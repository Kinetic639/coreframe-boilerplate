-- Locations V2 manual verification queries

-- 1) shape parity
SELECT
  (SELECT COUNT(*) FROM public.warehouse_layout_shapes s WHERE s.deleted_at IS NULL AND s.shape_type = 'location' AND s.location_id IS NOT NULL) AS old_location_shape_count,
  (SELECT COUNT(*) FROM public.warehouse_location_visual_nodes n WHERE n.deleted_at IS NULL AND n.status = 'active') AS new_visual_node_count;

-- 2) null / invalid warehouse location flags
SELECT COUNT(*) AS null_can_store_inventory
FROM public.warehouse_locations
WHERE can_store_inventory IS NULL;

SELECT COUNT(*) AS null_location_category
FROM public.warehouse_locations
WHERE location_category IS NULL;

SELECT COUNT(*) AS invalid_location_status
FROM public.warehouse_locations
WHERE status IS NULL OR status NOT IN ('active','inactive','archived');

-- 3) null / invalid visual flags
SELECT COUNT(*) AS invalid_visual_role
FROM public.warehouse_location_visual_nodes
WHERE visual_role IS NULL OR visual_role NOT IN ('primary','label','reference','aggregate');

SELECT COUNT(*) AS invalid_visual_status
FROM public.warehouse_location_visual_nodes
WHERE status IS NULL OR status NOT IN ('active','hidden','historical');

-- 4) invalid split size_mode
SELECT COUNT(*) AS invalid_split_size_mode
FROM public.warehouse_layout_split_nodes
WHERE size_mode IS NULL OR size_mode NOT IN ('equal','ratio','fixed','auto');

-- 5) duplicate active primary nodes
SELECT location_id, view_type,
  COALESCE(layout_id, '00000000-0000-0000-0000-000000000000'::uuid) AS layout_id,
  COALESCE(view_context_location_id, '00000000-0000-0000-0000-000000000000'::uuid) AS view_context_location_id,
  COUNT(*)
FROM public.warehouse_location_visual_nodes
WHERE deleted_at IS NULL AND status = 'active' AND visual_role = 'primary'
GROUP BY 1,2,3,4
HAVING COUNT(*) > 1;

-- 6) storage-capable parents with active children
SELECT p.id, p.name, COUNT(c.id) AS active_children
FROM public.warehouse_locations p
JOIN public.warehouse_locations c ON c.parent_id = p.id AND c.deleted_at IS NULL AND COALESCE(c.status, 'active') = 'active'
WHERE p.deleted_at IS NULL AND p.can_store_inventory = true
GROUP BY p.id, p.name;

-- 7) stock-holding unmapped locations
-- NOTE: actual deployed stock table is inventory_balances (column: on_hand_quantity).
-- product_location_stock does not exist in this schema.
SELECT wl.id, wl.organization_id, wl.branch_id, wl.name
FROM public.warehouse_locations wl
JOIN public.inventory_balances ib ON ib.location_id = wl.id AND COALESCE(ib.on_hand_quantity, 0) > 0
LEFT JOIN public.warehouse_location_visual_nodes n
  ON n.location_id = wl.id AND n.deleted_at IS NULL AND n.status = 'active'
WHERE wl.deleted_at IS NULL
GROUP BY wl.id
HAVING COUNT(n.id) = 0;

-- 8) stock on can_store_inventory=false locations
SELECT wl.id, wl.organization_id, wl.branch_id, wl.name, SUM(ib.on_hand_quantity) AS total_qty
FROM public.warehouse_locations wl
JOIN public.inventory_balances ib ON ib.location_id = wl.id
WHERE wl.deleted_at IS NULL AND wl.can_store_inventory = false
GROUP BY wl.id, wl.organization_id, wl.branch_id, wl.name
HAVING SUM(ib.on_hand_quantity) > 0;
