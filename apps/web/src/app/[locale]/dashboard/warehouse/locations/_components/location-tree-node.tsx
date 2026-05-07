"use client";

import { useState } from "react";
import { ChevronRight, ChevronDown, Package, Archive } from "lucide-react";
import { cn } from "@/lib/utils";
import { MappingStatusBadge } from "./mapping-status-badge";
import type { LocationV2, LocationMappingStatus } from "@/lib/types/warehouse/locations-v2";

export interface TreeNode {
  location: LocationV2;
  children: TreeNode[];
  mappingStatus?: LocationMappingStatus;
}

interface LocationTreeNodeProps {
  node: TreeNode;
  depth?: number;
  selectedId?: string | null;
  onSelect: (location: LocationV2) => void;
}

export function LocationTreeNode({ node, depth = 0, selectedId, onSelect }: LocationTreeNodeProps) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children.length > 0;
  const isSelected = selectedId === node.location.id;
  const isArchived = node.location.status === "archived";
  const isInactive = node.location.status === "inactive";

  const storageCount = countStorageSlots(node);

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-1 rounded-md px-2 py-1 text-sm cursor-pointer select-none group",
          isSelected ? "bg-primary text-primary-foreground" : "hover:bg-muted/60",
          isArchived && "opacity-50"
        )}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={() => onSelect(node.location)}
      >
        {/* expand/collapse */}
        <button
          className="shrink-0 p-0.5 rounded hover:bg-black/10"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((p) => !p);
          }}
        >
          {hasChildren ? (
            expanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )
          ) : (
            <span className="h-3.5 w-3.5 block" />
          )}
        </button>

        {/* icon */}
        {node.location.can_store_inventory ? (
          <Package className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
        ) : (
          <span
            className="h-3 w-3 rounded-sm shrink-0 border"
            style={{
              backgroundColor: node.location.color ?? "#e2e8f0",
              borderColor: node.location.color ?? "#cbd5e1",
            }}
          />
        )}

        {/* name */}
        <span className="truncate flex-1 min-w-0">
          {node.location.code ? (
            <span className="font-mono text-xs opacity-60 mr-1">{node.location.code}</span>
          ) : null}
          {node.location.name}
        </span>

        {/* badges */}
        <div className="flex items-center gap-1 shrink-0">
          {isArchived && <Archive className="h-3 w-3 opacity-50" />}
          {isInactive && <span className="text-[10px] opacity-50">inactive</span>}
          {node.mappingStatus && node.mappingStatus !== "mapped" && (
            <MappingStatusBadge status={node.mappingStatus} size="xs" />
          )}
          {!hasChildren && storageCount === 0 && (
            <span className="text-[10px] opacity-40 hidden group-hover:block">leaf</span>
          )}
          {storageCount > 0 && !node.location.can_store_inventory && (
            <span className="text-[10px] opacity-50">{storageCount} slots</span>
          )}
        </div>
      </div>

      {/* children */}
      {hasChildren && expanded && (
        <div>
          {node.children.map((child) => (
            <LocationTreeNode
              key={child.location.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function countStorageSlots(node: TreeNode): number {
  let count = node.location.can_store_inventory ? 1 : 0;
  for (const child of node.children) {
    count += countStorageSlots(child);
  }
  return count;
}
