-- =============================================================================
-- HARDENING PHASE 3: Entitlements Recompute on UPDATE
-- Goal: Ensure organization_entitlements is never stale after plan upgrade,
--       addon status change, or limit override modification.
--
-- NOTE (post P9 audit): The three triggers created in this migration
-- (recompute_on_subscription_update, recompute_on_addon_update,
-- recompute_on_override_update) were later found to be redundant.
-- The existing *_change triggers (recompute_on_subscription_change,
-- recompute_on_addon_change, recompute_on_override_change) already fired on
-- AFTER INSERT OR DELETE OR UPDATE — including all UPDATE events — so no
-- coverage gap existed. The narrow triggers were removed in migration
-- 20260323000018_target_corrective_p9_trigger_dedup. This migration is
-- preserved as-is for historical record; the DROP TRIGGER IF EXISTS guards
-- ensure it is idempotent on replay.
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
