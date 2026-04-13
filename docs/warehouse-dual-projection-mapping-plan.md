# Warehouse Dual-Projection Mapping Plan

## Goal

Extend the current warehouse location + visual layout system with a second visual
projection:

- `top_down`: today's floor-plan style warehouse / room map
- `front_elevation`: a front view for a selected top-down storage unit such as a
  rack, shelving unit, cabinet, or cold-room bay

The feature must stay aligned with the existing architecture:

- `warehouse_locations` remains the operational source of truth
- `warehouse_layouts` + `warehouse_layout_shapes` remain the visual document layer
- permissions and RLS continue to be enforced through branch-aware Supabase access
- the model must remain portable to mobile, even if full editing initially ships
  only on web

This document proposes the scalable, enterprise-safe path.

---

## Current Model Summary

Today the system already has:

- hierarchical `warehouse_locations`
- display-only `warehouse_location_groups`
- visual `warehouse_layouts`
- visual `warehouse_layout_shapes`
- map dialog + viewer
- map editor for top-down placement

At the moment:

- root location acts as the layout scope
- direct children of the root are represented on the `top_down` map
- deeper descendants exist operationally, but do not yet have an explicit
  front-view projection model

That gives us a good foundation. We should build the new feature by extending the
visual semantics, not by replacing the current system.

---

## Product Semantics

### Location Levels

The intended behavior can be expressed as a convention:

- `depth 0 from selected layout root`
  - the warehouse / room / root space
- `depth 1`
  - a top-down storage unit or area
  - examples: rack, cabinet, freezer block, shelving block
- `depth 2`
  - front-elevation subdivisions inside that storage unit
  - examples: shelf, drawer, vertical segment, compartment row
- `depth 3+`
  - deeper operational locations
  - examples: bins, sub-bins, trays, pick faces

However, depth should be treated as a **default convention**, not a hard-coded
universal truth. The model should support explicit role hints so we do not lock
the platform into one warehouse pattern forever.

### Derived Visual Inheritance

For any location in the tree, the UI should be able to resolve:

- `layout_root_location_id`
  - the nearest ancestor that owns the current layout
- `top_down_anchor_location_id`
  - the nearest ancestor that provides the top-down footprint
- `front_anchor_location_id`
  - the nearest ancestor that provides the front-elevation slot

This means deeply nested nodes do not need independent shapes in every
projection. Instead, the viewer can highlight:

- the top-down anchor in the floor plan
- the front anchor in the elevation panel

Example:

- `MW` -> `R1` -> `Shelf 2` -> `Bin 4`

The viewer should resolve:

- layout root: `MW`
- top-down anchor: `R1`
- front anchor: `Shelf 2`

This is the cleanest way to support dialogs like "where is this location?".

---

## Recommended Domain Design

## Core Rule

Keep `warehouse_locations` as the shared domain entity, and add **physical /
mapping metadata** there. Keep actual visual placement inside
`warehouse_layout_shapes`.

This gives us:

- web editor flexibility
- mobile-readiness
- shared server validations
- no duplication of business semantics in a single web-only component

## Add Physical Metadata To Locations

Recommended new columns on `warehouse_locations`:

- `physical_width_m numeric null`
- `physical_depth_m numeric null`
- `physical_height_m numeric null`
- `physical_elevation_start_m numeric null`
- `storage_mode text not null default 'standard'`
- `map_role text not null default 'logical'`
- `allow_top_storage boolean not null default false`

Suggested meaning:

- `physical_width_m`
  - horizontal span in front view, width of rack/cabinet/shelf face
- `physical_depth_m`
  - floor depth / top-down depth
- `physical_height_m`
  - vertical span
- `physical_elevation_start_m`
  - bottom edge of the segment within the parent front elevation
- `storage_mode`
  - future-safe semantic hint such as `standard`, `rack`, `cabinet`, `drawer`,
    `shelf`, `bin`, `zone`
- `map_role`
  - controls default visual behavior
- `allow_top_storage`
  - whether content may legally extend above the nominal unit height

Recommended `map_role` enum values:

- `logical`
- `layout_root`
- `top_down_unit`
- `front_segment`

Why not rely on depth only:

- future layouts will not all follow the same nesting pattern
- some children of root may be logical groupings, not physical floor shapes
- some `depth 2` nodes may still be logical rather than front segments

