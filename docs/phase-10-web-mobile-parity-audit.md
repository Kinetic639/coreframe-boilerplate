# Phase 10 — Web vs Mobile Base-App Parity Audit

> Conducted March 2026. Covers the full base-app surface of both platforms — auth, org/branch context, permissions, entitlements, navigation shell, account/profile, and org management. Goal: identify what must be closed before feature expansion begins.

---

## A. Current base-app surface on web

**Auth/session lifecycle**

- Login (`/sign-in`), signup (`/sign-up`), forgot-password, reset-password pages
- Per-request JWT validation via `supabase.auth.getUser()` (stateless)
- Token refresh via Supabase middleware (transparent)
- Logout via Supabase `signOut()` → cookie clear → redirect

**Org context**

- Server-side deterministic resolution: preference → oldest member org → oldest created org
- Org profile loaded via `organizations → organization_profiles` join
- Stored in Zustand `useAppStoreV2` (name, slug, logo_url)
- No org-switching UI (single active org per session)

**Branch context**

- Server-side resolution: `default_branch_id` → first available
- Accessible branches computed server-side (wildcard path or role-assignment query)
- Session-local override via `sessionStorage` (hardened in Phase 10)
- `PermissionsSync` refetches branch permissions on every `activeBranchId` change

**Permissions**

- Org + branch snapshot loaded server-side in `loadUserContextV2`
- `usePermissions()` hook (`can`, `cannot`, `canAny`, `canAll`) — Zustand-backed
- Reactive sync: `PermissionsSync` component bridges React Query → user store on branch change

**Entitlements**

- Server-side only: loaded in `loadUserContextV2`, used only for sidebar filtering
- No client-side entitlements hook exposed in V2

**Navigation shell**

- Sidebar registry: Organization Management, My Activity, Tools
- Server-built: `buildSidebarModel()` applies permission + module gates before sending to client
- User account accessible via NavUser dropdown in sidebar footer (not a sidebar section)

**Account/profile/settings**

- `/account/profile` — view/edit first name, last name, avatar (signed URL from private bucket)
- `/account/preferences` — theme (dark/light), locale (PL/EN), timezone, compact-mode toggle
- `/account/notifications` — email notification settings (present but stub-level)

**Org management (under Organization module)**

- `/organization/profile` — edit org name, logo, slug, name_2
- `/organization/users/members` — full members list + pagination
- `/organization/users/members/[memberId]` — member detail: role assignment, branch access, remove
- `/organization/users/invitations` — send, resend, cancel invitations (with name + role pre-assignment)
- `/organization/users/roles` — custom role CRUD with permission editor
- `/organization/users/positions` — position definitions
- `/organization/users/branches` — assign users to branch-scoped roles
- `/organization/branches` — branch CRUD (create, edit, soft-delete)
- `/organization/billing` — subscription, usage, payment (owners only)
- `/organization/activity` — org-level activity feed
- `/organization/audit` — full audit log (IP, UA, all event types)

**Bootstrap/startup**

- Auth guard in dashboard layout → redirect to `/sign-in` or `/onboarding`
- All error cases implicit: no-session = redirect, no-org = redirect, RLS 403 = catch-all 404
- `DashboardInitialLoader` shows spinner until stores hydrated

**Diagnostics**

- No V2 diagnostic/debug panel (removed from V2 scope)
- Legacy dashboard had a `/development/` section (now returns 404)

---

## B. Current base-app surface on mobile

**Auth/session lifecycle**

- Welcome screen + sign-in screen (`(auth)/` group)
- Stateful `AuthContext`: restores session from Expo Secure Store on app start
- `onAuthStateChange` listener handles token refresh, sign-out
- `bootstrapping` flag prevents routing until session state is known

**Org context**

- Client-side derivation: first org-scoped JWT role → `activeOrgId`
- If null → `authenticated-unresolved` state → no-org screen + sign-out
- Org profile loaded async by bootstrap loader (name, name_2 from `organization_profiles`)
- No org-switching UI

