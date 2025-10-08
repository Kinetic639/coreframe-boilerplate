-- =============================================
-- Migration: Replace rigid product system with flexible EAV architecture
-- Implements Week 1 of the flexible product implementation plan
-- =============================================

-- Step 1: Drop existing product tables (with dependencies first)
DROP TABLE IF EXISTS product_inventory_summary CASCADE;
DROP TABLE IF EXISTS product_units CASCADE;
DROP TABLE IF EXISTS product_suppliers CASCADE;
DROP TABLE IF EXISTS product_stock_locations CASCADE;
DROP TABLE IF EXISTS product_ecommerce_data CASCADE;
DROP TABLE IF EXISTS product_inventory_data CASCADE;
DROP TABLE IF EXISTS product_variants CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS product_types CASCADE;

-- Step 2: Create flexible product foundation tables

-- Product Templates: Define schemas for different use cases
CREATE TABLE product_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  color TEXT DEFAULT '#6366f1',
  is_system BOOLEAN DEFAULT false, -- System templates can't be deleted
  parent_template_id UUID REFERENCES product_templates(id),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
  deleted_at TIMESTAMPTZ,

  UNIQUE(organization_id, slug)
);

-- Template Attribute Definitions: Define what attributes a template supports
CREATE TABLE template_attribute_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES product_templates(id) ON DELETE CASCADE,
  attribute_key TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  data_type TEXT NOT NULL CHECK (data_type IN ('text', 'number', 'boolean', 'date', 'json', 'select', 'multi_select')),
  validation_rules JSONB DEFAULT '{}',
  default_value JSONB,
  is_required BOOLEAN DEFAULT false,
  is_unique BOOLEAN DEFAULT false,
  is_searchable BOOLEAN DEFAULT true,
  context_scope TEXT[] DEFAULT ARRAY['warehouse'], -- warehouse, ecommerce, b2b, pos
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),

  UNIQUE(template_id, attribute_key)
);

-- Products: Core product entities using templates
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  template_id UUID NOT NULL REFERENCES product_templates(id),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
  deleted_at TIMESTAMPTZ,

  UNIQUE(organization_id, slug)
);

-- Product Variants: Every product has at least one variant
CREATE TABLE product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  sku TEXT,
  barcode TEXT,
  is_default BOOLEAN DEFAULT false,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'discontinued')),
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
  deleted_at TIMESTAMPTZ,

  UNIQUE(product_id, slug)
);

-- Product Attributes: EAV storage for flexible product data
CREATE TABLE product_attributes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
  attribute_key TEXT NOT NULL,
  value_text TEXT,
  value_number NUMERIC,
  value_boolean BOOLEAN,
  value_date DATE,
  value_json JSONB,
  context_scope TEXT NOT NULL DEFAULT 'warehouse',
  locale TEXT DEFAULT 'en',
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc', now()),

  -- Ensure only one value type is set
  CHECK (
    (value_text IS NOT NULL)::int +
    (value_number IS NOT NULL)::int +
    (value_boolean IS NOT NULL)::int +
    (value_date IS NOT NULL)::int +
    (value_json IS NOT NULL)::int = 1
  ),

  -- Unique constraint for attribute per product/variant/context/locale
  UNIQUE(product_id, variant_id, attribute_key, context_scope, locale)
);

-- Product Images: Flexible image storage
CREATE TABLE product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  alt_text TEXT,
  display_order INTEGER DEFAULT 0,
  context_scope TEXT NOT NULL DEFAULT 'warehouse',
  is_primary BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),

  UNIQUE(product_id, variant_id, context_scope, display_order)
);

