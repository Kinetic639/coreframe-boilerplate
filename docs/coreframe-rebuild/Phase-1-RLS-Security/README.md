# Phase 1: RLS & Security

**Status:** 🔵 IN PROGRESS
**Duration:** ~15 hours estimated
**Started:** 2026-01-20
**Overall Progress:** 30%
**Priority:** 🔴 CRITICAL - Security Blocker

---

## 📊 Progress Tracker

| Task                                  | Status         | Duration | Tests | Completion |
| ------------------------------------- | -------------- | -------- | ----- | ---------- |
| 1.1 Enable RLS on Auth Tables         | ⚪ Not Started | 2h       | 0/10  | 0%         |
| 1.2 Enable RLS on Permission Tables   | ⚪ Not Started | 2h       | 0/15  | 0%         |
| 1.3 Enable RLS on Organization Tables | ⚪ Not Started | 2h       | 0/12  | 0%         |
| 1.4 Add Performance Indexes           | ⚪ Not Started | 1h       | 0/5   | 0%         |
| 1.5 Security Audit & Testing          | ⚪ Not Started | 4h       | 0/50  | 0%         |
| 1.6 Performance Benchmarking          | ⚪ Not Started | 2h       | 0/8   | 0%         |
| 1.7 Debug Panel Enhancement           | ⚪ Not Started | 2h       | 0/10  | 0%         |

**Total:** 0/110 tests | 0/15 hours | 30% complete (foundation only)

---

## 🎯 Phase Goal

Enable Row Level Security (RLS) on all core tables, verify the permission system works end-to-end, and establish a security foundation for incremental RLS rollout on domain tables.

**Why This Matters:**

- ⚠️ Currently ALL RLS is DISABLED (major security vulnerability)
- Users can potentially access cross-tenant data
- No database-level security enforcement
- Production deployment blocked until RLS enabled

---

## 📋 Task Breakdown

---

## Task 1.1: Enable RLS on Auth Tables (2 hours) ⚪

**Goal:** Secure user authentication and preferences tables

### Step 1: Create Migration (30 min)

**File:** `supabase/migrations/YYYYMMDDHHMMSS_enable_rls_auth_tables.sql`

```bash
# Create migration
npm run supabase:migration:new -- enable_rls_auth_tables
```

**Migration Content:**

```sql
-- Enable RLS on auth-related tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- Users can view their own profile
CREATE POLICY "users_select_own"
  ON public.users FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = id);

-- Users can update their own profile
CREATE POLICY "users_update_own"
  ON public.users FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);

-- Users can view their own preferences
CREATE POLICY "user_preferences_select_own"
  ON public.user_preferences FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- Users can update their own preferences
CREATE POLICY "user_preferences_update_own"
  ON public.user_preferences FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- Users can insert their own preferences (first login)
CREATE POLICY "user_preferences_insert_own"
  ON public.user_preferences FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);
```

**Checklist:**

- [ ] Migration file created
- [ ] RLS enabled on `users` table
- [ ] RLS enabled on `user_preferences` table
- [ ] SELECT policies created
- [ ] UPDATE policies created
- [ ] INSERT policy created for preferences

### Step 2: Test Policies (30 min)

**File:** `supabase/tests/001_rls_auth_tables.sql`