**Branch context**

- Client-side resolution: wildcard permission check → all org branch IDs; else JWT branch roles
- Session-local: React state only (no sessionStorage — N/A for mobile)
- `activeBranchId` persisted to `user_preferences.default_branch_id` on switch (best-effort)
- Branch permissions reloaded by dedicated effect on every `activeBranchId` change

**Permissions**

- Org + branch snapshots loaded by `loadBootstrapData` + `loadBranchPermissionsData`
- No dedicated hook — consumers call `checkPermission(appState.permissions, SLUG)` directly
- Explicit bootstrap states expose permission loading progress to UI

**Entitlements**

- Client-side: loaded by `loadBootstrapData`, normalized by `normalizeEntitlements`
- `useEntitlements()` hook: `hasModuleAccess(slug)`, `getEffectiveLimit(key)`
- Launcher tiles gated by entitlements at render time

**Navigation shell**

- Two tabs: Home (launcher) + More
- Launcher (`index.tsx`): module tiles gated by permission + entitlement check via `getVisibleModules()`
- More (`more.tsx`): branch switcher row, diagnostics, organization link, sign-out
- Stack screens: `branch-select`, `diagnostics`, `organization/index`, `organization/edit`
- Only one module registered as `implemented: true`: Organization Management

**Account/profile/settings**

- Nothing. No user profile screen. No user preferences screen. No account settings.
- The More screen has: branch switcher, diagnostics, organization link, sign-out. No "My Account" or "Profile" entry.

**Org management (under Organization module)**

- `/organization/index` — view org profile (name, name_2, slug, website) + members list (read-only)
- `/organization/edit` — edit org name (name + name_2 only; gated behind `ORG_UPDATE`)
- No invitations, no roles, no positions, no branches CRUD, no billing, no audit, no activity

**Bootstrap/startup**

- Explicit states with dedicated UI: `resolving` → spinner, `authenticated-unresolved` → no-org screen, `forbidden` → access-denied screen, `error` → retry screen
- `BootstrapFallback` component handles all non-resolved states with appropriate UI

**Diagnostics**

- Comprehensive diagnostics screen (`diagnostics.tsx`, 651 lines)
- Sections: app state, bootstrap state, permissions (org + branch), entitlements, org context, branch list, members summary, JWT roles, React Query cache

---

## C. Strict parity matrix

