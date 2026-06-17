/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { VisualNode, StructureNode, LogicalLocation } from "../types";

export type LocationVisualResolution =
  | {
      status: "top_down";
      locationId: string;
      visualNodeId: string;
      visualNode: VisualNode;
      structurePath?: never;
      structureNodeId?: never;
      structureNode?: never;
    }
  | {
      status: "front_cell";
      locationId: string;
      parentVisualNodeId: string;
      parentVisualNode: VisualNode;
      structureNodeId: string;
      structurePath: string[];
      structureNode: StructureNode;
    }
  | {
      status: "unmapped";
      locationId: string;
    }
  | {
      status: "duplicate";
      locationId: string;
      matches: LocationVisualResolutionMatch[];
    };

export type LocationVisualResolutionMatch =
  | {
      type: "top_down";
      locationId: string;
      visualNodeId: string;
      visualNode: VisualNode;
    }
  | {
      type: "front_cell";
      locationId: string;
      parentVisualNodeId: string;
      parentVisualNode: VisualNode;
      structureNodeId: string;
      structurePath: string[];
      structureNode: StructureNode;
    };

export interface MappingIndex {
  byLocationId: Map<string, LocationVisualResolutionMatch[]>;
  duplicates: string[]; // locationIds with multiple matches
  unresolvedReferences: string[]; // locationIds that don't exist in locations array (if provided)
  visualOnlyObjects: string[]; // visualNodeIds with no locationId
}

/**
 * Builds an index of locationId to visual representation.
 */
export function buildLocationMappingIndex(
  visualNodes: VisualNode[],
  locations?: LogicalLocation[]
): MappingIndex {
  const byLocationId = new Map<string, LocationVisualResolutionMatch[]>();
  const visualOnlyObjects: string[] = [];
  const locationIdsInSystem = locations ? new Set(locations.map((l) => l.id)) : null;

  visualNodes.forEach((node) => {
    // 1. Check top-down location
    if (node.locationId) {
      const match: LocationVisualResolutionMatch = {
        type: "top_down",
        locationId: node.locationId,
        visualNodeId: node.id,
        visualNode: node,
      };
      const existing = byLocationId.get(node.locationId) || [];
      byLocationId.set(node.locationId, [...existing, match]);
    } else {
      visualOnlyObjects.push(node.id);
    }

    // 2. Check structure recursively
    if (node.structure) {
      const structureMatches = collectStructureLocationLinks(node.structure, node);
      structureMatches.forEach((match) => {
        const existing = byLocationId.get(match.locationId) || [];
        byLocationId.set(match.locationId, [...existing, match]);
      });
    }
  });

  const duplicates: string[] = [];
  const unresolvedReferences: string[] = [];

  for (const [locId, matches] of byLocationId.entries()) {
    if (matches.length > 1) {
      duplicates.push(locId);
    }
    if (locationIdsInSystem && !locationIdsInSystem.has(locId)) {
      unresolvedReferences.push(locId);
    }
  }

  return {
    byLocationId,
    duplicates,
    unresolvedReferences,
    visualOnlyObjects,
  };
}

/**
 * Resolves a locationId to its visual representation.
 */
export function resolveLocationVisual(
  locationId: string,
  visualNodes: VisualNode[],
  index?: MappingIndex
): LocationVisualResolution {
  const mappingIndex = index || buildLocationMappingIndex(visualNodes);
  const matches = mappingIndex.byLocationId.get(locationId);

  if (!matches || matches.length === 0) {
    return { status: "unmapped", locationId };
  }

  if (matches.length > 1) {
    return { status: "duplicate", locationId, matches };
  }

  const match = matches[0];
  if (match.type === "top_down") {
    return {
      status: "top_down",
      locationId: match.locationId,
      visualNodeId: match.visualNodeId,
      visualNode: match.visualNode,
    };
  } else {
    return {
      status: "front_cell",
      locationId: match.locationId,
      parentVisualNodeId: match.parentVisualNodeId,
      parentVisualNode: match.parentVisualNode,
      structureNodeId: match.structureNodeId,
      structurePath: match.structurePath,
      structureNode: match.structureNode,
    };
  }
}

