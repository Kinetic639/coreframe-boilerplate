-- =============================================================================
-- HARDENING PHASE 5: Performance Indexes
-- Goal: Add missing partial indexes to eliminate the performance gaps
--       identified in the security audit.
--
-- NOTE: CREATE INDEX cannot run with CONCURRENTLY inside a transaction block
--       (Supabase migrations). These use plain CREATE INDEX IF NOT EXISTS
--       which takes a ShareLock. Apply during low-traffic window.
-- =============================================================================

-- ─── 1. is_org_member hot-path partial index ─────────────────────────────────
-- is_org_member() is called on virtually every authenticated RLS evaluation.
-- The existing idx_organization_members_user_org does not filter on
-- status/deleted_at. This partial index eliminates the extra predicate
-- evaluation on every call.
CREATE INDEX IF NOT EXISTS idx_org_members_active_lookup
  ON public.organization_members (organization_id, user_id)
  WHERE status = 'active' AND deleted_at IS NULL;

-- ─── 2. org_positions lookup index ───────────────────────────────────────────
-- Queries for active positions in an org (e.g. list positions for org).
CREATE INDEX IF NOT EXISTS idx_org_positions_org_active
  ON public.org_positions (org_id)
  WHERE deleted_at IS NULL;

-- ─── 3. org_position_assignments user/org lookup ─────────────────────────────
-- Queries for a user's positions within an org, and for listing all
-- position assignments in an org.
CREATE INDEX IF NOT EXISTS idx_org_pos_assignments_org_user
  ON public.org_position_assignments (org_id, user_id)
  WHERE deleted_at IS NULL;

-- ─── 4. user_role_assignments compiler index (scope + user) ──────────────────
-- The compile trigger fan-out for role_permissions removal scans URA by
-- (role_id, deleted_at). Add a partial index to make that scan efficient.
CREATE INDEX IF NOT EXISTS idx_ura_role_active
  ON public.user_role_assignments (role_id)
  WHERE deleted_at IS NULL;
