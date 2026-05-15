-- =============================================================================
-- Migration: inventory_phase2_enterprise_core
-- Project:   rjeraydumwechpjjzrus (TARGET)
-- Phase:     Ambra Inventory V2 Phase 2 — Core Enterprise Layer
-- =============================================================================
-- Adds variant options/generation support, reservations, allocations, lots,
-- serials, procurement purchase orders, partial receiving hooks, basic pricing,
-- and weighted-average cost tracking.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Phase 2 permission slugs
-- ---------------------------------------------------------------------------
INSERT INTO public.permissions (slug, name, category, action)
VALUES
  ('warehouse.procurement.read',   'Warehouse Procurement Read',   'warehouse', 'procurement.read'),
  ('warehouse.procurement.manage', 'Warehouse Procurement Manage', 'warehouse', 'procurement.manage'),
  ('warehouse.pricing.read',       'Warehouse Pricing Read',       'warehouse', 'pricing.read'),
  ('warehouse.pricing.manage',     'Warehouse Pricing Manage',     'warehouse', 'pricing.manage')
ON CONFLICT (slug) DO NOTHING;

DO $$
DECLARE
  v_member_id uuid;
  v_perm_id uuid;
BEGIN
  SELECT id INTO v_member_id
  FROM public.roles
  WHERE name = 'org_member' AND is_basic = true
  LIMIT 1;

  IF v_member_id IS NOT NULL THEN
    SELECT id INTO v_perm_id FROM public.permissions WHERE slug = 'warehouse.procurement.read';
    IF v_perm_id IS NOT NULL THEN
      INSERT INTO public.role_permissions (role_id, permission_id)
      VALUES (v_member_id, v_perm_id)
      ON CONFLICT DO NOTHING;
    END IF;

    SELECT id INTO v_perm_id FROM public.permissions WHERE slug = 'warehouse.pricing.read';
    IF v_perm_id IS NOT NULL THEN
      INSERT INTO public.role_permissions (role_id, permission_id)
      VALUES (v_member_id, v_perm_id)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Inventory settings sequences for Phase 2 operational documents