-- Step 3: Create indexes for performance
CREATE INDEX idx_products_organization_template ON products(organization_id, template_id);
CREATE INDEX idx_products_status ON products(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_product_variants_product ON product_variants(product_id);
CREATE INDEX idx_product_variants_sku ON product_variants(sku) WHERE sku IS NOT NULL;
CREATE INDEX idx_product_variants_barcode ON product_variants(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX idx_product_attributes_product ON product_attributes(product_id);
CREATE INDEX idx_product_attributes_variant ON product_attributes(variant_id);
CREATE INDEX idx_product_attributes_key_context ON product_attributes(attribute_key, context_scope);
CREATE INDEX idx_product_attributes_text_search ON product_attributes USING gin(to_tsvector('english', value_text)) WHERE value_text IS NOT NULL;
CREATE INDEX idx_product_images_product_variant ON product_images(product_id, variant_id);

-- Step 4: Create system product templates
INSERT INTO product_templates (id, organization_id, name, slug, description, icon, color, is_system, metadata)
VALUES
  -- Get first organization for system templates
  (gen_random_uuid(), (SELECT id FROM organizations LIMIT 1), 'Basic Product', 'basic-product', 'Simple product template for general inventory', 'Package', '#6366f1', true, '{"contexts": ["warehouse"]}'),
  (gen_random_uuid(), (SELECT id FROM organizations LIMIT 1), 'Retail Product', 'retail-product', 'Template for retail/ecommerce products', 'ShoppingCart', '#10b981', true, '{"contexts": ["warehouse", "ecommerce"]}'),
  (gen_random_uuid(), (SELECT id FROM organizations LIMIT 1), 'Service Item', 'service-item', 'Template for services and labor', 'Wrench', '#f59e0b', true, '{"contexts": ["warehouse", "b2b"]}'),
  (gen_random_uuid(), (SELECT id FROM organizations LIMIT 1), 'Raw Material', 'raw-material', 'Template for manufacturing materials', 'Package2', '#8b5cf6', true, '{"contexts": ["warehouse", "b2b"]}');

-- Step 5: Create basic attribute definitions for system templates
INSERT INTO template_attribute_definitions (template_id, attribute_key, display_name, description, data_type, context_scope, is_required, display_order)
SELECT
  pt.id,
  attr.key,
  attr.display_name,
  attr.description,
  attr.data_type,
  attr.context_scope,
  attr.is_required,
  attr.display_order
FROM product_templates pt
CROSS JOIN (VALUES
  -- Common attributes for all templates
  ('purchase_price', 'Purchase Price', 'Cost price from supplier', 'number', ARRAY['warehouse'], false, 10),
  ('sell_price', 'Selling Price', 'Price for selling to customers', 'number', ARRAY['warehouse', 'ecommerce'], false, 11),
  ('currency', 'Currency', 'Currency code for pricing', 'text', ARRAY['warehouse', 'ecommerce'], false, 12),
  ('weight', 'Weight', 'Product weight in grams', 'number', ARRAY['warehouse', 'ecommerce'], false, 20),
  ('dimensions', 'Dimensions', 'Product dimensions (L x W x H)', 'json', ARRAY['warehouse', 'ecommerce'], false, 21),
  ('manufacturer', 'Manufacturer', 'Product manufacturer', 'text', ARRAY['warehouse', 'ecommerce'], false, 30),
  ('brand', 'Brand', 'Product brand', 'text', ARRAY['warehouse', 'ecommerce'], false, 31),
  ('category', 'Category', 'Product category', 'text', ARRAY['warehouse', 'ecommerce'], false, 40),
  ('tags', 'Tags', 'Search and filter tags', 'json', ARRAY['warehouse', 'ecommerce'], false, 41),

  -- Warehouse specific
  ('min_stock_level', 'Minimum Stock', 'Minimum stock level for alerts', 'number', ARRAY['warehouse'], false, 50),
  ('max_stock_level', 'Maximum Stock', 'Maximum stock level', 'number', ARRAY['warehouse'], false, 51),
  ('storage_conditions', 'Storage Conditions', 'Special storage requirements', 'text', ARRAY['warehouse'], false, 52),

  -- Ecommerce specific
  ('seo_title', 'SEO Title', 'SEO optimized title', 'text', ARRAY['ecommerce'], false, 60),
  ('seo_description', 'SEO Description', 'SEO meta description', 'text', ARRAY['ecommerce'], false, 61),
  ('is_published', 'Published', 'Visible in online store', 'boolean', ARRAY['ecommerce'], false, 62),
  ('featured', 'Featured Product', 'Show as featured product', 'boolean', ARRAY['ecommerce'], false, 63)
) AS attr(key, display_name, description, data_type, context_scope, is_required, display_order)
WHERE pt.is_system = true;

-- Step 6: Create helper functions
CREATE OR REPLACE FUNCTION get_product_attribute_value(
  p_product_id UUID,
  p_attribute_key TEXT,
  p_variant_id UUID DEFAULT NULL,
  p_context_scope TEXT DEFAULT 'warehouse',
  p_locale TEXT DEFAULT 'en'
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT
    CASE
      WHEN value_text IS NOT NULL THEN to_jsonb(value_text)
      WHEN value_number IS NOT NULL THEN to_jsonb(value_number)
      WHEN value_boolean IS NOT NULL THEN to_jsonb(value_boolean)
      WHEN value_date IS NOT NULL THEN to_jsonb(value_date)
      WHEN value_json IS NOT NULL THEN value_json
      ELSE NULL
    END INTO result
  FROM product_attributes
  WHERE product_id = p_product_id
    AND (variant_id = p_variant_id OR (variant_id IS NULL AND p_variant_id IS NULL))
    AND attribute_key = p_attribute_key
    AND context_scope = p_context_scope
    AND locale = p_locale
  ORDER BY updated_at DESC
  LIMIT 1;

  RETURN result;
END;
$$;

-- Step 7: Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_product_templates_updated_at BEFORE UPDATE ON product_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_product_variants_updated_at BEFORE UPDATE ON product_variants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_product_attributes_updated_at BEFORE UPDATE ON product_attributes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();