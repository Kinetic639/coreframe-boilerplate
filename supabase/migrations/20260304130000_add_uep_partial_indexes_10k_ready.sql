-- =============================================================================
-- UEP Partial Index Strategy — "10k-ready" performance package
-- =============================================================================
--
-- Problem: The existing full-table indexes on user_effective_permissions cannot
-- be used effectively by:
--   1) has_permission / user_has_effective_permission (WHERE branch_id IS NULL)
--   2) has_branch_permission (WHERE branch_id IS NULL OR branch_id = X — OR defeats indexes)
--   3) getPermissionSnapshotForUser two-query strategy (after 2A rewrite)
--
-- Solution: Two partial indexes that cover the two distinct access patterns.
--
-- Note: CREATE INDEX CONCURRENTLY cannot run inside a transaction.
-- Supabase MCP apply_migration runs DDL inside a transaction block, so we use
-- regular CREATE INDEX (holds exclusive lock during build; acceptable at deploy time).
-- For zero-downtime index builds on large tables, run CONCURRENTLY manually via psql.
-- =============================================================================

-- (1) Org-scope partial index
-- Covers: has_permission, user_has_effective_permission, getOrgEffectivePermissions*,
--         and Query 1 of the two-query getPermissionSnapshotForUser.
-- Predicate: branch_id IS NULL — only org-scoped rows, ignores all branch rows.
-- Column order: organization_id first (RLS pattern), then user_id, then permission_slug.
CREATE INDEX IF NOT EXISTS uep_org_exact_active_idx
  ON public.user_effective_permissions (organization_id, user_id, permission_slug)
  WHERE branch_id IS NULL;

-- (2) Branch-scope partial index
-- Covers: has_branch_permission (branch_id = X path), and Query 2 of the two-query
--         getPermissionSnapshotForUser when branchId is set.
-- Predicate: branch_id IS NOT NULL — only branch-scoped rows, ignores org rows.
-- Column order: organization_id, user_id, branch_id (exact match), permission_slug.
CREATE INDEX IF NOT EXISTS uep_branch_exact_active_idx
  ON public.user_effective_permissions (organization_id, user_id, branch_id, permission_slug)
  WHERE branch_id IS NOT NULL;