```sql
begin;
select plan(8);

-- Create test users
select tests.create_supabase_user('user1', 'user1@test.com');
select tests.create_supabase_user('user2', 'user2@test.com');

-- Insert user data
INSERT INTO public.users (id, email, first_name, last_name)
VALUES
  (tests.get_supabase_uid('user1'), 'user1@test.com', 'User', 'One'),
  (tests.get_supabase_uid('user2'), 'user2@test.com', 'User', 'Two');

-- Test as User 1
select tests.authenticate_as('user1');

-- Test 1: User can see own profile
select results_eq(
  'SELECT COUNT(*)::int FROM public.users WHERE id = tests.get_supabase_uid(''user1'')',
  ARRAY[1],
  'User 1 can see own profile'
);

-- Test 2: User cannot see other profiles
select results_eq(
  'SELECT COUNT(*)::int FROM public.users WHERE id = tests.get_supabase_uid(''user2'')',
  ARRAY[0],
  'User 1 cannot see User 2 profile'
);

-- Test 3: User can update own profile
select lives_ok(
  $$UPDATE public.users SET first_name = 'Updated' WHERE id = tests.get_supabase_uid('user1')$$,
  'User 1 can update own profile'
);

-- Test 4: User cannot update other profiles
select throws_ok(
  $$UPDATE public.users SET first_name = 'Hacked' WHERE id = tests.get_supabase_uid('user2')$$,
  '42501',
  NULL,
  'User 1 cannot update User 2 profile'
);

-- Test preferences
INSERT INTO public.user_preferences (user_id, theme)
VALUES
  (tests.get_supabase_uid('user1'), 'dark'),
  (tests.get_supabase_uid('user2'), 'light');

-- Test 5: User can see own preferences
select results_eq(
  'SELECT COUNT(*)::int FROM public.user_preferences WHERE user_id = tests.get_supabase_uid(''user1'')',
  ARRAY[1],
  'User 1 can see own preferences'
);

-- Test 6: User cannot see other preferences
select results_eq(
  'SELECT COUNT(*)::int FROM public.user_preferences WHERE user_id = tests.get_supabase_uid(''user2'')',
  ARRAY[0],
  'User 1 cannot see User 2 preferences'
);

-- Test 7: User can update own preferences
select lives_ok(
  $$UPDATE public.user_preferences SET theme = 'light' WHERE user_id = tests.get_supabase_uid('user1')$$,
  'User 1 can update own preferences'
);

-- Test 8: User cannot update other preferences
select throws_ok(
  $$UPDATE public.user_preferences SET theme = 'dark' WHERE user_id = tests.get_supabase_uid('user2')$$,
  '42501',
  NULL,
  'User 1 cannot update User 2 preferences'
);

select * from finish();
rollback;
```

**Checklist:**

- [ ] Test file created
- [ ] Test users created
- [ ] Profile access tests passing
- [ ] Profile update tests passing
- [ ] Preferences access tests passing
- [ ] Preferences update tests passing
- [ ] Cross-user access blocked
- [ ] All 8 tests passing

### Step 3: Apply Migration (10 min)

```bash
# Apply migration to remote database
npm run supabase:migration:up

# Run tests
npm run supabase:test
```

**Checklist:**

- [ ] Migration applied successfully
- [ ] No migration errors
- [ ] Tests passing on remote database

### Step 4: Manual Verification (20 min)

**Test Scenarios:**

1. **Login as User A**
   - [ ] Can view own profile at `/dashboard/account/profile`
   - [ ] Can update own profile
   - [ ] Can update own preferences
   - [ ] Cannot access User B's profile URL

2. **Login as User B**
   - [ ] Can view own profile
   - [ ] Cannot see User A's data
   - [ ] Profile changes don't affect User A

**Checklist:**

- [ ] Manual testing complete
- [ ] No errors in browser console
- [ ] Context loading still works
- [ ] User switching still works

### Definition of Done ✅

- [ ] Migration applied successfully
- [ ] All policies created (5 policies)
- [ ] All pgTAP tests passing (8 tests)
- [ ] Manual testing complete
- [ ] Users can ONLY access their own data
- [ ] No regression in existing features
- [ ] Documentation updated

---

## Task 1.2: Enable RLS on Permission Tables (2 hours) ⚪

**Goal:** Secure RBAC system tables while maintaining read access for permission checks

### Step 1: Create Migration (30 min)

**File:** `supabase/migrations/YYYYMMDDHHMMSS_enable_rls_permission_tables.sql`

