# Permissions Architecture Extraction (Complete)

## Context

This document is a **pure technical extraction** of the current permissions/RBAC system. It captures the exact current state from real code files and live database queries. No redesign. No improvements. No assumptions.

**Architecture Philosophy:** "Compile, don't evaluate" — Permissions are compiled at write-time into explicit facts stored in `user_effective_permissions`. RLS policies and runtime checks do simple existence checks against these pre-compiled facts. No wildcards, no role evaluation, no complex logic at request time.

---

# 1. TABLES

## 1.1 `permissions`

**Purpose:** Dictionary of all available permission actions in the system.

| Column           | Type          | Default             | Constraints | Notes                                                   |
| ---------------- | ------------- | ------------------- | ----------- | ------------------------------------------------------- |
| `id`             | UUID PK       | `gen_random_uuid()` |             |                                                         |
| `slug`           | TEXT NOT NULL |                     | UNIQUE      | Permission identifier (e.g., "warehouse.products.read") |
| `label`          | TEXT          |                     |             | Human-readable label                                    |
| `name`           | TEXT          |                     |             | Display name                                            |
| `description`    | TEXT          |                     |             | What this permission grants                             |
| `category`       | TEXT NOT NULL |                     |             | Grouping category (e.g., "warehouse", "members")        |
| `subcategory`    | TEXT          |                     |             | Optional sub-grouping                                   |
| `resource_type`  | TEXT          |                     |             | Type of resource (e.g., "product", "branch")            |
| `action`         | TEXT NOT NULL |                     |             | Action type (read, create, update, delete, manage, \*)  |
| `scope_types`    | TEXT[]        |                     |             | Valid assignment scopes (org, branch, global)           |
| `dependencies`   | UUID[]        |                     |             | Permission IDs that must also be granted                |
| `conflicts_with` | UUID[]        |                     |             | Permission IDs that conflict                            |
| `is_system`      | BOOLEAN       | `false`             |             | System permission (cannot be deleted)                   |
| `is_dangerous`   | BOOLEAN       | `false`             |             | Requires extra confirmation                             |
| `requires_mfa`   | BOOLEAN       | `false`             |             | Requires MFA to use                                     |
| `priority`       | INTEGER       | `0`                 |             | Sort/display priority                                   |
| `metadata`       | JSONB         | `'{}'::jsonb`       |             | Additional metadata                                     |
| `created_at`     | TIMESTAMPTZ   | `NOW()`             |             |                                                         |
| `updated_at`     | TIMESTAMPTZ   | `NOW()`             |             |                                                         |
| `deleted_at`     | TIMESTAMPTZ   |                     |             | Soft delete                                             |

**RLS:** Enabled

- `permissions_select_authenticated`: SELECT for `authenticated` WHERE `deleted_at IS NULL`

**Live Count:** 20 permission slugs (as of Feb 2026)

---

## 1.2 `roles`

**Purpose:** Role definitions (system roles + custom org roles).

| Column            | Type                                             | Default             | Constraints                    | Notes                                       |
| ----------------- | ------------------------------------------------ | ------------------- | ------------------------------ | ------------------------------------------- |
| `id`              | UUID PK                                          | `gen_random_uuid()` |                                |                                             |
| `organization_id` | UUID FK → `organizations(id)` ON DELETE SET NULL |                     |                                | NULL = system role, UUID = custom org role  |
| `name`            | TEXT NOT NULL                                    |                     |                                | Role name (e.g., "org_owner", "org_member") |
| `is_basic`        | BOOLEAN NOT NULL                                 | `false`             |                                | System-provided role                        |
| `description`     | TEXT                                             |                     |                                | Role description                            |
| `scope_type`      | TEXT NOT NULL                                    | `'org'`             | CHECK: `org`, `branch`, `both` | Where this role can be assigned             |
| `deleted_at`      | TIMESTAMPTZ                                      |                     |                                | Soft delete                                 |

**RLS:** Enabled

- `roles_select_system`: SELECT for `authenticated` WHERE `is_basic = true AND organization_id IS NULL AND deleted_at IS NULL` (system roles visible to all)
- `roles_select_org`: SELECT for `authenticated` WHERE `organization_id IS NOT NULL AND is_org_member(organization_id) AND deleted_at IS NULL` (org roles visible to members)
- `roles_insert_permission`: INSERT for `authenticated` WHERE `organization_id IS NOT NULL AND is_org_member(organization_id) AND has_permission(organization_id, 'members.manage') AND deleted_at IS NULL`
- `roles_update_permission`: UPDATE for `authenticated` WHERE `organization_id IS NOT NULL AND is_basic = false AND is_org_member(organization_id) AND has_permission(organization_id, 'members.manage') AND deleted_at IS NULL` (can only update custom roles)
- `roles_delete_permission`: DELETE for `authenticated` WHERE `organization_id IS NOT NULL AND is_basic = false AND is_org_member(organization_id) AND has_permission(organization_id, 'members.manage') AND deleted_at IS NULL`

**System Roles (Live):**

- `org_owner` — "Organization owner with full access", scope_type: `org`, is_basic: `true`
- `org_member` — "Regular organization member with limited access", scope_type: `org`, is_basic: `true`

---

## 1.3 `role_permissions`

**Purpose:** Maps roles to permissions (with allow/deny semantics).

| Column          | Type                                                    | Default             | Constraints | Notes                      |
| --------------- | ------------------------------------------------------- | ------------------- | ----------- | -------------------------- |
| `id`            | UUID PK                                                 | `gen_random_uuid()` |             |                            |
| `role_id`       | UUID NOT NULL FK → `roles(id)` ON DELETE RESTRICT       |                     |             |                            |
| `permission_id` | UUID NOT NULL FK → `permissions(id)` ON DELETE RESTRICT |                     |             |                            |
| `allowed`       | BOOLEAN NOT NULL                                        | `true`              |             | True = grant, false = deny |
| `deleted_at`    | TIMESTAMPTZ                                             |                     |             | Soft delete                |

**Constraints:**

- UNIQUE on `(role_id, permission_id)`

**RLS:** Enabled

- `role_permissions_select_system`: SELECT for `authenticated` WHERE role is basic system role
- `role_permissions_select_org`: SELECT for `authenticated` WHERE role belongs to org AND is_org_member
- `role_permissions_insert_permission`: INSERT for `authenticated` WHERE role is custom org role AND has `members.manage` permission
- `role_permissions_update_permission`: UPDATE for `authenticated` WHERE role is custom org role AND has `members.manage` permission
- `role_permissions_delete_permission`: DELETE for `authenticated` WHERE role is custom org role AND has `members.manage` permission

**Triggers:**

- `trigger_role_permission_compile` AFTER INSERT/UPDATE/DELETE → `trigger_compile_on_role_permission()` — recompiles permissions for all users with that role

---

## 1.4 `user_role_assignments`

**Purpose:** Assigns roles to users with scope (org or branch).

