-- Add inviter_name to get_invitation_preview_by_token
-- Joins public.users on invited_by to surface inviter display name on the invite landing page

CREATE OR REPLACE FUNCTION public.get_invitation_preview_by_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv          public.invitations%ROWTYPE;
  v_org_name     TEXT;
  v_role_name    TEXT;
  v_branch_name  TEXT;
  v_inviter_name TEXT;
  v_reason_code  TEXT;
  v_ira_summary  TEXT;
BEGIN
  SELECT * INTO v_inv
    FROM public.invitations
    WHERE token = p_token
      AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('reason_code', 'INVITE_NOT_FOUND');
  END IF;

  -- Map status to reason code
  v_reason_code := CASE v_inv.status
    WHEN 'pending'   THEN
      CASE WHEN v_inv.expires_at IS NOT NULL AND v_inv.expires_at < now()
           THEN 'INVITE_EXPIRED'
           ELSE 'INVITE_PENDING'
      END
    WHEN 'accepted'  THEN 'INVITE_ACCEPTED'
    WHEN 'declined'  THEN 'INVITE_DECLINED'
    WHEN 'cancelled' THEN 'INVITE_CANCELLED'
    ELSE 'INVITE_INVALID'
  END;

  -- Org name
  SELECT op.name INTO v_org_name
    FROM public.organization_profiles op
    WHERE op.organization_id = v_inv.organization_id
    LIMIT 1;

  -- Role name: prefer IRA summary, fall back to legacy role_id
  SELECT string_agg(r.name, ', ' ORDER BY r.name) INTO v_ira_summary
    FROM public.invitation_role_assignments ira
    JOIN public.roles r ON r.id = ira.role_id AND r.deleted_at IS NULL
    WHERE ira.invitation_id = v_inv.id;

  IF v_ira_summary IS NOT NULL AND v_ira_summary != '' THEN
    v_role_name := v_ira_summary;
  ELSIF v_inv.role_id IS NOT NULL THEN
    SELECT name INTO v_role_name FROM public.roles WHERE id = v_inv.role_id AND deleted_at IS NULL;
  END IF;

  -- Branch name from legacy branch_id
  IF v_inv.branch_id IS NOT NULL THEN
    SELECT name INTO v_branch_name FROM public.branches WHERE id = v_inv.branch_id;
  END IF;

  -- Inviter display name: first+last from public.users, fall back to email
  IF v_inv.invited_by IS NOT NULL THEN
    SELECT COALESCE(
      NULLIF(TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')), ''),
      email
    ) INTO v_inviter_name
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
    'role_name',          v_role_name,
    'branch_name',        v_branch_name,
    'inviter_name',       v_inviter_name
  );
END;
$$;
