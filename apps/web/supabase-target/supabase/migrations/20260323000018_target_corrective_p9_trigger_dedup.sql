-- =============================================================================
-- CORRECTIVE PASS — Phase 9: Remove Redundant Triggers
--
-- Six triggers are fully covered by broader AFTER INSERT OR DELETE OR UPDATE
-- triggers on the same table calling the same (or equivalent) function.
-- The narrow triggers were added as targeted fixes during hardening phases
-- P2 and P3, but in all cases the existing "any-event" trigger already
-- handled those events correctly.
--
-- Keeping both triggers causes double-compilation / double-recompute on
-- DELETE and soft-delete UPDATE events — wasteful but not incorrect.
-- This migration removes the redundant narrow triggers.
--
-- TRIGGER COVERAGE AFTER THIS MIGRATION (unchanged semantics):
--
--   user_role_assignments
--     trigger_role_assignment_compile  AFTER INSERT OR DELETE OR UPDATE  ← kept
--
--   role_permissions
--     trigger_role_permission_compile  AFTER INSERT OR DELETE OR UPDATE  ← kept
--
--   user_permission_overrides
--     trigger_override_compile         AFTER INSERT OR DELETE OR UPDATE  ← kept
--
--   organization_subscriptions
--     recompute_on_subscription_change AFTER INSERT OR DELETE OR UPDATE  ← kept
--
--   organization_module_addons
--     recompute_on_addon_change        AFTER INSERT OR DELETE OR UPDATE  ← kept
--
--   organization_limit_overrides
--     recompute_on_override_change     AFTER INSERT OR DELETE OR UPDATE  ← kept
-- =============================================================================

-- ─── Permission compile: remove narrow soft-delete / delete duplicates ────────

-- Covered by trigger_role_assignment_compile (INSERT OR DELETE OR UPDATE).
DROP TRIGGER IF EXISTS trg_ura_compile_remove ON public.user_role_assignments;

-- Covered by trigger_role_permission_compile (INSERT OR DELETE OR UPDATE).
-- trigger_compile_on_role_permission was updated in P7 to handle both org
-- and branch scopes, making trg_rp_compile_remove fully redundant.
DROP TRIGGER IF EXISTS trg_rp_compile_remove ON public.role_permissions;

-- Covered by trigger_override_compile (INSERT OR DELETE OR UPDATE).
DROP TRIGGER IF EXISTS trg_override_compile_remove ON public.user_permission_overrides;

-- ─── Entitlements recompute: remove narrow UPDATE-only duplicates ─────────────

-- Covered by recompute_on_subscription_change (INSERT OR DELETE OR UPDATE).
DROP TRIGGER IF EXISTS recompute_on_subscription_update ON public.organization_subscriptions;

-- Covered by recompute_on_addon_change (INSERT OR DELETE OR UPDATE).
DROP TRIGGER IF EXISTS recompute_on_addon_update ON public.organization_module_addons;

-- Covered by recompute_on_override_change (INSERT OR DELETE OR UPDATE).
DROP TRIGGER IF EXISTS recompute_on_override_update ON public.organization_limit_overrides;

-- ─── Orphaned narrow-trigger functions ───────────────────────────────────────
-- These functions were the backing implementations for the removed triggers.
-- With no trigger referencing them they become dead code. Drop for cleanliness.
-- (Functions are SECURITY DEFINER; leaving unused privileged code is itself a
--  minor security smell.)
DROP FUNCTION IF EXISTS public.trigger_compile_on_ura_remove();
DROP FUNCTION IF EXISTS public.trigger_compile_on_rp_remove();
DROP FUNCTION IF EXISTS public.trigger_compile_on_override_remove();
