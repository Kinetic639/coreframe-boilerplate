# Phase Verify: Permissions 100k-ready (Compiler-side Wildcard Expansion)

> **Date**: 2026-03-04
> **Branch**: `org-managment-v2`
> **Migration**: `supabase/migrations/20260304150000_add_permission_slug_exact_compiler_expansion.sql`
> **Prior phase**: [10k-ready verification](./PHASE_VERIFY_PERMISSIONS_10K_READY.md)

---

## Problem Statement

The 10k-ready package (prior phase) introduced partial indexes and a two-query snapshot strategy. However, DB RPC functions (`has_permission`, `has_branch_permission`, `user_has_effective_permission`) still performed **exact string matches** against `permission_slug`. This meant:

- A user with role-assigned `account.*` had that literal wildcard stored in UEP.
- Calling `has_permission(org_id, 'account.profile.read')` would return **false** — even though the user clearly has access via the wildcard.
- RLS policy authors had no safe way to use `has_permission` with granular slugs when the user's permissions came from wildcards.
- At 100k+ UEP rows, this is a correctness hazard in addition to a scalability hazard.

## Solution

**Compiler-side wildcard expansion.** Instead of storing the wildcard slug verbatim, the compiler (`compile_user_permissions`) now expands each wildcard into one UEP row per matching concrete slug from the `permissions` registry.

- `permission_slug` (existing column): retained for traceability — stores the source pattern (e.g., `account.*`)
- `permission_slug_exact` (new column): always a concrete slug (e.g., `account.profile.read`)
- DB functions now do `permission_slug_exact = p_slug` — pure btree exact lookup, O(1) per check

---

## Pre-implementation State

| Item                                           | State before migration                                                                    |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `permission_slug_exact` column                 | Did NOT exist                                                                             |
| Wildcards in UEP (`permission_slug`)           | `account.*`, `module.*`                                                                   |
| `has_permission()` match column                | `permission_slug` (exact, wildcard-blind)                                                 |
| `has_branch_permission()` match column         | `permission_slug` (exact, wildcard-blind)                                                 |
| `user_has_effective_permission()` match column | `permission_slug` (exact, wildcard-blind)                                                 |
| Unique constraint                              | `user_effective_permissions_unique_v2` on `(user_id, org_id, permission_slug, branch_id)` |
| Partial indexes                                | `uep_org_exact_active_idx`, `uep_branch_exact_active_idx` (on `permission_slug`)          |

---

## Migration Applied

**File**: `supabase/migrations/20260304150000_add_permission_slug_exact_compiler_expansion.sql`

**Steps executed:**

1. Added `permission_slug_exact text` column (nullable)
2. Initial backfill: `SET permission_slug_exact = permission_slug` for all existing rows
3. Dropped old unique constraint `user_effective_permissions_unique_v2`
4. Added new unique constraint `user_effective_permissions_unique_v3` on `(user_id, org_id, permission_slug_exact, branch_id)` NULLS NOT DISTINCT
5. Set `permission_slug_exact` NOT NULL
6. Dropped old partial indexes `uep_org_exact_active_idx`, `uep_branch_exact_active_idx`
7. Rewrote `compile_user_permissions` with wildcard expansion via LEFT JOIN on permissions registry
8. Updated `has_permission` to use `permission_slug_exact`
9. Updated `has_branch_permission` to use `permission_slug_exact`
10. Updated `user_has_effective_permission` to use `permission_slug_exact`
11. Added new partial indexes `uep_org_slug_exact_idx`, `uep_branch_slug_exact_idx` (on `permission_slug_exact`)
12. Re-ran `compile_user_permissions` for all existing user/org pairs (proper expansion backfill)
13. Updated `audit_uep_partial_indexes()` to check new index names

---

## Post-implementation Verification

### DB Schema

```
user_effective_permissions columns:
  id                  uuid    NOT NULL  (PK)
  user_id             uuid    NOT NULL
  organization_id     uuid    NOT NULL
  permission_slug     text    NOT NULL  ← source pattern (may be wildcard, for traceability)
  permission_slug_exact text  NOT NULL  ← always concrete (no wildcards)
  source_type         text    NOT NULL
  source_id           uuid    nullable
  created_at          timestamptz NOT NULL
  compiled_at         timestamptz NOT NULL
  branch_id           uuid    nullable
```

### Unique Constraint

```
user_effective_permissions_unique_v3:
  UNIQUE NULLS NOT DISTINCT (user_id, organization_id, permission_slug_exact, branch_id)
```

Old `unique_v2` (on `permission_slug`) dropped. ✅

### Partial Indexes (post-migration)

| Index                       | Columns                                                        | Predicate                     | Used by                                                           |
| --------------------------- | -------------------------------------------------------------- | ----------------------------- | ----------------------------------------------------------------- |
| `uep_org_slug_exact_idx`    | `(organization_id, user_id, permission_slug_exact)`            | `WHERE branch_id IS NULL`     | `has_permission`, `user_has_effective_permission`, TS snapshot Q1 |
| `uep_branch_slug_exact_idx` | `(organization_id, user_id, branch_id, permission_slug_exact)` | `WHERE branch_id IS NOT NULL` | `has_branch_permission`, TS snapshot Q2                           |

Old indexes `uep_org_exact_active_idx` / `uep_branch_exact_active_idx` dropped. ✅

### DB Function Column Check

All four functions verified to use `permission_slug_exact`:

| Function                        | Uses `permission_slug_exact` |
| ------------------------------- | ---------------------------- |
| `compile_user_permissions`      | ✅ YES                       |
| `has_permission`                | ✅ YES                       |
| `has_branch_permission`         | ✅ YES                       |
| `user_has_effective_permission` | ✅ YES                       |

### Expansion Correctness (live UEP data)

| Source slug        | Expanded exact slugs in UEP                                                                                                                                    |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `account.*`        | `account.preferences.read`, `account.preferences.update`, `account.profile.read`, `account.profile.update`, `account.settings.read`, `account.settings.update` |
| `module.*`         | `module.organization-management.access`                                                                                                                        |
| All concrete slugs | `permission_slug_exact = permission_slug` (pass-through, unchanged)                                                                                            |

Zero wildcards in `permission_slug_exact` (confirmed via live query). ✅

### TypeScript Service

`PermissionServiceV2.getPermissionSnapshotForUser`, `getOrgEffectivePermissions`, `getOrgEffectivePermissionsArray` — all now select `permission_slug_exact` instead of `permission_slug`.

The returned `allow` array contains only concrete slugs. `checkPermission(snapshot, slug)` works via exact equality path (no wildcard regex needed for slugs that came from the DB).

### Supabase Types Regenerated

`supabase/types/types.ts` regenerated to include `permission_slug_exact: string` in the `user_effective_permissions` Row/Insert/Update types.

---

## Test Results

```
Type-check:    CLEAN (0 errors)
Lint:          CLEAN (0 errors, 154 pre-existing warnings unrelated to this change)
Tests:         1061 passed | 7 skipped (all skipped are DB-backed tests without env vars)
```

### New test suite: `T-100K`

File: `src/server/services/__tests__/permission-v2.service.test.ts`

| Test                                                     | Assertion                                                        |
| -------------------------------------------------------- | ---------------------------------------------------------------- |
| `snapshot allow contains concrete slugs only`            | No wildcards in `allow` array; sorted correctly                  |
| `checkPermission works with concrete-only snapshot`      | Exact-match path returns correct results                         |
| `module.* source expands: concrete slug in snapshot`     | `module.organization-management.access` reachable by exact match |
| `org + branch concrete slugs merge correctly with dedup` | Dedup + sort correct for cross-scope concrete slugs              |

### Updated T-10K-DB

Index names updated from `uep_org_exact_active_idx` / `uep_branch_exact_active_idx` to `uep_org_slug_exact_idx` / `uep_branch_slug_exact_idx`. Assertions now also verify that index definitions reference `permission_slug_exact`.

---

## Invariant Checklist

| Invariant                                                                                    | Status                            |
| -------------------------------------------------------------------------------------------- | --------------------------------- |
| `permission_slug_exact` is NOT NULL in all UEP rows                                          | ✅                                |
| No wildcards in `permission_slug_exact` (zero rows with `LIKE '%*%'`)                        | ✅                                |
| `account.*` expands to 6 concrete slugs                                                      | ✅                                |
| `module.*` expands to 1 concrete slug                                                        | ✅                                |
| New unique constraint on `permission_slug_exact`                                             | ✅                                |
| New partial indexes on `permission_slug_exact`                                               | ✅                                |
| Old partial indexes dropped                                                                  | ✅                                |
| Old unique constraint dropped                                                                | ✅                                |
| All 4 DB functions use `permission_slug_exact`                                               | ✅                                |
| TS service reads `permission_slug_exact`                                                     | ✅                                |
| `has_permission(org_id, 'account.profile.read')` returns true for user with `account.*` role | ✅ (verified by expansion in UEP) |
| Type-check clean                                                                             | ✅                                |
| Full test suite green                                                                        | ✅                                |

---

## Follow-up Fix: Revoke Semantics (migration `20260304151000`)

After the 100k migration was applied, a P0 bug was discovered: the NOT EXISTS revoke checks in `compile_user_permissions` only compared against the **source** slug (`p.slug`). A revoke override for a concrete expanded slug (e.g. `account.profile.read`) derived from a wildcard (`account.*`) was silently ignored.

**Fix applied**: Migration `supabase/migrations/20260304151000_fix_compiler_revoke_matches_exact.sql` — adds `OR upo.permission_slug = COALESCE(p2.slug, p.slug)` to both NOT EXISTS clauses (org-scope and branch-scope).

**Tests added**:

- `T-REVOKE-UNIT`: 2 unit tests verifying mock snapshots reflect correct revoke suppression
- `T-REVOKE-DB`: 1 DB-backed integration test with full setup/teardown proving the fix end-to-end

See §14 and §21 of `docs/PERMISSIONS_ARCHITECTURE_EXTRACTION_V2_BRANCH_AWARE.md` for the full revoke match matrix and SQL.

---

## Known Caveats

**New permissions added after last compilation**: If a new slug is added to the `permissions` table, existing UEP rows are NOT automatically updated — the compiler must be re-triggered (role assignment change, override change, or admin call to `compile_user_permissions`). This is by design; the same caveat existed before (new slugs wouldn't appear in UEP until compilation). The trigger chain handles this automatically for role/override changes.

**Wildcard with no matching registry slug**: If a role has `warehouse.*` but there are no concrete `warehouse.X` slugs in the `permissions` table, no UEP rows are produced for that wildcard source. The user effectively has no warehouse permissions until the slugs are added to the registry and compilation re-runs.

**`compile_user_permissions` in transactions**: The backfill (Step 12 in migration) runs `compile_user_permissions` inside a transaction. For large deployments with many UEP rows, this may take significant time. Run manually via psql on a maintenance window if needed.
