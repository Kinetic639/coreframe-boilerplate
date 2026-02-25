# User Account (`user-account`)

## Purpose

- **What this module does:** Manages user-personal settings — profile display name/phone, regional preferences (timezone, locale, date/time format), notification settings, dashboard UI settings, module-specific settings, and default org/branch selection. Data is user-scoped (not org-scoped).
- **Who uses it (roles):** All authenticated users. No role restriction — every user has `account.*` wildcard permission.
- **Primary workflows:**
  - View and update own profile (display name, phone)
  - Update regional settings (timezone, locale, date format, time format)
  - Update notification preferences
  - Sync dashboard UI state across devices
  - Set default organization and branch

## Status

- **Implementation:** ⬜ planned / ⬜ in progress / ✅ done
- **Last updated:** 2026-02-25
- **Owner:** coreframe

---

## Entitlements

- **Plan-gated:** ❌ (available on all plans: free, professional, enterprise)
- **Module constant:** `MODULE_USER_ACCOUNT` (`"user-account"`) — defined in `src/lib/constants/modules.ts`
- **Entitlements source of truth:** `organization_entitlements.enabled_modules` (compiled) — slug `"user-account"` is present for all plan tiers (not plan-gated by design; no entitlement enforcement implemented)
- **Where enforced:**
  - Page guard: ❌ Not enforced — module is not plan-gated; no `requireModuleOrRedirect` calls in pages
  - Server actions: ❌ Not enforced — module is not plan-gated; no `requireModuleAccess` calls in actions
  - ✅ **Permission checks** added to all 10 actions (via `checkUserPermission` helper) and all pages (via `checkPermission` + `loadDashboardContextV2`)

### Verification checklist

- [x] Module slug `"user-account"` present in all orgs' `organization_entitlements.enabled_modules` (on all plans)
- [x] Module not plan-gated — entitlement gating guards are intentionally omitted
- [ ] Sidebar item hidden when not entitled — N/A (not plan-gated)
- [ ] Direct route access denied (server guard) when not entitled — N/A (not plan-gated)

---

## Permissions (Permission Service V2)

### Permission constants used

> No raw strings. Must match DB slugs exactly.

|             Action | Permission constant          | DB slug                      |
| -----------------: | ---------------------------- | ---------------------------- |
|           Wildcard | `ACCOUNT_WILDCARD`           | `account.*`                  |
|       Profile read | `ACCOUNT_PROFILE_READ`       | `account.profile.read`       |
|     Profile update | `ACCOUNT_PROFILE_UPDATE`     | `account.profile.update`     |
|   Preferences read | `ACCOUNT_PREFERENCES_READ`   | `account.preferences.read`   |
| Preferences update | `ACCOUNT_PREFERENCES_UPDATE` | `account.preferences.update` |
|      Settings read | `ACCOUNT_SETTINGS_READ`      | `account.settings.read`      |
|    Settings update | `ACCOUNT_SETTINGS_UPDATE`    | `account.settings.update`    |

All constants defined in `src/lib/constants/permissions.ts` lines 18–24.

Role assignments (DB verified):

- `org_owner` → `account.*` (wildcard, allows all)
- `org_member` → `account.*` (wildcard, allows all)

### Where enforced

- Server Components: ✅ Permission guards on `profile/page.tsx`, `preferences/page.tsx`, `notifications/page.tsx`. Each page calls `loadDashboardContextV2()` and passes `context.user.permissionSnapshot` to `checkPermission(snapshot, permission)` (wildcard-aware). `loadDashboardContextV2()` is `React.cache()`-wrapped — deduplicated with the outer dashboard layout call per request; no extra DB hit. Redirects to `/dashboard/start` (locale-aware) on denial.
- Server Actions: ✅ All 10 actions (8 mutating + 2 read) check permission via `checkUserPermission(supabase, permission)` helper. Read actions use `ACCOUNT_PREFERENCES_READ`; mutating actions use `ACCOUNT_PROFILE_UPDATE` or `ACCOUNT_PREFERENCES_UPDATE`. Returns `{ success: false, error: "Permission denied" }` on denial.
- RLS: ✅ Final boundary exists (`user_id = auth.uid()` on all policies)

