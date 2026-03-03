# MODULE_IMPLEMENTATION_CHECKLIST.md — `organization-management`

> **Filled in** for the `organization-management` module (V2 implementation, 2026-02-26).
> This module was implemented to current V2 standards from scratch.
>
> This checklist encodes the invariants of the Coreframe V2 architecture:
> SSR-First · TDD-First · Security-First · Compiled permissions · Compiled entitlements · Sidebar V2

---

## 1. Purpose & Non-Negotiables

### SSR-First Invariants

- [x] Server Components are authoritative. They compute data, authorization, and sidebar model before the page renders.
  > ✅ **REMEDIATED** (SSR-first pass 2026-02-26): All 7 org pages converted to async Server Components. Each calls `createClient()` + relevant `OrgXxxService` methods, passes results as `initialXxx` props. Client Components receive SSR data, no `useEffect` mount-fetch. All 8 client components updated.
- [x] Client Components are dumb renderers. They accept pre-computed props. They do not re-evaluate permissions.
  > ✅ `canEdit` flag computed server-side in `profile/page.tsx` via `checkPermission(context.user.permissionSnapshot, ORG_UPDATE)`. Client components use `usePermissions()` for additional fine-grained checks (manage vs read-only).
- [x] The dashboard layout loads the authoritative context once (via `loadDashboardContextV2()`), not repeated per page.
  > ✅ `React.cache()`-wrapped — deduplicated per request. Users layout + individual pages each call it; only one DB round-trip per request.
- [x] `buildSidebarModel()` runs server-side.
- [x] `React.cache()` provides per-request memoization — never a global singleton cache.
- [x] No `createClient()` / Supabase client instantiation in Client Components for org-scoped data.
  > ✅ All data mutations go through server actions (`src/app/actions/organization/`). Verified: `organization.service.ts` has 0 `createClient()` calls (injected pattern). Loaders and entitlements guard use `React.cache()`-wrapped `createClient()` — server-side only.

### TDD-First Invariants

- [x] Tests are written alongside (or before) the implementation.
  > ✅ T1 and T2 tests written in the same session as implementation, after audit approval.
- [x] Every access-control decision has at least one negative test (prove it fails closed).
  > ✅ `src/app/actions/organization/__tests__/actions.test.ts` — 26 tests, all covering deny-path (no permissions → `{ success: false, error: "Unauthorized" }`).
- [x] Sidebar integration tests use `buildSidebarModelUncached`.
  > ✅ `src/app/[locale]/dashboard/__tests__/sidebar-ssr.test.tsx` — 5 org-specific tests added (org-1 through org-5, verified 2026-02-26). Tests: module absent when not entitled, profile absent/present by ORG_READ, branches absent/present by BRANCHES_READ, billing hidden for non-owner.
- [x] RLS tests run against real Postgres, not mocked clients.
  > ⚠️ **T1 tests are mock-based**: `src/server/services/__tests__/organization-rls.test.ts` — 23 tests using `makeRlsDeniedClient()` / `makeRlsEmptyClient()`. Verifies service error propagation and DB constraint compliance but does NOT connect to real Postgres.
  > ✅ **T-RLS real-DB tests**: `src/server/services/__tests__/organization-rls-integration.test.ts` — 4 integration tests that connect to the actual Supabase project (skipped when env vars absent). Covers P1-A SELECT policy and P1-B stale-role fix at real Postgres level.
- [x] `clearPermissionRegexCache()` called in `afterEach` in sidebar tests.
  > ✅ `afterEach(() => clearPermissionRegexCache())` present in `sidebar-ssr.test.tsx:43`.

### UX vs. Security Boundary

