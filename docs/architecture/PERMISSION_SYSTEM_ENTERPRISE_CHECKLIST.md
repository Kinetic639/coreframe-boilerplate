# Permission System V2 - Enterprise-Grade Checklist

**Purpose**: Comprehensive list of fixes, improvements, and hardening measures to make the permission system bulletproof and enterprise-ready.

**Status**: Planning Phase
**Last Updated**: 2026-01-21

---

## Quick Reference Checklist

### Critical (Security)

- [ ] Make every write policy require BOTH `is_org_member(...)` AND `has_permission(...)`
- [ ] Invalidate compiled permissions on membership changes (inactive/deleted)
- [ ] Harden SECURITY DEFINER functions (`SET search_path TO ''`, explicit schema references)
- [ ] Enforce integrity of permission slugs (FK/permission_id, prevent typos)

### Important (Reliability)

- [ ] Enforce integrity of overrides (permission_id ↔ permission_slug, uniqueness)
- [ ] Add branch scope properly OR remove branch API until ready
- [ ] Prevent self-lockout / privilege bricking (owner cannot remove last admin, etc.)
- [ ] Make compilation transactional + idempotent (no partial states)

### Recommended (Operations)

- [ ] Add "staleness detection" + repair path (compiled_at checks, admin tools)
- [ ] Optimize compilation for scale (batching / queue for large orgs)
- [ ] Standardize permission naming + action taxonomy (module.entity.action)
- [ ] RLS policy consistency audit (same patterns everywhere)

### Nice-to-Have (Enterprise Features)

- [ ] Add audit logging for permission changes (who changed what, when)
- [ ] Add tests that simulate real RLS behavior (membership removal, override precedence, etc.)
- [ ] Document "source of truth" rules for devs (no ad-hoc checks outside this model)

---

## Detailed Explanations

---

### 1) Require Membership + Permission for Every Mutation

**Priority**: 🔴 CRITICAL

**Why**: Your compiled table can become stale (e.g., user removed from org but still has rows in `user_effective_permissions`). If any INSERT/UPDATE/DELETE policy checks only `has_permission()`, stale rows could authorize changes.

**Current State**: All mutation policies check ONLY `has_permission()` without `is_org_member()`:

- `branches` INSERT: `has_permission(organization_id, 'branches.create')`
- `branches` UPDATE: `has_permission(organization_id, 'branches.update')`
- `invitations` INSERT: `has_permission(organization_id, 'invites.create')`
- `organization_members` INSERT/UPDATE/DELETE: `has_permission(organization_id, 'members.manage')`
- etc.

**How to Implement**:

For every table with `organization_id`, enforce both:

1. **Tenant boundary**: `is_org_member(organization_id)`
2. **Action permission**: `has_permission(organization_id, 'x.y')`

**Implementation Pattern**:

```sql
-- SELECT (often membership-only is enough)
USING (is_org_member(organization_id));

-- INSERT
WITH CHECK (
  is_org_member(organization_id)
  AND has_permission(organization_id, 'branches.create')
);

-- UPDATE
USING (
  is_org_member(organization_id)
  AND has_permission(organization_id, 'branches.update')
);

-- DELETE
USING (
  is_org_member(organization_id)
  AND has_permission(organization_id, 'branches.delete')
);
```

**Even Safer Alternative**: Bake membership into `has_permission()` so devs can't forget:

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
    JOIN public.organization_members om
      ON om.organization_id = uep.organization_id
     AND om.user_id = uep.user_id
     AND om.status = 'active'
     AND om.deleted_at IS NULL
    WHERE uep.organization_id = org_id
      AND uep.user_id = auth.uid()
      AND uep.permission_slug = permission
  );
