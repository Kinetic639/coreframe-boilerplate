# Workshop Module

## Identity

| Field         | Value                                      |
| ------------- | ------------------------------------------ |
| Module slug   | `workshop`                                 |
| Constant      | `MODULE_WORKSHOP`                          |
| Theme colour  | `#f59e0b` (amber)                          |
| Plan gate     | Professional / Enterprise                  |
| Icon          | `Car` (lucide-react) — iconKey `"car"`     |
| Sidebar group | `workspace` (below Warehouse, above Tools) |

---

## Purpose

Central hub for automotive workshop operations — repair shops, car body workshops, and service centres.

---

## Scope: Now (base foundation only)

- Module shell at `/dashboard/workshop`
- SSR overview page with coming-soon feature cards
- Entitlement gate (Professional / Enterprise)
- User permission gate (`module.workshop.access`)
- Page-level read guard (`workshop.read`)
- Sidebar V2 entry in the workspace group
- i18n (EN + PL) for all keys in use
- Polish route: `/dashboard/warsztat`
- DB migration: permissions + org_owner wildcard + plan updates

---

## Scope: Future (not yet implemented)

- Repair orders (`/dashboard/workshop/repairs`)
- Vehicle intake and management (`/dashboard/workshop/vehicles`)
- Insurance claims handling (`/dashboard/workshop/claims`)
- Parts ordering and allocation (`/dashboard/workshop/parts`)
- Mechanic task management (`/dashboard/workshop/tasks`)
- Client handover flow
- Replacement / loan vehicle management
- Workshop analytics and reporting
- Quality control flow
- Client communication timeline

---

## Routes

| Route                 | Polish alias          | Guard                                                                       |
| --------------------- | --------------------- | --------------------------------------------------------------------------- |
| `/dashboard/workshop` | `/dashboard/warsztat` | layout: `MODULE_WORKSHOP` + `MODULE_WORKSHOP_ACCESS`; page: `WORKSHOP_READ` |

Future routes (not yet created):

- `/dashboard/workshop/repairs`
- `/dashboard/workshop/vehicles`
- `/dashboard/workshop/claims`
- `/dashboard/workshop/parts`
- `/dashboard/workshop/tasks`
- `/dashboard/workshop/settings`

---

## Permissions

| Constant                 | Slug                     | Purpose                                           |
| ------------------------ | ------------------------ | ------------------------------------------------- |
| `MODULE_WORKSHOP_ACCESS` | `module.workshop.access` | User-level module gate (assigned in roles editor) |
| `WORKSHOP_WILDCARD`      | `workshop.*`             | Org-owner wildcard — compiler expands at runtime  |
| `WORKSHOP_READ`          | `workshop.read`          | View module overview and read-only data           |
| `WORKSHOP_MANAGE`        | `workshop.manage`        | Manage workshop settings (future)                 |

Future permissions (pre-seeded via wildcard, constants not yet added):

- `workshop.repairs.read` / `workshop.repairs.manage`
- `workshop.vehicles.read` / `workshop.vehicles.manage`
- `workshop.claims.read` / `workshop.claims.manage`
- `workshop.tasks.read` / `workshop.tasks.manage`

---

## Default Role Grants

| Role         | Grant        | How                                                 |
| ------------ | ------------ | --------------------------------------------------- |
| `org_owner`  | `workshop.*` | Wildcard via migration; compiler expands at runtime |
| `org_member` | none         | Admin must grant explicitly via roles editor        |

Note: `org_owner` already holds `module.*` wildcard which covers `module.workshop.access`.
No explicit `module.workshop.access` grant is needed for `org_owner`.

---

## Entitlement Gate

Two layers enforced in `layout.tsx`:

1. **Plan-level** — `entitlements.requireModuleOrRedirect(MODULE_WORKSHOP)`
   - Org's subscription must include `"workshop"` in `enabled_modules`
   - Professional and Enterprise plans updated by migration
   - Free plan: no workshop access
2. **User-level** — `checkPermission(snapshot, MODULE_WORKSHOP_ACCESS)`
   - User must hold `module.workshop.access`
   - Redirect to `/dashboard/access-denied?reason=module_access&module=workshop` if missing

Page-level:

- `/dashboard/workshop` additionally checks `WORKSHOP_READ`
- Redirect to `/dashboard/access-denied?reason=workshop_read_required` if missing

---

## Sidebar Registration

File: `src/lib/sidebar/v2/registry.ts`

```
Group:    workspace  (between Warehouse and Tools)
Item id:  workshop
iconKey:  car
href:     /dashboard/workshop
match:    { startsWith: "/dashboard/workshop" }
Visibility:
  requiresModules:     [MODULE_WORKSHOP]
  requiresPermissions: [MODULE_WORKSHOP_ACCESS]
```