- [x] Understood: the sidebar is a UX boundary, not a security boundary.
- [x] Hiding or disabling a sidebar item never prevents direct URL access.
- [x] Every route that hides a link in the sidebar also has a server-side guard that enforces access independently.
  > ✅ Profile (`ORG_READ`), Users layout (`MEMBERS_READ OR BRANCH_ROLES_MANAGE`), Members page (`MEMBERS_READ`), Invitations page (`INVITES_READ`), Roles page (`MEMBERS_READ`), Branch Access page (`MEMBERS_READ OR BRANCH_ROLES_MANAGE`), Branches page (`BRANCHES_READ`), Billing (`ORG_UPDATE`), Module gate (`requireModuleOrRedirect`).
  > ✅ All deny paths (Phase 4) redirect to `/dashboard/access-denied?reason=<slug>` — no silent redirect to `/dashboard/start`.
- [x] Every server action behind a hidden sidebar item also has a permission check.
  > ✅ All 31 server actions use `checkPermission(context.user.permissionSnapshot, PERM)` before any data access.

### Fail-Closed Principles

- [x] If `organization_entitlements` is missing, module access check throws (EntitlementError → redirect to `/upgrade`).
- [x] If permission snapshot has no matching permission, access is denied.
- [x] Permission checks use deny-first semantics (deny entries override allow, wildcards respected).
- [x] RLS policies are final boundary — server actions cannot bypass.

### No Raw Strings Rule

- [x] TypeScript code never contains raw permission strings — all constants from `src/lib/constants/permissions.ts`.
  > ✅ Full sweep completed 2026-02-26 (architecture pass). Fixed files: `roles-client.tsx`, `branches-client.tsx`, `users/branches/branches-client.tsx`, `positions-client.tsx`, `members-client.tsx`, `invitations-client.tsx`.
  > Grep evidence: `can\("(org|members|invites|branches)\.` in `src/app/[locale]/dashboard/organization/**/*.tsx` → **0 matches**.
- [x] TypeScript code never contains raw module strings — `MODULE_ORGANIZATION_MANAGEMENT` from `src/lib/constants/modules.ts`.

---

## 2. Entitlements System

### Module Access

- [x] Module slug matches `organization_entitlements.enabled_modules` value exactly: `"organization-management"`.
- [x] Module slug matches constant `MODULE_ORGANIZATION_MANAGEMENT` in `src/lib/constants/modules.ts`.
- [x] `entitlements.requireModuleOrRedirect(MODULE_ORGANIZATION_MANAGEMENT)` used in layout.
  > ✅ `src/app/[locale]/dashboard/organization/layout.tsx`
- [x] All server actions call `entitlements.requireModuleAccess(MODULE_ORGANIZATION_MANAGEMENT)`.
  > ✅ All 7 action files, every exported action function.
- [x] Sidebar item has `requiresModules: [MODULE_ORGANIZATION_MANAGEMENT]`.

### Plan/Feature Gates

- [x] No per-feature gates beyond module-level — billing page uses permission check (`ORG_UPDATE`) not a separate feature entitlement. Page guard aligned with sidebar + action (fixed 2026-02-26; was incorrectly `ORG_READ`).

---

## 3. Permission System

### V2 Guard Pattern

- [x] Server actions use synchronous `checkPermission(context.user.permissionSnapshot, PERM)`.
- [x] No `PermissionServiceV2.currentUserHasPermission()` calls (async DB calls) in any action.
- [x] Context loaded via `loadDashboardContextV2()` — `permissionSnapshot` pre-compiled, `React.cache()` deduplicated.
- [x] Server pages use `checkPermission(context.user.permissionSnapshot, PERM)` for redirect guards.
- [x] Client components use `usePermissions()` hook for UI-only guards (buttons, menus).

### Audit (Pre-Implementation)

- [x] **Audit Fix A** applied: replaced all `PermissionServiceV2.currentUserHasPermission()` calls with `checkPermission(snapshot, PERM)` across 7 action files (30 occurrences).
- [x] **Audit Fix B** applied: `updateMemberStatus` status type changed `"active"|"suspended"` → `"active"|"inactive"` to match DB CHECK constraint. `removeMember` no longer sets `status = "removed"` (invalid value).
- [x] **Audit Fix C** applied: removed dead `import type { Database }` from `organization.service.ts`.
- [x] **Audit Fix D** applied (post-commit audit): `roles-client.tsx` PERMISSION_GROUPS raw strings replaced with imported constants from `src/lib/constants/permissions`.