$$;
```

---

### 2) Invalidate Compiled Permissions on Membership Changes

**Priority**: 🔴 CRITICAL

**Why**: "Compile, don't evaluate" only stays secure if you also handle the events that should remove access. Membership is the main boundary.

**Current State**: No trigger exists on `organization_members` to clean up compiled permissions when:

- `status` changes away from `'active'`
- `deleted_at` is set (soft delete)
- Row is hard deleted

**How to Implement**:

Add trigger on `organization_members` for:

- `status` changed away from `'active'`
- `deleted_at` set (soft delete)
- DELETE operation

**Action**:

1. Delete `user_effective_permissions` for that `(user_id, organization_id)`
2. Optionally soft-delete `user_role_assignments` for that org
3. Optionally recompile (should yield empty set if not active)

**Implementation**:

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

      -- Optionally soft-delete role assignments
      UPDATE public.user_role_assignments
      SET deleted_at = now()
      WHERE user_id = NEW.user_id
        AND scope = 'org'
        AND scope_id = NEW.organization_id
        AND deleted_at IS NULL;
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

### 3) Harden SECURITY DEFINER Functions

**Priority**: 🟠 IMPORTANT

**Why**: `SECURITY DEFINER` functions run with elevated privileges. Without hardening, you can risk `search_path` issues or accidental object shadowing.

**Current State**: Functions like `has_permission()` and `is_org_member()` are `SECURITY DEFINER` but may not have hardened `search_path`.

**How to Implement**:

1. Add `SET search_path TO ''` (or a safe explicit list)
2. Fully qualify table references with `public.`
3. Keep them `STABLE` and minimal

**Implementation**:

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

### 4) Enforce Permission Slug Integrity

**Priority**: 🔴 CRITICAL (for bulletproof)

**Why**: `permission_slug` as TEXT is easy to typo during compilation or manual edits. A typo silently breaks access or (worse) grants the wrong access if you later create a permission with that slug.

**Current State**: `user_effective_permissions.permission_slug` is plain TEXT with no FK validation.

**How to Implement**:

**Option A (Best)**: Store `permission_id` instead of slug

- Add `permission_id UUID REFERENCES permissions(id)` to `user_effective_permissions`
- Keep slug as derived via JOIN for UI/debug
- Update compiler to insert `permission_id`

**Option B (Good Enough)**: Add FK on slug

- Since `permissions.slug` is UNIQUE, add FK: `user_effective_permissions.permission_slug → permissions.slug`
- This blocks insertion of unknown slugs

**Implementation (Option B)**:

```sql
-- First ensure permissions.slug has a unique constraint
ALTER TABLE public.permissions
  ADD CONSTRAINT permissions_slug_unique UNIQUE (slug);

-- Then add FK to user_effective_permissions
ALTER TABLE public.user_effective_permissions
  ADD CONSTRAINT uep_permission_slug_fk
  FOREIGN KEY (permission_slug)
  REFERENCES public.permissions(slug)
  ON UPDATE CASCADE
  ON DELETE CASCADE;
```

---

### 5) Override Integrity + Uniqueness

**Priority**: 🟠 IMPORTANT

**Why**: Overrides are the first place messy data appears (duplicate overrides, inconsistent denormalized slugs). That creates confusing compilation results.

**Current State**: `user_permission_overrides` has both `permission_id` and `permission_slug` (denormalized) without strong validation.

**How to Implement**:

1. Enforce `UNIQUE(user_id, organization_id, permission_id)` (and `branch_id` later)
2. If keeping `permission_slug` denormalized:
   - Populate it via trigger from `permission_id`
   - Disallow direct updates to slug

**Compilation Rule**:

1. Base perms from roles
2. Apply overrides:
   - `grant` → add
   - `revoke` → remove

**Implementation**:

```sql
-- Add unique constraint
ALTER TABLE public.user_permission_overrides
  ADD CONSTRAINT upo_unique_user_org_perm
  UNIQUE (user_id, organization_id, permission_id);

-- Trigger to auto-populate permission_slug from permission_id
CREATE OR REPLACE FUNCTION sync_override_permission_slug()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  SELECT slug INTO NEW.permission_slug
  FROM public.permissions
  WHERE id = NEW.permission_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_sync_override_slug
  BEFORE INSERT OR UPDATE OF permission_id
  ON public.user_permission_overrides
  FOR EACH ROW
  EXECUTE FUNCTION sync_override_permission_slug();
