-- Locations V2 Phase 1.4: mapping status + archive validation

CREATE OR REPLACE FUNCTION public.get_warehouse_location_mapping_status(
  p_location_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_visual_count INTEGER := 0;
  v_has_top_down BOOLEAN := false;
  v_has_front_or_interior BOOLEAN := false;
  v_active_child_count INTEGER := 0;
  v_mapped_child_count INTEGER := 0;
  v_unmapped_child_count INTEGER := 0;
  v_mapping_status TEXT := 'unmapped';
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

  SELECT COUNT(*) INTO v_active_child_count
  FROM public.warehouse_locations c
  WHERE c.parent_id = p_location_id
    AND c.deleted_at IS NULL
    AND COALESCE(c.status, 'active') = 'active';

  SELECT COUNT(*) INTO v_mapped_child_count
  FROM public.warehouse_locations c
  WHERE c.parent_id = p_location_id
    AND c.deleted_at IS NULL
    AND COALESCE(c.status, 'active') = 'active'
    AND EXISTS (
      SELECT 1 FROM public.warehouse_location_visual_nodes n
      WHERE n.location_id = c.id
        AND n.deleted_at IS NULL
        AND n.status = 'active'
    );

  v_unmapped_child_count := GREATEST(v_active_child_count - v_mapped_child_count, 0);

  IF v_visual_count = 0 THEN
    v_mapping_status := 'unmapped';
  ELSIF v_unmapped_child_count > 0 THEN
    v_mapping_status := 'partially_mapped';
  ELSE
    v_mapping_status := 'mapped';
  END IF;

  RETURN jsonb_build_object(
    'location_id', p_location_id,
    'mapping_status', v_mapping_status,
    'is_mapped', v_visual_count > 0,
    'visual_node_count', v_visual_count,
    'active_child_count', v_active_child_count,
    'mapped_child_count', v_mapped_child_count,
    'unmapped_child_count', v_unmapped_child_count,
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
  v_direct_stock_qty NUMERIC := 0;
  v_desc_stock_count BIGINT := 0;
  v_desc_stock_qty NUMERIC := 0;
  v_active_children_count BIGINT := 0;
  v_reserved_stock_count BIGINT := 0;
  v_has_visual_nodes BIGINT := 0;
  v_blockers JSONB := '[]'::jsonb;
  v_warnings JSONB := '[]'::jsonb;
BEGIN
  SELECT COUNT(*), COALESCE(SUM(pls.quantity), 0)
    INTO v_direct_stock_count, v_direct_stock_qty
  FROM public.product_location_stock pls
  WHERE pls.location_id = p_location_id
    AND COALESCE(pls.quantity, 0) > 0;

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
  SELECT COUNT(*), COALESCE(SUM(pls.quantity), 0)
    INTO v_desc_stock_count, v_desc_stock_qty
  FROM public.product_location_stock pls
  JOIN descendants d ON d.id = pls.location_id
  WHERE COALESCE(pls.quantity, 0) > 0;

  SELECT COUNT(*) INTO v_active_children_count
  FROM public.warehouse_locations wl
  WHERE wl.parent_id = p_location_id
    AND wl.deleted_at IS NULL
    AND COALESCE(wl.status, 'active') = 'active';

  IF to_regclass('public.stock_reservations') IS NOT NULL
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='stock_reservations' AND column_name='location_id')
  THEN
    EXECUTE format('SELECT COUNT(*) FROM public.stock_reservations sr WHERE sr.location_id = $1 %s %s',
      CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='stock_reservations' AND column_name='status')
           THEN 'AND COALESCE(sr.status, ''active'') IN (''active'', ''partially_released'')' ELSE '' END,
      CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='stock_reservations' AND column_name='deleted_at')
           THEN 'AND sr.deleted_at IS NULL' ELSE '' END
    ) INTO v_reserved_stock_count USING p_location_id;
  END IF;

  SELECT COUNT(*) INTO v_has_visual_nodes
  FROM public.warehouse_location_visual_nodes n
  WHERE n.location_id = p_location_id
    AND n.deleted_at IS NULL
    AND n.status = 'active';

  IF v_direct_stock_count > 0 THEN
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object('type','direct_stock','message','Location contains active inventory','count',v_direct_stock_count,'quantity',v_direct_stock_qty));
  END IF;
  IF v_desc_stock_count > 0 THEN
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object('type','descendant_stock','message','Descendant locations contain active inventory','count',v_desc_stock_count,'quantity',v_desc_stock_qty));
  END IF;
  IF v_active_children_count > 0 THEN
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object('type','active_children','message','Location has active child locations','count',v_active_children_count));
  END IF;
  IF v_reserved_stock_count > 0 THEN
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object('type','reserved_stock','message','Location has active stock reservations','count',v_reserved_stock_count));
  END IF;
  IF v_has_visual_nodes > 0 THEN
    v_warnings := v_warnings || jsonb_build_array(jsonb_build_object('type','has_visual_nodes','message','Location has visual map representations','count',v_has_visual_nodes));
  END IF;

  RETURN jsonb_build_object(
    'location_id', p_location_id,
    'can_archive', jsonb_array_length(v_blockers) = 0,
    'blockers', v_blockers,
    'warnings', v_warnings
  );
END;
$$;