### Permission Coverage

| Domain        | Read perm                               | Write perm                                              | Guard location                 |
| ------------- | --------------------------------------- | ------------------------------------------------------- | ------------------------------ |
| Org profile   | `ORG_READ`                              | `ORG_UPDATE`                                            | page.tsx + action              |
| Members       | `MEMBERS_READ`                          | `MEMBERS_MANAGE`                                        | layout.tsx + page.tsx + action |
| Invitations   | `INVITES_READ`                          | `INVITES_CREATE`, `INVITES_CANCEL`                      | page.tsx + action              |
| Roles         | `MEMBERS_READ`                          | `MEMBERS_MANAGE`                                        | page.tsx + action              |
| Branch Access | `MEMBERS_READ` OR `BRANCH_ROLES_MANAGE` | `BRANCH_ROLES_MANAGE` (branch-scoped only)              | page.tsx + action (dual-gate)  |
| Positions     | `MEMBERS_READ`                          | `MEMBERS_MANAGE`                                        | layout.tsx + action            |
| Branches      | `BRANCHES_READ`                         | `BRANCHES_CREATE`, `BRANCHES_UPDATE`, `BRANCHES_DELETE` | page.tsx + action              |
| Billing       | `ORG_UPDATE`                            | (view only; same perm as sidebar)                       | page.tsx + action              |

---

## 4. Database (RLS & Schema)

### RLS

- [x] RLS enabled on all affected tables.
- [x] `is_org_member(org_id)` used for SELECT policies on org_profiles, org_positions, org_position_assignments, branches, roles.
  > ⚠️ **Exception**: `organization_members` SELECT uses pre-V2 legacy policy `"Users can view organization members"` with `(user_id = auth.uid()) OR is_org_creator(org_id) OR has_any_org_role(org_id)`. `has_any_org_role` checks `user_role_assignments` only — no member status check. See MODULE.md Known Compliance Gap #7.
  > ✅ **P1-A/P1-B mitigations applied (2026-02-27)**: `removeMember()` now soft-deletes `user_role_assignments` for the removed user (P1-B); `"V2 view org role assignments"` SELECT policy added on `user_role_assignments` requiring `members.read + is_org_member` (P1-A). See migration `20260227320000`.
- [x] `has_permission(org_id, slug)` used for mutation policies.
- [x] `FORCE ROW LEVEL SECURITY` applied on all org-management-related tables (see policy table in MODULE.md, verified via Supabase MCP 2026-02-27).
  > ✅ Applied via migration `20260227100000_force_rls_org_tables.sql` to: organization_profiles, invitations, org_positions, org_position_assignments, branches. Already applied: organization_members, organization_entitlements, roles, role_permissions.
- [x] Migrations tracked in `supabase/migrations/` (12 migration files for this module as of 2026-02-27).

### Schema Correctness

- [x] `organization_members.status` CHECK constraint: `ARRAY['active', 'inactive', 'pending']` only — confirmed no `'suspended'` or `'removed'`.
- [x] `inactive` status fully blocks RLS access (is_org_member returns false for inactive members).
- [x] Member removal only sets `deleted_at` — no status mutation (avoids constraint violation).
- [x] `is_basic = true` roles are immutable system roles — protected by permission check (`MEMBERS_MANAGE`) and UI guard.

### Soft Delete

- [x] `organization_members` uses soft delete (`deleted_at` column).
- [x] `org_positions` uses soft delete (`deleted_at` column).
- [x] Queries filter `deleted_at IS NULL` on all list operations.

### Storage

- [x] `org-logos` bucket created with public read, 5 MB limit, image MIME types.
- [x] Storage RLS: INSERT/UPDATE/DELETE require `is_org_member(org_id) AND has_permission(org_id, 'org.update')`.
- [x] Migration file: `supabase/migrations/20260226200001_create_org_logos_storage_bucket.sql`.

---

## 5. API Design

### Server Actions

