# RLS and Permissions Verification Plan

**Date:** 2026-01-19
**Phase:** Post Dashboard V2 Header Implementation
**Duration:** ~2-3 days
**Status:** 🚧 In Progress

---

## 🎯 Executive Summary

### Current State

- ✅ Permission system fully implemented with granular permissions and overrides
- ✅ AuthService extracting roles from JWT
- ✅ PermissionService with wildcard support and deny-first semantics
- ✅ Server-side context loaders (loadAppContextServer, loadUserContextServer)
- ⚠️ **ALL RLS is currently DISABLED** (by design during development)
- ⚠️ No comprehensive testing of permission loading flow
- ⚠️ No verification of security boundaries
- ⚠️ No performance metrics for permission calculations

### Goal

Enable RLS for auth and permission-related tables ONLY, verify the entire permission system works correctly (frontend + backend), and create a solid foundation for incrementally enabling RLS on other tables as features are added.

---

## ✅ Definition of Done

### Security Requirements

- [ ] RLS enabled on all auth/permission tables
- [ ] Users can ONLY perform operations they have permissions for
- [ ] Permission checks work on both client and server
- [ ] Cross-tenant data access is impossible
- [ ] Permission overrides (deny-first) work correctly
- [ ] Wildcard permissions work as expected
- [ ] Granular permissions with scope (org/branch) enforced
- [ ] Service role bypass works for admin operations

### Performance Requirements

- [ ] Permission loading completes in < 200ms (server-side)
- [ ] Permission checks in < 1ms (using cached snapshots)
- [ ] No N+1 queries in permission loading
- [ ] Context loaders use React cache() properly (no redundant calls)
- [ ] Permission snapshots cached client-side (Zustand)

### Functional Requirements

- [ ] `/dashboard/start` page displays all permission details
- [ ] Users see only allowed UI elements (buttons, menu items, etc.)
- [ ] Server actions enforce permissions before operations
- [ ] Permission changes reflect immediately (no stale state)
- [ ] Branch switching updates permissions correctly
- [ ] Organization switching updates permissions correctly

### Testing Requirements

- [ ] Unit tests for PermissionService (85% coverage)
- [ ] Integration tests for RLS policies (all tables)
- [ ] End-to-end tests for permission flows
- [ ] Manual testing checklist completed
- [ ] Performance benchmarks documented

---

## 📋 Implementation Checklist

### Phase 1: Comprehensive Analysis & Documentation (3-4 hours)

#### 1.1 Current Permission System Audit

- [ ] Document all permission-related tables and relationships
  - [ ] `roles` table structure and data
  - [ ] `permissions` table structure and data
  - [ ] `role_permissions` join table
  - [ ] `user_role_assignments` table (with scope support)
  - [ ] `user_permission_overrides` table (with scope precedence)
  - [ ] `user_modules` table (for feature gating)
- [ ] Analyze permission flow from server to client
  - [ ] `loadUserContextServer()` → PermissionService → JWT
  - [ ] `loadAppContextServer()` → Zustand → Client components
  - [ ] Permission snapshot structure (allow/deny lists)
- [ ] Document all permission check points
  - [ ] Server actions (via `loadAppContextServer`)
  - [ ] Client components (via `useUserStoreV2`, `useAppStoreV2`)
  - [ ] RLS policies (via `public.authorize()` function)
- [ ] Identify all tables currently without RLS
  - [ ] Create inventory of tables by category (auth, permissions, domain, etc.)
  - [ ] Prioritize order for RLS enablement

#### 1.2 Review Existing Tests

- [ ] Audit `src/server/services/__tests__/permission.service.test.ts` (88 tests)
  - [ ] Document test coverage gaps
  - [ ] Identify missing edge cases
  - [ ] Check for deny-first semantics tests
  - [ ] Verify wildcard matching tests
- [ ] Review any existing RLS tests
- [ ] Document untested scenarios

