# Warehouse Dual-Projection Implementation Checklist

## Purpose

This document translates the dual-projection architecture into a build-ready
implementation checklist for the current codebase.

It is intentionally specific to this repository:

- Next.js web app in `apps/web`
- Supabase-backed services and RLS
- current warehouse domain split:
  - `warehouse_locations` = operational truth
  - `warehouse_layouts` + `warehouse_layout_shapes` = visual layer

Related design doc:

- [warehouse-dual-projection-mapping-plan.md](/Users/michal/dev/turbo/amba-system/docs/warehouse-dual-projection-mapping-plan.md)

---

## Delivery Strategy

Recommended rollout:

1. Schema and shared types
2. Server/domain support
3. Read-only dual-projection viewer
4. Front-elevation editor
5. Publish hardening
6. Mobile read-only adoption

Do not start with the full editor. The safest first product milestone is:

- top-down map stays as-is
- selecting a top-down unit reveals a read-only front view below
- map dialogs for deep descendants resolve top-down and front anchors correctly

---

## Phase 0: Confirm Product Decisions

Before implementation, confirm these defaults:

- `map_role` will be explicit in data, with UI defaults based on depth
- one `front_elevation` face per top-down unit for v1
- front segments auto-stack by default, with manual override later
- strict validation applies at publish time, not for every draft save
- deep descendants resolve to nearest anchors rather than becoming shapes by default

These decisions should be written into the issue / implementation thread before
schema work starts.

---

## Phase 1: Schema Changes

## 1.1 Add Physical Metadata To `warehouse_locations`

Create a new migration in:

- `apps/web/supabase/migrations/`

Add columns to `public.warehouse_locations`:

- `physical_width_m numeric null`
- `physical_depth_m numeric null`
- `physical_height_m numeric null`
- `physical_elevation_start_m numeric null`
- `map_role text not null default 'logical'`
- `storage_mode text not null default 'standard'`
- `allow_top_storage boolean not null default false`

Add check constraints:

- width, depth, height > 0 when present
- `physical_elevation_start_m >= 0` when present
- `map_role in ('logical', 'layout_root', 'top_down_unit', 'front_segment')`

Optional for v1:

- `storage_mode in ('standard', 'rack', 'cabinet', 'drawer', 'shelf', 'bin', 'zone')`

### 1.1 Acceptance Criteria

- migration is idempotent where appropriate
- comments are added for every new column
- no existing rows become invalid

## 1.2 Add Projection Metadata To `warehouse_layout_shapes`

Add columns to `public.warehouse_layout_shapes`:

- `projection text not null default 'top_down'`
- `anchor_location_id uuid null references public.warehouse_locations(id) on delete set null`

Add check constraint:

- `projection in ('top_down', 'front_elevation')`

Add indexes:

- `(layout_id, projection)` where `deleted_at is null`
- `(anchor_location_id, projection)` where `deleted_at is null`
- `(location_id, projection)` where `deleted_at is null`

### 1.2 Acceptance Criteria

- existing top-down shapes migrate cleanly with `projection = 'top_down'`
- new columns do not break existing batch-save RPCs or service queries

## 1.3 Add DB Invariants

Create DB trigger validation functions for:

- projection/location/anchor branch consistency
- `front_elevation` shape requiring a valid `anchor_location_id`
- optional height envelope checks for `front_segment` locations

Recommended migration names:

- `202604xx000000_warehouse_location_physical_metadata.sql`
- `202604xx000100_warehouse_layout_shape_projection.sql`
- `202604xx000200_warehouse_dual_projection_invariants.sql`

### 1.3 Acceptance Criteria

- cross-branch anchor references are rejected
- invalid projection values are rejected
- invalid front-shape anchor references are rejected at DB layer

---

## Phase 2: Regenerate Supabase Types

After applying migrations:

- regenerate types for `apps/web/supabase/types/target.types.ts`

Confirm new columns appear in:

- `warehouse_locations`
- `warehouse_layout_shapes`

### 2.1 Acceptance Criteria

- generated types match migration output
- no hand-edited type drift remains

---

## Phase 3: Shared Type System

## 3.1 Update Location Types

Modify:

- `apps/web/src/lib/warehouse/location-tree.ts`

Add:

```ts
export type WarehouseLocationMapRole =
  | "logical"
  | "layout_root"
  | "top_down_unit"
  | "front_segment";
```

Extend `WarehouseLocation` with:

- `physical_width_m: number | null`
- `physical_depth_m: number | null`
- `physical_height_m: number | null`
- `physical_elevation_start_m: number | null`
- `map_role: WarehouseLocationMapRole`
- `storage_mode: string`
- `allow_top_storage: boolean`

Add pure helpers:

- `resolveLayoutRoot`
- `resolveTopDownAnchor`
- `resolveFrontAnchor`
- `resolveLocationMapContext`

These should be pure tree/ancestor utilities that can be reused in web and
mobile.

## 3.2 Update Layout Types

Modify:

- `apps/web/src/lib/warehouse/layouts.ts`

Add:

```ts
export type WarehouseLayoutProjection = "top_down" | "front_elevation";
```

Extend `WarehouseLayoutShape` with:

- `projection: WarehouseLayoutProjection`
- `anchor_location_id: string | null`

Extend `ShapeUpsertInput` with:

- `projection?: WarehouseLayoutProjection`
- `anchor_location_id?: string | null`

### 3.2 Acceptance Criteria

- all existing map code still compiles with default `top_down`
- new helpers are pure and not tied to client-only or server-only imports

---

## Phase 4: Zod Schemas And Action Contracts

## 4.1 Update Location Action Schemas

Modify:

- `apps/web/src/app/actions/warehouse/schemas.ts`

Add optional fields to:

- `createLocationSchema`
- `updateLocationSchema`

Fields:

- `physical_width_m`
- `physical_depth_m`
- `physical_height_m`
- `physical_elevation_start_m`
- `map_role`
- `storage_mode`
- `allow_top_storage`

Add schema helpers:

- positive numeric meters
- enum validation for `map_role`

## 4.2 Update Layout Shape Schemas

Modify:

- `apps/web/src/app/actions/warehouse/layout-schemas.ts`

Add:

- `projection`
- `anchor_location_id`

Update:

- `shapeUpsertSchema`
- `batchSaveShapesSchema`

If needed, add projection-specific refinement:

- `front_elevation` requires `anchor_location_id`

### 4.2 Acceptance Criteria

- client form validation and server action parsing remain aligned
- no existing top-down payload breaks

---

## Phase 5: Service Layer

## 5.1 Update `warehouse-locations.service.ts`

Modify:

- `apps/web/src/server/services/warehouse-locations.service.ts`

Tasks:

- include new physical metadata in select column lists
- allow create/update for new fields
- validate `map_role` and physical dimensions
- add helper methods:
  - `resolveLayoutRoot`
  - `resolveTopDownAnchor`
  - `resolveFrontAnchor`
  - `resolveMapContext`

Recommended behavior:

- role defaults can be applied in UI or action layer
- service layer must still validate explicit writes
- envelope validation should be fail-closed when enough parent metadata exists

## 5.2 Update `warehouse-layout-shapes.service.ts`

Modify:

- `apps/web/src/server/services/warehouse-layout-shapes.service.ts`

Tasks:

- include new `projection` and `anchor_location_id` fields in all selects
- support querying by projection
- support querying front-elevation shapes by anchor location
- extend batch-save behavior to preserve projection semantics

Recommended new methods:

- `listByLayoutAndProjection`
- `listFrontElevationByAnchor`
- `batchSaveProjectedShapes`

## 5.3 Optional: Add A Small Resolver Service

If helper logic starts spreading, add a dedicated domain helper:

- `apps/web/src/server/services/warehouse-map-context.service.ts`

Responsibilities:

- resolve root/top-down/front anchors
- centralize map-context logic used by viewer/dialog/editor

### 5.3 Acceptance Criteria

- no duplicated ancestry-resolution logic across editor/dialog/service code
- services remain server-only and RLS-safe

---

## Phase 6: Query Hooks

Modify:

- `apps/web/src/hooks/queries/warehouse/index.ts`

Add hooks for:

- front-elevation shapes by `layoutId + anchorLocationId`
- location map context by `locationId` if needed

Potential hooks:

- `useFrontElevationShapes(layoutId, anchorLocationId)`
- `useLocationMapContext(locationId)`

### 6.1 Acceptance Criteria

