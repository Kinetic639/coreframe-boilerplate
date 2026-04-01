-- =====================================================
-- MIGRATION 3: ADD-ONS AND OVERRIDES TABLES
-- Purpose: Create organization_module_addons and
--          organization_limit_overrides tables with RLS
-- =====================================================

-- 1. Module addons table
CREATE TABLE IF NOT EXISTS public.organization_module_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  module_slug TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled')),
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique constraint: one active addon per module per org
CREATE UNIQUE INDEX IF NOT EXISTS idx_org_module_addons_active
  ON public.organization_module_addons(organization_id, module_slug)
  WHERE status = 'active';

-- Lookup index
CREATE INDEX IF NOT EXISTS idx_org_module_addons_org
  ON public.organization_module_addons(organization_id);

-- RLS
ALTER TABLE public.organization_module_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_module_addons FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'organization_module_addons'
      AND policyname = 'org_module_addons_select_member'
  ) THEN
    CREATE POLICY "org_module_addons_select_member" ON public.organization_module_addons
      FOR SELECT TO authenticated
      USING (public.is_org_member(organization_id));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'organization_module_addons'
      AND policyname = 'org_module_addons_modify_service'
  ) THEN
    CREATE POLICY "org_module_addons_modify_service" ON public.organization_module_addons
      FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Updated_at trigger
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_org_module_addons_updated_at'
  ) THEN
    CREATE TRIGGER update_org_module_addons_updated_at
      BEFORE UPDATE ON public.organization_module_addons
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

COMMENT ON TABLE public.organization_module_addons IS 'Per-org module add-ons (beyond base plan modules)';

-- 2. Limit overrides table
CREATE TABLE IF NOT EXISTS public.organization_limit_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  limit_key TEXT NOT NULL,
  override_value INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique constraint: one override per limit key per org
CREATE UNIQUE INDEX IF NOT EXISTS idx_org_limit_overrides_unique
  ON public.organization_limit_overrides(organization_id, limit_key);

-- Lookup index
CREATE INDEX IF NOT EXISTS idx_org_limit_overrides_org
  ON public.organization_limit_overrides(organization_id);

-- RLS
ALTER TABLE public.organization_limit_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_limit_overrides FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'organization_limit_overrides'
      AND policyname = 'org_limit_overrides_select_member'
  ) THEN
    CREATE POLICY "org_limit_overrides_select_member" ON public.organization_limit_overrides
      FOR SELECT TO authenticated
      USING (public.is_org_member(organization_id));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'organization_limit_overrides'
      AND policyname = 'org_limit_overrides_modify_service'
  ) THEN
    CREATE POLICY "org_limit_overrides_modify_service" ON public.organization_limit_overrides
      FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Updated_at trigger
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_org_limit_overrides_updated_at'
  ) THEN
    CREATE TRIGGER update_org_limit_overrides_updated_at
      BEFORE UPDATE ON public.organization_limit_overrides
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

COMMENT ON TABLE public.organization_limit_overrides IS 'Per-org limit overrides (override plan defaults). limit_key uses flat namespaced format: module.limit_name';
