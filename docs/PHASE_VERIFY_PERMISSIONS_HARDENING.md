# Phase 1 — Permissions Hardening Verification Report

**Date:** 2026-03-04
**Branch:** `org-managment-v2`
**Method:** Supabase MCP (live DB) + source code reads + grep evidence

---

## A) DB Truth

### A.1 Table Schemas (verified via Supabase MCP)

#### `permissions` (30 active rows)

| Column       | Type        | Nullable | Default           |
| ------------ | ----------- | -------- | ----------------- | ------ |
| id           | uuid        | NO       | gen_random_uuid() |
| slug         | text        | NO       | —                 | UNIQUE |
| label        | text        | YES      | —                 |
| category     | text        | NO       | —                 |
| action       | text        | NO       | —                 |
| scope_types  | text[]      | YES      | —                 |
| is_system    | bool        | YES      | false             |
| is_dangerous | bool        | YES      | false             |
| deleted_at   | timestamptz | YES      | —                 |

Indexes: `permissions_pkey`, `permissions_slug_key` (UNIQUE), `idx_permissions_category`, `idx_permissions_system`, `idx_permissions_dangerous`

#### `role_permissions`

| Column        | Type        | Nullable | Default           |
| ------------- | ----------- | -------- | ----------------- |
| id            | uuid        | NO       | gen_random_uuid() |
| role_id       | uuid        | NO       | —                 |
| permission_id | uuid        | NO       | —                 |
| allowed       | bool        | NO       | true              |
| deleted_at    | timestamptz | YES      | —                 |

#### `user_role_assignments` (URA)

| Column     | Type        | Nullable |
| ---------- | ----------- | -------- | ----------------- |
| id         | uuid        | NO       |
| user_id    | uuid        | NO       |
| role_id    | uuid        | NO       |
| scope      | text        | NO       | 'org' or 'branch' |
| scope_id   | uuid        | NO       |
| deleted_at | timestamptz | YES      |

Indexes: PK, UNIQUE(user_id, role_id, scope, scope_id), `idx_user_role_assignments_compiler`(user_id, scope, scope_id WHERE deleted_at IS NULL)

#### `user_permission_overrides` (UPO)

**⚠️ REDUNDANT CONSTRAINT IDENTIFIED** — Two unique indexes cover the same column set:

| Index name                                | Definition                                      | WHERE              |
| ----------------------------------------- | ----------------------------------------------- | ------------------ |
| `user_permission_overrides_uniq`          | UNIQUE(user_id, permission_id, scope, scope_id) | deleted_at IS NULL |
| `user_permission_overrides_unique_active` | UNIQUE(user_id, scope, scope_id, permission_id) | deleted_at IS NULL |

Both cover `{user_id, permission_id, scope, scope_id}` — column order does not affect uniqueness semantics in PostgreSQL. Migration `20260110141056` comment explicitly states: _"Note: Existing table already has unique(user_id, permission_id, scope, scope_id)"_. No `ON CONFLICT ON CONSTRAINT` references found for either name in migrations or TypeScript.

#### `user_effective_permissions` (UEP)

| Column          | Type        | Nullable | Default           |
| --------------- | ----------- | -------- | ----------------- | --------------------- |
| id              | uuid        | NO       | gen_random_uuid() |
| user_id         | uuid        | NO       | —                 |
| organization_id | uuid        | NO       | —                 |
| permission_slug | text        | NO       | —                 |
| source_type     | text        | NO       | 'role'            |
| source_id       | uuid        | YES      | —                 |
| branch_id       | uuid        | YES      | —                 | NULL=org, UUID=branch |
| created_at      | timestamptz | NO       | now()             |
| compiled_at     | timestamptz | NO       | now()             |

UNIQUE: `user_effective_permissions_unique_v2`(user_id, org_id, permission_slug, branch_id) NULLS NOT DISTINCT

Indexes: `idx_uep_user_org`, `idx_uep_user_org_branch`, `idx_uep_user_org_permission`, `idx_uep_permission`

**Live counts (2026-03-04):** 31 total — 30 org-scope (branch_id IS NULL), 1 branch-scope.

#### `branches`

| Column          | Type        | Nullable |
| --------------- | ----------- | -------- |
| id              | uuid        | NO       |
| organization_id | uuid        | NO       |
| name            | text        | NO       |
| slug            | text        | YES      |
| created_at      | timestamptz | YES      |
| deleted_at      | timestamptz | YES      |

---

### A.2 DB Function Bodies (verified via Supabase MCP)

#### `compile_user_permissions(p_user_id, p_organization_id)` — SECURITY DEFINER

