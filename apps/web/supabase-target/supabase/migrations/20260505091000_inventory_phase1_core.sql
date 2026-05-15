-- =============================================================================
-- Migration: inventory_phase1_core
-- Project:   rjeraydumwechpjjzrus (TARGET)
-- Phase:     Ambra Inventory V2 Phase 1 — Core Schema + RLS
-- =============================================================================
-- Architecture guarantees:
--   - Ledger-based inventory: posted movement headers/lines are the source of truth.
--   - Variants are the only stock entity.
--   - Balances are quantity-only projections and never store product_id.
--   - Movement lines store variant_id only; product context is derived via variant.
--   - Reservations and allocations are not movement kinds.
--   - Phase 1 units are base-unit only; conversions arrive later.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Support indexes for composite branch/location validation
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'branches_id_organization_id_unique'
      AND conrelid = 'public.branches'::regclass
  ) THEN
    ALTER TABLE public.branches
      ADD CONSTRAINT branches_id_organization_id_unique UNIQUE (id, organization_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'warehouse_locations_id_org_branch_unique'
      AND conrelid = 'public.warehouse_locations'::regclass
  ) THEN
    ALTER TABLE public.warehouse_locations
      ADD CONSTRAINT warehouse_locations_id_org_branch_unique
      UNIQUE (id, organization_id, branch_id);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Inventory settings
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inventory_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  allow_negative_stock boolean not null default false,
  default_currency text not null default 'USD',
  cost_method text not null default 'none',
  rounding_precision integer not null default 6,
  movement_number_prefix text not null default 'INV',
  movement_number_next bigint not null default 1,
  sku_generation_enabled boolean not null default true,
  sku_prefix text not null default 'SKU',
  sku_next bigint not null default 1,
  expiry_enforcement_enabled boolean not null default false,
  created_by uuid null references public.users(id) on delete set null,
  updated_by uuid null references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint inventory_settings_org_unique unique (organization_id),
  constraint inventory_settings_currency_format check (default_currency ~ '^[A-Z]{3}$'),
  constraint inventory_settings_cost_method_check check (cost_method in ('none', 'weighted_average')),
  constraint inventory_settings_rounding_precision_check check (rounding_precision between 0 and 9),
  constraint inventory_settings_movement_next_positive check (movement_number_next > 0),
  constraint inventory_settings_sku_next_positive check (sku_next > 0),
  constraint inventory_settings_movement_prefix_not_empty check (length(trim(movement_number_prefix)) > 0),
  constraint inventory_settings_sku_prefix_not_empty check (length(trim(sku_prefix)) > 0)
);

COMMENT ON TABLE public.inventory_settings IS
  'Organization-level inventory settings and concurrency-safe number sequences.';
COMMENT ON COLUMN public.inventory_settings.movement_number_next IS
  'Next server-generated user-facing movement number sequence value. Updated only by the movement engine.';
COMMENT ON COLUMN public.inventory_settings.sku_next IS
  'Next server-generated SKU sequence value. Updated only by inventory product creation.';