- [x] All actions live in `src/app/actions/organization/` (one file per domain).
- [x] All actions are `"use server"` files.
- [x] All actions validate input with Zod before calling services.
- [x] All actions return `{ success: true, data: T } | { success: false, error: string }`.
- [x] No action throws to callers — all errors caught and returned as structured results.
- [x] No action bypasses RLS (all use `createClient()` — authenticated Supabase client only).
- [x] All 31 server actions (across 7 files) use `requireModuleAccess` + `checkPermission`.

### Service Layer

- [x] Services live in `src/server/services/organization.service.ts` (single flat file, no subdirectories).
- [x] Services are `"server-only"` — `import "server-only"` present at top of `organization.service.ts` (added 2026-02-27; compile-time enforcement via Next.js bundler).
- [x] Services return `ServiceResult<T>` — never throw to callers.
- [x] No service role bypass in service layer.

---

## 6. UI Standards

### Navigation

- [x] All routes registered in `src/i18n/routing.ts` with English + Polish locale paths.
- [x] Tab navigation uses `Link` from `@/i18n/navigation` (locale-aware).
- [x] Active tab detection uses `pathname.endsWith(href)` — exact suffix match prevents false positives if route names overlap.

### Components

- [x] Only shadcn/ui components used (Button, Input, Label, Card, Badge, Avatar, Dialog, Textarea, DropdownMenu, Checkbox, Select).
- [x] No custom UI components created that duplicate shadcn/ui functionality.
- [x] Toast notifications use `react-toastify` — no `sonner` imports.
- [x] Loading states: initial data from SSR props; `LoadingSkeleton` retained only for post-mutation re-sync if needed (all 8 client components have no mount-load skeleton).
- [x] Error states render inline with `AlertCircle` icon + message.
- [x] Empty states render inline with centered message.
- [x] Mutation buttons disabled during `isPending` state.

### Permission-Conditional Rendering

- [x] Edit buttons/forms hidden when `canManage`/`canEdit` is false.
- [x] Create/delete buttons gated on specific permissions (not all-or-nothing).
- [x] System roles (`is_basic = true`) display `Lock` icon and hide edit/delete buttons.

---

## 7. Sidebar V2

### Registry

- [x] Organization group registered in `src/lib/sidebar/v2/registry.ts`.
- [x] `requiresModules: [MODULE_ORGANIZATION_MANAGEMENT]` on parent group.
- [x] Profile child: `requiresPermissions: [ORG_READ]`.
- [x] Users child: `requiresPermissions: [MEMBERS_READ]`.
- [x] Branch Access child: `requiresAnyPermissions: [MEMBERS_READ, BRANCH_ROLES_MANAGE]` (OR logic — visible to branch managers too).
  > ✅ `organization.branch-access` entry added at `src/lib/sidebar/v2/registry.ts`, links to `/dashboard/organization/users/branch-access`.
- [x] Branches child: `requiresPermissions: [BRANCHES_READ]`.
  > ✅ `organization.branches` entry added at `src/lib/sidebar/v2/registry.ts`, links to `/dashboard/organization/branches`.
- [x] Billing child: `requiresPermissions: [ORG_UPDATE]`.
- [x] Sidebar SSR tests for organization module added and verified.
  > ✅ 5 tests added to `src/app/[locale]/dashboard/__tests__/sidebar-ssr.test.tsx` (org-1 through org-5), all passing.

---

## 8. Tests

### Action Tests (T2)

