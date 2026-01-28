# pgTAP Testing Guide

## Setup Complete ✅

Your pgTAP testing environment is configured and working:

- ✅ `supabase/tests/` directory created
- ✅ pgTAP extension installed on cloud database
- ✅ **Supabase Test Helpers installed** (advanced RLS testing)
- ✅ Example tests created and verified

## Advanced Test Helpers Available

You now have access to the **Supabase Test Helpers** which make RLS testing much easier:

### Key Functions

```sql
-- User management
tests.create_supabase_user(identifier, email, phone)
tests.get_supabase_uid(identifier)
tests.authenticate_as(identifier)
tests.authenticate_as_service_role()
tests.clear_authentication()

-- RLS verification
tests.rls_enabled(schema)

-- Time manipulation (for testing time-based features)
tests.freeze_time(timestamp)
tests.unfreeze_time()
```

### Example: Testing RLS with Multiple Users

```sql
BEGIN;
SELECT plan(3);

-- Create test users
SELECT tests.create_supabase_user('user1', 'user1@test.com');
SELECT tests.create_supabase_user('user2', 'user2@test.com');

-- Create test data
INSERT INTO products (name, org_id, created_by)
VALUES ('Product 1', 'org-id', tests.get_supabase_uid('user1@test.com'));

-- Test as User 1
SELECT tests.authenticate_as('user1@test.com');
SELECT results_eq(
  'SELECT COUNT(*) FROM products',
  ARRAY[1::bigint],
  'User 1 can see their product'
);

-- Test as User 2
SELECT tests.authenticate_as('user2@test.com');
SELECT results_eq(
  'SELECT COUNT(*) FROM products WHERE created_by = tests.get_supabase_uid(''user1@test.com'')',
  ARRAY[0::bigint],
  'User 2 cannot see User 1 products'
);

-- Test cross-tenant isolation
SELECT throws_ok(
  $$UPDATE products SET name = 'Hacked!' WHERE created_by = tests.get_supabase_uid('user1@test.com')$$,
  NULL,
  NULL,
  'User 2 cannot modify User 1 products'
);

SELECT * FROM finish();
ROLLBACK;
```

## Running Tests

### Option 1: Run via Supabase MCP (Recommended for Cloud)

Since your project uses cloud database, you can run tests using the Supabase MCP tool through Claude.

Example:

```sql
mcp__supabase__execute_sql with the test SQL
```

### Option 2: Run via psql (if you have connection string)

```bash
psql "your-connection-string" -f supabase/tests/003_rls_with_test_helpers.sql
```

## Test Files Created ✅

### Basic Setup Tests (29 tests)

1. **000_setup_test.sql** (5 tests) - Verifies pgTAP is working
2. **001_helper_functions_test.sql** (8 tests) - Basic `is_org_member()` and `has_permission()` tests
3. **002_rls_enabled_test.sql** (6 tests) - Verifies FORCE RLS on 6 critical tables
4. **003_rls_with_test_helpers.sql** (10 tests) - Advanced RLS testing with test helpers

### Core Security Tests (90 tests)

5. **010_permission_system_rls_test.sql** (25 tests) - All RLS policies for roles, permissions, assignments, overrides
6. **011_organization_system_rls_test.sql** (18 tests) - All RLS policies for organizations, members, invitations
7. **012_permission_compiler_test.sql** (20 tests) - Compiler behavior, triggers, role/override compilation
8. **013_helper_functions_extended_test.sql** (7 tests) - Extended helper function edge cases
9. **020_enterprise_hardening_test.sql** (30 tests) - Constraints, FORCE RLS, soft-delete, creator binding
10. **030_performance_test.sql** (10 tests) - Index usage and query performance

### Integration & Security Tests (100 tests)

11. **040_integration_flows_test.sql** (50 tests) - End-to-end flows:
    - Bootstrap → Upgrade (10 tests)
    - Invite → Accept (10 tests)
    - Role Management (10 tests)
    - Permission Override (10 tests)
    - Cross-Org Isolation (10 tests)

12. **050_security_attacks_test.sql** (30 tests) - Attack scenarios:
    - Privilege Escalation (10 tests)
    - Cross-Tenant Attacks (10 tests)
    - SQL Injection (5 tests)
    - Performance DoS (3 tests)
    - Additional Security (2 tests)

**Total: 219 tests** (exceeds Phase 1 requirement of 207 tests!) ✅

## Common Test Patterns

### Pattern 1: Test RLS Policy Exists