#### 1.3 Study Supabase Best Practices

- [x] Read Supabase RLS documentation
- [ ] Study performance optimization techniques
  - [ ] Index strategies for policies
  - [ ] `select` wrapper for functions (`(select auth.uid())`)
  - [ ] Security definer functions
  - [ ] Minimize joins in policies
- [ ] Review RLS testing patterns (pgTAP)
- [ ] Study Custom Access Token hooks (for JWT customization)

---

### Phase 2: Enhanced Permission Visibility (/dashboard/start) (4-5 hours)

#### 2.1 Create Permission Debug Components

**File:** `src/components/v2/debug/permission-debug-panel.tsx`

```tsx
"use client";

import { useUserStoreV2 } from "@/lib/stores/v2/user-store";
import { useAppStoreV2 } from "@/lib/stores/v2/app-store";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/**
 * Debug panel showing all permission and session details
 * ONLY visible in development mode
 */
export function PermissionDebugPanel() {
  if (process.env.NODE_ENV !== "development") return null;

  const { user, permissions } = useUserStoreV2();
  const { activeOrgId, activeBranchId, activeOrg, activeBranch } = useAppStoreV2();

  return (
    <Card className="border-2 border-yellow-500">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          🔍 Permission Debug Panel
          <Badge variant="destructive">DEV ONLY</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="session">
          <TabsList>
            <TabsTrigger value="session">Session</TabsTrigger>
            <TabsTrigger value="permissions">Permissions</TabsTrigger>
            <TabsTrigger value="context">Context</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
          </TabsList>

          <TabsContent value="session">{/* User session details */}</TabsContent>

          <TabsContent value="permissions">
            {/* All permissions with allow/deny lists */}
          </TabsContent>

          <TabsContent value="context">{/* Org/Branch context details */}</TabsContent>

          <TabsContent value="performance">
            {/* Timing metrics for permission loading */}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
```

#### 2.2 Implement Permission Snapshot Visualization

- [ ] Display all allowed permissions (with wildcard indicators)
- [ ] Display all denied permissions (highlight overrides)
- [ ] Show permission count and loading time
- [ ] Show scope information (org vs branch permissions)
- [ ] Highlight granular permission overrides
- [ ] Add search/filter functionality

#### 2.3 Add Session Information Display

- [ ] User ID, email, names
- [ ] Active organization and branch
- [ ] Available organizations and branches
- [ ] User modules (feature gates)
- [ ] JWT claims (redacted sensitive info)
- [ ] Session age and expiry

#### 2.4 Add Performance Metrics

- [ ] Time to load user context
- [ ] Time to load app context
- [ ] Time to calculate permissions
- [ ] Number of database queries
- [ ] Cache hit/miss ratio

#### 2.5 Add Permission Testing UI

- [ ] Interactive permission checker
  - Input: permission slug (e.g., "warehouse.products.delete")
  - Output: Allowed/Denied with explanation
- [ ] Show matching wildcard patterns
- [ ] Explain which override won (if applicable)

---

### Phase 3: RLS Policy Implementation (5-6 hours)

#### 3.1 Enable RLS on Auth Tables

**Migration:** `supabase/migrations/YYYYMMDDHHMMSS_enable_rls_auth_tables.sql`

```sql
-- Enable RLS on auth-related tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON public.users FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);

-- Users can view their own preferences
CREATE POLICY "Users can view own preferences"
  ON public.user_preferences FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- Users can update their own preferences
CREATE POLICY "Users can update own preferences"
  ON public.user_preferences FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- Users can insert their own preferences (on first login)
CREATE POLICY "Users can insert own preferences"
  ON public.user_preferences FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);
```

**Tests:** `supabase/tests/001_rls_auth_tables.sql`

#### 3.2 Enable RLS on Permission Tables

**Migration:** `supabase/migrations/YYYYMMDDHHMMSS_enable_rls_permission_tables.sql`