```sql
-- Enable RLS on permission-related tables
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_role_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permission_overrides ENABLE ROW LEVEL SECURITY;

-- Role definitions are public (needed for UI display)
CREATE POLICY "roles_select_authenticated"
  ON public.roles FOR SELECT
  TO authenticated
  USING (true);

-- Permission definitions are public
CREATE POLICY "permissions_select_authenticated"
  ON public.permissions FOR SELECT
  TO authenticated
  USING (true);

-- Role-permission mappings are public
CREATE POLICY "role_permissions_select_authenticated"
  ON public.role_permissions FOR SELECT
  TO authenticated
  USING (true);

-- Users can view their own role assignments
CREATE POLICY "user_role_assignments_select_own"
  ON public.user_role_assignments FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- Org owners can manage role assignments in their org
CREATE POLICY "user_role_assignments_manage_org_owners"
  ON public.user_role_assignments FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_role_assignments ura
      JOIN public.roles r ON ura.role_id = r.id
      WHERE ura.user_id = (select auth.uid())
      AND r.slug = 'org_owner'
      AND ura.scope = 'org'
      AND ura.scope_id = user_role_assignments.scope_id
      AND ura.deleted_at IS NULL
    )
  );

-- Users can view their own permission overrides
CREATE POLICY "user_permission_overrides_select_own"
  ON public.user_permission_overrides FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- Only org owners can manage permission overrides
CREATE POLICY "user_permission_overrides_manage_org_owners"
  ON public.user_permission_overrides FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_role_assignments ura
      JOIN public.roles r ON ura.role_id = r.id
      WHERE ura.user_id = (select auth.uid())
      AND r.slug = 'org_owner'
      AND ura.scope = 'org'
      AND ura.scope_id = user_permission_overrides.scope_id
      AND ura.deleted_at IS NULL
    )
  );
```

**Checklist:**

- [ ] Migration file created
- [ ] RLS enabled on 5 tables
- [ ] Public read policies (3 policies)
- [ ] User-specific policies (2 policies)
- [ ] Org owner management policies (2 policies)

### Step 2: Test Policies (1 hour)

**File:** `supabase/tests/002_rls_permission_tables.sql`

**Test Coverage:**

- [ ] Test users can view role definitions
- [ ] Test users can view permission definitions
- [ ] Test users can view role-permission mappings
- [ ] Test users can view own assignments
- [ ] Test users cannot view others' assignments
- [ ] Test users cannot modify assignments
- [ ] Test org owners can manage assignments in their org
- [ ] Test org owners cannot manage other orgs
- [ ] Test permission overrides work similarly
- [ ] Test privilege escalation blocked

**Checklist:**

- [ ] Test file created (15 tests)
- [ ] All tests passing
- [ ] Edge cases covered

### Step 3: Apply & Verify (30 min)

```bash
npm run supabase:migration:up
npm run supabase:test
```

**Manual Testing:**

- [ ] Permission system still loads correctly
- [ ] `usePermissions()` hook still works
- [ ] Permission debug panel shows data
- [ ] Org owner can assign roles
- [ ] Regular user cannot assign roles

### Definition of Done ✅

- [ ] Migration applied
- [ ] 10+ policies created
- [ ] 15 pgTAP tests passing
- [ ] Permission system works
- [ ] Org owners can manage roles
- [ ] Regular users cannot escalate privileges

---

## Task 1.3: Enable RLS on Organization Tables (2 hours) ⚪

**Goal:** Secure multi-tenancy with org/branch isolation

### Step 1: Create Helper Functions (1 hour)

**File:** `supabase/migrations/YYYYMMDDHHMMSS_create_rls_helpers.sql`

```sql
-- Create private schema for security definer functions
CREATE SCHEMA IF NOT EXISTS private;

-- Helper: Get user's organizations
CREATE OR REPLACE FUNCTION private.get_user_orgs(p_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT DISTINCT ura.scope_id
  FROM public.user_role_assignments ura
  WHERE ura.user_id = p_user_id
  AND ura.scope = 'org'
  AND ura.deleted_at IS NULL;
$$;

-- Helper: Check if user is org owner
CREATE OR REPLACE FUNCTION private.is_org_owner(p_user_id uuid, p_org_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_role_assignments ura
    JOIN public.roles r ON ura.role_id = r.id
    WHERE ura.user_id = p_user_id
    AND ura.scope_id = p_org_id
    AND ura.scope = 'org'
    AND r.slug = 'org_owner'
    AND ura.deleted_at IS NULL
  );
$$;

-- Helper: Check if user is org admin or owner
CREATE OR REPLACE FUNCTION private.is_org_admin(p_user_id uuid, p_org_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_role_assignments ura
    JOIN public.roles r ON ura.role_id = r.id
    WHERE ura.user_id = p_user_id
    AND ura.scope_id = p_org_id
    AND ura.scope = 'org'
    AND r.slug IN ('org_owner', 'org_admin')
    AND ura.deleted_at IS NULL
  );
$$;

-- Helper: Check if user has branch access
CREATE OR REPLACE FUNCTION private.has_branch_access(p_user_id uuid, p_branch_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.branches b
    WHERE b.id = p_branch_id
    AND b.organization_id IN (SELECT private.get_user_orgs(p_user_id))
    AND b.deleted_at IS NULL
  );
$$;
```

