-- Locations V2 Phase 1.4: mapping status + archive validation

CREATE OR REPLACE FUNCTION public.get_warehouse_location_mapping_status(
  p_location_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_has_top_down BOOLEAN;
  v_has_front_or_interior BOOLEAN;
  v_visual_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_visual_count
  FROM public.warehouse_location_visual_nodes
  WHERE location_id = p_location_id
    AND deleted_at IS NULL
    AND status = 'active';

  SELECT EXISTS (
    SELECT 1 FROM public.warehouse_location_visual_nodes
    WHERE location_id = p_location_id
      AND view_type = 'top_down'
      AND deleted_at IS NULL
      AND status = 'active'
  ) INTO v_has_top_down;

  SELECT EXISTS (
    SELECT 1 FROM public.warehouse_location_visual_nodes
    WHERE location_id = p_location_id
      AND view_type IN ('front', 'interior')
      AND deleted_at IS NULL
      AND status = 'active'
  ) INTO v_has_front_or_interior;

  RETURN jsonb_build_object(
    'location_id', p_location_id,
    'is_mapped', v_visual_count > 0,
    'visual_node_count', v_visual_count,
    'has_top_down', v_has_top_down,
    'has_front_or_interior', v_has_front_or_interior
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_warehouse_location_archive(
  p_location_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_direct_stock_count BIGINT := 0;
  v_descendant_stock_count BIGINT := 0;
  v_active_children_count BIGINT := 0;
  v_reserved_stock_count BIGINT := 0;
  v_open_assignment_count BIGINT := 0;
  v_has_sku_rules BOOLEAN := false;
BEGIN
  -- direct stock
  SELECT COUNT(*) INTO v_direct_stock_count
  FROM public.product_location_stock pls
  WHERE pls.location_id = p_location_id
    AND COALESCE(pls.quantity, 0) > 0;

  -- descendant stock
  WITH RECURSIVE descendants AS (
    SELECT wl.id
    FROM public.warehouse_locations wl
    WHERE wl.parent_id = p_location_id AND wl.deleted_at IS NULL
    UNION ALL
    SELECT wl2.id
    FROM public.warehouse_locations wl2
    JOIN descendants d ON d.id = wl2.parent_id
    WHERE wl2.deleted_at IS NULL
  )
  SELECT COUNT(*) INTO v_descendant_stock_count
  FROM public.product_location_stock pls
  JOIN descendants d ON d.id = pls.location_id
  WHERE COALESCE(pls.quantity, 0) > 0;

  -- active children
  SELECT COUNT(*) INTO v_active_children_count
  FROM public.warehouse_locations wl
  WHERE wl.parent_id = p_location_id
    AND wl.deleted_at IS NULL
    AND wl.status = 'active';

  -- reserved stock if table exists
  IF to_regclass('public.stock_reservations') IS NOT NULL THEN
    EXECUTE $$
      SELECT COUNT(*)
      FROM public.stock_reservations sr
      WHERE sr.location_id = $1
        AND COALESCE(sr.status, 'active') IN ('active', 'partially_released')
        AND COALESCE(sr.deleted_at, NULL) IS NULL
    $$ INTO v_reserved_stock_count USING p_location_id;
  END IF;

  -- open inbound/outbound assignments safe stub (TODO: wire to concrete assignment tables when available)
  v_open_assignment_count := 0;

  -- SKU rules safe stub (TODO: wire to concrete SKU-location rule table when available)
  v_has_sku_rules := false;

  RETURN jsonb_build_object(
    'location_id', p_location_id,
    'can_archive', (
      v_direct_stock_count = 0
      AND v_descendant_stock_count = 0
      AND v_active_children_count = 0
      AND v_reserved_stock_count = 0
      AND v_open_assignment_count = 0
      AND v_has_sku_rules = false
    ),
    'blockers', jsonb_build_object(
      'direct_stock_count', v_direct_stock_count,
      'descendant_stock_count', v_descendant_stock_count,
      'active_children_count', v_active_children_count,
      'reserved_stock_count', v_reserved_stock_count,
      'open_assignment_count', v_open_assignment_count,
      'has_sku_rules', v_has_sku_rules
    )
  );
END;
$$;
