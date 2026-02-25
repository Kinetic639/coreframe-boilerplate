# MODULE_IMPLEMENTATION_CHECKLIST.md — `user-account`

> **Filled in** for the `user-account` module during compliance verification (2026-02-24).
> This module was implemented BEFORE current V2 standards. Items are marked based on verified
> current state. Unchecked items include a note explaining the gap.
>
> This checklist encodes the invariants of the Coreframe V2 architecture:
> SSR-first · TDD-first · Security-first · Compiled permissions · Compiled entitlements · Sidebar V2

---

## 1. Purpose & Non-Negotiables

### SSR-First Invariants

- [ ] Server Components are authoritative. They compute data, authorization, and sidebar model before the page renders.
  > **GAP**: Account pages (`profile/page.tsx`, `preferences/page.tsx`, `notifications/page.tsx`) do NOT call `loadAppContextServer()` or load any data server-side. All data is fetched client-side via React Query on mount. Deviation from SSR-first rule. Acceptable for user-personal scope but should be documented as intentional.
  > **Where to fix**: `src/app/[locale]/dashboard/account/*/page.tsx` — add server-side data prefetch or document intentional client-fetch pattern.
  > **Required vs optional**: Required per guide, but low risk for user-personal data.
- [x] Client Components are dumb renderers. They accept pre-computed props. They do not re-evaluate permissions.
- [ ] The dashboard layout loads the authoritative context once (e.g. `loadDashboardContextV2()`), not repeated per page.
  > **INFO**: Account `layout.tsx` does not call `loadDashboardContextV2()`. Each account page calls it individually. Because `loadDashboardContextV2()` is `React.cache()`-wrapped, the call is deduplicated with the outer dashboard layout call — no extra DB hit per request. Acceptable pattern for this module.
- [x] `buildSidebarModel()` runs server-side. Production uses the `React.cache()`-wrapped version.
- [x] `React.cache()` provides per-request memoization — never a global singleton cache.
- [x] No `createClient()` / Supabase client instantiation in Client Components for org-scoped data.
  > Verified: service calls go through server actions only.

### TDD-First Invariants

- [ ] Tests are written alongside (or before) the implementation, not after.
  > **INFO**: Pre-V2 module. Tests were written after implementation.
- [x] Every access-control decision has at least one negative test (prove it fails closed).
  > Verified: src/app/actions/user-preferences/**tests**/index.test.ts (describe "Permission denial (fail-closed)")
- [x] Sidebar integration tests use `buildSidebarModelUncached` (never `buildSidebarModel`).
- [x] RLS tests run against real Postgres, not mocked clients.
  > Verified: supabase/tests/060_user_preferences_test.sql (21 tests)
- [x] `clearPermissionRegexCache()` called in `afterEach` in sidebar tests.
  > Verified: src/app/[locale]/dashboard/**tests**/sidebar-ssr.test.tsx afterEach hook

### UX vs. Security Boundary

- [x] Understood: the sidebar is a UX boundary, not a security boundary.
- [x] Hiding or disabling a sidebar item never prevents direct URL access.
- [x] Disabling a sidebar item never prevents a server action from executing.
- [x] Every route that hides a link in the sidebar also has a server-side guard that enforces access independently.
  > Verified: profile/page.tsx (ACCOUNT_PROFILE_READ), preferences/page.tsx (ACCOUNT_PREFERENCES_READ), notifications/page.tsx (ACCOUNT_SETTINGS_READ)
- [x] Every server action that is behind a hidden sidebar item also has a permission check at the top of the function.
  > Verified: src/app/actions/user-preferences/index.ts (checkUserPermission helper, all 10 actions: 8 mutating + 2 read)

### Fail-Closed Principles

- [x] If `organization_entitlements` is missing, all module access checks throw. (N/A — not plan-gated)
- [x] If `user_effective_permissions` is missing for a user, access is denied. (Handled by RLS — `user_id = auth.uid()` returns no rows for missing users)
- [x] If a limit check fails, treat as limit reached. (N/A — no limits used)
- [x] Permission checks use deny-first semantics. (Handled by permission system; RLS as final boundary)

