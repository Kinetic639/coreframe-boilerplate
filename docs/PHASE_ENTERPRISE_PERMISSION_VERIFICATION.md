# Enterprise-Grade Permissions System Verification Report

**Date:** 2026-03-04
**Branch:** `org-managment-v2`
**Scope:** Pure verification audit — no code changes, no migrations, no deletions.
**Methodology:** Static analysis (TypeScript), live DB introspection (Supabase MCP), grep-based call-graph tracing.

---

## Executive Summary

The V2 permission pipeline (SSR loaders → `PermissionServiceV2` → `user_effective_permissions` → `checkPermission()`) is **architecturally sound and correctly implemented** end-to-end. All V2 dashboard routes, server actions, and sidebar resolution use the canonical `checkPermission(snapshot, slug)` utility with deny-first, wildcard-aware semantics.

However, **20+ warehouse and business tables have RLS completely disabled**, and two tables (`contacts`, `contact_addresses`) have RLS enabled with broken tenant isolation (open `qual: true` policies). These findings represent a significant security gap that exists orthogonally to the permission system itself.

| Risk          | Count | Summary                                                                                                                            |
| ------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------- |
| P0 (Critical) | 2     | `contacts`/`contact_addresses` — RLS enabled but no tenant check (any user sees all contacts)                                      |
| P1 (High)     | 3     | 20+ tenant-scoped tables with RLS disabled; warehouse action permission gates commented out; audit function not applied to live DB |
| P2 (Medium)   | 3     | Module API files use `getSession()` without `getUser()`; legacy dead-code paths; UEP covering index opportunity                    |

---

## 1. Phase 1: Legacy Permission Path Audit

### 1.1 Files Classified as Legacy (V1)

#### `src/lib/auth/permissions.ts` — DEAD CODE (P1)

- **Function:** `hasPermission()` — computes permissions by joining `user_role_assignments → roles → role_permissions → permissions` at runtime
- **Violation:** Reads URA directly instead of compiled UEP — violates the compile-then-read invariant
- **Auth:** Uses `getSession()` only (no `getUser()` JWT validation)
- **Status:** Zero imports confirmed via grep — confirmed dead code
- **Risk:** If ever imported, silently bypasses the UEP snapshot and produces stale, non-branch-aware results

#### `src/lib/api/load-user-context-server.ts` — LEGACY LOADER (P1 for auth concern, scoped below)

- **Violation:** Imports `PermissionService` (V1 URA-join), uses `getSession()` only
- **Callers:**

  | Caller                                            | Context                  | Security Risk                 |
  | ------------------------------------------------- | ------------------------ | ----------------------------- |
  | `src/lib/providers/user-init-provider.tsx`        | Client provider          | Low — reads display info only |
  | `src/app/actions/_debug/debug-user-context.ts`    | Debug action             | Medium — exposes context data |
  | `src/components/Dashboard/sidebar/AppSidebar.tsx` | Only in `dashboard-old/` | Low — old dashboard not V2    |
  | `src/components/header-auth.tsx`                  | Public pages             | Low — reads name/avatar only  |
  | `src/components/Header/PublicHeader.tsx`          | Public pages             | Low — reads name/avatar only  |
  | `src/app/[locale]/dashboard-old/*` (4 files)      | Old dashboard            | Low — old flow, not V2        |

- **Conclusion:** None of these callers make permission-enforcement decisions based on V1 data. The security risk is limited to unvalidated `getSession()` cookie reads on public-facing components. No V2 dashboard layout or server action imports this loader.

#### `src/lib/api/load-app-context-server.ts` — PARTIAL LEGACY (P2)

- Uses `getSession()` at line 55 for org/branch context resolution
- Does not make permission enforcement decisions
- Used in V1 dashboard flow only

### 1.2 Module API Files Using `getSession()` Without `getUser()` (P2)

| File                                                      | Operation      | Risk                                                  |
| --------------------------------------------------------- | -------------- | ----------------------------------------------------- |
| `src/modules/organization-managment/api/uploadLogo.ts`    | File upload    | P2 — stale session token could authorize expired user |
| `src/modules/organization-managment/api/updateProfile.ts` | Profile update | P2 — same                                             |

Both files should call `supabase.auth.getUser()` before performing mutations.

### 1.3 V2 Pipeline — Confirmed Clean