- [x] 51 tests in `src/app/actions/organization/__tests__/actions.test.ts` — deny-path, G2 scope guards, branch manager allow/deny (BM), ORG_ONLY_SLUGS enforcement. New tests (Phase 3): `assignRoleToUserAction` BM allow (branch scope) + BM deny (org scope), `removeRoleFromUserAction` same, ORG_ONLY_SLUGS: members.read/manage/invites.create rejected for branch roles, branch.roles.manage allowed for branch roles.
- [x] **Phase 4 dual-gate**: `listRolesAction` (branch managers get only `scope_type='branch'` roles), `getUserRoleAssignmentsAction` (MEMBERS_READ OR BRANCH_ROLES_MANAGE), `getMemberAccessAction` (branch managers get only `scope='branch'` assignments).
- [x] **Phase 4 error normalization**: `normalizeDbError()` in `organization.service.ts` maps Postgres 42501 / row-level security errors to human-readable messages. Applied to `assignRoleToUser` + `removeRoleFromUser`.
- [x] **Phase 4 test fixes**: 3 stale test files fixed: `permissions.test.ts` (wrong mock target `PermissionServiceV2` → `PermissionService`), `app-store.test.ts` (`accessibleBranches` fixture populated for `setActiveBranch` tests), `load-dashboard-context.v2.test.ts` (`branches.view.any` added to fast-path tests to avoid `createClient()` outside request scope).
- [x] Tests use `vi.mock` with inlined context factory (correct Vitest hoisting pattern).
- [x] Tests cover: all 7 domains, entitlement gate, permission denial, Zod schema enforcement, permission scope (read does not imply write), G2 server-side branch role scope invariant.
- [x] No `PermissionServiceV2` mocked — tests use `checkPermission` snapshot pattern directly.

### RLS Tests (T1)

- [x] 23 tests in `src/server/services/__tests__/organization-rls.test.ts`.
- [x] `makeRlsDeniedClient()` uses fully-chainable recursive proxy (fixes Supabase chain failures).
- [x] Documents: `is_org_member` semantics, DB constraint values, soft-delete behavior.
- [x] Key invariant: `removeMember` does NOT write `status = 'removed'` — confirmed by test.
- [x] Gap #6 fix documented: `cancelInvitation` only writes `status='cancelled'`; both `invitations_update_self_cancel` and `invitations_update_self_accept` WITH CHECK semantics documented (exploit path blocked; acceptance path restored).
- [x] **Real-DB integration tests added (2026-02-27)**: `src/server/services/__tests__/organization-rls-integration.test.ts` — 4 T-RLS tests connecting to actual Supabase. Verifies P1-A SELECT policy (T-RLS-1 through T-RLS-3) and P1-B stale-role cleanup (T-RLS-4). Skipped gracefully when env vars absent (CI-safe). The T1 mock tests remain for service-layer unit coverage.
- [x] **RLS assertion client discipline enforced**: policy ALLOW/DENY assertions (T-RLS-1/2/3) use `RlsClient` (anon key + JWT sign-in) via `rlsQuery()` helper only. Service role (`SetupClient`) is restricted to setup/cleanup and DB-state verification (T-RLS-4). `assertIsRlsClient()` runtime guard throws if service-role key is accidentally passed to `rlsQuery()`.

### Sidebar SSR Tests

- [x] 5 org-specific tests in `src/app/[locale]/dashboard/__tests__/sidebar-ssr.test.tsx`.
  - org-1: `organization` group absent when `organization-management` NOT in `enabled_modules` ✅
  - org-2: `organization.profile` absent when user lacks `org.read` ✅
  - org-3: `organization.profile` present when user has `org.read` ✅
  - org-4: `organization.branches` absent when user lacks `branches.read` ✅
  - org-5: `organization.branches` present when user has `branches.read` ✅
  - Plus test 7.2 (pre-existing): billing visible to owner (ORG_UPDATE), hidden for member ✅

### Frontend Component Tests (RTL)