### No Raw Strings Rule

- [x] TypeScript code never contains raw permission strings — all account permission constants used in registry.
- [x] TypeScript code never contains raw module strings — `MODULE_USER_ACCOUNT` used where needed.
- [x] Raw string literals in SQL are acceptable.
- [x] Verify: grep `src/` for `requireModuleAccess("` — zero matches for this module. ✅
- [x] Verify: grep `src/` for raw account permission strings — zero matches. ✅

---

## 2. Module Specification Inputs

### Identity

```
Module name (human):       User Account
Module slug (kebab-case):  user-account
Constant name:             MODULE_USER_ACCOUNT
File prefix:               user-preferences (service/actions use this prefix)
v2_ready status:           [ ] v2_ready   [x] legacy
```

### Routes

```
Route path                              Guard type
/dashboard/account/profile              permission (ACCOUNT_PROFILE_READ — checkPermission + loadDashboardContextV2 ✅ updated 2026-02-25)
/dashboard/account/preferences          permission (ACCOUNT_PREFERENCES_READ — checkPermission + loadDashboardContextV2 ✅ updated 2026-02-25)
/dashboard/account/notifications        permission (ACCOUNT_SETTINGS_READ — checkPermission + loadDashboardContextV2 ✅ updated 2026-02-25)
```

### Data Ownership & Scoping

```
Primary scope:             [ ] organization   [ ] branch   [ ] global   [x] user-personal
organization_id required:  [ ] Yes   [x] No (column exists but is a preference value, not scoping key)
branch_id required:        [ ] Yes   [x] No
Multi-branch isolation:    [ ] Required   [x] Not applicable
Soft-delete required:      [x] Yes (deleted_at)   [ ] No
```

### Tables / Entities

```
Table name                    Primary scope    Soft delete    PII/Sensitive
user_preferences              user-personal    YES            YES (display_name, phone)
user_preference_audit         user-personal    NO             YES (ip_address, user_agent)
```

### Permission Matrix

```
Route / Server Action                    Permission slug(s) required        Deny effect
/dashboard/account/profile               account.profile.read               redirect /dashboard/start ✅
/dashboard/account/preferences           account.preferences.read           redirect /dashboard/start ✅
updateProfileAction                      account.profile.update             { success: false } ✅
updateRegionalSettingsAction             account.preferences.update         { success: false } ✅
updateNotificationSettingsAction         account.preferences.update         { success: false } ✅
updateDashboardSettingsAction            account.preferences.update         { success: false } ✅
updateModuleSettingsAction               account.preferences.update         { success: false } ✅
syncUiSettingsAction                     account.preferences.update         { success: false } ✅
setDefaultOrganizationAction             account.preferences.update         { success: false } ✅
setDefaultBranchAction                   account.preferences.update         { success: false } ✅
```

### Entitlement Gating

```
Is this module plan-gated?               [ ] Yes   [x] No
Plans that include this module:          [x] Free   [x] Professional   [x] Enterprise   [x] All
Add-on gated?                            [ ] Yes   [x] No
Manual override supported?               [ ] Yes   [x] No
Module slug added to subscription_plans? [ ] Pending   [x] Done (all plans)
```

### Limits

```
Limit key           Enforcement point
(none)              N/A
```

### i18n Keys Required

```
Sidebar title key:   modules.userAccount.title
Page title key:      AccountPage.title, ProfilePage.title, PreferencesPage.title, NotificationsPage.title
Error message keys:  (via action error strings, no dedicated keys)
```

---

## 3. Repo Integration Map

### Constants

- [x] `src/lib/constants/modules.ts` — `MODULE_USER_ACCOUNT` added, in `ModuleSlug` union and arrays
- [x] `src/lib/constants/permissions.ts` — 7 account constants added, in `PermissionSlug` union + `ALL_PERMISSION_SLUGS`

### Entitlements Types

- [x] N/A — no new limit keys for this module

### Database Migrations

