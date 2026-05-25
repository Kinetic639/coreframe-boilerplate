# MODULE_CHECKLIST.md — Analytics & Reports

> Copied from `docs/MODULE_CHECKLIST_TEMPLATE.md` and filled for the Analytics & Reports base implementation.
> Items marked [x] are verifiably complete for this base scope. Items marked [ ] require future work.

---

## 1. Purpose & Non-Negotiables

### SSR-First Invariants

- [x] Server Components are authoritative. They compute data, authorization, and sidebar model before the page renders.
- [x] Client Components are dumb renderers. They accept pre-computed props. They do not re-evaluate permissions.
- [x] The dashboard layout loads the authoritative context once (`loadDashboardContextV2()`), not repeated per page.
- [x] `buildSidebarModel()` runs server-side. Production uses the `React.cache()`-wrapped version (one call per request).
- [x] `React.cache()` provides per-request memoization — never a global singleton cache.
- [x] No `createClient()` / Supabase client instantiation in Client Components for org-scoped data.

### TDD-First Invariants

- [x] Tests written alongside implementation (6 sidebar SSR tests: an-1 to an-6).
- [x] Every access-control decision has at least one negative test (an-2, an-3, an-4, an-5).
- [x] Sidebar integration tests use `buildSidebarModelUncached`.
- [ ] RLS tests run against real Postgres — no new tables created in base; existing tables have existing RLS.
- [x] `clearPermissionRegexCache()` called in `afterEach` in the sidebar-ssr test file.

### UX vs. Security Boundary

- [x] Sidebar is a UX boundary, not a security boundary.
- [x] Every route has a server-side guard independent of sidebar visibility (layout + page-level checks).
- [x] Server actions (getOrgActivityAction, getAuditFeedAction) already have their own permission checks.

### Fail-Closed Principles

- [x] `entitlements.requireModuleOrRedirect(MODULE_ANALYTICS)` throws if entitlements missing.
- [x] `checkPermission` denies if permission missing.
- [x] Permission checks use deny-first semantics (inherited from checkPermission utility).

### No Raw Strings Rule

- [x] All permission slugs in TypeScript imported from `@/lib/constants/permissions`.
- [x] All module slugs in TypeScript imported from `@/lib/constants/modules`.
- [x] Sidebar registry uses imported constants (enforced by existing registry.test.ts).
- [x] Raw strings only in SQL migration (acceptable).

---

## 2. Module Specification Inputs

### Identity

```
Module name (human):       Analytics & Reports
Module slug (kebab-case):  analytics
Constant name:             MODULE_ANALYTICS
File prefix:               analytics
v2_ready status:           [x] v2_ready
```

### Routes

```
Route path                              Guard type
/dashboard/analytics                    both (MODULE_ANALYTICS entitlement + ANALYTICS_READ)
/dashboard/analytics/activity           both (layout gate + ANALYTICS_ACTIVITY_READ)
/dashboard/analytics/audit              both (layout gate + ANALYTICS_AUDIT_READ)
```

### Data Ownership & Scoping

```
Primary scope:             [x] organization
organization_id required:  [x] Yes
branch_id required:        [ ] No (activity/audit are org-scoped)
Multi-branch isolation:    [ ] Not applicable for base scope
Soft-delete required:      [ ] No (base has no new tables)
```

### Tables / Entities

```
Table name                    Primary scope    Soft delete    PII/Sensitive
(no new tables in base)       —                —              —
Uses: org_events (activity)   org              No             No
Uses: audit_events (audit)    org              No             Yes (IP, UA)
```

### Permission Matrix

```
Route / Server Action                  Permission slug(s) required        Deny effect
/dashboard/analytics (layout)          module.analytics.access            Redirect to access-denied
/dashboard/analytics (page)            analytics.read                     Redirect to access-denied
/dashboard/analytics/activity          analytics.activity.read            Redirect to access-denied
/dashboard/analytics/audit             analytics.audit.read               Redirect to access-denied
getOrgActivityAction                   (action has own auth guard)         Error result
getAuditFeedAction                     (action has own auth guard)         Error result
```

### Entitlement Gating

```
Is this module plan-gated?                   [x] Yes
Plans that include this module:              [ ] Free   [x] Professional   [x] Enterprise
Add-on gated?                                [ ] No
Manual override supported?                   [ ] No (standard entitlements)
Module slug added to subscription_plans?     [x] Done (migration 20260525100000)
```

### Limits

```
(No limits defined in base scope — future: analytics.monthly_exports already in LIMIT_KEYS)
```

### i18n Keys Required

```
Sidebar title key:        modules.analytics.titleSidebar            [x] Done
Page title keys:          modules.analytics.pages.overview.title    [x] Done
                          modules.analytics.pages.activity.title    [x] Done
                          modules.analytics.pages.audit.title       [x] Done
Error message keys:       modules.analytics.errors.loadFailed       [x] Done
Other keys needed:        modules.analytics.items.activity          [x] Done
                          modules.analytics.items.audit             [x] Done
                          modules.analytics.items.overview          [x] Done
```

