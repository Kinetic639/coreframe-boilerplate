-- =============================================================================
-- Phase 7 Schema Closure — organization_entitlements contract alignment
--
-- This migration is a NO-OP on the live TARGET DB.
-- The organization_entitlements table was correctly defined in:
--   20260320000009_target_p3_b3_entitlement_tables.sql
--
-- It exists to formally close the Phase 7 schema-truth gap and to serve as a
-- reference point in the migration history documenting the decision.
--
-- WHAT THIS CLOSES:
--   The legacy migration apps/web/supabase/migrations/20260211100300_compiled_entitlements.sql
--   defined organization_entitlements with three columns that do not exist in the live DB:
--     - plan_name TEXT  (never existed in TARGET)
--     - features JSONB  (never existed in TARGET)
--     - enabled_contexts TEXT[]  (TARGET uses "contexts", not "enabled_contexts")
--
--   That legacy migration was never applied to the TARGET project. The correct
--   schema (without plan_name, without features, with "contexts") has been in
--   place in TARGET since 20260320000009.
--
-- WHAT WAS FIXED IN APPLICATION CODE (Phase 7 Step 3):
--   - @repo/contracts OrganizationEntitlements: removed plan_name, features;
--     renamed enabled_contexts → contexts
--   - @repo/domain: removed hasFeatureAccess (no production callers; features
--     does not exist in DB)
--   - @repo/testing: updated DEFAULT_ENTITLEMENTS and removed makeEntitlementsWithFeatures
--   - packages/supabase/src/database.types.ts: regenerated from live TARGET DB
--   - apps/mobile normalizer: removed plan_name/features defaulting; direct contexts mapping
--   - apps/web entitlements-service: removed hasFeatureAccess, requireFeatureAccess;
--     fixed requireModuleAccess error context
--   - apps/web organization.service OrgBillingService: SELECT now excludes plan_name/features;
--     plan_name sourced via subscription_plans join
--   - apps/web use-entitlements: removed hasFeature, getPlanName
--   - apps/web entitlements-guards: removed stale ctx.entitlements?.plan_name references
--   - apps/web EntitlementsAdminUI: plan display via plans.find(p => p.id === entitlements.plan_id)
--
-- SOURCE OF TRUTH: Live TARGET DB (project rjeraydumwechpjjzrus)
-- =============================================================================

-- Verify the schema is as expected (informational; raises notice only)
DO $$
DECLARE
  has_plan_name    boolean;
  has_features     boolean;
  has_enabled_ctx  boolean;
  has_contexts     boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'organization_entitlements'
      AND column_name  = 'plan_name'
  ) INTO has_plan_name;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'organization_entitlements'
      AND column_name  = 'features'
  ) INTO has_features;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'organization_entitlements'
      AND column_name  = 'enabled_contexts'
  ) INTO has_enabled_ctx;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'organization_entitlements'
      AND column_name  = 'contexts'
  ) INTO has_contexts;

  IF has_plan_name OR has_features OR has_enabled_ctx THEN
    RAISE WARNING 'organization_entitlements schema mismatch: stale columns present (plan_name=%, features=%, enabled_contexts=%)',
      has_plan_name, has_features, has_enabled_ctx;
  ELSE
    RAISE NOTICE 'organization_entitlements schema verified: no stale columns (contexts=%)', has_contexts;
  END IF;
END;
$$;