| Column       | Type                                                   | Default             | Constraints            | Notes                                  |
| ------------ | ------------------------------------------------------ | ------------------- | ---------------------- | -------------------------------------- |
| `id`         | UUID PK                                                | `gen_random_uuid()` |                        |                                        |
| `user_id`    | UUID NOT NULL FK → `auth.users(id)` ON DELETE RESTRICT |                     |                        |                                        |
| `role_id`    | UUID NOT NULL FK → `roles(id)` ON DELETE RESTRICT      |                     |                        |                                        |
| `scope`      | TEXT NOT NULL                                          |                     | CHECK: `org`, `branch` | Assignment scope                       |
| `scope_id`   | UUID NOT NULL                                          |                     |                        | org_id or branch_id depending on scope |
| `deleted_at` | TIMESTAMPTZ                                            |                     |                        | Soft delete                            |

**Constraints:**

- UNIQUE on `(user_id, role_id, scope, scope_id)`

**RLS:** Enabled

- `View own role assignments`: SELECT for `authenticated` WHERE `user_id = auth.uid()`
- `Org admins view org role assignments`: SELECT for `authenticated` WHERE scope = 'org' AND (is_org_creator(scope_id) OR has_org_role(scope_id, 'org_owner'))
- `Org owners and creators can assign roles`: INSERT for `authenticated` with scope/owner checks
- `Org owners and creators can update role assignments`: UPDATE for `authenticated` with scope/owner checks
- `Org owners and creators can delete role assignments`: DELETE for `authenticated` with scope/owner checks

**Triggers:**

- `check_role_assignment_scope` BEFORE INSERT/UPDATE → `validate_role_assignment_scope()` — ensures role's scope_type matches assignment scope
- `trigger_role_assignment_compile` AFTER INSERT/UPDATE/DELETE → `trigger_compile_on_role_assignment()` — recompiles permissions for that user+org

---

## 1.5 `user_permission_overrides`

**Purpose:** Per-user permission overrides (grant/revoke specific permissions).

| Column            | Type                                                    | Default             | Constraints                      | Notes                                      |
| ----------------- | ------------------------------------------------------- | ------------------- | -------------------------------- | ------------------------------------------ |
| `id`              | UUID PK                                                 | `gen_random_uuid()` |                                  |                                            |
| `user_id`         | UUID NOT NULL FK → `auth.users(id)` ON DELETE RESTRICT  |                     |                                  |                                            |
| `permission_id`   | UUID NOT NULL FK → `permissions(id)` ON DELETE RESTRICT |                     |                                  |                                            |
| `allowed`         | BOOLEAN NOT NULL                                        | `true`              |                                  | True = grant, false = deny (V1 legacy)     |
| `effect`          | TEXT NOT NULL                                           | `'grant'`           | CHECK: `grant`, `revoke`         | V2: explicit effect                        |
| `permission_slug` | TEXT                                                    |                     |                                  | V2: direct slug reference (no join needed) |
| `scope`           | TEXT NOT NULL                                           |                     | CHECK: `org`, `branch`, `global` | Override scope                             |
| `scope_id`        | UUID                                                    |                     |                                  | org_id or branch_id (NULL for global)      |
| `organization_id` | UUID FK → `organizations(id)` ON DELETE CASCADE         |                     |                                  | Denormalized org ID for simpler queries    |
| `created_at`      | TIMESTAMPTZ NOT NULL                                    | `NOW()`             |                                  | Used for precedence (newest wins)          |
| `updated_at`      | TIMESTAMPTZ NOT NULL                                    | `NOW()`             |                                  | Auto-updated via trigger                   |
| `deleted_at`      | TIMESTAMPTZ                                             |                     |                                  | Soft delete                                |

**Constraints:**

- UNIQUE partial index on `(user_id, scope, scope_id, permission_id)` WHERE `deleted_at IS NULL`
- CHECK: `(scope = 'global' AND scope_id IS NULL) OR (scope <> 'global' AND scope_id IS NOT NULL)`

**Indexes:**

- `idx_user_permission_overrides_created_at` ON `created_at DESC`
- `user_permission_overrides_unique_active` partial UNIQUE index WHERE `deleted_at IS NULL`

**RLS:** Enabled

- `overrides_select_self`: SELECT for `authenticated` WHERE `user_id = auth.uid() AND deleted_at IS NULL`
- `overrides_select_admin`: SELECT for `authenticated` WHERE `organization_id IS NOT NULL AND is_org_member(organization_id) AND has_permission(organization_id, 'members.manage') AND deleted_at IS NULL`
- `overrides_insert_permission`: INSERT for `authenticated` WHERE has `members.manage` permission
- `overrides_update_permission`: UPDATE for `authenticated` WHERE has `members.manage` permission
- `overrides_delete_permission`: DELETE for `authenticated` WHERE has `members.manage` permission

**Triggers:**

- `trigger_validate_permission_slug` BEFORE INSERT/UPDATE → `validate_permission_slug_on_override()` — validates permission_slug exists
- `trigger_user_permission_overrides_updated_at` BEFORE UPDATE → `update_user_permission_overrides_updated_at()` — auto-update updated_at
- `trigger_override_compile` AFTER INSERT/UPDATE/DELETE → `trigger_compile_on_override()` — recompiles permissions for that user+org

---

## 1.6 `user_effective_permissions`

**Purpose:** **THE KEY TABLE** — Compiled permission facts. "User X can do Y in Org Z".

This is the single source of truth for permission checks at runtime. No wildcards, no roles, no logic — just explicit facts.

| Column            | Type                                                     | Default             | Constraints | Notes                                                 |
| ----------------- | -------------------------------------------------------- | ------------------- | ----------- | ----------------------------------------------------- |
| `id`              | UUID PK                                                  | `gen_random_uuid()` |             |                                                       |
| `user_id`         | UUID NOT NULL FK → `auth.users(id)` ON DELETE CASCADE    |                     |             |                                                       |
| `organization_id` | UUID NOT NULL FK → `organizations(id)` ON DELETE CASCADE |                     |             |                                                       |
| `permission_slug` | TEXT NOT NULL                                            |                     |             | Explicit permission (e.g., "warehouse.products.read") |
| `source_type`     | TEXT NOT NULL                                            | `'role'`            |             | Metadata: 'role' or 'override'                        |
| `source_id`       | UUID                                                     |                     |             | role_id or override_id that granted this              |
| `created_at`      | TIMESTAMPTZ NOT NULL                                     | `NOW()`             |             |                                                       |
| `compiled_at`     | TIMESTAMPTZ NOT NULL                                     | `NOW()`             |             | When compiler last ran                                |

**Constraints:**

- UNIQUE on `(user_id, organization_id, permission_slug)` — one permission per user per org

**Indexes:**

- `idx_uep_user_org` ON `(user_id, organization_id)`
- `idx_uep_permission` ON `(permission_slug)`
- `idx_uep_user_org_permission` ON `(user_id, organization_id, permission_slug)`

**RLS:** Enabled

- `Users can view own effective permissions`: SELECT for `public` WHERE `user_id = auth.uid()`
- `Org owners can view member permissions`: SELECT for `authenticated` WHERE `has_org_role(organization_id, 'org_owner')`

**Note:** No INSERT/UPDATE/DELETE policies for regular users — writes happen via SECURITY DEFINER functions only.

---

## 1.7 `organization_members`

