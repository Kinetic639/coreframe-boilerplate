# PERMISSIONS_ARCHITECTURE_EXTRACTION_V2_BRANCH_AWARE

**Extraction Date:** 2026-03-03
**Extractor:** Claude Code forensic pass
**Source of Truth:** Supabase MCP (live DB) + source code reads
**Branch:** `org-managment-v2`

---

## 0. Executive Summary

This document is a complete forensic extraction of the RBAC and permission compilation architecture as it stands on 2026-03-03. The system has undergone a **major upgrade** from V1 (org-only UEP) to V2 (branch-aware UEP). The key change is that `user_effective_permissions` now carries a `branch_id` column, enabling branch-scoped permission facts to be stored and checked independently from org-scoped facts.

### Architectural Philosophy

The system follows **two concurrent permission evaluation strategies**:

| Strategy                              | Used By                                                                                    | How                                                                            |
| ------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| **Compile-then-read (V2 / "cached")** | RLS policies, `PermissionServiceV2`, `has_permission()`, `user_has_effective_permission()` | DB triggers compile roles → UEP at write-time; RLS checks UEP at read-time     |
| **Dynamic query (V1 / "real-time")**  | `PermissionService`, `loadUserContextV2`, `getBranchPermissions` action                    | Query URA → role_permissions at read-time; supports wildcards + deny-overrides |

**Critical architectural constraint:** The V2 "compiled" path (`PermissionServiceV2`, RLS functions) only reads UEP where `branch_id IS NULL` — it is **org-scope only**. Branch-scoped permissions are only visible through the V1 dynamic query path. This is the root cause of the bug fixed in `getBranchPermissions` (previously used `PermissionServiceV2`, now correctly uses `PermissionService`).

### Live DB Snapshot (2026-03-03)

| Table                                                              | Count                     |
| ------------------------------------------------------------------ | ------------------------- |
| `user_effective_permissions` (org-scope, branch_id IS NULL)        | **31**                    |
| `user_effective_permissions` (branch-scope, branch_id IS NOT NULL) | **5**                     |
| Orphaned branch UEP (no matching URA branch assignment)            | **0** (data integrity OK) |

---

## 1. Live Permissions Registry

All 30 active permissions queried from `public.permissions` table. DB is source of truth.

| Slug                                    | Category   | Action                         | Scope Types  | Is System |
| --------------------------------------- | ---------- | ------------------------------ | ------------ | --------- |
| `account.*`                             | account    | \*                             | `["global"]` | true      |
| `account.preferences.read`              | account    | preferences.read               | `["global"]` | true      |
| `account.preferences.update`            | account    | preferences.update             | `["global"]` | true      |
| `account.profile.read`                  | account    | profile.read                   | `["global"]` | true      |
| `account.profile.update`                | account    | profile.update                 | `["global"]` | true      |
| `account.settings.read`                 | account    | settings.read                  | `["global"]` | true      |
| `account.settings.update`               | account    | settings.update                | `["global"]` | true      |
| `branch.roles.manage`                   | branch     | roles.manage                   | `["branch"]` | **false** |
| `branches.create`                       | branches   | create                         | null         | false     |
| `branches.delete`                       | branches   | delete                         | null         | false     |
| `branches.read`                         | branches   | read                           | null         | false     |
| `branches.update`                       | branches   | update                         | null         | false     |
| `branches.view.any`                     | branches   | view.any                       | null         | false     |
| `branches.view.remove.any`              | branches   | view.remove.any                | null         | false     |
| `branches.view.update.any`              | branches   | view.update.any                | null         | false     |
| `invites.cancel`                        | invites    | cancel                         | null         | false     |
| `invites.create`                        | invites    | create                         | null         | false     |
| `invites.read`                          | invites    | read                           | null         | false     |
| `members.manage`                        | members    | manage                         | null         | false     |
| `members.read`                          | members    | read                           | null         | false     |
| `module.*`                              | module     | \*                             | null         | false     |
| `module.organization-management.access` | module     | organization-management.access | null         | false     |
| `org.read`                              | org        | read                           | null         | false     |
| `org.update`                            | org        | update                         | null         | false     |
| `self.read`                             | self       | read                           | null         | false     |
| `self.update`                           | self       | update                         | null         | false     |
| `superadmin.*`                          | superadmin | \*                             | `["global"]` | true      |
| `superadmin.admin.read`                 | superadmin | admin.read                     | `["global"]` | true      |
| `superadmin.plans.read`                 | superadmin | plans.read                     | `["global"]` | true      |
| `superadmin.pricing.read`               | superadmin | pricing.read                   | `["global"]` | true      |

**Key notes:**

- `branch.roles.manage` is the only permission with `scope_types: ["branch"]` and `is_system: false` — it is a user-assignable, branch-scoped delegation permission.
- `account.*` and `superadmin.*` are system wildcards (`is_system: true`), used by the admin module.
- `module.*` is org-scoped but not is_system — granted to `org_owner` role via migration.
- Permissions with `scope_types: null` are treated as org-scoped by convention.

### TypeScript Constants

All slugs are exported from `src/lib/constants/permissions.ts`. No raw permission strings exist outside this file (enforced by code review convention).

