-- =============================================
-- Simplified Products System Migration
-- Removes overcomplicated EAV/template system
-- Implements InFlow/Zoho-style product management
-- =============================================

-- ============================================
-- STEP 1: DROP OLD PRODUCT SYSTEM
-- ============================================

-- Drop old product-related tables (keep stock_movements, stock_snapshots, etc.)
DROP TABLE IF EXISTS product_attributes CASCADE;
DROP TABLE IF EXISTS product_images CASCADE;
DROP TABLE IF EXISTS template_attribute_definitions CASCADE;
DROP TABLE IF EXISTS product_templates CASCADE;
DROP TABLE IF EXISTS product_variants CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS product_types CASCADE;

-- ============================================
-- STEP 2: CREATE SIMPLIFIED PRODUCT TABLES
-- ============================================

-- Product Categories (keep this for classification)
CREATE TABLE IF NOT EXISTS product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES product_categories(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  UNIQUE(organization_id, name, parent_id)
);

-- Variant Option Groups (organization-wide, reusable)
CREATE TABLE IF NOT EXISTS variant_option_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  UNIQUE(organization_id, name) WHERE deleted_at IS NULL
);

-- Variant Option Values (belongs to option groups)
CREATE TABLE IF NOT EXISTS variant_option_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  option_group_id UUID NOT NULL REFERENCES variant_option_groups(id) ON DELETE CASCADE,
  value TEXT NOT NULL,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  UNIQUE(option_group_id, value) WHERE deleted_at IS NULL
);

-- Main Products Table (individual products OR item groups)
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Product Type
  product_type VARCHAR(20) NOT NULL CHECK (product_type IN ('goods', 'service', 'item_group')),

  -- Basic Info
  name TEXT NOT NULL,
  sku VARCHAR(100), -- Required for goods/service, NULL for item_group
  description TEXT,

  -- Classification
  category_id UUID REFERENCES product_categories(id) ON DELETE SET NULL,
  brand VARCHAR(100),
  manufacturer VARCHAR(100),

  -- Unit of Measure
  unit VARCHAR(50) DEFAULT 'pcs',

  -- Item Properties
  returnable_item BOOLEAN DEFAULT true,

  -- Measurements (optional)
  dimensions_length NUMERIC,
  dimensions_width NUMERIC,
  dimensions_height NUMERIC,
  dimensions_unit VARCHAR(10) DEFAULT 'cm',
  weight NUMERIC,
  weight_unit VARCHAR(10) DEFAULT 'kg',

  -- Identifiers
  upc VARCHAR(20),
  ean VARCHAR(20),
  isbn VARCHAR(20),
  mpn VARCHAR(100), -- Manufacturer Part Number

  -- Sales Information
  selling_price NUMERIC DEFAULT 0,
  sales_account VARCHAR(100),
  sales_description TEXT,

  -- Purchase Information
  cost_price NUMERIC DEFAULT 0,
  purchase_account VARCHAR(100),
  purchase_description TEXT,
  preferred_vendor_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,

  -- Inventory Settings
  track_inventory BOOLEAN DEFAULT true,
  inventory_account VARCHAR(100),
  reorder_point NUMERIC DEFAULT 0, -- 0 or NULL = disabled
  opening_stock NUMERIC DEFAULT 0,
  opening_stock_rate NUMERIC,

  -- Status
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),

  -- Timestamps
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  -- Constraints
  UNIQUE(organization_id, sku) WHERE sku IS NOT NULL AND deleted_at IS NULL,
  CHECK (
    (product_type IN ('goods', 'service') AND sku IS NOT NULL) OR
    (product_type = 'item_group' AND sku IS NULL)
  )
);

-- Product Barcodes (multi-barcode support like InFlow)
CREATE TABLE product_barcodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
  barcode VARCHAR(100) NOT NULL,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(barcode),
  CHECK (
    (product_id IS NOT NULL AND variant_id IS NULL) OR
    (product_id IS NULL AND variant_id IS NOT NULL)
  )
);

-- Product Custom Field Definitions (organization-wide)
CREATE TABLE product_custom_field_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  field_type VARCHAR(20) NOT NULL CHECK (field_type IN ('text', 'number', 'date', 'dropdown', 'checkbox')),
  dropdown_options JSONB, -- For dropdown type: ["Option 1", "Option 2"]
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  UNIQUE(organization_id, field_name) WHERE deleted_at IS NULL
);

