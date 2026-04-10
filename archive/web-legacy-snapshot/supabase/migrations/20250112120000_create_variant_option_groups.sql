-- =============================================
-- Migration: Create Variant Option Groups System
-- Supports both global templates and product-specific option groups
-- =============================================

-- Step 1: Create global variant option group templates
CREATE TABLE variant_option_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_template BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
  deleted_at TIMESTAMPTZ,

  UNIQUE(organization_id, name, deleted_at)
);

-- Step 2: Create values for global templates
CREATE TABLE variant_option_group_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  option_group_id UUID NOT NULL REFERENCES variant_option_groups(id) ON DELETE CASCADE,
  value TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
  deleted_at TIMESTAMPTZ,

  UNIQUE(option_group_id, value, deleted_at)
);

-- Step 3: Create product-specific option groups (copies of templates)
CREATE TABLE product_option_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  template_group_id UUID REFERENCES variant_option_groups(id),
  name TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
  deleted_at TIMESTAMPTZ,

  UNIQUE(product_id, name, deleted_at)
);

-- Step 4: Create product-specific option values (customizable per product)
CREATE TABLE product_option_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_option_group_id UUID NOT NULL REFERENCES product_option_groups(id) ON DELETE CASCADE,
  value TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
  deleted_at TIMESTAMPTZ,

  UNIQUE(product_option_group_id, value, deleted_at)
);

-- Step 5: Link variants to their specific option values
CREATE TABLE product_variant_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  product_option_group_id UUID NOT NULL REFERENCES product_option_groups(id) ON DELETE CASCADE,
  product_option_value_id UUID NOT NULL REFERENCES product_option_values(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),

  UNIQUE(variant_id, product_option_group_id)
);

-- Step 6: Create indexes for performance
CREATE INDEX idx_variant_option_groups_org ON variant_option_groups(organization_id, deleted_at);
CREATE INDEX idx_variant_option_groups_template ON variant_option_groups(is_template) WHERE deleted_at IS NULL;
CREATE INDEX idx_variant_option_group_values_group ON variant_option_group_values(option_group_id, display_order) WHERE deleted_at IS NULL;
CREATE INDEX idx_product_option_groups_product ON product_option_groups(product_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_product_option_groups_template ON product_option_groups(template_group_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_product_option_values_group ON product_option_values(product_option_group_id, display_order) WHERE deleted_at IS NULL;
CREATE INDEX idx_product_variant_options_variant ON product_variant_options(variant_id);

-- Step 7: Create triggers for updated_at timestamps
CREATE TRIGGER update_variant_option_groups_updated_at BEFORE UPDATE ON variant_option_groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_variant_option_group_values_updated_at BEFORE UPDATE ON variant_option_group_values
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_product_option_groups_updated_at BEFORE UPDATE ON product_option_groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_product_option_values_updated_at BEFORE UPDATE ON product_option_values
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Step 8: Add comments for documentation
COMMENT ON TABLE variant_option_groups IS 'Global variant option group templates (e.g., Size, Color, Dimensions)';
COMMENT ON TABLE variant_option_group_values IS 'Values for global templates';
COMMENT ON TABLE product_option_groups IS 'Product-specific option groups (copied from templates)';
COMMENT ON TABLE product_option_values IS 'Product-specific option values (customizable per product)';
COMMENT ON TABLE product_variant_options IS 'Links variants to their specific option values';
