/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { VisualNode, LogicalLocation, StructureNode, Layout, VisualNodeRole } from "../types";

export interface MappingHealthReport {
  timestamp: string;
  layoutId: string;
  layoutName: string;
  scopeLocationId?: string;
  scopeLocationName?: string;
  summary: {
    totalLocations: number;
    operationalLocations: number; // allowsStock = true
    mappedLocations: number;
    unmappedOperationalLocations: number;
    brokenMappings: number;
    duplicateMappings: number;
    hierarchyViolations: number;
    storageConflicts: number;
    outOfScopeMappings: number;
  };
  coverage: {
    mappedPercentage: number;
    topDownCount: number;
    frontViewCount: number;
    outOfScopeCount: number;
  };
  details: {
    unmappedOperational: LogicalLocation[];
    outOfScopeMappings: {
      visualNodeId: string;
      visualNodeLabel: string;
      locationId: string;
      source: "top-down" | "front-view";
    }[];
    brokenMappings: {
      visualNodeId?: string;
      visualNodeLabel?: string;
      locationId: string;
      source: "top-down" | "front-view";
      path?: string[];
    }[];
    duplicateMappings: {
      locationId: string;
      locationCode: string;
      occurrences: {
        type: "top-down" | "front-view";
        visualNodeId: string;
        visualNodeLabel: string;
        structurePath?: string[];
      }[];
    }[];
    hierarchyViolations: {
      locationId: string;
      locationCode: string;
      missingAncestors: { id: string; code: string }[];
    }[];
    storageConflicts: {
      locationId: string;
      locationCode: string;
      reason: "stock_allows_with_children" | "ambiguous_mapping";
    }[];
    unassignedStorageObjects: {
      id: string;
      label: string;
      type: string;
    }[];
  };
  recommendations: string[];
}

