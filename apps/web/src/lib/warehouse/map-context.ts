// TODO(locations-v2): Legacy map context computation path.
// Resolves top-down and front anchors from map_role chain (layout_root, top_down_unit, front_segment).
// V2 rendering derives context from warehouse_location_visual_nodes.view_context_location_id instead.
// Planned removal in Phase 8 once the V2 top-down editor is complete.
import type { WarehouseLocation } from "./location-tree";

export interface WarehouseLocationMapContext {
  layoutRootLocationId: string | null;
  topDownAnchorLocationId: string | null;
  frontAnchorLocationId: string | null;
  relativeDepth: number | null;
}

function buildLocationMap(locations: WarehouseLocation[]) {
  return new Map(locations.map((location) => [location.id, location]));
}

function getAncestorChain(
  locationId: string,
  locationMap: Map<string, WarehouseLocation>
): WarehouseLocation[] {
  const chain: WarehouseLocation[] = [];
  const visited = new Set<string>();
  let current = locationMap.get(locationId) ?? null;

  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    chain.unshift(current);
    current = current.parent_id ? (locationMap.get(current.parent_id) ?? null) : null;
  }

  return chain;
}

function getScopedChain(
  locationId: string,
  locations: WarehouseLocation[],
  explicitRootLocationId?: string | null
): WarehouseLocation[] {
  const locationMap = buildLocationMap(locations);
  const fullChain = getAncestorChain(locationId, locationMap);

  if (fullChain.length === 0) {
    return [];
  }

  if (explicitRootLocationId) {
    const rootIndex = fullChain.findIndex((location) => location.id === explicitRootLocationId);
    if (rootIndex >= 0) {
      return fullChain.slice(rootIndex);
    }
  }

  const explicitRoleIndex = fullChain.findIndex((location) => location.map_role === "layout_root");
  if (explicitRoleIndex >= 0) {
    return fullChain.slice(explicitRoleIndex);
  }

  return fullChain;
}

function findNearestRole(
  chain: WarehouseLocation[],
  role: WarehouseLocation["map_role"]
): WarehouseLocation | null {
  for (let index = chain.length - 1; index >= 0; index -= 1) {
    if (chain[index].map_role === role) {
      return chain[index];
    }
  }

  return null;
}

function findNearestFrontRenderableRole(chain: WarehouseLocation[]) {
  for (let index = chain.length - 1; index >= 0; index -= 1) {
    if (["front_segment", "top_storage_segment"].includes(chain[index].map_role ?? "logical")) {
      return chain[index];
    }
  }

  return null;
}

export function resolveLocationMapContext(
  locationId: string,
  locations: WarehouseLocation[],
  explicitRootLocationId?: string | null
): WarehouseLocationMapContext {
  const scopedChain = getScopedChain(locationId, locations, explicitRootLocationId);

  if (scopedChain.length === 0) {
    return {
      layoutRootLocationId: explicitRootLocationId ?? null,
      topDownAnchorLocationId: null,
      frontAnchorLocationId: null,
      relativeDepth: null,
    };
  }

  const layoutRoot =
    (explicitRootLocationId
      ? scopedChain.find((location) => location.id === explicitRootLocationId)
      : null) ??
    scopedChain.find((location) => location.map_role === "layout_root") ??
    scopedChain[0];

  const relativeDepth = scopedChain.length - 1;
  const explicitTopDownAnchor = findNearestRole(scopedChain, "top_down_unit");
  const explicitFrontAnchor = findNearestFrontRenderableRole(scopedChain);

  const topDownAnchor = explicitTopDownAnchor ?? null;

  const frontAnchor =
    explicitFrontAnchor ?? (scopedChain.length >= 3 ? scopedChain[2] : null) ?? null;

  return {
    layoutRootLocationId: layoutRoot?.id ?? explicitRootLocationId ?? null,
    topDownAnchorLocationId: topDownAnchor?.id ?? null,
    frontAnchorLocationId: frontAnchor?.id ?? null,
    relativeDepth,
  };
}

export function resolveLocationMapContexts(
  locationIds: string[],
  locations: WarehouseLocation[],
  explicitRootLocationId?: string | null
) {
  return locationIds.map((locationId) =>
    resolveLocationMapContext(locationId, locations, explicitRootLocationId)
  );
}

export function isEligibleTopDownUnit(
  locationId: string,
  locations: WarehouseLocation[],
  explicitRootLocationId?: string | null
) {
  const location = locations.find((entry) => entry.id === locationId);
  if (!location) return false;
  if (location.map_role === "top_down_unit") return true;
  if ((location.map_role ?? "logical") === "logical") return false;

  const context = resolveLocationMapContext(locationId, locations, explicitRootLocationId);
  return context.topDownAnchorLocationId === locationId;
}
