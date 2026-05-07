-- Locations V2 Phase 1.5: backfill legacy location shapes into visual nodes

INSERT INTO public.warehouse_location_visual_nodes (
  layout_id,
  organization_id,
  branch_id,
  location_id,
  view_type,
  view_context_location_id,
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
  'top_down'::TEXT,
  l.root_location_id,
  COALESCE(wl.map_role, 'legacy_location_shape')::TEXT,
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
ON CONFLICT DO NOTHING;
