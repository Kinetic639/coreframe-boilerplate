-- =============================================================================
-- Inventory location placement model
-- =============================================================================
-- Branch remains the stock ownership boundary. Warehouse locations describe
-- internal placement only: bins may hold balances, higher-level nodes aggregate
-- child-bin balances, and bin-to-bin transfers stay inside the same branch.

ALTER TABLE public.warehouse_locations
  ADD COLUMN IF NOT EXISTS can_store_inventory boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.warehouse_locations.can_store_inventory IS
  'True when this location can directly hold inventory balances. By default only physical bins should be stockable.';

UPDATE public.warehouse_locations
SET can_store_inventory = true
WHERE deleted_at IS NULL
  AND lower(coalesce(storage_mode, '')) IN (
    'bin',
    'storage',
    'standard',
    'receiving',
    'shipping',
    'returns',
    'quarantine',
    'staging',
    'transit',
    'adjustment'
  );

CREATE INDEX IF NOT EXISTS warehouse_locations_stockable_idx
  ON public.warehouse_locations (organization_id, branch_id, can_store_inventory)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.inventory_putaway_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  product_id uuid NULL,
  variant_id uuid NULL,
  product_category text NULL,
  destination_location_id uuid NOT NULL,
  priority integer NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,
  updated_by uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL,
  CONSTRAINT inventory_putaway_rules_branch_org_fk
    FOREIGN KEY (branch_id, organization_id)
    REFERENCES public.branches (id, organization_id),
  CONSTRAINT inventory_putaway_rules_product_fk
    FOREIGN KEY (product_id, organization_id)
    REFERENCES public.inventory_products (id, organization_id)
    ON DELETE CASCADE,
  CONSTRAINT inventory_putaway_rules_variant_fk
    FOREIGN KEY (variant_id, organization_id)
    REFERENCES public.inventory_variants (id, organization_id),
  CONSTRAINT inventory_putaway_rules_destination_location_fk
    FOREIGN KEY (destination_location_id, organization_id, branch_id)
    REFERENCES public.warehouse_locations (id, organization_id, branch_id),
  CONSTRAINT inventory_putaway_rules_target_check
    CHECK (product_id IS NOT NULL OR variant_id IS NOT NULL OR product_category IS NOT NULL),
  CONSTRAINT inventory_putaway_rules_priority_check
    CHECK (priority >= 0)
);

CREATE INDEX IF NOT EXISTS inventory_putaway_rules_destination_idx
  ON public.inventory_putaway_rules (organization_id, branch_id, destination_location_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS inventory_putaway_rules_variant_idx
  ON public.inventory_putaway_rules (organization_id, branch_id, variant_id, priority)
  WHERE deleted_at IS NULL AND variant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS inventory_putaway_rules_product_idx
  ON public.inventory_putaway_rules (organization_id, branch_id, product_id, priority)
  WHERE deleted_at IS NULL AND product_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.inventory_containers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  code text NOT NULL,
  type text NOT NULL DEFAULT 'container',
  status text NOT NULL DEFAULT 'active',
  current_location_id uuid NOT NULL,
  reference_type text NULL,
  reference_id text NULL,
  created_by uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,
  updated_by uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL,
  CONSTRAINT inventory_containers_branch_org_fk
    FOREIGN KEY (branch_id, organization_id)
    REFERENCES public.branches (id, organization_id),
  CONSTRAINT inventory_containers_current_location_fk
    FOREIGN KEY (current_location_id, organization_id, branch_id)
    REFERENCES public.warehouse_locations (id, organization_id, branch_id),
  CONSTRAINT inventory_containers_code_not_blank CHECK (length(trim(code)) > 0),
  CONSTRAINT inventory_containers_status_check CHECK (status IN ('active', 'sealed', 'in_transit', 'archived'))
);

CREATE UNIQUE INDEX IF NOT EXISTS inventory_containers_code_uidx
  ON public.inventory_containers (organization_id, branch_id, lower(code))
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS inventory_containers_location_idx
  ON public.inventory_containers (organization_id, branch_id, current_location_id)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS inventory_containers_org_branch_id_uidx
  ON public.inventory_containers (id, organization_id, branch_id);

