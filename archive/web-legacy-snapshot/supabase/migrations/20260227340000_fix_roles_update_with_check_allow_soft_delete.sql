-- The roles_update_permission WITH CHECK incorrectly required deleted_at IS NULL,
-- which blocked soft-deletes (UPDATE SET deleted_at = now()).
-- The USING clause already prevents touching already-deleted rows;
-- the WITH CHECK must allow the resulting row to have deleted_at set.
ALTER POLICY roles_update_permission ON public.roles
  USING (
    organization_id IS NOT NULL
    AND is_basic = false
    AND is_org_member(organization_id)
    AND has_permission(organization_id, 'members.manage')
    AND deleted_at IS NULL
  )
  WITH CHECK (
    organization_id IS NOT NULL
    AND is_basic = false
    AND is_org_member(organization_id)
    AND has_permission(organization_id, 'members.manage')
  );
