# Permission System V2 - Complete Documentation

**Last Updated**: 2026-01-27
**Version**: 6.0 (Enterprise Hardened - Final)
**Status**: Production (Enterprise Hardened)
**Verified Against**: Live database (zlcnlalwfmmtusigeuyk) on 2026-01-27

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [The Core Principle](#the-core-principle)
3. [System Architecture](#system-architecture)
4. [Database Schema](#database-schema)
5. [Database Functions](#database-functions)
6. [Database Triggers](#database-triggers)
7. [RLS Policies](#rls-policies)
8. [Security Hardening](#security-hardening)
9. [Design Decisions & Known Limitations](#design-decisions--known-limitations)
10. [Performance Optimizations](#performance-optimizations)
11. [Observability](#observability)
12. [TypeScript Services](#typescript-services)
13. [React Hooks & Server Actions](#react-hooks--server-actions)
14. [Permission Flow Examples](#permission-flow-examples)
15. [Current Permissions & Roles](#current-permissions--roles)
16. [Adding New Permissions](#adding-new-permissions)
17. [Debugging & Troubleshooting](#debugging--troubleshooting)
18. [Enterprise Checklist](#enterprise-checklist)
19. [Migration History](#migration-history)

---

## Executive Summary

The Permission System V2 uses a **"Compile, Don't Evaluate"** architecture with **enterprise-grade security hardening**:

```
+------------------------------------------------------------------+
|                    WRITE-TIME (Compilation)                       |
|                                                                   |
|  When roles/assignments change -> Compiler runs automatically     |
|  Roles + Permissions -> Compiled into explicit facts              |
|  Result stored in: user_effective_permissions                     |
|                                                                   |
|  ENTERPRISE FEATURES:                                             |
|  - Advisory locks (prevents race conditions)                      |
|  - Active membership guard (idempotent safety)                    |
|  - Set-based queries (no loops, high performance)                 |
|  - source_type tracking (accurate metadata)                       |
+------------------------------------------------------------------+
                              |
                              v
+------------------------------------------------------------------+
|                    READ-TIME (Enforcement)                        |
|                                                                   |
|  RLS Policy: "Does row exist in user_effective_permissions?"      |
|  No wildcards. No deny logic. No complex evaluation.              |
|  Just a simple EXISTS check.                                      |
|                                                                   |
|  ENTERPRISE FEATURES:                                             |
|  - Two-layer RLS: is_org_member() + has_permission()              |
|  - FORCE ROW LEVEL SECURITY on 6 critical tables                  |
|  - deleted_at IS NULL on ALL policies (soft-delete safety)        |
|  - LOWER() email normalization (invitations)                      |
|  - Creator binding on self-registration (escalation prevention)   |
+------------------------------------------------------------------+
```

### Key Characteristics

| Aspect                | Implementation                                                                     |
| --------------------- | ---------------------------------------------------------------------------------- |
| **Pattern**           | Compile at write-time, lookup at read-time                                         |
| **Runtime Logic**     | Simple EXISTS check (no wildcards, no deny-first)                                  |
| **Wildcard Handling** | Expanded at compile-time into explicit slugs                                       |
| **Deny Handling**     | Applied at compile-time (deny array always empty at runtime)                       |
| **RLS Approach**      | Two-layer: tenant boundary (`is_org_member`) + permission check (`has_permission`) |
| **Auto-Compilation**  | Database triggers on role/permission/membership/override changes                   |
| **Security**          | Enterprise-hardened (FORCE RLS, creator binding, privilege lockdown)               |
| **Verified Policies** | 34 RLS policies across 9 tables (verified 2026-01-27)                              |

---

## The Core Principle

> **"A user can do X in org Y only if there is an explicit row in `user_effective_permissions` that says so."**

No magic. No guessing. No wildcards at runtime. Everything else exists only to produce those rows.

---

## System Architecture

### Complete Data Flow

```
+-----------------------------------------------------------------------------+
|                           CONFIGURATION LAYER                               |
+-----------------------------------------------------------------------------+
|                                                                             |
|   +-------------+     +------------------+     +-------------------------+  |
|   | permissions |     | role_permissions |     |         roles           |  |
|   |  (13 slugs) |<----|    (junction)    |---->|  org_owner, org_member  |  |
|   +-------------+     +------------------+     +-------------------------+  |
|         |                                                |                  |
|         |                                                |                  |
|         v                                                v                  |
|   +---------------------------------------------------------------------+  |
|   |                    user_role_assignments                             |  |
|   |         (user_id, role_id, scope='org', scope_id=org_id)            |  |
|   +---------------------------------------------------------------------+  |
|                                    |                                        |
|           TRIGGERS: role_assignment, override, membership, role_permission  |
|                                    v                                        |
|   +---------------------------------------------------------------------+  |
|   |                 PERMISSION COMPILER (Enterprise Hardened)            |  |
|   |                                                                     |  |
|   |  SQL Function: compile_user_permissions(user_id, org_id)            |  |
|   |                                                                     |  |
|   |  Enterprise Features:                                               |  |
|   |  - Active membership guard (only compiles for active members)       |  |
|   |  - Advisory lock (prevents concurrent compilation races)            |  |
|   |  - Set-based logic (no loops, single INSERT statement)              |  |
|   |  - source_type tracking (updates on conflict)                       |  |
|   |  - SECURITY DEFINER with SET search_path TO ''                      |  |
|   +---------------------------------------------------------------------+  |
|                                    |                                        |
|                                    v                                        |
|   +---------------------------------------------------------------------+  |
|   |               user_effective_permissions (THE KEY TABLE)            |  |
|   |                                                                     |  |
|   |  Example data (org_owner with 13 permissions):                      |  |
|   |  +-- (user-123, org-456, 'org.read',        'role', '2026-01-27')  |  |
|   |  +-- (user-123, org-456, 'org.update',      'role', '2026-01-27')  |  |
|   |  +-- (user-123, org-456, 'branches.read',   'role', '2026-01-27')  |  |
|   |  +-- ... (13 total rows)                                            |  |
|   +---------------------------------------------------------------------+  |
|                                                                             |
+-----------------------------------------------------------------------------+

+-----------------------------------------------------------------------------+
|                           ENFORCEMENT LAYER                                 |
+-----------------------------------------------------------------------------+
|                                                                             |
|   +---------------------------------------------------------------------+  |
|   |                         RLS POLICIES                                |  |
|   |                                                                     |  |
|   |  Layer 1 - Tenant Boundary:                                         |  |
|   |  is_org_member(org_id) -> checks organization_members               |  |
|   |  SECURITY: authenticated + service_role can execute                 |  |
|   |                                                                     |  |
|   |  Layer 2 - Permission Check:                                        |  |
|   |  has_permission(org_id, 'branches.create') ->                       |  |
|   |    SELECT EXISTS FROM user_effective_permissions                    |  |
|   |    WHERE user_id = auth.uid()                                       |  |
|   |    AND organization_id = org_id                                     |  |
|   |    AND permission_slug = 'branches.create'                          |  |
|   |  SECURITY: authenticated + service_role can execute                 |  |
|   +---------------------------------------------------------------------+  |
|                                                                             |
+-----------------------------------------------------------------------------+
```

---

## Database Schema

### Core Tables

#### 1. `permissions` - Permission Dictionary

**Purpose**: Catalog of all possible permissions in the system.

| Column           | Type        | Nullable | Default             | Description                            |
| ---------------- | ----------- | -------- | ------------------- | -------------------------------------- |
| `id`             | uuid        | NO       | `gen_random_uuid()` | Primary key                            |
| `slug`           | text        | NO       | -                   | Unique permission identifier           |
| `label`          | text        | YES      | -                   | Display label                          |
| `name`           | text        | YES      | -                   | Human-readable name                    |
| `description`    | text        | YES      | -                   | Description                            |
| `category`       | text        | NO       | -                   | Category grouping                      |
| `subcategory`    | text        | YES      | -                   | Sub-category                           |
| `resource_type`  | text        | YES      | -                   | Resource this controls                 |
| `action`         | text        | NO       | -                   | Action type (read, create, etc.)       |
| `scope_types`    | text[]      | YES      | -                   | Valid scopes                           |
| `dependencies`   | uuid[]      | YES      | -                   | Required permission IDs (NOT slugs)    |
| `conflicts_with` | uuid[]      | YES      | -                   | Conflicting permission IDs (NOT slugs) |
| `is_system`      | boolean     | YES      | `false`             | System permission flag                 |
| `is_dangerous`   | boolean     | YES      | `false`             | Dangerous action flag                  |
| `requires_mfa`   | boolean     | YES      | `false`             | MFA requirement                        |
| `priority`       | integer     | YES      | `0`                 | Display priority                       |
| `metadata`       | jsonb       | YES      | `'{}'`              | Extra metadata                         |
| `created_at`     | timestamptz | YES      | `now()`             | Created timestamp                      |
| `updated_at`     | timestamptz | YES      | `now()`             | Updated timestamp                      |
| `deleted_at`     | timestamptz | YES      | -                   | Soft delete                            |

**Key Constraints**:

- `permissions_slug_key` UNIQUE (`slug`)

```sql
-- Current data (13 permissions):
-- branches.create, branches.delete, branches.read, branches.update
-- invites.cancel, invites.create, invites.read
-- members.manage, members.read
-- org.read, org.update
-- self.read, self.update
```

#### 2. `roles` - Role Definitions

**Purpose**: Named bundles of permissions.

| Column            | Type        | Nullable | Default             | Description                       |
| ----------------- | ----------- | -------- | ------------------- | --------------------------------- |
| `id`              | uuid        | NO       | `gen_random_uuid()` | Primary key                       |
| `organization_id` | uuid        | YES      | -                   | NULL = system role, UUID = custom |
| `name`            | text        | NO       | -                   | Role name                         |
| `is_basic`        | boolean     | NO       | `false`             | System role flag                  |
| `description`     | text        | YES      | -                   | Description                       |
| `scope_type`      | text        | NO       | `'org'`             | 'org', 'branch', or 'both'        |
| `deleted_at`      | timestamptz | YES      | -                   | Soft delete                       |

**Key Constraints**:

- `roles_invariant` CHECK: `(is_basic = true AND organization_id IS NULL) OR (is_basic = false AND organization_id IS NOT NULL)` - Single canonical constraint ensuring system roles have no org, custom roles must have an org
- `roles_scope_type_check` CHECK: `scope_type IN ('org', 'branch', 'both')`
- FK `roles_organization_id_fkey` -> `organizations(id)`

```sql
-- Current data (2 system roles):
-- org_owner  | scope_type='org' | is_basic=true | 13 permissions (ALL)
-- org_member | scope_type='org' | is_basic=true | 5 permissions (read-only)
```

#### 3. `role_permissions` - Role-Permission Mapping

**Purpose**: Links roles to their permissions.

| Column          | Type        | Nullable | Default             | Description        |
| --------------- | ----------- | -------- | ------------------- | ------------------ |
| `id`            | uuid        | NO       | `gen_random_uuid()` | Primary key        |
| `role_id`       | uuid        | NO       | -                   | FK to roles        |
| `permission_id` | uuid        | NO       | -                   | FK to permissions  |
| `allowed`       | boolean     | NO       | `true`              | Permission granted |
| `deleted_at`    | timestamptz | YES      | -                   | Soft delete        |

**Key Constraints**:

- `role_permissions_role_id_permission_id_key` UNIQUE (`role_id`, `permission_id`)
- FK `role_permissions_role_id_fkey` -> `roles(id)`
- FK `role_permissions_permission_id_fkey` -> `permissions(id)`

#### 4. `user_role_assignments` - User-Role Links

**Purpose**: Assigns roles to users with scope.

| Column       | Type        | Nullable | Default             | Description                  |
| ------------ | ----------- | -------- | ------------------- | ---------------------------- |
| `id`         | uuid        | NO       | `gen_random_uuid()` | Primary key                  |
| `user_id`    | uuid        | NO       | -                   | FK to auth.users             |
| `role_id`    | uuid        | NO       | -                   | FK to roles                  |
| `scope`      | text        | NO       | -                   | 'org' or 'branch'            |
| `scope_id`   | uuid        | NO       | -                   | organization_id or branch_id |
| `deleted_at` | timestamptz | YES      | -                   | Soft delete                  |

**Key Constraints**:

- `user_role_assignments_user_id_role_id_scope_scope_id_key` UNIQUE (`user_id`, `role_id`, `scope`, `scope_id`) - Prevents duplicate role assignments
- `user_role_assignments_scope_check` CHECK: `scope IN ('org', 'branch')`
- FK `user_role_assignments_user_id_fkey` -> `auth.users(id)`
- FK `user_role_assignments_role_id_fkey` -> `roles(id)`

#### 5. `user_effective_permissions` - THE KEY TABLE

**Purpose**: Compiled permission facts. This is what RLS checks.

| Column            | Type        | Nullable | Default             | Description           |
| ----------------- | ----------- | -------- | ------------------- | --------------------- |
| `id`              | uuid        | NO       | `gen_random_uuid()` | Primary key           |
| `user_id`         | uuid        | NO       | -                   | FK to auth.users      |
| `organization_id` | uuid        | NO       | -                   | FK to organizations   |
| `permission_slug` | text        | NO       | -                   | Compiled permission   |
| `source_type`     | text        | NO       | `'role'`            | 'role' or 'override'  |
| `source_id`       | uuid        | YES      | -                   | Role or override ID   |
| `created_at`      | timestamptz | NO       | `now()`             | Created timestamp     |
| `compiled_at`     | timestamptz | NO       | `now()`             | Last compilation time |

**Key Constraints**:

- `user_effective_permissions_unique` UNIQUE (`user_id`, `organization_id`, `permission_slug`)
- FK `user_effective_permissions_user_id_fkey` -> `auth.users(id)`
- FK `user_effective_permissions_organization_id_fkey` -> `organizations(id)`

#### 6. `organization_members` - Tenant Boundary

**Purpose**: Determines who belongs to an organization (separate from what they can do).

| Column            | Type        | Nullable | Default             | Description                     |
| ----------------- | ----------- | -------- | ------------------- | ------------------------------- |
| `id`              | uuid        | NO       | `gen_random_uuid()` | Primary key                     |
| `organization_id` | uuid        | NO       | -                   | FK to organizations             |
| `user_id`         | uuid        | NO       | -                   | FK to auth.users                |
| `status`          | text        | NO       | `'active'`          | 'active', 'pending', 'inactive' |
| `joined_at`       | timestamptz | YES      | `now()`             | Joined timestamp                |
| `created_at`      | timestamptz | YES      | `now()`             | Created timestamp               |
| `updated_at`      | timestamptz | YES      | `now()`             | Updated timestamp               |
| `deleted_at`      | timestamptz | YES      | -                   | Soft delete                     |

**Key Constraints**:

- `organization_members_organization_id_user_id_key` UNIQUE (`organization_id`, `user_id`) - Prevents duplicate membership
- `organization_members_status_check` CHECK: `status IN ('active', 'inactive', 'pending')`
- FK `organization_members_organization_id_fkey` -> `organizations(id)`
- FK `organization_members_user_id_fkey` -> `auth.users(id)`

#### 7. `user_permission_overrides` - Individual Exceptions

**Purpose**: Grant or revoke specific permissions for individual users (applied at compile time).

| Column            | Type        | Nullable | Default             | Description                          |
| ----------------- | ----------- | -------- | ------------------- | ------------------------------------ |
| `id`              | uuid        | NO       | `gen_random_uuid()` | Primary key                          |
| `user_id`         | uuid        | NO       | -                   | FK to auth.users                     |
| `permission_id`   | uuid        | NO       | -                   | FK to permissions                    |
| `allowed`         | boolean     | NO       | -                   | Legacy field                         |
| `scope`           | text        | NO       | -                   | 'global', 'org', or 'branch'         |
| `scope_id`        | uuid        | YES      | -                   | NULL for global, UUID for org/branch |
| `deleted_at`      | timestamptz | YES      | -                   | Soft delete                          |
| `created_at`      | timestamptz | NO       | `now()`             | Created timestamp                    |
| `updated_at`      | timestamptz | NO       | `now()`             | Updated timestamp                    |
| `effect`          | text        | NO       | `'grant'`           | 'grant' or 'revoke'                  |
| `permission_slug` | text        | YES      | -                   | Auto-populated by validation trigger |
| `organization_id` | uuid        | YES      | -                   | FK to organizations                  |

**Key Constraints**:

- `user_permission_overrides_effect_check` CHECK: `effect IN ('grant', 'revoke')`
- `user_permission_overrides_scope_check` CHECK: `scope IN ('global', 'org', 'branch')`
- `user_permission_overrides_scope_id_required` CHECK: `(scope = 'global' AND scope_id IS NULL) OR (scope IN ('org', 'branch') AND scope_id IS NOT NULL)`
- `user_permission_overrides_global_scope_id_null` CHECK: `(scope = 'global' AND scope_id IS NULL) OR (scope <> 'global' AND scope_id IS NOT NULL)` _(Note: Redundant with scope_id_required; legacy constraint)_
- FK `user_permission_overrides_user_id_fkey` -> `auth.users(id)`
- FK `user_permission_overrides_permission_id_fkey` -> `permissions(id)`
- FK `user_permission_overrides_organization_id_fkey` -> `organizations(id)`

#### 8. `organizations` - Organization Table

| Column       | Type        | Nullable | Default             | Description       |
| ------------ | ----------- | -------- | ------------------- | ----------------- |
| `id`         | uuid        | NO       | `gen_random_uuid()` | Primary key       |
| `name`       | text        | NO       | -                   | Organization name |
| `slug`       | text        | YES      | -                   | URL slug          |
| `created_by` | uuid        | YES      | -                   | FK to auth.users  |
| `created_at` | timestamptz | YES      | `now()`             | Created timestamp |
| `deleted_at` | timestamptz | YES      | -                   | Soft delete       |

**Key Constraints**:

- `organizations_slug_key` UNIQUE (`slug`)
- FK `organizations_created_by_fkey` -> `auth.users(id)`

#### 9. `invitations` - Invitation Table

| Column            | Type        | Nullable | Default             | Description         |
| ----------------- | ----------- | -------- | ------------------- | ------------------- |
| `id`              | uuid        | NO       | `gen_random_uuid()` | Primary key         |
| `email`           | text        | NO       | -                   | Invitee email       |
| `invited_by`      | uuid        | NO       | -                   | FK to auth.users    |
| `organization_id` | uuid        | YES      | -                   | FK to organizations |
| `branch_id`       | uuid        | YES      | -                   | FK to branches      |
| `team_id`         | uuid        | YES      | -                   | FK to teams         |
| `role_id`         | uuid        | YES      | -                   | FK to roles         |
| `token`           | text        | NO       | -                   | Invitation token    |
| `status`          | text        | NO       | `'pending'`         | Status              |
| `expires_at`      | timestamptz | YES      | -                   | Expiration          |
| `accepted_at`     | timestamptz | YES      | -                   | Acceptance time     |
| `created_at`      | timestamptz | YES      | `now()`             | Created timestamp   |
| `deleted_at`      | timestamptz | YES      | -                   | Soft delete         |

**Note**: The invitations table has `branch_id` and `team_id` columns, but branch/team-scoped invitation enforcement is **not implemented at the RLS level**. All invitations are currently treated as organization-level. Branch-scoped permissions would require extending the compiler to support `scope='branch'` in `user_effective_permissions`.

---

## Database Functions

### RLS Helper Functions

#### `is_org_member(org_id UUID)` - Tenant Boundary Check

**Verified from live database:**

```sql
CREATE OR REPLACE FUNCTION public.is_org_member(org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = org_id
      AND user_id = auth.uid()
      AND status = 'active'
      AND deleted_at IS NULL
  );
$$;
```

**Security**: `STABLE SECURITY DEFINER` with empty `search_path`. Callable by `authenticated` and `service_role`, NOT `anon`.

#### `has_permission(org_id UUID, permission TEXT)` - Permission Check

**Verified from live database:**

```sql
CREATE OR REPLACE FUNCTION public.has_permission(org_id uuid, permission text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_effective_permissions
    WHERE organization_id = org_id
      AND user_id = auth.uid()
      AND permission_slug = permission  -- EXACT STRING MATCH ONLY
  );
$$;
```

**Note**: Uses **exact string matching**. No wildcards. No regex. No LIKE.

### Compiler Function

#### `compile_user_permissions(user_id UUID, org_id UUID)` - Enterprise Hardened

**CRITICAL**: This function is **not callable by `authenticated` users**. It is invoked by database triggers (which run as `SECURITY DEFINER`) and is executable by `service_role` for manual recompilation.

**Verified from live database:**

```sql
CREATE OR REPLACE FUNCTION public.compile_user_permissions(
  p_user_id uuid,
  p_organization_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- ============================================================================
  -- FIX #2: Active membership guard
  -- ============================================================================
  -- Ensures we only compile for active org members
  -- Makes the function idempotent and safe even if called "too often"
  -- Enforces invariant: only active members can have compiled permissions

  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = p_user_id
      AND organization_id = p_organization_id
      AND status = 'active'
      AND deleted_at IS NULL
  ) THEN
    -- User is not an active member - ensure no permissions exist and exit
    DELETE FROM public.user_effective_permissions
    WHERE user_id = p_user_id
      AND organization_id = p_organization_id;
    RETURN;
  END IF;

  -- ============================================================================
  -- Advisory lock to prevent concurrent compilation races
  -- ============================================================================

  PERFORM pg_advisory_xact_lock(
    hashtext(p_user_id::text || p_organization_id::text)
  );

  -- ============================================================================
  -- Delete existing effective permissions for this user/org
  -- ============================================================================

  DELETE FROM public.user_effective_permissions
  WHERE user_id = p_user_id
    AND organization_id = p_organization_id;

  -- ============================================================================
  -- Insert new effective permissions using set-based logic
  -- ============================================================================
  -- 1. Get all permissions from assigned roles
  -- 2. Add granted overrides
  -- 3. Remove revoked overrides
  -- All in one query, no loops

  INSERT INTO public.user_effective_permissions (
    user_id, organization_id, permission_slug, source_type, compiled_at
  )
  SELECT DISTINCT
    p_user_id,
    p_organization_id,
    final_perms.permission_slug,
    final_perms.source_type,
    now()
  FROM (
    -- Permissions from roles (excluding any that are revoked by overrides)
    SELECT p.slug AS permission_slug, 'role' AS source_type
    FROM public.user_role_assignments ura
    JOIN public.roles r ON ura.role_id = r.id
    JOIN public.role_permissions rp ON r.id = rp.role_id AND rp.allowed = true
    JOIN public.permissions p ON rp.permission_id = p.id
    WHERE ura.user_id = p_user_id
      AND ura.scope = 'org'
      AND ura.scope_id = p_organization_id
      AND ura.deleted_at IS NULL
      AND r.deleted_at IS NULL
      AND rp.deleted_at IS NULL
      AND p.deleted_at IS NULL
      -- Exclude permissions that have a revoke override
      AND NOT EXISTS (
        SELECT 1 FROM public.user_permission_overrides upo
        WHERE upo.user_id = p_user_id
          AND upo.organization_id = p_organization_id
          AND upo.permission_slug = p.slug
          AND upo.effect = 'revoke'
          AND upo.deleted_at IS NULL
      )

    UNION

    -- Permissions from grant overrides (that aren't already from roles)
    SELECT upo.permission_slug, 'override' AS source_type
    FROM public.user_permission_overrides upo
    WHERE upo.user_id = p_user_id
      AND upo.organization_id = p_organization_id
      AND upo.effect = 'grant'
      AND upo.permission_slug IS NOT NULL
      AND upo.deleted_at IS NULL
  ) AS final_perms
  -- ============================================================================
  -- FIX #1: Update source_type on conflict
  -- ============================================================================
  -- Prevents stale source_type when permission source changes
  ON CONFLICT (user_id, organization_id, permission_slug) DO UPDATE
  SET compiled_at = now(), source_type = EXCLUDED.source_type;

END;
$$;
```

---

## Database Triggers

### All Triggers (Verified)

| Trigger                                        | Table                       | Timing | Events                 | Function                                      | Purpose                                  |
| ---------------------------------------------- | --------------------------- | ------ | ---------------------- | --------------------------------------------- | ---------------------------------------- |
| `trigger_role_assignment_compile`              | `user_role_assignments`     | AFTER  | INSERT, UPDATE, DELETE | `trigger_compile_on_role_assignment`          | Compile for affected user                |
| `trigger_override_compile`                     | `user_permission_overrides` | AFTER  | INSERT, UPDATE, DELETE | `trigger_compile_on_override`                 | Compile for affected user                |
| `trigger_role_permission_compile`              | `role_permissions`          | AFTER  | INSERT, UPDATE, DELETE | `trigger_compile_on_role_permission`          | Compile for ALL users with that role     |
| `trigger_membership_compile`                   | `organization_members`      | AFTER  | INSERT, UPDATE, DELETE | `trigger_compile_on_membership`               | Compile or delete permissions            |
| `trigger_validate_permission_slug`             | `user_permission_overrides` | BEFORE | INSERT, UPDATE         | `validate_permission_slug_on_override`        | Auto-correct permission_slug             |
| `check_role_assignment_scope`                  | `user_role_assignments`     | BEFORE | INSERT, UPDATE         | `validate_role_assignment_scope`              | Validate scope matches role's scope_type |
| `trigger_user_permission_overrides_updated_at` | `user_permission_overrides` | BEFORE | UPDATE                 | `update_user_permission_overrides_updated_at` | Auto-update updated_at                   |

### Membership Trigger (Enterprise Hardened)

**Verified from live database:**

```sql
CREATE OR REPLACE FUNCTION public.trigger_compile_on_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Handle INSERT: compile if active
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'active' AND NEW.deleted_at IS NULL THEN
      PERFORM public.compile_user_permissions(NEW.user_id, NEW.organization_id);
    END IF;
    RETURN NEW;
  END IF;

  -- Handle UPDATE
  IF TG_OP = 'UPDATE' THEN
    -- ENTERPRISE FIX: Handle org_id or user_id changes (ghost permission prevention)
    IF (OLD.organization_id <> NEW.organization_id) OR (OLD.user_id <> NEW.user_id) THEN
      DELETE FROM public.user_effective_permissions
      WHERE user_id = OLD.user_id AND organization_id = OLD.organization_id;

      IF NEW.status = 'active' AND NEW.deleted_at IS NULL THEN
        PERFORM public.compile_user_permissions(NEW.user_id, NEW.organization_id);
      END IF;
      RETURN NEW;
    END IF;

    -- Handle status changes (active <-> inactive)
    IF (OLD.status = 'active' AND NEW.status <> 'active')
       OR (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL) THEN
      DELETE FROM public.user_effective_permissions
      WHERE user_id = NEW.user_id AND organization_id = NEW.organization_id;
      RETURN NEW;
    END IF;

    IF (OLD.status <> 'active' AND NEW.status = 'active')
       OR (OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL) THEN
      PERFORM public.compile_user_permissions(NEW.user_id, NEW.organization_id);
      RETURN NEW;
    END IF;

    RETURN NEW;
  END IF;

  -- Handle DELETE: remove all permissions
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.user_effective_permissions
    WHERE user_id = OLD.user_id AND organization_id = OLD.organization_id;
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;
```

### Role Assignment Scope Validation Trigger

**Verified from live database:**

```sql
CREATE OR REPLACE FUNCTION public.validate_role_assignment_scope()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  role_scope_type text;
BEGIN
  SELECT scope_type INTO role_scope_type
  FROM public.roles WHERE id = NEW.role_id;

  IF role_scope_type = 'org' AND NEW.scope != 'org' THEN
    RAISE EXCEPTION 'Role % can only be assigned at org scope', NEW.role_id;
  END IF;

  IF role_scope_type = 'branch' AND NEW.scope != 'branch' THEN
    RAISE EXCEPTION 'Role % can only be assigned at branch scope', NEW.role_id;
  END IF;

  -- 'both' allows either scope
  RETURN NEW;
END;
$$;
```

### Permission Slug Validation Trigger

**Verified from live database:**

```sql
CREATE OR REPLACE FUNCTION public.validate_permission_slug_on_override()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_correct_slug TEXT;
BEGIN
  -- If permission_id is provided, ensure permission_slug matches
  IF NEW.permission_id IS NOT NULL THEN
    SELECT slug INTO v_correct_slug FROM public.permissions WHERE id = NEW.permission_id;
    IF v_correct_slug IS NULL THEN
      RAISE EXCEPTION 'Invalid permission_id: % does not exist', NEW.permission_id;
    END IF;
    IF NEW.permission_slug IS NULL OR NEW.permission_slug <> v_correct_slug THEN
      NEW.permission_slug := v_correct_slug;
    END IF;
  END IF;

  -- If only permission_slug is provided, validate it exists
  IF NEW.permission_slug IS NOT NULL AND NEW.permission_id IS NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.permissions WHERE slug = NEW.permission_slug) THEN
      RAISE EXCEPTION 'Invalid permission_slug: % does not exist', NEW.permission_slug;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
```

---

## RLS Policies

### RLS and FORCE RLS Status (Verified)

| Table                        | RLS Enabled | FORCE RLS | Policy Count |
| ---------------------------- | ----------- | --------- | ------------ |
| `organizations`              | Yes         | No        | 4            |
| `organization_members`       | Yes         | **Yes**   | 5            |
| `invitations`                | Yes         | No        | 3            |
| `permissions`                | Yes         | No        | 1            |
| `roles`                      | Yes         | **Yes**   | 5            |
| `role_permissions`           | Yes         | **Yes**   | 5            |
| `user_role_assignments`      | Yes         | **Yes**   | 5            |
| `user_permission_overrides`  | Yes         | **Yes**   | 5            |
| `user_effective_permissions` | Yes         | **Yes**   | 1            |
| **Total**                    | **9/9**     | **6/9**   | **34**       |

### FORCE ROW LEVEL SECURITY

6 critical tables have `FORCE ROW LEVEL SECURITY` enabled:

```sql
ALTER TABLE public.organization_members FORCE ROW LEVEL SECURITY;
ALTER TABLE public.roles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.user_role_assignments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.user_permission_overrides FORCE ROW LEVEL SECURITY;
ALTER TABLE public.user_effective_permissions FORCE ROW LEVEL SECURITY;
```

> **Note**: FORCE RLS prevents the **table owner** from bypassing RLS. It does NOT affect `service_role`, which has the PostgreSQL `BYPASSRLS` attribute. See [Design Decisions](#force-rls-vs-service_role) for details.

### Complete Policy Reference (Verified from Live Database)

#### `organizations` (4 policies)

```sql
-- SELECT: Organization creator can see their orgs
CREATE POLICY "org_select_creator" ON public.organizations
  FOR SELECT TO authenticated
  USING (created_by = auth.uid() AND deleted_at IS NULL);

-- SELECT: Organization members can see the org
CREATE POLICY "org_select_member" ON public.organizations
  FOR SELECT TO authenticated
  USING (is_org_member(id) AND deleted_at IS NULL);

-- INSERT: Only authenticated users can create, bound to creator
CREATE POLICY "org_insert_authenticated" ON public.organizations
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND deleted_at IS NULL);

-- UPDATE: Requires org.update permission
CREATE POLICY "org_update_permission" ON public.organizations
  FOR UPDATE TO authenticated
  USING (is_org_member(id) AND has_permission(id, 'org.update') AND deleted_at IS NULL)
  WITH CHECK (is_org_member(id) AND has_permission(id, 'org.update') AND deleted_at IS NULL);
```

**Key**: `org_insert_authenticated` uses `created_by = auth.uid()` to prevent spoofing org ownership.

#### `organization_members` (5 policies)

```sql
-- SELECT: Users see their own memberships
CREATE POLICY "members_select_self" ON public.organization_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND deleted_at IS NULL);

-- SELECT: Org members see other members
CREATE POLICY "members_select_org" ON public.organization_members
  FOR SELECT TO authenticated
  USING (is_org_member(organization_id) AND deleted_at IS NULL);

-- INSERT: Admin or self-registration (creator binding)
CREATE POLICY "members_insert_permission" ON public.organization_members
  FOR INSERT TO authenticated
  WITH CHECK (
    -- Admin case: Has members.manage permission + tenant boundary
    (is_org_member(organization_id)
      AND has_permission(organization_id, 'members.manage')
      AND deleted_at IS NULL)
    OR
    -- Self-registration case: ONLY org creator adding themselves
    (user_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM organizations o
        WHERE o.id = organization_members.organization_id
          AND o.created_by = auth.uid()
          AND o.deleted_at IS NULL)
      AND NOT EXISTS (
        SELECT 1 FROM organization_members om
        WHERE om.user_id = auth.uid()
          AND om.organization_id <> organization_id
          AND om.status = 'active'
          AND om.deleted_at IS NULL)
      AND deleted_at IS NULL)
  );

-- UPDATE: Requires members.manage + tenant boundary
CREATE POLICY "members_update_permission" ON public.organization_members
  FOR UPDATE TO authenticated
  USING (is_org_member(organization_id) AND has_permission(organization_id, 'members.manage') AND deleted_at IS NULL)
  WITH CHECK (is_org_member(organization_id) AND has_permission(organization_id, 'members.manage') AND deleted_at IS NULL);

-- DELETE: Requires members.manage + tenant boundary
CREATE POLICY "members_delete_permission" ON public.organization_members
  FOR DELETE TO authenticated
  USING (is_org_member(organization_id) AND has_permission(organization_id, 'members.manage') AND deleted_at IS NULL);
```

#### `invitations` (3 policies)

```sql
-- SELECT: Permission holders OR the invitee themselves (case-insensitive email)
CREATE POLICY "invitations_select_permission" ON public.invitations
  FOR SELECT TO authenticated
  USING (
    (
      (is_org_member(organization_id) AND has_permission(organization_id, 'invites.read'))
      OR
      (LOWER(email) = LOWER((SELECT email FROM auth.users WHERE id = auth.uid())))
    )
    AND deleted_at IS NULL
  );

-- INSERT: Requires invites.create + tenant boundary
CREATE POLICY "invitations_insert_permission" ON public.invitations
  FOR INSERT TO authenticated
  WITH CHECK (
    is_org_member(organization_id)
    AND has_permission(organization_id, 'invites.create')
    AND deleted_at IS NULL
  );

-- UPDATE: Permission holders OR the invitee (for accepting)
CREATE POLICY "invitations_update_permission" ON public.invitations
  FOR UPDATE TO authenticated
  USING (
    (
      (is_org_member(organization_id) AND has_permission(organization_id, 'invites.cancel'))
      OR
      (LOWER(email) = LOWER((SELECT email FROM auth.users WHERE id = auth.uid())))
    )
    AND deleted_at IS NULL
  )
  WITH CHECK (
    (
      (is_org_member(organization_id) AND has_permission(organization_id, 'invites.cancel'))
      OR
      (LOWER(email) = LOWER((SELECT email FROM auth.users WHERE id = auth.uid())))
    )
    AND deleted_at IS NULL
  );
```

**Key**: `LOWER()` normalization ensures case-insensitive email matching. The outer `AND deleted_at IS NULL` is correctly scoped via parentheses around the inner OR expression (operator precedence fix).

#### `permissions` (1 policy)

```sql
-- SELECT: All authenticated users can read the permission dictionary (excluding soft-deleted)
CREATE POLICY "permissions_select_authenticated" ON public.permissions
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL);
```

#### `roles` (5 policies)

```sql
-- SELECT: System roles visible to all authenticated users
CREATE POLICY "roles_select_system" ON public.roles
  FOR SELECT TO authenticated
  USING (is_basic = true AND organization_id IS NULL AND deleted_at IS NULL);

-- SELECT: Custom roles visible to org members
CREATE POLICY "roles_select_org" ON public.roles
  FOR SELECT TO authenticated
  USING (organization_id IS NOT NULL AND is_org_member(organization_id) AND deleted_at IS NULL);

-- INSERT: Custom roles only, requires members.manage + tenant boundary
CREATE POLICY "roles_insert_permission" ON public.roles
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IS NOT NULL
    AND is_org_member(organization_id)
    AND has_permission(organization_id, 'members.manage')
    AND deleted_at IS NULL
  );

-- UPDATE: Custom non-basic roles only, requires members.manage + tenant boundary
CREATE POLICY "roles_update_permission" ON public.roles
  FOR UPDATE TO authenticated
  USING (organization_id IS NOT NULL AND is_basic = false
    AND is_org_member(organization_id) AND has_permission(organization_id, 'members.manage')
    AND deleted_at IS NULL)
  WITH CHECK (organization_id IS NOT NULL AND is_basic = false
    AND is_org_member(organization_id) AND has_permission(organization_id, 'members.manage')
    AND deleted_at IS NULL);

-- DELETE: Custom non-basic roles only, requires members.manage + tenant boundary
CREATE POLICY "roles_delete_permission" ON public.roles
  FOR DELETE TO authenticated
  USING (organization_id IS NOT NULL AND is_basic = false
    AND is_org_member(organization_id) AND has_permission(organization_id, 'members.manage')
    AND deleted_at IS NULL);
```

**Key**: System role policies use strict `AND` logic (`is_basic = true AND organization_id IS NULL`), not `OR`, to prevent malicious custom roles with `organization_id = NULL` from being universally visible.

#### `role_permissions` (5 policies)

```sql
-- SELECT: System role permissions visible to all authenticated
CREATE POLICY "role_permissions_select_system" ON public.role_permissions
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM roles r
      WHERE r.id = role_permissions.role_id
        AND r.is_basic = true AND r.organization_id IS NULL AND r.deleted_at IS NULL)
    AND deleted_at IS NULL
  );

-- SELECT: Custom role permissions visible to org members
CREATE POLICY "role_permissions_select_org" ON public.role_permissions
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM roles r
      WHERE r.id = role_permissions.role_id
        AND r.organization_id IS NOT NULL
        AND is_org_member(r.organization_id) AND r.deleted_at IS NULL)
    AND deleted_at IS NULL
  );

-- INSERT: Custom non-basic roles, requires members.manage
CREATE POLICY "role_permissions_insert_permission" ON public.role_permissions
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM roles r
      WHERE r.id = role_permissions.role_id
        AND r.organization_id IS NOT NULL AND r.is_basic = false
        AND is_org_member(r.organization_id)
        AND has_permission(r.organization_id, 'members.manage')
        AND r.deleted_at IS NULL)
    AND deleted_at IS NULL
  );

-- UPDATE: Same as INSERT
CREATE POLICY "role_permissions_update_permission" ON public.role_permissions
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM roles r
      WHERE r.id = role_permissions.role_id
        AND r.organization_id IS NOT NULL AND r.is_basic = false
        AND is_org_member(r.organization_id)
        AND has_permission(r.organization_id, 'members.manage')
        AND r.deleted_at IS NULL)
    AND deleted_at IS NULL)
  WITH CHECK (
    EXISTS (SELECT 1 FROM roles r
      WHERE r.id = role_permissions.role_id
        AND r.organization_id IS NOT NULL AND r.is_basic = false
        AND is_org_member(r.organization_id)
        AND has_permission(r.organization_id, 'members.manage')
        AND r.deleted_at IS NULL)
    AND deleted_at IS NULL);

-- DELETE: Same as UPDATE
CREATE POLICY "role_permissions_delete_permission" ON public.role_permissions
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM roles r
      WHERE r.id = role_permissions.role_id
        AND r.organization_id IS NOT NULL AND r.is_basic = false
        AND is_org_member(r.organization_id)
        AND has_permission(r.organization_id, 'members.manage')
        AND r.deleted_at IS NULL)
    AND deleted_at IS NULL);
```

#### `user_role_assignments` (5 policies)

```sql
-- SELECT: Users see their own assignments
CREATE POLICY "role_assignments_select_self" ON public.user_role_assignments
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND deleted_at IS NULL);

-- SELECT: Admins see assignments in their org
CREATE POLICY "role_assignments_select_admin" ON public.user_role_assignments
  FOR SELECT TO authenticated
  USING (scope = 'org' AND is_org_member(scope_id)
    AND has_permission(scope_id, 'members.manage') AND deleted_at IS NULL);

-- INSERT: Admin or self-registration (creator binding, escalation prevention)
CREATE POLICY "role_assignments_insert_permission" ON public.user_role_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    -- Admin case: Has members.manage permission
    (scope = 'org'
      AND is_org_member(scope_id)
      AND has_permission(scope_id, 'members.manage')
      AND deleted_at IS NULL)
    OR
    -- Self-registration case: ONLY during org creation by the CREATOR
    (user_id = auth.uid()
      AND scope = 'org'
      -- CRITICAL: Only allow org_member role (NOT org_owner!)
      AND EXISTS (SELECT 1 FROM roles r
        WHERE r.id = user_role_assignments.role_id
          AND r.name = 'org_member'
          AND r.deleted_at IS NULL)
      -- CRITICAL: User must be the organization creator
      AND EXISTS (SELECT 1 FROM organizations o
        WHERE o.id = user_role_assignments.scope_id
          AND o.created_by = auth.uid()
          AND o.deleted_at IS NULL)
      -- Belt & suspenders: User has no other active memberships
      AND NOT EXISTS (SELECT 1 FROM organization_members om
        WHERE om.user_id = auth.uid()
          AND om.organization_id <> user_role_assignments.scope_id
          AND om.status = 'active'
          AND om.deleted_at IS NULL)
      AND deleted_at IS NULL)
  );

-- UPDATE: Requires members.manage + tenant boundary
CREATE POLICY "role_assignments_update_permission" ON public.user_role_assignments
  FOR UPDATE TO authenticated
  USING (scope = 'org' AND is_org_member(scope_id)
    AND has_permission(scope_id, 'members.manage') AND deleted_at IS NULL)
  WITH CHECK (scope = 'org' AND is_org_member(scope_id)
    AND has_permission(scope_id, 'members.manage') AND deleted_at IS NULL);

-- DELETE: Requires members.manage + tenant boundary
CREATE POLICY "role_assignments_delete_permission" ON public.user_role_assignments
  FOR DELETE TO authenticated
  USING (scope = 'org' AND is_org_member(scope_id)
    AND has_permission(scope_id, 'members.manage') AND deleted_at IS NULL);
```

**Key**: Self-registration is constrained to `org_member` role only (prevents `org_owner` self-escalation) and requires `o.created_by = auth.uid()` (prevents joining arbitrary orgs).

#### `user_permission_overrides` (5 policies)

```sql
-- SELECT: Users see their own overrides
CREATE POLICY "overrides_select_self" ON public.user_permission_overrides
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND deleted_at IS NULL);

-- SELECT: Admins see overrides in their org
CREATE POLICY "overrides_select_admin" ON public.user_permission_overrides
  FOR SELECT TO authenticated
  USING (organization_id IS NOT NULL AND is_org_member(organization_id)
    AND has_permission(organization_id, 'members.manage') AND deleted_at IS NULL);

-- INSERT: Requires members.manage + tenant boundary
CREATE POLICY "overrides_insert_permission" ON public.user_permission_overrides
  FOR INSERT TO authenticated
  WITH CHECK (organization_id IS NOT NULL AND is_org_member(organization_id)
    AND has_permission(organization_id, 'members.manage') AND deleted_at IS NULL);

-- UPDATE: Same as INSERT
CREATE POLICY "overrides_update_permission" ON public.user_permission_overrides
  FOR UPDATE TO authenticated
  USING (organization_id IS NOT NULL AND is_org_member(organization_id)
    AND has_permission(organization_id, 'members.manage') AND deleted_at IS NULL)
  WITH CHECK (organization_id IS NOT NULL AND is_org_member(organization_id)
    AND has_permission(organization_id, 'members.manage') AND deleted_at IS NULL);

-- DELETE: Same as INSERT
CREATE POLICY "overrides_delete_permission" ON public.user_permission_overrides
  FOR DELETE TO authenticated
  USING (organization_id IS NOT NULL AND is_org_member(organization_id)
    AND has_permission(organization_id, 'members.manage') AND deleted_at IS NULL);
```

#### `user_effective_permissions` (1 policy)

```sql
-- SELECT: Users can ONLY see their own compiled permissions
CREATE POLICY "Users can view own effective permissions" ON public.user_effective_permissions
  FOR SELECT TO public
  USING (user_id = auth.uid());
```

**Key**:

- No INSERT/UPDATE/DELETE policies. Only the compiler (via triggers with `SECURITY DEFINER`) can write to this table.
- **Why `TO public` instead of `TO authenticated`?** The `USING (user_id = auth.uid())` clause makes this safe: `anon` users have `auth.uid() = NULL`, so the condition `user_id = NULL` will never match any row (user_id is NOT NULL). This is functionally equivalent to `TO authenticated`, but slightly more permissive in policy definition. If you prefer explicit semantics, change to `TO authenticated`.

---

## Security Hardening

### Function Execute Privileges

| Function                   | anon | authenticated | service_role |
| -------------------------- | ---- | ------------- | ------------ |
| `compile_user_permissions` | No   | No            | Yes          |
| `has_permission`           | No   | Yes           | Yes          |
| `is_org_member`            | No   | Yes           | Yes          |

### Security Features Summary

| Feature                         | Implementation                                      | Protection Against                            |
| ------------------------------- | --------------------------------------------------- | --------------------------------------------- |
| Advisory locks                  | `pg_advisory_xact_lock()` in compiler               | Race conditions                               |
| Active membership guard         | Check at top of compiler                            | Zombie permissions                            |
| Ghost permission prevention     | Membership trigger handles ID changes               | Admin mistakes                                |
| Privilege escalation prevention | Self-assignment bound to `org_member` + org creator | Users assigning themselves `org_owner`        |
| Creator binding                 | `created_by = auth.uid()` on org INSERT             | Spoofing org ownership                        |
| DoS prevention                  | Compiler invoked only by SECURITY DEFINER triggers  | Spammed recompiles                            |
| Permission slug validation      | Trigger on overrides                                | Typos and drift                               |
| SECURITY DEFINER + search_path  | All functions use `SET search_path TO ''`           | SQL injection via search_path                 |
| FORCE ROW LEVEL SECURITY        | 6 critical tables                                   | Table owner bypass                            |
| Role invariant constraint       | Single `roles_invariant` CHECK                      | Invalid system/custom role states             |
| Strict AND policy logic         | System role policies use AND not OR                 | Unauthorized system role visibility           |
| Soft-delete filtering           | `deleted_at IS NULL` in all RLS policies            | Soft-deleted data leakage                     |
| LOWER() email normalization     | Invitations SELECT/UPDATE policies                  | Case-sensitivity email bypass                 |
| Operator precedence fix         | Explicit parentheses around OR in invitations       | `deleted_at IS NULL` applying to wrong branch |
| Unique constraints              | On memberships, assignments, compiled permissions   | Duplicate data insertion                      |

### Service Role Bypass (Expected Behavior)

`service_role` bypasses RLS by design. This is expected and correct:

- `service_role` is used by backend/server actions
- It has the `BYPASSRLS` attribute in PostgreSQL
- All sensitive operations should go through server actions that validate permissions before using service_role
- FORCE ROW LEVEL SECURITY does NOT affect `service_role` (only table owners without `BYPASSRLS`)

---

## Design Decisions & Known Limitations

### Bootstrap Ordering (Self-Registration)

When a user creates a new organization, three INSERT operations must happen **sequentially**:

1. **Organization INSERT** (`org_insert_authenticated`): `created_by = auth.uid()`
2. **Membership INSERT** (`members_insert_permission`): Checks `organizations.created_by = auth.uid()`
3. **Role Assignment INSERT** (`role_assignments_insert_permission`): Checks `organizations.created_by = auth.uid()` and restricts to `org_member` role

This ordering is critical. The membership INSERT checks that the organization exists and was created by the current user. The role assignment INSERT checks the same. If these were reordered, the policies would fail.

> **Note**: The self-registration flow only assigns `org_member`. The `org_owner` role must be assigned by a server action using `service_role`.

### INSERT deleted_at IS NULL (Belt-and-Suspenders)

All INSERT WITH CHECK clauses include `deleted_at IS NULL`, even though new rows naturally have `deleted_at = NULL`. This is **intentionally redundant** as defense-in-depth:

- Prevents a malicious client from inserting a pre-deleted row (e.g., `INSERT INTO ... VALUES (..., deleted_at = '2020-01-01')`)
- Such a row would be invisible to SELECT policies but could still exist in the table
- The redundant check costs nothing (column is always checked anyway) but closes this vector

### Soft-Delete UPDATE Limitation (Option C)

RLS cannot enforce that an UPDATE "only changes the `deleted_at` column." PostgreSQL's WITH CHECK runs against the entire NEW row, not the diff. This means:

- A user with UPDATE permission can modify ANY column on a row, not just `deleted_at`
- RLS policies check "can this user see/modify this row?" not "what specific columns changed"
- This is an **accepted limitation** of PostgreSQL RLS

**Mitigation**: Application-level validation in server actions should enforce which columns can be changed.

### FORCE RLS vs service_role

FORCE ROW LEVEL SECURITY has a specific, limited scope:

- **What it does**: Prevents the PostgreSQL **table owner** role from bypassing RLS
- **What it does NOT do**: It does NOT affect roles with the `BYPASSRLS` attribute (like `service_role`)
- **Why it matters**: Without FORCE RLS, if application code accidentally runs as the table owner instead of through `service_role` or `authenticated`, RLS would be silently bypassed

The 3 tables without FORCE RLS (`organizations`, `invitations`, `permissions`) are less sensitive because:

- `organizations`: Protected by creator binding
- `invitations`: Protected by email matching + permission checks
- `permissions`: Read-only dictionary, no mutation policies for authenticated users

### Known Issue: members_insert Self-Registration Guard is Effectively Disabled

The `members_insert_permission` policy's NOT EXISTS subquery has a **SQL name resolution ambiguity** that renders the guard ineffective:

```sql
-- Current (BROKEN):
NOT EXISTS (
  SELECT 1 FROM organization_members om
  WHERE om.user_id = auth.uid()
    AND om.organization_id <> organization_id  -- Resolves to om.organization_id!
    AND om.status = 'active'
    AND om.deleted_at IS NULL
)
```

Because the policy is on `organization_members` and the subquery also references `organization_members om`, PostgreSQL's scoping rules resolve the unqualified `organization_id` to `om.organization_id` (inner scope first). This makes the condition:

```sql
om.organization_id <> om.organization_id  -- Always FALSE!
```

The guard is completely bypassed.

**How to fix** (not currently applied):

```sql
-- Option 1: Qualify the outer column
om.organization_id <> organization_members.organization_id

-- Option 2: Remove this guard entirely (it's belt-and-suspenders anyway)
```

**Impact**: **Low severity**. This is a defense-in-depth check, not a primary security boundary. The **real** security control is the creator binding:

```sql
EXISTS (
  SELECT 1 FROM organizations o
  WHERE o.id = organization_members.organization_id
    AND o.created_by = auth.uid()  -- <-- THIS prevents joining arbitrary orgs
)
```

Even with the guard disabled, users can only add themselves to organizations they created.

**Why we haven't fixed it**: The guard adds minimal security value (you can only be in one org if you're not invited to others anyway), and fixing it requires changing a live RLS policy. If you need strict "one org per user" enforcement, implement it at the application level, not in RLS.

**Note**: The equivalent check in `role_assignments_insert_permission` works correctly because the outer table is `user_role_assignments`, making the reference unambiguous: `om.organization_id <> user_role_assignments.scope_id`.

---

## Performance Optimizations

### Indexes

| Index                                    | Table                        | Purpose                                  |
| ---------------------------------------- | ---------------------------- | ---------------------------------------- |
| `idx_uep_user_org_permission`            | `user_effective_permissions` | Fast RLS permission checks               |
| `idx_uep_user_org`                       | `user_effective_permissions` | User+org lookups                         |
| `idx_uep_permission`                     | `user_effective_permissions` | Permission slug lookups                  |
| `idx_organization_members_user_org`      | `organization_members`       | Fast active membership checks (filtered) |
| `idx_user_role_assignments_compiler`     | `user_role_assignments`      | Fast role lookups (filtered)             |
| `idx_user_permission_overrides_compiler` | `user_permission_overrides`  | Fast override lookups (filtered)         |
| `idx_role_permissions_role`              | `role_permissions`           | Fast permission joins (filtered)         |

### Compiler Performance

- **Set-based**: Single INSERT statement, no loops (except `trigger_compile_on_role_permission` which loops over affected users)
- **Filtered indexes**: Partial indexes with `WHERE deleted_at IS NULL`
- **Advisory locks**: Transaction-scoped, minimal blocking
- **ON CONFLICT**: Handles recompilation without separate DELETE+INSERT

---

## Observability

### Permission Staleness Report

```sql
-- View: permission_staleness_report
SELECT * FROM permission_staleness_report;

-- Results:
-- email                              | org_name | permission_count | freshness_status
-- -----------------------------------+----------+------------------+-----------------
-- user@example.com                   | Test Org | 13               | FRESH
```

**Freshness Status**:

- `FRESH`: Compiled within last 5 minutes
- `OLD (>5min)`: Compiled 5-60 minutes ago
- `STALE (>1hr)`: Compiled more than 1 hour ago
- `NEVER_COMPILED`: No compiled permissions exist

---

## TypeScript Services

### PermissionServiceV2

**Location**: `src/server/services/permission-v2.service.ts`

```typescript
export class PermissionServiceV2 {
  // Get all effective permissions as a Set
  static async getEffectivePermissions(
    supabase: SupabaseClient,
    userId: string,
    orgId: string
  ): Promise<Set<string>>;

  // Get as PermissionSnapshot (V1 compatibility)
  static async getPermissionSnapshotForUser(
    supabase: SupabaseClient,
    userId: string,
    orgId: string,
    branchId?: string | null
  ): Promise<PermissionSnapshot>; // { allow: [...], deny: [] }

  // Check single permission
  static async hasPermission(
    supabase: SupabaseClient,
    userId: string,
    orgId: string,
    permission: string
  ): Promise<boolean>;
}
```

**Note**: `deny` is always an empty array in V2. Deny logic is handled at compile-time only.

### PermissionCompiler

**Location**: `src/server/services/permission-compiler.service.ts`

Server-side service that can trigger recompilation via `service_role`.

---

## React Hooks & Server Actions

### Server Action: `getBranchPermissions`

**Location**: `src/app/actions/v2/permissions.ts`

```typescript
export async function getBranchPermissions(
  orgId: string,
  branchId: string | null
): Promise<{ permissions: PermissionSnapshot }>;

// Returns: { permissions: { allow: [...], deny: [] } }
// Note: deny is always empty in V2
```

### React Hook: `usePermissions`

**Location**: `src/hooks/v2/use-permissions.ts`

```typescript
export function usePermissions() {
  return {
    can: (permission: string) => boolean,
    cannot: (permission: string) => boolean,
    canAny: (permissions: string[]) => boolean,
    canAll: (permissions: string[]) => boolean,
    getSnapshot: () => PermissionSnapshot,
  };
}
```

---

## Permission Flow Examples

### Flow 1: User Creates Organization (Bootstrap)

**Model**: Client-side authenticated inserts with RLS enforcement, then server-side upgrade.

```
1. User clicks "Create Organization"
2. Client (authenticated) INSERTs organization record
   -> RLS policy org_insert_authenticated enforces: created_by = auth.uid() AND deleted_at IS NULL
   -> Organization created with user as creator
3. Client (authenticated) INSERTs organization_members record (user as active member)
   -> RLS policy members_insert_permission self-registration branch:
      - Checks: user_id = auth.uid()
      - Checks: organization created_by = auth.uid() (creator binding)
      - Checks: no other active memberships (belt-and-suspenders, may be disabled)
   -> Membership trigger fires -> compile_user_permissions() (but no role yet, so 0 permissions)
4. Client (authenticated) INSERTs user_role_assignments (user + org_member role)
   -> RLS policy role_assignments_insert_permission self-registration branch:
      - Checks: user_id = auth.uid()
      - Checks: role.name = 'org_member' (NOT org_owner!)
      - Checks: organization created_by = auth.uid() (creator binding)
      - Checks: no other active memberships
   -> Role assignment trigger fires -> compile_user_permissions()
5. Compiler runs:
   a. Checks active membership -> YES
   b. Acquires advisory lock
   c. Gets org_member role's permissions (5 slugs)
   d. INSERTs 5 rows with source_type='role'
6. Server action (service_role) upgrades user to org_owner
   -> Bypasses RLS (service_role has BYPASSRLS)
   -> DELETEs org_member role assignment
   -> INSERTs org_owner role assignment
   -> Role assignment trigger fires -> recompile
   -> Now 13 compiled permissions
```

**Note**: Steps 2-4 use **authenticated RLS policies** (not service_role bypass). This enforces creator binding and prevents privilege escalation. Only step 6 uses service_role to bypass the "only org_member via self-registration" restriction.

### Flow 2: Permission Check (RLS)

```
1. User requests: SELECT * FROM branches WHERE organization_id = ?
2. Supabase evaluates RLS policy on branches table
3. Policy calls: is_org_member(organization_id)
   -> EXISTS check on organization_members (active + not deleted)
4. Policy calls: has_permission(organization_id, 'branches.read')
   -> EXISTS check on user_effective_permissions (exact slug match)
5. Both return true -> Row included in results
```

### Flow 3: Member Removed

```
1. Admin removes user from organization
2. organization_members.status set to 'inactive'
3. Membership trigger fires (UPDATE)
4. Trigger detects: OLD.status='active' AND NEW.status<>'active'
5. Trigger executes: DELETE FROM user_effective_permissions
   WHERE user_id=... AND organization_id=...
6. User immediately loses ALL permissions for that org
7. All subsequent RLS checks fail (no rows in effective permissions)
```

### Flow 4: Override Applied

```
1. Admin grants specific permission override to user
2. user_permission_overrides record created
3. validate_permission_slug trigger fires (BEFORE INSERT)
   -> Validates/auto-corrects permission_slug
4. trigger_compile_on_override fires (AFTER INSERT)
   -> Calls compile_user_permissions()
5. Compiler re-evaluates all sources (roles + overrides)
6. New permission appears in user_effective_permissions
```

---

## Current Permissions & Roles

### Permission Catalog (13 permissions, verified)

| Slug              | Category     | Action |
| ----------------- | ------------ | ------ |
| `branches.create` | branches     | create |
| `branches.delete` | branches     | delete |
| `branches.read`   | branches     | read   |
| `branches.update` | branches     | update |
| `invites.cancel`  | invites      | cancel |
| `invites.create`  | invites      | create |
| `invites.read`    | invites      | read   |
| `members.manage`  | members      | manage |
| `members.read`    | members      | read   |
| `org.read`        | organization | read   |
| `org.update`      | organization | update |
| `self.read`       | self         | read   |
| `self.update`     | self         | update |

### Role Definitions (verified)

#### org_owner (System Role, 13 permissions)

Full organization access - ALL permissions:
`branches.create`, `branches.delete`, `branches.read`, `branches.update`, `invites.cancel`, `invites.create`, `invites.read`, `members.manage`, `members.read`, `org.read`, `org.update`, `self.read`, `self.update`

#### org_member (System Role, 5 permissions)

Limited read access:
`branches.read`, `members.read`, `org.read`, `self.read`, `self.update`

---

## Adding New Permissions

### Step 1: Add Permission to Catalog

```sql
INSERT INTO permissions (slug, category, action, description) VALUES
('warehouse.products.read', 'warehouse', 'read', 'View products');
```

### Step 2: Assign to Roles

```sql
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'org_owner' AND p.slug = 'warehouse.products.read';
```

### Step 3: Triggers Auto-Recompile

The `trigger_role_permission_compile` will automatically recompile permissions for all users with the affected role.

### Step 4: Add RLS Policies

```sql
CREATE POLICY "products_select" ON products
FOR SELECT TO authenticated
USING (
  is_org_member(organization_id)
  AND has_permission(organization_id, 'warehouse.products.read')
  AND deleted_at IS NULL
);
```

---

## Debugging & Troubleshooting

### Query 1: Check User's Compiled Permissions

```sql
SELECT permission_slug, source_type, compiled_at
FROM user_effective_permissions
WHERE user_id = 'user-uuid' AND organization_id = 'org-uuid'
ORDER BY permission_slug;
```

### Query 2: Check Permission Staleness

```sql
SELECT * FROM permission_staleness_report
WHERE email = 'user@example.com';
```

### Query 3: Manually Recompile (service_role only)

```sql
SELECT compile_user_permissions('user-uuid', 'org-uuid');
```

### Query 4: Check Function Privileges

```sql
SELECT
  p.proname,
  r.rolname,
  has_function_privilege(r.oid, p.oid, 'EXECUTE') as can_execute
FROM pg_proc p
CROSS JOIN pg_roles r
WHERE p.proname IN ('compile_user_permissions', 'has_permission', 'is_org_member')
AND p.pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
AND r.rolname IN ('authenticated', 'service_role', 'anon');
```

### Query 5: Verify Enterprise Hardening (v6.0)

```sql
-- Check FORCE RLS is enabled on critical tables
SELECT relname, relrowsecurity, relforcerowsecurity
FROM pg_class
WHERE relname IN (
  'user_effective_permissions', 'user_role_assignments',
  'user_permission_overrides', 'organization_members',
  'roles', 'role_permissions'
)
ORDER BY relname;
-- Expected: relrowsecurity=true AND relforcerowsecurity=true for all 6

-- Check roles_invariant constraint
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.roles'::regclass
AND conname = 'roles_invariant';
-- Expected: roles_invariant with (is_basic=true AND org IS NULL) OR (is_basic=false AND org IS NOT NULL)

-- Verify system role policy uses strict AND
SELECT policyname, qual
FROM pg_policies
WHERE tablename = 'roles' AND policyname = 'roles_select_system';
-- Expected: is_basic = true AND organization_id IS NULL AND deleted_at IS NULL

-- Count total policies on permission system tables
SELECT tablename, count(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN (
  'organizations', 'organization_members', 'invitations',
  'permissions', 'roles', 'role_permissions',
  'user_role_assignments', 'user_permission_overrides', 'user_effective_permissions'
)
GROUP BY tablename ORDER BY tablename;
-- Expected: 34 total policies

-- Verify unique constraints exist (duplicate prevention)
SELECT tc.table_name, tc.constraint_name
FROM information_schema.table_constraints tc
WHERE tc.table_schema = 'public'
AND tc.constraint_type = 'UNIQUE'
AND tc.table_name IN ('organization_members', 'user_role_assignments', 'user_effective_permissions')
ORDER BY tc.table_name;
-- Expected: organization_members_organization_id_user_id_key,
--           user_role_assignments_user_id_role_id_scope_scope_id_key,
--           user_effective_permissions_unique
```

### Common Issues

| Symptom                          | Cause                                  | Fix                                              |
| -------------------------------- | -------------------------------------- | ------------------------------------------------ |
| User can't see anything          | Not in `organization_members`          | Add membership record                            |
| User has role but no permissions | Membership not active                  | Check `status='active'` and `deleted_at IS NULL` |
| Permission check returns false   | Permission not compiled                | Check staleness report, recompile                |
| RLS blocking unexpectedly        | Compiled permissions stale             | Recompile via service_role                       |
| Can't call compiler function     | Not service_role                       | Compiler invoked only via triggers               |
| Soft-deleted rows visible        | Missing `deleted_at IS NULL` in policy | Check policy definitions                         |
| Invitation email not matching    | Case sensitivity                       | Verify `LOWER()` in policy                       |

---

## Enterprise Checklist

### Critical (Must Have)

- [x] EXECUTE privilege lockdown for compiler functions
- [x] RLS policy hardening (privilege escalation prevention)
- [x] Foreign keys for referential integrity
- [x] Performance indexes for compiler queries
- [x] Active membership guard in compiler
- [x] Advisory locks for race prevention
- [x] source_type update on conflict
- [x] Membership trigger handles ID changes (ghost prevention)
- [x] Permission slug validation trigger
- [x] Role assignment scope validation trigger
- [x] FORCE ROW LEVEL SECURITY on 6 critical tables
- [x] Single canonical `roles_invariant` CHECK constraint
- [x] Strict AND logic for system role policies
- [x] Soft-delete filtering (`deleted_at IS NULL`) in ALL RLS policies
- [x] Creator binding for self-registration policies
- [x] LOWER() email normalization in invitations policies
- [x] Operator precedence fix (parentheses around OR in invitations)
- [x] Unique constraints on memberships, assignments, compiled permissions

### Recommended (Have)

- [x] Observability view (permission_staleness_report)
- [x] Filtered indexes for active records
- [x] SECURITY DEFINER with SET search_path on all functions
- [x] Comprehensive documentation (this document)
- [x] Service role bypass documentation
- [x] Design decisions and known limitations documented

### Future (Optional)

- [ ] Fix `members_insert_permission` NOT EXISTS column resolution ambiguity
- [ ] Add `branch_id` to user_effective_permissions for branch-scope permissions
- [ ] Split `members.manage` into finer permissions (`members.invite`, `roles.assign`)
- [ ] Statement-level triggers for batch operations
- [ ] Async job queue for recompiles
- [ ] Co-member visibility policy hardening (consider limiting exposed user fields)
- [ ] Add FORCE RLS to remaining 3 tables (organizations, invitations, permissions)

---

## Migration History

| Version | Migration Timestamp | Migration Name                           | Changes                                                                                                                     |
| ------- | ------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Pre-V2  | 20250712131800      | `create_permissions_table`               | Initial permissions table                                                                                                   |
| Pre-V2  | 20250712135819      | `create_roles_table`                     | Initial roles table                                                                                                         |
| Pre-V2  | 20250712140256      | `create_role_permissions_table`          | Role-permission junction                                                                                                    |
| Pre-V2  | 20250712140316      | `create_user_role_assignments_table`     | User-role assignments                                                                                                       |
| Pre-V2  | 20250712140332      | `create_user_permission_overrides_table` | Permission overrides                                                                                                        |
| Pre-V2  | 20250804092727      | `add_role_management_rls_policies`       | Initial RLS policies                                                                                                        |
| Pre-V2  | 20260109110139      | `add_missing_fk_permission_overrides`    | Foreign key fixes                                                                                                           |
| Pre-V2  | 20260110141056      | `add_permission_override_constraints`    | Override constraints                                                                                                        |
| Pre-V2  | 20260119133706      | `add_wildcard_permissions`               | Wildcard permission support                                                                                                 |
| 1.0     | 20260120114036      | `permission_system_v2_foundation`        | V2 foundation: compiler, triggers, effective_permissions table                                                              |
| 2.0     | 20260120174957      | `rls_v2_core_tables`                     | Core RLS policies                                                                                                           |
| 2.0     | 20260120230319      | `rls_v2_complete_security`               | Complete RLS coverage                                                                                                       |
| 3.0     | 20260122084701      | `enterprise_permission_hardening`        | Membership guard, advisory locks, source_type fix                                                                           |
| 4.0     | 20260122085722      | `enterprise_security_lockdown`           | EXECUTE privileges, validation trigger, indexes                                                                             |
| 5.0     | 20260123124558      | `enterprise_rls_policy_hardening`        | FORCE RLS, CHECK constraints, soft-delete filters                                                                           |
| **6.0** | **20260127074445**  | **`enterprise_rls_policy_cleanup`**      | **Final: 34 policies, creator binding, LOWER() email, operator precedence fix, roles_invariant, deterministic DROP+CREATE** |

---

## Summary

| Layer                        | Responsibility                                          |
| ---------------------------- | ------------------------------------------------------- |
| `permissions`                | Catalog of possible actions (13 slugs)                  |
| `roles` + `role_permissions` | Named permission bundles (org_owner: 13, org_member: 5) |
| `user_role_assignments`      | Who has what role (with scope validation)               |
| `user_permission_overrides`  | Individual exceptions (grant/revoke at compile time)    |
| **Compiler**                 | Turns roles into facts (enterprise hardened)            |
| `user_effective_permissions` | **THE FACTS** (what can user actually do)               |
| `organization_members`       | Tenant boundary (who belongs)                           |
| `is_org_member()`            | RLS Layer 1: "Are you in this org?"                     |
| `has_permission()`           | RLS Layer 2: "Can you do this action?"                  |

**The Golden Rule**:

> Roles describe intent.
> The compiler turns intent into facts.
> Facts are enforced everywhere.
> Security is enterprise-grade.

---

**Document Version**: 6.0 (Enterprise Hardened - Final)
**Last Updated**: 2026-01-27
**Verified Against**: Live database queries on 2026-01-27 (34 policies, 7 triggers, 3 functions, 6 FORCE RLS tables, roles_invariant constraint)
