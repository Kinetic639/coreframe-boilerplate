# Phase 4: Organization Management

**Status:** ⚪ NOT STARTED
**Duration:** ~10 hours estimated
**Priority:** 🟡 HIGH
**Overall Progress:** 0%

---

## 📊 Progress Tracker

| Task                       | Status         | Duration | Pages | Actions | Tests | Completion |
| -------------------------- | -------------- | -------- | ----- | ------- | ----- | ---------- |
| 4.1 Organization Settings  | ⚪ Not Started | 3h       | 2     | 4       | 0/40  | 0%         |
| 4.2 Branch Management      | ⚪ Not Started | 4h       | 2     | 7       | 0/60  | 0%         |
| 4.3 Roles & Permissions UI | ⚪ Not Started | 3h       | 2     | 3       | 0/40  | 0%         |

**Total:** 0/6 pages | 0/14 actions | 0/140 tests | 0/10 hours | 0% complete

---

## 🎯 Phase Goal

Build complete organization and branch management system with roles and permissions UI for multi-tenant administration.

**Prerequisites:**

- ✅ Org context loading - Complete
- ✅ Branch switching - Complete
- ⚪ RLS policies (Phase 1) - Required
- ⚪ UI primitives (Phase 2) - Required

---

## Task 4.1: Organization Settings (3 hours) ⚪

### 4.1.1 Organization Profile (2 hours)

**File:** `src/app/[locale]/dashboard/organization/settings/page.tsx`

**Features:**

- [ ] Display org info (name, slug, logo)
- [ ] Edit org profile form
- [ ] Logo upload with storage RLS
- [ ] Delete organization (with safety confirmation)
- [ ] Validation and error handling

**Server Actions:** `src/app/[locale]/dashboard/organization/_actions.ts`

```typescript
export async function updateOrganization(input: UpdateOrgInput): Promise<ActionResponse> {
  // 1. Load context
  // 2. Validate user is org owner
  // 3. Validate input with Zod
  // 4. Call OrganizationService.update()
  // 5. Return success/error
}

export async function deleteOrganization(orgId: string): Promise<ActionResponse> {
  // 1. Load context
  // 2. Validate user is org owner
  // 3. Check for dependencies (branches, users)
  // 4. Call OrganizationService.delete()
  // 5. Return success/error
}
```

**Service:** `src/server/services/organization.service.ts`

```typescript
class OrganizationService {
  static async update(orgId: string, data: UpdateOrgData): Promise<Organization> {
    // 1. Validate business rules
    // 2. Check slug uniqueness
    // 3. Update organizations table
    // 4. Update organization_profiles table
    // 5. Return updated org
  }

  static async delete(orgId: string): Promise<void> {
    // 1. Check for active branches
    // 2. Check for active users
    // 3. Soft delete or hard delete based on dependencies
  }
}
```

**RLS Policy:**

```sql
-- Organization owners can update their org
CREATE POLICY "organizations_update_owner" ON public.organizations
  FOR UPDATE TO authenticated
  USING (private.is_org_owner(auth.uid(), id));

-- Organization profiles update
CREATE POLICY "org_profiles_update_owner" ON public.organization_profiles
  FOR UPDATE TO authenticated
  USING (private.is_org_owner(auth.uid(), organization_id));
```

**Tests:**

- [ ] Service tests (15 tests)
- [ ] Action tests (10 tests)
- [ ] Component tests (5 tests)

**Checklist:**

- [ ] Page created
- [ ] Form functional
- [ ] Logo upload works
- [ ] Server actions created
- [ ] Service methods created
- [ ] 30 tests passing
- [ ] Mobile responsive

### 4.1.2 Billing & Subscription (1 hour)

**File:** `src/app/[locale]/dashboard/organization/settings/billing/page.tsx`

**Features:**

- [ ] Current plan display
- [ ] Usage metrics (users, branches, storage)
- [ ] Upgrade/downgrade plan UI (placeholder)
- [ ] Billing history list
- [ ] Payment method display

**Server Action:**

```typescript
export async function getSubscriptionDetails(): Promise<ActionResponse<SubscriptionDetails>> {
  // 1. Load context
  // 2. Get subscription from database
  // 3. Get usage metrics
  // 4. Return subscription data
}
```

**Tests:**

- [ ] Action tests (5 tests)
- [ ] Component tests (5 tests)

**Checklist:**

- [ ] Page created
- [ ] Subscription info displays
- [ ] Usage metrics show correctly
- [ ] 10 tests passing

