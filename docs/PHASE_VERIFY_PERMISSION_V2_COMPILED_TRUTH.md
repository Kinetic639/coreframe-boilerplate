# Phase 1 Verification Report — Permission V2 Compiled Truth Hardening

**Date:** 2026-03-04
**Branch:** `org-managment-v2`
**Status:** Phase 1 complete — NO code changes
**Source:** Supabase MCP (live DB) + source code forensic reads

---

## Executive Summary

Three distinct problems are confirmed:

| #   | Problem                                                                                                                                           | Severity                                                                                      |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| P-1 | `getEffectivePermissions*` queries UEP without `branch_id` filter → returns cross-branch rows                                                     | MED — not a security gate today, but semantics are wrong                                      |
| P-2 | `getDetailedPermissions` uses dynamic role assignment queries (`user_role_assignments` → `get_permissions_for_roles` RPC) instead of compiled UEP | MED — violates "UEP is source of truth" invariant; creates a divergent code path              |
| P-3 | UEP contains wildcard slugs (`account.*`, `module.*`) but PermissionServiceV2 JSDoc claims "no wildcards at runtime"                              | LOW — misleading documentation; `checkPermission` utility already handles wildcards correctly |

One issue is confirmed **NOT a problem** (requires no change):

- `PermissionService` (legacy) call site in `src/lib/api/load-user-context-server.ts` uses `getPermissionsForUser` (V1 legacy loader, not V2 path) — out of Phase 2 scope.

---

## Section A — Call Site Inventory

### A.1 `PermissionServiceV2.getEffectivePermissions*`

| Method                                          | File                                           | Line | Purpose                                        | Security-sensitive?     | Scope it SHOULD represent  |
| ----------------------------------------------- | ---------------------------------------------- | ---- | ---------------------------------------------- | ----------------------- | -------------------------- |
| `getEffectivePermissionsArray`                  | `src/app/actions/v2/permissions.ts`            | 76   | Powers `getEffectivePermissions` server action | No — informational only | Org-only (no cross-branch) |
| `getEffectivePermissions` (service method)      | JSDoc example in service                       | —    | Not called from production code                | N/A                     | —                          |
| `getEffectivePermissionsArray` (service method) | `src/server/services/permission-v2.service.ts` | 98   | Definition only; called by action above        | No                      | Org-only                   |

**Current query (no branch_id filter):**

```typescript
supabase
  .from("user_effective_permissions")
  .select("permission_slug")
  .eq("user_id", userId)
  .eq("organization_id", orgId);
// ← NO .is("branch_id", null) — returns ALL rows including branch-scoped
```

**Issue:** For a user with `branch.roles.manage` on branch-A (stored as `branch_id = uuid`), calling `getEffectivePermissionsArray(orgId)` returns `branch.roles.manage` even though the caller asked for org-level permissions. This pollutes the result with branch-scoped permissions.

### A.2 `getEffectivePermissions` Server Action

| File                                | Line | Caller                             | Usage                                                        | Security-sensitive? |
| ----------------------------------- | ---- | ---------------------------------- | ------------------------------------------------------------ | ------------------- |
| `src/app/actions/v2/permissions.ts` | 65   | Unknown (no grep hit in prod code) | Informational — no call sites found in production components | No                  |

The `getEffectivePermissions` server action has **zero call sites in production components**. It is exported but unused (or used only by external tools). It is kept for API completeness but not relied on for any auth gate.

### A.3 `getDetailedPermissions` Server Action

| File                                | Line | Caller                                                   | Usage                                                                    | Security-sensitive?                    |
| ----------------------------------- | ---- | -------------------------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------- |
| `src/app/actions/v2/permissions.ts` | 123  | `src/components/v2/debug/permission-debug-panel.tsx:155` | Debug panel only — `queryFn: () => getDetailedPermissions(activeOrgId!)` | No — debug display, DEV ONLY component |

**Current implementation (dynamic path):**

```typescript
// Step 1: Org-scoped role IDs from user_role_assignments
supabase
  .from("user_role_assignments")
  .select("role_id")
  .eq("user_id", userId)
  .eq("scope", "org")
  .eq("scope_id", orgId);

// Step 2: get_permissions_for_roles(orgRoleIds) RPC

// Step 3: Branch-scoped role IDs from user_role_assignments
supabase
  .from("user_role_assignments")
  .select("role_id, scope_id")
  .eq("user_id", userId)
  .eq("scope", "branch");

// Step 4: Resolve branch names via branches table
// Step 5: get_permissions_for_roles(branchRoleIds) per branch
```