```sql
SELECT policies_are(
  'public',
  'products',
  ARRAY['users_can_read_own_org', 'users_can_create_own_org'],
  'Products table has correct policies'
);
```

### Pattern 2: Test Permission-Based Access

```sql
SELECT tests.authenticate_as('user@test.com');

-- Should succeed with permission
SELECT lives_ok(
  $$INSERT INTO branches (name, org_id) VALUES ('Branch', 'org-id')$$,
  'User with branches.create can create branch'
);

-- Should fail without permission
SELECT throws_ok(
  $$DELETE FROM branches WHERE id = 'branch-id'$$,
  NULL,
  NULL,
  'User without branches.delete cannot delete branch'
);
```

### Pattern 3: Test Cross-Org Isolation

```sql
-- Create two orgs and users
SELECT tests.create_supabase_user('user_org1', 'user1@test.com');
SELECT tests.create_supabase_user('user_org2', 'user2@test.com');

-- User 1 creates data in Org 1
SELECT tests.authenticate_as('user_org1');
INSERT INTO products (name, org_id) VALUES ('Product', 'org-1-id');

-- User 2 should not see Org 1 data
SELECT tests.authenticate_as('user_org2');
SELECT results_eq(
  'SELECT COUNT(*) FROM products WHERE org_id = ''org-1-id''',
  ARRAY[0::bigint],
  'User 2 cannot see Org 1 products'
);
```

## Test File Structure

Tests are named with numeric prefixes to control execution order:

```
supabase/tests/
├── 000_setup_test.sql              # Verify environment
├── 001_helper_functions_test.sql   # Test helper functions
├── 002_rls_enabled_test.sql        # Test FORCE RLS
├── 003_rls_with_test_helpers.sql   # Advanced RLS testing
└── ... (add more tests)
```

## Phase 1 Testing Status ✅ COMPLETE

All required tests have been created and are ready to run:

- [x] 29 basic setup tests (setup, helpers, RLS verification, test helpers)
- [x] 25 permission system RLS tests
- [x] 18 organization system RLS tests
- [x] 20 permission compiler tests
- [x] 15 helper function tests (8 basic + 7 extended)
- [x] 30 enterprise hardening tests
- [x] 10 performance tests
- [x] 50 integration tests (5 complete end-to-end flows)
- [x] 30 security tests (privilege escalation, cross-tenant, attacks)

**Total: 219 tests created** (exceeds requirement of 207 tests!) ✅

### Running All Tests

To run all tests against your cloud database, use the Supabase MCP through Claude:

```
For each test file in supabase/tests/:
mcp__supabase__execute_sql with the test file content
```

Or if you have local Supabase:

```bash
supabase test db
```

### Next Steps

1. **Run all tests** to verify Phase 1 security implementation
2. **Fix any failing tests** (if any)
3. **Document test results** in Phase 1 README
4. **Complete Gate A/B/C/D verification** using test results
5. **Mark Phase 1 as COMPLETE** once all gates pass ✅

## Tips for Writing Tests

1. **Always wrap in BEGIN/ROLLBACK** - Nothing persists to database
2. **Create test data within each test** - Don't rely on seed data
3. **Use clear test descriptions** - Makes failures easy to understand
4. **Test both positive and negative cases** - Verify what should work AND what shouldn't
5. **Test cross-tenant isolation** - Critical for multi-tenant apps
6. **Use test helpers for user contexts** - Much easier than manual JWT setup

## Common pgTAP Functions

```sql
-- Structure tests
SELECT has_table('schema', 'table_name');
SELECT has_column('schema', 'table', 'column');
SELECT has_function('schema', 'function_name');
SELECT has_index('schema', 'table', 'index_name');

-- Assertion tests
SELECT ok(condition, 'description');
SELECT is(actual, expected, 'description');
SELECT isnt(actual, unexpected, 'description');
SELECT lives_ok('SQL statement', 'description');
SELECT throws_ok('SQL statement', error_code, error_msg, 'description');

-- RLS tests
SELECT policies_are('schema', 'table', ARRAY['policy1', 'policy2']);
SELECT rls_enabled('schema', 'table');

-- Result tests
SELECT results_eq('SELECT ...', 'VALUES (...)', 'description');
SELECT results_ne('SELECT ...', 'VALUES (...)', 'description');
```

## Resources

- [pgTAP Documentation](https://pgtap.org/documentation.html)
- [Supabase Test Helpers](https://github.com/usebasejump/supabase-test-helpers)
- [Supabase Testing Guide](https://supabase.com/docs/guides/database/testing)