---

## 3. Repo Integration Map

### A. Constants & Types

- [x] `MODULE_ANALYTICS` — already existed in `packages/contracts/src/modules.ts`
- [x] `MODULE_ANALYTICS_ACCESS` added to `packages/contracts/src/permissions.ts`
- [x] `ANALYTICS_WILDCARD`, `ANALYTICS_READ`, `ANALYTICS_ACTIVITY_READ`, `ANALYTICS_AUDIT_READ`, `ANALYTICS_REPORTS_READ`, `ANALYTICS_EXPORTS_MANAGE` added
- [x] `PermissionSlug` union updated
- [x] `ALL_PERMISSION_SLUGS` array updated

### B. Database Schema

- [x] No new tables needed for base scope
- [x] Migration created: `supabase/migrations/20260525100000_analytics_module.sql`

### C. RLS & Security

- [x] No new tables, no new RLS needed
- [x] Existing audit/activity tables already have RLS

### D. Permissions (RBAC V2)

- [x] Permission rows seeded in migration
- [x] `analytics.*` wildcard granted to `org_owner`
- [x] `module.analytics.access` covered by `module.*` wildcard on `org_owner`
- [x] `org_member` receives nothing by default (premium module — admin assigns)

### E. Entitlements

- [x] `professional` plan updated to include `"analytics"` in `enabled_modules`
- [x] `enterprise` plan updated to include `"analytics"` in `enabled_modules`

### F. Server Guards

- [x] Layout: `entitlements.requireModuleOrRedirect(MODULE_ANALYTICS)`
- [x] Layout: `checkPermission(snapshot, MODULE_ANALYTICS_ACCESS)`
- [x] Overview page: `checkPermission(snapshot, ANALYTICS_READ)`
- [x] Activity page: `checkPermission(snapshot, ANALYTICS_ACTIVITY_READ)`
- [x] Audit page: `checkPermission(snapshot, ANALYTICS_AUDIT_READ)`

### G. Sidebar V2

- [x] Analytics section added to `src/lib/sidebar/v2/registry.ts`
- [x] `organization.activity` and `organization.audit` items removed from org section
- [x] All permission/module references use imported constants
- [x] Icon keys: `barChart`, `activity`, `shield`

### H. Tests

- [x] 6 sidebar SSR tests added to `sidebar-ssr.test.tsx` (an-1 to an-6)
- [ ] Unit tests for analytics service layer (no service yet — future)
- [ ] RLS integration tests (no new tables — future)

### I. i18n / UX

- [x] `modules.analytics.titleSidebar` added to `en.json` and `pl.json`
- [x] `items.overview`, `items.activity`, `items.audit` added
- [x] `pages.*`, `empty.*`, `errors.*` added
- [x] Routes added to `src/i18n/routing.ts`

### J. Module Metadata

- [x] `src/modules/analytics/config.ts` created
- [x] `src/modules/analytics/MODULE.md` created
- [x] `src/modules/analytics/MODULE_CHECKLIST.md` (this file)

---

## 4. Definition of Done

- [x] Module constant exists and is typed
- [x] Permission constants exist, match DB migration slugs
- [x] Module config created
- [x] Entitlement gate in layout (plan + user)
- [x] At least one route works end-to-end server-side
- [x] Sidebar item appears for entitled users, hidden for unentitled
- [x] Old routes (org/activity, org/audit) redirect to new routes
- [x] i18n keys present in both locales
- [x] Sidebar SSR tests added (6 tests)
- [x] No raw permission/module strings in TypeScript
- [ ] Type-check passes (verify with `pnpm type-check`)
- [ ] Tests pass (verify with `pnpm test`)

---

## 5. Future Scope (Out of Base)

The following are explicitly out of scope for this base implementation:

- [ ] Reports listing page (`/dashboard/analytics/reports`)
- [ ] Report generation engine
- [ ] Data export UI (`analytics.exports.manage`)
- [ ] Analytics dashboards and charts
- [ ] Operational insights across modules
- [ ] `analytics.monthly_exports` limit enforcement
- [ ] Service layer (`src/server/services/analytics.service.ts`)
- [ ] Target DB migration (mirror `20260525100000` in `supabase-target/supabase/migrations/`)

---

## 6. Common Failure Modes Checklist

- [x] Permission slug in TS matches slug in migration SQL (verified: `analytics.read` etc.)
- [x] Module slug in TS matches slug in subscription_plans (`analytics`)
- [x] Sidebar uses `requiresModules` array, not a string (checked)
- [x] Layout calls `requireModuleOrRedirect`, not `requireModuleAccess` (correct for pages)
- [x] Old routes converted to redirects, not deleted (404 avoided)
- [x] No sonner imports (using no toasts in base pages)
- [ ] Target DB migration not yet created — apply separately before deploying to production
