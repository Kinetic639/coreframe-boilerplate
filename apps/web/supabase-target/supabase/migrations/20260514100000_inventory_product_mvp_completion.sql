-- =============================================================================
-- Migration: inventory_product_mvp_completion
-- Project:   rjeraydumwechpjjzrus (TARGET)
-- Purpose:   MVP completion for Zoho-style product creation
-- =============================================================================

ALTER TABLE public.inventory_custom_fields
  ADD COLUMN IF NOT EXISTS section_name text null,
  ADD COLUMN IF NOT EXISTS help_text text null,
  ADD COLUMN IF NOT EXISTS placeholder text null;

CREATE TABLE IF NOT EXISTS public.inventory_sku_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text null,
  rules jsonb not null default '[]'::jsonb,
  is_default boolean not null default false,
  created_by uuid null references public.users(id) on delete set null,
  updated_by uuid null references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint inventory_sku_templates_name_not_empty check (length(trim(name)) > 0),
  constraint inventory_sku_templates_rules_array check (jsonb_typeof(rules) = 'array')
);

CREATE UNIQUE INDEX IF NOT EXISTS inventory_sku_templates_org_name_uidx
  ON public.inventory_sku_templates (organization_id, lower(name))
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS inventory_sku_templates_org_default_uidx
  ON public.inventory_sku_templates (organization_id)
  WHERE is_default = true AND deleted_at IS NULL;

ALTER TABLE public.inventory_sku_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_sku_templates FORCE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS inventory_sku_templates_updated_at ON public.inventory_sku_templates;
CREATE TRIGGER inventory_sku_templates_updated_at
  BEFORE UPDATE ON public.inventory_sku_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP POLICY IF EXISTS inventory_sku_templates_select ON public.inventory_sku_templates;
CREATE POLICY inventory_sku_templates_select
  ON public.inventory_sku_templates FOR SELECT
  USING (deleted_at IS NULL AND public.has_permission(organization_id, 'warehouse.products.read'));

DROP POLICY IF EXISTS inventory_sku_templates_manage ON public.inventory_sku_templates;
CREATE POLICY inventory_sku_templates_manage
  ON public.inventory_sku_templates FOR ALL
  USING (public.has_permission(organization_id, 'warehouse.products.manage'))
  WITH CHECK (public.has_permission(organization_id, 'warehouse.products.manage'));