This is a 4+ query dynamic path that re-derives what the DB trigger already compiled. It is NOT reading from compiled UEP.

### A.4 `PermissionService` (Legacy) — Non-test Production Call Sites

| File                                      | Line | Method                       | Usage                                        | Notes                                                |
| ----------------------------------------- | ---- | ---------------------------- | -------------------------------------------- | ---------------------------------------------------- |
| `src/lib/api/load-user-context-server.ts` | ~60  | `getPermissionsForUser(...)` | V1 legacy loader used by old dashboard pages | Out of V2 scope; not security-critical for this task |

The legacy loader uses `getPermissionsForUser` (the deprecated V1 flat array method), not `getPermissionSnapshotForUser`. It's in the V1 `loadUserContextServer` path which feeds the legacy (non-V2) dashboard. **Not in scope for this task.**

---

## Section B — UEP Wildcard Reality Confirmed

### B.1 Live UEP Sample (from Supabase MCP query)

```sql
SELECT permission_slug, branch_id IS NULL AS is_org_scope, count(*)
FROM public.user_effective_permissions
GROUP BY permission_slug, is_org_scope
ORDER BY permission_slug;
```

| permission_slug                         | is_org_scope | count |
| --------------------------------------- | ------------ | ----- |
| `account.*`                             | true         | 3     |
| `branches.read`                         | true         | 3     |
| `branches.read`                         | **false**    | 1     |
| `invites.cancel`                        | true         | 1     |
| `invites.cancel`                        | **false**    | 1     |
| `invites.create`                        | true         | 1     |
| `invites.create`                        | **false**    | 1     |
| `invites.read`                          | true         | 1     |
| `invites.read`                          | **false**    | 1     |
| `members.manage`                        | true         | 1     |
| `members.manage`                        | **false**    | 1     |
| `members.read`                          | true         | 3     |
| `module.*`                              | true         | 1     |
| `module.organization-management.access` | true         | 1     |
| `org.read`                              | true         | 3     |
| `self.read`                             | true         | 3     |
| `self.update`                           | true         | 3     |
| _(others)_                              |              |       |

### B.2 Wildcard Slugs Confirmed in UEP

**YES — wildcards ARE stored in UEP:**

- `account.*` (3 org-scope rows)
- `module.*` (1 org-scope row)

### B.3 DB Compiler Does NOT Expand Wildcards

Evidence from `compile_user_permissions` body (Section 3.1 of extraction doc):

```sql
-- Step 4: Insert org-scope perms
SELECT DISTINCT p_user_id, p_organization_id, p.slug, 'role', NULL::uuid, now()
FROM user_role_assignments ura
JOIN roles r ON ...
JOIN role_permissions rp ON ...
JOIN permissions p ON rp.permission_id = p.id   -- ← inserts p.slug as-is
```

The compiler inserts `p.slug` directly from the `permissions` table. If `permissions.slug = 'account.*'`, then `user_effective_permissions.permission_slug = 'account.*'`. No expansion.

### B.4 Implications

**CRITICAL:** Any statement claiming "no wildcards at runtime" is FALSE for this system.

- `checkPermission(snapshot, 'account.profile.update')` correctly returns `true` because `matchesAnyPattern(['account.*'], 'account.profile.update')` = true (regex `account\..*` matches).
- `PermissionServiceV2.getPermissionSnapshotForUser` returns `allow: ['account.*', ...]` (wildcard preserved).
- The `usePermissions` client hook calls `checkPermission` which handles wildcards — correct.
- `PermissionServiceV2.hasPermission` calls `user_has_effective_permission` RPC which does EXACT string match — this means `has_permission(orgId, 'account.profile.update')` returns **false** even though `account.*` grants it. This is a known limitation documented in the module checklist.

**The PermissionServiceV2 JSDoc comment "No wildcards at runtime!" must be updated to reflect reality.**

### B.5 Cross-Branch Pollution — Confirmed

From the UEP live data:

- `invites.cancel` has BOTH org-scope (is_org_scope=true) AND branch-scope rows
- `invites.read`, `invites.create`, `members.manage`, `branches.read` same pattern