```
1. Guard: IF NOT active member → DELETE UEP rows + RETURN
2. pg_advisory_xact_lock(hashtext(user_id || org_id))  [race protection]
3. DELETE FROM uep WHERE user_id=X AND org_id=X  [full wipe]
4. INSERT org-scoped (branch_id=NULL):
   URA(scope='org') → role_permissions(allowed=true) → permissions.slug
   UNION upo(effect='grant')
   MINUS upo(effect='revoke')  [applied to BOTH org and branch inserts]
5. INSERT branch-scoped (branch_id=ura.scope_id):
   URA(scope='branch') → role_permissions → permissions.slug
   JOIN branches b ON b.org=p_org  [cross-org guard]
   MINUS upo(effect='revoke')
ON CONFLICT (unique_v2) DO UPDATE SET compiled_at=now()
```

**Key invariants:**

- Wildcards stored verbatim (not expanded)
- Org-level revoke overrides suppress BOTH org-scoped AND branch-scoped rows
- Cross-org branch leakage prevented by `b.organization_id = p_organization_id`

#### `has_permission(org_id, permission)` — exact match, org-scope

```sql
SELECT EXISTS (SELECT 1 FROM uep
  WHERE org_id=org_id AND user_id=auth.uid()
    AND permission_slug=permission AND branch_id IS NULL);
```

#### `has_branch_permission(p_org_id, p_branch_id, p_slug)` — exact match, branch-aware

```sql
SELECT EXISTS (SELECT 1 FROM uep
  WHERE user_id=auth.uid() AND org_id=p_org_id
    AND permission_slug=p_slug
    AND (branch_id IS NULL OR branch_id=p_branch_id));
```

#### `user_has_effective_permission(p_user_id, p_org_id, p_slug)` — exact match, org-scope

```sql
SELECT EXISTS (SELECT 1 FROM uep
  WHERE user_id=p_user_id AND org_id=p_org_id
    AND permission_slug=p_slug AND branch_id IS NULL);
```

#### `is_org_member(org_id)` — active membership

```sql
SELECT EXISTS (SELECT 1 FROM organization_members
  WHERE org_id=org_id AND user_id=auth.uid()
    AND status='active' AND deleted_at IS NULL);
```

**All DB RPCs use exact string match — NOT wildcard-aware.**

---

### A.3 Triggers (verified)

| Table                     | Trigger                                      | Timing | Events               | Function                                      |
| ------------------------- | -------------------------------------------- | ------ | -------------------- | --------------------------------------------- |
| user_role_assignments     | trigger_role_assignment_compile              | AFTER  | INSERT/UPDATE/DELETE | trigger_compile_on_role_assignment()          |
| user_role_assignments     | check_role_assignment_scope                  | BEFORE | INSERT/UPDATE        | validate_role_assignment_scope()              |
| user_permission_overrides | trigger_override_compile                     | AFTER  | INSERT/UPDATE/DELETE | trigger_compile_on_override()                 |
| user_permission_overrides | trigger_user_permission_overrides_updated_at | BEFORE | UPDATE               | update_user_permission_overrides_updated_at() |
| user_permission_overrides | trigger_validate_permission_slug             | BEFORE | INSERT/UPDATE        | validate_permission_slug_on_override()        |

---

### A.4 RLS Policies (verified)

**`user_effective_permissions`**

- SELECT: `user_id = auth.uid()` (own rows only)
- SELECT: `has_org_role(organization_id, 'org_owner')` (org owner)
- No write policies — compiler (SECURITY DEFINER) is sole writer.

**`user_role_assignments`**

- SELECT: `user_id = auth.uid()` — used by `_computeAccessibleBranches` (own assignments, no members.read needed)
- SELECT: V2 org view — `scope='org' AND is_org_member AND has_permission('members.read')`
- SELECT: V2 branch view — `scope='branch' AND (has_permission('members.read') OR has_branch_permission('branch.roles.manage'))`
- INSERT/UPDATE/DELETE: dual-gate — org: `is_org_member + members.manage`; branch: `(members.manage OR branch.roles.manage) AND is_org_member`

**`user_permission_overrides`**

- SELECT self: `user_id = auth.uid() AND deleted_at IS NULL`
- SELECT admin: `is_org_member AND has_permission('members.manage')`
- INSERT/UPDATE/DELETE: `is_org_member AND has_permission('members.manage')`

**RLS slugs used in policies:** `'members.read'`, `'members.manage'`, `'branch.roles.manage'`, `'org_owner'` — all non-wildcard. ✅

---

## B) Application Truth

### B.1 SSR Pipeline (V2 production dashboard)

**Route**: `src/app/[locale]/dashboard/layout.tsx` → `loadDashboardContextV2()`

