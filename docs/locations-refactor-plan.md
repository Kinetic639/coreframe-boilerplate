# AMBRA SYSTEM — LOCATIONS V2 REFACTOR IMPLEMENTATION PLAN

Status: Draft for implementation  
Purpose: Replace the overcomplicated map-role/front-segment location model with a simpler, precise, production-grade architecture.  
Strategy: Additive-first migration, strict inventory safety, UX simplification, and progressive rollout.

---

# 0. IMPLEMENTATION PROGRESS TRACKER

Use this section as the master implementation checklist. Each item should be checked only after code is implemented, tested, reviewed, and merged.

## 0.1 Overall Progress

- [ ] Phase 0 — Architecture approval and implementation safeguards
- [ ] Phase 1 — Database foundation
- [ ] Phase 2 — Service/action/hook foundation
- [ ] Phase 3 — Migration backfill and verification
- [ ] Phase 4 — Simplified locations UI
- [ ] Phase 5 — Top-down visual plan editor
- [ ] Phase 6 — Interior/front-view split editor
- [ ] Phase 7 — Templates and auto-generation
- [ ] Phase 8 — Inventory integration hardening
- [ ] Phase 9 — Draft/publish, undo/redo, and layout safety
- [ ] Phase 10 — Cleanup and deprecation of old concepts

Current implementation status: Not started

---

## 0.2 Phase 0 — Architecture Approval and Safeguards

- [ ] Confirm final model: universal `warehouse_locations` entity
- [ ] Confirm visual representation is separate from location entity
- [ ] Confirm inventory stock references `warehouse_locations`, never visual nodes
- [ ] Confirm visual nodes can be removed without deleting locations
- [ ] Confirm unmapped locations are valid
- [ ] Confirm archived locations remain available for history/audit
- [ ] Confirm old map-role concepts are deprecated from UX
- [ ] Confirm location deletion is replaced by archive/deactivate in user-facing UI
- [ ] Confirm old map editor stays available during transition
- [ ] Confirm database migrations are additive first
- [ ] Confirm migrations are saved locally before Supabase execution
- [ ] Confirm Supabase MCP / target DB tooling is used for DB work
- [ ] Confirm SSR-first and TDD-first implementation approach
- [ ] Confirm all destructive operations require explicit validation

---

## 0.3 Phase 1 — Database Foundation

- [ ] Add new columns to `warehouse_locations`
- [ ] Add `can_store_inventory`
- [ ] Add `status`
- [ ] Add `location_category`
- [ ] Add `width_mm`
- [ ] Add `height_mm`
- [ ] Add `depth_mm`
- [ ] Add indexes for status and storage-capable locations
- [ ] Create `warehouse_location_visual_nodes`
- [ ] Add RLS policies for visual nodes
- [ ] Create `warehouse_layout_split_nodes`
- [ ] Add RLS policies for split nodes
- [ ] Add mapping status RPC
- [ ] Add archive validation RPC
- [ ] Add migration verification SQL queries
- [ ] Apply migrations to dev Supabase only
- [ ] Validate migration results on dev
- [ ] Save migration output / verification result in implementation notes

---

## 0.4 Phase 2 — Service, Actions, Hooks

- [ ] Extend `warehouse-locations.service.ts` with V2 fields
- [ ] Add archive validation service method
- [ ] Add archive location service method
- [ ] Add mapping status service method
- [ ] Add list locations with mapping status service method
- [ ] Create `warehouse-location-visual-nodes.service.ts`
- [ ] Create `warehouse-layout-split-nodes.service.ts`
- [ ] Create location visual node server actions
- [ ] Create split node server actions
- [ ] Extend existing location actions with V2 fields
- [ ] Add archive and validate archive actions
- [ ] Add React Query hooks for V2 locations
- [ ] Add React Query hooks for visual nodes
- [ ] Add React Query hooks for split nodes
- [ ] Add optimistic updates where safe
- [ ] Add rollback behavior for failed optimistic updates
- [ ] Add unit tests for services
- [ ] Add action-level permission tests

---

## 0.5 Phase 3 — Migration Backfill and Verification

- [ ] Backfill dimensions from meters to millimeters
- [ ] Backfill location categories from old map roles
- [ ] Backfill visual nodes from old location shapes
- [ ] Do NOT blindly backfill all old logical/top-down/front roles as inventory-storing
- [ ] Generate ambiguous-location review query
- [ ] Verify old location shape count vs new visual node count
- [ ] Verify unmapped stock-holding locations
- [ ] Verify locations with stock but `can_store_inventory = false`
- [ ] Verify locations with `can_store_inventory = true` and active children
- [ ] Verify duplicate visual nodes
- [ ] Mark old location shapes as migrated/ignored after successful backfill
- [ ] Ensure new UI reads location visuals only from `warehouse_location_visual_nodes`
- [ ] Ensure `warehouse_layout_shapes` remains only for decorative map shapes

---

## 0.6 Phase 4 — Simplified Locations UI

- [ ] Remove `map_role` from user-facing forms
- [ ] Remove `front_segment` from user-facing UI
- [ ] Remove `top_down_unit` from user-facing UI
- [ ] Remove `top_storage_segment` from user-facing UI
- [ ] Add `can_store_inventory` toggle
- [ ] Add `location_category` selector
- [ ] Add dimensions in millimeters
- [ ] Add mapping status badge
- [ ] Add storage slot count summaries
- [ ] Replace Delete with Archive in user-facing UI
- [ ] Add Remove from Map action
- [ ] Add archive blocker checklist dialog
- [ ] Add unmapped locations visibility
- [ ] Hide deep generated children by default
- [ ] Add expandable tree behavior
- [ ] Add SSR initial data loading

---

## 0.7 Phase 5 — Top-Down Visual Plan Editor

- [ ] Build top-down plan canvas
- [ ] Add object placement
- [ ] Add move/resize for object footprints
- [ ] Add dimensions inspector
- [ ] Add object details panel
- [ ] Add visual node CRUD integration
- [ ] Add decorative shapes support through existing `warehouse_layout_shapes`
- [ ] Add unmapped locations panel
- [ ] Add drag unmapped location onto map
- [ ] Add remove visual node only
- [ ] Add top-down aggregation badges for child inventory
- [ ] Add click object -> open interior flow

---

## 0.8 Phase 6 — Interior / Front-View Split Editor

- [ ] Build interior route/page
- [ ] Build front-view SVG canvas
- [ ] Build split node renderer
- [ ] Build split inspector
- [ ] Implement split horizontally
- [ ] Implement split vertically
- [ ] Implement split into rows
- [ ] Implement split into columns
- [ ] Implement resize split
- [ ] Implement generate child locations from split
- [ ] Implement link existing location to split cell
- [ ] Implement unlink location from split cell
- [ ] Implement remove split cell safely
- [ ] Implement parent-stock warning when splitting stock-holding parent
- [ ] Implement parent `can_store_inventory` default false when children become storage slots
- [ ] Implement recalculation of calculated geometry from split intent
- [ ] Implement local coordinate system
- [ ] Implement breadcrumb navigation
- [ ] Implement highlight location from search/inventory flow

---

## 0.9 Phase 7 — Templates and Auto-Generation

