# MODULE_IMPLEMENTATION_CHECKLIST.md — `warehouse`

> **Filled in** for the `warehouse` module, Phase 1 — Locations.
> Corrective pass completed 2026-04-02.
>
> This checklist encodes the invariants of the Coreframe V2 architecture:
> SSR-First · TDD-First · Security-First · Compiled permissions · Compiled entitlements · Sidebar V2

---

## 1. Purpose & Non-Negotiables

### SSR-First Invariants

- [x] Server Components are authoritative. They compute data, authorization, and sidebar model before the page renders.
  > ✅ `warehouse/locations/page.tsx` is an async Server Component. Calls `loadDashboardContextV2()`, checks permissions, fetches `initialLocations` via `WarehouseLocationsService.listByBranch`. Passes result as prop to `LocationsClient`.
- [x] Client Components are dumb renderers. They accept pre-computed props. They do not re-evaluate permissions.
  > ✅ `LocationsClient` receives `initialLocations[]` as prop. React Query hydrates from this. Permissions are re-checked via `usePermissions()` for UX gating only (button visibility), never for security decisions.
- [x] The dashboard layout loads the authoritative context once (via `loadDashboardContextV2()`), not repeated per page.
  > ✅ `React.cache()`-wrapped. Warehouse layout and page each call it; only one DB round-trip per request.
- [x] `buildSidebarModel()` runs server-side.
- [x] No `createClient()` / Supabase client instantiation in Client Components for warehouse data.
  > ✅ All mutations go through server actions. `LocationsClient` uses React Query hooks that call server actions.

### TDD-First Invariants

- [x] Every access-control decision has at least one negative test (prove it fails closed).
  > ✅ `locations.test.ts` covers: missing MODULE_WAREHOUSE_ACCESS, missing WAREHOUSE_READ, missing WAREHOUSE_LOCATIONS_READ, missing WAREHOUSE_LOCATIONS_MANAGE, no activeBranchId (create, update, delete), cross-branch delete denial.
- [x] Sidebar integration tests cover warehouse items.
  > ✅ `sidebar-ssr.test.tsx` includes warehouse/locations visibility tests gated on MODULE_WAREHOUSE + WAREHOUSE_LOCATIONS_READ.
- [x] RLS / branch-isolation tests exist in the service test file.
  > ✅ `warehouse-locations.service.test.ts` includes RLS simulation tests (makeRlsDeniedClient for SELECT, INSERT, UPDATE), cycle detection tests, soft-delete child reparent verification, level cascade verification.

### UX vs. Security Boundary

- [x] Understood: the sidebar is a UX boundary, not a security boundary.
- [x] Every route that hides a link in the sidebar also has a server-side guard that enforces access independently.
  > ✅ `warehouse/layout.tsx`: plan gate + `MODULE_WAREHOUSE_ACCESS`. `warehouse/locations/page.tsx`: `WAREHOUSE_READ` + `WAREHOUSE_LOCATIONS_READ`.
- [x] Every server action behind a hidden sidebar item also has a permission check.
  > ✅ All 5 actions in `src/app/actions/warehouse/locations.ts`.

### Fail-Closed Principles

- [x] If entitlement missing, `entitlements.requireModuleAccess(MODULE_WAREHOUSE)` throws → mapped to `{ success: false, error: "..." }` in action catch.
- [x] If permission snapshot missing matching permission, access is denied in `requireWarehouseContext()`.
- [x] `updateLocationAction` and `deleteLocationAction` fail closed when `activeBranchId` is absent.
- [x] `deleteLocationAction` fails closed when location's `branch_id` doesn't match `activeBranchId`.
- [x] RLS policies are the final boundary — server actions cannot bypass.
- [x] Permission checks use deny-first semantics (deny entries override allow, wildcards respected via compiled snapshot).

### No Raw Strings Rule

- [x] TypeScript code never contains raw permission strings — all constants from `src/lib/constants/permissions.ts`.
- [x] TypeScript code never contains raw module strings — `MODULE_WAREHOUSE` from `src/lib/constants/modules.ts`.

---

## 2. Entitlements System

### Module Access

- [x] Module slug `"warehouse"` matches constant `MODULE_WAREHOUSE` in `packages/contracts/src/modules.ts`.
- [x] `entitlements.requireModuleOrRedirect(MODULE_WAREHOUSE)` used in `warehouse/layout.tsx`.
- [x] All server actions call `entitlements.requireModuleAccess(MODULE_WAREHOUSE)` inside `requireWarehouseContext()`.
- [x] Sidebar item has `requiresModules: [MODULE_WAREHOUSE]`.

---

## 3. Permission System

### Permission Constants

- [x] `MODULE_WAREHOUSE_ACCESS` = `"module.warehouse.access"` in `@repo/contracts/permissions`.
- [x] `WAREHOUSE_READ` = `"warehouse.read"` in `@repo/contracts/permissions`.
- [x] `WAREHOUSE_LOCATIONS_READ` = `"warehouse.locations.read"` in `@repo/contracts/permissions`.
- [x] `WAREHOUSE_LOCATIONS_MANAGE` = `"warehouse.locations.manage"` in `@repo/contracts/permissions`.
- [x] All constants in `ALL_PERMISSION_SLUGS`.
- [x] `WAREHOUSE_LOCATIONS_READ` and `WAREHOUSE_LOCATIONS_MANAGE` registered in `rls-permission-invariants.test.ts` as RLS gate slugs.

### V2 Guard Pattern

