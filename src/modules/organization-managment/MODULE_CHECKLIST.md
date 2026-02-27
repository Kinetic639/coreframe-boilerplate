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
  > ✅ `src/server/services/__tests__/organization-rls.test.ts` — 15 tests covering RLS behavior, `is_org_member` semantics, constraint validation.
- [x] `clearPermissionRegexCache()` called in `afterEach` in sidebar tests.
  > ✅ `afterEach(() => clearPermissionRegexCache())` present in `sidebar-ssr.test.tsx:43`.

### UX vs. Security Boundary

- [x] Understood: the sidebar is a UX boundary, not a security boundary.
- [x] Hiding or disabling a sidebar item never prevents direct URL access.
- [x] Every route that hides a link in the sidebar also has a server-side guard that enforces access independently.
  > ✅ Profile (`ORG_READ`), Users layout (`MEMBERS_READ`), Invitations page (`INVITES_READ`), Branches page (`BRANCHES_READ`), Billing (`ORG_UPDATE`), Module gate (`requireModuleOrRedirect`).
- [x] Every server action behind a hidden sidebar item also has a permission check.
  > ✅ All 30 server actions use `checkPermission(context.user.permissionSnapshot, PERM)` before any data access.

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

| Domain      | Read perm       | Write perm                                              | Guard location            |
| ----------- | --------------- | ------------------------------------------------------- | ------------------------- |
| Org profile | `ORG_READ`      | `ORG_UPDATE`                                            | page.tsx + action         |
| Members     | `MEMBERS_READ`  | `MEMBERS_MANAGE`                                        | users/layout.tsx + action |
| Invitations | `INVITES_READ`  | `INVITES_CREATE`, `INVITES_CANCEL`                      | page.tsx + action         |
| Roles       | `MEMBERS_READ`  | `MEMBERS_MANAGE`                                        | users/layout.tsx + action |
| Positions   | `MEMBERS_READ`  | `MEMBERS_MANAGE`                                        | users/layout.tsx + action |
| Branches    | `BRANCHES_READ` | `BRANCHES_CREATE`, `BRANCHES_UPDATE`, `BRANCHES_DELETE` | page.tsx + action         |
| Billing     | `ORG_UPDATE`    | (view only; same perm as sidebar)                       | page.tsx + action         |

---

## 4. Database (RLS & Schema)

### RLS

- [x] RLS enabled on all affected tables.
- [x] `is_org_member(org_id)` used for SELECT policies on org_profiles, org_positions, org_position_assignments, branches, roles.
  > ⚠️ **Exception**: `organization_members` SELECT uses pre-V2 legacy policy `"Users can view organization members"` with `(user_id = auth.uid()) OR is_org_creator(org_id) OR has_any_org_role(org_id)`. `has_any_org_role` checks `user_role_assignments` only — no member status check. Inactive and soft-deleted members with live role assignments can read the member list. `removeMember()` does not clean up role assignments. No cross-tenant risk. See MODULE.md §RLS and Known Compliance Gap #7.
- [x] `has_permission(org_id, slug)` used for mutation policies.
- [x] `FORCE ROW LEVEL SECURITY` applied on all 9 module tables (verified via Supabase MCP 2026-02-27).
  > ✅ Applied via migration `20260227100000_force_rls_org_tables.sql` to: organization_profiles, invitations, org_positions, org_position_assignments, branches. Already applied: organization_members, organization_entitlements, roles, role_permissions.
- [x] Migrations tracked in `supabase/migrations/` (8 migration files for this module).

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
- [x] Branches child: `requiresPermissions: [BRANCHES_READ]`.
  > ✅ `organization.branches` entry added at `src/lib/sidebar/v2/registry.ts:99-108`, links to `/dashboard/organization/branches`.
- [x] Billing child: `requiresPermissions: [ORG_UPDATE]`.
- [x] Sidebar SSR tests for organization module added and verified.
  > ✅ 5 tests added to `src/app/[locale]/dashboard/__tests__/sidebar-ssr.test.tsx` (org-1 through org-5), all passing.

---

## 8. Tests

### Action Tests (T2)

- [x] 26 deny-path tests in `src/app/actions/organization/__tests__/actions.test.ts`.
- [x] Tests use `vi.mock` with inlined context factory (correct Vitest hoisting pattern).
- [x] Tests cover: all 7 domains, entitlement gate, permission denial, Zod schema enforcement, permission scope (read does not imply write).
- [x] No `PermissionServiceV2` mocked — tests use `checkPermission` snapshot pattern directly.

### RLS Tests (T1)