export function analyzeWorkspaceMappingHealth(
  layout: Layout,
  visuals: VisualNode[],
  locations: LogicalLocation[],
  scopeLocationId?: string
): MappingHealthReport {
  // Filter locations to subtree if scope is provided
  let filteredLocations = locations;
  let scopeLocationName = undefined;

  if (scopeLocationId) {
    const getDescendantIds = (parentId: string): string[] => {
      const children = locations.filter((l) => l.parentId === parentId);
      return [parentId, ...children.flatMap((c) => getDescendantIds(c.id))];
    };
    const scopeIds = new Set(getDescendantIds(scopeLocationId));
    filteredLocations = locations.filter((l) => scopeIds.has(l.id));
    scopeLocationName = locations.find((l) => l.id === scopeLocationId)?.name;
  }

  const report: MappingHealthReport = {
    timestamp: new Date().toISOString(),
    layoutId: layout.id,
    layoutName: layout.name,
    scopeLocationId,
    scopeLocationName,
    summary: {
      totalLocations: filteredLocations.length,
      operationalLocations: 0,
      mappedLocations: 0,
      unmappedOperationalLocations: 0,
      brokenMappings: 0,
      duplicateMappings: 0,
      hierarchyViolations: 0,
      storageConflicts: 0,
      outOfScopeMappings: 0,
    },
    coverage: {
      mappedPercentage: 0,
      topDownCount: 0,
      frontViewCount: 0,
      outOfScopeCount: 0,
    },
    details: {
      unmappedOperational: [],
      outOfScopeMappings: [],
      brokenMappings: [],
      duplicateMappings: [],
      hierarchyViolations: [],
      storageConflicts: [],
      unassignedStorageObjects: [],
    },
    recommendations: [],
  };

  const locationMap = new Map(filteredLocations.map((l) => [l.id, l]));
  const globalLocationMap = new Map(locations.map((l) => [l.id, l]));
  const operationalLocations = filteredLocations.filter((l) => l.capabilities.canStoreInventory);
  report.summary.operationalLocations = operationalLocations.length;

  // Track mappings
  const mappingIndex = new Map<
    string,
    {
      type: "top-down" | "front-view";
      visualNodeId: string;
      visualNodeLabel: string;
      structurePath?: string[];
    }[]
  >();

  const addMapping = (
    locId: string,
    mapping: {
      type: "top-down" | "front-view";
      visualNodeId: string;
      visualNodeLabel: string;
      structurePath?: string[];
    }
  ) => {
    // Only track if within scope
    if (!locationMap.has(locId)) return;

    if (!mappingIndex.has(locId)) {
      mappingIndex.set(locId, []);
    }
    mappingIndex.get(locId)!.push(mapping);
  };

  // 1. Scan Top-Down Mappings
  visuals.forEach((node) => {
    if (node.locationId) {
      if (!globalLocationMap.has(node.locationId)) {
        report.details.brokenMappings.push({
          visualNodeId: node.id,
          visualNodeLabel: node.label,
          locationId: node.locationId,
          source: "top-down",
        });
      } else if (locationMap.has(node.locationId)) {
        addMapping(node.locationId, {
          type: "top-down",
          visualNodeId: node.id,
          visualNodeLabel: node.label,
        });
        report.coverage.topDownCount++;
      } else {
        // Mapped to a valid location, but NOT in current subtree scope
        report.details.outOfScopeMappings.push({
          visualNodeId: node.id,
          visualNodeLabel: node.label,
          locationId: node.locationId,
          source: "top-down",
        });
        report.coverage.outOfScopeCount++;
      }
    } else {
      // Logic for unmapped visual objects based on nodeRole
      const isStorageLike =
        node.nodeRole === VisualNodeRole.UNASSIGNED_STORAGE ||
        node.nodeRole === VisualNodeRole.LOCATION_REPRESENTATION;

      // Heuristic fallback if nodeRole is missing
      const storageTypes = ["rack", "shelf", "industrial"];
      const heuristicIsStorage =
        !node.nodeRole &&
        (storageTypes.includes(node.type) ||
          node.label.toLowerCase().includes("rack") ||
          node.label.toLowerCase().includes("shelf"));

      if ((isStorageLike || heuristicIsStorage) && !node.locationId) {
        report.details.unassignedStorageObjects.push({
          id: node.id,
          label: node.label,
          type: node.type,
        });
      }
    }

    // 2. Scan Front-View Mappings (Recursive)
    if (node.structure) {
      const scanStructure = (sn: StructureNode, path: string[]) => {
        const currentPath = [...path, sn.displayLabel || sn.label || "unnamed"];
        if (sn.locationId) {
          if (!globalLocationMap.has(sn.locationId)) {
            report.details.brokenMappings.push({
              visualNodeId: node.id,
              visualNodeLabel: node.label,
              locationId: sn.locationId,
              source: "front-view",
              path: currentPath,
            });
          } else if (locationMap.has(sn.locationId)) {
            addMapping(sn.locationId, {
              type: "front-view",
              visualNodeId: node.id,
              visualNodeLabel: node.label,
              structurePath: currentPath,
            });
            report.coverage.frontViewCount++;
          } else {
            // Valid globally but out of current subtree scope
            report.details.outOfScopeMappings.push({
              visualNodeId: node.id,
              visualNodeLabel: node.label,
              locationId: sn.locationId,
              source: "front-view",
            });
            report.coverage.outOfScopeCount++;
          }
        }
        if (sn.children) {
          sn.children.forEach((child) => scanStructure(child, currentPath));
        }
      };
      scanStructure(node.structure, []);
    }
  });

  // 3. Process Duplicate Mappings
  mappingIndex.forEach((matches, locId) => {
    if (matches.length > 1) {
      const loc = locationMap.get(locId)!;
      report.details.duplicateMappings.push({
        locationId: locId,
        locationCode: loc.code,
        occurrences: matches,
      });
      report.summary.duplicateMappings++;
    }
  });

  report.summary.mappedLocations = mappingIndex.size;

  // 4. Find Unmapped Operational Locations
  operationalLocations.forEach((loc) => {
    if (!mappingIndex.has(loc.id)) {
      if (!loc.isVirtual) {
        report.details.unmappedOperational.push(loc);
        report.summary.unmappedOperationalLocations++;
      }
    }
  });

  // 5. Hierarchy Violations
  mappingIndex.forEach((_, locId) => {
    const loc = locationMap.get(locId)!;
    const missingAncestors: { id: string; code: string }[] = [];

    let currentParentId = loc.parentId;
    while (currentParentId) {
      // If we are scoped, and the parent is outside the scope, we stop hierarchy check
      // OR if the parent is in scope but not mapped, it's a violation.
      if (scopeLocationId && currentParentId === scopeLocationId) break;

      const parentInScope = locationMap.get(currentParentId);
      if (!parentInScope) {
        // Parent is outside scope, check if it exists globally to distinguish "broken hierarchy" vs "scope boundary"
        const parentGlobal = globalLocationMap.get(currentParentId);
        if (!parentGlobal) {
          missingAncestors.push({ id: currentParentId, code: "UNKNOWN_GLOBAL" });
        }
        // If parent is global but out of scope, we consider the local hierarchy "satisfied at scope edge"
        break;
      }

      if (!mappingIndex.has(currentParentId) && !parentInScope.capabilities.isVirtual) {
        missingAncestors.push({ id: parentInScope.id, code: parentInScope.code });
      }

      currentParentId = parentInScope.parentId;
    }

    if (missingAncestors.length > 0) {
      report.details.hierarchyViolations.push({
        locationId: locId,
        locationCode: loc.code,
        missingAncestors,
      });
      report.summary.hierarchyViolations++;
    }
  });

  // 6. Storage Conflicts
  filteredLocations.forEach((loc) => {
    const hasChildren = filteredLocations.some((l) => l.parentId === loc.id);
    if (loc.capabilities.canStoreInventory && hasChildren) {
      report.details.storageConflicts.push({
        locationId: loc.id,
        locationCode: loc.code,
        reason: "stock_allows_with_children",
      });
      report.summary.storageConflicts++;
    }
  });

  // Coverage Stats
  if (operationalLocations.length > 0) {
    report.coverage.mappedPercentage = Math.round(
      (report.summary.mappedLocations / operationalLocations.length) * 100
    );
  }

  report.summary.brokenMappings = report.details.brokenMappings.length;
  report.summary.outOfScopeMappings = report.details.outOfScopeMappings.length;

  // Recommendations
  if (report.summary.outOfScopeMappings > 0) {
    report.recommendations.push(
      `${report.summary.outOfScopeMappings} physical objects are mapped to locations from a different site/root. This creates data pollution.`
    );
  }
  if (report.summary.unmappedOperationalLocations > 0) {
    report.recommendations.push(
      `${report.summary.unmappedOperationalLocations} operational locations are missing physical representation.`
    );
  }
  if (report.summary.duplicateMappings > 0) {
    report.recommendations.push(
      `${report.summary.duplicateMappings} locations are mapped to multiple physical objects. This causes ambiguity for picking.`
    );
  }
  if (report.summary.hierarchyViolations > 0) {
    report.recommendations.push(
      `${report.summary.hierarchyViolations} locations are mapped without their parent containers. Physical wayfinding might be broken.`
    );
  }
  if (report.summary.storageConflicts > 0) {
    report.recommendations.push(
      `${report.summary.storageConflicts} locations allow stock while containing sub-locations. Prefer leaf-only stock assignment.`
    );
  }
  if (report.details.unassignedStorageObjects.length > 0) {
    report.recommendations.push(
      `${report.details.unassignedStorageObjects.length} storage objects have no logical location assigned.`
    );
  }

  return report;
}
