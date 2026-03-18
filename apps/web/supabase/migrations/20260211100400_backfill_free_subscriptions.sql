-- =====================================================
-- MIGRATION 5: BACKFILL FREE SUBSCRIPTIONS
-- Purpose: Ensure free/professional/enterprise plans exist with
--          correct namespaced limits, backfill orgs, recompute all
-- =====================================================

-- 1. Ensure free plan exists with NAMESPACED limit keys
-- NOTE: These values are INTENTIONAL updates from the current DB state:
-- - max_users: 2 → 3 (increase for free tier)
-- - enabled_modules: adds 'contacts', 'documentation'; removes 'development'
-- These changes take effect on next recompute for all orgs on free plan.
DO $$
DECLARE
  v_free_plan_id UUID;
BEGIN
  -- Check if free plan exists
  SELECT id INTO v_free_plan_id FROM public.subscription_plans WHERE name = 'free';

  -- If not, create it
  IF v_free_plan_id IS NULL THEN
    INSERT INTO public.subscription_plans (
      name,
      display_name,
      description,
      price_monthly,
      price_yearly,
      is_active,
      sort_order,
      enabled_modules,
      enabled_contexts,
      features,
      limits
    ) VALUES (
      'free',
      '{"en": "Free", "pl": "Darmowy"}'::jsonb,
      '{"en": "Perfect for getting started", "pl": "Idealny na początek"}'::jsonb,
      0,
      0,
      true,
      1,
      ARRAY['home', 'warehouse', 'teams', 'organization-management', 'support', 'user-account', 'contacts', 'documentation'],
      ARRAY['warehouse'],
      '{"basic_support": true}'::jsonb,
      '{"warehouse.max_products": 100, "organization.max_users": 3, "warehouse.max_locations": 5, "warehouse.max_branches": 1}'::jsonb
    );
  ELSE
    -- Free plan exists: update limits to namespaced + update modules
    -- Key-rename approach: preserves unknown keys
    UPDATE public.subscription_plans
    SET
      limits = (
        limits
        - 'max_products' - 'max_locations' - 'max_branches' - 'max_users'
        || '{"warehouse.max_products": 100, "organization.max_users": 3, "warehouse.max_locations": 5, "warehouse.max_branches": 1}'::jsonb
      ),
      enabled_modules = ARRAY['home', 'warehouse', 'teams', 'organization-management', 'support', 'user-account', 'contacts', 'documentation']
    WHERE id = v_free_plan_id;
  END IF;
END $$;

-- 2. Ensure professional plan has namespaced keys (preserve unknown keys)
-- Professional plan actual DB values: max_products=10000, max_locations=100, max_users=50
UPDATE public.subscription_plans
SET limits = (
  limits
  - 'max_products' - 'max_locations' - 'max_branches' - 'max_users'
  || jsonb_build_object(
    'warehouse.max_products', COALESCE((limits->>'max_products')::int, (limits->>'warehouse.max_products')::int, 10000),
    'warehouse.max_locations', COALESCE((limits->>'max_locations')::int, (limits->>'warehouse.max_locations')::int, 100),
    'warehouse.max_branches', COALESCE((limits->>'max_branches')::int, (limits->>'warehouse.max_branches')::int, 10),
    'organization.max_users', COALESCE((limits->>'max_users')::int, (limits->>'organization.max_users')::int, 50),
    'analytics.monthly_exports', 100
  )
)
WHERE name = 'professional'
  AND (limits ? 'max_products' OR NOT limits ? 'warehouse.max_products');

-- 3. Ensure enterprise plan has namespaced keys (preserve unknown keys)
UPDATE public.subscription_plans
SET limits = (
  limits
  - 'max_products' - 'max_locations' - 'max_branches' - 'max_users'
  || jsonb_build_object(
    'warehouse.max_products', -1,
    'warehouse.max_locations', -1,
    'warehouse.max_branches', -1,
    'organization.max_users', -1,
    'analytics.monthly_exports', -1
  )
)
WHERE name = 'enterprise'
  AND (limits ? 'max_products' OR NOT limits ? 'warehouse.max_products');

-- 4. Backfill: assign free plan to all orgs without subscription
INSERT INTO public.organization_subscriptions (
  organization_id,
  plan_id,
  status,
  current_period_start,
  current_period_end,
  is_development
)
SELECT
  o.id,
  sp.id,
  'active',
  NOW(),
  NOW() + INTERVAL '1 year',
  false
FROM public.organizations o
CROSS JOIN public.subscription_plans sp
WHERE sp.name = 'free'
  AND o.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.organization_subscriptions os
    WHERE os.organization_id = o.id
  )
ON CONFLICT (organization_id) DO NOTHING;

-- 5. Recompute all entitlements
SELECT public.recompute_all_entitlements();

-- 6. Verification queries (advisory — will show results in migration log)
-- Verify all orgs have entitlements
DO $$
DECLARE
  v_org_count INTEGER;
  v_ent_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_org_count FROM public.organizations WHERE deleted_at IS NULL;
  SELECT COUNT(*) INTO v_ent_count FROM public.organization_entitlements;

  IF v_org_count != v_ent_count THEN
    RAISE WARNING 'Entitlements count (%) does not match org count (%). Some orgs may be missing entitlements.',
      v_ent_count, v_org_count;
  ELSE
    RAISE NOTICE 'All % organizations have entitlements rows.', v_org_count;
  END IF;
END $$;

-- Verify all limit keys are namespaced (must return 0 rows)
DO $$
DECLARE
  v_bad_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_bad_count
  FROM public.subscription_plans, jsonb_each(limits) AS kv(key, value)
  WHERE key NOT LIKE '%.%';

  IF v_bad_count > 0 THEN
    RAISE WARNING '% un-namespaced limit keys found in subscription_plans. Expected 0.', v_bad_count;
  ELSE
    RAISE NOTICE 'All limit keys in subscription_plans are properly namespaced.';
  END IF;
END $$;
