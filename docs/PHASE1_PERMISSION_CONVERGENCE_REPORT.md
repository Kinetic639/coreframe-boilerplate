# Phase 1 — Permission System Convergence: Verification & Extraction Report

**Date:** 2026-03-03
**Branch:** `org-managment-v2`
**Status:** Phase 1 complete — NO code changes made
**Source of Truth:** Supabase MCP (live DB) + source code forensic reads
**Reference Document:** [PERMISSIONS_ARCHITECTURE_EXTRACTION_V2_BRANCH_AWARE.md](./PERMISSIONS_ARCHITECTURE_EXTRACTION_V2_BRANCH_AWARE.md) — complete schema, function definitions, and RLS policy dump

---

## Executive Summary

The database is **already fully on the compiled strategy**. Every `user_role_assignment` change fires the DB trigger `trigger_compile_on_role_assignment` → `compile_user_permissions(user_id, org_id)`, which writes branch-aware facts into `user_effective_permissions` (UEP). All RLS policies (`has_permission`, `has_branch_permission`) read exclusively from UEP.

The gap is entirely in the **TypeScript application layer**:

| Layer                   | Current State                                                            | Target State                              |
| ----------------------- | ------------------------------------------------------------------------ | ----------------------------------------- |
| SSR permission loading  | `PermissionService` (dynamic: queries URA → role_permissions at runtime) | Compiled read from UEP with branch filter |
| Client sync action      | `getBranchPermissions` → `PermissionService` (dynamic)                   | Compiled read from UEP with branch filter |
| `PermissionServiceV2`   | Reads UEP but **ignores branchId** (org-only)                            | Needs branch-aware variant                |
| `PermissionCompiler` TS | Does NOT set `branch_id` in UEP rows                                     | Needs fix or retirement                   |

**The convergence requires:** Replace `PermissionService`'s 3-query runtime join chain with a single compiled SELECT against UEP, using the same filter semantics as `has_branch_permission`.

---

## Section A — DB Canonical Permission Model

> Full schema, function bodies, and RLS policies documented in reference doc (sections 2–3). Key facts extracted here.

### A.1 `user_effective_permissions` Table

```
id              uuid PK
user_id         uuid NOT NULL
organization_id uuid NOT NULL
permission_slug text NOT NULL
source_type     text  -- 'role' | 'override'
source_id       uuid nullable
created_at      timestamptz
compiled_at     timestamptz
branch_id       uuid nullable   -- NULL = org-scope; UUID = branch-scope
```

**Unique constraint:** `user_effective_permissions_unique_v2` on `(user_id, organization_id, permission_slug, branch_id) NULLS NOT DISTINCT`

**Live row counts (2026-03-03):**

| Scope                                  | Count            |
| -------------------------------------- | ---------------- |
| Org-scope (`branch_id IS NULL`)        | 31               |
| Branch-scope (`branch_id IS NOT NULL`) | 5                |
| Orphaned branch rows                   | 0 (integrity OK) |

### A.2 Canonical DB Functions

| Function                             | Signature                         | Behavior                                                                                                                                    |
| ------------------------------------ | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `compile_user_permissions`           | `(user_id, org_id)`               | Active membership guard → advisory lock → DELETE all → INSERT org-scope (`branch_id=NULL`) → INSERT branch-scope (`branch_id=ura.scope_id`) |
| `has_permission`                     | `(org_id, slug)`                  | `SELECT EXISTS ... WHERE branch_id IS NULL` — **org-only**                                                                                  |
| `has_branch_permission`              | `(org_id, branch_id, slug)`       | `SELECT EXISTS ... WHERE branch_id IS NULL OR branch_id = p_branch_id` — **branch-aware**                                                   |
| `user_has_effective_permission`      | `(user_id, org_id, slug)`         | Same as `has_permission` but explicit user_id                                                                                               |
| `trigger_compile_on_role_assignment` | AFTER INSERT/UPDATE/DELETE on URA | Resolves org_id for branch scope; calls `compile_user_permissions`                                                                          |

### A.3 Target Canonical Query (what the TypeScript services SHOULD execute)

```sql
-- Mirrors has_branch_permission semantics exactly
SELECT permission_slug
FROM public.user_effective_permissions
WHERE user_id         = $1   -- userId
  AND organization_id = $2   -- orgId
  AND (branch_id IS NULL OR branch_id = $3)  -- $3 = branchId or special null handling
```

