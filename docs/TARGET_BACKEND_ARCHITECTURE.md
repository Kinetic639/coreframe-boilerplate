# TARGET Backend Architecture

**Project ref:** `rjeraydumwechpjjzrus`
**Status:** Verified production backend
**Last audited:** 2026-03-11
**Source of truth:** Live Supabase schema + codebase at `/home/user/coreframe-boilerplate`

---

## Table of Contents

1. [Database Architecture Overview](#1-database-architecture-overview)
2. [Permissions Architecture](#2-permissions-architecture)
3. [Entitlements Architecture](#3-entitlements-architecture)
4. [RLS Architecture](#4-rls-architecture)
5. [Core Helper Functions](#5-core-helper-functions)
6. [Org Onboarding Pipeline](#6-org-onboarding-pipeline)
7. [Invitation System Architecture](#7-invitation-system-architecture)
8. [Security Design](#8-security-design)
9. [Performance Considerations](#9-performance-considerations)
10. [Known Limitations](#10-known-limitations)

---

## 1. Database Architecture Overview

### Core Table Map

```
auth.users (Supabase auth)
    │
    ▼
public.users                        ← mirrors auth.users; FK from most user tables
    │                                  columns: id, email, first_name, last_name,
    │                                           avatar_url, avatar_path, status_id*, default_branch_id*, deleted_at
    │
    ├─► user_preferences             ← per-user settings, active org/branch pointers
    │       columns: user_id (UNIQUE), organization_id, default_branch_id, last_branch_id,
    │                display_name, phone, timezone, date_format, time_format, locale,
    │                notification_settings(jsonb), dashboard_settings(jsonb), module_settings(jsonb)
    │
    ├─► organization_members         ← membership pivot: user ↔ org
    │       columns: id, organization_id, user_id, status ('active'|...), joined_at, deleted_at
    │       unique: (organization_id, user_id)
    │
    └─► user_role_assignments        ← user → role, with scope (org | branch)
            columns: id, user_id, role_id, scope ('org'|'branch'), scope_id (org_id or branch_id),
                     deleted_at
            unique: (user_id, role_id, scope, scope_id)

public.organizations                ← top-level tenant entity
    │   columns: id, name, name_2, slug (UNIQUE), created_by, created_at, deleted_at
    │
    ├─► organization_profiles        ← extended org metadata
    │       columns: organization_id (PK FK), name, name_2, slug, bio, website,
    │                logo_url, theme_color, font_color, created_at
    │       note: slug mirrors organizations.slug (trigger: trg_sync_org_slug_to_profile)
    │
    ├─► branches                     ← sub-units of an organization
    │       columns: id, organization_id, name, slug, created_at, deleted_at
    │       unique: (organization_id, slug) WHERE slug IS NOT NULL
    │
    ├─► organization_subscriptions   ← one active subscription per org
    │       columns: id (not PK), organization_id (UNIQUE), plan_id, status, created_at, updated_at
    │
    ├─► organization_entitlements    ← computed cache: merged modules + limits
    │       columns: organization_id (PK), plan_id, enabled_modules(text[]),
    │                limits(jsonb), contexts(text[]), metadata(jsonb), updated_at, created_at
    │
    ├─► organization_limit_overrides ← per-org limit overrides on top of plan limits
    │       columns: id, organization_id, limit_key, limit_value, created_at
    │       unique: (organization_id, limit_key)
    │
    ├─► organization_module_addons   ← per-org addon modules outside the plan
    │       columns: id, organization_id, module_slug, status, created_at
    │       unique: (organization_id, module_slug) WHERE status='active'
    │
    ├─► org_positions                ← named positions within an org (e.g. "Warehouse Manager")
    │       columns: id, org_id, name, description, created_at, updated_at, created_by, deleted_at
    │
    └─► org_position_assignments     ← user → position, optionally scoped to a branch
            columns: id, org_id, user_id, position_id, branch_id (nullable), created_at, created_by, deleted_at
            unique: (org_id, user_id, position_id, branch_id) NULLS NOT DISTINCT

public.roles                        ← role definitions (basic=system, non-basic=org-custom)
    │   columns: id, name, description, is_basic (bool), organization_id (NULL for system roles),
    │            scope_type ('org'|'branch'|'both'), deleted_at
    │
    └─► role_permissions             ← role → permission grants/denies
            columns: id, role_id, permission_id, allowed (bool), deleted_at
            unique: (role_id, permission_id)

public.permissions                  ← permission slug registry
    columns: id, slug (UNIQUE), name, description, category, action, is_system, is_dangerous, deleted_at

public.user_effective_permissions   ← compiled permission cache (derived from roles + overrides)
    columns: id, user_id, organization_id, permission_slug, permission_slug_exact (NOT NULL),
             source_type ('role'|'override'), source_id, branch_id (NULL=org-scope), created_at, compiled_at

public.user_permission_overrides    ← explicit grant/revoke overrides per user
    columns: id, user_id, organization_id, permission_id, permission_slug, scope, scope_id,
             effect ('grant'|'revoke'), created_at, updated_at, deleted_at

public.subscription_plans           ← plan definitions
    columns: id, name (UNIQUE), description, price_monthly, price_yearly, is_active,
             enabled_modules(text[]), limits(jsonb), contexts(text[]), metadata(jsonb),
             features(jsonb), stripe_price_id, max_users, created_at, updated_at

public.invitations                  ← org invitation records
    columns: id, email, invited_by, organization_id, branch_id*, team_id*, role_id*,
             token (UNIQUE), status ('pending'|'accepted'|'cancelled'|'declined'),
             expires_at, accepted_at, declined_at, created_at, deleted_at,
             invited_first_name, invited_last_name
    * legacy columns, not used in current primary flow

public.invitation_role_assignments  ← roles to assign to invitee on acceptance
    columns: id, invitation_id (FK→invitations CASCADE), role_id (FK→roles RESTRICT),
             scope ('org'|'branch'), scope_id (UUID)

-- LEGACY ARTIFACTS (empty, no RLS, not used in runtime):
public.modules          (slug, label, description, settings, deleted_at)
public.user_modules     (user_id, module_id, setting_overrides, deleted_at)
```

### Table Relationships Summary

- `public.users.id` ← FK from: `organization_members.user_id`, `user_preferences.user_id`, `user_role_assignments.user_id`, `org_position_assignments.user_id`
- `organizations.id` ← FK from: `organization_members.organization_id`, `organization_profiles.organization_id`, `branches.organization_id`, `organization_subscriptions.organization_id`, `organization_entitlements.organization_id`, `org_positions.org_id`, `org_position_assignments.org_id`, `invitations.organization_id`, `roles.organization_id` (nullable for system roles)
- `branches.id` ← FK from: `user_role_assignments.scope_id` (when scope='branch'), `org_position_assignments.branch_id`
- `roles.id` ← FK from: `user_role_assignments.role_id`, `role_permissions.role_id`, `invitation_role_assignments.role_id`
- `permissions.id` ← FK from: `role_permissions.permission_id`, `user_permission_overrides.permission_id`

---

## 2. Permissions Architecture

### Permission Slug Structure

Format: `<category>.<action>` or `<category>.<subcategory>.<action>`

Examples:

```
members.read
members.manage
branches.view.any
module.organization-management.access
branch.roles.manage
account.*            ← wildcard slug
module.*             ← wildcard slug
```

### Seeded Permission Slugs (27 total as of 2026-03-11)

| Category     | Slugs                                                                                                                                              |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `account`    | `account.*`                                                                                                                                        |
| `branch`     | `branch.roles.manage`                                                                                                                              |
| `branches`   | `branches.create`, `.delete`, `.read`, `.update`, `.view.any`, `.view.remove.any`, `.view.update.any`                                              |
| `invites`    | `invites.cancel`, `.create`, `.read`                                                                                                               |
| `members`    | `members.manage`, `.read`                                                                                                                          |
| `module`     | `module.*`, `module.home.access`, `module.organization-management.access`, `module.teams.access`, `module.tools.access`, `module.warehouse.access` |
| `org`        | `org.read`, `org.update`                                                                                                                           |
| `self`       | `self.read`, `self.update`                                                                                                                         |
| `superadmin` | `superadmin.*`                                                                                                                                     |
| `tools`      | `tools.manage`, `tools.read`                                                                                                                       |

**NOT seeded (code-defined only, no DB row):**

- `account.preferences.read/update`, `account.profile.read/update`, `account.settings.read/update` — target slugs for `account.*` wildcard
- `superadmin.admin.read`, `superadmin.plans.read`, `superadmin.pricing.read` — admin uses synthetic snapshot, no DB compilation needed
- `warehouse.*` and all granular warehouse permissions — warehouse module uses code-level guards only
- `teams.*` and all granular teams permissions — not yet implemented at DB level

**IMPORTANT:** `account.*` wildcard currently expands to ZERO concrete permissions because no `account.*` children are seeded. `org_member` users have `account.*` in their role_permissions but receive no compiled account permissions. This is a known gap to fix when account features go to DB-level enforcement.

### System Roles

| Role         | Type  | Scope | Permission Grant                                                                                                           |
| ------------ | ----- | ----- | -------------------------------------------------------------------------------------------------------------------------- |
| `org_owner`  | basic | org   | 28 permissions — full coverage of all non-wildcard slugs + `module.*` wildcard                                             |
| `org_member` | basic | org   | 8 permissions — `account.*`(phantom), `branches.read`, `members.read`, `org.read`, `self.read/update`, `tools.read/manage` |

Custom roles are created by org owners (`is_basic=false`, `organization_id = org_id`). They can have any subset of seeded permissions.

### Role → Permission Mapping Flow

```
user_role_assignments
    user_id, role_id, scope ('org'|'branch'), scope_id
           ↓
    role_permissions (role_id, permission_id, allowed=true)
           ↓
    permissions (slug, category, action)
           ↓
    WILDCARD EXPANSION (if slug contains '*'):
        LEFT JOIN permissions p2
        WHERE p2.slug LIKE replace(p.slug, '*', '%')
          AND p2.slug NOT LIKE '%*%'  -- concrete targets only
           ↓
    user_effective_permissions
        permission_slug (original, may be wildcard)
        permission_slug_exact (always concrete slug)
        branch_id (NULL = org-scope, UUID = branch-scope)
```

### Org vs Branch Scope

**Org-scoped permissions** (`branch_id IS NULL` in UEP):

- Derived from `user_role_assignments WHERE scope='org'`
- Satisfy `has_permission(org_id, slug)` checks
- Apply across the entire organization

**Branch-scoped permissions** (`branch_id = <uuid>` in UEP):

- Derived from `user_role_assignments WHERE scope='branch'`
- Satisfy `has_branch_permission(org_id, branch_id, slug)` checks
- Apply only to the specific branch (plus: org-wide grants also satisfy branch checks — see `has_branch_permission`)

**Critical rule:** `has_branch_permission` returns TRUE if EITHER:

1. An org-wide grant exists for the slug (`branch_id IS NULL`)
2. A branch-specific grant exists for that exact branch (`branch_id = p_branch_id`)

This means org_owners (who have org-scoped permissions) automatically pass all branch permission checks.

### `compile_user_permissions` Logic

The function is `SECURITY DEFINER` and atomically:

1. **Membership gate**: If user is not active member of org → delete all UEP rows for (user, org) and return
2. **Advisory lock**: Prevents concurrent compilation for same (user, org) pair
3. **Wipe**: Delete all existing UEP rows for (user, org)
4. **INSERT 1 — Org-scoped**: From `user_role_assignments WHERE scope='org'` + `role_permissions` + wildcard expansion. Revoke overrides suppress rows. Grant overrides add rows.
5. **INSERT 2 — Branch-scoped**: From `user_role_assignments WHERE scope='branch'` + `role_permissions` + wildcard expansion. Branch must belong to target org and not be soft-deleted.
6. Both inserts use `ON CONFLICT ON CONSTRAINT user_effective_permissions_unique_v3 DO UPDATE` for idempotency.

**Trigger events that cause auto-recompile:**

- INSERT on `organization_members` (new membership)
- INSERT on `user_role_assignments` (role grant)
- INSERT on `role_permissions` (permission added to role)
- INSERT on `user_permission_overrides` (explicit override)

**NOT triggered automatically (requires manual call):**

- DELETE/soft-delete of `user_role_assignments`
- DELETE/soft-delete of `role_permissions`
- DELETE of `user_permission_overrides`

Applications must call `compile_user_permissions(user_id, org_id)` explicitly after these operations.

---

## 3. Entitlements Architecture

### Pipeline

```
organization_subscriptions (org_id, plan_id, status)
           ↓
    subscription_plans (enabled_modules[], limits{}, contexts[])
           +
    organization_module_addons (module_slug, status='active')
           +
    organization_limit_overrides (limit_key, limit_value)
           ↓
    recompute_organization_entitlements(org_id)
           ↓
    organization_entitlements (org_id, enabled_modules[], limits{}, contexts{})
```

### `recompute_organization_entitlements` Logic

1. Resolve active/trialing subscription → plan. Fallback: `free` plan by name.
2. Collect active module addons.
3. Merge plan modules + addon modules (deduplicated array).
4. Start with plan limits JSONB, overlay each `organization_limit_overrides` row.
5. Upsert `organization_entitlements` with computed values.
6. Uses `pg_advisory_xact_lock(hashtext(org_id))` for safety.

**Auto-triggered by:**

- INSERT on `organization_subscriptions`
- INSERT on `organization_module_addons`
- INSERT on `organization_limit_overrides`

**NOT triggered by UPDATE** on subscriptions or addons. Must be called manually after plan changes.

### Subscription Plans (as of 2026-03-11)

| Plan           | Modules                              | Limits                                                               |
| -------------- | ------------------------------------ | -------------------------------------------------------------------- |
| `free`         | org-management, home, support, tools | max_users:3, max_products:100, max_branches:1, max_locations:5       |
| `professional` | + warehouse, teams                   | max_users:50, max_products:10000, max_branches:10, max_locations:100 |
| `enterprise`   | all                                  | all limits: -1 (unlimited)                                           |

Limits are stored as JSONB with keys like `"organization.max_users"`, `"warehouse.max_products"`, etc.

### Entitlement Guards in Code

- `entitlements.requireModuleOrRedirect(MODULE_SLUG)` — redirects to `/upgrade` if `enabled_modules` does not include the slug
- `entitlements.requireModuleAccess(MODULE_SLUG)` — server action guard
- `MODULE_TOOLS` is NOT in any plan's `enabled_modules` — tools bypass entitlement check and use permission check only (`PERMISSION_TOOLS_READ`)

### Module Slugs

| Constant                         | Slug                        | Plan Gate                      |
| -------------------------------- | --------------------------- | ------------------------------ |
| `MODULE_HOME`                    | `"home"`                    | free+                          |
| `MODULE_ORGANIZATION_MANAGEMENT` | `"organization-management"` | free+                          |
| `MODULE_SUPPORT`                 | `"support"`                 | free+                          |
| `MODULE_TOOLS`                   | `"tools"`                   | No plan gate (permission only) |
| `MODULE_WAREHOUSE`               | `"warehouse"`               | professional+                  |
| `MODULE_TEAMS`                   | `"teams"`                   | professional+                  |
| `MODULE_ADMIN`                   | `"admin"`                   | Superadmin synthetic only      |

---

## 4. RLS Architecture

### General Pattern

Every application table follows one of these patterns:

**Pattern A — Org-isolated (most tables):**

```sql
-- SELECT: org members can read
USING (is_org_member(organization_id))
-- INSERT/UPDATE/DELETE: permission-gated
WITH CHECK (is_org_member(organization_id) AND has_permission(organization_id, 'permission.slug'))
-- service_role: unrestricted
USING (true) WITH CHECK (true) -- FOR service_role
```

**Pattern B — Self-owned (user_preferences, users):**

```sql
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid())
```

**Pattern C — Cross-table validation (invitation_role_assignments):**

```sql
-- SELECT
USING (EXISTS (
  SELECT 1 FROM invitations i
  WHERE i.id = invitation_role_assignments.invitation_id
    AND has_permission(i.organization_id, 'invites.read')
))
```

**Pattern D — Dual permissive + restrictive (roles table):**

```sql
-- PERMISSIVE UPDATE: grants based on current state
USING (... AND has_permission(..., 'members.manage'))
-- RESTRICTIVE UPDATE: enforces final state constraints
-- Both must pass; restrictive prevents bypasses
```

### Helper Function Dependency Chain

```
RLS policy
    └─► is_org_member(org_id)
            └─► SELECT FROM organization_members WHERE user_id = auth.uid()
                    └─► idx_organization_members_user_org

    └─► has_permission(org_id, slug)
            └─► SELECT FROM user_effective_permissions
                  WHERE user_id = auth.uid()
                    AND organization_id = org_id
                    AND permission_slug_exact = slug
                    AND branch_id IS NULL
                        └─► uep_org_slug_exact_idx (PARTIAL, branch_id IS NULL)

    └─► has_branch_permission(org_id, branch_id, slug)
            └─► SELECT FROM user_effective_permissions
                  WHERE ... AND (branch_id IS NULL OR branch_id = p_branch_id)
                        └─► uep_branch_slug_exact_idx + uep_org_slug_exact_idx
```

### FORCE ROW LEVEL SECURITY

Tables with `FORCE ROW LEVEL SECURITY = true` enforce RLS even for table owners. These are the tables where a superuser or postgres connection must not accidentally bypass isolation:

`branches`, `invitations`, `organization_entitlements`, `organization_limit_overrides`, `organization_members`, `organization_module_addons`, `organization_profiles`, `organization_subscriptions`, `role_permissions`, `roles`, `subscription_plans`, `user_effective_permissions`, `user_permission_overrides`, `user_preferences`, `user_role_assignments`

NOT forced (low risk since these are reference tables or all writes go through DEFINER functions):
`organizations`, `permissions`, `users`, `org_positions`, `org_position_assignments`, `invitation_role_assignments`

### Soft-Delete Considerations

Several tables use soft-delete (`deleted_at` column). RLS policies handle this:

- `invitations`: policies include `AND (deleted_at IS NULL)`
- `organization_members`: `is_org_member` requires `deleted_at IS NULL`
- `roles`, `role_permissions`: SELECT policies include `AND deleted_at IS NULL`
- `user_role_assignments`: `is_org_member` checked internally; no explicit filter in policy (relies on `is_org_member` gate)
- `branches`: index `idx_branches_org_not_deleted` uses `WHERE deleted_at IS NULL`

---

## 5. Core Helper Functions

### `is_org_member(org_id uuid) → boolean`

```sql
SELECT EXISTS (
  SELECT 1 FROM public.organization_members
  WHERE organization_id = org_id
    AND user_id = auth.uid()
    AND status = 'active'
    AND deleted_at IS NULL
);
```

- **Type:** SECURITY DEFINER, STABLE
- **Usage:** Foundation of all org-scoped RLS policies. Called on virtually every authenticated DB operation.
- **Performance:** Uses `idx_organization_members_user_org(user_id, organization_id)`. Missing partial index on `status`/`deleted_at` — see performance notes.
- **Returns false for:** unauthenticated calls (auth.uid() = NULL), soft-deleted members, inactive members.

---

### `has_permission(org_id uuid, permission text) → boolean`

```sql
SELECT EXISTS (
  SELECT 1 FROM public.user_effective_permissions
  WHERE organization_id = org_id
    AND user_id = auth.uid()
    AND permission_slug_exact = permission
    AND branch_id IS NULL
);
```

- **Type:** SECURITY DEFINER, STABLE
- **Usage:** All org-level permission gates in RLS (members.manage, org.update, invites.create, etc.)
- **Performance:** Uses `uep_org_slug_exact_idx` — very fast, partial index on `branch_id IS NULL`.
- **Note:** Only checks org-scope UEP rows. Does NOT check branch-scoped permissions. For branch operations use `has_branch_permission`.

---

### `has_branch_permission(p_org_id uuid, p_branch_id uuid, p_permission_slug text) → boolean`

```sql
SELECT EXISTS (
  SELECT 1 FROM public.user_effective_permissions
  WHERE user_id = auth.uid()
    AND organization_id = p_org_id
    AND permission_slug_exact = p_permission_slug
    AND (
      branch_id IS NULL         -- org-wide grant satisfies branch check
      OR branch_id = p_branch_id -- branch-specific grant
    )
);
```

- **Type:** SECURITY DEFINER, STABLE
- **Usage:** Branch-scoped operations (branch role assignment, branch-manager access control).
- **Performance:** Uses `uep_branch_slug_exact_idx` + `uep_org_slug_exact_idx` partial indexes.
- **Note:** An org-wide grant (`branch_id IS NULL`) satisfies any branch check. Org owners always pass.

---

### `compile_user_permissions(p_user_id uuid, p_organization_id uuid) → void`

- **Type:** SECURITY DEFINER, VOLATILE
- **Purpose:** Atomically recomputes all UEP rows for (user, org). Full description in Section 2.
- **Called by:** Auto-triggered on membership/role/override INSERT. Manually called after deletes, during onboarding, and after invitation acceptance.
- **Advisory lock:** `pg_advisory_xact_lock(hashtext(user_id || org_id))` — transaction-scoped.
- **Side effects:** Fully replaces all UEP rows for the (user, org) pair. Old rows are deleted first.

---

### `recompute_organization_entitlements(p_org_id uuid) → void`

- **Type:** SECURITY DEFINER, VOLATILE
- **Purpose:** Recomputes `organization_entitlements` from subscription plan + addons + limit overrides. Full description in Section 3.
- **Called by:** Auto-triggered on subscription/addon/override INSERT. Manually called during onboarding.
- **Advisory lock:** `pg_advisory_xact_lock(hashtext(org_id))` — transaction-scoped.

---

### `check_org_slug_available(p_slug text) → boolean`

```sql
SELECT NOT EXISTS (
  SELECT 1 FROM public.organizations
  WHERE slug = trim(p_slug) AND deleted_at IS NULL
);
```

- **Type:** SECURITY DEFINER, STABLE
- **Purpose:** Bypass `organizations_select_member` RLS so unauthenticated/pre-membership users can check slug availability during onboarding.
- **Granted to:** `authenticated`, `anon` (intentional — used before org creation)

---

### `custom_access_token_hook(event jsonb) → jsonb`

- **Type:** SECURITY DEFINER, STABLE
- **Purpose:** Enriches Supabase JWT with user's role assignments in `app_metadata.roles[]`
- **Called by:** Supabase auth system on every token issuance
- **Output:** Injects `{ role_id, name, is_basic, scope, scope_id, scope_type }` objects into JWT
- **Access:** `service_role` + `supabase_auth_admin` only (correct)

---

### `validate_role_assignment_scope() → trigger`

- **Type:** BEFORE INSERT trigger on `user_role_assignments`
- **Purpose:** Enforces `scope_type` compatibility — org-only roles cannot be assigned at branch scope and vice versa. Roles with `scope_type='both'` pass either.
- **On violation:** Raises EXCEPTION (rolls back the INSERT)

---

## 6. Org Onboarding Pipeline

### Trigger: `handle_user_signup_hook`

Called by Supabase auth system on every new signup. Minimal bootstrap only:

```sql
1. INSERT INTO public.users (id, email, first_name, last_name)
   -- from auth.users data, ON CONFLICT DO NOTHING

2. INSERT INTO public.user_preferences (user_id, organization_id)
   VALUES (uid, NULL)
   -- org_id is NULL — user has no org yet
   -- ON CONFLICT (user_id) DO NOTHING
```

After signup, user is redirected to onboarding wizard (`/onboarding`).

### RPC: `create_organization_for_current_user`

Signature: `(p_name text, p_branch_name text, p_plan_id uuid DEFAULT NULL, p_name_2 text DEFAULT NULL, p_slug text DEFAULT NULL) → jsonb`

**Execution steps (atomic transaction):**

```
1. Auth check: auth.uid() must not be NULL

2. Idempotency check: if user already has an org-scoped role assignment,
   return { success: true, organization_id: existing_id, already_existed: true }

3. Plan resolution:
   a. Use p_plan_id if valid active plan
   b. Fallback to 'free' plan by name
   c. Return INVALID error if no plan found

4. Role resolution:
   SELECT id FROM roles WHERE name='org_owner' AND is_basic=true

5. Slug processing:
   a. If p_slug provided: check uniqueness (return SLUG_TAKEN if taken)
   b. If not provided: auto-generate from name+name_2 + random suffix

6. Ensure public.users row exists (UPSERT)

7. INSERT INTO organizations (name, name_2, slug)

8. INSERT INTO organization_profiles (organization_id, name, name_2, slug)
   ON CONFLICT DO UPDATE (idempotent)

9. INSERT INTO branches (organization_id, name, slug)

10. INSERT INTO organization_members (user_id, organization_id)
    ON CONFLICT DO NOTHING

11. INSERT INTO user_role_assignments (user_id, role_id='org_owner', scope='org', scope_id=org_id)
    ON CONFLICT DO NOTHING

12. INSERT INTO organization_subscriptions (organization_id, plan_id, status='active')
    ON CONFLICT DO NOTHING

13. PERFORM recompute_organization_entitlements(org_id)

14. PERFORM compile_user_permissions(user_id, org_id)

15. UPSERT user_preferences (user_id) SET organization_id, default_branch_id, last_branch_id

16. RETURN { success: true, organization_id, branch_id }
```

**Returns:**

- `{ success: true, organization_id, branch_id }` — success
- `{ success: false, error: 'SLUG_TAKEN' }` — slug already in use
- `{ success: false, error: 'NO_VALID_PLAN' }` — no plans in DB
- `{ success: true, already_existed: true }` — idempotency return

---

## 7. Invitation System Architecture

### Lifecycle

```
[inviter] createInvitation(email, name, role_assignments[])
    │
    ├─► check_invitation_eligibility(org_id, email, inviter_id)
    │       Checks: SELF_INVITE, ALREADY_MEMBER, DUPLICATE_PENDING
    │
    ├─► INSERT INTO invitations (email, invited_by, org_id, token, status='pending', expires_at)
    │
    ├─► INSERT INTO invitation_role_assignments (invitation_id, role_id, scope, scope_id)
    │       One row per role assignment in the invite
    │
    └─► [email sent to invitee with token link]

[invitee] Views invitation preview: get_invitation_preview_by_token(token)
    Returns org name, inviter info, role names (no auth required)

[invitee] Accepts: accept_invitation_and_join_org(token)
    │
    ├─► Validate: token exists, status='pending', not expired, not deleted
    ├─► Resolve org from invitation
    ├─► UPSERT public.users (id, email) — ensures row exists for new signups
    ├─► UPSERT user_preferences (org_id) — points user to invited org
    ├─► INSERT organization_members (user_id, org_id, status='active')
    ├─► Copy IRA rows → user_role_assignments:
    │       For each invitation_role_assignment:
    │           Validate scope compatibility (validate_role_assignment_scope)
    │           INSERT user_role_assignments (user_id, role_id, scope, scope_id)
    │           ON CONFLICT DO NOTHING
    ├─► Mark invitation: status='accepted', accepted_at=now()
    └─► compile_user_permissions(user_id, org_id)

[invitee] Declines: decline_invitation(token)
    Updates status='declined', declined_at=now()

[inviter] Cancels: UPDATE invitations SET status='cancelled'
    Via RLS: requires invites.cancel permission
```

### Invitation Uniqueness

`invitations_org_pending_email_idx`: UNIQUE on `(organization_id, lower(email)) WHERE status='pending' AND deleted_at IS NULL`

This prevents duplicate pending invitations to the same email within an org.

### Eligibility RPC: `check_invitation_eligibility`

Returns `{ eligible: bool, reason?: string }` with reasons:

- `SELF_INVITE` — inviter trying to invite themselves
- `ALREADY_MEMBER` — target email is already an active member of the org
- `DUPLICATE_PENDING` — pending invitation already exists for this email in this org

---

## 8. Security Design

### Defense Layers

```
Layer 1: Network / Auth
    Supabase Auth JWT required for all authenticated operations
    custom_access_token_hook enriches JWT with roles (used by client-side RBAC)

Layer 2: Row Level Security (Database)
    All 21 application tables have RLS enabled
    is_org_member() + has_permission() gates on every sensitive operation
    FORCE ROW LEVEL SECURITY on 15 core tables

Layer 3: SECURITY DEFINER Functions
    Privileged operations (org creation, invitation acceptance, compile, recompute)
    execute with elevated privileges but with set search_path = '' for safety
    These bypass RLS where needed but contain explicit authorization checks

Layer 4: Server-side Permission Validation (Application)
    Server actions use PermissionService.getPermissionSnapshotForUser()
    Actions call checkPermission(snapshot, PERMISSION_SLUG) before any operation
    Layout components use loadDashboardContextV2 for SSR permission loading

Layer 5: Client-side Guards (UI)
    usePermissions() hook for conditional rendering
    HasAnyRoleServer / HasAnyRoleClient components
    Sidebar requiresPermissions / requiresAnyPermissions
```

### Privileged Operations

All of these BYPASS RLS and require SECURITY DEFINER:

| Operation              | Function                               | Why DEFINER needed                                                              |
| ---------------------- | -------------------------------------- | ------------------------------------------------------------------------------- |
| Org creation           | `create_organization_for_current_user` | Writes to organizations, roles, subscriptions across tenant boundary            |
| Permission compilation | `compile_user_permissions`             | Writes to UEP (no authenticated write policy)                                   |
| Entitlements recompute | `recompute_organization_entitlements`  | Writes to entitlements (service_role only in policies)                          |
| Invitation acceptance  | `accept_invitation_and_join_org`       | Creates membership + role assignment for an invitee who may not be a member yet |
| Role deletion          | `delete_org_role`                      | Atomically soft-deletes across multiple tables                                  |
| Slug availability      | `check_org_slug_available`             | Reads organizations without being a member                                      |

### `service_role` Usage

`service_role` has `BYPASSRLS` — it bypasses all RLS policies regardless of presence/absence of explicit service_role policies. The explicit `_all_service_role` policies on tables are declarative documentation of intent, not functional requirements.

Used in application code for:

- Admin operations
- Billing webhooks (subscription/plan updates)
- Background jobs that recompute entitlements

### Storage Bucket Security

| Bucket         | Access Model            | Policy Logic                                                                                                 |
| -------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------ |
| `org-logos`    | Public read, auth write | SELECT: public (all); INSERT/UPDATE/DELETE: `is_org_member(folder[0]) AND has_permission(..., 'org.update')` |
| `user-avatars` | Private, self-only      | All operations: `folder[0] = auth.uid()::text`                                                               |

Folder structure for `org-logos`: `/{org_id}/{filename}` — org_id is extracted via `storage.foldername(name)[1]` and cast to UUID for permission checks.

---

## 9. Performance Considerations

### Critical Indexes

| Index                                  | Table                      | Purpose                                                                                                       |
| -------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `uep_org_slug_exact_idx`               | user_effective_permissions | `has_permission()` hot path — `(org_id, user_id, permission_slug_exact) WHERE branch_id IS NULL`              |
| `uep_branch_slug_exact_idx`            | user_effective_permissions | `has_branch_permission()` — `(org_id, user_id, branch_id, permission_slug_exact) WHERE branch_id IS NOT NULL` |
| `user_effective_permissions_unique_v3` | user_effective_permissions | Conflict resolution on compile — `(user_id, org_id, permission_slug_exact, branch_id) NULLS NOT DISTINCT`     |
| `idx_organization_members_user_org`    | organization_members       | `is_org_member()` — `(user_id, organization_id)`                                                              |
| `idx_invitations_token_status_email`   | invitations                | Token lookup — `(token, status, email) WHERE deleted_at IS NULL`                                              |
| `invitations_org_pending_email_idx`    | invitations                | Duplicate prevention — `(org_id, lower(email)) WHERE status='pending' AND deleted_at IS NULL`                 |

### UEP Caching Strategy

`user_effective_permissions` is a **compiled cache** (not a live view). The compile is triggered:

- Immediately on certain events (INSERT triggers on role_assignments, role_permissions, overrides, membership)
- Manually by server actions after role deletions

The cache is per (user_id, organization_id) pair. A full recompile wipes and replaces all rows for that pair. Advisory lock prevents duplicate concurrent compiles.

**Trade-off:** Stale permissions are possible between a DELETE operation and the next manual compile. This window is typically < 1 second in normal application flow.

### Known Performance Gaps

1. **`is_org_member` missing partial index**: `idx_organization_members_user_org(user_id, organization_id)` does not filter on `status='active' AND deleted_at IS NULL`. For large orgs with many historical members, this scans more rows than needed. Recommended fix: add partial index.

2. **`users_select_org_member` double join**: The policy for reading other org members' user records performs a self-join on `organization_members`. For orgs with 500+ members this policy fires on every `SELECT FROM users`. Acceptable at current scale; monitor for degradation.

3. **`user_role_assignments` branch policies**: INSERT/UPDATE/DELETE for branch-scoped operations perform a correlated subquery `SELECT organization_id FROM branches WHERE id = scope_id`. The branches primary key index makes this fast; acceptable.

---

## 10. Known Limitations

### L1 — `account.*` Phantom Wildcard

`org_member` role has `account.*` in role_permissions but no concrete `account.*` children exist in the permissions table. The wildcard expands to zero rows. All org_member users currently have no `account.*` permissions in their UEP.

**Impact today:** No RLS policies check account permissions, so no functional bug. Code uses `account.*` for future account settings features.

**Fix required before:** Any feature that gates UI/DB operations on `account.preferences.read` or similar.

### L2 — Compile Triggers Only Fire on INSERT

Permissions do not automatically recompile when:

- A user's role assignment is deleted (soft or hard)
- A permission is removed from a role
- A permission override is deleted

Application code MUST call `compile_user_permissions(user_id, org_id)` after these operations.

**Current gap:** `delete_org_role` RPC soft-deletes role assignments but does not recompile affected users' permissions.

### L3 — Entitlements Not Recomputed on Subscription UPDATE

`recompute_organization_entitlements` is triggered by INSERT on `organization_subscriptions` but not UPDATE. Plan upgrades/downgrades via UPDATE require an explicit call.

### L4 — Legacy Tables with No RLS

`modules` and `user_modules` exist from an older design where module access was DB-driven. Both are empty. Module system is now config-file-based (`src/modules/`). These tables should be deprecated.

### L5 — Dead Function Overload

`create_organization_for_current_user(text, text, uuid)` (3-param) exists alongside the current 5-param version. The 3-param version omits `name_2` and `slug`, so calling it via RPC with only 3 args creates an org without profile slug. Should be dropped.

### L6 — Warehouse and Teams Permission Gaps

No `warehouse.*` or `teams.*` permission slugs are seeded in the DB. These modules currently enforce access via plan entitlements only (not DB-level permission checks). When fine-grained warehouse/teams permissions are needed, slugs must be seeded and compile paths verified.

### L7 — `invitations` Legacy Columns

`branch_id`, `team_id`, and `role_id` columns exist from older invitation designs. The current system uses `invitation_role_assignments` for multi-role invites. The `role_id` column has a fallback code path in `accept_invitation_and_join_org` but is not used in the primary invite creation flow. These columns are candidates for deprecation.

### L8 — `users.status_id` and `users.default_branch_id`

`status_id` is a UUID column with no FK (no `user_statuses` table). `default_branch_id` duplicates `user_preferences.default_branch_id`. Both appear to be legacy remnants. No application code references them.

### L9 — `anon` EXECUTE on Sensitive Functions

All functions have `anon` EXECUTE grant via the PostgreSQL `public` role. While most functions are safe to call as anon (they check `auth.uid()` internally), `compile_user_permissions` and `recompute_organization_entitlements` are potential DoS vectors if callable by unauthenticated users without rate limiting. Supabase's API gateway provides some protection but the DB grants should be tightened.

### L10 — `org_positions` / `org_position_assignments` Policy Role Specification

All RLS policies on these tables specify `{public}` role instead of `{authenticated}`. Functionally harmless due to `is_org_member()` auth check, but incorrect specification that should be corrected.

---

_Document generated from verified live schema state. Re-audit before major schema changes._
