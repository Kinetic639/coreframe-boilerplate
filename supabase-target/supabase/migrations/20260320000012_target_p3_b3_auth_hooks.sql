-- ============================================================
-- TARGET Phase 1 — Batch 3 / File 12
-- Functions: custom_access_token_hook(event jsonb),
--            handle_user_signup_hook(event jsonb)
-- Grants: EXECUTE on both hooks to supabase_auth_admin
-- ============================================================
-- Purpose      : Auth hooks that run under supabase_auth_admin:
--
--   custom_access_token_hook: enriches JWTs with the user's
--     role assignments (roles[] in claims).
--
--   handle_user_signup_hook: fires on new user creation.
--     - Invitation path: joins org, assigns invitation roles.
--     - Regular path: creates org, creates subscription on
--       the free plan, calls recompute_organization_entitlements.
--
-- Dependencies : all Batch 1 tables (users, organizations,
--                branches, organization_members, user_preferences)
--                all Batch 2 tables (roles, user_role_assignments,
--                user_effective_permissions)
--                all Batch 3 tables + recompute function (Files 9-11)
-- Applied to   : TARGET project only
-- ============================================================
-- Deviations from LEGACY handle_user_signup_hook:
--
--   1. No hardcoded role UUIDs. LEGACY uses a CONSTANT UUID for
--      org_member. TARGET resolves both system roles by name:
--        SELECT id FROM public.roles
--        WHERE name = 'org_member' AND is_basic = true
--      Safe because File 11 seeds the preserved LEGACY UUIDs —
--      same result, no UUID embedded in function code.
--
--   2. Subscription creation on new org. LEGACY does NOT create
--      an organization_subscriptions row or call
--      recompute_organization_entitlements after org creation.
--      TARGET adds:
--        a. INSERT INTO organization_subscriptions (free plan)
--        b. CALL recompute_organization_entitlements(new_org_id)
--      This ensures every org has an entitlements row from birth.
--
--   3. Scope check before each role assignment. LEGACY's invitation
--      path inserts into user_role_assignments without checking
--      scope_type, causing validate_role_assignment_scope() trigger
--      to raise EXCEPTION for branch-scoped roles assigned at org
--      scope. TARGET checks role.scope_type per IRA row.
--
--   4. invitation_role_assignments support. TARGET copies rows from
--      invitation_role_assignments → user_role_assignments, with
--      per-row scope_type validation. Falls back to org_member if
--      no IRA rows are valid/present.
--
--   5. branches.is_default does NOT exist in TARGET Batch 1.
--      The branches table has: id, organization_id, name,
--      created_at, deleted_at, slug. The is_default column was
--      intentionally excluded from the TARGET schema. The default
--      branch insert uses only the columns that exist.
--
--   6. Invitation path: user_preferences.default_branch_id left
--      NULL. See comment in the invitation path below for rationale.
--
--   7. SET search_path = '' on both hooks (TARGET hardening).
--      custom_access_token_hook previously used search_path='public'
--      in LEGACY; TARGET aligns it with the stricter pattern and
--      uses fully-qualified table names throughout.
-- ============================================================

-- ============================================================
-- custom_access_token_hook(event jsonb)
-- Enriches every JWT with the user's current role assignments.
-- Injects 'roles' into app_metadata claims.
-- STABLE SECURITY DEFINER: reads only, no writes.
-- SET search_path = '': all names fully-qualified (TARGET hardening).
-- LEGACY used search_path = 'public' with unqualified names;
-- TARGET aligns with the stricter pattern used by all other
-- SECURITY DEFINER functions in this schema.
-- ============================================================
create or replace function public.custom_access_token_hook(event jsonb)
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
as $$
declare
  claims      jsonb;
  v_user_id   uuid;
  roles_data  jsonb;
begin
  v_user_id := (event->>'userId')::uuid;
  claims    := event->'claims';

  -- Build roles array from user_role_assignments joined to roles.
  -- Includes role name, is_basic, scope, scope_id for downstream use.
  -- All table references fully-qualified (search_path = '').
  select jsonb_agg(
    jsonb_build_object(
      'role_id',    ura.role_id,
      'name',       r.name,
      'is_basic',   r.is_basic,
      'scope',      ura.scope,
      'scope_id',   ura.scope_id,
      'scope_type', r.scope_type
    )
  )
  into roles_data
  from public.user_role_assignments ura
  join public.roles r on r.id = ura.role_id
  where ura.user_id = v_user_id
    and ura.deleted_at is null
    and r.deleted_at is null;

  -- Inject roles into app_metadata claims.
  claims := jsonb_set(
    claims,
    '{app_metadata}',
    coalesce(claims->'app_metadata', '{}'::jsonb)
      || jsonb_build_object('roles', coalesce(roles_data, '[]'::jsonb))
  );

  return jsonb_set(event, '{claims}', claims);
