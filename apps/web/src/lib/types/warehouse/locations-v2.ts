/**
 * Locations V2 TypeScript types.
 *
 * These types map directly to the verified Phase 1 DB schema.
 * They intentionally omit legacy v1 concepts (map_role, front_segment,
 * top_down_unit, top_storage_segment) from user-facing APIs.
 *
 * Safe to import from both server and client (no server-only guard here).
 */

// ─── Enums / Union Types ──────────────────────────────────────────────────────

export type LocationStatus = "active" | "inactive" | "archived";

export type LocationCategory =
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

export type LocationMappingStatus = "mapped" | "partially_mapped" | "unmapped";

export type ViewType = "top_down" | "front" | "interior" | "side" | "3d";

export type VisualRole = "primary" | "label" | "reference" | "aggregate";

export type VisualizationType =
  | "rectangle"
  | "cabinet"
  | "rack"
  | "grid"
  | "drawer"
  | "bin"
  | "zone"
  | "custom";

export type VisualNodeStatus = "active" | "hidden" | "historical";

export type SplitNodeKind = "container" | "cell";

export type SplitDirection = "horizontal" | "vertical";

export type SplitSizeMode = "equal" | "ratio" | "fixed" | "auto";

// ─── Core Entities ────────────────────────────────────────────────────────────

/**
 * A V2 location record — the logical/inventory truth entity.
 * Every field present in warehouse_locations after Phase 1 migrations.
 * The legacy map_role/elevation fields are present on the DB row but
 * are NOT part of the V2 API surface (excluded from this interface).
 */
export interface LocationV2 {
  id: string;
  organization_id: string;
  branch_id: string;
  parent_id: string | null;

  name: string;
  code: string | null;
  description: string | null;
  icon_name: string | null;
  color: string | null;
  inherit_group_color: boolean;
  inherit_parent_color: boolean;

  // V2 fields
  can_store_inventory: boolean;
  status: LocationStatus;
  location_category: LocationCategory;
  width_mm: number | null;
  height_mm: number | null;
  depth_mm: number | null;

  level: number;
  sort_order: number;
  qr_code: string;

  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;

  // Computed — optionally joined
  mapping_status?: LocationMappingStatus;
}

export interface LocationVisualNode {
  id: string;
  organization_id: string;
  branch_id: string;
  layout_id: string;
  location_id: string;

  view_type: ViewType;
  view_context_location_id: string | null;
  visualization_type: VisualizationType;
  visual_role: VisualRole;
  status: VisualNodeStatus;

  x_mm: number;
  y_mm: number;
  z_mm: number;
  width_mm: number;
  height_mm: number;
  depth_mm: number | null;
  rotation_deg: number;

  style: Record<string, unknown> | null;
  z_index: number;
  sort_order: number;

  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface LayoutSplitNode {
  id: string;
  organization_id: string;
  branch_id: string;
  layout_id: string;
  view_context_location_id: string | null;
  parent_visual_node_id: string | null;
  parent_node_id: string | null;

  node_kind: SplitNodeKind;
  split_direction: SplitDirection | null;
  size_mode: SplitSizeMode;
  size_value: number | null;
  sort_order: number;
  linked_location_id: string | null;

  calc_x_mm: number | null;
  calc_y_mm: number | null;
  calc_z_mm: number | null;
  calc_width_mm: number | null;
  calc_height_mm: number | null;
  calc_depth_mm: number | null;
  cache_valid: boolean;

  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

// ─── RPC Result Types ─────────────────────────────────────────────────────────

export interface ArchiveBlocker {
  type:
    | "direct_stock"
    | "descendant_stock"
    | "active_children"
    | "reserved_stock"
    | "open_assignments";
  message: string;
  count?: number;
  quantity?: number;
}

export interface ArchiveWarning {
  type: "has_visual_nodes";
  message: string;
  count?: number;
}

export interface ArchiveValidationResult {
  location_id: string;
  can_archive: boolean;
  blockers: ArchiveBlocker[];
  warnings: ArchiveWarning[];
}

export interface MappingStatusResult {
  location_id: string;
  mapping_status: LocationMappingStatus;
  is_mapped: boolean;
  visual_node_count: number;
  active_child_count: number;
  mapped_child_count: number;
  unmapped_child_count: number;
  has_top_down: boolean;
  has_front_or_interior: boolean;
}

// ─── Input Types ──────────────────────────────────────────────────────────────

export interface CreateLocationV2Input {
  name: string;
  code?: string | null;
  description?: string | null;
  icon_name?: string | null;
  color?: string | null;
  parent_id?: string | null;
  group_id?: string | null;
  inherit_group_color?: boolean;
  inherit_parent_color?: boolean;
  can_store_inventory?: boolean;
  location_category?: LocationCategory;
  width_mm?: number | null;
  height_mm?: number | null;
  depth_mm?: number | null;
  sort_order?: number;
}

export interface UpdateLocationV2Input {
  name?: string;
  code?: string | null;
  description?: string | null;
  icon_name?: string | null;
  color?: string | null;
  parent_id?: string | null;
  group_id?: string | null;
  inherit_group_color?: boolean;
  inherit_parent_color?: boolean;
  can_store_inventory?: boolean;
  location_category?: LocationCategory;
  width_mm?: number | null;
  height_mm?: number | null;
  depth_mm?: number | null;
  sort_order?: number;
}

export interface UpsertVisualNodeInput {
  id?: string;
  layout_id: string;
  location_id: string;
  view_type: ViewType;
  view_context_location_id?: string | null;
  visualization_type?: VisualizationType;
  visual_role?: VisualRole;
  x_mm: number;
  y_mm: number;
  z_mm?: number;
  width_mm: number;
  height_mm: number;
  depth_mm?: number | null;
  rotation_deg?: number;
  style?: Record<string, unknown> | null;
  z_index?: number;
  sort_order?: number;
}

export interface CreateSplitNodeInput {
  layout_id: string;
  parent_node_id?: string | null;
  parent_visual_node_id?: string | null;
  view_context_location_id?: string | null;
  node_kind: SplitNodeKind;
  split_direction?: SplitDirection | null;
  size_mode?: SplitSizeMode;
  size_value?: number | null;
  sort_order?: number;
  linked_location_id?: string | null;
}

export interface UpdateSplitNodeInput {
  size_mode?: SplitSizeMode;
  size_value?: number | null;
  sort_order?: number;
  split_direction?: SplitDirection | null;
}

export interface VisualNodeListOptions {
  viewType?: ViewType;
  viewContextLocationId?: string | null;
  includeHidden?: boolean;
}

export interface SplitNodeListOptions {
  parentVisualNodeId?: string | null;
}
