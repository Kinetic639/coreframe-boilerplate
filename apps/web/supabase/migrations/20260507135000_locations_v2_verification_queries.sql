-- Locations V2 Phase 1.6: verification queries (run manually after apply)

-- 1) old location shapes vs new visual nodes counts
SELECT
  (SELECT COUNT(*) FROM public.warehouse_layout_shapes s WHERE s.deleted_at IS NULL AND s.shape_type = 'location' AND s.location_id IS NOT NULL) AS old_location_shapes_count,
  (SELECT COUNT(*) FROM public.warehouse_location_visual_nodes n WHERE n.deleted_at IS NULL AND n.status = 'active') AS new_visual_nodes_count;

-- 2) stock-holding unmapped locations
SELECT wl.id, wl.organization_id, wl.branch_id, wl.name
FROM public.warehouse_locations wl
JOIN public.product_location_stock pls ON pls.location_id = wl.id AND COALESCE(pls.quantity, 0) > 0
LEFT JOIN public.warehouse_location_visual_nodes n
  ON n.location_id = wl.id AND n.deleted_at IS NULL AND n.status = 'active'
WHERE wl.deleted_at IS NULL
GROUP BY wl.id
HAVING COUNT(n.id) = 0;

-- 3) stock assigned to can_store_inventory=false
SELECT wl.id, wl.name, COALESCE(SUM(pls.quantity), 0) AS qty
FROM public.warehouse_locations wl
JOIN public.product_location_stock pls ON pls.location_id = wl.id
WHERE wl.deleted_at IS NULL
  AND wl.can_store_inventory = false
GROUP BY wl.id, wl.name
HAVING COALESCE(SUM(pls.quantity), 0) > 0;

-- 4) parent locations with can_store_inventory=true and active children
SELECT p.id, p.name, COUNT(c.id) AS active_children
FROM public.warehouse_locations p
JOIN public.warehouse_locations c ON c.parent_id = p.id AND c.deleted_at IS NULL AND c.status = 'active'
WHERE p.deleted_at IS NULL
  AND p.can_store_inventory = true
GROUP BY p.id, p.name;

-- 5) duplicate active primary visual nodes in same scope
SELECT layout_id, view_type, COALESCE(view_context_location_id, '00000000-0000-0000-0000-000000000000'::uuid) AS view_context_location_id, location_id, COUNT(*)
FROM public.warehouse_location_visual_nodes
WHERE deleted_at IS NULL AND status = 'active'
GROUP BY layout_id, view_type, COALESCE(view_context_location_id, '00000000-0000-0000-0000-000000000000'::uuid), location_id
HAVING COUNT(*) > 1;
