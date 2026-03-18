-- ============================================================================
-- TEST: Performance Tests (5 tests)
-- ============================================================================
BEGIN;

SELECT plan(5);

-- Test 1: user_effective_permissions has index on user_id
SELECT ok(
  EXISTS(SELECT 1 FROM pg_indexes
         WHERE tablename = 'user_effective_permissions'
         AND indexdef LIKE '%user_id%'),
  'user_effective_permissions has index on user_id'
);

-- Test 2: user_effective_permissions has index on organization_id
SELECT ok(
  EXISTS(SELECT 1 FROM pg_indexes
         WHERE tablename = 'user_effective_permissions'
         AND indexdef LIKE '%organization_id%'),
  'user_effective_permissions has index on organization_id'
);

-- Test 3: organization_members has index on user_id
SELECT ok(
  EXISTS(SELECT 1 FROM pg_indexes
         WHERE tablename = 'organization_members'
         AND indexdef LIKE '%user_id%'),
  'organization_members has index on user_id'
);

-- Test 4: organization_members has index on organization_id
SELECT ok(
  EXISTS(SELECT 1 FROM pg_indexes
         WHERE tablename = 'organization_members'
         AND indexdef LIKE '%organization_id%'),
  'organization_members has index on organization_id'
);

-- Test 5: user_role_assignments has index on user_id
SELECT ok(
  EXISTS(SELECT 1 FROM pg_indexes
         WHERE tablename = 'user_role_assignments'
         AND indexdef LIKE '%user_id%'),
  'user_role_assignments has index on user_id'
);

SELECT * FROM finish();
ROLLBACK;
