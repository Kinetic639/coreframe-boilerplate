-- =============================================================================
-- HARDENING PHASE 6: Legacy Cleanup
-- Goal:
--   1. Drop dead 3-param create_organization_for_current_user overload
--   2. Rewrite accept_invitation_and_join_org — remove legacy role_id/branch_id
--      fallback block; add explicit compile_user_permissions call
--   3. Rewrite get_my_pending_invitations — use IRA for role names
--   4. Rewrite get_invitation_preview_by_token — use IRA only (no legacy fallback)
--   5. Drop orphan columns: users.status_id, users.default_branch_id,
--      invitations.team_id, invitations.role_id, invitations.branch_id
--
-- RISK: Column drops are irreversible. The four RPCs are updated BEFORE
--       the columns are dropped so no function references the dropped columns.
-- =============================================================================

-- ─── 1. Drop dead 3-param overload ───────────────────────────────────────────
-- The 5-param version (p_name, p_branch_name, p_plan_id, p_name_2, p_slug)
-- is the only active version. The 3-param version omits slug and name_2.
DROP FUNCTION IF EXISTS public.create_organization_for_current_user(text, text, uuid);

-- ─── 2. Rewrite accept_invitation_and_join_org ───────────────────────────────
-- Changes vs previous version:
--   - Block 8 (legacy role_id/branch_id fallback) REMOVED
--   - Explicit compile_user_permissions call added after all role assignments
--     (belt-and-suspenders: trigger fires on INSERT but ON CONFLICT DO UPDATE
--     does not reliably fire INSERT triggers in all execution contexts)
CREATE OR REPLACE FUNCTION public.accept_invitation_and_join_org(p_token text)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  v_invitation         public.invitations%rowtype;
  v_current_user_id    uuid;
  v_current_email      text;
  v_org_member_role_id uuid;
  v_ira                record;