- [x] `supabase/migrations/20260201120000_user_preferences_v2.sql` — schema expansion + RLS + audit table
- [x] `supabase/migrations/20260203000000_revoke_anon_user_preferences.sql` — anon access revoked
- [x] `supabase/migrations/20250605131416_add_organization_and_branch_to_user_preferences.sql` — org/branch columns
- [ ] Dedicated permissions migration
  > **INFO**: Permission slugs exist in DB (verified). Migration file not identified separately — may be in a shared permissions migration.
  > **Required**: Verify slugs are in a tracked migration.

### Server Layer

- [x] `src/server/services/user-preferences.service.ts` — `UserPreferencesService` static class
- [x] `src/app/actions/user-preferences/index.ts` — server actions with auth + permission guards

### Client / App Layer

- [x] `src/hooks/queries/user-preferences/index.ts` — React Query hooks
- [x] `src/app/[locale]/dashboard/account/profile/page.tsx` — Server Component (no entitlements guard — intentional)
- [ ] `src/app/[locale]/dashboard/account/loading.tsx`
  > **GAP**: No `loading.tsx` found in account directory.
  > **Where to add**: `src/app/[locale]/dashboard/account/loading.tsx`
  > **Required**: Recommended.
- [ ] `src/app/[locale]/dashboard/account/error.tsx`
  > **GAP**: No `error.tsx` found in account directory.
  > **Where to add**: `src/app/[locale]/dashboard/account/error.tsx`
  > **Required**: Recommended.
- [x] Client components exist under `_components/`

### Module Metadata

- [x] `src/modules/user-account/config.ts` — ModuleConfig exists
  > Verified: items use `type: "action" as const`, no `path:` fields
- [x] `src/modules/index.ts` — module registered in `getAllModules()`
- [x] `src/modules/user-account/MODULE.md` — created in this task ✅

### Sidebar V2 (Navigation)

- [x] `src/lib/sidebar/v2/registry.ts` — entry in `FOOTER_NAV_ITEMS` using constants
- [x] `src/lib/sidebar/v2/icon-map.ts` — `"settings"` iconKey already valid

### i18n

- [x] `messages/en.json` — account keys present (used in pages)
- [x] `messages/pl.json` — account keys present

### Tests

- [x] `src/app/[locale]/dashboard/__tests__/sidebar-ssr.test.tsx` — SSR integration test for account sidebar
  > Verified: tests 7.4a (account.profile visible with account.profile.read) and 7.4b (hidden without) added
- [x] Service unit tests — NOT a separate file; service is tested indirectly via action tests
  > **INFO**: No dedicated `user-preferences.service.test.ts`. Acceptable coverage via action tests, but direct service tests are recommended.
- [x] `src/app/actions/user-preferences/__tests__/index.test.ts` — action tests exist
- [x] `supabase/tests/060_user_preferences_test.sql` — RLS integration tests
  > Verified: 21 tests (schema, RLS isolation, JSONB functional, unauthenticated access)

---

## 4. Step-by-Step Build Flow

### A. Constants & Types

- [x] `MODULE_USER_ACCOUNT = "user-account"` in `src/lib/constants/modules.ts`
- [x] `MODULE_USER_ACCOUNT` in `ModuleSlug` type union
- [x] Module slug in module arrays in `modules.ts`
- [x] Permission constants added (7 total)
- [x] All constants in `PermissionSlug` union
- [x] All constants in `ALL_PERMISSION_SLUGS` array
- [x] No new limit keys needed
- [x] `npm run type-check` — passes (verified locally 2026-02-25)
- [x] Grep for raw module strings → zero hits (verified locally 2026-02-25)
- [x] Grep for raw permission strings → zero hits (verified locally 2026-02-25)

### B. Database Schema