| Component                        | Auth Method                               | Permission Source                                        |
| -------------------------------- | ----------------------------------------- | -------------------------------------------------------- |
| `loadUserContextV2`              | `getUser()` → `getSession()` (token only) | `PermissionServiceV2.getPermissionSnapshotForUser` (UEP) |
| `getBranchPermissions` action    | `getUser()`                               | `PermissionServiceV2.getPermissionSnapshotForUser` (UEP) |
| `checkOrgPermissionExact` action | `getUser()` via service                   | `has_permission` DB RPC (exact match)                    |
| `loadDashboardContextV2`         | Delegates to `loadUserContextV2`          | UEP via V2 loader                                        |

All V2 SSR paths use `getUser()` for JWT validation before any permission check. ✅

---

## 2. Phase 2: Permission Gate Audit

### 2.1 Canonical Check Function

**`checkPermission(snapshot, slug)`** from `src/lib/utils/permissions.ts`:

- Pure module — only imports `PermissionSnapshot` type (no server-only dependencies)
- Deny-first: deny patterns checked before allow patterns
- Wildcard-aware: regex-cached `*` → `.*` expansion
- Server-safe: can be imported in both RSC and client components ✅

### 2.2 V2 Dashboard — SSR Layouts and Pages

All V2 dashboard layouts and pages that perform permission-gated redirects use `checkPermission(context.user.permissionSnapshot, SLUG)`:

| File                                          | Gate Slug                               | Result on Deny                                  |
| --------------------------------------------- | --------------------------------------- | ----------------------------------------------- |
| `dashboard/organization/layout.tsx`           | `MODULE_ORGANIZATION_MANAGEMENT_ACCESS` | `/dashboard/access-denied?reason=module_access` |
| `dashboard/organization/users/layout.tsx`     | `MEMBERS_READ \|\| BRANCH_ROLES_MANAGE` | `/dashboard/access-denied?reason=permission`    |
| `dashboard/organization/users/roles/page.tsx` | `MEMBERS_MANAGE`                        | Access denied page                              |

No V2 dashboard file imports the legacy `loadUserContextServer` loader. ✅

### 2.3 V2 Sidebar Resolution

`src/lib/sidebar/v2/resolver.ts`:

- Uses `checkPermission(permissionSnapshot, permission)` for both AND (`requiresPermissions`) and OR (`requiresAnyPermissions`) gates ✅
- Fail-closed for entitlements: returns `false` if `entitlements` is null ✅
- Pure/deterministic function — no side effects ✅

`src/server/loaders/v2/load-dashboard-context.v2.ts`:

- Uses `checkPermission(permissionSnapshot, BRANCHES_VIEW_ANY)` for accessible-branch computation ✅

### 2.4 Organization Server Actions

All 6 organization server action files call the full V2 context check pattern:

1. `loadDashboardContextV2()` → returns `DashboardContextV2` with live permission snapshot
2. `context.user.permissionSnapshot` passed to `checkPermission(snapshot, MODULE_ORGANIZATION_MANAGEMENT_ACCESS)`
3. Returns `{ success: false, error: "Module access denied" }` on failure (fail-closed) ✅

Specific files verified: `profile.ts`, `members.ts`, `invitations.ts`, `roles.ts`, `branches.ts`, `positions.ts`.

### 2.5 Warehouse Transfer Actions — PERMISSION GATES COMMENTED OUT (P1)

In warehouse transfer-related server actions, permission checks are present but **commented out**:

```typescript
// await checkPermission(context.user.permissionSnapshot, WAREHOUSE_TRANSFERS_CREATE);
```

These commented-out gates mean warehouse transfer operations are currently accessible to any authenticated org member with warehouse module entitlement, regardless of granular permissions.

**Affected operations:** transfer request creation, approval, or mutation (exact files not enumerated in this pass).

### 2.6 DB RPC Gate — `checkOrgPermissionExact`

`src/app/actions/v2/permissions.ts:checkOrgPermissionExact`:

- Delegates to `PermissionServiceV2.currentUserHasPermission` → `has_permission(org_id, slug)` DB RPC
- **Exact string match only** — does NOT expand wildcards
- Correctly renamed from `checkPermission` to prevent confusion with the wildcard utility
- All 4 RPC gate slugs verified non-wildcard: `branches.view.any`, `branches.view.update.any`, `branches.view.remove.any`, `module.organization-management.access` ✅

### 2.7 RLS Policy Slug Inventory

All 10 permission slugs used in RLS policy expressions confirmed non-wildcard (verified 2026-03-04 via `regexp_matches` on `pg_policies`):

```
members.read          members.manage        branch.roles.manage
branches.create       branches.delete       branches.update
invites.create        invites.read          invites.cancel
org.update
```

No wildcard in any RLS slug. ✅

---

## 3. Phase 3: DB RLS Coverage Audit