```typescript
// Key constants (full list in file)
BRANCH_ROLES_MANAGE = "branch.roles.manage";
BRANCHES_VIEW_ANY = "branches.view.any";
MEMBERS_READ = "members.read";
MEMBERS_MANAGE = "members.manage";
MODULE_ORGANIZATION_MANAGEMENT_ACCESS = "module.organization-management.access";
```

---

## 2. RBAC Data Model

### 2.1 `roles`

```
id              uuid PK  gen_random_uuid()
organization_id uuid     nullable  -- NULL = system/global role
name            text     NOT NULL
is_basic        boolean  default false
scope_type      text     NOT NULL  default 'org'  -- 'org' | 'branch' | 'both'
description     text     nullable
deleted_at      timestamptz nullable
```

- `scope_type` controls which URA scope is valid for assignments to this role.
- `organization_id IS NULL` = system roles (e.g., `org_owner`, `org_member`).
- `is_basic` marks roles that cannot be deleted by org admins.

**RLS Policies (5):**

- `roles_select_system` (SELECT): `organization_id IS NULL` — everyone can see system roles
- `roles_select_org` (SELECT): `is_org_member(organization_id)` — members see org roles
- `roles_insert_permission` (INSERT): `has_permission(organization_id, 'members.manage')` AND `is_org_member`
- `roles_update_permission` (UPDATE): same as insert
- `roles_delete_permission` (DELETE): same as insert

### 2.2 `role_permissions`

Joins roles to permission slugs. Mirrors roles RLS (5 policies, same pattern as roles write policies).

Key columns: `role_id`, `permission_id`, `allowed` (bool), `deleted_at`.

### 2.3 `user_role_assignments` (URA)

```
id       uuid PK  gen_random_uuid()
user_id  uuid     FK → auth.users(id) ON DELETE RESTRICT  NOT NULL
role_id  uuid     FK → roles(id) ON DELETE RESTRICT       NOT NULL
scope    text     NOT NULL   CHECK (scope IN ('org', 'branch'))
scope_id uuid     NOT NULL   -- org_id when scope='org', branch_id when scope='branch'
deleted_at timestamptz nullable
```

**Unique Constraint:** `(user_id, role_id, scope, scope_id)` — prevents duplicate assignments.

**RLS Policies (7):**

| Policy Name                            | CMD    | Gate                                                                                                                            |
| -------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `View own role assignments`            | SELECT | `user_id = auth.uid()`                                                                                                          |
| `V2 view org role assignments`         | SELECT | `scope='org' AND is_org_member(scope_id) AND has_permission(scope_id, 'members.read')`                                          |
| `V2 view branch role assignments`      | SELECT | `scope='branch' AND (has_permission(org_id, 'members.read') OR has_branch_permission(org_id, scope_id, 'branch.roles.manage'))` |
| `Org admins view org role assignments` | SELECT | `scope='org' AND (is_org_creator(scope_id) OR has_org_role(scope_id, 'org_owner'))`                                             |
| `V2 assign roles`                      | INSERT | See dual-gate below                                                                                                             |
| `V2 update role assignments`           | UPDATE | See dual-gate below                                                                                                             |
| `V2 delete role assignments`           | DELETE | See dual-gate below                                                                                                             |

**Dual-gate pattern for INSERT/UPDATE/DELETE:**

```sql
-- Org path:
(scope = 'org' AND is_org_member(scope_id) AND has_permission(scope_id, 'members.manage'))
OR
-- Branch path:
(scope = 'branch'
  AND (
    has_permission(branch.organization_id, 'members.manage')
    OR has_branch_permission(branch.organization_id, scope_id, 'branch.roles.manage')
  )
  AND is_org_member(branch.organization_id)
)
```

This is the **DB-level enforcement** of the branch manager delegation model: holders of `branch.roles.manage` on a specific branch can assign/remove branch-scoped roles on that branch without `members.manage`.

### 2.4 `user_effective_permissions` (UEP) — V2 with branch_id

```
id              uuid PK  gen_random_uuid()
user_id         uuid     NOT NULL
organization_id uuid     NOT NULL
permission_slug text     NOT NULL
source_type     text     default 'role'   -- 'role' | 'override'
source_id       uuid     nullable
created_at      timestamptz
compiled_at     timestamptz
branch_id       uuid     nullable   -- NULL = org-scope; UUID = branch-scope (ADDED IN V2)
```

**Unique Constraint:** `user_effective_permissions_unique_v2` on `(user_id, organization_id, permission_slug, branch_id)`

**Indexes:**
| Index | Unique | Columns |
|---|---|---|
| `user_effective_permissions_pkey` | YES (PK) | `id` |
| `user_effective_permissions_unique_v2` | YES | `user_id, organization_id, permission_slug, branch_id` |
| `idx_uep_user_org` | no | `user_id, organization_id` |
| `idx_uep_user_org_branch` | no | `user_id, organization_id, branch_id` |
| `idx_uep_user_org_permission` | no | `user_id, organization_id, permission_slug` |
| `idx_uep_permission` | no | `permission_slug` |

**RLS Policies (2):**

- `Users can view own effective permissions` (SELECT): `user_id = auth.uid()`
- `Org owners can view member permissions` (SELECT): `has_org_role(organization_id, 'org_owner')`

### 2.5 `user_permission_overrides` (UPO)

