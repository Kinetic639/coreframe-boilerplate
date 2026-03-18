# Permission System - Complete Architecture Guide

**Version**: V2 ("Compile, Don't Evaluate")
**Last Updated**: 2026-01-21
**Goal**: Secure, scalable authorization for a multi-tenant, modular app (Next.js + Supabase) with org + branch scopes, custom roles, and per-user exceptions — enforced by PostgreSQL RLS.

---

## Table of Contents

1. [Why This System Exists](#0-why-this-system-exists)
2. [Core Principle](#1-core-principle-compile-dont-evaluate)
3. [Two-Layer Authorization Model](#2-two-layer-authorization-model)
4. [Required Tables](#3-required-tables)
5. [Required SQL Helper Functions](#4-required-sql-helper-functions)
6. [The Compiler](#5-the-compiler-write-time-authorization)
7. [Triggers](#6-triggers-auto-recompile)
8. [RLS Policy Patterns](#7-rls-policy-patterns)
9. [Backend Validation](#8-backend-validation)
10. [Frontend Permission Handling](#9-frontend-permission-handling)
11. [Adding Modules](#10-adding-modules-later)
12. [Debugging Playbook](#11-debugging-playbook)
13. [Common Pitfalls](#12-common-pitfalls)
14. [Branch Scope Extension](#13-branch-scope-extension)
15. [Permission Naming Convention](#14-permission-naming-convention)
16. [Summary Mental Model](#15-summary-mental-model)
17. [READ vs WRITE Reasoning](#16-how-to-reason-about-read-vs-write)
18. [RLS Decision Matrix](#17-the-correct-rls-decision-matrix)
19. [Example: Contacts with Private/Public Lifecycle](#18-contacts-example)
20. [Frontend Permissions](#19-how-frontend-should-think-about-permissions)
21. [Adding New Modules Safely](#20-how-to-add-a-new-module-safely)
22. [What NOT To Do](#21-what-not-to-do)
23. [Final Checklist](#22-final-mental-checklist-for-every-new-table)
24. [Final Takeaway](#23-final-takeaway)

---

## 0) Why This System Exists

This application is **multi-tenant**:

- A user can belong to multiple **organizations**
- Each organization can have multiple **branches**
- Most data belongs to an org (and sometimes additionally to a branch)

We must ensure:

1. **Tenant boundary**: Users can only access data in orgs they belong to.
2. **Authorization**: Within that org, users can only do actions they're permitted to do.
3. **RLS is the final truth**: Even if frontend/backend bugs exist, the database must reject unauthorized operations.

---

## 1) Core Principle ("Compile, Don't Evaluate")

### Golden Rule

> **A user can do X in org Y only if there is an explicit row in `user_effective_permissions` that says so.**

This avoids runtime wildcard logic, deny precedence, and complex joins inside RLS.

Instead:

- On changes (role assignment, role permissions, overrides), we **compile** permissions into explicit facts.
- At query time, RLS performs a simple indexed `EXISTS(...)`.

### Visual Model

```
┌─────────────────────────────────────────────────────────────────┐
│                    WRITE-TIME (Compilation)                      │
│                                                                  │
│  When roles/assignments change → Compiler runs automatically     │
│  Roles + Permissions → Compiled into explicit facts              │
│  Result stored in: user_effective_permissions                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    READ-TIME (Enforcement)                       │
│                                                                  │
│  RLS Policy: "Does row exist in user_effective_permissions?"     │
│  No wildcards. No deny logic. No complex evaluation.             │
│  Just a simple EXISTS check.                                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2) Two-Layer Authorization Model

Every org-owned table should follow this:

### Layer 1: Tenant Boundary (Membership)

> "Are you an active member of this org?"

### Layer 2: Permission (Capability)

> "Do you have permission to do this action in this org?"

### In RLS This Looks Like

| Operation                         | Pattern                                                                                                      |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **SELECT (reads)**                | `is_org_member(organization_id)` or `is_org_member(...) AND has_permission(...)` for sensitive/module tables |
| **INSERT/UPDATE/DELETE (writes)** | `is_org_member(...) AND has_permission(...)`                                                                 |

---

## 3) Required Tables

### 3.1 `organization_members` (Tenant Boundary)

**Purpose**: Source of truth for **who belongs to the org**.

```sql
CREATE TABLE organization_members (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'active',  -- 'active', 'pending', 'inactive'
  joined_at       TIMESTAMPTZ DEFAULT now(),
  deleted_at      TIMESTAMPTZ,

  UNIQUE(organization_id, user_id)
);
```

**Why**: Membership and permissions are different things. Removing membership must immediately block access (even if permissions are stale).

---

### 3.2 `permissions` (Catalog / Dictionary)

**Purpose**: Defines all possible permission slugs.

```sql
CREATE TABLE permissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT UNIQUE NOT NULL,
  category    TEXT NOT NULL,
  action      TEXT,
  description TEXT,
  scope_types TEXT[],  -- e.g., '{org,branch}' (optional, for future)
  created_at  TIMESTAMPTZ DEFAULT now()
);
```

**Rule**: Permission slugs are the **API contract** between backend, RLS, and frontend.

---

### 3.3 `roles` (Bundles)

**Purpose**: Roles are named sets of permissions.

**Two Types**:

- **System roles**: `is_basic=true`, `organization_id=NULL`
- **Custom org roles**: `organization_id=<org_uuid>`

```sql
CREATE TABLE roles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  description     TEXT,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  scope_type      TEXT DEFAULT 'org',  -- 'org' or 'branch'
  is_basic        BOOLEAN DEFAULT false,
  deleted_at      TIMESTAMPTZ,

  -- System roles are unique by name globally
  -- Org roles are unique by name within org
  UNIQUE NULLS NOT DISTINCT (organization_id, name)
);
```

---

### 3.4 `role_permissions` (Role → Permissions Mapping)

**Purpose**: Junction table defining which permissions each role grants.

```sql
CREATE TABLE role_permissions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id       UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  deleted_at    TIMESTAMPTZ,

  UNIQUE(role_id, permission_id)
);
```

---

### 3.5 `user_role_assignments` (Who Has Which Role in Which Scope)

```sql
CREATE TABLE user_role_assignments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id    UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  scope      TEXT NOT NULL CHECK (scope IN ('org', 'branch')),
  scope_id   UUID NOT NULL,  -- organization_id or branch_id
  deleted_at TIMESTAMPTZ,

  UNIQUE(user_id, role_id, scope, scope_id)
);
```

---

### 3.6 `user_permission_overrides` (Per-User Exceptions)

**Purpose**: Stores "grant" or "revoke" of a single permission for a single user in an org (or branch later).

```sql
CREATE TABLE user_permission_overrides (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id       UUID REFERENCES branches(id) ON DELETE CASCADE,  -- For future branch scope
  permission_id   UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  effect          TEXT NOT NULL DEFAULT 'grant' CHECK (effect IN ('grant', 'revoke')),
  permission_slug TEXT,  -- Denormalized convenience (auto-populated via trigger)
  deleted_at      TIMESTAMPTZ,

  UNIQUE(user_id, organization_id, permission_id)
);
```

**Important**: Overrides are **compiled** (not evaluated in RLS).

---

### 3.7 `user_effective_permissions` (Compiled Facts)

**Purpose**: This is what RLS checks. One row = one allowed permission in one scope.

```sql
CREATE TABLE user_effective_permissions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  permission_slug  TEXT NOT NULL,
  source_type      TEXT NOT NULL DEFAULT 'role',  -- 'role' or 'override'
  source_id        UUID,  -- role_id or override_id
  compiled_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(user_id, organization_id, permission_slug)
);

-- Critical indexes for RLS performance
CREATE INDEX idx_uep_user_org ON user_effective_permissions(user_id, organization_id);
CREATE INDEX idx_uep_permission ON user_effective_permissions(permission_slug);
CREATE INDEX idx_uep_user_org_permission ON user_effective_permissions(user_id, organization_id, permission_slug);
```

---

## 4) Required SQL Helper Functions

### 4.1 `is_org_member(org_id)` - Tenant Boundary Check

```sql
CREATE OR REPLACE FUNCTION public.is_org_member(org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.organization_id = org_id
      AND om.user_id = auth.uid()
      AND om.status = 'active'
      AND om.deleted_at IS NULL
  );
$$;
```

---

### 4.2 `has_permission(org_id, permission_slug)` - Permission Check

Uses compiled facts.

```sql
CREATE OR REPLACE FUNCTION public.has_permission(org_id uuid, permission text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_effective_permissions uep
    WHERE uep.organization_id = org_id
      AND uep.user_id = auth.uid()
      AND uep.permission_slug = permission
  );
$$;
```

---

### 4.3 `has_permission_safe(org_id, permission)` - Optional Bulletproof Version

If you want "bulletproof by default," include membership inside permission check:

```sql
CREATE OR REPLACE FUNCTION public.has_permission_safe(org_id uuid, permission text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT public.is_org_member(org_id)
     AND public.has_permission(org_id, permission);
$$;
```

---

## 5) The Compiler (Write-Time Authorization)

The compiler converts:

- **Roles** (via `role_permissions`)
- Plus **overrides** (grant/revoke)
- Into rows in `user_effective_permissions`

### 5.1 Compile Algorithm (Per User + Org)

**Pseudo-code**:

```
1. Find all role assignments for user in org
2. Collect all permissions granted by those roles
3. Apply overrides:
   - grant → add permission
   - revoke → remove permission
4. Replace rows in user_effective_permissions for that user+org
```

**Implementation Notes**:

1. Use `DELETE FROM user_effective_permissions WHERE user_id=? AND organization_id=?`
2. Then bulk `INSERT ... ON CONFLICT DO NOTHING`
3. Wrap in a transaction
4. Ensure it runs with appropriate privileges (often `SECURITY DEFINER`)

### 5.2 Example Implementation

```sql
CREATE OR REPLACE FUNCTION compile_user_permissions(p_user_id UUID, p_org_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  desired_perms TEXT[];
BEGIN
  -- Step 1-2: Get all permissions from assigned roles
  SELECT ARRAY_AGG(DISTINCT p.slug) INTO desired_perms
  FROM public.user_role_assignments ura
  JOIN public.role_permissions rp ON ura.role_id = rp.role_id
  JOIN public.permissions p ON rp.permission_id = p.id
  WHERE ura.user_id = p_user_id
    AND ura.scope = 'org'
    AND ura.scope_id = p_org_id
    AND ura.deleted_at IS NULL
    AND rp.deleted_at IS NULL;

  -- Step 3: Apply grant overrides (add)
  SELECT ARRAY_AGG(DISTINCT slug) INTO desired_perms
  FROM (
    SELECT unnest(COALESCE(desired_perms, ARRAY[]::TEXT[])) AS slug
    UNION
    SELECT p.slug
    FROM public.user_permission_overrides upo
    JOIN public.permissions p ON upo.permission_id = p.id
    WHERE upo.user_id = p_user_id
      AND upo.organization_id = p_org_id
      AND upo.effect = 'grant'
      AND upo.deleted_at IS NULL
  ) combined;

  -- Step 3: Apply revoke overrides (remove)
  SELECT ARRAY_AGG(slug) INTO desired_perms
  FROM (
    SELECT unnest(COALESCE(desired_perms, ARRAY[]::TEXT[])) AS slug
    EXCEPT
    SELECT p.slug
    FROM public.user_permission_overrides upo
    JOIN public.permissions p ON upo.permission_id = p.id
    WHERE upo.user_id = p_user_id
      AND upo.organization_id = p_org_id
      AND upo.effect = 'revoke'
      AND upo.deleted_at IS NULL
  ) after_revoke;

  -- Handle NULL array
  IF desired_perms IS NULL THEN
    desired_perms := ARRAY[]::TEXT[];
  END IF;

  -- Step 4a: Delete permissions not in desired set
  DELETE FROM public.user_effective_permissions
  WHERE user_id = p_user_id
    AND organization_id = p_org_id
    AND permission_slug != ALL(desired_perms);

  -- Step 4b: Upsert desired permissions
  INSERT INTO public.user_effective_permissions
    (id, user_id, organization_id, permission_slug, source_type, compiled_at)
  SELECT
    gen_random_uuid(),
    p_user_id,
    p_org_id,
    unnest(desired_perms),
    'role',
    now()
  ON CONFLICT (user_id, organization_id, permission_slug)
  DO UPDATE SET compiled_at = now();
END;
$$;
```

---

## 6) Triggers (Auto-Recompile)

Recompile should happen automatically when authorization inputs change.

### Trigger Sources

| Table                       | Events               | Action                                                   |
| --------------------------- | -------------------- | -------------------------------------------------------- |
| `user_role_assignments`     | INSERT/UPDATE/DELETE | Compile for that user+org                                |
| `role_permissions`          | INSERT/UPDATE/DELETE | Compile for ALL users with that role                     |
| `user_permission_overrides` | INSERT/UPDATE/DELETE | Compile for that user                                    |
| `organization_members`      | UPDATE/DELETE        | **Cleanup** compiled permissions when membership removed |

### Cleanup Trigger (Critical)

When membership becomes inactive/deleted:

1. Delete compiled permissions for that user+org
2. Optionally soft-delete role assignments too (or keep but ignore in compiler)

```sql
CREATE OR REPLACE FUNCTION trigger_cleanup_on_membership_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Handle UPDATE: status changed to non-active or deleted_at set
  IF TG_OP = 'UPDATE' THEN
    IF (NEW.status != 'active' AND OLD.status = 'active')
       OR (NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL) THEN
      -- Purge compiled permissions
      DELETE FROM public.user_effective_permissions
      WHERE user_id = NEW.user_id
        AND organization_id = NEW.organization_id;
    END IF;
    RETURN NEW;
  END IF;

  -- Handle DELETE: membership removed entirely
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.user_effective_permissions
    WHERE user_id = OLD.user_id
      AND organization_id = OLD.organization_id;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

CREATE TRIGGER trigger_membership_permission_cleanup
  AFTER UPDATE OF status, deleted_at OR DELETE
  ON public.organization_members
  FOR EACH ROW
  EXECUTE FUNCTION trigger_cleanup_on_membership_change();
```

---

## 7) RLS Policy Patterns

### 7.1 Pattern A: Org-Readable, Permission-Written (Most Common)

**Use for**: `branches`, `products`, `contacts` (public), `orders`, `settings`

```sql
-- SELECT: Members can read
CREATE POLICY "table_select_member" ON table_name
FOR SELECT
USING (is_org_member(organization_id));

-- INSERT: Requires permission
CREATE POLICY "table_insert_permission" ON table_name
FOR INSERT
WITH CHECK (
  is_org_member(organization_id)
  AND has_permission(organization_id, 'entity.create')
);

-- UPDATE: Requires permission
CREATE POLICY "table_update_permission" ON table_name
FOR UPDATE
USING (
  is_org_member(organization_id)
  AND has_permission(organization_id, 'entity.update')
)
WITH CHECK (
  is_org_member(organization_id)
  AND has_permission(organization_id, 'entity.update')
);

-- DELETE: Requires permission
CREATE POLICY "table_delete_permission" ON table_name
FOR DELETE
USING (
  is_org_member(organization_id)
  AND has_permission(organization_id, 'entity.delete')
);
```

---

### 7.2 Pattern B: Sensitive Table (Permission-Gated Reads)

**Use for**: `billing_events`, `audit_logs`, `financial_reports`, `admin_configs`

```sql
-- SELECT: Requires permission
CREATE POLICY "sensitive_select_permission" ON billing_events
FOR SELECT
USING (
  is_org_member(organization_id)
  AND has_permission(organization_id, 'billing.read')
);
```

---

### 7.3 Pattern C: Mixed Visibility (Private vs Public Rows)

**Use for**: `contacts`, `drafts`, `notes`, `personal_configs`

```sql
-- SELECT: Public or owner
CREATE POLICY "mixed_select" ON contacts
FOR SELECT
USING (
  is_org_member(organization_id)
  AND (
    is_private = false
    OR created_by = auth.uid()
    OR has_permission(organization_id, 'contacts.manage')
  )
);

-- UPDATE: Owner (private) or admin (public)
CREATE POLICY "mixed_update" ON contacts
FOR UPDATE
USING (
  is_org_member(organization_id)
  AND (
    (is_private = true AND created_by = auth.uid())
    OR (is_private = false AND has_permission(organization_id, 'contacts.manage'))
  )
)
WITH CHECK (
  is_org_member(organization_id)
  AND (
    (is_private = false AND has_permission(organization_id, 'contacts.manage'))
    OR (is_private = true AND created_by = auth.uid())
  )
);
```

---

## 8) Backend Validation

You have **two enforcement layers**:

1. **Database RLS** (final truth)
2. **Backend pre-checks** (better UX & clearer errors)

### Recommended Backend Flow

```typescript
// 1. Validate session exists
const {
  data: { user },
  error,
} = await supabase.auth.getUser();
if (!user) throw new AuthError("Not authenticated");

// 2. Determine orgId (and branchId later)
const orgId = getActiveOrgId();

// 3. Optional pre-check for nice error messages
const hasPermission = await PermissionServiceV2.currentUserHasPermission(
  supabase,
  orgId,
  "branches.create"
);
if (!hasPermission) {
  throw new ForbiddenError("You do not have permission to create branches");
}

// 4. Run DB query (RLS enforces regardless)
const { data, error } = await supabase
  .from("branches")
  .insert({ name: "New Branch", organization_id: orgId });
```

### Key Points

- Backend pre-checks provide **better error messages**
- RLS enforces **regardless of pre-checks**
- Never rely solely on pre-checks for security

---

## 9) Frontend Permission Handling

### 9.1 What Frontend SHOULD Do

- Hide/disable UI actions based on permissions
- Show `AccessDenied` for pages user cannot read
- Provide better UX by anticipating what user can/cannot do

### 9.2 What Frontend MUST NOT Do

- **Never assume hidden UI is security**
- Always handle RLS returning:
  - Empty results
  - Permission-denied errors on writes
  - 401 when session expired

### 9.3 Snapshot Loading

```typescript
// On org switch: fetch effective perms for (user, org)
const permissions = await getBranchPermissions(orgId, branchId);

// Store as Set<string> in Zustand
useAppStore.setState({
  permissionSnapshot: {
    allow: new Set(permissions.allow),
    deny: new Set(permissions.deny), // Always empty in V2
  },
});

// usePermissions().can('x.y') becomes set membership check
const { can } = usePermissions();
if (can("branches.create")) {
  // Show create button
}
```

### 9.4 The Rule

> Frontend checks should match backend permissions exactly — but backend must never depend on frontend.

---

## 10) Adding Modules Later

### Recommended Process

1. **Seed permissions** to `permissions` table
2. **Map into roles** via `role_permissions`
3. **Trigger recompile** (automatic via triggers)
4. **Add RLS policies** to module tables
5. **Use permissions** on frontend for navigation + UI controls

### Example: Adding Warehouse Module

```sql
-- Step 1: Add permissions
INSERT INTO permissions (slug, category, action, description) VALUES
('warehouse.products.read', 'warehouse', 'read', 'View products'),
('warehouse.products.create', 'warehouse', 'create', 'Create products'),
('warehouse.products.update', 'warehouse', 'update', 'Update products'),
('warehouse.products.delete', 'warehouse', 'delete', 'Delete products');

-- Step 2: Assign to roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'org_owner' AND p.slug LIKE 'warehouse.%';

-- Step 3: Recompile happens automatically via trigger

-- Step 4: Add RLS policies
CREATE POLICY "products_select" ON products
FOR SELECT USING (is_org_member(organization_id));

CREATE POLICY "products_insert" ON products
FOR INSERT WITH CHECK (
  is_org_member(organization_id)
  AND has_permission(organization_id, 'warehouse.products.create')
);
```

```tsx
// Step 5: Use in UI
function ProductsPage() {
  const { can } = usePermissions();

  return (
    <div>
      <ProductList />
      {can("warehouse.products.create") && <CreateButton />}
    </div>
  );
}
```

---

## 11) Debugging Playbook

### Check Compiled Permissions

```sql
SELECT permission_slug, source_type, compiled_at
FROM user_effective_permissions
WHERE user_id = '<user-uuid>'
  AND organization_id = '<org-uuid>'
ORDER BY permission_slug;
```

### Check Membership

```sql
SELECT status, deleted_at
FROM organization_members
WHERE user_id = '<user-uuid>'
  AND organization_id = '<org-uuid>';
```

### Check Role Assignments

```sql
SELECT r.name as role_name, ura.scope, ura.scope_id
FROM user_role_assignments ura
JOIN roles r ON ura.role_id = r.id
WHERE ura.user_id = '<user-uuid>'
  AND ura.deleted_at IS NULL;
```

### Test RLS Functions

```sql
-- Run as authenticated user
SELECT is_org_member('<org-uuid>');
SELECT has_permission('<org-uuid>', 'branches.create');
```

### Manually Recompile

```sql
-- For single user
SELECT compile_user_permissions('<user-uuid>', '<org-uuid>');

-- For entire organization
SELECT compile_org_permissions('<org-uuid>');
```

---

## 12) Common Pitfalls

| Pitfall                                       | Solution                                                                             |
| --------------------------------------------- | ------------------------------------------------------------------------------------ |
| Missing membership check on writes            | Use `has_permission_safe()` or consistent policy templates                           |
| Stale compiled perms after membership removal | Add cleanup trigger on `organization_members`                                        |
| Permission slug drift                         | Treat slugs as stable API contracts                                                  |
| Over-gating reads too early                   | Keep simple membership reads for shared metadata tables, gate sensitive/module reads |
| Wildcards in RLS                              | Never evaluate wildcards at runtime; compile to explicit slugs                       |

---

## 13) Branch Scope Extension

### Option A (Recommended): Add Scope Columns to Compiled Permissions

Extend `user_effective_permissions` to support both org and branch facts.

#### Table Changes

```sql
ALTER TABLE user_effective_permissions
ADD COLUMN scope TEXT NOT NULL DEFAULT 'org' CHECK (scope IN ('org', 'branch')),
ADD COLUMN branch_id UUID REFERENCES branches(id) ON DELETE CASCADE;

-- Update uniqueness
-- For org scope: unique on (user_id, organization_id, permission_slug, scope) where branch_id IS NULL
-- For branch scope: unique on (user_id, organization_id, branch_id, permission_slug, scope)
```

#### Example Rows

| user_id | organization_id | branch_id | permission_slug           | scope  |
| ------- | --------------- | --------- | ------------------------- | ------ |
| u1      | org1            | NULL      | members.manage            | org    |
| u1      | org1            | brA       | warehouse.products.create | branch |

#### Branch-Aware Function

```sql
CREATE OR REPLACE FUNCTION public.has_branch_permission(
  org_id uuid,
  branch_id uuid,
  permission text
)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_effective_permissions uep
    WHERE uep.organization_id = org_id
      AND uep.user_id = auth.uid()
      AND uep.permission_slug = permission
      AND (
        -- org-level permission can grant access everywhere
        uep.scope = 'org'
        OR (uep.scope = 'branch' AND uep.branch_id = has_branch_permission.branch_id)
      )
  );
$$;
```

#### Compiler Updates

- Compile org roles into `scope='org'`
- Compile branch roles into `scope='branch'` + `branch_id`
- Apply overrides at org or branch level

#### RLS Usage

For branch-owned tables:

```sql
-- SELECT
USING (
  is_org_member(organization_id)
  AND has_branch_permission(organization_id, branch_id, 'warehouse.products.read')
);

-- INSERT
WITH CHECK (
  is_org_member(organization_id)
  AND has_branch_permission(organization_id, branch_id, 'warehouse.products.create')
);
```

### Option B: Separate Table for Branch Permissions

Create `user_effective_branch_permissions` with `(user_id, org_id, branch_id, permission_slug)`.

**Pros**: Cleaner physical separation
**Cons**: More joins/functions and more places to keep consistent

**Recommendation**: If you already have V2 working well, Option A is usually simpler long-term.

---

## 14) Permission Naming Convention

### 14.1 Recommended Slug Format

`{domain}.{resource}.{action}` (most explicit)

**Examples**:

- `org.settings.update`
- `branches.profile.read`
- `members.role.assign`
- `warehouse.products.read`
- `warehouse.movements.approve`

For shorter non-entity domains:

- `org.read`, `org.update` (fine for top-level domain objects)

### 14.2 Standard Actions

| Action              | Meaning                      |
| ------------------- | ---------------------------- |
| `read`              | List/view                    |
| `create`            | Create new                   |
| `update`            | Modify existing              |
| `delete`            | Remove (soft or hard)        |
| `manage`            | Full control (use sparingly) |
| `approve`           | Workflow approvals           |
| `assign` / `revoke` | Membership/roles             |

### 14.3 Rules to Avoid Future Pain

1. **Never mix patterns** - Don't have both `warehouse.view` and `warehouse.products.read`
2. **No wildcards in DB enforcement** - If you want "bundles", express them as roles or compile-time expansion
3. **Don't overload `manage`** - Reserve it for truly "admin everything in this domain"
4. **Make permissions map to tables or operations**:
   - If there's a `products` table, use `warehouse.products.read/create/update/delete`
5. **Version carefully**:
   - Prefer adding new permissions over renaming old ones
   - If you must rename, provide migration scripts and temporary compatibility

### 14.4 Recommended Baseline Permissions for New Modules

For each module X and entity Y:

- `X.Y.read`
- `X.Y.create`
- `X.Y.update`
- `X.Y.delete`

Then add workflow permissions only when needed:

- `X.operations.approve`
- `X.inventory.adjust`

---

## 15) Summary Mental Model

| Component                    | Question It Answers       |
| ---------------------------- | ------------------------- |
| `organization_members`       | Are you inside this org?  |
| `roles`                      | What bundle do you have?  |
| **Compiler**                 | What are the final facts? |
| `user_effective_permissions` | Exactly what can you do?  |

**RLS uses only**:

- `is_org_member()`
- `has_permission()` / `has_branch_permission()`

> **Roles describe intent.**
> **The compiler turns intent into facts.**
> **Facts are enforced everywhere.**

---

## 16) How to Reason About READ vs WRITE

A common mistake in permission systems is treating reads and writes the same. **Enterprise systems do not do that.**

### Core Rule

> **Membership is about visibility.**
> **Permissions are about authority.**

### Reads (SELECT)

Reads answer: **"Am I allowed to SEE this data at all?"**

In most business apps:

- If you are a member of the organization
- And the data belongs to that organization
- **You can usually read it**

So for many tables, **membership alone is enough for SELECT**.

```sql
USING (is_org_member(organization_id))
```

**Add `has_permission()` to SELECT only when**:

- The data is **sensitive** (salaries, audit logs)
- The data is **role-restricted** (financial reports)
- The data is **personal/private** (other users' private records)
- The data is **admin-only** (configs)

### Writes (INSERT / UPDATE / DELETE)

Writes answer: **"Are you allowed to CHANGE reality?"**

**Writes must always be stricter.**

**Rule**: Every mutation must require an explicit permission.

```sql
WITH CHECK (
  is_org_member(organization_id)
  AND has_permission(organization_id, 'something.action')
)
```

---

## 17) The Correct RLS Decision Matrix

When adding a new table, ask these questions in order:

### Question 1: Is this table org-owned?

If **yes**:

- It must have `organization_id`
- It must have `is_org_member(organization_id)` at minimum

### Question 2: Can any org member read it?

- **Yes** → Membership-only SELECT
- **No** → Permission-gated SELECT

### Question 3: Can any member modify it?

- **Almost always NO**
- **Writes require permissions**

### Decision Table

| Table Type      | SELECT                                    | INSERT               | UPDATE                | DELETE               |
| --------------- | ----------------------------------------- | -------------------- | --------------------- | -------------------- |
| Shared metadata | `is_org_member()`                         | `+ has_permission()` | `+ has_permission()`  | `+ has_permission()` |
| Sensitive data  | `is_org_member() + has_permission()`      | `+ has_permission()` | `+ has_permission()`  | `+ has_permission()` |
| Private/owned   | `is_org_member() + (owner OR permission)` | `is_org_member()`    | `owner OR permission` | `permission`         |

---

## 18) Contacts Example (Private → Public Lifecycle)

### Table Design

```sql
CREATE TABLE contacts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  created_by      UUID NOT NULL REFERENCES auth.users(id),
  is_private      BOOLEAN NOT NULL DEFAULT true,
  name            TEXT,
  email           TEXT,
  phone           TEXT
);
```

### SELECT Policy

```sql
USING (
  is_org_member(organization_id)
  AND (
    is_private = false
    OR created_by = auth.uid()
  )
)
```

- Public contacts → all org members can read
- Private contacts → only creator can read

### INSERT Policy

```sql
WITH CHECK (is_org_member(organization_id))
```

Everyone can create private contacts.

### UPDATE Policy

```sql
USING (
  (created_by = auth.uid() AND is_private = true)
  OR has_permission(organization_id, 'contacts.manage')
)
```

- Creator can edit while private
- Once public → creator loses edit rights
- Admin role controls public contacts

### DELETE Policy

```sql
USING (has_permission(organization_id, 'contacts.manage'))
```

Only admins can delete contacts.

### Resulting Behavior

| Scenario                              | Allowed           |
| ------------------------------------- | ----------------- |
| Member creates private contact        | ✅                |
| Creator edits private contact         | ✅                |
| Creator makes contact public          | ❌ (unless admin) |
| Admin edits public contact            | ✅                |
| Member edits public contact           | ❌                |
| Member reads public contact           | ✅                |
| Member reads private contact (others) | ❌                |

---

## 19) How Frontend Should Think About Permissions

### The Rule

> **Frontend permissions are UX hints, not security.**

### Backend (Supabase + RLS)

- **Authoritative**
- Blocks everything unsafe
- Never trusts frontend

### Frontend

- Hides buttons
- Disables actions
- Shows better errors

### Correct Frontend Flow

```typescript
// 1. App loads
// 2. Server fetches user_effective_permissions
const permissions = await getBranchPermissions(orgId, branchId);

// 3. Frontend stores them in memory (Set)
const allowSet = new Set(permissions.allow);

// 4. UI calls can() for UX decisions
function can(permission: string): boolean {
  return allowSet.has(permission);
}

// 5. Backend still enforces RLS
// If frontend is wrong → request fails safely
```

---

## 20) How to Add a New Module Safely

### Step 1: Add Permissions

```sql
INSERT INTO permissions (slug, category, action, description) VALUES
('warehouse.products.read', 'warehouse', 'read', 'View products'),
('warehouse.products.create', 'warehouse', 'create', 'Create products'),
('warehouse.products.update', 'warehouse', 'update', 'Update products'),
('warehouse.products.delete', 'warehouse', 'delete', 'Delete products');
```

### Step 2: Assign to Roles

```sql
-- org_owner → all
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'org_owner' AND p.slug LIKE 'warehouse.%';

-- org_member → read-only
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'org_member' AND p.slug = 'warehouse.products.read';
```

### Step 3: Trigger Recompilation

Done automatically via triggers.

### Step 4: Add RLS Policies

```sql
CREATE POLICY "products_select" ON products
FOR SELECT USING (
  is_org_member(organization_id)
  AND has_permission(organization_id, 'warehouse.products.read')
);

CREATE POLICY "products_insert" ON products
FOR INSERT WITH CHECK (
  is_org_member(organization_id)
  AND has_permission(organization_id, 'warehouse.products.create')
);
```

### Step 5: Use in UI

```tsx
{
  can("warehouse.products.create") && <CreateButton />;
}
```

---

## 21) What NOT To Do

### Hard Rules - NEVER Do These

| Don't                                           | Why                                              |
| ----------------------------------------------- | ------------------------------------------------ |
| Evaluate wildcards in RLS                       | Fragile, slow, hard to reason about              |
| Put regex in RLS                                | Performance killer, security risk                |
| Compute permissions at read-time                | Defeats "compile, don't evaluate"                |
| Rely on frontend for security                   | Frontend can be bypassed                         |
| Mix membership and permissions into one concept | They answer different questions                  |
| Allow UPDATE without permission checks          | Always require explicit permission for mutations |
| Skip membership check on writes                 | Stale permissions could grant access             |

---

## 22) Final Mental Checklist for Every New Table

Before merging any new table:

- [ ] Does it have `organization_id`?
- [ ] Is membership checked (`is_org_member`)?
- [ ] Are writes permission-gated (`has_permission`)?
- [ ] Are private rows protected (owner check)?
- [ ] Are permissions compiled, not evaluated?
- [ ] Does frontend match backend permissions?
- [ ] **Can this break multi-tenant isolation?** (if yes → STOP)

---

## 23) Final Takeaway

> **Membership answers where you exist.**
> **Permissions answer what power you have.**
> **Roles describe intent.**
> **The compiler turns intent into facts.**
> **Facts are enforced everywhere.**

You now have a clean, scalable, enterprise-grade permission architecture.

---

**Document Version**: 1.0
**Created**: 2026-01-21
**Purpose**: Complete architecture reference for permission system implementation