### 3.1 Core Permission System Tables — RLS Enabled + Correct Isolation ✅

| Table                        | RLS | Tenant Boundary                                            |
| ---------------------------- | --- | ---------------------------------------------------------- |
| `user_effective_permissions` | ✅  | `organization_id` + `user_id = auth.uid()`                 |
| `user_role_assignments`      | ✅  | `is_org_member` + `has_permission`/`has_branch_permission` |
| `user_permission_overrides`  | ✅  | `is_org_member` + `has_permission`                         |
| `organization_members`       | ✅  | `is_org_member` + `has_permission`                         |
| `branches`                   | ✅  | `is_org_member` + specific branch slugs                    |
| `roles`                      | ✅  | `is_org_member` for reads                                  |
| `permissions`                | ✅  | Global reference data — read-only for all authenticated    |
| `role_permissions`           | ✅  | Protected by `members.manage`                              |
| `org_positions`              | ✅  | `is_org_member` + `org.update`                             |
| `org_profiles`               | ✅  | `is_org_member` + `org.update`                             |
| `invitations`                | ✅  | `is_org_member` + specific invite slugs                    |
| `admin_entitlements`         | ✅  | Service role only                                          |
| `organization_entitlements`  | ✅  | Service role only                                          |

### 3.2 Tables with RLS Enabled but BROKEN Tenant Isolation — P0 CRITICAL

| Table               | Issue                                                       | Impact                                                                      |
| ------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------- |
| `contacts`          | RLS enabled; all policies have `qual: true` (unconditional) | Any authenticated user can read/write ALL contacts across ALL organizations |
| `contact_addresses` | Same — `qual: true` / `with_check: true`                    | Any authenticated user can read/write ALL contact addresses                 |

These tables have `rowsecurity = true` in `pg_class` but the policy expressions evaluate unconditionally. This creates a false sense of security (RLS is "on") while providing zero tenant isolation.

### 3.3 Tables with `organization_id` Column but RLS DISABLED — P1 HIGH

The following 20 tables contain an `organization_id` column (implying multi-tenant data) but have no RLS enforcement. Any authenticated user can read and write all rows across all organizations:

**Warehouse/Inventory:**

- `locations`
- `products`
- `product_categories`
- `product_branch_settings`
- `stock_movements`
- `stock_reservations`
- `purchase_orders`
- `sales_orders`
- `transfer_requests`
- `price_lists`
- `label_batches`
- `label_templates`

**Communication/Activity:**

- `activities`
- `news_posts`
- `chats`
- `chat_participants`
- `messages`
- `message_status`

**Business:**

- `business_accounts`
- `contact_custom_field_definitions`

**Note:** These tables rely entirely on application-layer security (server actions + RLS on permission tables). If an attacker bypasses server actions (e.g., via direct Supabase client with valid JWT), they can access all rows. The severity depends on whether `anon` key access is exposed client-side to these tables.

### 3.4 Additional RLS Concerns

#### `label_batches_extended` (view)

- RLS enabled; UPDATE policy uses a legacy role name string check rather than `has_permission` DB function
- Does not participate in the V2 permission system — consistency concern

#### `organizations` table

- RLS enabled for INSERT/UPDATE but SELECT policy status warrants verification
- Members should only see their own organization row

### 3.5 Tables Without `organization_id` (Global) — Appropriate

| Table                | Notes                                         |
| -------------------- | --------------------------------------------- |
| `users`              | Own-row access via `user_id = auth.uid()` ✅  |
| `permissions`        | Global reference — authenticated read-only ✅ |
| `admin_entitlements` | Service role only ✅                          |

---

## 4. Phase 4: UEP Index Verification

### 4.1 Current Index Inventory

| Index Name                             | Columns                                                  | Type   |
| -------------------------------------- | -------------------------------------------------------- | ------ |
| `user_effective_permissions_pkey`      | `id`                                                     | PK     |
| `user_effective_permissions_unique_v2` | `(user_id, organization_id, permission_slug, branch_id)` | UNIQUE |
| `idx_uep_user_org`                     | `(user_id, organization_id)`                             | B-tree |
| `idx_uep_user_org_branch`              | `(user_id, organization_id, branch_id)`                  | B-tree |
| `idx_uep_user_org_permission`          | `(user_id, organization_id, permission_slug)`            | B-tree |
| `idx_uep_permission`                   | `(permission_slug)`                                      | B-tree |

Confirmed removed: ~~`user_permission_overrides_uniq`~~ (migration `20260304110000`) ✅
Active unique: `user_permission_overrides_unique_active` ✅

