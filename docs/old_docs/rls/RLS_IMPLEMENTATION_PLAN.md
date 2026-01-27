# RLS Implementation Plan for Auth Tables

**Document Version:** 1.0
**Created:** 2026-01-05
**Last Updated:** 2026-01-05
**Status:** 📋 Planning

---

## Goal

Implement Row Level Security (RLS) policies for all auth-related tables incrementally, with comprehensive integration tests before enabling each policy.

## User Requirements

- ✅ Incremental approach - one table at a time
- ✅ TDD - Create integration tests BEFORE enabling RLS
- ✅ Include all tables (including `users`)
- ✅ Don't break the app
- ✅ Ensure JWT custom hook continues working

---

## Current State

All 9 core auth/permission tables have RLS **disabled**:

| Table                       | RLS Enabled | Has Policies | Risk Level   | Used By                       |
| --------------------------- | ----------- | ------------ | ------------ | ----------------------------- |
| `user_preferences`          | ❌          | ❌           | LOW          | User settings                 |
| `organizations`             | ❌          | ❌           | MEDIUM       | Org data, context loader      |
| `branches`                  | ❌          | ❌           | MEDIUM       | Branch data, context loader   |
| `roles`                     | ❌          | ❌           | MEDIUM       | Role management, RLS policies |
| `permissions`               | ❌          | ❌           | MEDIUM       | Permission management         |
| `role_permissions`          | ❌          | ❌           | MEDIUM       | Role-permission mapping       |
| `user_permission_overrides` | ❌          | ❌           | MEDIUM       | Permission overrides          |
| `user_role_assignments`     | ❌          | ❌           | **CRITICAL** | JWT hook, authorization       |
| `users`                     | ❌          | ❌           | LOW          | User profiles (rarely used)   |

---

## Implementation Strategy

### Phase-Based Incremental Rollout

Each phase follows TDD:

1. **Write integration tests** for RLS policies
2. **Create migration** with RLS policies
3. **Run tests** to verify policies work
4. **Apply migration** to enable RLS
5. **Manual smoke test** of affected features
6. **Commit** changes
7. **Move to next phase**

---

## Phase 1: Low-Risk Tables (Start Here)

### Table 1.1: `user_preferences` ✅ **Safest to start**

**Why First**:

- Only affects user settings
- Simple ownership model (user_id = auth.uid())
- No dependencies on other tables
- Easy to test

**Integration Tests**:

```typescript
// src/server/services/__tests__/rls/user-preferences.rls.test.ts
describe("RLS: user_preferences", () => {
  it("user can read own preferences", async () => {});
  it("user cannot read other user preferences", async () => {});
  it("user can update own preferences", async () => {});
  it("user cannot update other user preferences", async () => {});
  it("user can insert own preferences", async () => {});
  it("user cannot delete other user preferences", async () => {});
});
```

**RLS Policies**:

```sql
-- Enable RLS
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Policy: Users manage own preferences
CREATE POLICY "Users manage own preferences"
ON user_preferences
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
```

**Affected Features**: User settings, language preferences, active org/branch

**Rollback Plan**: `ALTER TABLE user_preferences DISABLE ROW LEVEL SECURITY;`

---

### Table 1.2: `users`

**Why Second**:

- Low usage (auth.users is primary)
- Simple policies
- No critical dependencies

**Integration Tests**:

```typescript
// src/server/services/__tests__/rls/users.rls.test.ts
describe("RLS: users", () => {
  it("user can read own profile", async () => {});
  it("user can read profiles in same org", async () => {});
  it("user cannot read profiles in other orgs", async () => {});
  it("user can update own profile with permission", async () => {});
});
```

**RLS Policies**:

```sql
-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read own profile
CREATE POLICY "Users can read own profile"
ON users FOR SELECT
TO authenticated
USING (id = auth.uid());

-- Policy: Users can read profiles in their orgs
CREATE POLICY "Users can read org members"
ON users FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT user_id
    FROM user_role_assignments
    WHERE scope_id IN (
      SELECT scope_id
      FROM user_role_assignments
      WHERE user_id = auth.uid()
      AND scope = 'org'
      AND deleted_at IS NULL
    )
    AND deleted_at IS NULL
  )
);

-- Policy: Users can update own profile
CREATE POLICY "Users can update own profile"
ON users FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());
```

**Affected Features**: User profile display, user management

