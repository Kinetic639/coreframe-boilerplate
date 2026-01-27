# Phase 1: Enterprise Security & Permission System

**Status:** 🔵 IN PROGRESS
**Duration:** ~25 hours estimated
**Started:** 2026-01-20
**Overall Progress:** 30%
**Priority:** 🔴 CRITICAL - Security Blocker

---

## 📊 Progress Tracker

| Task                                                                                                       | Status         | Duration | Tests | Completion |
| ---------------------------------------------------------------------------------------------------------- | -------------- | -------- | ----- | ---------- |
| 1.1 RLS Policies for Permission System (roles, permissions, assignments, overrides, effective_permissions) | ⚪ Not Started | 3h       | 0/25  | 0%         |
| 1.2 RLS Policies for Organization System (organizations, organization_members, invitations)                | ⚪ Not Started | 3h       | 0/18  | 0%         |
| 1.3 Permission Compiler Verification & Testing                                                             | ⚪ Not Started | 2h       | 0/20  | 0%         |
| 1.4 Security Helper Functions (is_org_member, has_permission)                                              | ⚪ Not Started | 2h       | 0/15  | 0%         |
| 1.5 Enterprise Hardening (FORCE RLS, constraints, triggers validation)                                     | ⚪ Not Started | 3h       | 0/20  | 0%         |
| 1.6 Performance Optimization (indexes, query analysis)                                                     | ⚪ Not Started | 2h       | 0/10  | 0%         |
| 1.7 Integration Testing (end-to-end permission flows)                                                      | ⚪ Not Started | 4h       | 0/50  | 0%         |
| 1.8 Security Audit & Penetration Testing                                                                   | ⚪ Not Started | 4h       | 0/30  | 0%         |
| 1.9 Debug Panel & Observability Enhancement                                                                | ⚪ Not Started | 2h       | 0/8   | 0%         |

**Total:** 0/196 tests | 0/25 hours | 30% complete (V2 foundation exists)

---

## 🎯 Phase Goal

**Implement enterprise-grade security with comprehensive RLS policies, complete permission system validation, and multi-layer defense-in-depth architecture.**

### What This Phase Achieves

✅ **Complete RLS Coverage**: 34 policies across 9 critical tables
✅ **Permission System V2**: Compile-time permission resolution with runtime enforcement
✅ **Enterprise Hardening**: FORCE RLS, advisory locks, constraint validation
✅ **Multi-Tenant Isolation**: Organization/branch scoping with zero data leakage
✅ **Performance Optimized**: Sub-200ms permission checks with filtered indexes
✅ **Production Ready**: 196+ tests covering all security scenarios

### Why This Matters

⚠️ **Current State**: Permission system V2 foundation exists but:

- Only **partial RLS coverage** - many tables still unprotected
- Policies exist but **not comprehensively tested**
- No systematic security audit
- Performance not benchmarked
- Missing enterprise hardening validation

🎯 **After Phase 1**: Enterprise-level security suitable for production deployment with complete RLS enforcement, tested permission flows, and performance guarantees.

---

## 🏗️ Architecture Overview

### The Permission System V2 ("Compile, Don't Evaluate")

```
┌──────────────────────────────────────────────────────────────────┐
│                    CONFIGURATION LAYER                            │
│                                                                   │
│  ┌─────────────┐  ┌──────────────────┐  ┌──────────────────┐   │
│  │ permissions │  │ role_permissions │  │      roles        │   │
│  │  (13 slugs) │◄─┤   (junction)     ├─►│ org_owner, etc.   │   │
│  └─────────────┘  └──────────────────┘  └──────────────────┘   │
│         │                                         │               │
│         └─────────────────┬───────────────────────┘               │
│                           ▼                                       │
│              ┌────────────────────────────────┐                  │
│              │  user_role_assignments         │                  │
│              │  + user_permission_overrides   │                  │
│              └────────────────────────────────┘                  │
│                           │                                       │
│              ┌────────────▼───────────────────┐                  │
│              │   PERMISSION COMPILER           │                  │
│              │   (compile_user_permissions)    │                  │
│              │                                 │                  │
│              │  • Advisory locks               │                  │
│              │  • Active membership guard      │                  │
│              │  • Set-based logic (no loops)   │                  │
│              │  • Deny-first processing        │                  │
│              └────────────┬───────────────────┘                  │
│                           ▼                                       │
│              ┌────────────────────────────────┐                  │
│              │  user_effective_permissions    │                  │
│              │  (THE KEY TABLE)                │                  │
│              │  - Explicit permission facts    │                  │
│              │  - No wildcards at runtime      │                  │
│              └────────────────────────────────┘                  │
└──────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│                     ENFORCEMENT LAYER                             │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  RLS POLICIES (34 policies across 9 tables)                 │ │
│  │                                                              │ │
│  │  Layer 1 - Tenant Boundary:                                 │ │
│  │    is_org_member(org_id) → organization_members check       │ │
│  │                                                              │ │
│  │  Layer 2 - Permission Check:                                │ │
│  │    has_permission(org_id, 'action') → lookup in             │ │
│  │    user_effective_permissions (simple EXISTS check)         │ │
│  │                                                              │ │
│  │  FORCE RLS on 6 critical tables:                            │ │
│  │    • organization_members                                    │ │
│  │    • roles, role_permissions                                │ │
│  │    • user_role_assignments                                  │ │
│  │    • user_permission_overrides                              │ │
│  │    • user_effective_permissions                             │ │
│  └────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

### Core Principle

> **"A user can do X in org Y only if there is an explicit row in `user_effective_permissions` that says so."**

- No wildcards at runtime (expanded at compile-time)
- No complex deny logic at runtime (applied at compile-time)
- Simple, fast EXISTS checks for enforcement
- All complexity handled during compilation

---

## 📋 Task Breakdown

---

## Task 1.1: RLS Policies for Permission System (3 hours) ⚪

**Goal:** Verify and test all 25 RLS policies across permission system tables (roles, permissions, role_permissions, user_role_assignments, user_permission_overrides, user_effective_permissions)

### Current State Analysis

The permission system V2 **already has RLS policies deployed**. This task focuses on:

1. **Verification**: Confirm all 25 policies exist and are correct
2. **Testing**: Comprehensive pgTAP test coverage for all policies
3. **Documentation**: Policy behavior and security guarantees

### Tables Covered (5 tables, 22 policies + 3 additional)

#### 1. `permissions` (1 policy)

- ✅ All authenticated users can read permission catalog (excluding soft-deleted)

#### 2. `roles` (5 policies)

- ✅ System roles visible to all authenticated users
- ✅ Custom roles visible to org members
- ✅ Custom roles can be created by members.manage permission holders
- ✅ Custom non-basic roles can be updated/deleted by members.manage holders
- ✅ System roles (is_basic=true) protected from modification

#### 3. `role_permissions` (5 policies)

- ✅ System role permissions visible to all authenticated
- ✅ Custom role permissions visible to org members
- ✅ Custom role permissions can be managed by members.manage holders
- ✅ System role permissions protected from modification

#### 4. `user_role_assignments` (5 policies)

- ✅ Users see their own assignments
- ✅ Admins see assignments in their org (with members.manage)
- ✅ Admins can manage assignments (with members.manage)
- ✅ Self-registration allowed ONLY for org creators assigning org_member role
- ✅ Privilege escalation prevention (cannot self-assign org_owner)

#### 5. `user_permission_overrides` (5 policies)

- ✅ Users see their own overrides
- ✅ Admins see overrides in their org (with members.manage)
- ✅ Admins can manage overrides (with members.manage)
- ✅ Organization scoping enforced

#### 6. `user_effective_permissions` (1 policy)

- ✅ Users can ONLY see their own compiled permissions
- ✅ No INSERT/UPDATE/DELETE policies (compiler-only writes)

### Step 1: Verify Existing Policies (30 min)

**Action:** Run verification queries to confirm all policies exist and match expected definitions.

**File:** `docs/coreframe-rebuild/Phase-1-RLS-Security/policy-verification.sql`

```sql
-- Count policies per table
SELECT
  schemaname,
  tablename,
  count(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'permissions', 'roles', 'role_permissions',
    'user_role_assignments', 'user_permission_overrides',
    'user_effective_permissions'
  )
GROUP BY schemaname, tablename
ORDER BY tablename;

-- Expected output:
-- permissions: 1
-- roles: 5
-- role_permissions: 5
-- user_role_assignments: 5
-- user_permission_overrides: 5
-- user_effective_permissions: 1
-- TOTAL: 22 policies