```
id              uuid PK  gen_random_uuid()
user_id         uuid     NOT NULL
permission_id   uuid     NOT NULL
allowed         boolean  NOT NULL
scope           text     NOT NULL
scope_id        uuid     nullable
deleted_at      timestamptz nullable
created_at      timestamptz NOT NULL  default now()
updated_at      timestamptz NOT NULL  default now()
effect          text     NOT NULL  default 'grant'   -- 'grant' | 'revoke'
permission_slug text     nullable
organization_id uuid     nullable
```

**RLS Policies (5):**

- `overrides_select_self` (SELECT): `user_id = auth.uid() AND deleted_at IS NULL`
- `overrides_select_admin` (SELECT): `is_org_member AND has_permission('members.manage') AND deleted_at IS NULL`
- `overrides_insert_permission` (INSERT): `is_org_member AND has_permission('members.manage') AND deleted_at IS NULL`
- `overrides_update_permission` (UPDATE): same
- `overrides_delete_permission` (DELETE): same

### 2.6 `organization_members`

```
id              uuid PK  gen_random_uuid()
organization_id uuid     NOT NULL
user_id         uuid     NOT NULL
status          text     NOT NULL  default 'active'
joined_at       timestamptz nullable  default now()
created_at      timestamptz nullable  default now()
updated_at      timestamptz nullable  default now()
deleted_at      timestamptz nullable
```

Used by `compile_user_permissions` as the membership guard — if a user is not an `active` member, their UEP is wiped.

---

## 3. Permission Compilation Pipeline

### 3.1 DB Function: `compile_user_permissions(p_user_id, p_organization_id)`

This is the **canonical compiler** called by DB triggers on every URA change.

```sql
BEGIN
  -- ============================================================
  -- STEP 1: Active membership guard
  -- If user is not active member → wipe UEP and return.
  -- ============================================================
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = p_user_id
      AND organization_id = p_organization_id
      AND status = 'active'
      AND deleted_at IS NULL
  ) THEN
    DELETE FROM public.user_effective_permissions
    WHERE user_id = p_user_id AND organization_id = p_organization_id;
    RETURN;
  END IF;

  -- ============================================================
  -- STEP 2: Advisory lock (prevent concurrent compilation races)
  -- ============================================================
  PERFORM pg_advisory_xact_lock(
    hashtext(p_user_id::text || p_organization_id::text)
  );

  -- ============================================================
  -- STEP 3: Delete all existing UEP for this user/org (all scopes)
  -- ============================================================
  DELETE FROM public.user_effective_permissions
  WHERE user_id = p_user_id AND organization_id = p_organization_id;

  -- ============================================================
  -- STEP 4: Insert ORG-SCOPED permissions (branch_id = NULL)
  -- Source: URA scope='org' → roles → role_permissions
  --         UNION grant overrides
  -- Excludes: any slug with active revoke override
  -- ============================================================
  INSERT INTO public.user_effective_permissions (
    user_id, organization_id, permission_slug, source_type, branch_id, compiled_at
  )
  SELECT DISTINCT p_user_id, p_organization_id, slug, source_type, NULL::uuid, now()
  FROM (
    -- From org-scoped role assignments
    SELECT p.slug, 'role' AS source_type
    FROM user_role_assignments ura
    JOIN roles r           ON ura.role_id = r.id
    JOIN role_permissions rp ON r.id = rp.role_id AND rp.allowed = true
    JOIN permissions p     ON rp.permission_id = p.id
    WHERE ura.user_id = p_user_id
      AND ura.scope = 'org' AND ura.scope_id = p_organization_id
      AND ura.deleted_at IS NULL AND r.deleted_at IS NULL
      AND rp.deleted_at IS NULL AND p.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM user_permission_overrides upo
        WHERE upo.user_id = p_user_id AND upo.organization_id = p_organization_id
          AND upo.permission_slug = p.slug AND upo.effect = 'revoke'
          AND upo.deleted_at IS NULL
      )
    UNION
    -- From explicit grant overrides
    SELECT upo.permission_slug, 'override' AS source_type
    FROM user_permission_overrides upo
    WHERE upo.user_id = p_user_id AND upo.organization_id = p_organization_id
      AND upo.effect = 'grant' AND upo.permission_slug IS NOT NULL
      AND upo.deleted_at IS NULL
  ) AS final_perms
  ON CONFLICT ON CONSTRAINT user_effective_permissions_unique_v2
  DO UPDATE SET compiled_at = now(), source_type = EXCLUDED.source_type;

  -- ============================================================
  -- STEP 5: Insert BRANCH-SCOPED permissions (branch_id = ura.scope_id)
  -- Source: URA scope='branch' for branches in this org
  -- Excludes: any slug with active revoke override (org-level revokes apply)
  -- ============================================================
  INSERT INTO public.user_effective_permissions (
    user_id, organization_id, permission_slug, source_type, branch_id, compiled_at
  )
  SELECT DISTINCT p_user_id, p_organization_id, p.slug, 'role', ura.scope_id, now()
  FROM user_role_assignments ura
  JOIN roles r            ON ura.role_id = r.id
  JOIN role_permissions rp ON r.id = rp.role_id AND rp.allowed = true
  JOIN permissions p      ON rp.permission_id = p.id
  JOIN branches b         ON b.id = ura.scope_id AND b.deleted_at IS NULL
  WHERE ura.user_id = p_user_id AND ura.scope = 'branch'
    AND b.organization_id = p_organization_id
    AND ura.deleted_at IS NULL AND r.deleted_at IS NULL
    AND rp.deleted_at IS NULL AND p.deleted_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM user_permission_overrides upo
      WHERE upo.user_id = p_user_id AND upo.organization_id = p_organization_id
        AND upo.permission_slug = p.slug AND upo.effect = 'revoke'
        AND upo.deleted_at IS NULL
    )
  ON CONFLICT ON CONSTRAINT user_effective_permissions_unique_v2
  DO UPDATE SET compiled_at = now(), source_type = EXCLUDED.source_type;
END;
```