- [x] `checkPermission(context.user.permissionSnapshot, PERM)` — synchronous snapshot-based check used throughout.
- [x] No `PermissionServiceV2.currentUserHasPermission` calls.

### RLS

- [x] `warehouse_locations` table has RLS enabled and FORCE ROW LEVEL SECURITY.
- [x] SELECT policy uses `has_branch_permission` (branch-aware) + `deleted_at IS NULL`.
- [x] INSERT policy uses `has_branch_permission` (branch-aware).
- [x] UPDATE policy uses `has_branch_permission` for both USING and WITH CHECK.
- [x] DELETE policy is `false` — hard deletes blocked.
- [x] RLS policies use non-wildcard permission slugs (verified by `rls-permission-invariants.test.ts`).

---

## 4. Database

### Table

- [x] `warehouse_locations` table created with all required columns, constraints, and indexes.
- [x] `updated_at` trigger attached (uses `public.set_updated_at()`).
- [x] Partial unique index on `code` per org+branch+parent scope (when `code IS NOT NULL` and `deleted_at IS NULL`).
- [x] `wl_no_self_parent` CHECK constraint in DB.

### Hierarchy Integrity

- [x] Self-parent blocked: `CHECK (parent_id IS DISTINCT FROM id)` in DB + service-level check.
- [x] Cycle prevention: `wouldCreateCycle()` private helper in service rejects reparenting into descendants.
- [x] Level consistency: `cascadeDescendantLevels()` private helper updates all descendant levels after reparent.
- [x] Soft-delete child handling: direct children explicitly reparented to root (parent_id=NULL, level=0); grandchildren levels cascaded. FK `ON DELETE SET NULL` does NOT fire for soft-delete UPDATEs — documented in service comment.

### Migrations

- [x] `supabase/migrations/20260401120000_warehouse_locations.sql` — initial schema + base RLS
- [x] `supabase/migrations/20260401130000_warehouse_locations_rls_hardening.sql` — branch-aware RLS

---

## 5. Service Layer

- [x] `server-only` import present.
- [x] `ServiceResult<T>` discriminated union returned by all methods.
- [x] Never throws to callers — all DB errors mapped to `{ success: false, error }`.
- [x] No stock, movement, document, or product coupling.

---

## 6. Validation

- [x] Zod schemas in `src/app/actions/warehouse/schemas.ts`.
- [x] `createLocationSchema`: name required, code alphanumeric max 20, color hex, parent_id UUID optional.
- [x] `updateLocationSchema`: id required UUID, all other fields optional.
- [x] `deleteLocationSchema` and `getLocationSchema`: id UUID.

---

## 7. Server Actions

- [x] `"use server"` directive at top.
- [x] All actions fail closed on entitlement error, permission denial, missing context.
- [x] `create` requires `activeBranchId`.
- [x] `update` requires `activeBranchId`.
- [x] `delete` requires `activeBranchId` + verifies location belongs to active branch.
- [x] All write actions emit audit events (baseline/enhanced tier).

---

## 8. React Query Layer

- [x] `src/hooks/queries/warehouse/index.ts` — query key factory + hooks.
- [x] Mutations invalidate the locations list query on success.
- [x] Toast notifications on mutation success/error.

---

## 9. Sidebar V2

- [x] `warehouse` group item in `MAIN_NAV_ITEMS` with `requiresModules: [MODULE_WAREHOUSE]` + `requiresPermissions: [MODULE_WAREHOUSE_ACCESS]`.
- [x] `warehouse.locations` child item with `requiresPermissions: [WAREHOUSE_LOCATIONS_READ]`.
- [x] No raw strings in registry — all constants imported.

---

## 10. Components

- [x] SSR page passes `initialLocations` to client component.
- [x] `LocationsClient` is a Client Component receiving SSR-seeded data via React Query.
- [x] Permission-gated UX (add/edit/delete buttons hidden when `!canManage`).
- [x] Empty states: no permission, no branch, no locations.
- [x] `LocationFormDialog` handles create and edit modes.

---

## 11. Module Config

- [x] `src/modules/warehouse/config.ts` created with `warehouseModule: ModuleConfig`.
- [x] `MODULE.md` documents all architecture decisions, permissions, RLS, and hierarchy guarantees.
- [x] `MODULE_CHECKLIST.md` (this file) filled in.

---

## 12. Tests

- [x] Service unit tests cover all methods + error paths.
- [x] Service tests include: cycle detection (self=A→descendant), soft-delete children reparent, level cascade, RLS-denied client simulation.
- [x] Action tests cover all permission deny paths + schema validation + happy path delegation.
- [x] Action tests cover: no activeBranchId for update, no activeBranchId for delete, cross-branch delete denial.
- [x] Component tests cover: no permission, no branch, empty, render, dialog, manage gate.
- [x] Sidebar SSR tests cover: module gate + locations permission gate.
- [x] `rls-permission-invariants.test.ts` updated with `WAREHOUSE_LOCATIONS_READ` and `WAREHOUSE_LOCATIONS_MANAGE` as RLS gate slugs.

---

## Definition of Done

- [x] All permission deny paths return `{ success: false, error: "Unauthorized" }` or descriptive error
- [x] RLS is the final boundary — verified by migration + policy assertions in invariant test
- [x] Level values consistent after any mutation
- [x] No raw permission/module strings in TypeScript code
- [x] Module artifacts complete (config.ts, MODULE.md, MODULE_CHECKLIST.md)
- [x] Type-check passes
- [x] Tests pass