| Capability                           | Web status                     | Mobile status                  | Parity status                | Rationale                                             |
| ------------------------------------ | ------------------------------ | ------------------------------ | ---------------------------- | ----------------------------------------------------- |
| **Auth: sign-in**                    | Full                           | Full                           | Full parity                  | Both have login screens                               |
| **Auth: sign-up**                    | Full                           | Missing                        | Missing on mobile            | Mobile has no registration flow                       |
| **Auth: password reset**             | Full (forgot + reset)          | Missing                        | Missing on mobile            | Mobile has no forgot-password                         |
| **Auth: session restore**            | Cookie-based                   | SecureStore-based              | Intentional platform diff    | Both restore sessions correctly                       |
| **Auth: token refresh**              | Middleware-transparent         | onAuthStateChange              | Full parity                  | Both handle transparently                             |
| **Auth: sign-out**                   | Full                           | Full                           | Full parity                  | Both clear session                                    |
| **Org context resolution**           | Deterministic SSR              | Deterministic JWT-first        | Full parity (diff mechanism) | Same fallback logic, diff execution                   |
| **Org profile view**                 | Full                           | Full                           | Full parity                  | Both show org name, name_2                            |
| **Org profile edit**                 | Full (name, logo, slug)        | Partial (name, name_2 only)    | Partial parity               | Mobile missing logo + slug edit                       |
| **Branch context resolution**        | Server-side                    | Client-side                    | Full parity (diff mechanism) | Same wildcard/explicit-role logic                     |
| **Branch switching UI**              | BranchSwitcherV2 in sidebar    | branch-select modal            | Full parity                  | Both have it                                          |
| **Branch switching persistence**     | DB + sessionStorage            | DB + React state               | Full parity (diff mechanism) | Both persist correctly                                |
| **Branch permissions reload**        | PermissionsSync                | Effect-driven                  | Full parity                  | Both reload on branch change                          |
| **Permissions loading**              | SSR → hydration                | Bootstrap loader               | Full parity (diff mechanism) | Same snapshot format                                  |
| **Permissions checking**             | `usePermissions()` hook        | Direct `checkPermission()`     | Partial parity               | Same logic, no hook on mobile                         |
| **Entitlements loading**             | SSR (sidebar only)             | Bootstrap loader               | Full parity (diff mechanism) | Both load correctly                                   |
| **Entitlements checking**            | Sidebar-only (server)          | `useEntitlements()` hook       | Intentional platform diff    | Mobile needs runtime check; web gates at SSR          |
| **Navigation shell**                 | Sidebar with registry          | Tabs + launcher                | Intentional platform diff    | Appropriate for each platform                         |
| **Module gating (launcher/sidebar)** | Permission + entitlement gated | Permission + entitlement gated | Full parity                  | Same gate logic, diff UI                              |
| **Bootstrap startup states**         | Implicit (redirect-based)      | Explicit UI states             | Intentional platform diff    | Mobile more transparent; web appropriate for SSR      |
| **User account/profile screen**      | `/account/profile`             | Missing                        | **Missing on mobile**        | No user profile screen on mobile                      |
| **User preferences screen**          | `/account/preferences`         | Missing                        | **Missing on mobile**        | No preferences screen on mobile                       |
| **Account: theme setting**           | Preferences page               | Missing (hook only)            | **Missing on mobile**        | Color scheme works but no UI to change it             |
| **Diagnostics panel**                | Removed from V2                | Comprehensive                  | Missing on web               | Mobile significantly better                           |
| **Org users: view members**          | Full table                     | Read-only list                 | Partial parity               | Both show members; web has more actions               |
| **Org users: invite members**        | Full                           | Missing                        | Missing on mobile            | Admin feature; acceptable to defer                    |
| **Org users: manage roles**          | Full CRUD                      | Missing                        | Missing on mobile            | Admin feature; acceptable to defer                    |
| **Org users: manage invitations**    | Full                           | Missing                        | Missing on mobile            | Admin feature; acceptable to defer                    |
| **Org users: positions**             | Full                           | Missing                        | Missing on mobile            | Admin feature; acceptable to defer                    |
| **Org users: branch assignments**    | Full                           | Missing                        | Missing on mobile            | Admin feature; acceptable to defer                    |
| **Org branches CRUD**                | Full                           | Missing                        | Missing on mobile            | Admin feature; acceptable to defer                    |
| **Org billing**                      | Full                           | Missing                        | Missing on mobile            | Admin feature; acceptable to defer                    |
| **Org activity feed**                | Full                           | Missing                        | Missing on mobile            | Product feature; acceptable to defer                  |
| **Org audit log**                    | Full                           | Missing                        | Missing on mobile            | Admin feature; acceptable to defer                    |
| **Tools module**                     | Full (catalog + user-enabled)  | Not implemented                | Missing on mobile            | Both platforms should have it eventually; module work |
| **My Activity (personal feed)**      | Full                           | Missing                        | Missing on mobile            | Product feature; acceptable to defer                  |

---

## D. Shared architecture audit

**Correctly shared already:**

- `@repo/contracts` — permission/module/entitlement constants and types used identically on both platforms
- `@repo/auth` — `AuthService.getUserRoles()` JWT parser called by both platforms
- `@repo/domain` — `checkPermission()` and `hasModuleAccess()` called identically on both
- Permission snapshot format `{ allow: string[], deny: string[] }` — identical on both
- Accessible-branches wildcard logic — same algorithm, different execution location
- `default_branch_id` write on branch switch — both platforms call this via the same Supabase column

