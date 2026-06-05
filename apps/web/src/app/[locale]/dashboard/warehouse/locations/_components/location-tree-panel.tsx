"use client";

import { useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin } from "lucide-react";
import { LocationTreeNode, type TreeNode } from "./location-tree-node";
import type { LocationV2, LocationMappingStatus } from "@/lib/types/warehouse/locations-v2";

interface LocationTreePanelProps {
  locations: LocationV2[];
  mappingStatuses?: Record<string, LocationMappingStatus>;
  selectedId?: string | null;
  onSelect: (location: LocationV2) => void;
  isLoading?: boolean;
}

export function LocationTreePanel({
  locations,
  mappingStatuses = {},
  selectedId,
  onSelect,
  isLoading,
}: LocationTreePanelProps) {
  const tree = useMemo(() => buildTree(locations, mappingStatuses), [locations, mappingStatuses]);

  if (isLoading) {
    return (
      <div className="p-3 space-y-2">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-7 w-full" style={{ marginLeft: i > 2 ? 16 : 0 }} />
        ))}
      </div>
    );
  }

  if (tree.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-6 text-center">
        <MapPin className="h-8 w-8 mb-2 opacity-30" />
        <p className="text-sm">No locations yet</p>
        <p className="text-xs mt-1">Use &quot;Add object&quot; to place your first item.</p>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className="py-2 pr-2">
        {tree.map((node) => (
          <LocationTreeNode
            key={node.location.id}
            node={node}
            selectedId={selectedId}
            onSelect={onSelect}
          />
        ))}
      </div>
    </ScrollArea>
  );
}

function buildTree(
  locations: LocationV2[],
  mappingStatuses: Record<string, LocationMappingStatus>
): TreeNode[] {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  // First pass: create all nodes
  for (const loc of locations) {
    map.set(loc.id, {
      location: loc,
      children: [],
      mappingStatus: mappingStatuses[loc.id],
    });
  }

  // Second pass: build hierarchy
  for (const loc of locations) {
    const node = map.get(loc.id)!;
    if (loc.parent_id && map.has(loc.parent_id)) {
      map.get(loc.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // Sort by sort_order, then name
  function sortNodes(nodes: TreeNode[]) {
    nodes.sort(
      (a, b) =>
        (a.location.sort_order ?? 0) - (b.location.sort_order ?? 0) ||
        a.location.name.localeCompare(b.location.name)
    );
    for (const n of nodes) sortNodes(n.children);
    return nodes;
  }

  return sortNodes(roots);
}
