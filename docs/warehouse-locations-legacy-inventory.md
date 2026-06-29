# Warehouse Locations — Legacy Inventory

**Purpose:** Catalog every legacy visualization concept still present in the codebase after the V2 transition. This is a planning document for eventual Phase 8 cleanup. **Nothing here should be removed until Phase 8.**

**Created:** 2026-05-07  
**Status:** Accurate as of Phase 2 completion (commit c3809a8d)

---

## A. Legacy DB Concepts

These columns and table semantics exist in the live database but are no longer part of the V2 canonical architecture. They must be preserved until Phase 8.

### `warehouse_locations` table — deprecated columns

| Column                       | V1 Role                                                                                                          | V2 Status      | Notes                                                                                                     |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------- | -------------- | --------------------------------------------------------------------------------------------------------- |
| `map_role`                   | Dual-projection routing hint (`logical`, `layout_root`, `top_down_unit`, `front_segment`, `top_storage_segment`) | **Deprecated** | Still read by legacy editor and public maps. V2 uses `can_store_inventory` + `location_category` instead. |
| `elevation_level`            | Stacking order for top-down rendering                                                                            | **Deprecated** | No V2 equivalent — rendering is handle via `warehouse_location_visual_nodes.z_index`.                     |
| `allow_top_storage`          | Permits a `top_storage_segment` child                                                                            | **Deprecated** | Concept disappears in V2.                                                                                 |
| `storage_mode`               | Semantic storage classification                                                                                  | **Deprecated** | Currently always `'standard'`. No V2 equivalent planned yet.                                              |
| `physical_elevation_start_m` | Vertical bottom offset in front-elevation view                                                                   | **Deprecated** | Front-elevation is now computed from `warehouse_layout_split_nodes`.                                      |

### `warehouse_layout_shapes` table — deprecated semantics

| Aspect                                                          | V1 Role                                             | V2 Status                                                                 |
| --------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------- |
| `shape_type = 'location'`                                       | Location placeholder shape on the map canvas        | **Deprecated for V2** — V2 uses `warehouse_location_visual_nodes` instead |
| `projection` column                                             | `'top_down'` vs `'front_elevation'` dual-projection | **Deprecated** — V2 uses `view_type` on visual nodes                      |
| `anchor_location_id`                                            | Context anchor for front-elevation shapes           | **Deprecated** — V2 uses `view_context_location_id` on visual nodes       |
| Whole-layout replace RPC (`batch_save_warehouse_layout_shapes`) | Atomic shape replacement                            | **Keep temporarily** for decorative shapes (walls, labels, etc.)          |

### What stays valid in `warehouse_layout_shapes`

The table itself is NOT deprecated. Only the `shape_type='location'` usage is. These shape types remain valid and will continue being served:

- `wall`, `door`, `aisle`, `zone`, `obstacle`, `label` — all decorative map elements, no V2 equivalent needed

---

## B. Legacy Code Inventory

### B.1 Core legacy rendering libraries

These are pure utility files that implement V1 rendering semantics. They are self-contained and do not affect inventory.

| File                                   | What it does                                                                                      | Category                                                            |
| -------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `src/lib/warehouse/location-tree.ts`   | Defines `WarehouseLocationMapRole` type (`top_down_unit`, `front_segment`, `top_storage_segment`) | **Keep temporarily** — type is referenced everywhere                |
| `src/lib/warehouse/front-elevation.ts` | Computes front-elevation rendering data from `map_role` + physical dimensions                     | **Replace in Phase 5** — V2 front editor uses `split_nodes` instead |
| `src/lib/warehouse/map-preview.ts`     | Resolves location context from `map_role` hierarchy for map navigation                            | **Replace in Phase 4** — V2 top-down editor uses `visual_nodes`     |
| `src/lib/warehouse/map-context.ts`     | Computes editor context (top-down anchor, front anchor) from `map_role` chain                     | **Replace in Phase 4**                                              |

### B.2 Legacy service layer

| File                                                     | Legacy usage                                                                                                                                                                                                                                                                               | Category                                                                       |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| `src/server/services/warehouse-locations.service.ts`     | `LOCATION_COLUMNS` includes `map_role`, `elevation_level`, `allow_top_storage` etc.; `CreateLocationInput`/`UpdateLocationInput` accept `map_role`; `validateFrontSegmentHeight` validates old `front_segment` height constraints; `listPlacedLocationIds` reads `warehouse_layout_shapes` | **Keep temporarily** — must not break old editor                               |
| `src/server/services/warehouse-layout-shapes.service.ts` | Entire service operates on `warehouse_layout_shapes`; includes `batchSave` (whole-layout replace), `upsertOne`, `listByLayout`, etc.                                                                                                                                                       | **Keep temporarily** — old editor depends on it; decorative shapes still valid |
| `src/server/services/warehouse-layouts.service.ts`       | Doc comment references `warehouse_layout_shapes`                                                                                                                                                                                                                                           | **No code change needed** — comment only                                       |

