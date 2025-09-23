-- =============================================
-- Migration: Complete product management functions
-- Fills the remaining 5% to complete database schema
-- =============================================

-- Function to get product with all context-specific data
CREATE OR REPLACE FUNCTION get_product_with_contexts(
  p_product_id UUID,
  p_context TEXT DEFAULT 'warehouse'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  -- Get product with template, variants, and all context data
  SELECT jsonb_build_object(
    'id', p.id,
    'name', p.name,
    'slug', p.slug,
    'description', p.description,
    'status', p.status,
    'organization_id', p.organization_id,
    'template_id', p.template_id,
    'created_at', p.created_at,
    'updated_at', p.updated_at,
    'template', jsonb_build_object(
      'id', pt.id,
      'name', pt.name,
      'slug', pt.slug,
      'description', pt.description,
      'icon', pt.icon,
      'color', pt.color,
      'metadata', pt.metadata,
      'is_system', pt.is_system
    ),
    'variants', COALESCE(variants.variants, '[]'::jsonb),
    'attributes', COALESCE(attributes.attributes, '[]'::jsonb),
    'images', COALESCE(images.images, '[]'::jsonb)
  ) INTO result
  FROM products p
  LEFT JOIN product_templates pt ON p.template_id = pt.id
  LEFT LATERAL (
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', pv.id,
        'name', pv.name,
        'slug', pv.slug,
        'sku', pv.sku,
        'barcode', pv.barcode,
        'is_default', pv.is_default,
        'status', pv.status,
        'stock_snapshots', COALESCE(ss.snapshots, '[]'::jsonb),
        'attributes', COALESCE(va.attributes, '[]'::jsonb)
      )
    ) as variants
    FROM product_variants pv
    LEFT LATERAL (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', s.id,
          'location_id', s.location_id,
          'quantity_available', s.quantity_available,
          'quantity_reserved', s.quantity_reserved,
          'average_cost', s.average_cost,
          'last_movement_at', s.last_movement_at
        )
      ) as snapshots
      FROM stock_snapshots s
      WHERE s.product_id = p.id AND s.variant_id = pv.id
    ) ss ON true
    LEFT LATERAL (
      SELECT jsonb_agg(
        jsonb_build_object(
          'attribute_key', pa.attribute_key,
          'value_text', pa.value_text,
          'value_number', pa.value_number,
          'value_boolean', pa.value_boolean,
          'value_date', pa.value_date,
          'value_json', pa.value_json,
          'context_scope', pa.context_scope,
          'locale', pa.locale
        )
      ) as attributes
      FROM product_attributes pa
      WHERE pa.variant_id = pv.id
        AND (pa.context_scope = p_context OR pa.context_scope = 'warehouse')
    ) va ON true
    WHERE pv.product_id = p.id AND pv.deleted_at IS NULL
  ) variants ON true
  LEFT LATERAL (
    SELECT jsonb_agg(
      jsonb_build_object(
        'attribute_key', pa.attribute_key,
        'value_text', pa.value_text,
        'value_number', pa.value_number,
        'value_boolean', pa.value_boolean,
        'value_date', pa.value_date,
        'value_json', pa.value_json,
        'context_scope', pa.context_scope,
        'locale', pa.locale
      )
    ) as attributes
    FROM product_attributes pa
    WHERE pa.product_id = p.id AND pa.variant_id IS NULL
      AND (pa.context_scope = p_context OR pa.context_scope = 'warehouse')
  ) attributes ON true
  LEFT LATERAL (
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', pi.id,
        'storage_path', pi.storage_path,
        'file_name', pi.file_name,
        'alt_text', pi.alt_text,
        'display_order', pi.display_order,
        'context_scope', pi.context_scope,
        'is_primary', pi.is_primary,
        'metadata', pi.metadata
      ) ORDER BY pi.display_order
    ) as images
    FROM product_images pi
    WHERE pi.product_id = p.id
      AND (pi.context_scope = p_context OR pi.context_scope = 'warehouse')
  ) images ON true
  WHERE p.id = p_product_id AND p.deleted_at IS NULL;

  RETURN result;
END;
$$;

