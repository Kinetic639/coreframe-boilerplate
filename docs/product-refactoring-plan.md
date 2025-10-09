# Product System Refactoring Plan

**Date**: January 2025
**Status**: Planning
**Goal**: Simplify products to support Individual Products and Product Groups with Variants (Zoho/InFlow pattern)

---

## Executive Summary

Refactor the overcomplicated product system to use industry-standard patterns from Zoho Inventory, InFlow Inventory, and Odoo Inventory. The new system will support:

1. **Individual Products** - Simple products without variations
2. **Product Groups** - Products with variants generated from attribute combinations
3. **Organization-wide Variant Options** - Reusable attributes (Color, Size, etc.)
4. **Units of Measure** - Weight, length, volume, quantity
5. **Context Support** - Warehouse, ecommerce, b2b, pos data (for future multi-channel)

---

## Current Problems

❌ **Overcomplicated**: Every product requires at least one variant, even simple products
❌ **EAV Pattern**: Complex attribute system with poor query performance
❌ **Template-heavy**: Unnecessary abstraction layer
❌ **Poor UX**: Confusing for users coming from other inventory systems

---

## New Architecture

### Core Concepts

**Two Product Types:**

- **Individual Product**: Single SKU, no variants (e.g., "Office Chair")
- **Product Group**: Parent product with multiple variants (e.g., "T-Shirt" with colors and sizes)

**Variant Generation:**

- User selects attributes (Color, Size)
- System generates all combinations automatically
- Each variant gets unique SKU based on configurable pattern

**Global Variant Options:**

- Created once at organization level
- Reused across all products
- Examples: Color (Red, Blue, Green), Size (S, M, L, XL)

**Context-Based Data:**

- Same product can have different data per context
- Warehouse: cost price, supplier, bin location
- Ecommerce: retail price, SEO, images
- B2B: wholesale price, MOQ, terms

---

## Phase 1: Database Schema (Day 1-2)

### 1.1 Organization Settings Tables

```sql
-- Units of measure (organization-wide with i18n support)
CREATE TABLE units_of_measure (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),  -- NULL = system preset

  -- Internationalized name: {"en": "Kilogram", "pl": "Kilogram"}
  name JSONB NOT NULL,

  unit_type VARCHAR(30) NOT NULL,  -- "weight", "length", "volume", "quantity"
  is_base_unit BOOLEAN DEFAULT false,
  conversion_factor NUMERIC,

  -- Internationalized abbreviation: {"en": "kg", "pl": "kg"}
  abbreviation JSONB,

  -- System presets cannot be deleted
  is_system BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  -- System units have NULL org_id, custom units must have org_id
  CHECK (
    (is_system = true AND organization_id IS NULL) OR
    (is_system = false AND organization_id IS NOT NULL)
  )
);

-- Create index on organization_id and system units
CREATE INDEX idx_units_of_measure_org ON units_of_measure(organization_id);
CREATE INDEX idx_units_of_measure_system ON units_of_measure(is_system) WHERE is_system = true;

-- Global variant options (reusable across products with i18n)
CREATE TABLE variant_option_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),  -- NULL = system preset

  -- Internationalized name: {"en": "Color", "pl": "Kolor"}
  name JSONB NOT NULL,

  display_order INT DEFAULT 0,

  -- System presets cannot be deleted
  is_system BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  -- System options have NULL org_id, custom options must have org_id
  CHECK (
    (is_system = true AND organization_id IS NULL) OR
    (is_system = false AND organization_id IS NOT NULL)
  )
);

CREATE TABLE variant_option_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  option_group_id UUID NOT NULL REFERENCES variant_option_groups(id) ON DELETE CASCADE,

  -- Internationalized value: {"en": "Red", "pl": "Czerwony"}
  value JSONB NOT NULL,

  display_order INT DEFAULT 0,

  -- System presets cannot be deleted
  is_system BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_variant_option_groups_org ON variant_option_groups(organization_id);
CREATE INDEX idx_variant_option_groups_system ON variant_option_groups(is_system) WHERE is_system = true;
CREATE INDEX idx_variant_option_values_group ON variant_option_values(option_group_id);
CREATE INDEX idx_variant_option_values_system ON variant_option_values(is_system) WHERE is_system = true;
```

### 1.2 Products Table

```sql
-- Main products table (supports both types)
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),

  -- Product type determines behavior
  product_type VARCHAR(20) NOT NULL CHECK (product_type IN ('individual', 'group')),

  -- Basic information
  name TEXT NOT NULL,
  description TEXT,
  category_id UUID REFERENCES product_categories(id),
  brand VARCHAR(100),

  -- For INDIVIDUAL products only (NULL for groups)
  sku VARCHAR(100),
  barcode VARCHAR(100),

  -- Unit of measure
  unit_of_measure_id UUID REFERENCES units_of_measure(id),

  -- Status
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),

  -- Timestamps
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  -- Constraints
  UNIQUE(organization_id, sku) WHERE sku IS NOT NULL,

  -- Business logic: individual products must have SKU
  CHECK (
    (product_type = 'individual' AND sku IS NOT NULL) OR
    (product_type = 'group' AND sku IS NULL)
  )
);
```

### 1.3 Product Groups Configuration

```sql
-- Which variant options are used for a product group
CREATE TABLE product_group_attributes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  option_group_id UUID NOT NULL REFERENCES variant_option_groups(id),
  display_order INT DEFAULT 0,

  UNIQUE(product_id, option_group_id)
);

-- SKU generation config (Zoho pattern)
CREATE TABLE product_group_sku_config (
  product_id UUID PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,

  separator VARCHAR(5) DEFAULT '-',  -- '-' or '/'
  case_style VARCHAR(10) DEFAULT 'upper',  -- 'upper' or 'lower'

  -- Pattern stored as JSONB
  -- Example: [
  --   {"type": "item_name", "chars": 3, "position": "first"},
  --   {"type": "attribute", "attribute_key": "color", "chars": 3},
  --   {"type": "attribute", "attribute_key": "size", "chars": "all"}
  -- ]
  pattern JSONB NOT NULL DEFAULT '[]',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 1.4 Product Variants

```sql
-- Variants (only for product groups)
CREATE TABLE product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,

  -- Generated identification
  name TEXT NOT NULL,  -- "Green T-Shirt - Size S"
  sku VARCHAR(100) NOT NULL,
  barcode VARCHAR(100),

  -- Optional identifiers
  upc VARCHAR(20),
  ean VARCHAR(20),
  isbn VARCHAR(20),

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  UNIQUE(sku),
  UNIQUE(product_id, name)
);

-- Link variants to their attribute values
CREATE TABLE variant_attribute_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  option_group_id UUID NOT NULL REFERENCES variant_option_groups(id),
  option_value_id UUID NOT NULL REFERENCES variant_option_values(id),

  UNIQUE(variant_id, option_group_id)
);
```

### 1.5 Context-Specific Data

```sql
-- Store context-specific data (warehouse, ecommerce, b2b, pos)
CREATE TABLE product_context_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Belongs to either product OR variant (not both)
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,

  context_name VARCHAR(50) NOT NULL,  -- 'warehouse', 'ecommerce', 'b2b', 'pos'

  -- Flexible JSONB for context-specific fields
  data JSONB NOT NULL DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- One context per product/variant
  UNIQUE(product_id, context_name) WHERE product_id IS NOT NULL,
  UNIQUE(variant_id, context_name) WHERE variant_id IS NOT NULL,

  -- Must belong to product OR variant, not both
  CHECK (
    (product_id IS NOT NULL AND variant_id IS NULL) OR
    (product_id IS NULL AND variant_id IS NOT NULL)
  )
);

-- Example warehouse context data:
-- {
--   "cost_price": 25.00,
--   "selling_price": 49.99,
--   "reorder_point": 10,
--   "supplier_id": "uuid",
--   "bin_location": "A-12",
--   "lead_time_days": 14
-- }