/**
 * Basic search across locations and visuals.
 */
export function searchLocationsAndVisuals(
  query: string,
  locations: LogicalLocation[],
  visualNodes: VisualNode[]
) {
  const normalizedQuery = query.toLowerCase().trim();
  if (!normalizedQuery) return [];

  const index = buildLocationMappingIndex(visualNodes, locations);
  const results: any[] = [];

  // Search locations
  locations.forEach((loc) => {
    if (
      loc.code.toLowerCase().includes(normalizedQuery) ||
      loc.name.toLowerCase().includes(normalizedQuery)
    ) {
      const resolution = resolveLocationVisual(loc.id, visualNodes, index);
      results.push({
        type: "location",
        id: loc.id,
        code: loc.code,
        name: loc.name,
        resolution,
      });
    }
  });

  // Search visuals (top-level)
  visualNodes.forEach((node) => {
    if (node.label.toLowerCase().includes(normalizedQuery)) {
      results.push({
        type: "visual_node",
        id: node.id,
        label: node.label,
        locationId: node.locationId,
        viewMode: node.viewMode,
      });
    }

    if (node.structure) {
      const cells = findStructureNodesByPredicate(
        node.structure,
        (sNode) =>
          (sNode.label?.toLowerCase().includes(normalizedQuery) ||
            sNode.displayLabel?.toLowerCase().includes(normalizedQuery)) === true
      );
      cells.forEach((cell) => {
        results.push({
          type: "structure_cell",
          id: cell.id,
          label: cell.label,
          displayLabel: cell.displayLabel,
          parentVisualNodeId: node.id,
          locationId: cell.locationId,
        });
      });
    }
  });

  return results;
}

/**
 * Finds a structure node by its ID.
 */
export function findStructureNodeById(root: StructureNode, id: string): StructureNode | null {
  if (root.id === id) return root;
  if (root.children) {
    for (const child of root.children) {
      const found = findStructureNodeById(child, id);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Finds a structure node path by predicate.
 */
export function findStructureNodePath(
  root: StructureNode,
  predicate: (node: StructureNode) => boolean,
  currentPath: string[] = []
): { node: StructureNode; path: string[] } | null {
  const newPath = [...currentPath, root.id];
  if (predicate(root)) {
    return { node: root, path: newPath };
  }
  if (root.children) {
    for (const child of root.children) {
      const found = findStructureNodePath(child, predicate, newPath);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Finds structure nodes that match a predicate.
 */
export function findStructureNodesByPredicate(
  root: StructureNode,
  predicate: (node: StructureNode) => boolean
): StructureNode[] {
  let results: StructureNode[] = [];
  if (predicate(root)) {
    results.push(root);
  }
  if (root.children) {
    for (const child of root.children) {
      results = [...results, ...findStructureNodesByPredicate(child, predicate)];
    }
  }
  return results;
}

/**
 * Collects all location links within a front-view structure.
 */
export function collectStructureLocationLinks(
  root: StructureNode,
  parentVisual: VisualNode,
  currentPath: string[] = []
): LocationVisualResolutionMatch[] {
  const matches: LocationVisualResolutionMatch[] = [];
  const newPath = [...currentPath, root.id];

  if (root.locationId) {
    matches.push({
      type: "front_cell",
      locationId: root.locationId,
      parentVisualNodeId: parentVisual.id,
      parentVisualNode: parentVisual,
      structureNodeId: root.id,
      structurePath: newPath,
      structureNode: root,
    });
  }

  if (root.children) {
    root.children.forEach((child) => {
      matches.push(...collectStructureLocationLinks(child, parentVisual, newPath));
    });
  }

  return matches;
}