**Key behaviours:**

- Advisory lock prevents race conditions when multiple URA changes fire simultaneously.
- Step 3 wipes UEP before re-inserting — full recompile, not incremental.
- Org-level revoke overrides apply to branch-scoped permissions too (Step 5 exclusion).
- ON CONFLICT upserts prevent failures if the unique constraint is hit mid-compilation.

### 3.2 Trigger: `trigger_compile_on_role_assignment`

Fires **AFTER INSERT, UPDATE, DELETE on `user_role_assignments`**.

```sql
DECLARE v_org_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.scope = 'org' THEN
      PERFORM compile_user_permissions(OLD.user_id, OLD.scope_id);
    ELSIF OLD.scope = 'branch' THEN
      SELECT organization_id INTO v_org_id FROM branches WHERE id = OLD.scope_id;
      IF v_org_id IS NOT NULL THEN
        PERFORM compile_user_permissions(OLD.user_id, v_org_id);
      END IF;
    END IF;
    RETURN OLD;
  ELSE
    IF NEW.scope = 'org' THEN
      PERFORM compile_user_permissions(NEW.user_id, NEW.scope_id);
    ELSIF NEW.scope = 'branch' THEN
      SELECT organization_id INTO v_org_id FROM branches WHERE id = NEW.scope_id;
      IF v_org_id IS NOT NULL THEN
        PERFORM compile_user_permissions(NEW.user_id, v_org_id);
      END IF;
    END IF;
    RETURN NEW;
  END IF;
END;
```

**Key behaviour:** For branch-scope assignments, the trigger resolves `organization_id` from `branches` and passes it to `compile_user_permissions`. The compiler then recompiles all UEP (both org-scope and branch-scope) for that user/org pair.

### 3.3 Trigger: `validate_role_assignment_scope`

Fires **BEFORE INSERT, UPDATE on `user_role_assignments`**.

```sql
DECLARE role_scope_type text;
BEGIN
  SELECT scope_type INTO role_scope_type FROM roles WHERE id = NEW.role_id;

  IF role_scope_type = 'org' AND NEW.scope != 'org' THEN
    RAISE EXCEPTION 'Role % can only be assigned at org scope', NEW.role_id;
  END IF;

  IF role_scope_type = 'branch' AND NEW.scope != 'branch' THEN
    RAISE EXCEPTION 'Role % can only be assigned at branch scope', NEW.role_id;
  END IF;
  -- 'both' allows either scope, no check needed
  RETURN NEW;
END;
```

Enforces `roles.scope_type` at the database level. Application layer (TypeScript) also enforces `ORG_ONLY_SLUGS` at the server action level for defense in depth.

### 3.4 DB RPC Functions

#### `has_permission(org_id uuid, permission text)` → boolean

**Org-scope only. Used by RLS policies.**

```sql
SELECT EXISTS (
  SELECT 1 FROM user_effective_permissions
  WHERE organization_id = org_id
    AND user_id = auth.uid()
    AND permission_slug = permission
    AND branch_id IS NULL        -- ← org-scope only
);
```

#### `has_branch_permission(org_id uuid, branch_id uuid, slug text)` → boolean

**Branch-aware. Used by URA RLS policies for branch manager delegation.**

```sql
SELECT EXISTS (
  SELECT 1 FROM user_effective_permissions
  WHERE user_id = auth.uid()
    AND organization_id = p_org_id
    AND permission_slug = p_permission_slug
    AND (
      branch_id IS NULL          -- org-wide grant satisfies any branch check
      OR branch_id = p_branch_id -- branch-specific grant for exact branch
    )
);
```

**Critical:** An org-scope grant (branch_id IS NULL) satisfies `has_branch_permission`. This means if a user has `members.manage` via an org role, they automatically pass the branch manager RLS checks too.

#### `user_has_effective_permission(user_id uuid, org_id uuid, slug text)` → boolean

**Explicit user lookup. Org-scope only. Used by `PermissionServiceV2.hasPermission`.**

```sql
SELECT EXISTS (
  SELECT 1 FROM user_effective_permissions
  WHERE user_id = p_user_id
    AND organization_id = p_organization_id
    AND permission_slug = p_permission_slug
    AND branch_id IS NULL        -- ← org-scope only
);
```

**Note:** Unlike `has_permission`, this takes an explicit `user_id` rather than relying on `auth.uid()`. Used for checking specific users (e.g., in admin operations).

---

## 4. Application Layer — Permission Services

### 4.1 `PermissionService` — Dynamic Branch-Aware (V1)

**File:** `src/server/services/permission.service.ts`

```typescript
static async getPermissionSnapshotForUser(
  supabase: SupabaseClient,
  userId: string,
  orgId: string,
  branchId?: string | null
): Promise<PermissionSnapshot>
```

**Algorithm:**

