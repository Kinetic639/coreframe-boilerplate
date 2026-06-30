/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { LogicalLocation, LocationRole } from "../types";

export interface LocationExportSchema {
  schemaVersion: string;
  exportedAt: string;
  source: {
    branchId: string;
    rootLocationId?: string;
    appUnit: string;
  };
  locations: LogicalLocation[];
  tree: ExportTreeNode[];
  metadata: {
    counts: {
      totalLocations: number;
      rootLocations: number;
      leafLocations: number;
      storageCapableLocations: number;
      virtualLocations: number;
      pickableLocations: number;
      receivableLocations: number;
      withQrCode: number;
      withBarcode: number;
      withWarnings: number;
    };
    byRole: Record<string, number>;
    byStatus: Record<string, number>;
    maxDepth: number;
  };
  diagnostics: {
    missingParents: string[];
    duplicateCodes: string[];
    circularReferences: string[];
    orphanedLocations: string[];
    parentAllowsStockWithChildren: string[];
    locationsWithoutCodes: string[];
    locationsWithoutNames: string[];
  };
  visualizationReadiness: {
    locationsEligibleForVisualization: string[];
    storageCapableLeafLocations: string[];
    containerLocations: string[];
    virtualLocationsExcludedFromVisualization: string[];
    suggestedWorkspaceRoots: string[];
  };
}

export interface ExportTreeNode {
  id: string;
  code: string;
  name: string;
  pathCode: string;
  pathName: string;
  depth: number;
  parentId: string | null;
  role: LocationRole;
  status: string;
  capabilities: {
    canStoreInventory: boolean;
    canReceive: boolean;
    canPick: boolean;
    isVirtual: boolean;
  };
  children: ExportTreeNode[];
}

export function generateLocationExport(
  locations: LogicalLocation[],
  branchId: string = "unknown"
): LocationExportSchema {
  const exportedAt = new Date().toISOString();

  // Helpers
  const getLocationById = (id: string) => locations.find((l) => l.id === id);

  const isLeaf = (locId: string) => !locations.some((l) => l.parentId === locId);

  // Map locations to include extra inspection info
  const locationsWithDepth = locations.map((l) => {
    let depth = 0;
    let current = l;
    const visited = new Set<string>();
    while (current.parentId && !visited.has(current.parentId)) {
      const parent = getLocationById(current.parentId);
      if (!parent) break;
      visited.add(current.parentId);
      current = parent;
      depth++;
    }
    return {
      ...l,
      depth,
      isLeaf: isLeaf(l.id),
      ancestorIds: Array.from(visited),
    };
  });

  // Build Tree
  const buildTree = (parentId: string | null): ExportTreeNode[] => {
    return locationsWithDepth
      .filter((l) => l.parentId === parentId)
      .map((l) => ({
        id: l.id,
        code: l.code,
        name: l.name,
        pathCode: l.pathCode,
        pathName: l.pathName,
        depth: l.depth,
        parentId: l.parentId,
        role: l.role,
        status: l.status,
        capabilities: {
          canStoreInventory: l.capabilities.canStoreInventory,
          canReceive: l.capabilities.canReceive,
          canPick: l.capabilities.canPick,
          isVirtual: l.capabilities.isVirtual,
        },
        children: buildTree(l.id),
      }));
  };

  const tree = buildTree(null);

  // Metadata & Counts
  const counts = {
    totalLocations: locations.length,
    rootLocations: locations.filter((l) => !l.parentId).length,
    leafLocations: locationsWithDepth.filter((l) => l.isLeaf).length,
    storageCapableLocations: locations.filter((l) => l.capabilities.canStoreInventory).length,
    virtualLocations: locations.filter((l) => l.capabilities.isVirtual).length,
    pickableLocations: locations.filter((l) => l.capabilities.canPick).length,
    receivableLocations: locations.filter((l) => l.capabilities.canReceive).length,
    withQrCode: locations.filter((l) => !!l.physical?.qrCode).length,
    withBarcode: 0, // Removed from schema per new model instructions
    withWarnings: locations.filter((l) => (l.warnings?.length || 0) > 0).length,
  };

  const byRole: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  let maxDepth = 0;

  locationsWithDepth.forEach((l) => {
    byRole[l.role] = (byRole[l.role] || 0) + 1;
    byStatus[l.status] = (byStatus[l.status] || 0) + 1;
    if (l.depth > maxDepth) maxDepth = l.depth;
  });

  // Diagnostics
  const codes = locations.map((l) => l.code);
  const duplicateCodes = Array.from(
    new Set(codes.filter((item, index) => codes.indexOf(item) !== index))
  );

  const missingParents = locations
    .filter((l) => l.parentId !== null && !getLocationById(l.parentId))
    .map((l) => l.id);

  const circularReferences: string[] = [];
  locationsWithDepth.forEach((l) => {
    if (l.ancestorIds.includes(l.id)) {
      circularReferences.push(l.id);
    }
  });

  const parentAllowsStockWithChildren = locationsWithDepth
    .filter((l) => l.capabilities.canStoreInventory && !l.isLeaf)
    .map((l) => l.id);

  // Visualization Readiness
  const storageCapableLeafLocations = locationsWithDepth
    .filter((l) => l.capabilities.canStoreInventory && l.isLeaf)
    .map((l) => l.id);

  const containerLocations = locations.filter((l) => !isLeaf(l.id)).map((l) => l.id);

  const locationsEligibleForVisualization = locations
    .filter((l) => !l.capabilities.isVirtual)
    .map((l) => l.id);

  return {
    schemaVersion: "ambra-location-model-refactor-v1",
    exportedAt,
    source: {
      branchId,
      appUnit: "cm",
    },
    locations: locationsWithDepth as any,
    tree,
    metadata: {
      counts,
      byRole,
      byStatus,
      maxDepth,
    },
    diagnostics: {
      missingParents,
      duplicateCodes,
      circularReferences,
      orphanedLocations: missingParents,
      parentAllowsStockWithChildren,
      locationsWithoutCodes: locations.filter((l) => !l.code).map((l) => l.id),
      locationsWithoutNames: locations.filter((l) => !l.name).map((l) => l.id),
    },
    visualizationReadiness: {
      locationsEligibleForVisualization,
      storageCapableLeafLocations,
      containerLocations,
      virtualLocationsExcludedFromVisualization: locations
        .filter((l) => l.capabilities.isVirtual)
        .map((l) => l.id),
      suggestedWorkspaceRoots: locations.filter((l) => !l.parentId).map((l) => l.id),
    },
  };
}