**Checklist:**

- [ ] Private schema created
- [ ] get_user_orgs() function created
- [ ] is_org_owner() function created
- [ ] is_org_admin() function created
- [ ] has_branch_access() function created
- [ ] All functions use SECURITY DEFINER
- [ ] All functions marked STABLE

### Step 2: Enable RLS on Org Tables (30 min)

**File:** `supabase/migrations/YYYYMMDDHHMMSS_enable_rls_organization_tables.sql`

```sql
-- Enable RLS on organization tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

-- Users can view organizations they belong to
CREATE POLICY "organizations_select_member"
  ON public.organizations FOR SELECT
  TO authenticated
  USING (
    id IN (SELECT private.get_user_orgs((select auth.uid())))
  );

-- Org owners can update organization
CREATE POLICY "organizations_update_owner"
  ON public.organizations FOR UPDATE
  TO authenticated
  USING (private.is_org_owner((select auth.uid()), id))
  WITH CHECK (private.is_org_owner((select auth.uid()), id));

-- Users can view organization profiles they belong to
CREATE POLICY "organization_profiles_select_member"
  ON public.organization_profiles FOR SELECT
  TO authenticated
  USING (
    organization_id IN (SELECT private.get_user_orgs((select auth.uid())))
  );

-- Org owners can update organization profile
CREATE POLICY "organization_profiles_update_owner"
  ON public.organization_profiles FOR UPDATE
  TO authenticated
  USING (private.is_org_owner((select auth.uid()), organization_id))
  WITH CHECK (private.is_org_owner((select auth.uid()), organization_id));

-- Users can view branches in their organizations
CREATE POLICY "branches_select_member"
  ON public.branches FOR SELECT
  TO authenticated
  USING (
    organization_id IN (SELECT private.get_user_orgs((select auth.uid())))
    AND deleted_at IS NULL
  );

-- Org admins can manage branches
CREATE POLICY "branches_insert_admin"
  ON public.branches FOR INSERT
  TO authenticated
  WITH CHECK (private.is_org_admin((select auth.uid()), organization_id));

CREATE POLICY "branches_update_admin"
  ON public.branches FOR UPDATE
  TO authenticated
  USING (private.is_org_admin((select auth.uid()), organization_id))
  WITH CHECK (private.is_org_admin((select auth.uid()), organization_id));

CREATE POLICY "branches_delete_admin"
  ON public.branches FOR DELETE
  TO authenticated
  USING (private.is_org_admin((select auth.uid()), organization_id));
```

**Checklist:**

- [ ] RLS enabled on organizations
- [ ] RLS enabled on organization_profiles
- [ ] RLS enabled on branches
- [ ] SELECT policies created
- [ ] UPDATE policies created
- [ ] INSERT/DELETE policies for branches

### Step 3: Test Policies (30 min)

**File:** `supabase/tests/003_rls_organization_tables.sql`

**Test Coverage:**

- [ ] User can see own organizations
- [ ] User cannot see other organizations
- [ ] Org owner can update org
- [ ] Non-owner cannot update org
- [ ] User can see org branches
- [ ] User cannot see other org branches
- [ ] Org admin can create branches
- [ ] Regular user cannot create branches
- [ ] Cross-tenant isolation verified

**Checklist:**

- [ ] Test file created (12 tests)
- [ ] All tests passing

### Definition of Done ✅

- [ ] Helper functions created (4 functions)
- [ ] RLS enabled on 3 tables
- [ ] 6+ policies created
- [ ] 12 pgTAP tests passing
- [ ] Users only see their orgs
- [ ] Cross-tenant access blocked
- [ ] Org/branch switching still works

