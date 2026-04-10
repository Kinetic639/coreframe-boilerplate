-- ============================================================
-- Migration: Invite Decline + Onboarding Routing Support
-- Adds decline_invitation SECURITY DEFINER function and
-- updates get_invitation_preview_by_token to handle declined status.
-- ============================================================

-- ============================================================
-- 1. decline_invitation(p_token TEXT)
--    Authenticated only. Validates email match, marks invitation
--    as 'declined'. Safe, atomic, SECURITY DEFINER.
-- ============================================================
CREATE OR REPLACE FUNCTION public.decline_invitation(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_invitation       public.invitations%ROWTYPE;
  v_current_user_id  UUID;
  v_current_email    TEXT;
BEGIN
  v_current_user_id := auth.uid();
  IF v_current_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT email INTO v_current_email
    FROM auth.users
    WHERE id = v_current_user_id;

  IF v_current_email IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  SELECT * INTO v_invitation
    FROM public.invitations
    WHERE token = p_token
      AND deleted_at IS NULL
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invitation not found');
  END IF;

  IF v_invitation.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invitation is no longer pending');
  END IF;

  IF lower(v_invitation.email) != lower(v_current_email) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Email does not match invitation');
  END IF;

  UPDATE public.invitations
    SET status = 'declined'
    WHERE id = v_invitation.id;

  RETURN jsonb_build_object(
    'success', true,
    'organization_id', v_invitation.organization_id
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.decline_invitation(TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.decline_invitation(TEXT) FROM anon;

-- ============================================================
-- 2. Update get_invitation_preview_by_token to handle 'declined'
--    Maps declined status -> INVITE_DECLINED reason code.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_invitation_preview_by_token(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_inv         public.invitations%ROWTYPE;
  v_org_name    TEXT;
  v_role_name   TEXT;
  v_branch_name TEXT;
  v_reason      TEXT;
BEGIN
  IF p_token IS NULL OR length(trim(p_token)) < 8 THEN
    RETURN jsonb_build_object('reason_code', 'INVITE_INVALID');
  END IF;

  SELECT * INTO v_inv
    FROM public.invitations
    WHERE token = p_token
      AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('reason_code', 'INVITE_NOT_FOUND');
  END IF;

  IF v_inv.status = 'accepted' THEN
    v_reason := 'INVITE_ACCEPTED';
  ELSIF v_inv.status = 'cancelled' THEN
    v_reason := 'INVITE_CANCELLED';
  ELSIF v_inv.status = 'declined' THEN
    v_reason := 'INVITE_DECLINED';
  ELSIF v_inv.status = 'expired'
     OR (v_inv.expires_at IS NOT NULL AND v_inv.expires_at < now()) THEN
    v_reason := 'INVITE_EXPIRED';
  ELSIF v_inv.status = 'pending' THEN
    v_reason := 'INVITE_PENDING';
  ELSE
    v_reason := 'INVITE_INVALID';
  END IF;

  SELECT op.name INTO v_org_name
    FROM public.organization_profiles op
    WHERE op.organization_id = v_inv.organization_id
    LIMIT 1;

  IF v_inv.role_id IS NOT NULL THEN
    SELECT r.name INTO v_role_name
      FROM public.roles r
      WHERE r.id = v_inv.role_id
        AND r.deleted_at IS NULL;
  END IF;

  IF v_inv.branch_id IS NOT NULL THEN
    SELECT b.name INTO v_branch_name
      FROM public.branches b
      WHERE b.id = v_inv.branch_id
        AND b.deleted_at IS NULL;
  END IF;

  RETURN jsonb_build_object(
    'reason_code',   v_reason,
    'status',        v_inv.status,
    'expires_at',    v_inv.expires_at,
    'invited_email', v_inv.email,
    'org_name',      v_org_name,
    'role_name',     v_role_name,
    'branch_name',   v_branch_name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_invitation_preview_by_token(TEXT) TO anon, authenticated;