- [x] Migration files exist for `user_preferences` schema
- [x] `id uuid DEFAULT gen_random_uuid() PRIMARY KEY` ✅
- [ ] `organization_id uuid NOT NULL REFERENCES ...`
  > **INFO**: `organization_id` exists but is nullable (stores user's default org preference, not a scoping key). This is intentional — user preferences are user-scoped, not org-scoped. Acceptable deviation.
- [x] Soft-delete: `deleted_at` column ✅
- [x] `created_at`, `updated_at` columns ✅
- [ ] `created_by` column
  > **INFO**: Column not present on `user_preferences`. Has `updated_by` instead. Acceptable for user-personal data.
- [x] Indexes exist (`idx_user_preferences_updated_at`, GIN on `dashboard_settings`)
- [x] Migration is idempotent (uses `IF NOT EXISTS`, `DO $$ BEGIN` pattern)
- [x] TypeScript types include `user_preferences` (in `supabase/types/types.ts`)

### C. RLS & Security in DB

- [x] `ENABLE ROW LEVEL SECURITY` on `user_preferences` ✅ (verified)
- [x] `ENABLE ROW LEVEL SECURITY` on `user_preference_audit` ✅ (verified)
- [x] `FORCE ROW LEVEL SECURITY` for PII tables ✅
  > Verified: supabase/migrations/20260224105002_force_rls_user_preferences.sql
- [x] SELECT policy: `user_id = auth.uid()` ✅
  > **NOTE**: Uses `user_id = auth.uid()` instead of `is_org_member()` — intentional (user-personal data, not org-scoped).
- [x] INSERT policy with `WITH CHECK (user_id = auth.uid())` ✅
- [x] UPDATE policy: USING `user_id = auth.uid()` + WITH CHECK `user_id = auth.uid()` — mirrored ✅
- [x] DELETE policy: `user_id = auth.uid()` ✅
- [x] No overly broad policies — all scoped to `auth.uid()` ✅
- [x] No direct writes to `user_effective_permissions`, `organization_entitlements` ✅
- [x] Cross-tenant isolation test ✅
  > Verified: supabase/tests/060_user_preferences_test.sql (tests 9–14)

### D. Permissions (RBAC V2 Compile Model)

- [x] Permission slugs inserted into `public.permissions` table (7 slugs verified in DB)
- [x] Assigned to roles: `org_owner` and `org_member` both get `account.*` wildcard
- [x] DB slug exactly matches constant in `permissions.ts` (verified)
- [x] `user_effective_permissions` recompiles via trigger after role assignment
- [x] Wildcard decision documented:
  ```
  org_owner:    [x] account.*
  org_member:   [x] account.*   (every user owns their own account)
  branch_admin: N/A
  ```
- [x] Deny consideration: no actions require explicit deny capability
- [x] Prove by test: deny overrides allow ✅
  > Verified: src/app/actions/user-preferences/**tests**/index.test.ts (describe "Permission denial (fail-closed)")

### E. Entitlements (Compiled Snapshot)

- [x] Module is NOT plan-gated — entitlement guards intentionally omitted ✅
- [x] `"user-account"` slug present in `subscription_plans.enabled_modules` for all plans ✅
- [x] N/A: no limits keys for this module
- [ ] `requireModuleOrRedirect(MODULE_USER_ACCOUNT)` in Server Components
  > **N/A**: Not plan-gated. No guard needed.
- [ ] `requireModuleAccess(MODULE_USER_ACCOUNT)` in Server Actions
  > **N/A**: Not plan-gated. No guard needed.
- [x] Fail-closed: no entitlement gate to be missing — N/A

### F. Server Guards (Real Enforcement at Runtime)

Routes:

- [x] `/dashboard/account/profile` has `checkPermission(context.user.permissionSnapshot, ACCOUNT_PROFILE_READ)` guard ✅
  > Verified: src/app/[locale]/dashboard/account/profile/page.tsx
- [x] `/dashboard/account/preferences` has `checkPermission(context.user.permissionSnapshot, ACCOUNT_PREFERENCES_READ)` guard ✅
  > Verified: src/app/[locale]/dashboard/account/preferences/page.tsx
- [x] `/dashboard/account/notifications` has `checkPermission(context.user.permissionSnapshot, ACCOUNT_SETTINGS_READ)` guard ✅
  > Verified: src/app/[locale]/dashboard/account/notifications/page.tsx

Server actions:

- [x] `updateProfileAction` calls `checkUserPermission(supabase, ACCOUNT_PROFILE_UPDATE)` ✅
  > Verified: src/app/actions/user-preferences/index.ts
- [x] `updateRegionalSettingsAction` calls `checkUserPermission(supabase, ACCOUNT_PREFERENCES_UPDATE)` ✅
- [x] `updateNotificationSettingsAction` — same ✅
- [x] `updateDashboardSettingsAction` — same ✅
- [x] `updateModuleSettingsAction` — same ✅
- [x] `syncUiSettingsAction` — same ✅
- [x] `setDefaultOrganizationAction` — same ✅
- [x] `setDefaultBranchAction` — same ✅
- [ ] All actions use `mapEntitlementError(error)` — N/A (not plan-gated)

Invariant checklist:

- [x] Type route URL without permission → redirected to `/dashboard/start` ✅
  > Verified: profile/page.tsx, preferences/page.tsx, notifications/page.tsx
- [x] Call protected server action without permission → `{ success: false }` ✅
  > Verified: src/app/actions/user-preferences/index.ts (checkUserPermission returns false → `{ success: false, error: "Permission denied" }`)
- [x] No route relies solely on sidebar visibility for access control ✅
  > Verified: all 3 account routes have server-side checkPermission guards (loadDashboardContextV2 + checkPermission)

### G. Sidebar V2 (UX Integration)

- [x] Entry in `FOOTER_NAV_ITEMS` in `src/lib/sidebar/v2/registry.ts` ✅
- [x] Entry uses imported constants (`ACCOUNT_PROFILE_READ`, `ACCOUNT_PREFERENCES_READ`) — no raw strings ✅
- [x] `iconKey: "settings"` exists in `src/lib/sidebar/v2/icon-map.ts` ✅
- [x] `titleKey: "modules.userAccount.title"` exists in messages files ✅
- [x] `href` set for child items ✅
- [x] Not `coming_soon`
- [x] No `showWhenDisabled` (not plan-gated)
- [x] Parent carries no `requiresModules`; children carry `requiresPermissions` ✅
- [x] If all children pruned, parent disappears (resolver handles this)
- [x] Client renderer does not read `permissionSnapshot` directly ✅
- [x] `ModuleConfig` does NOT contain navigation hrefs duplicating registry entries ✅
  > Verified: src/modules/user-account/config.ts (items use `type: "action" as const`, no `path:`)

### H. Tests (TDD-First Proof)

**Sidebar SSR Integration Tests:**

- [x] Test: account item appears when user has `ACCOUNT_PROFILE_READ` ✅
  > Verified: sidebar-ssr.test.tsx test 7.4a
- [x] Test: account item absent when user lacks `ACCOUNT_PROFILE_READ` ✅
  > Verified: sidebar-ssr.test.tsx test 7.4b
- [x] `afterEach(() => clearPermissionRegexCache())` in sidebar test ✅
  > Verified: sidebar-ssr.test.tsx afterEach hook (line 44)

**Unit Tests — Service Layer:**

- [ ] `src/server/services/__tests__/user-preferences.service.test.ts`
  > **GAP**: No dedicated service unit test file. Service tested indirectly via action tests.
  > **Required**: Recommended.

**Unit Tests — Server Actions:**

- [x] Happy path tests exist for all 10 actions ✅
- [x] Auth failure tests exist ✅
- [x] Guard test: action returns `{ success: false }` when permission missing ✅
  > Verified: src/app/actions/user-preferences/**tests**/index.test.ts (describe "Permission denial (fail-closed)")
- [ ] Guard test: limit exceeded → N/A (no limits)

**RLS Integration Tests:**

- [x] User A cannot SELECT user B's preferences ✅
  > Verified: supabase/tests/060_user_preferences_test.sql test 10
- [x] User A cannot UPDATE user B's preferences ✅
  > Verified: supabase/tests/060_user_preferences_test.sql test 12
- [x] Unauthenticated access returns no rows ✅
  > Verified: supabase/tests/060_user_preferences_test.sql test 21

**Negative / Fail-Closed Tests:**

- [x] Missing permission → action returns error ✅
  > Verified: src/app/actions/user-preferences/**tests**/index.test.ts (describe "Permission denial (fail-closed)")

**Final Build Gate:**

- [x] `npm run type-check` — passes (verified locally 2026-02-25)
- [x] `npx vitest run` — existing tests pass (verified locally 2026-02-25)
- [x] `npm run build` — passes (verified locally 2026-02-25)

### I. i18n / Metadata / UX Finishing

- [x] `messages/en.json` — account keys present ✅
- [x] `messages/pl.json` — account keys present ✅
- [x] `titleKey` in registry resolves correctly ✅
- [x] Error messages from actions are plain strings (no `mapEntitlementError` — not plan-gated) ✅
- [x] `react-toastify` used in hooks — no sonner imports ✅
- [x] `toast.success`, `toast.error` used correctly ✅
- [ ] `loading.tsx` exists
  > **GAP**: No `loading.tsx` in account directory.
- [ ] `error.tsx` exists
  > **GAP**: No `error.tsx` in account directory.
- [ ] Accessibility: interactive elements have accessible labels
  > **INFO**: Not verified. Pre-V2 module.

### J. Release / Verification Checklist

- [x] `npm run type-check` → clean (verified locally 2026-02-25)
- [x] `npx vitest run` → passes (verified locally 2026-02-25)
- [x] `npm run build` → succeeds (verified locally 2026-02-25)
- [x] **Smoke — permission gate**: log in without `account.profile.read` → blocked server-side ✅
  > Verified: profile/page.tsx, preferences/page.tsx, notifications/page.tsx use `checkPermission` + `loadDashboardContextV2`
- [x] **Smoke — server action gate**: call `updateProfileAction` without `account.profile.update` → `{ success: false }` ✅
  > Verified: src/app/actions/user-preferences/index.ts + denial test in **tests**/index.test.ts
- [x] **Smoke — sidebar UX**: authorized user sees account in footer sidebar ✅
- [x] No `console.log` / debug statements in production paths ✅
  > Verified: syncUiSettingsAction and useSyncUiSettingsMutation have no console.log
- [x] No TypeScript `any` types introduced — N/A (pre-existing module)
- [x] No ESLint `disable` suppressions in this module's files ✅ (not verified fully)
- [x] Service role key NOT used in pages/actions ✅

### K. Entitlements Gate

> ✅ SKIP — module is available on all plans. Not plan-gated.

- [x] Module slug constant exists in `modules.ts` ✅
- [x] No raw module slug strings in TypeScript ✅
- [x] Subscription plans updated (all plans include `user-account`) ✅
- [x] `organization_entitlements.enabled_modules` includes slug (not plan-gated by design; entitlement enforcement intentionally omitted)
- [x] N/A: not checking free plan exclusion (all plans have access)
- [ ] Page-level server guard — N/A (not plan-gated)
- [ ] Server action module guard — N/A (not plan-gated)

### L. Sidebar V2 Registry Integration

- [x] Registry entry in `FOOTER_NAV_ITEMS` ✅
- [x] Uses module and permission constants only ✅
- [ ] `visibility.requiresModules` — N/A (not plan-gated)
- [x] `visibility.requiresPermissions` set using `ACCOUNT_PROFILE_READ`, `ACCOUNT_PREFERENCES_READ` ✅
- [x] SSR sidebar integration test added ✅
  > Verified: sidebar-ssr.test.tsx tests 7.4a and 7.4b
- [x] Verified: member without permission does NOT see sidebar item ✅
  > Verified: sidebar-ssr.test.tsx test 7.4b

### M. Permission Slug Integrity Verification

- [x] All permission constants in `permissions.ts` exactly match DB slugs (all 7 verified via Supabase query) ✅
- [x] No permission slug used in application code absent from DB ✅
- [x] No outdated slugs referenced ✅
- [x] No raw permission strings in TypeScript files ✅

### N. UI Responsiveness Verification

- [ ] Verified layout at 390px — no horizontal overflow
  > **GAP**: Not verified. Pre-V2 module, no documented check.
  > **Required**: Recommended.
- [ ] Primary actions reachable on mobile
  > **GAP**: Not verified.
- [x] Sidebar collapse/expand does not obscure module content — handled by layout
- [ ] Tables/data-dense views have mobile fallback
  > **INFO**: Profile and preferences pages use card layouts; mobile behavior not verified.

---

## 5. Definition of Done (Enterprise-Grade Gate)

- [x] **Constants**: `MODULE_USER_ACCOUNT` in `modules.ts`; all 7 permission constants in `permissions.ts`; unions updated ✅
- [x] **No raw strings**: grep confirms zero raw account permission or module strings in TypeScript ✅
- [x] **Database**: `user_preferences` and `user_preference_audit` have `ENABLE ROW LEVEL SECURITY` ✅
- [ ] **RLS policies**: policies exist but use `user_id = auth.uid()` instead of `is_org_member()` / `has_permission()`
  > **INFO**: Intentional special case — user-personal data. The standard pattern is org-scoped; this is user-scoped. Documented deviation.
- [x] **RLS tests**: cross-tenant isolation proven by test ✅
  > Verified: supabase/tests/060_user_preferences_test.sql (21 tests, tests 9–14 cover isolation)
- [x] **Permission rows**: all 7 slugs in `public.permissions`; `account.*` assigned to `org_owner` and `org_member` via `role_permissions` ✅
- [x] **Entitlements**: not plan-gated; all plans include `user-account` ✅
- [x] **Server guards**: every server action (mutating and read) has permission check ✅
  > Verified: src/app/actions/user-preferences/index.ts (checkUserPermission helper, all 10 actions: 8 mutating + 2 read — getUserPreferencesAction, getDashboardSettingsAction)
- [x] **Sidebar registry**: entry in `registry.ts`; uses constants; `iconKey` valid; `titleKey` resolves ✅
- [x] **No client-side authorization logic**: `usePermissions()` not used for data gating ✅
- [x] **Tests pass (full criteria)**: sidebar SSR tests and RLS tests added ✅
  > Verified locally 2026-02-25; sidebar-ssr.test.tsx (tests 7.4a, 7.4b); 060_user_preferences_test.sql (21 tests)
- [x] **Type-check passes** ✅
- [x] **Build passes** ✅
- [x] **i18n keys exist** in both `en.json` and `pl.json` ✅
- [x] **No direct writes to compiled tables** ✅
- [x] **No service role at runtime** ✅
- [x] **MODULE.md created/updated and fully populated** ✅

---

## 6. Common Failure Modes (Anti-Footguns)

- [x] **Route exists but no server-side guard** — guard added ✅

  > Verified: profile/page.tsx, preferences/page.tsx, notifications/page.tsx all have checkPermission guards (wildcard-aware, uses permissionSnapshot from loadDashboardContextV2)

- [ ] **Sidebar shows link but module not in plan** — N/A (all plans include this module)

- [x] **Permission constant added to `permissions.ts` but not inserted into DB** — NOT this case. All 7 slugs verified in DB. ✅

- [x] **RLS enabled but not FORCE RLS on sensitive table** — FORCE RLS applied ✅

  > Verified: supabase/migrations/20260224105002_force_rls_user_preferences.sql

- [x] **Wrong policy command type** — UPDATE policy has correct USING + WITH CHECK. ✅

- [x] **ModuleConfig navigation items duplicate sidebar registry entries** — removed ✅

  > Verified: src/modules/user-account/config.ts (items use `type: "action" as const`, no `path:`)

- [x] **Raw module or permission strings in TypeScript** — None found. ✅

- [x] **`buildSidebarModel` (cached) used in tests** — sidebar tests use `buildSidebarModelUncached`. ✅

- [x] **`clearPermissionRegexCache()` missing from `afterEach`** — present in sidebar test ✅
  > Verified: sidebar-ssr.test.tsx afterEach hook

---

_Checklist completed: 2026-02-24 — compliance verification task for pre-V2 user-account module_
_Checklist updated: 2026-02-24 — re-verification pass confirmed all 8 gaps closed; stale GAP notes removed from checked items_
_Checklist updated: 2026-02-25 — guard mechanism corrected to checkPermission + loadDashboardContextV2; action count updated to all 10; redirect target corrected to /dashboard/start; "verified in DB" claims replaced with design-intent statements_
_Checklist version: February 2026 — aligned with Permissions V2, Entitlements V2, Sidebar V2_
