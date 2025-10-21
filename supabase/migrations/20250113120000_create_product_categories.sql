-- =============================================
-- Migration: Create Product Categories System
-- Hierarchical categories with foreign key to products
-- Matches InFlow behavior: products reassigned on deletion
-- =============================================

-- Step 1: Create product_categories table
CREATE TABLE product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES product_categories(id) ON DELETE CASCADE,

  level INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,

  icon_name TEXT,
  color TEXT,

  is_default BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
  deleted_at TIMESTAMPTZ,

  UNIQUE(organization_id, name, parent_id, deleted_at)
);

-- Step 2: Add category_id to products table
ALTER TABLE products
ADD COLUMN category_id UUID REFERENCES product_categories(id) ON DELETE SET NULL;

-- Step 3: Create indexes for performance
CREATE INDEX idx_product_categories_org ON product_categories(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_product_categories_parent ON product_categories(parent_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_product_categories_sort ON product_categories(organization_id, parent_id, sort_order) WHERE deleted_at IS NULL;
CREATE INDEX idx_product_categories_default ON product_categories(organization_id, is_default) WHERE is_default = true AND deleted_at IS NULL;
CREATE INDEX idx_products_category ON products(category_id);

-- Step 3b: Create partial unique index for one default per organization
CREATE UNIQUE INDEX idx_product_categories_one_default_per_org
ON product_categories(organization_id, is_default)
WHERE is_default = true AND deleted_at IS NULL;

-- Step 4: Create updated_at trigger
CREATE TRIGGER update_product_categories_updated_at
  BEFORE UPDATE ON product_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Step 5: Create default "Uncategorized" category for existing organizations
INSERT INTO product_categories (organization_id, name, description, is_default, sort_order)
SELECT
  id as organization_id,
  'Uncategorized' as name,
  'Default category for products' as description,
  true as is_default,
  0 as sort_order
FROM organizations
WHERE NOT EXISTS (
  SELECT 1 FROM product_categories
  WHERE product_categories.organization_id = organizations.id
  AND is_default = true
);

-- Step 6: Add trigger to create default category for new organizations
CREATE OR REPLACE FUNCTION create_default_product_category()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO product_categories (organization_id, name, description, is_default, sort_order)
  VALUES (NEW.id, 'Uncategorized', 'Default category for products', true, 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER create_default_category_on_org_creation
  AFTER INSERT ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION create_default_product_category();

-- Step 7: Add comments for documentation
COMMENT ON TABLE product_categories IS 'Hierarchical product categories with foreign key references from products';
COMMENT ON COLUMN product_categories.is_default IS 'Default Uncategorized category that cannot be deleted';
COMMENT ON COLUMN product_categories.parent_id IS 'Parent category for hierarchical structure. CASCADE on delete.';
COMMENT ON COLUMN products.category_id IS 'Foreign key to product_categories. SET NULL on delete (should not happen due to reassignment logic).';
