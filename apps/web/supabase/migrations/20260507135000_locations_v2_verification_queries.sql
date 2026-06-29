-- Locations V2 Phase 1.6: reusable verification function
--
-- Stock table note: the deployed inventory table is `inventory_balances`
-- (column: on_hand_quantity), not `product_location_stock`.
-- Both stock queries are guarded via to_regclass + column existence so
-- the function is safe to create and call regardless of which tables exist.

CREATE OR REPLACE FUNCTION public.verify_locations_v2_migration()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_old_location_shape_count              BIGINT := 0;
  v_new_visual_node_count                 BIGINT := 0;
  v_unmapped_stock_holding_locations      BIGINT := 0;
  v_stock_on_non_storable_locations       BIGINT := 0;
  v_storage_capable_parents_with_children BIGINT := 0;
  v_duplicate_active_primary_visual_nodes BIGINT := 0;
  v_invalid_location_categories           BIGINT := 0;
  v_null_can_store_inventory              BIGINT := 0;
  v_invalid_location_status               BIGINT := 0;
  v_invalid_visual_roles                  BIGINT := 0;
  v_invalid_visual_statuses               BIGINT := 0;
  v_invalid_split_size_modes              BIGINT := 0;
BEGIN
  SELECT COUNT(*) INTO v_old_location_shape_count
  FROM public.warehouse_layout_shapes s
  WHERE s.deleted_at IS NULL AND s.shape_type = 'location' AND s.location_id IS NOT NULL;

  SELECT COUNT(*) INTO v_new_visual_node_count
  FROM public.warehouse_location_visual_nodes n
  WHERE n.deleted_at IS NULL AND n.status = 'active';

  -- Stock checks: guarded against table/column non-existence.
  -- Uses inventory_balances (actual deployed stock table; qty column = on_hand_quantity).
  IF to_regclass('public.inventory_balances') IS NOT NULL
     AND EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'inventory_balances'
                   AND column_name = 'location_id')
     AND EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'inventory_balances'
                   AND column_name = 'on_hand_quantity')
  THEN
    EXECUTE $q$
      SELECT COUNT(*) FROM (
        SELECT wl.id
        FROM public.warehouse_locations wl
        JOIN public.inventory_balances ib
          ON ib.location_id = wl.id AND COALESCE(ib.on_hand_quantity, 0) > 0
        LEFT JOIN public.warehouse_location_visual_nodes n
          ON n.location_id = wl.id AND n.deleted_at IS NULL AND n.status = 'active'
        WHERE wl.deleted_at IS NULL
        GROUP BY wl.id
        HAVING COUNT(n.id) = 0
      ) q
    $q$ INTO v_unmapped_stock_holding_locations;

    EXECUTE $q$
      SELECT COUNT(*) FROM (
        SELECT wl.id
        FROM public.warehouse_locations wl
        JOIN public.inventory_balances ib ON ib.location_id = wl.id
        WHERE wl.deleted_at IS NULL AND wl.can_store_inventory = false
        GROUP BY wl.id
        HAVING COALESCE(SUM(ib.on_hand_quantity), 0) > 0
      ) q
    $q$ INTO v_stock_on_non_storable_locations;
  END IF;

  SELECT COUNT(*) INTO v_storage_capable_parents_with_children
  FROM (
    SELECT p.id
    FROM public.warehouse_locations p
    JOIN public.warehouse_locations c ON c.parent_id = p.id
      AND c.deleted_at IS NULL AND COALESCE(c.status, 'active') = 'active'
    WHERE p.deleted_at IS NULL AND p.can_store_inventory = true
    GROUP BY p.id
  ) q;

  SELECT COUNT(*) INTO v_duplicate_active_primary_visual_nodes
  FROM (
    SELECT n.location_id, n.view_type,
      COALESCE(n.layout_id, '00000000-0000-0000-0000-000000000000'::uuid),
      COALESCE(n.view_context_location_id, '00000000-0000-0000-0000-000000000000'::uuid)
    FROM public.warehouse_location_visual_nodes n
    WHERE n.deleted_at IS NULL AND n.status = 'active' AND n.visual_role = 'primary'
    GROUP BY 1, 2, 3, 4
    HAVING COUNT(*) > 1
  ) q;

  SELECT COUNT(*) INTO v_invalid_location_categories
  FROM public.warehouse_locations wl
  WHERE wl.location_category IS NULL
    OR wl.location_category NOT IN (
      'area', 'zone', 'room', 'cabinet', 'rack', 'shelf_unit', 'workbench',
      'shelf', 'drawer', 'bin', 'box', 'pallet_position', 'wall_storage',
      'receiving', 'dispatch', 'quarantine', 'temporary', 'custom'
    );

  SELECT COUNT(*) INTO v_null_can_store_inventory
  FROM public.warehouse_locations wl
  WHERE wl.can_store_inventory IS NULL;

  SELECT COUNT(*) INTO v_invalid_location_status
  FROM public.warehouse_locations wl
  WHERE wl.status IS NULL OR wl.status NOT IN ('active', 'inactive', 'archived');

  SELECT COUNT(*) INTO v_invalid_visual_roles
  FROM public.warehouse_location_visual_nodes n
  WHERE n.visual_role NOT IN ('primary', 'label', 'reference', 'aggregate');

  SELECT COUNT(*) INTO v_invalid_visual_statuses
  FROM public.warehouse_location_visual_nodes n
  WHERE n.status NOT IN ('active', 'hidden', 'historical');

  -- NULL must be checked explicitly; NOT IN does not match NULLs.
  SELECT COUNT(*) INTO v_invalid_split_size_modes
  FROM public.warehouse_layout_split_nodes sn
  WHERE sn.size_mode IS NULL OR sn.size_mode NOT IN ('equal', 'ratio', 'fixed', 'auto');

  RETURN jsonb_build_object(
    'old_location_shape_count',              v_old_location_shape_count,
    'new_visual_node_count',                 v_new_visual_node_count,
    'unmapped_stock_holding_locations',      v_unmapped_stock_holding_locations,
    'stock_on_non_storable_locations',       v_stock_on_non_storable_locations,
    'storage_capable_parents_with_children', v_storage_capable_parents_with_children,
    'duplicate_active_primary_visual_nodes', v_duplicate_active_primary_visual_nodes,
    'invalid_location_categories',           v_invalid_location_categories,
    'null_can_store_inventory',              v_null_can_store_inventory,
    'invalid_location_status',               v_invalid_location_status,
    'invalid_visual_roles',                  v_invalid_visual_roles,
    'invalid_visual_statuses',               v_invalid_visual_statuses,
    'invalid_split_size_modes',              v_invalid_split_size_modes
  );
END;
$$;