When `branchId` is `null` (no active branch), use:

```sql
WHERE user_id = $1 AND organization_id = $2 AND branch_id IS NULL
```

This mirrors `has_permission` semantics — org-scope only.

### A.4 Compile-time Deny Handling

Deny overrides (`user_permission_overrides` with `effect='revoke'`) are **excluded at compile time** from both org-scope and branch-scope UEP inserts. A revoked permission is never written into UEP — so the compiled allow list is the final effective set, and `deny: []` is always correct for compiled snapshots.

**Confirmed by:** `compile_user_permissions` SQL — both INSERT sections have `AND NOT EXISTS (SELECT 1 FROM user_permission_overrides WHERE effect='revoke' ...)` exclusion.

---

## Section B — App Permission Data Flow Inventory

### B.1 Authority Hierarchy (current state)

```
LEVEL 1 — SSR Authority (server-renders pages, gates layouts, gates server actions)
  loadDashboardContextV2
    └─ loadUserContextV2
         └─ PermissionService.getPermissionSnapshotForUser()   [DYNAMIC — V1]
              ├─ Query 1: URA scope='org' → role_ids
              ├─ Query 2: URA scope='branch' → role_ids  (if branchId)
              ├─ RPC 3:   get_permissions_for_roles(role_ids) → allow[]
              └─ Query 4: user_permission_overrides → deny[]

LEVEL 2 — Client Sync (re-hydrates Zustand after branch switch)
  PermissionsSync component
    └─ getBranchPermissions(orgId, branchId) server action   [DYNAMIC — V1]
         └─ PermissionService.getPermissionSnapshotForUser()  [same V1 path]

LEVEL 3 — Point checks (used inside server actions only)
  PermissionServiceV2.currentUserHasPermission(supabase, orgId, perm)
    └─ RPC: has_permission(org_id, perm)   [compiled UEP, org-scope only]

LEVEL 4 — Debug display only (not security-relevant)
  getDetailedPermissions() server action
    └─ Dynamic: queries URA directly + get_permissions_for_roles RPC per branch
```

### B.2 All Permission Service Call Sites

| File                                                 | Method Called                                                                             | Authority Level                        | Branch-Aware?            |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------- | ------------------------ |
| `src/server/loaders/v2/load-user-context.v2.ts:115`  | `PermissionService.getPermissionSnapshotForUser(supabase, userId, orgId, activeBranchId)` | SSR (Level 1)                          | YES                      |
| `src/app/actions/v2/permissions.ts:39`               | `PermissionService.getPermissionSnapshotForUser(supabase, userId, orgId, branchId)`       | Client sync (Level 2)                  | YES                      |
| `src/app/actions/v2/permissions.ts:73`               | `PermissionServiceV2.getEffectivePermissionsArray(supabase, userId, orgId)`               | `getEffectivePermissions` action       | NO (org-only)            |
| `src/app/actions/v2/permissions.ts:93`               | `PermissionServiceV2.currentUserHasPermission(supabase, orgId, perm)`                     | `checkPermission` action               | NO (org-only)            |
| `src/app/actions/v2/permissions.ts:227`              | `PermissionServiceV2.currentUserIsOrgMember(supabase, orgId)`                             | `checkOrgMembership` action            | N/A                      |
| `src/server/services/permission-compiler.service.ts` | Writes to UEP (insert/delete)                                                             | Called from org create / invite accept | NO (`branch_id` not set) |

### B.3 `PermissionServiceV2` Usage — Current vs Target

`PermissionServiceV2.getEffectivePermissionsArray` (used in `getEffectivePermissions` action) queries UEP without any branch_id filter:

```typescript
// Current — no branch_id filter → returns ALL rows (org + all branches mixed)
supabase
  .from("user_effective_permissions")
  .select("permission_slug")
  .eq("user_id", userId)
  .eq("organization_id", orgId);
```

This mixes org-scope and ALL branch-scope permissions into one flat list. For a user with `branch.roles.manage` on Branch A, calling this would include that permission even when asking about Branch B. This is **not currently used for security gates** (only `getEffectivePermissions` which is a debug/informational action), but it is a latent correctness issue.

### B.4 `PermissionCompiler` (TypeScript-side) — Critical Limitation