```sql
-- Enable RLS on permission-related tables
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_role_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permission_overrides ENABLE ROW LEVEL SECURITY;

-- Public can view role definitions (needed for UI display)
CREATE POLICY "Roles are viewable by authenticated users"
  ON public.roles FOR SELECT
  TO authenticated
  USING (true);

-- Public can view permission definitions
CREATE POLICY "Permissions are viewable by authenticated users"
  ON public.permissions FOR SELECT
  TO authenticated
  USING (true);

-- Public can view role-permission mappings
CREATE POLICY "Role permissions are viewable by authenticated users"
  ON public.role_permissions FOR SELECT
  TO authenticated
  USING (true);

-- Users can view their own role assignments
CREATE POLICY "Users can view own role assignments"
  ON public.user_role_assignments FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- Org owners can manage role assignments in their org
CREATE POLICY "Org owners can manage role assignments"
  ON public.user_role_assignments FOR ALL
  TO authenticated
  USING (
    scope = 'org' AND
    scope_id IN (
      SELECT organization_id
      FROM public.user_roles
      WHERE user_id = (select auth.uid())
      AND role IN ('org_owner')
    )
  );

-- Users can view their own permission overrides
CREATE POLICY "Users can view own permission overrides"
  ON public.user_permission_overrides FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- Only org owners can create/modify permission overrides
CREATE POLICY "Org owners can manage permission overrides"
  ON public.user_permission_overrides FOR ALL
  TO authenticated
  USING (
    scope IN ('org', 'branch') AND
    scope_id IN (
      SELECT organization_id
      FROM public.user_roles
      WHERE user_id = (select auth.uid())
      AND role IN ('org_owner')
    )
  );
```

**Tests:** `supabase/tests/002_rls_permission_tables.sql`

#### 3.3 Create RLS Helper Functions

**File:** `supabase/migrations/YYYYMMDDHHMMSS_create_rls_helpers.sql`

```sql
-- Create private schema for security definer functions
CREATE SCHEMA IF NOT EXISTS private;

-- Helper: Get user's organizations
CREATE OR REPLACE FUNCTION private.get_user_orgs(user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id
  FROM user_roles
  WHERE user_id = $1
  AND deleted_at IS NULL;
$$;

-- Helper: Check if user is org owner
CREATE OR REPLACE FUNCTION private.is_org_owner(user_id uuid, org_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_roles
    WHERE user_id = $1
    AND organization_id = $2
    AND role IN ('org_owner')
    AND deleted_at IS NULL
  );
$$;

-- Helper: Check if user is org admin or owner
CREATE OR REPLACE FUNCTION private.is_org_admin(user_id uuid, org_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_roles
    WHERE user_id = $1
    AND organization_id = $2
    AND role IN ('org_owner', 'org_admin')
    AND deleted_at IS NULL
  );
$$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_roles_user_org
  ON user_roles(user_id, organization_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_user_role_assignments_user_scope
  ON user_role_assignments(user_id, scope, scope_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_user_permission_overrides_user_scope
  ON user_permission_overrides(user_id, scope, scope_id)
  WHERE deleted_at IS NULL;
```

#### 3.4 Enable RLS on Organization Tables

**Migration:** `supabase/migrations/YYYYMMDDHHMMSS_enable_rls_organization_tables.sql`

