# Warehouse (`warehouse`)

## Purpose

- **What this module does:** Physical warehouse management for organisations that operate branch-level inventory. Phase 1 covers the location hierarchy — the structural backbone for all future stock, movement, and audit features. Locations are branch-scoped nested structures (e.g. Zone → Aisle → Shelf → Bin).
- **Who uses it (roles):** `org_owner` (full manage access via wildcard), `org_member` (read access to locations). Custom roles can receive `warehouse.locations.manage` for write access. Gated by plan entitlement (`MODULE_WAREHOUSE`) and user-level permission (`MODULE_WAREHOUSE_ACCESS`).
- **Primary workflows (Phase 1 — Locations):**
  - View the location hierarchy for the active branch
  - Create root locations and nested child locations
  - Edit location name, code, icon, colour, parent, sort order, description
  - Soft-delete a location (children are explicitly reparented to root)
  - QR code identifier generated once at creation, never modified

## Status

- **Implementation:** ✅ Locations — done (corrective pass 2026-04-02: branch-aware RLS, cycle guard, explicit children reparent, level cascade, module artifacts)
- **Planned/partial:** Products, Audits, Labels, Suppliers, Stock Movements — not yet implemented
- **Last updated:** 2026-04-02
- **Owner:** coreframe

---

## Entitlements

- **Plan-gated:** ✅ `MODULE_WAREHOUSE` (`"warehouse"`) must appear in `organization_entitlements.enabled_modules`
- **Module constant:** `MODULE_WAREHOUSE` in `packages/contracts/src/modules.ts`
- **Where enforced:**
  - Layout gate (plan): `src/app/[locale]/dashboard/warehouse/layout.tsx` → `entitlements.requireModuleOrRedirect(MODULE_WAREHOUSE)`
  - Layout gate (user): same layout → `checkPermission(..., MODULE_WAREHOUSE_ACCESS)` → redirects to `/dashboard/access-denied?reason=module_access`
  - Server actions: all actions call `entitlements.requireModuleAccess(MODULE_WAREHOUSE)` + `MODULE_WAREHOUSE_ACCESS` check in `requireWarehouseContext()`

### Verification checklist

- [x] Module slug `"warehouse"` present in `organization_entitlements.enabled_modules` for all standard plans
- [x] Layout gate enforced via `entitlements.requireModuleOrRedirect`
- [x] User-level module access enforced via `MODULE_WAREHOUSE_ACCESS` permission
- [x] Server actions enforce via `entitlements.requireModuleAccess` (plan) + `MODULE_WAREHOUSE_ACCESS` (user)
- [x] Sidebar item hidden when module not entitled or user lacks `MODULE_WAREHOUSE_ACCESS`

---

## Permissions (Permission Service V2)

### Permission constants used

> No raw strings. All constants from `src/lib/constants/permissions.ts` (re-exports `@repo/contracts/permissions`).

| Action                       | Permission constant          | DB slug                      | Scope         |
| ---------------------------- | ---------------------------- | ---------------------------- | ------------- |
| Module access                | `MODULE_WAREHOUSE_ACCESS`    | `module.warehouse.access`    | org or branch |
| Broad module read            | `WAREHOUSE_READ`             | `warehouse.read`             | org or branch |
| Read locations               | `WAREHOUSE_LOCATIONS_READ`   | `warehouse.locations.read`   | org or branch |
| Create/edit/delete locations | `WAREHOUSE_LOCATIONS_MANAGE` | `warehouse.locations.manage` | org or branch |

Role seeding (migration `20260401120000`):

- `org_owner` → `warehouse.*` wildcard (compiler expands to all concrete slugs)
- `org_member` → `module.warehouse.access`, `warehouse.read`, `warehouse.locations.read`

### Permission scope

All warehouse permissions can be granted at org-scope (applies to all branches) or branch-scope (applies only to that branch). The RLS helper `has_branch_permission(org_id, branch_id, slug)` enforces this: org-level UEP rows (branch_id IS NULL) pass for every branch; branch-specific rows pass only for their branch.

`module.warehouse.access` is intentionally **not** in `ORG_ONLY_SLUGS` so that it can be assigned to branch-specific custom roles in future.

### Guard pattern

```typescript
// ✅ Correct V2 pattern — synchronous, snapshot-based
const canManage = checkPermission(context.user.permissionSnapshot, WAREHOUSE_LOCATIONS_MANAGE);
if (!canManage) return { success: false, error: "Unauthorized" };
```

### Where enforced