### Definition of Done ✅

- [ ] 2 settings pages complete
- [ ] 4 server actions working
- [ ] OrganizationService methods created
- [ ] RLS policies enforced
- [ ] 40 tests passing
- [ ] Mobile responsive
- [ ] Only org owners can modify settings

---

## Task 4.2: Branch Management (4 hours) ⚪

### 4.2.1 Branch List (1 hour)

**File:** `src/app/[locale]/dashboard/organization/branches/page.tsx`

**Features:**

- [ ] DataTable with branches
- [ ] Display: name, description, member count, status
- [ ] Create branch button
- [ ] Edit/delete actions per row
- [ ] Branch status indicator (active/inactive)

**Server Actions:**

```typescript
export async function getBranches(): Promise<ActionResponse<Branch[]>> {
  // 1. Load context
  // 2. Call BranchService.list(orgId)
  // 3. Return branches
}

export async function createBranch(input: CreateBranchInput): Promise<ActionResponse<Branch>> {
  // 1. Load context
  // 2. Validate user is org admin
  // 3. Validate input with Zod
  // 4. Call BranchService.create()
  // 5. Return new branch
}
```

**Service:** `src/server/services/branch.service.ts`

```typescript
class BranchService {
  static async list(orgId: string): Promise<Branch[]> {
    // 1. Query branches table
    // 2. Include member counts
    // 3. Order by creation date
    // 4. Return branches
  }

  static async create(data: CreateBranchData, orgId: string): Promise<Branch> {
    // 1. Validate business rules
    // 2. Create branch record
    // 3. Create default permissions
    // 4. Return new branch
  }
}
```

**Tests:**

- [ ] Service tests (10 tests)
- [ ] Action tests (8 tests)
- [ ] Component tests (5 tests)

**Checklist:**

- [ ] Page created
- [ ] DataTable working
- [ ] Create branch works
- [ ] Server actions created
- [ ] 23 tests passing

### 4.2.2 Branch Settings (2 hours)

**File:** `src/app/[locale]/dashboard/organization/branches/[branchId]/settings/page.tsx`

**Features:**

- [ ] Branch detail form
- [ ] Edit branch info (name, description, status)
- [ ] Set as default branch
- [ ] Transfer ownership option
- [ ] Delete branch (with safety checks)

**Server Actions:**

```typescript
export async function updateBranch(
  branchId: string,
  input: UpdateBranchInput
): Promise<ActionResponse> {
  // 1. Load context
  // 2. Validate user is org admin
  // 3. Validate input
  // 4. Call BranchService.update()
  // 5. Return success/error
}

export async function deleteBranch(branchId: string): Promise<ActionResponse> {
  // 1. Load context
  // 2. Validate user is org admin
  // 3. Check for dependencies (users, data)
  // 4. Call BranchService.delete()
  // 5. Return success/error
}

export async function setDefaultBranch(branchId: string): Promise<ActionResponse> {
  // Update user preferences with default branch
}
```

**Service:**

```typescript
class BranchService {
  static async update(branchId: string, data: UpdateBranchData, orgId: string): Promise<Branch> {
    // 1. Validate business rules
    // 2. Update branches table
    // 3. Return updated branch
  }

  static async delete(branchId: string, orgId: string): Promise<void> {
    // 1. Check for dependencies
    // 2. Check if last branch (prevent delete)
    // 3. Soft delete branch
  }
}
```

**Tests:**

- [ ] Service tests (10 tests)
- [ ] Action tests (8 tests)
- [ ] Component tests (4 tests)

**Checklist:**

- [ ] Page created
- [ ] Update branch works
- [ ] Delete with safety checks
- [ ] Default branch setting works
- [ ] 22 tests passing

### 4.2.3 Branch Users (1 hour)

**File:** `src/app/[locale]/dashboard/organization/branches/[branchId]/users/page.tsx`

**Features:**

- [ ] List users in branch
- [ ] Assign users to branch dialog
- [ ] Remove users from branch
- [ ] Branch-specific role assignment
- [ ] User count and activity

**Server Actions:**

```typescript
export async function getBranchUsers(branchId: string): Promise<ActionResponse<User[]>> {
  // Get all users with access to branch
}

export async function assignUserToBranch(
  userId: string,
  branchId: string,
  roleId?: string
): Promise<ActionResponse> {
  // 1. Load context
  // 2. Validate user is org admin
  // 3. Assign user to branch
  // 4. Optionally assign branch-level role
  // 5. Return success/error
}

export async function removeUserFromBranch(
  userId: string,
  branchId: string
): Promise<ActionResponse> {
  // Remove user's branch access
}
```

