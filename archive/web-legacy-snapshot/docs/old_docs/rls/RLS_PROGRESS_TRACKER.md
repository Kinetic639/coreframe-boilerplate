# RLS Implementation Progress Tracker

**Last Updated:** 2026-01-05
**Current Phase:** Planning
**Overall Status:** 📋 Not Started

---

## Quick Overview

| Phase       | Tables                                           | Status         | Progress | Started | Completed | Notes              |
| ----------- | ------------------------------------------------ | -------------- | -------- | ------- | --------- | ------------------ |
| **Phase 1** | user_preferences, users                          | ⚪ Not Started | 0/2      | -       | -         | Low-risk tables    |
| **Phase 2** | organizations, branches                          | ⚪ Not Started | 0/2      | -       | -         | Multi-tenant core  |
| **Phase 3** | roles, permissions, role_permissions             | ⚪ Not Started | 0/3      | -       | -         | Permission system  |
| **Phase 4** | user_permission_overrides, user_role_assignments | ⚪ Not Started | 0/2      | -       | -         | Critical tables ⚠️ |

**Overall Progress:** 0/9 tables (0%)

**Legend:**

- ✅ Complete
- 🔵 In Progress
- 🟡 Testing
- ⚪ Not Started
- ❌ Blocked

---

## Phase 1: Low-Risk Tables

**Goal:** Start with safest tables to establish workflow
**Duration:** 1-2 days
**Status:** ⚪ Not Started
**Started:** TBD
**Target Completion:** TBD

### Table 1.1: user_preferences

**Status:** ⚪ Not Started

#### Checklist

- [ ] **1. Write integration tests** (RED phase)
  - [ ] Test SELECT policies (user can read own, cannot read others)
  - [ ] Test INSERT policies (user can insert own)
  - [ ] Test UPDATE policies (user can update own, cannot update others)
  - [ ] Test DELETE policies (user can delete own, cannot delete others)
  - [ ] All tests fail before migration (RED confirmed)

- [ ] **2. Create migration**
  - [ ] Migration file: `[timestamp]_enable_rls_user_preferences.sql`
  - [ ] ALTER TABLE ENABLE ROW LEVEL SECURITY
  - [ ] CREATE POLICY "Users manage own preferences"
  - [ ] CREATE POLICY "Service role has full access"
  - [ ] Test migration locally with `pnpm supabase db reset`

- [ ] **3. Run tests** (GREEN phase)
  - [ ] All RLS tests passing
  - [ ] No other tests broken
  - [ ] Type-check passes (`pnpm type-check`)
  - [ ] Lint passes (`pnpm lint`)

- [ ] **4. Apply migration**
  - [ ] Apply to remote with `pnpm supabase db push`
  - [ ] Verify RLS enabled in Supabase dashboard
  - [ ] Verify policies exist

- [ ] **5. Manual smoke test**
  - [ ] Login works
  - [ ] Language preferences save/load
  - [ ] Active org/branch persistence works
  - [ ] No console errors

- [ ] **6. Commit**
  - [ ] Commit test file
  - [ ] Commit migration
  - [ ] Update this progress tracker
  - [ ] Document any issues

**Files Created:**

- `src/server/services/__tests__/rls/user-preferences.rls.test.ts`
- `supabase/migrations/[timestamp]_enable_rls_user_preferences.sql`

**Gate:** ✅ User preferences secured, tests passing

---

### Table 1.2: users

**Status:** ⚪ Not Started

#### Checklist

- [ ] **1. Write integration tests** (RED phase)
  - [ ] Test SELECT policies (own profile, org members, not other orgs)
  - [ ] Test UPDATE policies (can update own)
  - [ ] All tests fail before migration (RED confirmed)

- [ ] **2. Create migration**
  - [ ] Migration file: `[timestamp]_enable_rls_users.sql`
  - [ ] ALTER TABLE ENABLE ROW LEVEL SECURITY
  - [ ] CREATE POLICY "Users can read own profile"
  - [ ] CREATE POLICY "Users can read org members"
  - [ ] CREATE POLICY "Users can update own profile"
  - [ ] CREATE POLICY "Service role has full access"
  - [ ] Test migration locally

- [ ] **3. Run tests** (GREEN phase)
  - [ ] All RLS tests passing
  - [ ] No other tests broken
  - [ ] Type-check passes
  - [ ] Lint passes

- [ ] **4. Apply migration**
  - [ ] Apply to remote
  - [ ] Verify RLS enabled
  - [ ] Verify policies exist

- [ ] **5. Manual smoke test**
  - [ ] User profile displays
  - [ ] User list shows org members only
  - [ ] Cannot see users from other orgs
  - [ ] No console errors

