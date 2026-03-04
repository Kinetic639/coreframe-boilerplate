# Phase Verification: Permissions 10k-ready Package

> **Date**: 2026-03-04
> **Branch**: `org-managment-v2`
> **Migration**: `supabase/migrations/20260304130000_add_uep_partial_indexes_10k_ready.sql`
> **Code change**: `src/server/services/permission-v2.service.ts` — `getPermissionSnapshotForUser`

---

## 1. Before State (Phase 1 evidence)

### 1A. UEP indexes before migration

Queried via Supabase MCP `execute_sql`:

```
indexname                            | indexdef
-------------------------------------|--------------------------------------------------------------
idx_uep_permission                   | BTREE (permission_slug)
idx_uep_user_org                     | BTREE (user_id, organization_id)
idx_uep_user_org_branch              | BTREE (user_id, organization_id, branch_id)
idx_uep_user_org_permission          | BTREE (user_id, organization_id, permission_slug)
user_effective_permissions_pkey      | BTREE (id)
user_effective_permissions_unique_v2 | BTREE (user_id, organization_id, permission_slug, branch_id) NULLS NOT DISTINCT
```

**Finding**: No partial indexes. All indexes are full-table, no `WHERE` predicate.

### 1B. Snapshot query pattern before (the OR problem)

From `src/server/services/permission-v2.service.ts` (lines 158-160, before):

```typescript
const { data, error } = await (branchId
  ? baseQuery.or(`branch_id.is.null,branch_id.eq.${branchId}`)
  : baseQuery.is("branch_id", null));
```

Generated SQL (branch-aware path):

```sql
WHERE user_id = $1 AND organization_id = $2
  AND (branch_id IS NULL OR branch_id = $3)
```

**Problem**: The `OR` predicate prevents PostgreSQL from using a partial index. The planner cannot statically prove that all qualifying rows satisfy either `branch_id IS NULL` or `branch_id = X` — the OR requires a BitmapOr or SeqScan.

### 1C. DB functions (verified exact-match, no wildcards)

```
has_permission(org_id, slug)           → WHERE branch_id IS NULL AND permission_slug = $2  (exact match)
user_has_effective_permission(uid, …)  → WHERE branch_id IS NULL AND permission_slug = $3  (exact match)
has_branch_permission(org, branch, slug) → WHERE (branch_id IS NULL OR branch_id = $2) AND permission_slug = $3  (OR)
```

### 1D. Compiler state before (already correct)

```sql
-- compile_user_permissions — org-scope INSERT:
INSERT ... SELECT DISTINCT ... FROM (... UNION ...) AS final_perms
ON CONFLICT ON CONSTRAINT user_effective_permissions_unique_v2
DO UPDATE SET compiled_at = now(), source_type = EXCLUDED.source_type;

-- compile_user_permissions — branch-scope INSERT:
INSERT ... SELECT DISTINCT ... FROM ura JOIN ... ON CONFLICT DO UPDATE ...
```

**Finding**: Compiler already uses `SELECT DISTINCT` + `ON CONFLICT DO UPDATE`. No dedup issue. No change needed.

---

## 2. Changes Applied

### 2A. Code: Two-query strategy in `getPermissionSnapshotForUser`

File: `src/server/services/permission-v2.service.ts`

```typescript
// AFTER: two separate queries, each targeting one partition

// Query 1: org-scope (branch_id IS NULL) — uses uep_org_exact_active_idx
const { data: orgData, error: orgError } = await supabase
  .from("user_effective_permissions")
  .select("permission_slug")
  .eq("user_id", userId)
  .eq("organization_id", orgId)
  .is("branch_id", null);

// Query 2: branch-scope (branch_id = X) — only when branchId is set
// uses uep_branch_exact_active_idx
let branchSlugs: string[] = [];
if (branchId) {
  const { data: branchData, error: branchError } = await supabase
    .from("user_effective_permissions")
    .select("permission_slug")
    .eq("user_id", userId)
    .eq("organization_id", orgId)
    .eq("branch_id", branchId);
  // fail-closed on error ...
  branchSlugs = (branchData ?? []).map((r) => r.permission_slug);
}

// Merge org + branch, dedup, sort
const allow = [...new Set([...orgSlugs, ...branchSlugs])].sort();
return { allow, deny: [] };
```

Semantics preserved:

- `branchId = null/undefined` → only org-scope rows (identical to old `is("branch_id", null)`)
- `branchId = X` → org rows + branch-X rows merged (identical to old `OR (branch_id IS NULL OR branch_id = X)`)
- Fail-closed: any query error → `{ allow: [], deny: [] }`

### 2B. Migration: `20260304130000_add_uep_partial_indexes_10k_ready.sql`

Applied via Supabase MCP `apply_migration`. Local file created at:
`supabase/migrations/20260304130000_add_uep_partial_indexes_10k_ready.sql`

