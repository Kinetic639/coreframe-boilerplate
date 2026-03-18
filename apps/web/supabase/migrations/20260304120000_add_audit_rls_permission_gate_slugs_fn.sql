-- audit_rls_permission_gate_slugs()
--
-- Read-only introspection helper for RLS wildcard invariant testing.
-- Extracts all string literals from RLS policy expressions (qual + with_check)
-- on public-schema tables where the expression calls has_permission,
-- has_branch_permission, or user_has_effective_permission.
--
-- Purpose: allow integration tests to assert that no wildcard slug ("*")
-- is used in RLS permission gates without needing direct pg_catalog access
-- via PostgREST.
--
-- Callable by: service_role only (not anon / authenticated).
-- No data is returned — only schema metadata (policy expression strings).

CREATE OR REPLACE FUNCTION public.audit_rls_permission_gate_slugs()
RETURNS TABLE(slug text, policy_name text, table_name text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT DISTINCT
    m[1]             AS slug,
    policyname::text AS policy_name,
    tablename::text  AS table_name
  FROM pg_policies,
    LATERAL regexp_matches(
      coalesce(qual, '') || ' ' || coalesce(with_check, ''),
      '''([^'']+)''',
      'g'
    ) m
  WHERE schemaname = 'public'
    AND (
      qual       LIKE '%has_permission%'
      OR qual    LIKE '%has_branch_permission%'
      OR qual    LIKE '%user_has_effective_permission%'
      OR with_check LIKE '%has_permission%'
      OR with_check LIKE '%has_branch_permission%'
      OR with_check LIKE '%user_has_effective_permission%'
    )
  ORDER BY 1, 2, 3;
$$;

-- Restrict access: revoke from PUBLIC, grant only to service_role.
-- Anon / authenticated roles must NOT be able to enumerate policy expressions.
REVOKE EXECUTE ON FUNCTION public.audit_rls_permission_gate_slugs() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.audit_rls_permission_gate_slugs() TO service_role;