-- Verify FORCE RLS on critical tables
SELECT
  relname,
  relrowsecurity as rls_enabled,
  relforcerowsecurity as force_rls
FROM pg_class
WHERE relname IN (
  'roles', 'role_permissions',
  'user_role_assignments', 'user_permission_overrides',
  'user_effective_permissions'
)
ORDER BY relname;

-- Expected: All should have rls_enabled=true AND force_rls=true
```

**Checklist:**

- [ ] Verification script created
- [ ] All 22 policies confirmed to exist
- [ ] FORCE RLS enabled on 5 tables (roles, role_permissions, user_role_assignments, user_permission_overrides, user_effective_permissions)
- [ ] Policy definitions match PERMISSION_SYSTEM_V2.md
- [ ] No missing or extra policies

### Step 2: Comprehensive pgTAP Testing (2 hours)

**File:** `supabase/tests/rls/001_permission_system_rls.test.sql`

**Test Coverage (25 tests):**

```sql
BEGIN;
SELECT plan(25);

-- Setup: Create test users, roles, permissions
-- ... (setup code)

-- ============================================================================
-- PERMISSIONS TABLE TESTS (1 test)
-- ============================================================================

SELECT results_eq(
  $$SELECT COUNT(*)::int FROM permissions WHERE deleted_at IS NULL$$,
  ARRAY[13],
  'All authenticated users can read permission catalog'
);

-- ============================================================================
-- ROLES TABLE TESTS (5 tests)
-- ============================================================================

SELECT results_eq(
  $$SELECT COUNT(*)::int FROM roles WHERE is_basic = true AND organization_id IS NULL$$,
  ARRAY[2],  -- org_owner, org_member
  'System roles visible to all authenticated users'
);

SELECT throws_ok(
  $$INSERT INTO roles (name, is_basic, organization_id) VALUES ('custom_role', false, NULL)$$,
  '23514',  -- CHECK constraint violation
  NULL,
  'Cannot create custom role with organization_id = NULL (roles_invariant)'
);

-- Test org member can create custom role with members.manage
-- Test org member cannot create custom role without members.manage
-- Test cannot modify system roles

-- ============================================================================
-- ROLE_PERMISSIONS TABLE TESTS (5 tests)
-- ============================================================================

-- Test system role permissions visible to all
-- Test custom role permissions visible to org members only
-- Test custom role permissions can be managed by members.manage holders
-- Test system role permissions cannot be modified
-- Test cross-org role permissions not visible

-- ============================================================================
-- USER_ROLE_ASSIGNMENTS TABLE TESTS (8 tests)
-- ============================================================================

-- Test users see their own assignments
-- Test admins see assignments in their org
-- Test regular users cannot see others' assignments
-- Test admins can create assignments with members.manage
-- Test regular users cannot create assignments
-- Test self-registration works for org creator + org_member role
-- Test self-registration FAILS for org_owner role (privilege escalation prevention)
-- Test cross-org assignment management blocked

-- ============================================================================
-- USER_PERMISSION_OVERRIDES TABLE TESTS (5 tests)
-- ============================================================================

-- Test users see their own overrides
-- Test admins see overrides in their org
-- Test admins can manage overrides with members.manage
-- Test regular users cannot create overrides
-- Test cross-org override management blocked

-- ============================================================================
-- USER_EFFECTIVE_PERMISSIONS TABLE TESTS (1 test)
-- ============================================================================

SELECT results_eq(
  $$SELECT COUNT(*)::int FROM user_effective_permissions WHERE user_id = auth.uid()$$,
  ARRAY[13],  -- Assuming test user is org_owner
  'Users can only see their own compiled permissions'
);

SELECT throws_ok(
  $$INSERT INTO user_effective_permissions (user_id, organization_id, permission_slug)
    VALUES (auth.uid(), 'test-org-id', 'fake.permission')$$,
  '42501',  -- Insufficient privilege
  NULL,
  'Users cannot directly insert into user_effective_permissions'
);

SELECT * FROM finish();
ROLLBACK;
```

**Checklist:**

- [ ] Test file created with 25 comprehensive tests
- [ ] All permission table policies tested
- [ ] All role table policies tested
- [ ] All role_permissions table policies tested
- [ ] All user_role_assignments table policies tested (including privilege escalation prevention)
- [ ] All user_permission_overrides table policies tested
- [ ] user_effective_permissions read-only enforcement tested
- [ ] Cross-org isolation tested
- [ ] All tests passing

### Step 3: Policy Documentation (30 min)

**File:** `docs/coreframe-rebuild/Phase-1-RLS-Security/PERMISSION_POLICIES.md`

Document all 22 policies with:

- Policy name and purpose
- Table and operation (SELECT/INSERT/UPDATE/DELETE)
- Security guarantees
- Example scenarios
- Known limitations

**Checklist:**

- [ ] Documentation file created
- [ ] All 22 policies documented
- [ ] Security guarantees clearly stated
- [ ] Example scenarios provided

### Definition of Done ✅

- [ ] All 22 permission system policies verified
- [ ] 25 pgTAP tests passing
- [ ] FORCE RLS confirmed on 5 critical tables
- [ ] Policy documentation complete
- [ ] No privilege escalation vectors found
- [ ] Cross-org isolation verified

---

## Task 1.2: RLS Policies for Organization System (3 hours) ⚪

**Goal:** Verify and test all 12 RLS policies for multi-tenant isolation (organizations, organization_members, invitations)

### Tables Covered (3 tables, 12 policies)

#### 1. `organizations` (4 policies)

- ✅ Creators can see their orgs
- ✅ Members can see their orgs (via is_org_member)
- ✅ Only authenticated users can create orgs (creator binding: `created_by = auth.uid()`)
- ✅ Org updates require org.update permission

#### 2. `organization_members` (5 policies) + FORCE RLS

- ✅ Users see their own memberships
- ✅ Org members see other members in same org
- ✅ Admins can invite members (with members.manage)
- ✅ Self-registration allowed ONLY for org creators
- ✅ Admins can update/delete members (with members.manage)

#### 3. `invitations` (3 policies)

- ✅ Permission holders OR invitees can see invitations
- ✅ Creating invitations requires invites.create permission
- ✅ Updating invitations requires invites.cancel OR being the invitee
- ✅ LOWER() email normalization (case-insensitive matching)

### Step 1: Verify Organization Policies (30 min)

**Action:** Verify all 12 organization-related policies exist and are correct.

**File:** `docs/coreframe-rebuild/Phase-1-RLS-Security/org-policy-verification.sql`

```sql
-- Count policies per table
SELECT
  tablename,
  count(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'organizations', 'organization_members', 'invitations'
  )
GROUP BY tablename
ORDER BY tablename;

-- Expected output:
-- organizations: 4
-- organization_members: 5
-- invitations: 3
-- TOTAL: 12 policies

-- Verify FORCE RLS on organization_members
SELECT
  relname,
  relrowsecurity as rls_enabled,
  relforcerowsecurity as force_rls
FROM pg_class
WHERE relname = 'organization_members';

-- Expected: rls_enabled=true AND force_rls=true

-- Verify creator binding on organizations INSERT policy
SELECT
  policyname,
  cmd,
  with_check
FROM pg_policies
WHERE tablename = 'organizations'
  AND cmd = 'INSERT';

-- Expected: with_check contains 'created_by = auth.uid()'
```

**Checklist:**

- [ ] Verification script created
- [ ] All 12 policies confirmed
- [ ] FORCE RLS on organization_members verified
- [ ] Creator binding on organizations verified
- [ ] LOWER() email normalization in invitations verified

### Step 2: Comprehensive pgTAP Testing (2 hours)

**File:** `supabase/tests/rls/002_organization_system_rls.test.sql`

**Test Coverage (18 tests):**

```sql
BEGIN;
SELECT plan(18);

-- ============================================================================
-- ORGANIZATIONS TABLE TESTS (6 tests)
-- ============================================================================

-- Test creator can see their org
-- Test member can see org via is_org_member
-- Test non-member cannot see org
-- Test creator binding on INSERT (cannot spoof created_by)
-- Test org.update permission required for updates
-- Test cross-org updates blocked

-- ============================================================================
-- ORGANIZATION_MEMBERS TABLE TESTS (8 tests)
-- ============================================================================

-- Test user sees own membership
-- Test org members see each other
-- Test non-members cannot see memberships
-- Test admin can add members with members.manage
-- Test self-registration works for org creator
-- Test self-registration fails for non-creator
-- Test members.manage required for updates/deletes
-- Test cross-org membership management blocked

-- ============================================================================
-- INVITATIONS TABLE TESTS (4 tests)
-- ============================================================================