**Rollback Plan**: `ALTER TABLE users DISABLE ROW LEVEL SECURITY;`

---

## Phase 2: Multi-Tenant Core (Organizations & Branches)

### Table 2.1: `organizations`

**Why Third**:

- Core multi-tenant isolation
- Moderate complexity
- Used by context loaders

**Integration Tests**:

```typescript
// src/server/services/__tests__/rls/organizations.rls.test.ts
describe("RLS: organizations", () => {
  it("user can read orgs they belong to", async () => {});
  it("user cannot read other orgs", async () => {});
  it("user can update org with organization.update permission", async () => {});
  it("user cannot update org without permission", async () => {});
  it("user can delete org with organization.delete permission", async () => {});
});
```

**RLS Policies**:

```sql
-- Enable RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their organizations
CREATE POLICY "Users can read their organizations"
ON organizations FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT scope_id
    FROM user_role_assignments
    WHERE user_id = auth.uid()
    AND scope = 'org'
    AND deleted_at IS NULL
  )
);

-- Policy: Users can update with permission
CREATE POLICY "Users can update organizations with permission"
ON organizations FOR UPDATE
TO authenticated
USING (authorize('organization.update', id))
WITH CHECK (authorize('organization.update', id));

-- Policy: Users can delete with permission
CREATE POLICY "Users can delete organizations with permission"
ON organizations FOR DELETE
TO authenticated
USING (authorize('organization.delete', id));

-- Policy: Service role can do anything (for migrations, admin tools)
CREATE POLICY "Service role has full access"
ON organizations FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
```

**Affected Features**: Org selector, org management, context loading

**Rollback Plan**: `ALTER TABLE organizations DISABLE ROW LEVEL SECURITY;`

---

### Table 2.2: `branches`

**Why Fourth**:

- Branch-level isolation
- Depends on organizations
- Used by context loaders

**Integration Tests**:

```typescript
// src/server/services/__tests__/rls/branches.rls.test.ts
describe("RLS: branches", () => {
  it("user can read branches in their org", async () => {});
  it("user cannot read branches in other orgs", async () => {});
  it("user can create branch with permission", async () => {});
  it("user can update branch with permission", async () => {});
  it("user can delete branch with permission", async () => {});
});
```

**RLS Policies**:

```sql
-- Enable RLS
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read branches in their orgs
CREATE POLICY "Users can read branches in their organizations"
ON branches FOR SELECT
TO authenticated
USING (
  organization_id IN (
    SELECT scope_id
    FROM user_role_assignments
    WHERE user_id = auth.uid()
    AND scope = 'org'
    AND deleted_at IS NULL
  )
);

-- Policy: Users can create branches with permission
CREATE POLICY "Users can create branches with permission"
ON branches FOR INSERT
TO authenticated
WITH CHECK (authorize('branch.create', organization_id));

-- Policy: Users can update branches with permission
CREATE POLICY "Users can update branches with permission"
ON branches FOR UPDATE
TO authenticated
USING (authorize('branch.update', organization_id))
WITH CHECK (authorize('branch.update', organization_id));

-- Policy: Users can delete branches with permission
CREATE POLICY "Users can delete branches with permission"
ON branches FOR DELETE
TO authenticated
USING (authorize('branch.delete', organization_id));

-- Policy: Service role full access
CREATE POLICY "Service role has full access"
ON branches FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
```

**Affected Features**: Branch selector, branch management, context loading

**Rollback Plan**: `ALTER TABLE branches DISABLE ROW LEVEL SECURITY;`

---

## Phase 3: Permission System (Read-Only Tables)

### Table 3.1: `roles`

**Why Fifth**:

- Mostly read-only for users
- Management requires permissions
- Used by RLS policies

**Integration Tests**:

```typescript
// src/server/services/__tests__/rls/roles.rls.test.ts
describe("RLS: roles", () => {
  it("user can read all roles", async () => {});
  it("user can create role with permission", async () => {});
  it("user can update role with permission", async () => {});
  it("user cannot update basic (system) roles", async () => {});
  it("user can delete role with permission", async () => {});
  it("user cannot delete basic roles", async () => {});
});
```

**RLS Policies**:

```sql
-- Enable RLS
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can read all roles
CREATE POLICY "Authenticated users can read roles"
ON roles FOR SELECT
TO authenticated
USING (true);

-- Policy: Users can create roles with permission in their org
CREATE POLICY "Users can create roles with permission"
ON roles FOR INSERT
TO authenticated
WITH CHECK (
  authorize('role.create', organization_id)
  AND organization_id IN (
    SELECT scope_id
    FROM user_role_assignments
    WHERE user_id = auth.uid()
    AND scope = 'org'
    AND deleted_at IS NULL
  )
);

-- Policy: Users can update non-basic roles with permission
CREATE POLICY "Users can update roles with permission"
ON roles FOR UPDATE
TO authenticated
USING (
  authorize('role.update', organization_id)
  AND is_basic = false
)
WITH CHECK (
  authorize('role.update', organization_id)
  AND is_basic = false
);

-- Policy: Users can delete non-basic roles with permission
CREATE POLICY "Users can delete roles with permission"
ON roles FOR DELETE
TO authenticated
USING (
  authorize('role.delete', organization_id)
  AND is_basic = false
);

-- Policy: Service role full access
CREATE POLICY "Service role has full access"
ON roles FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
```

**Affected Features**: Role management UI, role selection dropdowns

**Rollback Plan**: `ALTER TABLE roles DISABLE ROW LEVEL SECURITY;`

---

### Table 3.2: `permissions`

**Why Sixth**:

- Read-only for most users
- Used by permission derivation
- Low risk

**Integration Tests**:

```typescript
// src/server/services/__tests__/rls/permissions.rls.test.ts
describe("RLS: permissions", () => {
  it("user can read all permissions", async () => {});
  it("only superadmin can create permissions", async () => {});
  it("only superadmin can update permissions", async () => {});
  it("only superadmin can delete permissions", async () => {});
});
```

**RLS Policies**:

```sql
-- Enable RLS
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can read all permissions
CREATE POLICY "Authenticated users can read permissions"
ON permissions FOR SELECT
TO authenticated
USING (true);

-- Policy: Only superadmins can manage permissions
CREATE POLICY "Superadmins can manage permissions"
ON permissions FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_role_assignments ura
    JOIN roles r ON ura.role_id = r.id
    WHERE ura.user_id = auth.uid()
    AND r.name = 'superadmin'
    AND ura.deleted_at IS NULL
    AND r.deleted_at IS NULL
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_role_assignments ura
    JOIN roles r ON ura.role_id = r.id
    WHERE ura.user_id = auth.uid()
    AND r.name = 'superadmin'
    AND ura.deleted_at IS NULL
    AND r.deleted_at IS NULL
  )
);

-- Policy: Service role full access
CREATE POLICY "Service role has full access"
ON permissions FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
```

**Affected Features**: Permission management UI, permission lists

**Rollback Plan**: `ALTER TABLE permissions DISABLE ROW LEVEL SECURITY;`

---

### Table 3.3: `role_permissions`

**Why Seventh**:

- Maps roles to permissions
- Managed by permission system
- Used by get_permissions_for_roles() RPC (SECURITY DEFINER - bypasses RLS)

**Integration Tests**:

```typescript
// src/server/services/__tests__/rls/role-permissions.rls.test.ts
describe("RLS: role_permissions", () => {
  it("user can read all role-permission mappings", async () => {});
  it("user can assign permission to role with role.permission.manage", async () => {});
  it("user can revoke permission from role with role.permission.manage", async () => {});
  it("user cannot modify role-permissions without permission", async () => {});
});
```

**RLS Policies**:

```sql
-- Enable RLS
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can read all role-permissions
CREATE POLICY "Authenticated users can read role permissions"
ON role_permissions FOR SELECT
TO authenticated
USING (true);

-- Policy: Users can manage role-permissions with permission
CREATE POLICY "Users can manage role permissions with permission"
ON role_permissions FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM roles r
    WHERE r.id = role_permissions.role_id
    AND authorize('role.permission.manage', r.organization_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM roles r
    WHERE r.id = role_permissions.role_id
    AND authorize('role.permission.manage', r.organization_id)
  )
);

-- Policy: Service role full access
CREATE POLICY "Service role has full access"
ON role_permissions FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
```

**Affected Features**: Role management, permission assignment

**Rollback Plan**: `ALTER TABLE role_permissions DISABLE ROW LEVEL SECURITY;`

---

## Phase 4: Critical Tables ⚠️ (Test Thoroughly!)

### Table 4.1: `user_permission_overrides`

**Why Eighth**:

