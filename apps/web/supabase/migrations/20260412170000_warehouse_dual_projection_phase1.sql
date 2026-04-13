-- Migration: warehouse dual projection phase 1
--
-- Adds physical metadata to warehouse_locations and projection metadata to
-- warehouse_layout_shapes so the app can support both top-down and
-- front-elevation warehouse mapping.

BEGIN;

ALTER TABLE public.warehouse_locations
  ADD COLUMN IF NOT EXISTS physical_width_m DOUBLE PRECISION NULL,
  ADD COLUMN IF NOT EXISTS physical_depth_m DOUBLE PRECISION NULL,
  ADD COLUMN IF NOT EXISTS physical_height_m DOUBLE PRECISION NULL,
  ADD COLUMN IF NOT EXISTS physical_elevation_start_m DOUBLE PRECISION NULL,
  ADD COLUMN IF NOT EXISTS map_role TEXT NOT NULL DEFAULT 'logical',
  ADD COLUMN IF NOT EXISTS storage_mode TEXT NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS allow_top_storage BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.warehouse_locations.physical_width_m IS
  'Physical width in meters, primarily used for front-elevation rendering.';
COMMENT ON COLUMN public.warehouse_locations.physical_depth_m IS
  'Physical depth in meters, primarily used for top-down rendering.';
COMMENT ON COLUMN public.warehouse_locations.physical_height_m IS
  'Physical height in meters used for front-elevation constraints and rendering.';
COMMENT ON COLUMN public.warehouse_locations.physical_elevation_start_m IS
  'Bottom offset in meters within the parent front elevation.';
COMMENT ON COLUMN public.warehouse_locations.map_role IS
  'Mapping role hint: logical, layout_root, top_down_unit, or front_segment.';
COMMENT ON COLUMN public.warehouse_locations.storage_mode IS
  'Optional storage classification used for future warehouse semantics.';
COMMENT ON COLUMN public.warehouse_locations.allow_top_storage IS
  'Whether storage above the nominal top of this location is allowed.';

ALTER TABLE public.warehouse_locations
  DROP CONSTRAINT IF EXISTS warehouse_locations_physical_width_positive,
  DROP CONSTRAINT IF EXISTS warehouse_locations_physical_depth_positive,
  DROP CONSTRAINT IF EXISTS warehouse_locations_physical_height_positive,
  DROP CONSTRAINT IF EXISTS warehouse_locations_physical_elevation_start_non_negative,
  DROP CONSTRAINT IF EXISTS warehouse_locations_map_role_valid;

ALTER TABLE public.warehouse_locations
  ADD CONSTRAINT warehouse_locations_physical_width_positive
    CHECK (physical_width_m IS NULL OR physical_width_m > 0),
  ADD CONSTRAINT warehouse_locations_physical_depth_positive
    CHECK (physical_depth_m IS NULL OR physical_depth_m > 0),
  ADD CONSTRAINT warehouse_locations_physical_height_positive
    CHECK (physical_height_m IS NULL OR physical_height_m > 0),
  ADD CONSTRAINT warehouse_locations_physical_elevation_start_non_negative
    CHECK (physical_elevation_start_m IS NULL OR physical_elevation_start_m >= 0),
  ADD CONSTRAINT warehouse_locations_map_role_valid
    CHECK (map_role IN ('logical', 'layout_root', 'top_down_unit', 'front_segment'));