### 4.2 Branch-Aware Snapshot Query Analysis

The canonical read pattern (used by `PermissionServiceV2.getPermissionSnapshotForUser`):

```sql
SELECT permission_slug, branch_id
FROM user_effective_permissions
WHERE user_id = $1
  AND organization_id = $2
  AND (branch_id IS NULL OR branch_id = $3)
```

**Index coverage analysis:**

- `idx_uep_user_org_branch` on `(user_id, organization_id, branch_id)` is the best candidate for the `AND branch_id = $3` arm
- For the `branch_id IS NULL` arm, PostgreSQL uses a separate range scan and combines via bitmap OR
- `user_effective_permissions_unique_v2` on `(user_id, organization_id, permission_slug, branch_id)` covers all 4 projected columns — enables index-only scans for the full query if statistics allow

**Verdict:** Adequate for current scale (31 UEP rows). Query planner will use `idx_uep_user_org_branch` or the unique index for bitmap OR execution. No blocking performance issue.

**P2 Optimization opportunity:** A partial index on `(user_id, organization_id, permission_slug) WHERE branch_id IS NULL` would allow a pure index scan for the most common case (org-scope rows), avoiding the OR-branch bitmap operation. Recommended when UEP grows beyond ~10,000 rows per org.

### 4.3 DB Audit Function Status

`audit_rls_permission_gate_slugs()`:

- Migration file: `supabase/migrations/20260304120000_add_audit_rls_permission_gate_slugs_fn.sql` — exists **locally only**
- Status in live DB: **NOT APPLIED** (confirmed via `\df audit_rls*`)
- Impact: The DB integration test `rls-wildcard-db-invariant.test.ts` will skip (env vars required); no live DB audit coverage for RLS slug wildcard invariant
- This is a **P1 operational gap** — the contract test covers it statically, but live DB verification is absent

---

## 5. Risk Classification

### P0 — Critical (Immediate Action Required)

| ID   | Finding                                                                                           | Location                      | Impact                                                  |
| ---- | ------------------------------------------------------------------------------------------------- | ----------------------------- | ------------------------------------------------------- |
| P0-1 | `contacts` table: RLS enabled but policies are unconditional (`qual: true`) — no tenant isolation | DB: `contacts` table          | Cross-org contact data leak for all authenticated users |
| P0-2 | `contact_addresses` table: same broken RLS pattern                                                | DB: `contact_addresses` table | Cross-org address data leak for all authenticated users |

### P1 — High (Address in Next Sprint)

| ID   | Finding                                                                               | Location                                      | Impact                                                                                    |
| ---- | ------------------------------------------------------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------- |
| P1-1 | 20 tenant-scoped tables have RLS completely disabled                                  | DB: warehouse/business tables (see §3.3)      | Any JWT holder can read/write all org data in these tables via direct Supabase client     |
| P1-2 | Warehouse transfer action permission gates are commented out                          | `src/app/actions/warehouse/` (transfer files) | Any org member with warehouse entitlement can create/approve transfers regardless of role |
| P1-3 | `audit_rls_permission_gate_slugs()` DB function not applied to live DB                | `supabase/migrations/20260304120000_*`        | No live DB coverage for RLS wildcard invariant test; monitoring gap                       |
| P1-4 | `src/lib/auth/permissions.ts` V1 URA-join function — dead code but violates invariant | `src/lib/auth/permissions.ts`                 | If accidentally imported, silently produces stale, non-UEP-based permissions              |

### P2 — Medium (Backlog)

| ID   | Finding                                                                                         | Location                                  | Impact                                                                          |
| ---- | ----------------------------------------------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------- |
| P2-1 | `uploadLogo.ts` and `updateProfile.ts` use `getSession()` without `getUser()`                   | `src/modules/organization-managment/api/` | Mutations can proceed with stale/unvalidated session token                      |
| P2-2 | `load-user-context-server.ts` V1 loader reachable from `header-auth.tsx` and `PublicHeader.tsx` | `src/components/`                         | `getSession()`-only on public-facing components; low impact (display data only) |
| P2-3 | UEP lacks optimized partial index for `branch_id IS NULL` scan                                  | DB: `user_effective_permissions`          | Minor query planner inefficiency at large scale; no current impact              |
| P2-4 | `label_batches_extended` UPDATE policy uses legacy role name string check                       | DB                                        | Inconsistency with V2 permission system; not a bypass                           |

---

## 6. Recommended Actions

### Immediate (P0)

1. **Fix `contacts` and `contact_addresses` RLS policies:** Replace the unconditional policies with `organization_id` isolation using `is_org_member(organization_id)` or equivalent. Audit whether these tables should be joined to an `organization_id` via a relationship or have a direct column.