### Verification checklist

- [x] Permission constants exist in `src/lib/constants/permissions.ts`
- [x] DB has matching slugs in `permissions` table (all 7 verified)
- [x] RLS policies enforce read/write boundaries (`user_id = auth.uid()`)
- [x] Server actions deny when permission missing ✅ (fixed 2026-02-24)
- [x] Sidebar hides items when permission missing (uses `ACCOUNT_PROFILE_READ`, `ACCOUNT_PREFERENCES_READ`)

---

## Sidebar V2 Registry

### Navigation entries

> Sidebar V2 registry is the only navigation authority.

| Location       | Item id               | Label key                               | Href                             | requiresModules | requiresPermissions          |
| -------------- | --------------------- | --------------------------------------- | -------------------------------- | --------------- | ---------------------------- |
| FOOTER         | `account`             | `modules.userAccount.title`             | (group parent, no href)          | none            | none                         |
| FOOTER (child) | `account.profile`     | `modules.userAccount.items.profile`     | `/dashboard/account/profile`     | none            | `[ACCOUNT_PROFILE_READ]`     |
| FOOTER (child) | `account.preferences` | `modules.userAccount.items.preferences` | `/dashboard/account/preferences` | none            | `[ACCOUNT_PREFERENCES_READ]` |

Note: `/dashboard/account/notifications` page exists but is **not registered in the sidebar**. Server-side permission guard (`ACCOUNT_SETTINGS_READ`) added 2026-02-24.

### Files changed

- Registry file(s):
  - `src/lib/sidebar/v2/registry.ts` (FOOTER_NAV_ITEMS, lines ~141–171)
- SSR sidebar tests:
  - ✅ `src/app/[locale]/dashboard/__tests__/sidebar-ssr.test.tsx` — tests 7.4a and 7.4b added for account.profile visibility (fixed 2026-02-24)

### Verification checklist

- [x] Item appears for entitled + permitted user (uses `ACCOUNT_PROFILE_READ`, `ACCOUNT_PREFERENCES_READ`)
- [ ] Item hidden for not entitled user — N/A (not plan-gated)
- [x] Item hidden for missing permission user (visibility.requiresPermissions set)
- [x] SSR sidebar tests cover this module visibility ✅ (tests 7.4a + 7.4b added)

---

## Data Model

### Tables

- `public.user_preferences` — primary user data store (user-scoped, not org-scoped)
- `public.user_preference_audit` — audit trail for preference changes

### Columns of note (`user_preferences`)

- `user_id` UUID — primary scope (user-personal, NOT org-scoped)
- `organization_id` UUID nullable — stored default org preference (not a scoping key for RLS)
- `default_branch_id` UUID nullable
- `last_branch_id` UUID nullable
- `display_name` TEXT — user-chosen display name
- `phone` TEXT — user phone (PII)
- `timezone` TEXT DEFAULT `'UTC'`
- `date_format` TEXT DEFAULT `'YYYY-MM-DD'`
- `time_format` TEXT DEFAULT `'24h'`
- `locale` TEXT DEFAULT `'pl'`
- `notification_settings` JSONB DEFAULT `{}`
- `dashboard_settings` JSONB DEFAULT `{}`
- `module_settings` JSONB DEFAULT `{}`
- `preferences` JSONB nullable — legacy monolithic column (pre-V2)
- `updated_by` UUID nullable
- soft delete: `deleted_at` ✅
- audit columns: `created_at`, `updated_at` ✅

### Indexes

- `idx_user_preferences_updated_at` on `updated_at DESC`
- `idx_user_preferences_dashboard_settings` GIN on `dashboard_settings`
- `idx_user_preference_audit_user_id` on `user_id`
- `idx_user_preference_audit_created_at` on `created_at DESC`
- `idx_user_preference_audit_change_type` on `change_type`

