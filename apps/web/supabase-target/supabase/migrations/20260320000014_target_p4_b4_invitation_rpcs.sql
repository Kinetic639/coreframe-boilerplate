-- ============================================================
-- TARGET Phase 1 — Batch 4 / File 14
-- RPCs: check_invitation_eligibility
--       accept_invitation_and_join_org
--       decline_invitation
--       get_invitation_preview_by_token
--       get_my_pending_invitations
-- ============================================================
-- Purpose      : Invitation lifecycle RPCs. Called by PostgREST
--                (authenticated users) or directly from application
--                server actions.
-- Dependencies : invitations, invitation_role_assignments (File 13),
--                organization_members, user_role_assignments,
--                user_preferences, users, roles, branches,
--                organization_profiles (Batches 1–2)
-- Applied to   : TARGET project only
-- ============================================================
-- SECURITY model: all 5 RPCs are SECURITY DEFINER.
--   They call auth.uid() / auth.users to identify the caller
--   and perform writes that span multiple tables atomically.
--   SECURITY DEFINER is required because:
--     - invitations has FORCE RLS (writes from authenticated
--       context are policy-gated, but the RPC needs to write
--       across tables as a trusted function, not as the user)
--     - organization_members, user_role_assignments, etc. all
--       have FORCE RLS; SECURITY DEFINER runs as postgres and
--       bypasses it
-- ============================================================
-- LEGACY deviations (TARGET fixes):
--
--   1. check_invitation_eligibility: search_path changed from
--      'public' to '' (strict empty). Body already uses fully-
--      qualified public.* and auth.* names — no behavior change.
--
--   2. get_invitation_preview_by_token: search_path changed from
--      'public' to '' (same rationale). Body already qualified.
--
--   3. accept_invitation_and_join_org, decline_invitation,
--      get_my_pending_invitations: search_path was already ''
--      in LEGACY. Preserved as-is.
--
--   4. get_my_pending_invitations: uses inv.role_id (legacy
--      single-role join). When IRA rows exist, the role_name
--      returned is the legacy single-role value, not the IRA
--      summary. Preserved from LEGACY; the preview RPC
--      (get_invitation_preview_by_token) prefers IRA summary.
--
--   5. EXECUTE grants: LEGACY grants not captured by schema
--      inspection. TARGET adds explicit grants:
--        - TO authenticated: all 5 RPCs
--        - TO anon additionally: get_invitation_preview_by_token
--          (called before login on the invite accept page)
-- ============================================================

-- ============================================================
-- check_invitation_eligibility(p_org_id, p_email, p_inviter_id)
-- Returns {eligible: bool, reason?: text}
-- Reasons: SELF_INVITE, ALREADY_MEMBER, DUPLICATE_PENDING,
--          ALREADY_IN_ORG
-- Called by: admin invite flow before creating an invitation.
-- SECURITY DEFINER: reads auth.users.
-- search_path = '': LEGACY had 'public'; TARGET corrects to ''.
-- ============================================================
create or replace function public.check_invitation_eligibility(
  p_org_id    uuid,
  p_email     text,
  p_inviter_id uuid
)
  returns jsonb
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_norm_email text := lower(trim(p_email));
begin
  -- 1. Self-invite check
  if exists (
    select 1 from auth.users
    where id = p_inviter_id
      and lower(email) = v_norm_email
  ) then
    return jsonb_build_object('eligible', false, 'reason', 'SELF_INVITE');
  end if;

  -- 2. Already an active member of this org
  if exists (
    select 1
    from public.organization_members om
    join auth.users u on u.id = om.user_id
    where om.organization_id = p_org_id
      and om.status = 'active'
      and om.deleted_at is null
      and lower(u.email) = v_norm_email
  ) then
    return jsonb_build_object('eligible', false, 'reason', 'ALREADY_MEMBER');
  end if;

  -- 3. Already has a pending invite for this org
  if exists (
    select 1 from public.invitations
    where organization_id = p_org_id
      and lower(email)    = v_norm_email
      and status          = 'pending'
      and deleted_at is null
  ) then
    return jsonb_build_object('eligible', false, 'reason', 'DUPLICATE_PENDING');
  end if;

  -- 4. Already a member of any other organization
  if exists (
    select 1
    from public.organization_members om
    join auth.users u on u.id = om.user_id
    where om.organization_id <> p_org_id
      and om.status = 'active'
      and om.deleted_at is null
      and lower(u.email) = v_norm_email
  ) then
    return jsonb_build_object('eligible', false, 'reason', 'ALREADY_IN_ORG');
  end if;

  return jsonb_build_object('eligible', true);
