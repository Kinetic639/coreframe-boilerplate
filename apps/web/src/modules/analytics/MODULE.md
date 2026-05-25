# Analytics & Reports Module

## Overview

The Analytics & Reports module provides the foundation for activity feeds, audit logs, and future reporting capabilities. It is a **Premium module** available on Professional and Enterprise subscription plans.

---

## Identity

| Field           | Value                                               |
| --------------- | --------------------------------------------------- |
| Module slug     | `analytics`                                         |
| Module constant | `MODULE_ANALYTICS` (from `@/lib/constants/modules`) |
| Theme colour    | `#8b5cf6` (violet)                                  |
| Plan gate       | Professional / Enterprise                           |
| Icon            | `BarChart2` (lucide-react)                          |

---

## Routes

| Route                           | Polish route                     | Guard                                   | Description                                                                |
| ------------------------------- | -------------------------------- | --------------------------------------- | -------------------------------------------------------------------------- |
| `/dashboard/analytics`          | `/dashboard/analityka`           | Layout gate + `ANALYTICS_READ`          | Module overview shell                                                      |
| `/dashboard/analytics/activity` | `/dashboard/analityka/aktywnosc` | Layout gate + `ANALYTICS_ACTIVITY_READ` | Organisation activity feed (moved from `/dashboard/organization/activity`) |
| `/dashboard/analytics/audit`    | `/dashboard/analityka/audyt`     | Layout gate + `ANALYTICS_AUDIT_READ`    | Full audit event log (moved from `/dashboard/organization/audit`)          |

### Redirects from old routes

| Old route                          | Redirects to                    |
| ---------------------------------- | ------------------------------- |
| `/dashboard/organization/activity` | `/dashboard/analytics/activity` |
| `/dashboard/organization/audit`    | `/dashboard/analytics/audit`    |

---

## Permissions

All permission constants are in `@/lib/constants/permissions` (re-exported from `@repo/contracts/permissions`).

| Constant                   | Slug                       | Description                                                    |
| -------------------------- | -------------------------- | -------------------------------------------------------------- |
| `MODULE_ANALYTICS_ACCESS`  | `module.analytics.access`  | User-level gate — assigned by org admin to grant module access |
| `ANALYTICS_WILDCARD`       | `analytics.*`              | Org-owner wildcard — compiler expands at runtime               |
| `ANALYTICS_READ`           | `analytics.read`           | Read gate for the overview page                                |
| `ANALYTICS_ACTIVITY_READ`  | `analytics.activity.read`  | Read gate for the activity feed                                |
| `ANALYTICS_AUDIT_READ`     | `analytics.audit.read`     | Read gate for the audit log                                    |
| `ANALYTICS_REPORTS_READ`   | `analytics.reports.read`   | Read gate for reports (future)                                 |
| `ANALYTICS_EXPORTS_MANAGE` | `analytics.exports.manage` | Gate for data export (future)                                  |

### Default role grants

| Role         | Permissions granted                                                                                                |
| ------------ | ------------------------------------------------------------------------------------------------------------------ |
| `org_owner`  | `analytics.*` wildcard (compiler expands to all concrete slugs); `module.analytics.access` via `module.*` wildcard |
| `org_member` | None by default — admin must grant explicitly                                                                      |

Seeded in `supabase/migrations/20260525100000_analytics_module.sql`.

---

## Entitlement Gate

The analytics layout (`/dashboard/analytics/layout.tsx`) enforces two gates:

1. **Plan-level** — `entitlements.requireModuleOrRedirect(MODULE_ANALYTICS)`: org's subscription must include `"analytics"` in `enabled_modules`.
2. **User-level** — `checkPermission(snapshot, MODULE_ANALYTICS_ACCESS)`: user must hold `module.analytics.access`.

Subscription plans updated in migration:

- `professional` → `analytics` added to `enabled_modules`
- `enterprise` → `analytics` added to `enabled_modules`
- `free` → analytics NOT included

---

## Sidebar Registration

File: `src/lib/sidebar/v2/registry.ts`

```
analytics (group)
├── analytics.overview  → /dashboard/analytics          (ANALYTICS_READ)
├── analytics.activity  → /dashboard/analytics/activity (ANALYTICS_ACTIVITY_READ)
└── analytics.audit     → /dashboard/analytics/audit    (ANALYTICS_AUDIT_READ)
```

Group visibility: `requiresModules: [MODULE_ANALYTICS]` + `requiresPermissions: [MODULE_ANALYTICS_ACCESS]`

---

## Moved Pages

### Organisation Activity → Analytics Activity