-- Test invitee can see invitation (case-insensitive email)
-- Test permission holder can see invitations
-- Test invites.create required for creating invitations
-- Test invitee can update (accept) their invitation

SELECT * FROM finish();
ROLLBACK;
```

**Checklist:**

- [ ] Test file created with 18 tests
- [ ] All organizations policies tested
- [ ] All organization_members policies tested (including self-registration)
- [ ] All invitations policies tested (including LOWER() email)
- [ ] Creator binding tested
- [ ] Cross-org isolation tested
- [ ] All tests passing

### Step 3: Multi-Tenant Isolation Testing (30 min)

**File:** `supabase/tests/rls/003_cross_tenant_isolation.test.sql`

Test that users in Org A cannot:

- See Org B's data
- Modify Org B's data
- Accept invitations for Org B
- Assign roles in Org B
- Bypass org boundaries via direct ID access

**Checklist:**

- [ ] Cross-tenant test file created (10+ tests)
- [ ] All isolation tests passing
- [ ] Zero data leakage confirmed

### Definition of Done ✅

- [ ] All 12 organization policies verified
- [ ] 18 pgTAP tests passing
- [ ] 10+ cross-tenant isolation tests passing
- [ ] FORCE RLS on organization_members confirmed
- [ ] Creator binding working
- [ ] LOWER() email normalization working
- [ ] Zero cross-org data leakage

---

## Task 1.3: Permission Compiler Verification & Testing (2 hours) ⚪

**Goal:** Verify the permission compiler function works correctly with all enterprise hardening features

### Compiler Features to Verify

1. **Active Membership Guard** - Only compiles for active org members
2. **Advisory Locks** - Prevents concurrent compilation races
3. **Set-Based Logic** - Single INSERT statement, no loops
4. **source_type Tracking** - Updates on conflict
5. **Deny Processing** - Revoke overrides properly exclude permissions
6. **Grant Processing** - Grant overrides properly add permissions

### Step 1: Compiler Function Verification (30 min)

**Action:** Verify the `compile_user_permissions` function has all enterprise features.

**File:** `docs/coreframe-rebuild/Phase-1-RLS-Security/compiler-verification.sql`

```sql
-- Verify compiler function exists
SELECT
  proname,
  prosecdef as is_security_definer,
  provolatile::text as volatility,
  pg_get_functiondef(oid) as definition
FROM pg_proc
WHERE proname = 'compile_user_permissions'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- Expected:
-- - is_security_definer = true
-- - Definition contains:
--   - Active membership guard (IF NOT EXISTS check)
--   - pg_advisory_xact_lock()
--   - Set-based INSERT with UNION
--   - NOT EXISTS for revoke overrides
--   - ON CONFLICT UPDATE for source_type

-- Verify compiler is NOT executable by authenticated users
SELECT has_function_privilege('authenticated', 'public.compile_user_permissions(uuid, uuid)', 'EXECUTE') as can_execute;
-- Expected: false (only service_role can call)

-- Verify triggers exist that call the compiler
SELECT
  tgname,
  tgrelid::regclass as table_name,
  tgtype,
  proname as trigger_function
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE proname LIKE '%compile%'
ORDER BY tgname;

-- Expected triggers:
-- - trigger_role_assignment_compile (user_role_assignments)
-- - trigger_override_compile (user_permission_overrides)
-- - trigger_role_permission_compile (role_permissions)
-- - trigger_membership_compile (organization_members)
```

**Checklist:**

- [ ] Compiler function verified
- [ ] Active membership guard present
- [ ] Advisory locks present
- [ ] Set-based logic confirmed
- [ ] source_type update on conflict confirmed
- [ ] Deny/grant processing logic verified
- [ ] EXECUTE privileges locked down (not callable by authenticated)
- [ ] All 4 compilation triggers exist

### Step 2: Compiler Behavior Testing (1 hour)

**File:** `supabase/tests/compiler/001_permission_compiler.test.sql`

**Test Coverage (20 tests):**

```sql
BEGIN;
SELECT plan(20);

-- ============================================================================
-- ACTIVE MEMBERSHIP GUARD TESTS (4 tests)
-- ============================================================================

-- Test: Compiler only runs for active members
-- Test: Inactive member has 0 permissions
-- Test: Pending member has 0 permissions
-- Test: Soft-deleted member has 0 permissions

-- ============================================================================
-- ROLE-BASED COMPILATION TESTS (4 tests)
-- ============================================================================

-- Test: org_owner gets 13 permissions
-- Test: org_member gets 5 permissions
-- Test: Changing role from org_member to org_owner updates permissions
-- Test: All compiled permissions have source_type='role'

-- ============================================================================
-- OVERRIDE COMPILATION TESTS (6 tests)
-- ============================================================================

-- Test: Grant override adds permission
-- Test: Grant override sets source_type='override'
-- Test: Revoke override removes permission from role
-- Test: Revoke override doesn't affect other permissions
-- Test: Grant then revoke results in no permission
-- Test: Multiple overrides processed correctly

-- ============================================================================
-- TRIGGER COMPILATION TESTS (4 tests)
-- ============================================================================

-- Test: Adding role assignment triggers compilation
-- Test: Removing role assignment triggers compilation
-- Test: Adding override triggers compilation
-- Test: Updating role_permissions triggers compilation for all affected users

-- ============================================================================
-- RACE CONDITION TESTS (2 tests)
-- ============================================================================

-- Test: Concurrent compilations don't create duplicates (advisory lock)
-- Test: source_type updates correctly on conflict

SELECT * FROM finish();
ROLLBACK;
```

**Checklist:**

- [ ] Test file created with 20 tests
- [ ] Active membership guard tested
- [ ] Role compilation tested
- [ ] Override compilation tested (grant + revoke)
- [ ] Trigger-based compilation tested
- [ ] Race condition handling tested
- [ ] All tests passing

### Step 3: Performance Testing (30 min)

**File:** `docs/coreframe-rebuild/Phase-1-RLS-Security/compiler-performance.md`

Benchmark compiler performance:

```sql
-- Test 1: Compile time for single user
SELECT compile_user_permissions('user-id', 'org-id');
-- Target: < 100ms

-- Test 2: Trigger latency on role assignment
INSERT INTO user_role_assignments (...);
-- Target: < 150ms (including compilation)

-- Test 3: Bulk compilation (when role_permissions changes)
UPDATE role_permissions SET allowed = true WHERE role_id = 'org_owner' AND permission_id = 'new-perm';
-- Target: < 5s for 100 users
```

**Checklist:**

- [ ] Performance benchmarks documented
- [ ] Single user compilation < 100ms
- [ ] Trigger latency acceptable
- [ ] Bulk compilation performance acceptable

### Definition of Done ✅

- [ ] Compiler function verified with all enterprise features
- [ ] 20 pgTAP tests passing
- [ ] Trigger-based compilation verified
- [ ] Performance benchmarks documented
- [ ] EXECUTE privilege lockdown confirmed
- [ ] No race conditions found

---

## Task 1.4: Security Helper Functions (2 hours) ⚪

**Goal:** Verify and test the two critical RLS helper functions: `is_org_member()` and `has_permission()`

### Functions to Verify

#### 1. `is_org_member(org_id UUID)`

- Returns boolean
- Checks if auth.uid() is active member of org
- STABLE SECURITY DEFINER with SET search_path TO ''
- Used by Layer 1 RLS policies (tenant boundary)

#### 2. `has_permission(org_id UUID, permission TEXT)`

- Returns boolean
- Checks if auth.uid() has permission in org
- STABLE SECURITY DEFINER with SET search_path TO ''
- Uses exact string match (NO wildcards at runtime)
- Used by Layer 2 RLS policies (permission enforcement)

### Step 1: Function Verification (30 min)

**File:** `docs/coreframe-rebuild/Phase-1-RLS-Security/helper-functions-verification.sql`

```sql
-- Verify is_org_member function
SELECT
  proname,
  prosecdef as is_security_definer,
  provolatile::text as volatility,
  pg_get_functiondef(oid) as definition
FROM pg_proc
WHERE proname = 'is_org_member'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- Expected:
-- - is_security_definer = true
-- - volatility = 'stable'
-- - Definition contains: status = 'active' AND deleted_at IS NULL
-- - SET search_path TO ''

-- Verify has_permission function
SELECT
  proname,
  prosecdef as is_security_definer,
  provolatile::text as volatility,
  pg_get_functiondef(oid) as definition
FROM pg_proc
WHERE proname = 'has_permission'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- Expected:
-- - is_security_definer = true
-- - volatility = 'stable'
-- - Definition contains: permission_slug = permission (EXACT match, no wildcards)
-- - SET search_path TO ''

