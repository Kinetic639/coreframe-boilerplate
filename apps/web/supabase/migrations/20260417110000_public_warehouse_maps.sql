-- =============================================================================
-- Migration: Public warehouse maps by branch
-- =============================================================================
-- Adds a branch-level public flag that allows anonymous visitors to view all
-- published warehouse layouts for a branch without authenticating.
--
-- Security model:
--   - WRITE toggle is only possible through the SECURITY DEFINER RPC
--     set_branch_public_warehouse_maps(), which re-validates
--     warehouse.layouts.publish on the target branch.
--   - READ access for anon/authenticated is granted only when the branch has
--     public_warehouse_maps_enabled = true.
--   - Layouts are additionally restricted to status='published'.
--   - Shapes are additionally restricted to shapes that belong to published
--     layouts in a public branch.
-- =============================================================================

ALTER TABLE public.branches
  ADD COLUMN IF NOT EXISTS public_warehouse_maps_enabled BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.branches.public_warehouse_maps_enabled IS
  'When true, anonymous visitors may preview all published warehouse layouts for this branch.';

CREATE INDEX IF NOT EXISTS branches_public_warehouse_maps_enabled_idx
  ON public.branches (id)
  WHERE public_warehouse_maps_enabled = true AND deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Public read policies
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS branches_select_public_warehouse_maps ON public.branches;
CREATE POLICY branches_select_public_warehouse_maps
  ON public.branches
  FOR SELECT
  TO anon, authenticated
  USING (
    public_warehouse_maps_enabled = true
    AND deleted_at IS NULL
  );

DROP POLICY IF EXISTS wl_select_public_warehouse_maps ON public.warehouse_locations;
CREATE POLICY wl_select_public_warehouse_maps
  ON public.warehouse_locations
  FOR SELECT
  TO anon, authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.branches b
      WHERE b.id = warehouse_locations.branch_id
        AND b.public_warehouse_maps_enabled = true
        AND b.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS wlg_select_public_warehouse_maps ON public.warehouse_location_groups;
CREATE POLICY wlg_select_public_warehouse_maps
  ON public.warehouse_location_groups
  FOR SELECT
  TO anon, authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.branches b
      WHERE b.id = warehouse_location_groups.branch_id
        AND b.public_warehouse_maps_enabled = true
        AND b.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS wll_select_public_warehouse_maps ON public.warehouse_layouts;
CREATE POLICY wll_select_public_warehouse_maps
  ON public.warehouse_layouts
  FOR SELECT
  TO anon, authenticated
  USING (
    status = 'published'
    AND deleted_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.branches b
      WHERE b.id = warehouse_layouts.branch_id
        AND b.public_warehouse_maps_enabled = true
        AND b.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS wls_select_public_warehouse_maps ON public.warehouse_layout_shapes;
CREATE POLICY wls_select_public_warehouse_maps
  ON public.warehouse_layout_shapes
  FOR SELECT
  TO anon, authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.warehouse_layouts l
      JOIN public.branches b
        ON b.id = l.branch_id
      WHERE l.id = warehouse_layout_shapes.layout_id
        AND l.status = 'published'
        AND l.deleted_at IS NULL
        AND b.public_warehouse_maps_enabled = true
        AND b.deleted_at IS NULL
    )
  );

-- ---------------------------------------------------------------------------
-- RPC: toggle public warehouse maps for a branch
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_branch_public_warehouse_maps(
  p_branch_id UUID,
  p_enabled BOOLEAN
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_branch_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = '42501';
  END IF;

  SELECT organization_id, id
    INTO v_org_id, v_branch_id
  FROM public.branches
  WHERE id = p_branch_id
    AND deleted_at IS NULL;

  IF v_branch_id IS NULL THEN
    RAISE EXCEPTION 'Branch not found'
      USING ERRCODE = 'P0002';
  END IF;

  IF NOT public.has_branch_permission(v_org_id, v_branch_id, 'warehouse.layouts.publish') THEN
    RAISE EXCEPTION 'You do not have permission to change public warehouse map access'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.branches
  SET public_warehouse_maps_enabled = p_enabled
  WHERE id = p_branch_id
    AND deleted_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.set_branch_public_warehouse_maps(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_branch_public_warehouse_maps(UUID, BOOLEAN) TO authenticated;