**Purpose:** Organization membership table (triggers permission compilation).

| Column            | Type          | Default             | Notes                       |
| ----------------- | ------------- | ------------------- | --------------------------- |
| `id`              | UUID PK       | `gen_random_uuid()` |                             |
| `organization_id` | UUID NOT NULL |                     |                             |
| `user_id`         | UUID NOT NULL |                     |                             |
| `status`          | TEXT NOT NULL | `'active'`          | active, inactive, suspended |
| `joined_at`       | TIMESTAMPTZ   | `NOW()`             |                             |
| `created_at`      | TIMESTAMPTZ   | `NOW()`             |                             |
| `updated_at`      | TIMESTAMPTZ   | `NOW()`             |                             |
| `deleted_at`      | TIMESTAMPTZ   |                     | Soft delete                 |

**Triggers:**

- `trigger_membership_compile` AFTER INSERT/UPDATE/DELETE → `trigger_compile_on_membership()` — compiles/removes permissions when membership changes

---

# 2. MIGRATIONS

All migrations in chronological order:

| #   | File                                                        | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `20250712131800_create_permissions_table.sql`               | Creates `permissions` table (slug, label, deleted_at)                                                                                                                                                                                                                                                                                                                                                                                                             |
| 2   | `20250712135819_create_roles_table.sql`                     | Creates `roles` table (organization_id, name, is_basic, deleted_at)                                                                                                                                                                                                                                                                                                                                                                                               |
| 3   | `20250712140256_create_role_permissions_table.sql`          | Creates `role_permissions` table with FK constraints, UNIQUE(role_id, permission_id)                                                                                                                                                                                                                                                                                                                                                                              |
| 4   | `20250712140316_create_user_role_assignments_table.sql`     | Creates `user_role_assignments` table with scope/scope_id pattern, UNIQUE constraint                                                                                                                                                                                                                                                                                                                                                                              |
| 5   | `20250712140332_create_user_permission_overrides_table.sql` | Creates `user_permission_overrides` table with scope/scope_id pattern                                                                                                                                                                                                                                                                                                                                                                                             |
| 6   | `20250528230218_auth_admin_permissions.sql`                 | Grants `supabase_auth_admin` access to user_roles and roles tables + SELECT policies                                                                                                                                                                                                                                                                                                                                                                              |
| 7   | `20250804092727_add_role_management_rls_policies.sql`       | Adds comprehensive RLS policies for roles, user_role_assignments, user_permission_overrides                                                                                                                                                                                                                                                                                                                                                                       |
| 8   | `20250819140000_add_invitations_role_foreign_key.sql`       | Adds FK `invitations.role_id → roles.id`, creates index                                                                                                                                                                                                                                                                                                                                                                                                           |
| 9   | `20260107145249_fix_rbac_scope_support.sql`                 | Adds `scope_type` column to roles, creates `validate_role_assignment_scope()` trigger, improves `get_permissions_for_roles` RPC                                                                                                                                                                                                                                                                                                                                   |
| 10  | `20260109110139_add_missing_fk_permission_overrides.sql`    | Adds missing FK `user_permission_overrides.permission_id → permissions(id)`                                                                                                                                                                                                                                                                                                                                                                                       |
| 11  | `20260109170527_add_created_at_to_permission_overrides.sql` | Adds `created_at`, `updated_at` to `user_permission_overrides` for deterministic precedence, creates `update_user_permission_overrides_updated_at()` trigger                                                                                                                                                                                                                                                                                                      |
| 12  | `20260110141056_add_permission_override_constraints.sql`    | Adds partial UNIQUE index for active overrides, adds CHECK constraint for global scope NULL scope_id                                                                                                                                                                                                                                                                                                                                                              |
| 13  | `20260119134623_add_wildcard_permissions.sql`               | Inserts wildcard permissions (`warehouse.*`, `teams.*`, `admin.*`, `system.*`), maps them to `org_owner` role                                                                                                                                                                                                                                                                                                                                                     |
| 14  | `20260120113444_permission_system_v2_foundation.sql`        | **MAJOR V2 MIGRATION** — Creates `user_effective_permissions` table, seeds V1 permissions, creates compiler functions (`compile_user_permissions`, `compile_org_permissions`, `compile_all_user_permissions`), creates helper functions (`user_has_effective_permission`, `current_user_has_permission`, `current_user_is_org_member`), creates triggers for auto-compilation, adds `effect` and `permission_slug` columns to overrides, runs initial compilation |
| 15  | `20260122000000_enterprise_permission_hardening.sql`        | **ENTERPRISE HARDENING** — Adds active membership guard to `compile_user_permissions`, fixes ON CONFLICT to update `source_type`, adds `trigger_compile_on_membership` to handle org/user ID changes, adds advisory locks                                                                                                                                                                                                                                         |

**All migrations use idempotent patterns** — safe to re-run. Migration 14 is the most significant: it introduced the "compile, don't evaluate" architecture.

---

# 3. TRIGGERS & FUNCTIONS

## 3.1 Compilation Triggers (Live from Database)

| Trigger Name                      | Table                       | Event                                    | Function                               | Purpose                                                                                  |
| --------------------------------- | --------------------------- | ---------------------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------- |
| `trigger_role_assignment_compile` | `user_role_assignments`     | AFTER INSERT/UPDATE/DELETE, FOR EACH ROW | `trigger_compile_on_role_assignment()` | Recompiles when user's roles change                                                      |
| `trigger_override_compile`        | `user_permission_overrides` | AFTER INSERT/UPDATE/DELETE, FOR EACH ROW | `trigger_compile_on_override()`        | Recompiles when user's overrides change                                                  |
| `trigger_role_permission_compile` | `role_permissions`          | AFTER INSERT/UPDATE/DELETE, FOR EACH ROW | `trigger_compile_on_role_permission()` | Recompiles all users with that role when role's permissions change                       |
| `trigger_membership_compile`      | `organization_members`      | AFTER INSERT/UPDATE/DELETE, FOR EACH ROW | `trigger_compile_on_membership()`      | Compiles/removes permissions when membership status changes, handles org/user ID changes |

**Compilation chain:** Any write to roles/assignments/overrides/membership → trigger function → `compile_user_permissions(user_id, org_id)` → UPSERT into `user_effective_permissions`.

## 3.2 Validation Triggers

| Trigger Name                                   | Table                       | Event                              | Function                                        |
| ---------------------------------------------- | --------------------------- | ---------------------------------- | ----------------------------------------------- |
| `check_role_assignment_scope`                  | `user_role_assignments`     | BEFORE INSERT/UPDATE, FOR EACH ROW | `validate_role_assignment_scope()`              |
| `trigger_validate_permission_slug`             | `user_permission_overrides` | BEFORE INSERT/UPDATE, FOR EACH ROW | `validate_permission_slug_on_override()`        |
| `trigger_user_permission_overrides_updated_at` | `user_permission_overrides` | BEFORE UPDATE, FOR EACH ROW        | `update_user_permission_overrides_updated_at()` |

## 3.3 Core Compiler Functions (Live from Database)

All functions are `SECURITY DEFINER` with `SET search_path TO ''` (hardened against search_path attacks).

