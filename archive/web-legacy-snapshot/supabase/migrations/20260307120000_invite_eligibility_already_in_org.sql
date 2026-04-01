-- Add ALREADY_IN_ORG check to invitation eligibility function
-- Prevents inviting users who are already members of any other organization

CREATE OR REPLACE FUNCTION public.check_invitation_eligibility(
  p_org_id     uuid,
  p_email      text,
  p_inviter_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_norm_email TEXT := lower(trim(p_email));
BEGIN
  -- 1. Self-invite check
  IF EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = p_inviter_id
      AND lower(email) = v_norm_email
  ) THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'SELF_INVITE');
  END IF;

  -- 2. Already an active member of this org
  IF EXISTS (
    SELECT 1
    FROM public.organization_members om
    JOIN auth.users u ON u.id = om.user_id
    WHERE om.organization_id = p_org_id
      AND om.status = 'active'
      AND om.deleted_at IS NULL
      AND lower(u.email) = v_norm_email
  ) THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'ALREADY_MEMBER');
  END IF;

  -- 3. Already has a pending invite for this org
  IF EXISTS (
    SELECT 1 FROM public.invitations
    WHERE organization_id = p_org_id
      AND lower(email)    = v_norm_email
      AND status          = 'pending'
      AND deleted_at IS NULL
  ) THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'DUPLICATE_PENDING');
  END IF;

  -- 4. Already a member of any other organization
  IF EXISTS (
    SELECT 1
    FROM public.organization_members om
    JOIN auth.users u ON u.id = om.user_id
    WHERE om.organization_id <> p_org_id
      AND om.status = 'active'
      AND om.deleted_at IS NULL
      AND lower(u.email) = v_norm_email
  ) THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'ALREADY_IN_ORG');
  END IF;

  RETURN jsonb_build_object('eligible', true);
END;
$$;
