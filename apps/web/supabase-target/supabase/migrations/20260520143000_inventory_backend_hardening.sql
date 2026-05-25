-- Inventory backend hardening for production readiness Areas 5-9.
-- Repairs target RLS drift, view security, storage listing, transfer-line
-- tenant correlation, and canonical SKU collision detection.

-- ---------------------------------------------------------------------------
-- Canonical SKU identity
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.inventory_sku_fingerprint(p_sku text)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path = public
AS $$
  SELECT regexp_replace(upper(trim(p_sku)), '[^[:alnum:]]+', '', 'g');
$$;

CREATE UNIQUE INDEX IF NOT EXISTS inventory_variants_org_sku_fingerprint_active_uidx
  ON public.inventory_variants (organization_id, public.inventory_sku_fingerprint(sku))
  WHERE deleted_at IS NULL AND public.inventory_sku_fingerprint(sku) <> '';

CREATE OR REPLACE FUNCTION public.inventory_find_sku_collisions(
  p_organization_id uuid,
  p_skus text[],
  p_exclude_variant_ids uuid[] DEFAULT '{}'::uuid[]
)
RETURNS TABLE (
  sku text,
  variant_id uuid,
  product_id uuid,
  variant_name text,
  product_name text,
  sku_fingerprint text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH requested AS (
    SELECT DISTINCT public.inventory_sku_fingerprint(value) AS sku_fingerprint
    FROM unnest(coalesce(p_skus, '{}'::text[])) AS input(value)
    WHERE public.inventory_sku_fingerprint(value) <> ''
  )
  SELECT
    v.sku,
    v.id AS variant_id,
    v.product_id,
    v.name AS variant_name,
    p.name AS product_name,
    public.inventory_sku_fingerprint(v.sku) AS sku_fingerprint
  FROM public.inventory_variants v
  JOIN requested r
    ON r.sku_fingerprint = public.inventory_sku_fingerprint(v.sku)
  JOIN public.inventory_products p
    ON p.id = v.product_id
   AND p.organization_id = v.organization_id
  WHERE v.organization_id = p_organization_id
    AND v.deleted_at IS NULL
    AND p.deleted_at IS NULL
    AND NOT (v.id = ANY(coalesce(p_exclude_variant_ids, '{}'::uuid[])))
    AND public.has_permission(v.organization_id, 'warehouse.products.read');
$$;

-- ---------------------------------------------------------------------------
-- RLS drift repair for all inventory-owned public tables that were missing it.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'inventory_product_unit_conversions',
    'inventory_custom_fields',
    'inventory_custom_field_values',
    'inventory_collections',
    'inventory_collection_items',
    'inventory_saved_views',
    'inventory_import_jobs',
    'inventory_export_jobs',
    'inventory_valuation_snapshots',
    'inventory_report_runs',
    'inventory_count_sessions',
    'inventory_count_lines',
    'inventory_unit_conversions',
    'inventory_tax_rates'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', v_table);
  END LOOP;
END $$;

DROP POLICY IF EXISTS inventory_product_unit_conversions_select ON public.inventory_product_unit_conversions;
CREATE POLICY inventory_product_unit_conversions_select
  ON public.inventory_product_unit_conversions FOR SELECT
  USING (
    deleted_at IS NULL
    AND (
      public.has_permission(organization_id, 'warehouse.products.read')
      OR public.has_permission(organization_id, 'warehouse.products.manage')
    )
  );

DROP POLICY IF EXISTS inventory_product_unit_conversions_manage ON public.inventory_product_unit_conversions;
CREATE POLICY inventory_product_unit_conversions_manage
  ON public.inventory_product_unit_conversions FOR ALL
  USING (public.has_permission(organization_id, 'warehouse.products.manage'))
  WITH CHECK (public.has_permission(organization_id, 'warehouse.products.manage'));

DROP POLICY IF EXISTS inventory_custom_fields_select ON public.inventory_custom_fields;
CREATE POLICY inventory_custom_fields_select
  ON public.inventory_custom_fields FOR SELECT
  USING (
    deleted_at IS NULL
    AND (
      public.has_permission(organization_id, 'warehouse.products.read')
      OR public.has_permission(organization_id, 'warehouse.products.manage')
    )
  );

DROP POLICY IF EXISTS inventory_custom_fields_manage ON public.inventory_custom_fields;
CREATE POLICY inventory_custom_fields_manage
  ON public.inventory_custom_fields FOR ALL
  USING (public.has_permission(organization_id, 'warehouse.products.manage'))
  WITH CHECK (public.has_permission(organization_id, 'warehouse.products.manage'));

DROP POLICY IF EXISTS inventory_custom_field_values_select ON public.inventory_custom_field_values;
CREATE POLICY inventory_custom_field_values_select
  ON public.inventory_custom_field_values FOR SELECT
  USING (
    public.has_permission(organization_id, 'warehouse.products.read')
    OR public.has_permission(organization_id, 'warehouse.products.manage')
  );

DROP POLICY IF EXISTS inventory_custom_field_values_manage ON public.inventory_custom_field_values;
CREATE POLICY inventory_custom_field_values_manage
  ON public.inventory_custom_field_values FOR ALL
  USING (public.has_permission(organization_id, 'warehouse.products.manage'))
  WITH CHECK (public.has_permission(organization_id, 'warehouse.products.manage'));

DROP POLICY IF EXISTS inventory_collections_select ON public.inventory_collections;
CREATE POLICY inventory_collections_select
  ON public.inventory_collections FOR SELECT
  USING (
    deleted_at IS NULL
    AND (
      public.has_permission(organization_id, 'warehouse.products.read')
      OR public.has_permission(organization_id, 'warehouse.products.manage')
    )
  );

DROP POLICY IF EXISTS inventory_collections_manage ON public.inventory_collections;
CREATE POLICY inventory_collections_manage
  ON public.inventory_collections FOR ALL
  USING (public.has_permission(organization_id, 'warehouse.products.manage'))
  WITH CHECK (public.has_permission(organization_id, 'warehouse.products.manage'));

DROP POLICY IF EXISTS inventory_collection_items_select ON public.inventory_collection_items;
CREATE POLICY inventory_collection_items_select
  ON public.inventory_collection_items FOR SELECT
  USING (
    public.has_permission(organization_id, 'warehouse.products.read')
    OR public.has_permission(organization_id, 'warehouse.products.manage')
  );

DROP POLICY IF EXISTS inventory_collection_items_manage ON public.inventory_collection_items;
CREATE POLICY inventory_collection_items_manage
  ON public.inventory_collection_items FOR ALL
  USING (public.has_permission(organization_id, 'warehouse.products.manage'))
  WITH CHECK (public.has_permission(organization_id, 'warehouse.products.manage'));

DROP POLICY IF EXISTS inventory_saved_views_select ON public.inventory_saved_views;
CREATE POLICY inventory_saved_views_select
  ON public.inventory_saved_views FOR SELECT
  USING (
    deleted_at IS NULL
    AND (
      public.has_permission(organization_id, 'warehouse.products.read')
      OR public.has_permission(organization_id, 'warehouse.products.manage')
    )
    AND (is_shared = true OR user_id = auth.uid())
  );

DROP POLICY IF EXISTS inventory_saved_views_manage ON public.inventory_saved_views;
CREATE POLICY inventory_saved_views_manage
  ON public.inventory_saved_views FOR ALL
  USING (
    (
      public.has_permission(organization_id, 'warehouse.products.read')
      OR public.has_permission(organization_id, 'warehouse.products.manage')
    )
    AND (
      (is_shared = false AND user_id = auth.uid())
      OR public.has_permission(organization_id, 'warehouse.products.manage')
    )
  )
  WITH CHECK (
    (
      public.has_permission(organization_id, 'warehouse.products.read')
      OR public.has_permission(organization_id, 'warehouse.products.manage')
    )
    AND (
      (is_shared = false AND user_id = auth.uid())
      OR public.has_permission(organization_id, 'warehouse.products.manage')
    )
  );

DROP POLICY IF EXISTS inventory_import_jobs_select ON public.inventory_import_jobs;
CREATE POLICY inventory_import_jobs_select
  ON public.inventory_import_jobs FOR SELECT
  USING (
    public.has_permission(organization_id, 'warehouse.imports.manage')
    OR public.has_permission(organization_id, 'warehouse.products.manage')
  );

DROP POLICY IF EXISTS inventory_import_jobs_manage ON public.inventory_import_jobs;
CREATE POLICY inventory_import_jobs_manage
  ON public.inventory_import_jobs FOR ALL
  USING (
    public.has_permission(organization_id, 'warehouse.imports.manage')
    OR public.has_permission(organization_id, 'warehouse.products.manage')
  )
  WITH CHECK (
    public.has_permission(organization_id, 'warehouse.imports.manage')
    OR public.has_permission(organization_id, 'warehouse.products.manage')
  );

DROP POLICY IF EXISTS inventory_export_jobs_select ON public.inventory_export_jobs;
CREATE POLICY inventory_export_jobs_select
  ON public.inventory_export_jobs FOR SELECT
  USING (
    public.has_permission(organization_id, 'warehouse.products.read')
    OR public.has_permission(organization_id, 'warehouse.reports.read')
    OR public.has_permission(organization_id, 'warehouse.imports.manage')
  );

DROP POLICY IF EXISTS inventory_export_jobs_manage ON public.inventory_export_jobs;
CREATE POLICY inventory_export_jobs_manage
  ON public.inventory_export_jobs FOR ALL
  USING (
    public.has_permission(organization_id, 'warehouse.products.read')
    OR public.has_permission(organization_id, 'warehouse.reports.read')
    OR public.has_permission(organization_id, 'warehouse.imports.manage')
  )
  WITH CHECK (
    public.has_permission(organization_id, 'warehouse.products.read')
    OR public.has_permission(organization_id, 'warehouse.reports.read')
    OR public.has_permission(organization_id, 'warehouse.imports.manage')
  );

DROP POLICY IF EXISTS inventory_valuation_snapshots_select ON public.inventory_valuation_snapshots;
CREATE POLICY inventory_valuation_snapshots_select
  ON public.inventory_valuation_snapshots FOR SELECT
  USING (
    (branch_id IS NULL AND public.has_permission(organization_id, 'warehouse.reports.read'))
    OR (branch_id IS NOT NULL AND public.has_branch_permission(organization_id, branch_id, 'warehouse.reports.read'))
  );

DROP POLICY IF EXISTS inventory_valuation_snapshots_manage ON public.inventory_valuation_snapshots;
CREATE POLICY inventory_valuation_snapshots_manage
  ON public.inventory_valuation_snapshots FOR ALL
  USING (
    (branch_id IS NULL AND public.has_permission(organization_id, 'warehouse.reports.read'))
    OR (branch_id IS NOT NULL AND public.has_branch_permission(organization_id, branch_id, 'warehouse.reports.read'))
  )
  WITH CHECK (
    (branch_id IS NULL AND public.has_permission(organization_id, 'warehouse.reports.read'))
    OR (branch_id IS NOT NULL AND public.has_branch_permission(organization_id, branch_id, 'warehouse.reports.read'))
  );

DROP POLICY IF EXISTS inventory_report_runs_select ON public.inventory_report_runs;
CREATE POLICY inventory_report_runs_select
  ON public.inventory_report_runs FOR SELECT
  USING (
    (branch_id IS NULL AND public.has_permission(organization_id, 'warehouse.reports.read'))
    OR (branch_id IS NOT NULL AND public.has_branch_permission(organization_id, branch_id, 'warehouse.reports.read'))
  );

DROP POLICY IF EXISTS inventory_report_runs_manage ON public.inventory_report_runs;
CREATE POLICY inventory_report_runs_manage
  ON public.inventory_report_runs FOR ALL
  USING (
    (branch_id IS NULL AND public.has_permission(organization_id, 'warehouse.reports.read'))
    OR (branch_id IS NOT NULL AND public.has_branch_permission(organization_id, branch_id, 'warehouse.reports.read'))
  )
  WITH CHECK (
    (branch_id IS NULL AND public.has_permission(organization_id, 'warehouse.reports.read'))
    OR (branch_id IS NOT NULL AND public.has_branch_permission(organization_id, branch_id, 'warehouse.reports.read'))
  );

DROP POLICY IF EXISTS inventory_count_sessions_select ON public.inventory_count_sessions;
CREATE POLICY inventory_count_sessions_select
  ON public.inventory_count_sessions FOR SELECT
  USING (
    deleted_at IS NULL
    AND (
      public.has_branch_permission(organization_id, branch_id, 'warehouse.inventory.read')
      OR public.has_branch_permission(organization_id, branch_id, 'warehouse.inventory.adjust')
    )
  );

DROP POLICY IF EXISTS inventory_count_sessions_adjust ON public.inventory_count_sessions;
CREATE POLICY inventory_count_sessions_adjust
  ON public.inventory_count_sessions FOR ALL
  USING (public.has_branch_permission(organization_id, branch_id, 'warehouse.inventory.adjust'))
  WITH CHECK (public.has_branch_permission(organization_id, branch_id, 'warehouse.inventory.adjust'));

DROP POLICY IF EXISTS inventory_count_lines_select ON public.inventory_count_lines;
CREATE POLICY inventory_count_lines_select
  ON public.inventory_count_lines FOR SELECT
  USING (
    public.has_branch_permission(organization_id, branch_id, 'warehouse.inventory.read')
    OR public.has_branch_permission(organization_id, branch_id, 'warehouse.inventory.adjust')
  );

DROP POLICY IF EXISTS inventory_count_lines_adjust ON public.inventory_count_lines;
CREATE POLICY inventory_count_lines_adjust
  ON public.inventory_count_lines FOR ALL
  USING (public.has_branch_permission(organization_id, branch_id, 'warehouse.inventory.adjust'))
  WITH CHECK (public.has_branch_permission(organization_id, branch_id, 'warehouse.inventory.adjust'));

-- ---------------------------------------------------------------------------
-- Transfer lines must be correlated to the same organization as their header.
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS inventory_branch_transfers_id_org_uidx
  ON public.inventory_branch_transfers (id, organization_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'inventory_branch_transfer_lines_transfer_org_fkey'
      AND conrelid = 'public.inventory_branch_transfer_lines'::regclass
  ) THEN
    ALTER TABLE public.inventory_branch_transfer_lines
      ADD CONSTRAINT inventory_branch_transfer_lines_transfer_org_fkey
      FOREIGN KEY (transfer_id, organization_id)
      REFERENCES public.inventory_branch_transfers (id, organization_id)
      ON DELETE CASCADE
      NOT VALID;

    ALTER TABLE public.inventory_branch_transfer_lines
      VALIDATE CONSTRAINT inventory_branch_transfer_lines_transfer_org_fkey;
  END IF;
END $$;

DROP POLICY IF EXISTS inventory_branch_transfer_lines_select ON public.inventory_branch_transfer_lines;
CREATE POLICY inventory_branch_transfer_lines_select
  ON public.inventory_branch_transfer_lines FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.inventory_branch_transfers t
      WHERE t.id = inventory_branch_transfer_lines.transfer_id
        AND t.organization_id = inventory_branch_transfer_lines.organization_id
        AND (
          public.has_branch_permission(t.organization_id, t.source_branch_id, 'warehouse.inventory.read')
          OR public.has_branch_permission(t.organization_id, t.destination_branch_id, 'warehouse.inventory.read')
        )
    )
  );