- [ ] Add template registry
- [ ] Add Cabinet template
- [ ] Add Shelf Unit template
- [ ] Add Wall Bins / Ściana Kuwetek template
- [ ] Add Pallet Rack template
- [ ] Add Drawer Cabinet template
- [ ] Add Workbench template
- [ ] Add Custom Blank template
- [ ] Add naming pattern system
- [ ] Add K01-K50 generation
- [ ] Add row/column naming
- [ ] Add default `can_store_inventory` behavior per template level
- [ ] Add preview before generation
- [ ] Add template generation tests

---

## 0.10 Phase 8 — Inventory Integration Hardening

- [ ] Ensure inventory stock references locations only
- [ ] Ensure visual nodes are never required for inventory
- [ ] Add unmapped location support to inventory pickers
- [ ] Add mapping status to location pickers
- [ ] Add stock badge aggregation for parent locations
- [ ] Add stock badge to mapped cells
- [ ] Add direct navigation from SKU/location search to visual map
- [ ] Add direct navigation from delivery assignment to visual map
- [ ] Add QR flow for unmapped locations
- [ ] Add blockers for archive validation
- [ ] Add SKU default location rule blocker
- [ ] Add open inbound assignment blocker
- [ ] Add outbound reservation blocker
- [ ] Add descendant stock blocker
- [ ] Add active task/ticket blocker if helpdesk references locations

---

## 0.11 Phase 9 — Draft, Publish, Undo/Redo, Safety

- [ ] Add visual edit draft state
- [ ] Add save draft
- [ ] Add publish layout changes
- [ ] Add discard draft
- [ ] Add undo last split
- [ ] Add undo resize
- [ ] Add undo generate grid
- [ ] Add undo visual node move
- [ ] Add redo
- [ ] Add validation before publish
- [ ] Add layout version snapshots
- [ ] Add conflict warning if layout changed since editor opened
- [ ] Add restore from previous version
- [ ] Add Playwright tests for undo and discard

---

## 0.12 Phase 10 — Cleanup

- [ ] Remove old map-role UI references
- [ ] Remove old front-segment UI logic
- [ ] Remove old top-storage UI logic
- [ ] Remove old location-shape reads from editor
- [ ] Keep decorative `warehouse_layout_shapes`
- [ ] Mark deprecated columns as unused
- [ ] After stable release, plan migration to drop deprecated columns
- [ ] Update docs
- [ ] Update tests
- [ ] Update seed data
- [ ] Update onboarding docs
- [ ] Update Claude/Codex implementation notes

---

# 1. GOAL OF THIS REFACTOR

The current AMBRA warehouse locations system is powerful but overcomplicated. It exposes internal rendering concepts to the user, such as:

- `map_role`
- `top_down_unit`
- `front_segment`
- `top_storage_segment`
- `anchor_location_id`
- projection-specific location semantics

This makes the system difficult to understand and hard to use.

The new system must preserve precision and enterprise-grade correctness while making the UX simple enough that a new user can sit down and map a garage, storage room, cabinet, shelf, wall with bins, or warehouse quickly.

The target product experience:

- User thinks in real-world storage objects
- User adds a cabinet, rack, shelf, drawer, or wall bins
- User visually splits it into shelves, rows, columns, boxes, or masonry-like compartments
- The system automatically creates real inventory locations
- The top-down map stays clean
- The front/interior view shows detailed compartments
- Inventory assignments use the same real locations
- Visual representations can be removed without breaking inventory

The system should feel closer to:

- Figma
- IKEA planner
- The Sims build mode
- garage organizer
- spatial inventory map

not like a database or ERP configuration screen.

---

# 2. CORE ARCHITECTURAL PRINCIPLES

## 2.1 Everything Is a Location

There should be one universal location entity.

Examples:

- warehouse
- room
- area
- zone
- cabinet
- rack
- shelf unit
- shelf
- drawer
- bin
- box
- pallet position
- wall storage
- workbench
- receiving area
- dispatch area
- quarantine area
- temporary staging area

All of these are `warehouse_locations`.

They differ by behavior and visualization, not by fundamental entity type.

---

## 2.2 Location Is Not a Visual Shape

A location answers:

"Where can inventory exist or be organized?"

A visual node answers:

"How is this location represented visually in a specific view?"

Inventory must reference locations, not visual nodes.

Correct dependency:

```text
inventory_stock -> warehouse_locations
warehouse_location_visual_nodes -> warehouse_locations
```

Wrong dependency:

```text
inventory_stock -> warehouse_location_visual_nodes
```

---

## 2.3 Visual Deletion Is Not Location Deletion

Removing a location from the map must not remove the location itself.

If a visual node is removed:

- visual disappears from map
- location remains active
- stock remains assigned
- QR remains valid
- history remains valid
- location becomes unmapped

If a user tries to archive/delete a location with stock or dependencies:

- block archive
- show blocker checklist
- offer cleanup actions

---

## 2.4 Unmapped Locations Are Valid

A location without a visual node is valid.

This is required because:

- inventory can exist before mapping
- imported systems may have no map
- users may remove visual nodes
- users may rebuild layouts
- some temporary locations do not need a map
- stock and audit history must never depend on map existence

Every UI that allows location selection should handle unmapped locations.

---

## 2.5 Simple UX, Precise Engine

The user should see simple actions:

- Add object
- Add shelf
- Split horizontally
- Split vertically
- Generate bins
- Duplicate row
- Remove from map
- Archive location

The engine should store precise data:

- dimensions in millimeters
- local and global coordinates
- split ratios
- fixed sizes
- calculated geometry
- stock blockers
- audit references

Precision should be hidden underneath progressive UX.

---

## 2.6 Top-Down and Front View Are Projections of the Same Physical Object

A cabinet has:

- top-down footprint: width x depth
- front/interior view: width x height

The cabinet is still one location.

Example:

```text
C1 - Cabinet 1
```

Top-down view:

```text
width x depth
```

Front view:

```text
width x height
```

Interior children such as shelves and bins are child locations but do not need to appear individually on the top-down map.

---

# 3. WHAT CHANGES VS WHAT STAYS

## 3.1 Stays

The following should remain:

- `warehouse_locations.id`
- `warehouse_locations.organization_id`
- `warehouse_locations.branch_id`
- `warehouse_locations.parent_id`
- `warehouse_locations.code`
- `warehouse_locations.name`
- `warehouse_locations.description`
- `warehouse_locations.qr_code`
- `warehouse_locations.level`
- `warehouse_locations.sort_order`
- `warehouse_locations.color`
- `warehouse_locations.icon_name`
- `warehouse_locations.inherit_parent_color`
- `warehouse_locations.deleted_at`
- hierarchy RPCs for reparenting and level cascade
- technical soft-delete infrastructure
- `warehouse_layouts` as visual document/layout container
- `warehouse_layout_shapes` for decorative non-location elements

---

## 3.2 Evolves / Deprecated

The following should be deprecated from user-facing logic:

- `map_role`
- `storage_mode`
- `allow_top_storage`
- `physical_elevation_start_m`
- `elevation_level`
- `physical_width_m`
- `physical_height_m`
- `physical_depth_m`
- projection-specific location behavior
- front segment semantics
- top storage segment semantics

Old columns should not be dropped immediately. They should stay during the transition, then be removed only after all reads/writes are migrated.

---

## 3.3 New Columns on `warehouse_locations`

Add:

```text
can_store_inventory boolean
status text
location_category text
width_mm integer
height_mm integer
depth_mm integer
```

---

## 3.4 New Tables

Add:

```text
warehouse_location_visual_nodes
warehouse_layout_split_nodes
```

---

# 4. LOCATION ENTITY V2

## 4.1 Conceptual Type

