"use client";

import React from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { ChevronDown, ChevronUp, Layers3, Loader2 } from "lucide-react";
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
  viewBackgroundLabel?: string;
  viewportResetKey?: string | number;
  collapsible?: boolean;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
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
  viewBackgroundLabel,
  viewportResetKey,
  collapsible = false,
  collapsed = false,
  onCollapsedChange,
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

  const locationById = React.useMemo(
    () => new Map(locations.map((location) => [location.id, location])),
    [locations]
  );
  const anchorLocations = React.useMemo(
    () =>
      effectiveAnchorLocationIds
        .map((id) => locationById.get(id) ?? null)
        .filter((location): location is WarehouseLocation => !!location),
    [effectiveAnchorLocationIds, locationById]
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
    <section
      className={`flex min-h-0 flex-col overflow-hidden border-t bg-background ${className}`}
    >
      {collapsible && (
        <div className="flex shrink-0 items-center justify-between border-b bg-muted/30 px-3 py-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {viewBackgroundLabel ?? t("title")}
          </span>
          <button
            type="button"
            className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            onClick={() => onCollapsedChange?.(!collapsed)}
            aria-label={collapsed ? t("actions.expand") : t("actions.collapse")}
            title={collapsed ? t("actions.expand") : t("actions.collapse")}
          >
            {collapsed ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      )}

      <div
        className={`flex min-h-0 flex-1 overflow-hidden transition-[opacity,transform] duration-300 ease-out ${
          collapsed ? "pointer-events-none -translate-y-2 opacity-0" : "translate-y-0 opacity-100"
        }`}
      >
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
              viewBackgroundLabel={viewBackgroundLabel ?? t("title")}
              locations={locations}
              locationGroups={locationGroups}
              highlightLocationIds={highlightLocationIds}
              headerActiveLocationIds={headerActiveLocationIds}
              monochromaticHighlight={monochromaticHighlight}
              viewportResetKey={viewportResetKey}
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