end;
$$;

-- ============================================================
-- accept_invitation_and_join_org(p_token)
-- Returns {success: bool, organization_id?: uuid, error_code?: text}
-- Called by: authenticated invitee on the invite accept page.
-- Steps:
--   1. Authenticate caller via auth.uid()
--   2. Resolve org_member role by name (no hardcoded UUID)
--   3. Lock and validate invitation (token, status, expiry, email)
--   4. Upsert public.users row; apply invited names if blank
--   5. Upsert organization_members (create or reactivate)
--   6. Assign org_member baseline role
--   7. Copy IRA rows → user_role_assignments (scope_type validated)
--   8. Legacy fallback: role_id/branch_id on invitation (if no IRA)
--   9. Upsert user_preferences → invited org becomes active context
--  10. Mark invitation accepted
-- search_path = '' (matches LEGACY). All names fully-qualified.
-- ============================================================
create or replace function public.accept_invitation_and_join_org(
  p_token text
)
  returns jsonb
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_invitation         public.invitations%rowtype;
  v_current_user_id    uuid;
  v_current_email      text;
  v_org_member_role_id uuid;
  v_ira                record;
begin
  -- ── 1. Authenticate caller ────────────────────────────────────
  v_current_user_id := auth.uid();
  if v_current_user_id is null then
    return jsonb_build_object('success', false, 'error_code', 'NOT_AUTHENTICATED');
  end if;

  select email into v_current_email
    from auth.users
    where id = v_current_user_id;

  if v_current_email is null then
    return jsonb_build_object('success', false, 'error_code', 'USER_NOT_FOUND');
  end if;

  -- ── 2. Resolve org_member role dynamically ────────────────────
  -- No hardcoded UUID: resolve by name.
  select id into v_org_member_role_id
    from public.roles
    where name = 'org_member'
      and is_basic = true
      and deleted_at is null
    limit 1;

  if v_org_member_role_id is null then
    return jsonb_build_object('success', false, 'error_code', 'INTERNAL_ERROR');
  end if;

  -- ── 3. Lock and validate invitation ──────────────────────────
  select * into v_invitation
    from public.invitations
    where token = p_token
      and deleted_at is null
    for update;

  if not found then
    return jsonb_build_object('success', false, 'error_code', 'INVITE_NOT_FOUND');
  end if;

  if v_invitation.status != 'pending' then
    return jsonb_build_object('success', false, 'error_code', 'INVITE_NOT_PENDING');
  end if;

  if v_invitation.expires_at is not null and v_invitation.expires_at < now() then
    return jsonb_build_object('success', false, 'error_code', 'INVITE_EXPIRED');
  end if;

  if lower(v_invitation.email) != lower(v_current_email) then
    return jsonb_build_object('success', false, 'error_code', 'EMAIL_MISMATCH');
  end if;

  -- ── 4. Ensure public.users row exists ─────────────────────────
  insert into public.users (id, email, created_at)
    values (v_current_user_id, v_current_email, now())
    on conflict (id) do nothing;

  -- Apply invited names to public.users if still blank.
  if v_invitation.invited_first_name is not null
    or v_invitation.invited_last_name is not null
  then
    update public.users
      set first_name = coalesce(nullif(first_name, ''), v_invitation.invited_first_name),
          last_name  = coalesce(nullif(last_name,  ''), v_invitation.invited_last_name)
      where id = v_current_user_id;
  end if;

  -- ── 5. Create / reactivate org membership ─────────────────────
  insert into public.organization_members (organization_id, user_id, status, joined_at)
    values (v_invitation.organization_id, v_current_user_id, 'active', now())
    on conflict (organization_id, user_id) do update
      set status     = 'active',
          deleted_at = null,
          updated_at = now();

  -- ── 6. Assign org_member baseline role ────────────────────────
  insert into public.user_role_assignments (user_id, role_id, scope, scope_id)
    values (v_current_user_id, v_org_member_role_id, 'org', v_invitation.organization_id)
    on conflict (user_id, role_id, scope, scope_id) do update
      set deleted_at = null;

  -- ── 7. Copy invitation_role_assignments → user_role_assignments ─
  -- Per-row scope_type check: prevents validate_role_assignment_scope
  -- trigger from raising EXCEPTION for incompatible scope assignments.
  -- scope_type 'both' is valid for either scope direction.
  for v_ira in
    select ira.role_id,
           ira.scope,
           case ira.scope
             when 'org'    then v_invitation.organization_id
             when 'branch' then ira.scope_id
           end as resolved_scope_id,
           r.scope_type
      from public.invitation_role_assignments ira
      join public.roles r on r.id = ira.role_id and r.deleted_at is null
     where ira.invitation_id = v_invitation.id
  loop
    -- Skip org-scoped IRA rows for branch-only roles.
    if v_ira.scope = 'org' and v_ira.scope_type not in ('org', 'both') then
      continue;
    end if;
    -- Skip branch-scoped IRA rows for org-only roles.
    if v_ira.scope = 'branch' and v_ira.scope_type not in ('branch', 'both') then
      continue;
    end if;
    -- Skip branch-scoped rows with null scope_id (misconfigured IRA).
    if v_ira.scope = 'branch' and v_ira.resolved_scope_id is null then
      continue;
    end if;

    insert into public.user_role_assignments (user_id, role_id, scope, scope_id)
      values (v_current_user_id, v_ira.role_id, v_ira.scope, v_ira.resolved_scope_id)
      on conflict (user_id, role_id, scope, scope_id) do update
        set deleted_at = null;
  end loop;

  -- ── 8. Legacy fallback: single role_id/branch_id on invitation ──
  -- Used only when no IRA rows exist (invitations created before
  -- the IRA migration was applied).
  if not exists (
    select 1 from public.invitation_role_assignments
    where invitation_id = v_invitation.id
  ) and v_invitation.role_id is not null then
    declare
      v_legacy_scope_type text;
    begin
      select scope_type into v_legacy_scope_type
        from public.roles
        where id = v_invitation.role_id and deleted_at is null;

      if v_legacy_scope_type is not null then
        if v_legacy_scope_type in ('org', 'both') then
          insert into public.user_role_assignments (user_id, role_id, scope, scope_id)
            values (v_current_user_id, v_invitation.role_id, 'org', v_invitation.organization_id)
            on conflict (user_id, role_id, scope, scope_id) do update
              set deleted_at = null;
        end if;
        if v_legacy_scope_type in ('branch', 'both') and v_invitation.branch_id is not null then
          insert into public.user_role_assignments (user_id, role_id, scope, scope_id)
            values (v_current_user_id, v_invitation.role_id, 'branch', v_invitation.branch_id)
            on conflict (user_id, role_id, scope, scope_id) do update
              set deleted_at = null;
        end if;
      end if;
    end;
  end if;

  -- ── 9. Update user_preferences ────────────────────────────────
  -- Invited org becomes the user's active org context.
  -- default_branch_id and last_branch_id cleared: caller does not
  -- know which branch the user can access; the app computes
  -- accessibleBranches server-side and falls back gracefully.
  insert into public.user_preferences (user_id, organization_id, created_at)
    values (v_current_user_id, v_invitation.organization_id, now())
    on conflict (user_id) do update
      set organization_id   = v_invitation.organization_id,
          default_branch_id = null,
          last_branch_id    = null,
          updated_at        = now();

  -- ── 10. Mark invitation accepted ──────────────────────────────
  update public.invitations
    set status      = 'accepted',
        accepted_at = now()
    where id = v_invitation.id;

  return jsonb_build_object(
    'success',         true,
    'organization_id', v_invitation.organization_id
  );