- [x] 16 RTL tests in `src/app/[locale]/dashboard/organization/users/roles/__tests__/roles-client.test.tsx`.
  - roles-1: Create Role button visible when user has `MEMBERS_MANAGE` ✅
  - roles-2: Create Role button absent when user lacks `MEMBERS_MANAGE` ✅
  - roles-3: Permission group labels render in create dialog for org scope (Organization/Members/Invitations/Branches; Branch Management group only visible in branch scope) ✅
  - roles-4: `createRoleAction` called with correct `permission_slugs` on submit ✅
  - roles-5: `listRolesAction` NOT called on mount (SSR-first regression) ✅
  - roles-6: Create dialog scope selector defaults to `org` ✅
  - roles-7: `createRoleAction` receives `scope_type: "branch"` when branch scope selected ✅
  - roles-8: Branch-scoped role shows `branch` badge in list ✅
  - roles-9: `both`-scoped role shows `both` badge in list ✅
  - roles-10: Edit dialog shows scope as read-only text, no combobox ✅
  - roles-11: Permission picker uses grid layout, no overflow scroll container ✅
  - roles-12: Switching to branch scope hides org-only permissions in create dialog ✅
  - roles-13: Switching scope back to org restores org-only permissions ✅
  - roles-14: **G1** — Edit dialog for branch-scoped role omits org-only permissions ✅
  - roles-15: **G3** — Edit dialog sanitizes: invalid org-only perm pre-checked on branch role is NOT checked ✅
  - roles-16: **G1** — Edit dialog for org-scoped role shows org-only permissions ✅
- [x] 4 RTL tests in `src/app/[locale]/dashboard/organization/branches/__tests__/branches-client.test.tsx`.
  - branches-1: Create Branch button visible when user has `BRANCHES_CREATE` ✅
  - branches-2: `createBranchAction` called with branch name on submit ✅
  - branches-3: `listBranchesAction` NOT called on mount (SSR-first regression) ✅
  - branches-4: Branch name renders immediately from `initialBranches` (no fetch) ✅
- [x] 4 RTL tests in `src/app/[locale]/dashboard/organization/users/invitations/__tests__/invitations-client.test.tsx`.
  - invitations-1: Invite button visible when user has `INVITES_CREATE` ✅
  - invitations-2: Invite button absent when user lacks `INVITES_CREATE` ✅
  - invitations-3: `listInvitationsAction` NOT called on mount (SSR-first regression) ✅
  - invitations-4: `createInvitationAction` called with email on submit ✅
- [x] 7 RTL tests in `src/app/[locale]/dashboard/organization/users/members/__tests__/members-client.test.tsx`.
  - members-1: List actions NOT called on mount (SSR-first regression) ✅
  - members-2: Empty state message renders when member list is empty ✅
  - members-3: Member name renders immediately from `initialMembers` (no fetch) ✅
  - members-4: View link per row links to member detail page (href contains userId) ✅
  - members-5: Branch-scoped role shows `branch` badge in Manage Roles dialog ✅
  - members-6: `both`-scoped role shows org/branch toggle when checked in dialog ✅
  - members-7: Branch multiselect appears when branch scope selected for `both` role ✅
- [x] 10 RTL tests in `src/app/[locale]/dashboard/organization/users/members/[memberId]/__tests__/member-detail-client.test.tsx`.
  - detail-1 through detail-10: member detail display, Info/Access tabs, role assignment with scope, remove assignment, SSR-first regression ✅
- [x] 6 RTL tests in `src/app/[locale]/dashboard/organization/users/positions/__tests__/positions-client.test.tsx` (NEW 2026-02-26).
  - positions-1: Create Position button visible when user has `MEMBERS_MANAGE` ✅
  - positions-2: Create Position button absent when user lacks permission ✅
  - positions-3: `listPositionsAction` NOT called on mount (SSR-first regression) ✅
  - positions-4: Position name renders immediately from `initialPositions` (no fetch) ✅
  - positions-5: `createPositionAction` called with name on submit ✅
  - positions-6: Error toast shown when `createPositionAction` fails ✅

---

## 9. Known Gaps

