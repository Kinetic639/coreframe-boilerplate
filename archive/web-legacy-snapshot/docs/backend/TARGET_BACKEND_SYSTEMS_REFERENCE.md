# TARGET Backend Systems Reference

> **Canonical reference for the TARGET Supabase backend.**
> Verified against the live DB as of 2026-03-23 hardening pass.
> Future AI agents and developers must consult this document before modifying any permission, entitlement, trigger, or RLS system.

---

## 1. Core System Overview

### Architecture Layers

```
┌─────────────────────────────────────────────────────┐
│  Supabase Auth (auth.users)                         │
│  handle_user_signup_hook — creates public.users +   │
│  user_preferences rows on every new signup          │
└────────────────────────┬────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────┐
│  PostgreSQL + RLS                                   │
│  All tables have RLS ENABLED.                       │
│  Sensitive tables have FORCE ROW LEVEL SECURITY.    │
│  RLS policies call helper functions that read       │
│  user_effective_permissions (compiled cache).       │
└────────────────────────┬────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────┐
│  Permission Compilation Layer                       │
│  compile_user_permissions(user_id, org_id)          │
│  Writes to user_effective_permissions.              │
│  Triggered automatically by DB triggers.            │
└────────────────────────┬────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────┐
│  Entitlements Computation Layer                     │
│  recompute_organization_entitlements(org_id)        │
│  Writes to organization_entitlements.               │
│  Triggered automatically by DB triggers.            │
└────────────────────────┬────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────┐
│  App SSR Context Resolution                         │
│  loadDashboardContextV2 (server component)          │
│  Reads user_effective_permissions + entitlements.   │
│  Produces AppContextV2 hydrated into Zustand store. │
└─────────────────────────────────────────────────────┘
```

### Security Enforcement Chain

Every resource access goes through this chain:

1. **Auth** — Supabase JWT validates the caller's identity. `auth.uid()` is the single source of truth for "who is calling."
2. **RLS** — Every `SELECT/INSERT/UPDATE/DELETE` is filtered by RLS policies. Policies call `is_org_member()`, `has_permission()`, or `has_branch_permission()`, which read from the **compiled cache** (`user_effective_permissions`).
3. **Server actions** — TypeScript server actions re-validate permissions using `PermissionServiceV2.hasPermission()` before executing mutations. This is a belt-and-suspenders layer above RLS.
4. **Client guards** — UI components use `usePermissions()` hook which reads the hydrated permission snapshot. These are display-only guards; the server layer is the security boundary.

---

## 2. Permission System — Complete Reference

### Tables

| Table                               | Purpose                                                                                                                                                             |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `public.roles`                      | Named roles (e.g. `org_owner`, `org_member`). `is_basic=true` for system roles. `scope_type` constrains where the role can be assigned: `org`, `branch`, or `both`. |
| `public.permissions`                | Permission slugs (e.g. `members.manage`, `branches.*`). `deleted_at` soft-deletes.                                                                                  |
| `public.role_permissions`           | Many-to-many: which permissions a role grants. `allowed=true/false`, `deleted_at` for soft-delete.                                                                  |
| `public.user_role_assignments`      | Assigns a role to a user within a scope (org or branch). `scope='org'` + `scope_id=org_id` or `scope='branch'` + `scope_id=branch_id`.                              |
| `public.user_permission_overrides`  | Explicit `grant` or `revoke` overrides for a specific user/org/permission. Bypasses or overrides role-derived permissions.                                          |
| `public.user_effective_permissions` | **Compiled cache.** Written exclusively by `compile_user_permissions()`. Never edited directly. Read by all RLS helper functions.                                   |

### Role Assignment Scopes

A role can be assigned at two scopes:

- **`scope='org'`** — The role applies to the user across the entire organization. `scope_id` = organization UUID.
- **`scope='branch'`** — The role applies to the user only within a specific branch. `scope_id` = branch UUID.

The `validate_role_assignment_scope` BEFORE trigger enforces `roles.scope_type` compatibility at insert/update time. A role with `scope_type='org'` cannot be assigned at branch scope, and vice versa.

### Permission Evaluation at the DB Layer

Three SECURITY DEFINER helper functions read from `user_effective_permissions`:

```sql
-- Does this user have permission X org-wide?
is_org_member(org_id uuid) → boolean
  Uses: organization_members WHERE status='active' AND deleted_at IS NULL

-- Does this user have permission X at org level (branch_id IS NULL)?
has_permission(org_id uuid, slug text) → boolean
  Matches: permission_slug_exact = slug AND branch_id IS NULL

-- Does this user have permission X for a specific branch?
has_branch_permission(org_id uuid, branch_id uuid, slug text) → boolean
  Matches: permission_slug_exact = slug
       AND (branch_id IS NULL OR branch_id = p_branch_id)
  Note: an org-wide grant (branch_id IS NULL) satisfies any branch check.
```

### Wildcard Permission Model

Permissions support a single-level wildcard using `*`:

```
members.*        matches: members.read, members.manage
branches.*       matches: branches.create, branches.read, branches.update,
                          branches.delete, branches.view.any, etc.
module.*         matches: module.warehouse.access, module.teams.access, etc.
```

**How wildcards compile:** `compile_user_permissions` uses a `LEFT JOIN` on the `permissions` table:

```sql
left join public.permissions p2
  on  p.slug like '%*%'
  and p2.slug not like '%*%'           -- concrete targets only
  and p2.deleted_at is null
  and p2.slug like replace(p.slug, '*', '%')
```

Each wildcard row in `role_permissions` expands to one `user_effective_permissions` row per matching concrete slug in the `permissions` table. The stored `permission_slug` retains the wildcard source (e.g. `members.*`); `permission_slug_exact` stores the concrete target (e.g. `members.manage`).

**Phantom wildcard risk:** If a wildcard slug (e.g. `xyz.*`) has no matching concrete children in the `permissions` table, it expands to zero rows — the user gets nothing from that assignment. Always ensure concrete sibling slugs exist before assigning wildcards.

### org_owner Permission Design

`org_owner` is intentionally designed to use wildcards rather than enumerating individual permissions. This keeps org_owner future-proof — new permission slugs under covered prefixes are automatically granted.

**Active `role_permissions` for `org_owner`:**

| Wildcard slug | Covers                                                                                                                                  |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `account.*`   | account.read, account.update, account.delete, account.password, account.notifications, account.security                                 |
| `branches.*`  | branches.create, branches.read, branches.update, branches.delete, branches.view.any, branches.view.update.any, branches.view.remove.any |
| `invites.*`   | invites.read, invites.create, invites.cancel                                                                                            |
| `members.*`   | members.read, members.manage                                                                                                            |
| `module.*`    | All module.\*.access slugs                                                                                                              |
| `org.*`       | org.read, org.update                                                                                                                    |
| `self.*`      | self.read, self.update                                                                                                                  |
| `tools.*`     | tools.read, tools.manage                                                                                                                |

**`branch.roles.manage` is NOT in org_owner** — intentionally. This permission is for branch managers (branch-scoped role). Org owners use `members.manage` (org-wide) which satisfies the same DB policy condition.

---

## 3. Permission Compilation System

### What It Does

`compile_user_permissions(p_user_id uuid, p_organization_id uuid)` atomically rebuilds the `user_effective_permissions` cache for one `(user, org)` pair.

### Compilation Steps

1. **Membership gate** — If the user is not an active member of the org (`organization_members.status='active' AND deleted_at IS NULL`), all UEP rows for this `(user, org)` are deleted and the function returns early. This guarantees stale permissions are wiped immediately on membership removal.

2. **Advisory lock** — `pg_advisory_xact_lock(hashtext(user_id || org_id))` serializes concurrent compiles for the same `(user, org)` pair. Prevents race conditions.

3. **Wipe** — All existing UEP rows for `(user, org)` are deleted.

4. **INSERT 1: org-scoped permissions** (branch_id = NULL)
   - Source A: all `user_role_assignments` where `scope='org' AND scope_id=org_id` → expands wildcards via LEFT JOIN
   - Source B: `user_permission_overrides` with `effect='grant'`
   - Revoke overrides suppress matching Source A rows via `NOT EXISTS`

5. **INSERT 2: branch-scoped permissions** (branch_id IS NOT NULL)
   - Source: all `user_role_assignments` where `scope='branch'` and `branches.organization_id=org_id` → expands wildcards
   - Revoke overrides suppress rows (org-wide revokes apply to branch permissions too)

