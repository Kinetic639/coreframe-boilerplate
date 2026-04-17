"use client";

import React from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { Layers3, Loader2 } from "lucide-react";
import type { WarehouseLayoutShape, WarehouseLayoutWithShapes } from "@/lib/warehouse/layouts";
import type { WarehouseLocation, WarehouseLocationGroup } from "@/lib/warehouse/location-tree";
import {
  buildCombinedFrontElevationLayout,
  buildFrontElevationLayout,
} from "@/lib/warehouse/front-elevation";

const WarehouseMapViewer = dynamic(
  () =>
    import("./warehouse-map-viewer").then((module) => ({
      default: module.WarehouseMapViewer,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    ),
  }
);

interface WarehouseFrontElevationPanelProps {
  layout: WarehouseLayoutWithShapes;
  locations: WarehouseLocation[];
  locationGroups: WarehouseLocationGroup[];
  anchorLocationId: string | null;
  anchorLocationIds?: string[] | null;
  highlightLocationIds?: string[];
  headerActiveLocationIds?: string[];
  monochromaticHighlight?: boolean;
  className?: string;
  onShapeClick?: (shape: WarehouseLayoutShape) => void;
  rightRail?: React.ReactNode;
}

export function WarehouseFrontElevationPanel({
  layout,
  locations,
  locationGroups,
  anchorLocationId,
  anchorLocationIds,
  highlightLocationIds,
  headerActiveLocationIds,
  monochromaticHighlight = false,
  className = "",
  onShapeClick,
  rightRail,
}: WarehouseFrontElevationPanelProps) {
  const t = useTranslations("warehouseFrontElevation");
  const effectiveAnchorLocationIds = React.useMemo(
    () =>
      anchorLocationIds && anchorLocationIds.length > 0
        ? [...new Set(anchorLocationIds.filter(Boolean))]
        : anchorLocationId
          ? [anchorLocationId]
          : [],
    [anchorLocationId, anchorLocationIds]
  );

  const anchorLocation = React.useMemo(
    () => locations.find((location) => location.id === anchorLocationId) ?? null,
    [anchorLocationId, locations]
  );
  const anchorLocations = React.useMemo(
    () =>
      effectiveAnchorLocationIds
        .map((id) => locations.find((location) => location.id === id) ?? null)
        .filter((location): location is WarehouseLocation => !!location),
    [effectiveAnchorLocationIds, locations]
  );

  const frontLayout = React.useMemo(() => {
    if (effectiveAnchorLocationIds.length === 0) return null;

    if (effectiveAnchorLocationIds.length === 1) {
      return buildFrontElevationLayout({
        layout,
        locations,
        locationGroups,
        anchorLocationId: effectiveAnchorLocationIds[0],
      });
    }

    return buildCombinedFrontElevationLayout({
      layout,
      locations,
      locationGroups,
      anchorLocationIds: effectiveAnchorLocationIds,
    });
  }, [effectiveAnchorLocationIds, layout, locations, locationGroups]);

  return (
    <section className={`flex min-h-0 flex-col border-t bg-background ${className}`}>
      <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {t("title")}
        </p>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="min-w-0 flex-1 overflow-hidden">
          {effectiveAnchorLocationIds.length === 0 || anchorLocations.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center text-muted-foreground">
              <Layers3 className="mb-2 h-7 w-7 opacity-30" />
              <p className="text-sm font-medium">{t("emptyTitle")}</p>
              <p className="mt-1 max-w-sm text-xs">{t("emptyDescription")}</p>
            </div>
          ) : !frontLayout ? (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center text-muted-foreground">
              <Layers3 className="mb-2 h-7 w-7 opacity-30" />
              <p className="text-sm font-medium">{t("noFrontViewTitle")}</p>
              <p className="mt-1 max-w-sm text-xs">{t("noFrontViewDescription")}</p>
            </div>
          ) : (
            <WarehouseMapViewer
              layout={frontLayout}
              projection="front_elevation"
              locations={locations}
              locationGroups={locationGroups}
              highlightLocationIds={highlightLocationIds}
              headerActiveLocationIds={headerActiveLocationIds}
              monochromaticHighlight={monochromaticHighlight}
              autoPanToHighlight={false}
              onShapeClick={onShapeClick}
              className="h-full w-full"
            />
          )}
        </div>

        {rightRail}
      </div>
    </section>
  );
}
