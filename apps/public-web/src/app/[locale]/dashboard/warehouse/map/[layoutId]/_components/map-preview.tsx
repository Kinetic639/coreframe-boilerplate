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
import {
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  Info,
  Loader2,
  MapPin,
  MoveHorizontal,
  MoveVertical,
  Palette,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { WarehouseLayoutWithShapes, WarehouseLayoutShape } from "@/lib/warehouse/layouts";
import {
  getEffectiveLocationColor,
  type WarehouseLocation,
  type WarehouseLocationGroup,
} from "@/lib/warehouse/location-tree";
import { resolveLocationMapContext } from "@/lib/warehouse/map-context";
import {
  buildChildrenByParentId,
  buildLocationMap,
  deriveWarehousePreviewSelectionState,
} from "@/lib/warehouse/map-preview";
import { WarehouseFrontElevationPanel } from "@/components/v2/warehouse/warehouse-front-elevation-panel";

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMeters(value: number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return `${Number.isInteger(value) ? value : value.toFixed(2).replace(/\.?0+$/, "")} m`;
}

// ─── Info rail ────────────────────────────────────────────────────────────────

function PreviewInfoRail({
  location,
  panelTitle,
  emptyLabel,
}: {
  location: WarehouseLocation | null;
  panelTitle: string;
  emptyLabel: string;
}) {
  const [open, setOpen] = React.useState(true);
  const width = location?.physical_width_m ? formatMeters(location.physical_width_m) : null;
  const depth = location?.physical_depth_m ? formatMeters(location.physical_depth_m) : null;
  const height = location?.physical_height_m ? formatMeters(location.physical_height_m) : null;
  const hasDimensions = width || depth || height;

  return (
    <div
      className="pointer-events-auto relative flex h-full shrink-0 items-stretch"
      onClick={(e) => e.stopPropagation()}
    >
      {!open && (
        <div className="absolute inset-y-0 right-0 z-10 flex items-start justify-end p-3">
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 rounded-lg border-border/70 bg-background/90 shadow-sm backdrop-blur-sm"
                  onClick={() => setOpen(true)}
                >
                  <Info className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{panelTitle}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}

      <div
        className={cn(
          "flex h-full overflow-hidden border-l border-border/60 bg-background/75 backdrop-blur-sm transition-[width,opacity] duration-200 ease-out",
          open ? "w-64 opacity-100" : "w-0 opacity-0"
        )}
      >
        <div className="flex h-full min-w-0 w-full flex-col">
          <div className="flex w-full items-center justify-between border-b border-border/60 px-3 py-2">
            <div className="min-w-0 flex-1">
              {!location ? (
                <p className="truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  {panelTitle}
                </p>
              ) : (
                <p className="truncate text-sm font-medium text-foreground">
                  {location.name}
                  {location.code ? (
                    <span className="ml-1 font-mono text-[11px] font-normal text-muted-foreground">
                      ({location.code})
                    </span>
                  ) : null}
                </p>
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={() => setOpen(false)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
            {!location ? (
              <p className="text-xs leading-relaxed text-muted-foreground">{emptyLabel}</p>
            ) : (
              <>
                {location.description?.trim() && (
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {location.description}
                  </p>
                )}
                {hasDimensions && (
                  <div className="space-y-2 pt-1">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Wymiary
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {width && (
                        <TooltipProvider delayDuration={100}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-2.5 py-1.5">
                                <MoveHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-xs font-medium">{width}</span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>Szerokość</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      {depth && (
                        <TooltipProvider delayDuration={100}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-2.5 py-1.5">
                                <MoveVertical className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-xs font-medium">{depth}</span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>Głębokość</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      {height && (
                        <TooltipProvider delayDuration={100}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-2.5 py-1.5">
                                <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-xs font-medium">{height}</span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>Wysokość</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Tree node ────────────────────────────────────────────────────────────────

function TreeNode({
  location,
  allLocations,
  placedLocationIds,
  mappableLocationIds,
  highlightedId,
  onSelect,
  depth,
  groups,
  t,
}: {
  location: WarehouseLocation;
  allLocations: WarehouseLocation[];
  placedLocationIds: Set<string>;
  mappableLocationIds: Set<string>;
  highlightedId: string | null;
  onSelect: (id: string) => void;
  depth: number;
  groups: WarehouseLocationGroup[];
  t: ReturnType<typeof useTranslations>;
}) {
  const [expanded, setExpanded] = React.useState(true);
  const children = allLocations.filter((l) => l.parent_id === location.id);
  const isPlaced = placedLocationIds.has(location.id);
  const isMappable = mappableLocationIds.has(location.id);
  const isActive = highlightedId === location.id;

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-1.5 py-1.5 pr-2 rounded-md mx-1 transition-colors",
          isActive && "bg-primary/10",
          !isActive && isMappable && "cursor-pointer hover:bg-accent",
          !isActive && !isMappable && "opacity-50 cursor-default"
        )}
        style={{ paddingLeft: 8 + depth * 16 }}
        onClick={() => {
          if (isMappable) onSelect(location.id);
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
          style={{
            backgroundColor: getEffectiveLocationColor(location, groups, allLocations) ?? "#10b981",
          }}
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
            mappableLocationIds={mappableLocationIds}
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
  const [isFrontViewCollapsed, setIsFrontViewCollapsed] = React.useState(true);

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

  const locationMap = React.useMemo(() => buildLocationMap(locations), [locations]);
  const childrenByParentId = React.useMemo(() => buildChildrenByParentId(locations), [locations]);
  const highlightedIds = React.useMemo(
    () => (highlightedId ? [highlightedId] : []),
    [highlightedId]
  );

  const {
    selectedTopDownFocusIds,
    frontStageAnchorIds,
    frontHighlightIds,
    topDownInfoLocations,
    frontInfoLocations,
  } = React.useMemo(
    () =>
      deriveWarehousePreviewSelectionState({
        highlightedIds,
        locations,
        locationMap,
        childrenByParentId,
      }),
    [highlightedIds, locations, locationMap, childrenByParentId]
  );

  const frontAnchorLocationId = React.useMemo(
    () => (frontStageAnchorIds.length === 1 ? frontStageAnchorIds[0] : null),
    [frontStageAnchorIds]
  );

  // Auto-expand front view when the selection has front view content
  React.useEffect(() => {
    if (frontStageAnchorIds.length > 0) {
      setIsFrontViewCollapsed(false);
    }
  }, [frontStageAnchorIds]);

  // Set of location IDs that have a shape on the canvas
  const placedLocationIds = React.useMemo(
    () => new Set(layout.shapes.filter((s) => s.location_id).map((s) => s.location_id!)),
    [layout.shapes]
  );
  const mappableLocationIds = React.useMemo(
    () =>
      new Set(
        descendants
          .filter((location) => {
            const context = resolveLocationMapContext(location.id, locations, rootLocationId);
            return !!context.topDownAnchorLocationId || !!context.frontAnchorLocationId;
          })
          .map((location) => location.id)
      ),
    [descendants, locations, rootLocationId]
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

  const handleClearHighlight = () => {
    setHighlightedId(null);
    setIsMonochrome(true);
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
                mappableLocationIds={mappableLocationIds}
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

      {/* ── Right: map viewer + front elevation ────────────────────────── */}
      <div
        className="grid min-w-0 flex-1 overflow-hidden transition-[grid-template-rows] duration-300 ease-in-out"
        style={{
          gridTemplateRows: isFrontViewCollapsed
            ? "minmax(0,1fr) 2.25rem"
            : "minmax(0,1fr) clamp(14rem,35%,20rem)",
        }}
      >
        {/* Top-down map + info rail */}
        <div className="flex min-h-0 overflow-hidden" onClick={handleClearHighlight}>
          <div className="relative min-w-0 flex-1 overflow-hidden bg-zinc-200 dark:bg-zinc-900">
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

            <div className="h-full w-full" onClick={(e) => e.stopPropagation()}>
              <WarehouseMapViewer
                layout={layout}
                locations={locations}
                locationGroups={locationGroups}
                highlightLocationId={highlightedId}
                highlightLocationIds={
                  selectedTopDownFocusIds.length > 0 ? selectedTopDownFocusIds : undefined
                }
                autoPanToHighlight={false}
                monochromaticHighlight={isMonochrome}
                onShapeClick={handleShapeClick}
                className="h-full w-full"
              />
            </div>
          </div>

          <PreviewInfoRail
            location={topDownInfoLocations[0] ?? null}
            panelTitle="Widok z góry"
            emptyLabel="Zaznacz lokalizację, aby zobaczyć szczegóły."
          />
        </div>

        {/* Front elevation */}
        <WarehouseFrontElevationPanel
          layout={layout}
          locations={locations}
          locationGroups={locationGroups}
          anchorLocationId={frontAnchorLocationId}
          anchorLocationIds={frontStageAnchorIds}
          highlightLocationIds={frontHighlightIds}
          className="min-h-0 shrink-0"
          collapsible
          collapsed={isFrontViewCollapsed}
          onCollapsedChange={setIsFrontViewCollapsed}
          viewportResetKey={`${layout.id}:${isFrontViewCollapsed ? "collapsed" : "expanded"}:${frontStageAnchorIds.join(",")}:front`}
          rightRail={
            <PreviewInfoRail
              location={frontInfoLocations[0] ?? null}
              panelTitle="Widok frontowy"
              emptyLabel="Zaznacz lokalizację z widokiem frontowym."
            />
          }
        />
      </div>
    </div>
  );
}
