-- Locations V2 Phase 1.1: entity cleanup (additive)

ALTER TABLE public.warehouse_locations
  ADD COLUMN IF NOT EXISTS can_store_inventory BOOLEAN,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  ADD COLUMN IF NOT EXISTS location_category TEXT,
  ADD COLUMN IF NOT EXISTS width_mm INTEGER,
  ADD COLUMN IF NOT EXISTS height_mm INTEGER,
  ADD COLUMN IF NOT EXISTS depth_mm INTEGER;

ALTER TABLE public.warehouse_locations
  DROP CONSTRAINT IF EXISTS warehouse_locations_dimensions_non_negative;

ALTER TABLE public.warehouse_locations
  ADD CONSTRAINT warehouse_locations_dimensions_non_negative
  CHECK (
    (width_mm IS NULL OR width_mm > 0) AND
    (height_mm IS NULL OR height_mm > 0) AND
    (depth_mm IS NULL OR depth_mm > 0)
  );

-- Conservative backfill from legacy meter fields when present.
UPDATE public.warehouse_locations
SET
  width_mm = COALESCE(width_mm, CASE WHEN physical_width_m IS NOT NULL AND physical_width_m > 0 THEN (physical_width_m * 1000)::INTEGER END),
  height_mm = COALESCE(height_mm, CASE WHEN physical_height_m IS NOT NULL AND physical_height_m > 0 THEN (physical_height_m * 1000)::INTEGER END),
  depth_mm = COALESCE(depth_mm, CASE WHEN physical_depth_m IS NOT NULL AND physical_depth_m > 0 THEN (physical_depth_m * 1000)::INTEGER END)
WHERE true;

-- Conservative category backfill (do not expose deprecated concepts in new UI).
UPDATE public.warehouse_locations
SET location_category = COALESCE(
  location_category,
  CASE
    WHEN top_storage_segment IS NOT NULL THEN 'storage'
    WHEN map_role IN ('storage', 'rack', 'shelf', 'bin') THEN 'storage'
    WHEN map_role IN ('receiving', 'dispatch') THEN map_role
    WHEN map_role IS NOT NULL THEN 'general'
    ELSE NULL
  END
)
WHERE location_category IS NULL;

-- Safe default for can_store_inventory only when old role is strongly storage-like.
UPDATE public.warehouse_locations
SET can_store_inventory = true
WHERE can_store_inventory IS NULL
  AND map_role IN ('storage', 'rack', 'shelf', 'bin', 'slot');

-- For remaining rows keep explicit false until manually classified.
UPDATE public.warehouse_locations
SET can_store_inventory = false
WHERE can_store_inventory IS NULL;

CREATE INDEX IF NOT EXISTS wl_status_active_idx
  ON public.warehouse_locations (organization_id, branch_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS wl_category_active_idx
  ON public.warehouse_locations (organization_id, branch_id, location_category)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS wl_can_store_inventory_active_idx
  ON public.warehouse_locations (organization_id, branch_id, can_store_inventory)
  WHERE deleted_at IS NULL;
