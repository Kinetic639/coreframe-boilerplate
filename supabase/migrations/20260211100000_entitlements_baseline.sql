-- =====================================================
-- MIGRATION 1: ENTITLEMENTS BASELINE
-- Purpose: Establish idempotent schema for subscription system
-- Tables: subscription_plans, organization_subscriptions, subscription_usage
-- Also: update_updated_at_column trigger function, indexes, constraints,
--        initial limit key rename (preserves unknown keys)
--
-- IDEMPOTENT: safe to run on both fresh and existing databases.
-- Uses CREATE TABLE IF NOT EXISTS so tables are created when missing
-- and skipped when already present.
-- =====================================================

-- 1. Verify update_updated_at_column() exists (DO NOT REPLACE — used by existing triggers)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'update_updated_at_column'
  ) THEN
    RAISE EXCEPTION 'update_updated_at_column() function does not exist. '
      'It must be created before this migration. This function is shared by many tables.';
  END IF;
END $$;

-- 2. Verify is_org_member() exists and is SECURITY DEFINER (DO NOT REPLACE)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'is_org_member'
  ) THEN
    RAISE EXCEPTION 'is_org_member() function does not exist. '
      'This function is critical for RLS policies and must exist before proceeding.';
  END IF;
  -- Verify it is SECURITY DEFINER
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'is_org_member'
      AND p.prosecdef = true
  ) THEN
    RAISE WARNING 'is_org_member() is NOT SECURITY DEFINER. '
      'It should be SECURITY DEFINER SET search_path TO '''' for security.';
  END IF;
END $$;

-- 3. Create subscription_plans if not exists
-- Column definitions match the live DB schema.
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_product_id TEXT,
  name TEXT NOT NULL,
  display_name JSONB NOT NULL,
  description JSONB,
  price_monthly INTEGER,
  price_yearly INTEGER,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  enabled_modules TEXT[] DEFAULT ARRAY[]::text[],
  enabled_contexts TEXT[] DEFAULT ARRAY[]::text[],
  features JSONB DEFAULT '{}'::jsonb,
  limits JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint on name (idempotent guard)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'subscription_plans_name_key'
  ) THEN
    ALTER TABLE public.subscription_plans ADD CONSTRAINT subscription_plans_name_key UNIQUE (name);
  END IF;
END $$;

-- 4. Create organization_subscriptions if not exists
CREATE TABLE IF NOT EXISTS public.organization_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES public.subscription_plans(id),
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  trial_start TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 month'),
  is_development BOOLEAN DEFAULT false,
  dev_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- CHECK constraint on status (idempotent guard)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'organization_subscriptions_status_check'
  ) THEN
    ALTER TABLE public.organization_subscriptions
      ADD CONSTRAINT organization_subscriptions_status_check
      CHECK (status IN ('active', 'trialing', 'past_due', 'canceled', 'unpaid', 'incomplete'));
  END IF;
END $$;

-- Unique constraint: one subscription per org (idempotent guard)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'organization_subscriptions_organization_id_key'
  ) THEN
    ALTER TABLE public.organization_subscriptions
      ADD CONSTRAINT organization_subscriptions_organization_id_key UNIQUE (organization_id);
  END IF;
END $$;

-- 5. Create subscription_usage if not exists
CREATE TABLE IF NOT EXISTS public.subscription_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL,
  current_value INTEGER DEFAULT 0,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint: one usage row per org+feature+period (idempotent guard)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'subscription_usage_organization_id_feature_key_period_start_key'
  ) THEN
    ALTER TABLE public.subscription_usage
      ADD CONSTRAINT subscription_usage_organization_id_feature_key_period_start_key
      UNIQUE (organization_id, feature_key, period_start);
  END IF;
END $$;

-- 6. Ensure indexes exist (idempotent)
CREATE INDEX IF NOT EXISTS idx_subscription_plans_active
  ON public.subscription_plans(is_active, sort_order);

CREATE INDEX IF NOT EXISTS idx_org_subscriptions_active
  ON public.organization_subscriptions(organization_id, status);

CREATE INDEX IF NOT EXISTS idx_subscription_usage_lookup
  ON public.subscription_usage(organization_id, feature_key, period_start, period_end);

-- 7. Ensure updated_at triggers exist (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_subscription_plans_updated_at'
  ) THEN
    CREATE TRIGGER update_subscription_plans_updated_at
      BEFORE UPDATE ON public.subscription_plans
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_organization_subscriptions_updated_at'
  ) THEN
    CREATE TRIGGER update_organization_subscriptions_updated_at
      BEFORE UPDATE ON public.organization_subscriptions
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_subscription_usage_updated_at'
  ) THEN
    CREATE TRIGGER update_subscription_usage_updated_at
      BEFORE UPDATE ON public.subscription_usage
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- 8. Rename limit keys to namespaced format (preserve unknown keys)
-- Uses key-rename approach: removes old keys, adds new keys, preserves any other keys.
-- Only applies to rows that still have un-namespaced keys.
UPDATE public.subscription_plans
SET limits = (
  -- Start with existing limits (preserves unknown keys)
  limits
  -- Remove old un-namespaced keys
  - 'max_products' - 'max_locations' - 'max_branches' - 'max_users'
  -- Add namespaced keys with values from old keys (fallback to already-namespaced)
  || jsonb_build_object(
    'warehouse.max_products', COALESCE((limits->>'max_products')::int, (limits->>'warehouse.max_products')::int),
    'warehouse.max_locations', COALESCE((limits->>'max_locations')::int, (limits->>'warehouse.max_locations')::int),
    'warehouse.max_branches', COALESCE((limits->>'max_branches')::int, (limits->>'warehouse.max_branches')::int, 1),
    'organization.max_users', COALESCE((limits->>'max_users')::int, (limits->>'organization.max_users')::int)
  )
)
WHERE limits ? 'max_products'
   OR limits ? 'max_users'
   OR limits ? 'max_locations'
   OR limits ? 'max_branches';

-- 9. Add comments
COMMENT ON TABLE public.subscription_plans IS 'Available subscription plans with features and limits';
COMMENT ON TABLE public.organization_subscriptions IS 'Organization subscription assignments (one active per org)';
COMMENT ON TABLE public.subscription_usage IS 'Monthly usage tracking for metered subscription limits';
