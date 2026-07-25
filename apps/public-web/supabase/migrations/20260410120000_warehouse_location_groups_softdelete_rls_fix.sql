-- =============================================================================
-- Migration: warehouse_location_groups soft-delete RLS fix
-- =============================================================================
-- Root cause: same as 20260407120000_warehouse_softdelete_rls_fix.sql
--   PostgREST enforces that after an UPDATE the resulting row is still visible
--   under the table's SELECT policy. The wlg_select policy requires
--   deleted_at IS NULL, so a soft-delete UPDATE makes the row invisible.
--   PostgREST interprets this as a WITH CHECK violation:
--     "new row violates row-level security policy for table warehouse_location_groups"
--
-- Fix:
--   Add a second SELECT policy that lets users with the manage permission see
--   ALL rows including soft-deleted ones. PostgREST's post-update visibility
--   check passes because the row is still readable by manage users.
--   The application layer always adds .is("deleted_at", null) to every query,
--   so soft-deleted rows never surface to end users through normal app paths.
-- =============================================================================

DROP POLICY IF EXISTS wlg_select_manage_all ON public.warehouse_location_groups;
CREATE POLICY wlg_select_manage_all
  ON public.warehouse_location_groups FOR SELECT
  USING (
    public.has_branch_permission(organization_id, branch_id, 'warehouse.locations.manage')
  );
