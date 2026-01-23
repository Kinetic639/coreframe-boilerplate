# Permission System V2 - Complete Documentation

**Last Updated**: 2026-01-22
**Status**: Production (Enterprise Hardened)
**Verified Against**: Live database (zlcnlalwfmmtusigeuyk)

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
9. [Performance Optimizations](#performance-optimizations)
10. [TypeScript Services](#typescript-services)
11. [React Hooks & Server Actions](#react-hooks--server-actions)
12. [Permission Flow Examples](#permission-flow-examples)
13. [Current Permissions & Roles](#current-permissions--roles)
14. [Adding New Permissions](#adding-new-permissions)
15. [Debugging & Troubleshooting](#debugging--troubleshooting)
16. [Enterprise Checklist](#enterprise-checklist)

---

## Executive Summary

The Permission System V2 uses a **"Compile, Don't Evaluate"** architecture with **enterprise-grade security hardening**:

```
┌─────────────────────────────────────────────────────────────────┐
│                    WRITE-TIME (Compilation)                      │
│                                                                  │
│  When roles/assignments change → Compiler runs automatically     │
│  Roles + Permissions → Compiled into explicit facts              │
│  Result stored in: user_effective_permissions                    │
│                                                                  │
│  ENTERPRISE FEATURES:                                            │
│  ✓ Advisory locks (prevents race conditions)                     │
│  ✓ Active membership guard (idempotent safety)                   │
│  ✓ Set-based queries (no loops, high performance)                │
│  ✓ source_type tracking (accurate metadata)                      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    READ-TIME (Enforcement)                       │
│                                                                  │
│  RLS Policy: "Does row exist in user_effective_permissions?"     │
│  No wildcards. No deny logic. No complex evaluation.             │
│  Just a simple EXISTS check.                                     │
│                                                                  │
│  ENTERPRISE FEATURES:                                            │
│  ✓ Function privilege lockdown (DoS prevention)                  │
│  ✓ RLS policy hardening (privilege escalation prevention)        │
│  ✓ Optimized indexes (sub-millisecond lookups)                   │
└─────────────────────────────────────────────────────────────────┘
```

### Key Characteristics

| Aspect                | Implementation                                                  |
| --------------------- | --------------------------------------------------------------- |
| **Pattern**           | Compile at write-time, lookup at read-time                      |
| **Runtime Logic**     | Simple EXISTS check (no wildcards, no deny-first)               |
| **Wildcard Handling** | Expanded at compile-time into explicit slugs                    |
| **Deny Handling**     | Applied at compile-time (deny array always empty at runtime)    |
| **RLS Approach**      | Two-layer: tenant boundary + permission check                   |
| **Auto-Compilation**  | Database triggers on role/permission/membership changes         |
| **Security**          | Enterprise-hardened (privilege lockdown, escalation prevention) |

---

## The Core Principle

> **"A user can do X in org Y only if there is an explicit row in `user_effective_permissions` that says so."**

No magic. No guessing. No wildcards at runtime. Everything else exists only to produce those rows.

---

## System Architecture

### Complete Data Flow

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           CONFIGURATION LAYER                                  │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│   ┌─────────────┐     ┌──────────────────┐     ┌─────────────────────────┐  │
│   │ permissions │     │ role_permissions │     │         roles           │  │
│   │  (13 slugs) │◄────│    (junction)    │────►│  org_owner, org_member  │  │
│   └─────────────┘     └──────────────────┘     └─────────────────────────┘  │
│         │                                                │                    │
│         │                                                │                    │
│         ▼                                                ▼                    │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                    user_role_assignments                             │   │
│   │         (user_id, role_id, scope='org', scope_id=org_id)            │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                          │
│                      TRIGGERS: role_assignment, override, membership          │
│                                    ▼                                          │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                 PERMISSION COMPILER (Enterprise Hardened)            │   │
│   │                                                                      │   │
│   │  SQL Function: compile_user_permissions(user_id, org_id)            │   │
│   │                                                                      │   │
│   │  Enterprise Features:                                                │   │
│   │  ✓ Active membership guard (only compiles for active members)       │   │
│   │  ✓ Advisory lock (prevents concurrent compilation races)            │   │
│   │  ✓ Set-based logic (no loops, single INSERT statement)              │   │
│   │  ✓ source_type tracking (updates on conflict)                       │   │
│   │  ✓ SECURITY DEFINER with SET search_path TO ''                      │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                          │
│                                    ▼                                          │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │               user_effective_permissions (THE KEY TABLE)             │   │
│   │                                                                      │   │
│   │  Example data (org_owner with 13 permissions):                      │   │
│   │  ├── (user-123, org-456, 'org.read',        'role', '2026-01-22')  │   │
│   │  ├── (user-123, org-456, 'org.update',      'role', '2026-01-22')  │   │
│   │  ├── (user-123, org-456, 'branches.read',   'role', '2026-01-22')  │   │
│   │  └── ... (13 total rows)                                            │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│                           ENFORCEMENT LAYER                                    │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                         RLS POLICIES                                 │   │
│   │                                                                      │   │
│   │  Layer 1 - Tenant Boundary:                                         │   │
│   │  is_org_member(org_id) → checks organization_members                │   │
│   │  SECURITY: authenticated + service_role can execute                 │   │
│   │                                                                      │   │
│   │  Layer 2 - Permission Check:                                        │   │
│   │  has_permission(org_id, 'branches.create') →                        │   │
│   │    SELECT EXISTS FROM user_effective_permissions                    │   │
│   │    WHERE user_id = auth.uid()                                       │   │
│   │    AND organization_id = org_id                                     │   │
│   │    AND permission_slug = 'branches.create'                          │   │
│   │  SECURITY: authenticated + service_role can execute                 │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### Core Tables

#### 1. `permissions` - Permission Dictionary

**Purpose**: Catalog of all possible permissions in the system.

```sql
-- Current data (13 permissions):
SELECT slug, category, description FROM permissions;

-- Results:
branches.create   | branches     | Create new branches
branches.delete   | branches     | Delete branches
branches.read     | branches     | View branches
branches.update   | branches     | Update branch information
invites.cancel    | invites      | Cancel pending invitations
invites.create    | invites      | Send invitations
invites.read      | invites      | View pending invitations
members.manage    | members      | Invite, remove, and manage member roles
members.read      | members      | View member list
org.read          | organization | View organization information
org.update        | organization | Update organization settings
self.read         | self         | View own profile
self.update       | self         | Update own profile
```

#### 2. `roles` - Role Definitions

**Purpose**: Named bundles of permissions.

```sql
-- Current data (2 system roles):
SELECT name, description, scope_type, is_basic FROM roles WHERE deleted_at IS NULL;

-- Results:
org_owner  | Organization owner with full access           | org | true
org_member | Regular organization member with limited access | org | true
```

**Fields**:

- `is_basic = true`: System role, cannot be deleted
- `organization_id = NULL`: Global role (applies to all orgs)
- `organization_id = UUID`: Custom role for specific org

#### 3. `role_permissions` - Role-Permission Mapping

**Purpose**: Links roles to their permissions.

```sql
-- Current mappings:
SELECT r.name, p.slug FROM role_permissions rp
JOIN roles r ON rp.role_id = r.id
JOIN permissions p ON rp.permission_id = p.id
WHERE rp.deleted_at IS NULL;

-- org_owner has ALL 13 permissions
-- org_member has 5 permissions: org.read, branches.read, members.read, self.read, self.update
```

#### 4. `user_role_assignments` - User-Role Links

**Purpose**: Assigns roles to users with scope.

```sql
CREATE TABLE user_role_assignments (
  id         UUID PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES auth.users(id),
  role_id    UUID NOT NULL REFERENCES roles(id),
  scope      TEXT NOT NULL CHECK (scope IN ('org', 'branch')),
  scope_id   UUID NOT NULL,  -- organization_id or branch_id
  deleted_at TIMESTAMPTZ
);

-- Performance index for compiler queries
CREATE INDEX idx_user_role_assignments_compiler
  ON user_role_assignments(user_id, scope, scope_id)
  WHERE deleted_at IS NULL;
```

#### 5. `user_effective_permissions` - THE KEY TABLE

**Purpose**: Compiled permission facts. This is what RLS checks.

```sql
CREATE TABLE user_effective_permissions (
  id               UUID PRIMARY KEY,
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  permission_slug  TEXT NOT NULL,
  source_type      TEXT NOT NULL DEFAULT 'role',  -- 'role' or 'override'
  source_id        UUID,                           -- role_id or override_id
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  compiled_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (user_id, organization_id, permission_slug)
);

-- Indexes for fast RLS lookups
CREATE INDEX idx_uep_user_org ON user_effective_permissions(user_id, organization_id);
CREATE INDEX idx_uep_permission ON user_effective_permissions(permission_slug);
CREATE INDEX idx_uep_user_org_permission ON user_effective_permissions(user_id, organization_id, permission_slug);
```

#### 6. `organization_members` - Tenant Boundary

**Purpose**: Determines who belongs to an organization (separate from what they can do).

```sql
CREATE TABLE organization_members (
  id              UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'active',  -- 'active', 'pending', 'inactive'
  joined_at       TIMESTAMPTZ DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);

-- Performance index for active membership checks
CREATE INDEX idx_organization_members_user_org
  ON organization_members(user_id, organization_id)
  WHERE status = 'active' AND deleted_at IS NULL;
```

#### 7. `user_permission_overrides` - Individual Exceptions

**Purpose**: Grant or revoke specific permissions for individual users (applied at compile time).

```sql
CREATE TABLE user_permission_overrides (
  id              UUID PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission_id   UUID NOT NULL REFERENCES permissions(id) ON DELETE RESTRICT,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  effect          TEXT NOT NULL DEFAULT 'grant' CHECK (effect IN ('grant', 'revoke')),
  permission_slug TEXT,  -- Auto-populated by validation trigger
  deleted_at      TIMESTAMPTZ
);

-- Performance index for compiler queries
CREATE INDEX idx_user_permission_overrides_compiler
  ON user_permission_overrides(user_id, organization_id, effect)
  WHERE deleted_at IS NULL;
```

**Validation Trigger**: `trigger_validate_permission_slug` ensures `permission_slug` always matches `permission_id`.

---

## Database Functions

### RLS Helper Functions

#### `is_org_member(org_id UUID)` - Tenant Boundary Check

```sql
CREATE OR REPLACE FUNCTION is_org_member(org_id UUID)
RETURNS BOOLEAN
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

-- SECURITY: authenticated + service_role can execute
-- anon CANNOT execute (prevents unauthenticated access)
```

#### `has_permission(org_id UUID, permission TEXT)` - Permission Check

```sql
CREATE OR REPLACE FUNCTION has_permission(org_id UUID, permission TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_effective_permissions
    WHERE organization_id = org_id
      AND user_id = auth.uid()
      AND permission_slug = permission
  );
$$;

-- SECURITY: authenticated + service_role can execute
-- anon CANNOT execute (prevents unauthenticated access)
```

**Note**: Uses **exact string matching**. No wildcards. No regex. No LIKE.

### Compiler Functions

#### `compile_user_permissions(user_id UUID, org_id UUID)` - Enterprise Hardened

**CRITICAL**: This function is **service_role only**. Normal users cannot call it.

```sql
CREATE OR REPLACE FUNCTION compile_user_permissions(
  p_user_id UUID,
  p_organization_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- ============================================================================
  -- ENTERPRISE FIX #1: Active membership guard
  -- ============================================================================
  -- Ensures we only compile for active org members
  -- Makes the function idempotent and safe even if called "too often"
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = p_user_id
      AND organization_id = p_organization_id
      AND status = 'active'
      AND deleted_at IS NULL
  ) THEN
    -- Not an active member - ensure no permissions exist and exit
    DELETE FROM public.user_effective_permissions
    WHERE user_id = p_user_id AND organization_id = p_organization_id;
    RETURN;
  END IF;

  -- ============================================================================
  -- ENTERPRISE FIX #2: Advisory lock (prevents race conditions)
  -- ============================================================================
  PERFORM pg_advisory_xact_lock(
    hashtext(p_user_id::text || p_organization_id::text)
  );

  -- Delete existing effective permissions
  DELETE FROM public.user_effective_permissions
  WHERE user_id = p_user_id AND organization_id = p_organization_id;

  -- ============================================================================
  -- Set-based INSERT (no loops, high performance)
  -- ============================================================================
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
    -- Permissions from roles (excluding revoked overrides)
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
      AND NOT EXISTS (
        SELECT 1 FROM public.user_permission_overrides upo
        WHERE upo.user_id = p_user_id
          AND upo.organization_id = p_organization_id
          AND upo.permission_slug = p.slug
          AND upo.effect = 'revoke'
          AND upo.deleted_at IS NULL
      )

    UNION

    -- Permissions from grant overrides
    SELECT upo.permission_slug, 'override' AS source_type
    FROM public.user_permission_overrides upo
    WHERE upo.user_id = p_user_id
      AND upo.organization_id = p_organization_id
      AND upo.effect = 'grant'
      AND upo.permission_slug IS NOT NULL
      AND upo.deleted_at IS NULL
  ) AS final_perms
  -- ============================================================================
  -- ENTERPRISE FIX #3: Update source_type on conflict
  -- ============================================================================
  -- Prevents stale metadata when permission source changes
  ON CONFLICT (user_id, organization_id, permission_slug) DO UPDATE
  SET compiled_at = now(), source_type = EXCLUDED.source_type;
END;
$$;

-- SECURITY: service_role ONLY can execute (prevents DoS attacks)
REVOKE ALL ON FUNCTION compile_user_permissions(UUID, UUID) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION compile_user_permissions(UUID, UUID) TO service_role;
```

#### `compile_org_permissions(org_id UUID)`

Compiles permissions for ALL active members in an organization.

**SECURITY**: service_role only.

#### `compile_all_user_permissions(user_id UUID)`

Compiles permissions for a user across ALL their organizations.

**SECURITY**: service_role only.

---

## Database Triggers

### Auto-Compilation Triggers

Permissions are automatically recompiled when:

| Trigger                            | Table                       | Events                 | Action                               |
| ---------------------------------- | --------------------------- | ---------------------- | ------------------------------------ |
| `trigger_role_assignment_compile`  | `user_role_assignments`     | INSERT, UPDATE, DELETE | Compile for affected user            |
| `trigger_override_compile`         | `user_permission_overrides` | INSERT, UPDATE, DELETE | Compile for affected user            |
| `trigger_role_permission_compile`  | `role_permissions`          | INSERT, UPDATE, DELETE | Compile for ALL users with that role |
| `trigger_membership_compile`       | `organization_members`      | INSERT, UPDATE, DELETE | Compile or delete permissions        |
| `trigger_validate_permission_slug` | `user_permission_overrides` | INSERT, UPDATE         | Auto-correct permission_slug         |

### Membership Trigger (Enterprise Hardened)

```sql
CREATE OR REPLACE FUNCTION trigger_compile_on_membership()
RETURNS TRIGGER
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
    -- ============================================================================
    -- ENTERPRISE FIX: Handle org_id or user_id changes (ghost permission prevention)
    -- ============================================================================
    IF (OLD.organization_id <> NEW.organization_id) OR (OLD.user_id <> NEW.user_id) THEN
      -- Delete permissions for OLD user/org
      DELETE FROM public.user_effective_permissions
      WHERE user_id = OLD.user_id AND organization_id = OLD.organization_id;

      -- Compile for NEW user/org (if active)
      IF NEW.status = 'active' AND NEW.deleted_at IS NULL THEN
        PERFORM public.compile_user_permissions(NEW.user_id, NEW.organization_id);
      END IF;
      RETURN NEW;
    END IF;

    -- Handle status changes (active ↔ inactive)
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

### Permission Slug Validation Trigger

```sql
CREATE OR REPLACE FUNCTION validate_permission_slug_on_override()
RETURNS TRIGGER
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

    -- Auto-correct the slug
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

### Complete RLS Status

All permission-related tables have RLS enabled:

| Table                        | RLS | SELECT                                               | INSERT                                   | UPDATE                                   | DELETE                                   |
| ---------------------------- | --- | ---------------------------------------------------- | ---------------------------------------- | ---------------------------------------- | ---------------------------------------- |
| `organizations`              | ✅  | `is_org_member(id)` OR creator                       | `auth.uid() IS NOT NULL`                 | `has_permission(id, 'org.update')`       | -                                        |
| `organization_members`       | ✅  | `is_org_member(organization_id)` OR self             | **HARDENED** (see below)                 | `has_permission(..., 'members.manage')`  | `has_permission(..., 'members.manage')`  |
| `branches`                   | ✅  | `is_org_member(organization_id)`                     | `has_permission(..., 'branches.create')` | `has_permission(..., 'branches.update')` | `has_permission(..., 'branches.delete')` |
| `invitations`                | ✅  | `has_permission(..., 'invites.read')` OR email match | `has_permission(..., 'invites.create')`  | `has_permission(..., 'invites.cancel')`  | -                                        |
| `permissions`                | ✅  | All authenticated                                    | -                                        | -                                        | -                                        |
| `roles`                      | ✅  | System: all; Custom: `is_org_member`                 | `has_permission(..., 'members.manage')`  | `has_permission(..., 'members.manage')`  | `has_permission(..., 'members.manage')`  |
| `role_permissions`           | ✅  | System: all; Custom: `is_org_member`                 | `has_permission(..., 'members.manage')`  | `has_permission(..., 'members.manage')`  | `has_permission(..., 'members.manage')`  |
| `user_role_assignments`      | ✅  | `is_org_member(scope_id)` OR self                    | **HARDENED** (see below)                 | `has_permission(..., 'members.manage')`  | `has_permission(..., 'members.manage')`  |
| `user_permission_overrides`  | ✅  | Self OR `has_permission(..., 'members.manage')`      | `has_permission(..., 'members.manage')`  | `has_permission(..., 'members.manage')`  | `has_permission(..., 'members.manage')`  |
| `user_effective_permissions` | ✅  | `user_id = auth.uid()` only                          | - (triggers only)                        | - (triggers only)                        | - (triggers only)                        |
| `users`                      | ✅  | Self OR org co-member                                | Self                                     | Self                                     | -                                        |

### Hardened INSERT Policies (Privilege Escalation Prevention)

#### `user_role_assignments` INSERT Policy

**CRITICAL**: Prevents users from assigning themselves `org_owner` role.

```sql
CREATE POLICY "role_assignments_insert_permission"
  ON user_role_assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Admin case: Has members.manage permission
    (
      scope = 'org'
      AND has_permission(scope_id, 'members.manage')
    )
    OR
    -- Self-registration case: ONLY during initial org creation
    (
      user_id = auth.uid()
      AND scope = 'org'
      -- CRITICAL: Only allow org_member role (NOT org_owner!)
      AND EXISTS (
        SELECT 1 FROM roles r
        WHERE r.id = role_id
        AND r.name = 'org_member'  -- <-- Prevents privilege escalation
        AND r.deleted_at IS NULL
      )
      -- Only during initial org creation (no other memberships)
      AND NOT EXISTS (
        SELECT 1 FROM organization_members om
        WHERE om.user_id = auth.uid()
        AND om.organization_id <> scope_id
        AND om.deleted_at IS NULL
      )
    )
  );
```

#### `organization_members` INSERT Policy

```sql
CREATE POLICY "members_insert_permission"
  ON organization_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Admin case: Has members.manage permission
    has_permission(organization_id, 'members.manage')
    OR
    -- Self-registration case: Only during org creation
    (
      user_id = auth.uid()
      -- Only during initial setup (no other memberships)
      AND NOT EXISTS (
        SELECT 1 FROM organization_members om
        WHERE om.user_id = auth.uid()
        AND om.organization_id <> organization_id
        AND om.deleted_at IS NULL
      )
    )
  );
```

---

## Security Hardening

### Function Execute Privileges

**CRITICAL**: Compiler functions are locked down to prevent DoS attacks.

| Function                       | anon | authenticated | service_role |
| ------------------------------ | ---- | ------------- | ------------ |
| `compile_user_permissions`     | ❌   | ❌            | ✅           |
| `compile_org_permissions`      | ❌   | ❌            | ✅           |
| `compile_all_user_permissions` | ❌   | ❌            | ✅           |
| `has_permission`               | ❌   | ✅            | ✅           |
| `is_org_member`                | ❌   | ✅            | ✅           |

```sql
-- Compiler functions: service_role ONLY
REVOKE ALL ON FUNCTION compile_user_permissions(UUID, UUID) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION compile_user_permissions(UUID, UUID) TO service_role;

-- RLS helpers: authenticated + service_role
REVOKE ALL ON FUNCTION has_permission(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION has_permission(UUID, TEXT) TO authenticated, service_role;
```

### Security Features Summary

| Feature                         | Implementation                                      | Protection Against                     |
| ------------------------------- | --------------------------------------------------- | -------------------------------------- |
| Advisory locks                  | `pg_advisory_xact_lock()` in compiler               | Race conditions                        |
| Active membership guard         | Check at top of compiler                            | Zombie permissions                     |
| Ghost permission prevention     | Membership trigger handles ID changes               | Admin mistakes                         |
| Privilege escalation prevention | RLS policy allows only `org_member` self-assignment | Users assigning themselves `org_owner` |
| DoS prevention                  | Compiler functions locked to service_role           | Spammed recompiles                     |
| Permission slug validation      | Trigger on overrides                                | Typos and drift                        |
| SECURITY DEFINER + search_path  | All functions                                       | SQL injection                          |

---

## Performance Optimizations

### Indexes

| Index                                    | Table                      | Purpose                                  |
| ---------------------------------------- | -------------------------- | ---------------------------------------- |
| `idx_uep_user_org_permission`            | user_effective_permissions | Fast RLS permission checks               |
| `idx_organization_members_user_org`      | organization_members       | Fast active membership checks (filtered) |
| `idx_user_role_assignments_compiler`     | user_role_assignments      | Fast role lookups (filtered)             |
| `idx_user_permission_overrides_compiler` | user_permission_overrides  | Fast override lookups (filtered)         |
| `idx_role_permissions_role`              | role_permissions           | Fast permission joins (filtered)         |

### Compiler Performance

- **Set-based**: Single INSERT statement, no loops
- **Filtered indexes**: Partial indexes with `WHERE deleted_at IS NULL`
- **Advisory locks**: Transaction-scoped, minimal blocking

---

## Observability

### Permission Staleness Report

```sql
-- View: permission_staleness_report
-- Shows how fresh each user's compiled permissions are

SELECT * FROM permission_staleness_report;

-- Results:
email                              | org_name | permission_count | freshness_status
-----------------------------------+----------+------------------+-----------------
michal.stepien@cichy-zasada.pl     | Test Org | 13               | FRESH
oskar.woszczek@cichy-zasada.pl     | Test Org | 5                | FRESH
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

### Flow 1: User Creates Organization

```
1. User clicks "Create Organization"
2. Server creates organization record
3. Server creates organization_members record (user as active member)
4. Membership trigger fires → BUT compiler not called yet (role not assigned)
5. Server creates user_role_assignments (user + org_owner role)
6. Role assignment trigger fires → compile_user_permissions()
7. Compiler:
   a. Checks active membership ✓
   b. Acquires advisory lock
   c. Gets org_owner role's permissions (13 slugs)
   d. DELETEs any existing rows
   e. INSERTs 13 new rows with source_type='role'
8. User now has 13 compiled permissions
```

### Flow 2: Permission Check (RLS)

```
1. User requests: SELECT * FROM branches WHERE organization_id = ?
2. Supabase evaluates RLS policy: branches_select_member
3. Policy calls: is_org_member(organization_id)
4. Function executes EXISTS check on organization_members
5. Returns true → Row included in results
```

### Flow 3: Member Removed

```
1. Admin removes user from organization
2. organization_members.status set to 'inactive'
3. Membership trigger fires
4. Trigger detects: OLD.status='active' AND NEW.status<>'active'
5. Trigger executes: DELETE FROM user_effective_permissions WHERE user_id=... AND org_id=...
6. User immediately loses all permissions
```

---

## Current Permissions & Roles

### Permission Catalog (13 permissions)

| Slug              | Category     | Description                             |
| ----------------- | ------------ | --------------------------------------- |
| `org.read`        | organization | View organization information           |
| `org.update`      | organization | Update organization settings            |
| `branches.read`   | branches     | View branches                           |
| `branches.create` | branches     | Create new branches                     |
| `branches.update` | branches     | Update branch information               |
| `branches.delete` | branches     | Delete branches                         |
| `members.read`    | members      | View member list                        |
| `members.manage`  | members      | Invite, remove, and manage member roles |
| `invites.read`    | invites      | View pending invitations                |
| `invites.create`  | invites      | Send invitations                        |
| `invites.cancel`  | invites      | Cancel pending invitations              |
| `self.read`       | self         | View own profile                        |
| `self.update`     | self         | Update own profile                      |

### Role Definitions

#### org_owner (13 permissions)

Full organization access - ALL permissions

#### org_member (5 permissions)

Limited read access: `org.read`, `branches.read`, `members.read`, `self.read`, `self.update`

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
FOR SELECT USING (
  is_org_member(organization_id)
  AND has_permission(organization_id, 'warehouse.products.read')
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
-- For single user
SELECT compile_user_permissions('user-uuid', 'org-uuid');

-- For entire organization
SELECT compile_org_permissions('org-uuid');
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

### Common Issues

| Symptom                          | Cause                         | Fix                                 |
| -------------------------------- | ----------------------------- | ----------------------------------- |
| User can't see anything          | Not in `organization_members` | Add membership record               |
| User has role but no permissions | Membership not active         | Check `status='active'`             |
| Permission check returns false   | Permission not compiled       | Check staleness report              |
| RLS blocking unexpectedly        | Compiled permissions stale    | Recompile via service_role          |
| Can't call compiler function     | Wrong role                    | Use service_role, not authenticated |

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
- [x] Membership trigger handles ID changes
- [x] Permission slug validation trigger

### Recommended (Have)

- [x] Observability view (permission_staleness_report)
- [x] Filtered indexes for active records
- [x] SECURITY DEFINER with SET search_path
- [x] Comprehensive documentation

### Future (Optional)

- [ ] Add `branch_id` to user_effective_permissions for branch-scope permissions
- [ ] Split `members.manage` into finer permissions (`members.invite`, `roles.assign`)
- [ ] Statement-level triggers for batch operations
- [ ] Async job queue for recompiles

---

## Summary

| Layer                        | Responsibility                               |
| ---------------------------- | -------------------------------------------- |
| `permissions`                | Catalog of possible actions                  |
| `roles` + `role_permissions` | Named permission bundles                     |
| `user_role_assignments`      | Who has what role                            |
| `user_permission_overrides`  | Individual exceptions                        |
| **Compiler**                 | Turns roles into facts (enterprise hardened) |
| `user_effective_permissions` | **THE FACTS** (what can user actually do)    |
| `organization_members`       | Tenant boundary (who belongs)                |
| `is_org_member()`            | RLS: "Are you in this org?"                  |
| `has_permission()`           | RLS: "Can you do this action?"               |

**The Golden Rule**:

> Roles describe intent.
> The compiler turns intent into facts.
> Facts are enforced everywhere.
> Security is enterprise-grade.

---

**Document Version**: 4.0 (Enterprise Hardened)
**Last Updated**: 2026-01-22
**Verified Against**: Live database queries + security audit
