// TODO(locations-v2): Legacy front-elevation rendering path.
// Computes front/interior view from map_role semantics (front_segment, top_storage_segment).
// V2 rendering uses warehouse_location_visual_nodes + warehouse_layout_split_nodes instead.
// Planned removal in Phase 8 once the V2 interior/front editor is complete.
import type { WarehouseLayoutWithShapes, WarehouseLayoutShape } from "./layouts";
import {
  getEffectiveLocationColor,
  type WarehouseLocation,
  type WarehouseLocationGroup,
} from "./location-tree";

interface FrontElevationIndexes {
  locationMap: Map<string, WarehouseLocation>;
  childrenByParentId: Map<string, WarehouseLocation[]>;
  topDownShapeByLocationId: Map<string, WarehouseLayoutShape>;
  explicitShapesByAnchorId: Map<string, WarehouseLayoutShape[]>;
  groupMap: Map<string, WarehouseLocationGroup>;
}

function withAlpha(hexColor: string, alphaHex: string) {
  if (!hexColor.startsWith("#")) return hexColor;
  const normalized =
    hexColor.length === 4
      ? `#${hexColor[1]}${hexColor[1]}${hexColor[2]}${hexColor[2]}${hexColor[3]}${hexColor[3]}`
      : hexColor;
  return `${normalized}${alphaHex}`;
}

function createDerivedFrontShape(
  location: WarehouseLocation,
  parentWidth: number,
  autoY: number,
  indexes: FrontElevationIndexes
): WarehouseLayoutShape {
  const width = Math.max(0.01, parentWidth);
  const height = Math.max(0.01, location.physical_height_m ?? 1);
  const y = Math.max(0, autoY);
  const color =
    getEffectiveLocationColor(location, indexes.groupMap, indexes.locationMap) ?? "#10b981";
  const isTopStorageSegment = (location.map_role ?? "logical") === "top_storage_segment";

  return {
    id: `derived-front-${location.id}`,
    layout_id: `derived-front-${location.parent_id ?? "root"}`,
    organization_id: location.organization_id,
    branch_id: location.branch_id,
    shape_type: "location",
    projection: "front_elevation",
    anchor_location_id: location.parent_id,
    location_id: location.id,
    label: location.code ?? location.name,
    x: 0,
    y,
    width,
    height,
    rotation: 0,
    style: {
      fill: isTopStorageSegment ? `${color}1f` : `${color}33`,
      stroke: color,
      strokeWidth: isTopStorageSegment ? 1.4 : 1,
    },
    z_index: 0,
    sort_order: location.sort_order,
    created_by: null,
    created_at: location.created_at,
    updated_at: location.updated_at,
    deleted_at: null,
  };
}

function buildFrontElevationIndexes(
  layout: WarehouseLayoutWithShapes,
  locations: WarehouseLocation[],
  locationGroups: WarehouseLocationGroup[]
): FrontElevationIndexes {
  const locationMap = new Map(locations.map((location) => [location.id, location]));
  const childrenByParentId = new Map<string, WarehouseLocation[]>();

  for (const location of locations) {
    if (!location.parent_id) continue;
    const siblings = childrenByParentId.get(location.parent_id);
    if (siblings) {
      siblings.push(location);
    } else {
      childrenByParentId.set(location.parent_id, [location]);
    }
  }

  const topDownShapeByLocationId = new Map<string, WarehouseLayoutShape>();
  const explicitShapesByAnchorId = new Map<string, WarehouseLayoutShape[]>();

  for (const shape of layout.shapes) {
    if (shape.deleted_at) continue;

    if (
      shape.projection !== "front_elevation" &&
      shape.shape_type === "location" &&
      shape.location_id
    ) {
      topDownShapeByLocationId.set(shape.location_id, shape);
      continue;
    }

    if (shape.projection === "front_elevation" && shape.anchor_location_id) {
      const shapes = explicitShapesByAnchorId.get(shape.anchor_location_id);
      if (shapes) {
        shapes.push(shape);
      } else {
        explicitShapesByAnchorId.set(shape.anchor_location_id, [shape]);
      }
    }
  }

  for (const shapes of explicitShapesByAnchorId.values()) {
    shapes.sort(
      (left, right) => left.z_index - right.z_index || left.sort_order - right.sort_order
    );
  }

  return {
    locationMap,
    childrenByParentId,
    topDownShapeByLocationId,
    explicitShapesByAnchorId,
    groupMap: new Map(locationGroups.map((group) => [group.id, group])),
  };
}