-- Verify EXECUTE privileges
SELECT
  p.proname,
  r.rolname,
  has_function_privilege(r.oid, p.oid, 'EXECUTE') as can_execute
FROM pg_proc p
CROSS JOIN pg_roles r
WHERE p.proname IN ('is_org_member', 'has_permission')
  AND p.pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  AND r.rolname IN ('authenticated', 'service_role', 'anon')
ORDER BY p.proname, r.rolname;

-- Expected:
-- - authenticated: can execute both
-- - service_role: can execute both
-- - anon: cannot execute either
```

**Checklist:**

- [ ] is_org_member function verified
- [ ] has_permission function verified
- [ ] Both use SECURITY DEFINER
- [ ] Both use SET search_path TO ''
- [ ] Both marked STABLE
- [ ] EXECUTE privileges correct (authenticated + service_role only)
- [ ] No wildcard matching in has_permission

### Step 2: Function Behavior Testing (1 hour)

**File:** `supabase/tests/helpers/001_security_helpers.test.sql`

**Test Coverage (15 tests):**

```sql
BEGIN;
SELECT plan(15);

-- ============================================================================
-- IS_ORG_MEMBER TESTS (7 tests)
-- ============================================================================

-- Test: Returns true for active member
-- Test: Returns false for non-member
-- Test: Returns false for inactive member
-- Test: Returns false for pending member
-- Test: Returns false for soft-deleted member
-- Test: Returns false for wrong org
-- Test: Performance < 20ms

-- ============================================================================
-- HAS_PERMISSION TESTS (8 tests)
-- ============================================================================

-- Test: Returns true when permission exists in user_effective_permissions
-- Test: Returns false when permission doesn't exist
-- Test: Uses exact string match (not wildcard)
-- Test: Returns false for similar but non-matching permissions
-- Test: Works for all 13 permission types
-- Test: Returns false when not org member
-- Test: Returns false when wrong org
-- Test: Performance < 10ms

SELECT * FROM finish();
ROLLBACK;
```

**Checklist:**

- [ ] Test file created with 15 tests
- [ ] All is_org_member scenarios tested
- [ ] All has_permission scenarios tested
- [ ] Exact string matching verified
- [ ] Performance targets met
- [ ] All tests passing

### Step 3: Integration with RLS Policies (30 min)

**Action:** Verify these functions are used correctly in all RLS policies.

**File:** `docs/coreframe-rebuild/Phase-1-RLS-Security/helper-usage-audit.sql`

```sql
-- Find all RLS policies using is_org_member
SELECT
  schemaname,
  tablename,
  policyname,
  qual,
  with_check
FROM pg_policies
WHERE qual LIKE '%is_org_member%'
   OR with_check LIKE '%is_org_member%'
ORDER BY tablename, policyname;

-- Find all RLS policies using has_permission
SELECT
  schemaname,
  tablename,
  policyname,
  qual,
  with_check
FROM pg_policies
WHERE qual LIKE '%has_permission%'
   OR with_check LIKE '%has_permission%'
ORDER BY tablename, policyname;

-- Expected: Most organization-scoped policies use these functions
```

**Checklist:**

- [ ] Helper usage audit complete
- [ ] Functions used consistently across policies
- [ ] Two-layer pattern verified (is_org_member + has_permission)
- [ ] No policies bypassing helpers

### Definition of Done ✅

- [ ] Both helper functions verified
- [ ] 15 pgTAP tests passing
- [ ] SECURITY DEFINER + SET search_path confirmed
- [ ] EXECUTE privileges correct
- [ ] Performance targets met (< 20ms each)
- [ ] Integration with RLS policies verified
- [ ] No wildcard matching at runtime

---

## Task 1.5: Enterprise Hardening (3 hours) ⚪

**Goal:** Verify and test all enterprise hardening features

### Enterprise Features to Verify

1. **FORCE ROW LEVEL SECURITY** (6 tables)
2. **roles_invariant Constraint** (prevents invalid system/custom role states)
3. **Unique Constraints** (prevents duplicate data)
4. **Soft-Delete Filtering** (deleted_at IS NULL in ALL policies)
5. **Creator Binding** (prevents spoofing org ownership)
6. **Operator Precedence Fixes** (parentheses in complex conditions)
7. **LOWER() Email Normalization** (case-insensitive invitations)
8. **Validation Triggers** (permission slug, role assignment scope)

### Step 1: FORCE RLS Verification (30 min)

**File:** `docs/coreframe-rebuild/Phase-1-RLS-Security/force-rls-verification.sql`

```sql
-- Verify FORCE RLS on 6 critical tables
SELECT
  relname,
  relrowsecurity as rls_enabled,
  relforcerowsecurity as force_rls
FROM pg_class
WHERE relname IN (
  'organization_members',
  'roles',
  'role_permissions',
  'user_role_assignments',
  'user_permission_overrides',
  'user_effective_permissions'
)
ORDER BY relname;

-- Expected: All 6 tables have rls_enabled=true AND force_rls=true

-- Verify service_role can still bypass (expected behavior)
-- This is tested by running a query as service_role and confirming it works
```

**Checklist:**

- [ ] FORCE RLS verified on all 6 tables
- [ ] service_role bypass confirmed (expected)
- [ ] Table owner cannot bypass (verified)

### Step 2: Constraint Verification (1 hour)

**File:** `docs/coreframe-rebuild/Phase-1-RLS-Security/constraint-verification.sql`

```sql
-- Verify roles_invariant constraint
SELECT
  conname,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'public.roles'::regclass
  AND conname = 'roles_invariant';

-- Expected: (is_basic = true AND organization_id IS NULL) OR (is_basic = false AND organization_id IS NOT NULL)

-- Verify unique constraints
SELECT
  tc.table_name,
  tc.constraint_name,
  kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.constraint_type = 'UNIQUE'
  AND tc.table_name IN (
    'organization_members',
    'user_role_assignments',
    'user_effective_permissions'
  )
ORDER BY tc.table_name, tc.constraint_name, kcu.ordinal_position;

-- Expected unique constraints:
-- - organization_members: (organization_id, user_id)
-- - user_role_assignments: (user_id, role_id, scope, scope_id)
-- - user_effective_permissions: (user_id, organization_id, permission_slug)
```

**Test Coverage (20 tests):**

**File:** `supabase/tests/hardening/001_enterprise_hardening.test.sql`

```sql
BEGIN;
SELECT plan(20);

-- ============================================================================
-- ROLES_INVARIANT CONSTRAINT TESTS (4 tests)
-- ============================================================================

-- Test: System role with org_id fails (is_basic=true, org_id NOT NULL)
-- Test: Custom role without org_id fails (is_basic=false, org_id NULL)
-- Test: System role without org_id succeeds (is_basic=true, org_id NULL)
-- Test: Custom role with org_id succeeds (is_basic=false, org_id NOT NULL)

-- ============================================================================
-- UNIQUE CONSTRAINT TESTS (6 tests)
-- ============================================================================

-- Test: Duplicate membership fails
-- Test: Duplicate role assignment fails
-- Test: Duplicate compiled permission fails (prevented by compiler)
-- Test: Same user can have different roles
-- Test: Same permission can exist for different users
-- Test: Same role can be assigned at different scopes

-- ============================================================================
-- SOFT-DELETE FILTERING TESTS (5 tests)
-- ============================================================================

-- Test: Soft-deleted roles not visible
-- Test: Soft-deleted assignments not counted
-- Test: Soft-deleted members not counted
-- Test: Soft-deleted overrides not applied
-- Test: Policies enforce deleted_at IS NULL

-- ============================================================================
-- CREATOR BINDING TESTS (3 tests)
-- ============================================================================

-- Test: Cannot insert org with different created_by
-- Test: Cannot self-register to org not created by user
-- Test: Creator can successfully register

-- ============================================================================
-- EMAIL NORMALIZATION TESTS (2 tests)
-- ============================================================================

-- Test: LOWER() email matching in invitations (case-insensitive)
-- Test: Invitation lookup works regardless of email case

SELECT * FROM finish();
ROLLBACK;
```

**Checklist:**

- [ ] roles_invariant constraint verified
- [ ] All unique constraints verified
- [ ] 20 hardening tests passing
- [ ] Soft-delete filtering working
- [ ] Creator binding working
- [ ] Email normalization working

### Step 3: Validation Trigger Verification (1 hour)

**File:** `docs/coreframe-rebuild/Phase-1-RLS-Security/trigger-verification.sql`

```sql
-- Verify validation triggers exist
SELECT
  tgname,
  tgrelid::regclass as table_name,
  tgenabled,
  proname as trigger_function
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgname IN (
  'trigger_validate_permission_slug',
  'check_role_assignment_scope'
)
ORDER BY tgname;

