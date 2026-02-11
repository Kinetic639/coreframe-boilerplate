-- =====================================================
-- MIGRATION 7: DEV MODE GATE AND DEV RPCs
-- Purpose: Create app_config table, dev mode gate function,
--          is_org_owner helper, and 6 dev_* RPCs.
-- All SECURITY DEFINER functions: SET search_path TO ''
-- All references fully qualified with public.*
-- Includes REVOKE/GRANT privilege hardening.
-- =====================================================

-- =====================================================
-- 1. APP CONFIG TABLE (single-row, stores system flags)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.app_config (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),  -- enforce single row
  dev_mode_enabled BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed: dev mode OFF by default (safe for production).
-- NEVER seed as true — if this migration leaks to prod, dev RPCs remain inert.
INSERT INTO public.app_config (id, dev_mode_enabled)
VALUES (1, false)
ON CONFLICT (id) DO NOTHING;

-- RLS: readable by authenticated, writable by service_role only
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_config FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'app_config'
      AND policyname = 'app_config_select'
  ) THEN
    CREATE POLICY "app_config_select" ON public.app_config
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'app_config'
      AND policyname = 'app_config_modify'
  ) THEN
    CREATE POLICY "app_config_modify" ON public.app_config
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

COMMENT ON TABLE public.app_config IS 'Single-row system configuration. dev_mode_enabled must be false in production.';

-- =====================================================
-- 2. DEV MODE GATE FUNCTION
-- Must be called as FIRST statement in every dev_* RPC.
-- =====================================================
CREATE OR REPLACE FUNCTION public.assert_dev_mode_enabled()
RETURNS void AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.app_config WHERE id = 1 AND dev_mode_enabled = true
  ) THEN
    RAISE EXCEPTION 'Dev mode is not enabled. Set app_config.dev_mode_enabled = true to use dev RPCs.';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '';