### `compile_user_permissions(p_user_id UUID, p_organization_id UUID) → void`

**The core compiler function.** Compiles all effective permissions for a user in an organization.

**Algorithm:**

1. **Active membership guard** — Checks if user is an active member of the org. If not, deletes any existing permissions and exits.
2. **Advisory lock** — `pg_advisory_xact_lock(hashtext(user_id || org_id))` to prevent concurrent compilation races.
3. **Delete existing permissions** — Removes all current `user_effective_permissions` rows for this user+org.
4. **Build permission set** — Set-based query (no loops):
   - Gets all permissions from assigned roles (org + branch scoped)
   - Adds granted overrides
   - Removes revoked overrides (via NOT EXISTS clause)
5. **Insert compiled permissions** — Inserts new rows into `user_effective_permissions`
6. **ON CONFLICT** — Updates `compiled_at` and `source_type` (prevents stale metadata)

**Source:** Migration 20260122 (enterprise hardening)

### `compile_org_permissions(p_organization_id UUID) → void`

Compiles permissions for all active members of an organization. Loops over `organization_members` WHERE `status = 'active' AND deleted_at IS NULL`, calls `compile_user_permissions` for each.

### `compile_all_user_permissions(p_user_id UUID) → void`

Compiles permissions for a user across all organizations they're a member of. Loops over orgs, calls `compile_user_permissions` for each.

### `user_has_effective_permission(p_user_id UUID, p_organization_id UUID, p_permission_slug TEXT) → boolean`

Checks if a permission exists in `user_effective_permissions` for the given user+org+slug. Simple EXISTS query.

**SQL:** `SECURITY DEFINER` SQL function

### `has_permission(org_id UUID, permission TEXT) → boolean`

**Canonical permission check function** used by RLS policies. Checks if `auth.uid()` has the permission in the org. Uses `user_effective_permissions` table.

**SQL:** `SECURITY DEFINER` SQL function

### `is_org_member(org_id UUID) → boolean`

**Canonical org membership check** used by RLS policies. Checks if `auth.uid()` is an active member of the org.

**SQL:** `SECURITY DEFINER` SQL function

```sql
SELECT EXISTS (
  SELECT 1 FROM organization_members
  WHERE user_id = auth.uid()
  AND organization_id = org_id
  AND status = 'active'
  AND deleted_at IS NULL
);
```

## 3.4 Trigger Functions

### `trigger_compile_on_role_assignment() → trigger`

**Handles:** INSERT/UPDATE/DELETE on `user_role_assignments`

- ON DELETE: Recompiles for OLD.user_id, OLD.scope_id (if scope = 'org')
- ON INSERT/UPDATE: Recompiles for NEW.user_id, NEW.scope_id (if scope = 'org')

### `trigger_compile_on_override() → trigger`

**Handles:** INSERT/UPDATE/DELETE on `user_permission_overrides`

- ON DELETE: Recompiles for OLD.user_id, OLD.organization_id
- ON INSERT/UPDATE: Recompiles for NEW.user_id, NEW.organization_id

### `trigger_compile_on_role_permission() → trigger`

**Handles:** INSERT/UPDATE/DELETE on `role_permissions`

- Gets affected role_id
- Finds all users with that role (via `user_role_assignments`)
- Recompiles for each user+org pair

### `trigger_compile_on_membership() → trigger`

**Handles:** INSERT/UPDATE/DELETE on `organization_members`

**Enterprise hardening (handles edge cases):**

- **ON INSERT:** If active, compiles permissions
- **ON UPDATE:**
  - If org_id or user_id changed: Deletes OLD permissions, compiles NEW
  - If status changed to inactive/deleted: Deletes all permissions
  - If status changed to active: Compiles permissions
- **ON DELETE:** Deletes all permissions

**Source:** Migration 20260122 (enterprise hardening)

### `validate_role_assignment_scope() → trigger`

**Handles:** BEFORE INSERT/UPDATE on `user_role_assignments`

Validates that the assignment scope matches the role's `scope_type`:

- role.scope_type = 'org' → assignment.scope must be 'org'
- role.scope_type = 'branch' → assignment.scope must be 'branch'
- role.scope_type = 'both' → allows either scope

## 3.5 Legacy RPC

### `get_permissions_for_roles(role_ids UUID[]) → SETOF text`

Returns DISTINCT permission slugs for given role IDs. Used by V1 `PermissionService`.

**SQL:** `SECURITY DEFINER` plpgsql function

```sql
SELECT DISTINCT p.slug
FROM role_permissions rp
JOIN permissions p ON rp.permission_id = p.id
WHERE rp.role_id = ANY(role_ids)
AND rp.allowed = true
AND rp.deleted_at IS NULL
AND p.deleted_at IS NULL
ORDER BY p.slug;
```

**Source:** Migration 20260107

---

# 4. RLS POLICIES (All Tables, Live from Database)

All permission tables use RLS (some with FORCE). Pattern: Users can read their own data or if they have `members.manage` permission.

| Table                        | Policy                                                | Command | Role            | Condition                                                                                                                                                          |
| ---------------------------- | ----------------------------------------------------- | ------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `permissions`                | `permissions_select_authenticated`                    | SELECT  | `authenticated` | `deleted_at IS NULL`                                                                                                                                               |
| `roles`                      | `roles_select_system`                                 | SELECT  | `authenticated` | `is_basic = true AND organization_id IS NULL AND deleted_at IS NULL`                                                                                               |
| `roles`                      | `roles_select_org`                                    | SELECT  | `authenticated` | `organization_id IS NOT NULL AND is_org_member(organization_id) AND deleted_at IS NULL`                                                                            |
| `roles`                      | `roles_insert_permission`                             | INSERT  | `authenticated` | `organization_id IS NOT NULL AND is_org_member(organization_id) AND has_permission(organization_id, 'members.manage') AND deleted_at IS NULL`                      |
| `roles`                      | `roles_update_permission`                             | UPDATE  | `authenticated` | `organization_id IS NOT NULL AND is_basic = false AND is_org_member(organization_id) AND has_permission(organization_id, 'members.manage') AND deleted_at IS NULL` |
| `roles`                      | `roles_delete_permission`                             | DELETE  | `authenticated` | `organization_id IS NOT NULL AND is_basic = false AND is_org_member(organization_id) AND has_permission(organization_id, 'members.manage') AND deleted_at IS NULL` |
| `role_permissions`           | `role_permissions_select_system`                      | SELECT  | `authenticated` | Role is basic system role                                                                                                                                          |
| `role_permissions`           | `role_permissions_select_org`                         | SELECT  | `authenticated` | Role belongs to org AND is_org_member                                                                                                                              |
| `role_permissions`           | `role_permissions_insert_permission`                  | INSERT  | `authenticated` | Role is custom AND has `members.manage`                                                                                                                            |
| `role_permissions`           | `role_permissions_update_permission`                  | UPDATE  | `authenticated` | Role is custom AND has `members.manage`                                                                                                                            |
| `role_permissions`           | `role_permissions_delete_permission`                  | DELETE  | `authenticated` | Role is custom AND has `members.manage`                                                                                                                            |
| `user_role_assignments`      | `View own role assignments`                           | SELECT  | `authenticated` | `user_id = auth.uid()`                                                                                                                                             |
| `user_role_assignments`      | `Org admins view org role assignments`                | SELECT  | `authenticated` | `scope = 'org' AND (is_org_creator(scope_id) OR has_org_role(scope_id, 'org_owner'))`                                                                              |
| `user_role_assignments`      | `Org owners and creators can assign roles`            | INSERT  | `authenticated` | Scope/owner checks                                                                                                                                                 |
| `user_role_assignments`      | `Org owners and creators can update role assignments` | UPDATE  | `authenticated` | Scope/owner checks                                                                                                                                                 |
| `user_role_assignments`      | `Org owners and creators can delete role assignments` | DELETE  | `authenticated` | Scope/owner checks                                                                                                                                                 |
| `user_permission_overrides`  | `overrides_select_self`                               | SELECT  | `authenticated` | `user_id = auth.uid() AND deleted_at IS NULL`                                                                                                                      |
| `user_permission_overrides`  | `overrides_select_admin`                              | SELECT  | `authenticated` | `organization_id IS NOT NULL AND is_org_member(organization_id) AND has_permission(organization_id, 'members.manage') AND deleted_at IS NULL`                      |
| `user_permission_overrides`  | `overrides_insert_permission`                         | INSERT  | `authenticated` | Has `members.manage` permission                                                                                                                                    |
| `user_permission_overrides`  | `overrides_update_permission`                         | UPDATE  | `authenticated` | Has `members.manage` permission                                                                                                                                    |
| `user_permission_overrides`  | `overrides_delete_permission`                         | DELETE  | `authenticated` | Has `members.manage` permission                                                                                                                                    |
| `user_effective_permissions` | `Users can view own effective permissions`            | SELECT  | `public`        | `user_id = auth.uid()`                                                                                                                                             |
| `user_effective_permissions` | `Org owners can view member permissions`              | SELECT  | `authenticated` | `has_org_role(organization_id, 'org_owner')`                                                                                                                       |