---

## i18n Keys

Namespace: `modules.workshop`

| Key                       | EN                                               | PL                                                      |
| ------------------------- | ------------------------------------------------ | ------------------------------------------------------- |
| `title`                   | Workshop                                         | Warsztat                                                |
| `titleSidebar`            | Workshop                                         | Warsztat                                                |
| `description`             | Manage automotive repairs, workshop processes, … | Zarządzaj naprawami pojazdów i procesami warsztatowymi. |
| `items.overview`          | Overview                                         | Przegląd                                                |
| `pages.overview.title`    | Workshop                                         | Warsztat                                                |
| `pages.overview.subtitle` | Manage automotive repairs, …                     | Zarządzaj naprawami pojazdów …                          |
| `features.repairs`        | Repairs                                          | Naprawy                                                 |
| `features.vehicles`       | Vehicles                                         | Pojazdy                                                 |
| `features.claims`         | Insurance Claims                                 | Szkody ubezpieczeniowe                                  |
| `features.parts`          | Parts & Inventory                                | Części i magazyn                                        |
| `features.tasks`          | Mechanic Tasks                                   | Zadania mechaników                                      |
| `features.handover`       | Client Handover                                  | Wydanie pojazdu klientowi                               |
| `features.comingSoon`     | Coming soon                                      | Wkrótce                                                 |
| `empty.noData`            | No workshop data available                       | Brak danych warsztatu                                   |
| `empty.noDataDescription` | Start by configuring your workshop settings.     | Zacznij od skonfigurowania ustawień warsztatu.          |
| `errors.loadFailed`       | Failed to load workshop data                     | Nie udało się załadować danych warsztatu                |

---

## Files Created / Modified

### Created

| File                                                     | Purpose                                 |
| -------------------------------------------------------- | --------------------------------------- |
| `supabase/migrations/20260525110000_workshop_module.sql` | Permissions + plan updates              |
| `src/modules/workshop/config.ts`                         | ModuleConfig (metadata only)            |
| `src/modules/workshop/MODULE.md`                         | This document                           |
| `src/modules/workshop/MODULE_CHECKLIST.md`               | Implementation checklist                |
| `src/app/[locale]/dashboard/workshop/layout.tsx`         | Two-layer entitlement + permission gate |
| `src/app/[locale]/dashboard/workshop/page.tsx`           | SSR overview page                       |
| `src/app/[locale]/dashboard/workshop/loading.tsx`        | Suspense fallback skeleton              |
| `src/app/[locale]/dashboard/workshop/error.tsx`          | Client error boundary                   |

### Modified

| File                                                        | Change                                                   |
| ----------------------------------------------------------- | -------------------------------------------------------- |
| `packages/contracts/src/modules.ts`                         | Added `MODULE_WORKSHOP`, `ModuleSlug`, `PREMIUM_MODULES` |
| `packages/contracts/src/permissions.ts`                     | Added 4 workshop constants + union + array               |
| `src/lib/types/v2/sidebar.ts`                               | Added `"car"` to `IconKey`                               |
| `src/lib/sidebar/v2/icon-map.ts`                            | Added `Car` lucide import + `car` mapping                |
| `src/lib/sidebar/v2/registry.ts`                            | Added workshop sidebar entry (workspace group)           |
| `src/i18n/routing.ts`                                       | Added `/dashboard/workshop` route                        |
| `messages/en.json`                                          | Added `modules.workshop` translations                    |
| `messages/pl.json`                                          | Added `modules.workshop` translations                    |
| `src/app/[locale]/dashboard/__tests__/sidebar-ssr.test.tsx` | Added ws-1 through ws-4 tests                            |

---

## Database Tables Created

None. Business-domain tables (repairs, vehicles, claims, parts, tasks) are deferred until each feature is designed and implemented.

---

## Tests Added

| Test ID | Description                                                        |
| ------- | ------------------------------------------------------------------ |
| ws-1    | Workshop visible when `MODULE_WORKSHOP` entitled + user has access |
| ws-2    | Workshop hidden when `MODULE_WORKSHOP` not in `enabled_modules`    |
| ws-3    | Workshop hidden when user lacks `module.workshop.access`           |
| ws-4    | Workshop hidden when entitlements are `null` (fail-closed)         |

---

## Known Future Work

- Implement repair order feature (DB tables, service, actions, UI)
- Implement vehicle intake forms and vehicle management
- Implement insurance claim handling
- Implement parts ordering and allocation from Warehouse module
- Implement mechanic task assignment and tracking
- Implement client handover flow
- Add `workshop.repairs.read`, `workshop.vehicles.read`, etc. constants when needed
- Add sidebar children for each implemented sub-route
- Add workshop analytics and reporting