### B.3 Legacy server actions

| File                                       | Legacy usage                                                                                         | Category                                                  |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `src/app/actions/warehouse/schemas.ts`     | `createLocationSchema`/`updateLocationSchema` include `map_role` field; `locationMapRoleSchema` enum | **Keep temporarily** — legacy form still uses it          |
| `src/app/actions/warehouse/public-maps.ts` | Queries `warehouse_layout_shapes` to build public map; uses `map_role` to filter location types      | **Replace in Phase 4** when V2 public map viewer is built |

### B.4 Legacy UI components

These components form the entire legacy map editor stack. They are the reason V1 compatibility must be preserved.

| File                                                                                          | Legacy usage                                                                                                                                     | Category                                          |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------- |
| `src/app/[locale]/dashboard/warehouse/locations/_components/location-form-dialog.tsx`         | Exposes `map_role` selector in the form UI; uses `map_role` to validate parent selection; front-segment dimension fields tied to `map_role`      | **Replace in Phase 4** (simplified location form) |
| `src/app/[locale]/dashboard/warehouse/locations/_components/locations-client.tsx`             | Uses `map_role` to determine if location is a "logical container" for tree display                                                               | **Replace in Phase 4**                            |
| `src/app/[locale]/dashboard/warehouse/map/[layoutId]/_components/map-editor.tsx`              | Core legacy editor; reads/writes `warehouse_layout_shapes` with `shape_type='location'`; uses `map_role` to filter which locations can be placed | **Keep until Phase 4 editor**                     |
| `src/app/[locale]/dashboard/warehouse/map/[layoutId]/_components/map-canvas.tsx`              | Renders `warehouse_layout_shapes`; special-cases `shape_type='location'` for badges                                                              | **Keep until Phase 4 editor**                     |
| `src/app/[locale]/dashboard/warehouse/map/[layoutId]/_components/shape-inspector.tsx`         | Heavily uses `shape_type='location'` for inspector panels                                                                                        | **Keep until Phase 4 editor**                     |
| `src/app/[locale]/dashboard/warehouse/map/[layoutId]/_components/location-toolbox.tsx`        | Uses `map_role` to classify locations for toolbox display                                                                                        | **Keep until Phase 4 editor**                     |
| `src/components/v2/warehouse/warehouse-map-dialog.tsx`                                        | Uses `map_role` to route between top-down and front-elevation views                                                                              | **Replace in Phase 4**                            |
| `src/components/v2/warehouse/warehouse-map-viewer.tsx`                                        | Reads `warehouse_layout_shapes` with `shape_type='location'`; renders locations via old shape system                                             | **Replace in Phase 4**                            |
| `src/app/[locale]/(public)/maps/[branchId]/_components/public-warehouse-maps-page-client.tsx` | Public maps page; uses `map_role` to classify front/storage segments                                                                             | **Replace in Phase 4**                            |

---

## C. Legacy Editor Architecture

### What the legacy editor assumes

1. **Whole-layout replace semantics**: The `batch_save_warehouse_layout_shapes` RPC replaces ALL shapes for a layout in one transaction. This is a risky all-or-nothing pattern. V2 uses scoped upserts instead.

2. **Location shapes ARE the visual representation**: In V1, placing a location on the map means creating a `warehouse_layout_shapes` row with `shape_type='location'` and `location_id=<id>`. V2 uses `warehouse_location_visual_nodes` instead.

3. **Projection semantics embedded in shapes**: The `projection` column (`top_down` vs `front_elevation`) and `anchor_location_id` implement dual-projection within the shapes table. V2 uses `view_type` and `view_context_location_id` on visual nodes instead.

4. **`map_role` drives rendering behavior**: The old editor uses `map_role` to decide what UI to show and what constraints to enforce. V2 uses `can_store_inventory`, `location_category`, and visual node `visualization_type` instead.

5. **Front-elevation is built from location hierarchy + map_role**: The `front-elevation.ts` utility traverses the location tree using `map_role` to find `front_segment` children. V2 uses `warehouse_layout_split_nodes` instead.

### Rendering path comparison

