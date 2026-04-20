import type { WarehouseLocation } from "@/lib/warehouse/location-tree";
import type { WarehouseLayoutWithShapes } from "@/lib/warehouse/layouts";

export function buildLocationMap(locations: WarehouseLocation[]) {
  return new Map(locations.map((location) => [location.id, location]));
}

export function buildChildrenByParentId(locations: WarehouseLocation[]) {
  const map = new Map<string, WarehouseLocation[]>();

  for (const location of locations) {
    if (!location.parent_id) continue;
    const siblings = map.get(location.parent_id);
    if (siblings) {
      siblings.push(location);
    } else {
      map.set(location.parent_id, [location]);
    }
  }

  return map;
}

export function findNearestLogicalContainerAncestor(
  locationId: string,
  locationMap: Map<string, WarehouseLocation>
) {
  let current = locationMap.get(locationId) ?? null;

  while (current?.parent_id) {
    current = locationMap.get(current.parent_id) ?? null;
    if ((current?.map_role ?? "logical") === "logical") {
      return current;
    }
  }

  return null;
}

export function getDescendantTopDownUnitIds(
  containerId: string,
  locationMap: Map<string, WarehouseLocation>,
  childrenByParentId: Map<string, WarehouseLocation[]>
) {
  const topDownIds: string[] = [];
  const queue = [...(childrenByParentId.get(containerId) ?? [])];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if ((current.map_role ?? "logical") === "top_down_unit") {
      topDownIds.push(current.id);
    }

    const children = childrenByParentId.get(current.id);
    if (children?.length) {
      queue.push(...children);
    }
  }

  return topDownIds.filter((topDownId) => {
    const nearestContainer = findNearestLogicalContainerAncestor(topDownId, locationMap);
    return nearestContainer?.id === containerId;
  });
}

export function getAncestorIds(
  locationId: string,
  locationMap: Map<string, WarehouseLocation>,
  stopAtId?: string | null
) {
  const ancestorIds: string[] = [];
  let current = locationMap.get(locationId) ?? null;

  while (current?.parent_id) {
    if (current.parent_id === stopAtId) break;
    ancestorIds.push(current.parent_id);
    current = locationMap.get(current.parent_id) ?? null;
  }

  return ancestorIds;
}

export function getDescendantLocationIds(
  locationId: string,
  childrenByParentId: Map<string, WarehouseLocation[]>
) {
  const descendantIds: string[] = [];
  const queue = [...(childrenByParentId.get(locationId) ?? [])];

  while (queue.length > 0) {
    const current = queue.shift()!;
    descendantIds.push(current.id);
    const children = childrenByParentId.get(current.id);
    if (children?.length) {
      queue.push(...children);
    }
  }

  return descendantIds;
}

export function buildLocationCodePath(
  locationId: string,
  locationMap: Map<string, WarehouseLocation>,
  stopAtId?: string | null
) {
  const path: string[] = [];
  let current = locationMap.get(locationId) ?? null;

  while (current) {
    path.unshift(current.code?.trim() || current.name);
    if (!current.parent_id || current.id === stopAtId) break;
    current = locationMap.get(current.parent_id) ?? null;
  }

  return path.join("/");
}

