"use client";

import React from "react";
import { useTranslations } from "next-intl";
import {
  Palette,
  Map as MapIcon,
  Info,
  MoveHorizontal,
  MoveVertical,
  ChevronDown,
  ChevronRight,
  ChevronsDown,
  ChevronsUp,
  MapPin,
  ArrowUpDown,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { resolveLocationMapContext, resolveLocationMapContexts } from "@/lib/warehouse/map-context";
import type { WarehouseLocation, WarehouseLocationGroup } from "@/lib/warehouse/location-tree";
import type { WarehouseLayoutShape, WarehouseLayoutWithShapes } from "@/lib/warehouse/layouts";
import { WarehouseMapViewer } from "@/components/v2/warehouse/warehouse-map-viewer";
import { WarehouseFrontElevationPanel } from "@/components/v2/warehouse/warehouse-front-elevation-panel";

function buildLocationMap(locations: WarehouseLocation[]) {
  return new Map(locations.map((location) => [location.id, location]));
}

function findNearestLogicalContainerAncestor(
  locationId: string,
  locationMap: Map<string, WarehouseLocation>
) {
  let current = locationMap.get(locationId) ?? null;

  while (current?.parent_id) {
    current = locationMap.get(current.parent_id) ?? null;
    if ((current?.map_role ?? "logical") === "logical") {
      return current;
    }
  }

  return null;
}

function getDescendantTopDownUnitIds(
  containerId: string,
  locations: WarehouseLocation[],
  locationMap: Map<string, WarehouseLocation>
) {
  const topDownIds: string[] = [];
  const queue = locations.filter((location) => location.parent_id === containerId);

  while (queue.length > 0) {
    const current = queue.shift()!;
    if ((current.map_role ?? "logical") === "top_down_unit") {
      topDownIds.push(current.id);
    }

    for (const child of locations) {
      if (child.parent_id === current.id) {
        queue.push(child);
      }
    }
  }

  return topDownIds.filter((topDownId) => {
    const nearestContainer = findNearestLogicalContainerAncestor(topDownId, locationMap);
    return nearestContainer?.id === containerId;
  });
}

function getAncestorIds(
  locationId: string,
  locationMap: Map<string, WarehouseLocation>,
  stopAtId?: string | null
) {
  const ancestorIds: string[] = [];
  let current = locationMap.get(locationId) ?? null;

  while (current?.parent_id) {
    if (current.parent_id === stopAtId) break;
    ancestorIds.push(current.parent_id);
    current = locationMap.get(current.parent_id) ?? null;
  }

  return ancestorIds;
}

function getDescendantLocationIds(locationId: string, locations: WarehouseLocation[]) {
  const descendantIds: string[] = [];
  const queue = locations.filter((location) => location.parent_id === locationId);

  while (queue.length > 0) {
    const current = queue.shift()!;
    descendantIds.push(current.id);
    queue.push(...locations.filter((location) => location.parent_id === current.id));
  }

  return descendantIds;
}

function formatMeters(value: number | null | undefined) {
  if (value === null || value === undefined) return null;
  return `${Number.isInteger(value) ? value : value.toFixed(2).replace(/\.?0+$/, "")} m`;
}

function getLocationMetrics(
  location: WarehouseLocation,
  locationMap: Map<string, WarehouseLocation>
) {
  const parent = location.parent_id ? (locationMap.get(location.parent_id) ?? null) : null;
  const width =
    location.physical_width_m ??
    ((location.map_role ?? "logical") === "front_segment" ||
    (location.map_role ?? "logical") === "top_storage_segment"
      ? (parent?.physical_width_m ?? null)
      : null);
  const depth =
    location.physical_depth_m ??
    ((location.map_role ?? "logical") === "front_segment" ||
    (location.map_role ?? "logical") === "top_storage_segment"
      ? (parent?.physical_depth_m ?? null)
      : null);
  const height = location.physical_height_m ?? null;

  return [
    width !== null
      ? { key: "width" as const, icon: MoveHorizontal, value: formatMeters(width) }
      : null,
    depth !== null
      ? { key: "depth" as const, icon: MoveVertical, value: formatMeters(depth) }
      : null,
    height !== null
      ? { key: "height" as const, icon: ArrowUpDown, value: formatMeters(height) }
      : null,
  ].filter(
    (
      entry
    ): entry is {
      key: "width" | "depth" | "height";
      icon: typeof MoveHorizontal;
      value: string | null;
    } => !!entry && !!entry.value
  );
}

function joinLocationCodes(locations: WarehouseLocation[]) {
  return locations.map((location) => location.code?.trim() || location.name).join(", ");
}

function summarizeLocationSelection(
  locations: WarehouseLocation[],
  locationMap: Map<string, WarehouseLocation>,
  t: ReturnType<typeof useTranslations<"warehouseMapDialog">>,
  multipleLabel: string
) {
  if (locations.length === 0) {
    return {
      mode: "empty" as const,
    };
  }

  if (locations.length === 1) {
    const location = locations[0];
    return {
      mode: "single" as const,
      title: location.name,
      code: location.code?.trim() || null,
      description: location.description?.trim() || null,
      metrics: getLocationMetrics(location, locationMap),
    };
  }

  const describedCount = locations.filter((location) => !!location.description?.trim()).length;

  return {
    mode: "multiple" as const,
    title: multipleLabel,
    code: joinLocationCodes(locations),
    description:
      describedCount === 0
        ? null
        : describedCount === 1
          ? t("info.multiple.oneDescription")
          : t("info.multiple.manyDescriptions", { count: describedCount }),
    metrics: [],
  };
}

function MapInfoDrawer({
  title,
  emptyLabel,
  summary,
  className,
}: {
  title: string;
  emptyLabel: string;
  summary:
    | { mode: "empty" }
    | {
        mode: "single" | "multiple";
        title: string;
        code: string | null;
        description: string | null;
        metrics: {
          key: "width" | "depth" | "height";
          icon: typeof MoveHorizontal;
          value: string | null;
        }[];
      };
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const t = useTranslations("warehouseMapDialog");

  return (
    <div
      className={cn("pointer-events-auto relative flex h-full shrink-0 items-stretch", className)}
      onClick={(event) => event.stopPropagation()}
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
              <TooltipContent>{title}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}

      <div
        className={cn(
          "flex h-full overflow-hidden border-l border-border/60 bg-background/75 backdrop-blur-sm transition-[width,opacity] duration-200 ease-out",
          open ? "w-72 opacity-100" : "w-0 opacity-0"
        )}
      >
        <div className="flex h-full min-w-0 flex-col">
          <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
            <div className="min-w-0">
              {summary.mode === "empty" ? (
                <p className="truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  {title}
                </p>
              ) : (
                <p className="truncate text-sm font-medium text-foreground">
                  {summary.title}
                  {summary.code ? (
                    <span className="ml-1 font-mono text-[11px] font-normal text-muted-foreground">
                      ({summary.code})
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
            {summary.mode === "empty" ? (
              <p className="text-xs leading-relaxed text-muted-foreground">{emptyLabel}</p>
            ) : (
              <>
                {summary.metrics.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      {t("info.dimensions")}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {summary.metrics.map((metric) => {
                        const Icon = metric.icon;
                        return (
                          <TooltipProvider key={metric.key} delayDuration={100}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-muted/40 px-2 py-1 text-xs text-foreground">
                                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                                  <span>{metric.value}</span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>{t(`info.metrics.${metric.key}`)}</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        );
                      })}
                    </div>
                  </div>
                )}

                {summary.description ? (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      {t("info.description")}
                    </p>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {summary.description}
                    </p>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TreeLocationRow({
  location,
  allLocations,
  locationGroups,
  selectableLocationIds,
  highlightedIds,
  onSelectIds,
  autoExpandedLocationIds,
  autoExpandedGroupIds,
  expandMode,
  depth,
  t,
}: {
  location: WarehouseLocation;
  allLocations: WarehouseLocation[];
  locationGroups: WarehouseLocationGroup[];
  selectableLocationIds: Set<string>;
  highlightedIds: string[];
  onSelectIds: (ids: string[]) => void;
  autoExpandedLocationIds: Set<string>;
  autoExpandedGroupIds: Set<string>;
  expandMode: "auto" | "all" | "collapsed";
  depth: number;
  t: ReturnType<typeof useTranslations<"warehouseMapDialog">>;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const childGroups = locationGroups.filter((group) => group.parent_location_id === location.id);
  const childLocations = allLocations.filter(
    (childLocation) => childLocation.parent_id === location.id && !childLocation.group_id
  );
  const hasChildren = childGroups.length > 0 || childLocations.length > 0;
  const isExpanded =
    hasChildren &&
    (expandMode === "all" ||
      (expandMode === "auto" && (expanded || autoExpandedLocationIds.has(location.id))));
  const isSelected = highlightedIds.includes(location.id);
  const isSelectable = selectableLocationIds.has(location.id);

  return (
    <>
      <button
        type="button"
        className={cn(
          "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors",
          isSelected ? "bg-primary/10 text-foreground" : "hover:bg-muted/50",
          isSelectable ? "cursor-pointer" : "cursor-not-allowed opacity-45"
        )}
        style={{ paddingLeft: `${12 + depth * 14}px` }}
        onClick={() => {
          if (!isSelectable) return;
          onSelectIds(
            highlightedIds.length === 1 && highlightedIds[0] === location.id ? [] : [location.id]
          );
        }}
      >
        <span className="flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground">
          {hasChildren ? (
            <button
              type="button"
              className="flex h-4 w-4 items-center justify-center"
              onClick={(event) => {
                event.stopPropagation();
                setExpanded((value) => !value);
              }}
              aria-label={isExpanded ? t("tree.collapse") : t("tree.expand")}
            >
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </button>
          ) : null}
        </span>
        <span
          className="h-3 w-3 shrink-0 rounded-full border border-border/70"
          style={{
            backgroundColor:
              location.color && location.color.trim().length > 0
                ? location.color
                : "var(--muted-foreground)",
          }}
        />
        <span className="min-w-0 flex-1 truncate">{location.name}</span>
        {location.code ? (
          <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
            {location.code}
          </span>
        ) : null}
      </button>

      {isExpanded && (
        <>
          {childGroups.map((group) => (
            <TreeGroupRow
              key={group.id}
              group={group}
              allLocations={allLocations}
              locationGroups={locationGroups}
              selectableLocationIds={selectableLocationIds}
              highlightedIds={highlightedIds}
              onSelectIds={onSelectIds}
              autoExpandedLocationIds={autoExpandedLocationIds}
              autoExpandedGroupIds={autoExpandedGroupIds}
              expandMode={expandMode}
              depth={depth + 1}
              t={t}
            />
          ))}
          {childLocations.map((childLocation) => (
            <TreeLocationRow
              key={childLocation.id}
              location={childLocation}
              allLocations={allLocations}
              locationGroups={locationGroups}
              selectableLocationIds={selectableLocationIds}
              highlightedIds={highlightedIds}
              onSelectIds={onSelectIds}
              autoExpandedLocationIds={autoExpandedLocationIds}
              autoExpandedGroupIds={autoExpandedGroupIds}
              expandMode={expandMode}
              depth={depth + 1}
              t={t}
            />
          ))}
        </>
      )}
    </>
  );
}

function TreeGroupRow({
  group,
  allLocations,
  locationGroups,
  selectableLocationIds,
  highlightedIds,
  onSelectIds,
  autoExpandedLocationIds,
  autoExpandedGroupIds,
  expandMode,
  depth,
  t,
}: {
  group: WarehouseLocationGroup;
  allLocations: WarehouseLocation[];
  locationGroups: WarehouseLocationGroup[];
  selectableLocationIds: Set<string>;
  highlightedIds: string[];
  onSelectIds: (ids: string[]) => void;
  autoExpandedLocationIds: Set<string>;
  autoExpandedGroupIds: Set<string>;
  expandMode: "auto" | "all" | "collapsed";
  depth: number;
  t: ReturnType<typeof useTranslations<"warehouseMapDialog">>;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const groupLocations = allLocations.filter((location) => location.group_id === group.id);
  const groupLocationIds = groupLocations
    .filter((location) => selectableLocationIds.has(location.id))
    .map((location) => location.id);
  const hasChildren = groupLocations.length > 0;
  const isExpanded =
    hasChildren &&
    (expandMode === "all" ||
      (expandMode === "auto" && (expanded || autoExpandedGroupIds.has(group.id))));
  const isSelected =
    groupLocationIds.length > 0 &&
    groupLocationIds.every((locationId) => highlightedIds.includes(locationId));
  const isSelectable = groupLocationIds.length > 0;

  return (
    <>
      <button
        type="button"
        className={cn(
          "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors",
          isSelected ? "bg-primary/10 text-foreground" : "hover:bg-muted/50",
          isSelectable ? "cursor-pointer" : "cursor-not-allowed opacity-45"
        )}
        style={{ paddingLeft: `${12 + depth * 14}px` }}
        onClick={() => {
          if (!isSelectable) return;
          onSelectIds(isSelected ? [] : groupLocationIds);
        }}
      >
        <span className="flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground">
          {hasChildren ? (
            <button
              type="button"
              className="flex h-4 w-4 items-center justify-center"
              onClick={(event) => {
                event.stopPropagation();
                setExpanded((value) => !value);
              }}
              aria-label={isExpanded ? t("tree.collapse") : t("tree.expand")}
            >
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </button>
          ) : null}
        </span>
        <span
          className="h-3 w-3 shrink-0 rounded-sm border border-border/70"
          style={{
            backgroundColor:
              group.color && group.color.trim().length > 0
                ? group.color
                : "var(--muted-foreground)",
          }}
        />
        <span className="min-w-0 flex-1 truncate">{group.name}</span>
      </button>

      {isExpanded &&
        groupLocations.map((location) => (
          <TreeLocationRow
            key={location.id}
            location={location}
            allLocations={allLocations}
            locationGroups={locationGroups}
            selectableLocationIds={selectableLocationIds}
            highlightedIds={highlightedIds}
            onSelectIds={onSelectIds}
            autoExpandedLocationIds={autoExpandedLocationIds}
            autoExpandedGroupIds={autoExpandedGroupIds}
            expandMode={expandMode}
            depth={depth + 1}
            t={t}
          />
        ))}
    </>
  );
}

function TreeItems({
  parentId,
  allLocations,
  locationGroups,
  selectableLocationIds,
  highlightedIds,
  onSelectIds,
  autoExpandedLocationIds,
  autoExpandedGroupIds,
  expandMode,
  depth,
  t,
}: {
  parentId: string | null | undefined;
  allLocations: WarehouseLocation[];
  locationGroups: WarehouseLocationGroup[];
  selectableLocationIds: Set<string>;
  highlightedIds: string[];
  onSelectIds: (ids: string[]) => void;
  autoExpandedLocationIds: Set<string>;
  autoExpandedGroupIds: Set<string>;
  expandMode: "auto" | "all" | "collapsed";
  depth: number;
  t: ReturnType<typeof useTranslations<"warehouseMapDialog">>;
}) {
  const parentGroups = locationGroups.filter((group) => group.parent_location_id === parentId);
  const parentLocations = allLocations.filter(
    (location) => location.parent_id === parentId && !location.group_id
  );

  return (
    <>
      {parentGroups.map((group) => (
        <TreeGroupRow
          key={group.id}
          group={group}
          allLocations={allLocations}
          locationGroups={locationGroups}
          selectableLocationIds={selectableLocationIds}
          highlightedIds={highlightedIds}
          onSelectIds={onSelectIds}
          autoExpandedLocationIds={autoExpandedLocationIds}
          autoExpandedGroupIds={autoExpandedGroupIds}
          expandMode={expandMode}
          depth={depth}
          t={t}
        />
      ))}
      {parentLocations.map((location) => (
        <TreeLocationRow
          key={location.id}
          location={location}
          allLocations={allLocations}
          locationGroups={locationGroups}
          selectableLocationIds={selectableLocationIds}
          highlightedIds={highlightedIds}
          onSelectIds={onSelectIds}
          autoExpandedLocationIds={autoExpandedLocationIds}
          autoExpandedGroupIds={autoExpandedGroupIds}
          expandMode={expandMode}
          depth={depth}
          t={t}
        />
      ))}
    </>
  );
}

function TreePanel({
  layout,
  locations,
  locationGroups,
  rootLocationId,
  highlightedIds,
  onSelectIds,
  t,
}: {
  layout: WarehouseLayoutWithShapes;
  locations: WarehouseLocation[];
  locationGroups: WarehouseLocationGroup[];
  rootLocationId: string | null | undefined;
  highlightedIds: string[];
  onSelectIds: (ids: string[]) => void;
  t: ReturnType<typeof useTranslations<"warehouseMapDialog">>;
}) {
  const descendants = React.useMemo(() => {
    if (!rootLocationId) return locations;
    const result: WarehouseLocation[] = [];
    const visited = new Set<string>();
    const queue = locations.filter((location) => location.parent_id === rootLocationId);
    while (queue.length > 0) {
      const location = queue.shift()!;
      if (visited.has(location.id)) continue;
      visited.add(location.id);
      result.push(location);
      locations
        .filter((child) => child.parent_id === location.id)
        .forEach((child) => queue.push(child));
    }
    return result;
  }, [locations, rootLocationId]);

  const [searchQuery, setSearchQuery] = React.useState("");
  const [expandMode, setExpandMode] = React.useState<"auto" | "all" | "collapsed">("collapsed");
  const locationMap = React.useMemo(() => buildLocationMap(descendants), [descendants]);
  const searchableGroups = React.useMemo(
    () =>
      locationGroups.filter((group) =>
        descendants.some((location) => location.parent_id === group.parent_location_id)
      ),
    [descendants, locationGroups]
  );
  const selectableLocationIds = React.useMemo(() => {
    const previewableIds = new Set(
      descendants
        .filter((location) => {
          const context = resolveLocationMapContext(
            location.id,
            locations,
            rootLocationId ?? layout.root_location_id
          );
          return !!context.topDownAnchorLocationId || !!context.frontAnchorLocationId;
        })
        .map((location) => location.id)
    );

    for (const location of descendants) {
      if ((location.map_role ?? "logical") !== "logical") continue;
      const descendantIds = getDescendantLocationIds(location.id, descendants);
      if (descendantIds.some((id) => previewableIds.has(id))) {
        previewableIds.add(location.id);
      }
    }

    return previewableIds;
  }, [descendants, layout.root_location_id, locations, rootLocationId]);

  const visibleLocationIds = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return new Set(descendants.map((location) => location.id));

    const visibleIds = new Set<string>();
    for (const location of descendants) {
      const haystack = `${location.name} ${location.code ?? ""}`.toLowerCase();
      if (haystack.includes(query)) {
        visibleIds.add(location.id);
        getAncestorIds(location.id, locationMap, rootLocationId ?? null).forEach((id) =>
          visibleIds.add(id)
        );
      }
    }

    for (const group of searchableGroups) {
      if (group.name.toLowerCase().includes(query)) {
        const members = descendants.filter((location) => location.group_id === group.id);
        members.forEach((member) => {
          visibleIds.add(member.id);
          getAncestorIds(member.id, locationMap, rootLocationId ?? null).forEach((id) =>
            visibleIds.add(id)
          );
        });
      }
    }

    return visibleIds;
  }, [descendants, locationMap, rootLocationId, searchQuery, searchableGroups]);

  const visibleGroups = React.useMemo(
    () =>
      searchableGroups.filter((group) => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return true;
        if (group.name.toLowerCase().includes(query)) return true;
        return descendants.some(
          (location) => location.group_id === group.id && visibleLocationIds.has(location.id)
        );
      }),
    [descendants, searchQuery, searchableGroups, visibleLocationIds]
  );

  const autoExpandedLocationIds = React.useMemo(() => {
    const ids = new Set<string>();
    const targetIds =
      searchQuery.trim().length > 0
        ? new Set([...highlightedIds, ...visibleLocationIds])
        : new Set(highlightedIds);
    for (const locationId of targetIds) {
      getAncestorIds(locationId, locationMap, rootLocationId ?? null).forEach((id) => ids.add(id));
    }
    return ids;
  }, [highlightedIds, locationMap, rootLocationId, searchQuery, visibleLocationIds]);

  const autoExpandedGroupIds = React.useMemo(() => {
    const ids = new Set<string>();
    const isSearching = searchQuery.trim().length > 0;
    for (const group of visibleGroups) {
      const memberIds = descendants
        .filter((location) => location.group_id === group.id)
        .map((location) => location.id);
      if (
        memberIds.some(
          (id) => highlightedIds.includes(id) || (isSearching && visibleLocationIds.has(id))
        )
      ) {
        ids.add(group.id);
      }
    }
    return ids;
  }, [descendants, highlightedIds, searchQuery, visibleGroups, visibleLocationIds]);

  const filteredDescendants = React.useMemo(
    () => descendants.filter((location) => visibleLocationIds.has(location.id)),
    [descendants, visibleLocationIds]
  );

  return (
    <div className="flex w-56 shrink-0 flex-col overflow-hidden border-r bg-background">
      <div className="shrink-0 border-b bg-muted/50 px-3 py-2.5">
        <div className="relative">
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={t("tree.searchPlaceholder")}
            className="h-8 pr-8 text-xs"
          />
          {searchQuery.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 h-6 w-6 -translate-y-1/2 text-muted-foreground"
              onClick={() => setSearchQuery("")}
              aria-label={t("tree.clearSearch")}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {filteredDescendants.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-3 py-8 text-center text-muted-foreground">
            <MapPin className="mb-2 h-6 w-6 opacity-20" />
            <p className="text-[10px]">
              {searchQuery.trim() ? t("tree.noResults") : t("tree.empty")}
            </p>
          </div>
        ) : (
          <TreeItems
            parentId={rootLocationId}
            allLocations={filteredDescendants}
            locationGroups={visibleGroups}
            selectableLocationIds={selectableLocationIds}
            highlightedIds={highlightedIds}
            onSelectIds={onSelectIds}
            autoExpandedLocationIds={autoExpandedLocationIds}
            autoExpandedGroupIds={autoExpandedGroupIds}
            expandMode={expandMode}
            depth={0}
            t={t}
          />
        )}
      </div>

      <div className="flex shrink-0 items-center justify-end gap-1 border-t bg-muted/30 px-2 py-1.5">
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => {
                  setExpandMode("collapsed");
                  onSelectIds([]);
                }}
              >
                <ChevronsUp className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("tree.collapseAll")}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => {
                  setExpandMode("all");
                  onSelectIds([]);
                }}
              >
                <ChevronsDown className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("tree.expandAll")}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}

interface PublicWarehouseMapsPageClientProps {
  branch: {
    id: string;
    name: string;
    slug: string | null;
  };
  layouts: WarehouseLayoutWithShapes[];
  locations: WarehouseLocation[];
  locationGroups: WarehouseLocationGroup[];
}

export function PublicWarehouseMapsPageClient({
  branch,
  layouts,
  locations,
  locationGroups,
}: PublicWarehouseMapsPageClientProps) {
  const t = useTranslations("publicWarehouseMapsPage");
  const dialogT = useTranslations("warehouseMapDialog");
  const [selectedLayoutId, setSelectedLayoutId] = React.useState(layouts[0]?.id ?? "");
  const [highlightedIds, setHighlightedIds] = React.useState<string[]>([]);
  const [isMonochrome, setIsMonochrome] = React.useState(true);

  const selectedLayout = React.useMemo(
    () => layouts.find((layout) => layout.id === selectedLayoutId) ?? layouts[0] ?? null,
    [layouts, selectedLayoutId]
  );
  const highlightedId = highlightedIds.length === 1 ? highlightedIds[0] : null;
  const mapContexts = React.useMemo(
    () =>
      selectedLayout
        ? resolveLocationMapContexts(highlightedIds, locations, selectedLayout.root_location_id)
        : [],
    [highlightedIds, locations, selectedLayout]
  );
  const topDownHighlightIds = React.useMemo(
    () =>
      [
        ...new Set(mapContexts.map((context) => context.topDownAnchorLocationId).filter(Boolean)),
      ] as string[],
    [mapContexts]
  );
  const locationMap = React.useMemo(() => buildLocationMap(locations), [locations]);
  const selectedTopDownFocusIds = React.useMemo(() => {
    return [
      ...new Set(
        highlightedIds
          .map((id) => {
            const location = locationMap.get(id);
            if (!location) return null;
            if ((location.map_role ?? "logical") === "top_down_unit") return location.id;
            if (["front_segment", "top_storage_segment"].includes(location.map_role ?? "logical")) {
              return location.parent_id ?? null;
            }
            return null;
          })
          .filter(Boolean)
      ),
    ] as string[];
  }, [highlightedIds, locationMap]);
  const frontStageAnchorIds = React.useMemo(() => {
    const expandedAnchorIds = selectedTopDownFocusIds.flatMap((topDownId) => {
      const topDownLocation = locationMap.get(topDownId);
      if (!topDownLocation?.group_id) return [topDownId];

      return locations
        .filter(
          (location) =>
            (location.map_role ?? "logical") === "top_down_unit" &&
            location.group_id === topDownLocation.group_id
        )
        .map((location) => location.id);
    });

    const containerExpandedAnchorIds = expandedAnchorIds.flatMap((topDownId) => {
      const nearestContainer = findNearestLogicalContainerAncestor(topDownId, locationMap);
      if (!nearestContainer) return [topDownId];

      const containerTopDownIds = getDescendantTopDownUnitIds(
        nearestContainer.id,
        locations,
        locationMap
      );
      return containerTopDownIds.length > 0 ? containerTopDownIds : [topDownId];
    });

    return [...new Set(containerExpandedAnchorIds)];
  }, [locationMap, locations, selectedTopDownFocusIds]);
  const frontHighlightIds = React.useMemo(() => {
    const explicitFrontSelections = highlightedIds.filter((id) =>
      ["front_segment", "top_storage_segment"].includes(locationMap.get(id)?.map_role ?? "logical")
    );

    if (explicitFrontSelections.length > 0) return [...new Set(explicitFrontSelections)];

    const highlightParentIds =
      highlightedIds.length === 1 ? selectedTopDownFocusIds : frontStageAnchorIds;

    return locations
      .filter(
        (location) =>
          highlightParentIds.includes(location.parent_id ?? "") &&
          ["front_segment", "top_storage_segment"].includes(location.map_role ?? "logical")
      )
      .map((location) => location.id);
  }, [frontStageAnchorIds, highlightedIds, locationMap, locations, selectedTopDownFocusIds]);
  const frontAnchorLocationId = React.useMemo(
    () => (frontStageAnchorIds.length === 1 ? frontStageAnchorIds[0] : null),
    [frontStageAnchorIds]
  );
  const topDownInfoLocations = React.useMemo(() => {
    if (highlightedIds.length === 0) return [];

    const explicitSelections = highlightedIds
      .map((id) => locationMap.get(id) ?? null)
      .filter((location): location is WarehouseLocation => !!location);

    const topDownSelections = explicitSelections.filter(
      (location) => (location.map_role ?? "logical") === "top_down_unit"
    );
    if (topDownSelections.length > 0) return topDownSelections;

    const frontSelections = explicitSelections.filter((location) =>
      ["front_segment", "top_storage_segment"].includes(location.map_role ?? "logical")
    );
    if (frontSelections.length > 0) {
      return selectedTopDownFocusIds
        .map((id) => locationMap.get(id) ?? null)
        .filter((location): location is WarehouseLocation => !!location);
    }

    return explicitSelections;
  }, [highlightedIds, locationMap, selectedTopDownFocusIds]);
  const frontInfoLocations = React.useMemo(() => {
    if (highlightedIds.length === 0) return [];

    const explicitSelections = highlightedIds
      .map((id) => locationMap.get(id) ?? null)
      .filter((location): location is WarehouseLocation => !!location);

    const explicitFrontSelections = explicitSelections.filter((location) =>
      ["front_segment", "top_storage_segment"].includes(location.map_role ?? "logical")
    );
    if (explicitFrontSelections.length > 0) return explicitFrontSelections;

    return locations.filter(
      (location) =>
        frontStageAnchorIds.includes(location.parent_id ?? "") &&
        ["front_segment", "top_storage_segment"].includes(location.map_role ?? "logical")
    );
  }, [frontStageAnchorIds, highlightedIds, locationMap, locations]);
  const topDownInfoSummary = React.useMemo(
    () =>
      summarizeLocationSelection(
        topDownInfoLocations,
        locationMap,
        dialogT,
        dialogT("info.multiple.topDownSelection", { count: topDownInfoLocations.length })
      ),
    [dialogT, locationMap, topDownInfoLocations]
  );
  const frontInfoSummary = React.useMemo(
    () =>
      summarizeLocationSelection(
        frontInfoLocations,
        locationMap,
        dialogT,
        dialogT("info.multiple.frontSelection", { count: frontInfoLocations.length })
      ),
    [dialogT, frontInfoLocations, locationMap]
  );

  React.useEffect(() => {
    setHighlightedIds([]);
    setIsMonochrome(true);
  }, [selectedLayoutId]);

  const handleShapeClick = React.useCallback((shape: WarehouseLayoutShape) => {
    if (!shape.location_id) return;
    setHighlightedIds((prev) =>
      prev.length === 1 && prev[0] === shape.location_id ? [] : [shape.location_id]
    );
  }, []);

  if (!selectedLayout) {
    return (
      <div className="flex w-full max-w-5xl flex-col items-center justify-center gap-3 rounded-2xl border border-dashed px-6 py-16 text-center">
        <MapIcon className="h-10 w-10 text-muted-foreground/40" />
        <div>
          <p className="text-lg font-semibold">{t("emptyTitle")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("emptyDescription")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-[1200px] flex-col gap-3">
      <div className="flex flex-col gap-2 rounded-2xl border bg-background/90 px-4 py-3 shadow-sm backdrop-blur-sm md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold tracking-tight">{branch.name}</h1>
        </div>

        <div className="flex items-center gap-2">
          <div className="w-64 max-w-full">
            <Select value={selectedLayout.id} onValueChange={setSelectedLayoutId}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder={t("layoutSelectPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {layouts.map((layout) => (
                  <SelectItem key={layout.id} value={layout.id}>
                    {layout.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant={!isMonochrome ? "default" : "outline"}
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={() => setIsMonochrome((value) => !value)}
                >
                  <Palette className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {!isMonochrome ? t("colorMode.showMonochrome") : t("colorMode.showColors")}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-background shadow-sm">
        <div className="relative flex h-[80vh] overflow-hidden">
          <TreePanel
            layout={selectedLayout}
            locations={locations}
            locationGroups={locationGroups}
            rootLocationId={selectedLayout.root_location_id}
            highlightedIds={highlightedIds}
            onSelectIds={(ids) =>
              setHighlightedIds((prev) =>
                prev.length === ids.length && ids.every((id) => prev.includes(id)) ? [] : ids
              )
            }
            t={dialogT}
          />

          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <div
              className="flex min-h-0 flex-1 overflow-hidden"
              onClick={() => setHighlightedIds([])}
            >
              <div className="relative min-w-0 flex-1 overflow-hidden">
                {highlightedIds.length > 0 && (
                  <div className="absolute left-3 top-3 z-10 flex flex-col gap-1 rounded-lg border bg-background/90 p-1 shadow-sm backdrop-blur-sm">
                    <button
                      type="button"
                      title={
                        isMonochrome
                          ? dialogT("actions.showColors")
                          : dialogT("actions.monochromaticView")
                      }
                      onClick={(event) => {
                        event.stopPropagation();
                        setIsMonochrome((value) => !value);
                      }}
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-muted",
                        !isMonochrome
                          ? "bg-primary text-primary-foreground hover:bg-primary/90"
                          : "text-muted-foreground"
                      )}
                    >
                      <Palette className="h-4 w-4" />
                    </button>
                  </div>
                )}

                <div className="h-full w-full" onClick={(event) => event.stopPropagation()}>
                  <WarehouseMapViewer
                    layout={selectedLayout}
                    locations={locations}
                    locationGroups={locationGroups}
                    highlightLocationId={highlightedId}
                    highlightLocationIds={
                      topDownHighlightIds.length > 0 ? topDownHighlightIds : highlightedIds
                    }
                    autoPanToHighlight={false}
                    monochromaticHighlight={isMonochrome}
                    onShapeClick={handleShapeClick}
                    className="h-full w-full"
                  />
                </div>
              </div>

              <MapInfoDrawer
                title={dialogT("info.topDownTitle")}
                emptyLabel={dialogT("info.emptyTopDown")}
                summary={topDownInfoSummary}
              />
            </div>

            <WarehouseFrontElevationPanel
              layout={selectedLayout}
              locations={locations}
              locationGroups={locationGroups}
              anchorLocationId={frontAnchorLocationId}
              anchorLocationIds={frontStageAnchorIds}
              highlightLocationIds={frontHighlightIds}
              headerActiveLocationIds={selectedTopDownFocusIds}
              monochromaticHighlight={isMonochrome}
              onShapeClick={handleShapeClick}
              className="h-64 shrink-0"
              rightRail={
                <MapInfoDrawer
                  title={dialogT("info.frontTitle")}
                  emptyLabel={dialogT("info.emptyFront")}
                  summary={frontInfoSummary}
                />
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}
