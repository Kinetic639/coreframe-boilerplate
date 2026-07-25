ALTER TABLE public.warehouse_locations
ADD COLUMN IF NOT EXISTS elevation_level integer;

UPDATE public.warehouse_locations
SET elevation_level = 1
WHERE elevation_level IS NULL;

ALTER TABLE public.warehouse_locations
ALTER COLUMN elevation_level SET DEFAULT 1;

ALTER TABLE public.warehouse_locations
ALTER COLUMN elevation_level SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'warehouse_locations_elevation_level_check'
  ) THEN
    ALTER TABLE public.warehouse_locations
    ADD CONSTRAINT warehouse_locations_elevation_level_check
    CHECK (elevation_level >= 1);
  END IF;
END
$$;