exception when others then
  return jsonb_build_object('success', false, 'error_code', 'INTERNAL_ERROR');
end;
$$;

-- ============================================================
-- decline_invitation(p_token)
-- Returns {success: bool, organization_id?: uuid, error_code?: text}
-- Called by: authenticated invitee declining an invitation.
-- Validates caller email matches invitation email.
-- search_path = '' (matches LEGACY).
-- ============================================================
create or replace function public.decline_invitation(
  p_token text
)
  returns jsonb
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_invitation      public.invitations%rowtype;
  v_current_user_id uuid;
  v_current_email   text;
begin
  v_current_user_id := auth.uid();
  if v_current_user_id is null then
    return jsonb_build_object('success', false, 'error_code', 'NOT_AUTHENTICATED');
  end if;

  select email into v_current_email
    from auth.users
    where id = v_current_user_id;

  if v_current_email is null then
    return jsonb_build_object('success', false, 'error_code', 'USER_NOT_FOUND');
  end if;

  select * into v_invitation
    from public.invitations
    where token = p_token
      and deleted_at is null
    for update;

  if not found then
    return jsonb_build_object('success', false, 'error_code', 'INVITE_NOT_FOUND');
  end if;

  if v_invitation.status != 'pending' then
    return jsonb_build_object('success', false, 'error_code', 'INVITE_NOT_PENDING');
  end if;

  if lower(v_invitation.email) != lower(v_current_email) then
    return jsonb_build_object('success', false, 'error_code', 'EMAIL_MISMATCH');
  end if;

  update public.invitations
    set status      = 'declined',
        declined_at = now()
    where id = v_invitation.id;

  return jsonb_build_object(
    'success',         true,
    'organization_id', v_invitation.organization_id
  );