```sql
-- (1) Org-scope partial index
CREATE INDEX IF NOT EXISTS uep_org_exact_active_idx
  ON public.user_effective_permissions (organization_id, user_id, permission_slug)
  WHERE branch_id IS NULL;

-- (2) Branch-scope partial index
CREATE INDEX IF NOT EXISTS uep_branch_exact_active_idx
  ON public.user_effective_permissions (organization_id, user_id, branch_id, permission_slug)
  WHERE branch_id IS NOT NULL;
```

### 2C. Tests: `src/server/services/__tests__/permission-v2.service.test.ts`

Added suites:

- `T-10K: getPermissionSnapshotForUser — two-query strategy` (8 unit tests)
- `T-10K-COMPILER: Compiler dedup invariant` (2 unit tests)
- `T-10K-DB: UEP partial indexes exist on live DB` (2 integration tests, skipped without env vars)

---

## 3. After State (Phase 3 evidence)

### 3A. UEP indexes after migration (verified via MCP)

```
indexname                            | indexdef
-------------------------------------|--------------------------------------------------------------
idx_uep_permission                   | BTREE (permission_slug)
idx_uep_user_org                     | BTREE (user_id, organization_id)
idx_uep_user_org_branch              | BTREE (user_id, organization_id, branch_id)
idx_uep_user_org_permission          | BTREE (user_id, organization_id, permission_slug)
uep_org_exact_active_idx             | BTREE (organization_id, user_id, permission_slug) WHERE (branch_id IS NULL)   ← NEW
uep_branch_exact_active_idx          | BTREE (organization_id, user_id, branch_id, permission_slug) WHERE (branch_id IS NOT NULL)  ← NEW
user_effective_permissions_pkey      | BTREE (id)
user_effective_permissions_unique_v2 | BTREE (user_id, organization_id, permission_slug, branch_id) NULLS NOT DISTINCT
```

Both partial indexes present with correct predicates. ✅

### 3B. Test results

```
Test Files  58 passed | 2 skipped (60 total)
Tests       1058 passed | 8 skipped (1066 total)
```

- `permission-v2.service.test.ts`: 26 passed | 2 skipped (DB-backed tests skipped — no service-role env in CI) ✅
- All other suites unchanged ✅

### 3C. Type check

```
npm run type-check → exit 0 (no errors)
```

### 3D. Lint

```
npm run lint → 0 errors (pre-existing warnings only, unrelated to this change)
```

---

## 4. Invariants Verified

| Invariant                                                                     | Verified                                              |
| ----------------------------------------------------------------------------- | ----------------------------------------------------- |
| `getPermissionSnapshotForUser` with `branchId=null` issues exactly 1 DB query | ✅ (unit test)                                        |
| `getPermissionSnapshotForUser` with `branchId=X` issues exactly 2 DB queries  | ✅ (unit test)                                        |
| Final `allow` array is deduplicated                                           | ✅ (unit test)                                        |
| Final `allow` array is sorted lexicographically                               | ✅ (unit test)                                        |
| Fail-closed: org-scope query error → empty snapshot (no branch query issued)  | ✅ (unit test)                                        |
| Fail-closed: branch-scope query error → empty snapshot                        | ✅ (unit test)                                        |
| `deny` is always empty (denies resolved at compile time)                      | ✅ (unit test)                                        |
| Wildcard slugs preserved verbatim (not expanded)                              | ✅ (unit test)                                        |
| `uep_org_exact_active_idx` exists, predicate `branch_id IS NULL`              | ✅ (MCP introspection)                                |
| `uep_branch_exact_active_idx` exists, predicate `branch_id IS NOT NULL`       | ✅ (MCP introspection)                                |
| Compiler uses `SELECT DISTINCT` (no duplicate insert risk)                    | ✅ (function source read)                             |
| Compiler uses `ON CONFLICT DO UPDATE` (upsert-safe)                           | ✅ (function source read)                             |
| Compiler uses advisory lock (race-safe)                                       | ✅ (function source read)                             |
| No wildcard slugs in RLS gate expressions                                     | ✅ (pre-existing `rls-wildcard-db-invariant.test.ts`) |

---

## 5. Notes / Caveats

- **`has_branch_permission` DB function still uses OR**: The function was not modified. Its OR (`branch_id IS NULL OR branch_id = X`) can still benefit from a BitmapOr of both partial indexes, but is not as efficient as two explicit lookups. The application-layer snapshot fetch (the hot path) is now two-query and fully index-friendly.

- **`CREATE INDEX CONCURRENTLY` not used**: Supabase MCP migrations run inside a transaction; CONCURRENTLY requires no-transaction. For zero-downtime index builds on tables with millions of rows, run manually via psql with `CONCURRENTLY`.

- **Compiler change**: None. The compiler already had correct dedup semantics (`SELECT DISTINCT` + unique constraint + `ON CONFLICT`). Adding a regression test suite was sufficient.