`getEffectivePermissionsArray` without `branch_id IS NULL` filter will return these branch-scope slugs in the result for any caller who just asked for "org-level permissions". For a user without a branch assignment, this may be irrelevant (all their rows are org-scope). But for the branch manager user whose UEP has branch-scope rows, the method returns branch permissions contaminating org-level results.

---

## Section C — Required Output Contract for `getDetailedPermissions`

### C.1 Current vs Target

| Aspect                 | Current (dynamic)                                                                | Target (compiled)                                                                                                            |
| ---------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Data source            | `user_role_assignments` → `get_permissions_for_roles` RPC                        | `user_effective_permissions` WHERE user_id + organization_id                                                                 |
| Wildcards              | Correct (preserves wildcard slugs from `permissions` table)                      | Correct (wildcard slugs already in UEP)                                                                                      |
| Branch rows            | Derived from role assignments per branch                                         | Direct from `branch_id` column in UEP                                                                                        |
| Branch name resolution | Multiple queries via `branches` table, filtered by org                           | Same — resolve `branch_id` → `name` from `branches` WHERE `organization_id = orgId`                                          |
| RLS safety             | Reads `user_role_assignments` (own rows, via "View own role assignments" policy) | Reads `user_effective_permissions` (own rows, via "Users can view own effective permissions" policy: `user_id = auth.uid()`) |
| Org isolation          | Org-scoped by `scope_id = orgId` (org) + org filter on branches (branch)         | Org-scoped by `organization_id = orgId` directly                                                                             |
| Auth                   | `auth.getSession()`                                                              | Must use `auth.getUser()` (validates JWT against server)                                                                     |

### C.2 Required `DetailedPermission` Output Contract

```typescript
interface DetailedPermission {
  slug: string; // permission_slug from UEP
  scope: "org" | "branch"; // derived: branch_id IS NULL → "org", else "branch"
  branch_id: string | null; // raw branch_id from UEP (null for org-scope)
  branch_name: string | null; // resolved from branches table; null if unresolvable/RLS error
}
```

Sort order: `(scope ASC, branch_name NULLS LAST, slug ASC)` — deterministic for UI.

### C.3 Security Invariants

| Invariant                          | Mechanism                                                                                                                                             |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Only current user's data           | `WHERE user_id = auth.uid()` (implicit from RLS "Users can view own effective permissions") — but action should also explicit `eq("user_id", userId)` |
| Only this org's data               | `WHERE organization_id = orgId`                                                                                                                       |
| No cross-org leakage               | UEP has `organization_id` — filtering by orgId in query is sufficient                                                                                 |
| Branch name RLS failure → graceful | If `branches` SELECT fails, set `branch_name: null` instead of throwing                                                                               |
| Auth validation                    | Use `auth.getUser()` (server-validates JWT), not `auth.getSession()` (cookie-only)                                                                    |

---

## Section D — Test Coverage Gaps

### D.1 Existing Tests

| Test File                                                                          | What it covers                                                                             | Relevant?     |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------- |
| `src/app/actions/v2/__tests__/permissions.test.ts`                                 | `getBranchPermissions`, `getEffectivePermissions`, `checkPermission`, `checkOrgMembership` | YES — partial |
| No dedicated test for `getDetailedPermissions`                                     | —                                                                                          | **GAP**       |
| No dedicated test for `PermissionServiceV2.getEffectivePermissions*` branch filter | —                                                                                          | **GAP**       |

### D.2 Coverage Gaps

| Gap | Description                                                                                        |
| --- | -------------------------------------------------------------------------------------------------- |
| G-1 | `getDetailedPermissions` has ZERO tests (no describe block in any test file)                       |
| G-2 | `getEffectivePermissions` test only checks happy path — does NOT verify `branch_id IS NULL` filter |
| G-3 | No test for org isolation in `getDetailedPermissions` (cross-org UEP rows excluded)                |
| G-4 | No test for branch name resolution success case                                                    |
| G-5 | No test for branch name resolution graceful failure (RLS error → `branch_name: null`)              |
| G-6 | No test verifying `auth.getUser()` (not `getSession()`) is used in the action                      |

### D.3 Debug Panel Consumer

`permission-debug-panel.tsx` (line 366) passes `detailedPerms` to `<ScopedPermissionList>` component:

- Filters by `permissionFilter` text
- Groups by scope + branch via `availableBranches` prop
- Displays `p.slug`, `p.scope`, `p.branch_name`

**After refactoring `getDetailedPermissions` to UEP-driven output:**

- `DetailedPermission` interface shape is unchanged (`slug`, `scope`, `branch_id`, `branch_name`)
- `ScopedPermissionList` component should work without changes
- The only behavioral change is that the data comes from compiled UEP instead of dynamic derivation — correct behavior, no UI breakage expected

---

## Minimal Change List for Phase 2

**5 changes required:**

### Change 1 — Fix `getEffectivePermissions*` ambiguity in `PermissionServiceV2`

| Action                                                                    | Detail                            |
| ------------------------------------------------------------------------- | --------------------------------- |
| Rename `getEffectivePermissions` → `getOrgEffectivePermissions`           | Makes org-only semantics explicit |
| Rename `getEffectivePermissionsArray` → `getOrgEffectivePermissionsArray` | Same                              |
| Add `.is("branch_id", null)` to both                                      | Enforces org-only semantics       |
| Update call site in `permissions.ts` action (`getEffectivePermissions`)   | 1 call site                       |
| Update test mock in `permissions.test.ts`                                 | 1 mock reference                  |
| Update JSDoc: "No wildcards at runtime!" → accurate statement             | Documentation fix                 |

### Change 2 — Rewrite `getDetailedPermissions` to UEP-driven

| Action                                              | Detail                                                                        |
| --------------------------------------------------- | ----------------------------------------------------------------------------- |
| Replace 4-query dynamic path with compiled UEP read | SELECT from `user_effective_permissions` WHERE user_id + org_id               |
| Map `branch_id` to `scope`                          | `null` → `"org"`, UUID → `"branch"`                                           |
| Resolve branch names with org-isolated query        | SELECT from `branches` WHERE `id IN (branch_ids) AND organization_id = orgId` |
| Graceful failure on branches query                  | Catch RLS error; set `branch_name: null`                                      |
| Sort output                                         | `(scope, branch_name, slug)`                                                  |
| Switch auth from `getSession()` → `getUser()`       | Security improvement                                                          |

### Change 3 — Update JSDoc in `PermissionServiceV2`

Remove incorrect "No wildcards at runtime!" claim. Replace with accurate statement about wildcards being stored as-is and `checkPermission` being required for wildcard-aware checks.

### Change 4 — Add tests

| Test                                                                | Location                                 |
| ------------------------------------------------------------------- | ---------------------------------------- |
| `getDetailedPermissions` org+branch rows with correct scope mapping | `permissions.test.ts` new describe block |
| `getDetailedPermissions` branch name resolution success             | Same                                     |
| `getDetailedPermissions` branch name resolution graceful failure    | Same                                     |
| `getDetailedPermissions` org isolation                              | Same                                     |
| `getOrgEffectivePermissionsArray` org-only filter verification      | Same                                     |

### Change 5 — Update documentation

Update `PermissionServiceV2` class JSDoc and module docs to state:

- UEP stores wildcard slugs as-is
- `checkPermission` (wildcard-aware) must be used for permission checks, not `has_permission` RPC (exact match)
- `getOrgEffectivePermissions*` = org-scope only (branch_id IS NULL)
- `getPermissionSnapshotForUser` = branch-aware (preferred for auth gates)

---

## No-Change Confirmations

| Item                                                                     | Decision              | Reason                                     |
| ------------------------------------------------------------------------ | --------------------- | ------------------------------------------ |
| `PermissionService` legacy in `load-user-context-server.ts`              | NO CHANGE             | V1 path, out of V2 scope                   |
| `PermissionsSync` → `getBranchPermissions`                               | NO CHANGE             | Already switched to V2 compiled path       |
| `loadUserContextV2` → `PermissionServiceV2.getPermissionSnapshotForUser` | NO CHANGE             | Already correct from previous refactor     |
| `permission-debug-panel.tsx` UI                                          | NO CHANGE (data only) | `DetailedPermission` interface unchanged   |
| `ScopedPermissionList` component                                         | NO CHANGE             | Receives same interface; display unchanged |
| DB functions, triggers, RLS                                              | NO CHANGE             | Already correct                            |

---

_Phase 1 complete. Awaiting approval before Phase 2 implementation._

_Source: Supabase MCP (live DB) + source code forensic reads | 2026-03-04_
