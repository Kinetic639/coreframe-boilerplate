-- =============================================================================
-- HARDENING PHASE 3: Entitlements Recompute on UPDATE
-- Goal: Ensure organization_entitlements is never stale after plan upgrade,
--       addon status change, or limit override modification.
-- Existing INSERT triggers already handled; this adds UPDATE coverage.
-- =============================================================================

-- ─── A. Subscription UPDATE trigger ─────────────────────────────────────────
-- Fire when plan_id or status changes (e.g. upgrade, downgrade, cancellation).

DROP TRIGGER IF EXISTS recompute_on_subscription_update ON public.organization_subscriptions;
CREATE TRIGGER recompute_on_subscription_update
  AFTER UPDATE OF plan_id, status
  ON public.organization_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_recompute_entitlements();

-- ─── B. Module addon UPDATE trigger ──────────────────────────────────────────
-- Fire when an addon is activated or deactivated (status changes).

DROP TRIGGER IF EXISTS recompute_on_addon_update ON public.organization_module_addons;
CREATE TRIGGER recompute_on_addon_update
  AFTER UPDATE OF status
  ON public.organization_module_addons
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_recompute_entitlements();

-- ─── C. Limit override UPDATE trigger ────────────────────────────────────────
-- Fire when an existing limit override value is changed.

DROP TRIGGER IF EXISTS recompute_on_override_update ON public.organization_limit_overrides;
CREATE TRIGGER recompute_on_override_update
  AFTER UPDATE OF limit_value
  ON public.organization_limit_overrides
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_recompute_entitlements();