DROP POLICY IF EXISTS inventory_branch_transfer_lines_operate ON public.inventory_branch_transfer_lines;
CREATE POLICY inventory_branch_transfer_lines_operate
  ON public.inventory_branch_transfer_lines FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.inventory_branch_transfers t
      WHERE t.id = inventory_branch_transfer_lines.transfer_id
        AND t.organization_id = inventory_branch_transfer_lines.organization_id
        AND (
          public.has_branch_permission(t.organization_id, t.source_branch_id, 'warehouse.inventory.operate')
          OR public.has_branch_permission(t.organization_id, t.destination_branch_id, 'warehouse.inventory.operate')
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.inventory_branch_transfers t
      WHERE t.id = inventory_branch_transfer_lines.transfer_id
        AND t.organization_id = inventory_branch_transfer_lines.organization_id
        AND (
          public.has_branch_permission(t.organization_id, t.source_branch_id, 'warehouse.inventory.operate')
          OR public.has_branch_permission(t.organization_id, t.destination_branch_id, 'warehouse.inventory.operate')
        )
    )
  );

-- ---------------------------------------------------------------------------
-- View and storage hardening.
-- ---------------------------------------------------------------------------
ALTER VIEW public.inventory_balance_analytics SET (security_invoker = true);

DROP POLICY IF EXISTS inventory_item_images_storage_public_read ON storage.objects;
