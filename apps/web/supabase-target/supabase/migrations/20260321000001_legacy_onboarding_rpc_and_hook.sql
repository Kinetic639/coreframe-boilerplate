-- ============================================================
-- LEGACY: Add create_organization_for_current_user RPC +
--         Update handle_user_signup_hook to minimal bootstrap
--
-- Applied to LEGACY project (zlcnlalwfmmtusigeuyk) via
-- Supabase Management API (apply_migration is read-only on LEGACY).
--
-- Changes:
--   1. create_organization_for_current_user — ported from TARGET
--      File 19 with LEGACY-specific adaptations:
--      - organization_members unique constraint is (organization_id, user_id)
--      - user_role_assignments FK → auth.users (public.users still needed
--        for organization_members FK)
--      - Idempotency path also calls compile_user_permissions so users
--        whose org was created by the old signup hook get permissions compiled
--
--   2. handle_user_signup_hook — simplified to minimal bootstrap:
--      - Creates public.users (with first_name/last_name from metadata)
--      - Creates user_preferences (organization_id = NULL)
--      - Does NOT auto-create org → users go through onboarding wizard
--      - Invitation acceptance handled by accept_invitation_and_join_org
--        called from /auth/callback (not in hook)
-- ============================================================

-- ── 1. create_organization_for_current_user ──────────────────
create or replace function public.create_organization_for_current_user(
  p_name        text,
  p_branch_name text,
  p_plan_id     uuid default null
)
  returns jsonb
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_user_id           uuid;
  v_email             text;
  v_new_org_id        uuid;
  v_new_branch_id     uuid;
  v_org_owner_role_id uuid;
  v_resolved_plan_id  uuid;
  v_org_slug          text;
  v_branch_slug       text;
  v_branch_name       text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    return jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  end if;

  if p_name is null or trim(p_name) = '' then
    return jsonb_build_object('success', false, 'error', 'INVALID_NAME');
  end if;

  -- Idempotency guard: user already has an org-scoped role assignment.
  -- Also compile permissions so hook-created orgs are fully initialized.
  if exists (
    select 1 from public.user_role_assignments
    where user_id = v_user_id
      and scope = 'org'
      and deleted_at is null
  ) then
    select scope_id into v_new_org_id
    from public.user_role_assignments
    where user_id = v_user_id
      and scope = 'org'
      and deleted_at is null
    order by id asc
    limit 1;

    perform public.compile_user_permissions(v_user_id, v_new_org_id);

    return jsonb_build_object(
      'success',         true,
      'organization_id', v_new_org_id,
      'already_existed', true
    );
  end if;

  -- Plan resolution
  if p_plan_id is not null then
    select id into v_resolved_plan_id
    from public.subscription_plans
    where id = p_plan_id
      and is_active = true
    limit 1;

    if v_resolved_plan_id is null then
      raise notice 'create_organization_for_current_user: plan_id % not found or inactive, falling back to free plan', p_plan_id;
    end if;
  end if;

  if v_resolved_plan_id is null then
    select id into v_resolved_plan_id
    from public.subscription_plans
    where name = 'free'
      and is_active = true
    limit 1;
  end if;

  if v_resolved_plan_id is null then
    return jsonb_build_object('success', false, 'error', 'NO_VALID_PLAN');
  end if;

  -- Role resolution
  select id into v_org_owner_role_id
  from public.roles
  where name = 'org_owner'
    and is_basic = true
  limit 1;

  -- Slug generation
  v_org_slug := lower(regexp_replace(trim(p_name), '[^a-z0-9]+', '-', 'g'))
    || '-' || substr(gen_random_uuid()::text, 1, 8);

  v_branch_name := coalesce(nullif(trim(p_branch_name), ''), 'Main Branch');
  v_branch_slug := lower(regexp_replace(v_branch_name, '[^a-z0-9]+', '-', 'g'));

  -- Ensure public.users row (needed for organization_members FK)
  select email into v_email from auth.users where id = v_user_id;
  insert into public.users (id, email)
  values (v_user_id, v_email)
  on conflict (id) do nothing;

  -- Create organization
  insert into public.organizations (name, slug, created_by)
  values (trim(p_name), v_org_slug, v_user_id)
  returning id into v_new_org_id;

  -- Create org profile
  insert into public.organization_profiles (organization_id)
  values (v_new_org_id)
  on conflict (organization_id) do nothing;

  -- Create default branch
  insert into public.branches (organization_id, name, slug)
  values (v_new_org_id, v_branch_name, v_branch_slug)
  returning id into v_new_branch_id;

  -- Add org member (status has default 'active')
  insert into public.organization_members (organization_id, user_id)
  values (v_new_org_id, v_user_id)
  on conflict (organization_id, user_id) do nothing;

  -- Assign org_owner role
  if v_org_owner_role_id is not null then
    insert into public.user_role_assignments (user_id, role_id, scope, scope_id)
    values (v_user_id, v_org_owner_role_id, 'org', v_new_org_id)
    on conflict (user_id, role_id, scope, scope_id) do nothing;
  end if;

  -- Create subscription
  insert into public.organization_subscriptions (organization_id, plan_id, status)
  values (v_new_org_id, v_resolved_plan_id, 'active')
  on conflict (organization_id) do nothing;

  -- Compute entitlements + permissions
  perform public.recompute_organization_entitlements(v_new_org_id);
  perform public.compile_user_permissions(v_user_id, v_new_org_id);

  -- Update user_preferences
  insert into public.user_preferences (
    user_id, organization_id, default_branch_id, last_branch_id
  )
  values (v_user_id, v_new_org_id, v_new_branch_id, v_new_branch_id)
  on conflict (user_id) do update
    set organization_id   = excluded.organization_id,
        default_branch_id = excluded.default_branch_id,
        last_branch_id    = excluded.last_branch_id;

  return jsonb_build_object(
    'success',         true,
    'organization_id', v_new_org_id,
    'branch_id',       v_new_branch_id
  );
end;
$$;

grant execute on function public.create_organization_for_current_user(text, text, uuid)
  to authenticated;

-- ── 2. Minimal handle_user_signup_hook ───────────────────────
create or replace function public.handle_user_signup_hook(event jsonb)
  returns jsonb
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_user_id    uuid;
  v_email      text;
  v_first_name text;
  v_last_name  text;
begin
  v_user_id := (event->>'user_id')::uuid;
  v_email   := event->>'email';

  -- Read names from auth.users.raw_user_meta_data (reliable source)
  select
    nullif(trim(coalesce(raw_user_meta_data->>'first_name', '')), ''),
    nullif(trim(coalesce(raw_user_meta_data->>'last_name',  '')), '')
  into v_first_name, v_last_name
  from auth.users
  where id = v_user_id;

  -- Ensure public.users row exists
  insert into public.users (id, email, first_name, last_name, created_at)
  values (v_user_id, v_email, v_first_name, v_last_name, now())
  on conflict (id) do update
    set email      = excluded.email,
        first_name = coalesce(excluded.first_name, public.users.first_name),
        last_name  = coalesce(excluded.last_name,  public.users.last_name);

  -- Create empty user_preferences (organization_id = NULL).
  -- loadAppContextV2 resolves activeOrgId = null → redirect to /onboarding.
  insert into public.user_preferences (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;

  return event;

exception
  when others then
    raise log 'handle_user_signup_hook error: % %', sqlstate, sqlerrm;
    return event;
end;
$$;