- Permission overrides are sensitive
- Used by authorize() function (SECURITY DEFINER - bypasses RLS)
- Low app usage impact

**Integration Tests**:

```typescript
// src/server/services/__tests__/rls/user-permission-overrides.rls.test.ts
describe("RLS: user_permission_overrides", () => {
  it("user can read overrides in their org", async () => {});
  it("user cannot read overrides in other orgs", async () => {});
  it("user can create override with permission.override.create", async () => {});
  it("user can delete override with permission.override.delete", async () => {});
  it("user cannot modify overrides without permission", async () => {});
});
```

**RLS Policies**:

```sql
-- Enable RLS
ALTER TABLE user_permission_overrides ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read overrides in their org
CREATE POLICY "Users can read overrides in their organization"
ON user_permission_overrides FOR SELECT
TO authenticated
USING (
  scope_id IN (
    SELECT scope_id
    FROM user_role_assignments
    WHERE user_id = auth.uid()
    AND scope = 'org'
    AND deleted_at IS NULL
  )
);

-- Policy: Users can create overrides with permission
CREATE POLICY "Users can create overrides with permission"
ON user_permission_overrides FOR INSERT
TO authenticated
WITH CHECK (authorize('permission.override.create', scope_id));

-- Policy: Users can delete overrides with permission
CREATE POLICY "Users can delete overrides with permission"
ON user_permission_overrides FOR DELETE
TO authenticated
USING (authorize('permission.override.delete', scope_id));

-- Policy: Service role full access
CREATE POLICY "Service role has full access"
ON user_permission_overrides FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
```

**Affected Features**: Permission override management

**Rollback Plan**: `ALTER TABLE user_permission_overrides DISABLE ROW LEVEL SECURITY;`

---

### Table 4.2: `user_role_assignments` ⚠️ **MOST CRITICAL**

**Why Last**:

- ⚠️ Used by JWT custom hook (SECURITY DEFINER - bypasses RLS ✅)
- Used by context loaders
- Used by authorize() function (SECURITY DEFINER - bypasses RLS ✅)
- If policies are wrong, could break authentication

**CRITICAL Pre-Checks**:

1. ✅ Verify JWT custom hook uses SECURITY DEFINER (bypasses RLS)
2. ✅ Verify authorize() uses SECURITY DEFINER (bypasses RLS)
3. ✅ Verify get_permissions_for_roles() uses SECURITY DEFINER (bypasses RLS)
4. ⚠️ Test app code that reads this table directly

**Integration Tests**:

```typescript
// src/server/services/__tests__/rls/user-role-assignments.rls.test.ts
describe("RLS: user_role_assignments", () => {
  it("user can read role assignments in their org", async () => {});
  it("user cannot read role assignments in other orgs", async () => {});
  it("user can assign role with user.role.assign permission", async () => {});
  it("user can revoke role with user.role.revoke permission", async () => {});
  it("user cannot modify role assignments without permission", async () => {});

  // CRITICAL TESTS
  it("JWT custom hook still works after RLS enabled", async () => {
    // Login and verify JWT contains roles
  });
  it("authorize() function still works after RLS enabled", async () => {
    // Call authorize and verify it returns correct result
  });
  it("PermissionService.getPermissionsForUser still works", async () => {
    // Verify permission derivation works
  });
});
```

**RLS Policies**:

```sql
-- Enable RLS
ALTER TABLE user_role_assignments ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read role assignments in their orgs
CREATE POLICY "Users can read role assignments in their organization"
ON user_role_assignments FOR SELECT
TO authenticated
USING (
  scope_id IN (
    SELECT scope_id
    FROM user_role_assignments ura
    WHERE ura.user_id = auth.uid()
    AND ura.scope = 'org'
    AND ura.deleted_at IS NULL
  )
);

-- Policy: Users can assign roles with permission
CREATE POLICY "Users can assign roles with permission"
ON user_role_assignments FOR INSERT
TO authenticated
WITH CHECK (authorize('user.role.assign', scope_id));

-- Policy: Users can update role assignments with permission
CREATE POLICY "Users can update role assignments with permission"
ON user_role_assignments FOR UPDATE
TO authenticated
USING (authorize('user.role.manage', scope_id))
WITH CHECK (authorize('user.role.manage', scope_id));

-- Policy: Users can revoke roles with permission
CREATE POLICY "Users can revoke roles with permission"
ON user_role_assignments FOR DELETE
TO authenticated
USING (authorize('user.role.revoke', scope_id));

-- Policy: Service role full access
CREATE POLICY "Service role has full access"
ON user_role_assignments FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
```