```sql
-- Enable RLS on organization tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

-- Users can view organizations they belong to
CREATE POLICY "Users can view their organizations"
  ON public.organizations FOR SELECT
  TO authenticated
  USING (
    id IN (SELECT private.get_user_orgs((select auth.uid())))
  );

-- Org owners can update organization
CREATE POLICY "Org owners can update organization"
  ON public.organizations FOR UPDATE
  TO authenticated
  USING (private.is_org_owner((select auth.uid()), id))
  WITH CHECK (private.is_org_owner((select auth.uid()), id));

-- Users can view organization profiles they belong to
CREATE POLICY "Users can view their org profiles"
  ON public.organization_profiles FOR SELECT
  TO authenticated
  USING (
    organization_id IN (SELECT private.get_user_orgs((select auth.uid())))
  );

-- Org owners can update organization profile
CREATE POLICY "Org owners can update org profile"
  ON public.organization_profiles FOR UPDATE
  TO authenticated
  USING (private.is_org_owner((select auth.uid()), organization_id))
  WITH CHECK (private.is_org_owner((select auth.uid()), organization_id));

-- Users can view branches in their organizations
CREATE POLICY "Users can view org branches"
  ON public.branches FOR SELECT
  TO authenticated
  USING (
    organization_id IN (SELECT private.get_user_orgs((select auth.uid())))
    AND deleted_at IS NULL
  );

-- Org admins can manage branches
CREATE POLICY "Org admins can manage branches"
  ON public.branches FOR ALL
  TO authenticated
  USING (private.is_org_admin((select auth.uid()), organization_id));
```

**Tests:** `supabase/tests/003_rls_organization_tables.sql`

---

### Phase 4: Comprehensive Testing (6-8 hours)

#### 4.1 Unit Tests - PermissionService

**File:** `src/server/services/__tests__/permission.service.test.ts` (enhance existing)

- [ ] Test permission snapshot loading
  - [ ] Org-only permissions
  - [ ] Branch-specific permissions
  - [ ] Global, org, and branch overrides
  - [ ] Override precedence (branch > org > global)
  - [ ] Same-scope override tiebreaker (newest wins)
- [ ] Test permission checking (can method)
  - [ ] Exact permission match
  - [ ] Wildcard permission match ("warehouse.\*")
  - [ ] Nested wildcard ("warehouse.products.\*")
  - [ ] Deny override with wildcard
  - [ ] Edge cases (empty lists, null, undefined)
- [ ] Test performance
  - [ ] Benchmark permission snapshot loading
  - [ ] Benchmark permission checking
  - [ ] Verify no N+1 queries

#### 4.2 Integration Tests - RLS Policies

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
  'SELECT COUNT(*) FROM public.users WHERE id = tests.get_supabase_uid(''user1'')',
  ARRAY[1::bigint],
  'User 1 can see own profile'
);

