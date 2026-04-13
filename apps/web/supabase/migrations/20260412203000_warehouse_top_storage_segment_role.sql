BEGIN;

COMMENT ON COLUMN public.warehouse_locations.map_role IS
  'Mapping role hint: logical, layout_root, top_down_unit, front_segment, or top_storage_segment.';

ALTER TABLE public.warehouse_locations
  DROP CONSTRAINT IF EXISTS warehouse_locations_map_role_valid;

ALTER TABLE public.warehouse_locations
  ADD CONSTRAINT warehouse_locations_map_role_valid
    CHECK (map_role IN ('logical', 'layout_root', 'top_down_unit', 'front_segment', 'top_storage_segment'));

COMMIT;