-- =====================================================
-- 3. ORG OWNER CHECK (Permissions V2 role-based)
-- Uses user_role_assignments + roles tables.
-- Does NOT use organizations.created_by.
-- =====================================================
CREATE OR REPLACE FUNCTION public.is_org_owner(p_org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_role_assignments ura
    JOIN public.roles r ON r.id = ura.role_id
    WHERE ura.user_id = auth.uid()
      AND ura.scope = 'org'
      AND ura.scope_id = p_org_id
      AND r.name = 'org_owner'
      AND ura.deleted_at IS NULL
      AND r.deleted_at IS NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '';

-- =====================================================
-- 4. DEV RPCs
-- Every function:
--   1st line: PERFORM public.assert_dev_mode_enabled();
--   2nd: IF NOT public.is_org_owner(...) THEN RAISE
--   All table refs: public.table_name
--   All function refs: public.function_name()
-- =====================================================

-- Dev: Set org plan
CREATE OR REPLACE FUNCTION public.dev_set_org_plan(
  p_org_id UUID,
  p_plan_name TEXT
)
RETURNS void AS $$
DECLARE
  v_plan_id UUID;
BEGIN
  -- Gate: dev mode must be enabled in DB
  PERFORM public.assert_dev_mode_enabled();

  -- Guard: must be org owner (role-based via Permissions V2)
  IF NOT public.is_org_owner(p_org_id) THEN
    RAISE EXCEPTION 'Permission denied: not org owner';
  END IF;

  -- Get plan ID
  SELECT id INTO v_plan_id
  FROM public.subscription_plans
  WHERE name = p_plan_name AND is_active = true;

  IF v_plan_id IS NULL THEN
    RAISE EXCEPTION 'Plan not found: %', p_plan_name;
  END IF;

  -- Upsert subscription
  INSERT INTO public.organization_subscriptions (
    organization_id,
    plan_id,
    status,
    is_development,
    dev_expires_at,
    current_period_start,
    current_period_end
  ) VALUES (
    p_org_id,
    v_plan_id,
    'active',
    true,
    NOW() + INTERVAL '30 days',
    NOW(),
    NOW() + INTERVAL '30 days'
  )
  ON CONFLICT (organization_id) DO UPDATE SET
    plan_id = v_plan_id,
    status = 'active',
    is_development = true,
    dev_expires_at = NOW() + INTERVAL '30 days',
    updated_at = NOW();

  -- Recompute entitlements (trigger fires automatically on UPDATE)
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '';

-- Dev: Add module addon
-- Uses UPDATE-then-INSERT pattern because the uniqueness constraint is a
-- partial unique INDEX (WHERE status='active'), which cannot be targeted
-- by ON CONFLICT.
CREATE OR REPLACE FUNCTION public.dev_add_module_addon(
  p_org_id UUID,
  p_module_slug TEXT
)
RETURNS void AS $$
BEGIN
  PERFORM public.assert_dev_mode_enabled();
  IF NOT public.is_org_owner(p_org_id) THEN
    RAISE EXCEPTION 'Permission denied: not org owner';
  END IF;

  -- Try to touch an existing active addon row
  UPDATE public.organization_module_addons
  SET updated_at = NOW(), status = 'active', ends_at = NULL
  WHERE organization_id = p_org_id
    AND module_slug = p_module_slug
    AND status = 'active';

  -- If no active row existed, insert a new one
  IF NOT FOUND THEN
    INSERT INTO public.organization_module_addons (
      organization_id,
      module_slug,
      status,
      starts_at
    ) VALUES (
      p_org_id,
      p_module_slug,
      'active',
      NOW()
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '';

-- Dev: Remove module addon
CREATE OR REPLACE FUNCTION public.dev_remove_module_addon(
  p_org_id UUID,
  p_module_slug TEXT
)
RETURNS void AS $$
BEGIN
  PERFORM public.assert_dev_mode_enabled();
  IF NOT public.is_org_owner(p_org_id) THEN
    RAISE EXCEPTION 'Permission denied: not org owner';
  END IF;

  UPDATE public.organization_module_addons
  SET status = 'canceled', ends_at = NOW()
  WHERE organization_id = p_org_id
    AND module_slug = p_module_slug
    AND status = 'active';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '';

-- Dev: Set limit override
CREATE OR REPLACE FUNCTION public.dev_set_limit_override(
  p_org_id UUID,
  p_limit_key TEXT,
  p_override_value INTEGER
)
RETURNS void AS $$
BEGIN
  PERFORM public.assert_dev_mode_enabled();
  IF NOT public.is_org_owner(p_org_id) THEN
    RAISE EXCEPTION 'Permission denied: not org owner';
  END IF;

  INSERT INTO public.organization_limit_overrides (
    organization_id,
    limit_key,
    override_value
  ) VALUES (
    p_org_id,
    p_limit_key,
    p_override_value
  )
  ON CONFLICT (organization_id, limit_key) DO UPDATE SET
    override_value = p_override_value,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '';

-- Dev: Reset org to free plan
CREATE OR REPLACE FUNCTION public.dev_reset_org_to_free(p_org_id UUID)
RETURNS void AS $$
BEGIN
  PERFORM public.assert_dev_mode_enabled();
  IF NOT public.is_org_owner(p_org_id) THEN
    RAISE EXCEPTION 'Permission denied: not org owner';
  END IF;

  -- Remove addons
  DELETE FROM public.organization_module_addons WHERE organization_id = p_org_id;

  -- Remove overrides
  DELETE FROM public.organization_limit_overrides WHERE organization_id = p_org_id;

  -- Set to free plan (dev_set_org_plan will re-check dev mode — safe redundancy)
  PERFORM public.dev_set_org_plan(p_org_id, 'free');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '';

-- Dev: Simulate subscription change (like webhook)
CREATE OR REPLACE FUNCTION public.dev_simulate_subscription_change(
  p_org_id UUID,
  p_event_type TEXT,
  p_plan_name TEXT
)
RETURNS void AS $$
BEGIN
  PERFORM public.assert_dev_mode_enabled();
  IF NOT public.is_org_owner(p_org_id) THEN
    RAISE EXCEPTION 'Permission denied: not org owner';
  END IF;

  CASE p_event_type
    WHEN 'subscription.created', 'subscription.updated' THEN
      PERFORM public.dev_set_org_plan(p_org_id, p_plan_name);
    WHEN 'subscription.canceled' THEN
      UPDATE public.organization_subscriptions
      SET status = 'canceled', updated_at = NOW()
      WHERE organization_id = p_org_id;
    ELSE
      RAISE EXCEPTION 'Unknown event type: %', p_event_type;
  END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '';

-- =====================================================
-- 5. PRIVILEGE HARDENING
-- Supabase default ACL auto-grants EXECUTE to anon, authenticated, service_role.
-- Dev RPCs must NOT be callable by anon. Restrict to authenticated + service_role.
-- =====================================================

REVOKE ALL ON FUNCTION public.dev_set_org_plan(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dev_set_org_plan(UUID, TEXT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.dev_add_module_addon(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dev_add_module_addon(UUID, TEXT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.dev_remove_module_addon(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dev_remove_module_addon(UUID, TEXT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.dev_set_limit_override(UUID, TEXT, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dev_set_limit_override(UUID, TEXT, INTEGER) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.dev_reset_org_to_free(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dev_reset_org_to_free(UUID) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.dev_simulate_subscription_change(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dev_simulate_subscription_change(UUID, TEXT, TEXT) TO authenticated, service_role;

-- Also restrict helper functions
REVOKE ALL ON FUNCTION public.assert_dev_mode_enabled() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assert_dev_mode_enabled() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_org_owner(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_org_owner(UUID) TO authenticated, service_role;

-- =====================================================
-- TO ENABLE DEV MODE (run manually in dev environment ONLY):
--   UPDATE public.app_config SET dev_mode_enabled = true WHERE id = 1;
-- Or add a dev-only seed script that is NOT deployed to production.
-- =====================================================
