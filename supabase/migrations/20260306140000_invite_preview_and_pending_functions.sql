-- ============================================================
-- Migration: Invite Preview & Pending Invites Functions
-- ============================================================

-- ============================================================
-- 1. get_invitation_preview_by_token
--    Safe public preview: callable by anon, returns minimal safe
--    fields only (no internal IDs, no token in response).
--    Reason codes: INVITE_PENDING | INVITE_NOT_FOUND |
--                  INVITE_EXPIRED | INVITE_CANCELLED |
--                  INVITE_ACCEPTED | INVITE_INVALID
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
  -- Basic sanity check
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

  -- Map DB status -> stable reason code
  IF v_inv.status = 'accepted' THEN
    v_reason := 'INVITE_ACCEPTED';
  ELSIF v_inv.status = 'cancelled' THEN
    v_reason := 'INVITE_CANCELLED';
  ELSIF v_inv.status = 'expired'
     OR (v_inv.expires_at IS NOT NULL AND v_inv.expires_at < now()) THEN
    v_reason := 'INVITE_EXPIRED';
  ELSIF v_inv.status = 'pending' THEN
    v_reason := 'INVITE_PENDING';
  ELSE
    v_reason := 'INVITE_INVALID';
  END IF;

  -- Org name from profiles
  SELECT op.name INTO v_org_name
    FROM public.organization_profiles op
    WHERE op.organization_id = v_inv.organization_id
    LIMIT 1;

  -- Role name (no display_name column on roles table)
  IF v_inv.role_id IS NOT NULL THEN
    SELECT r.name INTO v_role_name
      FROM public.roles r
      WHERE r.id = v_inv.role_id
        AND r.deleted_at IS NULL;
  END IF;

  -- Branch name
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

-- Accessible to unauthenticated visitors (public invite link preview)
GRANT EXECUTE ON FUNCTION public.get_invitation_preview_by_token(TEXT) TO anon, authenticated;

-- ============================================================
-- 2. get_my_pending_invitations
--    For authenticated users only. Returns pending, non-expired
--    invitations matching the current user's email. Token IS
--    included so the client can navigate to /invite/[token].
--    No org-private data (branch/role IDs) exposed.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_my_pending_invitations()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_email   TEXT;
  v_results JSONB;
BEGIN
  SELECT email INTO v_email
    FROM auth.users
    WHERE id = auth.uid();

  IF v_email IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'id',          inv.id,
      'token',       inv.token,
      'expires_at',  inv.expires_at,
      'org_name',    op.name,
      'role_name',   r.name,
      'branch_name', b.name
    )
    ORDER BY inv.created_at DESC
  )
  INTO v_results
  FROM public.invitations inv
  LEFT JOIN public.organization_profiles op
         ON op.organization_id = inv.organization_id
  LEFT JOIN public.roles r
         ON r.id = inv.role_id AND r.deleted_at IS NULL
  LEFT JOIN public.branches b
         ON b.id = inv.branch_id AND b.deleted_at IS NULL
  WHERE lower(inv.email)  = lower(v_email)
    AND inv.status        = 'pending'
    AND (inv.expires_at IS NULL OR inv.expires_at > now())
    AND inv.deleted_at    IS NULL;

  RETURN jsonb_build_object(
    'success',     true,
    'invitations', COALESCE(v_results, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_pending_invitations() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_my_pending_invitations() FROM anon;
