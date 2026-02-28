-- Fix invitations RLS policies that incorrectly access auth.users table
-- Replace SELECT email FROM auth.users with (auth.jwt() ->> 'email') which
-- reads from the JWT token without requiring auth.users table access.

DROP POLICY IF EXISTS "invitations_select_permission" ON public.invitations;
DROP POLICY IF EXISTS "invitations_update_permission" ON public.invitations;

CREATE POLICY "invitations_select_permission"
  ON public.invitations
  FOR SELECT
  TO authenticated
  USING (
    (
      (
        is_org_member(organization_id)
        AND has_permission(organization_id, 'invites.read')
      )
      OR (
        LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
      )
    )
    AND deleted_at IS NULL
  );

CREATE POLICY "invitations_update_permission"
  ON public.invitations
  FOR UPDATE
  TO authenticated
  USING (
    (
      (
        is_org_member(organization_id)
        AND has_permission(organization_id, 'invites.cancel')
      )
      OR (
        LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
      )
    )
    AND deleted_at IS NULL
  )
  WITH CHECK (
    (
      (
        is_org_member(organization_id)
        AND has_permission(organization_id, 'invites.cancel')
      )
      OR (
        LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
      )
    )
    AND deleted_at IS NULL
  );