- **Server Component (layout):** `warehouse/layout.tsx` → plan gate + `MODULE_WAREHOUSE_ACCESS`
- **Server Component (page):** `warehouse/locations/page.tsx` → `WAREHOUSE_READ` + `WAREHOUSE_LOCATIONS_READ`
- **Server Actions:** all 5 actions in `src/app/actions/warehouse/locations.ts`
  - `requireWarehouseContext()` (shared) → plan + `MODULE_WAREHOUSE_ACCESS` + `WAREHOUSE_READ`
  - `listLocationsAction` → additionally checks `WAREHOUSE_LOCATIONS_READ`
  - `getLocationAction` → additionally checks `WAREHOUSE_LOCATIONS_READ`
  - `createLocationAction` → additionally checks `WAREHOUSE_LOCATIONS_MANAGE`
  - `updateLocationAction` → additionally checks `WAREHOUSE_LOCATIONS_MANAGE` + requires `activeBranchId`
  - `deleteLocationAction` → additionally checks `WAREHOUSE_LOCATIONS_MANAGE` + requires `activeBranchId` + verifies location belongs to active branch
- **Client Components:** `usePermissions()` gates the "Add Location" button and edit/delete controls (UX boundary only — not a security boundary)
- **RLS:** database-enforced on `warehouse_locations` table (see below)

---

## Sidebar V2 Registry

### Navigation entries

| Location | Item id               | Title         | Href                             | requiresModules      | requiresPermissions          |
| -------- | --------------------- | ------------- | -------------------------------- | -------------------- | ---------------------------- |
| MAIN     | `warehouse`           | `"Warehouse"` | (group parent)                   | `[MODULE_WAREHOUSE]` | `[MODULE_WAREHOUSE_ACCESS]`  |
| MAIN (↳) | `warehouse.locations` | `"Locations"` | `/dashboard/warehouse/locations` | inherited            | `[WAREHOUSE_LOCATIONS_READ]` |

File: `src/lib/sidebar/v2/registry.ts`

---

## Data Model

### `warehouse_locations`

Branch-scoped nested location structure.

| Column                      | Type                    | Notes                                                                                  |
| --------------------------- | ----------------------- | -------------------------------------------------------------------------------------- |
| `id`                        | UUID PK                 |                                                                                        |
| `organization_id`           | UUID FK → organizations | Cascade delete                                                                         |
| `branch_id`                 | UUID FK → branches      | Cascade delete; branch is the warehouse boundary                                       |
| `name`                      | TEXT NOT NULL           | Non-empty (CHECK)                                                                      |
| `code`                      | TEXT NULL               | Optional short code (e.g. MG-A-R1). Unique per org+branch when set.                    |
| `description`               | TEXT NULL               |                                                                                        |
| `icon_name`                 | TEXT NULL               | Lucide icon name for UI display                                                        |
| `color`                     | TEXT NULL               | Hex colour for UI display                                                              |
| `parent_id`                 | UUID NULL → self        | Self-parent blocked by CHECK. Cycle prevention in service layer.                       |
| `level`                     | INTEGER ≥ 0             | Depth (0 = root). Always consistent — cascaded by service on reparent and soft-delete. |
| `sort_order`                | INTEGER ≥ 0             | Sibling ordering                                                                       |
| `qr_code`                   | TEXT UNIQUE             | Stable opaque QR identifier, set once at INSERT                                        |
| `created_by` / `updated_by` | UUID NULL → users       | Audit trail                                                                            |
| `created_at` / `updated_at` | TIMESTAMPTZ             | `updated_at` maintained by trigger                                                     |
| `deleted_at`                | TIMESTAMPTZ NULL        | Soft-delete marker                                                                     |

Migrations:

- `supabase/migrations/20260401120000_warehouse_locations.sql` — initial table + permissions + base RLS
- `supabase/migrations/20260401130000_warehouse_locations_rls_hardening.sql` — branch-aware RLS policies

---

## RLS Policies (`warehouse_locations`)

| Operation | Policy name                | Condition                                                                                     |
| --------- | -------------------------- | --------------------------------------------------------------------------------------------- |
| SELECT    | `wl_select_locations_read` | `has_branch_permission(org_id, branch_id, 'warehouse.locations.read') AND deleted_at IS NULL` |
| INSERT    | `wl_insert_manage`         | `has_branch_permission(org_id, branch_id, 'warehouse.locations.manage')`                      |
| UPDATE    | `wl_update_manage`         | USING + WITH CHECK: `has_branch_permission(org_id, branch_id, 'warehouse.locations.manage')`  |
| DELETE    | `wl_delete_deny`           | `false` — blocked; all deletes must go through soft-delete                                    |

`has_branch_permission(org_id, branch_id, slug)` — org-level grants (UEP `branch_id IS NULL`) pass for any branch; branch-specific grants pass only for that branch.

---

## Hierarchy Integrity

| Guard                | Where enforced                      | Behaviour                                                                                                                                  |
| -------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Self-parent          | DB CHECK + service                  | `parent_id IS DISTINCT FROM id`; service returns error before update                                                                       |
| Cycle prevention     | Service (`wouldCreateCycle`)        | Walks ancestor chain from proposed new parent; rejects if current node found                                                               |
| Level consistency    | Service (`cascadeDescendantLevels`) | After any reparent or parent change, all descendant levels are recomputed recursively                                                      |
| Soft-delete children | Service (`softDelete`)              | Direct children explicitly set to `parent_id = NULL, level = 0`; grandchildren cascaded. No dangling parent_id references to deleted rows. |

