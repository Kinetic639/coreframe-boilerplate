-- Fix UPDATE policy to support branch-scoped rows.
-- Bug: old policy (scope='org' AND is_org_creator/has_org_role) blocks:
--   1. upsert ON CONFLICT DO UPDATE for branch-scoped rows (assignRoleToUser retry)
--   2. soft-delete UPDATE (removeRoleFromUser) for branch-scoped rows

DROP POLICY IF EXISTS "Org owners and creators can update role assignments" ON public.user_role_assignments;

CREATE POLICY "V2 update role assignments" ON public.user_role_assignments
  AS PERMISSIVE FOR UPDATE
  TO authenticated
  USING (
    (
      scope = 'org'
      AND is_org_member(scope_id)
      AND has_permission(scope_id, 'members.manage')
    )
    OR
    (
      scope = 'branch'
      AND has_permission(
        (SELECT organization_id FROM public.branches WHERE id = scope_id AND deleted_at IS NULL),
        'members.manage'
      )
      AND is_org_member(
        (SELECT organization_id FROM public.branches WHERE id = scope_id AND deleted_at IS NULL)
      )
    )
  )
  WITH CHECK (
    (
      scope = 'org'
      AND is_org_member(scope_id)
      AND has_permission(scope_id, 'members.manage')
    )
    OR
    (
      scope = 'branch'
      AND has_permission(
        (SELECT organization_id FROM public.branches WHERE id = scope_id AND deleted_at IS NULL),
        'members.manage'
      )
      AND is_org_member(
        (SELECT organization_id FROM public.branches WHERE id = scope_id AND deleted_at IS NULL)
      )
    )
  );