-- ---------------------------------------------------------------------------
ALTER TABLE public.inventory_settings
  ADD COLUMN IF NOT EXISTS reservation_number_prefix text not null default 'RES',
  ADD COLUMN IF NOT EXISTS reservation_number_next bigint not null default 1,
  ADD COLUMN IF NOT EXISTS allocation_number_prefix text not null default 'ALLOC',
  ADD COLUMN IF NOT EXISTS allocation_number_next bigint not null default 1,
  ADD COLUMN IF NOT EXISTS purchase_order_number_prefix text not null default 'PO',
  ADD COLUMN IF NOT EXISTS purchase_order_number_next bigint not null default 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'inventory_settings_reservation_next_positive'
      AND conrelid = 'public.inventory_settings'::regclass
  ) THEN
    ALTER TABLE public.inventory_settings
      ADD CONSTRAINT inventory_settings_reservation_next_positive
      CHECK (reservation_number_next > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'inventory_settings_allocation_next_positive'
      AND conrelid = 'public.inventory_settings'::regclass
  ) THEN
    ALTER TABLE public.inventory_settings
      ADD CONSTRAINT inventory_settings_allocation_next_positive
      CHECK (allocation_number_next > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'inventory_settings_po_next_positive'
      AND conrelid = 'public.inventory_settings'::regclass
  ) THEN
    ALTER TABLE public.inventory_settings
      ADD CONSTRAINT inventory_settings_po_next_positive
      CHECK (purchase_order_number_next > 0);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Variant option system
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inventory_option_groups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  display_order integer not null default 0,
  created_by uuid null references public.users(id) on delete set null,
  updated_by uuid null references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint inventory_option_groups_name_not_empty check (length(trim(name)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS inventory_option_groups_org_name_unique_idx
  ON public.inventory_option_groups (organization_id, lower(name))
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS inventory_option_groups_id_org_uidx
  ON public.inventory_option_groups (id, organization_id);

CREATE TABLE IF NOT EXISTS public.inventory_option_values (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  option_group_id uuid not null,
  value text not null,
  display_order integer not null default 0,
  created_by uuid null references public.users(id) on delete set null,
  updated_by uuid null references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint inventory_option_values_group_fk
    foreign key (option_group_id, organization_id)
    references public.inventory_option_groups (id, organization_id)
    on delete cascade,
  constraint inventory_option_values_value_not_empty check (length(trim(value)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS inventory_option_values_group_value_unique_idx
  ON public.inventory_option_values (option_group_id, lower(value))
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS inventory_option_values_id_org_uidx
  ON public.inventory_option_values (id, organization_id);

CREATE TABLE IF NOT EXISTS public.inventory_variant_option_values (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  variant_id uuid not null,
  option_group_id uuid not null,
  option_value_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (variant_id, option_group_id),
  constraint inventory_variant_option_values_variant_fk
    foreign key (variant_id, organization_id)
    references public.inventory_variants (id, organization_id)
    on delete cascade,
  constraint inventory_variant_option_values_group_fk
    foreign key (option_group_id, organization_id)
    references public.inventory_option_groups (id, organization_id)
    on delete restrict,
  constraint inventory_variant_option_values_value_fk
    foreign key (option_value_id, organization_id)
    references public.inventory_option_values (id, organization_id)
    on delete restrict
);

ALTER TABLE public.inventory_variants
  ADD COLUMN IF NOT EXISTS barcode text null,
  ADD COLUMN IF NOT EXISTS media jsonb not null default '[]',
  ADD COLUMN IF NOT EXISTS purchase_price numeric(18, 6) null,
  ADD COLUMN IF NOT EXISTS sales_price numeric(18, 6) null,
  ADD COLUMN IF NOT EXISTS price_currency text null;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'inventory_variants_phase2_price_check'
      AND conrelid = 'public.inventory_variants'::regclass
  ) THEN
    ALTER TABLE public.inventory_variants
      ADD CONSTRAINT inventory_variants_phase2_price_check
      CHECK (
        (purchase_price IS NULL OR purchase_price >= 0)
        AND (sales_price IS NULL OR sales_price >= 0)
        AND (price_currency IS NULL OR price_currency ~ '^[A-Z]{3}$')
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Lots and serials
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inventory_lots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid not null,
  variant_id uuid not null,
  lot_number text not null,
  manufactured_at date null,
  expires_at date null,
  supplier_reference text null,
  status text not null default 'active',
  metadata jsonb not null default '{}',
  created_by uuid null references public.users(id) on delete set null,
  updated_by uuid null references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint inventory_lots_product_fk
    foreign key (product_id, organization_id)
    references public.inventory_products (id, organization_id)
    on delete restrict,
  constraint inventory_lots_variant_fk
    foreign key (variant_id, organization_id)
    references public.inventory_variants (id, organization_id)
    on delete restrict,
  constraint inventory_lots_status_check check (
    status in ('active', 'quarantined', 'expired', 'recalled', 'archived')
  ),
  constraint inventory_lots_number_not_empty check (length(trim(lot_number)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS inventory_lots_id_org_uidx
  ON public.inventory_lots (id, organization_id);

CREATE UNIQUE INDEX IF NOT EXISTS inventory_lots_variant_number_unique_idx
  ON public.inventory_lots (organization_id, variant_id, lower(lot_number))
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.inventory_serials (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid not null,
  variant_id uuid not null,
  serial_number text not null,
  lot_id uuid null,
  current_branch_id uuid null references public.branches(id) on delete set null,
  current_location_id uuid null references public.warehouse_locations(id) on delete set null,
  warranty_starts_at date null,
  warranty_ends_at date null,
  status text not null default 'in_stock',
  metadata jsonb not null default '{}',
  created_by uuid null references public.users(id) on delete set null,
  updated_by uuid null references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint inventory_serials_product_fk
    foreign key (product_id, organization_id)
    references public.inventory_products (id, organization_id)
    on delete restrict,
  constraint inventory_serials_variant_fk
    foreign key (variant_id, organization_id)
    references public.inventory_variants (id, organization_id)
    on delete restrict,
  constraint inventory_serials_lot_fk
    foreign key (lot_id, organization_id)
    references public.inventory_lots (id, organization_id)
    on delete set null,
  constraint inventory_serials_status_check check (
    status in ('in_stock', 'reserved', 'allocated', 'issued', 'scrapped', 'archived')
  ),
  constraint inventory_serials_number_not_empty check (length(trim(serial_number)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS inventory_serials_id_org_uidx
  ON public.inventory_serials (id, organization_id);

CREATE UNIQUE INDEX IF NOT EXISTS inventory_serials_org_number_unique_idx
  ON public.inventory_serials (organization_id, lower(serial_number))
  WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.inventory_validate_lot_serial_product()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_product_id uuid;
BEGIN
  SELECT product_id
  INTO v_product_id
  FROM public.inventory_variants
  WHERE id = NEW.variant_id
    AND organization_id = NEW.organization_id
    AND deleted_at IS NULL;

  IF NOT FOUND OR v_product_id <> NEW.product_id THEN
    RAISE EXCEPTION 'Lot/serial product_id must match variant.product_id';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS inventory_lots_product_match ON public.inventory_lots;
CREATE TRIGGER inventory_lots_product_match
  BEFORE INSERT OR UPDATE OF product_id, variant_id, organization_id ON public.inventory_lots
  FOR EACH ROW EXECUTE FUNCTION public.inventory_validate_lot_serial_product();

DROP TRIGGER IF EXISTS inventory_serials_product_match ON public.inventory_serials;
CREATE TRIGGER inventory_serials_product_match
  BEFORE INSERT OR UPDATE OF product_id, variant_id, organization_id ON public.inventory_serials
  FOR EACH ROW EXECUTE FUNCTION public.inventory_validate_lot_serial_product();

ALTER TABLE public.inventory_balances
  DROP CONSTRAINT IF EXISTS inventory_balances_lot_id_fkey,
  DROP CONSTRAINT IF EXISTS inventory_balances_serial_id_fkey;

ALTER TABLE public.inventory_balances
  ADD CONSTRAINT inventory_balances_lot_id_fkey
  FOREIGN KEY (lot_id, organization_id)
  REFERENCES public.inventory_lots (id, organization_id)
  ON DELETE RESTRICT,
  ADD CONSTRAINT inventory_balances_serial_id_fkey
  FOREIGN KEY (serial_id, organization_id)
  REFERENCES public.inventory_serials (id, organization_id)
  ON DELETE RESTRICT;

ALTER TABLE public.inventory_movement_lines
  ADD COLUMN IF NOT EXISTS lot_id uuid null,
  ADD COLUMN IF NOT EXISTS serial_id uuid null;

ALTER TABLE public.inventory_movement_lines
  DROP CONSTRAINT IF EXISTS inventory_movement_lines_lot_id_fkey,
  DROP CONSTRAINT IF EXISTS inventory_movement_lines_serial_id_fkey;

ALTER TABLE public.inventory_movement_lines
  ADD CONSTRAINT inventory_movement_lines_lot_id_fkey
  FOREIGN KEY (lot_id, organization_id)
  REFERENCES public.inventory_lots (id, organization_id)
  ON DELETE RESTRICT,
  ADD CONSTRAINT inventory_movement_lines_serial_id_fkey
  FOREIGN KEY (serial_id, organization_id)
  REFERENCES public.inventory_serials (id, organization_id)
  ON DELETE RESTRICT;

-- ---------------------------------------------------------------------------
-- Reservations and allocations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inventory_reservations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  reservation_number text not null,
  status text not null default 'active',
  reference_type text null,
  reference_id uuid null,
  reference_number text null,
  expires_at timestamptz null,
  priority integer not null default 0,
  notes text null,
  created_by uuid null references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cancelled_at timestamptz null,
  cancelled_by uuid null references public.users(id) on delete set null,
  deleted_at timestamptz null,
  constraint inventory_reservations_status_check check (
    status in ('active', 'partial', 'fulfilled', 'expired', 'cancelled')
  ),
  constraint inventory_reservations_number_not_empty check (length(trim(reservation_number)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS inventory_reservations_number_org_unique_idx
  ON public.inventory_reservations (organization_id, reservation_number);

CREATE TABLE IF NOT EXISTS public.inventory_reservation_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  reservation_id uuid not null references public.inventory_reservations(id) on delete cascade,
  product_id uuid not null references public.inventory_products(id) on delete restrict,
  variant_id uuid not null references public.inventory_variants(id) on delete restrict,
  location_id uuid null references public.warehouse_locations(id) on delete restrict,
  lot_id uuid null references public.inventory_lots(id) on delete restrict,
  serial_id uuid null references public.inventory_serials(id) on delete restrict,
  reserved_quantity numeric(18, 6) not null,
  released_quantity numeric(18, 6) not null default 0,
  fulfilled_quantity numeric(18, 6) not null default 0,
  created_at timestamptz not null default now(),
  constraint inventory_reservation_line_qty_check check (
    reserved_quantity > 0
    and released_quantity >= 0
    and fulfilled_quantity >= 0
    and released_quantity + fulfilled_quantity <= reserved_quantity
  )
);

CREATE INDEX IF NOT EXISTS inventory_reservation_lines_variant_idx
  ON public.inventory_reservation_lines (organization_id, branch_id, variant_id, location_id);

CREATE TABLE IF NOT EXISTS public.inventory_allocations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  allocation_number text not null,
  status text not null default 'active',
  reservation_id uuid null references public.inventory_reservations(id) on delete set null,
  reference_type text null,
  reference_id uuid null,
  reference_number text null,
  created_by uuid null references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint inventory_allocations_status_check check (
    status in ('active', 'released', 'fulfilled', 'cancelled')
  ),
  constraint inventory_allocations_number_not_empty check (length(trim(allocation_number)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS inventory_allocations_number_org_unique_idx
  ON public.inventory_allocations (organization_id, allocation_number);

CREATE TABLE IF NOT EXISTS public.inventory_allocation_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  allocation_id uuid not null references public.inventory_allocations(id) on delete cascade,
  reservation_line_id uuid null references public.inventory_reservation_lines(id) on delete set null,
  product_id uuid not null references public.inventory_products(id) on delete restrict,
  variant_id uuid not null references public.inventory_variants(id) on delete restrict,
  location_id uuid not null references public.warehouse_locations(id) on delete restrict,
  lot_id uuid null references public.inventory_lots(id) on delete restrict,
  serial_id uuid null references public.inventory_serials(id) on delete restrict,
  allocated_quantity numeric(18, 6) not null,
  fulfilled_quantity numeric(18, 6) not null default 0,
  created_at timestamptz not null default now(),
  constraint inventory_allocation_line_qty_check check (
    allocated_quantity > 0
    and fulfilled_quantity >= 0
    and fulfilled_quantity <= allocated_quantity
  )
);

CREATE INDEX IF NOT EXISTS inventory_allocation_lines_variant_idx
  ON public.inventory_allocation_lines (organization_id, branch_id, variant_id, location_id);

-- ---------------------------------------------------------------------------
-- Procurement and pricing/costing
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inventory_suppliers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  email text null,
  phone text null,
  status text not null default 'active',
  created_by uuid null references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint inventory_suppliers_status_check check (status in ('active', 'inactive', 'archived')),
  constraint inventory_suppliers_name_not_empty check (length(trim(name)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS inventory_suppliers_org_name_uidx
  ON public.inventory_suppliers (organization_id, lower(name))
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.inventory_purchase_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  po_number text not null,
  supplier_id uuid not null references public.inventory_suppliers(id) on delete restrict,
  status text not null default 'draft',
  order_date date not null default current_date,
  expected_delivery_date date null,
  delivery_location_id uuid null references public.warehouse_locations(id) on delete set null,
  currency text not null default 'PLN',
  total numeric(18, 6) not null default 0,
  notes text null,
  created_by uuid null references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint inventory_po_status_check check (
    status in ('draft', 'ordered', 'partially_received', 'received', 'closed', 'cancelled')
  ),
  constraint inventory_po_currency_format check (currency ~ '^[A-Z]{3}$'),
  constraint inventory_po_total_nonnegative check (total >= 0),
  constraint inventory_po_number_not_empty check (length(trim(po_number)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS inventory_purchase_orders_org_number_uidx
  ON public.inventory_purchase_orders (organization_id, po_number);

CREATE TABLE IF NOT EXISTS public.inventory_purchase_order_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  purchase_order_id uuid not null references public.inventory_purchase_orders(id) on delete cascade,
  line_number integer not null,
  product_id uuid not null references public.inventory_products(id) on delete restrict,
  variant_id uuid not null references public.inventory_variants(id) on delete restrict,
  unit_id uuid not null references public.inventory_units(id) on delete restrict,
  ordered_quantity numeric(18, 6) not null,
  received_quantity numeric(18, 6) not null default 0,
  unit_cost numeric(18, 6) not null default 0,
  total_cost numeric(18, 6) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_po_line_number_positive check (line_number > 0),
  constraint inventory_po_line_quantities_check check (
    ordered_quantity > 0
    and received_quantity >= 0
    and received_quantity <= ordered_quantity
  ),
  constraint inventory_po_line_costs_check check (unit_cost >= 0 and total_cost >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS inventory_po_lines_po_line_uidx
  ON public.inventory_purchase_order_lines (purchase_order_id, line_number);

CREATE TABLE IF NOT EXISTS public.inventory_variant_costs (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  variant_id uuid not null references public.inventory_variants(id) on delete restrict,
  currency text not null default 'PLN',
  average_unit_cost numeric(18, 6) not null default 0,
  total_quantity numeric(18, 6) not null default 0,
  total_value numeric(18, 6) not null default 0,
  updated_at timestamptz not null default now(),
  primary key (organization_id, branch_id, variant_id, currency),
  constraint inventory_variant_costs_currency_format check (currency ~ '^[A-Z]{3}$'),
  constraint inventory_variant_costs_nonnegative check (
    average_unit_cost >= 0 and total_quantity >= 0 and total_value >= 0
  )
);

-- ---------------------------------------------------------------------------
-- Balance helpers for reservation/allocation engines
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.inventory_get_or_create_balance_for_update(
  p_organization_id uuid,
  p_branch_id uuid,
  p_location_id uuid,
  p_variant_id uuid,
  p_movement_id uuid,
  p_lot_id uuid default null,
  p_serial_id uuid default null
)
RETURNS public.inventory_balances
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_balance public.inventory_balances%ROWTYPE;
BEGIN
  INSERT INTO public.inventory_balances (
    organization_id,
    branch_id,
    location_id,
    variant_id,
    lot_id,
    serial_id,
    last_movement_id,
    last_movement_at
  )
  VALUES (
    p_organization_id,
    p_branch_id,
    p_location_id,
    p_variant_id,
    p_lot_id,
    p_serial_id,
    p_movement_id,
    CASE WHEN p_movement_id IS NULL THEN NULL ELSE now() END
  )
  ON CONFLICT (
    organization_id,
    branch_id,
    location_id,
    variant_id,
    coalesce(lot_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(serial_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  DO NOTHING;

  SELECT *
  INTO v_balance
  FROM public.inventory_balances
  WHERE organization_id = p_organization_id
    AND branch_id = p_branch_id
    AND location_id = p_location_id
    AND variant_id = p_variant_id
    AND coalesce(lot_id, '00000000-0000-0000-0000-000000000000'::uuid)
      = coalesce(p_lot_id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND coalesce(serial_id, '00000000-0000-0000-0000-000000000000'::uuid)
      = coalesce(p_serial_id, '00000000-0000-0000-0000-000000000000'::uuid)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unable to lock inventory balance row';
  END IF;

  RETURN v_balance;
END;
$$;

CREATE OR REPLACE FUNCTION public.inventory_create_reservation(
  p_organization_id uuid,
  p_branch_id uuid,
  p_lines jsonb,
  p_reference_type text default null,
  p_reference_id uuid default null,
  p_reference_number text default null,
  p_expires_at timestamptz default null,
  p_notes text default null,
  p_actor_user_id uuid default null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_settings public.inventory_settings%ROWTYPE;
  v_reservation_id uuid;
  v_reservation_number text;
  v_line jsonb;
  v_product_id uuid;
  v_balance public.inventory_balances%ROWTYPE;
  v_quantity numeric(18, 6);
BEGIN
  IF NOT public.has_branch_permission(p_organization_id, p_branch_id, 'warehouse.inventory.operate') THEN
    RAISE EXCEPTION 'Missing warehouse.inventory.operate permission';
  END IF;

  IF jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'At least one reservation line is required';
  END IF;

  PERFORM set_config('ambra.inventory_movement_engine', 'on', true);

  INSERT INTO public.inventory_settings (organization_id, created_by, updated_by)
  VALUES (p_organization_id, p_actor_user_id, p_actor_user_id)
  ON CONFLICT (organization_id) DO NOTHING;

  SELECT * INTO v_settings
  FROM public.inventory_settings
  WHERE organization_id = p_organization_id
  FOR UPDATE;

  v_reservation_number :=
    v_settings.reservation_number_prefix || '-' || lpad(v_settings.reservation_number_next::text, 6, '0');

  UPDATE public.inventory_settings
  SET reservation_number_next = reservation_number_next + 1,
      updated_by = p_actor_user_id
  WHERE id = v_settings.id;

  INSERT INTO public.inventory_reservations (
    organization_id, branch_id, reservation_number, reference_type, reference_id,
    reference_number, expires_at, notes, created_by
  )
  VALUES (
    p_organization_id, p_branch_id, v_reservation_number, p_reference_type, p_reference_id,
    p_reference_number, p_expires_at, p_notes, p_actor_user_id
  )
  RETURNING id INTO v_reservation_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_quantity := (v_line ->> 'quantity')::numeric;
    IF v_quantity <= 0 THEN
      RAISE EXCEPTION 'Reservation quantity must be positive';
    END IF;
    IF nullif(v_line ->> 'location_id', '') IS NULL THEN
      RAISE EXCEPTION 'Phase 2 hard reservations require location_id';
    END IF;

    SELECT p.id
    INTO v_product_id
    FROM public.inventory_variants v
    JOIN public.inventory_products p
      ON p.id = v.product_id AND p.organization_id = v.organization_id
    WHERE v.id = (v_line ->> 'variant_id')::uuid
      AND v.organization_id = p_organization_id
      AND v.status = 'active'
      AND p.status = 'active'
      AND v.deleted_at IS NULL
      AND p.deleted_at IS NULL;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Reservation variant is not active';
    END IF;

    v_balance := public.inventory_get_or_create_balance_for_update(
      p_organization_id,
      p_branch_id,
      (v_line ->> 'location_id')::uuid,
      (v_line ->> 'variant_id')::uuid,
      null,
      nullif(v_line ->> 'lot_id', '')::uuid,
      nullif(v_line ->> 'serial_id', '')::uuid
    );

    IF v_balance.available_quantity < v_quantity THEN
      RAISE EXCEPTION 'Insufficient available stock to reserve';
    END IF;

    INSERT INTO public.inventory_reservation_lines (
      organization_id, branch_id, reservation_id, product_id, variant_id, location_id,
      lot_id, serial_id, reserved_quantity
    )
    VALUES (
      p_organization_id, p_branch_id, v_reservation_id, v_product_id,
      (v_line ->> 'variant_id')::uuid,
      (v_line ->> 'location_id')::uuid,
      nullif(v_line ->> 'lot_id', '')::uuid,
      nullif(v_line ->> 'serial_id', '')::uuid,
      v_quantity
    );

    UPDATE public.inventory_balances
    SET reserved_quantity = reserved_quantity + v_quantity
    WHERE id = v_balance.id;
  END LOOP;

  RETURN jsonb_build_object(
    'reservation_id', v_reservation_id,
    'reservation_number', v_reservation_number,
    'status', 'active'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.inventory_release_reservation(
  p_reservation_id uuid,
  p_actor_user_id uuid default null,
  p_cancel boolean default true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_reservation public.inventory_reservations%ROWTYPE;
  v_line public.inventory_reservation_lines%ROWTYPE;
  v_remaining numeric(18, 6);
  v_balance public.inventory_balances%ROWTYPE;
BEGIN
  SELECT * INTO v_reservation
  FROM public.inventory_reservations
  WHERE id = p_reservation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reservation not found';
  END IF;

  IF NOT public.has_branch_permission(v_reservation.organization_id, v_reservation.branch_id, 'warehouse.inventory.operate') THEN
    RAISE EXCEPTION 'Missing warehouse.inventory.operate permission';
  END IF;

  PERFORM set_config('ambra.inventory_movement_engine', 'on', true);

  FOR v_line IN
    SELECT *
    FROM public.inventory_reservation_lines
    WHERE reservation_id = v_reservation.id
    FOR UPDATE
  LOOP
    v_remaining := v_line.reserved_quantity - v_line.released_quantity - v_line.fulfilled_quantity;
    IF v_remaining > 0 THEN
      v_balance := public.inventory_get_or_create_balance_for_update(
        v_line.organization_id,
        v_line.branch_id,
        v_line.location_id,
        v_line.variant_id,
        null,
        v_line.lot_id,
        v_line.serial_id
      );

      UPDATE public.inventory_balances
      SET reserved_quantity = greatest(0, reserved_quantity - v_remaining)
      WHERE id = v_balance.id;

      UPDATE public.inventory_reservation_lines
      SET released_quantity = released_quantity + v_remaining
      WHERE id = v_line.id;
    END IF;
  END LOOP;

  IF p_cancel THEN
    UPDATE public.inventory_reservations
    SET status = 'cancelled',
        cancelled_at = now(),
        cancelled_by = p_actor_user_id
    WHERE id = v_reservation.id;
  END IF;

  RETURN jsonb_build_object('reservation_id', v_reservation.id, 'status', CASE WHEN p_cancel THEN 'cancelled' ELSE v_reservation.status END);
END;
$$;

CREATE OR REPLACE FUNCTION public.inventory_create_allocation(
  p_organization_id uuid,
  p_branch_id uuid,
  p_lines jsonb,
  p_reservation_id uuid default null,
  p_reference_type text default null,
  p_reference_id uuid default null,
  p_reference_number text default null,
  p_actor_user_id uuid default null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_settings public.inventory_settings%ROWTYPE;
  v_allocation_id uuid;
  v_allocation_number text;
  v_line jsonb;
  v_product_id uuid;
  v_quantity numeric(18, 6);
  v_reservation_line public.inventory_reservation_lines%ROWTYPE;
  v_balance public.inventory_balances%ROWTYPE;
BEGIN
  IF NOT public.has_branch_permission(p_organization_id, p_branch_id, 'warehouse.inventory.operate') THEN
    RAISE EXCEPTION 'Missing warehouse.inventory.operate permission';
  END IF;

  IF jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'At least one allocation line is required';
  END IF;

  PERFORM set_config('ambra.inventory_movement_engine', 'on', true);

  INSERT INTO public.inventory_settings (organization_id, created_by, updated_by)
  VALUES (p_organization_id, p_actor_user_id, p_actor_user_id)
  ON CONFLICT (organization_id) DO NOTHING;

  SELECT * INTO v_settings
  FROM public.inventory_settings
  WHERE organization_id = p_organization_id
  FOR UPDATE;

  v_allocation_number :=
    v_settings.allocation_number_prefix || '-' || lpad(v_settings.allocation_number_next::text, 6, '0');

  UPDATE public.inventory_settings
  SET allocation_number_next = allocation_number_next + 1,
      updated_by = p_actor_user_id
  WHERE id = v_settings.id;

  INSERT INTO public.inventory_allocations (
    organization_id, branch_id, allocation_number, reservation_id, reference_type,
    reference_id, reference_number, created_by
  )
  VALUES (
    p_organization_id, p_branch_id, v_allocation_number, p_reservation_id, p_reference_type,
    p_reference_id, p_reference_number, p_actor_user_id
  )
  RETURNING id INTO v_allocation_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_quantity := (v_line ->> 'quantity')::numeric;
    IF v_quantity <= 0 THEN
      RAISE EXCEPTION 'Allocation quantity must be positive';
    END IF;

    SELECT p.id
    INTO v_product_id
    FROM public.inventory_variants v
    JOIN public.inventory_products p
      ON p.id = v.product_id AND p.organization_id = v.organization_id
    WHERE v.id = (v_line ->> 'variant_id')::uuid
      AND v.organization_id = p_organization_id
      AND v.status = 'active'
      AND p.status = 'active'
      AND v.deleted_at IS NULL
      AND p.deleted_at IS NULL;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Allocation variant is not active';
    END IF;

    v_balance := public.inventory_get_or_create_balance_for_update(
      p_organization_id,
      p_branch_id,
      (v_line ->> 'location_id')::uuid,
      (v_line ->> 'variant_id')::uuid,
      null,
      nullif(v_line ->> 'lot_id', '')::uuid,
      nullif(v_line ->> 'serial_id', '')::uuid
    );

    IF nullif(v_line ->> 'reservation_line_id', '') IS NOT NULL THEN
      SELECT * INTO v_reservation_line
      FROM public.inventory_reservation_lines
      WHERE id = (v_line ->> 'reservation_line_id')::uuid
        AND organization_id = p_organization_id
        AND branch_id = p_branch_id
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Reservation line not found for allocation';
      END IF;

      IF v_reservation_line.reserved_quantity - v_reservation_line.released_quantity - v_reservation_line.fulfilled_quantity < v_quantity THEN
        RAISE EXCEPTION 'Allocation exceeds remaining reservation quantity';
      END IF;

      UPDATE public.inventory_reservation_lines
      SET fulfilled_quantity = fulfilled_quantity + v_quantity
      WHERE id = v_reservation_line.id;

      UPDATE public.inventory_balances
      SET reserved_quantity = greatest(0, reserved_quantity - v_quantity),
          allocated_quantity = allocated_quantity + v_quantity
      WHERE id = v_balance.id;
    ELSE
      IF v_balance.available_quantity < v_quantity THEN
        RAISE EXCEPTION 'Insufficient available stock to allocate';
      END IF;

      UPDATE public.inventory_balances
      SET allocated_quantity = allocated_quantity + v_quantity
      WHERE id = v_balance.id;
    END IF;

    INSERT INTO public.inventory_allocation_lines (
      organization_id, branch_id, allocation_id, reservation_line_id, product_id, variant_id,
      location_id, lot_id, serial_id, allocated_quantity
    )
    VALUES (
      p_organization_id, p_branch_id, v_allocation_id,
      nullif(v_line ->> 'reservation_line_id', '')::uuid,
      v_product_id,
      (v_line ->> 'variant_id')::uuid,
      (v_line ->> 'location_id')::uuid,
      nullif(v_line ->> 'lot_id', '')::uuid,
      nullif(v_line ->> 'serial_id', '')::uuid,
      v_quantity
    );
  END LOOP;

  RETURN jsonb_build_object(
    'allocation_id', v_allocation_id,
    'allocation_number', v_allocation_number,
    'status', 'active'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.inventory_release_allocation(
  p_allocation_id uuid,
  p_actor_user_id uuid default null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_allocation public.inventory_allocations%ROWTYPE;
  v_line public.inventory_allocation_lines%ROWTYPE;
  v_remaining numeric(18, 6);
  v_balance public.inventory_balances%ROWTYPE;
BEGIN
  SELECT * INTO v_allocation
  FROM public.inventory_allocations
  WHERE id = p_allocation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Allocation not found';
  END IF;

  IF NOT public.has_branch_permission(v_allocation.organization_id, v_allocation.branch_id, 'warehouse.inventory.operate') THEN
    RAISE EXCEPTION 'Missing warehouse.inventory.operate permission';
  END IF;

  PERFORM set_config('ambra.inventory_movement_engine', 'on', true);

  FOR v_line IN
    SELECT *
    FROM public.inventory_allocation_lines
    WHERE allocation_id = v_allocation.id
    FOR UPDATE
  LOOP
    v_remaining := v_line.allocated_quantity - v_line.fulfilled_quantity;
    IF v_remaining > 0 THEN
      v_balance := public.inventory_get_or_create_balance_for_update(
        v_line.organization_id,
        v_line.branch_id,
        v_line.location_id,
        v_line.variant_id,
        null,
        v_line.lot_id,
        v_line.serial_id
      );

      UPDATE public.inventory_balances
      SET allocated_quantity = greatest(0, allocated_quantity - v_remaining)
      WHERE id = v_balance.id;
    END IF;
  END LOOP;

  UPDATE public.inventory_allocations
  SET status = 'released'
  WHERE id = v_allocation.id;

  RETURN jsonb_build_object('allocation_id', v_allocation.id, 'status', 'released');
END;
$$;

CREATE OR REPLACE FUNCTION public.inventory_update_weighted_average_cost()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_line public.inventory_movement_lines%ROWTYPE;
  v_currency text;
  v_unit_cost numeric(18, 6);
BEGIN
  IF TG_OP <> 'UPDATE' OR OLD.status = 'posted' OR NEW.status <> 'posted' THEN
    RETURN NEW;
  END IF;

  IF NEW.movement_kind NOT IN ('receipt', 'opening_balance', 'adjustment') THEN
    RETURN NEW;
  END IF;

  IF NEW.movement_kind = 'adjustment' AND NEW.adjustment_direction <> 'increase' THEN
    RETURN NEW;
  END IF;

  FOR v_line IN
    SELECT *
    FROM public.inventory_movement_lines
    WHERE movement_id = NEW.id
      AND deleted_at IS NULL
      AND quantity > 0
  LOOP
    v_currency := coalesce(v_line.currency, 'PLN');
    v_unit_cost := coalesce(v_line.unit_cost, v_line.total_cost / nullif(v_line.quantity, 0));

    IF v_unit_cost IS NOT NULL THEN
      INSERT INTO public.inventory_variant_costs (
        organization_id, branch_id, variant_id, currency,
        average_unit_cost, total_quantity, total_value
      )
      VALUES (
        NEW.organization_id, NEW.branch_id, v_line.variant_id, v_currency,
        v_unit_cost, v_line.quantity, v_unit_cost * v_line.quantity
      )
      ON CONFLICT (organization_id, branch_id, variant_id, currency)
      DO UPDATE SET
        total_quantity = public.inventory_variant_costs.total_quantity + excluded.total_quantity,
        total_value = public.inventory_variant_costs.total_value + excluded.total_value,
        average_unit_cost =
          CASE
            WHEN public.inventory_variant_costs.total_quantity + excluded.total_quantity <= 0 THEN 0
            ELSE (public.inventory_variant_costs.total_value + excluded.total_value)
              / (public.inventory_variant_costs.total_quantity + excluded.total_quantity)
          END,
        updated_at = now();
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS inventory_movement_weighted_average_cost ON public.inventory_movement_headers;
CREATE TRIGGER inventory_movement_weighted_average_cost
  AFTER UPDATE OF status ON public.inventory_movement_headers
  FOR EACH ROW
  EXECUTE FUNCTION public.inventory_update_weighted_average_cost();

-- ---------------------------------------------------------------------------
-- Purchase order creation and partial receiving
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.inventory_create_purchase_order(
  p_organization_id uuid,
  p_branch_id uuid,
  p_supplier_id uuid,
  p_lines jsonb,
  p_expected_delivery_date date default null,
  p_delivery_location_id uuid default null,
  p_currency text default 'PLN',
  p_notes text default null,
  p_actor_user_id uuid default null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_settings public.inventory_settings%ROWTYPE;
  v_po_id uuid;
  v_po_number text;
  v_line jsonb;
  v_line_number integer := 0;
  v_total numeric(18, 6) := 0;
  v_product_id uuid;
BEGIN
  IF NOT public.has_branch_permission(p_organization_id, p_branch_id, 'warehouse.procurement.manage') THEN
    RAISE EXCEPTION 'Missing warehouse.procurement.manage permission';
  END IF;

  IF jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'At least one purchase order line is required';
  END IF;

  PERFORM set_config('ambra.inventory_movement_engine', 'on', true);

  INSERT INTO public.inventory_settings (organization_id, created_by, updated_by)
  VALUES (p_organization_id, p_actor_user_id, p_actor_user_id)
  ON CONFLICT (organization_id) DO NOTHING;

  SELECT * INTO v_settings
  FROM public.inventory_settings
  WHERE organization_id = p_organization_id
  FOR UPDATE;

  v_po_number :=
    v_settings.purchase_order_number_prefix || '-' || lpad(v_settings.purchase_order_number_next::text, 6, '0');

  UPDATE public.inventory_settings
  SET purchase_order_number_next = purchase_order_number_next + 1,
      updated_by = p_actor_user_id
  WHERE id = v_settings.id;

  INSERT INTO public.inventory_purchase_orders (
    organization_id, branch_id, po_number, supplier_id, status,
    expected_delivery_date, delivery_location_id, currency, notes, created_by
  )
  VALUES (
    p_organization_id, p_branch_id, v_po_number, p_supplier_id, 'ordered',
    p_expected_delivery_date, p_delivery_location_id, coalesce(p_currency, 'PLN'), p_notes, p_actor_user_id
  )
  RETURNING id INTO v_po_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_line_number := v_line_number + 1;

    SELECT p.id INTO v_product_id
    FROM public.inventory_variants v
    JOIN public.inventory_products p
      ON p.id = v.product_id AND p.organization_id = v.organization_id
    WHERE v.id = (v_line ->> 'variant_id')::uuid
      AND v.organization_id = p_organization_id
      AND v.deleted_at IS NULL
      AND p.deleted_at IS NULL;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Purchase order variant is invalid';
    END IF;

    v_total := v_total + ((v_line ->> 'quantity')::numeric * coalesce(nullif(v_line ->> 'unit_cost', '')::numeric, 0));

    INSERT INTO public.inventory_purchase_order_lines (
      organization_id, branch_id, purchase_order_id, line_number, product_id, variant_id,
      unit_id, ordered_quantity, unit_cost, total_cost
    )
    VALUES (
      p_organization_id, p_branch_id, v_po_id, v_line_number, v_product_id,
      (v_line ->> 'variant_id')::uuid,
      (v_line ->> 'unit_id')::uuid,
      (v_line ->> 'quantity')::numeric,
      coalesce(nullif(v_line ->> 'unit_cost', '')::numeric, 0),
      (v_line ->> 'quantity')::numeric * coalesce(nullif(v_line ->> 'unit_cost', '')::numeric, 0)
    );
  END LOOP;

  UPDATE public.inventory_purchase_orders
  SET total = v_total
  WHERE id = v_po_id;

  RETURN jsonb_build_object('purchase_order_id', v_po_id, 'po_number', v_po_number, 'status', 'ordered');
END;
$$;

CREATE OR REPLACE FUNCTION public.inventory_receive_purchase_order(
  p_purchase_order_id uuid,
  p_lines jsonb,
  p_actor_user_id uuid default null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_po public.inventory_purchase_orders%ROWTYPE;
  v_line jsonb;
  v_po_line public.inventory_purchase_order_lines%ROWTYPE;
  v_receipt_lines jsonb := '[]'::jsonb;
  v_qty numeric(18, 6);
  v_location_id uuid;
  v_movement jsonb;
  v_remaining_open integer;
BEGIN
  SELECT * INTO v_po
  FROM public.inventory_purchase_orders
  WHERE id = p_purchase_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Purchase order not found';
  END IF;

  IF NOT public.has_branch_permission(v_po.organization_id, v_po.branch_id, 'warehouse.procurement.manage') THEN
    RAISE EXCEPTION 'Missing warehouse.procurement.manage permission';
  END IF;

  IF v_po.status IN ('received', 'closed', 'cancelled') THEN
    RAISE EXCEPTION 'Purchase order cannot be received in current status';
  END IF;

  IF jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'At least one receipt line is required';
  END IF;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    SELECT * INTO v_po_line
    FROM public.inventory_purchase_order_lines
    WHERE id = (v_line ->> 'purchase_order_line_id')::uuid
      AND purchase_order_id = v_po.id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Purchase order line not found';
    END IF;

    v_qty := (v_line ->> 'quantity')::numeric;
    IF v_qty <= 0 OR v_po_line.received_quantity + v_qty > v_po_line.ordered_quantity THEN
      RAISE EXCEPTION 'Receipt quantity exceeds open purchase order quantity';
    END IF;

    v_location_id := coalesce(nullif(v_line ->> 'destination_location_id', '')::uuid, v_po.delivery_location_id);
    IF v_location_id IS NULL THEN
      RAISE EXCEPTION 'Receipt destination location is required';
    END IF;

    UPDATE public.inventory_purchase_order_lines
    SET received_quantity = received_quantity + v_qty
    WHERE id = v_po_line.id;

    v_receipt_lines := v_receipt_lines || jsonb_build_array(jsonb_build_object(
      'variant_id', v_po_line.variant_id,
      'destination_location_id', v_location_id,
      'unit_id', v_po_line.unit_id,
      'quantity', v_qty,
      'unit_cost', v_po_line.unit_cost,
      'total_cost', v_qty * v_po_line.unit_cost,
      'currency', v_po.currency
    ));
  END LOOP;

  v_movement := public.inventory_create_draft_movement(
    v_po.organization_id,
    v_po.branch_id,
    'receipt',
    v_receipt_lines,
    null,
    null,
    'Purchase order receipt',
    'purchase_order',
    v_po.id::text,
    'po-receipt-' || v_po.id::text || '-' || extract(epoch from clock_timestamp())::text,
    p_actor_user_id
  );

  v_movement := public.inventory_post_movement((v_movement ->> 'movement_id')::uuid, p_actor_user_id);

  SELECT count(*) INTO v_remaining_open
  FROM public.inventory_purchase_order_lines
  WHERE purchase_order_id = v_po.id
    AND received_quantity < ordered_quantity;

  UPDATE public.inventory_purchase_orders
  SET status = CASE WHEN v_remaining_open = 0 THEN 'received' ELSE 'partially_received' END
  WHERE id = v_po.id;

  RETURN jsonb_build_object(
    'purchase_order_id', v_po.id,
    'status', CASE WHEN v_remaining_open = 0 THEN 'received' ELSE 'partially_received' END,
    'movement_id', v_movement ->> 'movement_id',
    'movement_number', v_movement ->> 'movement_number'
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Phase 2 validation overlay
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
    RAISE EXCEPTION 'Service and bundle products cannot be used in stock movements';
  END IF;

  IF v_product_type = 'lot_tracked' AND NEW.lot_id IS NULL THEN
    RAISE EXCEPTION 'Lot-tracked products require lot_id in Phase 2 movements';
  END IF;

  IF v_product_type = 'serialized' AND NEW.serial_id IS NULL THEN
    RAISE EXCEPTION 'Serialized products require serial_id in Phase 2 movements';
  END IF;

  IF NEW.unit_id <> v_product_base_unit_id THEN
    RAISE EXCEPTION 'Movement line unit must equal product base unit until conversions are enabled';
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

CREATE OR REPLACE FUNCTION public.inventory_create_draft_movement(
  p_organization_id uuid,
  p_branch_id uuid,
  p_movement_kind text,
  p_lines jsonb,
  p_adjustment_direction text default null,
  p_reason_id uuid default null,
  p_note text default null,
  p_reference_type text default null,
  p_reference_id text default null,
  p_idempotency_key text default null,
  p_actor_user_id uuid default null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_settings public.inventory_settings%ROWTYPE;
  v_reason public.inventory_movement_reasons%ROWTYPE;
  v_movement_id uuid;
  v_movement_number text;
  v_line jsonb;
  v_line_number integer := 0;
  v_existing public.inventory_movement_headers%ROWTYPE;
BEGIN
  IF p_movement_kind NOT IN ('receipt', 'issue', 'transfer', 'adjustment', 'opening_balance') THEN
    RAISE EXCEPTION 'Unsupported movement kind';
  END IF;

  IF p_movement_kind = 'adjustment' THEN
    IF p_adjustment_direction NOT IN ('increase', 'decrease') THEN
      RAISE EXCEPTION 'Adjustment direction is required';
    END IF;
    IF NOT public.has_branch_permission(p_organization_id, p_branch_id, 'warehouse.inventory.adjust') THEN
      RAISE EXCEPTION 'Missing warehouse.inventory.adjust permission';
    END IF;
  ELSE
    IF p_adjustment_direction IS NOT NULL THEN
      RAISE EXCEPTION 'Adjustment direction is only valid for adjustment movements';
    END IF;
    IF NOT public.has_branch_permission(p_organization_id, p_branch_id, 'warehouse.inventory.operate') THEN
      RAISE EXCEPTION 'Missing warehouse.inventory.operate permission';
    END IF;
  END IF;

  IF jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'At least one movement line is required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.branches
    WHERE id = p_branch_id
      AND organization_id = p_organization_id
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Branch does not belong to organization';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_existing
    FROM public.inventory_movement_headers
    WHERE organization_id = p_organization_id
      AND idempotency_key = p_idempotency_key
    FOR UPDATE;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'movement_id', v_existing.id,
        'movement_number', v_existing.movement_number,
        'status', v_existing.status
      );
    END IF;
  END IF;

  PERFORM set_config('ambra.inventory_movement_engine', 'on', true);

  INSERT INTO public.inventory_settings (organization_id, created_by, updated_by)
  VALUES (p_organization_id, p_actor_user_id, p_actor_user_id)
  ON CONFLICT (organization_id) DO NOTHING;

  SELECT * INTO v_settings
  FROM public.inventory_settings
  WHERE organization_id = p_organization_id
    AND deleted_at IS NULL
  FOR UPDATE;

  v_movement_number :=
    v_settings.movement_number_prefix || '-' || lpad(v_settings.movement_number_next::text, 6, '0');

  UPDATE public.inventory_settings
  SET movement_number_next = movement_number_next + 1,
      updated_by = p_actor_user_id
  WHERE id = v_settings.id;

  IF p_reason_id IS NOT NULL THEN
    SELECT * INTO v_reason
    FROM public.inventory_movement_reasons
    WHERE id = p_reason_id
      AND organization_id = p_organization_id
      AND deleted_at IS NULL
      AND is_active = true;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Movement reason is invalid';
    END IF;

    IF array_length(v_reason.applies_to, 1) IS NOT NULL
       AND NOT (p_movement_kind = ANY(v_reason.applies_to)) THEN
      RAISE EXCEPTION 'Movement reason does not apply to movement kind';
    END IF;

    IF v_reason.requires_note AND (p_note IS NULL OR length(trim(p_note)) = 0) THEN
      RAISE EXCEPTION 'Movement reason requires a note';
    END IF;
  END IF;

  INSERT INTO public.inventory_movement_headers (
    organization_id, branch_id, movement_number, movement_kind, adjustment_direction,
    status, reason_id, reason_code, note, reference_type, reference_id, idempotency_key, created_by
  )
  VALUES (
    p_organization_id, p_branch_id, v_movement_number, p_movement_kind, p_adjustment_direction,
    'draft', p_reason_id, v_reason.code, p_note, p_reference_type, p_reference_id, p_idempotency_key, p_actor_user_id
  )
  RETURNING id INTO v_movement_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_line_number := v_line_number + 1;

    INSERT INTO public.inventory_movement_lines (
      organization_id, branch_id, movement_id, line_number, variant_id,
      source_location_id, destination_location_id, lot_id, serial_id, unit_id,
      quantity, unit_cost, total_cost, currency, note
    )
    VALUES (
      p_organization_id, p_branch_id, v_movement_id, v_line_number,
      (v_line ->> 'variant_id')::uuid,
      nullif(v_line ->> 'source_location_id', '')::uuid,
      nullif(v_line ->> 'destination_location_id', '')::uuid,
      nullif(v_line ->> 'lot_id', '')::uuid,
      nullif(v_line ->> 'serial_id', '')::uuid,
      (v_line ->> 'unit_id')::uuid,
      (v_line ->> 'quantity')::numeric,
      nullif(v_line ->> 'unit_cost', '')::numeric,
      nullif(v_line ->> 'total_cost', '')::numeric,
      nullif(v_line ->> 'currency', ''),
      nullif(v_line ->> 'note', '')
    );
  END LOOP;

  RETURN jsonb_build_object('movement_id', v_movement_id, 'movement_number', v_movement_number, 'status', 'draft');
END;
$$;

CREATE OR REPLACE FUNCTION public.inventory_post_movement(
  p_movement_id uuid,
  p_actor_user_id uuid default null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_header public.inventory_movement_headers%ROWTYPE;
  v_settings public.inventory_settings%ROWTYPE;
  v_line public.inventory_movement_lines%ROWTYPE;
  v_balance public.inventory_balances%ROWTYPE;
  v_product_type text;
  v_product_base_unit_id uuid;
  v_delta numeric(18, 6);
  v_location_id uuid;
BEGIN
  SELECT *
  INTO v_header
  FROM public.inventory_movement_headers
  WHERE id = p_movement_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Movement not found';
  END IF;

  IF v_header.status = 'posted' THEN
    RETURN jsonb_build_object(
      'movement_id', v_header.id,
      'movement_number', v_header.movement_number,
      'status', v_header.status
    );
  END IF;

  IF v_header.status <> 'draft' THEN
    RAISE EXCEPTION 'Only draft movements can be posted';
  END IF;

  IF v_header.original_movement_id IS NOT NULL THEN
    IF NOT public.has_branch_permission(v_header.organization_id, v_header.branch_id, 'warehouse.inventory.reverse') THEN
      RAISE EXCEPTION 'Missing warehouse.inventory.reverse permission';
    END IF;
  ELSIF v_header.movement_kind = 'adjustment' THEN
    IF NOT public.has_branch_permission(v_header.organization_id, v_header.branch_id, 'warehouse.inventory.adjust') THEN
      RAISE EXCEPTION 'Missing warehouse.inventory.adjust permission';
    END IF;
  ELSE
    IF NOT public.has_branch_permission(v_header.organization_id, v_header.branch_id, 'warehouse.inventory.operate') THEN
      RAISE EXCEPTION 'Missing warehouse.inventory.operate permission';
    END IF;
  END IF;

  PERFORM set_config('ambra.inventory_movement_engine', 'on', true);

  SELECT *
  INTO v_settings
  FROM public.inventory_settings
  WHERE organization_id = v_header.organization_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventory settings unavailable';
  END IF;

  FOR v_line IN
    SELECT *
    FROM public.inventory_movement_lines
    WHERE movement_id = v_header.id
      AND organization_id = v_header.organization_id
      AND branch_id = v_header.branch_id
      AND deleted_at IS NULL
    ORDER BY
      coalesce(source_location_id, destination_location_id),
      variant_id,
      coalesce(lot_id, '00000000-0000-0000-0000-000000000000'::uuid),
      coalesce(serial_id, '00000000-0000-0000-0000-000000000000'::uuid),
      line_number
    FOR UPDATE
  LOOP
    SELECT p.product_type, p.base_unit_id
    INTO v_product_type, v_product_base_unit_id
    FROM public.inventory_variants v
    JOIN public.inventory_products p
      ON p.id = v.product_id
     AND p.organization_id = v.organization_id
    WHERE v.id = v_line.variant_id
      AND v.organization_id = v_header.organization_id
      AND v.status = 'active'
      AND v.deleted_at IS NULL
      AND p.status = 'active'
      AND p.deleted_at IS NULL;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Movement line variant is not active';
    END IF;

    IF v_product_type IN ('service', 'bundle') THEN
      RAISE EXCEPTION 'Service and bundle products cannot be posted to stock';
    END IF;

    IF v_product_type = 'lot_tracked' AND v_line.lot_id IS NULL THEN
      RAISE EXCEPTION 'Lot-tracked products require lot_id in Phase 2 movements';
    END IF;

    IF v_product_type = 'serialized' AND v_line.serial_id IS NULL THEN
      RAISE EXCEPTION 'Serialized products require serial_id in Phase 2 movements';
    END IF;

    IF v_line.unit_id <> v_product_base_unit_id THEN
      RAISE EXCEPTION 'Movement line unit must equal product base unit until conversions are enabled';
    END IF;

    IF (v_line.unit_cost IS NOT NULL AND v_line.unit_cost < 0)
       OR (v_line.total_cost IS NOT NULL AND v_line.total_cost < 0) THEN
      RAISE EXCEPTION 'Movement cost metadata must be nonnegative';
    END IF;

    IF v_header.movement_kind IN ('receipt', 'opening_balance')
       OR (v_header.movement_kind = 'adjustment' AND v_header.adjustment_direction = 'increase') THEN
      v_location_id := v_line.destination_location_id;
      v_delta := v_line.quantity;

      v_balance := public.inventory_get_or_create_balance_for_update(
        v_header.organization_id,
        v_header.branch_id,
        v_location_id,
        v_line.variant_id,
        v_header.id,
        v_line.lot_id,
        v_line.serial_id
      );

      UPDATE public.inventory_balances
      SET on_hand_quantity = on_hand_quantity + v_delta,
          last_movement_id = v_header.id,
          last_movement_at = now()
      WHERE id = v_balance.id;

      IF v_line.serial_id IS NOT NULL THEN
        UPDATE public.inventory_serials
        SET current_branch_id = v_header.branch_id,
            current_location_id = v_location_id,
            status = 'in_stock',
            updated_by = p_actor_user_id
        WHERE id = v_line.serial_id
          AND organization_id = v_header.organization_id;
      END IF;

    ELSIF v_header.movement_kind = 'issue'
       OR (v_header.movement_kind = 'adjustment' AND v_header.adjustment_direction = 'decrease') THEN
      v_location_id := v_line.source_location_id;
      v_delta := v_line.quantity;

      v_balance := public.inventory_get_or_create_balance_for_update(
        v_header.organization_id,
        v_header.branch_id,
        v_location_id,
        v_line.variant_id,
        v_header.id,
        v_line.lot_id,
        v_line.serial_id
      );

      IF NOT v_settings.allow_negative_stock AND v_balance.available_quantity < v_delta THEN
        RAISE EXCEPTION 'Insufficient available stock';
      END IF;

      UPDATE public.inventory_balances
      SET on_hand_quantity = on_hand_quantity - v_delta,
          last_movement_id = v_header.id,
          last_movement_at = now()
      WHERE id = v_balance.id;

      IF v_line.serial_id IS NOT NULL THEN
        UPDATE public.inventory_serials
        SET current_branch_id = null,
            current_location_id = null,
            status = 'issued',
            updated_by = p_actor_user_id
        WHERE id = v_line.serial_id
          AND organization_id = v_header.organization_id;
      END IF;

    ELSIF v_header.movement_kind = 'transfer' THEN
      v_balance := public.inventory_get_or_create_balance_for_update(
        v_header.organization_id,
        v_header.branch_id,
        v_line.source_location_id,
        v_line.variant_id,
        v_header.id,
        v_line.lot_id,
        v_line.serial_id
      );

      IF NOT v_settings.allow_negative_stock AND v_balance.available_quantity < v_line.quantity THEN
        RAISE EXCEPTION 'Insufficient available stock';
      END IF;

      UPDATE public.inventory_balances
      SET on_hand_quantity = on_hand_quantity - v_line.quantity,
          last_movement_id = v_header.id,
          last_movement_at = now()
      WHERE id = v_balance.id;

      v_balance := public.inventory_get_or_create_balance_for_update(
        v_header.organization_id,
        v_header.branch_id,
        v_line.destination_location_id,
        v_line.variant_id,
        v_header.id,
        v_line.lot_id,
        v_line.serial_id
      );

      UPDATE public.inventory_balances
      SET on_hand_quantity = on_hand_quantity + v_line.quantity,
          last_movement_id = v_header.id,
          last_movement_at = now()
      WHERE id = v_balance.id;

      IF v_line.serial_id IS NOT NULL THEN
        UPDATE public.inventory_serials
        SET current_branch_id = v_header.branch_id,
            current_location_id = v_line.destination_location_id,
            status = 'in_stock',
            updated_by = p_actor_user_id
        WHERE id = v_line.serial_id
          AND organization_id = v_header.organization_id;
      END IF;
    ELSE
      RAISE EXCEPTION 'Unsupported movement kind';
    END IF;
  END LOOP;

  UPDATE public.inventory_movement_headers
  SET status = 'posted',
      posted_at = now(),
      posted_by = p_actor_user_id,
      updated_at = now()
  WHERE id = v_header.id;

  RETURN jsonb_build_object(
    'movement_id', v_header.id,
    'movement_number', v_header.movement_number,
    'status', 'posted'
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- RLS and policies
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'inventory_option_groups',
    'inventory_option_values',
    'inventory_variant_option_values',
    'inventory_lots',
    'inventory_serials',
    'inventory_reservations',
    'inventory_reservation_lines',
    'inventory_allocations',
    'inventory_allocation_lines',
    'inventory_suppliers',
    'inventory_purchase_orders',
    'inventory_purchase_order_lines',
    'inventory_variant_costs'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', v_table);
    EXECUTE format('DROP TRIGGER IF EXISTS %I_updated_at ON public.%I', v_table, v_table);
    IF v_table NOT IN ('inventory_variant_option_values', 'inventory_reservation_lines', 'inventory_allocation_lines', 'inventory_variant_costs') THEN
      EXECUTE format(
        'CREATE TRIGGER %I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()',
        v_table,
        v_table
      );
    END IF;
  END LOOP;
END $$;

CREATE POLICY inventory_option_groups_select
  ON public.inventory_option_groups FOR SELECT
  USING (deleted_at IS NULL AND public.has_permission(organization_id, 'warehouse.products.read'));
CREATE POLICY inventory_option_groups_manage
  ON public.inventory_option_groups FOR ALL
  USING (public.has_permission(organization_id, 'warehouse.products.manage'))
  WITH CHECK (public.has_permission(organization_id, 'warehouse.products.manage'));

CREATE POLICY inventory_option_values_select
  ON public.inventory_option_values FOR SELECT
  USING (deleted_at IS NULL AND public.has_permission(organization_id, 'warehouse.products.read'));
CREATE POLICY inventory_option_values_manage
  ON public.inventory_option_values FOR ALL
  USING (public.has_permission(organization_id, 'warehouse.products.manage'))
  WITH CHECK (public.has_permission(organization_id, 'warehouse.products.manage'));

CREATE POLICY inventory_variant_option_values_select
  ON public.inventory_variant_option_values FOR SELECT
  USING (public.has_permission(organization_id, 'warehouse.products.read'));
CREATE POLICY inventory_variant_option_values_manage
  ON public.inventory_variant_option_values FOR ALL
  USING (public.has_permission(organization_id, 'warehouse.products.manage'))
  WITH CHECK (public.has_permission(organization_id, 'warehouse.products.manage'));

CREATE POLICY inventory_lots_select
  ON public.inventory_lots FOR SELECT
  USING (deleted_at IS NULL AND public.has_permission(organization_id, 'warehouse.inventory.read'));
CREATE POLICY inventory_lots_manage
  ON public.inventory_lots FOR ALL
  USING (public.has_permission(organization_id, 'warehouse.inventory.operate'))
  WITH CHECK (public.has_permission(organization_id, 'warehouse.inventory.operate'));

CREATE POLICY inventory_serials_select
  ON public.inventory_serials FOR SELECT
  USING (deleted_at IS NULL AND public.has_permission(organization_id, 'warehouse.inventory.read'));
CREATE POLICY inventory_serials_manage
  ON public.inventory_serials FOR ALL
  USING (public.has_permission(organization_id, 'warehouse.inventory.operate'))
  WITH CHECK (public.has_permission(organization_id, 'warehouse.inventory.operate'));

CREATE POLICY inventory_reservations_select
  ON public.inventory_reservations FOR SELECT
  USING (deleted_at IS NULL AND public.has_branch_permission(organization_id, branch_id, 'warehouse.inventory.read'));
CREATE POLICY inventory_reservations_operate
  ON public.inventory_reservations FOR ALL
  USING (public.has_branch_permission(organization_id, branch_id, 'warehouse.inventory.operate'))
  WITH CHECK (public.has_branch_permission(organization_id, branch_id, 'warehouse.inventory.operate'));

CREATE POLICY inventory_reservation_lines_select
  ON public.inventory_reservation_lines FOR SELECT
  USING (public.has_branch_permission(organization_id, branch_id, 'warehouse.inventory.read'));
CREATE POLICY inventory_reservation_lines_operate
  ON public.inventory_reservation_lines FOR ALL
  USING (public.has_branch_permission(organization_id, branch_id, 'warehouse.inventory.operate'))
  WITH CHECK (public.has_branch_permission(organization_id, branch_id, 'warehouse.inventory.operate'));

CREATE POLICY inventory_allocations_select
  ON public.inventory_allocations FOR SELECT
  USING (deleted_at IS NULL AND public.has_branch_permission(organization_id, branch_id, 'warehouse.inventory.read'));
CREATE POLICY inventory_allocations_operate
  ON public.inventory_allocations FOR ALL
  USING (public.has_branch_permission(organization_id, branch_id, 'warehouse.inventory.operate'))
  WITH CHECK (public.has_branch_permission(organization_id, branch_id, 'warehouse.inventory.operate'));

CREATE POLICY inventory_allocation_lines_select
  ON public.inventory_allocation_lines FOR SELECT
  USING (public.has_branch_permission(organization_id, branch_id, 'warehouse.inventory.read'));
CREATE POLICY inventory_allocation_lines_operate
  ON public.inventory_allocation_lines FOR ALL
  USING (public.has_branch_permission(organization_id, branch_id, 'warehouse.inventory.operate'))
  WITH CHECK (public.has_branch_permission(organization_id, branch_id, 'warehouse.inventory.operate'));

CREATE POLICY inventory_suppliers_select
  ON public.inventory_suppliers FOR SELECT
  USING (deleted_at IS NULL AND public.has_permission(organization_id, 'warehouse.procurement.read'));
CREATE POLICY inventory_suppliers_manage
  ON public.inventory_suppliers FOR ALL
  USING (public.has_permission(organization_id, 'warehouse.procurement.manage'))
  WITH CHECK (public.has_permission(organization_id, 'warehouse.procurement.manage'));

CREATE POLICY inventory_purchase_orders_select
  ON public.inventory_purchase_orders FOR SELECT
  USING (deleted_at IS NULL AND public.has_branch_permission(organization_id, branch_id, 'warehouse.procurement.read'));
CREATE POLICY inventory_purchase_orders_manage
  ON public.inventory_purchase_orders FOR ALL
  USING (public.has_branch_permission(organization_id, branch_id, 'warehouse.procurement.manage'))
  WITH CHECK (public.has_branch_permission(organization_id, branch_id, 'warehouse.procurement.manage'));

CREATE POLICY inventory_purchase_order_lines_select
  ON public.inventory_purchase_order_lines FOR SELECT
  USING (public.has_branch_permission(organization_id, branch_id, 'warehouse.procurement.read'));
CREATE POLICY inventory_purchase_order_lines_manage
  ON public.inventory_purchase_order_lines FOR ALL
  USING (public.has_branch_permission(organization_id, branch_id, 'warehouse.procurement.manage'))
  WITH CHECK (public.has_branch_permission(organization_id, branch_id, 'warehouse.procurement.manage'));

CREATE POLICY inventory_variant_costs_select
  ON public.inventory_variant_costs FOR SELECT
  USING (
    public.has_branch_permission(organization_id, branch_id, 'warehouse.pricing.read')
    OR public.has_branch_permission(organization_id, branch_id, 'warehouse.inventory.read')
  );
CREATE POLICY inventory_variant_costs_engine_manage
  ON public.inventory_variant_costs FOR ALL
  USING (
    public.has_branch_permission(organization_id, branch_id, 'warehouse.pricing.manage')
    OR public.has_branch_permission(organization_id, branch_id, 'warehouse.inventory.operate')
  )
  WITH CHECK (
    public.has_branch_permission(organization_id, branch_id, 'warehouse.pricing.manage')
    OR public.has_branch_permission(organization_id, branch_id, 'warehouse.inventory.operate')
  );

-- Recompile active member permission snapshots after adding Phase 2 slugs.
DO $$
DECLARE
  v_member record;
BEGIN
  FOR v_member IN
    SELECT organization_id, user_id
    FROM public.organization_members
    WHERE status = 'active'
  LOOP
    PERFORM public.compile_user_permissions(v_member.user_id, v_member.organization_id);
  END LOOP;
END $$;