end;
$$;

-- ============================================================
-- handle_user_signup_hook(event jsonb)
-- Fires on new auth.users creation.
-- Two paths:
--   Invitation: joins existing org; copies invitation role assignments.
--   Regular: creates new org, org_profile, default branch,
--            subscription (free plan), entitlements, user_preferences.
-- SECURITY DEFINER, SET search_path = ''.
-- ============================================================
create or replace function public.handle_user_signup_hook(event jsonb)
  returns jsonb
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_user_id            uuid;
  v_email              text;
  v_first_name         text;
  v_last_name          text;
  v_meta               jsonb;

  v_invitation_id      uuid;
  v_invitation         record;
  v_invitation_org_id  uuid;

  v_org_owner_role_id  uuid;
  v_org_member_role_id uuid;

  v_new_org_id         uuid;
  v_new_branch_id      uuid;
  v_free_plan_id       uuid;

  v_ira_row            record;
  v_assigned_count     int := 0;
begin
  -- ── Extract user identity ────────────────────────────────────
  v_user_id    := (event->>'userId')::uuid;
  v_meta       := event->'userMetaData';
  v_email      := coalesce(v_meta->>'email', event->>'email', '');
  v_first_name := coalesce(v_meta->>'first_name', '');
  v_last_name  := coalesce(v_meta->>'last_name', '');

  -- ── Ensure public.users row exists ──────────────────────────
  -- Upsert: may already exist if auth.users was created without hook.
  insert into public.users (id, email)
  values (v_user_id, v_email)
  on conflict (id) do nothing;

  -- ── Resolve system role UUIDs by name (no hardcoded UUIDs) ──
  select id into v_org_member_role_id
  from public.roles
  where name = 'org_member' and is_basic = true
  limit 1;

  select id into v_org_owner_role_id
  from public.roles
  where name = 'org_owner' and is_basic = true
  limit 1;

  -- ── Resolve free plan UUID by name ──────────────────────────
  select id into v_free_plan_id
  from public.subscription_plans
  where name = 'free' and is_active = true
  limit 1;

  -- ── Check for pending invitation ────────────────────────────
  v_invitation_id := (v_meta->>'invitation_id')::uuid;

  if v_invitation_id is not null then
    -- ── Invitation path ──────────────────────────────────────
    select *
    into v_invitation
    from public.invitations
    where id = v_invitation_id
      and status = 'pending'
    limit 1;

    if v_invitation is not null then
      v_invitation_org_id := v_invitation.organization_id;

      -- Upsert organization_members row.
      insert into public.organization_members (user_id, organization_id)
      values (v_user_id, v_invitation_org_id)
      on conflict (user_id, organization_id) do nothing;

      -- Set user_preferences to the invited org.
      -- default_branch_id intentionally left NULL here.
      -- Rationale: for an org-scoped invitation, we do not know
      -- which branch the user should land on — that depends on their
      -- branch-scoped role assignments, which vary per invitation.
      -- The app's loadDashboardContextV2 already handles NULL
      -- default_branch_id by falling back to the first accessible
      -- branch (computed server-side via accessibleBranches). Setting
      -- a branch here could land the user on one they cannot access.
      insert into public.user_preferences (user_id, organization_id)
      values (v_user_id, v_invitation_org_id)
      on conflict (user_id) do update
        set organization_id = excluded.organization_id;

      -- Copy invitation_role_assignments → user_role_assignments.
      -- Per-row scope_type check prevents validate_role_assignment_scope
      -- trigger from raising EXCEPTION for scope mismatches.
      for v_ira_row in
        select ira.role_id, ira.scope, ira.scope_id, r.scope_type
        from public.invitation_role_assignments ira
        join public.roles r on r.id = ira.role_id
        where ira.invitation_id = v_invitation_id
      loop
        -- Skip org-only roles assigned at branch scope and vice versa.
        if v_ira_row.scope_type = 'org' and v_ira_row.scope != 'org' then
          continue;
        end if;
        if v_ira_row.scope_type = 'branch' and v_ira_row.scope != 'branch' then
          continue;
        end if;

        insert into public.user_role_assignments (
          user_id, role_id, scope, scope_id
        )
        values (
          v_user_id,
          v_ira_row.role_id,
          v_ira_row.scope,
          v_ira_row.scope_id
        )
        on conflict (user_id, role_id, scope, scope_id) do nothing;

        v_assigned_count := v_assigned_count + 1;
      end loop;

      -- Fallback: assign org_member if no IRA rows were valid/present.
      if v_assigned_count = 0 and v_org_member_role_id is not null then
        insert into public.user_role_assignments (
          user_id, role_id, scope, scope_id
        )
        values (
          v_user_id,
          v_org_member_role_id,
          'org',
          v_invitation_org_id
        )
        on conflict (user_id, role_id, scope, scope_id) do nothing;
      end if;

      -- Mark invitation as accepted.
      update public.invitations
      set status = 'accepted'
      where id = v_invitation_id;

      -- Compile permissions for the new member.
      perform public.compile_user_permissions(v_user_id, v_invitation_org_id);

    end if; -- invitation found

    return event;
  end if; -- invitation path

  -- ── Regular signup path ──────────────────────────────────────

  -- Create the organization.
  insert into public.organizations (name, slug)
  values (
    coalesce(
      nullif(trim(v_first_name || ' ' || v_last_name), ''),
      split_part(v_email, '@', 1)
    ) || '''s Organization',
    lower(regexp_replace(
      coalesce(
        nullif(trim(v_first_name || ' ' || v_last_name), ''),
        split_part(v_email, '@', 1)
      ),
      '[^a-z0-9]+', '-', 'g'
    )) || '-' || substr(gen_random_uuid()::text, 1, 8)
  )
  returning id into v_new_org_id;

  -- Create org profile.
  insert into public.organization_profiles (organization_id)
  values (v_new_org_id)
  on conflict (organization_id) do nothing;

  -- Create default branch.
  -- branches.is_default does NOT exist in TARGET Batch 1 (deviation 5).
  -- The TARGET branches table columns are: id, organization_id, name,
  -- created_at, deleted_at, slug. No is_default column.
  insert into public.branches (organization_id, name, slug)
  values (v_new_org_id, 'Main Branch', 'main')
  returning id into v_new_branch_id;

  -- Add user as org member.
  insert into public.organization_members (user_id, organization_id)
  values (v_user_id, v_new_org_id)
  on conflict (user_id, organization_id) do nothing;

  -- Set user preferences: default org + default branch.
  -- For regular signup the branch is known (just created above),
  -- so we set default_branch_id immediately.
  insert into public.user_preferences (
    user_id, organization_id, default_branch_id
  )
  values (v_user_id, v_new_org_id, v_new_branch_id)
  on conflict (user_id) do update
    set organization_id   = excluded.organization_id,
        default_branch_id = excluded.default_branch_id;

  -- Assign org_owner role at org scope.
  if v_org_owner_role_id is not null then
    insert into public.user_role_assignments (
      user_id, role_id, scope, scope_id
    )
    values (
      v_user_id,
      v_org_owner_role_id,
      'org',
      v_new_org_id
    )
    on conflict (user_id, role_id, scope, scope_id) do nothing;
  end if;

  -- ── TARGET ADDITION: Create free subscription ────────────────
  -- LEGACY does not create a subscription row on signup.
  -- TARGET ensures every org has one from birth so that
  -- recompute_organization_entitlements always finds a plan.
  if v_free_plan_id is not null then
    insert into public.organization_subscriptions (
      organization_id,
      plan_id,
      status
    )
    values (
      v_new_org_id,
      v_free_plan_id,
      'active'
    )
    on conflict (organization_id) do nothing;
  end if;

  -- ── TARGET ADDITION: Compute entitlements ────────────────────
  -- The AFTER trigger on organization_subscriptions fires within
  -- this same transaction and will call recompute automatically.
  -- We call it explicitly here as well so the entitlements row
  -- is guaranteed to exist before the hook returns, regardless
  -- of trigger execution ordering within the transaction.
  perform public.recompute_organization_entitlements(v_new_org_id);

  -- Compile permissions for the new owner.
  perform public.compile_user_permissions(v_user_id, v_new_org_id);

  return event;
end;
$$;

-- ============================================================
-- EXECUTE grants to supabase_auth_admin
-- Both hook functions must be callable by supabase_auth_admin
-- (the role Supabase uses when invoking pg-function hooks).
-- ============================================================
grant execute on function public.custom_access_token_hook(jsonb)
  to supabase_auth_admin;

grant execute on function public.handle_user_signup_hook(jsonb)
  to supabase_auth_admin;

-- USAGE on public schema: idempotent safety grant.
grant usage on schema public to supabase_auth_admin;
