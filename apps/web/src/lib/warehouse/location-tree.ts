/**
 * Warehouse location types and pure tree-building utility.
 *
 * This file is intentionally NOT server-only so client components
 * can import the types and buildLocationTree without triggering the
 * "server-only" guard.  The service layer re-exports these for consumers
 * that import from the service.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * A display-only group that visually clusters sibling locations (e.g. bays of
 * the same rack). Not an inventory entity — no stock, QR code, or movements.
 */
export interface WarehouseLocationGroup {
  id: string;
  organization_id: string;
  branch_id: string;
  /** The location whose direct children this group organises. Null = legacy top-level. */
  parent_location_id: string | null;
  name: string;
  description: string | null;
  color: string | null;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface WarehouseLocation {
  id: string;
  organization_id: string;
  branch_id: string;
  name: string;
  code: string | null;
  description: string | null;
  icon_name: string | null;
  color: string | null;
  parent_id: string | null;
  /** Optional group this location belongs to (display only, not hierarchy). */
  group_id: string | null;
  /** When true, the effective UI color should follow the assigned group's color. */
  inherit_group_color: boolean;
  /** When true, the effective UI color should follow the parent location's color. */
  inherit_parent_color?: boolean;
  /** Physical front-view width in meters. */
  physical_width_m?: number | null;
  /** Physical top-down depth in meters. */
  physical_depth_m?: number | null;
  /** Physical height in meters. */
  physical_height_m?: number | null;
  /** Vertical bottom offset within the parent front elevation in meters. */
  physical_elevation_start_m?: number | null;
  /** Visual top-down stacking order. Higher values render above lower ones. */
  elevation_level?: number | null;
  /** Mapping role hint used by dual-projection viewers/editors. */
  map_role?: WarehouseLocationMapRole;
  /** Optional semantic storage classification for future workflows. */
  storage_mode?: string;
  /** Whether storage above the nominal unit height is allowed. */
  allow_top_storage?: boolean;
  level: number;
  sort_order: number;
  qr_code: string;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface WarehouseLocationTreeNode extends WarehouseLocation {
  children: WarehouseLocationTreeNode[];
}

export type WarehouseLocationMapRole =
  | "logical"
  | "layout_root"
  | "top_down_unit"
  | "front_segment"
  | "top_storage_segment";

export function getEffectiveLocationColor(
  location: Pick<
    WarehouseLocation,
    "id" | "color" | "parent_id" | "group_id" | "inherit_group_color" | "inherit_parent_color"
  >,
  groups?: WarehouseLocationGroup[] | Map<string, WarehouseLocationGroup>,
  locations?: WarehouseLocation[] | Map<string, WarehouseLocation>,
  visited = new Set<string>()
): string | null {
  if (
    location.inherit_parent_color &&
    location.parent_id &&
    locations &&
    !visited.has(location.id)
  ) {
    const locationMap =
      locations instanceof Map ? locations : new Map(locations.map((entry) => [entry.id, entry]));
    const parent = locationMap.get(location.parent_id);
    if (parent) {
      visited.add(location.id);
      return (
        getEffectiveLocationColor(parent, groups, locationMap, visited) ?? location.color ?? null
      );
    }
  }

  if (!location.inherit_group_color || !location.group_id) {
    return location.color ?? null;
  }

  if (groups instanceof Map) {
    return groups.get(location.group_id)?.color ?? location.color ?? null;
  }

  return groups?.find((group) => group.id === location.group_id)?.color ?? location.color ?? null;
}

// ─── buildLocationTree ────────────────────────────────────────────────────────

/**
 * Build a nested tree from a flat list of locations.
 * Orphaned nodes (parent_id set but parent not in the list) are promoted to roots.
 * Pure function — no side effects.
 */
export function buildLocationTree(locations: WarehouseLocation[]): WarehouseLocationTreeNode[] {
  const map = new Map<string, WarehouseLocationTreeNode>();

  for (const loc of locations) {
    map.set(loc.id, { ...loc, children: [] });
  }

  const roots: WarehouseLocationTreeNode[] = [];

  for (const loc of locations) {
    const node = map.get(loc.id)!;
    if (loc.parent_id && map.has(loc.parent_id)) {
      map.get(loc.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortChildren = (nodes: WarehouseLocationTreeNode[]): void => {
    nodes.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
    for (const n of nodes) sortChildren(n.children);
  };
  sortChildren(roots);

  return roots;
}
