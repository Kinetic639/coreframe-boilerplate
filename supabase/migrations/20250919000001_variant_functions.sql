-- =====================================================
-- VARIANT MANAGEMENT FUNCTIONS
-- =====================================================
-- This migration adds enhanced database functions for variant management
-- including bulk operations, performance analytics, and utility functions

-- Function to create multiple variants in batch
CREATE OR REPLACE FUNCTION create_variant_batch(
  p_product_id UUID,
  p_variants JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  variant_data JSONB;
  new_variant product_variants;
  attr_data JSONB;
  result_variants JSONB := '[]'::jsonb;
  total_created INTEGER := 0;
BEGIN
  -- Validate product exists
  IF NOT EXISTS (SELECT 1 FROM products WHERE id = p_product_id AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Product not found or deleted: %', p_product_id;
  END IF;

  -- Process each variant in the batch
  FOR variant_data IN SELECT * FROM jsonb_array_elements(p_variants)
  LOOP
    -- Insert variant
    INSERT INTO product_variants (
      product_id,
      name,
      slug,
      sku,
      barcode,
      is_default,
      status,
      created_at,
      updated_at
    ) VALUES (
      p_product_id,
      variant_data->>'name',
      variant_data->>'slug',
      variant_data->>'sku',
      variant_data->>'barcode',
      COALESCE((variant_data->>'is_default')::boolean, false),
      COALESCE(variant_data->>'status', 'active'),
      NOW(),
      NOW()
    ) RETURNING * INTO new_variant;

    -- Create variant attributes if provided
    IF variant_data ? 'attributes' THEN
      FOR attr_data IN SELECT * FROM jsonb_each(variant_data->'attributes')
      LOOP
        INSERT INTO product_attributes (
          product_id,
          variant_id,
          attribute_key,
          context_scope,
          locale,
          value_text,
          value_number,
          value_boolean,
          value_date,
          value_json,
          created_at
        ) VALUES (
          p_product_id,
          new_variant.id,
          attr_data.key,
          COALESCE(variant_data->>'context_scope', 'warehouse'),
          COALESCE(variant_data->>'locale', 'en'),
          CASE WHEN attr_data.value->>'type' = 'text' THEN attr_data.value->>'value' END,
          CASE WHEN attr_data.value->>'type' = 'number' THEN (attr_data.value->>'value')::numeric END,
          CASE WHEN attr_data.value->>'type' = 'boolean' THEN (attr_data.value->>'value')::boolean END,
          CASE WHEN attr_data.value->>'type' = 'date' THEN (attr_data.value->>'value')::date END,
          CASE WHEN attr_data.value->>'type' = 'json' THEN attr_data.value->'value' END,
          NOW()
        );
      END LOOP;
    END IF;

    -- Add to result
    result_variants := result_variants || jsonb_build_object(
      'id', new_variant.id,
      'name', new_variant.name,
      'sku', new_variant.sku,
      'created_at', new_variant.created_at
    );

    total_created := total_created + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'total_created', total_created,
    'variants', result_variants
  );
END;
$$;

-- Function to generate variant combinations from a matrix
CREATE OR REPLACE FUNCTION generate_variant_combinations(
  p_product_id UUID,
  p_matrix JSONB,
  p_options JSONB DEFAULT '{}'::jsonb
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  attributes TEXT[];
  attr_name TEXT;
  attr_values JSONB;
  combination JSONB;
  combinations JSONB := '[]'::jsonb;
  base_name TEXT;
  variant_name TEXT;
  variant_sku TEXT;
  name_pattern TEXT;
  sku_pattern TEXT;
BEGIN
  -- Get product name for combinations
  SELECT name INTO base_name FROM products WHERE id = p_product_id AND deleted_at IS NULL;
  IF base_name IS NULL THEN
    RAISE EXCEPTION 'Product not found: %', p_product_id;
  END IF;

  -- Extract patterns from options
  name_pattern := p_options->>'name_pattern';
  sku_pattern := p_options->>'sku_pattern';

  -- Get attribute names
  SELECT ARRAY(SELECT jsonb_object_keys(p_matrix->'combinations')) INTO attributes;

  -- Generate all combinations using recursive CTE
  WITH RECURSIVE variant_combinations AS (
    -- Base case: start with empty combination
    SELECT
      '{}'::jsonb as combination,
      0 as attr_index

    UNION ALL

    -- Recursive case: add next attribute value
    SELECT
      vc.combination || jsonb_build_object(
        attributes[vc.attr_index + 1],
        attr_val.value
      ) as combination,
      vc.attr_index + 1
    FROM variant_combinations vc
    CROSS JOIN LATERAL (
      SELECT jsonb_array_elements_text(
        p_matrix->'combinations'->attributes[vc.attr_index + 1]
      ) as value
    ) attr_val
    WHERE vc.attr_index < array_length(attributes, 1)
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'name', CASE
        WHEN name_pattern IS NOT NULL THEN
          replace(
            replace(name_pattern, '{{product_name}}', base_name),
            '{{attributes}}',
            (SELECT string_agg(v::text, ' ') FROM jsonb_each_text(combination) AS t(k,v))
          )
        ELSE
          base_name || ' - ' ||
          (SELECT string_agg(v::text, ' ') FROM jsonb_each_text(combination) AS t(k,v))
      END,
      'sku', CASE
        WHEN sku_pattern IS NOT NULL THEN
          replace(
            replace(sku_pattern, '{{product_id}}', substring(p_product_id::text, 1, 8)),
            '{{attributes}}',
            (SELECT string_agg(upper(substring(v::text, 1, 2)), '') FROM jsonb_each_text(combination) AS t(k,v))
          )
        ELSE
          substring(p_product_id::text, 1, 8) || '-' ||
          (SELECT string_agg(upper(substring(v::text, 1, 2)), '') FROM jsonb_each_text(combination) AS t(k,v))
      END,
      'attributes', combination
    )
  ) INTO combinations
  FROM variant_combinations
  WHERE attr_index = array_length(attributes, 1);

  RETURN jsonb_build_object(
    'success', true,
    'total_combinations', jsonb_array_length(combinations),
    'combinations', combinations
  );
END;
$$;

-- Function to update variant pricing in batch
CREATE OR REPLACE FUNCTION update_variant_pricing(
  p_pricing_updates JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  pricing_update JSONB;
  updated_count INTEGER := 0;
BEGIN
  -- Process each pricing update
  FOR pricing_update IN SELECT * FROM jsonb_array_elements(p_pricing_updates)
  LOOP
    -- For now, we'll update a metadata field since variant_pricing table doesn't exist yet
    -- In production, this would update a proper pricing table
    UPDATE product_variants
    SET
      metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
        'pricing', jsonb_build_object(
          'cost', pricing_update->>'cost',
          'price', pricing_update->>'price',
          'currency', COALESCE(pricing_update->>'currency', 'USD'),
          'effective_date', COALESCE(pricing_update->>'effective_date', NOW()::text),
          'context', COALESCE(pricing_update->>'context', 'warehouse')
        )
      ),
      updated_at = NOW()
    WHERE id = (pricing_update->>'variant_id')::uuid
      AND deleted_at IS NULL;

    IF FOUND THEN
      updated_count := updated_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'updated_count', updated_count
  );