export function buildFrontElevationLayout(params: {
  layout: WarehouseLayoutWithShapes;
  locations: WarehouseLocation[];
  locationGroups: WarehouseLocationGroup[];
  anchorLocationId: string;
}): WarehouseLayoutWithShapes | null {
  const { layout, locations, locationGroups, anchorLocationId } = params;
  const indexes = buildFrontElevationIndexes(layout, locations, locationGroups);
  const anchorLocation = indexes.locationMap.get(anchorLocationId);
  if (!anchorLocation) return null;

  const explicitShapes = indexes.explicitShapesByAnchorId.get(anchorLocationId) ?? [];
  const topDownAnchorShape = indexes.topDownShapeByLocationId.get(anchorLocationId) ?? null;

  const canvasWidth =
    anchorLocation.physical_width_m ?? topDownAnchorShape?.width ?? explicitShapes[0]?.width ?? 2;
  const derivedChildren = (indexes.childrenByParentId.get(anchorLocationId) ?? [])
    .filter(
      (location) =>
        location.map_role === "front_segment" ||
        location.map_role === "top_storage_segment" ||
        location.physical_height_m !== null ||
        location.physical_elevation_start_m !== null
    )
    .sort((left, right) => {
      const leftPriority = (left.map_role ?? "logical") === "top_storage_segment" ? -1 : 0;
      const rightPriority = (right.map_role ?? "logical") === "top_storage_segment" ? -1 : 0;
      return (
        leftPriority - rightPriority ||
        left.sort_order - right.sort_order ||
        left.name.localeCompare(right.name)
      );
    });
  const stackedChildrenHeight = derivedChildren.reduce(
    (sum, child) => sum + Math.max(0.01, child.physical_height_m ?? 1),
    0
  );
  const explicitFrontHeight = explicitShapes.reduce(
    (max, shape) => Math.max(max, shape.y + shape.height),
    0
  );
  const canvasHeight =
    anchorLocation.physical_height_m ?? Math.max(explicitFrontHeight, stackedChildrenHeight, 2);

  if (explicitShapes.length > 0) {
    return {
      ...layout,
      id: `${layout.id}:front:${anchorLocationId}`,
      name: `${layout.name} / ${anchorLocation.name}`,
      canvas_width_m: Math.max(canvasWidth, 0.01),
      canvas_height_m: Math.max(canvasHeight, 0.5),
      shapes: explicitShapes,
    };
  }

  const children = derivedChildren;

  if (children.length === 0) return null;

  const childHeights = children.map((child) => Math.max(0.01, child.physical_height_m ?? 1));
  const totalChildrenHeight = childHeights.reduce((sum, height) => sum + height, 0);
  let nextY = Math.max(0, canvasHeight - totalChildrenHeight);
  const derivedShapes = children.map((child) => {
    const shape = createDerivedFrontShape(child, canvasWidth, nextY, indexes);
    nextY += Math.max(0.01, child.physical_height_m ?? 1);
    return shape;
  });

  return {
    ...layout,
    id: `${layout.id}:front:${anchorLocationId}`,
    name: `${layout.name} / ${anchorLocation.name}`,
    canvas_width_m: Math.max(canvasWidth, 0.01),
    canvas_height_m: Math.max(
      canvasHeight,
      derivedShapes.reduce((max, shape) => Math.max(max, shape.y + shape.height), 0),
      0.5
    ),
    shapes: derivedShapes,
  };
}

