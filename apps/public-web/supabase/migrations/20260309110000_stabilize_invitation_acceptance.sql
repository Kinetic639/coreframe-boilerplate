-- Stabilize accept_invitation_and_join_org for reliable baseline acceptance.
--
-- Root causes fixed:
--
-- 1. INTERNAL_ERROR: organization_members.user_id FK references public.users(id),
--    NOT auth.users. Users whose signup hook silently failed (branch-scoped role bug,
--    fixed in 20260309100000) have no public.users row. The INSERT into
--    organization_members threw a FK violation, caught by EXCEPTION WHEN OTHERS
--    and surfaced as INTERNAL_ERROR.
--
-- 2. Missing post-accept org context: the function did not update user_preferences,
--    so the user landed in their old org after acceptance instead of the invited org.
--
-- 3. Brittle hardcoded org_member UUID: replaced with canonical DB lookup.
--
-- 4. Stabilization: invited role assignment removed for this phase (org_member-only).
--    Role assignment will be re-added in a future phase once baseline is stable.

CREATE OR REPLACE FUNCTION public.accept_invitation_and_join_org(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_invitation        public.invitations%ROWTYPE;
  v_current_user_id   UUID;
  v_current_email     TEXT;
  v_org_member_role_id UUID;
BEGIN
  -- ── 1. Authenticate caller ────────────────────────────────────────────────
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

  -- ── 2. Resolve org_member role dynamically (no hardcoded UUID) ────────────
  SELECT id INTO v_org_member_role_id
    FROM public.roles
    WHERE name = 'org_member'
      AND is_basic = true
      AND deleted_at IS NULL
    LIMIT 1;

  IF v_org_member_role_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INTERNAL_ERROR');
  END IF;

  -- ── 3. Lock and validate invitation ──────────────────────────────────────
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

  -- ── 4. Ensure public.users row exists ─────────────────────────────────────
  -- Broken-hook users (signup hook failed silently due to branch-role scope
  -- mismatch) have a valid auth.users row but no public.users row.
  -- Without this, organization_members INSERT fails with FK violation.
  INSERT INTO public.users (id, email, created_at)
    VALUES (v_current_user_id, v_current_email, now())
    ON CONFLICT (id) DO NOTHING;

  -- ── 5. Create / reactivate org membership ────────────────────────────────
  INSERT INTO public.organization_members (organization_id, user_id, status, joined_at)
    VALUES (v_invitation.organization_id, v_current_user_id, 'active', now())
    ON CONFLICT (organization_id, user_id) DO UPDATE
      SET status     = 'active',
          deleted_at = NULL,
          updated_at = now();

  -- ── 6. Assign org_member baseline role ───────────────────────────────────
  -- Invited-role assignment is intentionally omitted in this stabilization
  -- phase. Only org_member is assigned. Additional role assignment will be
  -- added once baseline acceptance is confirmed stable.
  INSERT INTO public.user_role_assignments (user_id, role_id, scope, scope_id)
    VALUES (v_current_user_id, v_org_member_role_id, 'org', v_invitation.organization_id)
    ON CONFLICT (user_id, role_id, scope, scope_id) DO UPDATE
      SET deleted_at = NULL;

  -- ── 7. Update user_preferences → invited org becomes active context ──────
  -- This ensures the user lands in the invited org's dashboard after accept.
  -- Nulling branch IDs so the dashboard picks the first available branch.
  INSERT INTO public.user_preferences (user_id, organization_id, created_at)
    VALUES (v_current_user_id, v_invitation.organization_id, now())
    ON CONFLICT (user_id) DO UPDATE
      SET organization_id   = v_invitation.organization_id,
          default_branch_id = NULL,
          last_branch_id    = NULL,
          updated_at        = now();

  -- ── 8. Mark invitation accepted ──────────────────────────────────────────
  UPDATE public.invitations
    SET status      = 'accepted',
        accepted_at = now()
    WHERE id = v_invitation.id;

  RETURN jsonb_build_object(
    'success',         true,
    'organization_id', v_invitation.organization_id
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error_code', 'INTERNAL_ERROR');
END;
$function$;
