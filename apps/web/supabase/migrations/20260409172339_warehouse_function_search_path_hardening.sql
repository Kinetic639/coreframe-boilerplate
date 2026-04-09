-- =============================================================================
-- Migration: warehouse function search_path hardening
-- =============================================================================
-- Pins warehouse hierarchy/layout functions to SET search_path = public.
-- This matches the security hardening already applied to the target Supabase
-- project and removes mutable-search_path warnings from the advisor.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.cascade_warehouse_location_levels(
  p_org_id uuid,
  p_parent_id uuid,
  p_parent_level int
)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  WITH RECURSIVE subtree AS (
    SELECT
      id,
      (p_parent_level + 1) AS new_level
    FROM warehouse_locations
    WHERE parent_id = p_parent_id
      AND organization_id = p_org_id
      AND deleted_at IS NULL

    UNION ALL

    SELECT
      wl.id,
      (s.new_level + 1)
    FROM warehouse_locations wl
    JOIN subtree s ON wl.parent_id = s.id
    WHERE wl.organization_id = p_org_id
      AND wl.deleted_at IS NULL
  )
  UPDATE warehouse_locations
  SET level = subtree.new_level
  FROM subtree
  WHERE warehouse_locations.id = subtree.id
    AND warehouse_locations.organization_id = p_org_id;
$$;

CREATE OR REPLACE FUNCTION public.reparent_warehouse_location(
  p_org_id uuid,
  p_location_id uuid,
  p_new_parent_id uuid,
  p_new_level int
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  UPDATE warehouse_locations
  SET parent_id = p_new_parent_id,
      level = p_new_level
  WHERE id = p_location_id
    AND organization_id = p_org_id
    AND deleted_at IS NULL;

  PERFORM cascade_warehouse_location_levels(p_org_id, p_location_id, p_new_level);
END;
$$;

CREATE OR REPLACE FUNCTION public.soft_delete_warehouse_location(
  p_org_id uuid,
  p_location_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_child_id uuid;
BEGIN
  FOR v_child_id IN
    SELECT id
    FROM warehouse_locations
    WHERE parent_id = p_location_id
      AND organization_id = p_org_id
      AND deleted_at IS NULL
  LOOP
    UPDATE warehouse_locations
    SET parent_id = NULL,
        level = 0
    WHERE id = v_child_id
      AND organization_id = p_org_id;

    PERFORM cascade_warehouse_location_levels(p_org_id, v_child_id, 0);
  END LOOP;

  UPDATE warehouse_locations
  SET deleted_at = NOW()
  WHERE id = p_location_id
    AND organization_id = p_org_id
    AND deleted_at IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_warehouse_layout_with_root(
  p_org_id UUID,
  p_branch_id UUID,
  p_user_id UUID,
  p_layout_name TEXT,
  p_layout_description TEXT,
  p_root_loc_code TEXT,
  p_canvas_width_m FLOAT,
  p_canvas_height_m FLOAT
)
RETURNS TABLE (layout_id UUID, root_location_id UUID)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_root_location_id UUID;
  v_layout_id UUID;
BEGIN
  INSERT INTO public.warehouse_locations (
    organization_id,
    branch_id,
    name,
    code,
    color,
    parent_id,
    level,
    sort_order,
    created_by,
    updated_by
  ) VALUES (
    p_org_id,
    p_branch_id,
    p_layout_name,
    p_root_loc_code,
    '#10b981',
    NULL,
    0,
    0,
    p_user_id,
    p_user_id
  )
  RETURNING id INTO v_root_location_id;

  INSERT INTO public.warehouse_layouts (
    organization_id,
    branch_id,
    root_location_id,
    name,
    description,
    status,
    canvas_width_m,
    canvas_height_m,
    created_by,
    updated_by
  ) VALUES (
    p_org_id,
    p_branch_id,
    v_root_location_id,
    p_layout_name,
    p_layout_description,
    'draft',
    p_canvas_width_m,
    p_canvas_height_m,
    p_user_id,
    p_user_id
  )
  RETURNING id INTO v_layout_id;

  RETURN QUERY SELECT v_layout_id, v_root_location_id;
END;
$$;

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
    WHERE elem->>'location_id' IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.warehouse_locations wl
        WHERE wl.id = (elem->>'location_id')::UUID
          AND wl.organization_id = p_org_id
          AND wl.branch_id = p_branch_id
          AND wl.deleted_at IS NULL
      )
  ) THEN
    RAISE EXCEPTION 'invalid_location_id: One or more location_ids do not belong to org % branch %',
      p_org_id, p_branch_id;
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

CREATE OR REPLACE FUNCTION public.soft_delete_warehouse_layout(
  p_org_id UUID,
  p_layout_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  UPDATE public.warehouse_layout_shapes
  SET deleted_at = NOW()
  WHERE layout_id = p_layout_id
    AND organization_id = p_org_id
    AND deleted_at IS NULL;

  UPDATE public.warehouse_layouts
  SET deleted_at = NOW()
  WHERE id = p_layout_id
    AND organization_id = p_org_id
    AND deleted_at IS NULL;
END;
$$;