-- ---------------------------------------------------------------------------
-- Basic units
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inventory_units (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  name text not null,
  unit_kind text not null default 'count',
  precision integer not null default 0,
  is_system boolean not null default false,
  created_by uuid null references public.users(id) on delete set null,
  updated_by uuid null references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint inventory_units_code_not_empty check (length(trim(code)) > 0),
  constraint inventory_units_name_not_empty check (length(trim(name)) > 0),
  constraint inventory_units_precision_check check (precision between 0 and 9),
  constraint inventory_units_kind_check check (
    unit_kind in ('count', 'weight', 'length', 'volume', 'time', 'area', 'other')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS inventory_units_org_code_active_uidx
  ON public.inventory_units (organization_id, lower(code))
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS inventory_units_id_org_uidx
  ON public.inventory_units (id, organization_id);

-- ---------------------------------------------------------------------------
-- Products and variants
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inventory_products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text null,
  product_type text not null default 'stocked',
  status text not null default 'active',
  base_unit_id uuid not null,
  default_variant_id uuid null,
  created_by uuid null references public.users(id) on delete set null,
  updated_by uuid null references public.users(id) on delete set null,
  archived_by uuid null references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz null,
  deleted_at timestamptz null,
  constraint inventory_products_name_not_empty check (length(trim(name)) > 0),
  constraint inventory_products_type_check check (
    product_type in ('stocked', 'consumable', 'service', 'serialized', 'lot_tracked', 'bundle')
  ),
  constraint inventory_products_status_check check (status in ('active', 'archived', 'discontinued')),
  constraint inventory_products_base_unit_fk
    foreign key (base_unit_id, organization_id)
    references public.inventory_units (id, organization_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS inventory_products_id_org_uidx
  ON public.inventory_products (id, organization_id);

CREATE INDEX IF NOT EXISTS inventory_products_org_status_idx
  ON public.inventory_products (organization_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS inventory_products_org_type_idx
  ON public.inventory_products (organization_id, product_type)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.inventory_variants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid not null,
  sku text not null,
  name text not null default 'Default',
  is_default boolean not null default false,
  status text not null default 'active',
  created_by uuid null references public.users(id) on delete set null,
  updated_by uuid null references public.users(id) on delete set null,
  archived_by uuid null references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz null,
  deleted_at timestamptz null,
  constraint inventory_variants_product_fk
    foreign key (product_id, organization_id)
    references public.inventory_products (id, organization_id)
    on delete cascade,
  constraint inventory_variants_sku_not_empty check (length(trim(sku)) > 0),
  constraint inventory_variants_name_not_empty check (length(trim(name)) > 0),
  constraint inventory_variants_status_check check (status in ('active', 'archived', 'discontinued'))
);

CREATE UNIQUE INDEX IF NOT EXISTS inventory_variants_id_org_uidx
  ON public.inventory_variants (id, organization_id);

CREATE UNIQUE INDEX IF NOT EXISTS inventory_variants_org_sku_active_uidx
  ON public.inventory_variants (organization_id, lower(sku))
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS inventory_variants_default_per_product_uidx
  ON public.inventory_variants (organization_id, product_id)
  WHERE is_default = true AND deleted_at IS NULL;

ALTER TABLE public.inventory_products
  DROP CONSTRAINT IF EXISTS inventory_products_default_variant_fk;

ALTER TABLE public.inventory_products
  ADD CONSTRAINT inventory_products_default_variant_fk
  FOREIGN KEY (default_variant_id, organization_id)
  REFERENCES public.inventory_variants (id, organization_id)
  DEFERRABLE INITIALLY DEFERRED;

-- ---------------------------------------------------------------------------
-- Structured movement reasons
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inventory_movement_reasons (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  name text not null,
  description text null,
  applies_to text[] not null default '{}',
  requires_note boolean not null default false,
  is_active boolean not null default true,
  created_by uuid null references public.users(id) on delete set null,
  updated_by uuid null references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint inventory_movement_reasons_code_not_empty check (length(trim(code)) > 0),
  constraint inventory_movement_reasons_name_not_empty check (length(trim(name)) > 0),
  constraint inventory_movement_reasons_applies_to_check check (
    applies_to <@ array['receipt', 'issue', 'transfer', 'adjustment', 'opening_balance']::text[]
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS inventory_movement_reasons_org_code_active_uidx
  ON public.inventory_movement_reasons (organization_id, lower(code))
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS inventory_movement_reasons_id_org_uidx
  ON public.inventory_movement_reasons (id, organization_id);

-- ---------------------------------------------------------------------------
-- Movement ledger
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inventory_movement_headers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  movement_number text not null,
  movement_kind text not null,
  adjustment_direction text null,
  status text not null default 'draft',
  reason_id uuid null,
  reason_code text null,
  note text null,
  reference_type text null,
  reference_id text null,
  idempotency_key text null,
  original_movement_id uuid null references public.inventory_movement_headers(id) on delete restrict,
  reversal_movement_id uuid null references public.inventory_movement_headers(id) on delete restrict,
  created_by uuid null references public.users(id) on delete set null,
  posted_by uuid null references public.users(id) on delete set null,
  cancelled_by uuid null references public.users(id) on delete set null,
  reversed_by uuid null references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  posted_at timestamptz null,
  cancelled_at timestamptz null,
  reversed_at timestamptz null,
  deleted_at timestamptz null,
  constraint inventory_movement_headers_branch_org_fk
    foreign key (branch_id, organization_id)
    references public.branches (id, organization_id),
  constraint inventory_movement_headers_reason_fk
    foreign key (reason_id, organization_id)
    references public.inventory_movement_reasons (id, organization_id),
  constraint inventory_movement_headers_kind_check check (
    movement_kind in ('receipt', 'issue', 'transfer', 'adjustment', 'opening_balance')
  ),
  constraint inventory_movement_headers_adjustment_direction_check check (
    (
      movement_kind = 'adjustment'
      and adjustment_direction in ('increase', 'decrease')
    )
    or (
      movement_kind <> 'adjustment'
      and adjustment_direction is null
    )
  ),
  constraint inventory_movement_headers_status_check check (
    status in ('draft', 'posted', 'cancelled', 'reversed')
  ),
  constraint inventory_movement_headers_number_not_empty check (length(trim(movement_number)) > 0),
  constraint inventory_movement_headers_posted_pair check (
    (status in ('posted', 'reversed') and posted_at is not null)
    or (status in ('draft', 'cancelled'))
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS inventory_movement_headers_org_number_uidx
  ON public.inventory_movement_headers (organization_id, movement_number);

CREATE UNIQUE INDEX IF NOT EXISTS inventory_movement_headers_org_idempotency_uidx
  ON public.inventory_movement_headers (organization_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS inventory_movement_headers_id_org_branch_uidx
  ON public.inventory_movement_headers (id, organization_id, branch_id);

CREATE INDEX IF NOT EXISTS inventory_movement_headers_org_branch_status_idx
  ON public.inventory_movement_headers (organization_id, branch_id, status, created_at desc);

CREATE TABLE IF NOT EXISTS public.inventory_movement_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  movement_id uuid not null,
  line_number integer not null default 1,
  variant_id uuid not null,
  source_location_id uuid null,
  destination_location_id uuid null,
  unit_id uuid not null,
  quantity numeric(18, 6) not null,
  unit_cost numeric(18, 6) null,
  total_cost numeric(18, 6) null,
  currency text null,
  note text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint inventory_movement_lines_header_fk
    foreign key (movement_id, organization_id, branch_id)
    references public.inventory_movement_headers (id, organization_id, branch_id)
    on delete cascade,
  constraint inventory_movement_lines_variant_fk
    foreign key (variant_id, organization_id)
    references public.inventory_variants (id, organization_id),
  constraint inventory_movement_lines_unit_fk
    foreign key (unit_id, organization_id)
    references public.inventory_units (id, organization_id),
  constraint inventory_movement_lines_source_location_fk
    foreign key (source_location_id, organization_id, branch_id)
    references public.warehouse_locations (id, organization_id, branch_id),
  constraint inventory_movement_lines_destination_location_fk
    foreign key (destination_location_id, organization_id, branch_id)
    references public.warehouse_locations (id, organization_id, branch_id),
  constraint inventory_movement_lines_quantity_positive check (quantity > 0),
  constraint inventory_movement_lines_cost_nonnegative check (
    (unit_cost is null or unit_cost >= 0)
    and (total_cost is null or total_cost >= 0)
  ),
  constraint inventory_movement_lines_currency_format check (
    currency is null or currency ~ '^[A-Z]{3}$'
  ),
  constraint inventory_movement_lines_line_number_positive check (line_number > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS inventory_movement_lines_movement_line_uidx
  ON public.inventory_movement_lines (movement_id, line_number)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS inventory_movement_lines_variant_idx
  ON public.inventory_movement_lines (organization_id, branch_id, variant_id);

CREATE INDEX IF NOT EXISTS inventory_movement_lines_source_idx
  ON public.inventory_movement_lines (organization_id, branch_id, source_location_id)
  WHERE source_location_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS inventory_movement_lines_destination_idx
  ON public.inventory_movement_lines (organization_id, branch_id, destination_location_id)
  WHERE destination_location_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Quantity-only balances
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inventory_balances (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  location_id uuid not null,
  variant_id uuid not null,
  lot_id uuid null,
  serial_id uuid null,
  on_hand_quantity numeric(18, 6) not null default 0,
  reserved_quantity numeric(18, 6) not null default 0,
  allocated_quantity numeric(18, 6) not null default 0,
  available_quantity numeric(18, 6)
    generated always as (on_hand_quantity - reserved_quantity - allocated_quantity) stored,
  last_movement_id uuid null references public.inventory_movement_headers(id) on delete set null,
  last_movement_at timestamptz null,
  updated_at timestamptz not null default now(),
  constraint inventory_balances_branch_org_fk
    foreign key (branch_id, organization_id)
    references public.branches (id, organization_id),
  constraint inventory_balances_location_fk
    foreign key (location_id, organization_id, branch_id)
    references public.warehouse_locations (id, organization_id, branch_id),
  constraint inventory_balances_variant_fk
    foreign key (variant_id, organization_id)
    references public.inventory_variants (id, organization_id),
  constraint inventory_balances_reserved_nonnegative check (reserved_quantity >= 0),
  constraint inventory_balances_allocated_nonnegative check (allocated_quantity >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS inventory_balances_unique_stock_identity_uidx
  ON public.inventory_balances (
    organization_id,
    branch_id,
    location_id,
    variant_id,
    coalesce(lot_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(serial_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

CREATE INDEX IF NOT EXISTS inventory_balances_variant_location_idx
  ON public.inventory_balances (organization_id, branch_id, variant_id, location_id);

CREATE INDEX IF NOT EXISTS inventory_balances_location_idx
  ON public.inventory_balances (organization_id, branch_id, location_id);

CREATE INDEX IF NOT EXISTS inventory_balances_last_movement_idx
  ON public.inventory_balances (last_movement_id)
  WHERE last_movement_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Validation and protection triggers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.inventory_validate_movement_line()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_header public.inventory_movement_headers%ROWTYPE;
  v_product_type text;
  v_product_base_unit_id uuid;
  v_variant_status text;
BEGIN
  SELECT *
  INTO v_header
  FROM public.inventory_movement_headers
  WHERE id = NEW.movement_id
    AND organization_id = NEW.organization_id
    AND branch_id = NEW.branch_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Movement line header does not match organization and branch';
  END IF;

  SELECT p.product_type, p.base_unit_id, v.status
  INTO v_product_type, v_product_base_unit_id, v_variant_status
  FROM public.inventory_variants v
  JOIN public.inventory_products p
    ON p.id = v.product_id
   AND p.organization_id = v.organization_id
  WHERE v.id = NEW.variant_id
    AND v.organization_id = NEW.organization_id
    AND v.deleted_at IS NULL
    AND p.deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Movement line variant does not belong to the organization';
  END IF;

  IF v_variant_status <> 'active' THEN
    RAISE EXCEPTION 'Only active variants can be used in movement lines';
  END IF;

  IF v_product_type IN ('service', 'bundle') THEN
    RAISE EXCEPTION 'Service and bundle products cannot be used in Phase 1 stock movements';
  END IF;

  IF NEW.unit_id <> v_product_base_unit_id THEN
    RAISE EXCEPTION 'Phase 1 movement line unit must equal product base unit';
  END IF;

  IF v_header.movement_kind IN ('receipt', 'opening_balance') THEN
    IF NEW.source_location_id IS NOT NULL OR NEW.destination_location_id IS NULL THEN
      RAISE EXCEPTION '% movements require destination_location_id only', v_header.movement_kind;
    END IF;
  ELSIF v_header.movement_kind = 'issue' THEN
    IF NEW.source_location_id IS NULL OR NEW.destination_location_id IS NOT NULL THEN
      RAISE EXCEPTION 'issue movements require source_location_id only';
    END IF;
  ELSIF v_header.movement_kind = 'transfer' THEN
    IF NEW.source_location_id IS NULL OR NEW.destination_location_id IS NULL THEN
      RAISE EXCEPTION 'transfer movements require source and destination locations';
    END IF;
    IF NEW.source_location_id = NEW.destination_location_id THEN
      RAISE EXCEPTION 'transfer source and destination must differ';
    END IF;
  ELSIF v_header.movement_kind = 'adjustment' THEN
    IF v_header.adjustment_direction = 'increase' THEN
      IF NEW.source_location_id IS NOT NULL OR NEW.destination_location_id IS NULL THEN
        RAISE EXCEPTION 'adjustment increase requires destination_location_id only';
      END IF;
    ELSIF v_header.adjustment_direction = 'decrease' THEN
      IF NEW.source_location_id IS NULL OR NEW.destination_location_id IS NOT NULL THEN
        RAISE EXCEPTION 'adjustment decrease requires source_location_id only';
      END IF;
    ELSE
      RAISE EXCEPTION 'adjustment direction is required';
    END IF;
  ELSE
    RAISE EXCEPTION 'Unsupported movement kind';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS inventory_movement_lines_validate ON public.inventory_movement_lines;
CREATE TRIGGER inventory_movement_lines_validate
  BEFORE INSERT OR UPDATE ON public.inventory_movement_lines
  FOR EACH ROW
  EXECUTE FUNCTION public.inventory_validate_movement_line();

CREATE OR REPLACE FUNCTION public.inventory_protect_posted_movement_lines()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_status text;
BEGIN
  SELECT status
  INTO v_status
  FROM public.inventory_movement_headers
  WHERE id = OLD.movement_id;

  IF v_status IN ('posted', 'reversed') THEN
    RAISE EXCEPTION 'Posted movement lines are immutable';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS inventory_movement_lines_immutable ON public.inventory_movement_lines;
CREATE TRIGGER inventory_movement_lines_immutable
  BEFORE UPDATE OR DELETE ON public.inventory_movement_lines
  FOR EACH ROW
  EXECUTE FUNCTION public.inventory_protect_posted_movement_lines();

CREATE OR REPLACE FUNCTION public.inventory_protect_posted_movement_headers()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.status IN ('posted', 'reversed')
     AND current_setting('ambra.inventory_movement_engine', true) <> 'on' THEN
    RAISE EXCEPTION 'Posted movement headers are immutable outside the movement engine';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS inventory_movement_headers_immutable ON public.inventory_movement_headers;
CREATE TRIGGER inventory_movement_headers_immutable
  BEFORE UPDATE OR DELETE ON public.inventory_movement_headers
  FOR EACH ROW
  EXECUTE FUNCTION public.inventory_protect_posted_movement_headers();

CREATE OR REPLACE FUNCTION public.inventory_guard_balance_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_setting('ambra.inventory_movement_engine', true) <> 'on' THEN
    RAISE EXCEPTION 'inventory_balances can only be changed by the movement engine';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS inventory_balances_engine_only ON public.inventory_balances;
CREATE TRIGGER inventory_balances_engine_only
  BEFORE INSERT OR UPDATE OR DELETE ON public.inventory_balances
  FOR EACH ROW
  EXECUTE FUNCTION public.inventory_guard_balance_write();

CREATE OR REPLACE FUNCTION public.inventory_guard_settings_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND current_setting('ambra.inventory_movement_engine', true) <> 'on'
     AND NOT public.has_permission(NEW.organization_id, 'warehouse.settings.manage') THEN
    RAISE EXCEPTION 'inventory_settings can only be updated by settings managers or inventory engines';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS inventory_settings_write_guard ON public.inventory_settings;
CREATE TRIGGER inventory_settings_write_guard
  BEFORE UPDATE ON public.inventory_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.inventory_guard_settings_write();

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'inventory_settings',
    'inventory_units',
    'inventory_products',
    'inventory_variants',
    'inventory_movement_reasons',
    'inventory_movement_headers',
    'inventory_movement_lines',
    'inventory_balances'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_updated_at ON public.%I', v_table, v_table);
    EXECUTE format(
      'CREATE TRIGGER %I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()',
      v_table,
      v_table
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE public.inventory_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_settings FORCE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_units FORCE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_products FORCE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_variants FORCE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movement_reasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movement_reasons FORCE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movement_headers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movement_headers FORCE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movement_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movement_lines FORCE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_balances FORCE ROW LEVEL SECURITY;

-- Settings: visible to inventory readers/settings managers; mutation by settings
-- managers and sequence-generating inventory engines.
CREATE POLICY inventory_settings_select
  ON public.inventory_settings FOR SELECT
  USING (
    deleted_at IS NULL
    AND (
      public.has_permission(organization_id, 'warehouse.settings.manage')
      OR public.has_permission(organization_id, 'warehouse.inventory.read')
      OR public.has_permission(organization_id, 'warehouse.products.read')
    )
  );

CREATE POLICY inventory_settings_insert
  ON public.inventory_settings FOR INSERT
  WITH CHECK (
    public.has_permission(organization_id, 'warehouse.settings.manage')
    OR public.has_permission(organization_id, 'warehouse.products.manage')
    OR public.has_permission(organization_id, 'warehouse.inventory.operate')
    OR public.has_permission(organization_id, 'warehouse.inventory.adjust')
    OR public.has_permission(organization_id, 'warehouse.inventory.reverse')
  );

CREATE POLICY inventory_settings_update
  ON public.inventory_settings FOR UPDATE
  USING (
    public.has_permission(organization_id, 'warehouse.settings.manage')
    OR public.has_permission(organization_id, 'warehouse.products.manage')
    OR public.has_permission(organization_id, 'warehouse.inventory.operate')
    OR public.has_permission(organization_id, 'warehouse.inventory.adjust')
    OR public.has_permission(organization_id, 'warehouse.inventory.reverse')
  )
  WITH CHECK (
    public.has_permission(organization_id, 'warehouse.settings.manage')
    OR public.has_permission(organization_id, 'warehouse.products.manage')
    OR public.has_permission(organization_id, 'warehouse.inventory.operate')
    OR public.has_permission(organization_id, 'warehouse.inventory.adjust')
    OR public.has_permission(organization_id, 'warehouse.inventory.reverse')
  );

CREATE POLICY inventory_settings_delete_deny
  ON public.inventory_settings FOR DELETE
  USING (false);

-- Catalog/config tables.
CREATE POLICY inventory_units_select
  ON public.inventory_units FOR SELECT
  USING (
    deleted_at IS NULL
    AND public.has_permission(organization_id, 'warehouse.products.read')
  );

CREATE POLICY inventory_units_insert
  ON public.inventory_units FOR INSERT
  WITH CHECK (public.has_permission(organization_id, 'warehouse.products.manage'));

CREATE POLICY inventory_units_update
  ON public.inventory_units FOR UPDATE
  USING (public.has_permission(organization_id, 'warehouse.products.manage'))
  WITH CHECK (public.has_permission(organization_id, 'warehouse.products.manage'));

CREATE POLICY inventory_units_delete_deny
  ON public.inventory_units FOR DELETE
  USING (false);

CREATE POLICY inventory_products_select
  ON public.inventory_products FOR SELECT
  USING (
    deleted_at IS NULL
    AND public.has_permission(organization_id, 'warehouse.products.read')
  );

CREATE POLICY inventory_products_insert
  ON public.inventory_products FOR INSERT
  WITH CHECK (public.has_permission(organization_id, 'warehouse.products.manage'));

CREATE POLICY inventory_products_update_manage
  ON public.inventory_products FOR UPDATE
  USING (
    public.has_permission(organization_id, 'warehouse.products.manage')
    OR public.has_permission(organization_id, 'warehouse.products.archive')
  )
  WITH CHECK (
    public.has_permission(organization_id, 'warehouse.products.manage')
    OR public.has_permission(organization_id, 'warehouse.products.archive')
  );

CREATE POLICY inventory_products_delete_deny
  ON public.inventory_products FOR DELETE
  USING (false);

CREATE POLICY inventory_variants_select
  ON public.inventory_variants FOR SELECT
  USING (
    deleted_at IS NULL
    AND public.has_permission(organization_id, 'warehouse.products.read')
  );

CREATE POLICY inventory_variants_insert
  ON public.inventory_variants FOR INSERT
  WITH CHECK (public.has_permission(organization_id, 'warehouse.products.manage'));

CREATE POLICY inventory_variants_update_manage
  ON public.inventory_variants FOR UPDATE
  USING (
    public.has_permission(organization_id, 'warehouse.products.manage')
    OR public.has_permission(organization_id, 'warehouse.products.archive')
  )
  WITH CHECK (
    public.has_permission(organization_id, 'warehouse.products.manage')
    OR public.has_permission(organization_id, 'warehouse.products.archive')
  );

CREATE POLICY inventory_variants_delete_deny
  ON public.inventory_variants FOR DELETE
  USING (false);

CREATE POLICY inventory_movement_reasons_select
  ON public.inventory_movement_reasons FOR SELECT
  USING (
    deleted_at IS NULL
    AND (
      public.has_permission(organization_id, 'warehouse.inventory.read')
      OR public.has_permission(organization_id, 'warehouse.products.manage')
    )
  );

CREATE POLICY inventory_movement_reasons_insert
  ON public.inventory_movement_reasons FOR INSERT
  WITH CHECK (public.has_permission(organization_id, 'warehouse.products.manage'));

CREATE POLICY inventory_movement_reasons_update
  ON public.inventory_movement_reasons FOR UPDATE
  USING (public.has_permission(organization_id, 'warehouse.products.manage'))
  WITH CHECK (public.has_permission(organization_id, 'warehouse.products.manage'));

CREATE POLICY inventory_movement_reasons_delete_deny
  ON public.inventory_movement_reasons FOR DELETE
  USING (false);

-- Operational tables are branch-scoped.
CREATE POLICY inventory_movement_headers_select
  ON public.inventory_movement_headers FOR SELECT
  USING (
    deleted_at IS NULL
    AND public.has_branch_permission(organization_id, branch_id, 'warehouse.inventory.read')
  );

CREATE POLICY inventory_movement_headers_insert
  ON public.inventory_movement_headers FOR INSERT
  WITH CHECK (
    (
      movement_kind = 'adjustment'
      AND public.has_branch_permission(organization_id, branch_id, 'warehouse.inventory.adjust')
    )
    OR (
      movement_kind <> 'adjustment'
      AND public.has_branch_permission(organization_id, branch_id, 'warehouse.inventory.operate')
    )
  );

CREATE POLICY inventory_movement_headers_update
  ON public.inventory_movement_headers FOR UPDATE
  USING (
    (
      movement_kind = 'adjustment'
      AND public.has_branch_permission(organization_id, branch_id, 'warehouse.inventory.adjust')
    )
    OR public.has_branch_permission(organization_id, branch_id, 'warehouse.inventory.operate')
    OR public.has_branch_permission(organization_id, branch_id, 'warehouse.inventory.reverse')
  )
  WITH CHECK (
    (
      movement_kind = 'adjustment'
      AND public.has_branch_permission(organization_id, branch_id, 'warehouse.inventory.adjust')
    )
    OR public.has_branch_permission(organization_id, branch_id, 'warehouse.inventory.operate')
    OR public.has_branch_permission(organization_id, branch_id, 'warehouse.inventory.reverse')
  );

CREATE POLICY inventory_movement_headers_delete_deny
  ON public.inventory_movement_headers FOR DELETE
  USING (false);

CREATE POLICY inventory_movement_lines_select
  ON public.inventory_movement_lines FOR SELECT
  USING (
    deleted_at IS NULL
    AND public.has_branch_permission(organization_id, branch_id, 'warehouse.inventory.read')
  );

CREATE POLICY inventory_movement_lines_insert
  ON public.inventory_movement_lines FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.inventory_movement_headers h
      WHERE h.id = movement_id
        AND h.organization_id = inventory_movement_lines.organization_id
        AND h.branch_id = inventory_movement_lines.branch_id
        AND h.status = 'draft'
        AND (
          (
            h.movement_kind = 'adjustment'
            AND public.has_branch_permission(h.organization_id, h.branch_id, 'warehouse.inventory.adjust')
          )
          OR (
            h.movement_kind <> 'adjustment'
            AND public.has_branch_permission(h.organization_id, h.branch_id, 'warehouse.inventory.operate')
          )
        )
    )
  );

CREATE POLICY inventory_movement_lines_update
  ON public.inventory_movement_lines FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.inventory_movement_headers h
      WHERE h.id = movement_id
        AND h.organization_id = inventory_movement_lines.organization_id
        AND h.branch_id = inventory_movement_lines.branch_id
        AND h.status = 'draft'
        AND (
          (
            h.movement_kind = 'adjustment'
            AND public.has_branch_permission(h.organization_id, h.branch_id, 'warehouse.inventory.adjust')
          )
          OR (
            h.movement_kind <> 'adjustment'
            AND public.has_branch_permission(h.organization_id, h.branch_id, 'warehouse.inventory.operate')
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.inventory_movement_headers h
      WHERE h.id = movement_id
        AND h.organization_id = inventory_movement_lines.organization_id
        AND h.branch_id = inventory_movement_lines.branch_id
        AND h.status = 'draft'
        AND (
          (
            h.movement_kind = 'adjustment'
            AND public.has_branch_permission(h.organization_id, h.branch_id, 'warehouse.inventory.adjust')
          )
          OR (
            h.movement_kind <> 'adjustment'
            AND public.has_branch_permission(h.organization_id, h.branch_id, 'warehouse.inventory.operate')
          )
        )
    )
  );

CREATE POLICY inventory_movement_lines_delete_deny
  ON public.inventory_movement_lines FOR DELETE
  USING (false);

CREATE POLICY inventory_balances_select
  ON public.inventory_balances FOR SELECT
  USING (public.has_branch_permission(organization_id, branch_id, 'warehouse.inventory.read'));

CREATE POLICY inventory_balances_insert_engine
  ON public.inventory_balances FOR INSERT
  WITH CHECK (
    public.has_branch_permission(organization_id, branch_id, 'warehouse.inventory.operate')
    OR public.has_branch_permission(organization_id, branch_id, 'warehouse.inventory.adjust')
    OR public.has_branch_permission(organization_id, branch_id, 'warehouse.inventory.reverse')
  );

CREATE POLICY inventory_balances_update_engine
  ON public.inventory_balances FOR UPDATE
  USING (
    public.has_branch_permission(organization_id, branch_id, 'warehouse.inventory.operate')
    OR public.has_branch_permission(organization_id, branch_id, 'warehouse.inventory.adjust')
    OR public.has_branch_permission(organization_id, branch_id, 'warehouse.inventory.reverse')
  )
  WITH CHECK (
    public.has_branch_permission(organization_id, branch_id, 'warehouse.inventory.operate')
    OR public.has_branch_permission(organization_id, branch_id, 'warehouse.inventory.adjust')
    OR public.has_branch_permission(organization_id, branch_id, 'warehouse.inventory.reverse')
  );

CREATE POLICY inventory_balances_delete_deny
  ON public.inventory_balances FOR DELETE
  USING (false);
