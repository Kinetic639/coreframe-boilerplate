-- ============================================================================
-- TEST: Setup and Environment Verification
-- ============================================================================
BEGIN;

SELECT plan(5);

-- Test 1: pgTAP extension is available
SELECT has_extension('pgtap', 'pgTAP extension is installed');

-- Test 2: Basic assertion works
SELECT ok(true, 'Basic assertion passes');

-- Test 3: Simple equality test
SELECT is(1 + 1, 2, 'Math works correctly');

-- Test 4: Test that we can access a known table
SELECT has_table('public', 'permissions', 'permissions table exists');

-- Test 5: Test helper functions exist (checking function name only, not params)
SELECT ok(
  EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'has_permission'),
  'has_permission function exists'
);

SELECT * FROM finish();

ROLLBACK;