---

## RLS Policies

### Policies summary

| Table                   | Operation | Policy name                   | Conditions                                          |
| ----------------------- | --------- | ----------------------------- | --------------------------------------------------- |
| `user_preferences`      | SELECT    | `user_preferences_select_own` | `user_id = auth.uid()`                              |
| `user_preferences`      | INSERT    | `user_preferences_insert_own` | WITH CHECK `user_id = auth.uid()`                   |
| `user_preferences`      | UPDATE    | `user_preferences_update_own` | USING `user_id = auth.uid()` + WITH CHECK mirror ✅ |
| `user_preferences`      | DELETE    | `user_preferences_delete_own` | `user_id = auth.uid()`                              |
| `user_preference_audit` | SELECT    | `audit_select_own`            | `user_id = auth.uid()`                              |
| `user_preference_audit` | INSERT    | `audit_insert_authenticated`  | `changed_by = auth.uid()`                           |

### Notes

- Escalation logic (update→delete permission) used: ❌ Not applicable (user-personal data)
- **Special case**: RLS uses `user_id = auth.uid()` instead of `is_org_member(organization_id)` — intentional, because preferences are user-personal data, not org-scoped. This is a documented deviation from the standard org-scoped pattern.
- ✅ `FORCE ROW LEVEL SECURITY` applied to both tables via migration `20260224105002_force_rls_user_preferences.sql` (fixed 2026-02-24)

---

## API Surface

### Server actions

| Action                             | File                                        | Input schema                       | Permission enforced             | Entitlement enforced |
| ---------------------------------- | ------------------------------------------- | ---------------------------------- | ------------------------------- | -------------------- |
| `getUserPreferencesAction`         | `src/app/actions/user-preferences/index.ts` | none                               | ✅ `ACCOUNT_PREFERENCES_READ`   | ❌                   |
| `getDashboardSettingsAction`       | same                                        | none                               | ✅ `ACCOUNT_PREFERENCES_READ`   | ❌                   |
| `updateProfileAction`              | same                                        | `updateProfileSchema` (Zod)        | ✅ `ACCOUNT_PROFILE_UPDATE`     | ❌                   |
| `updateRegionalSettingsAction`     | same                                        | `updateRegionalSchema` (Zod)       | ✅ `ACCOUNT_PREFERENCES_UPDATE` | ❌                   |
| `updateNotificationSettingsAction` | same                                        | `updateNotificationSettingsSchema` | ✅ `ACCOUNT_PREFERENCES_UPDATE` | ❌                   |
| `updateDashboardSettingsAction`    | same                                        | `updateDashboardSettingsSchema`    | ✅ `ACCOUNT_PREFERENCES_UPDATE` | ❌                   |
| `updateModuleSettingsAction`       | same                                        | `updateModuleSettingsSchema`       | ✅ `ACCOUNT_PREFERENCES_UPDATE` | ❌                   |
| `syncUiSettingsAction`             | same                                        | `syncUiSettingsSchema`             | ✅ `ACCOUNT_PREFERENCES_UPDATE` | ❌                   |
| `setDefaultOrganizationAction`     | same                                        | `setDefaultOrganizationSchema`     | ✅ `ACCOUNT_PREFERENCES_UPDATE` | ❌                   |
| `setDefaultBranchAction`           | same                                        | `setDefaultBranchSchema`           | ✅ `ACCOUNT_PREFERENCES_UPDATE` | ❌                   |

### Services

- `src/server/services/user-preferences.service.ts` — `UserPreferencesService` responsibilities:
  - `getOrCreatePreferences(supabase, userId)` — upsert user prefs row
  - `getDashboardSettings(supabase, userId)` — lightweight fetch
  - `updateProfile`, `updateRegionalSettings`, `updateNotificationSettings`, `updateDashboardSettings`, `updateModuleSettings`, `syncUiSettings`, `setDefaultOrganization`, `setDefaultBranch`