**Security model:**

- `has_permission()` and `is_org_member()` are `SECURITY DEFINER` with `search_path = ''`
- No INSERT/UPDATE/DELETE policies on `user_effective_permissions` for regular users
- Writes to `user_effective_permissions` go through SECURITY DEFINER compiler functions only
- `members.manage` permission gates most role/permission management operations

---

# 5. SERVER-SIDE SERVICES

## 5.1 PermissionServiceV2 (Primary — V2 Architecture)

**File:** `src/server/services/permission-v2.service.ts`

**Architecture:** "Compile, don't evaluate" — Reads from `user_effective_permissions` table. No runtime logic.

**Methods:**

| Method                         | Signature                                                   | Description                                                                 |
| ------------------------------ | ----------------------------------------------------------- | --------------------------------------------------------------------------- |
| `getEffectivePermissions`      | `(supabase, userId, orgId) → Set<string>`                   | Reads `user_effective_permissions`, returns Set                             |
| `getEffectivePermissionsArray` | `(supabase, userId, orgId) → string[]`                      | Same as above, returns sorted array                                         |
| `getPermissionSnapshotForUser` | `(supabase, userId, orgId, branchId?) → PermissionSnapshot` | Returns `{allow: permissions, deny: []}` (V2: deny handled at compile time) |
| `hasPermission`                | `(supabase, userId, orgId, permission) → boolean`           | Calls `user_has_effective_permission` RPC                                   |
| `currentUserHasPermission`     | `(supabase, orgId, permission) → boolean`                   | Calls `has_permission` RPC (uses auth.uid() internally)                     |
| `currentUserIsOrgMember`       | `(supabase, orgId) → boolean`                               | Calls `is_org_member` RPC                                                   |
| `can`                          | `(permissions: Set, permission) → boolean`                  | Static check — simple Set membership                                        |
| `canFromSnapshot`              | `(snapshot, permission) → boolean`                          | Static check — simple array includes                                        |

**No wildcards at runtime!** All permissions are explicit slugs. The table only contains concrete permission strings.

## 5.2 PermissionService (Legacy — V1 Architecture)

**File:** `src/server/services/permission.service.ts`

**Architecture:** Evaluates permissions at runtime — fetches roles, builds permission set, applies overrides with precedence.

**Methods:**

| Method                         | Signature                                                   | Description                                                                                                                                                                                                                                                      |
| ------------------------------ | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getPermissionSnapshotForUser` | `(supabase, userId, orgId, branchId?) → PermissionSnapshot` | **COMPLEX** — Queries `user_role_assignments` (org + branch), calls `get_permissions_for_roles` RPC, queries `user_permission_overrides` with join to permissions, applies scope precedence (branch > org > global), returns `{allow: string[], deny: string[]}` |
| `can`                          | `(snapshot, requiredPermission) → boolean`                  | Delegates to shared `checkPermission()` utility (wildcard matching, deny-first)                                                                                                                                                                                  |
| `getPermissionsForUser`        | `(supabase, userId, orgId, branchId?) → string[]`           | **DEPRECATED** — Returns allow array (UNSAFE with wildcards)                                                                                                                                                                                                     |

**Wildcard support:** Uses regex-based wildcard matching via `src/lib/utils/permissions.ts`.

**Scope precedence:** branch > org > global; for same scope+slug, newest `created_at` wins.

**Used by:** V1 code paths, module index sidebar filtering.

## 5.3 PermissionCompiler (Service Layer)

**File:** `src/server/services/permission-compiler.service.ts`

**Purpose:** TypeScript wrapper around database compiler functions for programmatic use.

**Methods:**

| Method                     | Signature                   | Returns           | Description                                                                          |
| -------------------------- | --------------------------- | ----------------- | ------------------------------------------------------------------------------------ |
| `compileForUser`           | `(supabase, userId, orgId)` | `CompileResult`   | Compiles permissions for user in org. Returns `{success, permissionCount, error?}`   |
| `recompileForRole`         | `(supabase, roleId)`        | `RecompileResult` | Recompiles for all users with that role. Returns `{success, usersUpdated, errors?}`  |
| `recompileForOrganization` | `(supabase, orgId)`         | `RecompileResult` | Recompiles for all active members of org. Returns `{success, usersUpdated, errors?}` |

**When to call:**

- After user creates organization (assign org_owner → compile)
- After invitation is accepted (assign org_member → compile)
- After role assignment changes (triggers handle this automatically)
- After bulk permission changes (manual call via admin UI)

**Note:** Triggers handle most cases automatically. This service is for programmatic/admin use.

---

# 6. CLIENT-SIDE HOOKS & UTILITIES

## 6.1 `usePermissions()` Hook (V2)

**File:** `src/hooks/v2/use-permissions.ts`

**Architecture:** Reads from V2 user store `permissionSnapshot` (hydrated from server).

**Methods:**

| Method                  | Description                                     |
| ----------------------- | ----------------------------------------------- |
| `can(permission)`       | Returns `checkPermission(snapshot, permission)` |
| `cannot(permission)`    | Returns `!can(permission)`                      |
| `canAny(permissions[])` | Returns true if user has ANY of the permissions |
| `canAll(permissions[])` | Returns true if user has ALL of the permissions |
| `getSnapshot()`         | Returns current `PermissionSnapshot`            |

**Example:**

```tsx
const { can, cannot, canAny } = usePermissions();

