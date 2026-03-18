-- Migration: Invitation Acceptance Flow
-- Adds FK, unique index, and SECURITY DEFINER function for atomic invitation acceptance.

-- ============================================================
-- 1. Add role_id FK to invitations table (idempotent)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'invitations_role_id_fkey'
      AND table_name = 'invitations'
      AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.invitations
      ADD CONSTRAINT invitations_role_id_fkey
      FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================
-- 2. Partial unique index — one pending invitation per email per org
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS invitations_org_pending_email_idx
  ON public.invitations (organization_id, lower(email))
  WHERE status = 'pending' AND deleted_at IS NULL;

-- ============================================================
-- 3. SECURITY DEFINER function: accept_invitation_and_join_org
--
-- Atomically validates invitation, creates org membership,
-- assigns org_member role (and optional invited role), marks
-- invitation accepted. Runs as function owner to bypass RLS.
-- ============================================================
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
  -- Resolve current authenticated user
  v_current_user_id := auth.uid();
  IF v_current_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Get user's email from auth.users
  SELECT email INTO v_current_email
    FROM auth.users
    WHERE id = v_current_user_id;

  IF v_current_email IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  -- Lock and fetch invitation row
  SELECT * INTO v_invitation
    FROM public.invitations
    WHERE token = p_token
      AND deleted_at IS NULL
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invitation not found');
  END IF;

  -- Validate invitation state
  IF v_invitation.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invitation is no longer pending');
  END IF;

  IF v_invitation.expires_at < now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invitation has expired');
  END IF;

  -- Validate email match (case-insensitive)
  IF lower(v_invitation.email) != lower(v_current_email) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Email does not match invitation');
  END IF;

  -- Create org membership (idempotent via ON CONFLICT DO NOTHING)
  INSERT INTO public.organization_members (organization_id, user_id, status, joined_at)
    VALUES (v_invitation.organization_id, v_current_user_id, 'active', now())
    ON CONFLICT (organization_id, user_id) DO UPDATE
      SET status = 'active',
          deleted_at = NULL,
          updated_at = now();

  -- Assign org_member base role (reactivate if soft-deleted)
  INSERT INTO public.user_role_assignments (user_id, role_id, scope, scope_id)
    VALUES (v_current_user_id, v_org_member_role_id, 'org', v_invitation.organization_id)
    ON CONFLICT (user_id, role_id, scope, scope_id) DO UPDATE
      SET deleted_at = NULL;

  -- Assign invited role if specified (must be org-scoped)
  IF v_invitation.role_id IS NOT NULL THEN
    -- Only assign if role is org-scoped or supports both scopes
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

  -- Mark invitation as accepted
  UPDATE public.invitations
    SET status = 'accepted',
        accepted_at = now()
    WHERE id = v_invitation.id;

  RETURN jsonb_build_object(
    'success', true,
    'organization_id', v_invitation.organization_id
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Grant execute to authenticated users only
GRANT EXECUTE ON FUNCTION public.accept_invitation_and_join_org(TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.accept_invitation_and_join_org(TEXT) FROM anon;