```

---

### 6) Branch Scope: Implement Fully or Remove Until Ready

**Priority**: 🟠 IMPORTANT

**Why**: Half-implemented scope is where enterprise systems get "bug-prone": devs think branch roles work, but enforcement is org-only.

**Current State**:

- `user_role_assignments.scope` supports `'org'` and `'branch'`
- But `user_effective_permissions` doesn't have `branch_id`
- RLS doesn't check branch-level permissions

**Option A (Recommended if branch is soon)**:

1. Add `branch_id UUID NULL` to `user_effective_permissions`
2. Add `has_permission(org_id, branch_id, perm)`:
   - Check exact match for `(org_id, branch_id)` first
   - Then optionally allow org-wide `(org_id, NULL)` as fallback
3. Update compiler:
   - Compile org assignments into `(branch_id = NULL)`
   - Compile branch assignments into `(branch_id = X)`
4. Update RLS: branch tables check both membership and branch-level permission

**Option B (Recommended if branch later)**:

- Remove `branchId` from services/actions/hooks now to avoid false assumptions
- Simplify to org-only until branch is fully implemented

---

### 7) Prevent Self-Lockout and "Last Admin Removed" States

**Priority**: 🟠 IMPORTANT (enterprise requirement)

**Why**: In real orgs, someone will eventually remove the last user who can manage members/roles and brick the org.

**Current State**: No guardrails prevent removing the last org_owner or last user with `members.manage`.

**How to Implement**:

Add guardrails in DB via triggers or constraints:

- Cannot revoke `members.manage` from the last org owner/admin
- Cannot delete last active owner role assignment in org

Enforce at write-time; don't rely only on UI.

**Implementation**:

```sql
CREATE OR REPLACE FUNCTION prevent_last_admin_removal()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  admin_count INTEGER;
  org_id UUID;
BEGIN
  -- Get the org being affected
  IF TG_OP = 'DELETE' THEN
    org_id := OLD.scope_id;
  ELSE
    org_id := NEW.scope_id;
  END IF;

  -- Only check for org scope and org_owner role
  IF (TG_OP = 'DELETE' AND OLD.scope = 'org')
     OR (TG_OP = 'UPDATE' AND OLD.scope = 'org' AND NEW.deleted_at IS NOT NULL) THEN

    -- Count remaining active org_owners
    SELECT COUNT(*) INTO admin_count
    FROM public.user_role_assignments ura
    JOIN public.roles r ON ura.role_id = r.id
    WHERE ura.scope = 'org'
      AND ura.scope_id = org_id
      AND ura.deleted_at IS NULL
      AND r.name = 'org_owner'
      AND ura.id != OLD.id;  -- Exclude the one being removed

    IF admin_count = 0 THEN
      RAISE EXCEPTION 'Cannot remove the last organization owner';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

CREATE TRIGGER trigger_prevent_last_admin
  BEFORE DELETE OR UPDATE OF deleted_at
  ON public.user_role_assignments
  FOR EACH ROW
  EXECUTE FUNCTION prevent_last_admin_removal();