```
loadDashboardContextV2()
  loadAppContextV2()                  → resolves activeOrgId, activeBranchId, availableBranches
  loadUserContextV2(orgId, branchId)
    supabase.auth.getUser()           ← JWT validated (auth gate)
    supabase.auth.getSession()        ← access_token for JWT role extraction ONLY
    users table query                 ← identity
    AuthService.getUserRoles()        ← roles from JWT
    PermissionServiceV2.getPermissionSnapshotForUser(supabase, userId, orgId, branchId)
      → UEP: branch_id IS NULL OR branch_id = branchId
  _computeAccessibleBranches(userId, orgId, allBranches, snapshot)
    FAST PATH: if checkPermission(snapshot, BRANCHES_VIEW_ANY) → return allBranches
    SLOW PATH: query URA WHERE scope='branch' (RLS allows own rows) → filter allBranches
  Re-validate activeBranchId → reload loadUserContextV2 if branch changed
```

---

### B.2 `_computeAccessibleBranches` — URA Read (Branch Discovery, NOT Permission Computation)

**File**: `src/server/loaders/v2/load-dashboard-context.v2.ts:44-51`

```typescript
// SLOW PATH only (when user lacks BRANCHES_VIEW_ANY)
const { data: assignments } = await supabase
  .from("user_role_assignments")
  .select("scope_id") // Only retrieves branch IDs — not permission content
  .eq("user_id", userId)
  .eq("scope", "branch")
  .is("deleted_at", null);
```

**Why this URA read is correct:**

- Purpose: discover WHICH BRANCHES the user has been assigned to (accessibility), not WHAT they can do.
- Only `scope_id` (branch UUID) is selected — no permission slugs read from URA.
- Permission content always comes from UEP via `getPermissionSnapshotForUser`.
- RLS "View own role assignments" (`user_id = auth.uid()`) permits this without `members.read`.
- This is NOT permission derivation. The "compile, don't evaluate" invariant is preserved.

**Invariant statement**: "TS code must not derive effective permissions from URA. URA reads are permitted only for branch accessibility discovery (which branches exist for the user). All permission content comes exclusively from UEP."

---

### B.3 V1 PermissionService — Production Impact

| File                                        | V1 Usage                                    | Production?                     |
| ------------------------------------------- | ------------------------------------------- | ------------------------------- |
| `src/lib/api/load-user-context-server.ts`   | `PermissionService.getPermissionsForUser()` | Only via `dashboard-old` layout |
| `src/app/[locale]/dashboard-old/layout.tsx` | Uses `loadUserContextServer`                | Legacy route only               |
| `src/lib/providers/user-init-provider.tsx`  | Type imports `loadUserContextServer`        | Only in `dashboard-old`         |

**V2 production dashboard** (`src/app/[locale]/dashboard/layout.tsx`) → `loadDashboardContextV2` → `PermissionServiceV2` exclusively. V1 is isolated to legacy code.

---

### B.4 `canFromSnapshot()` — Zero Callers

**Grep result**: No calls to `canFromSnapshot` anywhere in `src/` except the definition at `permission-v2.service.ts:288`.

Current implementation:

```typescript
static canFromSnapshot(snapshot: PermissionSnapshot, permission: string): boolean {
  return snapshot.allow.includes(permission);  // exact match — NOT wildcard-aware
}
```

**Bug**: If `snapshot.allow = ["warehouse.*"]` and you call `canFromSnapshot(snap, "warehouse.products.read")`, it returns `false`. No callers currently trigger this bug. However, the method has no `@deprecated` warning to prevent future misuse.

---

### B.5 `checkPermission` Name Collision

| Symbol                      | Module                              | Signature                                                | Behaviour                      |
| --------------------------- | ----------------------------------- | -------------------------------------------------------- | ------------------------------ |
| `checkPermission` (action)  | `src/app/actions/v2/permissions.ts` | `(orgId: string, slug: string) → Promise<boolean>`       | DB RPC, exact match, org-scope |
| `checkPermission` (utility) | `src/lib/utils/permissions.ts`      | `(snapshot: PermissionSnapshot, slug: string) → boolean` | Wildcard-aware, deny-first     |

**Production callers of server action `checkPermission`**: test file only (`src/app/actions/v2/__tests__/permissions.test.ts`). No production imports found.

**Risk**: TypeScript will not catch an import from the wrong module since both return `boolean`.

---

## C) Issues Summary

