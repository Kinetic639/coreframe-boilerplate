-- =============================================================================
-- Migration: inventory_phase3_advanced_features
-- Project:   rjeraydumwechpjjzrus (TARGET)
-- Phase:     Ambra Inventory V2 Phase 3 — Advanced Features
-- =============================================================================
-- Adds SKU automation patterns, unit conversions, custom fields, collections,
-- saved DataView views, import/export job tracking, valuation snapshots,
-- inventory counts/cycle counts, and report snapshots.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Phase 3 permission slugs
-- ---------------------------------------------------------------------------
INSERT INTO public.permissions (slug, name, category, action)
VALUES
  ('warehouse.reports.read',   'Warehouse Reports Read',   'warehouse', 'reports.read'),
  ('warehouse.imports.manage', 'Warehouse Imports Manage', 'warehouse', 'imports.manage')
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
    SELECT id INTO v_perm_id FROM public.permissions WHERE slug = 'warehouse.reports.read';
    IF v_perm_id IS NOT NULL THEN
      INSERT INTO public.role_permissions (role_id, permission_id)
      VALUES (v_member_id, v_perm_id)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Advanced SKU pattern settings
-- ---------------------------------------------------------------------------
ALTER TABLE public.inventory_settings
  ADD COLUMN IF NOT EXISTS sku_pattern text not null default '{PREFIX}-{SEQ}',
  ADD COLUMN IF NOT EXISTS sku_sequence_padding integer not null default 6,
  ADD COLUMN IF NOT EXISTS low_stock_threshold numeric(18, 6) not null default 0,
  ADD COLUMN IF NOT EXISTS overstock_threshold numeric(18, 6) null;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'inventory_settings_sku_padding_check'
      AND conrelid = 'public.inventory_settings'::regclass
  ) THEN
    ALTER TABLE public.inventory_settings
      ADD CONSTRAINT inventory_settings_sku_padding_check
      CHECK (sku_sequence_padding BETWEEN 1 AND 12);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'inventory_settings_stock_thresholds_check'
      AND conrelid = 'public.inventory_settings'::regclass
  ) THEN
    ALTER TABLE public.inventory_settings
      ADD CONSTRAINT inventory_settings_stock_thresholds_check
      CHECK (
        low_stock_threshold >= 0
        AND (overstock_threshold IS NULL OR overstock_threshold >= low_stock_threshold)
      );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.inventory_sku_token(p_value text, p_max integer default 12)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT trim(both '-' from left(
    regexp_replace(upper(coalesce(p_value, 'ITEM')), '[^A-Z0-9]+', '-', 'g'),
    greatest(1, p_max)
  ));
$$;