```

---

### 8) Make Compilation Transactional + Idempotent

**Priority**: 🟠 IMPORTANT (reliability)

**Why**: If compilation deletes then inserts and fails mid-way, the user can temporarily lose access (or have partial perms).

**Current State**: Compiler does DELETE then INSERT which could leave partial state on failure.

**How to Implement**:

1. Ensure compiler runs in a transaction
2. Use "upsert" patterns where possible
3. Write compiler so re-running it always yields same end state ("idempotent")

**Nice Pattern**:

1. Build temp set of desired permissions
2. DELETE anything not in desired set
3. `INSERT ... ON CONFLICT DO NOTHING` for desired set

**Implementation**:

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
  -- Build array of desired permissions
  SELECT ARRAY_AGG(DISTINCT p.slug) INTO desired_perms
  FROM public.user_role_assignments ura
  JOIN public.role_permissions rp ON ura.role_id = rp.role_id
  JOIN public.permissions p ON rp.permission_id = p.id
  WHERE ura.user_id = p_user_id
    AND ura.scope = 'org'
    AND ura.scope_id = p_org_id
    AND ura.deleted_at IS NULL
    AND rp.deleted_at IS NULL;

  -- Handle NULL array
  IF desired_perms IS NULL THEN
    desired_perms := ARRAY[]::TEXT[];
  END IF;

  -- Delete permissions not in desired set
  DELETE FROM public.user_effective_permissions
  WHERE user_id = p_user_id
    AND organization_id = p_org_id
    AND permission_slug != ALL(desired_perms);

  -- Upsert desired permissions
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

### 9) Add Staleness Detection + Repair Path

**Priority**: 🟡 RECOMMENDED

**Why**: Even with triggers, things go stale due to manual DB edits, failed transactions, or disabled triggers.

**Current State**: `compiled_at` timestamp exists but no detection/repair tools.

**How to Implement**:

1. Keep `compiled_at` timestamp
2. Add admin-only debugging RPC:
   - "recompile this org"
   - "recompile this user"
3. Optionally add a periodic job (cron/edge function) that checks:
   - Missing compiled rows for active members
   - Compiled rows for inactive members

**Implementation**:

```sql
-- Admin function to detect stale permissions
CREATE OR REPLACE FUNCTION detect_stale_permissions(p_org_id UUID)
RETURNS TABLE (
  issue_type TEXT,
  user_id UUID,
  email TEXT,
  details TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
AS $$
  -- Find active members with no compiled permissions
  SELECT
    'missing_permissions' as issue_type,
    om.user_id,
    u.email,
    'Active member with no compiled permissions' as details
  FROM public.organization_members om
  JOIN auth.users u ON om.user_id = u.id
  WHERE om.organization_id = p_org_id
    AND om.status = 'active'
    AND om.deleted_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.user_effective_permissions uep
      WHERE uep.user_id = om.user_id
        AND uep.organization_id = om.organization_id
    )

  UNION ALL

  -- Find compiled permissions for inactive/deleted members
  SELECT
    'stale_permissions' as issue_type,
    uep.user_id,
    u.email,
    'Has compiled permissions but membership is inactive/deleted' as details
  FROM public.user_effective_permissions uep
  JOIN auth.users u ON uep.user_id = u.id
  LEFT JOIN public.organization_members om
    ON om.user_id = uep.user_id
    AND om.organization_id = uep.organization_id
  WHERE uep.organization_id = p_org_id
    AND (om.id IS NULL OR om.status != 'active' OR om.deleted_at IS NOT NULL);
$$;

-- Admin function to repair an org
CREATE OR REPLACE FUNCTION repair_org_permissions(p_org_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Remove stale permissions for inactive members
  DELETE FROM public.user_effective_permissions uep
  WHERE uep.organization_id = p_org_id
    AND NOT EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.user_id = uep.user_id
        AND om.organization_id = uep.organization_id
        AND om.status = 'active'
        AND om.deleted_at IS NULL
    );

  -- Recompile for all active members
  PERFORM public.compile_user_permissions(om.user_id, p_org_id)
  FROM public.organization_members om
  WHERE om.organization_id = p_org_id
    AND om.status = 'active'
    AND om.deleted_at IS NULL;
END;
$$;
```

---

### 10) Optimize Compilation for Scale

**Priority**: 🟡 RECOMMENDED

**Why**: Trigger "recompile all users for a role change" can get expensive at scale.

**Current State**: Triggers compile synchronously which could cause timeouts for large orgs.

**How to Implement**:

For small scale, triggers are fine.

For medium/large:

1. Write triggers that enqueue "recompile tasks" into a table
2. A worker processes tasks in batches
3. Avoid long locks and timeouts

**Implementation**:

```sql
-- Queue table
CREATE TABLE public.permission_compile_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  organization_id UUID,
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ,
  UNIQUE(user_id, organization_id)
);