- [ ] **6. Commit**
  - [ ] Commit test file
  - [ ] Commit migration
  - [ ] Update this progress tracker
  - [ ] Document any issues

**Files Created:**

- `src/server/services/__tests__/rls/users.rls.test.ts`
- `supabase/migrations/[timestamp]_enable_rls_users.sql`

**Gate:** ✅ User profiles secured, multi-tenant isolation working

---

## Phase 2: Multi-Tenant Core

**Goal:** Secure organization and branch data
**Duration:** 1-2 days
**Status:** ⚪ Not Started
**Started:** TBD
**Target Completion:** TBD

### Table 2.1: organizations

**Status:** ⚪ Not Started

#### Checklist

- [ ] **1. Write integration tests** (RED phase)
  - [ ] Test SELECT policies (can read own orgs, cannot read others)
  - [ ] Test UPDATE policies (with permission check)
  - [ ] Test DELETE policies (with permission check)
  - [ ] All tests fail before migration (RED confirmed)

- [ ] **2. Create migration**
  - [ ] Migration file: `[timestamp]_enable_rls_organizations.sql`
  - [ ] ALTER TABLE ENABLE ROW LEVEL SECURITY
  - [ ] CREATE POLICY "Users can read their organizations"
  - [ ] CREATE POLICY "Users can update organizations with permission"
  - [ ] CREATE POLICY "Users can delete organizations with permission"
  - [ ] CREATE POLICY "Service role has full access"
  - [ ] Test migration locally

- [ ] **3. Run tests** (GREEN phase)
  - [ ] All RLS tests passing
  - [ ] No other tests broken
  - [ ] Type-check passes
  - [ ] Lint passes

- [ ] **4. Apply migration**
  - [ ] Apply to remote
  - [ ] Verify RLS enabled
  - [ ] Verify policies exist

- [ ] **5. Manual smoke test**
  - [ ] Org selector shows correct orgs
  - [ ] Cannot see other orgs
  - [ ] Org management UI works
  - [ ] Context loading still works
  - [ ] No console errors

- [ ] **6. Commit**
  - [ ] Commit test file
  - [ ] Commit migration
  - [ ] Update this progress tracker
  - [ ] Document any issues

**Files Created:**

- `src/server/services/__tests__/rls/organizations.rls.test.ts`
- `supabase/migrations/[timestamp]_enable_rls_organizations.sql`

**Gate:** ✅ Organization multi-tenant isolation working

---

### Table 2.2: branches

**Status:** ⚪ Not Started

#### Checklist

- [ ] **1. Write integration tests** (RED phase)
  - [ ] Test SELECT policies (can read branches in own org)
  - [ ] Test INSERT policies (with permission check)
  - [ ] Test UPDATE policies (with permission check)
  - [ ] Test DELETE policies (with permission check)
  - [ ] All tests fail before migration (RED confirmed)

- [ ] **2. Create migration**
  - [ ] Migration file: `[timestamp]_enable_rls_branches.sql`
  - [ ] ALTER TABLE ENABLE ROW LEVEL SECURITY
  - [ ] CREATE POLICY "Users can read branches in their organizations"
  - [ ] CREATE POLICY "Users can create branches with permission"
  - [ ] CREATE POLICY "Users can update branches with permission"
  - [ ] CREATE POLICY "Users can delete branches with permission"
  - [ ] CREATE POLICY "Service role has full access"
  - [ ] Test migration locally

- [ ] **3. Run tests** (GREEN phase)
  - [ ] All RLS tests passing
  - [ ] No other tests broken
  - [ ] Type-check passes
  - [ ] Lint passes

- [ ] **4. Apply migration**
  - [ ] Apply to remote
  - [ ] Verify RLS enabled
  - [ ] Verify policies exist

- [ ] **5. Manual smoke test**
  - [ ] Branch selector works
  - [ ] Cannot see branches from other orgs
  - [ ] Branch management UI works
  - [ ] Context loading still works
  - [ ] Org/branch switching works
  - [ ] No console errors

- [ ] **6. Commit**
  - [ ] Commit test file
  - [ ] Commit migration
  - [ ] Update this progress tracker
  - [ ] Document any issues

**Files Created:**

- `src/server/services/__tests__/rls/branches.rls.test.ts`
- `supabase/migrations/[timestamp]_enable_rls_branches.sql`

**Gate:** ✅ Branch multi-tenant isolation working

---

## Phase 3: Permission System

**Goal:** Secure permission tables
**Duration:** 2-3 days
**Status:** ⚪ Not Started
**Started:** TBD
**Target Completion:** TBD

