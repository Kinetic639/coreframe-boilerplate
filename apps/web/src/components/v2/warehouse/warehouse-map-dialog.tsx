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
import { useTranslations } from "next-intl";
import {
  Map as MapIcon,
  ExternalLink,
  Loader2,
  AlertCircle,
  Palette,
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
  Maximize2,
  Minimize2,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useRouter } from "@/i18n/navigation";
import { usePublishedLayoutQuery } from "@/hooks/queries/warehouse";
import { useAppStoreV2 } from "@/lib/stores/v2/app-store";
import { resolveLocationMapContext } from "@/lib/warehouse/map-context";
import {
  getEffectiveLocationColor,
  type WarehouseLocation,
  type WarehouseLocationGroup,
} from "@/lib/warehouse/location-tree";
import type { WarehouseLayoutWithShapes, WarehouseLayoutShape } from "@/lib/warehouse/layouts";
import { WarehouseFrontElevationPanel } from "./warehouse-front-elevation-panel";

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

function buildLocationCodePath(
  locationId: string,
  locationMap: Map<string, WarehouseLocation>,
  stopAtId?: string | null
) {
  const path: string[] = [];
  let current = locationMap.get(locationId) ?? null;

  while (current) {
    path.unshift(current.code?.trim() || current.name);
    if (!current.parent_id || current.id === stopAtId) break;
    current = locationMap.get(current.parent_id) ?? null;
  }

  return path.join("/");
}

function formatMeters(value: number | null | undefined) {
  if (value === null || value === undefined) return null;
  return `${Number.isInteger(value) ? value : value.toFixed(2).replace(/\.?0+$/, "")} m`;
}

function getLocationRoleLabel(
  location: WarehouseLocation,
  t: ReturnType<typeof useTranslations<"warehouseMapDialog">>
) {
  switch (location.map_role ?? "logical") {
    case "layout_root":
      return t("info.roles.layoutRoot");
    case "top_down_unit":
      return t("info.roles.topDownUnit");
    case "front_segment":
      return t("info.roles.frontSegment");
    case "top_storage_segment":
      return t("info.roles.topStorageSegment");
    default:
      return t("info.roles.logical");
  }
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

  const metrics = [
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

  return metrics;
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
        <div className="flex h-full min-w-0 w-full flex-col">
          <div className="flex w-full items-center justify-between border-b border-border/60 px-3 py-2">
            <div className="min-w-0 flex-1">
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
                {summary.description && (
                  <div className="space-y-1">
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {summary.description}
                    </p>
                  </div>
                )}

                {summary.metrics.length > 0 && (
                  <div className="space-y-2 pt-1">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      {t("info.fields.dimensions")}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {summary.metrics.map((metric) => (
                        <TooltipProvider key={metric.key} delayDuration={100}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-2.5 py-1.5">
                                <metric.icon className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-xs font-medium text-foreground">
                                  {metric.value}
                                </span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              {metric.key === "width"
                                ? t("info.fields.width")
                                : metric.key === "depth"
                                  ? t("info.fields.depth")
                                  : t("info.fields.height")}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ))}
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

// ─── Location tree (same pattern as MapPreview) ───────────────────────────────

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
  t: ReturnType<typeof useTranslations>;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const children = allLocations.filter((entry) => entry.parent_id === location.id);
  const myGroups = locationGroups.filter((group) => group.parent_location_id === location.id);
  const hasChildren = children.length > 0 || myGroups.length > 0;
  const isSelectable = selectableLocationIds.has(location.id);
  const effectiveExpanded =
    hasChildren &&
    (expandMode === "all" ||
      (expandMode === "auto" && (expanded || autoExpandedLocationIds.has(location.id))));
  const isActive = highlightedIds.includes(location.id);

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-1.5 py-1.5 pr-2 rounded-md mx-1 transition-colors",
          isSelectable && "cursor-pointer",
          isActive && "bg-primary/10",
          !isActive && isSelectable && "hover:bg-accent",
          !isActive && !isSelectable && "opacity-45 cursor-default"
        )}
        style={{ paddingLeft: 8 + depth * 16 }}
        onClick={() => {
          if (isSelectable) {
            onSelectIds(
              highlightedIds.length === 1 && highlightedIds[0] === location.id ? [] : [location.id]
            );
          }
        }}
      >
        <button
          type="button"
          className={cn(
            "shrink-0 w-4 h-4 flex items-center justify-center text-muted-foreground hover:text-foreground",
            !hasChildren && "invisible pointer-events-none"
          )}
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) setExpanded((v) => !v);
          }}
        >
          {effectiveExpanded ? (
            <ChevronDown className="w-3 h-3" />
          ) : (
            <ChevronRight className="w-3 h-3" />
          )}
        </button>

        <div
          className="w-2.5 h-2.5 rounded-sm shrink-0 border border-black/10"
          style={{
            backgroundColor:
              getEffectiveLocationColor(location, locationGroups, allLocations) ?? "#10b981",
          }}
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
      </div>

      {effectiveExpanded && (
        <TreeItems
          parentId={location.id}
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
      )}
    </div>
  );
}

