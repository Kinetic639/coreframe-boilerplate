-- =============================================================================
-- CORRECTIVE PASS — Phase 8: subscription_plans → entitlements cascade
-- Gap: editing a plan's enabled_modules / limits / contexts does not
-- automatically recompute organization_entitlements for subscriber orgs.
--
-- Fix: AFTER UPDATE trigger on subscription_plans fans out
-- recompute_organization_entitlements to all active/trialing subscribers.
--
-- Fan-out is bounded: at most one recompute per subscriber org per plan
-- change. Each recompute is guarded by pg_advisory_xact_lock(org_id) so
-- concurrent calls for the same org serialise safely.
-- =============================================================================

-- ─── 1. Fan-out trigger function ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trigger_recompute_on_plan_update()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  v_org record;
BEGIN
  FOR v_org IN
    SELECT organization_id
      FROM public.organization_subscriptions
     WHERE plan_id = NEW.id
       AND status  IN ('active', 'trialing')
  LOOP
    PERFORM public.recompute_organization_entitlements(v_org.organization_id);
  END LOOP;
  RETURN NEW;
END;
$$;

-- Trigger helper is internal; revoke PUBLIC EXECUTE.
REVOKE EXECUTE ON FUNCTION public.trigger_recompute_on_plan_update() FROM PUBLIC;

-- ─── 2. Trigger on subscription_plans ────────────────────────────────────────
-- Only fire when the columns that drive entitlements actually change.
-- is_active changes are NOT included — when a plan is deactivated the org's
-- own subscription row will be updated (status change), which already fires
-- the existing recompute_on_subscription_change trigger.
DROP TRIGGER IF EXISTS recompute_on_plan_definition_update ON public.subscription_plans;
CREATE TRIGGER recompute_on_plan_definition_update
  AFTER UPDATE OF enabled_modules, limits, contexts
  ON public.subscription_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_recompute_on_plan_update();