- **Old path:** `src/app/[locale]/dashboard/organization/activity/page.tsx`
- **New path:** `src/app/[locale]/dashboard/analytics/activity/page.tsx`
- **Old page:** Converted to a server-side redirect → `/dashboard/analytics/activity`
- **Wrapper component:** `OrgActivityWrapper` (unchanged, stays at original path — uses absolute `@/` import)
- **Permission change:** `ORG_READ` → `ANALYTICS_ACTIVITY_READ`

### Organisation Audit → Analytics Audit

- **Old path:** `src/app/[locale]/dashboard/organization/audit/page.tsx`
- **New path:** `src/app/[locale]/dashboard/analytics/audit/page.tsx`
- **Old page:** Converted to a server-side redirect → `/dashboard/analytics/audit`
- **Wrapper component:** `AuditFeedWrapper` (unchanged, stays at original path — uses absolute `@/` import)
- **Permission change:** `AUDIT_EVENTS_READ` → `ANALYTICS_AUDIT_READ`

---

## Files Touched

### Created

- `supabase/migrations/20260525100000_analytics_module.sql` — permissions + plan updates
- `packages/contracts/src/permissions.ts` — 7 new permission constants + PermissionSlug union + ALL_PERMISSION_SLUGS
- `src/modules/analytics/config.ts` — module metadata
- `src/modules/analytics/MODULE.md` — this file
- `src/modules/analytics/MODULE_CHECKLIST.md` — implementation checklist
- `src/app/[locale]/dashboard/analytics/layout.tsx` — plan + user-level gate
- `src/app/[locale]/dashboard/analytics/page.tsx` — overview shell
- `src/app/[locale]/dashboard/analytics/loading.tsx` — Suspense fallback
- `src/app/[locale]/dashboard/analytics/error.tsx` — error boundary
- `src/app/[locale]/dashboard/analytics/activity/page.tsx` — activity page
- `src/app/[locale]/dashboard/analytics/audit/page.tsx` — audit page

### Modified

- `src/lib/sidebar/v2/registry.ts` — added analytics section, removed org activity/audit items
- `src/i18n/routing.ts` — added `/dashboard/analytics`, `/dashboard/analytics/activity`, `/dashboard/analytics/audit`
- `messages/en.json` — added `titleSidebar`, `items.activity`, `items.audit`, `pages.*`, `empty.*`, `errors.*` under `modules.analytics`
- `messages/pl.json` — same in Polish
- `src/app/[locale]/dashboard/organization/activity/page.tsx` — replaced with server-side redirect
- `src/app/[locale]/dashboard/organization/audit/page.tsx` — replaced with server-side redirect
- `src/app/[locale]/dashboard/__tests__/sidebar-ssr.test.tsx` — added 6 analytics tests (an-1 to an-6)

---

## Tests

Added in `src/app/[locale]/dashboard/__tests__/sidebar-ssr.test.tsx`:

| Test ID | Description                                                                                          |
| ------- | ---------------------------------------------------------------------------------------------------- |
| an-1    | Analytics group visible when module entitled + user has `module.analytics.access` + `analytics.read` |
| an-2    | Analytics group hidden when `analytics` NOT in `enabled_modules`                                     |
| an-3    | Analytics group hidden when user lacks `module.analytics.access`                                     |
| an-4    | `analytics.activity` hidden when user lacks `analytics.activity.read`                                |
| an-5    | `analytics.audit` hidden when user lacks `analytics.audit.read`                                      |
| an-6    | `organization.activity` and `organization.audit` no longer appear in sidebar (regression guard)      |

---

## i18n Keys

Added under `modules.analytics` in `messages/en.json` and `messages/pl.json`:

- `titleSidebar` — sidebar label
- `items.activity` — activity nav label
- `items.audit` — audit nav label
- `items.overview` — overview nav label
- `pages.overview.title/subtitle`
- `pages.activity.title/subtitle`
- `pages.audit.title/subtitle`
- `empty.noData/noDataDescription`
- `errors.loadFailed`

New pathnames in `src/i18n/routing.ts`:

- `/dashboard/analytics` → `pl: /dashboard/analityka`
- `/dashboard/analytics/activity` → `pl: /dashboard/analityka/aktywnosc`
- `/dashboard/analytics/audit` → `pl: /dashboard/analityka/audyt`

---

## Known Future Scope

The following are **not yet implemented** and are outside the current base scope:

- Reports listing and generation (`analytics.reports.read`, `analytics.exports.manage`)
- Analytics dashboards and charts
- Data export functionality
- Operational insights across modules
- `analytics.reports.read` and `analytics.exports.manage` permissions are seeded in the DB and constants are defined — ready for future pages

When adding report/export pages, add routes to `routing.ts`, new sidebar children, and corresponding i18n keys. No DB schema changes needed unless report storage is required.