exception when others then
  return jsonb_build_object('success', false, 'error_code', 'INTERNAL_ERROR');
end;
$$;

-- ============================================================
-- get_invitation_preview_by_token(p_token)
-- Returns invitation context for the invite landing page.
-- Accessible to anonymous users (called before login).
-- Returns reason_code, status, org name, role name, inviter name.
-- Prefers IRA role summary over legacy single role_id.
-- search_path = '': LEGACY had 'public'; TARGET corrects to ''.
-- ============================================================
create or replace function public.get_invitation_preview_by_token(
  p_token text
)
  returns jsonb
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_inv          public.invitations%rowtype;
  v_org_name     text;
  v_org_name_2   text;
  v_role_name    text;
  v_branch_name  text;
  v_inviter_name text;
  v_reason_code  text;
  v_ira_summary  text;
begin
  select * into v_inv
    from public.invitations
    where token = p_token
      and deleted_at is null;

  if not found then
    return jsonb_build_object('reason_code', 'INVITE_NOT_FOUND');
  end if;

  -- Map status to reason code.
  v_reason_code := case v_inv.status
    when 'pending'   then
      case when v_inv.expires_at is not null and v_inv.expires_at < now()
           then 'INVITE_EXPIRED'
           else 'INVITE_PENDING'
      end
    when 'accepted'  then 'INVITE_ACCEPTED'
    when 'declined'  then 'INVITE_DECLINED'
    when 'cancelled' then 'INVITE_CANCELLED'
    else 'INVITE_INVALID'
  end;

  -- Org name + name_2.
  select op.name, op.name_2 into v_org_name, v_org_name_2
    from public.organization_profiles op
    where op.organization_id = v_inv.organization_id
    limit 1;

  -- Role name: prefer IRA summary (comma-separated role names),
  -- fall back to legacy single role_id.
  select string_agg(r.name, ', ' order by r.name) into v_ira_summary
    from public.invitation_role_assignments ira
    join public.roles r on r.id = ira.role_id and r.deleted_at is null
    where ira.invitation_id = v_inv.id;

  if v_ira_summary is not null and v_ira_summary != '' then
    v_role_name := v_ira_summary;
  elsif v_inv.role_id is not null then
    select name into v_role_name
      from public.roles
      where id = v_inv.role_id and deleted_at is null;
  end if;

  -- Branch name from legacy branch_id.
  if v_inv.branch_id is not null then
    select name into v_branch_name
      from public.branches
      where id = v_inv.branch_id;
  end if;

  -- Inviter display name: first+last from public.users, fall back to email.
  if v_inv.invited_by is not null then
    select coalesce(
      nullif(trim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')), ''),
      email
    ) into v_inviter_name
    from public.users
    where id = v_inv.invited_by;
  end if;

  return jsonb_build_object(
    'reason_code',        v_reason_code,
    'status',             v_inv.status,
    'expires_at',         v_inv.expires_at,
    'invited_email',      v_inv.email,
    'invited_first_name', v_inv.invited_first_name,
    'invited_last_name',  v_inv.invited_last_name,
    'org_name',           v_org_name,
    'org_name_2',         v_org_name_2,
    'role_name',          v_role_name,
    'branch_name',        v_branch_name,
    'inviter_name',       v_inviter_name
  );
end;
$$;

-- ============================================================
-- get_my_pending_invitations()
-- Returns {success: bool, invitations: jsonb[]}
-- Lists all pending, unexpired invitations for the calling
-- user's email address.
-- Note: uses inv.role_id (legacy single-role join).
--   When IRA rows exist, role_name reflects the legacy field.
--   For full IRA-aware role display, use
--   get_invitation_preview_by_token per invitation.
-- search_path = '' (matches LEGACY).
-- ============================================================
create or replace function public.get_my_pending_invitations()
  returns jsonb
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_email   text;
  v_results jsonb;
begin
  select email into v_email
    from auth.users
    where id = auth.uid();

  if v_email is null then
    return jsonb_build_object('success', false, 'error', 'Not authenticated');
  end if;

  select jsonb_agg(
    jsonb_build_object(
      'id',          inv.id,
      'token',       inv.token,
      'expires_at',  inv.expires_at,
      'org_name',    op.name,
      'org_name_2',  op.name_2,
      'role_name',   r.name,
      'branch_name', b.name
    )
    order by inv.created_at desc
  )
  into v_results
  from public.invitations inv
  left join public.organization_profiles op
         on op.organization_id = inv.organization_id
  left join public.roles r
         on r.id = inv.role_id and r.deleted_at is null
  left join public.branches b
         on b.id = inv.branch_id and b.deleted_at is null
  where lower(inv.email) = lower(v_email)
    and inv.status       = 'pending'
    and (inv.expires_at is null or inv.expires_at > now())
    and inv.deleted_at   is null;

  return jsonb_build_object(
    'success',     true,
    'invitations', coalesce(v_results, '[]'::jsonb)
  );
end;
$$;

-- ============================================================
-- EXECUTE grants
-- All 5 RPCs granted to authenticated.
-- get_invitation_preview_by_token also granted to anon:
--   the invite landing page calls it before the user has logged
--   in (to display org/role context and check expiry).
-- ============================================================
grant execute on function public.check_invitation_eligibility(uuid, text, uuid)
  to authenticated;

grant execute on function public.accept_invitation_and_join_org(text)
  to authenticated;

grant execute on function public.decline_invitation(text)
  to authenticated;

grant execute on function public.get_invitation_preview_by_token(text)
  to anon, authenticated;

grant execute on function public.get_my_pending_invitations()
  to authenticated;