---

## Task 1.4: Add Performance Indexes (1 hour) ⚪

**Goal:** Ensure RLS policies perform well at scale

### Step 1: Create Indexes (30 min)

**File:** `supabase/migrations/YYYYMMDDHHMMSS_add_rls_performance_indexes.sql`

```sql
-- Indexes for RLS policy performance
CREATE INDEX IF NOT EXISTS idx_users_id
  ON public.users(id);

CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id
  ON public.user_preferences(user_id);

CREATE INDEX IF NOT EXISTS idx_user_role_assignments_user_scope
  ON public.user_role_assignments(user_id, scope, scope_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_user_permission_overrides_user_scope
  ON public.user_permission_overrides(user_id, scope, scope_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_organizations_id
  ON public.organizations(id);

CREATE INDEX IF NOT EXISTS idx_organization_profiles_org_id
  ON public.organization_profiles(organization_id);

CREATE INDEX IF NOT EXISTS idx_branches_org_id
  ON public.branches(organization_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_roles_slug
  ON public.roles(slug);

-- Analyze tables for query planner
ANALYZE public.users;
ANALYZE public.user_preferences;
ANALYZE public.user_role_assignments;
ANALYZE public.user_permission_overrides;
ANALYZE public.organizations;
ANALYZE public.organization_profiles;
ANALYZE public.branches;
ANALYZE public.roles;
```

**Checklist:**

- [ ] All indexes created (7 indexes)
- [ ] Partial indexes use WHERE clause
- [ ] ANALYZE run on all tables

### Step 2: Measure Performance (30 min)

**File:** `docs/coreframe-rebuild/Phase-1-RLS-Security/PERFORMANCE_BENCHMARKS.md`

**Benchmarks to Run:**

```sql
-- 1. Permission loading time
EXPLAIN ANALYZE
SELECT * FROM get_user_permissions_snapshot('user-id', 'org-id', 'branch-id');

-- 2. Get user orgs
EXPLAIN ANALYZE
SELECT * FROM private.get_user_orgs('user-id');

-- 3. Org ownership check
EXPLAIN ANALYZE
SELECT private.is_org_owner('user-id', 'org-id');

-- 4. User profile access
EXPLAIN ANALYZE
SELECT * FROM public.users WHERE id = 'user-id';

-- 5. Branch list
EXPLAIN ANALYZE
SELECT * FROM public.branches WHERE organization_id = 'org-id';
```

**Target Metrics:**

- [ ] Permission load < 200ms
- [ ] get_user_orgs() < 50ms
- [ ] is_org_owner() < 20ms
- [ ] User profile < 10ms
- [ ] Branch list < 50ms

**Checklist:**

- [ ] Benchmarks documented
- [ ] All queries under target
- [ ] No N+1 queries found
- [ ] Query plans reviewed

### Definition of Done ✅

- [ ] 7 indexes created
- [ ] Performance benchmarks documented
- [ ] All queries meet targets
- [ ] No performance regressions

---

## Task 1.5: Security Audit & Testing (4 hours) ⚪

**Goal:** Comprehensive security verification with multiple roles

### Step 1: Manual Security Testing (2 hours)

**Test Scenarios:**

#### 1. Org Owner Tests

- [ ] Can view all users in org
- [ ] Can assign roles to users
- [ ] Can create/edit/delete branches
- [ ] Can update org settings
- [ ] Can manage permission overrides
- [ ] Cannot access other orgs

#### 2. Branch Admin Tests

- [ ] Can view users in org
- [ ] Can manage users in their branch
- [ ] Cannot manage org settings
- [ ] Cannot create branches
- [ ] Cannot access other orgs

#### 3. Regular User Tests

- [ ] Can view own profile
- [ ] Can update own preferences
- [ ] Can view org/branch data
- [ ] Cannot assign roles
- [ ] Cannot manage branches
- [ ] Cannot access other orgs

#### 4. Cross-Tenant Isolation

- [ ] User A cannot see Org B data
- [ ] User A cannot modify Org B data
- [ ] Direct URL access blocked
- [ ] API calls blocked
- [ ] No data leakage in errors