6. **Conflict handling** — `ON CONFLICT ON CONSTRAINT user_effective_permissions_unique_v3 DO UPDATE` ensures idempotency.

### user_effective_permissions Schema

| Column                  | Type        | Notes                                                             |
| ----------------------- | ----------- | ----------------------------------------------------------------- |
| `id`                    | uuid        | PK                                                                |
| `user_id`               | uuid        | FK → public.users                                                 |
| `organization_id`       | uuid        | FK → organizations                                                |
| `permission_slug`       | text        | Source pattern (e.g. `members.*`)                                 |
| `permission_slug_exact` | text        | Concrete target (e.g. `members.manage`). Used by all RLS queries. |
| `source_type`           | text        | `'role'` or `'override'`                                          |
| `source_id`             | uuid        | Nullable; for audit tracing                                       |
| `branch_id`             | uuid        | NULL = org-wide; non-NULL = branch-scoped                         |
| `compiled_at`           | timestamptz | Last recompile time                                               |

**Unique constraint `user_effective_permissions_unique_v3`:** `(user_id, org_id, permission_slug_exact, branch_id)`

**Partial indexes for RLS hot paths:**

- `uep_org_slug_exact_idx` on `(org_id, user_id, permission_slug_exact) WHERE branch_id IS NULL`
- `uep_branch_slug_exact_idx` on `(org_id, user_id, branch_id, permission_slug_exact) WHERE branch_id IS NOT NULL`

### When Compilation Is Triggered

See the complete Trigger Matrix in Section 8.

### Why Compilation Is Necessary

Evaluating permissions directly from `role_permissions` + `user_role_assignments` at query time would require complex joins on every RLS evaluation. Every table SELECT would execute this join for every row scanned. The compiled cache reduces per-row RLS cost to a single indexed lookup on `user_effective_permissions`.

---

## 4. Entitlements System

### What Entitlements Control

Organization entitlements determine which **modules** are available, what **limits** apply (e.g. max users, storage), and which **contexts** are enabled. These are plan-level features, separate from user permissions.

### Tables

| Table                          | Purpose                                                                                            |
| ------------------------------ | -------------------------------------------------------------------------------------------------- |
| `subscription_plans`           | Plan definitions: `enabled_modules text[]`, `limits jsonb`, `contexts text[]`, `is_active`         |
| `organization_subscriptions`   | Which plan an org is on. `status` can be `active`, `trialing`, `cancelled`, etc.                   |
| `organization_module_addons`   | Per-org addon modules outside the plan (e.g. extra module purchased). `status='active'` to enable. |
| `organization_limit_overrides` | Per-org limit overrides that supersede plan limits. `limit_key text`, `limit_value numeric`.       |
| `organization_entitlements`    | **Computed cache.** Written exclusively by `recompute_organization_entitlements()`.                |

### Computation: recompute_organization_entitlements(org_id)

1. **Advisory lock** — `pg_advisory_xact_lock(hashtext(org_id))` serializes concurrent recomputes.
2. **Resolve plan** — Finds the org's `active/trialing` subscription and reads the plan's `enabled_modules`, `limits`, `contexts`. Falls back to the `free` plan (looked up by name, not hardcoded UUID) if no active subscription.
3. **Collect addons** — Gathers `module_slug` from `organization_module_addons WHERE status='active'`.
4. **Merge modules** — `enabled_modules = DISTINCT(plan_modules || addon_modules)`.
5. **Apply overrides** — Iterates `organization_limit_overrides` and overlays each `limit_key` onto the plan limits via `jsonb_set`.
6. **Upsert** — Writes to `organization_entitlements ON CONFLICT(organization_id) DO UPDATE`.

### When Entitlements Are Recomputed

See the complete Trigger Matrix in Section 8.

---

## 5. RLS Security Model

### Philosophy

- Every table has `RLS ENABLED`.
- Tables where all writes go through `SECURITY DEFINER` RPCs also have `FORCE ROW LEVEL SECURITY`, which prevents even the `postgres` superrole from bypassing policies during routine operations.
- Tables with FORCE RLS: `organizations`, `users`, `invitation_role_assignments`.
- No table is left accessible to `anon` without explicit policy.

### Core RLS Helper Functions

