"use client";

import React from "react";
import { useTranslations } from "next-intl";
import {
  Palette,
  Map as MapIcon,
  Info,
  Search,
  MoveHorizontal,
  MoveVertical,
  ChevronDown,
  ChevronRight,
  ChevronsDown,
  ChevronsUp,
  MapPin,
  ArrowUpDown,
  X,
  PanelLeftClose,
  PanelLeftOpen,
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
import { resolveLocationMapContext } from "@/lib/warehouse/map-context";
import {
  buildChildrenByParentId,
  buildGroupMap,
  buildGroupsByParentId,
  buildLocationCodePath,
  buildLocationMap,
  buildMembersByGroupId,
  deriveWarehousePreviewSelectionState,
  getAncestorIds,
  getDescendantLocationIds,
  orderTopDownAnchorIdsByLayoutShapes,
} from "@/lib/warehouse/map-preview";
import {
  getEffectiveLocationColor,
  type WarehouseLocation,
  type WarehouseLocationGroup,
} from "@/lib/warehouse/location-tree";
import type { WarehouseLayoutShape, WarehouseLayoutWithShapes } from "@/lib/warehouse/layouts";
import { WarehouseMapViewer } from "@/components/v2/warehouse/warehouse-map-viewer";
import { WarehouseFrontElevationPanel } from "@/components/v2/warehouse/warehouse-front-elevation-panel";

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

const MapInfoDrawer = React.memo(function MapInfoDrawer({
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
  const [open, setOpen] = React.useState(true);
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
                {summary.metrics.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      {t("info.fields.dimensions")}
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
                      {t("info.fields.description")}
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
});

function TreeLocationRow({
  location,
  locationMap,
  groupMap,
  childrenByParentId,
  groupsByParentId,
  membersByGroupId,
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
  locationMap: Map<string, WarehouseLocation>;
  groupMap: Map<string, WarehouseLocationGroup>;
  childrenByParentId: Map<string, WarehouseLocation[]>;
  groupsByParentId: Map<string | null, WarehouseLocationGroup[]>;
  membersByGroupId: Map<string, WarehouseLocation[]>;
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
  const children = childrenByParentId.get(location.id) ?? [];
  const myGroups = groupsByParentId.get(location.id) ?? [];
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
          "mx-1 flex items-center gap-1.5 rounded-md py-1.5 pr-2 transition-colors",
          isSelectable && "cursor-pointer",
          isActive && "bg-primary/10",
          !isActive && isSelectable && "hover:bg-accent",
          !isActive && !isSelectable && "cursor-default opacity-45"
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
            "flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground",
            !hasChildren && "pointer-events-none invisible"
          )}
          onClick={(event) => {
            event.stopPropagation();
            if (hasChildren) setExpanded((value) => !value);
          }}
          aria-label={effectiveExpanded ? t("tree.collapse") : t("tree.expand")}
        >
          {effectiveExpanded ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </button>

        <div
          className="h-2.5 w-2.5 shrink-0 rounded-sm border border-black/10"
          style={{
            backgroundColor:
              getEffectiveLocationColor(location, groupMap, locationMap) ?? "#10b981",
          }}
        />

        <span
          className={cn(
            "min-w-0 flex-1 truncate text-xs",
            isActive && "font-semibold text-primary"
          )}
        >
          {location.name}
        </span>
        {location.code ? (
          <span className="shrink-0 text-[10px] font-mono text-muted-foreground">
            {location.code}
          </span>
        ) : null}
      </div>

      {effectiveExpanded && (
        <TreeItems
          parentId={location.id}
          locationMap={locationMap}
          groupMap={groupMap}
          childrenByParentId={childrenByParentId}
          groupsByParentId={groupsByParentId}
          membersByGroupId={membersByGroupId}
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
  locationMap,
  groupMap,
  childrenByParentId,
  groupsByParentId,
  membersByGroupId,
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
  locationMap: Map<string, WarehouseLocation>;
  groupMap: Map<string, WarehouseLocationGroup>;
  childrenByParentId: Map<string, WarehouseLocation[]>;
  groupsByParentId: Map<string | null, WarehouseLocationGroup[]>;
  membersByGroupId: Map<string, WarehouseLocation[]>;
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
          "mx-1 flex items-center gap-1.5 rounded-md py-1.5 pr-2 transition-colors",
          hasSelectableMembers && "cursor-pointer",
          isActive && "bg-primary/10",
          !isActive && hasSelectableMembers && "hover:bg-accent",
          !isActive && !hasSelectableMembers && "cursor-default opacity-45"
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
          className="flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground"
          onClick={(event) => {
            event.stopPropagation();
            setExpanded((value) => !value);
          }}
          aria-label={effectiveExpanded ? t("tree.collapse") : t("tree.expand")}
        >
          {effectiveExpanded ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </button>

        <div className="flex h-4 w-4 shrink-0 items-center justify-center">
          <div
            className="h-2.5 w-2.5 rounded-sm border border-black/10"
            style={{ backgroundColor: group.color ?? "#94a3b8" }}
          />
        </div>

        <span
          className={cn(
            "min-w-0 flex-1 truncate text-xs uppercase tracking-wide text-muted-foreground",
            isActive && "font-semibold text-primary"
          )}
        >
          {group.name}
        </span>
        <span className="shrink-0 text-[10px] text-muted-foreground">{members.length}</span>
      </div>

      {effectiveExpanded &&
        members.map((member) => (
          <TreeLocationRow
            key={member.id}
            location={member}
            locationMap={locationMap}
            groupMap={groupMap}
            childrenByParentId={childrenByParentId}
            groupsByParentId={groupsByParentId}
            membersByGroupId={membersByGroupId}
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
  locationMap,
  groupMap,
  childrenByParentId,
  groupsByParentId,
  membersByGroupId,
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
  locationMap: Map<string, WarehouseLocation>;
  groupMap: Map<string, WarehouseLocationGroup>;
  childrenByParentId: Map<string, WarehouseLocation[]>;
  groupsByParentId: Map<string | null, WarehouseLocationGroup[]>;
  membersByGroupId: Map<string, WarehouseLocation[]>;
  selectableLocationIds: Set<string>;
  highlightedIds: string[];
  onSelectIds: (ids: string[]) => void;
  autoExpandedLocationIds: Set<string>;
  autoExpandedGroupIds: Set<string>;
  expandMode: "auto" | "all" | "collapsed";
  depth: number;
  t: ReturnType<typeof useTranslations<"warehouseMapDialog">>;
}) {
  const myGroups = [...(groupsByParentId.get(parentId ?? null) ?? [])].sort(
    (left, right) => left.sort_order - right.sort_order || left.name.localeCompare(right.name)
  );
  const knownGroupIds = new Set(myGroups.map((group) => group.id));
  const children = [...(childrenByParentId.get(parentId ?? "") ?? [])].sort(
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
      isSelectable: (membersByGroupId.get(group.id) ?? []).some((location) =>
        selectableLocationIds.has(location.id)
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
            locationMap={locationMap}
            groupMap={groupMap}
            childrenByParentId={childrenByParentId}
            groupsByParentId={groupsByParentId}
            membersByGroupId={membersByGroupId}
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
            locationMap={locationMap}
            groupMap={groupMap}
            childrenByParentId={childrenByParentId}
            groupsByParentId={groupsByParentId}
            membersByGroupId={membersByGroupId}
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

const TreePanel = React.memo(function TreePanel({
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
  t: ReturnType<typeof useTranslations<"warehouseMapDialog">>;
}) {
  const allChildrenByParentId = React.useMemo(
    () => buildChildrenByParentId(locations),
    [locations]
  );
  const descendants = React.useMemo(() => {
    if (!rootLocationId) return locations;
    const result: WarehouseLocation[] = [];
    const visited = new Set<string>();
    const queue = [...(allChildrenByParentId.get(rootLocationId) ?? [])];
    while (queue.length > 0) {
      const location = queue.shift()!;
      if (visited.has(location.id)) continue;
      visited.add(location.id);
      result.push(location);
      const children = allChildrenByParentId.get(location.id);
      if (children?.length) {
        queue.push(...children);
      }
    }
    return result;
  }, [allChildrenByParentId, locations, rootLocationId]);

  const [searchQuery, setSearchQuery] = React.useState("");
  const [expandMode, setExpandMode] = React.useState<"auto" | "all" | "collapsed">("auto");
  const locationMap = React.useMemo(() => buildLocationMap(descendants), [descendants]);
  const childrenByParentId = React.useMemo(
    () => buildChildrenByParentId(descendants),
    [descendants]
  );
  const membersByGroupId = React.useMemo(() => buildMembersByGroupId(descendants), [descendants]);
  const descendantParentIds = React.useMemo(
    () => new Set(descendants.map((location) => location.parent_id).filter(Boolean)),
    [descendants]
  );
  const searchableGroups = React.useMemo(
    () => locationGroups.filter((group) => descendantParentIds.has(group.parent_location_id)),
    [descendantParentIds, locationGroups]
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
      const descendantIds = getDescendantLocationIds(location.id, childrenByParentId);
      if (descendantIds.some((id) => previewableIds.has(id))) {
        previewableIds.add(location.id);
      }
    }

    return previewableIds;
  }, [childrenByParentId, descendants, layout.root_location_id, locations, rootLocationId]);

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
        const members = membersByGroupId.get(group.id) ?? [];
        members.forEach((member) => {
          visibleIds.add(member.id);
          getAncestorIds(member.id, locationMap, rootLocationId ?? null).forEach((id) =>
            visibleIds.add(id)
          );
        });
      }
    }

    return visibleIds;
  }, [descendants, locationMap, membersByGroupId, rootLocationId, searchQuery, searchableGroups]);

  const visibleGroups = React.useMemo(
    () =>
      searchableGroups.filter((group) => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return true;
        if (group.name.toLowerCase().includes(query)) return true;
        return (membersByGroupId.get(group.id) ?? []).some((location) =>
          visibleLocationIds.has(location.id)
        );
      }),
    [membersByGroupId, searchQuery, searchableGroups, visibleLocationIds]
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
      const memberIds = (membersByGroupId.get(group.id) ?? []).map((location) => location.id);
      if (
        memberIds.some(
          (id) => highlightedIds.includes(id) || (isSearching && visibleLocationIds.has(id))
        )
      ) {
        ids.add(group.id);
      }
    }
    return ids;
  }, [highlightedIds, membersByGroupId, searchQuery, visibleGroups, visibleLocationIds]);

  const filteredDescendants = React.useMemo(
    () => descendants.filter((location) => visibleLocationIds.has(location.id)),
    [descendants, visibleLocationIds]
  );
  const renderLocationMap = React.useMemo(
    () => buildLocationMap(filteredDescendants),
    [filteredDescendants]
  );
  const renderChildrenByParentId = React.useMemo(
    () => buildChildrenByParentId(filteredDescendants),
    [filteredDescendants]
  );
  const renderMembersByGroupId = React.useMemo(
    () => buildMembersByGroupId(filteredDescendants),
    [filteredDescendants]
  );
  const renderGroupMap = React.useMemo(() => buildGroupMap(visibleGroups), [visibleGroups]);
  const renderGroupsByParentId = React.useMemo(
    () => buildGroupsByParentId(visibleGroups),
    [visibleGroups]
  );

  return (
    <div className="flex h-full w-56 shrink-0 flex-col overflow-hidden border-r bg-background">
      <div className="shrink-0 border-b bg-muted/50 px-3 py-2.5">
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
          <div className="flex flex-col items-center justify-center px-3 py-8 text-center text-muted-foreground">
            <MapPin className="mb-2 h-6 w-6 opacity-20" />
            <p className="text-[10px]">
              {searchQuery.trim() ? t("tree.noResults") : t("tree.empty")}
            </p>
          </div>
        ) : (
          <TreeItems
            parentId={rootLocationId}
            locationMap={renderLocationMap}
            groupMap={renderGroupMap}
            childrenByParentId={renderChildrenByParentId}
            groupsByParentId={renderGroupsByParentId}
            membersByGroupId={renderMembersByGroupId}
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
});

export interface PublicWarehouseMapsPageClientProps {
  branch: {
    id: string;
    name: string;
    slug: string | null;
  };
  layouts: WarehouseLayoutWithShapes[];
  locations: WarehouseLocation[];
  locationGroups: WarehouseLocationGroup[];
}

const PublicMapsHeader = React.memo(function PublicMapsHeader({
  branchName,
  resolvedRootLocationName,
  selectedLayoutName,
  highlightedLocationBreadcrumbs,
  highlightedLocationCodePath,
  didCopyPath,
  onCopyHighlightedLocationPath,
  dialogT,
  globalSearchQuery,
  onGlobalSearchQueryChange,
  onGlobalSearchFocus,
  onGlobalSearchBlur,
  onClearGlobalSearch,
  isGlobalSearchOpen,
  globalSearchResults,
  onGlobalSearchSelect,
  layoutOptions,
  selectedLayoutId,
  onSelectedLayoutIdChange,
  t,
}: {
  branchName: string;
  resolvedRootLocationName: string | null;
  selectedLayoutName: string;
  highlightedLocationBreadcrumbs: string[];
  highlightedLocationCodePath: string | null;
  didCopyPath: boolean;
  onCopyHighlightedLocationPath: () => void;
  dialogT: ReturnType<typeof useTranslations<"warehouseMapDialog">>;
  globalSearchQuery: string;
  onGlobalSearchQueryChange: (value: string) => void;
  onGlobalSearchFocus: () => void;
  onGlobalSearchBlur: () => void;
  onClearGlobalSearch: () => void;
  isGlobalSearchOpen: boolean;
  globalSearchResults: Array<{
    location: WarehouseLocation;
    layoutId: string;
    layoutName: string;
    rootLocationName: string;
    breadcrumbPath: string;
  }>;
  onGlobalSearchSelect: (layoutId: string, locationId: string) => void;
  layoutOptions: Array<{ id: string; name: string }>;
  selectedLayoutId: string;
  onSelectedLayoutIdChange: (value: string) => void;
  t: ReturnType<typeof useTranslations<"publicWarehouseMapsPage">>;
}) {
  return (
    <div className="relative z-[5] flex shrink-0 flex-col gap-1 overflow-visible rounded-xl border bg-background/90 px-3 py-2 shadow-sm backdrop-blur-sm md:flex-row md:items-center md:justify-between">
      <div className="min-w-0">
        <h1 className="truncate text-sm font-semibold tracking-tight md:text-base">{branchName}</h1>
        <div className="mt-1 flex min-h-[1.25rem] min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          {highlightedLocationBreadcrumbs.length > 0 || highlightedLocationCodePath ? (
            <>
              <span className="min-w-0 truncate">
                <span className="font-semibold text-foreground/90">
                  {resolvedRootLocationName ?? selectedLayoutName}
                </span>
                {highlightedLocationBreadcrumbs.length > 0 ? (
                  <span>{` / ${highlightedLocationBreadcrumbs.join(" / ")}`}</span>
                ) : null}
              </span>
              {highlightedLocationCodePath && (
                <TooltipProvider delayDuration={100}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={onCopyHighlightedLocationPath}
                        className="min-w-0 max-w-56 shrink cursor-pointer text-left transition-colors hover:text-foreground"
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
                            {dialogT("actions.copied")}
                          </span>
                        </span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{dialogT("actions.copy")}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </>
          ) : (
            <span className="invisible select-none">
              {resolvedRootLocationName ?? selectedLayoutName}
            </span>
          )}
        </div>
      </div>

      <div className="flex w-full flex-col gap-2 md:w-auto md:min-w-[32rem] md:flex-row md:items-center md:justify-end">
        <div className="relative z-[15] w-full overflow-visible md:w-80">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={globalSearchQuery}
            onChange={(event) => onGlobalSearchQueryChange(event.target.value)}
            onFocus={onGlobalSearchFocus}
            onBlur={onGlobalSearchBlur}
            placeholder={t("globalSearch.placeholder")}
            className="h-8 rounded-lg pl-8 pr-8 text-xs"
          />
          {globalSearchQuery.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 h-6 w-6 -translate-y-1/2 text-muted-foreground"
              onMouseDown={(event) => event.preventDefault()}
              onClick={onClearGlobalSearch}
              aria-label={t("globalSearch.clear")}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
          {isGlobalSearchOpen && globalSearchQuery.trim().length > 0 && (
            <div className="absolute inset-x-0 top-[calc(100%+0.375rem)] z-[25] overflow-hidden rounded-lg border bg-popover shadow-2xl">
              {globalSearchResults.length > 0 ? (
                <div className="max-h-80 overflow-y-auto p-1">
                  {globalSearchResults.map((result) => (
                    <button
                      key={result.location.id}
                      type="button"
                      className="flex w-full flex-col rounded-md px-2.5 py-2 text-left transition-colors hover:bg-accent"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => onGlobalSearchSelect(result.layoutId, result.location.id)}
                    >
                      <span className="truncate text-xs font-medium text-foreground">
                        {result.location.name}
                        {result.location.code ? (
                          <span className="ml-1 font-mono text-[11px] font-normal text-muted-foreground">
                            ({result.location.code})
                          </span>
                        ) : null}
                      </span>
                      <span className="truncate text-[11px] text-muted-foreground">
                        {result.breadcrumbPath}
                        {result.rootLocationName ? ` (${result.rootLocationName})` : ""}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="px-3 py-2 text-xs text-muted-foreground">
                  {t("globalSearch.noResults")}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="w-full md:w-64 md:max-w-full">
          <Select value={selectedLayoutId} onValueChange={onSelectedLayoutIdChange}>
            <SelectTrigger className="h-8 rounded-lg">
              <SelectValue placeholder={t("layoutSelectPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {layoutOptions.map((layout) => (
                <SelectItem key={layout.id} value={layout.id}>
                  {layout.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
});

const PublicMapsBody = React.memo(function PublicMapsBody({
  selectedLayout,
  locations,
  locationGroups,
  highlightedIds,
  highlightedId,
  selectedTopDownFocusIds,
  frontAnchorLocationId,
  orderedFrontStageAnchorIds,
  frontHighlightIds,
  isMonochrome,
  isFrontViewCollapsed,
  isTreeVisible,
  onTreeSelection,
  onHideTree,
  onShowTree,
  onClearSelection,
  onToggleMonochrome,
  onShapeClick,
  onFrontViewCollapsedChange,
  topDownInfoRail,
  frontInfoRail,
  dialogT,
}: {
  selectedLayout: WarehouseLayoutWithShapes;
  locations: WarehouseLocation[];
  locationGroups: WarehouseLocationGroup[];
  highlightedIds: string[];
  highlightedId: string | null;
  selectedTopDownFocusIds: string[];
  frontAnchorLocationId: string | null;
  orderedFrontStageAnchorIds: string[];
  frontHighlightIds: string[];
  isMonochrome: boolean;
  isFrontViewCollapsed: boolean;
  isTreeVisible: boolean;
  onTreeSelection: (ids: string[]) => void;
  onHideTree: () => void;
  onShowTree: () => void;
  onClearSelection: () => void;
  onToggleMonochrome: () => void;
  onShapeClick: (shape: WarehouseLayoutShape) => void;
  onFrontViewCollapsedChange: (collapsed: boolean) => void;
  topDownInfoRail: React.ReactNode;
  frontInfoRail: React.ReactNode;
  dialogT: ReturnType<typeof useTranslations<"warehouseMapDialog">>;
}) {
  return (
    <div className="relative z-0 min-h-0 flex-1 overflow-hidden rounded-2xl border bg-background shadow-sm">
      <div className="relative flex h-full overflow-hidden">
        <div
          className={cn(
            "h-full shrink-0 overflow-hidden transition-[width,opacity] duration-300 ease-out",
            isTreeVisible ? "w-56 opacity-100" : "w-0 opacity-0"
          )}
        >
          <div className="h-full w-56">
            <TreePanel
              layout={selectedLayout}
              locations={locations}
              locationGroups={locationGroups}
              rootLocationId={selectedLayout.root_location_id}
              highlightedIds={highlightedIds}
              onSelectIds={onTreeSelection}
              onToggleVisibility={onHideTree}
              t={dialogT}
            />
          </div>
        </div>

        <div
          className="grid min-w-0 flex-1 overflow-hidden transition-[grid-template-rows] duration-300 ease-in-out"
          style={{
            gridTemplateRows: isFrontViewCollapsed
              ? "minmax(0,1fr) 2.25rem"
              : "minmax(0,1fr) clamp(16rem,38%,24rem)",
          }}
        >
          <div className="flex min-h-0 flex-1 overflow-hidden" onClick={onClearSelection}>
            <div className="relative min-w-0 flex-1 overflow-hidden">
              {!isTreeVisible && (
                <div className="pointer-events-auto absolute left-3 top-3 z-30 animate-in fade-in-0 slide-in-from-left-2 duration-200">
                  <TooltipProvider delayDuration={100}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 rounded-lg border-border/70 bg-background/90 shadow-sm backdrop-blur-sm"
                          onClick={(event) => {
                            event.stopPropagation();
                            onShowTree();
                          }}
                        >
                          <PanelLeftOpen className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{dialogT("actions.showTree")}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              )}
              {highlightedIds.length > 0 && (
                <div
                  className={cn(
                    "pointer-events-auto absolute top-3 z-30 flex flex-col gap-1 rounded-lg border bg-background/90 p-1 shadow-sm backdrop-blur-sm transition-[left] duration-300 ease-out",
                    !isTreeVisible ? "left-14" : "left-3"
                  )}
                >
                  <button
                    type="button"
                    title={
                      isMonochrome
                        ? dialogT("actions.showColors")
                        : dialogT("actions.monochromaticView")
                    }
                    onClick={(event) => {
                      event.stopPropagation();
                      onToggleMonochrome();
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
                  viewBackgroundLabel={dialogT("backgroundLabels.topDown")}
                  locations={locations}
                  locationGroups={locationGroups}
                  highlightLocationId={highlightedId}
                  highlightLocationIds={
                    selectedTopDownFocusIds.length > 0 ? selectedTopDownFocusIds : highlightedIds
                  }
                  autoPanToHighlight={false}
                  monochromaticHighlight={isMonochrome}
                  viewportResetKey={`${selectedLayout.id}:${isFrontViewCollapsed ? "collapsed" : "expanded"}:top`}
                  onShapeClick={onShapeClick}
                  className="h-full w-full"
                />
              </div>
            </div>

            {topDownInfoRail}
          </div>

          <WarehouseFrontElevationPanel
            layout={selectedLayout}
            locations={locations}
            locationGroups={locationGroups}
            viewBackgroundLabel={dialogT("backgroundLabels.front")}
            anchorLocationId={frontAnchorLocationId}
            anchorLocationIds={orderedFrontStageAnchorIds}
            highlightLocationIds={frontHighlightIds}
            headerActiveLocationIds={selectedTopDownFocusIds}
            monochromaticHighlight={isMonochrome}
            onShapeClick={onShapeClick}
            viewportResetKey={`${selectedLayout.id}:${isFrontViewCollapsed ? "collapsed" : "expanded"}:${orderedFrontStageAnchorIds.join(",")}:front`}
            collapsible
            collapsed={isFrontViewCollapsed}
            onCollapsedChange={onFrontViewCollapsedChange}
            className="min-h-0 shrink-0"
            rightRail={frontInfoRail}
          />
        </div>
      </div>
    </div>
  );
});

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
  const [didCopyPath, setDidCopyPath] = React.useState(false);
  const [isFrontViewCollapsed, setIsFrontViewCollapsed] = React.useState(true);
  const [isTreeVisible, setIsTreeVisible] = React.useState(true);
  const [globalSearchQuery, setGlobalSearchQuery] = React.useState("");
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = React.useState(false);
  const globalSearchBlurTimeoutRef = React.useRef<number | null>(null);
  const searchNavigationTargetRef = React.useRef<string | null>(null);

  const locationMap = React.useMemo(() => buildLocationMap(locations), [locations]);
  const layoutById = React.useMemo(
    () => new Map(layouts.map((layout) => [layout.id, layout])),
    [layouts]
  );
  const childrenByParentId = React.useMemo(() => {
    return buildChildrenByParentId(locations);
  }, [locations]);
  const selectedLayout = React.useMemo(
    () => layouts.find((layout) => layout.id === selectedLayoutId) ?? layouts[0] ?? null,
    [layouts, selectedLayoutId]
  );
  const highlightedId = highlightedIds.length === 1 ? highlightedIds[0] : null;
  const locationLayoutMap = React.useMemo(() => {
    const map = new Map<string, string>();

    for (const layout of layouts) {
      if (!layout.root_location_id) continue;
      map.set(layout.root_location_id, layout.id);

      const queue = [...(childrenByParentId.get(layout.root_location_id) ?? [])];
      while (queue.length > 0) {
        const current = queue.shift()!;
        if (map.has(current.id)) continue;
        map.set(current.id, layout.id);
        const children = childrenByParentId.get(current.id);
        if (children?.length) {
          queue.push(...children);
        }
      }
    }

    return map;
  }, [childrenByParentId, layouts]);
  const rootLocationNameByLayoutId = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const layout of layouts) {
      if (!layout.root_location_id) continue;
      map.set(layout.id, locationMap.get(layout.root_location_id)?.name ?? layout.name);
    }
    return map;
  }, [layouts, locationMap]);
  const globalSearchResults = React.useMemo(() => {
    const query = globalSearchQuery.trim().toLowerCase();
    if (!query) return [];

    return locations
      .filter((location) => locationLayoutMap.has(location.id))
      .map((location) => {
        const layoutId = locationLayoutMap.get(location.id)!;
        const layout = layoutById.get(layoutId) ?? null;
        const rootLocationName = rootLocationNameByLayoutId.get(layoutId) ?? layout?.name ?? "";
        const breadcrumbPath = buildLocationCodePath(
          location.id,
          locationMap,
          layout?.root_location_id ?? null
        );
        const searchValue =
          `${location.name} ${location.code ?? ""} ${breadcrumbPath} ${rootLocationName ?? ""}`.toLowerCase();

        return {
          location,
          layoutId,
          layoutName: layout?.name ?? "",
          rootLocationName: rootLocationName ?? "",
          breadcrumbPath,
          searchValue,
        };
      })
      .filter((entry) => entry.searchValue.includes(query))
      .sort((left, right) => {
        const leftStartsWith = left.location.name.toLowerCase().startsWith(query);
        const rightStartsWith = right.location.name.toLowerCase().startsWith(query);
        if (leftStartsWith !== rightStartsWith) return leftStartsWith ? -1 : 1;

        const leftCodeStartsWith = (left.location.code ?? "").toLowerCase().startsWith(query);
        const rightCodeStartsWith = (right.location.code ?? "").toLowerCase().startsWith(query);
        if (leftCodeStartsWith !== rightCodeStartsWith) return leftCodeStartsWith ? -1 : 1;

        return (
          left.location.name.localeCompare(right.location.name) ||
          (left.location.sort_order ?? 0) - (right.location.sort_order ?? 0)
        );
      })
      .slice(0, 8);
  }, [
    globalSearchQuery,
    layoutById,
    locationLayoutMap,
    locationMap,
    locations,
    rootLocationNameByLayoutId,
  ]);
  const resolvedRootLocationName = React.useMemo(() => {
    if (!selectedLayout?.root_location_id) return null;
    return locationMap.get(selectedLayout.root_location_id)?.name ?? null;
  }, [locationMap, selectedLayout?.root_location_id]);
  const highlightedLocationBreadcrumbs = React.useMemo(() => {
    if (!selectedLayout?.root_location_id || !highlightedId) return [];

    const breadcrumbs: string[] = [];
    let current = locationMap.get(highlightedId) ?? null;

    while (current) {
      if (current.id === selectedLayout.root_location_id) break;
      breadcrumbs.unshift(current.name);
      current = current.parent_id ? (locationMap.get(current.parent_id) ?? null) : null;
    }

    return breadcrumbs;
  }, [highlightedId, locationMap, selectedLayout?.root_location_id]);
  const highlightedLocationCodePath = React.useMemo(() => {
    if (!selectedLayout?.root_location_id || !highlightedId) return null;
    return buildLocationCodePath(highlightedId, locationMap, selectedLayout.root_location_id);
  }, [highlightedId, locationMap, selectedLayout?.root_location_id]);
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
    [childrenByParentId, highlightedIds, locationMap, locations]
  );
  const orderedFrontStageAnchorIds = React.useMemo(
    () =>
      selectedLayout ? orderTopDownAnchorIdsByLayoutShapes(frontStageAnchorIds, locationMap) : [],
    [frontStageAnchorIds, locationMap, selectedLayout]
  );
  const frontAnchorLocationId = React.useMemo(
    () => (orderedFrontStageAnchorIds.length === 1 ? orderedFrontStageAnchorIds[0] : null),
    [orderedFrontStageAnchorIds]
  );
  React.useEffect(() => {
    if (frontStageAnchorIds.length > 0) {
      setIsFrontViewCollapsed(false);
    }
  }, [frontStageAnchorIds]);
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
    const pendingLocationId = searchNavigationTargetRef.current;
    if (pendingLocationId && locationLayoutMap.get(pendingLocationId) === selectedLayoutId) {
      setHighlightedIds([pendingLocationId]);
      searchNavigationTargetRef.current = null;
    } else if (!pendingLocationId) {
      setHighlightedIds([]);
    }
    setIsMonochrome(true);
  }, [locationLayoutMap, selectedLayoutId]);
  React.useEffect(() => {
    setDidCopyPath(false);
  }, [highlightedLocationCodePath]);
  React.useEffect(() => {
    setIsTreeVisible(true);
  }, [selectedLayoutId]);
  React.useEffect(() => {
    return () => {
      if (globalSearchBlurTimeoutRef.current !== null) {
        window.clearTimeout(globalSearchBlurTimeoutRef.current);
      }
    };
  }, []);

  const handleShapeClick = React.useCallback((shape: WarehouseLayoutShape) => {
    if (!shape.location_id) return;
    setHighlightedIds((prev) =>
      prev.length === 1 && prev[0] === shape.location_id ? [] : [shape.location_id]
    );
  }, []);
  const handleClearSelection = React.useCallback(() => {
    setHighlightedIds([]);
  }, []);
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
  const handleTreeSelection = React.useCallback((ids: string[]) => {
    setHighlightedIds((prev) =>
      prev.length === ids.length && ids.every((id) => prev.includes(id)) ? [] : ids
    );
  }, []);
  const handleHideTree = React.useCallback(() => {
    setIsTreeVisible(false);
  }, []);
  const handleShowTree = React.useCallback(() => {
    setIsTreeVisible(true);
  }, []);
  const handleToggleMonochrome = React.useCallback(() => {
    setIsMonochrome((value) => !value);
  }, []);
  const handleGlobalSearchQueryChange = React.useCallback((value: string) => {
    setGlobalSearchQuery(value);
    setIsGlobalSearchOpen(true);
  }, []);
  const handleGlobalSearchFocus = React.useCallback(() => {
    setIsGlobalSearchOpen(true);
  }, []);
  const handleGlobalSearchBlur = React.useCallback(() => {
    globalSearchBlurTimeoutRef.current = window.setTimeout(() => {
      setIsGlobalSearchOpen(false);
    }, 120);
  }, []);
  const handleClearGlobalSearch = React.useCallback(() => {
    setGlobalSearchQuery("");
    setIsGlobalSearchOpen(false);
  }, []);
  const handleGlobalSearchSelect = React.useCallback(
    (layoutId: string, locationId: string) => {
      setIsFrontViewCollapsed(false);
      if (layoutId === selectedLayoutId) {
        setHighlightedIds([locationId]);
      } else {
        searchNavigationTargetRef.current = locationId;
        setSelectedLayoutId(layoutId);
      }
      setGlobalSearchQuery("");
      setIsGlobalSearchOpen(false);
    },
    [selectedLayoutId]
  );
  const topDownInfoRail = React.useMemo(
    () => (
      <MapInfoDrawer
        title={dialogT("info.topDownTitle")}
        emptyLabel={dialogT("info.emptyTopDown")}
        summary={topDownInfoSummary}
      />
    ),
    [dialogT, topDownInfoSummary]
  );
  const frontInfoRail = React.useMemo(
    () => (
      <MapInfoDrawer
        title={dialogT("info.frontTitle")}
        emptyLabel={dialogT("info.emptyFront")}
        summary={frontInfoSummary}
      />
    ),
    [dialogT, frontInfoSummary]
  );

  if (!selectedLayout) {
    return (
      <div className="flex w-full flex-1 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed px-6 py-16 text-center">
        <MapIcon className="h-10 w-10 text-muted-foreground/40" />
        <div>
          <p className="text-lg font-semibold">{t("emptyTitle")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("emptyDescription")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-12.5rem)] min-h-[640px] w-full flex-col gap-2 self-stretch overflow-hidden">
      <PublicMapsHeader
        branchName={branch.name}
        resolvedRootLocationName={resolvedRootLocationName}
        selectedLayoutName={selectedLayout.name}
        highlightedLocationBreadcrumbs={highlightedLocationBreadcrumbs}
        highlightedLocationCodePath={highlightedLocationCodePath}
        didCopyPath={didCopyPath}
        onCopyHighlightedLocationPath={handleCopyHighlightedLocationPath}
        dialogT={dialogT}
        globalSearchQuery={globalSearchQuery}
        onGlobalSearchQueryChange={handleGlobalSearchQueryChange}
        onGlobalSearchFocus={handleGlobalSearchFocus}
        onGlobalSearchBlur={handleGlobalSearchBlur}
        onClearGlobalSearch={handleClearGlobalSearch}
        isGlobalSearchOpen={isGlobalSearchOpen}
        globalSearchResults={globalSearchResults}
        onGlobalSearchSelect={handleGlobalSearchSelect}
        layoutOptions={layouts.map((layout) => ({ id: layout.id, name: layout.name }))}
        selectedLayoutId={selectedLayout.id}
        onSelectedLayoutIdChange={setSelectedLayoutId}
        t={t}
      />

      <PublicMapsBody
        selectedLayout={selectedLayout}
        locations={locations}
        locationGroups={locationGroups}
        highlightedIds={highlightedIds}
        highlightedId={highlightedId}
        selectedTopDownFocusIds={selectedTopDownFocusIds}
        frontAnchorLocationId={frontAnchorLocationId}
        orderedFrontStageAnchorIds={orderedFrontStageAnchorIds}
        frontHighlightIds={frontHighlightIds}
        isMonochrome={isMonochrome}
        isFrontViewCollapsed={isFrontViewCollapsed}
        isTreeVisible={isTreeVisible}
        onTreeSelection={handleTreeSelection}
        onHideTree={handleHideTree}
        onShowTree={handleShowTree}
        onClearSelection={handleClearSelection}
        onToggleMonochrome={handleToggleMonochrome}
        onShapeClick={handleShapeClick}
        onFrontViewCollapsedChange={setIsFrontViewCollapsed}
        topDownInfoRail={topDownInfoRail}
        frontInfoRail={frontInfoRail}
        dialogT={dialogT}
      />
    </div>
  );
}