```ts
type LocationV2 = {
  id: string;

  organization_id: string;
  branch_id: string;
  parent_id: string | null;

  code: string;
  name: string;
  description: string | null;

  can_store_inventory: boolean;
  status: "active" | "inactive" | "archived";
  location_category:
    | "area"
    | "zone"
    | "room"
    | "cabinet"
    | "rack"
    | "shelf_unit"
    | "workbench"
    | "shelf"
    | "drawer"
    | "bin"
    | "box"
    | "pallet_position"
    | "wall_storage"
    | "receiving"
    | "dispatch"
    | "quarantine"
    | "temporary"
    | "custom";

  width_mm: number | null;
  height_mm: number | null;
  depth_mm: number | null;

  color: string | null;
  icon_name: string | null;
  inherit_parent_color: boolean;

  level: number;
  sort_order: number;
  qr_code: string;

  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};
```

---

## 4.2 `can_store_inventory` Rules

This field answers:

"Can stock be directly assigned to this location?"

Examples:

```text
Cabinet C1: false by default if it has bins/shelves
Shelf S1: optional
Bin B3: true by default
Warehouse root: false
Receiving Zone: true
Pallet Position: true
```

Important rule:

If a location has generated storage children, the parent should default to:

```text
can_store_inventory = false
```

This avoids ambiguity where stock is assigned to both:

```text
C1
C1/S1
C1/S1/B1
```

Exception:

Advanced users may allow parent storage intentionally, but the UI must warn about ambiguity.

---

## 4.3 `status` Rules

Recommended statuses:

```text
active
inactive
archived
```

Meaning:

```text
active:
  selectable for new inventory activity

inactive:
  visible, but not suggested for new placement

archived:
  hidden from normal use, preserved for history/audit
```

`deleted_at` remains a technical soft-delete, not the normal user-facing lifecycle.

User-facing delete should be replaced by archive.

---

## 4.4 `location_category` Rules

`location_category` is a UX/template hint, not a hard entity type.

It can control:

- default icon
- default dimensions
- default storage behavior
- template options
- form labels
- suggested split workflows

It must not replace generic location behavior.

---

# 5. VISUAL NODE SYSTEM

## 5.1 Purpose

A visual node represents a location in a specific layout and view.

Examples:

- C1 footprint on top-down garage map
- C1 front face in interior editor
- C1/S2/B3 as a bin in front view
- Rack A shown in top-down
- Receiving Zone shown as floor area

---

## 5.2 Conceptual Type

```ts
type LocationVisualNode = {
  id: string;

  organization_id: string;
  branch_id: string;

  location_id: string;
  layout_id: string | null;

  view_type: "top_down" | "front" | "side" | "3d";

  view_context_location_id: string | null;

  parent_visual_node_id: string | null;

  visual_role: "primary" | "label" | "reference" | "aggregate";

  x_mm: number;
  y_mm: number;
  z_mm: number | null;

  width_mm: number;
  height_mm: number;
  depth_mm: number | null;

  rotation: number;

  visualization_type:
    | "rectangle"
    | "cabinet"
    | "rack"
    | "grid"
    | "drawer"
    | "bin"
    | "zone"
    | "custom";

  style: Json | null;

  status: "active" | "hidden" | "historical";

  z_index: number;
  sort_order: number;

  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};
```

---

## 5.3 Why `view_context_location_id` Is Needed

A location may appear in multiple visual contexts.

Example:

```text
C1
```

May appear:

- on full garage top-down map
- in a selected zone map
- in a historical layout
- as an aggregate parent
- as an interior root

`view_context_location_id` defines the local context.

Examples:

```text
Garage top-down:
  view_context_location_id = GARAGE

C1 front interior:
  view_context_location_id = C1

Rack A front interior:
  view_context_location_id = RACK_A
```

This prevents the visual node table from becoming too rigid.

---

## 5.4 Why `visual_role` Is Needed

A location may need more than one visual reference in the same layout/view.

Examples:

- primary shape
- label-only representation
- reference marker
- aggregate/summary representation

Use:

```text
primary
label
reference
aggregate
```

Recommended uniqueness:

```text
one active primary visual node per location + layout + view_type + view_context_location_id
```

Do not prevent labels/references.

---

## 5.5 Visual Node Deletion

Visual node removal means:

```text
Remove from map
```

It does not delete the location.

When visual node is removed:

- set `deleted_at`
- or set `status = hidden` depending on operation
- location remains
- inventory remains
- mapping status becomes unmapped or partial

Use `deleted_at` for intentional visual removal.

Use `status = hidden/historical` for archive/history cases.

---

# 6. SPLIT NODE SYSTEM

## 6.1 Purpose

Split nodes represent interior layout structure, especially front-view/interior compartments.

This supports:

- shelves
- drawers
- bins
- rows
- columns
- masonry-like layouts
- wall bins
- pallet rack levels
- cabinet interiors

without exposing special location types.

---

## 6.2 Corrected Split Model

Claude's plan had the right idea, but the model needs to be clearer.

Use:

```text
container nodes
cell nodes
```

A container arranges children.

A cell may link to a location.

---

## 6.3 Conceptual Type

```ts
type LayoutSplitNode = {
  id: string;

  organization_id: string;
  branch_id: string;
  layout_id: string;

  parent_id: string | null;
  parent_visual_node_id: string | null;

  node_kind: "container" | "cell";

  split_direction: "horizontal" | "vertical" | null;

  size_mode: "equal" | "ratio" | "fixed" | "auto";
  size_value: number | null;

  sort_order: number;

  linked_location_id: string | null;

  calculated_x_mm: number;
  calculated_y_mm: number;
  calculated_z_mm: number | null;

  calculated_width_mm: number;
  calculated_height_mm: number;
  calculated_depth_mm: number | null;

  cache_valid: boolean;

  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};
```

---

## 6.4 Container vs Cell

Container:

```text
- has split_direction
- arranges children
- may not directly store inventory
```

Cell:

```text
- is final usable visual section
- may link to a location
- may become a storage slot
```

Example:

```text
C1 front root container
  split_direction = vertical

  S1 cell/location
  S2 container
    split_direction = horizontal
    B1 cell/location
    B2 cell/location
    B3 cell/location
  S3 cell/location
```

---

## 6.5 Split Intent Is Source of Truth

Do not treat calculated rectangles as the source of truth.

Source of truth:

```text
parent dimensions
split_direction
size_mode
size_value
sort_order
```

Calculated fields are cache only:

```text
calculated_x_mm
calculated_y_mm
calculated_width_mm
calculated_height_mm
cache_valid
```

If parent dimensions change, recalculate.

---

# 7. COORDINATE SYSTEM

Use a consistent internal 3D model:

```text
X = width / left-right
Y = depth / front-back
Z = height / bottom-top
```

Views:

```text
top_down = X + Y
front = X + Z
side = Y + Z
3d = X + Y + Z
```

Important examples:

Cabinet dimensions:

```text
width = 1200 mm
depth = 400 mm
height = 2000 mm
```

Top-down footprint:

```text
1200 x 400
```

Front/interior face:

```text
1200 x 2000
```

---

# 8. DATABASE MIGRATION PLAN

## 8.1 Migration 1 — Location Entity Cleanup

File:

```text
supabase/migrations/YYYYMMDDHHMMSS_locations_v2_entity_cleanup.sql
```

Add columns:

```sql
ALTER TABLE warehouse_locations
  ADD COLUMN IF NOT EXISTS can_store_inventory BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'archived')),
  ADD COLUMN IF NOT EXISTS location_category TEXT DEFAULT 'custom'
    CHECK (location_category IN (
      'area', 'zone', 'room',
      'cabinet', 'rack', 'shelf_unit', 'workbench',
      'shelf', 'drawer', 'bin', 'box', 'pallet_position',
      'wall_storage', 'receiving', 'dispatch', 'quarantine',
      'temporary', 'custom'
    )),
  ADD COLUMN IF NOT EXISTS width_mm INTEGER CHECK (width_mm > 0),
  ADD COLUMN IF NOT EXISTS height_mm INTEGER CHECK (height_mm > 0),
  ADD COLUMN IF NOT EXISTS depth_mm INTEGER CHECK (depth_mm > 0);
```

Backfill dimensions:

```sql
UPDATE warehouse_locations
SET
  width_mm  = COALESCE(width_mm, ROUND(physical_width_m * 1000)::INTEGER),
  height_mm = COALESCE(height_mm, ROUND(physical_height_m * 1000)::INTEGER),
  depth_mm  = COALESCE(depth_mm, ROUND(physical_depth_m * 1000)::INTEGER)
WHERE physical_width_m IS NOT NULL
   OR physical_height_m IS NOT NULL
   OR physical_depth_m IS NOT NULL;
```

Backfill category cautiously:

```sql
UPDATE warehouse_locations
SET location_category = CASE
  WHEN map_role = 'layout_root' THEN 'area'
  WHEN map_role = 'top_down_unit' THEN 'shelf_unit'
  WHEN map_role = 'front_segment' THEN 'bin'
  WHEN map_role = 'top_storage_segment' THEN 'bin'
  ELSE COALESCE(location_category, 'custom')
END
WHERE deleted_at IS NULL;
```

Do not blindly backfill `can_store_inventory = true` for all old roles.

Safer initial backfill:

```sql
UPDATE warehouse_locations wl
SET can_store_inventory = true
WHERE wl.deleted_at IS NULL
  AND wl.map_role IN ('front_segment', 'top_storage_segment')
  AND NOT EXISTS (
    SELECT 1
    FROM warehouse_locations child
    WHERE child.parent_id = wl.id
      AND child.deleted_at IS NULL
  );
```

Optional cautious leaf logic:

```sql
UPDATE warehouse_locations wl
SET can_store_inventory = true
WHERE wl.deleted_at IS NULL
  AND wl.map_role = 'logical'
  AND NOT EXISTS (
    SELECT 1
    FROM warehouse_locations child
    WHERE child.parent_id = wl.id
      AND child.deleted_at IS NULL
  );
```

Ambiguous cases must be reviewed by verification queries before production.

Add indexes:

```sql
CREATE INDEX IF NOT EXISTS wl_status_active_idx
  ON warehouse_locations (organization_id, branch_id)
  WHERE status = 'active' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS wl_can_store_idx
  ON warehouse_locations (organization_id, branch_id, can_store_inventory)
  WHERE deleted_at IS NULL AND status = 'active';

CREATE INDEX IF NOT EXISTS wl_category_idx
  ON warehouse_locations (organization_id, branch_id, location_category)
  WHERE deleted_at IS NULL;
```

---

## 8.2 Migration 2 — Visual Nodes Table

File:

```text
supabase/migrations/YYYYMMDDHHMMSS_locations_v2_visual_nodes.sql
```

```sql
CREATE TABLE IF NOT EXISTS warehouse_location_visual_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,

  location_id UUID NOT NULL REFERENCES warehouse_locations(id) ON DELETE CASCADE,
  layout_id UUID REFERENCES warehouse_layouts(id) ON DELETE CASCADE,

  view_type TEXT NOT NULL CHECK (view_type IN ('top_down', 'front', 'side', '3d')),

  view_context_location_id UUID REFERENCES warehouse_locations(id) ON DELETE SET NULL,

  parent_visual_node_id UUID REFERENCES warehouse_location_visual_nodes(id) ON DELETE SET NULL,

  visual_role TEXT NOT NULL DEFAULT 'primary'
    CHECK (visual_role IN ('primary', 'label', 'reference', 'aggregate')),

  x_mm FLOAT NOT NULL DEFAULT 0,
  y_mm FLOAT NOT NULL DEFAULT 0,
  z_mm FLOAT,

  width_mm FLOAT NOT NULL CHECK (width_mm > 0),
  height_mm FLOAT NOT NULL CHECK (height_mm > 0),
  depth_mm FLOAT CHECK (depth_mm > 0),

  rotation FLOAT NOT NULL DEFAULT 0,

  visualization_type TEXT NOT NULL DEFAULT 'rectangle'
    CHECK (visualization_type IN (
      'rectangle', 'cabinet', 'rack', 'grid',
      'drawer', 'bin', 'zone', 'custom'
    )),

  style JSONB,

  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'hidden', 'historical')),

  z_index INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,

  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
```