CREATE TABLE IF NOT EXISTS public.inventory_container_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  container_id uuid NOT NULL,
  variant_id uuid NOT NULL,
  unit_id uuid NOT NULL,
  lot_id uuid NULL,
  serial_id uuid NULL,
  quantity numeric(18, 6) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL,
  CONSTRAINT inventory_container_lines_container_fk
    FOREIGN KEY (container_id, organization_id, branch_id)
    REFERENCES public.inventory_containers (id, organization_id, branch_id)
    ON DELETE CASCADE,
  CONSTRAINT inventory_container_lines_variant_fk
    FOREIGN KEY (variant_id, organization_id)
    REFERENCES public.inventory_variants (id, organization_id),
  CONSTRAINT inventory_container_lines_unit_fk
    FOREIGN KEY (unit_id, organization_id)
    REFERENCES public.inventory_units (id, organization_id),
  CONSTRAINT inventory_container_lines_quantity_positive CHECK (quantity > 0)
);

CREATE INDEX IF NOT EXISTS inventory_container_lines_container_idx
  ON public.inventory_container_lines (organization_id, branch_id, container_id)
  WHERE deleted_at IS NULL;

ALTER TABLE public.inventory_movement_lines
  ADD COLUMN IF NOT EXISTS container_id uuid NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'inventory_movement_lines_container_fk'
      AND conrelid = 'public.inventory_movement_lines'::regclass
  ) THEN
    ALTER TABLE public.inventory_movement_lines
      ADD CONSTRAINT inventory_movement_lines_container_fk
      FOREIGN KEY (container_id, organization_id, branch_id)
      REFERENCES public.inventory_containers (id, organization_id, branch_id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS inventory_movement_lines_container_idx
  ON public.inventory_movement_lines (organization_id, branch_id, container_id)
  WHERE container_id IS NOT NULL;

ALTER TABLE public.inventory_putaway_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_putaway_rules FORCE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_containers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_containers FORCE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_container_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_container_lines FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inventory_putaway_rules_select ON public.inventory_putaway_rules;
CREATE POLICY inventory_putaway_rules_select
  ON public.inventory_putaway_rules FOR SELECT
  USING (
    deleted_at IS NULL
    AND public.has_branch_permission(organization_id, branch_id, 'warehouse.inventory.read')
  );

DROP POLICY IF EXISTS inventory_putaway_rules_manage ON public.inventory_putaway_rules;
CREATE POLICY inventory_putaway_rules_manage
  ON public.inventory_putaway_rules FOR ALL
  USING (public.has_branch_permission(organization_id, branch_id, 'warehouse.inventory.operate'))
  WITH CHECK (public.has_branch_permission(organization_id, branch_id, 'warehouse.inventory.operate'));

DROP POLICY IF EXISTS inventory_containers_select ON public.inventory_containers;
CREATE POLICY inventory_containers_select
  ON public.inventory_containers FOR SELECT
  USING (
    deleted_at IS NULL
    AND public.has_branch_permission(organization_id, branch_id, 'warehouse.inventory.read')
  );

DROP POLICY IF EXISTS inventory_containers_manage ON public.inventory_containers;
CREATE POLICY inventory_containers_manage
  ON public.inventory_containers FOR ALL
  USING (public.has_branch_permission(organization_id, branch_id, 'warehouse.inventory.operate'))
  WITH CHECK (public.has_branch_permission(organization_id, branch_id, 'warehouse.inventory.operate'));

DROP POLICY IF EXISTS inventory_container_lines_select ON public.inventory_container_lines;
CREATE POLICY inventory_container_lines_select
  ON public.inventory_container_lines FOR SELECT
  USING (
    deleted_at IS NULL
    AND public.has_branch_permission(organization_id, branch_id, 'warehouse.inventory.read')
  );

DROP POLICY IF EXISTS inventory_container_lines_manage ON public.inventory_container_lines;
CREATE POLICY inventory_container_lines_manage
  ON public.inventory_container_lines FOR ALL
  USING (public.has_branch_permission(organization_id, branch_id, 'warehouse.inventory.operate'))
  WITH CHECK (public.has_branch_permission(organization_id, branch_id, 'warehouse.inventory.operate'));
