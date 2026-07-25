BEGIN;

ALTER TABLE public.warehouse_locations
  ADD COLUMN IF NOT EXISTS inherit_parent_color BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.warehouse_locations.inherit_parent_color IS
  'When true, the location inherits its effective display color from its parent location.';

COMMIT;