-- Function to search products with context and template filtering
CREATE OR REPLACE FUNCTION search_products(
  p_organization_id UUID,
  p_branch_id UUID DEFAULT NULL,
  p_search_text TEXT DEFAULT NULL,
  p_template_ids UUID[] DEFAULT NULL,
  p_context TEXT DEFAULT 'warehouse',
  p_has_stock BOOLEAN DEFAULT NULL,
  p_status TEXT[] DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
  total_count INTEGER;
BEGIN
  -- Build the main query with filters
  WITH filtered_products AS (
    SELECT DISTINCT p.id
    FROM products p
    LEFT JOIN product_templates pt ON p.template_id = pt.id
    LEFT JOIN product_variants pv ON p.id = pv.product_id AND pv.deleted_at IS NULL
    LEFT JOIN stock_snapshots ss ON p.id = ss.product_id AND pv.id = ss.variant_id
    LEFT JOIN locations l ON ss.location_id = l.id
    WHERE p.organization_id = p_organization_id
      AND p.deleted_at IS NULL
      AND (p_branch_id IS NULL OR l.branch_id = p_branch_id)
      AND (p_search_text IS NULL OR (
        p.name ILIKE '%' || p_search_text || '%' OR
        p.description ILIKE '%' || p_search_text || '%' OR
        pv.sku ILIKE '%' || p_search_text || '%' OR
        pv.name ILIKE '%' || p_search_text || '%'
      ))
      AND (p_template_ids IS NULL OR p.template_id = ANY(p_template_ids))
      AND (p_status IS NULL OR p.status = ANY(p_status))
      AND (p_has_stock IS NULL OR (
        (p_has_stock = true AND ss.quantity_available > 0) OR
        (p_has_stock = false AND (ss.quantity_available IS NULL OR ss.quantity_available = 0))
      ))
  )
  SELECT
    jsonb_build_object(
      'products', jsonb_agg(product_data ORDER BY product_data->>'name'),
      'total_count', COUNT(*) OVER()
    ) INTO result
  FROM (
    SELECT get_product_with_contexts(fp.id, p_context) as product_data
    FROM filtered_products fp
    ORDER BY (get_product_with_contexts(fp.id, p_context)->>'name')
    LIMIT p_limit OFFSET p_offset
  ) products_with_data;

  RETURN COALESCE(result, jsonb_build_object('products', '[]'::jsonb, 'total_count', 0));
END;
$$;

-- Function to create product with context-aware attributes
CREATE OR REPLACE FUNCTION create_product_with_attributes(
  p_organization_id UUID,
  p_template_id UUID,
  p_name TEXT,
  p_description TEXT DEFAULT NULL,
  p_status TEXT DEFAULT 'active',
  p_variant_data JSONB DEFAULT '{}',
  p_attributes JSONB DEFAULT '{}',
  p_images JSONB DEFAULT '[]'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_product_id UUID;
  new_variant_id UUID;
  attr_key TEXT;
  attr_value JSONB;
  image_data JSONB;
BEGIN
  -- Check permissions
  IF NOT EXISTS (
    SELECT 1 FROM user_role_assignments
    WHERE user_id = auth.uid()
      AND organization_id = p_organization_id
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Access denied to create product in this organization';
  END IF;

  -- Create the main product
  INSERT INTO products (
    organization_id, template_id, name, slug, description, status, created_by
  ) VALUES (
    p_organization_id, p_template_id, p_name,
    lower(regexp_replace(p_name, '[^a-zA-Z0-9]+', '-', 'g')),
    p_description, p_status, auth.uid()
  ) RETURNING id INTO new_product_id;

  -- Create default variant
  INSERT INTO product_variants (
    product_id, name, slug, sku, barcode, is_default, status
  ) VALUES (
    new_product_id,
    COALESCE(p_variant_data->>'name', p_name),
    lower(regexp_replace(COALESCE(p_variant_data->>'name', p_name), '[^a-zA-Z0-9]+', '-', 'g')),
    p_variant_data->>'sku',
    p_variant_data->>'barcode',
    true,
    'active'
  ) RETURNING id INTO new_variant_id;

  -- Insert product-level attributes
  FOR attr_key, attr_value IN SELECT * FROM jsonb_each(p_attributes)
  LOOP
    INSERT INTO product_attributes (
      product_id, attribute_key,
      value_text, value_number, value_boolean, value_date, value_json,
      context_scope, locale
    ) VALUES (
      new_product_id, attr_key,
      CASE WHEN attr_value->>'type' = 'text' THEN attr_value->>'value' END,
      CASE WHEN attr_value->>'type' = 'number' THEN (attr_value->>'value')::numeric END,
      CASE WHEN attr_value->>'type' = 'boolean' THEN (attr_value->>'value')::boolean END,
      CASE WHEN attr_value->>'type' = 'date' THEN (attr_value->>'value')::date END,
      CASE WHEN attr_value->>'type' = 'json' THEN attr_value->'value' END,
      COALESCE(attr_value->>'context', 'warehouse'),
      COALESCE(attr_value->>'locale', 'en')
    );
  END LOOP;

  -- Insert images if provided
  FOR image_data IN SELECT jsonb_array_elements(p_images)
  LOOP
    INSERT INTO product_images (
      product_id, variant_id, storage_path, file_name, alt_text,
      context_scope, is_primary, display_order, metadata
    ) VALUES (
      new_product_id,
      CASE WHEN (image_data->>'variant_level')::boolean THEN new_variant_id END,
      image_data->>'storage_path',
      image_data->>'file_name',
      image_data->>'alt_text',
      COALESCE(image_data->>'context_scope', 'warehouse'),
      COALESCE((image_data->>'is_primary')::boolean, false),
      COALESCE((image_data->>'display_order')::integer, 0),
      COALESCE(image_data->'metadata', '{}'::jsonb)
    );
  END LOOP;

  RETURN new_product_id;
END;
$$;

-- Function to update product attributes by context
CREATE OR REPLACE FUNCTION update_product_attributes(
  p_product_id UUID,
  p_context TEXT,
  p_attributes JSONB,
  p_locale TEXT DEFAULT 'en'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  product_org_id UUID;
  attr_key TEXT;
  attr_value JSONB;
BEGIN
  -- Get product organization and check permissions
  SELECT organization_id INTO product_org_id
  FROM products
  WHERE id = p_product_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM user_role_assignments
    WHERE user_id = auth.uid()
      AND organization_id = product_org_id
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Access denied to update this product';
  END IF;

  -- Delete existing attributes for this context
  DELETE FROM product_attributes
  WHERE product_id = p_product_id
    AND context_scope = p_context
    AND locale = p_locale
    AND variant_id IS NULL;

  -- Insert new attributes
  FOR attr_key, attr_value IN SELECT * FROM jsonb_each(p_attributes)
  LOOP
    INSERT INTO product_attributes (
      product_id, attribute_key,
      value_text, value_number, value_boolean, value_date, value_json,
      context_scope, locale, updated_at
    ) VALUES (
      p_product_id, attr_key,
      CASE WHEN attr_value->>'type' = 'text' THEN attr_value->>'value' END,
      CASE WHEN attr_value->>'type' = 'number' THEN (attr_value->>'value')::numeric END,
      CASE WHEN attr_value->>'type' = 'boolean' THEN (attr_value->>'value')::boolean END,
      CASE WHEN attr_value->>'type' = 'date' THEN (attr_value->>'value')::date END,
      CASE WHEN attr_value->>'type' = 'json' THEN attr_value->'value' END,
      p_context, p_locale, timezone('utc', now())
    );
  END LOOP;

  -- Update product updated_at
  UPDATE products SET updated_at = timezone('utc', now()) WHERE id = p_product_id;

  RETURN TRUE;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_product_with_contexts(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION search_products(UUID, UUID, TEXT, UUID[], TEXT, BOOLEAN, TEXT[], INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION create_product_with_attributes(UUID, UUID, TEXT, TEXT, TEXT, JSONB, JSONB, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION update_product_attributes(UUID, TEXT, JSONB, TEXT) TO authenticated;

-- Add missing indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_org_template ON products(organization_id, template_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_product_variants_product_status ON product_variants(product_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_product_attributes_context_key ON product_attributes(context_scope, attribute_key);
CREATE INDEX IF NOT EXISTS idx_product_attributes_product_context ON product_attributes(product_id, context_scope);
CREATE INDEX IF NOT EXISTS idx_product_images_context_primary ON product_images(product_id, context_scope, is_primary);
CREATE INDEX IF NOT EXISTS idx_stock_snapshots_branch_location ON stock_snapshots(branch_id, location_id);