**Affected Features**:

- JWT token generation ⚠️
- Role management UI
- User management
- Authorization checks
- Context loading

**Rollback Plan**: `ALTER TABLE user_role_assignments DISABLE ROW LEVEL SECURITY;`

**Post-Deployment Verification**:

1. Login and decode JWT - verify roles are present
2. Test authorize() function with SQL queries
3. Test PermissionService in app
4. Test role management UI
5. Test user management UI

---

## Testing Strategy

### Integration Test Structure

Each table gets its own test file following this pattern:

```typescript
/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@/utils/supabase/server";

describe("RLS: [table_name]", () => {
  let supabase: ReturnType<typeof createClient>;
  let testUserId: string;
  let testOrgId: string;

  beforeAll(async () => {
    // Setup test data
    supabase = createClient();
    // Login as test user or use service role for setup
  });

  afterAll(async () => {
    // Cleanup test data
  });

  describe("SELECT policies", () => {
    it("user can read allowed records", async () => {});
    it("user cannot read forbidden records", async () => {});
  });

  describe("INSERT policies", () => {
    it("user can insert with permission", async () => {});
    it("user cannot insert without permission", async () => {});
  });

  describe("UPDATE policies", () => {
    it("user can update with permission", async () => {});
    it("user cannot update without permission", async () => {});
  });

  describe("DELETE policies", () => {
    it("user can delete with permission", async () => {});
    it("user cannot delete without permission", async () => {});
  });
});
```

### Test Data Setup

Create helper functions for test data:

```typescript
// src/test/helpers/rls-test-helpers.ts
export async function createTestUser(email: string) {}
export async function assignRole(userId: string, roleId: string, orgId: string) {}
export async function createTestOrg(name: string) {}
export async function loginAsUser(email: string) {}
```

---

## Migration Naming Convention

```
[timestamp]_enable_rls_[table_name].sql
```

Examples:

- `20260105140000_enable_rls_user_preferences.sql`
- `20260105140100_enable_rls_users.sql`
- `20260105140200_enable_rls_organizations.sql`
- `20260105140900_enable_rls_user_role_assignments.sql` (last)

---

## Implementation Checklist

### Per-Table Checklist

For each table:

- [ ] **1. Write integration tests**
  - [ ] Test SELECT policies
  - [ ] Test INSERT policies (if applicable)
  - [ ] Test UPDATE policies (if applicable)
  - [ ] Test DELETE policies (if applicable)
  - [ ] Test permission checks work
  - [ ] Test cross-org isolation
  - [ ] All tests RED (fail) before migration

- [ ] **2. Create migration**
  - [ ] ALTER TABLE ENABLE ROW LEVEL SECURITY
  - [ ] CREATE POLICY for SELECT
  - [ ] CREATE POLICY for INSERT (if applicable)
  - [ ] CREATE POLICY for UPDATE (if applicable)
  - [ ] CREATE POLICY for DELETE (if applicable)
  - [ ] CREATE POLICY for service_role (full access)
  - [ ] Test migration locally

- [ ] **3. Run tests**
  - [ ] All integration tests GREEN (pass)
  - [ ] No other tests broken
  - [ ] Type-check passes
  - [ ] Lint passes

- [ ] **4. Apply migration**
  - [ ] Apply to remote database
  - [ ] Verify RLS enabled: `SELECT relrowsecurity FROM pg_class WHERE relname = '[table]'`
  - [ ] Verify policies exist: `SELECT * FROM pg_policies WHERE tablename = '[table]'`

- [ ] **5. Manual smoke test**
  - [ ] Login works
  - [ ] Affected features work
  - [ ] No console errors
  - [ ] Data displays correctly

- [ ] **6. Commit**
  - [ ] Commit test file
  - [ ] Commit migration
  - [ ] Update progress tracker
  - [ ] Document any issues

---

## Rollback Strategy

### Per-Table Rollback

If a table's RLS breaks the app:

```sql
-- Quick disable (keeps policies for investigation)
ALTER TABLE [table_name] DISABLE ROW LEVEL SECURITY;

-- Full rollback (remove policies too)
DROP POLICY IF EXISTS "[policy_name]" ON [table_name];
ALTER TABLE [table_name] DISABLE ROW LEVEL SECURITY;
```