Depth can still supply defaults in UI, but server-side meaning should not be
purely implicit.

---

## Extend Layout Shapes With Projection

Add explicit projection semantics to `warehouse_layout_shapes`.

Recommended columns:

- `projection text not null default 'top_down'`
- `anchor_location_id uuid null`

Suggested `projection` enum values:

- `top_down`
- `front_elevation`

Semantics:

- `location_id`
  - the operational location that the shape directly represents
- `anchor_location_id`
  - the parent context this shape belongs to for rendering

Examples:

- top-down rack shape
  - `projection = 'top_down'`
  - `location_id = R1`
  - `anchor_location_id = MW`
- front shelf shape
  - `projection = 'front_elevation'`
  - `location_id = Shelf 2`
  - `anchor_location_id = R1`

This keeps one shapes table while making the projection context explicit.

### Geometry By Projection

Keep `geometry` as JSONB, but validate projection-specific keys.

For `top_down`:

- `x`
- `y`
- `width`
- `height`
- `rotation`

For `front_elevation`:

- `x`
- `y`
- `width`
- `height`

Where:

- in `top_down`, `width` and `height` mean floor footprint dimensions
- in `front_elevation`, `width` and `height` mean face width and vertical span

If desired later, the field names can stay generic while the renderer interprets
them per projection.

---

## Database Migration Strategy

### Phase 1 Schema Migration

Create a migration that:

1. Adds physical metadata columns to `warehouse_locations`
2. Adds `projection` and `anchor_location_id` to `warehouse_layout_shapes`
3. Adds indexes for projection-scoped lookups
4. Adds DB constraints and triggers for projection consistency

Recommended indexes:

- on `warehouse_layout_shapes(layout_id, projection, deleted_at)`
- on `warehouse_layout_shapes(anchor_location_id, projection, deleted_at)`
- on `warehouse_layout_shapes(location_id, projection, deleted_at)`
- on `warehouse_locations(map_role, deleted_at)` if query volume justifies it

### Phase 1 Constraints

Add DB-level checks:

- `physical_*` values must be positive when present
- `physical_elevation_start_m >= 0` when present
- `map_role` must be a valid enum-like value
- `projection` must be a valid enum-like value

### Phase 2 Trigger Validations

Add server-side and DB-side validation for:

- `front_elevation` shapes must reference an anchor location
- `top_down` shapes for direct root children must anchor to the layout root
- `front_segment` locations should not exceed parent height unless
  `allow_top_storage = true`
- sibling front segments should not overlap vertically unless the product later
  explicitly supports overlap

DB trigger responsibility:

- protect invariants no matter which client writes
- fail closed even if future code paths bypass current UI assumptions

---

## Supabase Security, RLS, and Permissions

The new feature should stay within the existing warehouse permission boundary
model rather than introducing a parallel security concept.

Recommended permission mapping:

- `warehouse.locations.read`
  - read locations and derived physical metadata
- `warehouse.locations.manage`
  - manage location physical metadata
- `warehouse.layouts.read`
  - view top-down and front-elevation projections
- `warehouse.layouts.manage`
  - edit projection shapes
- `warehouse.layouts.publish`
  - publish layouts that include both projections

No new permission family is required unless later you want separate control over
front-elevation authoring.

### RLS Guidance

RLS should remain branch-scoped and layout-shape access should remain gated by
org + branch alignment.

New columns do not fundamentally change policy structure, but triggers must
validate:

- `anchor_location_id` belongs to the same `organization_id` + `branch_id`
- `location_id` belongs to the same `organization_id` + `branch_id`
- any parent-child geometry assumptions reference active, non-deleted rows only

Do not move projection validation solely into client code.

---

## Service Layer Changes

### `warehouse-locations.service.ts`

Extend create/update flows to support the new physical metadata:

- width
- depth
- height
- elevation start
- map role
- top storage flag

Validation responsibilities:

- no negative dimensions
- no invalid combinations for chosen `map_role`
- optional parent-child height envelope checks

Recommended helper functions:

- `resolveLocationMapContext(locationId)`
- `resolveLayoutRoot(locationId)`
- `resolveTopDownAnchor(locationId)`
- `resolveFrontAnchor(locationId)`
- `validatePhysicalEnvelope(locationId, input)`