CREATE OR REPLACE FUNCTION public.inventory_create_enhanced_product(
  p_organization_id uuid,
  p_product jsonb,
  p_attributes jsonb DEFAULT '[]'::jsonb,
  p_variants jsonb DEFAULT '[]'::jsonb,
  p_tags jsonb DEFAULT '[]'::jsonb,
  p_custom_fields jsonb DEFAULT '[]'::jsonb,
  p_unit_conversions jsonb DEFAULT '[]'::jsonb,
  p_branch_id uuid DEFAULT NULL,
  p_actor_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_created jsonb;
  v_product_id uuid;
  v_default_variant_id uuid;
  v_variant_id uuid;
  v_variant_ids jsonb := '[]'::jsonb;
  v_variant jsonb;
  v_first_variant jsonb;
  v_attr jsonb;
  v_attr_name text;
  v_attr_value text;
  v_group_id uuid;
  v_value_id uuid;
  v_option_map jsonb := '{}'::jsonb;
  v_option_key text;
  v_option_value_text text;
  v_identifier_type text;
  v_identifier_value text;
  v_tag jsonb;
  v_tag_name text;
  v_tag_id uuid;
  v_custom_field jsonb;
  v_custom_target_variant_id uuid;
  v_conversion jsonb;
  v_product_sku text;
  v_first_sku text;
  v_index integer := 0;
BEGIN
  IF NOT public.has_permission(p_organization_id, 'warehouse.products.manage') THEN
    RAISE EXCEPTION 'Missing warehouse.products.manage permission';
  END IF;

  IF jsonb_typeof(coalesce(p_attributes, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'Attributes must be an array';
  END IF;
  IF jsonb_typeof(coalesce(p_variants, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'Variants must be an array';
  END IF;

  v_first_variant := CASE
    WHEN jsonb_array_length(coalesce(p_variants, '[]'::jsonb)) > 0 THEN p_variants -> 0
    ELSE NULL
  END;
  v_product_sku := nullif(trim(coalesce(p_product ->> 'sku', '')), '');
  v_first_sku := nullif(trim(coalesce(v_first_variant ->> 'sku', '')), '');

  v_created := public.inventory_create_product_with_default_variant(
    p_organization_id,
    p_product ->> 'name',
    coalesce(p_product ->> 'product_type', 'stocked'),
    (p_product ->> 'base_unit_id')::uuid,
    coalesce(v_first_sku, v_product_sku),
    nullif(p_product ->> 'description', ''),
    p_actor_user_id
  );

  v_product_id := (v_created ->> 'product_id')::uuid;
  v_default_variant_id := (v_created ->> 'variant_id')::uuid;

  UPDATE public.inventory_products
  SET returnable = coalesce((p_product ->> 'returnable')::boolean, true),
      brand_name = nullif(trim(coalesce(p_product ->> 'brand_name', '')), ''),
      manufacturer_name = nullif(trim(coalesce(p_product ->> 'manufacturer_name', '')), ''),
      length_value = nullif(p_product ->> 'length_value', '')::numeric,
      width_value = nullif(p_product ->> 'width_value', '')::numeric,
      height_value = nullif(p_product ->> 'height_value', '')::numeric,
      dimension_unit = nullif(trim(coalesce(p_product ->> 'dimension_unit', '')), ''),
      weight_value = nullif(p_product ->> 'weight_value', '')::numeric,
      weight_unit = nullif(trim(coalesce(p_product ->> 'weight_unit', '')), ''),
      sales_description = nullif(p_product ->> 'sales_description', ''),
      purchase_description = nullif(p_product ->> 'purchase_description', ''),
      preferred_supplier_id = nullif(p_product ->> 'preferred_supplier_id', '')::uuid,
      updated_by = p_actor_user_id
  WHERE id = v_product_id
    AND organization_id = p_organization_id;

  FOR v_attr IN SELECT * FROM jsonb_array_elements(coalesce(p_attributes, '[]'::jsonb))
  LOOP
    v_attr_name := trim(coalesce(v_attr ->> 'name', ''));
    IF v_attr_name = '' THEN
      CONTINUE;
    END IF;

    SELECT id INTO v_group_id
    FROM public.inventory_option_groups
    WHERE organization_id = p_organization_id
      AND deleted_at IS NULL
      AND lower(name) = lower(v_attr_name)
    LIMIT 1;

    IF v_group_id IS NULL THEN
      INSERT INTO public.inventory_option_groups (organization_id, name, created_by, updated_by)
      VALUES (p_organization_id, v_attr_name, p_actor_user_id, p_actor_user_id)
      RETURNING id INTO v_group_id;
    END IF;

    FOR v_attr_value IN SELECT trim(value::text) FROM jsonb_array_elements_text(coalesce(v_attr -> 'values', '[]'::jsonb)) AS value
    LOOP
      IF v_attr_value = '' THEN
        CONTINUE;
      END IF;

      SELECT id INTO v_value_id
      FROM public.inventory_option_values
      WHERE organization_id = p_organization_id
        AND option_group_id = v_group_id
        AND deleted_at IS NULL
        AND lower(value) = lower(v_attr_value)
      LIMIT 1;

      IF v_value_id IS NULL THEN
        INSERT INTO public.inventory_option_values (organization_id, option_group_id, value, created_by, updated_by)
        VALUES (p_organization_id, v_group_id, v_attr_value, p_actor_user_id, p_actor_user_id)
        RETURNING id INTO v_value_id;
      END IF;

      v_option_map := jsonb_set(
        v_option_map,
        ARRAY[lower(v_attr_name) || '::' || lower(v_attr_value)],
        to_jsonb(v_value_id::text),
        true
      );
    END LOOP;
  END LOOP;

  IF jsonb_array_length(coalesce(p_variants, '[]'::jsonb)) = 0 THEN
    v_variant_ids := v_variant_ids || to_jsonb(v_default_variant_id::text);
  ELSE
    FOR v_variant IN SELECT * FROM jsonb_array_elements(p_variants)
    LOOP
      v_index := v_index + 1;
      IF v_index = 1 THEN
        v_variant_id := v_default_variant_id;
        UPDATE public.inventory_variants
        SET sku = trim(v_variant ->> 'sku'),
            name = trim(v_variant ->> 'name'),
            barcode = nullif(trim(coalesce(v_variant ->> 'barcode', '')), ''),
            purchase_price = nullif(v_variant ->> 'purchase_price', '')::numeric,
            sales_price = nullif(v_variant ->> 'sales_price', '')::numeric,
            price_currency = nullif(trim(coalesce(v_variant ->> 'price_currency', '')), ''),
            updated_by = p_actor_user_id
        WHERE id = v_variant_id
          AND organization_id = p_organization_id;
      ELSE
        INSERT INTO public.inventory_variants (
          organization_id,
          product_id,
          sku,
          name,
          barcode,
          purchase_price,
          sales_price,
          price_currency,
          created_by,
          updated_by
        )
        VALUES (
          p_organization_id,
          v_product_id,
          trim(v_variant ->> 'sku'),
          trim(v_variant ->> 'name'),
          nullif(trim(coalesce(v_variant ->> 'barcode', '')), ''),
          nullif(v_variant ->> 'purchase_price', '')::numeric,
          nullif(v_variant ->> 'sales_price', '')::numeric,
          nullif(trim(coalesce(v_variant ->> 'price_currency', '')), ''),
          p_actor_user_id,
          p_actor_user_id
        )
        RETURNING id INTO v_variant_id;
      END IF;

      v_variant_ids := v_variant_ids || to_jsonb(v_variant_id::text);

      FOR v_option_key, v_option_value_text IN SELECT * FROM jsonb_each_text(coalesce(v_variant -> 'options', '{}'::jsonb))
      LOOP
        v_value_id := nullif(v_option_map ->> (lower(v_option_key) || '::' || lower(v_option_value_text)), '')::uuid;
        IF v_value_id IS NULL THEN
          CONTINUE;
        END IF;

        SELECT option_group_id INTO v_group_id
        FROM public.inventory_option_values
        WHERE id = v_value_id
          AND organization_id = p_organization_id;

        INSERT INTO public.inventory_variant_option_values (
          organization_id,
          variant_id,
          option_group_id,
          option_value_id
        )
        VALUES (p_organization_id, v_variant_id, v_group_id, v_value_id)
        ON CONFLICT (variant_id, option_group_id) DO UPDATE
          SET option_value_id = excluded.option_value_id;
      END LOOP;

      FOREACH v_identifier_type IN ARRAY ARRAY['barcode', 'upc', 'ean', 'isbn', 'mpn']
      LOOP
        v_identifier_value := nullif(trim(coalesce(v_variant ->> v_identifier_type, '')), '');
        IF v_identifier_value IS NOT NULL THEN
          INSERT INTO public.inventory_product_identifiers (
            organization_id,
            product_id,
            variant_id,
            identifier_type,
            identifier_value,
            is_primary,
            created_by
          )
          VALUES (
            p_organization_id,
            v_product_id,
            v_variant_id,
            v_identifier_type,
            v_identifier_value,
            v_identifier_type = 'barcode',
            p_actor_user_id
          );
        END IF;
      END LOOP;

      IF p_branch_id IS NOT NULL AND nullif(v_variant ->> 'reorder_point', '') IS NOT NULL THEN
        INSERT INTO public.inventory_reorder_rules (
          organization_id,
          branch_id,
          variant_id,
          reorder_point,
          preferred_supplier_id,
          created_by,
          updated_by
        )
        VALUES (
          p_organization_id,
          p_branch_id,
          v_variant_id,
          (v_variant ->> 'reorder_point')::numeric,
          nullif(p_product ->> 'preferred_supplier_id', '')::uuid,
          p_actor_user_id,
          p_actor_user_id
        );
      END IF;
    END LOOP;
  END IF;

  FOR v_tag IN SELECT * FROM jsonb_array_elements(coalesce(p_tags, '[]'::jsonb))
  LOOP
    v_tag_name := trim(v_tag #>> '{}');
    IF v_tag_name = '' THEN
      CONTINUE;
    END IF;

    SELECT id INTO v_tag_id
    FROM public.inventory_tags
    WHERE organization_id = p_organization_id
      AND deleted_at IS NULL
      AND lower(name) = lower(v_tag_name)
    LIMIT 1;

    IF v_tag_id IS NULL THEN
      INSERT INTO public.inventory_tags (organization_id, name, created_by)
      VALUES (p_organization_id, v_tag_name, p_actor_user_id)
      RETURNING id INTO v_tag_id;
    END IF;

    INSERT INTO public.inventory_product_tags (organization_id, product_id, tag_id, created_by)
    VALUES (p_organization_id, v_product_id, v_tag_id, p_actor_user_id)
    ON CONFLICT (product_id, tag_id) DO NOTHING;
  END LOOP;

  FOR v_custom_field IN SELECT * FROM jsonb_array_elements(coalesce(p_custom_fields, '[]'::jsonb))
  LOOP
    v_custom_target_variant_id := NULL;
    IF coalesce(v_custom_field ->> 'entity_type', '') = 'variant' THEN
      SELECT id INTO v_custom_target_variant_id
      FROM public.inventory_variants
      WHERE organization_id = p_organization_id
        AND product_id = v_product_id
        AND lower(sku) = lower(v_custom_field ->> 'variant_sku')
        AND deleted_at IS NULL
      LIMIT 1;
    END IF;

    INSERT INTO public.inventory_custom_field_values (
      organization_id,
      field_id,
      product_id,
      variant_id,
      value_text,
      value_number,
      value_date,
      value_boolean,
      value_json,
      created_by
    )
    VALUES (
      p_organization_id,
      (v_custom_field ->> 'field_id')::uuid,
      CASE WHEN coalesce(v_custom_field ->> 'entity_type', '') = 'product' THEN v_product_id ELSE NULL END,
      v_custom_target_variant_id,
      nullif(v_custom_field ->> 'value_text', ''),
      nullif(v_custom_field ->> 'value_number', '')::numeric,
      nullif(v_custom_field ->> 'value_date', '')::date,
      nullif(v_custom_field ->> 'value_boolean', '')::boolean,
      CASE WHEN v_custom_field ? 'value_json' THEN v_custom_field -> 'value_json' ELSE NULL END,
      p_actor_user_id
    );
  END LOOP;

  FOR v_conversion IN SELECT * FROM jsonb_array_elements(coalesce(p_unit_conversions, '[]'::jsonb))
  LOOP
    INSERT INTO public.inventory_product_unit_conversions (
      organization_id,
      product_id,
      from_unit_id,
      to_unit_id,
      factor,
      rounding_mode,
      created_by
    )
    VALUES (
      p_organization_id,
      v_product_id,
      (v_conversion ->> 'from_unit_id')::uuid,
      (v_conversion ->> 'to_unit_id')::uuid,
      (v_conversion ->> 'factor')::numeric,
      coalesce(v_conversion ->> 'rounding_mode', 'half_up'),
      p_actor_user_id
    );
  END LOOP;

  RETURN jsonb_build_object(
    'product_id', v_product_id,
    'variant_ids', v_variant_ids,
    'sku', coalesce(v_first_sku, v_product_sku, v_created ->> 'sku')
  );
END;
$$;