### React Query hooks

- `usePreferencesQuery(enabled?)`
- `useDashboardSettingsQuery(enabled?)`
- `useUpdateProfileMutation()`
- `useUpdateRegionalSettingsMutation()`
- `useUpdateNotificationSettingsMutation()`
- `useUpdateDashboardSettingsMutation()`
- `useUpdateModuleSettingsMutation()`
- `useSyncUiSettingsMutation()` — silent background sync
- `useSetDefaultOrganizationMutation()` — triggers page reload
- `useSetDefaultBranchMutation()`

---

## UI

### Routes

- `/dashboard/account/profile` — profile management (server-side permission guard: `ACCOUNT_PROFILE_READ`)
- `/dashboard/account/preferences` — regional + notification + appearance settings (server-side permission guard: `ACCOUNT_PREFERENCES_READ`)
- `/dashboard/account/notifications` — notifications page (server-side permission guard: `ACCOUNT_SETTINGS_READ`; not in sidebar — Option A)

### Components

- Server:
  - `src/app/[locale]/dashboard/account/layout.tsx`
  - `src/app/[locale]/dashboard/account/profile/page.tsx`
  - `src/app/[locale]/dashboard/account/preferences/page.tsx`
  - `src/app/[locale]/dashboard/account/notifications/page.tsx`
- Client:
  - `src/app/[locale]/dashboard/account/_components/account-layout-client.tsx`
  - `src/app/[locale]/dashboard/account/profile/_components/profile-client.tsx`
  - `src/app/[locale]/dashboard/account/preferences/_components/preferences-client.tsx`
  - `src/app/[locale]/dashboard/account/preferences/_components/regional-section.tsx`
  - `src/app/[locale]/dashboard/account/preferences/_components/notifications-section.tsx`
  - `src/app/[locale]/dashboard/account/preferences/_components/appearance-section.tsx`
  - `src/app/[locale]/dashboard/account/notifications/_components/notifications-client.tsx`

### Mobile responsiveness notes

- Verified at 390px: ❌ Not verified (pre-V2 module, no documented check)
- Known constraints: unknown

---

## Tests

### Coverage map

- Unit tests (server actions):
  - `src/app/actions/user-preferences/__tests__/index.test.ts` — covers auth failure, service failure, happy path for all 10 actions; ✅ now includes permission-denial test (`updateProfileAction` → `{ success: false, error: "Permission denied" }`)
- Unit tests (components):
  - `src/app/[locale]/dashboard/account/__tests__/account-components.test.tsx` — AccountLayoutClient, ProfileClient
  - `src/app/[locale]/dashboard/account/preferences/_components/__tests__/preference-sections.test.tsx`
  - `src/app/[locale]/dashboard/account/preferences/_components/__tests__/sections.test.tsx`
- Integration / RLS tests:
  - ✅ `supabase/tests/060_user_preferences_test.sql` — 21 tests (schema, RLS isolation, JSONB functional, unauthenticated access)
- Sidebar SSR tests:
  - ✅ `src/app/[locale]/dashboard/__tests__/sidebar-ssr.test.tsx` — tests 7.4a and 7.4b cover `account.profile` visibility (positive and negative cases)

### Manual test checklist

- [ ] Update profile flow (display name, phone)
- [ ] Update regional settings flow
- [ ] Permission denied behavior — server-side guard now in place; test by removing `account.*` from a role
- [ ] Entitlement denied behavior — N/A (not plan-gated)
- [ ] Mobile layout sanity at 390px

---

## Operational Notes

### Telemetry / logging

- Action error logging: `console.error` on catch in all actions
- ✅ `console.log` debug statements removed from `syncUiSettingsAction` and `useSyncUiSettingsMutation` (fixed 2026-02-24)
- Audit log integration: `user_preference_audit` table via DB trigger `user_preferences_audit_trigger` (AFTER INSERT OR UPDATE OR DELETE)