BEGIN
  -- ── 1. Authenticate caller ────────────────────────────────────
  v_current_user_id := auth.uid();
  IF v_current_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'NOT_AUTHENTICATED');
  END IF;

  SELECT email INTO v_current_email
    FROM auth.users
    WHERE id = v_current_user_id;

  IF v_current_email IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'USER_NOT_FOUND');
  END IF;

  -- ── 2. Resolve org_member role dynamically ────────────────────
  SELECT id INTO v_org_member_role_id
    FROM public.roles
    WHERE name     = 'org_member'
      AND is_basic = true
      AND deleted_at IS NULL
    LIMIT 1;

  IF v_org_member_role_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INTERNAL_ERROR');
  END IF;

  -- ── 3. Lock and validate invitation ──────────────────────────
  SELECT * INTO v_invitation
    FROM public.invitations
    WHERE token = p_token
      AND deleted_at IS NULL
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVITE_NOT_FOUND');
  END IF;

  IF v_invitation.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVITE_NOT_PENDING');
  END IF;

  IF v_invitation.expires_at IS NOT NULL AND v_invitation.expires_at < now() THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVITE_EXPIRED');
  END IF;

  IF lower(v_invitation.email) != lower(v_current_email) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'EMAIL_MISMATCH');
  END IF;

  -- ── 4. Ensure public.users row exists ─────────────────────────
  INSERT INTO public.users (id, email, created_at)
    VALUES (v_current_user_id, v_current_email, now())
    ON CONFLICT (id) DO NOTHING;

  -- Apply invited names to public.users if still blank.
  IF v_invitation.invited_first_name IS NOT NULL
    OR v_invitation.invited_last_name IS NOT NULL
  THEN
    UPDATE public.users
      SET first_name = coalesce(nullif(first_name, ''), v_invitation.invited_first_name),
          last_name  = coalesce(nullif(last_name,  ''), v_invitation.invited_last_name)
      WHERE id = v_current_user_id;
  END IF;

  -- ── 5. Create / reactivate org membership ─────────────────────
  INSERT INTO public.organization_members (organization_id, user_id, status, joined_at)
    VALUES (v_invitation.organization_id, v_current_user_id, 'active', now())
    ON CONFLICT (organization_id, user_id) DO UPDATE
      SET status     = 'active',
          deleted_at = NULL,
          updated_at = now();

  -- ── 6. Assign org_member baseline role ────────────────────────
  INSERT INTO public.user_role_assignments (user_id, role_id, scope, scope_id)
    VALUES (v_current_user_id, v_org_member_role_id, 'org', v_invitation.organization_id)
    ON CONFLICT (user_id, role_id, scope, scope_id) DO UPDATE
      SET deleted_at = NULL;

  -- ── 7. Copy invitation_role_assignments → user_role_assignments ─
  FOR v_ira IN
    SELECT ira.role_id,
           ira.scope,
           CASE ira.scope
             WHEN 'org'    THEN v_invitation.organization_id
             WHEN 'branch' THEN ira.scope_id
           END AS resolved_scope_id,
           r.scope_type
      FROM public.invitation_role_assignments ira
      JOIN public.roles r ON r.id = ira.role_id AND r.deleted_at IS NULL
     WHERE ira.invitation_id = v_invitation.id
  LOOP
    IF v_ira.scope = 'org'    AND v_ira.scope_type NOT IN ('org', 'both')    THEN CONTINUE; END IF;
    IF v_ira.scope = 'branch' AND v_ira.scope_type NOT IN ('branch', 'both') THEN CONTINUE; END IF;
    IF v_ira.scope = 'branch' AND v_ira.resolved_scope_id IS NULL            THEN CONTINUE; END IF;

    INSERT INTO public.user_role_assignments (user_id, role_id, scope, scope_id)
      VALUES (v_current_user_id, v_ira.role_id, v_ira.scope, v_ira.resolved_scope_id)
      ON CONFLICT (user_id, role_id, scope, scope_id) DO UPDATE
        SET deleted_at = NULL;
  END LOOP;

  -- ── 8. Update user_preferences ────────────────────────────────
  INSERT INTO public.user_preferences (user_id, organization_id, created_at)
    VALUES (v_current_user_id, v_invitation.organization_id, now())
    ON CONFLICT (user_id) DO UPDATE
      SET organization_id   = v_invitation.organization_id,
          default_branch_id = NULL,
          last_branch_id    = NULL,
          updated_at        = now();

  -- ── 9. Mark invitation accepted ───────────────────────────────
  UPDATE public.invitations
    SET status      = 'accepted',
        accepted_at = now()
    WHERE id = v_invitation.id;

  -- ── 10. Compile permissions ────────────────────────────────────
  -- Belt-and-suspenders: compile triggers fire on INSERT of URA rows,
  -- but ON CONFLICT DO UPDATE paths may not reliably fire INSERT triggers.
  -- An explicit compile call guarantees a consistent UEP after acceptance.
  PERFORM public.compile_user_permissions(v_current_user_id, v_invitation.organization_id);

  RETURN jsonb_build_object(
    'success',         true,
    'organization_id', v_invitation.organization_id
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error_code', 'INTERNAL_ERROR');
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_invitation_and_join_org(text)
  TO authenticated, service_role;

-- ─── 3. Rewrite get_my_pending_invitations ────────────────────────────────────
-- Uses IRA subquery for role names instead of legacy role_id join.
CREATE OR REPLACE FUNCTION public.get_my_pending_invitations()
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  v_email   text;
  v_results jsonb;
BEGIN
  SELECT email INTO v_email
    FROM auth.users
    WHERE id = auth.uid();

  IF v_email IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'id',         inv.id,
      'token',      inv.token,
      'expires_at', inv.expires_at,
      'org_name',   op.name,
      'org_name_2', op.name_2,
      'role_name',  (
        SELECT string_agg(r2.name, ', ' ORDER BY r2.name)
        FROM public.invitation_role_assignments ira2
        JOIN public.roles r2 ON r2.id = ira2.role_id AND r2.deleted_at IS NULL
        WHERE ira2.invitation_id = inv.id
      )
    )
    ORDER BY inv.created_at DESC
  )
  INTO v_results
  FROM public.invitations inv
  LEFT JOIN public.organization_profiles op
         ON op.organization_id = inv.organization_id
  WHERE lower(inv.email) = lower(v_email)
    AND inv.status       = 'pending'
    AND (inv.expires_at IS NULL OR inv.expires_at > now())
    AND inv.deleted_at   IS NULL;

  RETURN jsonb_build_object(
    'success',     true,
    'invitations', coalesce(v_results, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_pending_invitations()
  TO authenticated, service_role;

-- ─── 4. Rewrite get_invitation_preview_by_token ───────────────────────────────
-- Uses IRA for role_name and branch_name; removes all legacy role_id/branch_id
-- fallback references. branch_name is now derived from IRA scope_ids.
CREATE OR REPLACE FUNCTION public.get_invitation_preview_by_token(p_token text)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  v_inv          public.invitations%rowtype;
  v_org_name     text;
  v_org_name_2   text;
  v_role_name    text;
  v_branch_name  text;
  v_inviter_name text;
  v_reason_code  text;
BEGIN
  SELECT * INTO v_inv
    FROM public.invitations
    WHERE token     = p_token
      AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('reason_code', 'INVITE_NOT_FOUND');
  END IF;

  v_reason_code := CASE v_inv.status
    WHEN 'pending'  THEN
      CASE WHEN v_inv.expires_at IS NOT NULL AND v_inv.expires_at < now()
           THEN 'INVITE_EXPIRED'
           ELSE 'INVITE_PENDING'
      END
    WHEN 'accepted'  THEN 'INVITE_ACCEPTED'
    WHEN 'declined'  THEN 'INVITE_DECLINED'
    WHEN 'cancelled' THEN 'INVITE_CANCELLED'
    ELSE 'INVITE_INVALID'
  END;

  -- Org name + name_2.
  SELECT op.name, op.name_2
    INTO v_org_name, v_org_name_2
    FROM public.organization_profiles op
    WHERE op.organization_id = v_inv.organization_id
    LIMIT 1;

  -- Role name: IRA summary only (no legacy role_id fallback).
  SELECT string_agg(r.name, ', ' ORDER BY r.name)
    INTO v_role_name
    FROM public.invitation_role_assignments ira
    JOIN public.roles r ON r.id = ira.role_id AND r.deleted_at IS NULL
    WHERE ira.invitation_id = v_inv.id;

  -- Branch name: from branch-scoped IRA rows.
  SELECT string_agg(b.name, ', ' ORDER BY b.name)
    INTO v_branch_name
    FROM public.invitation_role_assignments ira
    JOIN public.branches b ON b.id = ira.scope_id AND b.deleted_at IS NULL
    WHERE ira.invitation_id = v_inv.id
      AND ira.scope = 'branch';

  -- Inviter display name.
  IF v_inv.invited_by IS NOT NULL THEN
    SELECT coalesce(
      nullif(trim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')), ''),
      email
    )
      INTO v_inviter_name
      FROM public.users
      WHERE id = v_inv.invited_by;
  END IF;

  RETURN jsonb_build_object(
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
END;
$$;

-- get_invitation_preview_by_token is legitimately public (pre-login preview).
GRANT EXECUTE ON FUNCTION public.get_invitation_preview_by_token(text)
  TO authenticated, anon, service_role;

-- ─── 5. Drop orphan columns ──────────────────────────────────────────────────
-- users.status_id: no FK, no code reference, no value; confirmed unused.
-- users.default_branch_id: no FK; duplicated by user_preferences.default_branch_id.
ALTER TABLE public.users DROP COLUMN IF EXISTS status_id;
ALTER TABLE public.users DROP COLUMN IF EXISTS default_branch_id;

-- invitations.team_id: teams module not implemented; no code reference.
-- invitations.role_id: legacy single-role invite; fallback removed from RPCs above.
-- invitations.branch_id: legacy single-branch invite; fallback removed from RPCs above.
ALTER TABLE public.invitations DROP COLUMN IF EXISTS team_id;
ALTER TABLE public.invitations DROP COLUMN IF EXISTS role_id;
ALTER TABLE public.invitations DROP COLUMN IF EXISTS branch_id;
