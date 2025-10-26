-- Create subscription system tables
-- This implements the subscription-based context system for organizations

-- Subscription plans table
CREATE TABLE subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL UNIQUE,
  display_name JSONB NOT NULL DEFAULT '{}'::jsonb,
  description JSONB DEFAULT '{}'::jsonb,
  price_monthly INTEGER NOT NULL DEFAULT 0, -- Price in cents
  price_yearly INTEGER DEFAULT 0, -- Price in cents
  enabled_modules TEXT[] NOT NULL DEFAULT ARRAY['home', 'warehouse'],
  enabled_contexts TEXT[] NOT NULL DEFAULT ARRAY['warehouse'],
  features JSONB NOT NULL DEFAULT '{}'::jsonb, -- Feature flags
  limits JSONB NOT NULL DEFAULT '{}'::jsonb, -- Usage limits
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_popular BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Organization subscriptions table
CREATE TABLE organization_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES subscription_plans(id),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'trialing', 'past_due', 'canceled', 'unpaid', 'incomplete')),

  -- Subscription period
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 month'),

  -- Trial information
  trial_start TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,

  -- Development subscriptions (for testing)
  is_development BOOLEAN NOT NULL DEFAULT false,
  dev_expires_at TIMESTAMPTZ, -- When development subscription expires

  -- Payment integration fields (for future use)
  stripe_subscription_id VARCHAR(255),
  stripe_customer_id VARCHAR(255),

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  UNIQUE(organization_id), -- One subscription per organization
  CONSTRAINT valid_dev_subscription CHECK (
    (is_development = false) OR
    (is_development = true AND dev_expires_at IS NOT NULL)
  )
);

-- Subscription usage tracking table
CREATE TABLE subscription_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  feature_key VARCHAR(100) NOT NULL,
  current_value INTEGER NOT NULL DEFAULT 0,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Unique constraint for organization + feature + period
  UNIQUE(organization_id, feature_key, period_start)
);

-- Create indexes for performance
CREATE INDEX idx_subscription_plans_active ON subscription_plans(is_active, sort_order);
CREATE INDEX idx_organization_subscriptions_org_id ON organization_subscriptions(organization_id);
CREATE INDEX idx_organization_subscriptions_status ON organization_subscriptions(status);
CREATE INDEX idx_organization_subscriptions_plan_id ON organization_subscriptions(plan_id);
CREATE INDEX idx_subscription_usage_org_feature ON subscription_usage(organization_id, feature_key);
CREATE INDEX idx_subscription_usage_period ON subscription_usage(period_start, period_end);

-- Create updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_subscription_plans_updated_at
    BEFORE UPDATE ON subscription_plans
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_organization_subscriptions_updated_at
    BEFORE UPDATE ON organization_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscription_usage_updated_at
    BEFORE UPDATE ON subscription_usage
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_usage ENABLE ROW LEVEL SECURITY;

-- Subscription plans are readable by everyone (they're public information)
CREATE POLICY "subscription_plans_select_policy" ON subscription_plans
    FOR SELECT USING (is_active = true);

-- Organization subscriptions are only visible to organization members
CREATE POLICY "organization_subscriptions_select_policy" ON organization_subscriptions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_role_assignments ura
            JOIN roles r ON r.id = ura.role_id
            WHERE ura.user_id = auth.uid()
            AND ura.organization_id = organization_subscriptions.organization_id
            AND ura.deleted_at IS NULL
            AND r.deleted_at IS NULL
        )
    );

-- Only organization admins can modify subscriptions
CREATE POLICY "organization_subscriptions_modify_policy" ON organization_subscriptions
    FOR ALL USING (
        public.authorize('manage_subscriptions'::text, organization_id)
    );

-- Usage data is readable by organization members, writable by service role
CREATE POLICY "subscription_usage_select_policy" ON subscription_usage
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_role_assignments ura
            JOIN roles r ON r.id = ura.role_id
            WHERE ura.user_id = auth.uid()
            AND ura.organization_id = subscription_usage.organization_id
            AND ura.deleted_at IS NULL
            AND r.deleted_at IS NULL
        )
    );

-- Allow service role to manage usage data
CREATE POLICY "subscription_usage_service_policy" ON subscription_usage
    FOR ALL USING (
        auth.role() = 'service_role'
    );

-- Insert default subscription plans
INSERT INTO subscription_plans (name, display_name, description, price_monthly, price_yearly, enabled_modules, enabled_contexts, features, limits, sort_order) VALUES
-- Free Plan
('free',
 '{"en": "Free", "pl": "Darmowy"}',
 '{"en": "Perfect for getting started", "pl": "Idealny na początek"}',
 0, 0,
 ARRAY['home', 'warehouse', 'teams', 'organization-management', 'support', 'user-account', 'development'],
 ARRAY['warehouse'],
 '{"basic_support": true}'::jsonb,
 '{"max_products": 100, "max_users": 3, "max_locations": 5, "max_branches": 1}'::jsonb,
 1),