-- Modified trigger that queues instead of compiling
CREATE OR REPLACE FUNCTION trigger_queue_compilation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.permission_compile_queue (user_id, organization_id)
  VALUES (
    COALESCE(NEW.user_id, OLD.user_id),
    COALESCE(NEW.scope_id, OLD.scope_id)
  )
  ON CONFLICT (user_id, organization_id) DO NOTHING;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Worker function (call from cron/edge function)
CREATE OR REPLACE FUNCTION process_compile_queue(batch_size INTEGER DEFAULT 100)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  processed INTEGER := 0;
  task RECORD;
BEGIN
  FOR task IN
    SELECT * FROM public.permission_compile_queue
    WHERE processed_at IS NULL
    ORDER BY priority DESC, created_at ASC
    LIMIT batch_size
    FOR UPDATE SKIP LOCKED
  LOOP
    PERFORM public.compile_user_permissions(task.user_id, task.organization_id);

    UPDATE public.permission_compile_queue
    SET processed_at = now()
    WHERE id = task.id;

    processed := processed + 1;
  END LOOP;

  RETURN processed;
END;
$$;
```

---

### 11) Standardize Permission Naming + Action Taxonomy

**Priority**: 🟡 RECOMMENDED

**Why**: Consistency prevents future naming mismatch. Module permissions will be added soon.

**Current State**: 13 foundational permissions use `category.action` pattern (e.g., `branches.read`).

**How to Implement**:

Use a strict pattern:

- `module.entity.action` (e.g., `warehouse.products.read`)
- `module.action` for module-wide actions (optional)

**Standard Actions**:

- `read` - View/list
- `create` - Create new
- `update` - Modify existing
- `delete` - Remove (soft or hard)
- `manage` - Full control (shorthand for all actions)

**Naming Convention**:

```
org.read
org.update
branches.read
branches.create
branches.update
branches.delete
members.read
members.manage
warehouse.products.read
warehouse.products.create
warehouse.products.update
warehouse.products.delete
warehouse.inventory.read
warehouse.inventory.adjust
teams.members.read
teams.members.invite
```

**Rule**: Avoid wildcards in DB enforcement. Wildcards can be used as authoring shortcuts during seeding/role design, but compile them to explicit perms.

---

### 12) RLS Policy Consistency Audit

**Priority**: 🟡 RECOMMENDED

**Why**: One missing `is_org_member()` or one overly-permissive policy breaks your whole security story.

**Current State**: Policies are inconsistent - some have membership checks, some don't.

**How to Implement**:

Create a "policy standard" doc snippet and apply it everywhere.

**Standard Pattern**:

| Operation | Pattern                                                                          |
| --------- | -------------------------------------------------------------------------------- |
| SELECT    | `is_org_member(organization_id)` (membership boundary)                           |
| INSERT    | `is_org_member(organization_id) AND has_permission(organization_id, 'x.create')` |
| UPDATE    | `is_org_member(organization_id) AND has_permission(organization_id, 'x.update')` |
| DELETE    | `is_org_member(organization_id) AND has_permission(organization_id, 'x.delete')` |

**Audit Query**:

```sql
-- Find policies that might be missing membership check
SELECT tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND cmd IN ('INSERT', 'UPDATE', 'DELETE')
  AND (qual NOT LIKE '%is_org_member%' OR qual IS NULL)
  AND (with_check NOT LIKE '%is_org_member%' OR with_check IS NULL)