-- Expected triggers:
-- - trigger_validate_permission_slug (user_permission_overrides, BEFORE INSERT/UPDATE)
-- - check_role_assignment_scope (user_role_assignments, BEFORE INSERT/UPDATE)
```

**Test Coverage:**

**File:** `supabase/tests/hardening/002_validation_triggers.test.sql`

```sql
BEGIN;
SELECT plan(10);

-- ============================================================================
-- PERMISSION SLUG VALIDATION TESTS (5 tests)
-- ============================================================================

-- Test: Invalid permission_slug fails
-- Test: permission_slug auto-corrected from permission_id
-- Test: Mismatched permission_slug corrected
-- Test: Valid permission_slug accepted
-- Test: NULL permission_slug with valid permission_id corrected

-- ============================================================================
-- ROLE ASSIGNMENT SCOPE VALIDATION TESTS (5 tests)
-- ============================================================================

-- Test: Org-scope role cannot be assigned at branch scope
-- Test: Branch-scope role cannot be assigned at org scope
-- Test: 'both' scope role can be assigned at org scope
-- Test: 'both' scope role can be assigned at branch scope
-- Test: Invalid scope fails

SELECT * FROM finish();
ROLLBACK;
```

**Checklist:**

- [ ] Permission slug validation trigger verified
- [ ] Role assignment scope validation trigger verified
- [ ] 10 validation tests passing
- [ ] Auto-correction working
- [ ] Invalid data rejected

### Definition of Done ✅

- [ ] FORCE RLS verified on 6 tables
- [ ] roles_invariant constraint verified
- [ ] All unique constraints verified
- [ ] 30 enterprise hardening tests passing (20 + 10)
- [ ] Soft-delete filtering working across all policies
- [ ] Creator binding preventing spoofing
- [ ] Email normalization working
- [ ] Validation triggers preventing invalid data

---

## Task 1.6: Performance Optimization (2 hours) ⚪

**Goal:** Verify all performance indexes exist and benchmark query performance

### Indexes to Verify (7 critical indexes)

1. `idx_uep_user_org_permission` - Fast RLS permission checks
2. `idx_uep_user_org` - User+org lookups
3. `idx_organization_members_user_org` - Active membership checks (filtered)
4. `idx_user_role_assignments_compiler` - Role lookups (filtered)
5. `idx_user_permission_overrides_compiler` - Override lookups (filtered)
6. `idx_role_permissions_role` - Permission joins (filtered)
7. Additional indexes on frequently queried columns

### Step 1: Index Verification (30 min)

**File:** `docs/coreframe-rebuild/Phase-1-RLS-Security/index-verification.sql`

```sql
-- Verify all critical indexes exist
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'user_effective_permissions',
    'organization_members',
    'user_role_assignments',
    'user_permission_overrides',
    'role_permissions'
  )
ORDER BY tablename, indexname;

-- Expected indexes:
-- user_effective_permissions:
--   - idx_uep_user_org_permission (user_id, organization_id, permission_slug)
--   - idx_uep_user_org (user_id, organization_id)
--   - idx_uep_permission (permission_slug)
-- organization_members:
--   - idx_organization_members_user_org (user_id, organization_id) WHERE deleted_at IS NULL AND status='active'
-- user_role_assignments:
--   - idx_user_role_assignments_compiler (user_id, scope, scope_id) WHERE deleted_at IS NULL
-- user_permission_overrides:
--   - idx_user_permission_overrides_compiler (user_id, organization_id) WHERE deleted_at IS NULL
-- role_permissions:
--   - idx_role_permissions_role (role_id) WHERE deleted_at IS NULL

-- Verify partial indexes are filtered
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexdef LIKE '%WHERE%'
ORDER BY tablename, indexname;

-- Expected: At least 4 partial indexes with deleted_at IS NULL filters
```

**Checklist:**

- [ ] All 7+ critical indexes verified
- [ ] Partial indexes properly filtered
- [ ] No missing indexes
- [ ] Index definitions correct

### Step 2: Query Performance Benchmarking (1 hour)

**File:** `docs/coreframe-rebuild/Phase-1-RLS-Security/PERFORMANCE_BENCHMARKS.md`

**Benchmarks to Run:**

```sql
-- Benchmark 1: has_permission() lookup
EXPLAIN (ANALYZE, BUFFERS)
SELECT has_permission('org-id', 'branches.read');
-- Target: < 5ms, Index Scan on idx_uep_user_org_permission

-- Benchmark 2: is_org_member() lookup
EXPLAIN (ANALYZE, BUFFERS)
SELECT is_org_member('org-id');
-- Target: < 10ms, Index Scan on idx_organization_members_user_org

-- Benchmark 3: Permission compilation
EXPLAIN (ANALYZE, BUFFERS)
SELECT compile_user_permissions('user-id', 'org-id');
-- Target: < 100ms, uses filtered indexes

-- Benchmark 4: RLS policy enforcement on SELECT
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM branches WHERE organization_id = 'org-id';
-- Target: < 50ms with RLS enabled

-- Benchmark 5: Role assignment with compilation trigger
EXPLAIN (ANALYZE, BUFFERS)
INSERT INTO user_role_assignments (user_id, role_id, scope, scope_id)
VALUES ('user-id', 'role-id', 'org', 'org-id');
-- Target: < 150ms (including trigger compilation)
```

**Performance Targets:**

| Query Type                | Target  | Acceptance |
| ------------------------- | ------- | ---------- |
| has_permission()          | < 5ms   | < 10ms     |
| is_org_member()           | < 10ms  | < 20ms     |
| Permission compilation    | < 100ms | < 200ms    |
| RLS SELECT query          | < 50ms  | < 100ms    |
| Role assignment + trigger | < 150ms | < 250ms    |

**Checklist:**

- [ ] All 5 benchmarks documented
- [ ] Query plans analyzed
- [ ] All queries use indexes (no Seq Scans on large tables)
- [ ] All targets met or acceptable
- [ ] No N+1 queries found

### Step 3: Performance Testing (30 min)

**File:** `supabase/tests/performance/001_performance.test.sql`

**Test Coverage (10 tests):**

```sql
BEGIN;
SELECT plan(10);

-- Test: has_permission() uses index
-- Test: is_org_member() uses index
-- Test: Permission compilation completes in < 200ms
-- Test: RLS policies don't cause Seq Scans
-- Test: Filtered indexes used for active records
-- Test: Bulk compilation (100 users) completes in < 10s
-- Test: Permission lookup cache hit rate > 90%
-- Test: No N+1 queries in context loading
-- Test: Concurrent compilations don't deadlock
-- Test: Index usage confirmed via EXPLAIN

SELECT * FROM finish();
ROLLBACK;
```

**Checklist:**

- [ ] Performance test file created
- [ ] 10 performance tests passing
- [ ] Index usage verified
- [ ] No performance regressions

### Definition of Done ✅

- [ ] All 7+ critical indexes verified
- [ ] Performance benchmarks documented
- [ ] All targets met (or documented exceptions)
- [ ] 10 performance tests passing
- [ ] No Seq Scans on large tables
- [ ] No N+1 queries
- [ ] Query plans analyzed and optimized

---

## Task 1.7: Integration Testing (4 hours) ⚪

**Goal:** Comprehensive end-to-end testing of complete permission flows

### Test Scenarios

#### 1. Organization Bootstrap Flow

- User creates organization
- User becomes creator
- User adds themselves as member
- User self-assigns org_member role
- Server action upgrades to org_owner
- Permissions compile correctly

#### 2. Member Invitation Flow

- Org owner invites new user
- Invitation created with proper permissions
- Invitee receives invitation
- Invitee accepts invitation
- Membership created
- Permissions compiled
- New member has correct permissions

#### 3. Role Management Flow

- Org owner creates custom role
- Org owner assigns permissions to role
- Org owner assigns role to user
- Permissions recompile
- User has new permissions
- Role modification propagates

#### 4. Permission Override Flow

- User has role-based permissions
- Admin adds grant override
- User gains additional permission
- Admin adds revoke override
- User loses specific permission
- Overrides compile correctly

#### 5. Cross-Org Isolation Flow

- User A in Org 1
- User B in Org 2
- User A cannot see Org 2 data
- User A cannot modify Org 2 data
- Direct URL access blocked
- API calls blocked

### Step 1: Integration Test Suite (3 hours)

**File:** `supabase/tests/integration/001_complete_flows.test.sql`

**Test Coverage (50 tests across 5 flows):**

```sql
BEGIN;
SELECT plan(50);

