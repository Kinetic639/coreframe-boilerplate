/**
 * Warehouse layout and shape types.
 *
 * Intentionally NOT server-only — client components (canvas editor, viewer
 * dialog) import these types directly without hitting the server-only guard.
 * The service layer re-exports them for consumers that go through the service.
 *
 * V1 shape model: shapes are FLAT per layout (no parent_shape_id).
 * Hierarchical shape nesting is deferred to a later phase.
 */

// ─── Enums ────────────────────────────────────────────────────────────────────

export type LayoutStatus = "draft" | "published";

/**
 * Every visual element on a layout has one of these types.
 * 'location' shapes link to an operational warehouse_locations row.
 * All other types are purely structural / decorative.
 */
export type ShapeType =
  | "location" // linked to warehouse_locations (location_id required)
  | "wall" // structural wall segment
  | "door" // opening / doorway in a wall
  | "aisle" // walkway / navigation corridor
  | "zone" // named area (staging, receiving, dispatch, etc.)
  | "obstacle" // column, pillar, fixed equipment
  | "label"; // free text annotation

// ─── Style ───────────────────────────────────────────────────────────────────

/**
 * Display properties stored as JSONB in the database.
 * All fields are optional — the canvas applies sensible defaults per shape_type.
 */
export interface ShapeStyle {
  fill?: string; // CSS hex color, e.g. "#10b981"
  fillOpacity?: number; // 0–1
  stroke?: string; // CSS hex color
  strokeWidth?: number; // in pixels (not meters)
  cornerRadius?: number; // in pixels
  fontSize?: number; // for label shapes
  fontWeight?: string; // "normal" | "bold"
  textColor?: string; // CSS hex color for label text

  // ── Location code label style ──────────────────────────────────────────────
  /** Text color for the location code rendered inside location shapes */
  labelColor?: string;
  /** Font size in meters (default 0.35) */
  labelSize?: number;
  /** Horizontal alignment within the shape (default "left") */
  labelAlignH?: "left" | "center" | "right";
  /** Vertical alignment within the shape (default "top") */
  labelAlignV?: "top" | "center" | "bottom";
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export interface WarehouseLayout {
  id: string;
  organization_id: string;
  branch_id: string;
  /** NULL = whole-branch layout; non-null scopes the map to a specific location subtree */
  root_location_id: string | null;
  name: string;
  description: string | null;
  status: LayoutStatus;
  /** Canvas width in meters */
  canvas_width_m: number;
  /** Canvas height in meters */
  canvas_height_m: number;
  published_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

// ─── Shape ────────────────────────────────────────────────────────────────────

export interface WarehouseLayoutShape {
  id: string;
  layout_id: string;
  /** Denormalized from parent layout for branch-aware RLS */
  organization_id: string;
  /** Denormalized from parent layout for branch-aware RLS */
  branch_id: string;
  shape_type: ShapeType;
  /** Populated only when shape_type = 'location' */
  location_id: string | null;
  /** Display override; for location shapes falls back to the linked location's name */
  label: string | null;
  /** Horizontal position in meters from canvas origin (top-left) */
  x: number;
  /** Vertical position in meters from canvas origin (top-left) */
  y: number;
  /** Width in meters */
  width: number;
  /** Height in meters */
  height: number;
  /** Clockwise rotation in degrees */
  rotation: number;
  style: ShapeStyle | null;
  z_index: number;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

// ─── Composed ────────────────────────────────────────────────────────────────

/** Layout with its active shapes pre-loaded — used by the editor and viewer */
export interface WarehouseLayoutWithShapes extends WarehouseLayout {
  shapes: WarehouseLayoutShape[];
}

// ─── Editor input types ───────────────────────────────────────────────────────

/**
 * Input for a single shape in a batch save operation.
 * The `id` is always required — clients must generate a UUID for new shapes
 * (use `crypto.randomUUID()`). This enables upsert-by-id semantics so the
 * editor never needs a separate "create" vs "update" code path.
 */
export interface ShapeUpsertInput {
  id: string;
  shape_type: ShapeType;
  location_id?: string | null;
  label?: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  style?: ShapeStyle | null;
  z_index?: number;
  sort_order?: number;
}