export function buildCombinedFrontElevationLayout(params: {
  layout: WarehouseLayoutWithShapes;
  locations: WarehouseLocation[];
  locationGroups: WarehouseLocationGroup[];
  anchorLocationIds: string[];
  gapM?: number;
}): WarehouseLayoutWithShapes | null {
  const { layout, locations, locationGroups, anchorLocationIds, gapM = 0 } = params;
  const uniqueAnchorIds = [...new Set(anchorLocationIds.filter(Boolean))];
  const headerHeight = 0.52;
  const indexes = buildFrontElevationIndexes(layout, locations, locationGroups);
  if (uniqueAnchorIds.length === 0) {
    return null;
  }

  const partialLayouts = uniqueAnchorIds
    .map((anchorLocationId) =>
      buildFrontElevationLayout({
        layout,
        locations,
        locationGroups,
        anchorLocationId,
      })
    )
    .filter((entry): entry is WarehouseLayoutWithShapes => !!entry);

  if (partialLayouts.length === 0) {
    return null;
  }

  if (partialLayouts.length === 1) {
    return partialLayouts[0];
  }

  // Use actual shape bounds (not canvas_height_m) so physical_height_m padding doesn't add whitespace
  const colBottoms = partialLayouts.map((pl) =>
    pl.shapes.reduce((m, s) => Math.max(m, s.y + s.height), 0)
  );
  const maxContentHeight = Math.max(...colBottoms, 0.5);

  let nextX = 0;
  const stitchedShapes = partialLayouts.flatMap((partialLayout, index) => {
    const anchorId = uniqueAnchorIds[index];
    const anchorLocation = indexes.locationMap.get(anchorId);
    const anchorColor = anchorLocation
      ? (getEffectiveLocationColor(anchorLocation, indexes.groupMap, indexes.locationMap) ??
        "#64748b")
      : "#64748b";
    const topDownShape = indexes.topDownShapeByLocationId.get(anchorId);
    const effectiveWidth =
      anchorLocation?.physical_width_m ?? topDownShape?.width ?? partialLayout.canvas_width_m;
    const isNarrow = effectiveWidth <= 0.2;

    const offsetX = nextX;
    const offsetY = headerHeight + Math.max(0, maxContentHeight - colBottoms[index]);
    nextX += partialLayout.canvas_width_m + (index < partialLayouts.length - 1 ? gapM : 0);

    const headerShapes: WarehouseLayoutShape[] = isNarrow
      ? []
      : [
          {
            id: `combined:header-bg:${anchorId}`,
            layout_id: partialLayout.id,
            organization_id: partialLayout.organization_id,
            branch_id: partialLayout.branch_id,
            shape_type: "zone",
            projection: "front_elevation",
            anchor_location_id: anchorId,
            location_id: anchorId,
            label: null,
            x: offsetX,
            y: 0,
            width: partialLayout.canvas_width_m,
            height: headerHeight,
            rotation: 0,
            style: { fill: withAlpha(anchorColor, "26"), stroke: anchorColor, strokeWidth: 0.045 },
            z_index: 90,
            sort_order: -200 + index,
            created_by: null,
            created_at: partialLayout.created_at,
            updated_at: partialLayout.updated_at,
            deleted_at: null,
          },
          {
            id: `combined:header:${anchorId}`,
            layout_id: partialLayout.id,
            organization_id: partialLayout.organization_id,
            branch_id: partialLayout.branch_id,
            shape_type: "label",
            projection: "front_elevation",
            anchor_location_id: anchorId,
            location_id: anchorId,
            label: anchorLocation?.code ?? anchorLocation?.name ?? null,
            x: offsetX,
            y: 0.035,
            width: partialLayout.canvas_width_m,
            height: headerHeight - 0.07,
            rotation: 0,
            style: { textColor: anchorColor, fontSize: 0.24 },
            z_index: 100,
            sort_order: -100 + index,
            created_by: null,
            created_at: partialLayout.created_at,
            updated_at: partialLayout.updated_at,
            deleted_at: null,
          },
        ];

    return [
      ...headerShapes,
      ...partialLayout.shapes.map((shape) => ({
        ...shape,
        x: shape.x + offsetX,
        y: shape.y + offsetY,
        id: `combined:${partialLayout.id}:${shape.id}`,
      })),
    ];
  });

  return {
    ...layout,
    id: `${layout.id}:front:combined:${uniqueAnchorIds.join(",")}`,
    name: `${layout.name} / combined-front`,
    canvas_width_m: Math.max(nextX, 0.5),
    canvas_height_m: Math.max(maxContentHeight + headerHeight, 0.5),
    shapes: stitchedShapes,
  };
}
