-- ============================================================
-- TARGET Phase 5 — Batch 5 / File 18
-- Supersedes the functions defined in File 17.
--
-- Changes vs File 17:
--
--   1. handle_user_signup_hook — invitation path REMOVED.
--      The hook now only does minimal user bootstrap:
--        - INSERT public.users (id, email)
--        - INSERT user_preferences (user_id)  ← org_id = NULL
--      Invitation acceptance is handled exclusively by
--      accept_invitation_and_join_org(), called from:
--        a. /auth/callback (after email confirmation with invitation_token)
--        b. /invite/[token] page (manual review + accept)
--      Having the hook also accept invitations created a duplicate
--      processing path with race conditions and conflicting state.
--
--   2. create_organization_for_current_user — three fixes:
--      a. Plan validation: if p_plan_id is provided but the plan
--         does not exist or is not active, fall back explicitly to
--         the free plan and raise a NOTICE (not a silent ignore).
--         Returns NO_VALID_PLAN if even free plan is missing.
--      b. last_branch_id: set alongside default_branch_id in the
--         user_preferences upsert so both preference pointers are
--         initialized for the first dashboard load.
--      c. Function signature unchanged — no client-side updates needed.
--
--   3. subscription_plans UPDATE — plan compatibility fix:
--      Ensures all active plans include 'organization-management'
--      in enabled_modules. Without this, users who select the free
--      or professional plan during onboarding are immediately locked
--      out of org management (which is gated by entitlements).
--      enterprise already includes it; free + professional do not.
--      This UPDATE is idempotent (WHERE NOT enabled_modules @> ...).
--
-- Dependencies : File 17 (functions being replaced), all Batch 1-4
-- Applied to   : TARGET project only
-- ============================================================

-- ============================================================
-- 1. Minimal handle_user_signup_hook
--    Only responsibility: bootstrap public.users + user_preferences.
--    Invitation acceptance is NOT handled here.
-- ============================================================
create or replace function public.handle_user_signup_hook(event jsonb)
  returns jsonb
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_user_id uuid;
  v_email   text;
  v_meta    jsonb;
