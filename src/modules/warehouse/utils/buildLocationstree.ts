import { Tables } from "../../../../supabase/types/types";
import { LocationTreeItem } from "../types/location-tree";

export function buildLocationTree(locations: Tables<"locations">[]): LocationTreeItem[] {
  const map = new Map<string, LocationTreeItem>();
  const roots: LocationTreeItem[] = [];

  for (const loc of locations) {
    map.set(loc.id, {
      id: loc.id,
      name: loc.name,
      icon_name: loc.icon_name,
      code: loc.code,
      color: loc.color,
      children: [],
      raw: loc,
    });
  }

  for (const loc of locations) {
    const node = map.get(loc.id)!;
    if (loc.parent_id && map.has(loc.parent_id)) {
      map.get(loc.parent_id)!.children!.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}