| #   | Section  | Description                                                                                                                                                             | Priority     | Status                                                                                                                                                                                                                                                  |
| --- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | UI       | No `loading.tsx` / `error.tsx` in org route tree                                                                                                                        | LOW          | ✅ Closed 2026-02-26 — `loading.tsx` and `error.tsx` added at `organization/` and `organization/users/`                                                                                                                                                 |
| 2   | SSR      | All 7 org pages violate guide §2731 Mandatory SSR-first (client-fetch-on-mount)                                                                                         | MEDIUM       | ✅ Closed 2026-02-26 — all 7 pages use SSR-first; `initialXxx` props passed from Server Components                                                                                                                                                      |
| 3   | Legacy   | `src/modules/organization-managment/config.ts` still has legacy `/dashboard-old/` routes                                                                                | PRE-EXISTING | ✅ Closed 2026-02-26 — `items` replaced with `[]`                                                                                                                                                                                                       |
| 4   | SECURITY | `invitations` UPDATE RLS — email-match branch had no column restriction. Invitee could update any column (role_id, branch_id, expires_at) via direct API.               | MEDIUM       | ✅ Closed 2026-02-27 — `20260227200000` + `20260227200001` applied; three UPDATE policies now cover all legitimate invitee transitions; no policy permits `status='pending'` new-row writes. +8 T1 tests total.                                         |
| 5   | INFO     | `organization_members` SELECT — `has_any_org_role` does not check status/deleted_at; removed members with lingering role assignments can read member list               | LOW          | ✅ Mitigated 2026-02-27 — P1-A + P1-B applied (see MODULE.md Gap #7). Legacy `has_any_org_role` SELECT on `organization_members` unchanged; `user_role_assignments` SELECT now gated by `members.read`; `removeMember()` soft-deletes role assignments. |
| 6   | INFO     | Invitation acceptance is a legacy client-side flow (`src/lib/api/invitations.ts`) that only updates `invitations.status` — does NOT insert into `organization_members`. | LOW          | ⏳ Open (P1-C, documented-only) — no fix needed until a V2 server-action invite acceptance flow is implemented. See MODULE.md Gap #8.                                                                                                                   |

---

### Permission Scope Filtering Invariant (added 2026-03-02)

- [x] **UI (create):** `PERMISSION_GROUPS.allowedScopes` metadata filters which permissions are shown when creating a role, based on selected `scope_type`.
- [x] **UI (edit):** Same `allowedScopes` filter applied to edit dialog, using the role's persisted `scope_type`. Branch-scoped roles cannot visually select org-only permissions.
- [x] **UI (openEdit sanitize):** `openEdit` strips any pre-existing `permission_slugs` that are invalid for the role's `scope_type` before populating the edit form. Stale/illegal data in `permission_slugs` is never shown as checked.
- [x] **Server (create):** `createRoleAction` rejects `branch`-scoped roles containing slugs in `ORG_ONLY_SLUGS`.
- [x] **Server (update):** `updateRoleAction` fetches `role.scope_type` before applying permissions; rejects if role is `branch`-scoped and any submitted slug is in `ORG_ONLY_SLUGS`. Guard runs before `OrgRolesService.updateRole`.
- [x] `ORG_ONLY_SLUGS` = `{ org.read, org.update, branches.create, branches.update, branches.delete, module.organization-management.access, members.read, members.manage, invites.read, invites.create, invites.cancel }` — defined once in `roles.ts`, used by both `createRoleAction` and `updateRoleAction`. `branch.roles.manage` is the only branch-assignable non-CRUD permission.
- [x] `assignRoleToUserAction` and `removeRoleFromUserAction` use dual-gate: allow if `MEMBERS_MANAGE` OR (`scope='branch'` AND `BRANCH_ROLES_MANAGE`). RLS is still the authoritative per-branch enforcement; action gate is a coarse allow.
- [x] `getMembersGroupedByBranch` added to `OrgMembersService` — derived grouping from `listMembers` result; no new table. Org-only members grouped as `branchId: null`; branch-assigned members grouped per branch.

---

_Last updated: 2026-03-03 — Phase 4 Enterprise UX Hardening: unified deny → `/dashboard/access-denied?reason=<slug>` (5 SSR guards); new `/organization/users/branch-access` route + `BranchAccessClient` + sidebar item (`requiresAnyPermissions`); `listRolesAction`/`getUserRoleAssignmentsAction`/`getMemberAccessAction` dual-gated; `normalizeDbError` helper; 3 stale tests fixed (permissions, app-store, load-dashboard-context)._
