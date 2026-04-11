"use client";

/**
 * MapPreview — read-only view inside the editor.
 *
 * Left panel:  collapsible locations tree. Clicking a placed location
 *              highlights + auto-pans to it on the canvas.
 * Right panel: WarehouseMapViewer (the shared cross-app component) rendered
 *              with the current (possibly unsaved) layout state so the user
 *              sees exactly what the map looks like right now.
 */

import React from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { ChevronDown, ChevronRight, Loader2, MapPin, Palette } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WarehouseLayoutWithShapes, WarehouseLayoutShape } from "@/lib/warehouse/layouts";
import {
  getEffectiveLocationColor,
  type WarehouseLocation,
  type WarehouseLocationGroup,
} from "@/lib/warehouse/location-tree";

// ─── Viewer: Konva — client-only ──────────────────────────────────────────────

const WarehouseMapViewer = dynamic(
  () =>
    import("@/components/v2/warehouse/warehouse-map-viewer").then((m) => ({
      default: m.WarehouseMapViewer,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    ),
  }
);

// ─── Tree node ────────────────────────────────────────────────────────────────

function TreeNode({
  location,
  allLocations,
  placedLocationIds,
  highlightedId,
  onSelect,
  depth,
  groups,
  t,
}: {
  location: WarehouseLocation;
  allLocations: WarehouseLocation[];
  placedLocationIds: Set<string>;
  highlightedId: string | null;
  onSelect: (id: string) => void;
  depth: number;
  groups: WarehouseLocationGroup[];
  t: ReturnType<typeof useTranslations>;
}) {
  const [expanded, setExpanded] = React.useState(true);
  const children = allLocations.filter((l) => l.parent_id === location.id);
  const isPlaced = placedLocationIds.has(location.id);
  const isActive = highlightedId === location.id;

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-1.5 py-1.5 pr-2 rounded-md mx-1 transition-colors",
          isActive && "bg-primary/10",
          !isActive && isPlaced && "cursor-pointer hover:bg-accent",
          !isActive && !isPlaced && "opacity-50 cursor-default"
        )}
        style={{ paddingLeft: 8 + depth * 16 }}
        onClick={() => {
          if (isPlaced) onSelect(location.id);
        }}
      >
        {/* Expand toggle */}
        <button
          type="button"
          className={cn(
            "shrink-0 w-4 h-4 flex items-center justify-center text-muted-foreground hover:text-foreground",
            children.length === 0 && "invisible pointer-events-none"
          )}
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
        >
          {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </button>

        {/* Color dot */}
        <div
          className="w-2.5 h-2.5 rounded-sm shrink-0 border border-black/10"
          style={{ backgroundColor: getEffectiveLocationColor(location, groups) ?? "#10b981" }}
        />

        {/* Name + code */}
        <span
          className={cn(
            "text-xs truncate flex-1 min-w-0",
            isActive && "font-semibold text-primary"
          )}
        >
          {location.name}
        </span>
        {location.code && (
          <span className="text-[10px] font-mono text-muted-foreground shrink-0">
            {location.code}
          </span>
        )}

        {/* Placed indicator */}
        {isPlaced && !isActive && (
          <div
            className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"
            title={t("tree.onCanvas")}
          />
        )}
        {isActive && (
          <div
            className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 animate-pulse"
            title={t("tree.highlighted")}
          />
        )}
      </div>

      {expanded &&
        children.map((child) => (
          <TreeNode
            key={child.id}
            location={child}
            allLocations={allLocations}
            placedLocationIds={placedLocationIds}
            highlightedId={highlightedId}
            onSelect={onSelect}
            depth={depth + 1}
            groups={groups}
            t={t}
          />
        ))}
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface MapPreviewProps {
  /** Current layout state (may include unsaved shapes) */
  layout: WarehouseLayoutWithShapes;
  locations: WarehouseLocation[];
  locationGroups: WarehouseLocationGroup[];
  rootLocationId: string | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MapPreview({ layout, locations, locationGroups, rootLocationId }: MapPreviewProps) {
  const t = useTranslations("warehouseMapPreview");
  const [highlightedId, setHighlightedId] = React.useState<string | null>(null);
  const [isMonochrome, setIsMonochrome] = React.useState(true);

  // All descendants of root (BFS), or full list for legacy layouts
  const descendants = React.useMemo(() => {
    if (!rootLocationId) return locations;
    const result: WarehouseLocation[] = [];
    const visited = new Set<string>();
    const queue = locations.filter((l) => l.parent_id === rootLocationId);
    while (queue.length > 0) {
      const loc = queue.shift()!;
      if (visited.has(loc.id)) continue;
      visited.add(loc.id);
      result.push(loc);
      locations.filter((l) => l.parent_id === loc.id).forEach((l) => queue.push(l));
    }
    return result;
  }, [locations, rootLocationId]);

  const treeRoots = descendants.filter((l) => l.parent_id === rootLocationId);

  // Set of location IDs that have a shape on the canvas
  const placedLocationIds = React.useMemo(
    () => new Set(layout.shapes.filter((s) => s.location_id).map((s) => s.location_id!)),
    [layout.shapes]
  );

  // Clicking a shape on the canvas highlights its location in the tree
  const handleShapeClick = (shape: WarehouseLayoutShape) => {
    if (shape.location_id) {
      setHighlightedId((prev) => (prev === shape.location_id ? null : shape.location_id));
    }
  };

  // Toggle highlight when clicking in tree
  const handleTreeSelect = (locationId: string) => {
    setHighlightedId((prev) => (prev === locationId ? null : locationId));
  };

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* ── Left: locations tree panel ─────────────────────────────────── */}
      <div className="w-64 h-full border-r bg-background flex flex-col shrink-0 overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b bg-muted/50 shrink-0">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            {t("tree.title")}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{t("tree.description")}</p>
        </div>

        <div className="flex-1 overflow-y-auto py-1">
          {treeRoots.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 px-4 text-center text-muted-foreground">
              <MapPin className="w-8 h-8 mb-2 opacity-20" />
              <p className="text-xs">{t("tree.empty")}</p>
            </div>
          ) : (
            treeRoots.map((loc) => (
              <TreeNode
                key={loc.id}
                location={loc}
                allLocations={descendants}
                placedLocationIds={placedLocationIds}
                highlightedId={highlightedId}
                onSelect={handleTreeSelect}
                depth={0}
                groups={locationGroups}
                t={t}
              />
            ))
          )}
        </div>

        {/* Legend */}
        <div className="p-3 border-t bg-muted/30 shrink-0 space-y-1.5">
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            {t("tree.legendPlaced")}
          </div>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />
            {t("tree.legendUnplaced")}
          </div>
        </div>
      </div>

      {/* ── Right: map viewer ──────────────────────────────────────────── */}
      {/* Clicking the dark surround (outside the Konva canvas) clears the highlight */}
      <div
        className="flex-1 h-full overflow-hidden bg-zinc-200 dark:bg-zinc-900 relative"
        onClick={() => {
          setHighlightedId(null);
          setIsMonochrome(true);
        }}
      >
        {highlightedId && (
          <div className="absolute left-3 top-3 z-10 flex flex-col gap-1 rounded-lg border bg-background/90 p-1 shadow-sm backdrop-blur-sm">
            <button
              type="button"
              title={isMonochrome ? t("actions.showColors") : t("actions.monochromaticView")}
              onClick={(e) => {
                e.stopPropagation();
                setIsMonochrome((v) => !v);
              }}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-muted",
                isMonochrome
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "text-muted-foreground"
              )}
            >
              <Palette className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* stopPropagation so clicks on the canvas itself don't bubble to the surround */}
        <div className="h-full w-full" onClick={(e) => e.stopPropagation()}>
          <WarehouseMapViewer
            layout={layout}
            locations={locations}
            locationGroups={locationGroups}
            highlightLocationId={highlightedId}
            autoPanToHighlight={false}
            monochromaticHighlight={isMonochrome}
            onShapeClick={handleShapeClick}
            className="h-full w-full"
          />
        </div>
      </div>
    </div>
  );
}