begin
  v_user_id := (event->>'userId')::uuid;
  v_meta    := event->'userMetaData';
  v_email   := coalesce(v_meta->>'email', event->>'email', '');

  -- Ensure public.users row exists.
  -- The organization_members and user_preferences tables have FKs
  -- to public.users (not auth.users), so this insert must precede any
  -- downstream org-join operations (which happen in accept_invitation_and_join_org).
  insert into public.users (id, email)
  values (v_user_id, v_email)
  on conflict (id) do nothing;

  -- Create empty user_preferences (organization_id = NULL).
  -- loadAppContextV2 resolves activeOrgId = null → dashboard layout
  -- redirects to /onboarding, which routes the user to either the
  -- onboarding wizard (self-starter) or the invite-pending screen.
  insert into public.user_preferences (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;

  return event;
end;
$$;

grant execute on function public.handle_user_signup_hook(jsonb)
  to supabase_auth_admin;

grant usage on schema public to supabase_auth_admin;

-- ============================================================
-- 2. create_organization_for_current_user (revised)
--    Fixes vs File 17:
--      - Plan validation with explicit fallback + NOTICE
--      - last_branch_id initialized alongside default_branch_id
--      - NO_VALID_PLAN error if no usable plan exists in DB
-- ============================================================
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

  -- Validate name
  if p_name is null or trim(p_name) = '' then
    return jsonb_build_object('success', false, 'error', 'INVALID_NAME');
  end if;

  -- Idempotency guard: user already has an org-scoped role assignment.
  -- Return the existing org rather than creating a duplicate.
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

  -- ── Plan resolution (validated, explicit fallback) ───────────
  -- Step 1: validate the caller-supplied plan_id.
  if p_plan_id is not null then
    select id into v_resolved_plan_id
    from public.subscription_plans
    where id = p_plan_id
      and is_active = true
    limit 1;

    if v_resolved_plan_id is null then
      -- Plan not found or inactive: log and fall through to free plan.
      raise notice 'create_organization_for_current_user: plan_id % not found or inactive, falling back to free plan', p_plan_id;
    end if;
  end if;

  -- Step 2: fallback to free plan if no valid plan resolved yet.
  if v_resolved_plan_id is null then
    select id into v_resolved_plan_id
    from public.subscription_plans
    where name = 'free'
      and is_active = true
    limit 1;
  end if;

  -- Step 3: no usable plan at all — DB is not seeded correctly.
  if v_resolved_plan_id is null then
    return jsonb_build_object('success', false, 'error', 'NO_VALID_PLAN');
  end if;

  -- ── Role resolution ──────────────────────────────────────────
  select id into v_org_owner_role_id
  from public.roles
  where name = 'org_owner'
    and is_basic = true
  limit 1;

  -- ── Slug generation ──────────────────────────────────────────
  v_org_slug := lower(regexp_replace(trim(p_name), '[^a-z0-9]+', '-', 'g'))
    || '-' || substr(gen_random_uuid()::text, 1, 8);

  v_branch_name := coalesce(nullif(trim(p_branch_name), ''), 'Main Branch');
  v_branch_slug := lower(regexp_replace(v_branch_name, '[^a-z0-9]+', '-', 'g'));

  -- ── Ensure public.users row ──────────────────────────────────
  -- Defensive: may already exist from signup hook.
  select email into v_email from auth.users where id = v_user_id;
  insert into public.users (id, email)
  values (v_user_id, v_email)
  on conflict (id) do nothing;

  -- ── Create organization ──────────────────────────────────────
  insert into public.organizations (name, slug, created_by)
  values (trim(p_name), v_org_slug, v_user_id)
  returning id into v_new_org_id;

  -- ── Create org profile ───────────────────────────────────────
  insert into public.organization_profiles (organization_id)
  values (v_new_org_id)
  on conflict (organization_id) do nothing;

  -- ── Create default branch ────────────────────────────────────
  insert into public.branches (organization_id, name, slug)
  values (v_new_org_id, v_branch_name, v_branch_slug)
  returning id into v_new_branch_id;

  -- ── Add org member ───────────────────────────────────────────
  insert into public.organization_members (user_id, organization_id)
  values (v_user_id, v_new_org_id)
  on conflict (user_id, organization_id) do nothing;

  -- ── Assign org_owner role ────────────────────────────────────
  if v_org_owner_role_id is not null then
    insert into public.user_role_assignments (user_id, role_id, scope, scope_id)
    values (v_user_id, v_org_owner_role_id, 'org', v_new_org_id)
    on conflict (user_id, role_id, scope, scope_id) do nothing;
  end if;

  -- ── Create subscription ──────────────────────────────────────
  insert into public.organization_subscriptions (organization_id, plan_id, status)
  values (v_new_org_id, v_resolved_plan_id, 'active')
  on conflict (organization_id) do nothing;

  -- ── Compute entitlements + permissions ───────────────────────
  perform public.recompute_organization_entitlements(v_new_org_id);
  perform public.compile_user_permissions(v_user_id, v_new_org_id);

  -- ── Update user_preferences ──────────────────────────────────
  -- Sets both default_branch_id and last_branch_id to the new branch.
  -- last_branch_id is initialized here so the first dashboard load
  -- has both preference pointers populated, avoiding null edge cases.
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

-- ============================================================
-- 3. Plan compatibility fix
--    Add 'organization-management' to all active plans that do
--    not already include it. Without this, users who onboard on
--    the free or professional plan are locked out of org management
--    (which is gated by enabled_modules entitlement check).
--
--    enabled_modules is text[] — use array operators, not jsonb.
--    coalesce handles any NULL column values defensively.
--    array_append + NOT ANY guard ensures idempotent, no duplicates.
-- ============================================================
update public.subscription_plans
set enabled_modules = array_append(coalesce(enabled_modules, '{}'::text[]), 'organization-management')
where is_active = true
  and not ('organization-management' = any(coalesce(enabled_modules, '{}'::text[])));