if (cannot("members.manage")) {
  return <AccessDenied />;
}

{
  can("warehouse.products.delete") && <DeleteButton />;
}
{
  canAny(["branches.create", "branches.delete"]) && <BranchActions />;
}
```

## 6.2 Wildcard Matching Utility

**File:** `src/lib/utils/permissions.ts`

**Exports:**

- `checkPermission(snapshot, requiredPermission) → boolean` — Deny-first, wildcard-aware
- `matchesAnyPattern(patterns[], required) → boolean` — Regex-based wildcard matching
- `clearPermissionRegexCache()` — For testing only

**Wildcard semantics:**

- `*` matches any characters including dots (greedy)
- `warehouse.*` matches `warehouse.products.read`, `warehouse.inventory.view`, etc.
- `warehouse.products.*` matches `warehouse.products.read`, `warehouse.products.create`, etc.
- Exact match: `warehouse.products.read` only matches that exact string

**Performance:** Uses regex cache (`Map<string, RegExp>`) to avoid repeated compilation.

**Deny-first logic:**

1. If any deny pattern matches → `false`
2. If any allow pattern matches → `true`
3. Otherwise → `false`

---

# 7. CONSTANTS & ENUMS

## 7.1 Permission Slugs (Live from Database — 20 total)

### Account Permissions (System)

- `account.*` — Full access to own account settings (wildcard)
- `account.preferences.read` — View own preferences
- `account.preferences.update` — Update own preferences
- `account.profile.read` — View own profile information
- `account.profile.update` — Update own profile information
- `account.settings.read` — View own account settings
- `account.settings.update` — Update own account settings

### Organization Permissions

- `org.read` — View organization information
- `org.update` — Update organization settings

### Branch Permissions

- `branches.read` — View branches
- `branches.create` — Create new branches
- `branches.update` — Update branch information
- `branches.delete` — Delete branches

### Member Permissions

- `members.read` — View member list
- `members.manage` — Invite, remove, and manage member roles

### Invitation Permissions

- `invites.read` — View pending invitations
- `invites.create` — Send invitations
- `invites.cancel` — Cancel pending invitations

### Self Permissions

- `self.read` — View own profile
- `self.update` — Update own profile

## 7.2 System Roles (Live from Database)

### `org_owner`

- **Description:** "Organization owner with full access"
- **scope_type:** `org`
- **is_basic:** `true`
- **Permissions (20 total):**
  - `account.*`
  - `org.read`, `org.update`
  - `branches.read`, `branches.create`, `branches.update`, `branches.delete`
  - `members.read`, `members.manage`
  - `invites.read`, `invites.create`, `invites.cancel`
  - `self.read`, `self.update`

### `org_member`

- **Description:** "Regular organization member with limited access"
- **scope_type:** `org`
- **is_basic:** `true`
- **Permissions (6 total):**
  - `account.*`
  - `org.read`
  - `branches.read`
  - `members.read`
  - `self.read`, `self.update`

## 7.3 PermissionSnapshot Type

```typescript
export type PermissionSnapshot = {
  allow: string[]; // Permissions explicitly allowed (can include wildcards)
  deny: string[]; // Permissions explicitly denied (takes precedence)
};
```

**V1 usage:** Both allow and deny can contain wildcards. Deny-first semantics.

**V2 usage:** Allow contains explicit permission slugs (no wildcards). Deny is always empty (deny logic applied at compile time).

---

# 8. LIVE DATA SAMPLES

## 8.1 Compiled Effective Permissions (User Example)

User `2c5067ea-9655-42a4-a78f-b1fe2d3bb281` in org `4aab690b-45c9-4150-96c2-cabe6a6d8633` (has `org_owner` role):

```json
[
  {
    "permission_slug": "account.*",
    "source_type": "role",
    "compiled_at": "2026-02-03T07:00:09.615407+00:00"
  },
  {
    "permission_slug": "branches.create",
    "source_type": "role",
    "compiled_at": "2026-02-03T07:00:09.615407+00:00"
  },
  {
    "permission_slug": "branches.delete",
    "source_type": "role",
    "compiled_at": "2026-02-03T07:00:09.615407+00:00"
  },
  {
    "permission_slug": "branches.read",
    "source_type": "role",
    "compiled_at": "2026-02-03T07:00:09.615407+00:00"
  },
  {
    "permission_slug": "branches.update",
    "source_type": "role",
    "compiled_at": "2026-02-03T07:00:09.615407+00:00"
  },
  {
    "permission_slug": "invites.cancel",
    "source_type": "role",
    "compiled_at": "2026-02-03T07:00:09.615407+00:00"
  },
  {
    "permission_slug": "invites.create",
    "source_type": "role",
    "compiled_at": "2026-02-03T07:00:09.615407+00:00"
  },
  {
    "permission_slug": "invites.read",
    "source_type": "role",
    "compiled_at": "2026-02-03T07:00:09.615407+00:00"
  },
  {
    "permission_slug": "members.manage",
    "source_type": "role",
    "compiled_at": "2026-02-03T07:00:09.615407+00:00"
  },
  {
    "permission_slug": "members.read",
    "source_type": "role",
    "compiled_at": "2026-02-03T07:00:09.615407+00:00"
  },
  {
    "permission_slug": "org.read",
    "source_type": "role",
    "compiled_at": "2026-02-03T07:00:09.615407+00:00"
  },
  {
    "permission_slug": "org.update",
    "source_type": "role",
    "compiled_at": "2026-02-03T07:00:09.615407+00:00"
  },
  {
    "permission_slug": "self.read",
    "source_type": "role",
    "compiled_at": "2026-02-03T07:00:09.615407+00:00"
  },
  {
    "permission_slug": "self.update",
    "source_type": "role",
    "compiled_at": "2026-02-03T07:00:09.615407+00:00"
  }
]
```

User `55b7b00d-23d4-46fa-a258-e0928da0c5c5` in same org (has `org_member` role):

```json
[
  {
    "permission_slug": "account.*",
    "source_type": "role",
    "compiled_at": "2026-02-03T07:00:09.615407+00:00"
  },
  {
    "permission_slug": "branches.read",
    "source_type": "role",
    "compiled_at": "2026-02-03T07:00:09.615407+00:00"
  },
  {
    "permission_slug": "members.read",
    "source_type": "role",
    "compiled_at": "2026-02-03T07:00:09.615407+00:00"
  },
  {
    "permission_slug": "org.read",
    "source_type": "role",
    "compiled_at": "2026-02-03T07:00:09.615407+00:00"
  },
  {
    "permission_slug": "self.read",
    "source_type": "role",
    "compiled_at": "2026-02-03T07:00:09.615407+00:00"
  },
  {
    "permission_slug": "self.update",
    "source_type": "role",
    "compiled_at": "2026-02-03T07:00:09.615407+00:00"
  }
]
```

## 8.2 Role → Permission Mappings (Live)

**org_owner (20 permissions):**

```
account.*, branches.create, branches.delete, branches.read, branches.update,
invites.cancel, invites.create, invites.read,
members.manage, members.read,
org.read, org.update,
self.read, self.update
```

**org_member (6 permissions):**

```
account.*, branches.read, members.read, org.read, self.read, self.update
```

---

# 9. DATA FLOW DIAGRAM

```
                    ┌─────────────────────────────────────────────────────┐
                    │           WRITE-TIME COMPILATION (V2)                 │
                    │                                                     │
  permissions ──────┤ (dictionary of available actions)                  │
                    │                                                     │
  roles + ──────────┤                                                     │
  role_permissions  │   TRIGGERS FIRE ON:                                │
       │            │   - user_role_assignments (INSERT/UPDATE/DELETE)    │
       │            │   - role_permissions (INSERT/UPDATE/DELETE)         │
       ▼            │   - user_permission_overrides (INSERT/UPDATE/DELETE)│
  user_role_    ────┤   - organization_members (INSERT/UPDATE/DELETE)    │
  assignments       │                                                     │
       │            │              ▼                                      │
       │            │   trigger_compile_on_*()                           │
       ▼            │              │                                      │
  user_permission_──┤              ▼                                      │
  overrides         │   compile_user_permissions(user_id, org_id)        │
       │            │   ┌─────────────────────────────┐                 │
       │            │   │ 1. Active membership guard   │                 │
       │            │   │ 2. Advisory lock             │                 │
       │            │   │ 3. Delete existing perms     │                 │
       │            │   │ 4. Build permission set:     │                 │
       │            │   │    - Get from roles          │                 │
       │            │   │    - Add grant overrides     │                 │
       │            │   │    - Remove revoke overrides │                 │
       │            │   │ 5. Insert new perms          │                 │
       │            │   └─────────────────────────────┘                 │
       ▼            │              │                                      │
                    │              ▼                                      │
                    │   user_effective_permissions                       │
                    │   (COMPILED FACTS TABLE)                           │
                    │   - No wildcards                                   │
                    │   - Explicit slugs only                            │
                    │   - source_type metadata                           │
                    └─────────────────────────────────────────────────────┘

                    ┌─────────────────────────────────────────────────────┐
                    │            READ-TIME (SSR + CLIENT)                  │
                    │                                                     │
