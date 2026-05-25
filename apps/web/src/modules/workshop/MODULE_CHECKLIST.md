# MODULE_IMPLEMENTATION_CHECKLIST.md — Workshop

> Copied from `apps/web/docs/MODULE_CHECKLIST_TEMPLATE.md` on 2026-05-25.
> Do not mark a box unless it is verifiably true.

---

## 1. Purpose & Non-Negotiables

### SSR-First Invariants

- [x] Server Components are authoritative. They compute data, authorization, and sidebar model before the page renders.
- [x] Client Components are dumb renderers. They accept pre-computed props. They do not re-evaluate permissions.
- [x] The dashboard layout loads the authoritative context once (`loadDashboardContextV2()`), not repeated per page.
- [x] `buildSidebarModel()` runs server-side. Production uses the `React.cache()`-wrapped version.
- [x] `React.cache()` provides per-request memoization — never a global singleton cache.
- [x] No `createClient()` / Supabase client instantiation in Client Components for org-scoped data.

### TDD-First Invariants

- [x] Tests are written alongside the implementation.
- [x] Every access-control decision has at least one negative test (ws-2, ws-3, ws-4 prove fail-closed).
- [x] Sidebar integration tests use `buildSidebarModelUncached`.
- [ ] RLS tests run against real Postgres — not applicable for base module (no domain tables).
- [x] `clearPermissionRegexCache()` is called in `afterEach` in the sidebar test file.

### UX vs. Security Boundary

- [x] Understood: the sidebar is a UX boundary, not a security boundary.
- [x] Hiding a sidebar item never prevents direct URL access.
- [x] Every route (`/dashboard/workshop`) has a server-side guard (layout + page).

### Fail-Closed Principles

- [x] Missing entitlements → access denied (ws-4 confirms fail-closed).
- [x] Missing permissions → access denied (ws-3 confirms).
- [x] Permission checks use deny-first semantics.

### No Raw Strings Rule

- [x] No raw permission strings in TypeScript. All use `@/lib/constants/permissions`.
- [x] No raw module strings in TypeScript. All use `@/lib/constants/modules`.

---

## 2. Module Specification Inputs

### Identity

```
Module name (human):       Workshop
Module slug (kebab-case):  workshop
Constant name:             MODULE_WORKSHOP
File prefix:               workshop
v2_ready status:           [x] v2_ready
```

### Routes

```
Route path                     Guard type
/dashboard/workshop            both (module entitlement + permission)
```

### Permissions

```
Slug                       Constant                  Granted to
workshop.*                 WORKSHOP_WILDCARD          org_owner (wildcard)
workshop.read              WORKSHOP_READ              (via wildcard expansion)
workshop.manage            WORKSHOP_MANAGE            (via wildcard expansion)
module.workshop.access     MODULE_WORKSHOP_ACCESS     (via module.* wildcard on org_owner)
```

### Entitlements

```
Module slug in subscription_plans.enabled_modules:   workshop
Plans with access:   professional, enterprise
Plans without:       free, starter
```

---

## 3. Database Schema

- [x] No domain tables for base module — deferred to feature implementation.
- [x] Permission rows inserted via migration `20260525110000_workshop_module.sql`.

---

## 4. RLS Policies

- [x] Not applicable for base module (no domain tables created).

---

## 5. Permissions (RBAC V2)

- [x] `workshop.*` permission slug seeded in `permissions` table.
- [x] `workshop.read` permission slug seeded.
- [x] `workshop.manage` permission slug seeded.
- [x] `module.workshop.access` permission slug seeded.
- [x] `org_owner` granted `workshop.*` wildcard via migration.
- [x] `org_member` receives no explicit grants — admin assigns via roles editor.
- [x] Constants added to `packages/contracts/src/permissions.ts`.
- [x] Constants added to `PermissionSlug` union type.
- [x] Constants added to `ALL_PERMISSION_SLUGS` array.

---

## 6. Entitlements

- [x] `MODULE_WORKSHOP` constant added to `packages/contracts/src/modules.ts`.
- [x] Added to `ModuleSlug` union type.
- [x] Added to `PREMIUM_MODULES` array.
- [x] `professional` plan updated to include `'workshop'` in `enabled_modules`.
- [x] `enterprise` plan updated to include `'workshop'` in `enabled_modules`.
- [x] `entitlements.requireModuleOrRedirect(MODULE_WORKSHOP)` called in `layout.tsx`.

---

## 7. Server Guards

- [x] Layout `layout.tsx`: Gate 1 — `entitlements.requireModuleOrRedirect(MODULE_WORKSHOP)`.
- [x] Layout `layout.tsx`: Gate 2 — `checkPermission(snapshot, MODULE_WORKSHOP_ACCESS)`.
- [x] Page `page.tsx`: `checkPermission(snapshot, WORKSHOP_READ)`.
- [x] Redirects to `/dashboard/access-denied` with appropriate `reason` query param.

---

## 8. Sidebar V2 Registry

- [x] Workshop entry added to `src/lib/sidebar/v2/registry.ts`.
- [x] Group: `workspace` (between Warehouse and Tools).
- [x] `requiresModules: [MODULE_WORKSHOP]` — plan gate.
- [x] `requiresPermissions: [MODULE_WORKSHOP_ACCESS]` — user gate.
- [x] `iconKey: "car"` — new icon added to `IconKey` type and `ICON_MAP`.
- [x] No raw strings in registry.

---

## 9. Tests

- [x] ws-1: Workshop visible when entitled + user has access.
- [x] ws-2: Workshop hidden when not in `enabled_modules`.
- [x] ws-3: Workshop hidden when user lacks `module.workshop.access`.
- [x] ws-4: Workshop hidden when entitlements are `null` (fail-closed).
- [ ] Page guard tests — deferred (requires route-level integration test setup).
- [ ] RLS integration tests — not applicable for base module.

---

## 10. i18n Keys

- [x] `modules.workshop.title` — EN + PL.
- [x] `modules.workshop.titleSidebar` — EN + PL.
- [x] `modules.workshop.description` — EN + PL.
- [x] `modules.workshop.items.overview` — EN + PL.
- [x] `modules.workshop.pages.overview.title` — EN + PL.
- [x] `modules.workshop.pages.overview.subtitle` — EN + PL.
- [x] `modules.workshop.features.*` — EN + PL (6 feature cards + comingSoon).
- [x] `modules.workshop.empty.*` — EN + PL.
- [x] `modules.workshop.errors.*` — EN + PL.
- [x] i18n route `/dashboard/workshop` → `/dashboard/warsztat` added to `routing.ts`.

---

## 11. Release Verification

- [x] `pnpm type-check` passes (workshop-specific).
- [x] Workshop sidebar tests (ws-1 through ws-4) pass.
- [ ] Migration applied to target DB — pending (apply via Supabase MCP if required).
- [ ] Feature smoke-test in browser — pending (requires running dev server).
- [ ] Org entitlement manually updated for dev/test org — pending.

---

## 12. Known Future Work

- Repair orders feature (DB, service, actions, UI)
- Vehicle intake and management
- Insurance claim handling
- Parts ordering and allocation
- Mechanic task management
- Client handover flow
- Replacement / loan vehicle management
- Workshop analytics
- Additional permission constants when sub-features are implemented
- Sidebar children for each sub-route when implemented
