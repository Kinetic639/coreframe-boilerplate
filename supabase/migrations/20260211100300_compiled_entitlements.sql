-- =====================================================
-- MIGRATION 4: COMPILED ENTITLEMENTS
-- Purpose: Create organization_entitlements table + recompute functions + triggers
-- All SECURITY DEFINER functions use SET search_path TO ''
-- and fully qualify all table/function references.
-- =====================================================

-- 1. Create organization_entitlements table
CREATE TABLE IF NOT EXISTS public.organization_entitlements (
  organization_id UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES public.subscription_plans(id),
  plan_name TEXT NOT NULL,
  enabled_modules TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  enabled_contexts TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  features JSONB NOT NULL DEFAULT '{}'::jsonb,
  limits JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. RLS
ALTER TABLE public.organization_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_entitlements FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'organization_entitlements'
      AND policyname = 'organization_entitlements_select_policy'
  ) THEN
    CREATE POLICY "organization_entitlements_select_policy" ON public.organization_entitlements
      FOR SELECT TO authenticated
      USING (public.is_org_member(organization_id));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'organization_entitlements'
      AND policyname = 'organization_entitlements_modify_policy'
  ) THEN
    CREATE POLICY "organization_entitlements_modify_policy" ON public.organization_entitlements
      FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

COMMENT ON TABLE public.organization_entitlements IS 'Compiled entitlements snapshot per organization (single source of truth for SSR)';

-- 3. Recompute function
-- CRITICAL: SECURITY DEFINER because it writes to FORCE RLS table.
-- Function owner (postgres) has rolbypassrls = true.
-- ALL references are fully qualified (public.*) because search_path is empty.
CREATE OR REPLACE FUNCTION public.recompute_organization_entitlements(p_org_id UUID)
RETURNS void AS $$
DECLARE
  v_subscription RECORD;
  v_plan RECORD;
  v_modules TEXT[];
  v_contexts TEXT[];
  v_features JSONB;
  v_limits JSONB;
  v_addon RECORD;
  v_override RECORD;
BEGIN
  -- Advisory lock: per-org, prevents concurrent recomputes for the SAME org.
  -- hashtext(p_org_id::text) returns a stable int4 hash of the UUID string.
  -- Different orgs get different lock keys → no cross-org contention.
  -- pg_advisory_xact_lock auto-releases at transaction end.
  PERFORM pg_advisory_xact_lock(hashtext(p_org_id::text));

  -- 1. Get active subscription
  SELECT * INTO v_subscription
  FROM public.organization_subscriptions
  WHERE organization_id = p_org_id
    AND status = 'active'
  LIMIT 1;

  -- If no subscription, default to free plan
  IF v_subscription IS NULL THEN
    SELECT * INTO v_plan
    FROM public.subscription_plans
    WHERE name = 'free'
      AND is_active = true
    LIMIT 1;

    IF v_plan IS NULL THEN
      RAISE EXCEPTION 'No free plan found in public.subscription_plans';
    END IF;
  ELSE
    -- Get plan details
    SELECT * INTO v_plan
    FROM public.subscription_plans
    WHERE id = v_subscription.plan_id;
  END IF;

  -- 2. Build modules list (plan + active addons)
  v_modules := v_plan.enabled_modules;

  FOR v_addon IN
    SELECT module_slug FROM public.organization_module_addons
    WHERE organization_id = p_org_id
      AND status = 'active'
      AND (ends_at IS NULL OR ends_at > NOW())
  LOOP
    v_modules := array_append(v_modules, v_addon.module_slug);
  END LOOP;

  -- Remove duplicates
  v_modules := ARRAY(SELECT DISTINCT unnest(v_modules));

  -- 3. Contexts (from plan only for now)
  v_contexts := v_plan.enabled_contexts;

  -- 4. Features (from plan only for now)
  v_features := v_plan.features;

  -- 5. Limits (plan base + overrides)
  -- Limits use FLAT JSONB keys: "warehouse.max_products", NOT nested.
  -- jsonb_set path ARRAY['warehouse.max_products'] = single top-level key (not nested path).
  v_limits := v_plan.limits;

  FOR v_override IN
    SELECT limit_key, override_value FROM public.organization_limit_overrides
    WHERE organization_id = p_org_id
  LOOP
    v_limits := jsonb_set(
      COALESCE(v_limits, '{}'::jsonb),
      ARRAY[v_override.limit_key],
      to_jsonb(v_override.override_value),
      true
    );
  END LOOP;

  -- 6. Upsert compiled entitlements
  INSERT INTO public.organization_entitlements (
    organization_id,
    plan_id,
    plan_name,
    enabled_modules,
    enabled_contexts,
    features,
    limits,
    updated_at
  ) VALUES (
    p_org_id,
    v_plan.id,
    v_plan.name,
    v_modules,
    v_contexts,
    v_features,
    v_limits,
    NOW()
  )
  ON CONFLICT (organization_id) DO UPDATE SET
    plan_id = EXCLUDED.plan_id,
    plan_name = EXCLUDED.plan_name,
    enabled_modules = EXCLUDED.enabled_modules,
    enabled_contexts = EXCLUDED.enabled_contexts,
    features = EXCLUDED.features,
    limits = EXCLUDED.limits,
    updated_at = NOW();

END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '';

-- 4. Trigger function
-- SECURITY DEFINER + search_path TO '' — must use public.recompute_organization_entitlements()
CREATE OR REPLACE FUNCTION public.trigger_recompute_entitlements()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.recompute_organization_entitlements(
    COALESCE(NEW.organization_id, OLD.organization_id)
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '';

-- 5. Create triggers (idempotent: drop first)

-- On organization_subscriptions
DROP TRIGGER IF EXISTS recompute_on_subscription_change ON public.organization_subscriptions;
CREATE TRIGGER recompute_on_subscription_change
  AFTER INSERT OR UPDATE OR DELETE ON public.organization_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_recompute_entitlements();

-- On organization_module_addons
DROP TRIGGER IF EXISTS recompute_on_addon_change ON public.organization_module_addons;
CREATE TRIGGER recompute_on_addon_change
  AFTER INSERT OR UPDATE OR DELETE ON public.organization_module_addons
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_recompute_entitlements();

-- On organization_limit_overrides
DROP TRIGGER IF EXISTS recompute_on_override_change ON public.organization_limit_overrides;
CREATE TRIGGER recompute_on_override_change
  AFTER INSERT OR UPDATE OR DELETE ON public.organization_limit_overrides
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_recompute_entitlements();

-- 6. Admin recompute-all function
-- SECURITY DEFINER + search_path TO '' — must use public.recompute_organization_entitlements()
CREATE OR REPLACE FUNCTION public.recompute_all_entitlements()
RETURNS INTEGER AS $$
DECLARE
  v_org_id UUID;
  v_count INTEGER := 0;
BEGIN
  FOR v_org_id IN
    SELECT id FROM public.organizations WHERE deleted_at IS NULL
  LOOP
    PERFORM public.recompute_organization_entitlements(v_org_id);
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '';