These helpers should live server-side and in shared pure utilities where
possible, because both web and mobile will need the same logic.

### `warehouse-layout-shapes.service.ts`

Extend CRUD and batch save flows to support projection-aware shapes.

Recommended additions:

- `listByLayoutAndProjection(layoutId, projection)`
- `listFrontElevationShapes(layoutId, anchorLocationId)`
- `batchSaveProjectedShapes(layoutId, projection, anchorLocationId, shapes[])`

The current batch save model should still work well if the payload stays scoped
to one layout + one projection context per save action.

---

## Server Actions And Schemas

### Actions

Add or extend server actions for:

- updating location physical metadata
- fetching front-elevation shapes for a selected top-down unit
- batch saving front-elevation shapes

### Zod Schemas

Extend current warehouse location schemas with optional:

- `physical_width_m`
- `physical_depth_m`
- `physical_height_m`
- `physical_elevation_start_m`
- `map_role`
- `allow_top_storage`

Extend layout shape schemas with:

- `projection`
- `anchor_location_id`

Validation should remain permissive enough for drafts, but strict enough to
avoid impossible geometry in published layouts.

---

## Shared Types

Update:

- `apps/web/src/lib/warehouse/location-tree.ts`
- `apps/web/src/lib/warehouse/layouts.ts`
- generated Supabase types

Recommended location type additions:

```ts
type WarehouseLocationMapRole = "logical" | "layout_root" | "top_down_unit" | "front_segment";
```

```ts
interface WarehouseLocationPhysicalMeta {
  physical_width_m: number | null;
  physical_depth_m: number | null;
  physical_height_m: number | null;
  physical_elevation_start_m: number | null;
  map_role: WarehouseLocationMapRole;
  allow_top_storage: boolean;
}
```

Recommended shape type additions:

```ts
type WarehouseLayoutProjection = "top_down" | "front_elevation";
```

These shared types are the bridge to future mobile support.

---

## UI / UX Plan

## Editor Layout

Do **not** try to collapse both projection editors into a single overloaded
canvas. Keep them visually separate.

Recommended editor composition:

- top section:
  - top-down canvas editor
- bottom section:
  - front-elevation editor for the currently selected top-down unit

Behavior:

- selecting a top-down shape that represents a `top_down_unit` opens its
  front-elevation editor
- if nothing eligible is selected, the bottom panel shows an empty / guidance
  state
- a deep descendant selected from the tree resolves to its top-down anchor and
  front anchor automatically

### Why This Is Better

- easier mental model
- simpler constraints
- simpler rendering code
- lower risk of editor regressions
- easier to reuse the front-elevation viewer independently in dialogs

---

## Authoring Flow

### Creating a root layout

For root locations:

- choose or confirm warehouse / room dimensions
- create or open the published/draft layout

### Creating a top-down unit

For locations intended to appear in top-down view:

- user creates a child location under the root
- user sets:
  - width
  - depth
  - optional height
  - role defaults to `top_down_unit`
- user places it on the top-down map

### Creating a front segment

For locations intended to appear in front view:

- user creates a child under a `top_down_unit`
- user sets:
  - height
  - optional width override
  - optional elevation start
  - role defaults to `front_segment`
- front editor auto-places it or lets the user place/resize it

### Deeper descendants

For deeper locations:

- keep forms simple by default
- they do not need to become shapes automatically
- the viewer resolves inherited anchors

This reduces friction while preserving precise "find on map" behavior.

---

## Recommended Defaults And Automation

To avoid making every create/edit form too heavy, use smart defaults.

### Default Role Resolution

When creating a child:

- if parent is root layout, default child to `top_down_unit`
- if parent is `top_down_unit`, default child to `front_segment`
- otherwise default to `logical`

### Default Dimension Behavior

- width / depth for `top_down_unit` can be required only when "show on map" is
  enabled
- height for `front_segment` can be required only when "show in front view" is
  enabled
- `physical_elevation_start_m` can initially be auto-computed by stack order

### Auto-Layout Helpers

Provide helpers before forcing manual precision:

- `stack evenly`
- `stack from bottom`
- `distribute with gaps`
- `fill available height`

This is much more usable than expecting exact meter-based input for every shelf.

---

## Viewer / Dialog Behavior

The reusable map dialog should evolve into a dual-projection viewer.

Recommended behavior for a highlighted location:

1. Resolve its layout root
2. Resolve its top-down anchor
3. Resolve its front anchor
4. Open:
   - top-down map with top-down anchor highlighted
   - front-elevation panel with front anchor highlighted when available

Example:

- selected location: `Bin 4`
- top-down map highlights `R1`
- front elevation highlights `Shelf 2`

This is far more useful operationally than trying to draw every deep node in the
top-down plane.

---

## Mobile Strategy

The feature is mobile-compatible if we keep the logic in domain helpers and
shared types.

Recommended mobile rollout:

- Phase 1:
  - read-only dual-projection viewer
- Phase 2:
  - item/location "find on map"
- Phase 3:
  - limited editing only if product value justifies it

Do not design the data model around current web editor assumptions alone.

---

## Performance Considerations

This feature is feasible without unusual performance risk if we keep projection
queries scoped.

### Good Practices

- load top-down shapes for the layout normally
- load front-elevation shapes only for the selected anchor location
- memoize derived anchor-resolution functions
- continue using batch save for geometry updates
- debounce editor persistence
- avoid rendering front-view geometry for the entire warehouse at once

### What To Avoid

- fetching all front-elevation shapes for every top-down unit in one payload
- recomputing ancestry chains inside render loops
- storing redundant inherited fields that can drift

---

## Enterprise-Grade Validation Rules

Recommended business rules:

- dimensions must be positive
- front segments must remain within parent height unless `allow_top_storage`
- front segments should not overlap by default
- top-down units should not exceed layout extents
- published layouts must not contain invalid geometry
- changing a location role should revalidate all linked shapes

Recommended publishing rule:

- drafts may contain incomplete geometry
- published layouts must pass strict validation

That gives teams flexibility while keeping production maps trustworthy.

---

## Testing Strategy

### Unit Tests

Add tests for:

- role inference defaults
- anchor resolution
- envelope validation
- front projection validation
- published layout strict validation

### Service Tests

Add tests covering:

- location physical metadata create/update
- invalid parent-child height combinations
- projection mismatch errors
- front-elevation shape save and query behavior

### UI Tests

Add tests for:

- selecting top-down unit reveals front-elevation panel
- deep descendant highlight resolves correct anchors
- front panel empty state
- auto-layout helper behavior

### RLS / DB Invariant Tests

Add DB-facing tests for:

- cross-branch anchor denial
- invalid projection writes
- invalid parent height violations
- publish flow rejection on invalid geometry

---

## Recommended Implementation Phases

## Phase 0: Design and invariants

- finalize schema
- define role/projection vocabulary
- define publish-time validation rules

## Phase 1: Schema and shared types

- add physical metadata columns
- add shape projection columns
- regenerate Supabase types
- add service and Zod support

## Phase 2: Derived read-only front viewer

- no editing yet
- selecting top-down unit shows front-elevation panel
- dual-projection map dialog works for deep descendants

This is the lowest-risk milestone and proves the model.

## Phase 3: Front-elevation editor

- add front projection editing
- add auto-stack helpers
- add validation feedback

## Phase 4: Publish-time hardening

- strict publish validator
- cross-projection consistency checks
- test coverage for invalid states

## Phase 5: Mobile read-only support

- dual viewer on mobile
- item/location lookup integrations

---

## Recommendation Summary

Recommended approach:

- keep `warehouse_locations` as the domain truth
- add physical metadata there
- extend `warehouse_layout_shapes` with explicit projection context
- compute top-down and front anchors for deep descendants
- ship read-only front view first
- ship front editor second

This gives the best balance of:

- scalability
- clarity
- security
- mobile portability
- low regression risk to the current map editor

---

## Open Questions

These decisions should be confirmed before implementation:

1. Should `map_role` be fully explicit, or default-only with optional override?
2. Do we want one front-elevation anchor per top-down unit, or support multiple
   named faces later?
3. Should front segments auto-stack by default, or always require manual
   vertical placement?
4. At publish time, do we reject all incomplete physical metadata, or only
   projection-linked records?
5. Should deeper descendants ever become directly renderable front-view shapes,
   or always resolve to nearest front anchor?

My recommendation:

- explicit `map_role` with smart defaults
- one front face for now
- auto-stack first, manual override second
- strict publish validation only for projection-linked records
- deeper descendants resolve to nearest anchor unless explicitly promoted later