-- Test 2: User cannot see other profiles
select results_eq(
  'SELECT COUNT(*) FROM public.users WHERE id = tests.get_supabase_uid(''user2'')',
  ARRAY[0::bigint],
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

-- ... more tests

select * from finish();
rollback;
```

**File:** `supabase/tests/002_rls_permission_tables.sql`
**File:** `supabase/tests/003_rls_organization_tables.sql`

#### 4.3 End-to-End Tests

**File:** `tests/e2e/permissions.spec.ts` (if using Playwright)

- [ ] Test permission-based UI rendering
  - [ ] Admin sees admin-only buttons
  - [ ] Viewer doesn't see edit buttons
  - [ ] Branch admin sees branch-specific options
- [ ] Test permission enforcement in server actions
  - [ ] Allowed operation succeeds
  - [ ] Denied operation returns error
  - [ ] Permission check happens before database operation
- [ ] Test branch/org switching
  - [ ] Permissions update when switching branches
  - [ ] UI re-renders with correct permissions

#### 4.4 Manual Testing Checklist

- [ ] **User Profile Access**
  - [ ] User can view own profile at `/dashboard/account/profile`
  - [ ] User cannot view other users' profiles
  - [ ] User can update own profile
  - [ ] User cannot update other users' profiles

- [ ] **Organization Access**
  - [ ] User sees only organizations they belong to
  - [ ] User can switch between organizations
  - [ ] Permissions update when switching organizations
  - [ ] Org owner can update organization settings
  - [ ] Non-owner cannot update organization settings

- [ ] **Branch Access**
  - [ ] User sees only branches in their organizations
  - [ ] User can switch between branches
  - [ ] Branch-specific permissions work correctly
  - [ ] Branch admin can create/update branches
  - [ ] Non-admin cannot create/update branches

- [ ] **Permission Display**
  - [ ] `/dashboard/start` shows all permissions
  - [ ] Allow list is accurate
  - [ ] Deny list is accurate
  - [ ] Overrides are highlighted
  - [ ] Wildcard permissions display correctly

- [ ] **Permission Enforcement**
  - [ ] User with "warehouse.products.read" can view products
  - [ ] User without "warehouse.products.read" cannot view products
  - [ ] User with "warehouse.\*" can perform all warehouse operations
  - [ ] Deny override blocks wildcard permissions
  - [ ] Server actions enforce permissions before operations

- [ ] **Performance**
  - [ ] Page loads in < 2 seconds
  - [ ] Permission checks are instant (< 1ms)
  - [ ] No visible lag when switching branches/orgs
  - [ ] DevTools Network tab shows minimal queries

---

### Phase 5: Performance Optimization (3-4 hours)

#### 5.1 Add Database Indexes

```sql
-- Indexes for RLS policy performance
CREATE INDEX IF NOT EXISTS idx_users_id ON public.users(id);
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON public.user_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_user_role_assignments_user_scope ON user_role_assignments(user_id, scope, scope_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_user_permission_overrides_user_scope ON user_permission_overrides(user_id, scope, scope_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_organizations_id ON public.organizations(id);
CREATE INDEX IF NOT EXISTS idx_organization_profiles_org_id ON public.organization_profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_branches_org_id ON public.branches(organization_id) WHERE deleted_at IS NULL;
```

#### 5.2 Optimize Permission Service Queries

- [ ] Review query plans using EXPLAIN ANALYZE
- [ ] Reduce number of round trips to database
- [ ] Use joins instead of separate queries where possible
- [ ] Cache RPC results where appropriate

#### 5.3 Add Performance Monitoring

**File:** `src/lib/utils/performance.ts`

```typescript
export class PerformanceMonitor {
  static timers = new Map<string, number>();

  static start(label: string) {
    this.timers.set(label, Date.now());
  }

  static end(label: string): number {
    const start = this.timers.get(label);
    if (!start) return 0;

    const duration = Date.now() - start;
    this.timers.delete(label);

    if (process.env.NODE_ENV === "development") {
      console.log(`⏱️ ${label}: ${duration}ms`);
    }

    return duration;
  }
}
```

Use in context loaders:

```typescript
export async function loadUserContextServer() {
  PerformanceMonitor.start("loadUserContext");
  // ... existing code
  const duration = PerformanceMonitor.end("loadUserContext");

  return { ...context, _loadTime: duration };
}
```

#### 5.4 Benchmark and Document

- [ ] Create performance benchmarks
  - [ ] Permission snapshot loading time
  - [ ] Permission checking time
  - [ ] Context loading time
  - [ ] Page load time
- [ ] Document results in `docs/coreframe-rebuild/PERFORMANCE_BENCHMARKS.md`
- [ ] Set performance budgets for future changes

---

### Phase 6: Documentation & Knowledge Transfer (2-3 hours)

#### 6.1 Update Developer Documentation

- [ ] Document RLS policy patterns used
- [ ] Create guide for adding RLS to new tables
- [ ] Document permission system architecture
- [ ] Create troubleshooting guide for common issues

#### 6.2 Create RLS Policy Template

**File:** `docs/guides/RLS_POLICY_TEMPLATE.md`

````markdown
# RLS Policy Template

## Basic Table Pattern

```sql
-- Enable RLS
ALTER TABLE public.your_table ENABLE ROW LEVEL SECURITY;

-- Users can view org data
CREATE POLICY "Users can view org data"
  ON public.your_table FOR SELECT
  TO authenticated
  USING (
    organization_id IN (SELECT private.get_user_orgs((select auth.uid())))
  );

-- Users with permission can modify
CREATE POLICY "Users can modify with permission"
  ON public.your_table FOR ALL
  TO authenticated
  USING (
    organization_id IN (SELECT private.get_user_orgs((select auth.uid())))
    AND public.authorize((select auth.uid()), 'your_module.action', organization_id)
  );
```
````

## Testing Template

```sql
begin;
select plan(4);

-- Create test users
select tests.create_supabase_user('user1', 'user1@test.com');
select tests.create_supabase_user('user2', 'user2@test.com');

-- ... setup data

-- Test as User 1
select tests.authenticate_as('user1');

-- Test 1: Can see own org data
-- Test 2: Cannot see other org data
-- Test 3: Can modify with permission
-- Test 4: Cannot modify without permission

select * from finish();
rollback;
```

````

#### 6.3 Update CLAUDE.md

Add section on RLS and Permissions:

```markdown
## Security & Authorization Requirements

**MANDATORY**: When implementing any new feature, you MUST validate and implement proper security measures:

### RLS Enablement Checklist

- [ ] Enable RLS on new table
- [ ] Create SELECT policy (who can view)
- [ ] Create INSERT policy (who can create)
- [ ] Create UPDATE policy (who can modify)
- [ ] Create DELETE policy (who can remove)
- [ ] Add indexes for policy performance
- [ ] Write pgTAP tests for all policies
- [ ] Test with multiple user roles
- [ ] Test cross-tenant isolation

### Permission Validation

- [ ] Check permission exists in `permissions` table
- [ ] Verify role assignments grant permission
- [ ] Test permission overrides (allow and deny)
- [ ] Test wildcard permission matching
- [ ] Verify scope (org vs branch) enforcement

### Testing Requirements

- [ ] Unit tests for service layer
- [ ] Integration tests for RLS policies
- [ ] E2E tests for UI permission gating
- [ ] Manual testing with different roles
- [ ] Performance testing (< 200ms for permission load)
````

---

## 📊 Progress Tracking

### Summary Table

| Phase                       | Tasks  | Complete | Status         |
| --------------------------- | ------ | -------- | -------------- |
| 1. Analysis & Documentation | 13     | 0        | ⏳ Not Started |
| 2. Enhanced Visibility      | 12     | 0        | ⏳ Not Started |
| 3. RLS Implementation       | 16     | 0        | ⏳ Not Started |
| 4. Comprehensive Testing    | 20     | 0        | ⏳ Not Started |
| 5. Performance Optimization | 8      | 0        | ⏳ Not Started |
| 6. Documentation            | 6      | 0        | ⏳ Not Started |
| **TOTAL**                   | **75** | **0**    | **0%**         |

### Detailed Progress

#### Phase 1: Analysis & Documentation (0/13)

- [ ] Document permission-related tables
- [ ] Analyze permission flow
- [ ] Document permission checkpoints
- [ ] Identify tables without RLS
- [ ] Audit existing tests
- [ ] Document test coverage gaps
- [ ] Identify missing edge cases
- [ ] Read Supabase RLS docs
- [ ] Study performance techniques
- [ ] Review testing patterns
- [ ] Study Custom Access Token hooks
- [ ] Create table inventory
- [ ] Prioritize RLS enablement order

#### Phase 2: Enhanced Visibility (0/12)

- [ ] Create PermissionDebugPanel component
- [ ] Implement session tab
- [ ] Implement permissions tab
- [ ] Implement context tab
- [ ] Implement performance tab
- [ ] Add permission search/filter
- [ ] Display wildcard indicators
- [ ] Highlight overrides
- [ ] Show scope information
- [ ] Add interactive permission checker
- [ ] Show matching wildcards
- [ ] Integrate into /dashboard/start

#### Phase 3: RLS Implementation (0/16)

- [ ] Create auth tables migration
- [ ] Create permission tables migration
- [ ] Create org tables migration
- [ ] Create RLS helper functions
- [ ] Create indexes for performance
- [ ] Test auth table policies
- [ ] Test permission table policies
- [ ] Test org table policies
- [ ] Verify cross-tenant isolation
- [ ] Verify permission-based access
- [ ] Verify org owner privileges
- [ ] Verify branch admin privileges
- [ ] Test with service role bypass
- [ ] Verify all policies work together
- [ ] Test with real user scenarios
- [ ] Document any edge cases found

#### Phase 4: Comprehensive Testing (0/20)

- [ ] Enhance PermissionService unit tests
- [ ] Add wildcard matching tests
- [ ] Add deny-first semantics tests
- [ ] Add override precedence tests
- [ ] Add performance benchmarks
- [ ] Create auth table RLS tests
- [ ] Create permission table RLS tests
- [ ] Create org table RLS tests
- [ ] Create E2E permission tests
- [ ] Test UI permission gating
- [ ] Test server action enforcement
- [ ] Test branch switching
- [ ] Complete user profile manual tests
- [ ] Complete org access manual tests
- [ ] Complete branch access manual tests
- [ ] Complete permission display tests
- [ ] Complete permission enforcement tests
- [ ] Complete performance manual tests
- [ ] Document all test results
- [ ] Fix any issues found

#### Phase 5: Performance Optimization (0/8)

- [ ] Add database indexes
- [ ] Optimize permission queries
- [ ] Review query plans
- [ ] Add performance monitoring
- [ ] Create benchmarks
- [ ] Document benchmark results
- [ ] Set performance budgets
- [ ] Verify all metrics meet targets

#### Phase 6: Documentation (0/6)

- [ ] Update developer docs
- [ ] Create RLS policy guide
- [ ] Create RLS policy template
- [ ] Update CLAUDE.md
- [ ] Create troubleshooting guide
- [ ] Document architecture decisions

---

## 🎯 Success Metrics

### Security

- ✅ **Zero cross-tenant data leaks**: Users NEVER see data from other organizations
- ✅ **100% permission enforcement**: ALL operations checked before execution
- ✅ **Proper override handling**: Deny-first semantics work correctly
- ✅ **Wildcard support**: Permissions like "warehouse.\*" work as expected

### Performance

- ✅ **Permission load < 200ms**: Server-side permission calculation is fast
- ✅ **Permission check < 1ms**: Client-side checks are instant
- ✅ **No N+1 queries**: Efficient database queries
- ✅ **Page load < 2s**: Dashboard pages load quickly

### Testing

- ✅ **85% test coverage**: PermissionService well-tested
- ✅ **All RLS tables tested**: pgTAP tests for all policies
- ✅ **E2E tests passing**: Full user flows verified
- ✅ **Manual testing complete**: All scenarios validated

### Developer Experience

- ✅ **Clear documentation**: Easy to add RLS to new tables
- ✅ **Template available**: Copy-paste pattern for RLS
- ✅ **Troubleshooting guide**: Common issues documented
- ✅ **Debug tools available**: Permission visibility in /dashboard/start

---

## 🚧 Known Issues & Risks

### Current Issues

1. **ALL RLS DISABLED**: Need to enable incrementally to avoid breaking changes
2. **No performance baselines**: Need to establish current metrics before optimization
3. **Limited test coverage on RLS**: Only PermissionService has tests, RLS policies untested

### Risks

1. **Performance degradation**: RLS policies may slow down queries
   - **Mitigation**: Add indexes, use security definer functions, benchmark
2. **Breaking existing features**: Enabling RLS may break current functionality
   - **Mitigation**: Thorough testing, incremental rollout, feature flags
3. **Complex permission logic**: Wildcards + overrides + scopes = complexity
   - **Mitigation**: Comprehensive tests, clear documentation, debug tools

---

## 📝 Notes

### Architecture Decisions

**ADR-008: Incremental RLS Enablement**

- **Date:** 2026-01-19
- **Context:** Enabling RLS on all tables at once is risky
- **Decision:** Enable RLS only on auth/permission tables first, then incrementally add to domain tables
- **Status:** ✅ Approved
- **Impact:** Safer rollout, easier debugging, clear priority order

**ADR-009: Permission Debug Panel in Development**

- **Date:** 2026-01-19
- **Context:** Need visibility into permission loading and checking
- **Decision:** Create comprehensive debug panel, visible only in development
- **Status:** ✅ Approved
- **Impact:** Easier debugging, faster development, better testing

**ADR-010: Deny-First Semantics**

- **Date:** 2026-01-19 (existing decision, documented here)
- **Context:** Wildcard permissions need deny overrides to work correctly
- **Decision:** Use deny-first checking: check deny list before allow list
- **Status:** ✅ Implemented
- **Impact:** More secure, intuitive permission management

### Key Files

#### Implementation Files

- `src/server/services/permission.service.ts` - Core permission logic
- `src/lib/api/load-user-context-server.ts` - User context loader
- `src/lib/api/load-app-context-server.ts` - App context loader
- `src/lib/stores/v2/user-store.ts` - Client-side user state
- `src/lib/stores/v2/app-store.ts` - Client-side app state

#### Test Files

- `src/server/services/__tests__/permission.service.test.ts` - Unit tests
- `supabase/tests/001_rls_auth_tables.sql` - Auth RLS tests
- `supabase/tests/002_rls_permission_tables.sql` - Permission RLS tests
- `supabase/tests/003_rls_organization_tables.sql` - Org RLS tests

#### Migration Files

- `supabase/migrations/YYYYMMDDHHMMSS_enable_rls_auth_tables.sql`
- `supabase/migrations/YYYYMMDDHHMMSS_enable_rls_permission_tables.sql`
- `supabase/migrations/YYYYMMDDHHMMSS_enable_rls_organization_tables.sql`
- `supabase/migrations/YYYYMMDDHHMMSS_create_rls_helpers.sql`

#### Documentation Files

- `docs/guides/13-security-patterns.md` - Security guide
- `docs/guides/RLS_POLICY_TEMPLATE.md` - RLS template (to create)
- `docs/coreframe-rebuild/PERFORMANCE_BENCHMARKS.md` - Performance docs (to create)

---

## 🔄 Next Steps After Completion

Once this verification plan is complete:

1. **Incrementally enable RLS on domain tables**
   - Start with read-only tables (lookups, categories)
   - Move to transactional tables (products, movements)
   - End with complex tables (audits, reports)

2. **Add more granular permissions**
   - Define permissions for each module
   - Create role templates for common use cases
   - Document permission naming conventions

3. **Implement permission management UI**
   - Org owners can assign roles
   - Org owners can create overrides
   - Users can view their own permissions

4. **Performance optimization round 2**
   - Query plan analysis for all RLS policies
   - Materialized views for complex permissions
   - Cache warming strategies

---

## 📚 Reference Links

### Supabase Documentation

- [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [RLS Performance](https://supabase.com/docs/guides/database/postgres/row-level-security#rls-performance-recommendations)
- [Testing with pgTAP](https://supabase.com/docs/guides/local-development/testing/pgtap-extended)
- [Custom Access Token Hooks](https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook)

### Internal Documentation

- [Security Patterns Guide](../../docs/guides/13-security-patterns.md)
- [RBAC Fixes Summary](./RBAC_FIXES_SUMMARY.md)
- [Coreframe Rebuild Plan](./COREFRAME_REBUILD.md)

### Community Resources

- [RLS Guide and Best Practices](https://github.com/orgs/supabase/discussions/14576)
- [Supabase Test Helpers](https://github.com/usebasejump/supabase-test-helpers)
- [RLS Performance Tests](https://github.com/GaryAustin1/RLS-Performance)

---

**Last Updated:** 2026-01-19
**Next Review:** After Phase 1 completion
**Owner:** Development Team