### Next Sprint (P1)

2. **Enable RLS on all 20 warehouse/business tables** (P1-1): For each table, add at minimum:

   ```sql
   ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;
   CREATE POLICY "<table>_tenant_select" ON <table>
     FOR SELECT USING (is_org_member(organization_id));
   -- Add INSERT/UPDATE/DELETE policies with appropriate permission checks
   ```

   Tables to prioritize by data sensitivity: `stock_movements`, `purchase_orders`, `sales_orders`, `messages`, `chats`, `products`.

3. **Re-enable warehouse transfer permission gates** (P1-2): Uncomment and activate the `checkPermission(snapshot, WAREHOUSE_*_SLUG)` guards in transfer server actions.

4. **Apply audit DB function migration** (P1-3): Apply `20260304120000_add_audit_rls_permission_gate_slugs_fn.sql` to the live Supabase project so the DB integration test can run and provide continuous monitoring.

5. **Delete `src/lib/auth/permissions.ts`** (P1-4): This V1 dead code file violates the compile-then-read invariant. Deleting it removes the risk of accidental re-import and makes the architectural invariant enforcement clear.

### Backlog (P2)

6. **Replace `getSession()` with `getUser()` in module API files** (P2-1): `uploadLogo.ts` and `updateProfile.ts` should call `supabase.auth.getUser()` and return an error if it fails before proceeding with mutations.

7. **Plan migration of V1 callers** (P2-2): `header-auth.tsx` and `PublicHeader.tsx` use `loadUserContextServer`. Plan migration to a minimal V2-compatible loader that uses `getUser()`. Not urgent since these paths don't make permission decisions.

8. **UEP partial index** (P2-3): Add when UEP row count grows:
   ```sql
   CREATE INDEX idx_uep_user_org_null_branch
   ON user_effective_permissions (user_id, organization_id, permission_slug)
   WHERE branch_id IS NULL;
   ```

---

## Appendix A: V2 Permission Pipeline — Verified Clean

```
User Request
    │
    ▼
loadDashboardContextV2()          ← cache() deduped per request
    ├── loadAppContextV2()         ← org/branch resolution (getSession for cookie)
    └── loadUserContextV2(orgId, branchId)
            ├── getUser()          ← JWT-validated (server-to-server)
            ├── getSession()       ← access_token only (JWT role extraction)
            └── PermissionServiceV2.getPermissionSnapshotForUser()
                    └── SELECT FROM user_effective_permissions
                        WHERE user_id=$1 AND org_id=$2
                        AND (branch_id IS NULL OR branch_id=$3)
                        → PermissionSnapshot { allow: [...], deny: [...] }

Permission Enforcement
    ├── SSR layouts:    checkPermission(snapshot, SLUG) → redirect on false
    ├── Server actions: checkPermission(snapshot, SLUG) → { success: false } on false
    ├── Sidebar:        resolveSidebarModel() → prunes non-visible items
    └── DB RLS:         has_permission(org_id, slug) / has_branch_permission(...)
                        [exact match against UEP rows]

compile_user_permissions()         ← trigger on URA/UPO INSERT/UPDATE/DELETE
    └── Writes to user_effective_permissions (UEP)
        [Single source of truth for all permission reads]
```

## Appendix B: File Inventory

| File                                                      | V1/V2 | Status                             |
| --------------------------------------------------------- | ----- | ---------------------------------- |
| `src/lib/auth/permissions.ts`                             | V1    | Dead code — zero imports           |
| `src/lib/api/load-user-context-server.ts`                 | V1    | Active — only display-data callers |
| `src/lib/api/load-app-context-server.ts`                  | V1    | Active — V1 dashboard only         |
| `src/server/services/permission-v2.service.ts`            | V2    | Correct ✅                         |
| `src/lib/utils/permissions.ts`                            | V2    | Canonical utility ✅               |
| `src/app/actions/v2/permissions.ts`                       | V2    | Correct ✅                         |
| `src/server/loaders/v2/load-user-context.v2.ts`           | V2    | Correct ✅                         |
| `src/server/loaders/v2/load-dashboard-context.v2.ts`      | V2    | Correct ✅                         |
| `src/lib/sidebar/v2/resolver.ts`                          | V2    | Correct ✅                         |
| `src/modules/organization-managment/api/uploadLogo.ts`    | V1    | `getSession()` only — P2           |
| `src/modules/organization-managment/api/updateProfile.ts` | V1    | `getSession()` only — P2           |