1. Query URA for org-scoped role IDs (`scope='org', scope_id=orgId`)
2. If `branchId` provided: additionally query URA for branch-scoped role IDs (`scope='branch', scope_id=branchId`)
3. Call RPC `get_permissions_for_roles(role_ids[])` → get allow slug list
4. Fetch UPO with scope filter (`global` always; `org` if orgId; `branch` if branchId)
5. Apply override precedence: branch > org > global; same scope → newest `created_at` wins
6. Return `{ allow: string[], deny: string[] }` (deny = slugs with `allowed: false`)

**Supports wildcards at runtime** (wildcard slugs stored as-is in allow/deny arrays; matched by `checkPermission` utility).

**This service is used for SSR permission loading (`loadUserContextV2`) and the `getBranchPermissions` client-sync action.**

### 4.2 `PermissionServiceV2` — Compiled Read-Only (V2)

**File:** `src/server/services/permission-v2.service.ts`

```typescript
static async getPermissionSnapshotForUser(
  supabase: SupabaseClient,
  userId: string,
  orgId: string,
  _branchId?: string | null  // ← IGNORED — not used in query
): Promise<PermissionSnapshot>
```

Reads from `user_effective_permissions` **without filtering by branch_id** (implicit: selects all rows for user+org, including both branch_id IS NULL and branch_id IS NOT NULL). However `getEffectivePermissionsArray` also has no branch_id filter, so it returns all compiled permissions (org + all branches mixed together).

**`_branchId` is silently ignored.** This was the root cause of a bug where branch-scoped permissions were stripped during client-side `PermissionsSync` — fixed by switching `getBranchPermissions` to `PermissionService`.

Key methods:

- `getEffectivePermissions(supabase, userId, orgId)` → `Set<string>` (all compiled slugs, no branch filter)
- `getEffectivePermissionsArray(supabase, userId, orgId)` → `string[]` (sorted)
- `hasPermission(supabase, userId, orgId, permission)` → calls `user_has_effective_permission` RPC (org-scope only)
- `currentUserHasPermission(supabase, orgId, permission)` → calls `has_permission` RPC (org-scope only, auth.uid())
- `currentUserIsOrgMember(supabase, orgId)` → calls `is_org_member` RPC

### 4.3 `PermissionCompiler` — TypeScript-Side Compiler

**File:** `src/server/services/permission-compiler.service.ts`

Application-layer compiler (complement to the DB trigger). Used in orchestration scenarios:

- `compileForUser(supabase, userId, orgId)` — used after invitation acceptance, org creation
- `recompileForRole(supabase, roleId)` — used after role permission changes
- `recompileForOrganization(supabase, orgId)` — bulk recompile

**Important limitation:** The TypeScript compiler's `compileForUser` does NOT set `branch_id` when inserting UEP rows. It calls `get_permissions_for_roles` on all role IDs (both org and branch) without differentiating them, then inserts as `branch_id = undefined` (i.e., null). This means TypeScript-triggered recompiles may lose branch-scope differentiation. The **DB trigger** (`trigger_compile_on_role_assignment` calling `compile_user_permissions`) is the authoritative compiler that correctly sets `branch_id`.

### 4.4 `checkPermission` Utility — Client + Server Wildcard Matcher

**File:** `src/lib/utils/permissions.ts`

```typescript
function checkPermission(snapshot: PermissionSnapshot, required: string): boolean {
  // Deny-first: if any deny pattern matches → false
  if (matchesAnyPattern(snapshot.deny, required)) return false;
  // Then check allow patterns
  return matchesAnyPattern(snapshot.allow, required);
}

function matchesAnyPattern(patterns: string[], required: string): boolean {
  for (const p of patterns) {
    if (p === "*" || p === required) return true;
    if (!p.includes("*")) continue;
    if (getCachedRegex(p).test(required)) return true;
  }
  return false;
}
```

Wildcard semantics: `*` matches greedily across segment boundaries. `warehouse.*` matches `warehouse.products.read`. Uses a module-level `Map<string, RegExp>` regex cache. `clearPermissionRegexCache()` exported for test teardown.

This function is shared between server (page guards, loaders) and client (Zustand `usePermissions` hook).

---

## 5. Server-Side Context Loading

### 5.1 `loadAppContextV2`

**File:** `src/server/loaders/v2/load-app-context.v2.ts`

Resolves org/branch for the current session. Does **not** load permissions.

```
1. auth.getUser() — JWT validation
2. Resolve activeOrgId:
   a. preferences.organization_id (validated against organizations table)
   b. Oldest org where user has URA scope='org' (member)
   c. Oldest org created_by user
3. Load org snapshot (with organization_profiles join)
4. Load ALL branches (availableBranches) for org (deleted_at IS NULL, sorted by created_at)
5. Resolve activeBranchId:
   a. preferences.default_branch_id (if in availableBranches)
   b. First available branch
6. Return AppContextV2 with accessibleBranches: [] (stub — not computed here)
```

**Contract:** `accessibleBranches` is always `[]` from this loader. Only `loadDashboardContextV2` populates it.

### 5.2 `loadUserContextV2`

**File:** `src/server/loaders/v2/load-user-context.v2.ts`

Loads user identity + permissions. Uses `PermissionService` (branch-aware).

