-- =============================================================================
-- Migration: warehouse_locations — RLS Hardening (Branch-Aware Policies)
-- Project:   rjeraydumwechpjjzrus (TARGET)
-- Phase:     Warehouse V2 Phase 1 — Locations (corrective pass)
-- =============================================================================
-- Changes from initial migration (20260401120000):
--
--   SELECT was: is_org_member(org_id) AND deleted_at IS NULL
--   SELECT now: has_branch_permission(org_id, branch_id, 'warehouse.locations.read')
--     → any org member can read all branches' data (overly permissive)
--     → only users with warehouse.locations.read at org-scope (branch_id IS NULL)
--       OR at this specific branch can read. Org-level grants still work via
--       the branch_id IS NULL match inside has_branch_permission.
--
--   INSERT was: has_permission(org_id, 'warehouse.locations.manage')  [org-only]
--   INSERT now: has_branch_permission(org_id, branch_id, 'warehouse.locations.manage')
--     → org-level manage → can insert into any branch (IS NULL match)
--     → branch-specific manage → can insert only into that branch
--
--   UPDATE was: USING has_permission(org_id, 'warehouse.locations.manage') [no WITH CHECK]
--   UPDATE now: USING + WITH CHECK has_branch_permission(org_id, branch_id, 'warehouse.locations.manage')
--     → adds WITH CHECK so that the post-update row must also satisfy the policy
--       (prevents moving a row to a branch the caller lacks permission for)
--
--   DELETE policy: unchanged (still blocked — all deletes must use soft-delete)
--
-- RLS function reference:
--   has_branch_permission(org_id, branch_id, slug) — in user_effective_permissions,
--   returns TRUE when the calling user has a UEP row where:
--     (branch_id IS NULL OR branch_id = p_branch_id)
--     AND permission_slug_exact = slug
--   This means org-level grants (branch_id IS NULL) pass for every branch.
--   Branch-specific grants pass only for their specific branch.
-- =============================================================================

-- SELECT: user must hold warehouse.locations.read for this branch (or org-wide)
DROP POLICY IF EXISTS wl_select_org_member         ON public.warehouse_locations;
DROP POLICY IF EXISTS wl_select_locations_read     ON public.warehouse_locations;
CREATE POLICY wl_select_locations_read
  ON public.warehouse_locations FOR SELECT
  USING (
    public.has_branch_permission(organization_id, branch_id, 'warehouse.locations.read')
    AND deleted_at IS NULL
  );

-- INSERT: user must hold warehouse.locations.manage for this branch (or org-wide)
DROP POLICY IF EXISTS wl_insert_manage ON public.warehouse_locations;
CREATE POLICY wl_insert_manage
  ON public.warehouse_locations FOR INSERT
  WITH CHECK (
    public.has_branch_permission(organization_id, branch_id, 'warehouse.locations.manage')
  );

-- UPDATE: USING + WITH CHECK both require warehouse.locations.manage for the branch
DROP POLICY IF EXISTS wl_update_manage ON public.warehouse_locations;
CREATE POLICY wl_update_manage
  ON public.warehouse_locations FOR UPDATE
  USING (
    public.has_branch_permission(organization_id, branch_id, 'warehouse.locations.manage')
  )
  WITH CHECK (
    public.has_branch_permission(organization_id, branch_id, 'warehouse.locations.manage')
  );

-- DELETE: blocked — unchanged
DROP POLICY IF EXISTS wl_delete_deny ON public.warehouse_locations;
CREATE POLICY wl_delete_deny
  ON public.warehouse_locations FOR DELETE
  USING (false);
