-- ============================================================================
-- TEST: Security Helper Functions
-- ============================================================================
-- Tests for is_org_member() and has_permission() helper functions

BEGIN;

SELECT plan(8);

-- ============================================================================
-- SETUP: Test helper function signatures and security attributes
-- ============================================================================

-- Test 1: is_org_member function exists with correct signature
SELECT has_function(
  'public',
  'is_org_member',
  ARRAY['uuid'],
  'is_org_member(uuid) function exists'
);

-- Test 2: is_org_member returns boolean
SELECT function_returns(
  'public',
  'is_org_member',
  ARRAY['uuid'],
  'boolean',
  'is_org_member returns boolean'
);

-- Test 3: has_permission function exists with correct signature
SELECT has_function(
  'public',
  'has_permission',
  ARRAY['uuid', 'text'],
  'has_permission(uuid, text) function exists'
);

-- Test 4: has_permission returns boolean
SELECT function_returns(
  'public',
  'has_permission',
  ARRAY['uuid', 'text'],
  'boolean',
  'has_permission returns boolean'
);

-- Test 5: Verify functions are SECURITY DEFINER
SELECT ok(
  (SELECT prosecdef FROM pg_proc WHERE proname = 'is_org_member' LIMIT 1),
  'is_org_member is SECURITY DEFINER'
);

SELECT ok(
  (SELECT prosecdef FROM pg_proc WHERE proname = 'has_permission' LIMIT 1),
  'has_permission is SECURITY DEFINER'
);

-- Test 6: Verify functions are STABLE
SELECT is(
  (SELECT provolatile FROM pg_proc WHERE proname = 'is_org_member' LIMIT 1),
  's',
  'is_org_member is STABLE'
);

SELECT is(
  (SELECT provolatile FROM pg_proc WHERE proname = 'has_permission' LIMIT 1),
  's',
  'has_permission is STABLE'
);

SELECT * FROM finish();

ROLLBACK;