### Table 3.1: roles

**Status:** ⚪ Not Started

#### Checklist

- [ ] **1. Write integration tests** (RED phase)
  - [ ] Test SELECT policies (all authenticated users can read)
  - [ ] Test INSERT policies (with permission check, in own org)
  - [ ] Test UPDATE policies (with permission, non-basic roles only)
  - [ ] Test DELETE policies (with permission, non-basic roles only)
  - [ ] All tests fail before migration (RED confirmed)

- [ ] **2. Create migration**
  - [ ] Migration file: `[timestamp]_enable_rls_roles.sql`
  - [ ] ALTER TABLE ENABLE ROW LEVEL SECURITY
  - [ ] CREATE POLICY "Authenticated users can read roles"
  - [ ] CREATE POLICY "Users can create roles with permission"
  - [ ] CREATE POLICY "Users can update roles with permission"
  - [ ] CREATE POLICY "Users can delete roles with permission"
  - [ ] CREATE POLICY "Service role has full access"
  - [ ] Test migration locally

- [ ] **3. Run tests** (GREEN phase)
  - [ ] All RLS tests passing
  - [ ] No other tests broken
  - [ ] Type-check passes
  - [ ] Lint passes

- [ ] **4. Apply migration**
  - [ ] Apply to remote
  - [ ] Verify RLS enabled
  - [ ] Verify policies exist

- [ ] **5. Manual smoke test**
  - [ ] Role management UI works
  - [ ] Role selection dropdowns work
  - [ ] Cannot edit basic roles
  - [ ] No console errors

- [ ] **6. Commit**
  - [ ] Commit test file
  - [ ] Commit migration
  - [ ] Update this progress tracker
  - [ ] Document any issues

**Files Created:**

- `src/server/services/__tests__/rls/roles.rls.test.ts`
- `supabase/migrations/[timestamp]_enable_rls_roles.sql`

**Gate:** ✅ Role management secured

---

### Table 3.2: permissions

**Status:** ⚪ Not Started

#### Checklist

- [ ] **1. Write integration tests** (RED phase)
  - [ ] Test SELECT policies (all authenticated users can read)
  - [ ] Test INSERT/UPDATE/DELETE policies (superadmin only)
  - [ ] All tests fail before migration (RED confirmed)

- [ ] **2. Create migration**
  - [ ] Migration file: `[timestamp]_enable_rls_permissions.sql`
  - [ ] ALTER TABLE ENABLE ROW LEVEL SECURITY
  - [ ] CREATE POLICY "Authenticated users can read permissions"
  - [ ] CREATE POLICY "Superadmins can manage permissions"
  - [ ] CREATE POLICY "Service role has full access"
  - [ ] Test migration locally

- [ ] **3. Run tests** (GREEN phase)
  - [ ] All RLS tests passing
  - [ ] No other tests broken
  - [ ] Type-check passes
  - [ ] Lint passes

- [ ] **4. Apply migration**
  - [ ] Apply to remote
  - [ ] Verify RLS enabled
  - [ ] Verify policies exist

- [ ] **5. Manual smoke test**
  - [ ] Permission lists display
  - [ ] Only superadmin can manage
  - [ ] No console errors

- [ ] **6. Commit**
  - [ ] Commit test file
  - [ ] Commit migration
  - [ ] Update this progress tracker
  - [ ] Document any issues

**Files Created:**

- `src/server/services/__tests__/rls/permissions.rls.test.ts`
- `supabase/migrations/[timestamp]_enable_rls_permissions.sql`

**Gate:** ✅ Permission management secured

---

### Table 3.3: role_permissions

**Status:** ⚪ Not Started

#### Checklist

- [ ] **1. Write integration tests** (RED phase)
  - [ ] Test SELECT policies (all authenticated users can read)
  - [ ] Test INSERT/UPDATE/DELETE policies (with permission check)
  - [ ] All tests fail before migration (RED confirmed)

- [ ] **2. Create migration**
  - [ ] Migration file: `[timestamp]_enable_rls_role_permissions.sql`
  - [ ] ALTER TABLE ENABLE ROW LEVEL SECURITY
  - [ ] CREATE POLICY "Authenticated users can read role permissions"
  - [ ] CREATE POLICY "Users can manage role permissions with permission"
  - [ ] CREATE POLICY "Service role has full access"
  - [ ] Test migration locally

- [ ] **3. Run tests** (GREEN phase)
  - [ ] All RLS tests passing
  - [ ] No other tests broken
  - [ ] Type-check passes
  - [ ] Lint passes