### Performance considerations

- N+1 risks: none — all queries target single user by `user_id`
- Cached queries: `staleTime: 5 * 60 * 1000` (5 min) on `usePreferencesQuery` and `useDashboardSettingsQuery`
- Index reliance: `idx_user_preferences_updated_at` for sync queries; GIN index on `dashboard_settings`

---

## Known Compliance Gaps (Remaining)

> Gaps 1–8 from the initial compliance audit were fixed 2026-02-24. Only low-priority items remain.

| #   | Severity | Gap                                                                                                                                                         | Fix location      |
| --- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| 9   | INFO     | Pages do not call `loadAppContextServer()` for data prefetch (SSR-first deviation) — intentional for user-personal data (client-side fetch via React Query) | All account pages |

### Recommended follow-ups

- Add `loading.tsx` and `error.tsx` to `src/app/[locale]/dashboard/account/`
- Verify mobile layout at 390px for all account pages
- Add direct service unit tests (`src/server/services/__tests__/user-preferences.service.test.ts`)
- Consider adding `ACCOUNT_SETTINGS_READ` sidebar entry for `/dashboard/account/notifications` (currently Option A — guarded but unlisted)

---

## Files Changed

> Files created/modified across all tasks for this module.

- `src/modules/user-account/MODULE.md` — created; updated (this file)
- `src/modules/user-account/MODULE_CHECKLIST.md` — created; updated
- `src/app/actions/user-preferences/index.ts` — added `checkUserPermission` helper + permission checks to all 10 actions (8 mutating + 2 read); removed 2 `console.log` debug statements; added `ACCOUNT_PREFERENCES_READ` import
- `src/app/[locale]/dashboard/account/profile/page.tsx` — added server-side permission guard (`ACCOUNT_PROFILE_READ`) using `checkPermission` + `loadDashboardContextV2`; locale-aware redirect
- `src/app/[locale]/dashboard/account/preferences/page.tsx` — added server-side permission guard (`ACCOUNT_PREFERENCES_READ`) using `checkPermission` + `loadDashboardContextV2`; locale-aware redirect
- `src/app/[locale]/dashboard/account/notifications/page.tsx` — added server-side permission guard (`ACCOUNT_SETTINGS_READ`) using `checkPermission` + `loadDashboardContextV2`; locale-aware redirect
- `src/modules/user-account/config.ts` — removed `path:` from `items[]`; added `type: "action"` for metadata-only items
- `src/hooks/queries/user-preferences/index.ts` — removed 2 `console.log` debug statements from `useSyncUiSettingsMutation`
- `src/app/[locale]/dashboard/__tests__/sidebar-ssr.test.tsx` — added tests 7.4a and 7.4b for `account.profile` visibility
- `supabase/tests/060_user_preferences_test.sql` — added Test 21 (unauthenticated access); updated plan count 20 → 21
- `supabase/migrations/20260224105002_force_rls_user_preferences.sql` — applied `FORCE ROW LEVEL SECURITY` to `user_preferences` and `user_preference_audit`
- `src/app/actions/user-preferences/__tests__/index.test.ts` — added mocks for `loadAppContextServer` and `PermissionServiceV2`; added denial test suite; added read action denial test

---

## Changelog

- 2026-02-24 — Initial MODULE.md created by compliance verification task. Module was pre-V2, implemented before current standards. 8 compliance gaps documented.
- 2026-02-24 — Compliance fix task: all 8 gaps closed. PermissionServiceV2 enforcement added, page guards added, console.log removed, config.ts cleaned, sidebar SSR tests added, RLS unauthenticated test added, FORCE RLS migration applied, negative action test added.
- 2026-02-25 — Bugfix: page guards switched to `checkPermission` + `loadDashboardContextV2` (wildcard-aware, correct org resolution). Read actions gated with `ACCOUNT_PREFERENCES_READ`. Sidebar table header corrected to `requiresPermissions`.
