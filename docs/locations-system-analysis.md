# WAREHOUSE LOCATIONS SYSTEM — COMPREHENSIVE TECHNICAL REPORT

## Executive Summary

The warehouse locations system is a mature, multi-layer feature suite comprising a hierarchical location tree, visual map/layout editor, location groups (display containers), dual-projection (top-down / front-elevation) map support, and atomic database operations. **Total codebase: ~25,000 LOC** across migrations (~1,600 LOC), services (~1,400 LOC), server actions (~1,100 LOC), React Query hooks (~800 LOC), and UI components (~20,000+ LOC). The system uses Supabase with PostgreSQL RPCs for transaction safety, RLS policies for authorization, and Zod-validated server actions. All deletions are soft-deletes. Color inheritance flows from groups and parents. Physical dimensions and elevation data enable front-view mapping.

---

## 1. DATABASE SCHEMA

### 1.1 `warehouse_locations` Table

**Purpose:** Core hierarchical physical location structure (branch-scoped).

| Column                       | Type        | Constraints                                                                                                                  | Notes                                                                                             |
| ---------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `id`                         | UUID        | PK, default `gen_random_uuid()`                                                                                              | Unique location identifier                                                                        |
| `organization_id`            | UUID        | FK to `organizations`, NOT NULL                                                                                              | Organization scope                                                                                |
| `branch_id`                  | UUID        | FK to `branches`, NOT NULL                                                                                                   | Warehouse boundary (one per branch)                                                               |
| `name`                       | TEXT        | NOT NULL, `CHECK(length(trim(name)) > 0)`                                                                                    | Display name                                                                                      |
| `code`                       | TEXT        | NULLABLE, unique per org/branch/parent when NOT NULL                                                                         | Short human-readable code (e.g., "MG-A-R1")                                                       |
| `description`                | TEXT        | NULLABLE                                                                                                                     | Free-form text                                                                                    |
| `icon_name`                  | TEXT        | NULLABLE                                                                                                                     | Lucide icon identifier (e.g., "box", "warehouse")                                                 |
| `color`                      | TEXT        | NULLABLE                                                                                                                     | HEX color string (#RRGGBB)                                                                        |
| `parent_id`                  | UUID        | NULLABLE, FK to self ON DELETE SET NULL                                                                                      | Hierarchy self-reference; `CHECK(parent_id IS DISTINCT FROM id)`                                  |
| `group_id`                   | UUID        | NULLABLE, FK to `warehouse_location_groups.id` ON DELETE SET NULL                                                            | Display group membership (cosmetic only)                                                          |
| `inherit_group_color`        | BOOLEAN     | NOT NULL, DEFAULT false                                                                                                      | Color cascades from group when true; `CHECK(group_id IS NOT NULL OR inherit_group_color = false)` |
| `inherit_parent_color`       | BOOLEAN     | NOT NULL, DEFAULT false                                                                                                      | Color cascades from parent when true                                                              |
| `physical_width_m`           | FLOAT       | NULLABLE, `CHECK(> 0)`                                                                                                       | Front-view width in meters                                                                        |
| `physical_depth_m`           | FLOAT       | NULLABLE, `CHECK(> 0)`                                                                                                       | Top-down depth in meters                                                                          |
| `physical_height_m`          | FLOAT       | NULLABLE, `CHECK(> 0)`                                                                                                       | Height in meters (constrains front segments)                                                      |
| `physical_elevation_start_m` | FLOAT       | NULLABLE, `CHECK(>= 0)`                                                                                                      | Bottom offset in front elevation                                                                  |
| `elevation_level`            | INTEGER     | NOT NULL, DEFAULT 1                                                                                                          | Stacking order (top-down rendering)                                                               |
| `map_role`                   | TEXT        | NOT NULL, DEFAULT 'logical', `CHECK(IN ('logical', 'layout_root', 'top_down_unit', 'front_segment', 'top_storage_segment'))` | Mapping role hint for dual-projection                                                             |
| `storage_mode`               | TEXT        | NOT NULL, DEFAULT 'standard'                                                                                                 | Semantic storage type (future use)                                                                |
| `allow_top_storage`          | BOOLEAN     | NOT NULL, DEFAULT false                                                                                                      | Permits one `top_storage_segment` child                                                           |
| `level`                      | INTEGER     | NOT NULL, DEFAULT 0, `CHECK(>= 0)`                                                                                           | Depth in tree (0=root); maintained by app layer                                                   |
| `sort_order`                 | INTEGER     | NOT NULL, DEFAULT 0, `CHECK(>= 0)`                                                                                           | UI ordering within parent's children                                                              |
| `qr_code`                    | TEXT        | NOT NULL, UNIQUE                                                                                                             | Stable opaque UUID for QR encoding (immutable)                                                    |
| `created_by` / `updated_by`  | UUID        | NULLABLE, FK to `users.id` ON DELETE SET NULL                                                                                | Audit trail                                                                                       |
| `created_at` / `updated_at`  | TIMESTAMPTZ | NOT NULL, DEFAULT now()                                                                                                      | Maintained by trigger                                                                             |
| `deleted_at`                 | TIMESTAMPTZ | NULLABLE                                                                                                                     | Soft-delete flag                                                                                  |

**Key Indexes:**

- `wl_org_branch_active_idx`: `(organization_id, branch_id) WHERE deleted_at IS NULL`
- `wl_parent_active_idx`: `(parent_id) WHERE deleted_at IS NULL AND parent_id IS NOT NULL`
- `wl_code_unique_in_branch_idx` (UNIQUE partial): `(organization_id, branch_id, code) WHERE code IS NOT NULL AND deleted_at IS NULL`

**RLS Policies:**

- SELECT: `is_org_member(organization_id) AND deleted_at IS NULL`
- INSERT/UPDATE: `has_permission(organization_id, 'warehouse.locations.manage')`
- DELETE: `false` (hard deletes blocked; soft-delete only via RPC)

---

### 1.2 `warehouse_location_groups` Table

**Purpose:** Display-only grouping containers for sibling locations (e.g., rack bays). Not inventory entities.

| Column                          | Type                                                          | Notes                                         |
| ------------------------------- | ------------------------------------------------------------- | --------------------------------------------- |
| `id`                            | UUID PK                                                       |                                               |
| `organization_id` / `branch_id` | UUID FK                                                       | Scope                                         |
| `parent_location_id`            | UUID NULLABLE FK → `warehouse_locations.id` ON DELETE CASCADE | Scopes groups to a location's direct children |
| `name`                          | TEXT NOT NULL                                                 |                                               |
| `description`                   | TEXT NULLABLE                                                 |                                               |
| `color`                         | TEXT NULLABLE, `CHECK(color ~* '^#[0-9A-Fa-f]{6}$')`          | HEX color (regex-validated)                   |
| `sort_order`                    | INTEGER NOT NULL DEFAULT 0                                    |                                               |
| `deleted_at`                    | TIMESTAMPTZ                                                   | Soft-delete flag                              |

**RLS Policies:**

- SELECT (base): `has_branch_permission(organization_id, branch_id, 'warehouse.locations.read') AND deleted_at IS NULL`
- SELECT (manage): `has_branch_permission(organization_id, branch_id, 'warehouse.locations.manage')` — sees all including soft-deleted (needed for PostgREST post-UPDATE visibility check)
- INSERT/UPDATE: `has_branch_permission(..., 'warehouse.locations.manage')`
- DELETE: `false`

---

### 1.3 `warehouse_layouts` Table

**Purpose:** Named visual map documents scoping shapes to a branch or location subtree.

| Column                               | Type                                                              | Notes                                                  |
| ------------------------------------ | ----------------------------------------------------------------- | ------------------------------------------------------ |
| `id`                                 | UUID PK                                                           |                                                        |
| `organization_id` / `branch_id`      | UUID FK                                                           | Scope                                                  |
| `root_location_id`                   | UUID NULLABLE FK → `warehouse_locations.id` ON DELETE SET NULL    | Scopes layout to a subtree; NULL = whole-branch layout |
| `name`                               | TEXT NOT NULL                                                     |                                                        |
| `status`                             | TEXT NOT NULL DEFAULT 'draft', `CHECK(IN ('draft', 'published'))` |                                                        |
| `canvas_width_m` / `canvas_height_m` | FLOAT NOT NULL DEFAULT 50/30                                      | Canvas dimensions in meters                            |
| `published_at`                       | TIMESTAMPTZ NULLABLE                                              |                                                        |
| `deleted_at`                         | TIMESTAMPTZ                                                       | Soft-delete flag                                       |

**Key Index:**

- `wll_one_published_per_scope_idx` (UNIQUE partial): `(organization_id, branch_id, COALESCE(root_location_id, '00000000-...')) WHERE status = 'published' AND deleted_at IS NULL` — enforces one published layout per scope

**RLS:**

- SELECT: `has_branch_permission(..., 'warehouse.layouts.read') AND deleted_at IS NULL`
- INSERT/UPDATE: `has_branch_permission(..., 'warehouse.layouts.manage')`
- DELETE: `false`

---

### 1.4 `warehouse_layout_shapes` Table

**Purpose:** Individual canvas elements on a layout (V1: flat, no nesting).

| Column                          | Type                                                                                          | Notes                                                                                                                                        |
| ------------------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                            | UUID PK                                                                                       | Client-generated on insert                                                                                                                   |
| `layout_id`                     | UUID FK ON DELETE CASCADE                                                                     |                                                                                                                                              |
| `organization_id` / `branch_id` | UUID FK                                                                                       | Denormalized for RLS                                                                                                                         |
| `shape_type`                    | TEXT NOT NULL, `CHECK(IN ('location', 'wall', 'door', 'aisle', 'zone', 'obstacle', 'label'))` |                                                                                                                                              |
| `projection`                    | TEXT NOT NULL DEFAULT 'top_down', `CHECK(IN ('top_down', 'front_elevation'))`                 | Dual-projection support                                                                                                                      |
| `anchor_location_id`            | UUID NULLABLE FK → `warehouse_locations.id`                                                   | Required when `projection = 'front_elevation'`                                                                                               |
| `location_id`                   | UUID NULLABLE FK                                                                              | Set only when `shape_type = 'location'`; mutual exclusion enforced by CHECK                                                                  |
| `label`                         | TEXT NULLABLE                                                                                 | Override label                                                                                                                               |
| `x` / `y`                       | FLOAT NOT NULL DEFAULT 0                                                                      | Position in meters                                                                                                                           |
| `width` / `height`              | FLOAT NOT NULL DEFAULT 1, `CHECK(> 0)`                                                        | Dimensions in meters                                                                                                                         |
| `rotation`                      | FLOAT NOT NULL DEFAULT 0                                                                      | Degrees clockwise                                                                                                                            |
| `style`                         | JSONB NULLABLE                                                                                | `{ fill, fillOpacity, stroke, strokeWidth, cornerRadius, fontSize, fontWeight, textColor, labelColor, labelSize, labelAlignH, labelAlignV }` |
| `z_index`                       | INTEGER NOT NULL DEFAULT 0                                                                    |                                                                                                                                              |
| `deleted_at`                    | TIMESTAMPTZ                                                                                   | Soft-delete flag                                                                                                                             |

**Key Indexes:**

- `wls_location_unique_per_layout_projection_idx` (UNIQUE partial): `(layout_id, location_id, projection) WHERE location_id IS NOT NULL AND deleted_at IS NULL` — one location shape per layout per projection

**Triggers:**

- `warehouse_layout_shapes_validate_scope`: validates location/anchor refs stay within same org/branch; enforces anchor requirement for front-elevation

**RLS:** Same pattern — `warehouse.layouts.read` for SELECT, `warehouse.layouts.manage` for INSERT/UPDATE, DELETE blocked.

---

## 2. RPC / DATABASE FUNCTIONS

| Function                                | Purpose                                                                                         | Parameters                                                                                                                    | Returns                              |
| --------------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `cascade_warehouse_location_levels`     | Cascade `level` updates down a subtree via recursive CTE                                        | `p_org_id, p_parent_id, p_parent_level`                                                                                       | `void`                               |
| `reparent_warehouse_location`           | Move a location to a new parent + cascade levels                                                | `p_org_id, p_location_id, p_new_parent_id, p_new_level`                                                                       | `void`                               |
| `soft_delete_warehouse_location`        | Atomically: reparent children to root + cascade levels + clear group assignments + soft-delete  | `p_org_id, p_location_id`                                                                                                     | `void`                               |
| `soft_delete_warehouse_location_group`  | Atomically: clear `group_id` + `inherit_group_color` on members + soft-delete group             | `p_org_id, p_group_id`                                                                                                        | `void`                               |
| `publish_warehouse_layout`              | Atomically unpublish current layout for scope, then publish target                              | `p_layout_id, p_user_id`                                                                                                      | `void`                               |
| `unpublish_warehouse_layout`            | Revert published → draft                                                                        | `p_layout_id, p_user_id`                                                                                                      | `void`                               |
| `batch_save_warehouse_layout_shapes`    | Replace all active shapes for a layout in one transaction (soft-delete missing, upsert present) | `p_layout_id, p_org_id, p_branch_id, p_user_id, p_shapes JSONB`                                                               | `SETOF warehouse_layout_shapes`      |
| `create_warehouse_layout_with_root`     | Atomically create root location + linked layout                                                 | `p_org_id, p_branch_id, p_user_id, p_layout_name, p_layout_description, p_root_loc_code, p_canvas_width_m, p_canvas_height_m` | `TABLE(layout_id, root_location_id)` |
| `soft_delete_warehouse_layout`          | Soft-delete layout + all its shapes atomically                                                  | `p_org_id, p_layout_id`                                                                                                       | `void`                               |
| `validate_warehouse_layout_shape_scope` | Trigger: enforces org/branch consistency + anchor requirement for front-elevation               | TRIGGER context                                                                                                               | `TRIGGER`                            |

**Key design notes:**

- All RPCs use `SECURITY INVOKER` so RLS still applies.
- `publish_warehouse_layout` has an **internal** `has_branch_permission(..., 'warehouse.layouts.publish')` check (separate from manage).
- `batch_save_warehouse_layout_shapes` implements "replace active shapes" semantics — anything not in input is soft-deleted.

---

## 3. SERVICES (`src/server/services/`)

### `warehouse-locations.service.ts` (~703 LOC)

| Method                                             | Purpose                                                                                            |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `listByBranch(supabase, orgId, branchId)`          | Fetch all active locations, flat, sorted by level/sort_order/name                                  |
| `listPlacedLocationIds(supabase, orgId, branchId)` | Distinct IDs of locations with shapes on any layout (for "placed" badges)                          |
| `getById(supabase, orgId, id)`                     | Fetch single location                                                                              |
| `getChildren(supabase, orgId, parentId)`           | Direct children of a location                                                                      |
| `create(supabase, orgId, branchId, input, userId)` | Create location; validates parent scope, code uniqueness, group assignment, front-segment height   |
| `update(supabase, orgId, id, input, userId)`       | Update; if parent changes: validates self-parent, cycle detection, constraints; calls reparent RPC |
| `softDelete(supabase, orgId, id)`                  | Calls `soft_delete_warehouse_location` RPC                                                         |
| `reorderBatch(supabase, orgId, branchId, items)`   | Batch update `sort_order`                                                                          |

**Private helpers:** `wouldCreateCycle()`, `validateGroupAssignment()`, `validateFrontSegmentHeight()`

---

### `warehouse-location-groups.service.ts` (~277 LOC)

| Method         | Purpose                                                                             |
| -------------- | ----------------------------------------------------------------------------------- |
| `listByBranch` | List active groups for a branch                                                     |
| `getById`      | Fetch single group                                                                  |
| `create`       | Create group; auto-increments sort_order; validates parent_location_id scope        |
| `update`       | Update group metadata                                                               |
| `reorderBatch` | Bulk sort_order update                                                              |
| `softDelete`   | Calls `soft_delete_warehouse_location_group` RPC (clears member group_ids + delete) |

---

### `warehouse-layouts.service.ts` (~396 LOC)

| Method                   | Purpose                                                                    |
| ------------------------ | -------------------------------------------------------------------------- |
| `listByBranch`           | List all layouts (draft + published)                                       |
| `getById`                | Fetch single layout                                                        |
| `getWithShapes`          | Fetch layout + all active shapes                                           |
| `getPublishedForScope`   | Fetch published layout for (branch + optional root_location_id)            |
| `create`                 | Create draft layout; idempotent (returns existing if one exists for scope) |
| `update`                 | Update metadata (name, description, canvas dims)                           |
| `publish`                | Calls `publish_warehouse_layout` RPC                                       |
| `unpublish`              | Calls `unpublish_warehouse_layout` RPC                                     |
| `createWithRootLocation` | Calls `create_warehouse_layout_with_root` RPC (atomic)                     |
| `softDelete`             | Calls `soft_delete_warehouse_layout` RPC (cascades to shapes)              |

---

### `warehouse-layout-shapes.service.ts` (~200+ LOC)

| Method                       | Purpose                                                                                            |
| ---------------------------- | -------------------------------------------------------------------------------------------------- |
| `listByLayout`               | All active shapes for a layout                                                                     |
| `listByLayoutAndProjection`  | Filter shapes by projection ('top_down' or 'front_elevation')                                      |
| `listFrontElevationByAnchor` | Front-elevation shapes for a specific anchor location                                              |
| `batchSave`                  | Primary editor save: calls `batch_save_warehouse_layout_shapes` RPC                                |
| `upsertOne`                  | Incremental single-shape save (e.g. after drag-end); validates shape not owned by different layout |

---

## 4. SERVER ACTIONS (`src/app/actions/warehouse/`)

### `locations.ts`

| Action                          | Permission Gate              | Notes                              |
| ------------------------------- | ---------------------------- | ---------------------------------- |
| `listLocationsAction()`         | `WAREHOUSE_LOCATIONS_READ`   | Context-driven (active branch)     |
| `getLocationAction({ id })`     | `WAREHOUSE_LOCATIONS_READ`   | Validates belongs to active branch |
| `createLocationAction(input)`   | `WAREHOUSE_LOCATIONS_MANAGE` | Emits audit event on success       |
| `updateLocationAction(input)`   | `WAREHOUSE_LOCATIONS_MANAGE` | Emits audit event                  |
| `deleteLocationAction({ id })`  | `WAREHOUSE_LOCATIONS_MANAGE` | Calls soft-delete RPC              |
| `reorderLocationsAction(input)` | `WAREHOUSE_LOCATIONS_MANAGE` | Batch sort_order update            |
| `listPlacedLocationIdsAction()` | `WAREHOUSE_LOCATIONS_READ`   | For "placed" badges in map editor  |

### `location-groups.ts`

| Action                              | Permission Gate              |
| ----------------------------------- | ---------------------------- |
| `listLocationGroupsAction()`        | `WAREHOUSE_LOCATIONS_READ`   |
| `createLocationGroupAction(input)`  | `WAREHOUSE_LOCATIONS_MANAGE` |
| `updateLocationGroupAction(input)`  | `WAREHOUSE_LOCATIONS_MANAGE` |
| `deleteLocationGroupAction({ id })` | `WAREHOUSE_LOCATIONS_MANAGE` |
| `reorderGroupsAction(input)`        | `WAREHOUSE_LOCATIONS_MANAGE` |

### `layouts.ts`

| Action                                            | Permission Gate             |
| ------------------------------------------------- | --------------------------- |
| `listLayoutsAction()`                             | `WAREHOUSE_LAYOUTS_READ`    |
| `getLayoutWithShapesAction({ id })`               | `WAREHOUSE_LAYOUTS_READ`    |
| `getPublishedLayoutAction({ root_location_id? })` | `WAREHOUSE_LAYOUTS_READ`    |
| `createLayoutAction(input)`                       | `WAREHOUSE_LAYOUTS_MANAGE`  |
| `createLayoutForLocationAction(input)`            | `WAREHOUSE_LAYOUTS_MANAGE`  |
| `updateLayoutAction(input)`                       | `WAREHOUSE_LAYOUTS_MANAGE`  |
| `publishLayoutAction({ id })`                     | `WAREHOUSE_LAYOUTS_PUBLISH` |
| `unpublishLayoutAction({ id })`                   | `WAREHOUSE_LAYOUTS_PUBLISH` |
| `deleteLayoutAction({ id })`                      | `WAREHOUSE_LAYOUTS_MANAGE`  |

### `shapes.ts`

| Action                                         | Permission Gate            |
| ---------------------------------------------- | -------------------------- |
| `batchSaveShapesAction({ layout_id, shapes })` | `WAREHOUSE_LAYOUTS_MANAGE` |
| `upsertOneShapeAction({ layout_id, shape })`   | `WAREHOUSE_LAYOUTS_MANAGE` |
| `deleteShapeAction({ id })`                    | `WAREHOUSE_LAYOUTS_MANAGE` |

### `public-maps.ts`

| Action                                                      | Notes                                    |
| ----------------------------------------------------------- | ---------------------------------------- |
| `setBranchPublicWarehouseMapsAction({ branchId, enabled })` | Toggle public maps visibility for branch |

---

## 5. REACT QUERY HOOKS (`src/hooks/queries/warehouse/index.ts`, ~792 LOC)

### Query Key Factory: `warehouseKeys`

```
locations.byBranch(branchId)
locations.single(id)
locations.placedIds(branchId)
locationGroups.byBranch(branchId)
layouts.byBranch(branchId)
layouts.withShapes(id)
layouts.published(branchId, rootLocationId?)
```

### Location Hooks

| Hook                                                 | Type     | Key Features                                                                                     |
| ---------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------ |
| `useWarehouseLocationsQuery(branchId, initialData?)` | Query    | 2 min stale time; SSR initialData support                                                        |
| `useWarehouseLocationQuery(id, initialData?)`        | Query    | Lazy-enabled by id                                                                               |
| `useCreateLocationMutation(branchId)`                | Mutation | Invalidates list + single; toast                                                                 |
| `useUpdateLocationMutation(branchId)`                | Mutation | **Optimistic update** in `onMutate`; rollback on error; suppresses toast for "drag-only" updates |
| `useDeleteLocationMutation(branchId)`                | Mutation | Invalidates list; toast                                                                          |
| `useReorderLocationsMutation(branchId)`              | Mutation | Optimistic sort_order patch                                                                      |
| `usePlacedLocationIdsQuery(branchId)`                | Query    | 30s stale time                                                                                   |

### Location Group Hooks

| Hook                                                      | Type     | Key Features                        |
| --------------------------------------------------------- | -------- | ----------------------------------- |
| `useWarehouseLocationGroupsQuery(branchId, initialData?)` | Query    | 2 min stale time                    |
| `useCreateLocationGroupMutation(branchId)`                | Mutation | Invalidates groups + locations list |
| `useUpdateLocationGroupMutation(branchId)`                | Mutation | Invalidates list                    |
| `useDeleteLocationGroupMutation(branchId)`                | Mutation | Invalidates groups + locations      |
| `useReorderGroupsMutation(branchId)`                      | Mutation | Optimistic update                   |

### Layout & Shape Hooks

| Hook                                                        | Type     | Key Features                                          |
| ----------------------------------------------------------- | -------- | ----------------------------------------------------- |
| `useWarehouseLayoutsQuery(branchId, initialData?)`          | Query    | 2 min stale time                                      |
| `useWarehouseLayoutWithShapesQuery(layoutId, initialData?)` | Query    | 30s stale time; SSR initialData                       |
| `usePublishedLayoutQuery(branchId, rootLocationId?)`        | Query    | 5 min stale time                                      |
| `usePublishLayoutMutation(branchId)`                        | Mutation | Separate `WAREHOUSE_LAYOUTS_PUBLISH` permission       |
| `useUnpublishLayoutMutation(branchId)`                      | Mutation | Invalidates layouts + published layouts               |
| `useBatchSaveShapesMutation(layoutId)`                      | Mutation | Directly patches layout+shapes cache (no refetch)     |
| `useUpsertOneShapeMutation(layoutId)`                       | Mutation | Patches shapes array in cache (insert/update/restore) |
| `useDeleteShapeMutation(layoutId)`                          | Mutation | Filters from shapes array                             |

---

## 6. PAGE COMPONENTS & ROUTES

### `/dashboard/warehouse/locations`

- **SSR page**: fetches locations + groups in parallel; passes `initialLocations` + `initialGroups`
- **`locations-client.tsx`** (~500+ LOC):
  - Location tree with expand/collapse, drag-to-reorder (dnd-kit), context menu (create/edit/delete/map/QR)
  - Groups sidebar with drag-to-reorder
  - Public maps toggle (per-branch)
  - Permission gates throughout (`WAREHOUSE_LOCATIONS_MANAGE` hides edit/delete/create)
  - Modals: `LocationFormDialog`, `LocationGroupFormDialog`

### `/dashboard/warehouse/map`

- **`map-list-client.tsx`** (~200+ LOC): Grid of layout cards with status badge (draft/published); create/delete/publish context menu

### `/dashboard/warehouse/map/[layoutId]`

- **SSR page**: fetches layout + shapes + locations + groups in parallel; passes as `initialData`
- **`map-editor-shell.tsx`**: toolbar (save/publish/delete) + canvas + inspector + toolbox
- **`map-canvas.tsx`** (~300+ LOC): SVG-based canvas; drag-to-move shapes; click-to-select; shape drawing tools; meters-to-pixels scaling
- **`shape-inspector.tsx`** (~200+ LOC): geometry fields (x, y, w, h, rotation); style editor (fill, stroke, corner radius, label); location link dropdown
- **`location-toolbox.tsx`** (~150+ LOC): searchable location list with "placed" badges; drag-to-add onto canvas

---

## 7. DATA FLOWS END-TO-END

### Flow 1: Creating a New Location

1. `LocationFormDialog` collects input → Zod validates locally
2. `createLocationAction(input)` → check `WAREHOUSE_LOCATIONS_MANAGE`
3. `WarehouseLocationsService.create()`: fetch parent level, validate scope, validate code uniqueness, validate group assignment, validate front-segment height → INSERT
4. RLS INSERT policy checks `has_permission(org_id, 'warehouse.locations.manage')`
5. Cache invalidated → tree re-fetches → toast success

**Failure paths:** Parent not found / code already used / group wrong parent / front-segment height exceeds parent

### Flow 2: Editing a Location's Position on Map (Shape Drag)

1. Canvas `dragend` → `useUpsertOneShapeMutation` with updated `(x, y)`
2. `upsertOneShapeAction({ layout_id, shape })` → check `WAREHOUSE_LAYOUTS_MANAGE`
3. `WarehouseLayoutShapesService.upsertOne()`: validate no layout cross-claim, validate location scope → Supabase upsert
4. Cache patched directly (no refetch) → shape visually updates immediately

### Flow 3: Batch Saving Shapes (Click "Save" in editor)

1. Canvas maintains in-memory `shapes: ShapeUpsertInput[]`
2. `useBatchSaveShapesMutation(layoutId)` → `batchSaveShapesAction({ layout_id, shapes })`
3. Service calls `batch_save_warehouse_layout_shapes` RPC:
   - Soft-deletes all shapes NOT in input
   - Upserts all shapes in input (insert / update / restore)
4. Cache set to returned shapes → toast success

### Flow 4: Generating a QR Code for a Location

1. Location already has immutable `qr_code: string` column (UUID set at INSERT, never modified)
2. Context menu "View QR" → modal opens
3. `qrcode.react` / `qr-code-styling` renders `qr_code` string as visual QR
4. Optional print/download; copy-to-clipboard

### Flow 5: Deleting a Location

1. Alert dialog warns about child reparenting
2. `deleteLocationAction({ id })` → check `WAREHOUSE_LOCATIONS_MANAGE`
3. `WarehouseLocationsService.softDelete()` calls `soft_delete_warehouse_location` RPC:
   - For each direct child: promote to root (`parent_id = NULL, level = 0`) → cascade levels to all descendants
   - If location has groups: soft-delete groups + clear `group_id` on members
   - Soft-delete the location (`deleted_at = NOW()`)
4. Cache invalidated → tree re-fetches; deleted location disappears; children appear at root

### Flow 6: Publishing a Map Layout

1. Publish button (only for `WAREHOUSE_LAYOUTS_PUBLISH` users)
2. `publishLayoutAction({ id })` → `WarehouseLayoutsService.publish()` calls `publish_warehouse_layout` RPC
3. RPC internals (SECURITY INVOKER):
   - Checks `has_branch_permission(..., 'warehouse.layouts.publish')`
   - Unpublishes all other layouts for same (org, branch, scope)
   - Sets target to `status = 'published', published_at = NOW()`
4. Cache invalidated for layouts list + all published layout queries → status badges update

---

## 8. PERMISSIONS

| Slug                         | Who Has It                    | Purpose                                                       |
| ---------------------------- | ----------------------------- | ------------------------------------------------------------- |
| `warehouse.*`                | `org_owner` (wildcard)        | All warehouse access (compiler expands to all concrete slugs) |
| `warehouse.read`             | `org_member`                  | Module-level read gate                                        |
| `warehouse.locations.read`   | `org_member`                  | Read location hierarchy, groups                               |
| `warehouse.locations.manage` | Explicit grant                | Create/edit/delete locations and groups                       |
| `warehouse.layouts.read`     | `org_member`                  | Read layouts, shapes, published maps                          |
| `warehouse.layouts.manage`   | `org_owner` + explicit grants | Create/edit/delete layouts; draw shapes; batch save           |
| `warehouse.layouts.publish`  | `org_owner` + explicit grants | Publish/unpublish layouts (separate from manage)              |

**Checked at 3 layers:**

1. Client: `const { can } = usePermissions()` → hide UI elements
2. Server action: `checkPermission(context.user.permissionSnapshot, WAREHOUSE_LOCATIONS_MANAGE)` → return error
3. Database: RLS policies + internal RPC permission checks

---

## 9. FILE INVENTORY

### Services

| File                                                       | Lines | Purpose                                             |
| ---------------------------------------------------------- | ----- | --------------------------------------------------- |
| `src/server/services/warehouse-locations.service.ts`       | 703   | Core location CRUD + hierarchy validation           |
| `src/server/services/warehouse-location-groups.service.ts` | 277   | Groups CRUD + color/display management              |
| `src/server/services/warehouse-layouts.service.ts`         | 396   | Layout CRUD + publish/unpublish + shape composition |
| `src/server/services/warehouse-layout-shapes.service.ts`   | 200+  | Shape CRUD + batch save + dual-projection queries   |

### Server Actions

| File                                           | Lines | Purpose                                             |
| ---------------------------------------------- | ----- | --------------------------------------------------- |
| `src/app/actions/warehouse/locations.ts`       | 200+  | Location CRUD + reorder + placed IDs                |
| `src/app/actions/warehouse/location-groups.ts` | 100+  | Groups CRUD + reorder                               |
| `src/app/actions/warehouse/layouts.ts`         | 150+  | Layouts CRUD + publish/unpublish + create-with-root |
| `src/app/actions/warehouse/shapes.ts`          | 100+  | Shape batch save + upsert-one + delete              |
| `src/app/actions/warehouse/public-maps.ts`     | 50+   | Toggle public maps visibility                       |
| `src/app/actions/warehouse/schemas.ts`         | 100+  | Zod validation schemas                              |

### React Query Hooks

| File                                   | Lines | Purpose                                             |
| -------------------------------------- | ----- | --------------------------------------------------- |
| `src/hooks/queries/warehouse/index.ts` | 792   | All location/group/layout/shape queries + mutations |

### UI Components

| File                                                                                        | Lines | Purpose                                    |
| ------------------------------------------------------------------------------------------- | ----- | ------------------------------------------ |
| `src/app/[locale]/dashboard/warehouse/locations/page.tsx`                                   | 65    | SSR page loader                            |
| `src/app/[locale]/dashboard/warehouse/locations/_components/locations-client.tsx`           | 500+  | Location tree + groups UI + modals         |
| `src/app/[locale]/dashboard/warehouse/locations/_components/location-form-dialog.tsx`       | 150+  | Create/edit location form                  |
| `src/app/[locale]/dashboard/warehouse/locations/_components/location-group-form-dialog.tsx` | 100+  | Create/edit group form                     |
| `src/app/[locale]/dashboard/warehouse/map/page.tsx`                                         | 50    | Layouts list page loader                   |
| `src/app/[locale]/dashboard/warehouse/map/_components/map-list-client.tsx`                  | 200+  | Layouts grid/list view                     |
| `src/app/[locale]/dashboard/warehouse/map/[layoutId]/page.tsx`                              | 80    | Editor page loader                         |
| `src/app/[locale]/dashboard/warehouse/map/[layoutId]/_components/map-editor-shell.tsx`      | 100+  | Editor shell + composition                 |
| `src/app/[locale]/dashboard/warehouse/map/[layoutId]/_components/map-canvas.tsx`            | 300+  | SVG canvas + shape rendering + interaction |
| `src/app/[locale]/dashboard/warehouse/map/[layoutId]/_components/shape-inspector.tsx`       | 200+  | Properties panel                           |
| `src/app/[locale]/dashboard/warehouse/map/[layoutId]/_components/location-toolbox.tsx`      | 150+  | Draggable location list                    |
| `src/components/v2/warehouse/warehouse-map-viewer.tsx`                                      | 150+  | Read-only map viewer                       |
| `src/components/v2/warehouse/warehouse-front-elevation-panel.tsx`                           | 150+  | Front-elevation renderer                   |
| `src/components/v2/warehouse/warehouse-map-dialog.tsx`                                      | 100+  | Modal wrapper                              |

### Database Migrations (~1,600 LOC, 20+ files)

| File                                                              | Purpose                                                      |
| ----------------------------------------------------------------- | ------------------------------------------------------------ |
| `20260401120000_warehouse_locations.sql`                          | Core table, permissions, RLS                                 |
| `20260401130000_warehouse_locations_rls_hardening.sql`            | RLS policy hardening fixes                                   |
| `20260402100000_warehouse_location_hierarchy_functions.sql`       | cascade/reparent/soft-delete RPCs                            |
| `20260407110000_warehouse_layouts.sql`                            | Layouts + shapes tables + publish RPC                        |
| `20260407120000_warehouse_softdelete_rls_fix.sql`                 | Soft-delete RLS visibility fix                               |
| `20260409120000_warehouse_layouts_production_fixes.sql`           | Production hardening                                         |
| `20260409130000_warehouse_layouts_security_v2.sql`                | Security enhancements                                        |
| `20260409172339_warehouse_function_search_path_hardening.sql`     | Search path hardening in RPCs                                |
| `20260410100000_warehouse_location_groups.sql`                    | Groups table, RLS, soft-delete function                      |
| `20260410110000_warehouse_location_groups_parent.sql`             | Add `parent_location_id` to groups                           |
| `20260410120000_warehouse_location_groups_softdelete_rls_fix.sql` | Soft-delete RLS fix for groups                               |
| `20260411100000_warehouse_location_groups_hardening.sql`          | Additional hardening                                         |
| `20260411110000_warehouse_location_softdelete_groups_fix.sql`     | Integrate group clearing into soft-delete RPC                |
| `20260412113000_warehouse_location_inherit_group_color.sql`       | Color inheritance from groups                                |
| `20260412170000_warehouse_dual_projection_phase1.sql`             | Dual-projection support (physical metadata, front-elevation) |
| `20260412193000_warehouse_location_inherit_parent_color.sql`      | Color inheritance from parent                                |
| `20260412195500_warehouse_location_code_unique_per_parent.sql`    | Code uniqueness by parent scope                              |
| `20260412203000_warehouse_top_storage_segment_role.sql`           | Top-storage segment support                                  |
| `20260417110000_public_warehouse_maps.sql`                        | Public warehouse maps feature                                |
| `20260419100000_warehouse_location_elevation_level.sql`           | Elevation level column                                       |

---

## 10. COMPLEXITY HOTSPOTS & PAIN POINTS

### 1. Dual-Projection Complexity

Supporting top-down + front-elevation projections means shapes have `projection` + `anchor_location_id` fields, the DB trigger validates anchor requirements, and the editor must render two separate canvas views. Physical dimension validation (height constraints for front-elevation) adds ~100 LOC of validation logic in the service layer.

**Refactor opportunity:** Consider a dedicated front-elevation shape store (separate RPC/table) if complexity grows further.

### 2. Soft-Delete RLS Quirk

PostgREST enforces that after an UPDATE, the resulting row is still visible under the SELECT policy. Since SELECT requires `deleted_at IS NULL`, a soft-delete UPDATE makes the row invisible → PostgREST treats this as a WITH CHECK violation.

**Workaround:** A second SELECT policy for manage users that sees all rows (including soft-deleted). This affects locations, groups, layouts, and shapes — all four tables need the dual-SELECT policy pattern.

**Refactor opportunity:** Use a VIEW for soft-delete filtering at query time instead of table-level policies.

### 3. Hierarchy Level Maintenance

The `level` field must stay consistent across the entire tree. Every reparent operation must cascade level updates to all descendants via recursive CTE RPC. If the RPC fails midway, the tree could become inconsistent.

**Pain:** Level is never manually set in client code — all reparents must go through the RPC. No periodic consistency check or repair script exists.

### 4. Color Inheritance Chain

A location can inherit color from its group (`inherit_group_color`) OR its parent (`inherit_parent_color`). `getEffectiveLocationColor()` recalculates this client-side on every render by traversing groups + locations lists. No DB-computed denormalized column.

**Pain:** For large trees, this could be a perf bottleneck. Consider denormalizing `effective_color` in DB or caching at query level.

### 5. Front-Segment Height Validation

`validateFrontSegmentHeight()` is ~100 LOC: fetches all siblings, sums their heights, compares to parent's `physical_height_m`. Complex, in TypeScript only, not enforced by a DB constraint.

**Refactor opportunity:** Extract into a dedicated validator module. Add a DB CHECK constraint or trigger to reinforce the invariant server-side.

### 6. Batch Save Shape Semantics (Data Loss Risk)

The `batch_save_warehouse_layout_shapes` RPC replaces all active shapes — any shape not in the input list is soft-deleted. If the client sends an incomplete list, shapes are silently lost.

**Pain:** No conflict detection if two users edit simultaneously. Consider adding `updated_at` versioning or optimistic locking.

### 7. Fragmented Authorization

Permission validation is split across: RLS policies (table level), RPC internal checks (`publish_warehouse_layout` checks `warehouse.layouts.publish` inside the function), and server action gates.

**Pain:** Hard to audit all permission gates in one place. A change to the publish permission requires updating RPC, server action, and client guard independently.

### 8. No Undo/Redo in Map Editor

If a user makes a mistake in the canvas editor, there's no undo. Must manually correct.

**Refactor opportunity:** Add client-side undo stack to canvas state management.

### 9. Code Uniqueness Per Parent (Unusual Scope)

Location codes are unique per (org, branch, parent). Changing a location's parent can trigger uniqueness conflicts if a sibling already has that code.

**Pain:** This unusual uniqueness scope is likely a source of confusion during refactoring.

### 10. No Cross-Org/Cross-Branch Data Leakage Tests

RLS policies are designed to prevent cross-org/cross-branch access, but there is no explicit test suite validating these boundaries.

**Refactor opportunity:** Add integration tests for RLS policies.

---

## Summary: Key Entities & Relationships

| Entity         | Table                       | Parent FK                              | Soft-Delete | Permissions             | Notes                                                   |
| -------------- | --------------------------- | -------------------------------------- | ----------- | ----------------------- | ------------------------------------------------------- |
| Location       | `warehouse_locations`       | `parent_id` (self)                     | Yes         | `warehouse.locations.*` | Hierarchical; code unique per parent; color inheritance |
| Location Group | `warehouse_location_groups` | `parent_location_id`                   | Yes         | `warehouse.locations.*` | Display-only; scoped to parent; color cascade           |
| Layout         | `warehouse_layouts`         | `root_location_id` (scopes to subtree) | Yes         | `warehouse.layouts.*`   | One published per scope; atomic publish/unpublish       |
| Shape          | `warehouse_layout_shapes`   | `location_id`, `anchor_location_id`    | Yes         | `warehouse.layouts.*`   | Flat (V1); dual-projection; batch-save semantics        |