All three are `SECURITY DEFINER` with `SET search_path = ''`:

```sql
-- Membership check (used as base gate in most policies)
is_org_member(org_id uuid) → boolean
-- Reads: organization_members (not UEP; intentionally direct)

-- Org-level permission (branch_id = NULL in UEP)
has_permission(org_id uuid, permission text) → boolean
-- Reads: user_effective_permissions WHERE branch_id IS NULL

-- Branch-level permission (org-wide grant OR branch-specific grant)
has_branch_permission(org_id uuid, branch_id uuid, slug text) → boolean
-- Reads: user_effective_permissions WHERE (branch_id IS NULL OR branch_id = p_branch_id)
```

### is_org_member vs has_permission

`is_org_member` reads `organization_members` directly (not UEP). This is intentional: membership is the coarse gate (fast, simple FK check). `has_permission` reads the compiled cache for fine-grained capability checks.

Most policies pattern as:

```sql
USING (is_org_member(org_id) AND has_permission(org_id, 'some.permission'))
```

### PUBLIC EXECUTE Revocation

All `SECURITY DEFINER` functions that could be exploited as DoS vectors (by triggering expensive compiles or fan-outs) have `REVOKE EXECUTE FROM PUBLIC` and explicit grants to `authenticated, service_role` only. Functions that are legitimately pre-auth (e.g. `get_invitation_preview_by_token`) also grant to `anon`.

### Performance Index: organization_members

```sql
idx_org_members_active_lookup ON organization_members (organization_id, user_id)
WHERE status = 'active' AND deleted_at IS NULL
```

This partial index eliminates predicate evaluation overhead on every `is_org_member()` call.

---

## 6. Onboarding / Organization Creation Flow

```
1. User signs up via Supabase Auth
   └─ handle_user_signup_hook (Supabase Auth hook)
      ├─ INSERT INTO public.users (id, email) ON CONFLICT DO NOTHING
      └─ INSERT INTO public.user_preferences (user_id) ON CONFLICT DO NOTHING
         (organization_id = NULL → dashboard redirects to /onboarding)

2. Onboarding wizard (client)
   ├─ User enters: org name, org name_2, slug
   ├─ checkOrgSlugAction → check_org_slug_available(slug) RPC
   │   (SECURITY DEFINER to bypass pre-membership RLS; queries organizations.slug)
   └─ User submits

3. create_organization_for_current_user(p_name, p_branch_name, p_plan_id, p_name_2, p_slug) RPC
   ├─ Idempotency guard: if user already has org-scope URA, return existing org
   ├─ Resolve plan (p_plan_id or fallback 'free')
   ├─ Resolve org_owner role
   ├─ Generate/validate slug
   ├─ INSERT INTO public.organizations (name, name_2, slug, created_by)
   ├─ INSERT INTO public.organization_profiles (organization_id, name, name_2, slug)
   │   (trg_sync_org_slug_to_profile trigger keeps profiles.slug in sync with organizations.slug)
   ├─ INSERT INTO public.branches (organization_id, name, slug) → default branch
   ├─ INSERT INTO public.organization_members (user_id, organization_id)
   ├─ INSERT INTO public.user_role_assignments (user_id, org_owner_role_id, 'org', org_id)
   ├─ INSERT INTO public.organization_subscriptions (organization_id, plan_id, 'active')
   ├─ PERFORM recompute_organization_entitlements(org_id)
   ├─ PERFORM compile_user_permissions(user_id, org_id)
   └─ UPSERT user_preferences (organization_id, default_branch_id, last_branch_id)

4. Post-creation
   └─ App SSR context (loadDashboardContextV2) reads compiled UEP + entitlements
      and hydrates the Zustand store with activeOrg, activeBranch, permissions
```

**Slug canonicality:** `organizations.slug` is the canonical source with a `UNIQUE` constraint. `organization_profiles.slug` is a denormalized copy kept in sync by the `trg_sync_org_slug_to_profile` trigger (`AFTER UPDATE OF slug ON organizations`). The `updateProfile` service action also explicitly updates `organizations.slug` when slug is in the input (belt-and-suspenders).

---

## 7. Invitation System

### Flow

