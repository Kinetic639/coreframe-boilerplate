import { SchedulerResource } from "./scheduler-resource-types";

/**
 * Traverses resources hierarchically and returns a flat array of nodes with depth details
 * that should be rendered based on expand/collapse state.
 */
export interface FlatResourceNode {
  resource: SchedulerResource;
  depth: number;
  hasChildren: boolean;
}

export function getVisibleResourceTree(
  resources: SchedulerResource[],
  expandedIds: Set<string>,
  searchQuery: string = ""
): FlatResourceNode[] {
  const childrenMap = new Map<string, SchedulerResource[]>();
  const rootResources: SchedulerResource[] = [];

  resources.forEach((r) => {
    if (r.parentId) {
      const list = childrenMap.get(r.parentId) || [];
      list.push(r);
      childrenMap.set(r.parentId, list);
    } else {
      rootResources.push(r);
    }
  });

  const result: FlatResourceNode[] = [];

  function traverse(r: SchedulerResource, depth: number) {
    const children = childrenMap.get(r.id) || [];
    const hasChildren = children.length > 0;

    const matchesSearch =
      searchQuery === "" ||
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.description && r.description.toLowerCase().includes(searchQuery.toLowerCase()));

    // In search mode, visible parent items are shown regardless of parent collapse state.
    if (searchQuery === "" || matchesSearch) {
      result.push({ resource: r, depth, hasChildren });
    }

    const isExpanded = expandedIds.has(r.id);
    // If exploring via search, we show all elements, otherwise only show expanded children.
    if (hasChildren && (isExpanded || searchQuery !== "")) {
      children.forEach((child) => traverse(child, depth + 1));
    }
  }

  rootResources.forEach((r) => traverse(r, 0));
  return result;
}

/**
 * Lane allocation system to prevent overlaps. Stack overlapping calendar items vertically within each row.
 */
export interface LanedEvent<T> {
  event: T;
  lane: number;
  totalLanes: number;
}

export function layoutRowEvents<T extends { id: string; start: Date; end: Date }>(
  events: T[]
): LanedEvent<T>[] {
  if (events.length === 0) return [];

  // Sort events by start time, and then by longest duration to prioritize neat visual stacking
  const sorted = [...events].sort((a, b) => {
    const aTime = a.start.getTime();
    const bTime = b.start.getTime();
    if (aTime !== bTime) return aTime - bTime;
    return b.end.getTime() - b.start.getTime() - (a.end.getTime() - a.start.getTime());
  });

  const lanes: T[][] = [];

  sorted.forEach((ev) => {
    let placed = false;
    for (let i = 0; i < lanes.length; i++) {
      const overlaps = lanes[i].some((laneEv) => {
        const maxStart = Math.max(ev.start.getTime(), laneEv.start.getTime());
        const minEnd = Math.min(ev.end.getTime(), laneEv.end.getTime());
        return maxStart < minEnd; // overlaps if they intersect in time
      });

      if (!overlaps) {
        lanes[i].push(ev);
        placed = true;
        break;
      }
    }

    if (!placed) {
      lanes.push([ev]);
    }
  });

  const result: LanedEvent<T>[] = [];
  sorted.forEach((ev) => {
    const laneIndex = lanes.findIndex((lane) => lane.some((le) => le.id === ev.id));
    result.push({
      event: ev,
      lane: laneIndex !== -1 ? laneIndex : 0,
      totalLanes: lanes.length,
    });
  });

  return result;
}