| Concern                           | V1 (Legacy)                                                                                                          | V2 (Canonical)                                                                                 |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Location on top-down map          | `warehouse_layout_shapes` row with `shape_type='location'`, `projection='top_down'`                                  | `warehouse_location_visual_nodes` row with `view_type='top_down'`                              |
| Location in front view            | `warehouse_layout_shapes` row with `shape_type='location'`, `projection='front_elevation'`, `anchor_location_id` set | `warehouse_location_visual_nodes` row with `view_type='front'`, `view_context_location_id` set |
| Interior grid/shelf layout        | Front segments via `map_role='front_segment'` child locations                                                        | `warehouse_layout_split_nodes` tree                                                            |
| Decorative elements (walls, etc.) | `warehouse_layout_shapes` with `shape_type` ≠ `location`                                                             | Same (no change)                                                                               |

---

## D. Migration Strategy

### What we are NOT doing

- **No backfill** from `warehouse_layout_shapes` into `warehouse_location_visual_nodes`
- **No automatic migration** of `map_role` semantics to `location_category`
- **No conversion** of `front_segment` locations to split nodes
- **No data migration scripts** for legacy test/dev visualization data

### Rationale

The current legacy visualization data is dev/test data only. It does not represent production inventory. The complexity of migrating it accurately (especially front-elevation topology) outweighs the benefit. V2 starts fresh.

### What happens to existing legacy data

- `warehouse_locations` rows remain fully intact
- `warehouse_layout_shapes` rows remain intact and continue serving the legacy editor
- Legacy `map_role` values remain in the DB — they are just not used by V2 code
- New locations created via V2 actions will have correct V2 fields (`can_store_inventory`, `location_category`, `width_mm`, etc.) but `map_role` defaults to `'logical'`

### V2 becomes authoritative going forward

From Phase 3 onward:

- All NEW visual representations must be created in `warehouse_location_visual_nodes`
- New code must NOT write `shape_type='location'` shapes
- New code must NOT read `map_role` for rendering decisions
- New code must NOT depend on `front_segment` or `top_down_unit` semantics

---

## E. Categorized Removal Plan (Phase 8)

### Safe to remove in Phase 8 — after V2 editor is complete

**DB columns** (from `warehouse_locations`):

- `map_role`
- `elevation_level`
- `allow_top_storage`
- `storage_mode`
- `physical_elevation_start_m`

**DB table semantics**:

- `warehouse_layout_shapes.shape_type = 'location'` — no V2 code will write this
- `warehouse_layout_shapes.projection` column
- `warehouse_layout_shapes.anchor_location_id` column
- `batch_save_warehouse_layout_shapes` RPC (if editor is replaced)

**Library files**:

- `src/lib/warehouse/front-elevation.ts`
- `src/lib/warehouse/map-preview.ts`
- `src/lib/warehouse/map-context.ts`
- `WarehouseLocationMapRole` type from `location-tree.ts`

**Service methods**:

- `WarehouseLocationsService.validateFrontSegmentHeight()` — private, but references `front_segment`
- `WarehouseLayoutShapesService.listPlacedLocationIds()` — referenced from `WarehouseLocationsService.listPlacedLocationIds()`
- `map_role` from `LOCATION_COLUMNS`, `CreateLocationInput`, `UpdateLocationInput`

**Schema / Actions**:

- `locationMapRoleSchema` from `schemas.ts`
- `map_role` field from `createLocationSchema` / `updateLocationSchema`
- `listPlacedLocationIdsAction` (superseded by `getUnmappedLocationsAction`)

**UI components** (replace with V2 equivalents):

- Legacy map editor stack: `map-editor.tsx`, `map-canvas.tsx`, `shape-inspector.tsx`, `location-toolbox.tsx`
- `location-form-dialog.tsx` (replace with V2 form)
- `warehouse-map-dialog.tsx` (replace with V2 dialog)
- `warehouse-map-viewer.tsx` (replace with V2 viewer)

### Keep permanently

- `warehouse_layout_shapes` table itself (for walls, doors, labels, etc.)
- `WarehouseLayoutShapesService` — scoped to decorative shapes only
- `shapes.ts` server actions — for decorative shapes
- All V2 services/actions/hooks created in Phase 2

---

## F. Compatibility Rules During Transition

1. Old editor reads `warehouse_layout_shapes` → **allowed, no change needed**
2. Old editor writes `warehouse_layout_shapes` → **allowed, no change needed**
3. New V2 code writes `warehouse_layout_shapes` with `shape_type='location'` → **forbidden**
4. New V2 code reads `map_role` for rendering decisions → **forbidden**
5. New V2 code reads `warehouse_layout_shapes` for location visualization → **forbidden**
6. Decorative shapes (`wall`, `door`, etc.) in `warehouse_layout_shapes` → **always allowed**