```
Inviter (must have invites.create permission):
  → OrgInvitationsService.createInvitation()
  → check_invitation_eligibility(org_id, email, inviter_id) RPC
    (checks: SELF_INVITE, ALREADY_MEMBER, DUPLICATE_PENDING)
  → INSERT INTO invitations (email, org_id, token, expires_at, invited_first_name, invited_last_name)
  → INSERT INTO invitation_role_assignments (invitation_id, role_id, scope, scope_id)
     one row per role assignment in the invite

Invitee accepts:
  → accept_invitation_and_join_org(token) RPC (SECURITY DEFINER)
  → Validates: authenticated, user exists, invitation pending + not expired, email match
  → UPSERT public.users (id, email) — ensures FK chain for org_members
  → Apply invited_first_name/last_name to users if blank
  → UPSERT organization_members (active)
  → INSERT user_role_assignments: org_member baseline role
  → Copy invitation_role_assignments → user_role_assignments (scope-validated per row)
  → UPSERT user_preferences (organization_id → invited org)
  → UPDATE invitations SET status='accepted'
  → PERFORM compile_user_permissions(user_id, org_id)  ← explicit call for belt-and-suspenders
```

### invitation_role_assignments Table

Replaces the legacy single-field `role_id` / `branch_id` on `invitations`. One invite can carry multiple role assignments across multiple scopes.

| Column          | Notes                                                                      |
| --------------- | -------------------------------------------------------------------------- |
| `invitation_id` | FK → invitations (CASCADE delete)                                          |
| `role_id`       | FK → roles (RESTRICT)                                                      |
| `scope`         | `'org'` or `'branch'`                                                      |
| `scope_id`      | branch_id for branch scope; org_id for org scope (resolved at accept time) |

RLS policies on `invitation_role_assignments` require `has_permission(org_id, 'invites.read')` for SELECT, `invites.create` for INSERT.

---

## 8. Legacy System Removal

### modules / user_modules Tables

Both tables have been **dropped**. The module availability system is now entirely static config:

```
src/modules/index.ts → getAllModules(activeOrgId?, subscription?)
```

Modules are registered in `src/modules/*/config.ts` files. Availability is controlled by:

- Permission check: `module.<slug>.access` permission slug (user-level)
- Entitlement check: `organization_entitlements.enabled_modules` array (plan-level)

The two server-context loaders previously queried `user_modules` from the DB. Those queries have been removed and replaced with `userModules: []`. The `userModules` field in app context now reflects only what the static registry + entitlements gate produces.

### Legacy Invitation Columns Removed

`invitations.role_id`, `invitations.branch_id`, and `invitations.team_id` have been **dropped**. All invitation role data now lives exclusively in `invitation_role_assignments`. RPCs `accept_invitation_and_join_org`, `get_my_pending_invitations`, and `get_invitation_preview_by_token` have been rewritten to use IRA only (no legacy fallback paths).

---

## 9. Complete Trigger Matrix

### Permission Compilation Triggers

| Table                       | Trigger                           | Fires On                         | Function                             | Effect                                                                                                                                                      |
| --------------------------- | --------------------------------- | -------------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `user_role_assignments`     | `trigger_role_assignment_compile` | AFTER INSERT OR DELETE OR UPDATE | `trigger_compile_on_role_assignment` | Recompiles UEP for the affected `(user_id, org_id)`. Resolves org_id from branch lookup for branch-scoped rows.                                             |
| `role_permissions`          | `trigger_role_permission_compile` | AFTER INSERT OR DELETE OR UPDATE | `trigger_compile_on_role_permission` | Fan-out: recompiles UEP for **all users** holding the changed role (both org-scoped and branch-scoped assignments).                                         |
| `user_permission_overrides` | `trigger_override_compile`        | AFTER INSERT OR DELETE OR UPDATE | `trigger_compile_on_override`        | Recompiles UEP for the specific `(user_id, org_id)` affected by the override.                                                                               |
| `organization_members`      | `trigger_membership_compile`      | AFTER INSERT OR DELETE OR UPDATE | `trigger_compile_on_membership`      | On deactivation or soft-delete: **wipes** UEP rows for `(user, org)`. On activation or undelete: recompiles. On org/user change: wipes old, recompiles new. |

### Entitlements Recompute Triggers