- hooks use stable cache keys
- top-down and front-elevation caches invalidate independently where possible

---

## Phase 7: Read-Only Viewer Milestone

## 7.1 Extend Shared Viewer

Modify:

- `apps/web/src/components/v2/warehouse/warehouse-map-viewer.tsx`

Tasks:

- support `projection="top_down" | "front_elevation"`
- keep current top-down behavior untouched
- add front-elevation rendering mode

Important:

- do not overload the component with too many conditional branches if it starts
  getting hard to reason about
- if needed, split rendering internals into:
  - `top-down-renderer.tsx`
  - `front-elevation-renderer.tsx`

## 7.2 Extend Reusable Dialog

Modify:

- `apps/web/src/components/v2/warehouse/warehouse-map-dialog.tsx`

Tasks:

- resolve map context for selected location
- highlight top-down anchor in the top section
- highlight front anchor in a secondary front-elevation panel when available
- keep current single-location and group preview behavior working

Expected UX:

- root or top-down unit:
  - top map only, or top map + optional front panel
- deep child:
  - top map highlights rack/cabinet
  - front panel highlights shelf/front segment

### 7.2 Acceptance Criteria

- existing "show on map" flows keep working
- deep descendants produce meaningful highlights rather than disappearing

---

## Phase 8: Editor UI

## 8.1 Add Read-Only Front Panel To Editor First

Modify likely files:

- `apps/web/src/app/[locale]/dashboard/warehouse/map/[layoutId]/_components/map-editor.tsx`
- `apps/web/src/app/[locale]/dashboard/warehouse/map/[layoutId]/_components/map-canvas.tsx`
- add new component:
  - `front-elevation-panel.tsx`

Behavior:

- selected top-down unit opens a front-elevation panel below
- first implementation is read-only
- panel uses currently selected top-down location as anchor

## 8.2 Add Front-Elevation Editing

Add new component:

- `apps/web/src/app/[locale]/dashboard/warehouse/map/[layoutId]/_components/front-elevation-editor.tsx`

Tasks:

- drag/resize front segments
- stack vertically
- snap to vertical grid
- preserve batch-save behavior

Keep it separate from the top-down canvas.

### 8.2 Acceptance Criteria

- top-down editor remains stable
- front-elevation editor only activates for eligible selected locations
- no page-wide layout instability

---

## Phase 9: Inspector And Forms

## 9.1 Location Create/Edit Form

Modify:

- `apps/web/src/app/[locale]/dashboard/warehouse/locations/_components/location-form-dialog.tsx`

Add fields for:

- width
- depth
- height
- elevation start
- map role
- allow top storage

UX recommendation:

- keep advanced physical fields collapsed behind an "Advanced mapping" section
- prefill defaults based on parent role
- do not require all fields unless the selected role needs them

## 9.2 Shape Inspector

Modify:

- `apps/web/src/app/[locale]/dashboard/warehouse/map/[layoutId]/_components/shape-inspector.tsx`

Tasks:

- show projection-aware fields
- show top-down-unit metadata when selected
- show front-segment metadata when selected
- surface validation warnings for impossible height envelopes

### 9.2 Acceptance Criteria

- forms remain usable and not overloaded
- disabled / derived values are clearly explained

---

## Phase 10: Publish Validation

## 10.1 Server-Side Strict Validator

Add publish-time validation in:

- `apps/web/src/server/services/warehouse-layouts.service.ts`
- or a dedicated validator module:
  - `apps/web/src/server/services/warehouse-layout-publish-validator.ts`

Checks:

- all published top-down shapes are valid
- all published front-elevation shapes are valid
- front segments fit inside parent physical height unless `allow_top_storage`
- all shape/location/anchor references are in-scope and active

Recommended rule:

- drafts may remain incomplete
- publish requires full consistency

### 10.1 Acceptance Criteria

- invalid drafts can be edited
- invalid layouts cannot be published
- publish errors are surfaced in actionable language

---

## Phase 11: Tests

## 11.1 Unit Tests

Add tests for:

- role inference defaults
- anchor resolution
- top-down/front inheritance for deep descendants
- front envelope validation

Likely files:

- `apps/web/src/lib/warehouse/__tests__/...`
- `apps/web/src/server/services/__tests__/...`

## 11.2 Service Tests

Extend:

- `apps/web/src/server/services/__tests__/warehouse-locations.service.test.ts`
- `apps/web/src/server/services/__tests__/warehouse-layout-shapes.service.test.ts`
- `apps/web/src/server/services/__tests__/warehouse-layouts.service.test.ts`

Add cases:

- invalid physical dimensions
- invalid projection writes
- invalid anchor references
- publish validation failure

## 11.3 UI Tests

Extend or add tests for:

- dialog dual-projection rendering
- editor front panel reveal
- deep descendant highlight behavior

Likely files:

- `apps/web/src/app/[locale]/dashboard/warehouse/.../__tests__/...`
- `apps/web/src/components/v2/warehouse/__tests__/...`

## 11.4 RLS / Invariant Tests

Add DB-invariant tests for:

- cross-org/cross-branch anchor writes
- invalid front-elevation shapes
- publish rejection on invalid geometry

### 11.4 Acceptance Criteria

- tests cover both app-layer and DB-layer protection
- no invariant relies on UI-only enforcement

---

## Phase 12: Mobile Read-Only Support

After web read-only viewer stabilizes, expose the shared semantics to mobile.

Tasks:

- move pure resolver helpers into a shared-safe import path if needed
- add mobile read-only dual-projection viewer
- support "find location" flows for items and audit tasks

Do not port the editor immediately unless there is proven value.

---

## Suggested File-Level Change List

### Schema / DB

- `apps/web/supabase/migrations/<timestamp>_warehouse_location_physical_metadata.sql`
- `apps/web/supabase/migrations/<timestamp>_warehouse_layout_shape_projection.sql`
- `apps/web/supabase/migrations/<timestamp>_warehouse_dual_projection_invariants.sql`
- `apps/web/supabase/types/target.types.ts`

### Shared Types / Utilities

- `apps/web/src/lib/warehouse/location-tree.ts`
- `apps/web/src/lib/warehouse/layouts.ts`
- optional new:
  - `apps/web/src/lib/warehouse/map-context.ts`

### Actions / Validation

- `apps/web/src/app/actions/warehouse/schemas.ts`
- `apps/web/src/app/actions/warehouse/layout-schemas.ts`
- possible new actions:
  - `apps/web/src/app/actions/warehouse/front-elevation.ts`

### Services

- `apps/web/src/server/services/warehouse-locations.service.ts`
- `apps/web/src/server/services/warehouse-layout-shapes.service.ts`
- `apps/web/src/server/services/warehouse-layouts.service.ts`
- optional new:
  - `apps/web/src/server/services/warehouse-map-context.service.ts`
  - `apps/web/src/server/services/warehouse-layout-publish-validator.ts`

### Query Hooks

- `apps/web/src/hooks/queries/warehouse/index.ts`

### Viewer / Dialog

- `apps/web/src/components/v2/warehouse/warehouse-map-viewer.tsx`
- `apps/web/src/components/v2/warehouse/warehouse-map-dialog.tsx`

### Editor

- `apps/web/src/app/[locale]/dashboard/warehouse/map/[layoutId]/_components/map-editor.tsx`
- `apps/web/src/app/[locale]/dashboard/warehouse/map/[layoutId]/_components/map-canvas.tsx`
- new:
  - `front-elevation-panel.tsx`
  - `front-elevation-editor.tsx`

### Forms / Inspector

- `apps/web/src/app/[locale]/dashboard/warehouse/locations/_components/location-form-dialog.tsx`
- `apps/web/src/app/[locale]/dashboard/warehouse/map/[layoutId]/_components/shape-inspector.tsx`

---

## First Concrete Milestone

If we want the safest first implementation ticket, build this and stop:

1. Add schema for physical metadata + projection fields
2. Regenerate types
3. Add shared anchor-resolution helpers
4. Extend dialog/viewer to show:
   - top-down anchor
   - read-only front elevation for selected top-down unit
5. Add tests for deep descendant resolution

That milestone already delivers real product value while keeping risk low.

---

## My Recommended Build Order

1. Migrations
2. Generated types
3. Shared pure helpers
4. Service layer
5. Read-only dialog/viewer
6. Editor read-only front panel
7. Editor front-elevation authoring
8. Publish validator
9. Mobile viewer

This order is the best fit for the existing codebase and minimizes churn in the
current, already-working top-down map system.
