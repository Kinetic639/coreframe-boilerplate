-- ============================================================================
-- TEST: RLS Enabled on Critical Tables
-- ============================================================================
-- Verifies that Row Level Security is enabled on all critical permission tables

BEGIN;

SELECT plan(6);

-- ============================================================================
-- Test FORCE RLS on 6 critical tables
-- ============================================================================

-- Test 1: organization_members has FORCE RLS
SELECT ok(
  (SELECT relforcerowsecurity FROM pg_class WHERE relname = 'organization_members'),
  'organization_members has FORCE RLS enabled'
);

-- Test 2: roles has FORCE RLS
SELECT ok(
  (SELECT relforcerowsecurity FROM pg_class WHERE relname = 'roles'),
  'roles has FORCE RLS enabled'
);

-- Test 3: role_permissions has FORCE RLS
SELECT ok(
  (SELECT relforcerowsecurity FROM pg_class WHERE relname = 'role_permissions'),
  'role_permissions has FORCE RLS enabled'
);

-- Test 4: user_role_assignments has FORCE RLS
SELECT ok(
  (SELECT relforcerowsecurity FROM pg_class WHERE relname = 'user_role_assignments'),
  'user_role_assignments has FORCE RLS enabled'
);

-- Test 5: user_permission_overrides has FORCE RLS
SELECT ok(
  (SELECT relforcerowsecurity FROM pg_class WHERE relname = 'user_permission_overrides'),
  'user_permission_overrides has FORCE RLS enabled'
);

-- Test 6: user_effective_permissions has FORCE RLS
SELECT ok(
  (SELECT relforcerowsecurity FROM pg_class WHERE relname = 'user_effective_permissions'),
  'user_effective_permissions has FORCE RLS enabled'
);

SELECT * FROM finish();

ROLLBACK;