-- Professional Plan
('professional',
 '{"en": "Professional", "pl": "Profesjonalny"}',
 '{"en": "For growing businesses", "pl": "Dla rozwijających się firm"}',
 2900, 29000,
 ARRAY['home', 'warehouse', 'teams', 'organization-management', 'support', 'user-account', 'analytics', 'development'],
 ARRAY['warehouse', 'ecommerce'],
 '{"basic_support": true, "api_access": true, "advanced_reports": true, "priority_support": false}'::jsonb,
 '{"max_products": 1000, "max_users": 10, "max_locations": 25, "max_branches": 3}'::jsonb,
 2),

-- Business Plan
('business',
 '{"en": "Business", "pl": "Biznesowy"}',
 '{"en": "For established businesses", "pl": "Dla ugruntowanych firm"}',
 7900, 79000,
 ARRAY['home', 'warehouse', 'teams', 'organization-management', 'support', 'user-account', 'analytics', 'development'],
 ARRAY['warehouse', 'ecommerce', 'b2b', 'pos'],
 '{"basic_support": true, "api_access": true, "advanced_reports": true, "priority_support": true, "custom_branding": true}'::jsonb,
 '{"max_products": 5000, "max_users": 50, "max_locations": 100, "max_branches": 10}'::jsonb,
 3),

-- Enterprise Plan
('enterprise',
 '{"en": "Enterprise", "pl": "Korporacyjny"}',
 '{"en": "For large organizations", "pl": "Dla dużych organizacji"}',
 19900, 199000,
 ARRAY['home', 'warehouse', 'teams', 'organization-management', 'support', 'user-account', 'analytics', 'development'],
 ARRAY['warehouse', 'ecommerce', 'b2b', 'pos', 'manufacturing'],
 '{"basic_support": true, "api_access": true, "advanced_reports": true, "priority_support": true, "custom_branding": true, "white_label": true, "custom_integrations": true}'::jsonb,
 '{"max_products": -1, "max_users": -1, "max_locations": -1, "max_branches": -1}'::jsonb,
 4);

-- Create default free subscriptions for existing organizations
INSERT INTO organization_subscriptions (organization_id, plan_id, status, current_period_start, current_period_end)
SELECT
    o.id,
    sp.id,
    'active',
    NOW(),
    NOW() + INTERVAL '1 year' -- Free plan gets 1 year periods
FROM organizations o
CROSS JOIN subscription_plans sp
WHERE sp.name = 'free'
AND NOT EXISTS (
    SELECT 1 FROM organization_subscriptions os
    WHERE os.organization_id = o.id
)
ON CONFLICT (organization_id) DO NOTHING;

-- Add helpful functions
CREATE OR REPLACE FUNCTION get_organization_subscription(org_id UUID)
RETURNS TABLE (
    subscription_id UUID,
    plan_name VARCHAR(50),
    plan_display_name JSONB,
    status VARCHAR(20),
    enabled_modules TEXT[],
    enabled_contexts TEXT[],
    features JSONB,
    limits JSONB,
    is_development BOOLEAN,
    current_period_end TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        os.id,
        sp.name,
        sp.display_name,
        os.status,
        sp.enabled_modules,
        sp.enabled_contexts,
        sp.features,
        sp.limits,
        os.is_development,
        os.current_period_end
    FROM organization_subscriptions os
    JOIN subscription_plans sp ON sp.id = os.plan_id
    WHERE os.organization_id = org_id
    AND os.status = 'active';
END;
$$;

-- Function to check if organization has access to module
CREATE OR REPLACE FUNCTION has_module_access(org_id UUID, module_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    has_access BOOLEAN := false;
BEGIN
    -- Always allow access to default modules
    IF module_name IN ('home', 'warehouse', 'teams', 'organization-management', 'support', 'user-account', 'development') THEN
        RETURN true;
    END IF;

    -- Check subscription
    SELECT module_name = ANY(sp.enabled_modules) INTO has_access
    FROM organization_subscriptions os
    JOIN subscription_plans sp ON sp.id = os.plan_id
    WHERE os.organization_id = org_id
    AND os.status = 'active';

    RETURN COALESCE(has_access, false);
END;
$$;

-- Function to check if organization has access to context
CREATE OR REPLACE FUNCTION has_context_access(org_id UUID, context_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    has_access BOOLEAN := false;
BEGIN
    -- Always allow warehouse context
    IF context_name = 'warehouse' THEN
        RETURN true;
    END IF;

    -- Check subscription
    SELECT context_name = ANY(sp.enabled_contexts) INTO has_access
    FROM organization_subscriptions os
    JOIN subscription_plans sp ON sp.id = os.plan_id
    WHERE os.organization_id = org_id
    AND os.status = 'active';

    RETURN COALESCE(has_access, false);
END;
$$;

-- Function to check feature access
CREATE OR REPLACE FUNCTION has_feature_access(org_id UUID, feature_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    has_access BOOLEAN := false;
BEGIN
    SELECT COALESCE((sp.features->feature_name)::boolean, false) INTO has_access
    FROM organization_subscriptions os
    JOIN subscription_plans sp ON sp.id = os.plan_id
    WHERE os.organization_id = org_id
    AND os.status = 'active';

    RETURN COALESCE(has_access, false);
END;
$$;

COMMENT ON TABLE subscription_plans IS 'Available subscription plans with features and limits';
COMMENT ON TABLE organization_subscriptions IS 'Organization subscription assignments';
COMMENT ON TABLE subscription_usage IS 'Monthly usage tracking for subscription limits';