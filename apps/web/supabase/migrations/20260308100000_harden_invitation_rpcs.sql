-- ─── 1. Add declined_at column ───────────────────────────────────────────────
ALTER TABLE public.invitations
  ADD COLUMN IF NOT EXISTS declined_at TIMESTAMPTZ;

-- ─── 2. Revoke PUBLIC execute from all 4 invitation functions ────────────────
REVOKE EXECUTE ON FUNCTION public.accept_invitation_and_join_org(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.decline_invitation(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_invitation_preview_by_token(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_my_pending_invitations() FROM PUBLIC;

-- ─── 3. Harden accept_invitation_and_join_org ────────────────────────────────
CREATE OR REPLACE FUNCTION public.accept_invitation_and_join_org(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_invitation       public.invitations%ROWTYPE;
  v_current_user_id  UUID;
  v_current_email    TEXT;
  v_org_member_role_id UUID := 'fc5d6871-e442-4e49-94bd-4668b3dde4f7';
BEGIN
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

  IF v_invitation.expires_at < now() THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVITE_EXPIRED');
  END IF;

  IF lower(v_invitation.email) != lower(v_current_email) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'EMAIL_MISMATCH');
  END IF;

  INSERT INTO public.organization_members (organization_id, user_id, status, joined_at)
    VALUES (v_invitation.organization_id, v_current_user_id, 'active', now())
    ON CONFLICT (organization_id, user_id) DO UPDATE
      SET status = 'active',
          deleted_at = NULL,
          updated_at = now();

  INSERT INTO public.user_role_assignments (user_id, role_id, scope, scope_id)
    VALUES (v_current_user_id, v_org_member_role_id, 'org', v_invitation.organization_id)
    ON CONFLICT (user_id, role_id, scope, scope_id) DO UPDATE
      SET deleted_at = NULL;

  IF v_invitation.role_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.roles
      WHERE id = v_invitation.role_id
        AND scope_type IN ('org', 'both')
    ) THEN
      INSERT INTO public.user_role_assignments (user_id, role_id, scope, scope_id)
        VALUES (v_current_user_id, v_invitation.role_id, 'org', v_invitation.organization_id)
        ON CONFLICT (user_id, role_id, scope, scope_id) DO UPDATE
          SET deleted_at = NULL;
    END IF;
  END IF;

  UPDATE public.invitations
    SET status = 'accepted',
        accepted_at = now()
    WHERE id = v_invitation.id;

  RETURN jsonb_build_object(
    'success', true,
    'organization_id', v_invitation.organization_id
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error_code', 'INTERNAL_ERROR');
END;
$$;

-- ─── 4. Harden decline_invitation ───────────────────────────────────────────
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
    RETURN jsonb_build_object('success', false, 'error_code', 'NOT_AUTHENTICATED');
  END IF;

  SELECT email INTO v_current_email
    FROM auth.users
    WHERE id = v_current_user_id;

  IF v_current_email IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'USER_NOT_FOUND');
  END IF;

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

  IF lower(v_invitation.email) != lower(v_current_email) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'EMAIL_MISMATCH');
  END IF;

  UPDATE public.invitations
    SET status      = 'declined',
        declined_at = now()
    WHERE id = v_invitation.id;

  RETURN jsonb_build_object(
    'success', true,
    'organization_id', v_invitation.organization_id
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error_code', 'INTERNAL_ERROR');
END;
$$;
