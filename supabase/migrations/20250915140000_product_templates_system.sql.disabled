-- Product templates define available fields and contexts
CREATE TABLE product_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  organization_id UUID REFERENCES organizations(id), -- NULL = system template
  parent_template_id UUID REFERENCES product_templates(id), -- For custom templates

  -- Template metadata
  is_system BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  category VARCHAR(100),
  icon VARCHAR(100),
  color VARCHAR(7), -- HEX color
  supported_contexts TEXT[] DEFAULT '{"warehouse"}', -- JSON array of supported contexts
  settings JSONB DEFAULT '{}', -- Template-specific settings

  -- Audit
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT template_name_org_unique UNIQUE(name, organization_id)
);

-- Attribute definitions for templates
CREATE TABLE product_attribute_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES product_templates(id) ON DELETE CASCADE,

  -- Attribute identification
  slug VARCHAR(100) NOT NULL, -- machine-readable name
  label JSONB NOT NULL, -- {"en": "SKU", "pl": "SKU"}
  description JSONB, -- {"en": "Stock keeping unit", "pl": "Kod produktu"}

  -- Attribute type and validation
  data_type VARCHAR(50) NOT NULL CHECK (data_type IN ('text', 'number', 'boolean', 'date', 'json')),
  is_required BOOLEAN DEFAULT false,
  is_unique BOOLEAN DEFAULT false,
  default_value JSONB,
  validation_rules JSONB DEFAULT '{}', -- JSON schema for validation

  -- Context and display
  context_scope VARCHAR(50) DEFAULT 'warehouse', -- warehouse, ecommerce, b2b
  display_order INTEGER DEFAULT 0,
  is_searchable BOOLEAN DEFAULT false,
  is_filterable BOOLEAN DEFAULT false,

  -- UI hints
  input_type VARCHAR(50) DEFAULT 'text', -- text, textarea, select, multiselect, etc.
  placeholder JSONB, -- {"en": "Enter SKU", "pl": "Wprowadź SKU"}
  help_text JSONB, -- {"en": "Unique product code", "pl": "Unikalny kod produktu"}

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT attr_slug_template_unique UNIQUE(slug, template_id, context_scope)
);

-- Enable RLS
ALTER TABLE product_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_attribute_definitions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for templates
CREATE POLICY "Users can view system templates and org templates" ON product_templates
  FOR SELECT USING (
    is_system = true OR
    organization_id IN (
      SELECT organization_id FROM user_memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "Users can create org templates" ON product_templates
  FOR INSERT WITH CHECK (
    is_system = false AND
    organization_id IN (
      SELECT organization_id FROM user_memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "Users can update own org templates" ON product_templates
  FOR UPDATE USING (
    is_system = false AND
    organization_id IN (
      SELECT organization_id FROM user_memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "Users can delete own org templates" ON product_templates
  FOR DELETE USING (
    is_system = false AND
    organization_id IN (
      SELECT organization_id FROM user_memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- RLS Policies for attribute definitions
CREATE POLICY "Users can view attribute definitions" ON product_attribute_definitions
  FOR SELECT USING (
    template_id IN (
      SELECT id FROM product_templates WHERE
      is_system = true OR
      organization_id IN (
        SELECT organization_id FROM user_memberships
        WHERE user_id = auth.uid() AND status = 'active'
      )
    )
  );

CREATE POLICY "Users can manage attribute definitions for their templates" ON product_attribute_definitions
  FOR ALL USING (
    template_id IN (
      SELECT id FROM product_templates WHERE
      is_system = false AND
      organization_id IN (
        SELECT organization_id FROM user_memberships
        WHERE user_id = auth.uid() AND status = 'active'
      )
    )
  );

-- Update trigger for updated_at
CREATE TRIGGER update_product_templates_updated_at
  BEFORE UPDATE ON product_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_product_attribute_definitions_updated_at
  BEFORE UPDATE ON product_attribute_definitions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Indexes for performance
CREATE INDEX idx_product_templates_organization ON product_templates(organization_id);
CREATE INDEX idx_product_templates_system ON product_templates(is_system) WHERE is_system = true;
CREATE INDEX idx_product_templates_active ON product_templates(is_active) WHERE is_active = true;
CREATE INDEX idx_product_attribute_definitions_template ON product_attribute_definitions(template_id);
CREATE INDEX idx_product_attribute_definitions_context ON product_attribute_definitions(context_scope);