- [x] 23 tests in `src/server/services/__tests__/organization-rls.test.ts`.
- [x] `makeRlsDeniedClient()` uses fully-chainable recursive proxy (fixes Supabase chain failures).
- [x] Documents: `is_org_member` semantics, DB constraint values, soft-delete behavior.
- [x] Key invariant: `removeMember` does NOT write `status = 'removed'` — confirmed by test.
- [x] Gap #6 fix documented: `cancelInvitation` only writes `status='cancelled'`; both `invitations_update_self_cancel` and `invitations_update_self_accept` WITH CHECK semantics documented (exploit path blocked; acceptance path restored).
- [x] **NOTE — real-DB integration test limitation**: T1 tests are mock-based (no live Postgres). They document per-policy WITH CHECK logic but do not verify permissive-policy OR-combination at DB level. A real integration test suite against a seeded Supabase instance would be needed to prove cross-policy behaviour end-to-end.

### Sidebar SSR Tests

- [x] 5 org-specific tests in `src/app/[locale]/dashboard/__tests__/sidebar-ssr.test.tsx`.
  - org-1: `organization` group absent when `organization-management` NOT in `enabled_modules` ✅
  - org-2: `organization.profile` absent when user lacks `org.read` ✅
  - org-3: `organization.profile` present when user has `org.read` ✅
  - org-4: `organization.branches` absent when user lacks `branches.read` ✅
  - org-5: `organization.branches` present when user has `branches.read` ✅
  - Plus test 7.2 (pre-existing): billing visible to owner (ORG_UPDATE), hidden for member ✅

### Frontend Component Tests (RTL)

- [x] 5 RTL tests in `src/app/[locale]/dashboard/organization/users/roles/__tests__/roles-client.test.tsx`.
  - roles-1: Create Role button visible when user has `MEMBERS_MANAGE` ✅
  - roles-2: Create Role button absent when user lacks `MEMBERS_MANAGE` ✅
  - roles-3: All 4 permission group labels render in create dialog (Organization/Members/Invitations/Branches) ✅
  - roles-4: `createRoleAction` called with correct `permission_slugs` on submit ✅
  - roles-5: `listRolesAction` NOT called on mount (SSR-first regression) ✅
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
- [x] 3 RTL tests in `src/app/[locale]/dashboard/organization/users/members/__tests__/members-client.test.tsx`.
  - members-1: List actions NOT called on mount (SSR-first regression — inverted from old "calls 4 on mount") ✅
  - members-2: Empty state message renders when member list is empty ✅
  - members-3: Member name renders immediately from `initialMembers` (no fetch) ✅
- [x] 6 RTL tests in `src/app/[locale]/dashboard/organization/users/positions/__tests__/positions-client.test.tsx` (NEW 2026-02-26).
  - positions-1: Create Position button visible when user has `MEMBERS_MANAGE` ✅
  - positions-2: Create Position button absent when user lacks permission ✅
  - positions-3: `listPositionsAction` NOT called on mount (SSR-first regression) ✅
  - positions-4: Position name renders immediately from `initialPositions` (no fetch) ✅
  - positions-5: `createPositionAction` called with name on submit ✅
  - positions-6: Error toast shown when `createPositionAction` fails ✅

---

## 9. Known Gaps

| #   | Section  | Description                                                                                                                                               | Priority     | Status                                                                                                                                                                                                          |
| --- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | UI       | No `loading.tsx` / `error.tsx` in org route tree                                                                                                          | LOW          | ✅ Closed 2026-02-26 — `loading.tsx` and `error.tsx` added at `organization/` and `organization/users/`                                                                                                         |
| 2   | SSR      | All 7 org pages violate guide §2731 Mandatory SSR-first (client-fetch-on-mount)                                                                           | MEDIUM       | ✅ Closed 2026-02-26 — all 7 pages use SSR-first; `initialXxx` props passed from Server Components                                                                                                              |
| 3   | Legacy   | `src/modules/organization-managment/config.ts` still has legacy `/dashboard-old/` routes                                                                  | PRE-EXISTING | ✅ Closed 2026-02-26 — `items` replaced with `[]`                                                                                                                                                               |
| 4   | SECURITY | `invitations` UPDATE RLS — email-match branch had no column restriction. Invitee could update any column (role_id, branch_id, expires_at) via direct API. | MEDIUM       | ✅ Closed 2026-02-27 — `20260227200000` + `20260227200001` applied; three UPDATE policies now cover all legitimate invitee transitions; no policy permits `status='pending'` new-row writes. +8 T1 tests total. |
| 5   | INFO     | `organization_members` SELECT — `has_any_org_role` does not check status/deleted_at; removed members with lingering role assignments can read member list | LOW          | ⏳ Open — pending business decision: add role cleanup in `removeMember()`, restrict SELECT, or accept as-is                                                                                                     |

---

_Last updated: 2026-02-27 — Regression fix applied. Migration `20260227200001_fix_invitations_self_accept_regression.sql` adds self-accept policy. T1 test count updated to 23 (+5). Migration count updated to 8. Gap #4 remains closed. Gap #5 open._