`PermissionCompiler.compileForUser` (`src/server/services/permission-compiler.service.ts:99`):

1. Fetches all URA (org + branch) without scope differentiation
2. Gets permission slugs via `role_permissions` join (all roles merged)
3. Deletes existing UEP for `(user_id, organization_id)` — **deletes branch-scope rows too**
4. Inserts new rows **without `branch_id`** → all rows get `branch_id = NULL`

**Impact:** Running `PermissionCompiler.compileForUser` AFTER the DB trigger has already compiled branch-scoped rows will **overwrite and flatten** the branch-scope rows back to org-scope. This is a write-time data corruption risk.

**Current mitigation:** The DB trigger fires on every URA INSERT/UPDATE/DELETE and correctly restores branch-scope rows. If the TypeScript compiler runs first and the DB trigger runs after (which it always does since it's a AFTER trigger on the same URA operation), the DB trigger's output takes precedence. But if TypeScript compiler is called manually (e.g., after role permission changes via `recompileForRole`), it will corrupt branch_id state until the next URA change.

**Call sites for TypeScript compiler:**

```
grep -r "PermissionCompiler" src/
→ src/server/services/permission-compiler.service.ts  (definition)
→ src/server/services/__tests__/  (tests only)
```

No active server action or loader currently calls `PermissionCompiler` in the main flow — it is only in tests. **Risk level: LOW for current state, HIGH if added to role update flow.**

---

## Section C — Target Canonical Snapshot Format

### C.1 Snapshot Structure (unchanged)

```typescript
interface PermissionSnapshot {
  allow: string[]; // sorted, unique permission slugs from compiled UEP
  deny: []; // always empty — deny resolved at compile time
}
```

The `allow` array contains explicit permission slugs (including wildcards like `module.*` if they exist as rows in the `permissions` table and are assigned via `role_permissions`).

### C.2 Target Branch-Aware Compiled Query

```typescript
// New: PermissionServiceV2.getPermissionSnapshotForUserBranchAware
static async getPermissionSnapshotForUser(
  supabase: SupabaseClient,
  userId: string,
  orgId: string,
  branchId?: string | null
): Promise<PermissionSnapshot> {
  const query = supabase
    .from("user_effective_permissions")
    .select("permission_slug")
    .eq("user_id", userId)
    .eq("organization_id", orgId);

  if (branchId) {
    // Branch-aware: include org-scope rows + rows for this specific branch
    // This mirrors has_branch_permission DB function semantics
    query.or(`branch_id.is.null,branch_id.eq.${branchId}`);
  } else {
    // Org-scope only: mirrors has_permission DB function
    query.is("branch_id", null);
  }

  const { data, error } = await query;

  if (error) return { allow: [], deny: [] };

  const allow = [...new Set((data ?? []).map(r => r.permission_slug))].sort();
  return { allow, deny: [] };
}
```

**Query performance:** Hits `idx_uep_user_org_branch` index on `(user_id, organization_id, branch_id)`. Single query. No joins, no RPC calls.

### C.3 `checkPermission` Compatibility

The `checkPermission(snapshot, slug)` utility in `src/lib/utils/permissions.ts` works identically with compiled snapshots:

- Wildcards (`module.*`) stored in UEP as-is → still matched by `matchesAnyPattern`
- `deny: []` → deny check always returns false → no behavior change for normal cases
- Regex cache still applies

**No changes needed to `checkPermission` or `usePermissions` hook.**

---

## Section D — Compatibility & Breakage Risk Scan

### D.1 Risk Matrix

| Risk ID  | Description                                                                                               | Severity | Mitigation                                                         |
| -------- | --------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------ |
| **R-01** | `PermissionCompiler.compileForUser` does not set `branch_id`                                              | HIGH     | Retire or rewrite TypeScript compiler to use DB function via RPC   |
| **R-02** | `PermissionServiceV2.getEffectivePermissionsArray` mixes all branch permissions (no filter)               | MED      | Not currently used for security gates; fix separately or accept    |
| **R-03** | `snapshot.deny` will always be `[]` in compiled path — code that checks deny directly may change behavior | MED      | See D.3 — only `checkPermission` utility checks deny               |
| **R-04** | `PermissionService.getPermissionsForUser()` (legacy deprecated method) still calls dynamic path           | LOW      | No active call sites outside tests; can stay deprecated            |
| **R-05** | `getDetailedPermissions` debug action uses dynamic queries                                                | NONE     | Intentionally dynamic (display metadata); keep as-is               |
| **R-06** | `compile_user_permissions` revoke logic excludes by `effect='revoke'` at compile time                     | NONE     | Correctly matches V1 deny semantics — no behavior change           |
| **R-07** | React `cache()` on `loadUserContextV2` deduplicates same-request calls                                    | NONE     | Cache key is `(activeOrgId, activeBranchId)` — same after refactor |
| **R-08** | `PermissionsSync` client queries `getBranchPermissions` on every branch change                            | NONE     | After refactor: single compiled query instead of 4 queries         |

### D.2 Direct `snapshot.deny` Usage Audit

```
grep -r "snapshot\.deny\|permissionSnapshot\.deny\|\.deny\b" src/ \
  --include="*.ts" --include="*.tsx" | grep -v "test\|spec\|node_modules"
```

Findings:

- `src/lib/utils/permissions.ts` — `checkPermission` reads `snapshot.deny` via `matchesAnyPattern` — **correct, works with `[]`**
- `src/server/services/permission.service.ts:203` — builds `deny[]` from overrides then returns it — **only in V1 service being replaced**
- No other file reads `.deny` directly for business logic

**Conclusion:** Moving to `deny: []` compiled snapshots has zero behavioral impact. All callers use `checkPermission` which handles `[]` correctly.

### D.3 Wildcard Slug Storage Verification

The DB `permissions` table has `module.*` as an explicit slug (with `category='module'`, `action='*'`). This slug exists in `role_permissions` for `org_owner`. Therefore:

- `compile_user_permissions` inserts `permission_slug = 'module.*'` into UEP
- `checkPermission(snapshot, 'module.warehouse.access')` succeeds because `matchesAnyPattern(['module.*'], 'module.warehouse.access')` returns true

**Wildcards work correctly through the compiled path. No expansion needed.**

### D.4 Override Grant vs Compiled Path

Grant overrides (`effect='grant'` in `user_permission_overrides`) are included in the org-scope UEP insert by `compile_user_permissions` STEP 4's UNION clause. **They are compiled correctly.**

However, grant overrides currently written with `scope='branch'` in `user_permission_overrides` are NOT compiled into branch-scoped UEP rows — only `scope='org'` grants are included. This is a pre-existing limitation of the DB compiler (not introduced by this convergence). The override system has no current users relying on branch-scoped grant overrides.

### D.5 `PermissionCompiler` Retirement Safety

```
grep -rn "PermissionCompiler\." src/ --include="*.ts" --include="*.tsx" \
  | grep -v "__tests__\|\.test\."
```

Result: Zero call sites outside test files. Safe to retire without functional impact. Tests should be updated to remove PermissionCompiler tests or convert to DB-function-based tests.

---

## Section E — Phase 2 Prerequisites & Output Checklist

### E.1 Phase 2 Prerequisites (must be confirmed before implementing)

| #    | Prerequisite                                                                                                     | Status       | Evidence                                                                                         |
| ---- | ---------------------------------------------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------ |
| P-01 | DB trigger fires on every URA INSERT/UPDATE/DELETE                                                               | ✅ Confirmed | `trigger_compile_on_role_assignment` AFTER INSERT OR UPDATE OR DELETE on `user_role_assignments` |
| P-02 | Branch-scope UEP rows correctly set `branch_id = ura.scope_id`                                                   | ✅ Confirmed | Migration SQL + 5 live branch-scope rows, 0 orphaned                                             |
| P-03 | Wildcard slugs stored as-is in UEP (not expanded)                                                                | ✅ Confirmed | DB `compile_user_permissions` inserts `p.slug` directly from `permissions` table                 |
| P-04 | `checkPermission` utility works with `deny: []`                                                                  | ✅ Confirmed | Empty deny → deny-check short-circuits to false → allow-check proceeds normally                  |
| P-05 | No code reads `snapshot.deny` for business logic except via `checkPermission`                                    | ✅ Confirmed | Grep scan: only V1 service writes deny; all callers use utility function                         |
| P-06 | `PermissionCompiler` TypeScript service has no active call sites in prod code                                    | ✅ Confirmed | Zero hits outside test files                                                                     |
| P-07 | `getEffectivePermissions` / `checkPermission` / `checkOrgMembership` server actions do NOT need branch-awareness | ✅ Confirmed | These are informational/point-check actions; not used for SSR permission snapshot                |

### E.2 Files to Change in Phase 2/3 (implementation scope)

| File                                                     | Change                                                                                                           | Risk                                 |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `src/server/services/permission-v2.service.ts`           | Add `getPermissionSnapshotForUser(supabase, userId, orgId, branchId?)` with branch-aware UEP query               | LOW — additive change                |
| `src/server/loaders/v2/load-user-context.v2.ts`          | Replace `PermissionService.getPermissionSnapshotForUser` with `PermissionServiceV2.getPermissionSnapshotForUser` | MED — authoritative SSR path         |
| `src/app/actions/v2/permissions.ts:getBranchPermissions` | Replace `PermissionService` with `PermissionServiceV2` (branch-aware variant)                                    | MED — client sync path               |
| `src/server/services/permission-compiler.service.ts`     | Retire `compileForUser` or add branch_id handling                                                                | LOW — no active prod callers         |
| `src/server/services/permission.service.ts`              | Mark as deprecated, no longer used by core paths                                                                 | LOW — no deletion needed immediately |

**NOT in scope for Phase 3:**

- `getDetailedPermissions` (debug panel — intentionally dynamic for display metadata)
- `getEffectivePermissions` action (informational, not security-gating)
- `PermissionService.getPermissionsForUser` legacy method (already deprecated)
- Any RLS policies (all already use compiled UEP)
- `checkPermission` utility (no changes needed)
- `usePermissions` hook (no changes needed)

### E.3 Test Impact

| Test File                                                      | Change Needed                                                                    |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `src/server/services/__tests__/permission.service.test.ts`     | Keep (documents V1 behavior) or convert to compiled-path tests                   |
| `src/server/services/__tests__/permission-v2.service.test.ts`  | Add tests for branch-aware `getPermissionSnapshotForUser`                        |
| `src/app/actions/v2/__tests__/permissions.test.ts`             | Update `getBranchPermissions` mock to reflect V2 compiled call                   |
| `src/server/loaders/v2/__tests__/load-user-context.v2.test.ts` | Update mock setup (no URA/role_permissions mocks needed; mock UEP table instead) |

### E.4 Risk Summary for Phase 3

**Net query reduction per SSR page load:** 4 queries (URA org + URA branch + RPC get_permissions_for_roles + overrides) → 1 query (UEP with branch filter). For `getBranchPermissions` client action: same reduction.

**Behavioral delta:** None for correctly-compiled users. If a user's UEP is stale (e.g., DB trigger failed silently), the compiled path will return fewer permissions than the dynamic path. This is fail-closed — safer, not less safe.

**Rollback plan:** `PermissionService` remains in codebase (not deleted in Phase 3). Reverting `loadUserContextV2` and `getBranchPermissions` to use `PermissionService` restores V1 behavior immediately with no DB changes.

---

## Appendix — Data Divergence Check

The following SQL confirms the compiled UEP matches what the dynamic V1 path would compute for the current test user (conceptual — not run in Phase 1):

```sql
-- What compiled UEP says (org-scope)
SELECT permission_slug FROM user_effective_permissions
WHERE user_id = '<test_user_id>'
  AND organization_id = '<org_id>'
  AND branch_id IS NULL
ORDER BY permission_slug;

-- What V1 dynamic path says (org-scope equivalent)
SELECT DISTINCT p.slug
FROM user_role_assignments ura
JOIN role_permissions rp ON rp.role_id = ura.role_id AND rp.allowed = true
JOIN permissions p ON p.id = rp.permission_id
WHERE ura.user_id = '<test_user_id>'
  AND ura.scope = 'org'
  AND ura.scope_id = '<org_id>'
  AND ura.deleted_at IS NULL
  AND rp.deleted_at IS NULL
  AND p.deleted_at IS NULL
ORDER BY p.slug;
```

If these two queries return identical result sets, the compiled path is authoritative and convergence is safe. Run this in Phase 3 before switching the authoritative path.

---

_Phase 1 complete. Phase 2 = Write implementation plan. Phase 3 = Execute. Phase 4 = Delivery report._
_Report generated: 2026-03-03 | Source: Supabase MCP (live DB) + source code forensic reads_
