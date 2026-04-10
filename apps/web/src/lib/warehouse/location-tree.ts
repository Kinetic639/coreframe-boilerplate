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