export function deriveWarehousePreviewSelectionState({
  highlightedIds,
  locations,
  locationMap,
  childrenByParentId,
}: {
  highlightedIds: string[];
  locations: WarehouseLocation[];
  locationMap: Map<string, WarehouseLocation>;
  childrenByParentId: Map<string, WarehouseLocation[]>;
}) {
  const selectedTopDownFocusIds = [
    ...new Set(
      highlightedIds
        .map((id) => {
          const location = locationMap.get(id);
          if (!location) return null;
          if ((location.map_role ?? "logical") === "top_down_unit") return location.id;
          if (["front_segment", "top_storage_segment"].includes(location.map_role ?? "logical")) {
            return location.parent_id ?? null;
          }
          if ((location.map_role ?? "logical") === "logical") {
            return getDescendantTopDownUnitIds(id, locationMap, childrenByParentId);
          }
          return null;
        })
        .flat()
        .filter(Boolean)
    ),
  ] as string[];

  const frontStageAnchorIds = [
    ...new Set(
      selectedTopDownFocusIds.flatMap((topDownId) => {
        const topDownLocation = locationMap.get(topDownId);
        const groupedIds = topDownLocation?.group_id
          ? locations
              .filter(
                (location) =>
                  (location.map_role ?? "logical") === "top_down_unit" &&
                  location.group_id === topDownLocation.group_id
              )
              .map((location) => location.id)
          : [topDownId];

        return groupedIds.flatMap((candidateTopDownId) => {
          const nearestContainer = findNearestLogicalContainerAncestor(
            candidateTopDownId,
            locationMap
          );
          if (!nearestContainer) return [candidateTopDownId];

          const containerTopDownIds = getDescendantTopDownUnitIds(
            nearestContainer.id,
            locationMap,
            childrenByParentId
          );
          return containerTopDownIds.length > 0 ? containerTopDownIds : [candidateTopDownId];
        });
      })
    ),
  ];

  const explicitFrontSelections = highlightedIds.filter((id) =>
    ["front_segment", "top_storage_segment"].includes(locationMap.get(id)?.map_role ?? "logical")
  );
  const frontHighlightIds =
    explicitFrontSelections.length > 0
      ? [...new Set(explicitFrontSelections)]
      : locations
          .filter((location) =>
            (highlightedIds.length === 1 ? selectedTopDownFocusIds : frontStageAnchorIds).includes(
              location.parent_id ?? ""
            )
          )
          .filter((location) =>
            ["front_segment", "top_storage_segment"].includes(location.map_role ?? "logical")
          )
          .map((location) => location.id);

  const explicitSelections = highlightedIds
    .map((id) => locationMap.get(id) ?? null)
    .filter((location): location is WarehouseLocation => !!location);

  const topDownSelections = explicitSelections.filter(
    (location) => (location.map_role ?? "logical") === "top_down_unit"
  );
  const frontSelections = explicitSelections.filter((location) =>
    ["front_segment", "top_storage_segment"].includes(location.map_role ?? "logical")
  );

  const topDownInfoLocations =
    topDownSelections.length > 0
      ? topDownSelections
      : frontSelections.length > 0
        ? selectedTopDownFocusIds
            .map((id) => locationMap.get(id) ?? null)
            .filter((location): location is WarehouseLocation => !!location)
        : explicitSelections;

  const frontInfoLocations =
    frontSelections.length > 0
      ? frontSelections
      : locations.filter(
          (location) =>
            frontStageAnchorIds.includes(location.parent_id ?? "") &&
            ["front_segment", "top_storage_segment"].includes(location.map_role ?? "logical")
        );

  return {
    selectedTopDownFocusIds,
    frontStageAnchorIds,
    frontHighlightIds,
    topDownInfoLocations,
    frontInfoLocations,
  };
}

export function orderTopDownAnchorIdsByLayoutShapes(
  anchorIds: string[],
  layout: WarehouseLayoutWithShapes,
  locationMap: Map<string, WarehouseLocation>
) {
  const topDownShapeByLocationId = new Map(
    layout.shapes
      .filter(
        (shape) =>
          (shape.projection ?? "top_down") !== "front_elevation" &&
          shape.shape_type === "location" &&
          !!shape.location_id &&
          !shape.deleted_at
      )
      .map((shape) => [shape.location_id!, shape] as const)
  );

  return [...anchorIds].sort((leftId, rightId) => {
    const leftShape = topDownShapeByLocationId.get(leftId);
    const rightShape = topDownShapeByLocationId.get(rightId);
    const leftX = leftShape?.x ?? 0;
    const rightX = rightShape?.x ?? 0;
    if (leftX !== rightX) return leftX - rightX;

    const leftLocation = locationMap.get(leftId);
    const rightLocation = locationMap.get(rightId);
    return (
      (leftLocation?.sort_order ?? 0) - (rightLocation?.sort_order ?? 0) ||
      (leftLocation?.name ?? "").localeCompare(rightLocation?.name ?? "")
    );
  });
}
