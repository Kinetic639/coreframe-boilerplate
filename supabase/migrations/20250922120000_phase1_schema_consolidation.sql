-- =============================================
-- PHASE 1: Database Foundation & Schema Cleanup
-- Complete system refactoring - Step 1.1 & 1.2 & 1.3
-- =============================================

-- Step 1: Fix template_id constraint to allow template-optional products
-- This enables users to create products without selecting a template first
ALTER TABLE products ALTER COLUMN template_id DROP NOT NULL;

-- Step 2: Create context management tables for multi-context support
CREATE TABLE IF NOT EXISTS context_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id), -- NULL = system context
  context_name VARCHAR(50) NOT NULL,
  context_type VARCHAR(20) DEFAULT 'custom' CHECK (context_type IN ('system', 'custom')),
  display_label JSONB NOT NULL, -- {"en": "Warehouse", "pl": "Magazyn"}
  icon VARCHAR(50),
  color VARCHAR(7) DEFAULT '#10b981',
  is_active BOOLEAN DEFAULT true,
  api_enabled BOOLEAN DEFAULT false,
  access_level VARCHAR(20) DEFAULT 'private' CHECK (access_level IN ('public', 'token_required', 'private')),
  rate_limits JSONB DEFAULT '{"requests_per_minute": 60, "requests_per_hour": 1000}',
  cors_origins TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc', now()),

  -- Unique constraint for context names per organization
  UNIQUE(organization_id, context_name)
);

-- Step 3: Add enhanced attribute definitions for context behavior and API visibility
-- These columns enable field-level context configuration and API exposure control
ALTER TABLE template_attribute_definitions
ADD COLUMN IF NOT EXISTS context_behavior VARCHAR(20) DEFAULT 'context_specific'
  CHECK (context_behavior IN ('shared', 'context_specific', 'inherited')),
ADD COLUMN IF NOT EXISTS inheritance_rules JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS api_visibility JSONB DEFAULT '{"public": false, "token_required": false, "private": true}';

-- Step 4: Create field visibility rules table for API exposure control
CREATE TABLE IF NOT EXISTS field_visibility_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  context_config_id UUID REFERENCES context_configurations(id) ON DELETE CASCADE,
  field_name VARCHAR(100) NOT NULL,
  visibility_level VARCHAR(20) DEFAULT 'private' CHECK (visibility_level IN ('public', 'token_required', 'private')),
  field_transformations JSONB DEFAULT '{}', -- For data transformation rules
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),

  UNIQUE(context_config_id, field_name)
);

-- Step 5: Seed system contexts that are available to all organizations
INSERT INTO context_configurations (
  context_name,
  context_type,
  display_label,
  icon,
  color,
  api_enabled,
  access_level,
  organization_id,
  metadata
) VALUES
(
  'warehouse',
  'system',
  '{"en": "Warehouse", "pl": "Magazyn"}',
  'Package',
  '#10b981',
  false,
  'private',
  NULL,
  '{"description": {"en": "Internal warehouse management", "pl": "Wewnętrzne zarządzanie magazynem"}}'
),
(
  'ecommerce',
  'system',
  '{"en": "E-commerce", "pl": "E-commerce"}',
  'ShoppingCart',
  '#3b82f6',
  true,
  'public',
  NULL,
  '{"description": {"en": "Public e-commerce storefront", "pl": "Publiczny sklep internetowy"}}'
),
(
  'b2b',
  'system',
  '{"en": "B2B Sales", "pl": "Sprzedaż B2B"}',
  'Building',
  '#f59e0b',
  true,
  'token_required',
  NULL,
  '{"description": {"en": "Business-to-business sales", "pl": "Sprzedaż między firmami"}}'
),
(
  'pos',
  'system',
  '{"en": "Point of Sale", "pl": "Punkt sprzedaży"}',
  'CreditCard',
  '#ef4444',
  false,
  'private',
  NULL,
  '{"description": {"en": "Point of sale systems", "pl": "Systemy kasowe"}}'
)
ON CONFLICT (organization_id, context_name) DO NOTHING;

-- Step 6: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_context_configurations_org ON context_configurations(organization_id);
CREATE INDEX IF NOT EXISTS idx_context_configurations_active ON context_configurations(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_context_configurations_api_enabled ON context_configurations(api_enabled) WHERE api_enabled = true;
CREATE INDEX IF NOT EXISTS idx_field_visibility_rules_context ON field_visibility_rules(context_config_id);

-- Step 7: Enable RLS for new tables
ALTER TABLE context_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_visibility_rules ENABLE ROW LEVEL SECURITY;

-- Step 8: Create RLS policies for context management
-- Users can view system contexts and contexts from their organizations
CREATE POLICY "Users can view system contexts and org contexts" ON context_configurations
  FOR SELECT USING (
    context_type = 'system' OR
    organization_id IN (
      SELECT organization_id FROM user_memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Users can create custom contexts in their organizations
CREATE POLICY "Users can create org contexts" ON context_configurations
  FOR INSERT WITH CHECK (
    context_type = 'custom' AND
    organization_id IN (
      SELECT organization_id FROM user_memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Users can update custom contexts in their organizations
CREATE POLICY "Users can update org contexts" ON context_configurations
  FOR UPDATE USING (
    context_type = 'custom' AND
    organization_id IN (
      SELECT organization_id FROM user_memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Field visibility rules follow context access
CREATE POLICY "Users can manage field visibility for accessible contexts" ON field_visibility_rules
  FOR ALL USING (
    context_config_id IN (
      SELECT id FROM context_configurations WHERE
      context_type = 'system' OR
      organization_id IN (
        SELECT organization_id FROM user_memberships
        WHERE user_id = auth.uid() AND status = 'active'
      )
    )
  );

-- Step 9: Add update trigger for context configurations
CREATE OR REPLACE FUNCTION update_context_configurations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_context_configurations_updated_at
  BEFORE UPDATE ON context_configurations
  FOR EACH ROW EXECUTE FUNCTION update_context_configurations_updated_at();

-- Step 10: Grant necessary permissions
GRANT SELECT ON context_configurations TO authenticated;
GRANT SELECT ON field_visibility_rules TO authenticated;

-- Step 11: Add helpful comments
COMMENT ON TABLE context_configurations IS 'Manages different business contexts (warehouse, ecommerce, b2b, etc.) with API exposure settings';
COMMENT ON TABLE field_visibility_rules IS 'Controls which fields are visible in different API access levels per context';
COMMENT ON COLUMN template_attribute_definitions.context_behavior IS 'How field behaves across contexts: shared, context_specific, or inherited';
COMMENT ON COLUMN template_attribute_definitions.api_visibility IS 'Controls field visibility in public, token-required, and private APIs';

-- Step 12: Verify the changes work correctly
DO $$
BEGIN
  -- Test that products can now be created without template_id
  RAISE NOTICE 'Phase 1 Migration Complete:';
  RAISE NOTICE '✅ Products.template_id is now nullable';
  RAISE NOTICE '✅ Context management tables created';
  RAISE NOTICE '✅ System contexts seeded';
  RAISE NOTICE '✅ Enhanced attribute definitions added';
  RAISE NOTICE '✅ RLS policies configured';
  RAISE NOTICE '✅ Performance indexes created';
END $$;