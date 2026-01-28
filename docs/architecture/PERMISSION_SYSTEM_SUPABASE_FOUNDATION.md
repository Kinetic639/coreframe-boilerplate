# Permission System - Supabase Foundation

**Purpose**: Complete reference for all Supabase tables, functions, triggers, and RLS patterns required for the enterprise-grade V2 permission system.

**Version**: V2 ("Compile, Don't Evaluate")
**Last Updated**: 2026-01-21

---

## Table of Contents

1. [Overview](#overview)
2. [Required Tables](#a-tables-you-need-core)
3. [Required Functions](#b-functions-you-need-core)
4. [Required Triggers](#c-triggers-you-need)
5. [RLS Policy Patterns](#d-rls-policies-you-need)
6. [Enterprise Hardening](#e-enterprise-hardening)
7. [The has_permission_safe() Function](#f-the-has_permission_safe-function)
8. [Quick Mental Model](#g-quick-mental-model)
9. [Complete SQL Reference](#h-complete-sql-reference)

---

## Overview

The V2 permission system requires specific Supabase infrastructure to work at enterprise grade. This document lists every table, function, and trigger needed, explaining **what it does** and **why it's required**.

### Core Principle

```
┌─────────────────────────────────────────────────────────────┐
│  INPUTS (Configuration)                                      │
│  • roles + role_permissions = permission bundles             │
│  • user_role_assignments = who has what bundle               │
│  • user_permission_overrides = exceptions                    │
└─────────────────────────────────────────────────────────────┘
                              ↓
                     COMPILER (Triggers)
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  OUTPUT (Facts)                                              │
│  • user_effective_permissions = THE TRUTH                    │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  ENFORCEMENT (RLS)                                           │
│  • is_org_member() = tenant boundary                         │
│  • has_permission() = authority check                        │
└─────────────────────────────────────────────────────────────┘
```

---

## A) Tables You Need (Core)

### 1) `organizations`

**Answers**: "What tenants exist?"

**Why needed**: Tenant root. Every org-owned row points here.

```sql
CREATE TABLE organizations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE,
  created_by  UUID NOT NULL REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);
```

---

### 2) `organization_members` ✅ (Tenant Boundary)

**Answers**: "Is this user inside this org?"

**Why needed**: Membership is NOT the same as permissions. It's the **first security wall**.

**Rule**: Most SELECT policies start with this boundary.

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

CREATE INDEX idx_org_members_user ON organization_members(user_id);
CREATE INDEX idx_org_members_org ON organization_members(organization_id);
CREATE INDEX idx_org_members_org_user_status ON organization_members(organization_id, user_id, status);
```

---

### 3) `permissions` ✅ (Permission Catalog / Dictionary)

**Answers**: "What actions exist in the product?"

**Why needed**: Consistent naming, UI listing, role editor, auditing.

```sql
CREATE TABLE permissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT UNIQUE NOT NULL,
  category    TEXT NOT NULL,
  action      TEXT,
  description TEXT,
  scope_types TEXT[],  -- e.g., '{org,branch}' for future
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_permissions_slug ON permissions(slug);
CREATE INDEX idx_permissions_category ON permissions(category);
```

---

### 4) `roles` ✅ (Role Definitions)

**Answers**: "What bundles of permissions exist?"

**Why needed**: System roles + org custom roles.

**Key distinction**:

- `organization_id = NULL` → System role (applies to all orgs)
- `organization_id = UUID` → Custom org role

```sql
CREATE TABLE roles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  description     TEXT,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  scope_type      TEXT NOT NULL DEFAULT 'org',  -- 'org' or 'branch'
  is_basic        BOOLEAN DEFAULT false,  -- true = system template, cannot delete
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  deleted_at      TIMESTAMPTZ,

  -- System roles unique by name globally
  -- Org roles unique by name within org
  UNIQUE NULLS NOT DISTINCT (organization_id, name)
);

CREATE INDEX idx_roles_org ON roles(organization_id);
CREATE INDEX idx_roles_name ON roles(name);
```

---

### 5) `role_permissions` ✅ (Role → Permissions Mapping)

**Answers**: "What permissions does this role grant?"

**Why needed**: Clean, editable role matrix.

**Note**: V2 is grants-only. No role-level denies needed.

```sql
CREATE TABLE role_permissions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id       UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ DEFAULT now(),
  deleted_at    TIMESTAMPTZ,

  UNIQUE(role_id, permission_id)
);

CREATE INDEX idx_role_perms_role ON role_permissions(role_id);
CREATE INDEX idx_role_perms_perm ON role_permissions(permission_id);
```

---

### 6) `user_role_assignments` ✅ (Who Has What Role)

**Answers**: "Which roles does this user have in this org/branch?"

**Why needed**: Role assignment is the **input to compilation**.

```sql
CREATE TABLE user_role_assignments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id    UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  scope      TEXT NOT NULL CHECK (scope IN ('org', 'branch')),
  scope_id   UUID NOT NULL,  -- organization_id or branch_id
  created_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ,

  UNIQUE(user_id, role_id, scope, scope_id)
);

CREATE INDEX idx_role_assign_user ON user_role_assignments(user_id);
CREATE INDEX idx_role_assign_scope ON user_role_assignments(scope, scope_id);
CREATE INDEX idx_role_assign_role ON user_role_assignments(role_id);
```

---

### 7) `user_permission_overrides` ✅ (Optional but Enterprise-Useful)

**Answers**: "What exceptions apply to this user?"

**Why needed**: Real businesses need exceptions ("everyone can, except Bob").

**Important**: Overrides must be applied at **compile-time**, not runtime.

```sql
CREATE TABLE user_permission_overrides (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id       UUID REFERENCES branches(id) ON DELETE CASCADE,  -- Future branch scope
  permission_id   UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  effect          TEXT NOT NULL DEFAULT 'grant' CHECK (effect IN ('grant', 'revoke')),
  permission_slug TEXT,  -- Denormalized (auto-populated via trigger)
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  deleted_at      TIMESTAMPTZ,

  UNIQUE(user_id, organization_id, permission_id)
);

CREATE INDEX idx_overrides_user_org ON user_permission_overrides(user_id, organization_id);
```

---

### 8) `user_effective_permissions` ✅ (THE FACTS TABLE)

**Answers**: "Exactly what can this user do in this org?"

**Why needed**: This is the **enterprise trick** — RLS only checks facts.

```sql
CREATE TABLE user_effective_permissions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  permission_slug  TEXT NOT NULL,
  source_type      TEXT NOT NULL DEFAULT 'role',  -- 'role' or 'override'
  source_id        UUID,  -- role_id or override_id
  created_at       TIMESTAMPTZ DEFAULT now(),
  compiled_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(user_id, organization_id, permission_slug)
);

-- CRITICAL indexes for RLS performance
CREATE INDEX idx_uep_user_org ON user_effective_permissions(user_id, organization_id);
CREATE INDEX idx_uep_permission ON user_effective_permissions(permission_slug);
CREATE INDEX idx_uep_user_org_perm ON user_effective_permissions(user_id, organization_id, permission_slug);
```

---

## B) Functions You Need (Core)

### 1) `is_org_member(org_id)` → boolean ✅

**Used by**: RLS as the **tenant boundary**.

**What it does**: Checks `organization_members` for `(org_id, auth.uid(), status='active')`.

**Why needed**: Stops cross-tenant reads immediately. Makes most SELECT policies simple.

```sql
CREATE OR REPLACE FUNCTION public.is_org_member(org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE organization_id = org_id
      AND user_id = auth.uid()
      AND status = 'active'
      AND deleted_at IS NULL
  );
$$;
```

---

### 2) `has_permission(org_id, permission)` → boolean ✅

**Used by**: RLS for **authority checks**.

**What it does**: Exact match lookup in `user_effective_permissions`.

**Why needed**: Avoids wildcards/precedence logic in RLS. Predictable, fast, auditable.

```sql
CREATE OR REPLACE FUNCTION public.has_permission(org_id UUID, permission TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_effective_permissions
    WHERE organization_id = org_id
      AND user_id = auth.uid()
      AND permission_slug = permission
  );
$$;
```

---

### 3) Compiler Functions ✅

**These are NOT called by RLS** — they create the facts.

#### a) `compile_user_permissions(user_id, org_id)`

**What it does**:

1. Gather roles from `user_role_assignments` for that org
2. Expand role permissions
3. Apply overrides (grant adds, revoke removes)
4. Delete old facts in `user_effective_permissions`
5. Insert new facts

```sql
CREATE OR REPLACE FUNCTION public.compile_user_permissions(p_user_id UUID, p_org_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  role_perms TEXT[];
  grant_overrides TEXT[];
  revoke_overrides TEXT[];
  final_perms TEXT[];
BEGIN
  -- Step 1: Get all permissions from assigned roles
  SELECT ARRAY_AGG(DISTINCT p.slug) INTO role_perms
  FROM public.user_role_assignments ura
  JOIN public.role_permissions rp ON ura.role_id = rp.role_id AND rp.deleted_at IS NULL
  JOIN public.permissions p ON rp.permission_id = p.id
  WHERE ura.user_id = p_user_id
    AND ura.scope = 'org'
    AND ura.scope_id = p_org_id
    AND ura.deleted_at IS NULL;

  -- Step 2: Get grant overrides
  SELECT ARRAY_AGG(p.slug) INTO grant_overrides
  FROM public.user_permission_overrides upo
  JOIN public.permissions p ON upo.permission_id = p.id
  WHERE upo.user_id = p_user_id
    AND upo.organization_id = p_org_id
    AND upo.effect = 'grant'
    AND upo.deleted_at IS NULL;

  -- Step 3: Get revoke overrides
  SELECT ARRAY_AGG(p.slug) INTO revoke_overrides
  FROM public.user_permission_overrides upo
  JOIN public.permissions p ON upo.permission_id = p.id
  WHERE upo.user_id = p_user_id
    AND upo.organization_id = p_org_id
    AND upo.effect = 'revoke'
    AND upo.deleted_at IS NULL;

  -- Step 4: Calculate final permissions
  -- (role_perms + grant_overrides) - revoke_overrides
  SELECT ARRAY_AGG(DISTINCT slug) INTO final_perms
  FROM (
    SELECT unnest(COALESCE(role_perms, ARRAY[]::TEXT[])) AS slug
    UNION
    SELECT unnest(COALESCE(grant_overrides, ARRAY[]::TEXT[]))
  ) combined
  WHERE slug != ALL(COALESCE(revoke_overrides, ARRAY[]::TEXT[]));

  -- Handle NULL
  IF final_perms IS NULL THEN
    final_perms := ARRAY[]::TEXT[];
  END IF;

  -- Step 5: Delete old permissions not in final set
  DELETE FROM public.user_effective_permissions
  WHERE user_id = p_user_id
    AND organization_id = p_org_id
    AND permission_slug != ALL(final_perms);

  -- Step 6: Upsert new permissions
  INSERT INTO public.user_effective_permissions
    (id, user_id, organization_id, permission_slug, source_type, compiled_at)
  SELECT
    gen_random_uuid(),
    p_user_id,
    p_org_id,
    unnest(final_perms),
    'role',
    now()
  ON CONFLICT (user_id, organization_id, permission_slug)
  DO UPDATE SET compiled_at = now();
END;
$$;
```

#### b) `compile_org_permissions(org_id)` (Admin Convenience)

**What it does**: Recompile all active members in org.

```sql
CREATE OR REPLACE FUNCTION public.compile_org_permissions(p_org_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Recompile for all active members
  PERFORM public.compile_user_permissions(om.user_id, p_org_id)
  FROM public.organization_members om
  WHERE om.organization_id = p_org_id
    AND om.status = 'active'
    AND om.deleted_at IS NULL;
END;
$$;
```

#### c) `compile_all_user_permissions(user_id)` (Optional Convenience)

**What it does**: Recompile user for all their orgs.

```sql
CREATE OR REPLACE FUNCTION public.compile_all_user_permissions(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  PERFORM public.compile_user_permissions(p_user_id, om.organization_id)
  FROM public.organization_members om
  WHERE om.user_id = p_user_id
    AND om.status = 'active'
    AND om.deleted_at IS NULL;
END;
$$;
```

**Why compilers are required**:

- Keeps runtime enforcement dead-simple
- Prevents "permission resolver bugs" at read-time
- Scales better and is easier to debug

---

## C) Triggers You Need

Compilation must happen **automatically** when inputs change.

### 1) Trigger on `user_role_assignments`

**When**: INSERT/UPDATE/DELETE
**Action**: Compile for that (user, org)

```sql
CREATE OR REPLACE FUNCTION public.trigger_compile_on_role_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  target_user_id UUID;
  target_org_id UUID;
BEGIN
  -- Determine user and org from OLD or NEW
  IF TG_OP = 'DELETE' THEN
    target_user_id := OLD.user_id;
    target_org_id := OLD.scope_id;
  ELSE
    target_user_id := NEW.user_id;
    target_org_id := NEW.scope_id;
  END IF;

  -- Only compile for org scope (branch scope needs different handling)
  IF (TG_OP = 'DELETE' AND OLD.scope = 'org') OR
     (TG_OP != 'DELETE' AND NEW.scope = 'org') THEN
    PERFORM public.compile_user_permissions(target_user_id, target_org_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trigger_role_assignment_compile
  AFTER INSERT OR UPDATE OR DELETE ON public.user_role_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_compile_on_role_assignment();
```

---

### 2) Trigger on `role_permissions`

**When**: Role permission mapping changes
**Action**: Recompile all users that have that role assigned

```sql
CREATE OR REPLACE FUNCTION public.trigger_compile_on_role_permission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  target_role_id UUID;
BEGIN
  -- Get the affected role
  IF TG_OP = 'DELETE' THEN
    target_role_id := OLD.role_id;
  ELSE
    target_role_id := NEW.role_id;
  END IF;

  -- Recompile for all users with this role
  PERFORM public.compile_user_permissions(ura.user_id, ura.scope_id)
  FROM public.user_role_assignments ura
  WHERE ura.role_id = target_role_id
    AND ura.scope = 'org'
    AND ura.deleted_at IS NULL;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trigger_role_permission_compile
  AFTER INSERT OR UPDATE OR DELETE ON public.role_permissions
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_compile_on_role_permission();
```

---

### 3) Trigger on `user_permission_overrides`

**When**: INSERT/UPDATE/DELETE
**Action**: Compile for that (user, org)

```sql
CREATE OR REPLACE FUNCTION public.trigger_compile_on_override()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  target_user_id UUID;
  target_org_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_user_id := OLD.user_id;
    target_org_id := OLD.organization_id;
  ELSE
    target_user_id := NEW.user_id;
    target_org_id := NEW.organization_id;
  END IF;

  PERFORM public.compile_user_permissions(target_user_id, target_org_id);

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trigger_override_compile
  AFTER INSERT OR UPDATE OR DELETE ON public.user_permission_overrides
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_compile_on_override();
```

---

### 4) Trigger on `organization_members` (Critical for Security)

**When**: Membership becomes inactive or deleted
**Action**: Purge compiled permissions

```sql
CREATE OR REPLACE FUNCTION public.trigger_cleanup_on_membership_change()
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
  EXECUTE FUNCTION public.trigger_cleanup_on_membership_change();
```

**Why triggers matter**:

- Avoids stale permissions
- Avoids "works in UI but blocked by RLS"
- Keeps the facts table always aligned

---

## D) RLS Policies You Need

Enterprise-grade means:

- **Tenant boundary** for org-owned tables
- **Permission check** for mutations (and for sensitive reads)

### Standard Patterns

#### SELECT (Common Table)

```sql
CREATE POLICY "table_select_member"
ON table_name
FOR SELECT
USING (is_org_member(organization_id));
```

#### INSERT

```sql
CREATE POLICY "table_insert_permission"
ON table_name
FOR INSERT
WITH CHECK (
  is_org_member(organization_id)
  AND has_permission(organization_id, 'entity.create')
);
```

#### UPDATE

```sql
CREATE POLICY "table_update_permission"
ON table_name
FOR UPDATE
USING (
  is_org_member(organization_id)
  AND has_permission(organization_id, 'entity.update')
)
WITH CHECK (
  is_org_member(organization_id)
  AND has_permission(organization_id, 'entity.update')
);
```

#### DELETE

```sql
CREATE POLICY "table_delete_permission"
ON table_name
FOR DELETE
USING (
  is_org_member(organization_id)
  AND has_permission(organization_id, 'entity.delete')
);
```

#### Sensitive SELECT (Permission-Gated Reads)

```sql
CREATE POLICY "sensitive_select_permission"
ON sensitive_table
FOR SELECT
USING (
  is_org_member(organization_id)
  AND has_permission(organization_id, 'entity.read_sensitive')
);
```

---

## E) Enterprise Hardening

### 1) FORCE ROW LEVEL SECURITY

Prevents table owner bypass mistakes.

```sql
ALTER TABLE org_owned_table FORCE ROW LEVEL SECURITY;
```

---

### 2) Immutable Column Protection

Triggers to prevent changing critical columns:

```sql
CREATE OR REPLACE FUNCTION prevent_immutable_column_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
    RAISE EXCEPTION 'Cannot change organization_id';
  END IF;
  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'Cannot change created_by';
  END IF;
  RETURN NEW;
END;
$$;
```

---

### 3) Audit Log Table (Recommended for Enterprise)

Track who changed roles, overrides, membership:

```sql
CREATE TABLE permission_audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id   UUID REFERENCES auth.users(id),
  target_user_id  UUID REFERENCES auth.users(id),
  organization_id UUID REFERENCES organizations(id),
  action          TEXT NOT NULL,  -- 'role_assigned', 'role_removed', 'override_granted', etc.
  table_name      TEXT NOT NULL,
  record_id       UUID,
  before_state    JSONB,
  after_state     JSONB,
  created_at      TIMESTAMPTZ DEFAULT now()
);
```

---

### 4) Branch Scope Support (Future)

If you want branch-level permissions later:

**Option A**: Extend `user_effective_permissions`:

```sql
ALTER TABLE user_effective_permissions
ADD COLUMN branch_id UUID REFERENCES branches(id),
ADD COLUMN scope TEXT DEFAULT 'org';
```

**Option B**: Create separate table:

```sql
CREATE TABLE user_effective_branch_permissions (
  user_id         UUID,
  organization_id UUID,
  branch_id       UUID,
  permission_slug TEXT,
  ...
);
```

And add:

```sql
CREATE FUNCTION has_branch_permission(org_id UUID, branch_id UUID, permission TEXT)
...
```

---

## F) The `has_permission_safe()` Function

### What Is It?

`has_permission_safe()` is **not** a different permission system. It's a **defensive wrapper** around `has_permission()` to avoid accidental lock-outs and RLS foot-guns.

**Think of it as**: "Permission check that never explodes the app if permissions aren't seeded yet."

### The Problem It Solves

In early stages of development (or during migrations), this happens:

1. You create a new table
2. You add RLS: `has_permission(org_id, 'warehouse.products.read')`
3. **BUT**:
   - The permission slug doesn't exist yet
   - No role has been assigned that permission
   - Compilation hasn't run yet

**Result**:

- RLS blocks everything
- Even org owners suddenly see nothing
- App looks "broken", not "secured"

This is extremely common during:

- Early development
- Module rollouts
- Staging/preview environments
- Partial migrations

### What `has_permission_safe()` Does

It answers: **"If this permission doesn't exist yet, should we default to allow or deny?"**

Typical safe default during early rollout:

- **ALLOW** for org owners
- **DENY** for everyone else

### Implementation Options

#### Option A — Safe for Early Development (Owner Fallback)

```sql
CREATE OR REPLACE FUNCTION public.has_permission_safe(
  org_id UUID,
  permission TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT
    -- If permission exists in compiled facts → enforce it
    EXISTS (
      SELECT 1
      FROM public.user_effective_permissions
      WHERE organization_id = org_id
        AND user_id = auth.uid()
        AND permission_slug = permission
    )
    OR
    -- Fallback: allow org_owner when permission not yet compiled
    EXISTS (
      SELECT 1
      FROM public.user_role_assignments ura
      JOIN public.roles r ON r.id = ura.role_id
      WHERE ura.user_id = auth.uid()
        AND ura.scope = 'org'
        AND ura.scope_id = org_id
        AND r.name = 'org_owner'
        AND r.deleted_at IS NULL
        AND ura.deleted_at IS NULL
    );
$$;
```

**Behavior**:

- If permission is compiled → normal enforcement
- If permission doesn't exist → org_owner still works
- Everyone else → denied

#### Option B — Strict Production-Safe Version (Deny If Missing)

```sql
CREATE OR REPLACE FUNCTION public.has_permission_safe(
  org_id UUID,
  permission TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_effective_permissions
    WHERE organization_id = org_id
      AND user_id = auth.uid()
      AND permission_slug = permission
  );
$$;
```

This is functionally identical to `has_permission()` — useful when you want to standardize calls without changing policies later.

### When to Use Each

#### ✅ Use `has_permission_safe()` When:

- You are actively developing new modules
- Permissions may be added incrementally
- You don't want org owners accidentally locked out
- You are in early-stage / MVP / beta

```sql
USING (
  is_org_member(organization_id)
  AND has_permission_safe(organization_id, 'warehouse.products.read')
)
```

#### ❌ Do NOT Use `has_permission_safe()` When:

- You are fully in production
- All permissions are properly seeded
- You want strict, explicit security guarantees
- You're dealing with:
  - Billing / payments
  - PII (Personal Identifiable Information)
  - Audit logs
  - Legal data

In those cases, always use:

```sql
has_permission(organization_id, 'billing.read')
```

### Recommended Lifecycle Approach

| Phase                              | Function                                                                         | Reason                                 |
| ---------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------- |
| **Phase 1 — Early development**    | `has_permission_safe()`                                                          | Prevent accidental lockouts, move fast |
| **Phase 2 — Module stabilization** | Seed all permissions, assign to roles, verify compilation                        |                                        |
| **Phase 3 — Production hardening** | Replace with `has_permission()` OR redefine `has_permission_safe()` to be strict | Missing permissions = intentional deny |

**Advantage**: Policies don't need to change — only function behavior tightens.

### Key Takeaway

| Function                | Behavior                                              |
| ----------------------- | ----------------------------------------------------- |
| `has_permission()`      | **Strict authority** — missing = denied               |
| `has_permission_safe()` | **Development safety net** — missing = owner fallback |

Both rely on the same compiled facts table. The difference is only how missing permissions are treated.

---

## G) Quick Mental Model

```
organization_members     = WHO BELONGS
roles + role_permissions = WHAT BUNDLES EXIST
user_role_assignments    = WHO GOT WHICH BUNDLE
user_permission_overrides = EXCEPTIONS
compiler                 = TURN INTENT INTO FACTS
user_effective_permissions = THE FACTS

RLS uses ONLY:
  - is_org_member()
  - has_permission()
```

### The Golden Rules

> **Membership answers where you exist.**
> **Permissions answer what power you have.**
> **Roles describe intent.**
> **The compiler turns intent into facts.**
> **Facts are enforced everywhere.**

---

## H) Complete SQL Reference

### All Tables (Summary)

| Table                        | Purpose                        | Required?   |
| ---------------------------- | ------------------------------ | ----------- |
| `organizations`              | Tenant root                    | ✅ Yes      |
| `organization_members`       | Tenant boundary                | ✅ Yes      |
| `permissions`                | Permission catalog             | ✅ Yes      |
| `roles`                      | Role definitions               | ✅ Yes      |
| `role_permissions`           | Role → Permission mapping      | ✅ Yes      |
| `user_role_assignments`      | Who has what role              | ✅ Yes      |
| `user_permission_overrides`  | Per-user exceptions            | 🟡 Optional |
| `user_effective_permissions` | Compiled facts (THE KEY TABLE) | ✅ Yes      |

### All Functions (Summary)

| Function                                    | Purpose                  | Called By      |
| ------------------------------------------- | ------------------------ | -------------- |
| `is_org_member(org_id)`                     | Tenant boundary check    | RLS            |
| `has_permission(org_id, permission)`        | Permission check         | RLS            |
| `has_permission_safe(org_id, permission)`   | Development safety net   | RLS (optional) |
| `compile_user_permissions(user_id, org_id)` | Compile facts for user   | Triggers       |
| `compile_org_permissions(org_id)`           | Compile all users in org | Admin          |
| `compile_all_user_permissions(user_id)`     | Compile user in all orgs | Admin          |

### All Triggers (Summary)

| Trigger                                 | Table                       | Action                            |
| --------------------------------------- | --------------------------- | --------------------------------- |
| `trigger_role_assignment_compile`       | `user_role_assignments`     | Compile for user                  |
| `trigger_role_permission_compile`       | `role_permissions`          | Compile all users with role       |
| `trigger_override_compile`              | `user_permission_overrides` | Compile for user                  |
| `trigger_membership_permission_cleanup` | `organization_members`      | Purge permissions on deactivation |

---

**Document Version**: 1.0
**Created**: 2026-01-21
**Purpose**: Complete Supabase infrastructure reference for Permission System V2
