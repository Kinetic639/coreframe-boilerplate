# Running Phase 1 pgTAP Tests

## Quick Start

All 219 tests have been created for Phase 1 RLS Security validation. Here's how to run them:

### Option 1: Run via Supabase MCP (Recommended for Cloud Database)

Since your project uses a cloud database, you can run tests through Claude using the Supabase MCP tool.

**Example - Run a single test:**

```
Ask Claude to run: mcp__supabase__execute_sql with content from supabase/tests/000_setup_test.sql
```

**Run all tests systematically:**

1. Ask Claude to run each test file in order (000 → 050)
2. Review results for each category
3. Fix any failures before proceeding

### Option 2: Run via psql (If you have connection string)

```bash
# Run single test
psql "your-connection-string" -f supabase/tests/000_setup_test.sql

# Run all tests
for test in supabase/tests/*.sql; do
  echo "Running $test..."
  psql "your-connection-string" -f "$test"
done
```

### Option 3: Run via Supabase CLI (Local development)

```bash
supabase start
supabase test db
```

## Test Execution Order

Tests are numbered to run in logical order:

```
000-003: Basic Setup (29 tests)
   ├─ 000_setup_test.sql (5 tests)
   ├─ 001_helper_functions_test.sql (8 tests)
   ├─ 002_rls_enabled_test.sql (6 tests)
   └─ 003_rls_with_test_helpers.sql (10 tests)

010-013: Permission System (70 tests)
   ├─ 010_permission_system_rls_test.sql (25 tests)
   ├─ 011_organization_system_rls_test.sql (18 tests)
   ├─ 012_permission_compiler_test.sql (20 tests)
   └─ 013_helper_functions_extended_test.sql (7 tests)

020-030: Enterprise & Performance (40 tests)
   ├─ 020_enterprise_hardening_test.sql (30 tests)
   └─ 030_performance_test.sql (10 tests)

040-050: Integration & Security (80 tests)
   ├─ 040_integration_flows_test.sql (50 tests)
   └─ 050_security_attacks_test.sql (30 tests)
```

## Understanding Test Output

### Successful Test Output

```
ok 1 - pgTAP extension is installed
ok 2 - Basic assertion passes
ok 3 - Math works correctly
...
All tests successful.
```

### Failed Test Output

```
not ok 4 - permissions table exists
# Failed test 4: "permissions table exists"
```

## What Each Test Category Validates

### 000-003: Basic Setup (29 tests)

- ✅ pgTAP is installed and working
- ✅ Helper functions exist with correct signatures
- ✅ FORCE RLS enabled on 6 critical tables
- ✅ Test helpers work correctly (user creation, authentication)

### 010-013: Permission System (70 tests)

- ✅ All RLS policies for roles, permissions, assignments, overrides
- ✅ Permission compiler behavior (active guard, triggers, overrides)
- ✅ Helper functions work in all edge cases
- ✅ Cross-org isolation for permission system

### 020-030: Enterprise & Performance (40 tests)

- ✅ roles_invariant constraint prevents invalid states
- ✅ Unique constraints prevent duplicates
- ✅ Soft-delete filtering works across all tables
- ✅ Creator binding prevents spoofing
- ✅ FORCE RLS prevents owner bypass
- ✅ Indexes exist and are used by queries

### 040-050: Integration & Security (80 tests)

- ✅ Bootstrap → Upgrade flow works end-to-end
- ✅ Invite → Accept flow works correctly
- ✅ Role management updates permissions properly
- ✅ Permission overrides apply correctly
- ✅ Complete cross-org isolation (zero data leakage)
- ✅ Privilege escalation attacks blocked
- ✅ SQL injection attacks blocked
- ✅ Performance DoS attacks mitigated

## Interpreting Results for Phase 1 Gates

### Gate A: Invariants

**Tests:** 000-003, 020 (Enterprise Hardening)

- All FORCE RLS tests pass
- All constraint tests pass
- No direct writes to user_effective_permissions
- Soft-delete filtering works

**Result:** Gate A passes if all 35 tests in these files pass

### Gate B: Attack Scenarios

**Tests:** 050 (Security Attacks)

- All privilege escalation attacks blocked
- All cross-tenant attacks blocked
- SQL injection attacks blocked

**Result:** Gate B passes if all 30 security tests pass

### Gate C: Critical Flows

**Tests:** 040 (Integration Flows)

- Bootstrap → Upgrade flow (10 tests)
- Invite → Accept flow (10 tests)
- Role Management flow (10 tests)
- Permission Override flow (10 tests)
- Cross-Org Isolation flow (10 tests)

**Result:** Gate C passes if all 50 integration tests pass

### Gate D: Performance

**Tests:** 030 (Performance)

- All indexes exist
- Queries use indexes (no Seq Scans)
- Compilation completes quickly

**Result:** Gate D passes if all 10 performance tests pass

## Troubleshooting

### Test fails with "function does not exist"

- Check that helper functions are correctly named (`is_org_member`, `has_permission`)
- Verify migrations have been applied

### Test fails with "permission denied"

- Check RLS policies are correctly defined
- Verify FORCE RLS is enabled on critical tables

### Test fails with "relation does not exist"

- Check that all migrations have been applied
- Verify table names match schema

### All tests fail with connection error

- Verify database is running
- Check connection string/credentials
- Ensure pgTAP extension is installed

## After Running Tests

1. **Document Results:**
   - Record passing/failing test counts
   - Note any unexpected failures
   - Document any security issues found

2. **Update Phase 1 README:**
   - Mark completed tests as ✅
   - Update Gate A/B/C/D status
   - Update overall completion percentage

3. **Fix Failures:**
   - Prioritize security-critical failures
   - Fix RLS policy issues first
   - Re-run tests after fixes

4. **Complete Phase 1:**
   - When all 4 gates pass → Phase 1 is DONE
   - Create security audit report
   - Document performance benchmarks

## Quick Test Commands

```bash
# Run only setup tests
psql "connection-string" -f supabase/tests/000_setup_test.sql

# Run only RLS policy tests
psql "connection-string" -f supabase/tests/010_permission_system_rls_test.sql
psql "connection-string" -f supabase/tests/011_organization_system_rls_test.sql

# Run only security tests
psql "connection-string" -f supabase/tests/050_security_attacks_test.sql

# Run all tests (bash loop)
for test in supabase/tests/*.sql; do
  echo "=== Running $(basename $test) ==="
  psql "connection-string" -f "$test" || echo "FAILED: $test"
done
```

## Expected Results

If Phase 1 implementation is correct:

- ✅ **219/219 tests should pass**
- ✅ **All 4 gates should pass**
- ✅ **0 security vulnerabilities found**
- ✅ **All queries use indexes**

Any failures indicate security issues that must be fixed before Phase 1 can be marked complete.

## Need Help?

- Check [README.md](README.md) for test helper documentation
- Review [Phase 1 README](../../docs/coreframe-rebuild/Phase-1-RLS-Security/README.md) for requirements
- Check Supabase docs for pgTAP reference: https://supabase.com/docs/guides/database/testing
