-- =============================================================================
-- Migration: inventory_product_creation_enhancements
-- Project:   rjeraydumwechpjjzrus (TARGET)
-- Purpose:   Zoho-style item creation foundations for Ambra Inventory V2
-- =============================================================================

ALTER TABLE public.inventory_products
  ADD COLUMN IF NOT EXISTS returnable boolean not null default true,
  ADD COLUMN IF NOT EXISTS brand_name text null,
  ADD COLUMN IF NOT EXISTS manufacturer_name text null,
  ADD COLUMN IF NOT EXISTS length_value numeric(18, 6) null,
  ADD COLUMN IF NOT EXISTS width_value numeric(18, 6) null,
  ADD COLUMN IF NOT EXISTS height_value numeric(18, 6) null,
  ADD COLUMN IF NOT EXISTS dimension_unit text null,
  ADD COLUMN IF NOT EXISTS weight_value numeric(18, 6) null,
  ADD COLUMN IF NOT EXISTS weight_unit text null,
  ADD COLUMN IF NOT EXISTS sales_description text null,
  ADD COLUMN IF NOT EXISTS purchase_description text null,
  ADD COLUMN IF NOT EXISTS preferred_supplier_id uuid null references public.inventory_suppliers(id) on delete set null;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'inventory_products_dimensions_nonnegative'
      AND conrelid = 'public.inventory_products'::regclass
  ) THEN
    ALTER TABLE public.inventory_products
      ADD CONSTRAINT inventory_products_dimensions_nonnegative
      CHECK (
        (length_value is null or length_value >= 0)
        and (width_value is null or width_value >= 0)
        and (height_value is null or height_value >= 0)
        and (weight_value is null or weight_value >= 0)
      );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.inventory_product_identifiers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid not null,
  variant_id uuid null,
  identifier_type text not null,
  identifier_value text not null,
  is_primary boolean not null default false,
  created_by uuid null references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint inventory_product_identifiers_product_fk
    foreign key (product_id, organization_id)
    references public.inventory_products (id, organization_id)
    on delete cascade,
  constraint inventory_product_identifiers_variant_fk
    foreign key (variant_id, organization_id)
    references public.inventory_variants (id, organization_id)
    on delete cascade,
  constraint inventory_product_identifiers_type_check
    check (identifier_type in ('sku', 'barcode', 'upc', 'ean', 'isbn', 'mpn', 'custom')),
  constraint inventory_product_identifiers_value_not_empty check (length(trim(identifier_value)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS inventory_product_identifiers_unique_active_idx
  ON public.inventory_product_identifiers (organization_id, identifier_type, lower(identifier_value))
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS inventory_product_identifiers_product_idx
  ON public.inventory_product_identifiers (organization_id, product_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS inventory_product_identifiers_variant_idx
  ON public.inventory_product_identifiers (organization_id, variant_id)
  WHERE variant_id IS NOT NULL AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.inventory_item_images (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid not null,
  variant_id uuid null,
  storage_bucket text not null default 'inventory-item-images',
  storage_path text null,
  public_url text null,
  file_name text null,
  content_type text null,
  file_size bigint null,
  width integer null,
  height integer null,
  alt_text text null,
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  created_by uuid null references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint inventory_item_images_product_fk
    foreign key (product_id, organization_id)
    references public.inventory_products (id, organization_id)
    on delete cascade,
  constraint inventory_item_images_variant_fk
    foreign key (variant_id, organization_id)
    references public.inventory_variants (id, organization_id)
    on delete cascade,
  constraint inventory_item_images_has_location check (storage_path is not null or public_url is not null),
  constraint inventory_item_images_size_nonnegative check (file_size is null or file_size >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS inventory_item_images_primary_product_uidx
  ON public.inventory_item_images (organization_id, product_id)
  WHERE variant_id IS NULL AND is_primary = true AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS inventory_item_images_primary_variant_uidx
  ON public.inventory_item_images (organization_id, variant_id)
  WHERE variant_id IS NOT NULL AND is_primary = true AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS inventory_item_images_product_idx
  ON public.inventory_item_images (organization_id, product_id, sort_order)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.inventory_reorder_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  variant_id uuid not null,
  location_id uuid null,
  min_quantity numeric(18, 6) null,
  reorder_point numeric(18, 6) not null,
  reorder_quantity numeric(18, 6) null,
  preferred_supplier_id uuid null references public.inventory_suppliers(id) on delete set null,
  is_active boolean not null default true,
  created_by uuid null references public.users(id) on delete set null,
  updated_by uuid null references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint inventory_reorder_rules_variant_fk
    foreign key (variant_id, organization_id)
    references public.inventory_variants (id, organization_id)
    on delete cascade,
  constraint inventory_reorder_rules_location_fk
    foreign key (location_id, organization_id, branch_id)
    references public.warehouse_locations (id, organization_id, branch_id)
    on delete cascade,
  constraint inventory_reorder_rules_quantities_nonnegative check (
    reorder_point >= 0
    and (min_quantity is null or min_quantity >= 0)
    and (reorder_quantity is null or reorder_quantity >= 0)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS inventory_reorder_rules_scope_uidx
  ON public.inventory_reorder_rules (
    organization_id,
    branch_id,
    variant_id,
    coalesce(location_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.inventory_tags (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  color text null,
  created_by uuid null references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint inventory_tags_name_not_empty check (length(trim(name)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS inventory_tags_org_name_uidx
  ON public.inventory_tags (organization_id, lower(name))
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS inventory_tags_id_org_uidx
  ON public.inventory_tags (id, organization_id);

CREATE TABLE IF NOT EXISTS public.inventory_product_tags (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid not null,
  tag_id uuid not null,
  created_by uuid null references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (product_id, tag_id),
  constraint inventory_product_tags_product_fk
    foreign key (product_id, organization_id)
    references public.inventory_products (id, organization_id)
    on delete cascade,
  constraint inventory_product_tags_tag_fk
    foreign key (tag_id, organization_id)
    references public.inventory_tags (id, organization_id)
    on delete cascade
);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'inventory-item-images',
  'inventory-item-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'inventory_reorder_rules'
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

ALTER TABLE public.inventory_product_identifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_product_identifiers FORCE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_item_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_item_images FORCE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_reorder_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_reorder_rules FORCE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_tags FORCE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_product_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_product_tags FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inventory_product_identifiers_select ON public.inventory_product_identifiers;
CREATE POLICY inventory_product_identifiers_select
  ON public.inventory_product_identifiers FOR SELECT
  USING (public.has_permission(organization_id, 'warehouse.products.read'));

DROP POLICY IF EXISTS inventory_product_identifiers_manage ON public.inventory_product_identifiers;
CREATE POLICY inventory_product_identifiers_manage
  ON public.inventory_product_identifiers FOR ALL
  USING (public.has_permission(organization_id, 'warehouse.products.manage'))
  WITH CHECK (public.has_permission(organization_id, 'warehouse.products.manage'));

DROP POLICY IF EXISTS inventory_item_images_select ON public.inventory_item_images;
CREATE POLICY inventory_item_images_select
  ON public.inventory_item_images FOR SELECT
  USING (public.has_permission(organization_id, 'warehouse.products.read'));

DROP POLICY IF EXISTS inventory_item_images_manage ON public.inventory_item_images;
CREATE POLICY inventory_item_images_manage
  ON public.inventory_item_images FOR ALL
  USING (public.has_permission(organization_id, 'warehouse.products.manage'))
  WITH CHECK (public.has_permission(organization_id, 'warehouse.products.manage'));

DROP POLICY IF EXISTS inventory_reorder_rules_select ON public.inventory_reorder_rules;
CREATE POLICY inventory_reorder_rules_select
  ON public.inventory_reorder_rules FOR SELECT
  USING (public.has_branch_permission(organization_id, branch_id, 'warehouse.inventory.read'));

DROP POLICY IF EXISTS inventory_reorder_rules_manage ON public.inventory_reorder_rules;
CREATE POLICY inventory_reorder_rules_manage
  ON public.inventory_reorder_rules FOR ALL
  USING (public.has_branch_permission(organization_id, branch_id, 'warehouse.inventory.operate'))
  WITH CHECK (public.has_branch_permission(organization_id, branch_id, 'warehouse.inventory.operate'));

DROP POLICY IF EXISTS inventory_tags_select ON public.inventory_tags;
CREATE POLICY inventory_tags_select
  ON public.inventory_tags FOR SELECT
  USING (public.has_permission(organization_id, 'warehouse.products.read'));

DROP POLICY IF EXISTS inventory_tags_manage ON public.inventory_tags;
CREATE POLICY inventory_tags_manage
  ON public.inventory_tags FOR ALL
  USING (public.has_permission(organization_id, 'warehouse.products.manage'))
  WITH CHECK (public.has_permission(organization_id, 'warehouse.products.manage'));

DROP POLICY IF EXISTS inventory_product_tags_select ON public.inventory_product_tags;
CREATE POLICY inventory_product_tags_select
  ON public.inventory_product_tags FOR SELECT
  USING (public.has_permission(organization_id, 'warehouse.products.read'));

DROP POLICY IF EXISTS inventory_product_tags_manage ON public.inventory_product_tags;
CREATE POLICY inventory_product_tags_manage
  ON public.inventory_product_tags FOR ALL
  USING (public.has_permission(organization_id, 'warehouse.products.manage'))
  WITH CHECK (public.has_permission(organization_id, 'warehouse.products.manage'));

DROP POLICY IF EXISTS inventory_item_images_storage_public_read ON storage.objects;
CREATE POLICY inventory_item_images_storage_public_read
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'inventory-item-images');

DROP POLICY IF EXISTS inventory_item_images_storage_upload ON storage.objects;
CREATE POLICY inventory_item_images_storage_upload
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'inventory-item-images'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND public.has_permission((storage.foldername(name))[1]::uuid, 'warehouse.products.manage')
  );

DROP POLICY IF EXISTS inventory_item_images_storage_update ON storage.objects;
CREATE POLICY inventory_item_images_storage_update
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'inventory-item-images'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND public.has_permission((storage.foldername(name))[1]::uuid, 'warehouse.products.manage')
  )
  WITH CHECK (
    bucket_id = 'inventory-item-images'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND public.has_permission((storage.foldername(name))[1]::uuid, 'warehouse.products.manage')
  );

DROP POLICY IF EXISTS inventory_item_images_storage_delete ON storage.objects;
CREATE POLICY inventory_item_images_storage_delete
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'inventory-item-images'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND public.has_permission((storage.foldername(name))[1]::uuid, 'warehouse.products.manage')
  );
