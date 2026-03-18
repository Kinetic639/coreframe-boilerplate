-- audit_uep_partial_indexes()
--
-- Read-only introspection helper for UEP partial index verification testing.
-- Returns the index name and full index definition for the two 10k-ready
-- partial indexes on public.user_effective_permissions.
--
-- Purpose: allow integration tests to assert that the partial indexes exist
-- and have the correct predicate (WHERE clause) without needing direct
-- pg_catalog access via PostgREST (which is blocked).
--
-- Callable by: service_role only (not anon / authenticated).
-- No data rows are returned — only schema metadata (index definitions).

CREATE OR REPLACE FUNCTION public.audit_uep_partial_indexes()
RETURNS TABLE(indexname text, indexdef text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT
    i.indexname::text,
    i.indexdef::text
  FROM pg_indexes i
  WHERE i.schemaname = 'public'
    AND i.tablename  = 'user_effective_permissions'
    AND i.indexname  IN ('uep_org_exact_active_idx', 'uep_branch_exact_active_idx')
  ORDER BY i.indexname;
$$;

-- Restrict access: revoke from PUBLIC, grant only to service_role.
-- Anon / authenticated roles must NOT be able to enumerate index definitions.
REVOKE EXECUTE ON FUNCTION public.audit_uep_partial_indexes() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.audit_uep_partial_indexes() TO service_role;