-- Example ecommerce context data:
-- {
--   "seo_title": "Premium T-Shirt...",
--   "retail_price": 34.99,
--   "sale_price": 29.99,
--   "weight_kg": 0.2,
--   "tags": ["clothing", "cotton"],
--   "featured": true
-- }

-- Example B2B context data:
-- {
--   "wholesale_price": 22.00,
--   "moq": 50,
--   "bulk_tiers": [
--     {"qty": 100, "price": 20},
--     {"qty": 500, "price": 18}
--   ],
--   "payment_terms": "Net 30"
-- }
```

### 1.6 Indexes & RLS

```sql
-- Performance indexes
CREATE INDEX idx_products_org_type ON products(organization_id, product_type);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_status ON products(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_sku ON products(sku) WHERE sku IS NOT NULL;

CREATE INDEX idx_product_variants_product ON product_variants(product_id);
CREATE INDEX idx_product_variants_sku ON product_variants(sku);
CREATE INDEX idx_product_variants_active ON product_variants(is_active) WHERE deleted_at IS NULL;

CREATE INDEX idx_variant_attribute_values_variant ON variant_attribute_values(variant_id);
CREATE INDEX idx_variant_attribute_values_option ON variant_attribute_values(option_value_id);

CREATE INDEX idx_product_context_data_product ON product_context_data(product_id) WHERE product_id IS NOT NULL;
CREATE INDEX idx_product_context_data_variant ON product_context_data(variant_id) WHERE variant_id IS NOT NULL;
CREATE INDEX idx_product_context_data_context ON product_context_data(context_name);

CREATE INDEX idx_variant_option_groups_org ON variant_option_groups(organization_id);
CREATE INDEX idx_variant_option_values_group ON variant_option_values(option_group_id);

-- Row Level Security
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_group_attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_group_sku_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE variant_option_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE variant_option_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_context_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE units_of_measure ENABLE ROW LEVEL SECURITY;
ALTER TABLE variant_attribute_values ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES: PRODUCTS
-- ============================================

CREATE POLICY "Users can view org products" ON products
  FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM user_memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "Users can insert org products" ON products
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM user_memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "Users can update org products" ON products
  FOR UPDATE TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM user_memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "Users can delete org products" ON products
  FOR DELETE TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM user_memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- ============================================
-- RLS POLICIES: PRODUCT VARIANTS
-- ============================================

CREATE POLICY "Users can view product variants" ON product_variants
  FOR SELECT TO authenticated
  USING (
    product_id IN (
      SELECT id FROM products WHERE organization_id IN (
        SELECT organization_id FROM user_memberships
        WHERE user_id = auth.uid() AND status = 'active'
      )
    )
  );

CREATE POLICY "Users can manage product variants" ON product_variants
  FOR ALL TO authenticated
  USING (
    product_id IN (
      SELECT id FROM products WHERE organization_id IN (
        SELECT organization_id FROM user_memberships
        WHERE user_id = auth.uid() AND status = 'active'
      )
    )
  );

-- ============================================
-- RLS POLICIES: VARIANT OPTIONS
-- ============================================

-- Users can view system options and their org's custom options
CREATE POLICY "Users can view variant options" ON variant_option_groups
  FOR SELECT TO authenticated
  USING (
    is_system = true OR
    organization_id IN (
      SELECT organization_id FROM user_memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Users can only create custom options for their org
CREATE POLICY "Users can create org variant options" ON variant_option_groups
  FOR INSERT TO authenticated
  WITH CHECK (
    is_system = false AND
    organization_id IN (
      SELECT organization_id FROM user_memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Users can only update their org's custom options (not system)
CREATE POLICY "Users can update org variant options" ON variant_option_groups
  FOR UPDATE TO authenticated
  USING (
    is_system = false AND
    organization_id IN (
      SELECT organization_id FROM user_memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Users can only delete their org's custom options (not system)
CREATE POLICY "Users can delete org variant options" ON variant_option_groups
  FOR DELETE TO authenticated
  USING (
    is_system = false AND
    organization_id IN (
      SELECT organization_id FROM user_memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Variant option values follow parent group permissions
CREATE POLICY "Users can view variant option values" ON variant_option_values
  FOR SELECT TO authenticated
  USING (
    option_group_id IN (
      SELECT id FROM variant_option_groups WHERE
      is_system = true OR
      organization_id IN (
        SELECT organization_id FROM user_memberships
        WHERE user_id = auth.uid() AND status = 'active'
      )
    )
  );

CREATE POLICY "Users can manage org variant option values" ON variant_option_values
  FOR ALL TO authenticated
  USING (
    option_group_id IN (
      SELECT id FROM variant_option_groups WHERE
      is_system = false AND
      organization_id IN (
        SELECT organization_id FROM user_memberships
        WHERE user_id = auth.uid() AND status = 'active'
      )
    )
  );

-- ============================================
-- RLS POLICIES: UNITS OF MEASURE
-- ============================================

-- Users can view system units and their org's custom units
CREATE POLICY "Users can view units of measure" ON units_of_measure
  FOR SELECT TO authenticated
  USING (
    is_system = true OR
    organization_id IN (
      SELECT organization_id FROM user_memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Users can only create custom units for their org
CREATE POLICY "Users can create org units" ON units_of_measure
  FOR INSERT TO authenticated
  WITH CHECK (
    is_system = false AND
    organization_id IN (
      SELECT organization_id FROM user_memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Users can only update/delete their org's custom units (not system)
CREATE POLICY "Users can update org units" ON units_of_measure
  FOR UPDATE TO authenticated
  USING (
    is_system = false AND
    organization_id IN (
      SELECT organization_id FROM user_memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "Users can delete org units" ON units_of_measure
  FOR DELETE TO authenticated
  USING (
    is_system = false AND
    organization_id IN (
      SELECT organization_id FROM user_memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- ============================================
-- RLS POLICIES: CONTEXT DATA
-- ============================================

CREATE POLICY "Users can view product context data" ON product_context_data
  FOR SELECT TO authenticated
  USING (
    (product_id IN (
      SELECT id FROM products WHERE organization_id IN (
        SELECT organization_id FROM user_memberships
        WHERE user_id = auth.uid() AND status = 'active'
      )
    )) OR
    (variant_id IN (
      SELECT pv.id FROM product_variants pv
      JOIN products p ON p.id = pv.product_id
      WHERE p.organization_id IN (
        SELECT organization_id FROM user_memberships
        WHERE user_id = auth.uid() AND status = 'active'
      )
    ))
  );

CREATE POLICY "Users can manage product context data" ON product_context_data
  FOR ALL TO authenticated
  USING (
    (product_id IN (
      SELECT id FROM products WHERE organization_id IN (
        SELECT organization_id FROM user_memberships
        WHERE user_id = auth.uid() AND status = 'active'
      )
    )) OR
    (variant_id IN (
      SELECT pv.id FROM product_variants pv
      JOIN products p ON p.id = pv.product_id
      WHERE p.organization_id IN (
        SELECT organization_id FROM user_memberships
        WHERE user_id = auth.uid() AND status = 'active'
      )
    ))
  );

-- ============================================
-- RLS POLICIES: HELPER TABLES
-- ============================================

CREATE POLICY "Users can view product group attributes" ON product_group_attributes
  FOR SELECT TO authenticated
  USING (
    product_id IN (
      SELECT id FROM products WHERE organization_id IN (
        SELECT organization_id FROM user_memberships
        WHERE user_id = auth.uid() AND status = 'active'
      )
    )
  );

CREATE POLICY "Users can manage product group attributes" ON product_group_attributes
  FOR ALL TO authenticated
  USING (
    product_id IN (
      SELECT id FROM products WHERE organization_id IN (
        SELECT organization_id FROM user_memberships
        WHERE user_id = auth.uid() AND status = 'active'
      )
    )
  );

CREATE POLICY "Users can view sku config" ON product_group_sku_config
  FOR SELECT TO authenticated
  USING (
    product_id IN (
      SELECT id FROM products WHERE organization_id IN (
        SELECT organization_id FROM user_memberships
        WHERE user_id = auth.uid() AND status = 'active'
      )
    )
  );

CREATE POLICY "Users can manage sku config" ON product_group_sku_config
  FOR ALL TO authenticated
  USING (
    product_id IN (
      SELECT id FROM products WHERE organization_id IN (
        SELECT organization_id FROM user_memberships
        WHERE user_id = auth.uid() AND status = 'active'
      )
    )
  );

CREATE POLICY "Users can view variant attribute values" ON variant_attribute_values
  FOR SELECT TO authenticated
  USING (
    variant_id IN (
      SELECT pv.id FROM product_variants pv
      JOIN products p ON p.id = pv.product_id
      WHERE p.organization_id IN (
        SELECT organization_id FROM user_memberships
        WHERE user_id = auth.uid() AND status = 'active'
      )
    )
  );

CREATE POLICY "Users can manage variant attribute values" ON variant_attribute_values
  FOR ALL TO authenticated
  USING (
    variant_id IN (
      SELECT pv.id FROM product_variants pv
      JOIN products p ON p.id = pv.product_id
      WHERE p.organization_id IN (
        SELECT organization_id FROM user_memberships
        WHERE user_id = auth.uid() AND status = 'active'
      )
    )
  );
```

### 1.7 Seed System Presets (i18n)

```sql
-- ============================================
-- SYSTEM UNITS OF MEASURE (i18n)
-- ============================================

INSERT INTO units_of_measure (name, unit_type, is_base_unit, abbreviation, is_system)
VALUES
  -- Quantity units
  (
    '{"en": "Piece", "pl": "Sztuka"}'::jsonb,
    'quantity',
    true,
    '{"en": "pcs", "pl": "szt"}'::jsonb,
    true
  ),
  (
    '{"en": "Dozen", "pl": "Tuzin"}'::jsonb,
    'quantity',
    false,
    '{"en": "dz", "pl": "tuz"}'::jsonb,
    true
  ),
  (
    '{"en": "Pack", "pl": "Opakowanie"}'::jsonb,
    'quantity',
    false,
    '{"en": "pk", "pl": "op"}'::jsonb,
    true
  ),

  -- Weight units
  (
    '{"en": "Kilogram", "pl": "Kilogram"}'::jsonb,
    'weight',
    true,
    '{"en": "kg", "pl": "kg"}'::jsonb,
    true
  ),
  (
    '{"en": "Gram", "pl": "Gram"}'::jsonb,
    'weight',
    false,
    '{"en": "g", "pl": "g"}'::jsonb,
    true
  ),
  (
    '{"en": "Milligram", "pl": "Miligram"}'::jsonb,
    'weight',
    false,
    '{"en": "mg", "pl": "mg"}'::jsonb,
    true
  ),
  (
    '{"en": "Pound", "pl": "Funt"}'::jsonb,
    'weight',
    false,
    '{"en": "lb", "pl": "lb"}'::jsonb,
    true
  ),
  (
    '{"en": "Ounce", "pl": "Uncja"}'::jsonb,
    'weight',
    false,
    '{"en": "oz", "pl": "oz"}'::jsonb,
    true
  ),
  (
    '{"en": "Ton", "pl": "Tona"}'::jsonb,
    'weight',
    false,
    '{"en": "t", "pl": "t"}'::jsonb,
    true
  ),

  -- Length units
  (
    '{"en": "Meter", "pl": "Metr"}'::jsonb,
    'length',
    true,
    '{"en": "m", "pl": "m"}'::jsonb,
    true
  ),
  (
    '{"en": "Centimeter", "pl": "Centymetr"}'::jsonb,
    'length',
    false,
    '{"en": "cm", "pl": "cm"}'::jsonb,
    true
  ),
  (
    '{"en": "Millimeter", "pl": "Milimetr"}'::jsonb,
    'length',
    false,
    '{"en": "mm", "pl": "mm"}'::jsonb,
    true
  ),
  (
    '{"en": "Kilometer", "pl": "Kilometr"}'::jsonb,
    'length',
    false,
    '{"en": "km", "pl": "km"}'::jsonb,
    true
  ),
  (
    '{"en": "Inch", "pl": "Cal"}'::jsonb,
    'length',
    false,
    '{"en": "in", "pl": "cal"}'::jsonb,
    true
  ),
  (
    '{"en": "Foot", "pl": "Stopa"}'::jsonb,
    'length',
    false,
    '{"en": "ft", "pl": "ft"}'::jsonb,
    true
  ),
  (
    '{"en": "Yard", "pl": "Jard"}'::jsonb,
    'length',
    false,
    '{"en": "yd", "pl": "yd"}'::jsonb,
    true
  ),

  -- Volume units
  (
    '{"en": "Liter", "pl": "Litr"}'::jsonb,
    'volume',
    true,
    '{"en": "L", "pl": "L"}'::jsonb,
    true
  ),
  (
    '{"en": "Milliliter", "pl": "Mililitr"}'::jsonb,
    'volume',
    false,
    '{"en": "mL", "pl": "mL"}'::jsonb,
    true
  ),
  (
    '{"en": "Cubic Meter", "pl": "Metr sześcienny"}'::jsonb,
    'volume',
    false,
    '{"en": "m³", "pl": "m³"}'::jsonb,
    true
  ),
  (
    '{"en": "Gallon", "pl": "Galon"}'::jsonb,
    'volume',
    false,
    '{"en": "gal", "pl": "gal"}'::jsonb,
    true
  ),
  (
    '{"en": "Fluid Ounce", "pl": "Uncja płynna"}'::jsonb,
    'volume',
    false,
    '{"en": "fl oz", "pl": "fl oz"}'::jsonb,
    true
  );

-- ============================================
-- SYSTEM VARIANT OPTION GROUPS (i18n)
-- ============================================

-- Insert system variant option groups
INSERT INTO variant_option_groups (name, display_order, is_system)
VALUES
  ('{"en": "Color", "pl": "Kolor"}'::jsonb, 1, true),
  ('{"en": "Size", "pl": "Rozmiar"}'::jsonb, 2, true),
  ('{"en": "Material", "pl": "Materiał"}'::jsonb, 3, true),
  ('{"en": "Style", "pl": "Styl"}'::jsonb, 4, true),
  ('{"en": "Finish", "pl": "Wykończenie"}'::jsonb, 5, true);

-- Insert system variant option values
DO $$
DECLARE
  color_group_id UUID;
  size_group_id UUID;
  material_group_id UUID;
  style_group_id UUID;
  finish_group_id UUID;
BEGIN
  -- Get group IDs
  SELECT id INTO color_group_id FROM variant_option_groups
    WHERE name->>'en' = 'Color' AND is_system = true;
  SELECT id INTO size_group_id FROM variant_option_groups
    WHERE name->>'en' = 'Size' AND is_system = true;
  SELECT id INTO material_group_id FROM variant_option_groups
    WHERE name->>'en' = 'Material' AND is_system = true;
  SELECT id INTO style_group_id FROM variant_option_groups
    WHERE name->>'en' = 'Style' AND is_system = true;
  SELECT id INTO finish_group_id FROM variant_option_groups
    WHERE name->>'en' = 'Finish' AND is_system = true;

  -- Color values
  INSERT INTO variant_option_values (option_group_id, value, display_order, is_system)
  VALUES
    (color_group_id, '{"en": "Red", "pl": "Czerwony"}'::jsonb, 1, true),
    (color_group_id, '{"en": "Blue", "pl": "Niebieski"}'::jsonb, 2, true),
    (color_group_id, '{"en": "Green", "pl": "Zielony"}'::jsonb, 3, true),
    (color_group_id, '{"en": "Yellow", "pl": "Żółty"}'::jsonb, 4, true),
    (color_group_id, '{"en": "Black", "pl": "Czarny"}'::jsonb, 5, true),
    (color_group_id, '{"en": "White", "pl": "Biały"}'::jsonb, 6, true),
    (color_group_id, '{"en": "Gray", "pl": "Szary"}'::jsonb, 7, true),
    (color_group_id, '{"en": "Orange", "pl": "Pomarańczowy"}'::jsonb, 8, true),
    (color_group_id, '{"en": "Purple", "pl": "Fioletowy"}'::jsonb, 9, true),
    (color_group_id, '{"en": "Pink", "pl": "Różowy"}'::jsonb, 10, true),
    (color_group_id, '{"en": "Brown", "pl": "Brązowy"}'::jsonb, 11, true),
    (color_group_id, '{"en": "Beige", "pl": "Beżowy"}'::jsonb, 12, true);

  -- Size values (clothing)
  INSERT INTO variant_option_values (option_group_id, value, display_order, is_system)
  VALUES
    (size_group_id, '{"en": "XS", "pl": "XS"}'::jsonb, 1, true),
    (size_group_id, '{"en": "S", "pl": "S"}'::jsonb, 2, true),
    (size_group_id, '{"en": "M", "pl": "M"}'::jsonb, 3, true),
    (size_group_id, '{"en": "L", "pl": "L"}'::jsonb, 4, true),
    (size_group_id, '{"en": "XL", "pl": "XL"}'::jsonb, 5, true),
    (size_group_id, '{"en": "XXL", "pl": "XXL"}'::jsonb, 6, true),
    (size_group_id, '{"en": "XXXL", "pl": "XXXL"}'::jsonb, 7, true);

  -- Material values
  INSERT INTO variant_option_values (option_group_id, value, display_order, is_system)
  VALUES
    (material_group_id, '{"en": "Cotton", "pl": "Bawełna"}'::jsonb, 1, true),
    (material_group_id, '{"en": "Polyester", "pl": "Poliester"}'::jsonb, 2, true),
    (material_group_id, '{"en": "Wool", "pl": "Wełna"}'::jsonb, 3, true),
    (material_group_id, '{"en": "Leather", "pl": "Skóra"}'::jsonb, 4, true),
    (material_group_id, '{"en": "Plastic", "pl": "Plastik"}'::jsonb, 5, true),
    (material_group_id, '{"en": "Metal", "pl": "Metal"}'::jsonb, 6, true),
    (material_group_id, '{"en": "Wood", "pl": "Drewno"}'::jsonb, 7, true),
    (material_group_id, '{"en": "Glass", "pl": "Szkło"}'::jsonb, 8, true),
    (material_group_id, '{"en": "Rubber", "pl": "Guma"}'::jsonb, 9, true);

  -- Style values
  INSERT INTO variant_option_values (option_group_id, value, display_order, is_system)
  VALUES
    (style_group_id, '{"en": "Classic", "pl": "Klasyczny"}'::jsonb, 1, true),
    (style_group_id, '{"en": "Modern", "pl": "Nowoczesny"}'::jsonb, 2, true),
    (style_group_id, '{"en": "Vintage", "pl": "Vintage"}'::jsonb, 3, true),
    (style_group_id, '{"en": "Casual", "pl": "Casualowy"}'::jsonb, 4, true),
    (style_group_id, '{"en": "Sport", "pl": "Sportowy"}'::jsonb, 5, true),
    (style_group_id, '{"en": "Elegant", "pl": "Elegancki"}'::jsonb, 6, true);

  -- Finish values
  INSERT INTO variant_option_values (option_group_id, value, display_order, is_system)
  VALUES
    (finish_group_id, '{"en": "Matte", "pl": "Matowy"}'::jsonb, 1, true),
    (finish_group_id, '{"en": "Glossy", "pl": "Błyszczący"}'::jsonb, 2, true),
    (finish_group_id, '{"en": "Satin", "pl": "Satynowy"}'::jsonb, 3, true),
    (finish_group_id, '{"en": "Textured", "pl": "Teksturowany"}'::jsonb, 4, true),
    (finish_group_id, '{"en": "Polished", "pl": "Polerowany"}'::jsonb, 5, true);

END $$;

-- ============================================
-- HELPER FUNCTION: Get localized value
-- ============================================

-- Function to extract localized value from JSONB based on user's locale
CREATE OR REPLACE FUNCTION get_localized_value(
  jsonb_value JSONB,
  locale VARCHAR DEFAULT 'en'
) RETURNS TEXT AS $$
BEGIN
  -- Try to get value in requested locale
  IF jsonb_value ? locale THEN
    RETURN jsonb_value->>locale;
  END IF;

  -- Fallback to English
  IF jsonb_value ? 'en' THEN
    RETURN jsonb_value->>'en';
  END IF;

  -- Fallback to first available language
  RETURN jsonb_value->>jsonb_object_keys(jsonb_value) LIMIT 1;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Usage example:
-- SELECT
--   get_localized_value(name, 'pl') as name_pl,
--   get_localized_value(abbreviation, 'pl') as abbr_pl
-- FROM units_of_measure;
```

### 1.8 Adding Support for More Languages

**How to add a new language (e.g., German):**

1. **Update existing system presets** with new translations:

```sql
-- Add German translations to existing units
UPDATE units_of_measure
SET name = name || '{"de": "Stück"}'::jsonb
WHERE name->>'en' = 'Piece' AND is_system = true;

UPDATE units_of_measure
SET name = name || '{"de": "Kilogramm"}'::jsonb
WHERE name->>'en' = 'Kilogram' AND is_system = true;

-- Add German translations to variant options
UPDATE variant_option_groups
SET name = name || '{"de": "Farbe"}'::jsonb
WHERE name->>'en' = 'Color' AND is_system = true;

UPDATE variant_option_values
SET value = value || '{"de": "Rot"}'::jsonb
WHERE value->>'en' = 'Red' AND is_system = true;
```

2. **Best Practice**: Create a migration for each new language support

3. **Translation Management**:
   - System presets should be translated by developers via migrations
   - Custom organization values can be single-language or multi-language based on needs
   - UI should detect user's locale from `next-intl` and pass to service methods

4. **Future Enhancement**: Admin UI to manage translations for system presets

---

## Phase 2: TypeScript Types & Services (Day 3-4)

### 2.1 TypeScript Types

**File**: `src/modules/warehouse/types/products-v2.ts`

```typescript
export type ProductType = "individual" | "group";

// ==========================================
// BASE TYPES (Database Schema)
// ==========================================

export interface Product {
  id: string;
  organization_id: string;
  product_type: ProductType;
  name: string;
  description?: string;
  category_id?: string;
  brand?: string;
  sku?: string; // Only for individual products
  barcode?: string;
  unit_of_measure_id?: string;
  status: "active" | "inactive" | "archived";
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

// Internationalized version (raw from DB)
export interface VariantOptionGroup {
  id: string;
  organization_id?: string; // NULL for system presets
  name: Record<string, string>; // {"en": "Color", "pl": "Kolor"}
  display_order: number;
  is_system: boolean;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  values?: VariantOptionValue[];
}

// Localized version (for UI display)
export interface LocalizedVariantOptionGroup extends Omit<VariantOptionGroup, "name"> {
  name: string; // Already localized (e.g., "Kolor")
  name_i18n: Record<string, string>; // Keep original for editing
  values?: LocalizedVariantOptionValue[];
}

export interface VariantOptionValue {
  id: string;
  option_group_id: string;
  value: Record<string, string>; // {"en": "Red", "pl": "Czerwony"}
  display_order: number;
  is_system: boolean;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface LocalizedVariantOptionValue extends Omit<VariantOptionValue, "value"> {
  value: string; // Already localized
  value_i18n: Record<string, string>; // Keep original for editing
}

export interface ProductVariant {
  id: string;
  product_id: string;
  name: string;
  sku: string;
  barcode?: string;
  upc?: string;
  ean?: string;
  isbn?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  attribute_values?: VariantAttributeValue[];
}

export interface VariantAttributeValue {
  option_group_id: string;
  option_value_id: string;
  option_group_name?: string;
  option_value?: string;
}

export interface SKUGenerationConfig {
  separator: "-" | "/";
  case_style: "upper" | "lower";
  pattern: SKUPatternPart[];
}

export interface SKUPatternPart {
  type: "item_name" | "attribute" | "custom_text" | "counter";
  attribute_key?: string;
  chars?: number | "all";
  position?: "first" | "last";
  custom_text?: string;
  counter_start?: number;
}

export interface ProductContextData {
  id: string;
  product_id?: string;
  variant_id?: string;
  context_name: "warehouse" | "ecommerce" | "b2b" | "pos";
  data: WarehouseContextData | EcommerceContextData | B2BContextData;
  created_at: string;
  updated_at: string;
}

export interface WarehouseContextData {
  cost_price?: number;
  selling_price?: number;
  reorder_point?: number;
  supplier_id?: string;
  bin_location?: string;
  lead_time_days?: number;
}

export interface EcommerceContextData {
  seo_title?: string;
  seo_description?: string;
  retail_price?: number;
  sale_price?: number;
  weight_kg?: number;
  shipping_class?: string;
  tags?: string[];
  featured?: boolean;
}

export interface B2BContextData {
  wholesale_price?: number;
  moq?: number;
  bulk_tiers?: Array<{ qty: number; price: number }>;
  payment_terms?: string;
  catalog_visibility?: "public" | "approved_only" | "private";
}

// Internationalized version (raw from DB)
export interface UnitOfMeasure {
  id: string;
  organization_id?: string; // NULL for system presets
  name: Record<string, string>; // {"en": "Kilogram", "pl": "Kilogram"}
  unit_type: "weight" | "length" | "volume" | "quantity";
  abbreviation?: Record<string, string>; // {"en": "kg", "pl": "kg"}
  is_base_unit: boolean;
  is_system: boolean;
  conversion_factor?: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

// Localized version (for UI display)
export interface LocalizedUnitOfMeasure extends Omit<UnitOfMeasure, "name" | "abbreviation"> {
  name: string; // Already localized
  name_i18n: Record<string, string>; // Keep original for editing
  abbreviation?: string; // Already localized
  abbreviation_i18n?: Record<string, string>; // Keep original for editing
}

export interface CreateIndividualProductRequest {
  name: string;
  description?: string;
  category_id?: string;
  brand?: string;
  sku: string;
  barcode?: string;
  unit_of_measure_id?: string;
  warehouse_data?: WarehouseContextData;
}

export interface CreateProductGroupRequest {
  name: string;
  description?: string;
  category_id?: string;
  brand?: string;
  unit_of_measure_id?: string;
  variant_options: string[]; // Array of option_group_ids
  sku_config?: SKUGenerationConfig;
  default_warehouse_data?: WarehouseContextData;
}

export interface GenerateVariantsRequest {
  product_id: string;
  sku_config: SKUGenerationConfig;
  default_data?: {
    cost_price?: number;
    selling_price?: number;
    reorder_point?: number;
  };
}

export interface VariantGridRow {
  variant_id?: string;
  name: string;
  sku: string;
  attribute_values: VariantAttributeValue[];
  cost_price?: number;
  selling_price?: number;
  reorder_point?: number;
  upc?: string;
  ean?: string;
  isbn?: string;
  is_active: boolean;
}
```

### 2.2 Product Service

**File**: `src/modules/warehouse/api/products-v2-service.ts`

```typescript
import { createClient } from "@/utils/supabase/client";
import type {
  Product,
  ProductVariant,
  CreateIndividualProductRequest,
  CreateProductGroupRequest,
  GenerateVariantsRequest,
  VariantGridRow,
  VariantOptionGroup,
} from "../types/products-v2";

export class ProductServiceV2 {
  private supabase = createClient();

  // ==========================================
  // INDIVIDUAL PRODUCTS
  // ==========================================

  async createIndividualProduct(data: CreateIndividualProductRequest): Promise<Product> {
    // 1. Create product
    const { data: product, error: productError } = await this.supabase
      .from("products")
      .insert({
        product_type: "individual",
        name: data.name,
        description: data.description,
        category_id: data.category_id,
        brand: data.brand,
        sku: data.sku,
        barcode: data.barcode,
        unit_of_measure_id: data.unit_of_measure_id,
        organization_id: await this.getActiveOrgId(),
      })
      .select()
      .single();

    if (productError) throw productError;

    // 2. Create warehouse context data
    if (data.warehouse_data) {
      await this.saveProductContextData(product.id, "warehouse", data.warehouse_data);
    }

    return product;
  }

  async getProducts(orgId: string, filters?: any): Promise<Product[]> {
    // Fetch and filter products
  }

  async getProductById(id: string): Promise<Product> {
    // Get product with context data
  }

  async updateIndividualProduct(
    id: string,
    data: Partial<CreateIndividualProductRequest>
  ): Promise<Product> {
    // Update product and context data
  }

  // ==========================================
  // PRODUCT GROUPS
  // ==========================================

  async createProductGroup(data: CreateProductGroupRequest): Promise<Product> {
    const orgId = await this.getActiveOrgId();

    // 1. Create product group
    const { data: product, error: productError } = await this.supabase
      .from("products")
      .insert({
        product_type: "group",
        name: data.name,
        description: data.description,
        category_id: data.category_id,
        brand: data.brand,
        unit_of_measure_id: data.unit_of_measure_id,
        organization_id: orgId,
      })
      .select()
      .single();

    if (productError) throw productError;

    // 2. Link variant option groups
    const attributeLinks = data.variant_options.map((optionGroupId, index) => ({
      product_id: product.id,
      option_group_id: optionGroupId,
      display_order: index,
    }));

    await this.supabase.from("product_group_attributes").insert(attributeLinks);

    // 3. Save SKU config if provided
    if (data.sku_config) {
      await this.saveSkuConfig(product.id, data.sku_config);
    }

    return product;
  }

  async generateVariants(request: GenerateVariantsRequest): Promise<VariantGridRow[]> {
    // 1. Get product and its attribute groups
    const { data: productAttrs } = await this.supabase
      .from("product_group_attributes")
      .select(
        `
        option_group_id,
        variant_option_groups(
          id,
          name,
          variant_option_values(id, value)
        )
      `
      )
      .eq("product_id", request.product_id)
      .order("display_order");

    // 2. Generate all combinations (Cartesian product)
    const combinations = this.generateCombinations(productAttrs);

    // 3. Generate SKU for each combination
    const variantRows: VariantGridRow[] = combinations.map((combo) => ({
      name: this.generateVariantName(productAttrs, combo),
      sku: this.generateSKU(request.sku_config, combo),
      attribute_values: combo,
      cost_price: request.default_data?.cost_price,
      selling_price: request.default_data?.selling_price,
      reorder_point: request.default_data?.reorder_point,
      is_active: true,
    }));

    return variantRows;
  }

  async saveVariants(productId: string, variants: VariantGridRow[]): Promise<void> {
    // 1. Create variants
    const variantInserts = variants.map((v) => ({
      product_id: productId,
      name: v.name,
      sku: v.sku,
      barcode: v.barcode,
      upc: v.upc,
      ean: v.ean,
      isbn: v.isbn,
      is_active: v.is_active,
    }));

    const { data: createdVariants, error } = await this.supabase
      .from("product_variants")
      .insert(variantInserts)
      .select();

    if (error) throw error;

    // 2. Link attribute values
    const attributeLinks = [];
    for (let i = 0; i < createdVariants.length; i++) {
      const variant = createdVariants[i];
      const attributeValues = variants[i].attribute_values;

      for (const attr of attributeValues) {
        attributeLinks.push({
          variant_id: variant.id,
          option_group_id: attr.option_group_id,
          option_value_id: attr.option_value_id,
        });
      }
    }

    await this.supabase.from("variant_attribute_values").insert(attributeLinks);

    // 3. Save warehouse context data
    const contextDataInserts = [];
    for (let i = 0; i < createdVariants.length; i++) {
      const variant = createdVariants[i];
      const row = variants[i];

      if (row.cost_price || row.selling_price || row.reorder_point) {
        contextDataInserts.push({
          variant_id: variant.id,
          context_name: "warehouse",
          data: {
            cost_price: row.cost_price,
            selling_price: row.selling_price,
            reorder_point: row.reorder_point,
          },
        });
      }
    }

    if (contextDataInserts.length > 0) {
      await this.supabase.from("product_context_data").insert(contextDataInserts);
    }
  }

  // ==========================================
  // VARIANT OPTIONS MANAGEMENT
  // ==========================================

  async getVariantOptionGroups(
    orgId: string,
    locale: string = "en"
  ): Promise<LocalizedVariantOptionGroup[]> {
    // Get both system and organization-specific options
    const { data, error } = await this.supabase
      .from("variant_option_groups")
      .select(
        `
        *,
        values:variant_option_values(*)
      `
      )
      .or(`is_system.eq.true,organization_id.eq.${orgId}`)
      .is("deleted_at", null)
      .order("display_order");

    if (error) throw error;

    // Localize the results
    return (data || []).map((group) => ({
      ...group,
      name: this.getLocalizedValue(group.name, locale),
      name_i18n: group.name,
      values: (group.values || []).map((v) => ({
        ...v,
        value: this.getLocalizedValue(v.value, locale),
        value_i18n: v.value,
      })),
    }));
  }

  async createVariantOptionGroup(
    orgId: string,
    name: string | Record<string, string>, // Can be simple string or i18n object
    values: Array<string | Record<string, string>>
  ): Promise<VariantOptionGroup> {
    // 1. Create group
    const groupName =
      typeof name === "string"
        ? { en: name } // Auto-create single language entry
        : name;

    const { data: group, error: groupError } = await this.supabase
      .from("variant_option_groups")
      .insert({
        organization_id: orgId,
        name: groupName,
        is_system: false,
      })
      .select()
      .single();

    if (groupError) throw groupError;

    // 2. Create values
    const valueInserts = values.map((value, index) => ({
      option_group_id: group.id,
      value: typeof value === "string" ? { en: value } : value,
      display_order: index,
      is_system: false,
    }));

    const { data: createdValues, error: valuesError } = await this.supabase
      .from("variant_option_values")
      .insert(valueInserts)
      .select();

    if (valuesError) throw valuesError;

    return {
      ...group,
      values: createdValues,
    };
  }

  async getUnitsOfMeasure(orgId: string, locale: string = "en"): Promise<LocalizedUnitOfMeasure[]> {
    // Get both system and organization-specific units
    const { data, error } = await this.supabase
      .from("units_of_measure")
      .select("*")
      .or(`is_system.eq.true,organization_id.eq.${orgId}`)
      .is("deleted_at", null)
      .order("unit_type")
      .order("name");

    if (error) throw error;

    // Localize the results
    return (data || []).map((unit) => ({
      ...unit,
      name: this.getLocalizedValue(unit.name, locale),
      name_i18n: unit.name,
      abbreviation: unit.abbreviation
        ? this.getLocalizedValue(unit.abbreviation, locale)
        : undefined,
      abbreviation_i18n: unit.abbreviation,
    }));
  }

  // Helper to extract localized value from JSONB
  private getLocalizedValue(jsonbValue: Record<string, string>, locale: string): string {
    // Try requested locale
    if (jsonbValue[locale]) {
      return jsonbValue[locale];
    }

    // Fallback to English
    if (jsonbValue["en"]) {
      return jsonbValue["en"];
    }

    // Fallback to first available language
    const firstKey = Object.keys(jsonbValue)[0];
    return jsonbValue[firstKey] || "";
  }

  // ==========================================
  // HELPER METHODS
  // ==========================================

  private generateCombinations(attributeGroups: any[]): VariantAttributeValue[][] {
    // Generate Cartesian product of all attribute values
    // Example: Color[Red,Blue] × Size[S,M] = 4 combinations
    if (attributeGroups.length === 0) return [[]];

    const [first, ...rest] = attributeGroups;
    const restCombinations = this.generateCombinations(rest);

    const combinations: VariantAttributeValue[][] = [];

    for (const value of first.variant_option_groups.variant_option_values) {
      for (const restCombo of restCombinations) {
        combinations.push([
          {
            option_group_id: first.option_group_id,
            option_value_id: value.id,
            option_value: value.value,
          },
          ...restCombo,
        ]);
      }
    }

    return combinations;
  }

  private generateSKU(config: SKUGenerationConfig, attributes: VariantAttributeValue[]): string {
    // Build SKU from pattern config
    // Example: "GRE-S" from pattern [item_name(3), color(3), size(all)]
    const parts: string[] = [];

    for (const part of config.pattern) {
      let value = "";

      if (part.type === "item_name") {
        // Get from product name (passed in context)
        value = this.extractChars("PRODUCT", part.chars, part.position);
      } else if (part.type === "attribute") {
        const attr = attributes.find((a) => a.option_group_name === part.attribute_key);
        if (attr) {
          value = this.extractChars(attr.option_value || "", part.chars, part.position);
        }
      } else if (part.type === "custom_text") {
        value = part.custom_text || "";
      }

      parts.push(value);
    }

    let sku = parts.join(config.separator);

    if (config.case_style === "upper") {
      sku = sku.toUpperCase();
    } else if (config.case_style === "lower") {
      sku = sku.toLowerCase();
    }

    return sku;
  }

  private extractChars(
    str: string,
    chars: number | "all" | undefined,
    position: "first" | "last" | undefined
  ): string {
    if (chars === "all" || !chars) return str;

    if (position === "first") {
      return str.substring(0, chars);
    } else if (position === "last") {
      return str.substring(str.length - chars);
    }

    return str;
  }

  private generateVariantName(groups: any[], attributes: VariantAttributeValue[]): string {
    // Generate human-readable name
    // Example: "T-Shirt - Red - Large"
    const attrNames = attributes.map((a) => a.option_value).join(" - ");
    return attrNames;
  }

  private async saveProductContextData(
    productId: string,
    context: string,
    data: any
  ): Promise<void> {
    await this.supabase.from("product_context_data").insert({
      product_id: productId,
      context_name: context,
      data,
    });
  }

  private async saveSkuConfig(productId: string, config: SKUGenerationConfig): Promise<void> {
    await this.supabase.from("product_group_sku_config").insert({
      product_id: productId,
      separator: config.separator,
      case_style: config.case_style,
      pattern: config.pattern,
    });
  }

  private async getActiveOrgId(): Promise<string> {
    // Get from app store or user context
    return "org-id-placeholder";
  }
}

export const productServiceV2 = new ProductServiceV2();
```

---

## Phase 3: UI Components (Day 5-7)

### 3.1 Settings: Variant Options Manager

**Route**: `/dashboard/warehouse/settings/variant-options`

**Components**:

- `VariantOptionsManager.tsx` - Main page
- `VariantOptionGroupCard.tsx` - Display each option group
- `AddVariantOptionDialog.tsx` - Create new option group
- `EditVariantOptionDialog.tsx` - Edit existing option

**Features**:

- List all variant option groups with values
- Add new option group (name + values)
- Edit option group (add/remove/reorder values)
- Delete option group (warn if used by products)
- Drag-and-drop reordering

### 3.2 Settings: Units of Measure

**Route**: `/dashboard/warehouse/settings/units`

**Components**:

- `UnitsOfMeasureManager.tsx`
- `AddUnitDialog.tsx`

**Features**:

- List units grouped by type (weight, length, volume, quantity)
- Add custom units with conversion factors
- Edit/delete custom units
- Mark base units

### 3.3 Product Type Selection

**Route**: `/dashboard/warehouse/products/new`

**Component**: `ProductTypeSelector.tsx`

Two cards: "Individual Product" and "Product Group"

### 3.4 Individual Product Form

**Route**: `/dashboard/warehouse/products/new/individual`

**Component**: `CreateIndividualProductForm.tsx`

**Sections**:

1. Basic Info (name, description, category, brand)
2. Identification (SKU, barcode, unit)
3. Warehouse Data (cost, selling price, reorder point, supplier, location)

### 3.5 Product Group Form (Multi-step Wizard)

**Route**: `/dashboard/warehouse/products/new/group`

**Component**: `CreateProductGroupWizard.tsx`

**Steps**:

**Step 1: Basic Information**

- Name, description, category, brand, unit

**Step 2: Select Variant Attributes**

- Checkbox list of available variant option groups
- Must select at least one

**Step 3: Generate & Configure Variants**

- SKU Configuration button → Opens SKU Generator Dialog
- Variant Grid (Zoho-style editable table)
- Columns: Name, SKU, Cost Price, Selling Price, UPC, EAN, ISBN, Reorder Point, Active
- "COPY TO ALL" buttons for bulk editing
- Individual cell editing

### 3.6 SKU Generator Dialog (Zoho Pattern)

**Component**: `SKUGeneratorDialog.tsx`

**Features**:

- Live preview of generated SKU
- Separator selection (Hyphen / Slash)
- Case selection (Upper / Lower)
- Pattern builder with drag-and-drop
- Pattern parts: Item Name, Attributes, Custom Text, Counter
- Configuration per part: Show First/Last N Letters or All

### 3.7 Variant Grid Component

**Component**: `VariantGrid.tsx`

**Features**:

- Editable table with all variant rows
- "COPY TO ALL" buttons for each column
- Individual cell editing
- Row selection
- Bulk delete selected rows
- Export to CSV

---

## Phase 4: Data Migration (Day 8)

### 4.1 Migration Strategy

1. **Keep old tables temporarily** (don't drop until verified)
2. **Create feature flag** to switch between v1 and v2
3. **Migrate products**:
   - Single-variant products → Individual products
   - Multi-variant products → Product groups
4. **Migrate attributes** → Context data (JSONB)
5. **Test thoroughly** before dropping old tables

### 4.2 Migration Script

```sql
CREATE OR REPLACE FUNCTION migrate_products_v1_to_v2()
RETURNS void AS $$
BEGIN
  -- Implementation details...
  -- 1. Migrate simple products
  -- 2. Migrate product groups
  -- 3. Migrate attributes to context data
  -- 4. Verify data integrity

  RAISE NOTICE 'Migration completed successfully';
END;
$$ LANGUAGE plpgsql;
```

---

## Phase 5: Testing & Documentation (Day 9-10)

### 5.1 Test Cases

**Settings:**

- ✅ Create variant option groups
- ✅ Add/edit/delete values
- ✅ Verify options appear in product creation

**Individual Products:**

- ✅ Create simple product
- ✅ Edit product
- ✅ Verify SKU uniqueness
- ✅ Test warehouse context data

**Product Groups:**

- ✅ Create group with 2+ attributes
- ✅ Generate variants (test Cartesian product)
- ✅ Edit variant grid
- ✅ Test SKU generation with different patterns
- ✅ Test "Copy to All" feature
- ✅ Save and verify in database

**SKU Generator:**

- ✅ Test different pattern combinations
- ✅ Verify preview updates in real-time
- ✅ Test upper/lower case
- ✅ Test hyphen vs slash separator

### 5.2 Documentation

- [ ] User guide for creating products
- [ ] Developer docs for services
- [ ] Database schema documentation
- [ ] API documentation
- [ ] Migration guide

---

## Success Criteria

At the end of this refactoring, you should be able to:

✅ Create variant option groups in settings (Color, Size, etc.)
✅ Create individual products with one SKU
✅ Create product groups with multiple variants
✅ Generate variants automatically from attribute combinations
✅ Configure SKU patterns (Zoho-style)
✅ Edit variants in grid with "Copy to All"
✅ Save products and see them in the products list
✅ Context data stored properly for future use

---

## Timeline

**Total: 10 days**

- **Phase 1** (Database Schema): 2 days
- **Phase 2** (Types & Services): 2 days
- **Phase 3** (UI Components): 3 days
- **Phase 4** (Migration): 1 day
- **Phase 5** (Testing & Docs): 2 days

---

## Next Steps After Completion

Once basic product creation is working:

1. Add stock management (locations, movements)
2. Add ecommerce context UI
3. Add B2B context UI
4. Add product images
5. Add product categories management
6. Add advanced filtering/search
7. Add bulk operations
8. Add import/export
9. Add product templates (optional, for advanced users)

---

## Key Benefits

✅ **Simpler**: No forced variants for simple products
✅ **Industry Standard**: Matches Zoho, InFlow, Odoo
✅ **Reusable Attributes**: Define once, use everywhere
✅ **Fast Creation**: Individual products = 1 step
✅ **Flexible**: Can still handle complex products
✅ **Better UX**: Users understand "simple vs. group"
✅ **Performance**: No EAV queries, direct table joins
✅ **Future-Proof**: Context support for multi-channel

---

## Notes

- Context feature kept for future ecommerce, B2B, POS integrations
- JSONB used for context data instead of EAV for better performance
- SKU generation pattern inspired by Zoho (best in class)
- Variant options reusable like InFlow (organization-wide)
- Grid editing with "Copy to All" like Zoho (great UX)
- Internationalization support using PostgreSQL JSONB
- System presets (units, variant options) support multiple languages
- RLS policies ensure proper data isolation and security

---

## Appendix A: UI/UX Wireframes & Flow

### Product Creation Flow

```
┌─────────────────────────────────────────────┐
│  Select Product Type                        │
│                                             │
│  ┌─────────────┐    ┌─────────────┐       │
│  │ Individual  │    │  Product    │       │
│  │  Product    │    │   Group     │       │
│  │             │    │             │       │
│  │  Simple     │    │  Multiple   │       │
│  │  single SKU │    │  variants   │       │
│  └─────────────┘    └─────────────┘       │
└─────────────────────────────────────────────┘
```

### Individual Product Form

```
┌─────────────────────────────────────────────┐
│  Create Individual Product                  │
├─────────────────────────────────────────────┤
│  Basic Information                          │
│  • Name: [________________]                 │
│  • Description: [___________]               │
│  • Category: [Dropdown▼]                    │
│  • Brand: [________________]                │
│                                             │
│  Identification                             │
│  • SKU: [________________] (Required)       │
│  • Barcode: [________________]              │
│  • Unit: [Dropdown▼]                        │
│                                             │
│  Warehouse Data                             │
│  • Cost Price: [______]                     │
│  • Selling Price: [______]                  │
│  • Reorder Point: [______]                  │
│  • Supplier: [Dropdown▼]                    │
│  • Bin Location: [________________]         │
│                                             │
│  [Cancel]  [Save Product]                   │
└─────────────────────────────────────────────┘
```

### Product Group Wizard - Step 1

```
┌─────────────────────────────────────────────┐
│  Create Product Group (Step 1 of 3)        │
├─────────────────────────────────────────────┤
│  Basic Information                          │
│                                             │
│  • Name: [________________]                 │
│  • Description: [___________]               │
│  • Category: [Dropdown▼]                    │
│  • Brand: [________________]                │
│  • Unit: [Dropdown▼]                        │
│                                             │
│                [Cancel]  [Next →]           │
└─────────────────────────────────────────────┘
```

### Product Group Wizard - Step 2

```
┌─────────────────────────────────────────────┐
│  Create Product Group (Step 2 of 3)        │
├─────────────────────────────────────────────┤
│  Select Variant Attributes                  │
│                                             │
│  Choose which attributes define variants:   │
│                                             │
│  ☑ Color (12 values)                        │
│  ☑ Size (7 values)                          │
│  ☐ Material (9 values)                      │
│  ☐ Style (6 values)                         │
│  ☐ Finish (5 values)                        │
│                                             │
│  + Create Custom Attribute                  │
│                                             │
│  Preview: 84 variants will be generated     │
│           (12 colors × 7 sizes)             │
│                                             │
│             [← Back]  [Next →]              │
└─────────────────────────────────────────────┘
```

### Product Group Wizard - Step 3

```
┌──────────────────────────────────────────────────────────────────┐
│  Create Product Group (Step 3 of 3)                              │
├──────────────────────────────────────────────────────────────────┤
│  Configure Variants                                              │
│                                                                  │
│  [⚙ Configure SKU Pattern]  [↓ Import CSV]  [🗑 Delete Selected] │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Variant Name       │ SKU     │ Cost │ Price │ Reorder │ ✓ │ │
│  ├────────────────────┼─────────┼──────┼───────┼─────────┼───┤ │
│  │ Red - S            │ RED-S   │ 10   │ 20    │ 5       │ ☑ │ │
│  │ Red - M            │ RED-M   │ 10   │ 20    │ 5       │ ☑ │ │
│  │ Red - L            │ RED-L   │ 10   │ 20    │ 5       │ ☑ │ │
│  │ ...                │ ...     │ ...  │ ...   │ ...     │ ☑ │ │
│  └────────────────────┴─────────┴──────┴───────┴─────────┴───┘ │
│       [COPY TO ALL↓]         [COPY TO ALL↓]                     │
│                                                                  │
│             [← Back]  [Generate & Save]                          │
└──────────────────────────────────────────────────────────────────┘
```

### SKU Generator Dialog

```
┌─────────────────────────────────────────────┐
│  SKU Pattern Generator                      │
├─────────────────────────────────────────────┤
│  Separator:                                 │
│  ○ Hyphen (-)  ● Slash (/)                  │
│                                             │
│  Case Style:                                │
│  ● Uppercase  ○ Lowercase                   │
│                                             │
│  Pattern Builder:                           │
│  ┌─────────────────────────────────────┐   │
│  │ 1. Item Name (First 3 chars)        │   │
│  │ 2. Color (All)                      │   │
│  │ 3. Size (All)                       │   │
│  │ + Add Pattern Part                  │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  Pattern Parts Available:                   │
│  • Item Name                                │
│  • Attribute (Color, Size, etc.)            │
│  • Custom Text                              │
│  • Counter (001, 002, ...)                  │
│                                             │
│  Live Preview:                              │
│  ┌─────────────────────────────────────┐   │
│  │ TSH/RED/S                           │   │
│  │ TSH/RED/M                           │   │
│  │ TSH/BLUE/S                          │   │
│  └─────────────────────────────────────┘   │
│                                             │
│            [Cancel]  [Apply Pattern]        │
└─────────────────────────────────────────────┘
```

### Settings - Variant Options Manager

```
┌──────────────────────────────────────────────────────────┐
│  Variant Options                                         │
├──────────────────────────────────────────────────────────┤
│  Manage reusable variant attributes for your products    │
│                                                          │
│  [+ Create New Option Group]                             │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │ Color (System) 🔒                             [Edit]│ │
│  │ Red, Blue, Green, Yellow, Black, White... (+6)     │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │ Size (System) 🔒                              [Edit]│ │
│  │ XS, S, M, L, XL, XXL, XXXL                         │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │ Custom Fabric Type           [Edit] [Delete]        │ │
│  │ Canvas, Denim, Fleece, Jersey                      │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
└──────────────────────────────────────────────────────────┘

Note: 🔒 System options can be used but not deleted
```

### Settings - Units of Measure

```
┌──────────────────────────────────────────────────────────┐
│  Units of Measure                                        │
├──────────────────────────────────────────────────────────┤
│  [+ Create Custom Unit]                                  │
│                                                          │
│  ▼ Quantity Units                                        │
│    • Piece (pcs) 🔒 - Base Unit                          │
│    • Dozen (dz) 🔒 - 12 pcs                              │
│    • Pack (pk) 🔒                                        │
│                                                          │
│  ▼ Weight Units                                          │
│    • Kilogram (kg) 🔒 - Base Unit                        │
│    • Gram (g) 🔒 - 0.001 kg                              │
│    • Pound (lb) 🔒 - 0.453592 kg                         │
│    • Ton (t) 🔒 - 1000 kg                                │
│                                                          │
│  ▼ Length Units                                          │
│    • Meter (m) 🔒 - Base Unit                            │
│    • Centimeter (cm) 🔒 - 0.01 m                         │
│    • Inch (in) 🔒 - 0.0254 m                             │
│                                                          │
│  ▼ Volume Units                                          │
│    • Liter (L) 🔒 - Base Unit                            │
│    • Milliliter (mL) 🔒 - 0.001 L                        │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## Appendix B: Common Use Cases

### Use Case 1: Simple Office Chair (Individual Product)

**User Story**: As a warehouse manager, I want to add a simple office chair that doesn't have variants.

**Steps**:

1. Click "Add Product" → Select "Individual Product"
2. Fill in:
   - Name: "Executive Office Chair"
   - SKU: "CHAIR-001"
   - Cost: $50
   - Price: $120
   - Reorder: 5
3. Save

**Result**: Single product created, appears in inventory with one SKU.

---

### Use Case 2: T-Shirt with Colors and Sizes (Product Group)

**User Story**: As a retail manager, I want to create a T-shirt product with 12 colors and 7 sizes.

**Steps**:

1. Click "Add Product" → Select "Product Group"
2. Step 1: Name "Premium Cotton T-Shirt"
3. Step 2: Select attributes "Color" and "Size"
4. Step 3: Configure SKU pattern "TSH/{Color}/{Size}"
5. Edit prices in grid (or use "Copy to All")
6. Save

**Result**: 84 variants created (12 × 7), each with unique SKU like "TSH/RED/M"

---

### Use Case 3: Custom Wood Finish Options

**User Story**: As a furniture company, I need custom wood finish options that aren't in the system.

**Steps**:

1. Go to Settings → Variant Options
2. Click "+ Create New Option Group"
3. Name: "Wood Finish"
4. Add values: Oak, Walnut, Mahogany, Cherry
5. Save

**Result**: New custom attribute available for all future products.

---

## Appendix C: Performance Considerations

### Database Query Optimization

1. **Indexed Lookups**:
   - All foreign keys are indexed
   - SKU lookups use unique index
   - Organization filtering uses composite indexes

2. **Avoid N+1 Queries**:
   - Use Supabase `.select()` with joins
   - Example: `products.select('*, variants(*, attribute_values(*))')`

3. **JSONB Performance**:
   - JSONB fields are fast for PostgreSQL
   - Use GIN indexes for JSONB search if needed
   - Context data queries are simple key-value lookups

4. **Pagination**:
   - Always paginate product lists
   - Default: 25 items per page
   - Use cursor-based pagination for large datasets

### Expected Performance Metrics

- **Individual Product Creation**: < 500ms
- **Product Group with 100 variants**: < 3s
- **Product List (25 items)**: < 200ms
- **Variant Grid Generation**: < 1s for 1000 combinations
- **SKU Pattern Preview**: Real-time (< 50ms)

---

**Last Updated**: January 2025
**Status**: Ready for Implementation