ORDER BY tablename, cmd;
```

---

### 13) Audit Logging for Permission Changes

**Priority**: 🟢 NICE-TO-HAVE (enterprise feature)

**Why**: Enterprise customers expect traceability: who granted access, who revoked, when, why.

**Current State**: No audit logging for permission changes.

**How to Implement**:

1. Add `permission_audit_log` table capturing:
   - `actor_user_id` - Who made the change
   - `target_user_id` / `org_id` - What was affected
   - `action` - grant/revoke/role-assign/role-remove
   - `before` / `after` (JSON) - State change
   - `timestamp`

2. Populate via triggers on:
   - `user_role_assignments`
   - `user_permission_overrides`
   - `role_permissions` (for custom roles)

**Implementation**:

```sql
CREATE TABLE public.permission_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES auth.users(id),
  target_user_id UUID REFERENCES auth.users(id),
  organization_id UUID REFERENCES public.organizations(id),
  action TEXT NOT NULL,  -- 'role_assigned', 'role_removed', 'permission_granted', 'permission_revoked'
  table_name TEXT NOT NULL,
  record_id UUID,
  before_state JSONB,
  after_state JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_audit_org ON permission_audit_log(organization_id);
CREATE INDEX idx_audit_target ON permission_audit_log(target_user_id);
CREATE INDEX idx_audit_created ON permission_audit_log(created_at);

-- Enable RLS
ALTER TABLE public.permission_audit_log ENABLE ROW LEVEL SECURITY;

-- Only org admins can view audit logs
CREATE POLICY "audit_select_admin" ON permission_audit_log
FOR SELECT USING (
  is_org_member(organization_id)
  AND has_permission(organization_id, 'members.manage')
);
```

---

### 14) Tests That Simulate Real RLS Behavior

**Priority**: 🟢 NICE-TO-HAVE

**Why**: Most permission bugs are edge cases:

- User removed from org
- Role changed
- Override applied then removed
- Last admin removed

**Current State**: Basic unit tests exist but don't test RLS edge cases.

**How to Implement**:

Integration tests that:

1. Authenticate as different users
2. Attempt DB operations through Supabase client
3. Verify RLS blocks/allows as expected

**Key Test Scenarios**:

- [ ] Membership set inactive → cannot write even if compiled perms exist
- [ ] Role removed → permissions recompiled correctly
- [ ] Override grant → permission added
- [ ] Override revoke → permission removed
- [ ] Last admin removal blocked
- [ ] Stale permissions detected and cleaned

---

### 15) "One Truth" Rule for App Devs

**Priority**: 🟢 NICE-TO-HAVE (documentation)

**Why**: Teams accidentally add ad-hoc checks in server actions or UI and drift from the model.

**The Rules**:

1. **DB is the enforcer**. UI uses permissions only for UX (hide buttons).

2. **Server actions should rely on RLS by default**. Don't duplicate permission checks in code if RLS handles it.

3. **If you must do pre-checks**, they must call the same `has_permission()` / query `user_effective_permissions`.

4. **Never bypass RLS** with service role unless absolutely necessary (migrations, admin tools).

5. **Single source of truth**: `user_effective_permissions` table.

---

## Priority Summary

### If You Do Only 3 Things Now

1. ✅ **Membership + permission on every write policy** (Section 1)
2. ✅ **Invalidate compiled perms on membership changes** (Section 2)
3. ✅ **Harden SECURITY DEFINER + enforce slug integrity** (Sections 3 & 4)

Those three make the system genuinely "enterprise-grade" and resistant to the most common real-world failures.

---

## Implementation Order

**Phase 1 - Critical Security** (do first)

1. Fix all write policies to require both checks
2. Add membership change trigger for permission cleanup
3. Harden SECURITY DEFINER functions
4. Add FK constraint on permission_slug

**Phase 2 - Reliability** 5. Add override uniqueness constraint 6. Implement branch scope OR remove branch API 7. Add last-admin protection trigger 8. Make compilation idempotent

**Phase 3 - Operations** 9. Add staleness detection functions 10. Add compile queue for scale (if needed) 11. Standardize permission naming 12. Audit all RLS policies

**Phase 4 - Enterprise Features** 13. Add audit logging 14. Add integration tests 15. Document rules for developers

---

**Document Version**: 1.0
**Created**: 2026-01-21
**Based on**: ChatGPT senior review + live database verification