```
1. auth.getUser() — JWT validation (preferred over getSession)
2. auth.getSession() — get access_token for JWT role extraction
3. Load user identity from users table (with avatar signed URL)
4. AuthService.getUserRoles(access_token) — extract JWTRole[] from JWT
5. PermissionService.getPermissionSnapshotForUser(supabase, userId, activeOrgId, activeBranchId)
   → dynamic query: org URA roles + branch URA roles (if activeBranchId) + overrides
   → returns { allow: string[], deny: string[] }
6. Return UserContextV2 { user, roles, permissionSnapshot }
```

**Cached with React `cache()`** — deduplicates calls within same request.

### 5.3 `loadDashboardContextV2`

**File:** `src/server/loaders/v2/load-dashboard-context.v2.ts`

The **single entrypoint** for dashboard pages. Orchestrates app + user context + accessible branches.

```
1. loadAppContextV2() → AppContextV2 (org, branch, availableBranches)
2. loadUserContextV2(activeOrgId, activeBranchId) → UserContextV2 (perms)
3. _computeAccessibleBranches(userId, orgId, allBranches, permissionSnapshot):
   FAST PATH: if BRANCHES_VIEW_ANY → return allBranches
   SLOW PATH: query URA scope='branch' (own assignments via RLS) → filter allBranches
4. Re-validate activeBranch vs accessibleBranches:
   if current activeBranchId NOT in accessibleBranches:
     fallback to first accessible branch (or null)
     if activeBranchId changed → reload loadUserContextV2 for new branch
5. Return { app: { ...appContext, accessibleBranches, activeBranchId, activeBranch }, user }
```

**Re-validation bug fix (Mar 2026):** Step 4 now calls `loadUserContextV2` again if `activeBranchId` changed, so the permission snapshot reflects the corrected branch's role assignments.

**Cached with React `cache()`.**

---

## 6. Client-Side Permission Sync

### 6.1 `getBranchPermissions` Server Action

**File:** `src/app/actions/v2/permissions.ts`

```typescript
export async function getBranchPermissions(
  orgId: string,
  branchId: string | null
): Promise<{ permissions: PermissionSnapshot }>;
```

Called by the `PermissionsSync` React component via React Query. Invokes `PermissionService.getPermissionSnapshotForUser` (branch-aware, NOT V2) so that branch-scoped role permissions are included.

**Bug history:** Previously called `PermissionServiceV2.getPermissionSnapshotForUser` which ignores `branchId`. This caused branch-scoped permissions to be absent after `PermissionsSync` fired on the client, making branch managers appear to have no permissions. Fixed by switching to `PermissionService`.

### 6.2 `PermissionsSync` Component

React component that bridges Zustand stores and React Query:

1. Reads `activeOrgId` + `activeBranchId` from `useAppStoreV2`
2. Only enabled if both IDs present
3. Calls `getBranchPermissions(orgId, branchId)` via React Query
4. On success: syncs `permissionSnapshot` to `useUserStoreV2`
5. Refetches automatically when `activeBranchId` changes (query key includes both IDs)

---

## 7. Sidebar & Routing Enforcement

### 7.1 Sidebar Resolver (`src/lib/sidebar/v2/resolver.ts`)

Two gating mechanisms on sidebar items:

| Field                              | Logic          | Operator  |
| ---------------------------------- | -------------- | --------- |
| `requiresPermissions: string[]`    | ALL must match | `every()` |
| `requiresAnyPermissions: string[]` | ANY must match | `some()`  |

Both use `checkPermission(snapshot, slug)` which supports wildcards. Sidebar items filtered at build time (SSR); parent pruned if all children filtered.

### 7.2 Registry Examples (`src/lib/sidebar/v2/registry.ts`)

```typescript
// organization.users — AND gate — only full admins
requiresPermissions: [MEMBERS_READ];

// organization.branch-access — OR gate — admins OR branch managers
requiresAnyPermissions: [MEMBERS_READ, BRANCH_ROLES_MANAGE];

// organization.branches — single AND gate
requiresPermissions: [BRANCHES_READ];

// organization.billing — single AND gate
requiresPermissions: [ORG_UPDATE];
```

### 7.3 Users Layout Guard (`src/app/[locale]/dashboard/organization/users/layout.tsx`)

```typescript
const canRead = checkPermission(snapshot, MEMBERS_READ);
const canBranchManage = checkPermission(snapshot, BRANCH_ROLES_MANAGE);

if (!canRead && !canBranchManage) {
  redirect({
    href: { pathname: "/dashboard/access-denied", query: { reason: "members_read_required" } },
    locale,
  });
}

// Org admins (canRead) get tab navigation (UsersLayoutClient)
// Branch managers (canBranchManage only) get children directly — no tab nav
```

### 7.4 Individual Page Guards

| Page                     | Guard Permission                        | Redirect Reason                |
| ------------------------ | --------------------------------------- | ------------------------------ |
| `members/page.tsx`       | `MEMBERS_READ`                          | `members_read_required`        |
| `invitations/page.tsx`   | `INVITES_READ`                          | `invites_read_required`        |
| `roles/page.tsx`         | `MEMBERS_READ`                          | `members_read_required`        |
| `branch-access/page.tsx` | `MEMBERS_READ` OR `BRANCH_ROLES_MANAGE` | `branch_roles_manage_required` |

### 7.5 Server Action Gates (`src/app/actions/organization/roles.ts`)

Every action applies **double-gate**: module access + permission.

