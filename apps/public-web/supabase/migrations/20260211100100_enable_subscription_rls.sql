-- =====================================================
-- MIGRATION 2: ENABLE RLS ON SUBSCRIPTION TABLES
-- Purpose: Enable + FORCE RLS on subscription_plans,
--          organization_subscriptions, subscription_usage
-- Policies: SELECT for authenticated, ALL for service_role
-- =====================================================

-- 1. Enable RLS
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_usage ENABLE ROW LEVEL SECURITY;

-- 2. FORCE RLS (applies even to table owner)
ALTER TABLE public.subscription_plans FORCE ROW LEVEL SECURITY;
ALTER TABLE public.organization_subscriptions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_usage FORCE ROW LEVEL SECURITY;

-- 3. SELECT policies

-- Plans catalog: readable by any authenticated user (it's a public catalog)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'subscription_plans'
      AND policyname = 'subscription_plans_select_authenticated'
  ) THEN
    CREATE POLICY "subscription_plans_select_authenticated" ON public.subscription_plans
      FOR SELECT TO authenticated
      USING (is_active = true);
  END IF;
END $$;

-- Org subscriptions: readable by org members only
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'organization_subscriptions'
      AND policyname = 'org_subscriptions_select_member'
  ) THEN
    CREATE POLICY "org_subscriptions_select_member" ON public.organization_subscriptions
      FOR SELECT TO authenticated
      USING (public.is_org_member(organization_id));
  END IF;
END $$;

-- Usage: readable by org members only
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'subscription_usage'
      AND policyname = 'subscription_usage_select_member'
  ) THEN
    CREATE POLICY "subscription_usage_select_member" ON public.subscription_usage
      FOR SELECT TO authenticated
      USING (public.is_org_member(organization_id));
  END IF;
END $$;

-- 4. MODIFY policies (service_role only — used by triggers, admin functions)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'subscription_plans'
      AND policyname = 'subscription_plans_modify_service'
  ) THEN
    CREATE POLICY "subscription_plans_modify_service" ON public.subscription_plans
      FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'organization_subscriptions'
      AND policyname = 'org_subscriptions_modify_service'
  ) THEN
    CREATE POLICY "org_subscriptions_modify_service" ON public.organization_subscriptions
      FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'subscription_usage'
      AND policyname = 'subscription_usage_modify_service'
  ) THEN
    CREATE POLICY "subscription_usage_modify_service" ON public.subscription_usage
      FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;
