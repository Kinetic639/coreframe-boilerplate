-- =============================================================================
-- Migration: Warehouse soft-delete RLS fix
-- =============================================================================
-- Root cause:
--   PostgREST enforces that after an UPDATE the resulting row is still visible
--   under the table's SELECT policy. All three warehouse tables have SELECT
--   policies gated on `deleted_at IS NULL`. A soft-delete UPDATE sets
--   deleted_at = now(), making the row invisible to the SELECT policy.
--   PostgREST interprets this as a WITH CHECK violation and returns:
--     "new row violates row-level security policy for table <table>"
--
-- Fix:
--   Add a second SELECT policy on each table that allows users with the manage
--   permission to see ALL rows including soft-deleted ones. PostgREST's
--   post-update visibility check then passes because the manage user can still
--   see the (now soft-deleted) row.
--
--   The application layer always adds .is("deleted_at", null) to every query,
--   so soft-deleted rows never surface to end users through normal app paths.
--
-- Also applies the warehouse_locations hardening (20260401130000) which was
-- never applied to the live database — replaces org-only policies with
-- branch-aware equivalents using has_branch_permission.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- PART 1: warehouse_locations — apply missing hardening migration
-- ---------------------------------------------------------------------------

-- SELECT: replace org-member check with branch-aware permission check
DROP POLICY IF EXISTS wl_select_org_member     ON public.warehouse_locations;
DROP POLICY IF EXISTS wl_select_locations_read ON public.warehouse_locations;
CREATE POLICY wl_select_locations_read
  ON public.warehouse_locations FOR SELECT
  USING (
    public.has_branch_permission(organization_id, branch_id, 'warehouse.locations.read')
    AND deleted_at IS NULL
  );

-- SELECT (manage): allows users with manage permission to see all rows,
-- including soft-deleted — satisfies PostgREST post-update visibility check
DROP POLICY IF EXISTS wl_select_manage_all ON public.warehouse_locations;
CREATE POLICY wl_select_manage_all
  ON public.warehouse_locations FOR SELECT
  USING (
    public.has_branch_permission(organization_id, branch_id, 'warehouse.locations.manage')
  );

-- INSERT: replace org-only check with branch-aware check
DROP POLICY IF EXISTS wl_insert_manage ON public.warehouse_locations;
CREATE POLICY wl_insert_manage
  ON public.warehouse_locations FOR INSERT
  WITH CHECK (
    public.has_branch_permission(organization_id, branch_id, 'warehouse.locations.manage')
  );

-- UPDATE: replace org-only check with branch-aware check + explicit WITH CHECK
DROP POLICY IF EXISTS wl_update_manage ON public.warehouse_locations;
CREATE POLICY wl_update_manage
  ON public.warehouse_locations FOR UPDATE
  USING (
    public.has_branch_permission(organization_id, branch_id, 'warehouse.locations.manage')
  )
  WITH CHECK (
    public.has_branch_permission(organization_id, branch_id, 'warehouse.locations.manage')
  );

-- ---------------------------------------------------------------------------
-- PART 2: warehouse_layouts — add manage-can-see-all SELECT policy
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS wll_select_manage_all ON public.warehouse_layouts;
CREATE POLICY wll_select_manage_all
  ON public.warehouse_layouts FOR SELECT
  USING (
    public.has_branch_permission(organization_id, branch_id, 'warehouse.layouts.manage')
  );

-- ---------------------------------------------------------------------------
-- PART 3: warehouse_layout_shapes — add manage-can-see-all SELECT policy
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS wls_select_manage_all ON public.warehouse_layout_shapes;
CREATE POLICY wls_select_manage_all
  ON public.warehouse_layout_shapes FOR SELECT
  USING (
    public.has_branch_permission(organization_id, branch_id, 'warehouse.layouts.manage')
  );
