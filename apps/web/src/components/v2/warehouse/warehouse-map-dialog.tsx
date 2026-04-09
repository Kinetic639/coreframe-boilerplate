"use client";

/**
 * WarehouseMapDialog
 *
 * Reusable dialog that loads the published warehouse layout for the active
 * branch and renders it in the read-only viewer.
 *
 * When `locations` is supplied the dialog shows a left tree panel (same as
 * the editor preview) so users can browse and highlight individual locations.
 * An optional initial `highlightLocationId` pre-selects a location on open.
 */

import React from "react";
import dynamic from "next/dynamic";
import {
  Map,
  ExternalLink,
  Loader2,
  AlertCircle,
  Palette,
  ChevronDown,
  ChevronRight,
  MapPin,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useRouter } from "@/i18n/navigation";
import { usePublishedLayoutQuery } from "@/hooks/queries/warehouse";
import { useAppStoreV2 } from "@/lib/stores/v2/app-store";
import type { WarehouseLocation } from "@/lib/warehouse/location-tree";
import type { WarehouseLayoutWithShapes, WarehouseLayoutShape } from "@/lib/warehouse/layouts";

// ─── Viewer is Konva — must be loaded client-side only ───────────────────────

const WarehouseMapViewer = dynamic(
  () =>
    import("./warehouse-map-viewer").then((m) => ({
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

// ─── Location tree (same pattern as MapPreview) ───────────────────────────────

function TreeNode({
  location,
  allLocations,
  placedLocationIds,
  highlightedId,
  onSelect,
  depth,
}: {
  location: WarehouseLocation;
  allLocations: WarehouseLocation[];
  placedLocationIds: Set<string>;
  highlightedId: string | null;
  onSelect: (id: string) => void;
  depth: number;
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

        <div
          className="w-2.5 h-2.5 rounded-sm shrink-0 border border-black/10"
          style={{ backgroundColor: location.color ?? "#10b981" }}
        />

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

        {isPlaced && !isActive && (
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" title="On canvas" />
        )}
        {isActive && (
          <div
            className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 animate-pulse"
            title="Highlighted"
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
          />
        ))}
    </div>
  );
}

// ─── Tree panel ───────────────────────────────────────────────────────────────

function TreePanel({
  layout,
  locations,
  rootLocationId,
  highlightedId,
  onSelect,
}: {
  layout: WarehouseLayoutWithShapes;
  locations: WarehouseLocation[];
  rootLocationId: string | null | undefined;
  highlightedId: string | null;
  onSelect: (id: string) => void;
}) {
  // BFS descendants of root (or all if no root scoping)
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

  const placedLocationIds = React.useMemo(
    () => new Set(layout.shapes.filter((s) => s.location_id).map((s) => s.location_id!)),
    [layout.shapes]
  );

  return (
    <div className="w-56 border-r bg-background flex flex-col shrink-0 overflow-hidden">
      <div className="px-3 py-2.5 border-b bg-muted/50 shrink-0">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          Locations
        </p>
        <p className="text-[10px] text-muted-foreground mt-0.5">Click to highlight on map</p>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {treeRoots.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 px-3 text-center text-muted-foreground">
            <MapPin className="w-6 h-6 mb-2 opacity-20" />
            <p className="text-[10px]">No locations on this layout yet.</p>
          </div>
        ) : (
          treeRoots.map((loc) => (
            <TreeNode
              key={loc.id}
              location={loc}
              allLocations={descendants}
              placedLocationIds={placedLocationIds}
              highlightedId={highlightedId}
              onSelect={onSelect}
              depth={0}
            />
          ))
        )}
      </div>

      <div className="p-2.5 border-t bg-muted/30 shrink-0 space-y-1">
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Placed on canvas
        </div>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />
          Not yet placed
        </div>
      </div>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface WarehouseMapDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-select and highlight this location_id when the dialog opens. */
  highlightLocationId?: string | null;
  /**
   * Scope the search to a published layout whose root_location_id matches this.
   * Leave undefined to use any published layout for the branch.
   */
  rootLocationId?: string | null;
  /**
   * When provided, shows a left-side location tree panel so users can browse
   * and click through locations to highlight them on the map.
   */
  locations?: WarehouseLocation[];
  /** Dialog title — defaults to "Warehouse Map" */
  title?: string;
  /** Show an "Open in Editor" button linking to /dashboard/warehouse/map. */
  showEditorLink?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function WarehouseMapDialog({
  open,
  onOpenChange,
  highlightLocationId,
  rootLocationId,
  locations,
  title = "Warehouse Map",
  showEditorLink = false,
}: WarehouseMapDialogProps) {
  const router = useRouter();
  const activeBranchId = useAppStoreV2((s) => s.activeBranchId);

  // Internal highlight state — initialised from prop, then driven by tree/canvas clicks
  const [highlightedId, setHighlightedId] = React.useState<string | null>(
    highlightLocationId ?? null
  );
  const [isMonochrome, setIsMonochrome] = React.useState(true);

  // Sync if the prop changes (e.g. opening for a different location)
  React.useEffect(() => {
    setHighlightedId(highlightLocationId ?? null);
    setIsMonochrome(true);
  }, [highlightLocationId, open]);

  const {
    data: layout,
    isLoading,
    isError,
  } = usePublishedLayoutQuery(open ? activeBranchId : null, rootLocationId);

  const showTree = !!locations && !!layout;

  const handleShapeClick = (shape: WarehouseLayoutShape) => {
    if (shape.location_id) {
      setHighlightedId((prev) => (prev === shape.location_id ? null : shape.location_id));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex flex-col gap-0 p-0",
          showTree ? "h-[80vh] max-w-5xl" : "h-[80vh] max-w-4xl"
        )}
      >
        {/* Header */}
        <DialogHeader className="flex flex-row items-center justify-between border-b px-4 py-3 shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base font-medium">
            <Map className="h-4 w-4 text-emerald-600" />
            {title}
          </DialogTitle>
          {false && showEditorLink && layout && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => {
                router.push({
                  pathname: "/dashboard/warehouse/map/[layoutId]",
                  params: { layoutId: layout.id },
                });
                onOpenChange(false);
              }}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open editor
            </Button>
          )}
        </DialogHeader>

        {/* Body */}
        <div className="relative flex flex-1 overflow-hidden">
          {!activeBranchId && (
            <EmptyState icon="branch" message="Select a branch to view the warehouse map." />
          )}

          {activeBranchId && isLoading && (
            <div className="flex h-full w-full items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {activeBranchId && isError && (
            <EmptyState
              icon="error"
              message="Failed to load the warehouse map. Please try again."
            />
          )}

          {activeBranchId && !isLoading && !isError && !layout && (
            <EmptyState icon="map" message="No published layout for this branch yet." />
          )}

          {activeBranchId && layout && (
            <>
              {/* Left tree panel */}
              {showTree && (
                <TreePanel
                  layout={layout}
                  locations={locations!}
                  rootLocationId={rootLocationId}
                  highlightedId={highlightedId}
                  onSelect={(id) => setHighlightedId((prev) => (prev === id ? null : id))}
                />
              )}

              {/* Map area */}
              <div
                className="relative flex-1 overflow-hidden"
                onClick={() => setHighlightedId(null)}
              >
                {/* Vertical control bar — top-left overlay, shown only when something is highlighted */}
                {highlightedId && (
                  <div className="absolute left-3 top-3 z-10 flex flex-col gap-1 rounded-lg border bg-background/90 p-1 shadow-sm backdrop-blur-sm">
                    <button
                      type="button"
                      title={isMonochrome ? "Show colors" : "Monochromatic view"}
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

                {/* Canvas — stopPropagation so clicks inside don't clear highlight via the outer div */}
                <div className="h-full w-full" onClick={(e) => e.stopPropagation()}>
                  <WarehouseMapViewer
                    layout={layout}
                    locations={locations}
                    highlightLocationId={highlightedId}
                    autoPanToHighlight={false}
                    monochromaticHighlight={isMonochrome}
                    onShapeClick={showTree ? handleShapeClick : undefined}
                    className="h-full w-full"
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Empty state helper ───────────────────────────────────────────────────────

function EmptyState({ icon, message }: { icon: "branch" | "map" | "error"; message: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-muted-foreground">
      {icon === "error" ? (
        <AlertCircle className="h-8 w-8 text-destructive/60" />
      ) : (
        <Map className="h-8 w-8 opacity-40" />
      )}
      <p className="text-sm">{message}</p>
    </div>
  );
}
