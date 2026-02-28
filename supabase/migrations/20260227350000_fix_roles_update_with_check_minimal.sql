-- The roles_update_permission WITH CHECK was redundantly re-checking
-- is_org_member() and has_permission() on the NEW row. These STABLE
-- permission functions belong in USING (validates access), not WITH CHECK
-- (validates resulting row state). Re-evaluating them in WITH CHECK
-- causes the soft-delete (UPDATE SET deleted_at = now()) to fail with 403.
--
-- Correct pattern:
--   USING:      full permission validation on the OLD row
--   WITH CHECK: data integrity check on the NEW row only
--
-- The new WITH CHECK only ensures the resulting row:
--   1. Still belongs to an organization (can't set organization_id = NULL)
--   2. Is still not a system role (can't flip is_basic = true)
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
  );