Primary uniqueness:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS wlvn_primary_unique_idx
  ON warehouse_location_visual_nodes (
    location_id,
    view_type,
    layout_id,
    COALESCE(view_context_location_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  WHERE deleted_at IS NULL
    AND status = 'active'
    AND visual_role = 'primary';
```

Indexes:

```sql
CREATE INDEX IF NOT EXISTS wlvn_layout_view_active_idx
  ON warehouse_location_visual_nodes (layout_id, view_type)
  WHERE deleted_at IS NULL AND status = 'active';

CREATE INDEX IF NOT EXISTS wlvn_location_active_idx
  ON warehouse_location_visual_nodes (location_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS wlvn_context_idx
  ON warehouse_location_visual_nodes (view_context_location_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS wlvn_org_branch_active_idx
  ON warehouse_location_visual_nodes (organization_id, branch_id)
  WHERE deleted_at IS NULL;
```

RLS permission decision:

Visual nodes are map/layout edits, not location data edits.

Use:

```text
SELECT: warehouse.layouts.read or warehouse.locations.read
INSERT/UPDATE: warehouse.layouts.manage
DELETE: false
```

Example:

```sql
ALTER TABLE warehouse_location_visual_nodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY wlvn_select ON warehouse_location_visual_nodes
  FOR SELECT USING (
    public.has_branch_permission(organization_id, branch_id, 'warehouse.layouts.read')
    AND deleted_at IS NULL
  );

CREATE POLICY wlvn_select_manage ON warehouse_location_visual_nodes
  FOR SELECT USING (
    public.has_branch_permission(organization_id, branch_id, 'warehouse.layouts.manage')
  );

CREATE POLICY wlvn_insert ON warehouse_location_visual_nodes
  FOR INSERT WITH CHECK (
    public.has_branch_permission(organization_id, branch_id, 'warehouse.layouts.manage')
  );

CREATE POLICY wlvn_update ON warehouse_location_visual_nodes
  FOR UPDATE USING (
    public.has_branch_permission(organization_id, branch_id, 'warehouse.layouts.manage')
  ) WITH CHECK (
    public.has_branch_permission(organization_id, branch_id, 'warehouse.layouts.manage')
  );

CREATE POLICY wlvn_delete ON warehouse_location_visual_nodes
  FOR DELETE USING (false);
```

---

## 8.3 Migration 3 — Split Nodes Table

File:

```text
supabase/migrations/YYYYMMDDHHMMSS_locations_v2_split_nodes.sql
```

```sql
CREATE TABLE IF NOT EXISTS warehouse_layout_split_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  layout_id UUID NOT NULL REFERENCES warehouse_layouts(id) ON DELETE CASCADE,

  parent_id UUID REFERENCES warehouse_layout_split_nodes(id) ON DELETE CASCADE,
  parent_visual_node_id UUID REFERENCES warehouse_location_visual_nodes(id) ON DELETE CASCADE,

  node_kind TEXT NOT NULL DEFAULT 'cell'
    CHECK (node_kind IN ('container', 'cell')),

  split_direction TEXT
    CHECK (split_direction IN ('horizontal', 'vertical')),

  size_mode TEXT NOT NULL DEFAULT 'equal'
    CHECK (size_mode IN ('equal', 'ratio', 'fixed', 'auto')),

  size_value FLOAT,

  sort_order INTEGER NOT NULL DEFAULT 0,

  linked_location_id UUID REFERENCES warehouse_locations(id) ON DELETE SET NULL,

  calculated_x_mm FLOAT NOT NULL DEFAULT 0,
  calculated_y_mm FLOAT NOT NULL DEFAULT 0,
  calculated_z_mm FLOAT,

  calculated_width_mm FLOAT NOT NULL DEFAULT 0,
  calculated_height_mm FLOAT NOT NULL DEFAULT 0,
  calculated_depth_mm FLOAT,

  cache_valid BOOLEAN NOT NULL DEFAULT false,

  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,

  CHECK (
    (node_kind = 'container' AND split_direction IS NOT NULL)
    OR
    (node_kind = 'cell')
  )
);
```

Indexes:

```sql
CREATE INDEX IF NOT EXISTS wlsn_layout_active_idx
  ON warehouse_layout_split_nodes (layout_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS wlsn_parent_active_idx
  ON warehouse_layout_split_nodes (parent_id)
  WHERE deleted_at IS NULL AND parent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS wlsn_location_idx
  ON warehouse_layout_split_nodes (linked_location_id)
  WHERE linked_location_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS wlsn_parent_visual_node_idx
  ON warehouse_layout_split_nodes (parent_visual_node_id)
  WHERE deleted_at IS NULL;
```

RLS:

```sql
ALTER TABLE warehouse_layout_split_nodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY wlsn_select ON warehouse_layout_split_nodes
  FOR SELECT USING (
    public.has_branch_permission(organization_id, branch_id, 'warehouse.layouts.read')
    AND deleted_at IS NULL
  );

CREATE POLICY wlsn_select_manage ON warehouse_layout_split_nodes
  FOR SELECT USING (
    public.has_branch_permission(organization_id, branch_id, 'warehouse.layouts.manage')
  );

CREATE POLICY wlsn_insert ON warehouse_layout_split_nodes
  FOR INSERT WITH CHECK (
    public.has_branch_permission(organization_id, branch_id, 'warehouse.layouts.manage')
  );

CREATE POLICY wlsn_update ON warehouse_layout_split_nodes
  FOR UPDATE USING (
    public.has_branch_permission(organization_id, branch_id, 'warehouse.layouts.manage')
  ) WITH CHECK (
    public.has_branch_permission(organization_id, branch_id, 'warehouse.layouts.manage')
  );

CREATE POLICY wlsn_delete ON warehouse_layout_split_nodes
  FOR DELETE USING (false);
```

---

## 8.4 Migration 4 — Mapping Status and Archive Validation

Add `get_location_mapping_status`.

Mapping status rules:

```text
mapped:
  location has at least one active visual node

unmapped:
  location has no active visual nodes

partially_mapped:
  location has visual node but some active children/stock-holding descendants do not
```

Important: partial mapping should consider descendants, not only direct children.

Archive validation should check at minimum:

- direct stock
- descendant stock
- reserved stock
- active children
- SKU default location rules
- open inbound assignments
- open outbound reservations
- active tasks/tickets referencing the location, once that module exists

The first implementation may stub checks for modules that do not exist yet, but the function contract must support blockers.

Return shape:

```json
{
  "can_archive": false,
  "blockers": [
    {
      "type": "has_stock",
      "message": "Location contains active inventory",
      "quantity": 24
    }
  ],
  "warnings": [
    {
      "type": "has_visual_nodes",
      "message": "Location has visual map representations"
    }
  ]
}
```

Visual nodes should be warning-level, not archive blockers.

---

## 8.5 Migration 5 — Backfill Visual Nodes from Existing Shapes

Backfill location-linked shapes into visual nodes.

Important rules:

- old location shapes are migrated into `warehouse_location_visual_nodes`
- after verification, new UI should read location visuals only from visual nodes
- old `warehouse_layout_shapes` should remain only for decorative shapes
- do not long-term dual-read location visuals from both tables

Example:

```sql
INSERT INTO warehouse_location_visual_nodes (
  organization_id,
  branch_id,
  location_id,
  layout_id,
  view_type,
  view_context_location_id,
  visual_role,
  x_mm,
  y_mm,
  z_mm,
  width_mm,
  height_mm,
  depth_mm,
  visualization_type,
  style,
  z_index,
  sort_order,
  created_by,
  created_at,
  updated_at
)
SELECT
  wls.organization_id,
  wls.branch_id,
  wls.location_id,
  wls.layout_id,
  CASE
    WHEN wls.projection = 'front_elevation' THEN 'front'
    ELSE 'top_down'
  END,
  wls.anchor_location_id,
  'primary',
  wls.x * 1000,
  wls.y * 1000,
  NULL,
  wls.width * 1000,
  wls.height * 1000,
  NULL,
  'rectangle',
  wls.style,
  wls.z_index,
  wls.sort_order,
  wls.created_by,
  wls.created_at,
  wls.updated_at
FROM warehouse_layout_shapes wls
WHERE wls.shape_type = 'location'
  AND wls.location_id IS NOT NULL
  AND wls.deleted_at IS NULL
ON CONFLICT DO NOTHING;
```

---

# 9. MIGRATION VERIFICATION QUERIES

Before production rollout, run and save results.

## 9.1 Count Old Location Shapes vs New Visual Nodes

```sql
SELECT
  (SELECT COUNT(*)
   FROM warehouse_layout_shapes
   WHERE shape_type = 'location'
     AND location_id IS NOT NULL
     AND deleted_at IS NULL) AS old_location_shape_count,

  (SELECT COUNT(*)
   FROM warehouse_location_visual_nodes
   WHERE deleted_at IS NULL) AS new_visual_node_count;
```

## 9.2 Stock-Holding Locations Without Visual Nodes

```sql
SELECT wl.id, wl.code, wl.name
FROM warehouse_locations wl
WHERE wl.can_store_inventory = true
  AND wl.deleted_at IS NULL
  AND wl.status = 'active'
  AND NOT EXISTS (
    SELECT 1
    FROM warehouse_location_visual_nodes vn
    WHERE vn.location_id = wl.id
      AND vn.deleted_at IS NULL
      AND vn.status = 'active'
  );
```

This is allowed, but should be reviewed.

## 9.3 Locations With Stock But `can_store_inventory = false`

```sql
SELECT wl.id, wl.code, wl.name, SUM(pls.quantity) AS quantity
FROM warehouse_locations wl
JOIN product_location_stock pls ON pls.location_id = wl.id
WHERE wl.deleted_at IS NULL
  AND wl.can_store_inventory = false
GROUP BY wl.id, wl.code, wl.name
HAVING SUM(pls.quantity) > 0;
```

These need review.

## 9.4 Storage-Capable Parent Locations With Active Children

```sql
SELECT wl.id, wl.code, wl.name, COUNT(child.id) AS active_child_count
FROM warehouse_locations wl
JOIN warehouse_locations child
  ON child.parent_id = wl.id
 AND child.deleted_at IS NULL
 AND child.status = 'active'
WHERE wl.deleted_at IS NULL
  AND wl.status = 'active'
  AND wl.can_store_inventory = true
GROUP BY wl.id, wl.code, wl.name
HAVING COUNT(child.id) > 0;
```

These may be intentional, but should be reviewed because they can cause stock ambiguity.

## 9.5 Duplicate Primary Visual Nodes

```sql
SELECT
  location_id,
  layout_id,
  view_type,
  view_context_location_id,
  COUNT(*)
FROM warehouse_location_visual_nodes
WHERE deleted_at IS NULL
  AND status = 'active'
  AND visual_role = 'primary'
GROUP BY location_id, layout_id, view_type, view_context_location_id
HAVING COUNT(*) > 1;
```

---

# 10. SERVICE LAYER PLAN

## 10.1 Extend `warehouse-locations.service.ts`

Add:

```ts
archiveLocation();
validateArchive();
getMappingStatus();
listWithMappingStatus();
updateStorageCapability();
updateLocationDimensions();
```

Important:

`archiveLocation()` must call validation first.

It should not physically delete.

It should not automatically hard-delete stock, movements, QR codes, or visual history.

Recommended archive behavior:

```text
status = archived
prevent future stock placement
hide from normal pickers
preserve audit/history
visual nodes become hidden or historical only if product decision says so
```

Do not automatically soft-delete visual nodes unless user explicitly chooses Remove from Map.

---

## 10.2 Create `warehouse-location-visual-nodes.service.ts`

Methods:

```ts
listByLayout(layoutId, viewType?)
listByLocation(locationId)
listByContext(layoutId, viewType, viewContextLocationId?)
upsertNode(input)
softDeleteNode(nodeId)
hideNode(nodeId)
restoreNode(nodeId)
softDeleteAllForLocation(locationId, viewType?)
batchUpsert(layoutId, viewType, nodes)
getUnmappedLocations(branchId, layoutId, options?)
```

Important:

- `softDeleteNode` removes visual only
- `hideNode` preserves node for historical or archived display
- `batchUpsert` must not accidentally delete nodes not loaded by the client unless scoped carefully by layout/view/context
- avoid old risky replace-all semantics where incomplete input silently deletes many shapes

Recommended batch scope:

```text
layout_id + view_type + view_context_location_id
```

not whole layout.

---

## 10.3 Create `warehouse-layout-split-nodes.service.ts`

Methods:

```ts
listByLayout(layoutId);
listByParentVisualNode(parentVisualNodeId);
createSplit(input);
resizeSplit(nodeId, sizeValue);
removeSplitNode(nodeId);
linkLocation(splitNodeId, locationId);
unlinkLocation(splitNodeId);
generateLocations(input);
recalculatePositions(rootNodeId);
mergeCells(input);
```

Important:

- splitting a stock-holding parent must warn but not move stock automatically
- deleting a split cell linked to a location must default to visual-only unlink/removal
- generating children should default parent `can_store_inventory = false`
- moving stock must always be explicit inventory movement

---

# 11. SERVER ACTIONS PLAN

Create:

```text
src/app/actions/warehouse/location-visual-nodes.ts
src/app/actions/warehouse/split-nodes.ts
```

Visual node actions:

```ts
listVisualNodesAction({ layoutId, viewType, viewContextLocationId? })
upsertVisualNodeAction(input)
batchUpsertVisualNodesAction({ layoutId, viewType, viewContextLocationId, nodes })
removeVisualNodeAction({ nodeId })
hideVisualNodeAction({ nodeId })
restoreVisualNodeAction({ nodeId })
getUnmappedLocationsAction({ layoutId, viewContextLocationId? })
```

Split node actions:

```ts
listSplitNodesAction({ layoutId, parentVisualNodeId? })
createSplitAction(input)
resizeSplitAction({ nodeId, sizeValue })
removeSplitNodeAction({ nodeId })
generateLocationsFromSplitAction(input)
linkSplitToLocationAction({ splitNodeId, locationId })
unlinkSplitFromLocationAction({ splitNodeId })
recalculateSplitTreeAction({ rootNodeId })
```

Modify existing locations actions:

```ts
createLocationAction();
updateLocationAction();
archiveLocationAction();
validateArchiveAction();
listWithMappingStatusAction();
```

---

# 12. PERMISSIONS PLAN

Use consistent permissions:

```text
Location CRUD:
  warehouse.locations.manage

Location read:
  warehouse.locations.read

Visual node read:
  warehouse.layouts.read

Visual node edit/remove:
  warehouse.layouts.manage

Split node read:
  warehouse.layouts.read

Split node edit:
  warehouse.layouts.manage

Archive location:
  warehouse.locations.manage initially
  future: warehouse.locations.archive
```

Avoid mixing visual editing under `warehouse.locations.manage`.

Map edits are layout edits.

---

# 13. REACT QUERY HOOKS PLAN

Create:

```text
src/hooks/queries/warehouse/locations-v2.ts
```

Hooks:

```ts
useLocationsV2Query(branchId, layoutId?)
useLocationV2Query(locationId)
useLocationMappingStatusQuery(locationId, layoutId?)
useUnmappedLocationsQuery(branchId, layoutId, viewContextLocationId?)

useCreateLocationV2Mutation(branchId)
useUpdateLocationV2Mutation(branchId)
useArchiveLocationMutation(branchId)
useValidateArchiveMutation()

useLocationVisualNodesQuery(layoutId, viewType?, viewContextLocationId?)
useUpsertVisualNodeMutation(layoutId)
useBatchUpsertVisualNodesMutation(layoutId)
useRemoveVisualNodeMutation(layoutId)
useHideVisualNodeMutation(layoutId)
useRestoreVisualNodeMutation(layoutId)

useSplitNodesQuery(layoutId, parentVisualNodeId?)
useCreateSplitMutation(layoutId)
useResizeSplitMutation(layoutId)
useRemoveSplitNodeMutation(layoutId)
useGenerateLocationsFromSplitMutation(branchId)
useLinkSplitToLocationMutation(layoutId)
useUnlinkSplitFromLocationMutation(layoutId)
```

Important cache invalidation:

- removing visual node invalidates visual nodes and mapping status
- archiving location invalidates location tree, visual nodes, inventory pickers
- generating locations invalidates location tree, split nodes, visual nodes, unmapped locations

---

# 14. UI PLAN — PHASE A: HIDE COMPLEXITY

Update current UI before building full new editor.

## 14.1 Location Form

Remove:

- map role selection
- front segment terminology
- top-down unit terminology
- top storage terminology
- elevation fields from normal mode

Add:

- can store inventory toggle
- location category selector
- width/depth/height in mm
- advanced section for power fields only if still needed during transition

## 14.2 Location Tree

Add:

- mapping status badge
- storage slot count
- inventory-capable icon
- archived/inactive badge
- collapsed generated children by default

Replace:

```text
Delete
```

with:

```text
Archive
Remove from map
```

## 14.3 Map Editor

Update deletion dialogs:

If visual selected:

```text
Remove from map
```

If location selected:

```text
Archive location
```

Explain difference clearly.

---

# 15. UI PLAN — PHASE B: NEW LOCATIONS PAGE

Route:

```text
/dashboard/warehouse/locations
```

Layout:

```text
Left: Location tree
Main: Top-down plan canvas
Right: Selected object panel
```

Tree shows:

```text
Garage
  C1 Cabinet
    48 storage slots
  Rack A
    24 storage slots
  Receiving Zone
```

Top-down canvas shows:

- top-level physical objects
- footprints
- map objects
- zones
- racks
- cabinets
- workbenches
- receiving/dispatch areas

It should not show tiny bins unless user opens an object.

---

# 16. UI PLAN — PHASE C: INTERIOR / FRONT VIEW

Route:

```text
/dashboard/warehouse/locations/[locationId]/interior
```

This opens selected object in front/interior mode.

Tools:

- Add shelf
- Add row
- Add column
- Split horizontally
- Split vertically
- Generate grid
- Duplicate selected area
- Resize split
- Link existing location
- Create locations
- Remove visual only
- Archive location

Inspector:

- selected location
- dimensions
- can store inventory
- child count
- stock summary
- mapping status
- QR action
- inventory actions

---

# 17. TOP-DOWN VS FRONT VIEW RULES

Top-down uses:

```text
X + Y
width + depth
```

Front uses:

```text
X + Z
width + height
```

Example:

Cabinet:

```text
width = 1200 mm
depth = 400 mm
height = 2000 mm
```

Top-down:

```text
1200 x 400
```

Front:

```text
1200 x 2000
```

---

# 18. ADD OBJECT WORKFLOW

User clicks:

```text
+ Add object
```

Chooses:

- Cabinet
- Shelf unit
- Rack
- Wall bins
- Drawer cabinet
- Workbench
- Pallet area
- Custom

Example cabinet:

Inputs:

```text
Name: Cabinet 1
Code: C1
Width: 1200 mm
Depth: 400 mm
Height: 2000 mm
```

System creates:

- location C1
- top-down visual node for C1
- front/interior root visual node for C1
- optional template split nodes

---

# 19. SPLIT WORKFLOW

User opens C1 interior.

They can:

```text
Split into 4 shelves
```

System creates split nodes.

Then user selects Shelf 2:

```text
Split into 5 bins
```

System can create child locations:

```text
C1/S2/B1
C1/S2/B2
C1/S2/B3
C1/S2/B4
C1/S2/B5
```

Each final bin can have:

```text
can_store_inventory = true
```

Shelf and cabinet can default to:

```text
can_store_inventory = false
```

---

# 20. MASONRY-LIKE LAYOUT SUPPORT

Masonry layouts are recursive rectangular splits, not freeform polygons.

Example:

```text
Split whole cabinet vertically 30/70
Split left section into 3 rows
Split right top into 4 bins
Split right bottom into 2 drawers
```

This supports irregular rows/columns while keeping the engine simple and precise.

---

# 21. TEMPLATE SYSTEM

Templates should use the same split engine.

Initial templates:

```text
Cabinet
Shelf Unit
Wall Bins / Ściana Kuwetek
Pallet Rack
Drawer Cabinet
Workbench
Custom
```

Each template defines:

- default dimensions
- default split tree
- default naming pattern
- default storage behavior
- default visualization type

Example wall bins:

```text
Name: SK - Ściana Kuwetki
Rows: 5
Columns: 10
Naming: K01-K50
```

Creates:

```text
SK/K01
SK/K02
...
SK/K50
```

---

# 22. NAMING SYSTEM

Support:

- prefix
- start number
- padding
- row/column labels
- custom pattern

Examples:

```text
B01, B02, B03
K01-K50
R1C1, R1C2
A1, A2, A3
S1/B1
```

Naming generator should preview results before creating locations.

---

# 23. INVENTORY INTEGRATION

Inventory must reflect the location tree.

If stock is assigned to:

```text
C1/S2/B3
```

Then:

- B3 shows stock badge in front view
- C1 shows aggregated stock count in top-down
- SKU search links to B3
- QR scan opens B3
- delivery assignment can suggest B3
- parent tree shows stock summary

---

# 24. PUTAWAY FUTURE COMPATIBILITY

The plan should not implement full putaway engine now unless inventory module is ready, but it must not block it.

Future tables:

```text
sku_location_rules
inventory_assignments
putaway_suggestions
```

Future priority:

```text
1. explicit order assignment
2. order line assignment
3. SKU primary location
4. SKU category rule
5. compatible free location
6. receiving fallback
```

---

# 25. ARCHIVE AND REMOVE RULES

## 25.1 Remove from Map

Allowed even if location has stock.

Result:

- visual node removed
- location remains active
- stock remains
- location becomes unmapped

## 25.2 Archive Location

Blocked if:

- direct stock exists
- descendant stock exists
- reserved stock exists
- active children exist
- open inbound assignments exist
- open outbound reservations exist
- SKU rules reference it
- active tasks/tickets reference it

Warnings:

- visual nodes exist
- historical movements exist

Historical movements are not blockers.

---

# 26. EDGE CASES

## 26.1 Split Location With Existing Stock

If user splits a location that already has stock:

Default:

```text
stock remains on parent
```

Warn:

```text
This location contains stock. New child locations will be created, but existing stock will remain on the parent until you move it.
```

Options:

- keep stock on parent
- move all stock to one child
- manually distribute stock
- cancel

Do not auto-distribute stock silently.

---

## 26.2 Delete Split Cell Linked to Location

Default:

```text
Remove visual only
```

If user wants archive, run archive validation.

---

## 26.3 Merge Cells

Options:

- keep both locations but show combined visual group
- move stock from one to another and archive old location
- create new merged location and move stock

Default safe option:

```text
keep both locations but show combined visual group
```

---

## 26.4 Reparent Location

Existing hierarchy RPC handles parent/level changes.

Additional visual logic required:

- visual node parent may need update
- split link may need update
- mapping status must recalculate
- code uniqueness must be checked under new parent

---

## 26.5 Parent With Children and Stock

Allow only intentionally.

UI should warn:

```text
This location has child storage locations and also stores stock directly. This may make inventory harder to locate precisely.
```

---

# 27. DRAFT / PUBLISH / VERSIONING

Visual editor must not be purely destructive.

Minimum:

- save draft
- discard draft
- publish
- undo
- redo

Recommended:

- layout version snapshots
- restore previous version
- conflict warning if someone else changed layout
- audit event for publish

Publish validation:

- no invalid dimensions
- no negative sizes
- no impossible fixed-size constraints
- no broken location links
- no visual nodes pointing to archived/deleted locations unless historical
- no duplicate primary visual nodes
- split cache valid or recalculable

---

# 28. TESTING PLAN

## 28.1 Unit Tests

- split calculation
- ratio/fixed/equal sizing
- masonry split layout
- mapping status
- archive validation
- naming generator
- template generator
- stock aggregation helper

## 28.2 Integration Tests

- visual node CRUD with RLS
- split node CRUD with RLS
- remove visual node does not delete location
- archive with stock is blocked
- backfill old shapes to visual nodes
- unmapped locations query
- location with stock but unmapped remains selectable

## 28.3 E2E Tests

- add cabinet
- place cabinet on top-down map
- open interior
- split into shelves
- generate bins
- assign stock to bin
- remove bin visual
- verify stock still assigned
- archive bin with stock blocked
- move stock then archive allowed
- search SKU opens map and highlights bin

---

# 29. IMPLEMENTATION ORDER

## Sprint 1 — DB Foundation

- migrations 1-4
- types
- verification queries
- dev Supabase validation

## Sprint 2 — Visual Nodes and Split Services

- services
- actions
- hooks
- tests

## Sprint 3 — Backfill and Old/New Transition

- visual node backfill
- mark old location shapes ignored/migrated
- ensure new reads use visual nodes
- decorative shapes remain in old shape table

## Sprint 4 — Hide Old Complexity

- remove map role from normal UI
- add inventory/storage flags
- add mapping badges
- archive/remove distinction

## Sprint 5 — Top-Down Plan Editor

- add/move/resize objects
- visual node CRUD
- unmapped panel
- object details panel

## Sprint 6 — Interior Editor

- split renderer
- split tools
- generate locations
- link/unlink locations
- stock-aware warnings

## Sprint 7 — Templates

- templates
- naming preview
- auto-generation
- template tests

## Sprint 8 — Inventory Integration Hardening

- stock badges
- aggregation
- search-to-map
- QR-to-map
- archive blockers

## Sprint 9 — Safety

- undo/redo
- draft/publish
- version snapshots
- conflict detection

## Sprint 10 — Cleanup

- remove deprecated UI logic
- document migration
- plan dropping old columns
- update tests/docs

---

# 30. FILES TO CREATE OR MODIFY

## 30.1 Migrations

```text
supabase/migrations/YYYYMMDDHHMMSS_locations_v2_entity_cleanup.sql
supabase/migrations/YYYYMMDDHHMMSS_locations_v2_visual_nodes.sql
supabase/migrations/YYYYMMDDHHMMSS_locations_v2_split_nodes.sql
supabase/migrations/YYYYMMDDHHMMSS_locations_v2_mapping_archive_functions.sql
supabase/migrations/YYYYMMDDHHMMSS_locations_v2_backfill_visual_nodes.sql
supabase/migrations/YYYYMMDDHHMMSS_locations_v2_verification_queries.sql
```

## 30.2 Types

```text
apps/web/src/lib/types/warehouse/locations-v2.ts
```

## 30.3 Services

```text
apps/web/src/server/services/warehouse-location-visual-nodes.service.ts
apps/web/src/server/services/warehouse-layout-split-nodes.service.ts
apps/web/src/server/services/warehouse-location-templates.service.ts
```

Modify:

```text
apps/web/src/server/services/warehouse-locations.service.ts
apps/web/src/server/services/warehouse-layouts.service.ts
apps/web/src/server/services/warehouse-layout-shapes.service.ts
```

## 30.4 Actions

```text
apps/web/src/app/actions/warehouse/location-visual-nodes.ts
apps/web/src/app/actions/warehouse/split-nodes.ts
apps/web/src/app/actions/warehouse/location-templates.ts
```

Modify:

```text
apps/web/src/app/actions/warehouse/locations.ts
apps/web/src/app/actions/warehouse/layouts.ts
apps/web/src/app/actions/warehouse/shapes.ts
apps/web/src/app/actions/warehouse/schemas.ts
```

## 30.5 Hooks

```text
apps/web/src/hooks/queries/warehouse/locations-v2.ts
apps/web/src/hooks/queries/warehouse/location-visual-nodes.ts
apps/web/src/hooks/queries/warehouse/split-nodes.ts
```

## 30.6 UI

```text
apps/web/src/app/[locale]/dashboard/warehouse/locations/page.tsx
apps/web/src/app/[locale]/dashboard/warehouse/locations/loading.tsx

apps/web/src/app/[locale]/dashboard/warehouse/locations/_components/locations-page-shell.tsx
apps/web/src/app/[locale]/dashboard/warehouse/locations/_components/location-tree-panel.tsx
apps/web/src/app/[locale]/dashboard/warehouse/locations/_components/location-tree-node.tsx
apps/web/src/app/[locale]/dashboard/warehouse/locations/_components/top-down-plan-canvas.tsx
apps/web/src/app/[locale]/dashboard/warehouse/locations/_components/location-object-panel.tsx
apps/web/src/app/[locale]/dashboard/warehouse/locations/_components/add-object-dialog.tsx
apps/web/src/app/[locale]/dashboard/warehouse/locations/_components/location-form-v2.tsx
apps/web/src/app/[locale]/dashboard/warehouse/locations/_components/archive-location-dialog.tsx
apps/web/src/app/[locale]/dashboard/warehouse/locations/_components/remove-from-map-dialog.tsx
apps/web/src/app/[locale]/dashboard/warehouse/locations/_components/mapping-status-badge.tsx
apps/web/src/app/[locale]/dashboard/warehouse/locations/_components/unmapped-locations-panel.tsx

apps/web/src/app/[locale]/dashboard/warehouse/locations/[locationId]/interior/page.tsx
apps/web/src/app/[locale]/dashboard/warehouse/locations/[locationId]/interior/loading.tsx
apps/web/src/app/[locale]/dashboard/warehouse/locations/[locationId]/interior/_components/interior-editor-shell.tsx
apps/web/src/app/[locale]/dashboard/warehouse/locations/[locationId]/interior/_components/interior-canvas.tsx
apps/web/src/app/[locale]/dashboard/warehouse/locations/[locationId]/interior/_components/split-node-renderer.tsx
apps/web/src/app/[locale]/dashboard/warehouse/locations/[locationId]/interior/_components/interior-inspector-panel.tsx
apps/web/src/app/[locale]/dashboard/warehouse/locations/[locationId]/interior/_components/interior-toolbar.tsx
apps/web/src/app/[locale]/dashboard/warehouse/locations/[locationId]/interior/_components/generate-grid-dialog.tsx
apps/web/src/app/[locale]/dashboard/warehouse/locations/[locationId]/interior/_components/storage-cell.tsx
apps/web/src/app/[locale]/dashboard/warehouse/locations/[locationId]/interior/_components/naming-pattern-preview.tsx
```

---

# 31. OUT OF SCOPE FOR THIS REFACTOR

Do not build in this cycle unless separately approved:

- full 3D renderer
- AR navigation
- robot routing
- full putaway engine
- advanced collision simulation
- weight/capacity engine
- full multi-user collaborative editing
- CAD-level arbitrary polygons

However, do not design anything that blocks those future features.

---

# 32. FINAL IMPLEMENTATION PRINCIPLES FOR CLAUDE/CODEX

1. Use SSR-first patterns.
2. Use TDD-first approach where possible.
3. Use Supabase target MCP for DB work.
4. Save all migrations locally.
5. Use context7 MCP for up-to-date docs and examples.
6. Do not expose deprecated map-role concepts in new UI.
7. Do not make inventory depend on visual nodes.
8. Do not delete locations when removing visuals.
9. Do not archive locations with stock/dependencies.
10. Do not silently move stock.
11. Do not silently delete visual nodes in large batch saves.
12. Keep old editor working until new editor is production ready.
13. Add verification queries for every migration.
14. Make every sprint independently reviewable.
15. Prefer simple UX with precise engine underneath.

---

# 33. FINAL TARGET EXPERIENCE

A user should be able to:

1. Open warehouse/garage plan.
2. Add Cabinet C1.
3. Enter dimensions.
4. Place it on the top-down map.
5. Open its front/interior view.
6. Split it into shelves and bins.
7. Auto-generate locations like `C1/S2/B3`.
8. Assign inventory to exact bins.
9. Search SKU and open the exact visual bin.
10. Remove a visual representation without losing stock.
11. Archive only after stock and dependencies are cleared.

The system should feel simple, visual, and fast while preserving enterprise-grade correctness.
