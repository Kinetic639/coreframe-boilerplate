"use client";

import { Package, MapPinOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  LocationV2,
  VisualizationType,
  LocationCategory,
} from "@/lib/types/warehouse/locations-v2";

const CATEGORY_VIZ: Partial<Record<LocationCategory, VisualizationType>> = {
  cabinet: "cabinet",
  rack: "rack",
  shelf_unit: "rack",
  zone: "zone",
  area: "zone",
  receiving: "zone",
  dispatch: "zone",
  bin: "bin",
  drawer: "drawer",
};

interface UnmappedLocationsPanelProps {
  locations: LocationV2[];
  isLoading?: boolean;
  onPlace: (location: LocationV2) => void;
  placingId?: string | null;
}

export function UnmappedLocationsPanel({
  locations,
  isLoading,
  onPlace,
  placingId,
}: UnmappedLocationsPanelProps) {
  if (isLoading) {
    return (
      <div className="p-3 space-y-2">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (locations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4 text-center">
        <MapPinOff className="h-6 w-6 mb-1.5 opacity-30" />
        <p className="text-sm">All locations are mapped</p>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className="p-2 space-y-1">
        {locations.map((loc) => (
          <div
            key={loc.id}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/60 group"
          >
            <Package className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm truncate font-medium">
                {loc.code && <span className="font-mono text-xs opacity-60 mr-1">{loc.code}</span>}
                {loc.name}
              </p>
              <p className="text-xs text-muted-foreground capitalize">
                {loc.location_category?.replace("_", " ")}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-xs px-2 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => onPlace(loc)}
              disabled={placingId === loc.id}
            >
              {placingId === loc.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Place"}
            </Button>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

/** Build a UpsertVisualNodeInput for placing an unmapped location on the canvas */
export function buildPlacementNode(location: LocationV2, layoutId: string, x: number, y: number) {
  const category = location.location_category as LocationCategory;
  const vizType: VisualizationType = CATEGORY_VIZ[category] ?? "rectangle";
  return {
    layout_id: layoutId,
    location_id: location.id,
    view_type: "top_down" as const,
    visualization_type: vizType,
    x_mm: x,
    y_mm: y,
    width_mm: location.width_mm ?? 1200,
    height_mm: location.depth_mm ?? 600,
  };
}