-- ============================================================================
-- ORGANIZATION BOOTSTRAP FLOW (10 tests)
-- ============================================================================

-- Test: User can create organization
-- Test: created_by set correctly
-- Test: User can add themselves as member
-- Test: User can self-assign org_member role
-- Test: User has 5 permissions (org_member permissions)
-- Test: Server action can upgrade to org_owner
-- Test: Permissions recompile to 13 (org_owner permissions)
-- Test: All permissions have correct source_type
-- Test: No permission duplication
-- Test: Process completes in < 500ms

-- ============================================================================
-- MEMBER INVITATION FLOW (10 tests)
-- ============================================================================

-- Test: Org owner can create invitation
-- Test: Invitee can see invitation (email match)
-- Test: Invitee can accept invitation
-- Test: Membership created with status='active'
-- Test: Role assigned correctly
-- Test: Permissions compiled for new member
-- Test: New member has correct permission count
-- Test: New member can access org data
-- Test: New member cannot access admin functions
-- Test: Process completes successfully

-- ============================================================================
-- ROLE MANAGEMENT FLOW (10 tests)
-- ============================================================================

-- Test: Org owner can create custom role
-- Test: Custom role has organization_id set
-- Test: Org owner can add permissions to role
-- Test: Org owner can assign custom role to user
-- Test: User permissions recompile
-- Test: User has permissions from both roles
-- Test: Modifying role_permissions triggers recompilation
-- Test: All affected users get updated permissions
-- Test: Regular user cannot create roles
-- Test: Regular user cannot modify roles

-- ============================================================================
-- PERMISSION OVERRIDE FLOW (10 tests)
-- ============================================================================

-- Test: Admin can create grant override
-- Test: User gains additional permission
-- Test: Permission source_type = 'override'
-- Test: Admin can create revoke override
-- Test: User loses specific permission
-- Test: Other permissions unaffected
-- Test: Grant + revoke on same permission = no permission
-- Test: Override changes immediate (via trigger)
-- Test: Regular user cannot create overrides
-- Test: Cross-org overrides blocked

-- ============================================================================
-- CROSS-ORG ISOLATION FLOW (10 tests)
-- ============================================================================

-- Test: User A cannot SELECT Org 2 data
-- Test: User A cannot INSERT into Org 2
-- Test: User A cannot UPDATE Org 2 data
-- Test: User A cannot DELETE Org 2 data
-- Test: User A cannot see Org 2 members
-- Test: User A cannot assign roles in Org 2
-- Test: User A cannot create invitations for Org 2
-- Test: User A cannot see Org 2 branches
-- Test: Direct ID access returns no rows (not errors)
-- Test: Zero data leakage confirmed

SELECT * FROM finish();
ROLLBACK;
```

**Checklist:**

- [ ] Integration test file created
- [ ] 50 end-to-end tests written
- [ ] All 5 flows tested
- [ ] Bootstrap flow working
- [ ] Invitation flow working
- [ ] Role management working
- [ ] Override flow working
- [ ] Cross-org isolation confirmed
- [ ] All tests passing

### Step 2: Manual Testing Checklist (1 hour)

**Action:** Perform manual testing with multiple users and roles.

**Test Matrix:**

| User Role  | Can View Own Profile | Can Manage Org | Can Invite | Can Assign Roles | Can See Org Data | Can See Other Org |
| ---------- | -------------------- | -------------- | ---------- | ---------------- | ---------------- | ----------------- |
| org_owner  | ✅                   | ✅             | ✅         | ✅               | ✅               | ❌                |
| org_member | ✅                   | ❌             | ❌         | ❌               | ✅ (read)        | ❌                |
| Non-member | ✅                   | ❌             | ❌         | ❌               | ❌               | ❌                |

**Test Scenarios:**

1. **Org Owner Tests (15 scenarios)**
   - [ ] Can view all users in org
   - [ ] Can create invitations
   - [ ] Can assign roles to users
   - [ ] Can create custom roles
   - [ ] Can modify organization settings
   - [ ] Can create branches
   - [ ] Can manage permission overrides
   - [ ] Can view all org data
   - [ ] Cannot access other orgs
   - [ ] Cannot assign roles in other orgs
   - [ ] Cannot see other org members
   - [ ] Permission changes reflect immediately
   - [ ] Context loading works correctly
   - [ ] Debug panel shows correct permissions
   - [ ] No errors in browser console

2. **Org Member Tests (10 scenarios)**
   - [ ] Can view own profile
   - [ ] Can update own preferences
   - [ ] Can view org name/description
   - [ ] Can view branches (read-only)
   - [ ] Can view other org members
   - [ ] Cannot create invitations
   - [ ] Cannot assign roles
   - [ ] Cannot modify org settings
   - [ ] Cannot create branches
   - [ ] Cannot access other orgs

3. **Cross-Org Tests (5 scenarios)**
   - [ ] User A cannot see Org B in org list
   - [ ] User A cannot access Org B URL
   - [ ] User A cannot see Org B members
   - [ ] User A cannot modify Org B data
   - [ ] API calls to Org B return 401/403

**Checklist:**

- [ ] All 30 manual test scenarios complete
- [ ] Test matrix verified
- [ ] No security issues found
- [ ] No UI errors
- [ ] Context loading works
- [ ] Debug panel accurate

### Definition of Done ✅

- [ ] 50 integration tests passing
- [ ] 30 manual test scenarios complete
- [ ] All 5 permission flows working correctly
- [ ] Bootstrap flow successful
- [ ] Invitation flow successful
- [ ] Role management successful
- [ ] Override flow successful
- [ ] Cross-org isolation confirmed
- [ ] Zero data leakage
- [ ] No regression bugs

---

## Task 1.8: Security Audit & Penetration Testing (4 hours) ⚪

**Goal:** Systematic security audit to identify and fix vulnerabilities

### Security Audit Categories

1. **Authentication & Authorization**
2. **Cross-Tenant Isolation**
3. **Privilege Escalation**
4. **Injection Attacks**
5. **Data Leakage**
6. **Performance DoS**

### Step 1: Privilege Escalation Testing (1 hour)

**Test Attack Scenarios:**

```sql
-- Attack 1: Self-assign org_owner role
-- Expected: FAIL (creator binding prevents this)
INSERT INTO user_role_assignments (user_id, role_id, scope, scope_id)
VALUES (
  auth.uid(),
  (SELECT id FROM roles WHERE slug = 'org_owner'),
  'org',
  'victim-org-id'
);
-- Should fail with insufficient privilege error

-- Attack 2: Modify compiled permissions directly
-- Expected: FAIL (no INSERT policy for authenticated users)
INSERT INTO user_effective_permissions (user_id, organization_id, permission_slug)
VALUES (auth.uid(), 'victim-org-id', 'org.update');
-- Should fail with insufficient privilege error

-- Attack 3: Create system role with NULL org_id
-- Expected: FAIL (roles_invariant constraint)
INSERT INTO roles (name, is_basic, organization_id)
VALUES ('fake_admin', true, NULL);
-- Should fail with CHECK constraint violation

-- Attack 4: Spoof organization creator
-- Expected: FAIL (created_by binding)
INSERT INTO organizations (name, slug, created_by)
VALUES ('Evil Org', 'evil', 'different-user-id');
-- Should fail with insufficient privilege error

-- Attack 5: Bypass FORCE RLS as table owner
-- Expected: FAIL (FORCE RLS prevents owner bypass)
SET ROLE postgres;
SELECT * FROM user_effective_permissions;
-- Should still enforce RLS

-- Attack 6: Join organization without invitation
-- Expected: FAIL (creator binding prevents arbitrary joins)
INSERT INTO organization_members (user_id, organization_id, status)
VALUES (auth.uid(), 'victim-org-id', 'active');
-- Should fail with insufficient privilege error
```

**File:** `supabase/tests/security/001_privilege_escalation.test.sql`

**Test Coverage (15 tests):**

```sql
BEGIN;
SELECT plan(15);

-- Test all 6 attack scenarios above + variations
-- All should fail with proper error codes

SELECT * FROM finish();
ROLLBACK;
```

**Checklist:**

- [ ] Privilege escalation test file created
- [ ] All 6 attack scenarios tested
- [ ] 15 escalation prevention tests passing
- [ ] Creator binding verified
- [ ] FORCE RLS verified
- [ ] No escalation vectors found

### Step 2: Cross-Tenant Isolation Testing (1 hour)

**Test Attack Scenarios:**

```sql
-- Attack 7: Direct ID access to other org data
SELECT * FROM branches WHERE id = 'other-org-branch-id';
-- Expected: Returns 0 rows (not an error)

