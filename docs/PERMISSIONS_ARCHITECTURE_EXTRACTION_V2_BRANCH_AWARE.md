# Permissions Architecture — V2 Branch-Aware (Verified 2026-03-04, Hardened + 10k-ready)

> **Status**: Fully verified against live DB + source code. Hardening patches applied (Phase 2 + follow-up audit + 10k-ready performance package).
> Branch: `org-managment-v2`. Hardening: `canFromSnapshot` wildcard-safe, action renamed, UPO index dropped, RLS slug inventory expanded to 10 slugs, DB-backed invariant test added, 10k-ready partial indexes + two-query snapshot strategy.

---

## Table of Contents

1. [Architecture Summary](#1-architecture-summary)
2. [Core Principle: Compile, Don't Evaluate](#2-core-principle-compile-dont-evaluate)
3. [URA Usage Invariant](#3-ura-usage-invariant)
4. [Database Tables](#4-database-tables)
5. [Database Functions](#5-database-functions)
6. [Database Triggers](#6-database-triggers)
7. [RLS Policies](#7-rls-policies)
8. [RLS / RPC Exact-Match Rule](#8-rls--rpc-exact-match-rule)
9. [TypeScript Layer](#9-typescript-layer)
10. [Server Actions (V2)](#10-server-actions-v2)
11. [Client-Side Permission Checking](#11-client-side-permission-checking)
12. [SSR Loading Pipeline](#12-ssr-loading-pipeline)
13. [Wildcard Handling](#13-wildcard-handling)
14. [Org Revoke Cascade Behaviour](#14-org-revoke-cascade-behaviour)
15. [Live DB Sanity Check (2026-03-04)](#15-live-db-sanity-check-2026-03-04)
16. [Known Issues and Design Decisions](#16-known-issues-and-design-decisions)
17. [Deprecated / Retired Code](#17-deprecated--retired-code)
18. [Permission Slug Inventory](#18-permission-slug-inventory)
19. [Diff vs Previous Doc](#19-diff-vs-previous-doc)
20. [10k-ready Performance Package](#20-10k-ready-performance-package)

---

## 1. Architecture Summary

```
User changes role assignment or override
         │
         ▼
  DB TRIGGER (AFTER INSERT/UPDATE/DELETE)
  ┌─ user_role_assignments → trigger_compile_on_role_assignment()
  └─ user_permission_overrides → trigger_compile_on_override()
         │
         ▼
  compile_user_permissions(user_id, organization_id)
  ┌─ Advisory lock (prevents races)
  ├─ Active membership guard (wipes UEP if not active member)
  ├─ DELETE existing UEP rows for user+org
  ├─ INSERT org-scoped rows   (branch_id = NULL)
  └─ INSERT branch-scoped rows (branch_id = <uuid>)
         │
         ▼
  user_effective_permissions  ←── SINGLE SOURCE OF TRUTH
         │
         ├── SSR: PermissionServiceV2.getPermissionSnapshotForUser()
         │         → loadUserContextV2 → permissionSnapshot
         │
         ├── Client sync: getBranchPermissions() server action
         │         → PermissionsSync component → usePermissions hook
         │
         ├── DB gate: has_permission(org_id, slug)
         │         → RLS policies (exact match, org-scope only)
         │
         └── DB gate: has_branch_permission(org_id, branch_id, slug)
                    → RLS policies (exact match, branch-aware)
```

---

## 2. Core Principle: Compile, Don't Evaluate

The V2 permission system **never computes permissions at request time**. Instead:

- Permissions are **compiled** once into `user_effective_permissions` (UEP) whenever role assignments or overrides change.
- All request-time checks **read** pre-compiled facts from UEP.
- The compiler (`compile_user_permissions`) is a DB SECURITY DEFINER function, not TypeScript code.
- No TypeScript code derives effective permissions from `user_role_assignments` at runtime.

---

## 3. URA Usage Invariant

**"TS code must not derive effective permissions from URA. URA reads are permitted only for branch accessibility discovery."**

There is exactly one legitimate TypeScript read of `user_role_assignments` in the V2 pipeline:

**`_computeAccessibleBranches`** — `src/server/loaders/v2/load-dashboard-context.v2.ts`

```typescript
// SLOW PATH: user lacks BRANCHES_VIEW_ANY — find which branches they have any role in
const { data: assignments } = await supabase
  .from("user_role_assignments")
  .select("scope_id") // only branch UUIDs — no permission content
  .eq("user_id", userId)
  .eq("scope", "branch")
  .is("deleted_at", null);
```

- **Purpose**: discover WHICH BRANCHES exist for this user (accessibility discovery), not WHAT they can do.
- Only `scope_id` (branch UUID) is selected — no permission slugs read from URA.
- Permission content **always** comes from UEP via `getPermissionSnapshotForUser`.
- RLS "View own role assignments" (`user_id = auth.uid()`) permits this without `members.read`.
- This is NOT permission derivation. The "compile, don't evaluate" invariant is preserved.

Any other TypeScript read of `user_role_assignments` for permission computation would be an architectural violation.

---

## 4. Database Tables

### 4.1 `permissions` (30 active rows)

| Column                               | Type        | Nullable | Default           |
| ------------------------------------ | ----------- | -------- | ----------------- | ------ |
| id                                   | uuid        | NO       | gen_random_uuid() |
| slug                                 | text        | NO       | —                 | UNIQUE |
| label                                | text        | YES      | —                 |
| name                                 | text        | YES      | —                 |
| description                          | text        | YES      | —                 |
| category                             | text        | NO       | —                 |
| subcategory                          | text        | YES      | —                 |
| resource_type                        | text        | YES      | —                 |
| action                               | text        | NO       | —                 |
| scope_types                          | text[]      | YES      | —                 |
| is_system                            | bool        | YES      | false             |
| is_dangerous                         | bool        | YES      | false             |
| requires_mfa                         | bool        | YES      | false             |
| priority                             | int         | YES      | 0                 |
| metadata                             | jsonb       | YES      | '{}'              |
| created_at / updated_at / deleted_at | timestamptz | —        | —                 |

**Indexes**: `permissions_pkey`, `permissions_slug_key` (UNIQUE), `idx_permissions_category`, `idx_permissions_system`, `idx_permissions_dangerous`.

---

### 4.2 `roles`

| Column          | Type        | Nullable | Default           |
| --------------- | ----------- | -------- | ----------------- | ---------------------------------- |
| id              | uuid        | NO       | gen_random_uuid() |
| organization_id | uuid        | YES      | —                 | FK → organizations (NULL = system) |
| name            | text        | NO       | —                 |
| is_basic        | bool        | NO       | false             | true = system role                 |
| scope_type      | text        | NO       | 'org'             | 'org' \| 'branch' \| 'both'        |
| deleted_at      | timestamptz | YES      | —                 |

---

### 4.3 `role_permissions`

| Column        | Type        | Nullable | Default           |
| ------------- | ----------- | -------- | ----------------- | ---------------- |
| id            | uuid        | NO       | gen_random_uuid() |
| role_id       | uuid        | NO       | —                 | FK → roles       |
| permission_id | uuid        | NO       | —                 | FK → permissions |
| allowed       | bool        | NO       | true              |
| deleted_at    | timestamptz | YES      | —                 |

---

### 4.4 `user_role_assignments` (URA)

| Column     | Type        | Nullable |
| ---------- | ----------- | -------- | ------------------- |
| id         | uuid        | NO       |
| user_id    | uuid        | NO       |
| role_id    | uuid        | NO       |
| scope      | text        | NO       | 'org' or 'branch'   |
| scope_id   | uuid        | NO       | org_id or branch_id |
| deleted_at | timestamptz | YES      |

**Indexes**: PK, UNIQUE(user_id, role_id, scope, scope_id), `idx_user_role_assignments_compiler`(user_id, scope, scope_id WHERE deleted_at IS NULL).

**Triggers**: BEFORE INSERT/UPDATE: `validate_role_assignment_scope`. AFTER INSERT/UPDATE/DELETE: `trigger_compile_on_role_assignment`.

---

### 4.5 `user_permission_overrides` (UPO)

| Column                  | Type        | Nullable | Default           |
| ----------------------- | ----------- | -------- | ----------------- | ------------------- |
| id                      | uuid        | NO       | gen_random_uuid() |
| user_id                 | uuid        | NO       | —                 |
| organization_id         | uuid        | YES      | —                 |
| permission_id           | uuid        | NO       | —                 |
| permission_slug         | text        | YES      | —                 | Denormalized        |
| allowed                 | bool        | NO       | —                 | Legacy column       |
| effect                  | text        | NO       | 'grant'           | 'grant' \| 'revoke' |
| scope                   | text        | NO       | —                 |
| scope_id                | uuid        | YES      | —                 |
| deleted_at              | timestamptz | YES      | —                 |
| created_at / updated_at | timestamptz | NO       | now()             |

**Indexes (post-hardening):**
| Index | Definition |
|---|---|
| `user_permission_overrides_pkey` | UNIQUE(id) |
| `user_permission_overrides_unique_active` | UNIQUE(user_id, scope, scope_id, permission_id) WHERE deleted_at IS NULL |
| `idx_user_permission_overrides_compiler` | (user_id, organization_id, effect) WHERE deleted_at IS NULL |
| `idx_user_permission_overrides_created_at` | (created_at DESC) |

**Note**: `user_permission_overrides_uniq` was dropped in migration `20260304110000` — it was functionally redundant with `user_permission_overrides_unique_active` (same 4 columns, same WHERE predicate, only column order differed).

**Triggers**: BEFORE INSERT/UPDATE: `validate_permission_slug_on_override`. AFTER INSERT/UPDATE/DELETE: `trigger_compile_on_override`. BEFORE UPDATE: `update_user_permission_overrides_updated_at`.

---

### 4.6 `user_effective_permissions` (UEP) — Single Source of Truth

| Column          | Type        | Nullable | Default           |
| --------------- | ----------- | -------- | ----------------- | ---------------------------------------------------- |
| id              | uuid        | NO       | gen_random_uuid() |
| user_id         | uuid        | NO       | —                 |
| organization_id | uuid        | NO       | —                 |
| permission_slug | text        | NO       | —                 | Verbatim from permissions.slug (wildcards preserved) |
| source_type     | text        | NO       | 'role'            | 'role' \| 'override'                                 |
| source_id       | uuid        | YES      | —                 |
| branch_id       | uuid        | YES      | —                 | **NULL = org-scoped; UUID = branch-scoped**          |
| created_at      | timestamptz | NO       | now()             |
| compiled_at     | timestamptz | NO       | now()             |

**Constraints**: UNIQUE `user_effective_permissions_unique_v2`(user_id, org_id, permission_slug, branch_id) NULLS NOT DISTINCT.

**Indexes**: `idx_uep_user_org`, `idx_uep_user_org_branch`, `idx_uep_user_org_permission`, `idx_uep_permission`.

**Critical semantics**:

- `branch_id IS NULL` = org-scoped (applies everywhere in the org)
- `branch_id = <uuid>` = branch-scoped (applies only in that branch)
- Compiler does **NOT** expand wildcards — `module.*`, `account.*` stored verbatim

---

### 4.7 `organization_members`

| Column          | Type        | Notes                                 |
| --------------- | ----------- | ------------------------------------- |
| organization_id | uuid        | FK → organizations                    |
| user_id         | uuid        | FK → users                            |
| status          | text        | 'active' \| 'inactive' \| 'suspended' |
| deleted_at      | timestamptz | Soft delete                           |

**Role in compiler**: If user is not an active member, compiler wipes all UEP rows for that user+org and exits.

---

### 4.8 `branches`

| Column          | Type        | Notes                                   |
| --------------- | ----------- | --------------------------------------- |
| id              | uuid        | PK                                      |
| organization_id | uuid        | FK — org isolation enforced in compiler |
| name            | text        |                                         |
| slug            | text        |                                         |
| deleted_at      | timestamptz | Soft delete                             |

---

## 5. Database Functions

### 5.1 `compile_user_permissions(p_user_id, p_organization_id)` — SECURITY DEFINER

**The sole authoritative permission compiler.** Called only by triggers.

```
1. Active membership guard:
   IF NOT (active org member) → DELETE UEP rows + RETURN

2. Advisory lock: pg_advisory_xact_lock(hashtext(user_id || org_id))
   → Prevents concurrent compilation races for same user+org

3. DELETE all UEP rows for user+org  (full wipe before recompile)

4. INSERT org-scoped (branch_id = NULL):
   URA(scope='org', scope_id=org_id)
     → role_permissions(allowed=true)
     → permissions.slug
   UNION upo(effect='grant')
   MINUS upo(effect='revoke')     ← applied here, prevents slug from appearing

5. INSERT branch-scoped (branch_id = ura.scope_id):
   URA(scope='branch')
     → role_permissions
     → permissions.slug
   JOIN branches b ON b.id=scope_id AND b.organization_id=p_org_id  ← cross-org guard
   MINUS upo(effect='revoke')     ← same revoke check as org-scoped

ON CONFLICT (unique_v2) DO UPDATE SET compiled_at=now(), source_type=EXCLUDED.source_type
```

---

### 5.2 `has_permission(org_id, permission) → boolean`

```sql
SELECT EXISTS (
  SELECT 1 FROM user_effective_permissions
  WHERE organization_id = org_id AND user_id = auth.uid()
    AND permission_slug = permission AND branch_id IS NULL
);
```

Exact match. Org-scope only. Used in RLS policies.

---

### 5.3 `has_branch_permission(p_org_id, p_branch_id, p_slug) → boolean`

```sql
SELECT EXISTS (
  SELECT 1 FROM user_effective_permissions
  WHERE user_id = auth.uid() AND organization_id = p_org_id
    AND permission_slug = p_slug
    AND (branch_id IS NULL OR branch_id = p_branch_id)
);
```

Exact match. Branch-aware (org-wide grants satisfy branch checks). Used in RLS policies.

---

### 5.4 `user_has_effective_permission(p_user_id, p_org_id, p_slug) → boolean`

```sql
SELECT EXISTS (
  SELECT 1 FROM user_effective_permissions
  WHERE user_id = p_user_id AND organization_id = p_org_id
    AND permission_slug = p_slug AND branch_id IS NULL
);
```

Exact match. Org-scope. Explicit user_id. Used by `PermissionServiceV2.hasPermission()`.

---

### 5.5 `is_org_member(org_id) → boolean`

```sql
SELECT EXISTS (
  SELECT 1 FROM organization_members
  WHERE organization_id = org_id AND user_id = auth.uid()
    AND status = 'active' AND deleted_at IS NULL
);
```

---

### 5.6 `validate_role_assignment_scope() → trigger`

Prevents assigning `scope_type='org'` roles at branch scope and vice versa.

---

## 6. Database Triggers

| Table                     | Trigger                                      | Timing | Events                 | Function                                      |
| ------------------------- | -------------------------------------------- | ------ | ---------------------- | --------------------------------------------- |
| user_role_assignments     | trigger_role_assignment_compile              | AFTER  | INSERT, UPDATE, DELETE | trigger_compile_on_role_assignment()          |
| user_role_assignments     | check_role_assignment_scope                  | BEFORE | INSERT, UPDATE         | validate_role_assignment_scope()              |
| user_permission_overrides | trigger_override_compile                     | AFTER  | INSERT, UPDATE, DELETE | trigger_compile_on_override()                 |
| user_permission_overrides | trigger_user_permission_overrides_updated_at | BEFORE | UPDATE                 | update_user_permission_overrides_updated_at() |
| user_permission_overrides | trigger_validate_permission_slug             | BEFORE | INSERT, UPDATE         | validate_permission_slug_on_override()        |

---

## 7. RLS Policies

### 7.1 `user_effective_permissions`

| Policy                                   | Cmd    | Condition                                    |
| ---------------------------------------- | ------ | -------------------------------------------- |
| Users can view own effective permissions | SELECT | `user_id = auth.uid()`                       |
| Org owners can view member permissions   | SELECT | `has_org_role(organization_id, 'org_owner')` |

No write policies — UEP is written **exclusively by the SECURITY DEFINER compiler**.

---

### 7.2 `user_role_assignments`

| Policy                               | Roles         | Cmd           | Condition                                                                                                                       |
| ------------------------------------ | ------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| View own role assignments            | authenticated | SELECT        | `user_id = auth.uid()`                                                                                                          |
| V2 view org role assignments         | authenticated | SELECT        | `scope='org' AND is_org_member(scope_id) AND has_permission(scope_id, 'members.read')`                                          |
| V2 view branch role assignments      | public        | SELECT        | `scope='branch' AND (has_permission(org_id, 'members.read') OR has_branch_permission(org_id, scope_id, 'branch.roles.manage'))` |
| Org admins view org role assignments | authenticated | SELECT        | `scope='org' AND (is_org_creator OR has_org_role('org_owner'))`                                                                 |
| V2 assign roles                      | public        | INSERT        | Org: `is_org_member + members.manage`; Branch: `(members.manage OR branch.roles.manage) AND is_org_member`                      |
| V2 update / delete role assignments  | public        | UPDATE/DELETE | Same dual-gate as insert                                                                                                        |

---

### 7.3 `user_permission_overrides`

| Policy                                    | Cmd                  | Condition                                                                   |
| ----------------------------------------- | -------------------- | --------------------------------------------------------------------------- |
| overrides_select_self                     | SELECT               | `user_id = auth.uid() AND deleted_at IS NULL`                               |
| overrides_select_admin                    | SELECT               | `is_org_member AND has_permission('members.manage') AND deleted_at IS NULL` |
| overrides_insert/update/delete_permission | INSERT/UPDATE/DELETE | `is_org_member AND has_permission('members.manage') AND deleted_at IS NULL` |

---

### 7.4 `organization_members`

| Policy                                 | Cmd    | Condition                                                                         |
| -------------------------------------- | ------ | --------------------------------------------------------------------------------- |
| Users can view                         | SELECT | `user_id=auth.uid() OR is_org_creator OR has_any_org_role`                        |
| Org creators and owners can add        | INSERT | `is_org_creator OR has_org_role('org_owner')`                                     |
| Org owners / members.manage can update | UPDATE | `has_org_role('org_owner')` OR `is_org_member + has_permission('members.manage')` |
| Org owners can remove                  | DELETE | `has_org_role('org_owner')`                                                       |

---

### 7.5 `permissions`

| Policy                           | Cmd    | Condition            |
| -------------------------------- | ------ | -------------------- |
| permissions_select_authenticated | SELECT | `deleted_at IS NULL` |

---

### 7.6 `roles`

| Policy                                | Cmd                  | Condition                                                               |
| ------------------------------------- | -------------------- | ----------------------------------------------------------------------- |
| roles_select_system                   | SELECT               | `is_basic = true AND organization_id IS NULL AND deleted_at IS NULL`    |
| roles_select_org                      | SELECT               | `org_id IS NOT NULL AND is_org_member AND deleted_at IS NULL`           |
| roles_insert/update/delete_permission | INSERT/UPDATE/DELETE | `is_org_member AND has_permission('members.manage') AND is_basic=false` |

---

## 8. RLS / RPC Exact-Match Rule

**Rule**: RLS policies and DB RPC permission checks must only use non-wildcard permission slugs.

**Rationale**: DB functions `has_permission`, `has_branch_permission`, `user_has_effective_permission` all perform **exact string comparisons** against `permission_slug` in UEP. UEP may contain wildcard rows such as `"warehouse.*"` or `"module.*"` stored verbatim. If an RLS policy used a wildcard slug (e.g. `has_permission(org_id, "warehouse.*")`), it would only match UEP rows where `permission_slug = "warehouse.*"` exactly — it would NOT expand to cover all `"warehouse.X"` rows. This would cause a silent security bypass.

**Complete canonical RLS gate slugs (all non-wildcard, verified 2026-03-04 via `pg_policies` regexp_matches):**

| Slug                  | Constant              | Tables / Policies                                                                           |
| --------------------- | --------------------- | ------------------------------------------------------------------------------------------- |
| `members.read`        | `MEMBERS_READ`        | user_role_assignments SELECT; user_permission_overrides SELECT; organization_members SELECT |
| `members.manage`      | `MEMBERS_MANAGE`      | URA/UPO INSERT/UPDATE/DELETE; organization_members UPDATE                                   |
| `branch.roles.manage` | `BRANCH_ROLES_MANAGE` | user_role_assignments branch-scoped dual-gate                                               |
| `branches.create`     | `BRANCHES_CREATE`     | branches INSERT                                                                             |
| `branches.delete`     | `BRANCHES_DELETE`     | branches DELETE                                                                             |
| `branches.update`     | `BRANCHES_UPDATE`     | branches UPDATE                                                                             |
| `invites.create`      | `INVITES_CREATE`      | invitations INSERT                                                                          |
| `invites.read`        | `INVITES_READ`        | invitations SELECT                                                                          |
| `invites.cancel`      | `INVITES_CANCEL`      | invitations UPDATE/DELETE                                                                   |
| `org.update`          | `ORG_UPDATE`          | org_positions UPDATE; org_profiles UPDATE                                                   |

**Invariant tests**:

- **Contract** (`src/lib/constants/__tests__/rls-permission-invariants.test.ts`): asserts all 10 RLS gate slugs + 4 RPC gate slugs are non-wildcard; exact-value assertions for each; asserts registry wildcards are only `["account.*", "module.*", "superadmin.*"]`.
- **DB-backed** (`src/server/services/__tests__/rls-wildcard-db-invariant.test.ts`): calls `public.audit_rls_permission_gate_slugs()` RPC (migration `20260304120000`) against live DB; asserts no extracted policy string literal contains `*`; asserts all 10 expected slugs present. Skips when `SUPABASE_SERVICE_ROLE_KEY` absent (CI-safe).

---

## 9. TypeScript Layer

### 9.1 `PermissionServiceV2` — `src/server/services/permission-v2.service.ts`

All methods read from UEP. No dynamic permission derivation.

| Method                                                             | Query filter                         | Wildcard-aware    | Auth model              |
| ------------------------------------------------------------------ | ------------------------------------ | ----------------- | ----------------------- |
| `getOrgEffectivePermissions(supabase, userId, orgId)`              | `branch_id IS NULL`                  | Result preserved  | Caller provides userId  |
| `getOrgEffectivePermissionsArray(supabase, userId, orgId)`         | `branch_id IS NULL`                  | Result preserved  | Caller provides userId  |
| `getPermissionSnapshotForUser(supabase, userId, orgId, branchId?)` | `IS NULL` or `IS NULL OR = branchId` | Result preserved  | Caller provides userId  |
| `hasPermission(supabase, userId, orgId, slug)`                     | RPC `user_has_effective_permission`  | ❌ Exact match    | Caller provides userId  |
| `currentUserHasPermission(supabase, orgId, slug)`                  | RPC `has_permission`                 | ❌ Exact match    | auth.uid() via RPC      |
| `currentUserIsOrgMember(supabase, orgId)`                          | RPC `is_org_member`                  | N/A               | auth.uid() via RPC      |
| `can(permissions: Set<string>, slug)`                              | `Set.has()`                          | ❌ Exact match    | None (pure)             |
| `canFromSnapshot(snapshot, slug)`                                  | delegates to `checkPermission`       | ✅ Wildcard-aware | None (pure, deprecated) |

**Note on `canFromSnapshot`**: Now delegates to `checkPermission(snapshot, permission)` from the utility — wildcard-aware and deny-first. Previously used `Array.includes()` (bug). Marked `@deprecated` — use `checkPermission(snapshot, slug)` directly.

---

### 9.2 `checkPermission` utility — `src/lib/utils/permissions.ts`

The **canonical wildcard-aware runtime check** for PermissionSnapshot.

```typescript
export function checkPermission(snapshot: PermissionSnapshot, requiredPermission: string): boolean;
```

- **Deny-first**: `snapshot.deny` patterns checked first; any match → false.
- **Wildcard-aware**: `warehouse.*` matches `warehouse.products.read`, etc. Uses cached regex.
- Greedy `*` matches across segment boundaries.
- `clearPermissionRegexCache()` exported for test cleanup.

**Always use `checkPermission(snapshot, slug)` for runtime checks. Never use `snapshot.allow.includes(slug)` where wildcards may be present.**

---

### 9.3 `usePermissions` hook — `src/hooks/v2/use-permissions.ts`

Client-side, reads from Zustand store. `can(slug)` is wildcard-aware (delegates to `checkPermission`).

---

### 9.4 `PermissionCompiler` — `src/server/services/permission-compiler.service.ts`

**RETIRED**. All 3 public methods throw via `_throwRetired()`.

---

## 10. Server Actions (V2)

All in `src/app/actions/v2/permissions.ts`. All use `getUser()` (JWT-validated). Fail-closed.

| Action                                  | Auth               | Reads                | Returns                               | Notes                       |
| --------------------------------------- | ------------------ | -------------------- | ------------------------------------- | --------------------------- |
| `getBranchPermissions(orgId, branchId)` | `getUser()`        | UEP branch-aware     | `{ permissions: PermissionSnapshot }` |                             |
| `getEffectivePermissions(orgId)`        | `getUser()`        | UEP org-only         | `string[]`                            |                             |
| `getDetailedPermissions(orgId)`         | `getUser()`        | UEP + branches       | `DetailedPermission[]`                |                             |
| `checkOrgPermissionExact(orgId, slug)`  | auth.uid() via RPC | RPC `has_permission` | `boolean`                             | Exact match, org-scope only |
| `checkOrgMembership(orgId)`             | auth.uid() via RPC | RPC `is_org_member`  | `boolean`                             |                             |

**Rename note**: `checkPermission(orgId, slug)` was renamed to `checkOrgPermissionExact(orgId, slug)` to eliminate the name collision with the wildcard-aware utility `checkPermission(snapshot, slug)` from `@/lib/utils/permissions`.

---

## 11. Client-Side Permission Checking

### Flow

```
SSR render → loadUserContextV2 → permissionSnapshot → serialized to client
     │
     └── PermissionsSync component (client)
            → getBranchPermissions(orgId, branchId) server action
                 → PermissionServiceV2.getPermissionSnapshotForUser (branch-aware UEP read)
                       → stores in Zustand → usePermissions().can(slug)
```

### Consistency guarantee

Both SSR loader (`loadUserContextV2`) and client sync (`getBranchPermissions`) call `PermissionServiceV2.getPermissionSnapshotForUser` with the same branch-aware UEP filter. Snapshot is always consistent.

---

## 12. SSR Loading Pipeline

```
loadDashboardContextV2()
  ├── loadAppContextV2()
  │     └── resolves activeOrgId, activeBranchId, availableBranches
  │
  ├── loadUserContextV2(activeOrgId, activeBranchId)
  │     ├── supabase.auth.getUser()      ← JWT validated (auth gate)
  │     ├── supabase.auth.getSession()   ← access_token for JWT role extraction ONLY
  │     ├── users table                  ← identity
  │     ├── AuthService.getUserRoles()   ← roles from JWT
  │     └── PermissionServiceV2.getPermissionSnapshotForUser(supabase, userId, orgId, branchId)
  │               └── UEP: branch_id IS NULL OR branch_id = branchId
  │
  ├── _computeAccessibleBranches(userId, orgId, allBranches, snapshot)
  │     ├── FAST: checkPermission(snapshot, BRANCHES_VIEW_ANY) → allBranches
  │     └── SLOW: URA SELECT scope_id WHERE scope='branch' (own rows, RLS allows)
  │                → filter allBranches to assigned branch IDs
  │               [This is branch accessibility discovery, NOT permission computation]
  │
  └── Re-validate activeBranchId against accessibleBranches
        → reload loadUserContextV2 if branch changed
```

---

## 13. Wildcard Handling

The compiler inserts `permissions.slug` verbatim. UEP may contain `"account.*"`, `"module.*"`, `"superadmin.*"` stored as-is.

### Wildcard-aware check matrix (post-hardening)

| Check type             | Method                                             | Wildcard-aware                    | Scope        |
| ---------------------- | -------------------------------------------------- | --------------------------------- | ------------ |
| Client/SSR snapshot    | `checkPermission(snapshot, slug)` (utility)        | ✅ YES                            | org + branch |
| Client hook            | `usePermissions().can(slug)`                       | ✅ YES                            | org + branch |
| Deprecated compat      | `PermissionServiceV2.canFromSnapshot(snap, slug)`  | ✅ YES (now delegates to utility) | org + branch |
| DB RPC (current user)  | `has_permission(org_id, slug)`                     | ❌ Exact match                    | org-only     |
| DB RPC (explicit user) | `user_has_effective_permission(uid, org_id, slug)` | ❌ Exact match                    | org-only     |
| DB RPC (branch-aware)  | `has_branch_permission(org_id, branch_id, slug)`   | ❌ Exact match                    | org + branch |
| Service static         | `PermissionServiceV2.can(set, slug)`               | ❌ Exact match                    | n/a          |

**Rule**: Always use `checkPermission(snapshot, slug)` or `usePermissions().can(slug)` for runtime checks where wildcards may be present. DB RPCs must only receive non-wildcard slugs.

---

## 14. Org Revoke Cascade Behaviour

When a revoke override (`upo.effect='revoke'`) exists for a user+org+slug, the compiler's `NOT EXISTS` guard applies to **both** the org-scoped INSERT and the branch-scoped INSERT:

```sql
-- Applied in BOTH step 4 (org) and step 5 (branch) of compile_user_permissions:
AND NOT EXISTS (
  SELECT 1 FROM user_permission_overrides upo
  WHERE upo.user_id = p_user_id
    AND upo.organization_id = p_organization_id
    AND upo.permission_slug = p.slug
    AND upo.effect = 'revoke'
    AND upo.deleted_at IS NULL
)
```

**Concrete example**:

| Scenario                                                          | UEP result                                                                     |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| User has org-scoped role with `warehouse.products.delete`         | UEP row: `permission_slug='warehouse.products.delete', branch_id=NULL`         |
| User also has branch-scoped role with `warehouse.products.delete` | UEP row: `permission_slug='warehouse.products.delete', branch_id='branch-xyz'` |
| Org-level revoke added for `warehouse.products.delete`            | **Both** UEP rows are ABSENT after next compile                                |
| Branch-level grant remains after revoke                           | ❌ Branch grant is ALSO suppressed — org revoke wins everywhere                |

**Invariant**: An org-level revoke override removes the permission from ALL branches for that user in that org. There is no way to grant a branch permission that overrides an org-level revoke.

---

## 15. Live DB Sanity Check (2026-03-04)

| Check                                                  | Result                                |
| ------------------------------------------------------ | ------------------------------------- |
| `COUNT(*) FROM permissions WHERE deleted_at IS NULL`   | 30                                    |
| `COUNT(*) FROM user_effective_permissions`             | 31                                    |
| UEP org-scope rows (branch_id IS NULL)                 | 30                                    |
| UEP branch-scope rows (branch_id IS NOT NULL)          | 1                                     |
| `user_permission_overrides_uniq` index exists          | ❌ Dropped (migration 20260304110000) |
| `user_permission_overrides_unique_active` index exists | ✅ Present                            |
| `uep_org_exact_active_idx` partial index exists        | ✅ Present (migration 20260304130000) |
| `uep_branch_exact_active_idx` partial index exists     | ✅ Present (migration 20260304130000) |

---

## 16. Known Issues and Design Decisions

### 16.1 `PermissionServiceV2.can()` is NOT wildcard-aware (intentional)

`can(permissions: Set<string>, slug)` uses `Set.has()` — exact match. Use `checkPermission(snapshot, slug)` when wildcards may be present.

### 16.2 V1 `PermissionService` still exists (isolated to legacy route)

`src/server/services/permission.service.ts` + `src/lib/api/load-user-context-server.ts` are used only by the legacy `dashboard-old` layout, not V2 production routes.

### 16.3 `load-user-context-server.ts` uses `getSession()` only

Legacy loader uses `getSession()` without JWT re-validation. Not used by V2 routes. V2 uses `loadUserContextV2` which calls `getUser()` first.

### 16.4 Module access permissions are org-scoped only

`module.<slug>.access` slugs are in `ORG_ONLY_SLUGS` and cannot be assigned at branch scope. Enforced at the TypeScript roles action layer.

### 16.5 `canFromSnapshot()` now wildcard-safe but still deprecated

Now delegates to `checkPermission(snapshot, slug)`. The `@deprecated` tag is preserved to steer new code to import from `@/lib/utils/permissions` directly.

---

## 17. Deprecated / Retired Code

| Component                                   | Location                                             | Status         | Notes                                                                |
| ------------------------------------------- | ---------------------------------------------------- | -------------- | -------------------------------------------------------------------- |
| `PermissionCompiler`                        | `src/server/services/permission-compiler.service.ts` | **RETIRED**    | All methods throw `_throwRetired()`                                  |
| `PermissionService` (V1)                    | `src/server/services/permission.service.ts`          | **DEPRECATED** | Functional, legacy `dashboard-old` only                              |
| `load-user-context-server.ts`               | `src/lib/api/load-user-context-server.ts`            | **LEGACY**     | Uses `getSession()` + V1; not in V2 pipeline                         |
| Old `getEffectivePermissions` method name   | `permission-v2.service.ts`                           | **RENAMED**    | Now `getOrgEffectivePermissions` / `getOrgEffectivePermissionsArray` |
| Old `getDetailedPermissions` (dynamic path) | `actions/v2/permissions.ts`                          | **REPLACED**   | Now reads UEP directly                                               |
| `canFromSnapshot` (Array.includes bug)      | `permission-v2.service.ts`                           | **FIXED**      | Now delegates to wildcard-aware `checkPermission`                    |
| `checkPermission(orgId, slug)` action name  | `actions/v2/permissions.ts`                          | **RENAMED**    | Now `checkOrgPermissionExact`                                        |
| `user_permission_overrides_uniq` index      | DB                                                   | **DROPPED**    | Redundant — migration `20260304110000`                               |

---

## 18. Permission Slug Inventory

30 active slugs. Constants: `src/lib/constants/permissions.ts`.

| Category            | Slug constants                                                                                                                     |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Organization        | `ORG_READ`, `ORG_UPDATE`                                                                                                           |
| Members             | `MEMBERS_READ`, `MEMBERS_MANAGE`                                                                                                   |
| Invitations         | `INVITES_READ`, `INVITES_CREATE`, `INVITES_CANCEL`                                                                                 |
| Account             | `ACCOUNT_WILDCARD` (`account.*`), `ACCOUNT_PREFERENCES_READ/UPDATE`, `ACCOUNT_PROFILE_READ/UPDATE`, `ACCOUNT_SETTINGS_READ/UPDATE` |
| Branches CRUD       | `BRANCHES_CREATE`, `BRANCHES_READ`, `BRANCHES_UPDATE`, `BRANCHES_DELETE`                                                           |
| Branches visibility | `BRANCHES_VIEW_ANY`, `BRANCHES_VIEW_UPDATE_ANY`, `BRANCHES_VIEW_REMOVE_ANY`                                                        |
| Branch management   | `BRANCH_ROLES_MANAGE` (`branch.roles.manage`)                                                                                      |
| Module access       | `MODULE_ACCESS_WILDCARD` (`module.*`), `MODULE_ORGANIZATION_MANAGEMENT_ACCESS`                                                     |
| Superadmin          | `SUPERADMIN_WILDCARD` (`superadmin.*`), `SUPERADMIN_ADMIN_READ`, `SUPERADMIN_PLANS_READ`, `SUPERADMIN_PRICING_READ`                |
| Self                | `SELF_READ`, `SELF_UPDATE`                                                                                                         |

Wildcard slugs (stored verbatim in UEP): `account.*`, `module.*`, `superadmin.*`.

---

## 19. Diff vs Previous Doc

Changes between this version and the previous `PERMISSIONS_ARCHITECTURE_EXTRACTION_V2_BRANCH_AWARE.md`:

| Section                       | Change                                                                                                                                                                |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| §3 URA Usage Invariant        | **NEW** — explicit invariant statement clarifying `_computeAccessibleBranches` reads URA for discovery only, not permission computation                               |
| §4.5 UPO table                | Updated: `user_permission_overrides_uniq` index removed from list (dropped in migration `20260304110000`)                                                             |
| §8 RLS / RPC Exact-Match Rule | **NEW** then **EXPANDED** — formal rule with rationale; slug table expanded from 3→10 slugs (full pg_policies inventory); dual invariant tests (contract + DB-backed) |
| §9.1 `canFromSnapshot`        | Updated: now ✅ wildcard-aware (delegates to utility), previous: ❌ exact match (bug)                                                                                 |
| §10 Server actions table      | Updated: `checkPermission(orgId, slug)` renamed to `checkOrgPermissionExact(orgId, slug)`                                                                             |
| §13 Wildcard matrix           | Updated: `canFromSnapshot` row changed from ❌ to ✅                                                                                                                  |
| §14 Org Revoke Cascade        | **NEW** — concrete example showing org-level revoke suppresses all branch-scoped rows                                                                                 |
| §15 Sanity check              | Updated: added `user_permission_overrides_uniq` dropped confirmation                                                                                                  |
| §16.5                         | **NEW** — `canFromSnapshot` fixed note                                                                                                                                |
| §17 Deprecated table          | Updated: added `canFromSnapshot` fix, `checkPermission` rename, UPO index drop                                                                                        |

| §8 Follow-up audit P0–P3 | **NEW** (follow-up session) — P0: DB audit function + expanded contract test (3→10 slugs); P1: confirmed utility server-safe; P2: confirmed UPO drop was index-only (`DROP INDEX` correct); P3: confirmed zero old `checkPermission` action callers |
| §15 Live DB Sanity Check | **UPDATED** — added `uep_org_exact_active_idx` and `uep_branch_exact_active_idx` index presence rows |
| §20 10k-ready Performance Package | **NEW** — rationale, SQL, two-query strategy, compiler invariant verification, before/after summary |

_Document verified and hardened: 2026-03-04 (Phase 2 + follow-up P0–P3 + 10k-ready package). Re-verify after any DB function or RLS policy changes._

---

## 20. 10k-ready Performance Package

> **Applied**: 2026-03-04. Migration: `20260304130000_add_uep_partial_indexes_10k_ready.sql`.
> Code change: `src/server/services/permission-v2.service.ts` — `getPermissionSnapshotForUser`.

### Rationale

As `user_effective_permissions` (UEP) grows (many orgs, many users, many permissions per user), the previous implementation suffered two performance hazards:

1. **OR filter defeats partial indexes.** The branch-aware snapshot fetch used:

   ```sql
   WHERE user_id = $1 AND organization_id = $2 AND (branch_id IS NULL OR branch_id = $3)
   ```

   PostgreSQL cannot use a partial index (predicated on `branch_id IS NULL` or `branch_id IS NOT NULL`) to answer an OR across both halves. The planner must either do a full-table scan or a bitmap OR of two indexes — neither is optimal at scale.

2. **Full-table indexes with no predicate.** The existing indexes were broad:
   - `idx_uep_user_org_permission`: `(user_id, organization_id, permission_slug)` — no WHERE
   - `idx_uep_user_org_branch`: `(user_id, organization_id, branch_id)` — no WHERE
     These indexes must scan all rows for a given user+org regardless of `branch_id`, wasting I/O on rows irrelevant to the query.

### Solution 1: Two-query snapshot strategy (replaces OR)

**Before** (`getPermissionSnapshotForUser`, single query with OR):

```typescript
// BEFORE: single query with OR — cannot use partial indexes
const { data, error } = await (branchId
  ? baseQuery.or(`branch_id.is.null,branch_id.eq.${branchId}`)
  : baseQuery.is("branch_id", null));
```

**After** (two separate queries, each targeting one partition):

```typescript
// Query 1: org-scope rows — uses uep_org_exact_active_idx
const { data: orgData, error: orgError } = await supabase
  .from("user_effective_permissions")
  .select("permission_slug")
  .eq("user_id", userId)
  .eq("organization_id", orgId)
  .is("branch_id", null); // ← partial index predicate satisfied exactly

// Query 2: branch-scope rows (only when branchId is set)
// — uses uep_branch_exact_active_idx
const { data: branchData, error: branchError } = await supabase
  .from("user_effective_permissions")
  .select("permission_slug")
  .eq("user_id", userId)
  .eq("organization_id", orgId)
  .eq("branch_id", branchId); // ← partial index predicate satisfied exactly

// Merge + dedup + sort in JS
const allow = [...new Set([...orgSlugs, ...branchSlugs])].sort();
```

Semantics are **identical** to the previous implementation: org-wide rows always included; branch rows added only when branchId is set; fail-closed (errors return empty allow).

### Solution 2: Partial index strategy for UEP

Two new partial indexes provide stable, efficient query plans:

#### (1) `uep_org_exact_active_idx` — org-scope lookups

```sql
CREATE INDEX uep_org_exact_active_idx
  ON public.user_effective_permissions (organization_id, user_id, permission_slug)
  WHERE branch_id IS NULL;
```

- **Covers**: `has_permission()`, `user_has_effective_permission()`, `getOrgEffectivePermissions*`, Query 1 of the two-query snapshot.
- **Why `organization_id` first**: matches the order used by RLS policy expressions (`has_permission(org_id, slug)`) and gives the planner a narrow org-based scan before filtering by user.
- **Index size**: roughly half the total UEP rows (only org-scope; branch rows excluded by predicate).

#### (2) `uep_branch_exact_active_idx` — branch-scope lookups

```sql
CREATE INDEX uep_branch_exact_active_idx
  ON public.user_effective_permissions (organization_id, user_id, branch_id, permission_slug)
  WHERE branch_id IS NOT NULL;
```

- **Covers**: `has_branch_permission()` (the `branch_id = X` path), Query 2 of the two-query snapshot.
- **Index size**: complementary to the org index — only branch rows. At scale, branch rows are a smaller fraction of UEP.
- **Note**: `has_branch_permission()` still uses an OR internally (`branch_id IS NULL OR branch_id = X`). The DB function itself was not modified — its OR can be satisfied by a bitmap OR of both partial indexes, which is cheaper than scanning the full-table index. A future migration could split the function into two explicit lookups for maximum performance.

#### Why not CONCURRENTLY?

`CREATE INDEX CONCURRENTLY` cannot run inside a transaction. Supabase MCP `apply_migration` runs DDL inside a transaction, so `CONCURRENTLY` is not supported in migration files. The migration uses regular `CREATE INDEX IF NOT EXISTS`, which holds an exclusive lock on UEP during index build. This is acceptable at initial deployment time. For zero-downtime index builds on large production tables, run the `CONCURRENTLY` variant manually via `psql`.

### Solution 3: Compiler dedup invariant (verified, no change needed)

The `compile_user_permissions` DB function was **verified** to already produce deduplicated output:

- Both INSERT phases use `SELECT DISTINCT` on the projected rowset.
- An `ON CONFLICT ON CONSTRAINT user_effective_permissions_unique_v2 DO UPDATE SET compiled_at = now()` clause provides an upsert safety net.
- An advisory lock (`pg_advisory_xact_lock`) prevents concurrent compilation races for the same user+org.

No change was made to the compiler. A regression test (`T-10K-COMPILER` suite) was added in `src/server/services/__tests__/permission-v2.service.test.ts` to prove the service-layer output is always deduplicated and sorted, even when the DB returns duplicate slugs.

### Test coverage added

File: `src/server/services/__tests__/permission-v2.service.test.ts`

| Suite                                                      | Tests                              | Purpose                                                                                                            |
| ---------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `T-10K: getPermissionSnapshotForUser — two-query strategy` | 8 tests                            | Verify query count (1 for null branchId, 2 for set branchId), merge/dedup/sort, fail-closed, wildcard preservation |
| `T-10K-COMPILER: Compiler dedup invariant`                 | 2 tests                            | Verify allow array is deduplicated and sorted even with duplicate DB rows                                          |
| `T-10K-DB: UEP partial indexes exist on live DB`           | 2 tests (skipped without env vars) | Verify index existence and predicates via `pg_indexes` using service-role key                                      |

### Before / After summary

| Aspect                                | Before                                                   | After                                                            |
| ------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------- |
| Snapshot query (branch-aware)         | Single query, OR filter                                  | Two queries, one per scope                                       |
| Org-scope index                       | `idx_uep_user_org_permission` (full-table, no predicate) | `uep_org_exact_active_idx` (partial, `branch_id IS NULL`)        |
| Branch-scope index                    | `idx_uep_user_org_branch` (full-table, no predicate)     | `uep_branch_exact_active_idx` (partial, `branch_id IS NOT NULL`) |
| Index usability on branch-aware query | Low (OR defeats partial index)                           | High (each query satisfies its partial index exactly)            |
| Compiler dedup                        | Already correct (`SELECT DISTINCT` + `ON CONFLICT`)      | Unchanged + regression tests added                               |
| Wildcard semantics                    | Unchanged                                                | Unchanged                                                        |
| Exact-match RPC gates                 | Unchanged                                                | Unchanged                                                        |
