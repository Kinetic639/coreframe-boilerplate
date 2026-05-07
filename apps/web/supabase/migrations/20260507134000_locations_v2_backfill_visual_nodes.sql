-- Locations V2 Phase 1.5: backfill legacy location shapes into visual nodes
-- NOTE:
-- - `warehouse_layout_shapes` remains for legacy/decorative shapes and old editor compatibility.
-- - V2 location visuals should read from `warehouse_location_visual_nodes`.

INSERT INTO public.warehouse_location_visual_nodes (
  layout_id,
  organization_id,
  branch_id,
  location_id,
  view_type,
  view_context_location_id,
  visualization_type,
  visual_role,
  status,
  x_mm,
  y_mm,
  z_mm,
  width_mm,
  height_mm,
  depth_mm,
  rotation_deg,
  style,
  z_index,
  sort_order,
  created_by,
  updated_by,
  created_at,
  updated_at
)
SELECT
  s.layout_id,
  s.organization_id,
  s.branch_id,
  s.location_id,
  CASE
    WHEN COALESCE(s.projection, 'top_down') = 'front_elevation' THEN 'front'
    ELSE 'top_down'
  END::TEXT,
  COALESCE(s.anchor_location_id, l.root_location_id),
  CASE
    WHEN wl.map_role = 'top_down_unit' THEN 'rack'
    WHEN wl.map_role = 'front_segment' THEN 'grid'
    WHEN wl.map_role = 'top_storage_segment' THEN 'bin'
    ELSE 'rectangle'
  END::TEXT,
  'primary'::TEXT,
  'active'::TEXT,
  GREATEST((s.x * 1000)::INTEGER, 0),
  GREATEST((s.y * 1000)::INTEGER, 0),
  0,
  GREATEST((s.width * 1000)::INTEGER, 1),
  GREATEST((COALESCE(wl.physical_height_m, s.height) * 1000)::INTEGER, 1),
  GREATEST((COALESCE(wl.physical_depth_m, s.height) * 1000)::INTEGER, 1),
  s.rotation,
  s.style,
  s.z_index,
  s.sort_order,
  s.created_by,
  s.created_by,
  s.created_at,
  s.updated_at
FROM public.warehouse_layout_shapes s
JOIN public.warehouse_layouts l ON l.id = s.layout_id
JOIN public.warehouse_locations wl ON wl.id = s.location_id
WHERE s.deleted_at IS NULL
  AND s.shape_type = 'location'
  AND s.location_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.warehouse_location_visual_nodes n
    WHERE n.location_id = s.location_id
      AND n.layout_id = s.layout_id
      AND n.view_type = (CASE WHEN COALESCE(s.projection, 'top_down') = 'front_elevation' THEN 'front' ELSE 'top_down' END)
      AND COALESCE(n.view_context_location_id, '00000000-0000-0000-0000-000000000000'::uuid) = COALESCE(COALESCE(s.anchor_location_id, l.root_location_id), '00000000-0000-0000-0000-000000000000'::uuid)
      AND n.visual_role = 'primary'
      AND n.deleted_at IS NULL
      AND n.status = 'active'
  );