- [ ] **4. Apply migration**
  - [ ] Apply to remote
  - [ ] Verify RLS enabled
  - [ ] Verify policies exist

- [ ] **5. Manual smoke test**
  - [ ] Role management UI works
  - [ ] Permission assignment works
  - [ ] No console errors

- [ ] **6. Commit**
  - [ ] Commit test file
  - [ ] Commit migration
  - [ ] Update this progress tracker
  - [ ] Document any issues

**Files Created:**

- `src/server/services/__tests__/rls/role-permissions.rls.test.ts`
- `supabase/migrations/[timestamp]_enable_rls_role_permissions.sql`

**Gate:** ✅ Role-permission mapping secured

---

## Phase 4: Critical Tables ⚠️

**Goal:** Secure most critical tables with extra testing
**Duration:** 2-3 days
**Status:** ⚪ Not Started
**Started:** TBD
**Target Completion:** TBD

### Table 4.1: user_permission_overrides

**Status:** ⚪ Not Started

#### Checklist

- [ ] **1. Write integration tests** (RED phase)
  - [ ] Test SELECT policies (can read overrides in own org)
  - [ ] Test INSERT policies (with permission check)
  - [ ] Test DELETE policies (with permission check)
  - [ ] All tests fail before migration (RED confirmed)

- [ ] **2. Create migration**
  - [ ] Migration file: `[timestamp]_enable_rls_user_permission_overrides.sql`
  - [ ] ALTER TABLE ENABLE ROW LEVEL SECURITY
  - [ ] CREATE POLICY "Users can read overrides in their organization"
  - [ ] CREATE POLICY "Users can create overrides with permission"
  - [ ] CREATE POLICY "Users can delete overrides with permission"
  - [ ] CREATE POLICY "Service role has full access"
  - [ ] Test migration locally

- [ ] **3. Run tests** (GREEN phase)
  - [ ] All RLS tests passing
  - [ ] No other tests broken
  - [ ] Type-check passes
  - [ ] Lint passes

- [ ] **4. Apply migration**
  - [ ] Apply to remote
  - [ ] Verify RLS enabled
  - [ ] Verify policies exist

- [ ] **5. Manual smoke test**
  - [ ] Permission override management works
  - [ ] No console errors

- [ ] **6. Commit**
  - [ ] Commit test file
  - [ ] Commit migration
  - [ ] Update this progress tracker
  - [ ] Document any issues

**Files Created:**

- `src/server/services/__tests__/rls/user-permission-overrides.rls.test.ts`
- `supabase/migrations/[timestamp]_enable_rls_user_permission_overrides.sql`

**Gate:** ✅ Permission overrides secured

---

### Table 4.2: user_role_assignments ⚠️ **MOST CRITICAL**

**Status:** ⚪ Not Started

#### Pre-Implementation Verification

- [ ] Verify JWT custom hook uses SECURITY DEFINER (should bypass RLS)
- [ ] Verify authorize() function uses SECURITY DEFINER (should bypass RLS)
- [ ] Verify get_permissions_for_roles() uses SECURITY DEFINER (should bypass RLS)
- [ ] Identify all app code that reads user_role_assignments directly

#### Checklist

- [ ] **1. Write integration tests** (RED phase)
  - [ ] Test SELECT policies (can read assignments in own org)
  - [ ] Test INSERT policies (with permission check)
  - [ ] Test UPDATE policies (with permission check)
  - [ ] Test DELETE policies (with permission check)
  - [ ] **CRITICAL TEST:** JWT custom hook still works
  - [ ] **CRITICAL TEST:** authorize() function still works
  - [ ] **CRITICAL TEST:** PermissionService.getPermissionsForUser still works
  - [ ] All tests fail before migration (RED confirmed)

- [ ] **2. Create migration**
  - [ ] Migration file: `[timestamp]_enable_rls_user_role_assignments.sql`
  - [ ] ALTER TABLE ENABLE ROW LEVEL SECURITY
  - [ ] CREATE POLICY "Users can read role assignments in their organization"
  - [ ] CREATE POLICY "Users can assign roles with permission"
  - [ ] CREATE POLICY "Users can update role assignments with permission"
  - [ ] CREATE POLICY "Users can revoke roles with permission"
  - [ ] CREATE POLICY "Service role has full access"
  - [ ] Test migration locally MULTIPLE TIMES

- [ ] **3. Run tests** (GREEN phase)
  - [ ] All RLS tests passing
  - [ ] **CRITICAL:** All auth tests still passing
  - [ ] **CRITICAL:** All permission tests still passing
  - [ ] No other tests broken
  - [ ] Type-check passes
  - [ ] Lint passes