SERVER:             │  PermissionServiceV2.getEffectivePermissions()     │
                    │         │                                           │
                    │         ▼                                           │
                    │  SELECT permission_slug                             │
                    │  FROM user_effective_permissions                    │
                    │  WHERE user_id = ? AND organization_id = ?          │
                    │         │                                           │
                    │         ▼                                           │
                    │  Returns: Set<string>                               │
                    │  Example: {"account.*", "branches.read", ...}       │
                    │         │                                           │
                    │         ▼                                           │
                    │  PermissionSnapshot: {allow: [...], deny: []}       │
                    │         │                                           │
                    │         ▼                                           │
CLIENT:             │  useUserStoreV2.permissionSnapshot                  │
                    │         │                                           │
                    │         ▼                                           │
                    │  usePermissions() hook                              │
                    │   - can(permission)                                 │
                    │   - cannot(permission)                              │
                    │   - canAny([...])                                   │
                    │   - canAll([...])                                   │
                    │         │                                           │
                    │         ▼                                           │
                    │  checkPermission(snapshot, required)                │
                    │   1. Deny-first check (with wildcard matching)      │
                    │   2. Allow check (with wildcard matching)           │
                    │         │                                           │
                    │         ▼                                           │
RLS:                │  has_permission(org_id, permission)                 │
                    │   SELECT EXISTS (                                   │
                    │     FROM user_effective_permissions                 │
                    │     WHERE user_id = auth.uid()                      │
                    │     AND organization_id = org_id                    │
                    │     AND permission_slug = permission                │
                    │   )                                                 │
                    └─────────────────────────────────────────────────────┘