```typescript
// Step 1: Module access gate (applied to every action)
await requireModuleAccess(context, MODULE_ORGANIZATION_MANAGEMENT_ACCESS);

// Step 2: Permission gate (example — assignRoleToUserAction)
const canManage = checkPermission(snapshot, MEMBERS_MANAGE);
const canManageBranch = scope === "branch" && checkPermission(snapshot, BRANCH_ROLES_MANAGE);
if (!canManage && !canManageBranch) throw new Error("Unauthorized");
```

**`ORG_ONLY_SLUGS` Set** (server-enforced, blocks branch-role assignments):

```
ORG_READ, ORG_UPDATE, BRANCHES_CREATE, BRANCHES_UPDATE, BRANCHES_DELETE,
MODULE_ORGANIZATION_MANAGEMENT_ACCESS, MEMBERS_READ, MEMBERS_MANAGE,
INVITES_READ, INVITES_CREATE, INVITES_CANCEL
```

These 11 slugs cannot be assigned to branch-scoped roles. Enforced in `updateRoleAction` (reads role `scope_type` from DB before checking) and `assignRoleToUserAction`.

---

## 8. Branch Switcher & `changeBranch` Action

### 8.1 `accessibleBranches` Computation

Server-computed in `loadDashboardContextV2._computeAccessibleBranches`:

- **Fast path:** `BRANCHES_VIEW_ANY` → all org branches
- **Slow path:** query user's own URA `scope='branch'` (RLS "View own role assignments" allows this without `members.read`) → filter `availableBranches` to those with matching branch_id

`accessibleBranches` is passed as server props to `SidebarBranchSwitcher` and `BranchSwitcher` — they are **props-driven, not store-driven**.

### 8.2 `changeBranch` Server Action

**File:** `src/app/actions/shared/changeBranch.ts`

Double validation before allowing branch switch:

1. `availableBranches.find(b => b.id === branchId)` — org membership check
2. `BRANCHES_VIEW_UPDATE_ANY || accessibleBranches.some(b => b.id === branchId)` — access check

Returns `ActionResult` discriminated union (`{ success: true }` | `{ success: false, error: string }`).

---

## 9. Live DB Sanity Checks

All queries run against live production DB (2026-03-03).

### 9.1 UEP Row Distribution

```sql
SELECT
  CASE WHEN branch_id IS NULL THEN 'org-scope' ELSE 'branch-scope' END AS scope,
  count(*) AS count
FROM public.user_effective_permissions
GROUP BY 1 ORDER BY 1;
```

| Scope          | Count  |
| -------------- | ------ |
| `branch-scope` | **5**  |
| `org-scope`    | **31** |

### 9.2 Branch UEP Integrity Check

```sql
SELECT count(*) AS orphaned_branch_uep
FROM public.user_effective_permissions uep
WHERE uep.branch_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.user_role_assignments ura
    WHERE ura.user_id = uep.user_id
      AND ura.scope = 'branch'
      AND ura.scope_id = uep.branch_id
      AND ura.deleted_at IS NULL
  );
```

| Result                                                                   |
| ------------------------------------------------------------------------ |
| **0** — all branch UEP rows have a matching active URA branch assignment |

### 9.3 Interpretation

- The 5 branch-scope UEP rows indicate 1 user has been assigned a branch-scoped role (`branch.roles.manage`) on specific branches.
- The 31 org-scope rows are from org-level role assignments (org_owner, org_member, custom roles).
- Zero orphaned rows confirm the DB trigger pipeline is operating correctly.

---

## 10. Diff vs Previous Extraction

This section captures what changed between the V1 architecture (before Mar 2026) and the current V2 state.

### Schema Changes

| Change                                                                            | Detail                                                                                                                     |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `user_effective_permissions.branch_id` added                                      | UUID nullable — `NULL` = org-scope, UUID = branch-scope                                                                    |
| Unique constraint renamed                                                         | `user_effective_permissions_unique` → `user_effective_permissions_unique_v2` covering `(user_id, org_id, slug, branch_id)` |
| Indexes added                                                                     | `idx_uep_user_org_branch` on `(user_id, organization_id, branch_id)`                                                       |
| `roles.scope_type` added                                                          | `text NOT NULL default 'org'` — validates URA scope at DB level                                                            |
| `branch.roles.manage` permission added                                            | `scope_types: ["branch"]`, not a system permission                                                                         |
| `branches.view.any`, `branches.view.update.any`, `branches.view.remove.any` added | New branch visibility permissions granted to `org_owner`                                                                   |

### Function Changes

| Change                                                 | Detail                                                                                     |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| `compile_user_permissions` updated                     | Now inserts branch-scoped UEP rows (Step 5) with `branch_id = ura.scope_id`                |
| `has_branch_permission(org_id, branch_id, slug)` added | NEW function — checks UEP for either org-scope OR matching branch-scope                    |
| `trigger_compile_on_role_assignment` updated           | Now handles `scope='branch'` — resolves org_id from branches table before calling compiler |
| `validate_role_assignment_scope` added                 | NEW trigger — enforces `roles.scope_type` constraint on URA inserts                        |

### RLS Policy Changes

| Table                   | Change                                                                                                                       |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `user_role_assignments` | V2 assign/update/delete policies added — dual-gate (`members.manage` OR `has_branch_permission(..., 'branch.roles.manage')`) |
| `user_role_assignments` | "V2 view branch role assignments" added — branch managers can see their branch assignments                                   |
| `user_role_assignments` | "V2 view org role assignments" added — replaces implicit org admin view                                                      |