**Duplicated but acceptable for now:**

- Supabase client setup — `apps/web/src/utils/supabase/` vs `apps/mobile/lib/supabase/client.ts` — platform-specific clients are expected and correct
- Permission snapshot queries — both platforms read `user_effective_permissions` with the same filters; not worth abstracting to a package yet
- Entitlements normalization — `normalize-entitlements.ts` on mobile is standalone; web has `entitlements-service.ts`; could be in `@repo/domain` eventually but acceptable now
- Org profile normalization — mobile has `normalize-org-profile.ts`; web inlines the logic — minor duplication

**Worth aligning before feature expansion:**

- Permission checking pattern — web has `usePermissions()` hook, mobile uses raw `checkPermission()`. Not a bug, but a `usePermissions`-equivalent on mobile would make component code consistent and easier to port screens between platforms.
- Entitlements on web client — web V2 has no client-side entitlements hook; launcher/module gating on web is server-only. If a web screen ever needs runtime entitlement check, this would need to be added.
- The `packages/domain` `hasModuleAccess` and `checkPermission` are already shared — no immediate action needed here.

---

## E. Remaining parity-critical gaps

**Priority 1 — Security/correctness: None found**
Both platforms enforce permission checks correctly. The hardened branch session model is consistent across both. No security regression or correctness gap identified.

**Priority 2 — Architecture consistency: Minor**

- Mobile lacks `usePermissions()` hook — components call `checkPermission()` directly from `appState`. Not a correctness problem but inconsistent with web pattern. Low priority.

**Priority 3 — Session/branch consistency: Closed**

- Closed by the `sessionStorage` session-local branch hardening shipped in Phase 10.

**Priority 4 — Diagnostics/observability gap (web)**

- Web V2 has no diagnostic/debug panel. Mobile has a comprehensive one. Not blocking feature work but a developer-experience concern for web.

**Priority 5 — UX/UI parity gaps (parity-critical before feature expansion):**

1. **User account/profile screen on mobile** — `[MUST-HAVE]`
   - Web has `/account/profile` with user name and avatar
   - Mobile has nothing — no screen where a user can see or edit their own account details
   - Every product app must have this; it is strictly foundational

2. **User preferences screen on mobile** — `[MUST-HAVE]`
   - Web has `/account/preferences` with theme, locale, timezone
   - Mobile has `useColorScheme()` hook that reads device preference but no UI to override it
   - At minimum: a theme toggle is expected on any mobile app
   - This naturally lives alongside the account/profile screen

3. **Auth: sign-up and password reset on mobile** — `[SHOULD-HAVE]`
   - Web has full registration flow; mobile has only sign-in
   - In a real deployment mobile users cannot self-register
   - This is a foundational auth gap, though deferrable if mobile is invite-only

---

## F. Recommendation

**Parity-critical gap to close before feature expansion:**

> Mobile is missing a user account/profile + preferences screen. Every production-quality app must give users visibility into and basic control over their own account. This is strictly base-app scope, not a product module.

**Next bounded slice — "Mobile Account / Profile / Preferences":**

A single slice that adds:

1. A "Konto" entry in the More screen
2. `/(app)/account/index.tsx` — email, first/last name, display name (read-only), theme toggle
3. `/(app)/account/edit.tsx` — edit first name, last name, display name
4. Theme preference persisted to `user_preferences.preferences.theme`
5. No permission gate — available to all authenticated users

This is the smallest unit that closes the only true foundational parity gap.

**What remains deferred after this slice:**

- Auth: sign-up + forgot-password on mobile (acceptable if mobile is invite-only)
- Org management depth: invitations, roles, positions, billing, audit, activity (build uniformly when planned)
- Tools module on mobile (first cross-platform module; tackle with first formal module expansion)
- Web V2 diagnostic panel (developer-experience; nice-to-have, not blocking)
- `usePermissions()` hook on mobile (minor consistency; not blocking)