function TreeGroupRow({
  group,
  members,
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
  members: WarehouseLocation[];
  allLocations: WarehouseLocation[];
  locationGroups: WarehouseLocationGroup[];
  selectableLocationIds: Set<string>;
  highlightedIds: string[];
  onSelectIds: (ids: string[]) => void;
  autoExpandedLocationIds: Set<string>;
  autoExpandedGroupIds: Set<string>;
  expandMode: "auto" | "all" | "collapsed";
  depth: number;
  t: ReturnType<typeof useTranslations>;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const memberIds = React.useMemo(() => members.map((member) => member.id), [members]);
  const isActive = memberIds.length > 0 && memberIds.every((id) => highlightedIds.includes(id));
  const hasSelectableMembers = members.some((member) => selectableLocationIds.has(member.id));
  const effectiveExpanded =
    expandMode === "all" ||
    (expandMode === "auto" && (expanded || autoExpandedGroupIds.has(group.id)));

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-1.5 py-1.5 pr-2 rounded-md mx-1 transition-colors",
          hasSelectableMembers && "cursor-pointer",
          isActive && "bg-primary/10",
          !isActive && hasSelectableMembers && "hover:bg-accent",
          !isActive && !hasSelectableMembers && "opacity-45 cursor-default"
        )}
        style={{ paddingLeft: 8 + depth * 16 }}
        onClick={() => {
          if (hasSelectableMembers) {
            onSelectIds(memberIds.filter((id) => selectableLocationIds.has(id)));
          }
        }}
      >
        <button
          type="button"
          className="shrink-0 w-4 h-4 flex items-center justify-center text-muted-foreground hover:text-foreground"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
        >
          {effectiveExpanded ? (
            <ChevronDown className="w-3 h-3" />
          ) : (
            <ChevronRight className="w-3 h-3" />
          )}
        </button>

        <div className="flex h-4 w-4 shrink-0 items-center justify-center">
          <div
            className="w-2.5 h-2.5 rounded-sm border border-black/10"
            style={{ backgroundColor: group.color ?? "#94a3b8" }}
          />
        </div>

        <span
          className={cn(
            "text-xs truncate flex-1 min-w-0 uppercase tracking-wide text-muted-foreground",
            isActive && "font-semibold text-primary"
          )}
        >
          {group.name}
        </span>
        <span className="text-[10px] text-muted-foreground shrink-0">{members.length}</span>
      </div>

      {effectiveExpanded &&
        members.map((member) => (
          <TreeLocationRow
            key={member.id}
            location={member}
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
    </div>
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
  t: ReturnType<typeof useTranslations>;
}) {
  const myGroups = locationGroups
    .filter((group) => group.parent_location_id === (parentId ?? null))
    .sort(
      (left, right) => left.sort_order - right.sort_order || left.name.localeCompare(right.name)
    );
  const knownGroupIds = new Set(myGroups.map((group) => group.id));
  const children = allLocations
    .filter((location) => location.parent_id === (parentId ?? null))
    .sort(
      (left, right) => left.sort_order - right.sort_order || left.name.localeCompare(right.name)
    );
  const groupedChildIds = new Set(
    children
      .filter((location) => location.group_id && knownGroupIds.has(location.group_id))
      .map((location) => location.id)
  );
  const ungroupedChildren = children.filter((location) => !groupedChildIds.has(location.id));
  const items = [
    ...myGroups.map((group) => ({
      kind: "group" as const,
      group,
      sortOrder: group.sort_order,
      isSelectable: children.some(
        (location) => location.group_id === group.id && selectableLocationIds.has(location.id)
      ),
    })),
    ...ungroupedChildren.map((location) => ({
      kind: "location" as const,
      location,
      sortOrder: location.sort_order,
      isSelectable: selectableLocationIds.has(location.id),
    })),
  ].sort((left, right) => {
    if (left.isSelectable !== right.isSelectable) {
      return left.isSelectable ? -1 : 1;
    }
    return left.sortOrder - right.sortOrder;
  });

  return (
    <>
      {items.map((item) =>
        item.kind === "group" ? (
          <TreeGroupRow
            key={item.group.id}
            group={item.group}
            members={children.filter((location) => location.group_id === item.group.id)}
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
        ) : (
          <TreeLocationRow
            key={item.location.id}
            location={item.location}
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
        )
      )}
    </>
  );
}

// ─── Tree panel ───────────────────────────────────────────────────────────────

function TreePanel({
  layout,
  locations,
  locationGroups,
  rootLocationId,
  highlightedIds,
  onSelectIds,
  onToggleVisibility,
  t,
}: {
  layout: WarehouseLayoutWithShapes;
  locations: WarehouseLocation[];
  locationGroups: WarehouseLocationGroup[];
  rootLocationId: string | null | undefined;
  highlightedIds: string[];
  onSelectIds: (ids: string[]) => void;
  onToggleVisibility?: () => void;
  t: ReturnType<typeof useTranslations>;
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

  const [searchQuery, setSearchQuery] = React.useState("");
  const [expandMode, setExpandMode] = React.useState<"auto" | "all" | "collapsed">("auto");
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
    <div className="w-56 border-r bg-background flex flex-col shrink-0 overflow-hidden">
      <div className="px-3 py-2.5 border-b bg-muted/50 shrink-0">
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
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
                title={t("tree.clearSearch")}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
          {onToggleVisibility && (
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shrink-0 rounded-lg"
                    onClick={onToggleVisibility}
                  >
                    <PanelLeftClose className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t("actions.hideTree")}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {filteredDescendants.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 px-3 text-center text-muted-foreground">
            <MapPin className="w-6 h-6 mb-2 opacity-20" />
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

      <div className="flex items-center justify-end gap-1 border-t bg-muted/30 px-2 py-1.5 shrink-0">
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

// ─── Props ────────────────────────────────────────────────────────────────────

export interface WarehouseMapDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-select and highlight this location_id when the dialog opens. */
  highlightLocationId?: string | null;
  /** Optional multi-highlight mode, used for group previews. */
  highlightLocationIds?: string[] | null;
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
  locationGroups?: WarehouseLocationGroup[];
  showTree?: boolean;
  /** Optional dialog title override. */
  title?: string;
  /** Show an "Open in Editor" button linking to /dashboard/warehouse/map. */
  showEditorLink?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function WarehouseMapDialog({
  open,
  onOpenChange,
  highlightLocationId,
  highlightLocationIds,
  rootLocationId,
  locations,
  locationGroups,
  showTree,
  title,
  showEditorLink = false,
}: WarehouseMapDialogProps) {
  const t = useTranslations("warehouseMapDialog");
  const router = useRouter();
  const activeBranchId = useAppStoreV2((s) => s.activeBranchId);

  // Internal highlight state — initialised from prop, then driven by tree/canvas clicks
  const [highlightedIds, setHighlightedIds] = React.useState<string[]>(
    highlightLocationIds && highlightLocationIds.length > 0
      ? [...new Set(highlightLocationIds)]
      : highlightLocationId
        ? [highlightLocationId]
        : []
  );
  const [isMonochrome, setIsMonochrome] = React.useState(true);
  const [didCopyPath, setDidCopyPath] = React.useState(false);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [isFrontViewCollapsed, setIsFrontViewCollapsed] = React.useState(false);
  const [isTreeVisible, setIsTreeVisible] = React.useState(true);
  const highlightedId = highlightedIds.length === 1 ? highlightedIds[0] : null;

  // Sync if the prop changes (e.g. opening for a different location)
  React.useEffect(() => {
    setHighlightedIds(
      highlightLocationIds && highlightLocationIds.length > 0
        ? [...new Set(highlightLocationIds)]
        : highlightLocationId
          ? [highlightLocationId]
          : []
    );
    setIsMonochrome(true);
    setIsFrontViewCollapsed(false);
    setIsTreeVisible(true);
  }, [highlightLocationId, highlightLocationIds, open]);

  const {
    data: layout,
    isLoading,
    isError,
  } = usePublishedLayoutQuery(open ? activeBranchId : null, rootLocationId);

  const hasTreeAvailable = (showTree ?? !!locations) && !!layout;
  const resolvedRootLocationName = React.useMemo(() => {
    if (!locations || !layout?.root_location_id) return null;
    return locations.find((location) => location.id === layout.root_location_id)?.name ?? null;
  }, [layout?.root_location_id, locations]);
  const highlightedLocationBreadcrumbs = React.useMemo(() => {
    if (!locations || !layout?.root_location_id || !highlightedId) return [];

    const locationMap = buildLocationMap(locations);
    const breadcrumbs: string[] = [];
    let current = locationMap.get(highlightedId) ?? null;

    while (current) {
      if (current.id === layout.root_location_id) break;
      breadcrumbs.unshift(current.name);
      current = current.parent_id ? (locationMap.get(current.parent_id) ?? null) : null;
    }

    return breadcrumbs;
  }, [highlightedId, layout?.root_location_id, locations]);
  const highlightedLocationCodePath = React.useMemo(() => {
    if (!locations || !layout?.root_location_id || !highlightedId) return null;
    return buildLocationCodePath(
      highlightedId,
      buildLocationMap(locations),
      layout.root_location_id
    );
  }, [highlightedId, layout?.root_location_id, locations]);
  React.useEffect(() => {
    setDidCopyPath(false);
  }, [highlightedLocationCodePath]);
  React.useEffect(() => {
    if (!open) {
      setIsFullscreen(false);
      setIsFrontViewCollapsed(false);
      setIsTreeVisible(true);
    }
  }, [open]);
  const selectedTopDownFocusIds = React.useMemo(() => {
    if (!locations) return [];

    const locationMap = buildLocationMap(locations);
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
            if ((location.map_role ?? "logical") === "logical") {
              const containerTopDownIds = getDescendantTopDownUnitIds(id, locations, locationMap);
              return containerTopDownIds;
            }
            return null;
          })
          .flat()
          .filter(Boolean)
      ),
    ] as string[];
  }, [highlightedIds, locations]);
  const frontStageAnchorIds = React.useMemo(() => {
    if (!locations) return [];

    const locationMap = buildLocationMap(locations);
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
  }, [locations, selectedTopDownFocusIds]);
  const frontHighlightIds = React.useMemo(() => {
    if (!locations) return [];
    const locationMap = buildLocationMap(locations);
    const explicitFrontSelections = highlightedIds.filter((id) =>
      ["front_segment", "top_storage_segment"].includes(locationMap.get(id)?.map_role ?? "logical")
    );

    if (explicitFrontSelections.length > 0) {
      return [...new Set(explicitFrontSelections)];
    }

    const highlightParentIds =
      highlightedIds.length === 1 ? selectedTopDownFocusIds : frontStageAnchorIds;

    return locations
      .filter(
        (location) =>
          highlightParentIds.includes(location.parent_id ?? "") &&
          ["front_segment", "top_storage_segment"].includes(location.map_role ?? "logical")
      )
      .map((location) => location.id);
  }, [frontStageAnchorIds, highlightedIds, locations, selectedTopDownFocusIds]);
  const frontAnchorLocationId = React.useMemo(
    () => (frontStageAnchorIds.length === 1 ? frontStageAnchorIds[0] : null),
    [frontStageAnchorIds]
  );
  const locationMap = React.useMemo(
    () => (locations ? buildLocationMap(locations) : new Map<string, WarehouseLocation>()),
    [locations]
  );
  const topDownInfoLocations = React.useMemo(() => {
    if (!locations || highlightedIds.length === 0) return [];

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
  }, [highlightedIds, locationMap, locations, selectedTopDownFocusIds]);
  const frontInfoLocations = React.useMemo(() => {
    if (!locations || highlightedIds.length === 0) return [];

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
        t,
        t("info.multiple.topDownSelection", { count: topDownInfoLocations.length })
      ),
    [locationMap, t, topDownInfoLocations]
  );
  const frontInfoSummary = React.useMemo(
    () =>
      summarizeLocationSelection(
        frontInfoLocations,
        locationMap,
        t,
        t("info.multiple.frontSelection", { count: frontInfoLocations.length })
      ),
    [frontInfoLocations, locationMap, t]
  );

  const handleShapeClick = (shape: WarehouseLayoutShape) => {
    if (shape.location_id) {
      setHighlightedIds((prev) =>
        prev.length === 1 && prev[0] === shape.location_id ? [] : [shape.location_id]
      );
    }
  };

  const handleCopyHighlightedLocationPath = React.useCallback(async () => {
    if (!highlightedLocationCodePath) return;
    try {
      await navigator.clipboard.writeText(highlightedLocationCodePath);
      setDidCopyPath(true);
      window.setTimeout(() => setDidCopyPath(false), 1600);
    } catch {
      setDidCopyPath(false);
    }
  }, [highlightedLocationCodePath]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideClose
        className={cn(
          "flex flex-col gap-0 p-0",
          isFullscreen
            ? "h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] max-w-none"
            : hasTreeAvailable
              ? "h-[80vh] max-w-5xl"
              : "h-[80vh] max-w-4xl"
        )}
      >
        {/* Header */}
        <DialogHeader className="shrink-0 border-b px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <DialogTitle className="flex min-w-0 items-center gap-2 text-base font-medium">
                <MapIcon className="h-4 w-4 text-emerald-600" />
                <span className="truncate">
                  {title ?? resolvedRootLocationName ?? layout?.name ?? t("title")}
                </span>
                {highlightedLocationBreadcrumbs.length > 0 && (
                  <span className="min-w-0 truncate text-sm font-normal text-muted-foreground">
                    {" / "}
                    {highlightedLocationBreadcrumbs.join(" / ")}
                  </span>
                )}
                {highlightedLocationCodePath && (
                  <TooltipProvider delayDuration={100}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={handleCopyHighlightedLocationPath}
                          className="min-w-0 max-w-56 shrink cursor-pointer text-sm font-normal text-muted-foreground transition-colors hover:text-foreground"
                        >
                          <span className="relative block overflow-hidden whitespace-nowrap">
                            <span
                              className={cn(
                                "block truncate transition-all duration-200",
                                didCopyPath
                                  ? "translate-y-[-120%] opacity-0"
                                  : "translate-y-0 opacity-100"
                              )}
                            >
                              ({highlightedLocationCodePath})
                            </span>
                            <span
                              className={cn(
                                "absolute inset-0 truncate text-emerald-600 transition-all duration-200",
                                didCopyPath
                                  ? "translate-y-0 opacity-100"
                                  : "translate-y-[120%] opacity-0"
                              )}
                            >
                              {t("actions.copied")}
                            </span>
                          </span>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>{t("actions.copy")}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </DialogTitle>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      onClick={() => setIsFullscreen((value) => !value)}
                    >
                      {isFullscreen ? (
                        <Minimize2 className="h-4 w-4" />
                      ) : (
                        <Maximize2 className="h-4 w-4" />
                      )}
                      <span className="sr-only">
                        {isFullscreen ? t("actions.exitFullscreen") : t("actions.enterFullscreen")}
                      </span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isFullscreen ? t("actions.exitFullscreen") : t("actions.enterFullscreen")}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <DialogClose className="inline-flex h-8 w-8 items-center justify-center rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
                <X className="h-5 w-5" />
                <span className="sr-only">Close</span>
              </DialogClose>
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
                  {t("actions.openEditor")}
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Body */}
        <div className="relative flex flex-1 overflow-hidden">
          {!activeBranchId && <EmptyState icon="branch" message={t("states.noBranch")} />}

          {activeBranchId && isLoading && (
            <div className="flex h-full w-full items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {activeBranchId && isError && <EmptyState icon="error" message={t("states.loadError")} />}

          {activeBranchId && !isLoading && !isError && !layout && (
            <EmptyState icon="map" message={t("states.noPublishedLayout")} />
          )}

          {activeBranchId && layout && (
            <>
              {hasTreeAvailable && (
                <div
                  className={cn(
                    "shrink-0 overflow-hidden transition-[width,opacity] duration-300 ease-out",
                    isTreeVisible ? "w-56 opacity-100" : "w-0 opacity-0"
                  )}
                >
                  <div className="w-56">
                    <TreePanel
                      layout={layout}
                      locations={locations ?? []}
                      locationGroups={locationGroups ?? []}
                      rootLocationId={rootLocationId}
                      highlightedIds={highlightedIds}
                      onSelectIds={(ids) =>
                        setHighlightedIds((prev) =>
                          prev.length === ids.length && ids.every((id) => prev.includes(id))
                            ? []
                            : ids
                        )
                      }
                      onToggleVisibility={() => setIsTreeVisible(false)}
                      t={t}
                    />
                  </div>
                </div>
              )}

              {/* Map area */}
              <div
                className="grid min-w-0 flex-1 overflow-hidden transition-[grid-template-rows] duration-300 ease-in-out"
                style={{
                  gridTemplateRows: locations
                    ? isFrontViewCollapsed
                      ? "minmax(0,1fr) 2.25rem"
                      : "minmax(0,1fr) clamp(16rem,38%,24rem)"
                    : "minmax(0,1fr)",
                }}
              >
                <div
                  className="flex min-h-0 flex-1 overflow-hidden"
                  onClick={() => setHighlightedIds([])}
                >
                  {/* Vertical control bar — top-left overlay, shown only when something is highlighted */}
                  <div className="relative min-w-0 flex-1 overflow-hidden">
                    {hasTreeAvailable && !isTreeVisible && (
                      <div className="pointer-events-auto absolute left-3 top-3 z-30 animate-in fade-in-0 slide-in-from-left-2 duration-200">
                        <TooltipProvider delayDuration={100}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 rounded-lg border-border/70 bg-background/90 shadow-sm backdrop-blur-sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setIsTreeVisible(true);
                                }}
                              >
                                <PanelLeftOpen className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{t("actions.showTree")}</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    )}
                    {highlightedIds.length > 0 && (
                      <div
                        className={cn(
                          "pointer-events-auto absolute top-3 z-30 flex flex-col gap-1 rounded-lg border bg-background/90 p-1 shadow-sm backdrop-blur-sm transition-[left] duration-300 ease-out",
                          hasTreeAvailable && !isTreeVisible ? "left-14" : "left-3"
                        )}
                      >
                        <button
                          type="button"
                          title={
                            isMonochrome ? t("actions.showColors") : t("actions.monochromaticView")
                          }
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsMonochrome((v) => !v);
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

                    {/* Canvas — stopPropagation so clicks inside don't clear highlight via the outer div */}
                    <div className="h-full w-full" onClick={(e) => e.stopPropagation()}>
                      <WarehouseMapViewer
                        layout={layout}
                        viewBackgroundLabel={t("backgroundLabels.topDown")}
                        locations={locations}
                        locationGroups={locationGroups}
                        highlightLocationId={highlightedId}
                        highlightLocationIds={
                          selectedTopDownFocusIds.length > 0
                            ? selectedTopDownFocusIds
                            : highlightedIds
                        }
                        autoPanToHighlight={false}
                        monochromaticHighlight={isMonochrome}
                        viewportResetKey={`${layout.id}:${isFrontViewCollapsed ? "collapsed" : "expanded"}:top`}
                        onShapeClick={hasTreeAvailable ? handleShapeClick : undefined}
                        className="h-full w-full"
                      />
                    </div>
                  </div>

                  <MapInfoDrawer
                    title={t("info.topDownTitle")}
                    emptyLabel={t("info.emptyTopDown")}
                    summary={topDownInfoSummary}
                  />
                </div>

                {locations && (
                  <WarehouseFrontElevationPanel
                    layout={layout}
                    locations={locations}
                    locationGroups={locationGroups ?? []}
                    viewBackgroundLabel={t("backgroundLabels.front")}
                    anchorLocationId={frontAnchorLocationId}
                    anchorLocationIds={frontStageAnchorIds}
                    highlightLocationIds={frontHighlightIds}
                    headerActiveLocationIds={selectedTopDownFocusIds}
                    monochromaticHighlight={isMonochrome}
                    onShapeClick={hasTreeAvailable ? handleShapeClick : undefined}
                    className="min-h-0 shrink-0"
                    viewportResetKey={`${layout.id}:${isFrontViewCollapsed ? "collapsed" : "expanded"}:${frontStageAnchorIds.join(",")}:front`}
                    collapsible
                    collapsed={isFrontViewCollapsed}
                    onCollapsedChange={setIsFrontViewCollapsed}
                    rightRail={
                      <MapInfoDrawer
                        title={t("info.frontTitle")}
                        emptyLabel={t("info.emptyFront")}
                        summary={frontInfoSummary}
                      />
                    }
                  />
                )}
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
        <MapIcon className="h-8 w-8 opacity-40" />
      )}
      <p className="text-sm">{message}</p>
    </div>
  );
}