END;
$$;

-- Function to get variant performance analytics
CREATE OR REPLACE FUNCTION get_variant_performance(
  p_product_id UUID,
  p_date_from DATE DEFAULT NULL,
  p_date_to DATE DEFAULT NULL
) RETURNS TABLE(
  variant_id UUID,
  variant_name TEXT,
  variant_sku TEXT,
  total_sales NUMERIC,
  total_quantity_sold NUMERIC,
  current_stock NUMERIC,
  stock_value NUMERIC,
  last_sale_date TIMESTAMP,
  performance_score INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    v.id as variant_id,
    v.name as variant_name,
    v.sku as variant_sku,
    -- For now, return 0 for sales data since we don't have sales tables yet
    0::numeric as total_sales,
    0::numeric as total_quantity_sold,
    COALESCE(ss.quantity_on_hand, 0) as current_stock,
    COALESCE(ss.total_value, 0) as stock_value,
    NULL::timestamp as last_sale_date,
    -- Simple performance score based on stock
    CASE
      WHEN COALESCE(ss.quantity_on_hand, 0) > 0 THEN 70
      ELSE 30
    END as performance_score
  FROM product_variants v
  LEFT JOIN stock_snapshots ss ON ss.variant_id = v.id
  WHERE v.product_id = p_product_id
    AND v.deleted_at IS NULL
  ORDER BY v.name;
END;
$$;

-- Function to auto-generate SKUs for variants without them
CREATE OR REPLACE FUNCTION generate_variant_skus(
  p_product_id UUID,
  p_pattern TEXT DEFAULT NULL
) RETURNS TABLE(
  variant_id UUID,
  generated_sku TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  variant_record RECORD;
  base_sku TEXT;
  new_sku TEXT;
  counter INTEGER := 1;
BEGIN
  -- Get product slug for base SKU
  SELECT slug INTO base_sku FROM products WHERE id = p_product_id AND deleted_at IS NULL;
  IF base_sku IS NULL THEN
    RAISE EXCEPTION 'Product not found: %', p_product_id;
  END IF;

  -- Process variants without SKUs
  FOR variant_record IN
    SELECT v.id, v.name, v.slug
    FROM product_variants v
    WHERE v.product_id = p_product_id
      AND v.deleted_at IS NULL
      AND (v.sku IS NULL OR v.sku = '')
  LOOP
    -- Generate SKU
    IF p_pattern IS NOT NULL THEN
      new_sku := replace(
        replace(p_pattern, '{{product_sku}}', base_sku),
        '{{variant_name}}', COALESCE(variant_record.slug, lower(replace(variant_record.name, ' ', '-')))
      );
    ELSE
      new_sku := base_sku || '-' || COALESCE(variant_record.slug, 'var' || counter);
    END IF;

    -- Ensure uniqueness
    WHILE EXISTS (SELECT 1 FROM product_variants WHERE sku = new_sku AND deleted_at IS NULL) LOOP
      new_sku := new_sku || '-' || counter;
      counter := counter + 1;
    END LOOP;

    -- Update variant
    UPDATE product_variants
    SET sku = new_sku, updated_at = NOW()
    WHERE id = variant_record.id;

    -- Return result
    variant_id := variant_record.id;
    generated_sku := new_sku;
    RETURN NEXT;

    counter := counter + 1;
  END LOOP;
END;
$$;

-- Function to compare variants side by side
CREATE OR REPLACE FUNCTION compare_variants(
  p_variant_ids UUID[]
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  variant_data JSONB;
  comparison_data JSONB := '[]'::jsonb;
  attribute_keys TEXT[];
  comparison_matrix JSONB := '{}'::jsonb;
  attr_key TEXT;
  attr_values JSONB := '[]'::jsonb;
BEGIN
  -- Get variant data with attributes
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', v.id,
      'name', v.name,
      'sku', v.sku,
      'barcode', v.barcode,
      'status', v.status,
      'attributes', COALESCE(attr_data.attributes, '[]'::jsonb),
      'stock', COALESCE(
        jsonb_build_object(
          'on_hand', ss.quantity_on_hand,
          'reserved', ss.quantity_reserved,
          'available', ss.quantity_available,
          'value', ss.total_value
        ),
        jsonb_build_object('on_hand', 0, 'reserved', 0, 'available', 0, 'value', 0)
      )
    )
  ) INTO variant_data
  FROM product_variants v
  LEFT JOIN (
    SELECT
      variant_id,
      jsonb_agg(
        jsonb_build_object(
          'key', attribute_key,
          'value', COALESCE(value_text, value_number::text, value_boolean::text, value_date::text, value_json::text)
        )
      ) as attributes
    FROM product_attributes
    WHERE variant_id = ANY(p_variant_ids)
    GROUP BY variant_id
  ) attr_data ON attr_data.variant_id = v.id
  LEFT JOIN stock_snapshots ss ON ss.variant_id = v.id
  WHERE v.id = ANY(p_variant_ids) AND v.deleted_at IS NULL;

  -- Get all unique attribute keys
  SELECT ARRAY(
    SELECT DISTINCT jsonb_extract_path_text(attr_obj, 'key')
    FROM jsonb_array_elements(variant_data) as variant_obj,
         jsonb_array_elements(variant_obj->'attributes') as attr_obj
  ) INTO attribute_keys;

  -- Build comparison matrix
  FOR attr_key IN SELECT unnest(attribute_keys)
  LOOP
    SELECT jsonb_agg(
      COALESCE(
        (
          SELECT jsonb_extract_path_text(attr_obj, 'value')
          FROM jsonb_array_elements(variant_obj->'attributes') as attr_obj
          WHERE jsonb_extract_path_text(attr_obj, 'key') = attr_key
          LIMIT 1
        ),
        'N/A'
      )
    ) INTO attr_values
    FROM jsonb_array_elements(variant_data) as variant_obj;

    comparison_matrix := comparison_matrix || jsonb_build_object(attr_key, attr_values);
  END LOOP;

  RETURN jsonb_build_object(
    'variants', variant_data,
    'comparison_matrix', comparison_matrix,
    'attribute_keys', to_jsonb(attribute_keys)
  );
END;
$$;

-- Function to get variant stock summary across all locations
CREATE OR REPLACE FUNCTION get_variant_stock_summary(
  p_variant_ids UUID[] DEFAULT NULL,
  p_organization_id UUID DEFAULT NULL,
  p_branch_id UUID DEFAULT NULL
) RETURNS TABLE(
  variant_id UUID,
  variant_name TEXT,
  variant_sku TEXT,
  total_on_hand NUMERIC,
  total_reserved NUMERIC,
  total_available NUMERIC,
  total_value NUMERIC,
  location_count INTEGER,
  last_movement_date TIMESTAMP
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    v.id as variant_id,
    v.name as variant_name,
    v.sku as variant_sku,
    COALESCE(SUM(ss.quantity_on_hand), 0) as total_on_hand,
    COALESCE(SUM(ss.quantity_reserved), 0) as total_reserved,
    COALESCE(SUM(ss.quantity_available), 0) as total_available,
    COALESCE(SUM(ss.total_value), 0) as total_value,
    COUNT(DISTINCT ss.location_id)::integer as location_count,
    MAX(sm.occurred_at) as last_movement_date
  FROM product_variants v
  LEFT JOIN stock_snapshots ss ON ss.variant_id = v.id
    AND (p_organization_id IS NULL OR ss.organization_id = p_organization_id)
    AND (p_branch_id IS NULL OR ss.branch_id = p_branch_id)
  LEFT JOIN stock_movements sm ON sm.variant_id = v.id
    AND (p_organization_id IS NULL OR sm.organization_id = p_organization_id)
    AND (p_branch_id IS NULL OR sm.branch_id = p_branch_id)
  WHERE v.deleted_at IS NULL
    AND (p_variant_ids IS NULL OR v.id = ANY(p_variant_ids))
  GROUP BY v.id, v.name, v.sku
  ORDER BY v.name;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION create_variant_batch(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION generate_variant_combinations(UUID, JSONB, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION update_variant_pricing(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION get_variant_performance(UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION generate_variant_skus(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION compare_variants(UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION get_variant_stock_summary(UUID[], UUID, UUID) TO authenticated;