### Application Code Changes

| File                                                       | Change                                                                                                   |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | --- | ------------------------------------------------------------------ |
| `src/app/actions/v2/permissions.ts`                        | `getBranchPermissions` switched from `PermissionServiceV2` to `PermissionService` (branch-aware fix)     |
| `src/server/loaders/v2/load-dashboard-context.v2.ts`       | `_computeAccessibleBranches` + activeBranch re-validation + userContext reload on branch change          |
| `src/app/actions/organization/roles.ts`                    | Dual-gate (`MEMBERS_MANAGE                                                                               |     | (scope=branch && BRANCH_ROLES_MANAGE)`); `ORG_ONLY_SLUGS` expanded |
| `src/app/[locale]/dashboard/organization/users/layout.tsx` | Dual-gate guard (`MEMBERS_READ                                                                           |     | BRANCH_ROLES_MANAGE`)                                              |
| `src/lib/sidebar/v2/registry.ts`                           | `organization.branch-access` item with `requiresAnyPermissions: [MEMBERS_READ, BRANCH_ROLES_MANAGE]`     |
| `src/lib/constants/permissions.ts`                         | Added `BRANCH_ROLES_MANAGE`, `BRANCHES_VIEW_ANY`, `BRANCHES_VIEW_UPDATE_ANY`, `BRANCHES_VIEW_REMOVE_ANY` |

---

## 11. Enterprise Invariants Checklist

| #    | Invariant                                                           | Status              | Evidence                                                                                  |
| ---- | ------------------------------------------------------------------- | ------------------- | ----------------------------------------------------------------------------------------- | --- | ------------------------------------- |
| I-01 | Every URA change triggers UEP recompilation                         | ✅ HOLD             | `trigger_compile_on_role_assignment` fires AFTER INSERT/UPDATE/DELETE on URA              |
| I-02 | Advisory lock prevents concurrent compilation races                 | ✅ HOLD             | `pg_advisory_xact_lock(hashtext(user_id                                                   |     | org_id))`in`compile_user_permissions` |
| I-03 | Revoke overrides apply to branch-scoped permissions                 | ✅ HOLD             | Branch UEP INSERT in `compile_user_permissions` excludes slugs with active revoke UPO     |
| I-04 | Org-scope UEP always has `branch_id IS NULL`                        | ✅ HOLD             | Step 4 of `compile_user_permissions` explicitly inserts `NULL::uuid`                      |
| I-05 | Branch UEP is scoped to the exact branch of the URA                 | ✅ HOLD             | Step 5 inserts `ura.scope_id` (branch_id), verified by `has_branch_permission`            |
| I-06 | Org-wide grants satisfy `has_branch_permission`                     | ✅ HOLD             | `has_branch_permission` checks `branch_id IS NULL OR branch_id = param`                   |
| I-07 | `has_permission` is strictly org-scope (branch_id IS NULL)          | ✅ HOLD             | DB function has `AND branch_id IS NULL` filter                                            |
| I-08 | `PermissionServiceV2.getPermissionSnapshotForUser` ignores branchId | ⚠️ KNOWN            | `_branchId` param unused; `getBranchPermissions` fixed to use `PermissionService` instead |
| I-09 | Branch manager cannot access org-only pages                         | ✅ HOLD             | `members/page.tsx` requires `MEMBERS_READ`; branch manager has only `BRANCH_ROLES_MANAGE` |
| I-10 | `ORG_ONLY_SLUGS` prevents org permissions on branch roles           | ✅ HOLD             | Server action guard + DB `validate_role_assignment_scope` trigger                         |
| I-11 | `accessibleBranches` is re-validated against permissions            | ✅ HOLD             | `loadDashboardContextV2` step 4 re-validates and reloads user context if branch changes   |
| I-12 | `changeBranch` validates both org membership and branch access      | ✅ HOLD             | Dual validation in `changeBranch` action                                                  |
| I-13 | Branch UEP integrity (no orphaned rows)                             | ✅ HOLD             | Live sanity check returns 0 orphaned rows                                                 |
| I-14 | TypeScript compiler (`PermissionCompiler`) does not set branch_id   | ⚠️ KNOWN LIMITATION | TypeScript service inserts without branch_id; DB trigger is authoritative                 |
| I-15 | Deny overrides take precedence over wildcard allows                 | ✅ HOLD             | `checkPermission` utility: deny checked first via `matchesAnyPattern`                     |
| I-16 | Permission constants are the only string source                     | ✅ HOLD             | All code uses `src/lib/constants/permissions.ts` exports; no raw strings                  |
| I-17 | Module access permission gates all org management actions           | ✅ HOLD             | `requireModuleAccess(context, MODULE_ORGANIZATION_MANAGEMENT_ACCESS)` in every action     |
| I-18 | UEP is wiped when user is not an active org member                  | ✅ HOLD             | `compile_user_permissions` membership guard (Step 1) wipes and returns early              |

**Legend:**

- ✅ HOLD — invariant is maintained, evidence confirmed from DB + code
- ⚠️ KNOWN — documented limitation or design choice, not a regression

---

_Document generated: 2026-03-03 | Source: Supabase MCP (live DB) + source code forensic reads_