```

---

# 10. NOTES & RISKS

## 10.1 V1 vs V2 Coexistence

The system has TWO permission architectures running in parallel:

**V1 (Legacy — Runtime Evaluation):**

- `PermissionService` — Queries roles at runtime, applies overrides with precedence
- Supports wildcards in both `allow` and `deny` lists
- Deny-first semantics with regex wildcard matching
- Used by: Legacy code, module index sidebar filtering
- Tables: `permissions`, `roles`, `role_permissions`, `user_role_assignments`, `user_permission_overrides`

**V2 (Current — Compile Don't Evaluate):**

- `PermissionServiceV2` — Reads from `user_effective_permissions` (pre-compiled facts)
- No wildcards at runtime (all permissions are explicit slugs)
- Deny logic applied at compile time (deny array always empty in V2 snapshots)
- Used by: V2 hooks, new code
- Tables: All V1 tables + `user_effective_permissions`

**Migration path:** V1 tables still exist and are used by the compiler. New code should use V2 services. V1 code gradually migrates to V2.

## 10.2 Wildcard Permissions

**Status:** Partially implemented. Database contains wildcard permissions (`warehouse.*`, `teams.*`, `admin.*`, `system.*`, `account.*`) but:

**In compiled permissions:**

- `account.*` appears in live compiled data (from org_owner and org_member roles)
- Warehouse/teams/admin wildcards exist in `permissions` table but are NOT mapped to any roles in `role_permissions` (migration 13 only added them for `org_owner` but live DB shows they're not assigned)

**Runtime handling:**

- V1: Wildcard matching via regex (supports both allow and deny wildcards)
- V2: Wildcards should be expanded at compile time, but `account.*` is stored as-is in `user_effective_permissions`

**Risk:** Inconsistency between intended V2 architecture (no wildcards in compiled table) and actual data (contains `account.*`). The `checkPermission` utility handles this at runtime, but it defeats the purpose of compilation.

## 10.3 Scope Support

**Supported scopes:** `org`, `branch`, `global` (for overrides)

**Current usage:**

- Roles: Only `org` scope roles exist in live DB (`org_owner`, `org_member`)
- Assignments: Can assign roles at `org` or `branch` scope
- Overrides: Can create at `global`, `org`, or `branch` scope
- Compilation: Only compiles for `org` scope (branch-scoped assignments are included if they belong to the org)

**Branch scope limitations:**

- No branch-scoped roles in the database
- `compile_user_permissions` includes branch role assignments but the resulting permissions are org-wide (stored with organization_id, not branch_id)
- `user_effective_permissions` table has no branch_id column — all permissions are org-scoped

**Risk:** The scope system is built but not fully utilized. Branch permissions are flattened to org level during compilation.

## 10.4 Permission Slug Mismatch

**Issue:** Some code references permission slugs that don't exist in the database.

**Example from module configs:** `organization.profile.update`, `branch.manage`, `user.manage`, `user.role.read`, `invitation.read`

**Actual DB slugs:** `org.update`, `branches.*`, `members.manage`, `invites.read`

**Impact:** Module sidebar filtering may not work correctly if it checks for non-existent slugs.

## 10.5 Security Considerations

**Strengths:**

- All SECURITY DEFINER functions use `SET search_path TO ''` (hardened)
- All table references fully qualified (`public.*`)
- Compiler uses advisory locks to prevent race conditions
- RLS policies enforce `members.manage` permission for role/permission management
- Active membership guard prevents compiling for inactive users
- Enterprise hardening handles edge cases (org/user ID changes)

**Risks:**

- Wildcard permissions in compiled table bypass the "no wildcards at runtime" design
- Legacy `getPermissionsForUser()` method marked UNSAFE — returns string[] instead of snapshot (cannot handle deny wildcards correctly)
- V1/V2 coexistence could lead to divergent behavior if not carefully managed

## 10.6 Performance Considerations

**Optimizations:**

- Compilation uses set-based logic (no loops in V2)
- Regex cache prevents repeated pattern compilation
- Indexes on `user_effective_permissions` for fast lookups
- `has_permission()` RPC uses simple EXISTS query

**Concerns:**

- Recompiling all users when role permissions change (`trigger_compile_on_role_permission`) — could be slow for large orgs
- No pagination in `compile_org_permissions` — loops over all active members
- Regex-based wildcard matching is slower than exact match (but cached)

## 10.7 Missing Features

1. **Branch-level permission isolation** — Compiled permissions are org-wide, not branch-scoped
2. **Permission dependencies** — `dependencies` column exists but not enforced
3. **Permission conflicts** — `conflicts_with` column exists but not checked
4. **MFA requirements** — `requires_mfa` column exists but not enforced
5. **Dangerous permission warnings** — `is_dangerous` column exists but not used in UI
6. **Bulk role assignment** — No batch API for assigning roles to multiple users
7. **Permission audit trail** — No history of permission changes over time
8. **Permission templates** — No preset permission bundles for common use cases

---

# 11. VERIFICATION

To verify this extraction:

1. **Permissions count:**

   ```sql
   SELECT COUNT(*) FROM permissions WHERE deleted_at IS NULL;
   ```

   Expected: 20

2. **System roles:**

   ```sql
   SELECT name, is_basic, scope_type FROM roles WHERE organization_id IS NULL AND deleted_at IS NULL;
   ```

   Expected: `org_owner`, `org_member`

3. **Compiler function signature:**

   ```sql
   SELECT pg_get_functiondef(oid) FROM pg_proc
   WHERE proname = 'compile_user_permissions'
   AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
   ```

   Should contain: membership guard, advisory lock, set-based query, ON CONFLICT with source_type update

4. **Triggers on user_role_assignments:**

   ```sql
   SELECT tgname FROM pg_trigger WHERE tgrelid = 'user_role_assignments'::regclass;
   ```

   Expected: `check_role_assignment_scope`, `trigger_role_assignment_compile`

5. **Sample compiled permissions:**
   ```sql
   SELECT user_id, COUNT(*) AS perm_count
   FROM user_effective_permissions
   GROUP BY user_id;
   ```
   Should show users with compiled permissions (14 for org_owner, 6 for org_member)

---

# 12. FILES REFERENCED

## 12.1 Migration Files (15 total)

1. `supabase/migrations/20250712131800_create_permissions_table.sql`
2. `supabase/migrations/20250712135819_create_roles_table.sql`
3. `supabase/migrations/20250712140256_create_role_permissions_table.sql`
4. `supabase/migrations/20250712140316_create_user_role_assignments_table.sql`
5. `supabase/migrations/20250712140332_create_user_permission_overrides_table.sql`
6. `supabase/migrations/20250528230218_auth_admin_permissions.sql`
7. `supabase/migrations/20250804092727_add_role_management_rls_policies.sql`
8. `supabase/migrations/20250819140000_add_invitations_role_foreign_key.sql`
9. `supabase/migrations/20260107145249_fix_rbac_scope_support.sql`
10. `supabase/migrations/20260109110139_add_missing_fk_permission_overrides.sql`
11. `supabase/migrations/20260109170527_add_created_at_to_permission_overrides.sql`
12. `supabase/migrations/20260110141056_add_permission_override_constraints.sql`
13. `supabase/migrations/20260119134623_add_wildcard_permissions.sql`
14. `supabase/migrations/20260120113444_permission_system_v2_foundation.sql` ⭐ MAJOR
15. `supabase/migrations/20260122000000_enterprise_permission_hardening.sql` ⭐ CRITICAL

## 12.2 TypeScript Source Files

16. `src/lib/types/permissions.ts` — `PermissionSnapshot` type
17. `src/server/services/permission-v2.service.ts` — V2 service (compile, don't evaluate)
18. `src/server/services/permission.service.ts` — V1 service (runtime evaluation)
19. `src/server/services/permission-compiler.service.ts` — Compiler wrapper for programmatic use
20. `src/hooks/v2/use-permissions.ts` — Client-side hook
21. `src/lib/utils/permissions.ts` — Wildcard matching utilities
22. `src/server/loaders/v2/load-user-context.v2.ts` — Loads permissionSnapshot (referenced in hook)
23. `src/lib/stores/v2/user-store.ts` — Stores permissionSnapshot (referenced in hook)

## 12.3 Database Queries Executed

- `information_schema.columns` — All 6 permission tables (50 columns total)
- `pg_policies` — All 23 RLS policies across 6 tables
- `pg_trigger` — All 7 triggers on permission tables
- `pg_proc` — All 12 functions (compilers, helpers, validators)
- `permissions` — 20 active permission slugs
- `roles` — 2 system roles
- `role_permissions` — 20 role→permission mappings
- `user_effective_permissions` — 20 sample compiled permission rows

---

# 13. SUMMARY

**Architecture:** "Compile, don't evaluate"

**Core principle:** Permissions are computed at write-time (when roles/assignments/overrides change) and stored as explicit facts in `user_effective_permissions`. Runtime checks are simple table lookups. No wildcards, no complex logic, no role expansion at request time.

**V2 is production, V1 is legacy:** New code should use `PermissionServiceV2` and `usePermissions()`. V1 services exist for backwards compatibility and are used by some legacy code paths.

**7 tables, 15 migrations, 12 functions, 23 RLS policies, 7 triggers, 20 permissions, 2 system roles.**

**Key tables:**

- `user_effective_permissions` — THE KEY TABLE (compiled facts)
- `user_role_assignments` — User→Role→Scope mappings
- `role_permissions` — Role→Permission mappings
- `user_permission_overrides` — Per-user grant/revoke

**Key functions:**

- `compile_user_permissions(user_id, org_id)` — The compiler
- `has_permission(org_id, permission)` — Canonical RLS check
- `is_org_member(org_id)` — Canonical membership check

**Key migrations:**

- Migration 14 (`20260120113444`) — Introduced V2 architecture, created `user_effective_permissions`, created compiler functions
- Migration 15 (`20260122000000`) — Enterprise hardening with active membership guard, advisory locks, source_type fix

**Wildcards:** Partially implemented. `account.*` exists in compiled data. V1 handles wildcards via regex. V2 design says no wildcards but current data contains them.

**Scopes:** `org`, `branch`, `global` supported but only `org` scope fully utilized. Branch permissions are flattened to org level during compilation.