-- Attack 8: Modify other org data by ID
UPDATE organizations SET name = 'Hacked' WHERE id = 'other-org-id';
-- Expected: 0 rows updated (silent failure via RLS)

-- Attack 9: See other org members via JOIN
SELECT u.email
FROM users u
JOIN organization_members om ON u.id = om.user_id
WHERE om.organization_id = 'other-org-id';
-- Expected: 0 rows (RLS on organization_members blocks this)

-- Attack 10: Accept invitation for another user
UPDATE invitations
SET status = 'accepted', accepted_at = now()
WHERE email = 'victim@example.com' AND organization_id = 'victim-org-id';
-- Expected: 0 rows updated (email must match auth.uid()'s email)
```

**File:** `supabase/tests/security/002_cross_tenant_isolation.test.sql`

**Test Coverage (15 tests):**

```sql
BEGIN;
SELECT plan(15);

-- Test all 4 attack scenarios above + variations
-- All should return 0 rows or fail appropriately

SELECT * FROM finish();
ROLLBACK;
```

**Checklist:**

- [ ] Cross-tenant test file created
- [ ] All 4 isolation attack scenarios tested
- [ ] 15 isolation tests passing
- [ ] Zero data leakage confirmed
- [ ] No cross-org access vectors

### Step 3: SQL Injection & Input Validation (1 hour)

**Test Attack Scenarios:**

```sql
-- Attack 11: SQL injection via permission slug
SELECT has_permission('org-id', 'branches.read'' OR ''1''=''1');
-- Expected: Returns false (exact string match, no SQL injection)

-- Attack 12: SQL injection via org_id
SELECT is_org_member('org-id''; DROP TABLE users; --');
-- Expected: Returns false or error (no SQL execution)

-- Attack 13: Invalid permission slug in override
INSERT INTO user_permission_overrides (user_id, organization_id, permission_slug, effect)
VALUES (auth.uid(), 'org-id', 'nonexistent.permission', 'grant');
-- Expected: FAIL (validation trigger rejects invalid slug)

-- Attack 14: XSS via organization name
INSERT INTO organizations (name, slug, created_by)
VALUES ('<script>alert("XSS")</script>', 'xss-test', auth.uid());
-- Expected: Succeeds (DB allows it), but UI must escape

-- Attack 15: Path traversal via slug
INSERT INTO organizations (name, slug, created_by)
VALUES ('Test', '../../etc/passwd', auth.uid());
-- Expected: Succeeds (DB allows it), but routing must validate
```

**Checklist:**

- [ ] SQL injection tests complete
- [ ] Permission slug validation working
- [ ] No SQL injection vectors found
- [ ] Input validation triggers working
- [ ] UI XSS prevention documented (not DB concern)

### Step 4: Performance DoS Testing (30 min)

**Test Attack Scenarios:**

```sql
-- Attack 16: Trigger excessive recompilations
-- Rapidly insert/delete role assignments
-- Expected: Advisory locks prevent race conditions, but may slow down

-- Attack 17: Query bomb via complex JOINs
-- Attempt to cause expensive queries via RLS policies
-- Expected: Indexes prevent slow queries

-- Attack 18: Bulk permission creation
-- Create 10,000 permissions
-- Expected: System handles gracefully (or rate limited at app layer)
```

**Checklist:**

- [ ] DoS scenarios tested
- [ ] Advisory locks prevent race conditions
- [ ] Indexes prevent query bombs
- [ ] No obvious DoS vectors at DB level

### Step 5: Security Audit Report (30 min)

**File:** `docs/coreframe-rebuild/Phase-1-RLS-Security/SECURITY_AUDIT_REPORT.md`

Document:

- All attack scenarios tested
- Results and mitigations
- Remaining risks (if any)
- Recommendations

**Checklist:**

- [ ] Security audit report created
- [ ] All 18 attack scenarios documented
- [ ] Results documented
- [ ] Mitigations verified
- [ ] Remaining risks identified (if any)

### Definition of Done ✅

- [ ] 30 security tests passing (15 + 15)
- [ ] All 18 attack scenarios tested
- [ ] Zero privilege escalation vectors
- [ ] Zero cross-tenant data leaks
- [ ] No SQL injection vulnerabilities
- [ ] Performance DoS risks documented
- [ ] Security audit report complete
- [ ] All findings addressed or documented

---

## Task 1.9: Debug Panel & Observability Enhancement (2 hours) ⚪

**Goal:** Enhance debug panel with RLS status, permission visualization, and performance metrics

### Features to Add

1. **RLS Status Indicators**
   - Show which tables have RLS enabled
   - Show FORCE RLS status
   - Show policy count per table

2. **Permission Visualization**
   - Show compiled permissions for current user
   - Show permission source (role vs override)
   - Show permission compilation timestamp

3. **Performance Metrics**
   - Permission load time
   - Context load time
   - RLS query execution time
   - Cache hit rates

4. **Security Warnings**
   - Stale permissions warning (>1 hour old)
   - Missing RLS policies warning
   - Cross-org access attempts

### Step 1: RLS Status Component (1 hour)

**File:** `src/components/debug/rls-status-panel.tsx`

**Features:**

- Table list with RLS status
- FORCE RLS indicators
- Policy count per table
- Quick test permission checker

**Checklist:**

- [ ] RLS status component created
- [ ] Shows all 9 permission-related tables
- [ ] FORCE RLS status displayed
- [ ] Policy counts accurate
- [ ] Test permission checker working

### Step 2: Permission Visualization (30 min)

**File:** `src/components/debug/permission-viewer.tsx`

**Features:**

- List all compiled permissions
- Show source_type (role vs override)
- Show compiled_at timestamp
- Highlight stale permissions
- Group by category

**Checklist:**

- [ ] Permission viewer created
- [ ] All permissions displayed
- [ ] Source type shown
- [ ] Timestamps displayed
- [ ] Stale permissions highlighted

### Step 3: Performance Metrics (30 min)

**File:** `src/components/debug/performance-metrics.tsx`

**Features:**

- Permission load time chart
- Context load time chart
- RLS query timing
- Cache hit rate display

**Checklist:**

- [ ] Performance metrics component created
- [ ] Timing data collected
- [ ] Charts displaying correctly
- [ ] Cache metrics accurate

### Step 4: Testing (Optional)

**File:** `src/components/debug/__tests__/debug-panel.test.tsx`

**Test Coverage (8 tests):**

- [ ] RLS status panel renders
- [ ] Permission viewer renders
- [ ] Performance metrics render
- [ ] Test permission checker works
- [ ] Stale permissions detected
- [ ] All 13 permissions displayed
- [ ] Source types correct
- [ ] Timestamps formatted correctly

**Checklist:**

- [ ] Test file created
- [ ] 8 component tests passing
- [ ] No console errors

### Definition of Done ✅

- [ ] RLS status panel implemented
- [ ] Permission viewer implemented
- [ ] Performance metrics implemented
- [ ] 8 component tests passing (optional)
- [ ] Debug panel accessible in dev mode
- [ ] No performance impact on production
- [ ] Documentation updated

---

## 📈 Success Metrics

### Security ✅

- [ ] **Zero Cross-Tenant Data Leaks** - Confirmed via 30+ tests
- [ ] **Zero Privilege Escalation** - Confirmed via 15+ tests
- [ ] **34 RLS Policies Active** - Verified across 9 tables
- [ ] **FORCE RLS on 6 Critical Tables** - organization_members, roles, role_permissions, user_role_assignments, user_permission_overrides, user_effective_permissions
- [ ] **Creator Binding** - Prevents org ownership spoofing
- [ ] **Permission System Integrity** - Compilation + enforcement working

### Performance ✅

- [ ] **Permission Load < 200ms** - Benchmark target
- [ ] **Permission Check < 5ms** - has_permission() target
- [ ] **Membership Check < 10ms** - is_org_member() target
- [ ] **Compilation < 100ms** - Single user compilation target
- [ ] **No N+1 Queries** - Verified via EXPLAIN ANALYZE
- [ ] **Index Usage 100%** - All RLS queries use indexes

### Testing ✅

- [ ] **196+ Tests Passing** - Across all test categories
- [ ] **25 Permission System Tests** - RLS policies for roles/permissions
- [ ] **18 Organization System Tests** - RLS policies for orgs/members
- [ ] **20 Compiler Tests** - Compilation behavior
- [ ] **15 Helper Function Tests** - is_org_member, has_permission
- [ ] **30 Enterprise Hardening Tests** - Constraints, triggers, FORCE RLS
- [ ] **10 Performance Tests** - Index usage, query speed
- [ ] **50 Integration Tests** - End-to-end flows
- [ ] **30 Security Tests** - Penetration testing
- [ ] **8 UI Component Tests** - Debug panel

### Quality ✅

- [ ] **All Migrations Applied** - Database schema complete
- [ ] **No TypeScript Errors** - Clean compilation
- [ ] **No Regression Bugs** - Existing features work
- [ ] **Documentation Complete** - All policies documented
- [ ] **Security Audit Complete** - No open vulnerabilities
- [ ] **Performance Benchmarks** - All targets met or documented

---

## 🚨 Known Risks & Mitigations

### Risk 1: Performance Degradation from RLS

**Risk:** RLS policies may slow down queries, especially complex JOINs.

**Mitigation:**

- ✅ 7+ filtered indexes on critical tables
- ✅ Partial indexes with `WHERE deleted_at IS NULL`
- ✅ STABLE SECURITY DEFINER functions (cacheable)
- ✅ Simple EXISTS checks (fast)
- ✅ Performance benchmarks validate < 200ms targets

### Risk 2: Complex Policy Debugging

**Risk:** RLS policy failures can be hard to debug (silent row filtering).

**Mitigation:**

- ✅ Debug panel with RLS status visibility
- ✅ Comprehensive test coverage (196+ tests)
- ✅ Permission staleness reporting
- ✅ Clear error messages in app layer
- ✅ Policy documentation with examples

### Risk 3: Permission Staleness

**Risk:** Permissions may become stale if triggers fail or are disabled.

**Mitigation:**

- ✅ Trigger-based automatic compilation
- ✅ Active membership guard (idempotent safety)
- ✅ Advisory locks prevent race conditions
- ✅ Staleness monitoring in debug panel
- ✅ Manual recompilation available (service_role)

### Risk 4: Breaking Changes During Rollout

**Risk:** Enabling RLS may break existing features that bypass permissions.

**Mitigation:**

- ✅ Comprehensive integration testing (50+ tests)
- ✅ Manual testing checklist (30 scenarios)
- ✅ Gradual rollout (Phase 1 = core tables only)
- ✅ Server actions use service_role (bypass RLS when needed)
- ✅ Debug panel identifies policy issues

### Risk 5: FORCE RLS Limitations

**Risk:** FORCE RLS doesn't prevent service_role bypass (by design).

**Mitigation:**

- ✅ Documented and expected behavior
- ✅ Server actions validate permissions before using service_role
- ✅ Sensitive operations require multi-layer validation
- ✅ Audit logging for service_role actions (future)

---

## 🔍 Testing Strategy Summary

### Layer 1: Database-Level Tests (pgTAP)

**Purpose:** Verify RLS policies, triggers, constraints work correctly at DB layer.

**Files:**

- `supabase/tests/rls/001_permission_system_rls.test.sql` (25 tests)
- `supabase/tests/rls/002_organization_system_rls.test.sql` (18 tests)
- `supabase/tests/rls/003_cross_tenant_isolation.test.sql` (10 tests)
- `supabase/tests/compiler/001_permission_compiler.test.sql` (20 tests)
- `supabase/tests/helpers/001_security_helpers.test.sql` (15 tests)
- `supabase/tests/hardening/001_enterprise_hardening.test.sql` (20 tests)
- `supabase/tests/hardening/002_validation_triggers.test.sql` (10 tests)
- `supabase/tests/performance/001_performance.test.sql` (10 tests)
- `supabase/tests/integration/001_complete_flows.test.sql` (50 tests)
- `supabase/tests/security/001_privilege_escalation.test.sql` (15 tests)
- `supabase/tests/security/002_cross_tenant_isolation.test.sql` (15 tests)

**Total: 208 database tests**

### Layer 2: Application-Level Tests (TypeScript)

**Purpose:** Verify permission system works correctly from application code.

**Files:**

- `src/components/debug/__tests__/debug-panel.test.tsx` (8 tests)
- Future: `src/__tests__/integration/permission-flows.test.ts` (optional)

**Total: 8+ application tests**

### Layer 3: Manual Testing

**Purpose:** Verify real-world user scenarios and UX.

**Scenarios:**

- Org owner tests (15 scenarios)
- Org member tests (10 scenarios)
- Cross-org tests (5 scenarios)

**Total: 30 manual scenarios**

### Total Test Coverage

- **Database Tests:** 208
- **Application Tests:** 8
- **Manual Scenarios:** 30
- **TOTAL:** 246 test points

---

## 📚 Documentation Deliverables

1. **PERMISSION_POLICIES.md** - All 34 RLS policies documented
2. **SECURITY_AUDIT_REPORT.md** - Penetration testing results
3. **PERFORMANCE_BENCHMARKS.md** - Query performance metrics
4. **MIGRATION_GUIDE.md** - How to apply Phase 1 changes (if needed)
5. **DEBUG_PANEL_GUIDE.md** - Using the enhanced debug panel

---

## 🔄 Migration Strategy

**Current State:**

- Permission System V2 foundation exists (compiler, triggers, user_effective_permissions)
- **Partial RLS coverage** - Some policies exist, but not all tables secured
- No systematic validation or testing

**Phase 1 Approach:**

- **Verification First** - Confirm existing policies are correct
- **Testing Second** - Comprehensive test coverage
- **Gap Analysis Third** - Identify missing policies or tests
- **Incremental Fixes** - Add missing policies/tests as migrations
- **Validation Fourth** - Security audit and penetration testing

**Migration Files (if needed):**

- `supabase/migrations/YYYYMMDDHHMMSS_phase1_rls_fixes.sql` - Any missing policies
- `supabase/migrations/YYYYMMDDHHMMSS_phase1_performance_indexes.sql` - Missing indexes

---

## 🎯 Phase Completion Criteria

### Must Have (Blocking)

- [ ] All 34 RLS policies verified and tested
- [ ] 196+ tests passing
- [ ] Zero privilege escalation vectors
- [ ] Zero cross-tenant data leaks
- [ ] FORCE RLS on 6 critical tables
- [ ] Performance targets met (< 200ms permission load)
- [ ] Security audit complete with no critical findings

### Should Have (Non-Blocking)

- [ ] Debug panel enhancements complete
- [ ] Performance benchmarks documented
- [ ] All documentation deliverables complete
- [ ] Manual testing checklist 100% complete

### Nice to Have (Future)

- [ ] Automated security scanning in CI/CD
- [ ] Permission changelog/audit log
- [ ] Real-time staleness monitoring
- [ ] Branch-scoped permissions (future enhancement)

---

## 🔄 Next Steps After Phase 1

Once Phase 1 is 100% complete:

1. **Phase 2: UI Primitives** - Build permission-aware UI components
2. **Domain Table RLS** - Incrementally enable RLS on warehouse, teams, etc.
3. **Advanced Features** - Branch-scoped permissions, audit logging, etc.
4. **Production Deployment** - Roll out enterprise-grade security

---

## 📝 Notes for Implementation

### Key Architectural Decisions

1. **Compile-Time vs Runtime**
   - Wildcards expanded at compile-time (not runtime)
   - Deny logic applied at compile-time (not runtime)
   - Simple EXISTS checks at runtime (fast)

2. **Two-Layer RLS Pattern**
   - Layer 1: `is_org_member(org_id)` - Tenant boundary
   - Layer 2: `has_permission(org_id, 'action')` - Permission check
   - Both must pass for access

3. **FORCE RLS Strategy**
   - 6 critical tables: organization_members, roles, role_permissions, user_role_assignments, user_permission_overrides, user_effective_permissions
   - Prevents table owner bypass
   - service_role bypass is expected and correct

4. **Soft-Delete Everywhere**
   - ALL policies include `deleted_at IS NULL`
   - Prevents soft-deleted data leakage
   - Compiler respects soft-deletes

5. **Creator Binding**
   - `created_by = auth.uid()` on organization INSERT
   - Prevents spoofing org ownership
   - Self-registration only for org creators

### References

- **PERMISSION_SYSTEM_V2.md** - Complete system documentation
- **Phase 0 README** - Foundation work (stores, hooks, server actions)
- **CLAUDE.md** - Security & authorization requirements

---

**Last Updated:** 2026-01-27
**Status:** 🔵 In Progress (30% - V2 foundation exists)
**Next Task:** 1.1 RLS Policies for Permission System
**Estimated Completion:** After 25 hours of focused work
**Blocking:** Production deployment