#### 5. Permission System Tests

- [ ] Wildcard permissions work
- [ ] Deny overrides work
- [ ] Branch permissions work
- [ ] Org permissions work
- [ ] Permission changes reflect immediately

**Checklist:**

- [ ] All 5 test categories complete
- [ ] All scenarios passing
- [ ] No security issues found
- [ ] Findings documented

### Step 2: Automated Security Tests (2 hours)

**File:** `src/__tests__/integration/rls-security.test.ts`

**Test Coverage:**

```typescript
describe("RLS Security", () => {
  describe("Cross-Tenant Isolation", () => {
    it("should block cross-org data access", async () => {
      // Test implementation
    });

    it("should block cross-branch data access", async () => {
      // Test implementation
    });

    it("should block direct ID access to other orgs", async () => {
      // Test implementation
    });
  });

  describe("Role-Based Access", () => {
    it("should enforce org owner privileges", async () => {
      // Test implementation
    });

    it("should enforce branch admin privileges", async () => {
      // Test implementation
    });

    it("should restrict regular user access", async () => {
      // Test implementation
    });
  });

  describe("Permission System", () => {
    it("should enforce permission checks", async () => {
      // Test implementation
    });

    it("should respect wildcard permissions", async () => {
      // Test implementation
    });

    it("should respect deny overrides", async () => {
      // Test implementation
    });
  });
});
```

**Checklist:**

- [ ] Integration test file created
- [ ] 50+ security tests written
- [ ] All tests passing
- [ ] CI/CD integration added

### Definition of Done ✅

- [ ] Manual security testing 100% complete
- [ ] No cross-tenant data leaks found
- [ ] Permission system works correctly
- [ ] 50+ automated security tests passing
- [ ] All edge cases documented
- [ ] Security audit report created

---

## Task 1.6: Performance Benchmarking (2 hours) ⚪

**Goal:** Document and optimize performance

**File:** `docs/coreframe-rebuild/Phase-1-RLS-Security/PERFORMANCE_BENCHMARKS.md`

**Benchmarks:**

- [ ] Permission snapshot loading
- [ ] Context loading (user + app)
- [ ] RLS policy query times
- [ ] Page load times
- [ ] Cache hit rates

**Targets:**

- [ ] Permission load < 200ms
- [ ] Context load < 300ms
- [ ] Page load < 2s
- [ ] No N+1 queries

---

## Task 1.7: Debug Panel Enhancement (2 hours) ⚪

**Goal:** Add RLS and performance visibility to debug panel

**Features to Add:**

- [ ] RLS status indicators
- [ ] Policy enforcement logs
- [ ] Performance timings
- [ ] Security warnings
- [ ] Test permission checker

---

## 📈 Success Metrics

### Security ✅

- [ ] Zero cross-tenant data leaks
- [ ] 100% permission enforcement
- [ ] Proper override handling
- [ ] Wildcard support working

### Performance ✅

- [ ] Permission load < 200ms
- [ ] Permission check < 1ms
- [ ] No N+1 queries
- [ ] Page load < 2s

### Testing ✅

- [ ] 110+ tests passing
- [ ] All RLS tables tested
- [ ] Manual testing complete
- [ ] Security audit complete

### Quality ✅

- [ ] All migrations applied
- [ ] No TypeScript errors
- [ ] No regression bugs
- [ ] Documentation complete

---

## 🚨 Known Risks

1. **Performance Degradation**
   - Risk: RLS policies may slow queries
   - Mitigation: Indexes + benchmarking

2. **Breaking Changes**
   - Risk: Enabling RLS may break features
   - Mitigation: Comprehensive testing

3. **Complex Policies**
   - Risk: Hard to debug policy issues
   - Mitigation: Debug panel + logging

---

## 🔄 Next Steps

After Phase 1 completion:

- Move to Phase 2: UI Primitives
- Enable RLS on domain tables incrementally
- Build permission management UI

---

**Last Updated:** 2026-01-27
**Status:** 🔵 In Progress (30%)
**Next Task:** 1.1 Enable RLS on Auth Tables
