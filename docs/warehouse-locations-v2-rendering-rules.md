# Warehouse Locations V2 — Rendering Rules

**Purpose:** Authoritative rules for the V2 location visualization architecture. All new code must follow these rules. Legacy code violating these rules is marked for Phase 8 removal.

**Created:** 2026-05-07

---

## A. Canonical Data Sources

### `warehouse_locations` — logical/inventory truth

Owns:

- Location hierarchy (parent/child relationships)
- Inventory identity (QR code — immutable)
- Storage capability (`can_store_inventory`)
- Physical dimensions (`width_mm`, `height_mm`, `depth_mm`)
- Location categorization (`location_category`)
- Lifecycle state (`status`: active / inactive / archived)
- Audit trail (`created_by`, `updated_by`, timestamps)

Does NOT own:

- Where the location appears on a map
- How the location is rendered visually
- Which layout it belongs to
- Whether it has been mapped

### `warehouse_location_visual_nodes` — visual representation truth

Owns:

- Whether/where a location is placed on a specific layout
- Which view type the representation belongs to (`top_down`, `front`, `interior`)
- The visual bounds (position, size, rotation) in mm
- The visualization hint (`visualization_type`: rack, bin, grid, etc.)
- The visual role (`primary`, `label`, `reference`, `aggregate`)
- View context scoping (`view_context_location_id`)

Does NOT own:

- The location's inventory identity
- The location's logical hierarchy
- Stock or movement data

### `warehouse_layout_split_nodes` — interior composition truth

Owns:

- Visual subdivision structure (grid, rows, masonry)
- Split intent (direction, size_mode, size_value)
- Cached calculated geometry (derived, not source of truth)
- Link between a split cell and a real location

Does NOT own:

- Location existence or identity
- Inventory data

### `warehouse_layout_shapes` — decorative/compatibility only

Valid uses:

- Walls, doors, aisles, obstacles, labels, measurement lines
- Any non-location drawing element on a layout canvas

NOT for:

- Representing the visual placement of a location (use `warehouse_location_visual_nodes`)
- Driving location existence or inventory logic

---

## B. Invariants

### B.1 Location independence from visuals

> **A location must exist and function independently of any visual representation.**

Corollaries:

- Deleting a visual node (`warehouse_location_visual_nodes`) must NEVER delete or archive the linked location
- A location with no visual node is in "unmapped" state — this is valid, not an error
- Inventory stock can exist on an unmapped location
- QR codes remain valid on unmapped locations
- Location search/list queries must work regardless of visual state

### B.2 Visual independence from inventory

> **Creating, updating, or deleting a visual node must NEVER modify inventory data.**

Corollaries:

- `upsertNode` does not affect `inventory_balances` or any stock table
- `softDeleteNode` does not affect stock
- `batchUpsert` does not move stock
- `softDeleteAllForLocation` does not archive the location

### B.3 Inventory placement independence from rendering

> **Inventory placement (which location holds stock) must NEVER depend on map rendering state.**

Corollaries:

- Stock assignments reference `warehouse_locations.id`, never `warehouse_location_visual_nodes.id`
- A location does not need a visual node to receive stock
- Putaway suggestions use location hierarchy and `can_store_inventory`, not visual state

### B.4 No `map_role` in V2 rendering

> **V2 rendering code must NOT use `map_role` to make rendering decisions.**

Deprecated patterns:

```typescript
// WRONG — legacy pattern
if (location.map_role === 'top_down_unit') { ... }
if (['front_segment', 'top_storage_segment'].includes(location.map_role)) { ... }
```

V2 equivalents:

```typescript
// RIGHT — V2 pattern
if (visualNode.view_type === 'top_down') { ... }
if (visualNode.view_type === 'front') { ... }
if (location.can_store_inventory) { ... }
if (location.location_category === 'shelf') { ... }
```

### B.5 Visual scope is always explicit

> **Every visual node is scoped to: layout_id + view_type + view_context_location_id.**

There is no "global" visual state for a location. A location may have:

- A top-down node in layout A
- A front node in layout A (scoped to a parent location)
- A top-down node in layout B
- No visual nodes at all

Each of these is a separate `warehouse_location_visual_nodes` row.

---

## C. Visual Node Uniqueness Rule

One PRIMARY visual node per (location, view_type, layout, view_context) scope:

```sql
-- Enforced by unique index: wlvn_primary_unique_idx
(location_id, view_type, layout_id, view_context_location_id)
WHERE deleted_at IS NULL AND status = 'active' AND visual_role = 'primary'
```

Non-primary nodes (`label`, `reference`, `aggregate`) may exist without uniqueness constraints.

---

## D. Mapping Status

A location's mapping status is computed from its active primary visual nodes:

| Status             | Condition                                                                             |
| ------------------ | ------------------------------------------------------------------------------------- |
| `mapped`           | Has at least one active primary visual node; all active children also mapped          |
| `partially_mapped` | Has at least one active primary visual node; one or more active children are unmapped |
| `unmapped`         | Has no active primary visual node                                                     |

Use `get_warehouse_location_mapping_status(location_id)` RPC or `WarehouseLocationsService.getMappingStatus()` to retrieve this. Do NOT compute it manually.

---

## E. View Type Semantics

| `view_type` | What it represents                                         | Canvas space                                 |
| ----------- | ---------------------------------------------------------- | -------------------------------------------- |
| `top_down`  | Floor footprint of a physical object                       | X (width) + Y (depth)                        |
| `front`     | Face/interior of a physical object                         | X (width) + Z (height)                       |
| `interior`  | Internal structure of a container                          | X (width) + Z (height), alternative to front |
| `side`      | Side elevation (reserved for future use)                   | Y (depth) + Z (height)                       |
| `3d`        | Three-dimensional representation (reserved for future use) | X + Y + Z                                    |

---

## F. Coordinate System

All dimensions and positions are in **millimeters (integer)**.

3D physical model:

- **X** = width (left/right)
- **Y** = depth (front/back)
- **Z** = height (bottom/top)

Projection mapping:

- Top-down canvas renders X + Y (z_mm unused)
- Front/interior canvas renders X + Z (y_mm = inherited from parent physical depth)

Positions on visual nodes are **local coordinates** relative to the parent context, NOT absolute global coordinates. If the parent object moves, children move with it.

---

## G. Decorative Shapes (`warehouse_layout_shapes`)

Decorative shapes are SEPARATE from location visual representations. Rules:

1. **Decorative shapes must NOT have `shape_type='location'`** in new V2 code. That field is legacy.
2. Decorative shapes define non-inventory map elements (walls, doors, aisles, obstacles, labels).
3. Decorative shapes use the existing `batch_save_warehouse_layout_shapes` RPC (whole-layout replace semantics) — this is acceptable for decorative elements since they carry no inventory meaning.
4. New V2 editor code must write location visuals ONLY to `warehouse_location_visual_nodes`.
5. The legacy editor may continue writing `shape_type='location'` to `warehouse_layout_shapes` as a temporary compatibility measure during transition.

---

## H. V2 Code Guidelines

### Do

```typescript
// ✅ List visual representations of a location
WarehouseLocationVisualNodesService.listByLocation(supabase, orgId, locationId)

// ✅ Place a location on a map
WarehouseLocationVisualNodesService.upsertNode(supabase, orgId, branchId, { ... })

// ✅ Remove visual representation without affecting location
WarehouseLocationVisualNodesService.softDeleteNode(supabase, orgId, nodeId)

// ✅ Check if location has a visual representation
WarehouseLocationsService.getMappingStatus(supabase, orgId, locationId)

// ✅ Find locations without visual representations
WarehouseLocationVisualNodesService.getUnmappedLocations(supabase, orgId, branchId, layoutId)

// ✅ Use location_category for rendering decisions
if (location.location_category === 'bin') { ... }

// ✅ Use can_store_inventory for inventory decisions
if (location.can_store_inventory) { ... }
```

### Do NOT

```typescript
// ❌ Write location placement to shapes table
supabase.from('warehouse_layout_shapes').insert({ shape_type: 'location', ... })

// ❌ Read location placements from shapes table
supabase.from('warehouse_layout_shapes').select('*').eq('shape_type', 'location')

// ❌ Use map_role for rendering decisions
if (location.map_role === 'top_down_unit') { ... }

// ❌ Delete location when removing visual
WarehouseLocationsService.softDelete(supabase, orgId, locationId) // triggered by visual removal

// ❌ Move stock during visual operations
// (stock operations must be explicit user actions, never triggered by map changes)
```
