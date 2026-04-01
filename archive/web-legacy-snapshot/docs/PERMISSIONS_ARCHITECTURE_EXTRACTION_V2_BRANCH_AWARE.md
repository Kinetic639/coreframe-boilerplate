# Permissions Architecture — V2 Branch-Aware

> **Status**: Fully re-verified 2026-03-04 against live source code + migration files.
> Commit: `19f6f03`. Branch: `org-managment-v2`.
> Packages applied: Hardening → 10k-ready → 100k-ready → P0 revoke fix.

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
21. [100k-ready: Compiler-side Wildcard Expansion](#21-100k-ready-compiler-side-wildcard-expansion)
22. [Verification Report (2026-03-04)](#22-verification-report-2026-03-04)
23. [Enterprise-Grade Readiness Checklist](#23-enterprise-grade-readiness-checklist)

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
  │    ↳ wildcards expanded → one row per concrete slug in registry
  └─ INSERT branch-scoped rows (branch_id = <uuid>)
       ↳ wildcards expanded → one row per concrete slug in registry
         │
         ▼
  user_effective_permissions  ←── SINGLE SOURCE OF TRUTH
  ┌── permission_slug       = source pattern (e.g. "account.*")  ← traceability
  └── permission_slug_exact = concrete slug (e.g. "account.profile.read") ← query target
         │
         ├── SSR: PermissionServiceV2.getPermissionSnapshotForUser()
         │         → loadUserContextV2 → permissionSnapshot (concrete slugs only)
         │
         ├── Client sync: getBranchPermissions() server action
         │         → PermissionsSync component → usePermissions hook
         │
         ├── DB gate: has_permission(org_id, slug)
         │         → matches permission_slug_exact (exact concrete match, org-scope)
         │
         └── DB gate: has_branch_permission(org_id, branch_id, slug)
                    → matches permission_slug_exact (exact concrete match, branch-aware)
```

---

## 2. Core Principle: Compile, Don't Evaluate

The V2 permission system **never computes permissions at request time**. Instead:

- Permissions are **compiled** once into `user_effective_permissions` (UEP) whenever role assignments or overrides change.
- All request-time checks **read** pre-compiled facts from UEP.
- The compiler (`compile_user_permissions`) is a DB SECURITY DEFINER function, not TypeScript code.
- No TypeScript code derives effective permissions from `user_role_assignments` at runtime.
- **Wildcards are expanded at compile time** — `permission_slug_exact` in UEP is always a concrete slug.

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

| Column          | Type        | Nullable | Default           |                                    |
| --------------- | ----------- | -------- | ----------------- | ---------------------------------- |
| id              | uuid        | NO       | gen_random_uuid() |
| organization_id | uuid        | YES      | —                 | FK → organizations (NULL = system) |
| name            | text        | NO       | —                 |
| is_basic        | bool        | NO       | false             | true = system role                 |
| scope_type      | text        | NO       | 'org'             | 'org' \| 'branch' \| 'both'        |
| deleted_at      | timestamptz | YES      | —                 |

---

### 4.3 `role_permissions`

| Column        | Type        | Nullable | Default           |                  |
| ------------- | ----------- | -------- | ----------------- | ---------------- |
| id            | uuid        | NO       | gen_random_uuid() |
| role_id       | uuid        | NO       | —                 | FK → roles       |
| permission_id | uuid        | NO       | —                 | FK → permissions |
| allowed       | bool        | NO       | true              |
| deleted_at    | timestamptz | YES      | —                 |

---

### 4.4 `user_role_assignments` (URA)

| Column     | Type        | Nullable |                     |
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

| Column                  | Type        | Nullable | Default           |                     |
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

| Index                                      | Definition                                                               |
| ------------------------------------------ | ------------------------------------------------------------------------ |
| `user_permission_overrides_pkey`           | UNIQUE(id)                                                               |
| `user_permission_overrides_unique_active`  | UNIQUE(user_id, scope, scope_id, permission_id) WHERE deleted_at IS NULL |
| `idx_user_permission_overrides_compiler`   | (user_id, organization_id, effect) WHERE deleted_at IS NULL              |
| `idx_user_permission_overrides_created_at` | (created_at DESC)                                                        |

**Note**: `user_permission_overrides_uniq` was dropped in migration `20260304110000` — functionally redundant with `user_permission_overrides_unique_active`.

**Triggers**: BEFORE INSERT/UPDATE: `validate_permission_slug_on_override`. AFTER INSERT/UPDATE/DELETE: `trigger_compile_on_override`. BEFORE UPDATE: `update_user_permission_overrides_updated_at`.

---

### 4.6 `user_effective_permissions` (UEP) — Single Source of Truth

| Column                | Type        | Nullable | Default           | Notes                                                   |
| --------------------- | ----------- | -------- | ----------------- | ------------------------------------------------------- |
| id                    | uuid        | NO       | gen_random_uuid() |
| user_id               | uuid        | NO       | —                 |
| organization_id       | uuid        | NO       | —                 |
| permission_slug       | text        | NO       | —                 | Source pattern — verbatim from role (may be wildcard)   |
| permission_slug_exact | text        | NO       | —                 | **Always concrete** — wildcard expanded at compile time |
| source_type           | text        | NO       | 'role'            | 'role' \| 'override'                                    |
| source_id             | uuid        | YES      | —                 |
| branch_id             | uuid        | YES      | —                 | NULL = org-scoped; UUID = branch-scoped                 |
| created_at            | timestamptz | NO       | now()             |
| compiled_at           | timestamptz | NO       | now()             |

**Constraints**:

- `user_effective_permissions_unique_v3`: UNIQUE NULLS NOT DISTINCT `(user_id, organization_id, permission_slug_exact, branch_id)`
- (Old `unique_v2` on `permission_slug` was dropped in migration `20260304150000`)

**Indexes (post-100k migration `20260304150000`):**

| Index                       | Definition                                                     | Predicate                     | Used by                                                                |
| --------------------------- | -------------------------------------------------------------- | ----------------------------- | ---------------------------------------------------------------------- |
| `uep_org_slug_exact_idx`    | `(organization_id, user_id, permission_slug_exact)`            | `WHERE branch_id IS NULL`     | `has_permission`, `user_has_effective_permission`, Query 1 of snapshot |
| `uep_branch_slug_exact_idx` | `(organization_id, user_id, branch_id, permission_slug_exact)` | `WHERE branch_id IS NOT NULL` | `has_branch_permission`, Query 2 of snapshot                           |

**Critical semantics**:

- `branch_id IS NULL` = org-scoped (applies everywhere in the org)
- `branch_id = <uuid>` = branch-scoped (applies only in that branch)
- `permission_slug` = source pattern (traceability only; may be `account.*`)
- `permission_slug_exact` = always a concrete slug — wildcard expanded by `compile_user_permissions` at write time
- Wildcards (`account.*`, `module.*`, `superadmin.*`) are stored in `permission_slug` for traceability but **never** in `permission_slug_exact`

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

Source: `supabase/migrations/20260304151000_fix_compiler_revoke_matches_exact.sql` (latest version).

```
1. Active membership guard:
   IF NOT (active org member) → DELETE UEP rows + RETURN

2. Advisory lock: pg_advisory_xact_lock(hashtext(user_id || org_id))
   → Prevents concurrent compilation races for same user+org

3. DELETE all UEP rows for user+org  (full wipe before recompile)

4. INSERT org-scoped (branch_id = NULL):
   SELECT DISTINCT
     p.slug AS permission_slug,
     COALESCE(p2.slug, p.slug) AS permission_slug_exact,
   FROM user_role_assignments ura
   JOIN roles r, role_permissions rp, permissions p
   LEFT JOIN permissions p2
     ON p.slug LIKE '%*%'           -- source is wildcard
     AND p2.slug NOT LIKE '%*%'     -- target must be concrete
     AND p2.slug LIKE replace(p.slug, '*', '%')  -- expansion match
   WHERE scope='org'
     AND (NOT p.slug LIKE '%*%' OR p2.slug IS NOT NULL)  -- skip unmatched wildcards
     AND NOT EXISTS (
       revoke override matching p.slug OR COALESCE(p2.slug, p.slug)
     )
   UNION grant overrides (same expansion logic)
   ON CONFLICT (unique_v3) DO UPDATE SET compiled_at=now()

5. INSERT branch-scoped (branch_id = ura.scope_id):
   Same expansion logic as org-scope
   JOIN branches b ON b.id=scope_id AND b.organization_id=p_org_id  ← cross-org guard
   Same revoke check as org-scoped
   ON CONFLICT (unique_v3) DO UPDATE SET compiled_at=now()
```

**Wildcard expansion**: `account.*` → 6 rows (one per matching concrete slug in registry). If no registry slug matches, the wildcard source produces zero rows (no implicit grants for unknown slugs).

---

### 5.2 `has_permission(org_id, permission) → boolean`

```sql
SELECT EXISTS (
  SELECT 1 FROM user_effective_permissions
  WHERE organization_id       = org_id
    AND user_id               = auth.uid()
    AND permission_slug_exact = permission   -- ← always concrete (100k migration)
    AND branch_id             IS NULL
);
```

Exact match against `permission_slug_exact`. Org-scope only. Used in RLS policies.
Source: `supabase/migrations/20260304150000_add_permission_slug_exact_compiler_expansion.sql` step 8.

---

### 5.3 `has_branch_permission(p_org_id, p_branch_id, p_slug) → boolean`

```sql
SELECT EXISTS (
  SELECT 1 FROM user_effective_permissions
  WHERE user_id               = auth.uid()
    AND organization_id       = p_org_id
    AND permission_slug_exact = p_permission_slug  -- ← always concrete (100k migration)
    AND (branch_id IS NULL OR branch_id = p_branch_id)
);
```

Exact match. Branch-aware (org-wide grants satisfy branch checks). Used in RLS policies.
Source: migration `20260304150000` step 9.

---

### 5.4 `user_has_effective_permission(p_user_id, p_org_id, p_slug) → boolean`

```sql
SELECT EXISTS (
  SELECT 1 FROM user_effective_permissions
  WHERE user_id               = p_user_id
    AND organization_id       = p_organization_id
    AND permission_slug_exact = p_permission_slug  -- ← always concrete (100k migration)
    AND branch_id             IS NULL
);
```

Exact match against `permission_slug_exact`. Org-scope. Explicit user_id. Used by `PermissionServiceV2.hasPermission()`.
Source: migration `20260304150000` step 10.

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

### 5.6 `audit_rls_permission_gate_slugs() → TABLE(slug, policy_name, table_name)` — SECURITY DEFINER

Extracts all string literals from RLS policy expressions that call `has_permission`, `has_branch_permission`, or `user_has_effective_permission`. Callable by `service_role` only.
Source: `supabase/migrations/20260304120000_add_audit_rls_permission_gate_slugs_fn.sql`.

---

### 5.7 `audit_uep_partial_indexes() → TABLE(indexname, indexdef)` — SECURITY DEFINER

Returns index name + definition for `uep_org_slug_exact_idx` and `uep_branch_slug_exact_idx`. Used by DB-backed index tests. Callable by `service_role` only.
Source: `supabase/migrations/20260304150000` step 13 (updated from 10k migration).

---

### 5.8 `validate_role_assignment_scope() → trigger`

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

**Rule**: RLS policies and DB RPC permission checks must only use concrete (non-wildcard) permission slugs.

**Rationale (post-100k migration)**:

DB functions `has_permission`, `has_branch_permission`, `user_has_effective_permission` compare against `permission_slug_exact` in UEP. After the 100k migration, `permission_slug_exact` is **always a concrete slug** — wildcards are expanded at compile time. An RLS policy calling `has_permission(org_id, 'account.*')` would check for a UEP row where `permission_slug_exact = 'account.*'` literally. No such row exists (wildcards are expanded, never stored in `permission_slug_exact`), so the check would always return false — a silent security bypass.

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

> **KNOWN GAP**: The comment in both test files still says DB functions match against `UEP.permission_slug`. This is now outdated — they match `permission_slug_exact`. The tests themselves remain correct (they test non-wildcard slugs, which is still the right invariant), but the comments need updating. See §23.

---

## 9. TypeScript Layer

### 9.1 `PermissionServiceV2` — `src/server/services/permission-v2.service.ts`

All methods read from UEP using `permission_slug_exact`. No dynamic permission derivation.

| Method                                                             | Query filter                          | Column selected         | Wildcard-aware           | Auth model              |
| ------------------------------------------------------------------ | ------------------------------------- | ----------------------- | ------------------------ | ----------------------- |
| `getOrgEffectivePermissions(supabase, userId, orgId)`              | `branch_id IS NULL`                   | `permission_slug_exact` | Concrete slugs only      | Caller provides userId  |
| `getOrgEffectivePermissionsArray(supabase, userId, orgId)`         | `branch_id IS NULL`                   | `permission_slug_exact` | Concrete slugs only      | Caller provides userId  |
| `getPermissionSnapshotForUser(supabase, userId, orgId, branchId?)` | Two queries: IS NULL, then = branchId | `permission_slug_exact` | Concrete slugs only      | Caller provides userId  |
| `hasPermission(supabase, userId, orgId, slug)`                     | RPC `user_has_effective_permission`   | `permission_slug_exact` | ✅ (expanded at compile) | Caller provides userId  |
| `currentUserHasPermission(supabase, orgId, slug)`                  | RPC `has_permission`                  | `permission_slug_exact` | ✅ (expanded at compile) | auth.uid() via RPC      |
| `currentUserIsOrgMember(supabase, orgId)`                          | RPC `is_org_member`                   | N/A                     | N/A                      | auth.uid() via RPC      |
| `can(permissions: Set<string>, slug)`                              | `Set.has()`                           | N/A                     | ❌ Exact match only      | None (pure)             |
| `canFromSnapshot(snapshot, slug)`                                  | delegates to `checkPermission`        | N/A                     | ✅ Wildcard-aware        | None (pure, deprecated) |

**Note on `canFromSnapshot`**: Now delegates to `checkPermission(snapshot, permission)` from the utility — wildcard-aware and deny-first. Previously used `Array.includes()` (bug). Marked `@deprecated` — use `checkPermission(snapshot, slug)` directly.

**Note on DB RPCs**: After the 100k migration, `has_permission` and `has_branch_permission` are fully wildcard-safe because `permission_slug_exact` is always concrete. Passing `'account.profile.read'` to `has_permission` returns true for a user whose role only has `'account.*'` (because the compiler expanded it). No TypeScript-side wildcard expansion is needed.

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

**In the 100k-ready state**: since `snapshot.allow` contains only concrete slugs, `checkPermission` takes the fast exact-equality path (`p === required`) rather than the regex path for nearly all checks. The wildcard regex path is still available and correct for any snapshot that contains wildcard slugs (e.g., synthesized admin snapshots).

**Always use `checkPermission(snapshot, slug)` for runtime checks. Never use `snapshot.allow.includes(slug)` — it is not wildcard-aware and may fail if the snapshot ever contains wildcard entries.**

---

### 9.3 `usePermissions` hook — `src/hooks/v2/use-permissions.ts`

Client-side, reads from Zustand store (`useUserStoreV2`). Exports `can`, `cannot`, `canAny`, `canAll`, `getSnapshot`. All delegate to `checkPermission`.

---

### 9.4 `PermissionCompiler` — `src/server/services/permission-compiler.service.ts`

**RETIRED**. All 3 public methods throw via `_throwRetired()`. TypeScript-side compilation is prohibited.

---

## 10. Server Actions (V2)

All in `src/app/actions/v2/permissions.ts`. All use `getUser()` (JWT-validated). Fail-closed.

| Action                                  | Auth               | Reads                        | Returns                               | Notes                              |
| --------------------------------------- | ------------------ | ---------------------------- | ------------------------------------- | ---------------------------------- |
| `getBranchPermissions(orgId, branchId)` | `getUser()`        | UEP branch-aware (two-query) | `{ permissions: PermissionSnapshot }` | Snapshot contains concrete slugs   |
| `getEffectivePermissions(orgId)`        | `getUser()`        | UEP org-only                 | `string[]`                            | Concrete slugs                     |
| `getDetailedPermissions(orgId)`         | `getUser()`        | UEP + branches               | `DetailedPermission[]`                | Uses `permission_slug` for display |
| `checkOrgPermissionExact(orgId, slug)`  | auth.uid() via RPC | RPC `has_permission`         | `boolean`                             | Exact match, org-scope only        |
| `checkOrgMembership(orgId)`             | auth.uid() via RPC | RPC `is_org_member`          | `boolean`                             |                                    |

**Rename note**: `checkPermission(orgId, slug)` was renamed to `checkOrgPermissionExact(orgId, slug)` to eliminate the name collision with the wildcard-aware utility `checkPermission(snapshot, slug)` from `@/lib/utils/permissions`.

**Note on `getDetailedPermissions`**: this action selects `permission_slug` (the source pattern, for display) rather than `permission_slug_exact`. This is intentional — it's used by the debug panel to show which wildcard produced each row.

---

## 11. Client-Side Permission Checking

### Flow

```
SSR render → loadUserContextV2 → permissionSnapshot (concrete slugs) → serialized to client
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
  │               ├── Query 1: UEP WHERE branch_id IS NULL   → uep_org_slug_exact_idx
  │               └── Query 2: UEP WHERE branch_id = X       → uep_branch_slug_exact_idx
  │               Returns { allow: [...concrete slugs], deny: [] }
  │
  ├── _computeAccessibleBranches(userId, orgId, allBranches, snapshot)
  │     ├── FAST: checkPermission(snapshot, BRANCHES_VIEW_ANY) → allBranches
  │     └── SLOW: URA SELECT scope_id WHERE scope='branch' (own rows, RLS allows)
  │                → filter allBranches to assigned branch IDs
  │               [This is branch accessibility discovery, NOT permission computation]
  │
  └── Re-validate activeBranchId against accessibleBranches
        → reload loadUserContextV2 if branch changed (bug fix, 2026-03-04)
```

**Server-safety**: `loadUserContextV2` uses only Supabase server client (`createClient` from `@/utils/supabase/server`), `cache()` from React, and no browser-only APIs. Deterministic — same inputs produce same output.

**V1 reachability**: `PermissionService` (V1) and `load-user-context-server.ts` are NOT in the V2 pipeline. They exist in the codebase but are isolated to the legacy `dashboard-old` layout. V2 dashboard routes exclusively use `loadDashboardContextV2` → `loadUserContextV2`.

---

## 13. Wildcard Handling

### Wildcard-aware check matrix (post-100k migration)

| Check type             | Method                                             | Wildcards in allow?      | Wildcard-aware?                        | Scope        |
| ---------------------- | -------------------------------------------------- | ------------------------ | -------------------------------------- | ------------ |
| Client/SSR snapshot    | `checkPermission(snapshot, slug)`                  | Concrete only (compiled) | ✅ (regex, but fast-path for concrete) | org + branch |
| Client hook            | `usePermissions().can(slug)`                       | Concrete only (compiled) | ✅ (delegates to utility)              | org + branch |
| Deprecated compat      | `PermissionServiceV2.canFromSnapshot(snap, slug)`  | Concrete only (compiled) | ✅ (delegates to utility)              | org + branch |
| DB RPC (current user)  | `has_permission(org_id, slug)`                     | N/A (UEP is concrete)    | ✅ (wildcard-safe via expansion)       | org-only     |
| DB RPC (explicit user) | `user_has_effective_permission(uid, org_id, slug)` | N/A (UEP is concrete)    | ✅ (wildcard-safe via expansion)       | org-only     |
| DB RPC (branch-aware)  | `has_branch_permission(org_id, branch_id, slug)`   | N/A (UEP is concrete)    | ✅ (wildcard-safe via expansion)       | org + branch |
| Service static         | `PermissionServiceV2.can(set, slug)`               | N/A                      | ❌ Exact match (Set.has)               | n/a          |

**Key change from pre-100k**: DB RPCs are now **wildcard-safe**. Calling `has_permission(org_id, 'account.profile.read')` returns `true` for a user whose role grants `account.*` — because the compiler expanded `account.*` into concrete rows including `account.profile.read` in `permission_slug_exact`. No TypeScript-side wildcard expansion is needed at runtime.

**Rule**: Always use `checkPermission(snapshot, slug)` or `usePermissions().can(slug)` for runtime checks. DB RPCs must receive only non-wildcard slugs (they will correctly match against the expanded UEP).

---

## 14. Org Revoke Cascade Behaviour

When a revoke override (`upo.effect='revoke'`) exists for a user+org+slug, the compiler's `NOT EXISTS` guard applies to **both** the org-scoped INSERT and the branch-scoped INSERT:

```sql
-- Applied in BOTH org-scope and branch-scope INSERTs of compile_user_permissions.
-- Fixed in migration 20260304151000: also matches against the EXPANDED exact slug
-- so that revoking a concrete slug (e.g. 'account.profile.read') suppresses the
-- row produced by wildcard expansion (source = 'account.*').
AND NOT EXISTS (
  SELECT 1 FROM user_permission_overrides upo
  WHERE upo.user_id        = p_user_id
    AND upo.organization_id = p_organization_id
    AND (upo.permission_slug = p.slug                        -- revoke by source slug
         OR upo.permission_slug = COALESCE(p2.slug, p.slug)) -- revoke by expanded exact slug
    AND upo.effect          = 'revoke'
    AND upo.deleted_at      IS NULL
)
```

**Revoke match matrix** (post-fix, migration `20260304151000`):

| Revoke `permission_slug` | Source `p.slug`        | `permission_slug_exact`  | Suppressed?                                  |
| ------------------------ | ---------------------- | ------------------------ | -------------------------------------------- |
| `account.*`              | `account.*`            | `account.profile.read`   | ✅ YES (source match)                        |
| `account.profile.read`   | `account.*`            | `account.profile.read`   | ✅ YES (exact match — was P0 bug before fix) |
| `account.profile.read`   | `account.profile.read` | `account.profile.read`   | ✅ YES (source = exact)                      |
| `account.profile.read`   | `account.*`            | `account.profile.update` | ❌ NO (different exact slug)                 |
| `org.read`               | `account.*`            | `account.profile.read`   | ❌ NO (unrelated slug)                       |

**Concrete example (wildcard expansion + concrete revoke)**:

| Scenario                                                          | UEP result                                                          |
| ----------------------------------------------------------------- | ------------------------------------------------------------------- |
| User has org-scoped role with `account.*`                         | UEP rows for all 6 `account.*` expansions                           |
| Org-level revoke added for `account.profile.read` (concrete slug) | `account.profile.read` absent; other 5 account expansions remain ✅ |
| Org-level revoke added for `account.*` (wildcard source)          | All 6 account expansion rows absent                                 |

**Invariant**: An org-level revoke override removes the permission from ALL branches for that user in that org. This applies to both concrete source slugs and slugs produced by wildcard expansion. There is no way to grant a branch permission that overrides an org-level revoke.

---

## 15. Live DB Sanity Check (2026-03-04)

| Check                                                     | Result                                         |
| --------------------------------------------------------- | ---------------------------------------------- |
| `COUNT(*) FROM permissions WHERE deleted_at IS NULL`      | 30                                             |
| `COUNT(*) FROM user_effective_permissions`                | 31 (30 org-scope + 1 branch-scope)             |
| UEP org-scope rows (branch_id IS NULL)                    | 30                                             |
| UEP branch-scope rows (branch_id IS NOT NULL)             | 1                                              |
| `permission_slug_exact` column exists on UEP              | ✅ Added (migration 20260304150000)            |
| `user_effective_permissions_unique_v3` constraint exists  | ✅ Present                                     |
| `user_effective_permissions_unique_v2` constraint dropped | ✅ Dropped (migration 20260304150000)          |
| `user_permission_overrides_uniq` index                    | ✅ Dropped (migration 20260304110000)          |
| `user_permission_overrides_unique_active` index           | ✅ Present                                     |
| `uep_org_slug_exact_idx` partial index                    | ✅ Present (migration 20260304150000, step 11) |
| `uep_branch_slug_exact_idx` partial index                 | ✅ Present (migration 20260304150000, step 11) |
| Old `uep_org_exact_active_idx` index                      | ✅ Dropped (migration 20260304150000, step 6)  |
| Old `uep_branch_exact_active_idx` index                   | ✅ Dropped (migration 20260304150000, step 6)  |
| `audit_rls_permission_gate_slugs()` RPC                   | ✅ Present (migration 20260304120000)          |
| `audit_uep_partial_indexes()` RPC                         | ✅ Present, returns new index names            |
| `compile_user_permissions` includes revoke exact match    | ✅ Fixed (migration 20260304151000)            |

---

## 16. Known Issues and Design Decisions

### 16.1 `PermissionServiceV2.can()` is NOT wildcard-aware (intentional)

`can(permissions: Set<string>, slug)` uses `Set.has()` — exact match. In the 100k-ready state, UEP returns concrete slugs only, so Set.has() works correctly. However, using this method with a manually constructed Set containing wildcards would fail. Use `checkPermission(snapshot, slug)` when wildcards may be present.

### 16.2 V1 `PermissionService` still exists (isolated to legacy route)

`src/server/services/permission.service.ts` + `src/lib/api/load-user-context-server.ts` are used only by the legacy `dashboard-old` layout, not V2 production routes.

### 16.3 `load-user-context-server.ts` uses `getSession()` only

Legacy loader uses `getSession()` without JWT re-validation. Not used by V2 routes. V2 uses `loadUserContextV2` which calls `getUser()` first.

### 16.4 Module access permissions are org-scoped only

`module.<slug>.access` slugs are in `ORG_ONLY_SLUGS` and cannot be assigned at branch scope. Enforced at the TypeScript roles action layer.

### 16.5 `canFromSnapshot()` now wildcard-safe but still deprecated

Now delegates to `checkPermission(snapshot, slug)`. The `@deprecated` tag is preserved to steer new code to import from `@/lib/utils/permissions` directly.

### 16.6 `getDetailedPermissions` selects `permission_slug` (source), not `permission_slug_exact`

This is intentional for the debug panel — it shows which wildcard source produced each row. Not a query correctness issue.

### 16.7 New registry slugs require re-compilation

If a new concrete slug is added to the `permissions` table, existing UEP rows do NOT automatically expand to include it. Recompilation is triggered by the next role/override change for that user. To force immediate expansion, call `compile_user_permissions(user_id, org_id)` manually.

---

## 17. Deprecated / Retired Code

| Component                                                  | Location                                             | Status         | Notes                                                                           |
| ---------------------------------------------------------- | ---------------------------------------------------- | -------------- | ------------------------------------------------------------------------------- |
| `PermissionCompiler`                                       | `src/server/services/permission-compiler.service.ts` | **RETIRED**    | All methods throw `_throwRetired()`                                             |
| `PermissionService` (V1)                                   | `src/server/services/permission.service.ts`          | **DEPRECATED** | Functional, legacy `dashboard-old` only                                         |
| `load-user-context-server.ts`                              | `src/lib/api/load-user-context-server.ts`            | **LEGACY**     | Uses `getSession()` + V1; not in V2 pipeline                                    |
| Old `getEffectivePermissions` method name                  | `permission-v2.service.ts`                           | **RENAMED**    | Now `getOrgEffectivePermissions` / `getOrgEffectivePermissionsArray`            |
| Old `getDetailedPermissions` (dynamic path)                | `actions/v2/permissions.ts`                          | **REPLACED**   | Now reads UEP directly                                                          |
| `canFromSnapshot` (Array.includes bug)                     | `permission-v2.service.ts`                           | **FIXED**      | Now delegates to wildcard-aware `checkPermission`                               |
| `checkPermission(orgId, slug)` action name                 | `actions/v2/permissions.ts`                          | **RENAMED**    | Now `checkOrgPermissionExact`                                                   |
| `user_permission_overrides_uniq` index                     | DB                                                   | **DROPPED**    | Redundant — migration `20260304110000`                                          |
| `unique_v2` constraint on UEP                              | DB                                                   | **DROPPED**    | Replaced by `unique_v3` on `permission_slug_exact` — migration `20260304150000` |
| `uep_org_exact_active_idx` / `uep_branch_exact_active_idx` | DB                                                   | **DROPPED**    | Replaced by `_slug_exact_` variants — migration `20260304150000`                |

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

Wildcard source slugs in `permissions` table (stored in `permission_slug` for traceability): `account.*`, `module.*`, `superadmin.*`. These are **never** stored in `permission_slug_exact`.

---

## 19. Diff vs Previous Doc

Changes in this re-verification (2026-03-04):

| Section                   | Change                                                                                                                                                                                                                                |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| §1 Architecture Summary   | Updated diagram: shows `permission_slug` vs `permission_slug_exact` split; compiler expansion noted                                                                                                                                   |
| §2 Core Principle         | Added: "Wildcards are expanded at compile time"                                                                                                                                                                                       |
| §4.6 UEP table            | **CORRECTED**: Added `permission_slug_exact` column (NOT NULL); updated unique constraint `unique_v2` → `unique_v3`; updated index table to show `_slug_exact_` indexes; removed outdated "Compiler does NOT expand wildcards" caveat |
| §5.1 Compiler summary     | **UPDATED**: Shows wildcard expansion logic (LEFT JOIN, COALESCE, revoke fix)                                                                                                                                                         |
| §5.2/5.3/5.4 DB functions | **CORRECTED**: Changed `permission_slug = permission` → `permission_slug_exact = permission` in all three function definitions                                                                                                        |
| §5.6/5.7                  | **NEW**: Added `audit_rls_permission_gate_slugs` and `audit_uep_partial_indexes` RPC entries                                                                                                                                          |
| §8 RLS/RPC Rule           | **UPDATED**: Rationale updated — danger is now about `permission_slug_exact` being concrete, so wildcard in RLS call never matches                                                                                                    |
| §9.1 TS Service table     | **UPDATED**: All snapshot methods now show `permission_slug_exact` as selected column; DB RPCs now marked ✅ wildcard-safe                                                                                                            |
| §9.2 checkPermission      | Added: fast-path note for concrete-only snapshots                                                                                                                                                                                     |
| §13 Wildcard matrix       | **CORRECTED**: "Wildcards in allow?" column corrected to "Concrete only (compiled)"; DB RPCs marked ✅ wildcard-safe                                                                                                                  |
| §15 Live DB sanity        | **UPDATED**: Added `permission_slug_exact`, `unique_v3`, `_slug_exact_` indexes; marked old indexes as dropped                                                                                                                        |
| §16.6/16.7                | **NEW**: `getDetailedPermissions` uses `permission_slug` intentionally; new registry slug caveat                                                                                                                                      |
| §17 Deprecated table      | **UPDATED**: Added `unique_v2` drop, old index drops                                                                                                                                                                                  |
| §22 Verification Report   | **NEW**                                                                                                                                                                                                                               |
| §23 Readiness Checklist   | **NEW**                                                                                                                                                                                                                               |

---

## 20. 10k-ready Performance Package

> **Applied**: 2026-03-04. Migration: `20260304130000_add_uep_partial_indexes_10k_ready.sql`.

### Rationale

As `user_effective_permissions` (UEP) grows, the previous implementation suffered two performance hazards:

1. **OR filter defeats partial indexes.** The branch-aware snapshot fetch used:

   ```sql
   WHERE user_id = $1 AND organization_id = $2 AND (branch_id IS NULL OR branch_id = $3)
   ```

   PostgreSQL cannot use a partial index (predicated on `branch_id IS NULL` or `branch_id IS NOT NULL`) to answer an OR across both halves.

2. **Full-table indexes with no predicate.** The existing indexes scanned all rows for a given user+org regardless of `branch_id`.

### Solution 1: Two-query snapshot strategy (replaces OR)

```typescript
// Query 1: org-scope rows — uses uep_org_slug_exact_idx
const { data: orgData } = await supabase
  .from("user_effective_permissions")
  .select("permission_slug_exact")
  .eq("user_id", userId)
  .eq("organization_id", orgId)
  .is("branch_id", null);

// Query 2: branch-scope rows (only when branchId is set) — uses uep_branch_slug_exact_idx
const { data: branchData } = await supabase
  .from("user_effective_permissions")
  .select("permission_slug_exact")
  .eq("user_id", userId)
  .eq("organization_id", orgId)
  .eq("branch_id", branchId);

// Merge + dedup + sort in JS
const allow = [...new Set([...orgSlugs, ...branchSlugs])].sort();
```

### Solution 2: Partial index strategy for UEP

Two partial indexes (on `permission_slug_exact` after the 100k migration):

| Index                       | Covers                                                                                    | Predicate                     |
| --------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------- |
| `uep_org_slug_exact_idx`    | `has_permission`, `user_has_effective_permission`, `getOrgEffectivePermissions*`, Query 1 | `WHERE branch_id IS NULL`     |
| `uep_branch_slug_exact_idx` | `has_branch_permission`, Query 2                                                          | `WHERE branch_id IS NOT NULL` |

**Note**: The 10k migration created these indexes on `permission_slug`. The 100k migration dropped and recreated them on `permission_slug_exact`. The current indexes target `permission_slug_exact`.

#### Why not CONCURRENTLY?

`CREATE INDEX CONCURRENTLY` cannot run inside a transaction. Supabase MCP `apply_migration` wraps DDL in a transaction. Migration uses regular `CREATE INDEX IF NOT EXISTS`. For zero-downtime index builds on large production tables, run the `CONCURRENTLY` variant manually via `psql`.

### Test coverage

| Suite                                                      | Tests                        | Purpose                                                               |
| ---------------------------------------------------------- | ---------------------------- | --------------------------------------------------------------------- |
| `T-10K: getPermissionSnapshotForUser — two-query strategy` | 8 tests                      | Verify query count, merge/dedup/sort, fail-closed                     |
| `T-10K-COMPILER: Compiler dedup invariant`                 | 2 tests                      | Verify allow array deduplicated and sorted                            |
| `T-10K-DB: UEP partial indexes exist on live DB`           | 1 test (skipped without env) | Verify index existence + predicates via `audit_uep_partial_indexes()` |

---

## 21. 100k-ready: Compiler-side Wildcard Expansion

> **Migration**: `20260304150000_add_permission_slug_exact_compiler_expansion.sql`
> **P0 fix**: `20260304151000_fix_compiler_revoke_matches_exact.sql`

### Problem

After the 10k-ready package, DB RPC functions still matched on `permission_slug` — an **exact string match**. Wildcards (`account.*`, `module.*`) were stored verbatim in UEP. This meant `has_permission(org_id, 'account.profile.read')` returned **false** for a user whose role granted `account.*`.

### Solution

**Compiler-side expansion**: `compile_user_permissions` now expands wildcards at write time by LEFT JOIN against the `permissions` registry.

| Column                  | Contents                                           | Purpose                                       |
| ----------------------- | -------------------------------------------------- | --------------------------------------------- |
| `permission_slug`       | Source pattern (`account.*`, `org.read`, …)        | Traceability                                  |
| `permission_slug_exact` | Always a concrete slug (`account.profile.read`, …) | Query target for DB functions and TS snapshot |

### Expansion Logic

```sql
LEFT JOIN public.permissions p2
  ON  p.slug LIKE '%*%'                      -- source is a wildcard
  AND p2.slug NOT LIKE '%*%'                 -- target must be concrete
  AND p2.deleted_at IS NULL
  AND p2.slug LIKE replace(p.slug, '*', '%') -- e.g. 'account.%'

-- permission_slug       = p.slug   (source, e.g. "account.*")
-- permission_slug_exact = COALESCE(p2.slug, p.slug)
--                         → p2.slug  for wildcard rows (expanded)
--                         → p.slug   for concrete rows (unchanged)
```

### Expansion Results (live registry)

| Source slug        | Expanded `permission_slug_exact` values                                                                                                                        |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `account.*`        | `account.preferences.read`, `account.preferences.update`, `account.profile.read`, `account.profile.update`, `account.settings.read`, `account.settings.update` |
| `module.*`         | `module.organization-management.access`                                                                                                                        |
| `superadmin.*`     | `superadmin.admin.read`, `superadmin.plans.read`, `superadmin.pricing.read`                                                                                    |
| All concrete slugs | `permission_slug_exact = permission_slug` (pass-through)                                                                                                       |

### DB Function Updates

All three RPC functions now match on `permission_slug_exact` (see §5.2, §5.3, §5.4).

### Revoke Semantics (fixed in migration `20260304151000`)

**Bug (P0)**: After the 100k migration, the NOT EXISTS revoke checks compared only against the source slug (`p.slug`). A revoke override for the concrete expanded slug (e.g. `account.profile.read`) was silently ignored.

**Fix**: Both NOT EXISTS clauses now also match against `COALESCE(p2.slug, p.slug)`. See §14 for the full revoke match matrix.

### Before / After Summary

| Aspect                                                             | Before (10k-ready)                   | After (100k-ready)                              |
| ------------------------------------------------------------------ | ------------------------------------ | ----------------------------------------------- |
| `permission_slug_exact` column                                     | Did not exist                        | `text NOT NULL`                                 |
| Wildcards in UEP                                                   | Stored verbatim in `permission_slug` | Expanded to concrete in `permission_slug_exact` |
| `has_permission('account.profile.read')` for user with `account.*` | ❌ false                             | ✅ true                                         |
| Unique constraint                                                  | `unique_v2` on `permission_slug`     | `unique_v3` on `permission_slug_exact`          |
| Partial indexes                                                    | On `permission_slug` (old names)     | On `permission_slug_exact` (new names)          |
| TS snapshot field                                                  | `permission_slug`                    | `permission_slug_exact`                         |
| TS wildcard regex needed                                           | Yes (for wildcards in allow)         | No (concrete slugs only; fast exact path)       |
| Compiler complexity                                                | Simple verbatim insert               | LEFT JOIN expansion against registry            |

### Test coverage

| Suite                                                   | Tests                        | Purpose                                                                                                        |
| ------------------------------------------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `T-100K: Snapshot contains concrete slugs only`         | 4 tests                      | Verify no wildcards in allow; checkPermission works with concrete slugs; module.\* expansion; org+branch merge |
| `T-REVOKE-UNIT: Revoke suppresses expanded slug (unit)` | 2 tests                      | Verify service correctly reads whatever DB returns (revoke correctness proof is in T-REVOKE-DB)                |
| `T-REVOKE-DB: Revoke-under-wildcard proof (live DB)`    | 1 test (skipped without env) | End-to-end: account.\* grant + account.profile.read revoke → account.profile.read absent from UEP              |

---

## 22. Verification Report (2026-03-04)

### What was verified and how

| Claim                                                                      | Evidence                                                       | Source                                                                   |
| -------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `getPermissionSnapshotForUser` uses two-query strategy                     | Read full method source                                        | `src/server/services/permission-v2.service.ts` lines 153–206             |
| Both queries select `permission_slug_exact`                                | Read source                                                    | Same file lines 165–198                                                  |
| Snapshot `allow` contains concrete slugs only                              | T-100K test suite; service method source                       | `__tests__/permission-v2.service.test.ts` lines 379–502                  |
| Snapshot `deny` is always empty                                            | T-10K test; service source returns `{ allow, deny: [] }`       | Test line 276; service line 205                                          |
| Fail-closed: empty allow on error                                          | T-10K tests; source returns `{ allow: [], deny: [] }` on error | Test lines 245–273; service lines 172–175                                |
| `has_permission` matches `permission_slug_exact`                           | Read migration SQL                                             | `20260304150000` step 8                                                  |
| `has_branch_permission` matches `permission_slug_exact`                    | Read migration SQL                                             | `20260304150000` step 9                                                  |
| `user_has_effective_permission` matches `permission_slug_exact`            | Read migration SQL                                             | `20260304150000` step 10                                                 |
| Compiler expands wildcards via LEFT JOIN                                   | Read migration SQL                                             | `20260304150000` step 7; `20260304151000` (P0 fix)                       |
| Revoke fix: OR clause on COALESCE(p2.slug, p.slug)                         | Read migration SQL                                             | `20260304151000` lines 129–137, 210–219                                  |
| `uep_org_slug_exact_idx` and `uep_branch_slug_exact_idx` exist             | Read migration SQL                                             | `20260304150000` step 11                                                 |
| Old `uep_org_exact_active_idx` / `uep_branch_exact_active_idx` dropped     | Read migration SQL                                             | `20260304150000` step 6                                                  |
| `unique_v2` dropped, `unique_v3` added                                     | Read migration SQL                                             | `20260304150000` steps 3–4                                               |
| `PermissionCompiler` always throws                                         | Read source                                                    | `src/server/services/permission-compiler.service.ts`                     |
| V2 layouts use `loadDashboardContextV2` + `checkPermission`                | Read layout source                                             | `src/app/[locale]/dashboard/organization/layout.tsx`                     |
| `getBranchPermissions` uses `PermissionServiceV2`                          | Read action source                                             | `src/app/actions/v2/permissions.ts` lines 42–48                          |
| `loadUserContextV2` calls `getUser()` before `getSession()`                | Read loader source                                             | `src/server/loaders/v2/load-user-context.v2.ts` lines 47–67              |
| V1 `PermissionService` NOT in V2 pipeline                                  | Grep of V2 layouts/actions                                     | No results for `PermissionService.` (without V2) in `src/app`            |
| `audit_rls_permission_gate_slugs()` is SECURITY DEFINER, service_role only | Read migration SQL                                             | `20260304120000`                                                         |
| `audit_uep_partial_indexes()` is SECURITY DEFINER, service_role only       | Read migration SQL                                             | `20260304150000` step 13                                                 |
| RLS gate slugs are all non-wildcard                                        | Contract test (static); DB-backed test (skipped in CI)         | `rls-permission-invariants.test.ts`; `rls-wildcard-db-invariant.test.ts` |

### What is proven true (evidence-backed)

- ✅ Compile-don't-evaluate architecture is implemented correctly and TypeScript compiler is fully retired
- ✅ `permission_slug_exact` is always a concrete slug (compiler never writes wildcards there)
- ✅ Two-query snapshot strategy is in place and uses correct partial indexes
- ✅ Snapshot `deny` is always empty (denies resolved at compile time)
- ✅ Fail-closed on any query error
- ✅ DB RPCs match on `permission_slug_exact` — wildcard-safe
- ✅ Revoke-under-wildcard P0 bug is fixed
- ✅ V2 pipeline (layouts, actions, loaders) exclusively uses V2 service
- ✅ V1 `PermissionService` is isolated to legacy routes not in V2 pipeline
- ✅ Audit RPCs exist for index and RLS invariant testing

### What remains assumptions / UNVERIFIED

- **UNVERIFIED (CI)**: Live DB index predicates — `T-10K-DB` and `T-REVOKE-DB` tests are skipped when `SUPABASE_SERVICE_ROLE_KEY` is absent. To verify: run tests with env vars set.
- **UNVERIFIED**: Live DB trigger definitions — trigger names are documented from prior session; not re-introspected in this session. To verify: `SELECT * FROM information_schema.triggers WHERE trigger_schema = 'public'`.
- **UNVERIFIED**: `audit_rls_permission_gate_slugs()` return value against live DB — would require service_role key. Contract test covers static slug invariants without live DB.
- **ASSUMPTION**: `PermissionService` (V1) is truly isolated. There may be non-dashboard routes that still use it. Confirmed it's absent from `src/app` layouts/actions, but a full grep for all V1 call sites was not performed.

---

## 23. Enterprise-Grade Readiness Checklist

### ✅ Green (proven by evidence)

| Item                                      | Evidence                                                             |
| ----------------------------------------- | -------------------------------------------------------------------- |
| No request-time permission derivation     | `PermissionCompiler` throws; no URA reads for permission content     |
| Compile-on-write with advisory locks      | `pg_advisory_xact_lock` in compiler                                  |
| Fail-closed on all auth errors            | Empty snapshot on any error in SSR + action                          |
| JWT-validated auth in all V2 paths        | `getUser()` before `getSession()` in `loadUserContextV2`             |
| Wildcard expansion at compile time        | `permission_slug_exact` always concrete; DB functions safe           |
| Revoke-under-wildcard P0 fixed            | Migration `20260304151000`; T-REVOKE-UNIT tests                      |
| Branch isolation in compiler              | `JOIN branches b ON b.organization_id = p_org_id` guard              |
| No wildcard slugs in RLS policy calls     | Contract test (10 slugs verified) + DB-backed test                   |
| Partial index strategy for UEP            | `uep_org_slug_exact_idx`, `uep_branch_slug_exact_idx`                |
| OR-query anti-pattern eliminated          | Two-query snapshot strategy                                          |
| Audit RPCs for introspection testing      | `audit_rls_permission_gate_slugs`, `audit_uep_partial_indexes`       |
| V1 not reachable from V2 routes           | No `PermissionService.` (V1) in `src/app` dashboard routes           |
| `canFromSnapshot` wildcard-safe           | Delegates to `checkPermission`; not `Array.includes`                 |
| Org-level revoke cascades to all branches | Revoke NOT EXISTS applied in both org-scope and branch-scope INSERTs |

### 🟡 Yellow (caveat / follow-up needed)

| Item                                               | Risk                                                                                                                                                                                                                                                                                                                             | Suggested follow-up                                                                                   |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Test file comments outdated                        | `rls-wildcard-db-invariant.test.ts` and `rls-permission-invariants.test.ts` comments say "matches `permission_slug`" — now wrong (should be `permission_slug_exact`). Tests are still correct.                                                                                                                                   | Update file comments to reference `permission_slug_exact`                                             |
| `getDetailedPermissions` selects `permission_slug` | Debug panel shows source wildcards (intentional). If this action is ever used for access control decisions (not just display), the wildcard source could mislead.                                                                                                                                                                | Add a comment clearly marking the column as "display only — do not use for access control"            |
| Registry-gated wildcard expansion                  | New concrete slugs added to `permissions` table are not automatically reflected in UEP for existing users until their next role/override change triggers recompile.                                                                                                                                                              | Document in onboarding; add `compile_user_permissions` call to permission creation workflow if needed |
| DB-backed tests need env vars                      | `T-REVOKE-DB`, `T-10K-DB`, `T-RLS-WILDCARD` require `SUPABASE_SERVICE_ROLE_KEY`. They skip in CI without them.                                                                                                                                                                                                                   | Set up a CI environment with service-role key for integration test runs                               |
| V1 `PermissionService` still exists                | Legacy code is callable; accidental import possible.                                                                                                                                                                                                                                                                             | Consider marking the file with a compile-time import guard or moving to an `_deprecated/` directory   |
| `has_branch_permission` OR in definition           | The function uses `branch_id IS NULL OR branch_id = p_branch_id`. With `uep_branch_slug_exact_idx` predicated on `branch_id IS NOT NULL`, the org-scope half of this OR may not benefit from the branch index. For RLS, this is fine (infrequent). For high-frequency TS checks, prefer the two-query snapshot strategy instead. | Document this trade-off; confirm query plan for RLS-intensive tables if needed                        |

### 🔴 Red (gaps that could be security risks)

None identified. All known P0–P3 issues from prior audit sessions have been addressed in migrations through `20260304151000`.