### Emergency Rollback (All Tables)

```sql
ALTER TABLE user_preferences DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE organizations DISABLE ROW LEVEL SECURITY;
ALTER TABLE branches DISABLE ROW LEVEL SECURITY;
ALTER TABLE roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE permissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_permission_overrides DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_role_assignments DISABLE ROW LEVEL SECURITY;
```

---

## Files to Create

### Test Files (9 files)

1. `src/server/services/__tests__/rls/user-preferences.rls.test.ts`
2. `src/server/services/__tests__/rls/users.rls.test.ts`
3. `src/server/services/__tests__/rls/organizations.rls.test.ts`
4. `src/server/services/__tests__/rls/branches.rls.test.ts`
5. `src/server/services/__tests__/rls/roles.rls.test.ts`
6. `src/server/services/__tests__/rls/permissions.rls.test.ts`
7. `src/server/services/__tests__/rls/role-permissions.rls.test.ts`
8. `src/server/services/__tests__/rls/user-permission-overrides.rls.test.ts`
9. `src/server/services/__tests__/rls/user-role-assignments.rls.test.ts`

### Test Helpers

- `src/test/helpers/rls-test-helpers.ts`

### Migrations (9 files)

1. `supabase/migrations/[timestamp]_enable_rls_user_preferences.sql`
2. `supabase/migrations/[timestamp]_enable_rls_users.sql`
3. `supabase/migrations/[timestamp]_enable_rls_organizations.sql`
4. `supabase/migrations/[timestamp]_enable_rls_branches.sql`
5. `supabase/migrations/[timestamp]_enable_rls_roles.sql`
6. `supabase/migrations/[timestamp]_enable_rls_permissions.sql`
7. `supabase/migrations/[timestamp]_enable_rls_role_permissions.sql`
8. `supabase/migrations/[timestamp]_enable_rls_user_permission_overrides.sql`
9. `supabase/migrations/[timestamp]_enable_rls_user_role_assignments.sql`

### Documentation

- `docs/rls/RLS_POLICIES_GUIDE.md` - Explains all policies
- `docs/rls/RLS_TESTING_GUIDE.md` - How to test RLS policies

---

## Success Criteria

✅ **Phase 1 Complete When**:

- [ ] user_preferences has RLS enabled with tests
- [ ] users has RLS enabled with tests
- [ ] All existing tests still pass
- [ ] App works normally

✅ **Phase 2 Complete When**:

- [ ] organizations has RLS enabled with tests
- [ ] branches has RLS enabled with tests
- [ ] Context loading still works
- [ ] Org/branch switching works

✅ **Phase 3 Complete When**:

- [ ] roles has RLS enabled with tests
- [ ] permissions has RLS enabled with tests
- [ ] role_permissions has RLS enabled with tests
- [ ] Role management UI works
- [ ] Permission lists display correctly

✅ **Phase 4 Complete When**:

- [ ] user_permission_overrides has RLS enabled with tests
- [ ] user_role_assignments has RLS enabled with tests
- [ ] JWT token still contains roles after login
- [ ] authorize() function still works
- [ ] PermissionService still works
- [ ] All auth features work

✅ **Full RLS Implementation Complete When**:

- [ ] All 9 tables have RLS enabled
- [ ] All 9 tables have comprehensive policies
- [ ] All 9 tables have passing integration tests
- [ ] No regression in existing functionality
- [ ] All quality gates pass (tests, type-check, lint)
- [ ] Documentation complete
- [ ] Users cannot access other orgs' data
- [ ] Permission checks enforce authorization

---

## Notes

- Service role policies (`TO service_role USING (true)`) allow migrations and admin tools to bypass RLS
- All policies use `deleted_at IS NULL` to respect soft deletes
- Critical tables (user_role_assignments) are last to minimize risk
- Each phase is independently testable and rollback-able
- TDD approach ensures policies are correct before enabling RLS

---

## Related Documentation

- [RLS Progress Tracker](./RLS_PROGRESS_TRACKER.md) - Track implementation status
- [Coreframe Rebuild Progress](../coreframe-rebuild/PROGRESS_TRACKER.md) - Overall rebuild status
- [Phase 1 Implementation](../coreframe-rebuild/PHASE_1_IMPLEMENTATION.md) - Auth foundation
