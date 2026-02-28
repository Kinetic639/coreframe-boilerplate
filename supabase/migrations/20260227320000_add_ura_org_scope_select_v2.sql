-- P1-A: Add V2 org-scope SELECT policy for user_role_assignments
-- Gap: Admins with members.read could not read another user's org-scoped role assignments.
-- The existing org-scope SELECT policy used the legacy has_org_role('org_owner') predicate.
-- This policy adds a V2-aligned, permission-based SELECT path that covers all users
-- with the members.read permission on the organisation.

CREATE POLICY "V2 view org role assignments" ON public.user_role_assignments
  AS PERMISSIVE FOR SELECT
  TO authenticated
  USING (
    scope = 'org'
    AND is_org_member(scope_id)
    AND has_permission(scope_id, 'members.read')
  );
