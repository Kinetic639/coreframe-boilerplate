-- ============================================================
-- Update create_organization_for_current_user to accept
-- p_name_2 (secondary name) and p_slug (user-chosen slug).
-- Also populates organization_profiles.name / name_2.
-- ============================================================
create or replace function public.create_organization_for_current_user(
  p_name        text,
  p_branch_name text,
  p_plan_id     uuid default null,
  p_name_2      text default null,
  p_slug        text default null
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
  v_org_name_2        text;
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

  -- Idempotency guard
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
    order by created_at asc
    limit 1;
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
    where id = p_plan_id and is_active = true
    limit 1;
    if v_resolved_plan_id is null then
      raise notice 'create_organization_for_current_user: plan_id % not found or inactive, falling back to free plan', p_plan_id;
    end if;
  end if;

  if v_resolved_plan_id is null then
    select id into v_resolved_plan_id
    from public.subscription_plans
    where name = 'free' and is_active = true
    limit 1;
  end if;

  if v_resolved_plan_id is null then
    return jsonb_build_object('success', false, 'error', 'NO_VALID_PLAN');
  end if;

  -- Role resolution
  select id into v_org_owner_role_id
  from public.roles
  where name = 'org_owner' and is_basic = true
  limit 1;

  -- Slug: use user-provided slug if given, else auto-generate
  v_org_name_2 := nullif(trim(coalesce(p_name_2, '')), '');

  if p_slug is not null and trim(p_slug) != '' then
    v_org_slug := trim(p_slug);
    -- Race-condition guard: reject if slug already taken
    if exists (
      select 1 from public.organizations
      where slug = v_org_slug and deleted_at is null
    ) then
      return jsonb_build_object('success', false, 'error', 'SLUG_TAKEN');
    end if;
  else
    -- Auto-generate slug from combined name
    v_org_slug := lower(regexp_replace(
      trim(coalesce(trim(p_name) || case when v_org_name_2 is not null then ' ' || v_org_name_2 else '' end, trim(p_name))),
      '[^a-z0-9]+', '-', 'g'
    )) || '-' || substr(gen_random_uuid()::text, 1, 8);
  end if;

  v_branch_name := coalesce(nullif(trim(p_branch_name), ''), 'Main Branch');
  v_branch_slug := lower(regexp_replace(v_branch_name, '[^a-z0-9]+', '-', 'g'));

  -- Ensure public.users row
  select email into v_email from auth.users where id = v_user_id;
  insert into public.users (id, email) values (v_user_id, v_email) on conflict (id) do nothing;

  -- Create organization (with name_2)
  insert into public.organizations (name, name_2, slug, created_by)
  values (trim(p_name), v_org_name_2, v_org_slug, v_user_id)
  returning id into v_new_org_id;

  -- Create org profile (populate name + name_2 from input)
  insert into public.organization_profiles (organization_id, name, name_2)
  values (v_new_org_id, trim(p_name), v_org_name_2)
  on conflict (organization_id) do update
    set name   = excluded.name,
        name_2 = excluded.name_2;

  -- Create default branch
  insert into public.branches (organization_id, name, slug)
  values (v_new_org_id, v_branch_name, v_branch_slug)
  returning id into v_new_branch_id;

  -- Add org member
  insert into public.organization_members (user_id, organization_id)
  values (v_user_id, v_new_org_id)
  on conflict (user_id, organization_id) do nothing;

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
  insert into public.user_preferences (user_id, organization_id, default_branch_id, last_branch_id)
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

grant execute on function public.create_organization_for_current_user(text, text, uuid, text, text)
  to authenticated;