- [ ] **4. Apply migration**
  - [ ] Apply to remote
  - [ ] Verify RLS enabled
  - [ ] Verify policies exist

- [ ] **5. Manual smoke test** ⚠️ **EXTENSIVE TESTING REQUIRED**
  - [ ] Login works
  - [ ] Logout works
  - [ ] JWT token contains roles (decode and verify)
  - [ ] Role management UI works
  - [ ] User management works
  - [ ] Permission checks work
  - [ ] Context loading works
  - [ ] Org/branch switching works
  - [ ] All auth features work
  - [ ] No console errors

- [ ] **6. Post-deployment verification**
  - [ ] Login and decode JWT - verify roles present
  - [ ] Test authorize() in SQL editor
  - [ ] Test PermissionService in app
  - [ ] Test role assignment
  - [ ] Test role revocation

- [ ] **7. Commit**
  - [ ] Commit test file
  - [ ] Commit migration
  - [ ] Update this progress tracker
  - [ ] Document any issues

**Files Created:**

- `src/server/services/__tests__/rls/user-role-assignments.rls.test.ts`
- `supabase/migrations/[timestamp]_enable_rls_user_role_assignments.sql`

**Gate:** ✅ Role assignments secured, ALL auth features still working

---

## Testing Metrics

Track test coverage and health over time:

| Metric                 | Phase 0 | Phase 1 | Phase 2 | Phase 3 | Phase 4 | Total |
| ---------------------- | ------- | ------- | ------- | ------- | ------- | ----- |
| **RLS Test Files**     | 0       | 0       | 0       | 0       | 0       | 0/9   |
| **RLS Tests**          | 0       | 0       | 0       | 0       | 0       | 0     |
| **Migrations Created** | 0       | 0       | 0       | 0       | 0       | 0/9   |
| **Tables with RLS**    | 0       | 0       | 0       | 0       | 0       | 0/9   |
| **Policies Created**   | 0       | 0       | 0       | 0       | 0       | 0     |

---

## Known Issues & Blockers

Track any issues that arise during implementation:

| Issue | Table | Phase | Severity | Status | Resolution |
| ----- | ----- | ----- | -------- | ------ | ---------- |
| -     | -     | -     | -        | -      | -          |

**Severity Levels:**

- 🔴 Critical - Blocks progress
- 🟡 High - Impacts timeline
- 🟢 Low - Minor issue

---

## Definition of Done - Full RLS Implementation

The RLS implementation is complete when ALL of the following are true:

### Database

- [ ] All 9 tables have RLS enabled
- [ ] All tables have comprehensive policies
- [ ] Service role policies exist for all tables
- [ ] All migrations applied cleanly

### Testing

- [ ] 9 RLS integration test files created
- [ ] All RLS tests passing
- [ ] No regression in existing tests
- [ ] Test helper functions created
- [ ] JWT verification tests passing
- [ ] authorize() function tests passing
- [ ] PermissionService tests passing

### Quality Gates

- [ ] `pnpm test:run` - All tests green
- [ ] `pnpm type-check` - No TypeScript errors
- [ ] `pnpm lint` - No linting errors
- [ ] App boots without auth errors
- [ ] All features work as expected

### Security Verification

- [ ] Users cannot access other orgs' data
- [ ] Permission checks enforce authorization
- [ ] Cross-org isolation verified
- [ ] JWT custom hook still works
- [ ] authorize() function still works
- [ ] PermissionService still works

### Documentation

- [ ] All policies documented
- [ ] Testing guide created
- [ ] Rollback procedures documented
- [ ] Progress tracker completed
- [ ] Any issues documented

---

## Daily Standup Template

Use this format to track daily progress:

```markdown
### Date: YYYY-MM-DD

**Phase:** Phase X
**Table:** [table_name]

**Completed Today:**

- [ ] Task 1
- [ ] Task 2

**In Progress:**

- [ ] Task 3

**Blockers:**

- None / [Description]

**Next Steps:**

- [ ] Task 4
- [ ] Task 5

**Tests Status:** X passing / Y total
**RLS Tables:** X/9 complete
```

---

## Related Documentation

- [RLS Implementation Plan](./RLS_IMPLEMENTATION_PLAN.md) - Detailed implementation guide
- [Coreframe Rebuild Progress](../coreframe-rebuild/PROGRESS_TRACKER.md) - Overall rebuild status
- [Phase 1 Implementation](../coreframe-rebuild/PHASE_1_IMPLEMENTATION.md) - Auth foundation

---

**Last Updated:** 2026-01-05
**Updated By:** Claude Code
**Next Review:** When Phase 1 starts