CREATE OR REPLACE FUNCTION public.inventory_build_sku_from_pattern(
  p_pattern text,
  p_prefix text,
  p_product_name text,
  p_product_type text,
  p_sequence bigint,
  p_padding integer
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_sku text;
BEGIN
  v_sku := coalesce(nullif(trim(p_pattern), ''), '{PREFIX}-{SEQ}');
  v_sku := replace(v_sku, '{PREFIX}', public.inventory_sku_token(p_prefix, 20));
  v_sku := replace(v_sku, '{PRODUCT}', public.inventory_sku_token(p_product_name, 18));
  v_sku := replace(v_sku, '{TYPE}', public.inventory_sku_token(p_product_type, 12));
  v_sku := replace(v_sku, '{SEQ}', lpad(p_sequence::text, greatest(1, p_padding), '0'));
  v_sku := regexp_replace(v_sku, '[^A-Z0-9_-]+', '-', 'g');
  v_sku := regexp_replace(v_sku, '-+', '-', 'g');
  v_sku := trim(both '-' from v_sku);
  IF length(v_sku) = 0 THEN
    RETURN 'SKU-' || lpad(p_sequence::text, greatest(1, p_padding), '0');
  END IF;
  RETURN v_sku;
END;
$$;

CREATE OR REPLACE FUNCTION public.inventory_preview_sku(
  p_organization_id uuid,
  p_product_name text,
  p_product_type text default 'stocked'
)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_settings public.inventory_settings%ROWTYPE;
BEGIN
  IF NOT public.has_permission(p_organization_id, 'warehouse.products.read') THEN
    RAISE EXCEPTION 'Missing warehouse.products.read permission';
  END IF;

  SELECT *
  INTO v_settings
  FROM public.inventory_settings
  WHERE organization_id = p_organization_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN public.inventory_build_sku_from_pattern(
      '{PREFIX}-{SEQ}',
      'SKU',
      p_product_name,
      p_product_type,
      1,
      6
    );
  END IF;

  RETURN public.inventory_build_sku_from_pattern(
    v_settings.sku_pattern,
    v_settings.sku_prefix,
    p_product_name,
    p_product_type,
    v_settings.sku_next,
    v_settings.sku_sequence_padding
  );
END;
$$;

-- Replace Phase 1 product creation to use the Phase 3 SKU pattern contract.
CREATE OR REPLACE FUNCTION public.inventory_create_product_with_default_variant(
  p_organization_id uuid,
  p_name text,
  p_product_type text,
  p_base_unit_id uuid,
  p_sku text default null,
  p_description text default null,
  p_actor_user_id uuid default null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_settings public.inventory_settings%ROWTYPE;
  v_product_id uuid;
  v_variant_id uuid;
  v_sku text;
BEGIN
  IF NOT public.has_permission(p_organization_id, 'warehouse.products.manage') THEN
    RAISE EXCEPTION 'Missing warehouse.products.manage permission';
  END IF;

  IF p_base_unit_id IS NULL THEN
    RAISE EXCEPTION 'Base unit is required';
  END IF;

  PERFORM set_config('ambra.inventory_movement_engine', 'on', true);

  INSERT INTO public.inventory_settings (organization_id, created_by, updated_by)
  VALUES (p_organization_id, p_actor_user_id, p_actor_user_id)
  ON CONFLICT (organization_id) DO NOTHING;

  SELECT *
  INTO v_settings
  FROM public.inventory_settings
  WHERE organization_id = p_organization_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventory settings unavailable';
  END IF;

  IF p_sku IS NULL OR length(trim(p_sku)) = 0 THEN
    IF NOT v_settings.sku_generation_enabled THEN
      RAISE EXCEPTION 'SKU is required when SKU generation is disabled';
    END IF;

    v_sku := public.inventory_build_sku_from_pattern(
      v_settings.sku_pattern,
      v_settings.sku_prefix,
      p_name,
      coalesce(p_product_type, 'stocked'),
      v_settings.sku_next,
      v_settings.sku_sequence_padding
    );

    UPDATE public.inventory_settings
    SET sku_next = sku_next + 1,
        updated_by = p_actor_user_id
    WHERE id = v_settings.id;
  ELSE
    v_sku := trim(p_sku);
  END IF;

  INSERT INTO public.inventory_products (
    organization_id,
    name,
    description,
    product_type,
    base_unit_id,
    created_by,
    updated_by
  )
  VALUES (
    p_organization_id,
    trim(p_name),
    p_description,
    coalesce(p_product_type, 'stocked'),
    p_base_unit_id,
    p_actor_user_id,
    p_actor_user_id
  )
  RETURNING id INTO v_product_id;

  INSERT INTO public.inventory_variants (
    organization_id,
    product_id,
    sku,
    name,
    is_default,
    created_by,
    updated_by
  )
  VALUES (
    p_organization_id,
    v_product_id,
    v_sku,
    'Default',
    true,
    p_actor_user_id,
    p_actor_user_id
  )
  RETURNING id INTO v_variant_id;

  UPDATE public.inventory_products
  SET default_variant_id = v_variant_id,
      updated_by = p_actor_user_id
  WHERE id = v_product_id
    AND organization_id = p_organization_id;

  RETURN jsonb_build_object(
    'product_id', v_product_id,
    'variant_id', v_variant_id,
    'sku', v_sku
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Unit conversions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inventory_unit_conversions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  from_unit_id uuid not null references public.inventory_units(id) on delete restrict,
  to_unit_id uuid not null references public.inventory_units(id) on delete restrict,
  factor numeric(24, 12) not null,
  created_by uuid null references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint inventory_unit_conversions_factor_positive check (factor > 0),
  constraint inventory_unit_conversions_distinct_units check (from_unit_id <> to_unit_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS inventory_unit_conversions_unique_idx
  ON public.inventory_unit_conversions (organization_id, from_unit_id, to_unit_id)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.inventory_product_unit_conversions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid not null references public.inventory_products(id) on delete cascade,
  from_unit_id uuid not null references public.inventory_units(id) on delete restrict,
  to_unit_id uuid not null references public.inventory_units(id) on delete restrict,
  factor numeric(24, 12) not null,
  rounding_mode text not null default 'half_up',
  created_by uuid null references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint inventory_product_unit_conversions_factor_positive check (factor > 0),
  constraint inventory_product_unit_conversions_distinct_units check (from_unit_id <> to_unit_id),
  constraint inventory_product_unit_conversions_rounding_check check (
    rounding_mode in ('half_up', 'up', 'down')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS inventory_product_unit_conversions_unique_idx
  ON public.inventory_product_unit_conversions (organization_id, product_id, from_unit_id, to_unit_id)
  WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.inventory_convert_quantity(
  p_organization_id uuid,
  p_product_id uuid,
  p_from_unit_id uuid,
  p_to_unit_id uuid,
  p_quantity numeric
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_factor numeric(24, 12);
  v_rounding text;
  v_result numeric;
BEGIN
  IF p_from_unit_id = p_to_unit_id THEN
    RETURN p_quantity;
  END IF;

  SELECT factor, rounding_mode
  INTO v_factor, v_rounding
  FROM public.inventory_product_unit_conversions
  WHERE organization_id = p_organization_id
    AND product_id = p_product_id
    AND from_unit_id = p_from_unit_id
    AND to_unit_id = p_to_unit_id
    AND deleted_at IS NULL
  LIMIT 1;

  IF NOT FOUND THEN
    SELECT factor, 'half_up'
    INTO v_factor, v_rounding
    FROM public.inventory_unit_conversions
    WHERE organization_id = p_organization_id
      AND from_unit_id = p_from_unit_id
      AND to_unit_id = p_to_unit_id
      AND deleted_at IS NULL
    LIMIT 1;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No unit conversion exists for the requested units';
  END IF;

  v_result := p_quantity * v_factor;
  IF v_rounding = 'up' THEN
    RETURN ceiling(v_result);
  ELSIF v_rounding = 'down' THEN
    RETURN floor(v_result);
  END IF;
  RETURN round(v_result, 6);
END;
$$;

-- ---------------------------------------------------------------------------
-- Custom fields
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inventory_custom_fields (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  entity_type text not null,
  name text not null,
  field_key text not null,
  field_type text not null,
  is_required boolean not null default false,
  is_filterable boolean not null default false,
  options jsonb not null default '[]'::jsonb,
  display_order integer not null default 0,
  created_by uuid null references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint inventory_custom_fields_entity_check check (
    entity_type in ('product', 'variant', 'lot', 'serial')
  ),
  constraint inventory_custom_fields_type_check check (
    field_type in ('text', 'number', 'date', 'boolean', 'select', 'multi_select')
  ),
  constraint inventory_custom_fields_name_not_empty check (length(trim(name)) > 0),
  constraint inventory_custom_fields_key_not_empty check (length(trim(field_key)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS inventory_custom_fields_key_unique_idx
  ON public.inventory_custom_fields (organization_id, entity_type, lower(field_key))
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.inventory_custom_field_values (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  field_id uuid not null references public.inventory_custom_fields(id) on delete cascade,
  product_id uuid null references public.inventory_products(id) on delete cascade,
  variant_id uuid null references public.inventory_variants(id) on delete cascade,
  lot_id uuid null references public.inventory_lots(id) on delete cascade,
  serial_id uuid null references public.inventory_serials(id) on delete cascade,
  value_text text null,
  value_number numeric(24, 8) null,
  value_date date null,
  value_boolean boolean null,
  value_json jsonb null,
  created_by uuid null references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_custom_field_values_one_entity_check check (
    num_nonnulls(product_id, variant_id, lot_id, serial_id) = 1
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS inventory_custom_field_values_product_unique_idx
  ON public.inventory_custom_field_values (organization_id, field_id, product_id)
  WHERE product_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS inventory_custom_field_values_variant_unique_idx
  ON public.inventory_custom_field_values (organization_id, field_id, variant_id)
  WHERE variant_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS inventory_custom_field_values_lot_unique_idx
  ON public.inventory_custom_field_values (organization_id, field_id, lot_id)
  WHERE lot_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS inventory_custom_field_values_serial_unique_idx
  ON public.inventory_custom_field_values (organization_id, field_id, serial_id)
  WHERE serial_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS inventory_custom_field_values_text_filter_idx
  ON public.inventory_custom_field_values (organization_id, field_id, lower(value_text))
  WHERE value_text IS NOT NULL;

CREATE INDEX IF NOT EXISTS inventory_custom_field_values_number_filter_idx
  ON public.inventory_custom_field_values (organization_id, field_id, value_number)
  WHERE value_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS inventory_custom_field_values_date_filter_idx
  ON public.inventory_custom_field_values (organization_id, field_id, value_date)
  WHERE value_date IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Collections and saved views
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inventory_collections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text null,
  collection_type text not null default 'manual',
  filter_json jsonb null,
  created_by uuid null references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint inventory_collections_type_check check (collection_type in ('manual', 'dynamic')),
  constraint inventory_collections_name_not_empty check (length(trim(name)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS inventory_collections_org_name_unique_idx
  ON public.inventory_collections (organization_id, lower(name))
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.inventory_collection_items (
  collection_id uuid not null references public.inventory_collections(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid not null references public.inventory_products(id) on delete cascade,
  created_by uuid null references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (collection_id, product_id)
);

CREATE INDEX IF NOT EXISTS inventory_collection_items_product_idx
  ON public.inventory_collection_items (organization_id, product_id);

CREATE TABLE IF NOT EXISTS public.inventory_saved_views (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid null references public.users(id) on delete cascade,
  entity text not null,
  name text not null,
  config jsonb not null,
  is_shared boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint inventory_saved_views_entity_not_empty check (length(trim(entity)) > 0),
  constraint inventory_saved_views_name_not_empty check (length(trim(name)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS inventory_saved_views_user_name_unique_idx
  ON public.inventory_saved_views (organization_id, user_id, entity, lower(name))
  WHERE deleted_at IS NULL AND user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS inventory_saved_views_shared_name_unique_idx
  ON public.inventory_saved_views (organization_id, entity, lower(name))
  WHERE deleted_at IS NULL AND is_shared = true;

-- ---------------------------------------------------------------------------
-- Import/export jobs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inventory_import_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid null references public.branches(id) on delete set null,
  import_type text not null,
  status text not null default 'queued',
  file_name text null,
  storage_path text null,
  mapping jsonb not null default '{}'::jsonb,
  summary jsonb not null default '{}'::jsonb,
  error_message text null,
  created_by uuid null references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz null,
  constraint inventory_import_jobs_type_check check (
    import_type in ('products', 'opening_stock', 'counts')
  ),
  constraint inventory_import_jobs_status_check check (
    status in ('queued', 'processing', 'completed', 'failed', 'cancelled')
  )
);

CREATE INDEX IF NOT EXISTS inventory_import_jobs_org_status_idx
  ON public.inventory_import_jobs (organization_id, status, created_at desc);

CREATE TABLE IF NOT EXISTS public.inventory_export_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid null references public.branches(id) on delete set null,
  export_type text not null,
  status text not null default 'queued',
  filters jsonb not null default '{}'::jsonb,
  storage_path text null,
  summary jsonb not null default '{}'::jsonb,
  error_message text null,
  created_by uuid null references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz null,
  constraint inventory_export_jobs_type_check check (
    export_type in ('products', 'inventory', 'movements', 'valuation', 'counts')
  ),
  constraint inventory_export_jobs_status_check check (
    status in ('queued', 'processing', 'completed', 'failed', 'cancelled')
  )
);

CREATE INDEX IF NOT EXISTS inventory_export_jobs_org_status_idx
  ON public.inventory_export_jobs (organization_id, status, created_at desc);

-- ---------------------------------------------------------------------------
-- Valuation snapshots, reports, and analytics
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inventory_valuation_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid null references public.branches(id) on delete cascade,
  snapshot_date date not null,
  variant_id uuid null references public.inventory_variants(id) on delete restrict,
  location_id uuid null references public.warehouse_locations(id) on delete restrict,
  quantity_on_hand numeric(18, 6) not null,
  average_unit_cost numeric(18, 6) not null,
  total_value numeric(18, 6) not null,
  currency text not null default 'PLN',
  created_at timestamptz not null default now()
);

CREATE UNIQUE INDEX IF NOT EXISTS inventory_valuation_snapshots_unique_idx
  ON public.inventory_valuation_snapshots (
    organization_id,
    coalesce(branch_id, '00000000-0000-0000-0000-000000000000'::uuid),
    snapshot_date,
    coalesce(variant_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(location_id, '00000000-0000-0000-0000-000000000000'::uuid),
    currency
  );

CREATE TABLE IF NOT EXISTS public.inventory_report_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid null references public.branches(id) on delete set null,
  report_type text not null,
  filters jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  created_by uuid null references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint inventory_report_runs_type_check check (
    report_type in ('low_stock', 'overstock', 'dead_stock', 'fast_moving', 'slow_moving', 'valuation', 'aging')
  )
);

CREATE INDEX IF NOT EXISTS inventory_report_runs_org_type_idx
  ON public.inventory_report_runs (organization_id, report_type, created_at desc);

CREATE OR REPLACE VIEW public.inventory_balance_analytics AS
SELECT
  b.id,
  b.organization_id,
  b.branch_id,
  b.location_id,
  b.variant_id,
  v.product_id,
  p.name AS product_name,
  v.sku,
  b.on_hand_quantity,
  b.reserved_quantity,
  b.allocated_quantity,
  b.available_quantity,
  coalesce(vc.average_unit_cost, 0) AS average_unit_cost,
  coalesce(vc.average_unit_cost, 0) * b.on_hand_quantity AS total_value,
  coalesce(vc.currency, s.default_currency, 'PLN') AS currency,
  b.last_movement_at,
  last_receipt.last_received_at,
  last_issue.last_issued_at,
  CASE
    WHEN b.on_hand_quantity <= s.low_stock_threshold THEN true
    ELSE false
  END AS is_low_stock,
  CASE
    WHEN s.overstock_threshold IS NOT NULL AND b.on_hand_quantity >= s.overstock_threshold THEN true
    ELSE false
  END AS is_overstock
FROM public.inventory_balances b
JOIN public.inventory_variants v
  ON v.id = b.variant_id
 AND v.organization_id = b.organization_id
JOIN public.inventory_products p
  ON p.id = v.product_id
 AND p.organization_id = b.organization_id
LEFT JOIN public.inventory_settings s
  ON s.organization_id = b.organization_id
 AND s.deleted_at IS NULL
LEFT JOIN public.inventory_variant_costs vc
  ON vc.organization_id = b.organization_id
 AND vc.branch_id = b.branch_id
 AND vc.variant_id = b.variant_id
LEFT JOIN LATERAL (
  SELECT max(h.posted_at) AS last_received_at
  FROM public.inventory_movement_headers h
  JOIN public.inventory_movement_lines l ON l.movement_id = h.id
  WHERE h.organization_id = b.organization_id
    AND h.branch_id = b.branch_id
    AND h.status = 'posted'
    AND h.movement_kind IN ('receipt', 'opening_balance')
    AND l.variant_id = b.variant_id
) last_receipt ON true
LEFT JOIN LATERAL (
  SELECT max(h.posted_at) AS last_issued_at
  FROM public.inventory_movement_headers h
  JOIN public.inventory_movement_lines l ON l.movement_id = h.id
  WHERE h.organization_id = b.organization_id
    AND h.branch_id = b.branch_id
    AND h.status = 'posted'
    AND h.movement_kind IN ('issue', 'adjustment')
    AND l.variant_id = b.variant_id
    AND (h.movement_kind = 'issue' OR h.adjustment_direction = 'decrease')
) last_issue ON true;

CREATE OR REPLACE FUNCTION public.inventory_create_valuation_snapshot(
  p_organization_id uuid,
  p_branch_id uuid default null,
  p_snapshot_date date default current_date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF p_branch_id IS NULL THEN
    IF NOT public.has_permission(p_organization_id, 'warehouse.reports.read') THEN
      RAISE EXCEPTION 'Missing warehouse.reports.read permission';
    END IF;
  ELSE
    IF NOT public.has_branch_permission(p_organization_id, p_branch_id, 'warehouse.reports.read') THEN
      RAISE EXCEPTION 'Missing warehouse.reports.read permission';
    END IF;
  END IF;

  INSERT INTO public.inventory_valuation_snapshots (
    organization_id,
    branch_id,
    snapshot_date,
    variant_id,
    location_id,
    quantity_on_hand,
    average_unit_cost,
    total_value,
    currency
  )
  SELECT
    organization_id,
    branch_id,
    coalesce(p_snapshot_date, current_date),
    variant_id,
    location_id,
    on_hand_quantity,
    average_unit_cost,
    total_value,
    currency
  FROM public.inventory_balance_analytics
  WHERE organization_id = p_organization_id
    AND (p_branch_id IS NULL OR branch_id = p_branch_id)
  ON CONFLICT (
    organization_id,
    coalesce(branch_id, '00000000-0000-0000-0000-000000000000'::uuid),
    snapshot_date,
    coalesce(variant_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(location_id, '00000000-0000-0000-0000-000000000000'::uuid),
    currency
  )
  DO UPDATE SET
    quantity_on_hand = excluded.quantity_on_hand,
    average_unit_cost = excluded.average_unit_cost,
    total_value = excluded.total_value,
    created_at = now();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('snapshot_date', coalesce(p_snapshot_date, current_date), 'rows', v_count);
END;
$$;

-- ---------------------------------------------------------------------------
-- Inventory counts / cycle counts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inventory_count_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  count_number text not null,
  status text not null default 'draft',
  scope jsonb not null default '{}'::jsonb,
  notes text null,
  created_by uuid null references public.users(id) on delete set null,
  approved_by uuid null references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  approved_at timestamptz null,
  deleted_at timestamptz null,
  constraint inventory_count_sessions_status_check check (
    status in ('draft', 'counting', 'submitted', 'approved', 'cancelled')
  ),
  constraint inventory_count_sessions_number_not_empty check (length(trim(count_number)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS inventory_count_sessions_number_uidx
  ON public.inventory_count_sessions (organization_id, count_number)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.inventory_count_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  count_session_id uuid not null references public.inventory_count_sessions(id) on delete cascade,
  variant_id uuid not null references public.inventory_variants(id) on delete restrict,
  location_id uuid not null references public.warehouse_locations(id) on delete restrict,
  lot_id uuid null references public.inventory_lots(id) on delete restrict,
  serial_id uuid null references public.inventory_serials(id) on delete restrict,
  expected_quantity numeric(18, 6) not null default 0,
  counted_quantity numeric(18, 6) null,
  variance_quantity numeric(18, 6) generated always as (coalesce(counted_quantity, expected_quantity) - expected_quantity) stored,
  unit_id uuid not null references public.inventory_units(id) on delete restrict,
  note text null,
  counted_by uuid null references public.users(id) on delete set null,
  counted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

CREATE INDEX IF NOT EXISTS inventory_count_lines_session_idx
  ON public.inventory_count_lines (count_session_id, variant_id);

CREATE UNIQUE INDEX IF NOT EXISTS inventory_count_lines_natural_uidx
  ON public.inventory_count_lines (
    count_session_id,
    variant_id,
    location_id,
    coalesce(lot_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(serial_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

CREATE OR REPLACE FUNCTION public.inventory_create_count_session(
  p_organization_id uuid,
  p_branch_id uuid,
  p_scope jsonb default '{}'::jsonb,
  p_notes text default null,
  p_actor_user_id uuid default null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_count_id uuid;
  v_number text;
BEGIN
  IF NOT public.has_branch_permission(p_organization_id, p_branch_id, 'warehouse.inventory.adjust') THEN
    RAISE EXCEPTION 'Missing warehouse.inventory.adjust permission';
  END IF;

  v_number := 'CNT-' || to_char(now(), 'YYYYMMDDHH24MISS') || '-' || substr(gen_random_uuid()::text, 1, 6);

  INSERT INTO public.inventory_count_sessions (
    organization_id, branch_id, count_number, scope, notes, created_by
  )
  VALUES (
    p_organization_id, p_branch_id, upper(v_number), coalesce(p_scope, '{}'::jsonb), p_notes, p_actor_user_id
  )
  RETURNING id INTO v_count_id;

  INSERT INTO public.inventory_count_lines (
    organization_id,
    branch_id,
    count_session_id,
    variant_id,
    location_id,
    lot_id,
    serial_id,
    expected_quantity,
    unit_id
  )
  SELECT
    b.organization_id,
    b.branch_id,
    v_count_id,
    b.variant_id,
    b.location_id,
    b.lot_id,
    b.serial_id,
    b.on_hand_quantity,
    p.base_unit_id
  FROM public.inventory_balances b
  JOIN public.inventory_variants v
    ON v.id = b.variant_id
   AND v.organization_id = b.organization_id
  JOIN public.inventory_products p
    ON p.id = v.product_id
   AND p.organization_id = b.organization_id
  WHERE b.organization_id = p_organization_id
    AND b.branch_id = p_branch_id
    AND (
      p_scope IS NULL
      OR NOT (p_scope ? 'location_id')
      OR b.location_id = (p_scope ->> 'location_id')::uuid
    )
    AND (
      p_scope IS NULL
      OR NOT (p_scope ? 'variant_id')
      OR b.variant_id = (p_scope ->> 'variant_id')::uuid
    );

  RETURN jsonb_build_object('count_session_id', v_count_id, 'count_number', upper(v_number), 'status', 'draft');
END;
$$;

CREATE OR REPLACE FUNCTION public.inventory_approve_count_session(
  p_count_session_id uuid,
  p_actor_user_id uuid default null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_session public.inventory_count_sessions%ROWTYPE;
  v_line record;
  v_increase_lines jsonb := '[]'::jsonb;
  v_decrease_lines jsonb := '[]'::jsonb;
  v_result jsonb;
BEGIN
  SELECT *
  INTO v_session
  FROM public.inventory_count_sessions
  WHERE id = p_count_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventory count session not found';
  END IF;

  IF NOT public.has_branch_permission(v_session.organization_id, v_session.branch_id, 'warehouse.inventory.adjust') THEN
    RAISE EXCEPTION 'Missing warehouse.inventory.adjust permission';
  END IF;

  IF v_session.status NOT IN ('draft', 'counting', 'submitted') THEN
    RAISE EXCEPTION 'Inventory count cannot be approved in current status';
  END IF;

  FOR v_line IN
    SELECT *
    FROM public.inventory_count_lines
    WHERE count_session_id = v_session.id
      AND counted_quantity IS NOT NULL
      AND variance_quantity <> 0
    ORDER BY location_id, variant_id
  LOOP
    IF v_line.variance_quantity > 0 THEN
      v_increase_lines := v_increase_lines || jsonb_build_array(jsonb_build_object(
        'variant_id', v_line.variant_id,
        'destination_location_id', v_line.location_id,
        'lot_id', v_line.lot_id,
        'serial_id', v_line.serial_id,
        'unit_id', v_line.unit_id,
        'quantity', v_line.variance_quantity
      ));
    ELSE
      v_decrease_lines := v_decrease_lines || jsonb_build_array(jsonb_build_object(
        'variant_id', v_line.variant_id,
        'source_location_id', v_line.location_id,
        'lot_id', v_line.lot_id,
        'serial_id', v_line.serial_id,
        'unit_id', v_line.unit_id,
        'quantity', abs(v_line.variance_quantity)
      ));
    END IF;
  END LOOP;

  IF jsonb_array_length(v_increase_lines) > 0 THEN
    v_result := public.inventory_create_draft_movement(
      v_session.organization_id,
      v_session.branch_id,
      'adjustment',
      v_increase_lines,
      'increase',
      null,
      'Inventory count ' || v_session.count_number,
      'inventory_count',
      v_session.id::text,
      'count-increase-' || v_session.id::text,
      p_actor_user_id
    );
    PERFORM public.inventory_post_movement((v_result ->> 'movement_id')::uuid, p_actor_user_id);
  END IF;

  IF jsonb_array_length(v_decrease_lines) > 0 THEN
    v_result := public.inventory_create_draft_movement(
      v_session.organization_id,
      v_session.branch_id,
      'adjustment',
      v_decrease_lines,
      'decrease',
      null,
      'Inventory count ' || v_session.count_number,
      'inventory_count',
      v_session.id::text,
      'count-decrease-' || v_session.id::text,
      p_actor_user_id
    );
    PERFORM public.inventory_post_movement((v_result ->> 'movement_id')::uuid, p_actor_user_id);
  END IF;

  UPDATE public.inventory_count_sessions
  SET status = 'approved',
      approved_at = now(),
      approved_by = p_actor_user_id
  WHERE id = v_session.id;

  RETURN jsonb_build_object(
    'count_session_id', v_session.id,
    'count_number', v_session.count_number,
    'status', 'approved',
    'increase_lines', jsonb_array_length(v_increase_lines),
    'decrease_lines', jsonb_array_length(v_decrease_lines)
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Updated-at triggers, RLS, policies
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'inventory_unit_conversions',
    'inventory_product_unit_conversions',
    'inventory_custom_fields',
    'inventory_custom_field_values',
    'inventory_collections',
    'inventory_collection_items',
    'inventory_saved_views',
    'inventory_import_jobs',
    'inventory_export_jobs',
    'inventory_count_sessions',
    'inventory_count_lines'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', v_table);
    EXECUTE format('DROP TRIGGER IF EXISTS %I_updated_at ON public.%I', v_table, v_table);
    EXECUTE format(
      'CREATE TRIGGER %I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()',
      v_table,
      v_table
    );
  END LOOP;

  ALTER TABLE public.inventory_valuation_snapshots ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.inventory_valuation_snapshots FORCE ROW LEVEL SECURITY;
  ALTER TABLE public.inventory_report_runs ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.inventory_report_runs FORCE ROW LEVEL SECURITY;
END $$;

CREATE POLICY inventory_unit_conversions_select
  ON public.inventory_unit_conversions FOR SELECT
  USING (deleted_at IS NULL AND public.has_permission(organization_id, 'warehouse.products.read'));
CREATE POLICY inventory_unit_conversions_manage
  ON public.inventory_unit_conversions FOR ALL
  USING (public.has_permission(organization_id, 'warehouse.products.manage'))
  WITH CHECK (public.has_permission(organization_id, 'warehouse.products.manage'));

CREATE POLICY inventory_product_unit_conversions_select
  ON public.inventory_product_unit_conversions FOR SELECT
  USING (deleted_at IS NULL AND public.has_permission(organization_id, 'warehouse.products.read'));
CREATE POLICY inventory_product_unit_conversions_manage
  ON public.inventory_product_unit_conversions FOR ALL
  USING (public.has_permission(organization_id, 'warehouse.products.manage'))
  WITH CHECK (public.has_permission(organization_id, 'warehouse.products.manage'));

CREATE POLICY inventory_custom_fields_select
  ON public.inventory_custom_fields FOR SELECT
  USING (deleted_at IS NULL AND public.has_permission(organization_id, 'warehouse.products.read'));
CREATE POLICY inventory_custom_fields_manage
  ON public.inventory_custom_fields FOR ALL
  USING (public.has_permission(organization_id, 'warehouse.products.manage'))
  WITH CHECK (public.has_permission(organization_id, 'warehouse.products.manage'));

CREATE POLICY inventory_custom_field_values_select
  ON public.inventory_custom_field_values FOR SELECT
  USING (public.has_permission(organization_id, 'warehouse.products.read'));
CREATE POLICY inventory_custom_field_values_manage
  ON public.inventory_custom_field_values FOR ALL
  USING (public.has_permission(organization_id, 'warehouse.products.manage'))
  WITH CHECK (public.has_permission(organization_id, 'warehouse.products.manage'));

CREATE POLICY inventory_collections_select
  ON public.inventory_collections FOR SELECT
  USING (deleted_at IS NULL AND public.has_permission(organization_id, 'warehouse.products.read'));
CREATE POLICY inventory_collections_manage
  ON public.inventory_collections FOR ALL
  USING (public.has_permission(organization_id, 'warehouse.products.manage'))
  WITH CHECK (public.has_permission(organization_id, 'warehouse.products.manage'));

CREATE POLICY inventory_collection_items_select
  ON public.inventory_collection_items FOR SELECT
  USING (public.has_permission(organization_id, 'warehouse.products.read'));
CREATE POLICY inventory_collection_items_manage
  ON public.inventory_collection_items FOR ALL
  USING (public.has_permission(organization_id, 'warehouse.products.manage'))
  WITH CHECK (public.has_permission(organization_id, 'warehouse.products.manage'));

CREATE POLICY inventory_saved_views_select
  ON public.inventory_saved_views FOR SELECT
  USING (
    deleted_at IS NULL
    AND public.has_permission(organization_id, 'warehouse.products.read')
    AND (is_shared = true OR user_id = auth.uid())
  );
CREATE POLICY inventory_saved_views_manage
  ON public.inventory_saved_views FOR ALL
  USING (
    public.has_permission(organization_id, 'warehouse.products.read')
    AND (is_shared = false AND user_id = auth.uid() OR public.has_permission(organization_id, 'warehouse.products.manage'))
  )
  WITH CHECK (
    public.has_permission(organization_id, 'warehouse.products.read')
    AND (is_shared = false AND user_id = auth.uid() OR public.has_permission(organization_id, 'warehouse.products.manage'))
  );

CREATE POLICY inventory_import_jobs_select
  ON public.inventory_import_jobs FOR SELECT
  USING (public.has_permission(organization_id, 'warehouse.imports.manage'));
CREATE POLICY inventory_import_jobs_manage
  ON public.inventory_import_jobs FOR ALL
  USING (public.has_permission(organization_id, 'warehouse.imports.manage'))
  WITH CHECK (public.has_permission(organization_id, 'warehouse.imports.manage'));

CREATE POLICY inventory_export_jobs_select
  ON public.inventory_export_jobs FOR SELECT
  USING (
    public.has_permission(organization_id, 'warehouse.reports.read')
    OR public.has_permission(organization_id, 'warehouse.imports.manage')
  );
CREATE POLICY inventory_export_jobs_manage
  ON public.inventory_export_jobs FOR ALL
  USING (
    public.has_permission(organization_id, 'warehouse.reports.read')
    OR public.has_permission(organization_id, 'warehouse.imports.manage')
  )
  WITH CHECK (
    public.has_permission(organization_id, 'warehouse.reports.read')
    OR public.has_permission(organization_id, 'warehouse.imports.manage')
  );

CREATE POLICY inventory_valuation_snapshots_select
  ON public.inventory_valuation_snapshots FOR SELECT
  USING (
    branch_id IS NULL
    AND public.has_permission(organization_id, 'warehouse.reports.read')
    OR branch_id IS NOT NULL
    AND public.has_branch_permission(organization_id, branch_id, 'warehouse.reports.read')
  );
CREATE POLICY inventory_valuation_snapshots_manage
  ON public.inventory_valuation_snapshots FOR ALL
  USING (
    branch_id IS NULL
    AND public.has_permission(organization_id, 'warehouse.reports.read')
    OR branch_id IS NOT NULL
    AND public.has_branch_permission(organization_id, branch_id, 'warehouse.reports.read')
  )
  WITH CHECK (
    branch_id IS NULL
    AND public.has_permission(organization_id, 'warehouse.reports.read')
    OR branch_id IS NOT NULL
    AND public.has_branch_permission(organization_id, branch_id, 'warehouse.reports.read')
  );

CREATE POLICY inventory_report_runs_select
  ON public.inventory_report_runs FOR SELECT
  USING (
    branch_id IS NULL
    AND public.has_permission(organization_id, 'warehouse.reports.read')
    OR branch_id IS NOT NULL
    AND public.has_branch_permission(organization_id, branch_id, 'warehouse.reports.read')
  );
CREATE POLICY inventory_report_runs_manage
  ON public.inventory_report_runs FOR ALL
  USING (
    branch_id IS NULL
    AND public.has_permission(organization_id, 'warehouse.reports.read')
    OR branch_id IS NOT NULL
    AND public.has_branch_permission(organization_id, branch_id, 'warehouse.reports.read')
  )
  WITH CHECK (
    branch_id IS NULL
    AND public.has_permission(organization_id, 'warehouse.reports.read')
    OR branch_id IS NOT NULL
    AND public.has_branch_permission(organization_id, branch_id, 'warehouse.reports.read')
  );

CREATE POLICY inventory_count_sessions_select
  ON public.inventory_count_sessions FOR SELECT
  USING (deleted_at IS NULL AND public.has_branch_permission(organization_id, branch_id, 'warehouse.inventory.read'));
CREATE POLICY inventory_count_sessions_adjust
  ON public.inventory_count_sessions FOR ALL
  USING (public.has_branch_permission(organization_id, branch_id, 'warehouse.inventory.adjust'))
  WITH CHECK (public.has_branch_permission(organization_id, branch_id, 'warehouse.inventory.adjust'));

CREATE POLICY inventory_count_lines_select
  ON public.inventory_count_lines FOR SELECT
  USING (public.has_branch_permission(organization_id, branch_id, 'warehouse.inventory.read'));
CREATE POLICY inventory_count_lines_adjust
  ON public.inventory_count_lines FOR ALL
  USING (public.has_branch_permission(organization_id, branch_id, 'warehouse.inventory.adjust'))
  WITH CHECK (public.has_branch_permission(organization_id, branch_id, 'warehouse.inventory.adjust'));

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