-- Product Custom Field Values (per product/variant)
CREATE TABLE product_custom_field_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
  field_definition_id UUID NOT NULL REFERENCES product_custom_field_definitions(id) ON DELETE CASCADE,
  value_text TEXT,
  value_number NUMERIC,
  value_date DATE,
  value_boolean BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(product_id, field_definition_id) WHERE product_id IS NOT NULL,
  UNIQUE(variant_id, field_definition_id) WHERE variant_id IS NOT NULL,
  CHECK (
    (product_id IS NOT NULL AND variant_id IS NULL) OR
    (product_id IS NULL AND variant_id IS NOT NULL)
  )
);

-- Product Variants (only for item_group products)
CREATE TABLE product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,

  -- Generated Info
  name TEXT NOT NULL, -- e.g., "Red - Large"
  sku VARCHAR(100) NOT NULL,

  -- Override prices (optional, inherits from parent if null)
  selling_price NUMERIC,
  cost_price NUMERIC,
  reorder_point NUMERIC,

  -- Identifiers
  upc VARCHAR(20),
  ean VARCHAR(20),
  isbn VARCHAR(20),

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  UNIQUE(sku) WHERE deleted_at IS NULL,
  UNIQUE(product_id, name) WHERE deleted_at IS NULL
);

-- Product Group Configuration (which variant options are used)
CREATE TABLE product_group_attributes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  option_group_id UUID NOT NULL REFERENCES variant_option_groups(id) ON DELETE CASCADE,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(product_id, option_group_id)
);

-- Variant Attribute Values (link variants to their option values)
CREATE TABLE variant_attribute_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  option_group_id UUID NOT NULL REFERENCES variant_option_groups(id) ON DELETE CASCADE,
  option_value_id UUID NOT NULL REFERENCES variant_option_values(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(variant_id, option_group_id)
);

-- Product Images
CREATE TABLE product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  alt_text TEXT,
  display_order INT DEFAULT 0,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CHECK (
    (product_id IS NOT NULL AND variant_id IS NULL) OR
    (product_id IS NULL AND variant_id IS NOT NULL)
  )
);

-- ============================================
-- STEP 3: CREATE INDEXES
-- ============================================

-- Product indexes
CREATE INDEX idx_products_org ON products(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_type ON products(product_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_category ON products(category_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_sku ON products(sku) WHERE sku IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_products_status ON products(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_vendor ON products(preferred_vendor_id) WHERE preferred_vendor_id IS NOT NULL;

-- Barcode indexes
CREATE INDEX idx_product_barcodes_product ON product_barcodes(product_id);
CREATE INDEX idx_product_barcodes_variant ON product_barcodes(variant_id);
CREATE INDEX idx_product_barcodes_barcode ON product_barcodes(barcode);

-- Custom field indexes
CREATE INDEX idx_custom_field_defs_org ON product_custom_field_definitions(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_custom_field_values_product ON product_custom_field_values(product_id);
CREATE INDEX idx_custom_field_values_variant ON product_custom_field_values(variant_id);

-- Variant indexes
CREATE INDEX idx_product_variants_product ON product_variants(product_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_product_variants_sku ON product_variants(sku) WHERE deleted_at IS NULL;
CREATE INDEX idx_product_variants_active ON product_variants(is_active) WHERE deleted_at IS NULL;

-- Variant option indexes
CREATE INDEX idx_variant_option_groups_org ON variant_option_groups(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_variant_option_values_group ON variant_option_values(option_group_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_product_group_attrs_product ON product_group_attributes(product_id);
CREATE INDEX idx_variant_attr_values_variant ON variant_attribute_values(variant_id);

-- Category indexes
CREATE INDEX idx_product_categories_org ON product_categories(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_product_categories_parent ON product_categories(parent_id) WHERE deleted_at IS NULL;

-- Image indexes
CREATE INDEX idx_product_images_product ON product_images(product_id);
CREATE INDEX idx_product_images_variant ON product_images(variant_id);

-- ============================================
-- STEP 4: RLS DISABLED (Will be enabled later)
-- ============================================
-- RLS will be configured separately after initial implementation

-- ============================================
-- STEP 5: CREATE TRIGGERS
-- ============================================

-- Trigger for updating updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_product_variants_updated_at
  BEFORE UPDATE ON product_variants
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_variant_option_groups_updated_at
  BEFORE UPDATE ON variant_option_groups
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_variant_option_values_updated_at
  BEFORE UPDATE ON variant_option_values
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_product_categories_updated_at
  BEFORE UPDATE ON product_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_custom_field_defs_updated_at
  BEFORE UPDATE ON product_custom_field_definitions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_custom_field_values_updated_at
  BEFORE UPDATE ON product_custom_field_values
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
