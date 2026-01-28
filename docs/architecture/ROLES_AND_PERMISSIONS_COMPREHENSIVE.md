# Comprehensive Roles and Permissions System Documentation

**Created**: 2026-01-19
**Purpose**: Complete reference for understanding, analyzing, and improving the RBAC system
**Audience**: Developers, architects, AI tools for comparison and analysis

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Database Schema](#database-schema)
3. [Current Data State](#current-data-state)
4. [Application Layer Code](#application-layer-code)
5. [Permission Resolution Flow](#permission-resolution-flow)
6. [Wildcard Matching System](#wildcard-matching-system)
7. [Current Issues and Flaws](#current-issues-and-flaws)
8. [Good Parts of the System](#good-parts-of-the-system)
9. [Recommendations for Improvement](#recommendations-for-improvement)
10. [Appendix: Full Code Listings](#appendix-full-code-listings)

---

## System Overview

### What This System Does

The application implements a **Role-Based Access Control (RBAC)** system with the following components:

1. **Roles** - Named collections of permissions (e.g., `org_owner`, `member`)
2. **Permissions** - Individual access rights with wildcard support (e.g., `warehouse.*`, `warehouse.products.read`)
3. **Role Assignments** - Links users to roles within a scope (organization or branch)
4. **Permission Overrides** - User-specific grants/denies that override role-based permissions

### Key Concepts

| Concept                | Description                                                                       |
| ---------------------- | --------------------------------------------------------------------------------- |
| **Scope**              | Where a permission applies: `global`, `org` (organization), or `branch`           |
| **Wildcard**           | Pattern matching with `*` (e.g., `warehouse.*` matches `warehouse.products.read`) |
| **Deny-First**         | Denied permissions always override allowed permissions                            |
| **PermissionSnapshot** | Data structure containing `{ allow: string[], deny: string[] }`                   |

### Architecture Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                     UI Components (React)                        │
│                   usePermissions() hook                          │
│              can(), cannot(), canAny(), canAll()                 │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Zustand Store (Client)                        │
│               useUserStoreV2.permissionSnapshot                  │
│         Hydrated from server, synced on branch change            │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                  PermissionService (Server)                      │
│           getPermissionSnapshotForUser()                         │
│    Queries database, applies overrides, returns snapshot         │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PostgreSQL Database                           │
│   roles, permissions, role_permissions, user_role_assignments,   │
│              user_permission_overrides                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### Table 1: `roles`

Stores role definitions. Roles can be system-wide templates or organization-specific custom roles.

```sql
CREATE TABLE public.roles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),  -- NULL for system/template roles
  name            TEXT NOT NULL,                       -- Role identifier (e.g., "org_owner")
  description     TEXT,                                -- Human-readable description
  scope_type      TEXT NOT NULL DEFAULT 'org',         -- 'org' or 'branch'
  is_basic        BOOLEAN NOT NULL DEFAULT false,      -- true = system template role
  deleted_at      TIMESTAMPTZ                          -- Soft delete timestamp
);
```

**Column Details:**

| Column            | Type        | Nullable | Description                                        |
| ----------------- | ----------- | -------- | -------------------------------------------------- |
| `id`              | UUID        | NO       | Primary key, auto-generated                        |
| `organization_id` | UUID        | YES      | NULL for system roles, org ID for custom roles     |
| `name`            | TEXT        | NO       | Role name/slug (e.g., "org_owner", "member")       |
| `description`     | TEXT        | YES      | Human-readable description                         |
| `scope_type`      | TEXT        | NO       | Where this role can be assigned: 'org' or 'branch' |
| `is_basic`        | BOOLEAN     | NO       | true = system template, false = custom org role    |
| `deleted_at`      | TIMESTAMPTZ | YES      | Soft delete timestamp                              |

**Important Notes:**

- `scope_type` defines where the role CAN be assigned, not where it IS assigned
- System roles (`is_basic = true`) are templates available to all organizations
- Custom roles (`organization_id != NULL`) are org-specific

---

### Table 2: `permissions`

Stores permission definitions with metadata.

```sql
CREATE TABLE public.permissions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug           TEXT NOT NULL UNIQUE,           -- Permission identifier (e.g., "warehouse.*")
  label          TEXT,                           -- Display label
  name           TEXT,                           -- Alternative name
  description    TEXT,                           -- What this permission allows
  category       TEXT NOT NULL,                  -- Grouping: admin, warehouse, teams, etc.
  subcategory    TEXT,                           -- Optional sub-grouping
  resource_type  TEXT,                           -- What resource this controls
  action         TEXT NOT NULL,                  -- What action this permits
  scope_types    TEXT[],                         -- Where this permission can apply
  dependencies   TEXT[],                         -- Other permissions this requires
  conflicts_with TEXT[],                         -- Mutually exclusive permissions
  is_system      BOOLEAN DEFAULT false,          -- System-level permission
  is_dangerous   BOOLEAN DEFAULT false,          -- Requires extra confirmation
  requires_mfa   BOOLEAN DEFAULT false,          -- Requires MFA to use
  priority       INTEGER DEFAULT 0,              -- Ordering priority
  metadata       JSONB DEFAULT '{}',             -- Additional metadata
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now(),
  deleted_at     TIMESTAMPTZ                     -- Soft delete
);
```

**Column Details:**

| Column           | Type    | Nullable | Description                                                             |
| ---------------- | ------- | -------- | ----------------------------------------------------------------------- |
| `slug`           | TEXT    | NO       | Unique permission identifier, supports wildcards (e.g., "warehouse.\*") |
| `category`       | TEXT    | NO       | Grouping category (admin, warehouse, teams, etc.)                       |
| `action`         | TEXT    | NO       | What action this permits                                                |
| `is_dangerous`   | BOOLEAN | YES      | If true, requires extra confirmation                                    |
| `requires_mfa`   | BOOLEAN | YES      | If true, requires MFA                                                   |
| `dependencies`   | TEXT[]  | YES      | Array of permission slugs this depends on                               |
| `conflicts_with` | TEXT[]  | YES      | Array of mutually exclusive permission slugs                            |

**Wildcard Permission Format:**

- `module.*` - Full access to module (e.g., `warehouse.*`)
- `module.entity.*` - Full access to entity (e.g., `warehouse.products.*`)
- `module.entity.action` - Specific action (e.g., `warehouse.products.read`)

---

### Table 3: `role_permissions`

Junction table linking roles to their permissions.

```sql
CREATE TABLE public.role_permissions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id       UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  allowed       BOOLEAN NOT NULL DEFAULT true,    -- true = grant, false = deny at role level
  deleted_at    TIMESTAMPTZ,
  UNIQUE(role_id, permission_id)
);
```

**Column Details:**

| Column          | Type        | Nullable | Description                                          |
| --------------- | ----------- | -------- | ---------------------------------------------------- |
| `role_id`       | UUID        | NO       | Reference to roles table                             |
| `permission_id` | UUID        | NO       | Reference to permissions table                       |
| `allowed`       | BOOLEAN     | NO       | true = permission granted, false = permission denied |
| `deleted_at`    | TIMESTAMPTZ | YES      | Soft delete                                          |

**Note:** The `allowed` field enables role-level denies, but this is rarely used. Most denies come from `user_permission_overrides`.

---

### Table 4: `user_role_assignments`

Links users to roles within a specific scope.

```sql
CREATE TABLE public.user_role_assignments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id    UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  scope      TEXT NOT NULL,        -- 'org' or 'branch'
  scope_id   UUID NOT NULL,        -- organization_id or branch_id
  deleted_at TIMESTAMPTZ,
  UNIQUE(user_id, role_id, scope, scope_id)
);
```

**Column Details:**

| Column       | Type        | Nullable | Description                         |
| ------------ | ----------- | -------- | ----------------------------------- |
| `user_id`    | UUID        | NO       | Reference to auth.users             |
| `role_id`    | UUID        | NO       | Reference to roles                  |
| `scope`      | TEXT        | NO       | Assignment scope: 'org' or 'branch' |
| `scope_id`   | UUID        | NO       | The org ID or branch ID             |
| `deleted_at` | TIMESTAMPTZ | YES      | Soft delete                         |

**How Scope Works:**

| Scope    | scope_id        | Effect                                               |
| -------- | --------------- | ---------------------------------------------------- |
| `org`    | organization_id | Role applies to entire organization and all branches |
| `branch` | branch_id       | Role applies only to the specific branch             |

**Example:**

```
User A has:
- role: org_owner, scope: org, scope_id: org-123    → Full access everywhere in org
- role: member, scope: org, scope_id: org-123       → Basic access everywhere in org

User B has:
- role: member, scope: org, scope_id: org-123       → Basic access everywhere
- role: warehouse_admin, scope: branch, scope_id: branch-456  → Warehouse admin in branch-456 only
```

---

### Table 5: `user_permission_overrides`

User-specific permission grants or denies that override role-based permissions.

```sql
CREATE TABLE public.user_permission_overrides (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  allowed       BOOLEAN NOT NULL,     -- true = grant, false = deny
  scope         TEXT NOT NULL,        -- 'global', 'org', or 'branch'
  scope_id      UUID,                 -- NULL for global, org_id or branch_id otherwise
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at    TIMESTAMPTZ,
  UNIQUE(user_id, permission_id, scope, scope_id)
);
```

**Column Details:**

| Column          | Type        | Nullable | Description                                      |
| --------------- | ----------- | -------- | ------------------------------------------------ |
| `user_id`       | UUID        | NO       | User this override applies to                    |
| `permission_id` | UUID        | NO       | Permission being overridden                      |
| `allowed`       | BOOLEAN     | NO       | true = grant permission, false = deny permission |
| `scope`         | TEXT        | NO       | Override scope: 'global', 'org', or 'branch'     |
| `scope_id`      | UUID        | YES      | NULL for global, otherwise org_id or branch_id   |
| `created_at`    | TIMESTAMPTZ | NO       | Used for precedence (newer wins for same scope)  |

**Override Precedence (highest to lowest):**

1. `branch` scope (most specific)
2. `org` scope
3. `global` scope (least specific)

For same scope, **newest `created_at` wins**.

**Use Cases:**

- Grant a specific user extra permission: `allowed = true`
- Revoke a permission from a specific user: `allowed = false`
- Override a role's permission for just this user

---

## Current Data State

### Roles Currently in Database

| Name                   | Scope Type | Is Basic       | Permissions Count |
| ---------------------- | ---------- | -------------- | ----------------- |
| `org_owner`            | org        | true (system)  | 44 permissions    |
| `member`               | org        | true (system)  | 7 permissions     |
| `Test Manager Updated` | org        | false (custom) | 3 permissions     |

**Critical Observation:** All roles have `scope_type = 'org'`. There are **NO branch-scoped roles** like `branch_manager` or `warehouse_worker`.

---

### Permissions Currently in Database (66 total)

#### By Category:

**admin (1)**

- `admin.*` - Full admin access to all admin operations

**branch (5)**

- `branch.create` - Create new branches
- `branch.delete` - Delete branches
- `branch.profile.update` - Update branch public profile
- `branch.read` - View branch details
- `branch.update` - Update branch details

**general (10)**

- `audit.view`, `branch.manage`, `branch.view`, `org.delete`, `org.edit`, `org.view`
- `permissions.manage`, `user.manage`, `warehouse.manage`, `warehouse.view`

**home (5)**

- `news.create`, `news.delete`, `news.read`, `news.update`, `news.view`

**invitation (10)**

- `invitation.bulk.create`, `invitation.bulk.manage`, `invitation.bulk.read`
- `invitation.cancel`, `invitation.create`, `invitation.events.read`
- `invitation.manage`, `invitation.read`, `invitation.template.manage`, `invitation.template.read`

**organization (7)**

- `organization.create`, `organization.delete`, `organization.profile.update`
- `organization.read`, `organization.settings.read`, `organization.settings.update`, `organization.update`

**permission (4)**

- `permission.override.create`, `permission.override.delete`
- `permission.override.manage`, `permission.override.read`

**role (5)**

- `role.create`, `role.delete`, `role.permission.manage`, `role.read`, `role.update`

**system (3)**

- `system.*` - Full system-level access
- `system.admin` - Full system administration access
- `system.user.impersonate` - Ability to impersonate other users

**teams (6)**

- `teams.*` - Full access to all teams operations
- `teams.chat.admin`, `teams.chat.create`, `teams.chat.moderate`
- `teams.chat.participate`, `teams.chat.view_all`

**user (9)**

- `user.delete`, `user.onboarding.read`, `user.read`, `user.update`
- `user.role.assign`, `user.role.manage`, `user.role.read`, `user.role.revoke`

**warehouse (1)**

- `warehouse.*` - Full access to all warehouse operations

---

### Role → Permission Mappings

#### `org_owner` (44 permissions)

```
admin.*
branch.create, branch.delete, branch.profile.update, branch.read, branch.update
branch.manage, org.edit, org.view, user.manage, warehouse.manage, warehouse.view
news.create, news.delete, news.read, news.update, news.view
invitation.cancel, invitation.create, invitation.manage, invitation.read
organization.profile.update, organization.read, organization.settings.read, organization.settings.update, organization.update
permission.override.create, permission.override.delete, permission.override.manage, permission.override.read
role.create, role.delete, role.permission.manage, role.read, role.update
system.*
teams.*
user.read, user.role.assign, user.role.manage, user.role.read, user.role.revoke, user.update
warehouse.*
```

#### `member` (7 permissions)

```
branch.read
org.view, warehouse.view
news.read, news.view
organization.read
user.read
```

---

## Application Layer Code

### Database Function: `get_permissions_for_roles`

```sql
CREATE OR REPLACE FUNCTION public.get_permissions_for_roles(role_ids uuid[])
RETURNS SETOF text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT p.slug
  FROM public.role_permissions rp
  JOIN public.permissions p ON rp.permission_id = p.id
  WHERE rp.role_id = ANY(role_ids)
    AND rp.allowed = true
    AND rp.deleted_at IS NULL
    AND p.deleted_at IS NULL
  ORDER BY p.slug;
END;
$$;
```

**What it does:** Takes an array of role IDs and returns all permission slugs granted by those roles.

---

### Database Function: `user_has_permission`

```sql
CREATE OR REPLACE FUNCTION public.user_has_permission(user_id uuid, permission_slug text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  RETURN EXISTS(
    SELECT 1
    FROM public.user_role_assignments ura
    JOIN public.role_permissions rp ON ura.role_id = rp.role_id
    JOIN public.permissions p ON rp.permission_id = p.id
    WHERE ura.user_id = user_has_permission.user_id
      AND p.slug = permission_slug
      AND ura.deleted_at IS NULL
      AND rp.allowed = true
      AND p.deleted_at IS NULL
  );
END;
$$;
```

**⚠️ LIMITATION:** This function does **NOT** support wildcard matching. It only does exact slug comparison. A user with `warehouse.*` will return `false` for `user_has_permission(user_id, 'warehouse.products.read')`.

---

### TypeScript Type: PermissionSnapshot

```typescript
/**
 * Permission snapshot with explicit allow and deny lists
 */
export type PermissionSnapshot = {
  /** Permissions explicitly allowed (can include wildcards like "warehouse.*") */
  allow: string[];
  /** Permissions explicitly denied (can include wildcards) - takes precedence over allow */
  deny: string[];
};
```

---

### Service: PermissionService

**File:** `src/server/services/permission.service.ts`

#### Method: `getPermissionSnapshotForUser(supabase, userId, orgId, branchId?)`

**Algorithm:**

1. **Query org-scoped role assignments:**

   ```sql
   SELECT role_id FROM user_role_assignments
   WHERE user_id = ? AND scope = 'org' AND scope_id = orgId AND deleted_at IS NULL
   ```

2. **Query branch-scoped role assignments (if branchId provided):**

   ```sql
   SELECT role_id FROM user_role_assignments
   WHERE user_id = ? AND scope = 'branch' AND scope_id = branchId AND deleted_at IS NULL
   ```

3. **Get permissions from roles via RPC:**

   ```sql
   SELECT * FROM get_permissions_for_roles(role_ids)
   ```

4. **Query user permission overrides:**

   ```sql
   SELECT allowed, scope, scope_id, created_at, permissions.slug
   FROM user_permission_overrides
   JOIN permissions ON permission_id = permissions.id
   WHERE user_id = ? AND scope IN ('global', 'org', 'branch') AND deleted_at IS NULL
   ```

5. **Filter overrides to relevant scope_ids:**
   - Global: always include
   - Org: only if scope_id matches orgId
   - Branch: only if scope_id matches branchId

6. **Apply override precedence:**
   - For each permission slug, keep the highest precedence override
   - Precedence: branch (3) > org (2) > global (1)
   - For same precedence, keep newest `created_at`

7. **Build final snapshot:**
   - `allow`: base permissions + granted overrides
   - `deny`: denied overrides

#### Method: `can(snapshot, requiredPermission)`

```typescript
static can(snapshot: PermissionSnapshot, requiredPermission: string): boolean {
  // Delegate to shared utility
  return checkPermission(snapshot, requiredPermission);
}
```

---

### Utility: Permission Matching

**File:** `src/lib/utils/permissions.ts`

```typescript
/**
 * Check if a permission is allowed
 *
 * Deny-first semantics:
 * 1. If any deny pattern matches → false
 * 2. If any allow pattern matches → true
 * 3. Otherwise → false
 */
export function checkPermission(snapshot: PermissionSnapshot, requiredPermission: string): boolean {
  // Deny-first: if any deny pattern matches, return false
  if (matchesAnyPattern(snapshot.deny, requiredPermission)) {
    return false;
  }
  // Then check allow patterns
  return matchesAnyPattern(snapshot.allow, requiredPermission);
}

/**
 * Check if any pattern matches the required permission
 *
 * Supports wildcards:
 * - "warehouse.*" matches "warehouse.products.read"
 * - "*" matches everything
 */
export function matchesAnyPattern(patterns: string[], required: string): boolean {
  for (const p of patterns) {
    // Exact match or universal wildcard
    if (p === "*" || p === required) return true;

    // Skip non-wildcard patterns
    if (!p.includes("*")) continue;

    // Use cached regex for wildcard patterns
    if (getCachedRegex(p).test(required)) return true;
  }
  return false;
}
```

**Wildcard Regex Conversion:**

- `warehouse.*` → `^warehouse\..*$`
- `warehouse.products.*` → `^warehouse\.products\..*$`
- `*` → matches everything (special case)

---

### Hook: usePermissions

**File:** `src/hooks/v2/use-permissions.ts`

```typescript
export function usePermissions() {
  const permissionSnapshot = useUserStoreV2((state) => state.permissionSnapshot);

  const can = (permission: string): boolean => {
    return checkPermission(permissionSnapshot, permission);
  };

  const cannot = (permission: string): boolean => {
    return !can(permission);
  };

  const canAny = (permissions: string[]): boolean => {
    return permissions.some((p) => checkPermission(permissionSnapshot, p));
  };

  const canAll = (permissions: string[]): boolean => {
    return permissions.every((p) => checkPermission(permissionSnapshot, p));
  };

  const getSnapshot = (): PermissionSnapshot => permissionSnapshot;

  return { can, cannot, canAny, canAll, getSnapshot };
}
```

**Usage in Components:**

```tsx
function ProductsPage() {
  const { can, cannot } = usePermissions();

  if (cannot("warehouse.products.read")) {
    return <AccessDenied />;
  }

  return (
    <div>
      {can("warehouse.products.create") && <CreateButton />}
      {can("warehouse.products.delete") && <DeleteButton />}
    </div>
  );
}
```

---

## Permission Resolution Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     User makes request                           │
│                  Context: orgId, branchId                        │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│              Step 1: Get User's Role Assignments                 │
│                                                                  │
│   Query user_role_assignments WHERE:                             │
│   ├─ user_id = userId                                            │
│   ├─ scope = 'org' AND scope_id = orgId                         │
│   └─ (if branchId) scope = 'branch' AND scope_id = branchId     │
│                                                                  │
│   Result: Set of role_ids                                        │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│              Step 2: Get Permissions from Roles                  │
│                                                                  │
│   Call get_permissions_for_roles(role_ids)                       │
│                                                                  │
│   Result: ['warehouse.*', 'teams.*', 'admin.*', ...]            │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│              Step 3: Get User Permission Overrides               │
│                                                                  │
│   Query user_permission_overrides WHERE:                         │
│   ├─ user_id = userId                                            │
│   ├─ scope IN ('global', 'org', 'branch')                       │
│   └─ scope_id matches context                                    │
│                                                                  │
│   Result: [{slug, allowed, scope, created_at}, ...]             │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│              Step 4: Apply Override Precedence                   │
│                                                                  │
│   For each permission slug:                                      │
│   ├─ Precedence: branch (3) > org (2) > global (1)              │
│   ├─ Same precedence: newest created_at wins                    │
│   └─ allowed=true → add to allow[], allowed=false → add to deny[]│
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│              Step 5: Return PermissionSnapshot                   │
│                                                                  │
│   {                                                              │
│     allow: ['warehouse.*', 'teams.*', ...],                     │
│     deny: ['warehouse.products.delete', ...]                    │
│   }                                                              │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│              Step 6: Permission Check                            │
│                                                                  │
│   can('warehouse.products.read'):                               │
│   ├─ 1. Check deny patterns → not matched                       │
│   ├─ 2. Check allow patterns → matches 'warehouse.*'            │
│   └─ 3. Return true                                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Wildcard Matching System

### How Wildcards Work

The system uses regex-based wildcard matching:

| Pattern                   | Matches                                                                             | Does NOT Match              |
| ------------------------- | ----------------------------------------------------------------------------------- | --------------------------- |
| `warehouse.*`             | `warehouse.products.read`, `warehouse.locations.create`, `warehouse.anything.here`  | `teams.members.read`        |
| `warehouse.products.*`    | `warehouse.products.read`, `warehouse.products.create`, `warehouse.products.delete` | `warehouse.locations.read`  |
| `*`                       | Everything                                                                          | (nothing)                   |
| `warehouse.products.read` | `warehouse.products.read` (exact only)                                              | `warehouse.products.create` |

### Regex Conversion

```
warehouse.*         → ^warehouse\..*$
warehouse.products.* → ^warehouse\.products\..*$
teams.members.*     → ^teams\.members\..*$
```

The `*` is converted to `.*` (match any characters including dots).

### Deny-First Semantics

```typescript
// Example snapshot
const snapshot = {
  allow: ["warehouse.*"], // Full warehouse access
  deny: ["warehouse.products.delete"], // But cannot delete products
};

can("warehouse.products.read"); // true  (allowed by warehouse.*)
can("warehouse.products.create"); // true  (allowed by warehouse.*)
can("warehouse.products.delete"); // FALSE (explicitly denied)
can("warehouse.locations.read"); // true  (allowed by warehouse.*)
can("teams.members.read"); // false (not in allow list)
```

---

## Current Issues and Flaws

### Issue 1: Permission Mismatch Between Code and Database

**Problem:** Code checks for permissions that don't exist in the database.

```typescript
// Code expects:
can("warehouse.products.read"); // ❌ Permission doesn't exist

// Database has:
("warehouse.view"); // This is NOT a wildcard
("warehouse.*"); // Only org_owner has this
```

**Impact:**

- `member` role has `warehouse.view` but code checks for `warehouse.products.read`
- `warehouse.view` does NOT match `warehouse.products.read` (no wildcard)
- Members cannot access warehouse features even though they have `warehouse.view`

**Root Cause:** Permission naming convention was never established. Some permissions use `module.view` pattern, code uses `module.entity.action` pattern.

---

### Issue 2: No Branch-Scoped Roles

**Problem:** All existing roles have `scope_type = 'org'`. There are no branch-level roles.

**Current State:**
| Role | scope_type |
|------|------------|
| org_owner | org |
| member | org |

**Missing:**

- `branch_manager` (scope_type: branch)
- `warehouse_admin` (scope_type: branch)
- `warehouse_worker` (scope_type: branch)
- `viewer` (scope_type: branch)

**Impact:**

- Cannot give a user different permissions per branch
- Either full org access or no access
- Can't have "warehouse admin for Branch A only"

---

### Issue 3: Database Function Doesn't Support Wildcards

**Problem:** `user_has_permission()` function does exact string match.

```sql
-- This returns FALSE even if user has 'warehouse.*'
SELECT user_has_permission(user_id, 'warehouse.products.read');
```

**Impact:**

- Cannot use this function for RLS policies with wildcard permissions
- RLS must be implemented differently or not use wildcards

---

### Issue 4: Granular Permissions Missing

**Problem:** Only 1 warehouse permission exists: `warehouse.*`

**Missing permissions for granular control:**

```
warehouse.products.read
warehouse.products.create
warehouse.products.update
warehouse.products.delete
warehouse.locations.read
warehouse.locations.create
warehouse.movements.read
warehouse.movements.create
warehouse.movements.approve
warehouse.inventory.read
warehouse.inventory.update
```

**Impact:**

- Cannot create a "warehouse viewer" role that can only read
- Cannot create a "warehouse worker" role that can create but not delete
- All or nothing access

---

### Issue 5: Inconsistent Permission Naming

**Current patterns in database:**

| Pattern                | Examples                                                 |
| ---------------------- | -------------------------------------------------------- |
| `module.*`             | `warehouse.*`, `teams.*`, `admin.*`                      |
| `module.action`        | `warehouse.view`, `warehouse.manage`, `branch.view`      |
| `module.entity.action` | `branch.profile.update`, `news.read`, `user.role.assign` |
| `entity.action`        | `news.create`, `news.delete`                             |

**Problem:** No consistent convention makes it hard to:

- Know what permission to check in code
- Create proper role-permission mappings
- Understand what permissions exist

---

### Issue 6: `member` Role Has Insufficient Permissions

**Current `member` permissions (7):**

```
branch.read, org.view, warehouse.view, news.read, news.view, organization.read, user.read
```

**Problems:**

- `warehouse.view` doesn't match `warehouse.products.read` code checks
- No wildcard so can't access any warehouse subfeatures
- Can't do anything useful in the app

---

## Good Parts of the System

### 1. Solid Architecture

The overall architecture is well-designed:

- Separation of roles and permissions
- Junction tables for flexibility
- User-level overrides for exceptions
- Scope-based assignment (org/branch ready)

### 2. Wildcard Support in Application Layer

The application-layer wildcard matching is well-implemented:

- Regex caching for performance
- Deny-first semantics
- Clean API: `can()`, `cannot()`, `canAny()`, `canAll()`

### 3. Override System with Precedence

The override system is sophisticated:

- Three scope levels: global < org < branch
- Timestamp-based tie-breaking
- Can grant OR deny permissions per user

### 4. PermissionSnapshot Pattern

The snapshot pattern is elegant:

- Explicit allow and deny lists
- Can be serialized/cached
- Easy to debug (just log the snapshot)
- Works with wildcards

### 5. Soft Delete Everywhere

All tables have `deleted_at` for:

- Audit trail
- Recovery capability
- No data loss

### 6. TypeScript Types

Strong typing throughout:

- `PermissionSnapshot` type
- Service methods are typed
- Hook returns are typed

### 7. Test Coverage

Good test coverage exists:

- 103+ permission-related tests
- Tests for wildcards, denies, edge cases

---

## Recommendations for Improvement

### Recommendation 1: Establish Permission Naming Convention

**Proposed Convention:**

```
{module}.{action}           → Module-level actions
{module}.{entity}.{action}  → Entity-level actions
{module}.*                  → Full module access (wildcard)
{module}.{entity}.*         → Full entity access (wildcard)
```

**Standard Actions:**

- `read` - View/list items
- `create` - Create new items
- `update` - Modify existing items
- `delete` - Remove items
- `approve` - Approve workflows
- `manage` - Full CRUD access

**Example Migration:**

```
warehouse.view     → warehouse.read.*     (can read all warehouse entities)
warehouse.manage   → warehouse.*          (full warehouse access)
```

---

### Recommendation 2: Add Granular Warehouse Permissions

```sql
INSERT INTO permissions (slug, description, category) VALUES
  ('warehouse.read.*', 'Read all warehouse data', 'warehouse'),
  ('warehouse.create.*', 'Create warehouse items', 'warehouse'),
  ('warehouse.update.*', 'Update warehouse items', 'warehouse'),
  ('warehouse.delete.*', 'Delete warehouse items', 'warehouse'),
  ('warehouse.approve.*', 'Approve warehouse operations', 'warehouse'),
  ('warehouse.products.*', 'Full products access', 'warehouse'),
  ('warehouse.locations.*', 'Full locations access', 'warehouse'),
  ('warehouse.movements.*', 'Full movements access', 'warehouse'),
  ('warehouse.inventory.*', 'Full inventory access', 'warehouse');
```

---

### Recommendation 3: Add Branch-Scoped Roles

```sql
INSERT INTO roles (name, description, scope_type, is_basic) VALUES
  ('branch_manager', 'Full control of a specific branch', 'branch', true),
  ('warehouse_admin', 'Manage warehouse operations in branch', 'branch', true),
  ('warehouse_worker', 'Day-to-day warehouse operations', 'branch', true),
  ('viewer', 'Read-only access to branch', 'branch', true);
```

---

### Recommendation 4: Update `member` Role Permissions

```sql
-- Clear existing
DELETE FROM role_permissions WHERE role_id = (SELECT id FROM roles WHERE name = 'member');

-- Add proper permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'member' AND p.slug IN (
  'org.read.*',
  'teams.read.*',
  'support.tickets.create',
  'warehouse.read.*'  -- Can view warehouse but not modify
);
```

---

### Recommendation 5: Create Role Deny Permissions Table

```sql
CREATE TABLE role_deny_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(role_id, permission_id)
);
```

This allows defining what a role explicitly CANNOT do, separate from the `allowed` boolean.

---

### Recommendation 6: Fix Database Function for Wildcards

```sql
CREATE OR REPLACE FUNCTION public.user_has_permission_v2(
  p_user_id uuid,
  p_permission_slug text,
  p_org_id uuid,
  p_branch_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_has_permission boolean := false;
  v_pattern text;
BEGIN
  -- Get all permission patterns for user's roles
  FOR v_pattern IN
    SELECT DISTINCT p.slug
    FROM user_role_assignments ura
    JOIN role_permissions rp ON ura.role_id = rp.role_id
    JOIN permissions p ON rp.permission_id = p.id
    WHERE ura.user_id = p_user_id
      AND (
        (ura.scope = 'org' AND ura.scope_id = p_org_id)
        OR (p_branch_id IS NOT NULL AND ura.scope = 'branch' AND ura.scope_id = p_branch_id)
      )
      AND ura.deleted_at IS NULL
      AND rp.allowed = true
  LOOP
    -- Check exact match
    IF v_pattern = p_permission_slug THEN
      RETURN true;
    END IF;

    -- Check wildcard match
    IF v_pattern LIKE '%*' THEN
      IF p_permission_slug LIKE replace(v_pattern, '*', '%') THEN
        RETURN true;
      END IF;
    END IF;
  END LOOP;

  RETURN false;
END;
$$;
```

---

### Recommendation 7: Standardize Role-Permission Matrix

| Role               | Scope  | Permissions                                                                |
| ------------------ | ------ | -------------------------------------------------------------------------- |
| `org_owner`        | org    | `admin.*`, `system.*`, `org.*`, `teams.*`, `warehouse.*`, `support.*`      |
| `org_admin`        | org    | `admin.users.*`, `admin.roles.*`, `org.*`, `teams.*`, `warehouse.*`        |
| `member`           | org    | `org.read.*`, `teams.read.*`, `warehouse.read.*`, `support.tickets.create` |
| `branch_manager`   | branch | `warehouse.*`, `teams.*` (branch-scoped)                                   |
| `warehouse_admin`  | branch | `warehouse.*` (branch-scoped)                                              |
| `warehouse_worker` | branch | `warehouse.read.*`, `warehouse.create.*`, `warehouse.update.*`             |
| `viewer`           | branch | `warehouse.read.*`, `teams.read.*`, `org.read.*`                           |

---

## Appendix: Full Code Listings

### A. PermissionService (Complete)

```typescript
// src/server/services/permission.service.ts

import { SupabaseClient } from "@supabase/supabase-js";
import type { PermissionSnapshot } from "@/lib/types/permissions";
import { checkPermission, matchesAnyPattern } from "@/lib/utils/permissions";

export class PermissionService {
  static async getPermissionSnapshotForUser(
    supabase: SupabaseClient,
    userId: string,
    orgId: string,
    branchId?: string | null
  ): Promise<PermissionSnapshot> {
    try {
      // 1. Get user's role assignments
      const roleIds = new Set<string>();

      // Query org roles
      const { data: orgRoles, error: orgErr } = await supabase
        .from("user_role_assignments")
        .select("role_id")
        .eq("user_id", userId)
        .eq("scope", "org")
        .eq("scope_id", orgId)
        .is("deleted_at", null);

      if (orgErr) return { allow: [], deny: [] };
      (orgRoles ?? []).forEach((r) => roleIds.add(r.role_id));

      // Query branch roles (if branch context provided)
      if (branchId) {
        const { data: branchRoles, error: branchErr } = await supabase
          .from("user_role_assignments")
          .select("role_id")
          .eq("user_id", userId)
          .eq("scope", "branch")
          .eq("scope_id", branchId)
          .is("deleted_at", null);

        if (branchErr) return { allow: [], deny: [] };
        (branchRoles ?? []).forEach((r) => roleIds.add(r.role_id));
      }

      // 2. Get base allow permissions from roles via RPC
      let allow: string[] = [];
      if (roleIds.size > 0) {
        const { data, error } = await supabase.rpc("get_permissions_for_roles", {
          role_ids: Array.from(roleIds),
        });
        if (error) return { allow: [], deny: [] };
        allow = (data ?? []).filter((x: any): x is string => typeof x === "string");
      }

      // 3. Get overrides with join to permissions
      const scopeFilter = branchId ? ["global", "org", "branch"] : ["global", "org"];
      const { data: overrides, error: ovErr } = await supabase
        .from("user_permission_overrides")
        .select("allowed, scope, scope_id, created_at, permissions!inner(slug)")
        .eq("user_id", userId)
        .in("scope", scopeFilter)
        .is("deleted_at", null);

      if (ovErr || !overrides?.length) {
        return { allow: uniqSorted(allow), deny: [] };
      }

      // 4. Filter overrides to relevant scope_ids
      const relevantOverrides = (overrides as any[]).filter((o) => {
        if (o.scope === "global") return true;
        if (o.scope === "org") return o.scope_id === orgId;
        if (o.scope === "branch") return o.scope_id === branchId;
        return false;
      });

      // 5. Apply overrides with precedence
      const scopeRank: Record<string, number> = { global: 1, org: 2, branch: 3 };
      const deny: string[] = [];
      const overrideMap = new Map<string, { rank: number; allowed: boolean; created_at: number }>();

      for (const o of relevantOverrides as any[]) {
        const slug = o.permissions?.slug;
        if (!slug) continue;

        const rank = scopeRank[o.scope] ?? 0;
        const createdAt = new Date(o.created_at || 0).getTime();
        const existing = overrideMap.get(slug);

        if (
          !existing ||
          rank > existing.rank ||
          (rank === existing.rank && createdAt > existing.created_at)
        ) {
          overrideMap.set(slug, { rank, allowed: o.allowed, created_at: createdAt });
        }
      }

      for (const [slug, override] of overrideMap.entries()) {
        if (override.allowed) {
          allow.push(slug);
        } else {
          deny.push(slug);
        }
      }

      return { allow: uniqSorted(allow), deny: uniqSorted(deny) };
    } catch (error) {
      return { allow: [], deny: [] };
    }
  }

  static can(snapshot: PermissionSnapshot, requiredPermission: string): boolean {
    return checkPermission(snapshot, requiredPermission);
  }
}

function uniqSorted(arr: string[]): string[] {
  return Array.from(new Set(arr)).sort();
}
```

### B. Permission Utilities (Complete)

```typescript
// src/lib/utils/permissions.ts

import type { PermissionSnapshot } from "@/lib/types/permissions";

const regexCache = new Map<string, RegExp>();

function getCachedRegex(patternWithWildcard: string): RegExp {
  if (!patternWithWildcard) {
    throw new Error("getCachedRegex: pattern cannot be empty");
  }

  const cached = regexCache.get(patternWithWildcard);
  if (cached) return cached;

  const escaped = patternWithWildcard.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");

  const re = new RegExp(`^${escaped}$`);
  regexCache.set(patternWithWildcard, re);
  return re;
}

export function checkPermission(snapshot: PermissionSnapshot, requiredPermission: string): boolean {
  if (matchesAnyPattern(snapshot.deny, requiredPermission)) {
    return false;
  }
  return matchesAnyPattern(snapshot.allow, requiredPermission);
}

export function matchesAnyPattern(patterns: string[], required: string): boolean {
  for (const p of patterns) {
    if (p === "*" || p === required) return true;
    if (!p.includes("*")) continue;
    if (getCachedRegex(p).test(required)) return true;
  }
  return false;
}

export function clearPermissionRegexCache(): void {
  regexCache.clear();
}
```

### C. usePermissions Hook (Complete)

```typescript
// src/hooks/v2/use-permissions.ts

"use client";

import { useUserStoreV2 } from "@/lib/stores/v2/user-store";
import { checkPermission, type PermissionSnapshot } from "@/lib/utils/permissions";

export function usePermissions() {
  const permissionSnapshot = useUserStoreV2((state) => state.permissionSnapshot);

  const can = (permission: string): boolean => {
    return checkPermission(permissionSnapshot, permission);
  };

  const cannot = (permission: string): boolean => {
    return !can(permission);
  };

  const canAny = (permissions: string[]): boolean => {
    return permissions.some((permission) => checkPermission(permissionSnapshot, permission));
  };

  const canAll = (permissions: string[]): boolean => {
    return permissions.every((permission) => checkPermission(permissionSnapshot, permission));
  };

  const getSnapshot = (): PermissionSnapshot => {
    return permissionSnapshot;
  };

  return { can, cannot, canAny, canAll, getSnapshot };
}
```

---

## Summary

### Current State

- **Roles:** 2 system roles (org_owner, member), all org-scoped
- **Permissions:** 66 total, but missing granular warehouse permissions
- **Issues:** Permission naming mismatch, no branch roles, member role broken

### What Works Well

- Architecture is solid
- Wildcard matching in app layer
- Override system with precedence
- PermissionSnapshot pattern
- Good test coverage

### What Needs Fixing

1. Add granular permissions (warehouse.products.read, etc.)
2. Add branch-scoped roles
3. Fix member role permissions
4. Establish naming convention
5. Update database function for wildcards

---

**Document Version:** 1.0
**Last Updated:** 2026-01-19
**Author:** Claude (AI Assistant)