Note: the `parent_id REFERENCES warehouse_locations(id) ON DELETE SET NULL` FK triggers only on hard DELETE — it does NOT fire for the soft-delete UPDATE. The service handles child reparenting explicitly.

---

## API Surface

### Server Actions (`src/app/actions/warehouse/locations.ts`)

| Action                          | Permission required          | Notes                                                                                                                         |
| ------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `listLocationsAction(branchId)` | `WAREHOUSE_LOCATIONS_READ`   | Returns flat list; caller builds tree                                                                                         |
| `getLocationAction({ id })`     | `WAREHOUSE_LOCATIONS_READ`   | Returns single location or null                                                                                               |
| `createLocationAction(input)`   | `WAREHOUSE_LOCATIONS_MANAGE` | Requires `activeBranchId`; emits `warehouse.location.created`                                                                 |
| `updateLocationAction(input)`   | `WAREHOUSE_LOCATIONS_MANAGE` | Requires `activeBranchId`; cycle guard; level cascade; emits `warehouse.location.updated`                                     |
| `deleteLocationAction({ id })`  | `WAREHOUSE_LOCATIONS_MANAGE` | Requires `activeBranchId`; verifies location belongs to active branch; reparents children; emits `warehouse.location.deleted` |

### Service (`src/server/services/warehouse-locations.service.ts`)

Static class: `listByBranch`, `getById`, `getChildren`, `create`, `update`, `softDelete`. Private helpers: `wouldCreateCycle`, `cascadeDescendantLevels`.

### React Query Hooks (`src/hooks/queries/warehouse/index.ts`)

`useWarehouseLocationsQuery`, `useWarehouseLocationQuery`, `useCreateLocationMutation`, `useUpdateLocationMutation`, `useDeleteLocationMutation`.

### Utility (`src/lib/warehouse/location-tree.ts`)

`buildLocationTree(locations)` — pure function, builds nested tree from flat list. Not server-only; safe to import in client components.

---

## UI

| Route                            | Component                                 | Guard                                                                 |
| -------------------------------- | ----------------------------------------- | --------------------------------------------------------------------- |
| `/dashboard/warehouse/locations` | `LocationsPage` (SSR) + `LocationsClient` | layout → `MODULE_WAREHOUSE_ACCESS`; page → `WAREHOUSE_LOCATIONS_READ` |

Components:

- `locations-client.tsx` — tree view with create/edit/delete controls, permission-gated
- `location-form-dialog.tsx` — create/edit dialog with name, code, parent, colour, description, sort order fields

Mobile: not yet implemented (planned).

---

## Audit Events

| Event key                    | Tier     | Triggered by           |
| ---------------------------- | -------- | ---------------------- |
| `warehouse.location.created` | baseline | `createLocationAction` |
| `warehouse.location.updated` | baseline | `updateLocationAction` |
| `warehouse.location.deleted` | enhanced | `deleteLocationAction` |

Registry: `src/server/audit/event-registry.ts`.

---

## Tests

| Suite        | File                                              | Coverage                                                                                                                                           |
| ------------ | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tree utility | `warehouse-locations.service.test.ts`             | `buildLocationTree` — empty, nested, orphan promotion, sort                                                                                        |
| Service unit | `warehouse-locations.service.test.ts`             | All methods; parent branch mismatch; duplicate code; cycle guard; soft-delete children reparent; level cascade; RLS denied/empty client simulation |
| Action unit  | `warehouse/__tests__/locations.test.ts`           | All permission deny paths; activeBranchId missing (update/delete); schema validation; happy path delegation                                        |
| Component    | `_components/__tests__/locations-client.test.tsx` | No permission state; no branch state; empty state; tree render; dialog open; manage gate                                                           |
| Sidebar SSR  | `__tests__/sidebar-ssr.test.tsx`                  | Warehouse items visible/hidden by MODULE_WAREHOUSE + WAREHOUSE_LOCATIONS_READ                                                                      |

---

## Operational Notes

- Warehouse data is branch-scoped: never query across branches without explicit multi-branch permission check.
- `level` is always consistent after service mutations. If a future migration is needed, run a recursive CTE to recompute all levels from scratch.
- `qr_code` is a stable identifier — do not regenerate it on update.
- `code` is optional but when set must be unique per org+branch (enforced by partial unique index `wl_code_unique_in_branch_idx`).

---

## Changelog

| Date       | Change                                                                                                                                                                                                                                                               |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-04-02 | Corrective pass: branch-aware RLS (`has_branch_permission`), cycle prevention (`wouldCreateCycle`), explicit soft-delete child reparenting, level cascade (`cascadeDescendantLevels`), `activeBranchId` required for update/delete actions, module artifacts created |
| 2026-04-02 | Initial implementation: locations table, permissions, service, actions, hooks, UI, audit events                                                                                                                                                                      |