ALTER TABLE public.warehouse_layout_shapes
  ADD COLUMN IF NOT EXISTS projection TEXT NOT NULL DEFAULT 'top_down',
  ADD COLUMN IF NOT EXISTS anchor_location_id UUID NULL REFERENCES public.warehouse_locations(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.warehouse_layout_shapes.projection IS
  'Projection plane for this shape: top_down or front_elevation.';
COMMENT ON COLUMN public.warehouse_layout_shapes.anchor_location_id IS
  'Location whose visual context this shape belongs to. Required for front_elevation shapes.';

ALTER TABLE public.warehouse_layout_shapes
  DROP CONSTRAINT IF EXISTS warehouse_layout_shapes_projection_valid,
  DROP CONSTRAINT IF EXISTS warehouse_layout_shapes_front_projection_requires_anchor;

ALTER TABLE public.warehouse_layout_shapes
  ADD CONSTRAINT warehouse_layout_shapes_projection_valid
    CHECK (projection IN ('top_down', 'front_elevation')),
  ADD CONSTRAINT warehouse_layout_shapes_front_projection_requires_anchor
    CHECK (projection != 'front_elevation' OR anchor_location_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS wls_layout_projection_active_idx
  ON public.warehouse_layout_shapes(layout_id, projection)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS wls_anchor_projection_active_idx
  ON public.warehouse_layout_shapes(anchor_location_id, projection)
  WHERE anchor_location_id IS NOT NULL AND deleted_at IS NULL;

DROP INDEX IF EXISTS wls_location_unique_per_layout_idx;
CREATE UNIQUE INDEX IF NOT EXISTS wls_location_unique_per_layout_projection_idx
  ON public.warehouse_layout_shapes(layout_id, location_id, projection)
  WHERE location_id IS NOT NULL AND deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.validate_warehouse_layout_shape_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_loc_org UUID;
  v_loc_branch UUID;
BEGIN
  IF NEW.location_id IS NOT NULL THEN
    SELECT organization_id, branch_id
      INTO v_loc_org, v_loc_branch
      FROM public.warehouse_locations
     WHERE id = NEW.location_id
       AND deleted_at IS NULL;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'invalid_location_id: Shape location % not found', NEW.location_id;
    END IF;

    IF v_loc_org IS DISTINCT FROM NEW.organization_id OR v_loc_branch IS DISTINCT FROM NEW.branch_id THEN
      RAISE EXCEPTION 'location_scope_mismatch: Shape location % does not belong to org % branch %',
        NEW.location_id, NEW.organization_id, NEW.branch_id;
    END IF;
  END IF;

  IF NEW.anchor_location_id IS NOT NULL THEN
    SELECT organization_id, branch_id
      INTO v_loc_org, v_loc_branch
      FROM public.warehouse_locations
     WHERE id = NEW.anchor_location_id
       AND deleted_at IS NULL;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'invalid_anchor_location_id: Anchor location % not found', NEW.anchor_location_id;
    END IF;

    IF v_loc_org IS DISTINCT FROM NEW.organization_id OR v_loc_branch IS DISTINCT FROM NEW.branch_id THEN
      RAISE EXCEPTION 'anchor_scope_mismatch: Anchor location % does not belong to org % branch %',
        NEW.anchor_location_id, NEW.organization_id, NEW.branch_id;
    END IF;
  ELSIF NEW.projection = 'front_elevation' THEN
    RAISE EXCEPTION 'front_projection_requires_anchor: Front-elevation shapes require anchor_location_id';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.validate_warehouse_layout_shape_scope IS
  'Ensures warehouse_layout_shapes location and anchor references stay within the same active org/branch scope, and front-elevation shapes always have an anchor.';

DROP TRIGGER IF EXISTS warehouse_layout_shapes_validate_scope ON public.warehouse_layout_shapes;
CREATE TRIGGER warehouse_layout_shapes_validate_scope
  BEFORE INSERT OR UPDATE OF location_id, anchor_location_id, organization_id, branch_id, projection
  ON public.warehouse_layout_shapes
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_warehouse_layout_shape_scope();

CREATE OR REPLACE FUNCTION public.batch_save_warehouse_layout_shapes(
  p_layout_id UUID,
  p_org_id UUID,
  p_branch_id UUID,
  p_user_id UUID,
  p_shapes JSONB
)
RETURNS SETOF public.warehouse_layout_shapes
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.warehouse_layouts
    WHERE id = p_layout_id
      AND organization_id = p_org_id
      AND branch_id = p_branch_id
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'layout_not_found: Layout % not found or does not belong to this branch', p_layout_id;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_shapes) AS elem
    WHERE elem->>'id' IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.warehouse_layout_shapes wls
        WHERE wls.id = (elem->>'id')::UUID
          AND wls.layout_id != p_layout_id
      )
  ) THEN
    RAISE EXCEPTION 'cross_layout_id: One or more shape IDs belong to a different layout';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_shapes) AS elem
    WHERE (
        elem->>'location_id' IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM public.warehouse_locations wl
          WHERE wl.id = (elem->>'location_id')::UUID
            AND wl.organization_id = p_org_id
            AND wl.branch_id = p_branch_id
            AND wl.deleted_at IS NULL
        )
      ) OR (
        elem->>'anchor_location_id' IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM public.warehouse_locations wl
          WHERE wl.id = (elem->>'anchor_location_id')::UUID
            AND wl.organization_id = p_org_id
            AND wl.branch_id = p_branch_id
            AND wl.deleted_at IS NULL
        )
      )
  ) THEN
    RAISE EXCEPTION 'invalid_location_id: One or more location references do not belong to org % branch %',
      p_org_id, p_branch_id;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_shapes) AS elem
    WHERE COALESCE(elem->>'projection', 'top_down') = 'front_elevation'
      AND elem->>'anchor_location_id' IS NULL
  ) THEN
    RAISE EXCEPTION 'front_projection_requires_anchor: Front-elevation shapes require anchor_location_id';
  END IF;

  UPDATE public.warehouse_layout_shapes
  SET deleted_at = now()
  WHERE layout_id = p_layout_id
    AND organization_id = p_org_id
    AND deleted_at IS NULL
    AND id NOT IN (
      SELECT (elem->>'id')::UUID
      FROM jsonb_array_elements(p_shapes) AS elem
      WHERE elem->>'id' IS NOT NULL
    );

  INSERT INTO public.warehouse_layout_shapes (
    id,
    layout_id,
    organization_id,
    branch_id,
    shape_type,
    projection,
    anchor_location_id,
    location_id,
    label,
    x, y, width, height, rotation,
    style,
    z_index,
    sort_order,
    created_by,
    deleted_at
  )
  SELECT
    (elem->>'id')::UUID,
    p_layout_id,
    p_org_id,
    p_branch_id,
    elem->>'shape_type',
    COALESCE(elem->>'projection', 'top_down'),
    CASE WHEN elem->>'anchor_location_id' IS NOT NULL THEN (elem->>'anchor_location_id')::UUID ELSE NULL END,
    CASE WHEN elem->>'location_id' IS NOT NULL THEN (elem->>'location_id')::UUID ELSE NULL END,
    elem->>'label',
    (elem->>'x')::FLOAT,
    (elem->>'y')::FLOAT,
    (elem->>'width')::FLOAT,
    (elem->>'height')::FLOAT,
    (elem->>'rotation')::FLOAT,
    CASE WHEN elem->'style' IS NULL OR jsonb_typeof(elem->'style') = 'null' THEN NULL ELSE elem->'style' END,
    COALESCE((elem->>'z_index')::INTEGER, 0),
    COALESCE((elem->>'sort_order')::INTEGER, 0),
    p_user_id,
    NULL
  FROM jsonb_array_elements(p_shapes) AS elem
  ON CONFLICT (id) DO UPDATE SET
    shape_type = EXCLUDED.shape_type,
    projection = EXCLUDED.projection,
    anchor_location_id = EXCLUDED.anchor_location_id,
    location_id = EXCLUDED.location_id,
    label = EXCLUDED.label,
    x = EXCLUDED.x,
    y = EXCLUDED.y,
    width = EXCLUDED.width,
    height = EXCLUDED.height,
    rotation = EXCLUDED.rotation,
    style = EXCLUDED.style,
    z_index = EXCLUDED.z_index,
    sort_order = EXCLUDED.sort_order,
    deleted_at = NULL,
    updated_at = now();

  RETURN QUERY
    SELECT *
    FROM public.warehouse_layout_shapes
    WHERE layout_id = p_layout_id
      AND organization_id = p_org_id
      AND deleted_at IS NULL
    ORDER BY z_index ASC, sort_order ASC;
END;
$$;

COMMENT ON FUNCTION public.batch_save_warehouse_layout_shapes IS
  'Atomically replaces the active canonical shape set for a layout, including projection-aware front-elevation shapes and anchor validation.';

COMMIT;