| Table                          | Trigger                               | Fires On                                            | Function                           | Effect                                                                                                                                                                              |
| ------------------------------ | ------------------------------------- | --------------------------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `organization_subscriptions`   | `recompute_on_subscription_change`    | AFTER INSERT OR DELETE OR UPDATE                    | `trigger_recompute_entitlements`   | Recomputes `organization_entitlements` for the org. Handles new subscriptions, cancellations, and any field change.                                                                 |
| `organization_module_addons`   | `recompute_on_addon_change`           | AFTER INSERT OR DELETE OR UPDATE                    | `trigger_recompute_entitlements`   | Recomputes when an addon is added, removed, or its status changes.                                                                                                                  |
| `organization_limit_overrides` | `recompute_on_override_change`        | AFTER INSERT OR DELETE OR UPDATE                    | `trigger_recompute_entitlements`   | Recomputes when a limit override is added, removed, or its value changes.                                                                                                           |
| `subscription_plans`           | `recompute_on_plan_definition_update` | AFTER UPDATE OF `enabled_modules, limits, contexts` | `trigger_recompute_on_plan_update` | Fan-out: recomputes `organization_entitlements` for **all orgs** with an active/trialing subscription on the updated plan. Only fires when plan definition columns actually change. |

### Validation Triggers (Not Compilation)

| Table                       | Trigger                            | Fires On                | Function                               | Effect                                                                                                                                               |
| --------------------------- | ---------------------------------- | ----------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `user_role_assignments`     | `check_role_assignment_scope`      | BEFORE INSERT OR UPDATE | `validate_role_assignment_scope`       | Raises an exception if the role's `scope_type` is incompatible with the assignment scope (e.g. prevents assigning an org-only role at branch scope). |
| `user_permission_overrides` | `trigger_validate_permission_slug` | BEFORE INSERT OR UPDATE | `validate_permission_slug_on_override` | Validates that the `permission_slug` in the override is a known slug in the `permissions` table.                                                     |

### Slug Sync Trigger

| Table           | Trigger                        | Fires On               | Function                   | Effect                                                                                             |
| --------------- | ------------------------------ | ---------------------- | -------------------------- | -------------------------------------------------------------------------------------------------- |
| `organizations` | `trg_sync_org_slug_to_profile` | AFTER UPDATE OF `slug` | `sync_org_slug_to_profile` | Copies `organizations.slug` to `organization_profiles.slug` to keep the denormalized copy in sync. |

---

## 10. Key Invariants for Safe Future Modifications

1. **Never write to `user_effective_permissions` directly.** All writes go through `compile_user_permissions()`. Direct writes will be overwritten on the next compile.

2. **Never write to `organization_entitlements` directly.** All writes go through `recompute_organization_entitlements()`.

3. **Adding a new permission slug:** Insert into `permissions` table only. The slug becomes available automatically for wildcard expansion on the next compile for any role with a matching wildcard.

4. **Adding a new role permission (INSERT into `role_permissions`):** The `trigger_role_permission_compile` trigger will fan-out recompilation to all users holding that role. This is intentionally synchronous in the mutation transaction — be aware on roles with many users.

5. **Soft-delete vs hard-delete:** All permission/membership tables use soft-delete (`deleted_at`). The compile system handles both hard DELETE and soft-delete UPDATE correctly. Prefer soft-delete for auditability.

6. **Wildcard phantom risk:** If you assign a wildcard slug to a role but no concrete children exist in `permissions` (e.g. `new_module.*` before any `new_module.action` slugs are seeded), the user will compile zero rows from that assignment. Seed concrete slugs first.

7. **compile_user_permissions is org-scoped.** It takes `(user_id, org_id)`. Branch-scoped permissions are compiled inside this call — the function processes both org-scope and branch-scope URAs in a single pass. There is no per-branch compilation function.

8. **plan-level changes require recompute:** Editing `subscription_plans.enabled_modules`, `limits`, or `contexts` automatically triggers a fan-out recompute via the `recompute_on_plan_definition_update` trigger. Editing other plan columns (e.g. `name`, `price`) does NOT trigger recompute — this is intentional.

9. **Advisory locks are transaction-scoped:** Both `compile_user_permissions` and `recompute_organization_entitlements` acquire `pg_advisory_xact_lock` keys based on their input IDs. This serializes concurrent operations for the same target. The lock is released at transaction end.