**Tests:**

- [ ] Action tests (8 tests)
- [ ] Component tests (7 tests)

**Checklist:**

- [ ] Page created
- [ ] User list displays
- [ ] Assign/remove works
- [ ] 15 tests passing

### Definition of Done ✅

- [ ] 3 branch pages complete
- [ ] 7 server actions working
- [ ] BranchService methods created
- [ ] 60 tests passing
- [ ] Mobile responsive
- [ ] Cannot delete branch with data

---

## Task 4.3: Roles & Permissions UI (3 hours) ⚪

### 4.3.1 Roles List (1 hour)

**File:** `src/app/[locale]/dashboard/organization/roles/page.tsx`

**Features:**

- [ ] Display all roles (system + custom)
- [ ] Role details (name, description, permissions count)
- [ ] Filter by scope (org/branch/both)
- [ ] View users with role
- [ ] Role assignment counts

**Server Action:**

```typescript
export async function getRoles(): Promise<ActionResponse<Role[]>> {
  // 1. Load context
  // 2. Get all roles
  // 3. Include permission counts
  // 4. Include user counts
  // 5. Return roles
}
```

**Tests:**

- [ ] Action tests (5 tests)
- [ ] Component tests (5 tests)

**Checklist:**

- [ ] Page created
- [ ] Roles display correctly
- [ ] Filters work
- [ ] 10 tests passing

### 4.3.2 Permission Overrides (2 hours)

**File:** `src/app/[locale]/dashboard/organization/users/[userId]/permissions/page.tsx`

**Features:**

- [ ] Display user's effective permissions
- [ ] Show permissions from roles
- [ ] Show allow/deny lists (overrides)
- [ ] Highlight wildcard permissions
- [ ] Add/remove permission overrides (admins only)
- [ ] Visual permission hierarchy

**Server Actions:**

```typescript
export async function getUserEffectivePermissions(
  userId: string
): Promise<ActionResponse<PermissionSnapshot>> {
  // 1. Load context
  // 2. Get user's role-based permissions
  // 3. Get user's permission overrides
  // 4. Compile into PermissionSnapshot
  // 5. Return effective permissions
}

export async function addPermissionOverride(
  userId: string,
  permission: string,
  type: "allow" | "deny"
): Promise<ActionResponse> {
  // 1. Load context
  // 2. Validate user is org admin
  // 3. Call PermissionService.addOverride()
  // 4. Invalidate permission cache
  // 5. Return success/error
}

export async function removePermissionOverride(overrideId: string): Promise<ActionResponse> {
  // Remove specific override
}
```

**Service:** `src/server/services/permission.service.ts`

```typescript
class PermissionService {
  static async addOverride(
    userId: string,
    permission: string,
    type: "allow" | "deny",
    scope: Scope
  ): Promise<void> {
    // 1. Validate permission exists
    // 2. Insert override record
    // 3. Update permission cache
  }

  static async removeOverride(overrideId: string): Promise<void> {
    // 1. Delete override record
    // 2. Update permission cache
  }
}
```

**Tests:**

- [ ] Service tests (10 tests)
- [ ] Action tests (10 tests)
- [ ] Component tests (10 tests)

**Checklist:**

- [ ] Page created
- [ ] Effective permissions display
- [ ] Override management works
- [ ] Wildcard permissions highlighted
- [ ] 30 tests passing

### Definition of Done ✅

- [ ] 2 roles/permissions pages complete
- [ ] 3 server actions working
- [ ] PermissionService methods created
- [ ] 40 tests passing
- [ ] Mobile responsive
- [ ] Only admins can manage overrides

---

## 📈 Success Metrics

- [ ] **Org settings complete** - Profile, logo, billing
- [ ] **Branch management working** - Create, edit, delete, users
- [ ] **Permission overrides UI** - View, add, remove overrides
- [ ] **140+ tests passing** - Comprehensive coverage
- [ ] **Mobile responsive** - Works on all devices
- [ ] **Permission gating** - Only authorized users see admin features

---

## 🔄 Next Steps

After Phase 4 completion:

- Move to Phase 5: Products Module (Vertical Slice)
- Build first complete feature with all 6 layers
- Validate architecture works end-to-end

---

**Last Updated:** 2026-01-27
**Status:** ⚪ Not Started
**Requires:** Phase 1 (RLS), Phase 2 (UI Primitives)
**Next Task:** 4.1 Organization Settings
