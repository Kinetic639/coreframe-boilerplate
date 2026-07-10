/**
 * Pure location-subtree expansion for the stock-audit wizard/service.
 *
 * Not server-only — pure function over plain data, safe to unit-test and to
 * import from a client component if ever needed for a preview.
 */
import type { WarehouseLocation } from "./location-tree";

/**
 * Given the full flat location list for a branch and a set of explicitly
 * selected location ids, returns the final expanded id list: the selected
 * ids plus, when `includeChildren` is true, every descendant of each
 * selected id (recursively). Deduplicated. Order is not significant.
 *
 * This is what gets sent as `scope.location_ids` to
 * `inventory_create_count_session` — the RPC never re-expands, it only
 * reads this already-expanded list.
 */
export function expandLocationIds(
  locations: Pick<WarehouseLocation, "id" | "parent_id">[],
  selectedIds: string[],
  includeChildren: boolean
): string[] {
  const result = new Set(selectedIds);

  if (includeChildren) {
    const childrenByParent = new Map<string, string[]>();
    for (const loc of locations) {
      if (!loc.parent_id) continue;
      const siblings = childrenByParent.get(loc.parent_id) ?? [];
      siblings.push(loc.id);
      childrenByParent.set(loc.parent_id, siblings);
    }

    const queue = [...selectedIds];
    while (queue.length > 0) {
      const current = queue.shift()!;
      const children = childrenByParent.get(current) ?? [];
      for (const childId of children) {
        if (!result.has(childId)) {
          result.add(childId);
          queue.push(childId);
        }
      }
    }
  }

  return Array.from(result);
}

/**
 * True when `locationId` is a descendant (at any depth) of `ancestorId`.
 * Used by the wizard's location tree to visually dim locations that are
 * already implicitly selected via an ancestor + includeChildren, without
 * duplicating them in the explicit selection array.
 */
export function isDescendantOf(
  locations: Pick<WarehouseLocation, "id" | "parent_id">[],
  locationId: string,
  ancestorId: string
): boolean {
  const byId = new Map(locations.map((loc) => [loc.id, loc]));
  let current = byId.get(locationId);
  while (current?.parent_id) {
    if (current.parent_id === ancestorId) return true;
    current = byId.get(current.parent_id);
  }
  return false;
}
