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

-- Controlled V2 categories only.
UPDATE public.warehouse_locations
SET location_category = CASE
  WHEN map_role = 'top_down_unit' THEN 'rack'
  WHEN map_role = 'front_segment' THEN 'shelf'
  WHEN map_role = 'top_storage_segment' THEN 'bin'
  WHEN map_role = 'layout_root' THEN 'area'
  WHEN map_role = 'logical' THEN 'custom'
  ELSE 'custom'
END
WHERE location_category IS NULL
   OR location_category NOT IN (
     'area','zone','room','cabinet','rack','shelf_unit','workbench',
     'shelf','drawer','bin','box','pallet_position','wall_storage',
     'receiving','dispatch','quarantine','temporary','custom'
   );

ALTER TABLE public.warehouse_locations
  DROP CONSTRAINT IF EXISTS warehouse_locations_location_category_valid;

ALTER TABLE public.warehouse_locations
  ADD CONSTRAINT warehouse_locations_location_category_valid
  CHECK (
    location_category IN (
      'area','zone','room','cabinet','rack','shelf_unit','workbench',
      'shelf','drawer','bin','box','pallet_position','wall_storage',
      'receiving','dispatch','quarantine','temporary','custom'
    )
  );

-- Conservative can_store_inventory backfill.
UPDATE public.warehouse_locations wl
SET can_store_inventory = true
WHERE wl.deleted_at IS NULL
  AND wl.can_store_inventory IS NULL
  AND wl.map_role IN ('front_segment', 'top_storage_segment')
  AND NOT EXISTS (
    SELECT 1
    FROM public.warehouse_locations child
    WHERE child.parent_id = wl.id
      AND child.deleted_at IS NULL
  );

UPDATE public.warehouse_locations wl
SET can_store_inventory = false
WHERE wl.can_store_inventory IS NULL;

CREATE INDEX IF NOT EXISTS wl_status_active_idx
  ON public.warehouse_locations (organization_id, branch_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS wl_category_active_idx
  ON public.warehouse_locations (organization_id, branch_id, location_category)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS wl_can_store_inventory_active_idx
  ON public.warehouse_locations (organization_id, branch_id, can_store_inventory)
  WHERE deleted_at IS NULL;