| ID  | Issue                                                                                          | Severity    | Fix                                          |
| --- | ---------------------------------------------------------------------------------------------- | ----------- | -------------------------------------------- |
| I-1 | Docs imply "TS never reads URA" but `_computeAccessibleBranches` does read URA (for discovery) | Misleading  | Fix 1: clarify invariant wording             |
| I-2 | `canFromSnapshot()` not wildcard-aware, no `@deprecated` warning                               | Bug risk    | Fix 2: delegate to `checkPermission` utility |
| I-3 | `checkPermission` server action and utility share same name                                    | Footgun     | Fix 3: rename action                         |
| I-4 | RLS/RPC exact-match rule documented but not tested                                             | Docs gap    | Fix 4: add invariant test                    |
| I-5 | Two UPO unique constraints enforce same uniqueness                                             | Schema debt | Fix 5: document + migration                  |
| I-6 | Org-revoke cascades to branch rows — only briefly mentioned                                    | Docs gap    | Fix 6: expand with example                   |

---

## D) Follow-Up Audit (2026-03-04) — Remaining Gaps

After Phase 2 fixes were verified, four additional gaps (P0–P3) were identified and resolved.

### P0 — RLS Wildcard Invariant: Contract Test vs DB-Backed Test

**Gap**: `rls-permission-invariants.test.ts` was a contract test covering only 3 slugs (`members.read`, `members.manage`, `branch.roles.manage`). It would not catch a new RLS policy added with a wildcard slug that we didn't enumerate.

**DB evidence** (regexp_matches on pg_policies, 2026-03-04):
The complete set of distinct permission slugs used in RLS policy expressions across all public-schema tables:

| Slug                  | Tables                                                                 |
| --------------------- | ---------------------------------------------------------------------- |
| `members.read`        | user_role_assignments, user_permission_overrides, organization_members |
| `members.manage`      | user_role_assignments, user_permission_overrides, organization_members |
| `branch.roles.manage` | user_role_assignments                                                  |
| `branches.create`     | branches                                                               |
| `branches.delete`     | branches                                                               |
| `branches.update`     | branches                                                               |
| `invites.create`      | invitations                                                            |
| `invites.read`        | invitations                                                            |
| `invites.cancel`      | invitations                                                            |
| `org.update`          | org_positions, org_profiles                                            |

None contain `*`. **Total: 10 slugs** (previous contract test covered only 3).

**Fixes applied**:

1. Expanded contract test to all 10 slugs with exact-value assertions for each.
2. Created migration `20260304120000_add_audit_rls_permission_gate_slugs_fn.sql` — SECURITY DEFINER function `public.audit_rls_permission_gate_slugs()` that introspects `pg_policies` and returns extracted string literals. Callable by `service_role` only.
3. Created DB-backed integration test `src/server/services/__tests__/rls-wildcard-db-invariant.test.ts` — calls the audit function via RPC and asserts no result contains `*`. Uses `itIfEnv` pattern (skips when `SUPABASE_SERVICE_ROLE_KEY` absent). Also asserts all 10 expected slugs are present (regression guard against unintended policy deletion).

### P1 — `checkPermission` Utility: Server-Safety

**Finding**: `src/lib/types/permissions.ts` exports only the `PermissionSnapshot` type — zero runtime code. The `checkPermission` utility (`src/lib/utils/permissions.ts`) uses only stdlib (Map, RegExp, string operations) with no client-only imports. **Confirmed pure and server-safe.** No fix required.

### P2 — `user_permission_overrides_uniq`: Index vs Constraint

**Finding**: `pg_constraint` query on the `user_permission_overrides` table returned no row named `user_permission_overrides_uniq`. Only check, FK, and PK constraints exist on this table. The object was a **pure index only**, not a table constraint. Therefore the migration `20260304110000` using `DROP INDEX IF EXISTS` was correct — no `ALTER TABLE ... DROP CONSTRAINT` was needed. No corrective action required.

### P3 — Old `checkPermission` Server Action Name: No Remaining Callers

**Grep of all `*.ts`/`*.tsx` files for `checkPermission`** confirmed:

- All production callers import from `@/lib/utils/permissions` (the utility function) ✓
- The only imports from `@/app/actions/v2/permissions` are `getBranchPermissions`, `getDetailedPermissions` ✓
- No file imports the old `checkPermission` action name — rename to `checkOrgPermissionExact` is fully clean ✓

### Summary Table

| Gap                                          | Status               | Action                                                                            |
| -------------------------------------------- | -------------------- | --------------------------------------------------------------------------------- |
| P0 Contract test covered only 3/10 RLS slugs | **Fixed**            | Expanded to 10 slugs; added DB-backed integration test + audit function migration |
| P1 `checkPermission` utility server-safety   | **Verified clean**   | No action (pure, server-safe)                                                     |
| P2 Dropped object type (index vs constraint) | **Verified correct** | No action (was index-only; `DROP INDEX` was right)                                |
| P3 Old `checkPermission` action name callers | **Verified clean**   | No action (zero callers)                                                          |
