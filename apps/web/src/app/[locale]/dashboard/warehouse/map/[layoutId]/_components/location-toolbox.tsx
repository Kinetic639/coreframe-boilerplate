"use client";

import React from "react";
import { useTranslations } from "next-intl";
import {
  Box,
  Minus,
  DoorOpen,
  ArrowLeftRight,
  LayoutGrid,
  AlertTriangle,
  Type,
  ChevronDown,
  ChevronRight,
  Trash2,
  GripVertical,
  Layers,
  FolderOpen,
  X,
} from "lucide-react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { CSS } from "@dnd-kit/utilities";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { ShapeType } from "@/lib/warehouse/layouts";
import {
  getEffectiveLocationColor,
  type WarehouseLocation,
  type WarehouseLocationGroup,
} from "@/lib/warehouse/location-tree";
import {
  useDeleteLocationMutation,
  useReorderLocationsMutation,
  useReorderGroupsMutation,
  useUpdateLocationMutation,
} from "@/hooks/queries/warehouse";
import { cn } from "@/lib/utils";

// ─── Shape palette ────────────────────────────────────────────────────────────

interface PaletteItem {
  type: ShapeType;
  labelKey: string;
  icon: React.ReactNode;
  colorClass: string;
}

const PALETTE: PaletteItem[] = [
  {
    type: "location",
    labelKey: "palette.location",
    icon: <Box className="w-5 h-5" />,
    colorClass: "text-emerald-600 group-hover:bg-emerald-50 dark:group-hover:bg-emerald-950",
  },
  {
    type: "wall",
    labelKey: "palette.wall",
    icon: <Minus className="w-5 h-5" />,
    colorClass: "text-muted-foreground group-hover:bg-muted",
  },
  {
    type: "door",
    labelKey: "palette.door",
    icon: <DoorOpen className="w-5 h-5" />,
    colorClass: "text-blue-600 group-hover:bg-blue-50 dark:group-hover:bg-blue-950",
  },
  {
    type: "aisle",
    labelKey: "palette.aisle",
    icon: <ArrowLeftRight className="w-5 h-5" />,
    colorClass: "text-yellow-600 group-hover:bg-yellow-50 dark:group-hover:bg-yellow-950",
  },
  {
    type: "zone",
    labelKey: "palette.zone",
    icon: <LayoutGrid className="w-5 h-5" />,
    colorClass: "text-violet-600 group-hover:bg-violet-50 dark:group-hover:bg-violet-950",
  },
  {
    type: "obstacle",
    labelKey: "palette.obstacle",
    icon: <AlertTriangle className="w-5 h-5" />,
    colorClass: "text-destructive group-hover:bg-destructive/10",
  },
  {
    type: "label",
    labelKey: "palette.label",
    icon: <Type className="w-5 h-5" />,
    colorClass: "text-muted-foreground group-hover:bg-muted",
  },
];

function PaletteChip({ item, t }: { item: PaletteItem; t: ReturnType<typeof useTranslations> }) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("shapeType", item.type);
        e.dataTransfer.effectAllowed = "copy";
      }}
      className={cn(
        "flex flex-col items-center justify-center p-2.5 bg-background border",
        "rounded-lg cursor-grab active:cursor-grabbing hover:border-border hover:shadow-sm",
        "transition-all group select-none"
      )}
    >
      <div
        className={cn(
          "w-9 h-9 rounded-md flex items-center justify-center bg-muted mb-1.5 transition-colors",
          item.colorClass
        )}
      >
        {item.icon}
      </div>
      <span className="text-[10px] font-medium text-muted-foreground leading-none">
        {t(item.labelKey)}
      </span>
    </div>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({
  title,
  count,
  open,
  onToggle,
}: {
  title: string;
  count?: number;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center justify-between px-3 py-2 bg-muted/50 border-b hover:bg-muted transition-colors shrink-0"
    >
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          {title}
        </span>
        {count !== undefined && count > 0 && (
          <span className="bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 text-[9px] font-bold">
            {count}
          </span>
        )}
      </div>
      {open ? (
        <ChevronDown className="w-3 h-3 text-muted-foreground" />
      ) : (
        <ChevronRight className="w-3 h-3 text-muted-foreground" />
      )}
    </button>
  );
}

// ─── Drag overlay preview ─────────────────────────────────────────────────────

function DragPreview({
  location,
  groups,
}: {
  location: WarehouseLocation;
  groups: WarehouseLocationGroup[];
}) {
  return (
    <div className="flex items-center gap-1.5 py-1 px-2 rounded-md bg-background border border-primary/30 shadow-lg text-xs select-none">
      <GripVertical className="w-3 h-3 text-muted-foreground shrink-0" />
      <div
        className="w-2 h-2 rounded-sm shrink-0"
        style={{ backgroundColor: getEffectiveLocationColor(location, groups) ?? "#10b981" }}
      />
      <span className="truncate font-medium">{location.name}</span>
      {location.code && (
        <span className="font-mono text-muted-foreground text-[10px]">{location.code}</span>
      )}
    </div>
  );
}

// ─── Toolbox context ──────────────────────────────────────────────────────────

interface ToolboxCtx {
  allLocations: WarehouseLocation[];
  groups: WarehouseLocationGroup[];
  placedLocationIds: Set<string>;
  selectedGroupId: string | null;
  canManage: boolean;
  onSelect: (id: string) => void;
  onSelectGroup: (groupId: string) => void;
  onReorderSiblings: (parentId: string | null, items: { id: string; sort_order: number }[]) => void;
  onReorderGroups: (items: { id: string; sort_order: number }[]) => void;
  onAssignToGroup: (locationId: string, groupId: string) => void;
  onUngroup: (locationId: string) => void;
  t: ReturnType<typeof useTranslations>;
}

// ─── SortableNodeWrapper ──────────────────────────────────────────────────────

function SortableNodeWrapper({
  id,
  dataType,
  children,
}: {
  id: string;
  dataType: "group" | "location";
  children: (dragHandleProps: React.HTMLAttributes<HTMLButtonElement>) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    data: { type: dataType },
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        position: "relative",
        zIndex: isDragging ? 10 : undefined,
      }}
    >
      {children({ ...attributes, ...listeners } as React.HTMLAttributes<HTMLButtonElement>)}
    </div>
  );
}

function GroupAssignDropZone({
  groupId,
  isActive,
  title,
}: {
  groupId: string;
  isActive: boolean;
  title: string;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `group-dropzone:${groupId}`,
    data: { type: "group-dropzone", groupId },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "pointer-events-none absolute inset-y-1 right-5 w-10 rounded-full border transition-colors",
        isActive || isOver
          ? "border-emerald-500 bg-emerald-100 dark:bg-emerald-950/40"
          : "border-transparent bg-transparent"
      )}
      title={title}
      aria-label={title}
    />
  );
}

function GroupColorBadge({ color }: { color: string | null }) {
  if (!color) {
    return (
      <div className="flex h-4 w-4 shrink-0 items-center justify-center">
        <Layers className="w-3 h-3 text-muted-foreground/60" />
      </div>
    );
  }

  return (
    <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded">
      <Layers className="w-3 h-3" style={{ color }} strokeWidth={2.25} />
    </div>
  );
}

function LocationColorBadge({ color }: { color: string | null }) {
  return (
    <div className="flex h-4 w-4 shrink-0 items-center justify-center">
      <div
        className="h-2.5 w-2.5 rounded-sm shrink-0"
        style={{ backgroundColor: color ?? "#10b981" }}
      />
    </div>
  );
}

// ─── ToolboxGroupSection ──────────────────────────────────────────────────────

function ToolboxGroupSection({
  group,
  members,
  depth,
  ctx,
  isSelected,
  isDropTarget,
  showDropZone = false,
  dragHandleProps,
}: {
  group: WarehouseLocationGroup;
  members: WarehouseLocation[];
  depth: number;
  ctx: ToolboxCtx;
  isSelected: boolean;
  isDropTarget: boolean;
  showDropZone?: boolean;
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const [memberActiveId, setMemberActiveId] = React.useState<string | null>(null);
  const indent = 2 + depth * 10;

  const memberSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleMemberDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setMemberActiveId(null);
    if (!over || active.id === over.id) return;
    const oldIdx = members.findIndex((m) => m.id === (active.id as string));
    const newIdx = members.findIndex((m) => m.id === (over.id as string));
    if (oldIdx === -1 || newIdx === -1) return;
    const reordered = arrayMove(members, oldIdx, newIdx);
    ctx.onReorderSiblings(
      members[0]?.parent_id ?? null,
      reordered.map((m, i) => ({ id: m.id, sort_order: i }))
    );
  }

  const activeMember = memberActiveId ? members.find((m) => m.id === memberActiveId) : null;

  return (
    <>
      <div
        className={cn(
          "group/grp relative flex items-center gap-1.5 py-1 pr-1.5 rounded-md mx-1 transition-colors",
          isDropTarget
            ? "bg-emerald-50 dark:bg-emerald-950/30 ring-2 ring-inset ring-emerald-400"
            : isSelected
              ? "bg-primary/10 ring-1 ring-inset ring-primary/30"
              : "bg-muted/30 hover:bg-muted/50"
        )}
        style={{ paddingLeft: indent }}
        onClick={() => ctx.onSelectGroup(group.id)}
        onDoubleClick={() => setExpanded((v) => !v)}
      >
        <GroupColorBadge color={group.color} />

        <span className="flex-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground truncate">
          {group.name}
        </span>
        <span className="text-[9px] text-muted-foreground shrink-0 mr-1">{members.length}</span>

        {ctx.canManage && showDropZone && (
          <GroupAssignDropZone
            groupId={group.id}
            isActive={isDropTarget}
            title={ctx.t("actions.assignToGroup")}
          />
        )}

        <button
          type="button"
          className="shrink-0 w-3.5 h-3.5 flex items-center justify-center text-muted-foreground hover:text-foreground"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
        >
          {expanded ? (
            <ChevronDown className="w-2.5 h-2.5" />
          ) : (
            <ChevronRight className="w-2.5 h-2.5" />
          )}
        </button>

        {/* drag handle */}
        {dragHandleProps && ctx.canManage && (
          <button
            type="button"
            {...dragHandleProps}
            className="shrink-0 touch-none cursor-grab active:cursor-grabbing text-muted-foreground/30 group-hover/grp:text-muted-foreground transition-colors"
            onClick={(e) => e.stopPropagation()}
            tabIndex={-1}
          >
            <GripVertical className="w-3 h-3" />
          </button>
        )}
      </div>

      {expanded &&
        (members.length === 0 ? (
          <div
            className="flex items-center gap-1 py-1.5 text-[10px] text-muted-foreground italic"
            style={{ paddingLeft: indent + 20 }}
          >
            <FolderOpen className="w-3 h-3 shrink-0" />
            {ctx.t("states.emptyGroup")}
          </div>
        ) : (
          <DndContext
            sensors={memberSensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragStart={(e) => setMemberActiveId(e.active.id as string)}
            onDragEnd={handleMemberDragEnd}
          >
            <SortableContext
              items={members.map((m) => m.id)}
              strategy={verticalListSortingStrategy}
            >
              {members.map((member) => (
                <SortableNodeWrapper key={member.id} id={member.id} dataType="location">
                  {(handle) => (
                    <ToolboxLocationRow
                      location={member}
                      depth={depth + 1}
                      ctx={ctx}
                      dragHandleProps={handle}
                      onUngroup={() => ctx.onUngroup(member.id)}
                    />
                  )}
                </SortableNodeWrapper>
              ))}
            </SortableContext>

            <DragOverlay dropAnimation={null}>
              {activeMember && <DragPreview location={activeMember} groups={ctx.groups} />}
            </DragOverlay>
          </DndContext>
        ))}
    </>
  );
}

// ─── ToolboxChildrenList ──────────────────────────────────────────────────────
//
// Renders a location's direct children + inline groups. parentId may be null
// for the root level (locations with parent_id = null).
// Each ToolboxChildrenList has its own DnD context for reordering and
// drop-to-group.

function ToolboxChildrenList({
  parentId,
  ctx,
  depth,
}: {
  parentId: string | null;
  ctx: ToolboxCtx;
  depth: number;
}) {
  const [localActiveId, setLocalActiveId] = React.useState<string | null>(null);
  const [dropTargetGroupId, setDropTargetGroupId] = React.useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const myGroups = ctx.groups
    .filter((g) => g.parent_location_id === parentId)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));

  const knownGroupIds = new Set(myGroups.map((g) => g.id));

  const children = ctx.allLocations
    .filter((l) => l.parent_id === parentId)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));

  const groupedChildIds = new Set(
    children.filter((c) => c.group_id && knownGroupIds.has(c.group_id)).map((c) => c.id)
  );

  const ungroupedChildren = children.filter((c) => !groupedChildIds.has(c.id));

  type Item = { kind: "group"; g: WarehouseLocationGroup } | { kind: "loc"; l: WarehouseLocation };

  const items: Item[] = [
    ...myGroups.map((g) => ({ kind: "group" as const, g })),
    ...ungroupedChildren.map((l) => ({ kind: "loc" as const, l })),
  ].sort((a, b) => {
    const ao = a.kind === "group" ? a.g.sort_order : a.l.sort_order;
    const bo = b.kind === "group" ? b.g.sort_order : b.l.sort_order;
    return ao - bo;
  });

  const allIds = items.map((item) => (item.kind === "group" ? item.g.id : item.l.id));

  function handleDragStart(e: DragStartEvent) {
    setLocalActiveId(e.active.id as string);
  }

  function handleDragOver(e: DragOverEvent) {
    const overData = e.over?.data.current as { type?: string; groupId?: string } | null;
    if (!overData?.type || !localActiveId) {
      setDropTargetGroupId(null);
      return;
    }
    const activeIsUngrouped = ungroupedChildren.some((l) => l.id === localActiveId);
    setDropTargetGroupId(
      activeIsUngrouped && overData.type === "group-dropzone" ? (overData.groupId ?? null) : null
    );
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    setLocalActiveId(null);
    setDropTargetGroupId(null);
    if (!over || active.id === over.id) return;

    const activeStr = active.id as string;
    const overStr = over.id as string;
    const overData = over.data.current as { type?: string; groupId?: string } | null;
    const overType = overData?.type;

    const activeIsGroup = myGroups.some((g) => g.id === activeStr);
    const activeIsUngrouped = ungroupedChildren.some((l) => l.id === activeStr);

    if (activeIsUngrouped && overType === "group-dropzone" && overData?.groupId) {
      ctx.onAssignToGroup(activeStr, overData.groupId);
      return;
    }

    if (!activeIsGroup && !activeIsUngrouped) return;

    const oldIdx = items.findIndex((item) =>
      item.kind === "group" ? item.g.id === activeStr : item.l.id === activeStr
    );
    const newIdx = items.findIndex((item) =>
      item.kind === "group" ? item.g.id === overStr : item.l.id === overStr
    );
    if (oldIdx === -1 || newIdx === -1) return;

    const reordered = arrayMove(items, oldIdx, newIdx);

    const groupUpdates = reordered.flatMap((item, i) =>
      item.kind === "group" ? [{ id: item.g.id, sort_order: i }] : []
    );
    const locationUpdates = reordered.flatMap((item, i) =>
      item.kind === "loc" ? [{ id: item.l.id, sort_order: i }] : []
    );

    if (groupUpdates.length > 0) ctx.onReorderGroups(groupUpdates);
    if (locationUpdates.length > 0) ctx.onReorderSiblings(parentId, locationUpdates);
  }

  const activeItem = localActiveId
    ? items.find((item) =>
        item.kind === "group" ? item.g.id === localActiveId : item.l.id === localActiveId
      )
    : null;
  const showGroupDropZones =
    !!localActiveId && ungroupedChildren.some((location) => location.id === localActiveId);

  if (items.length === 0) return null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={allIds} strategy={verticalListSortingStrategy}>
        {items.map((item) =>
          item.kind === "group" ? (
            <SortableNodeWrapper key={item.g.id} id={item.g.id} dataType="group">
              {(handle) => (
                <ToolboxGroupSection
                  group={item.g}
                  members={children
                    .filter((c) => c.group_id === item.g.id)
                    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))}
                  depth={depth}
                  ctx={ctx}
                  isSelected={ctx.selectedGroupId === item.g.id}
                  isDropTarget={dropTargetGroupId === item.g.id}
                  showDropZone={showGroupDropZones}
                  dragHandleProps={handle}
                />
              )}
            </SortableNodeWrapper>
          ) : (
            <SortableNodeWrapper key={item.l.id} id={item.l.id} dataType="location">
              {(handle) => (
                <ToolboxLocationRow
                  location={item.l}
                  depth={depth}
                  ctx={ctx}
                  dragHandleProps={handle}
                />
              )}
            </SortableNodeWrapper>
          )
        )}
      </SortableContext>

      <DragOverlay dropAnimation={null}>
        {activeItem &&
          (activeItem.kind === "group" ? (
            <div className="flex items-center gap-1.5 rounded-md border bg-muted/80 shadow-lg px-2 py-1 text-[10px] font-semibold uppercase tracking-wide w-48 opacity-90">
              <Layers className="w-3 h-3 text-muted-foreground shrink-0" />
              <span className="truncate">{activeItem.g.name}</span>
            </div>
          ) : (
            <DragPreview location={activeItem.l} groups={ctx.groups} />
          ))}
      </DragOverlay>
    </DndContext>
  );
}

// ─── ToolboxLocationRow ───────────────────────────────────────────────────────

function ToolboxLocationRow({
  location,
  depth,
  ctx,
  dragHandleProps,
  onUngroup,
}: {
  location: WarehouseLocation;
  depth: number;
  ctx: ToolboxCtx;
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
  onUngroup?: () => void;
}) {
  const [expanded, setExpanded] = React.useState(true);

  const children = ctx.allLocations.filter((l) => l.parent_id === location.id);
  const myGroups = ctx.groups.filter((g) => g.parent_location_id === location.id);
  const hasChildren = children.length > 0 || myGroups.length > 0;
  const isPlaced = ctx.placedLocationIds.has(location.id);

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-1.5 py-1 pr-1.5 rounded-md mx-1 transition-colors group/node",
          isPlaced ? "cursor-pointer hover:bg-accent" : "cursor-default hover:bg-muted/50"
        )}
        style={{ paddingLeft: 2 + depth * 10 }}
        onClick={() => {
          if (isPlaced) ctx.onSelect(location.id);
        }}
      >
        <LocationColorBadge color={getEffectiveLocationColor(location, ctx.groups)} />

        <span className="text-xs truncate flex-1 min-w-0">{location.name}</span>
        {location.code && (
          <span className="text-[10px] font-mono text-muted-foreground shrink-0">
            {location.code}
          </span>
        )}
        {isPlaced && (
          <div
            className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 ml-1"
            title={ctx.t("indicators.placedOnCanvas")}
          />
        )}
        {onUngroup && ctx.canManage && (
          <button
            type="button"
            className="shrink-0 opacity-0 group-hover/node:opacity-100 focus:opacity-100 transition-opacity text-muted-foreground/50 hover:text-amber-600 ml-0.5"
            onClick={(e) => {
              e.stopPropagation();
              onUngroup();
            }}
            tabIndex={-1}
            title={ctx.t("actions.ungroup")}
          >
            <X className="w-3 h-3" />
          </button>
        )}

        {/* Expand toggle */}
        <button
          type="button"
          className={cn(
            "shrink-0 w-3.5 h-3.5 flex items-center justify-center text-muted-foreground hover:text-foreground",
            !hasChildren && "invisible pointer-events-none"
          )}
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
        >
          {expanded ? (
            <ChevronDown className="w-2.5 h-2.5" />
          ) : (
            <ChevronRight className="w-2.5 h-2.5" />
          )}
        </button>

        {/* Drag handle */}
        <button
          type="button"
          className="shrink-0 touch-none cursor-grab active:cursor-grabbing text-muted-foreground/30 group-hover/node:text-muted-foreground transition-colors"
          {...(dragHandleProps ?? {})}
          onClick={(e) => e.stopPropagation()}
          tabIndex={-1}
        >
          <GripVertical className="w-3 h-3" />
        </button>
      </div>

      {expanded && hasChildren && (
        <ToolboxChildrenList parentId={location.id} ctx={ctx} depth={depth + 1} />
      )}
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface LocationToolboxProps {
  locations: WarehouseLocation[];
  locationGroups: WarehouseLocationGroup[];
  rootLocationId: string | null;
  branchId: string;
  placedLocationIds: Set<string>;
  selectedId: string | null;
  selectedGroupId: string | null;
  onSelectLocation: (locationId: string) => void;
  onSelectGroup: (groupId: string) => void;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function LocationToolbox({
  locations,
  locationGroups,
  rootLocationId,
  branchId,
  placedLocationIds,
  selectedId: _selectedId,
  selectedGroupId,
  onSelectLocation,
  onSelectGroup,
}: LocationToolboxProps) {
  const t = useTranslations("warehouseMapToolbox");
  const [treeOpen, setTreeOpen] = React.useState(true);
  const [shapesOpen, setShapesOpen] = React.useState(true);
  const [unplacedOpen, setUnplacedOpen] = React.useState(true);
  const [deleteLocTarget, setDeleteLocTarget] = React.useState<WarehouseLocation | null>(null);

  const deleteLocMut = useDeleteLocationMutation(branchId);
  const reorderMut = useReorderLocationsMutation(branchId);
  const reorderGroupsMut = useReorderGroupsMutation(branchId);
  const updateLocationMut = useUpdateLocationMutation(branchId);

  // Determine if user can manage (editor only renders toolbox when canManage=true,
  // but we derive it from whether the mutation hooks are available)
  const canManage = true; // LocationToolbox is only rendered when canManage is true in map-editor.tsx

  // All locations under rootLocationId (or all if no root)
  const allLocations = React.useMemo(() => {
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

  const unplaced = allLocations.filter((l) => !placedLocationIds.has(l.id));

  // ── Callbacks ────────────────────────────────────────────────────────────────

  function handleReorderSiblings(
    _parentId: string | null,
    items: { id: string; sort_order: number }[]
  ) {
    reorderMut.mutate({ items });
  }

  function handleReorderGroups(items: { id: string; sort_order: number }[]) {
    reorderGroupsMut.mutate({ items });
  }

  function handleAssignToGroup(locationId: string, groupId: string) {
    updateLocationMut.mutate({ id: locationId, group_id: groupId });
  }

  function handleUngroup(locationId: string) {
    updateLocationMut.mutate({ id: locationId, group_id: null });
  }

  const ctx: ToolboxCtx = {
    allLocations,
    groups: locationGroups,
    placedLocationIds,
    selectedGroupId,
    canManage,
    onSelect: onSelectLocation,
    onSelectGroup,
    onReorderSiblings: handleReorderSiblings,
    onReorderGroups: handleReorderGroups,
    onAssignToGroup: handleAssignToGroup,
    onUngroup: handleUngroup,
    t,
  };

  return (
    <div className="w-56 h-full border-r bg-background flex flex-col shrink-0 overflow-hidden">
      {/* ── Locations tree ─────────────────────────────────────────────── */}
      <SectionHeader
        title={t("sections.locations")}
        count={allLocations.length}
        open={treeOpen}
        onToggle={() => setTreeOpen((v) => !v)}
      />
      {treeOpen && (
        <div className="overflow-y-auto border-b py-1 max-h-52 shrink-0">
          {allLocations.length === 0 ? (
            <p className="text-[10px] text-muted-foreground px-3 py-2 leading-relaxed">
              {t("states.noLocations")}
            </p>
          ) : (
            // Render the root level via ToolboxChildrenList so groups attached
            // to rootLocationId (or null for top-level) are shown correctly.
            <ToolboxChildrenList parentId={rootLocationId} ctx={ctx} depth={0} />
          )}
        </div>
      )}

      {/* ── Shapes palette ─────────────────────────────────────────────── */}
      <SectionHeader
        title={t("sections.shapes")}
        open={shapesOpen}
        onToggle={() => setShapesOpen((v) => !v)}
      />
      {shapesOpen && (
        <div className="p-3 border-b shrink-0">
          <div className="grid grid-cols-3 gap-2">
            {PALETTE.map((item) => (
              <PaletteChip key={item.type} item={item} t={t} />
            ))}
          </div>
        </div>
      )}

      {/* ── Unplaced locations ──────────────────────────────────────────── */}
      <SectionHeader
        title={t("sections.unplaced")}
        count={unplaced.length}
        open={unplacedOpen}
        onToggle={() => setUnplacedOpen((v) => !v)}
      />
      {unplacedOpen && (
        <div className="flex-1 overflow-y-auto">
          {unplaced.length === 0 ? (
            <div className="p-4 text-center text-[10px] text-muted-foreground">
              {t("states.allPlaced")}
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {unplaced.map((loc) => (
                <div
                  key={loc.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("shapeType", "location");
                    e.dataTransfer.setData("locationId", loc.id);
                    e.dataTransfer.effectAllowed = "copy";
                  }}
                  className={cn(
                    "flex items-center gap-2 pl-2.5 pr-1 py-1.5 rounded-md border",
                    "cursor-grab active:cursor-grabbing hover:bg-accent hover:border-border",
                    "transition-all select-none bg-background"
                  )}
                >
                  <div
                    className="w-2.5 h-2.5 rounded-sm shrink-0"
                    style={{
                      backgroundColor: getEffectiveLocationColor(loc, locationGroups) ?? "#10b981",
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate">{loc.name}</p>
                    {loc.code && (
                      <p className="text-[10px] font-mono text-muted-foreground truncate">
                        {loc.code}
                      </p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0 text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10"
                    onClick={() => setDeleteLocTarget(loc)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Delete location confirmation ─────────────────────────────────── */}
      <AlertDialog
        open={!!deleteLocTarget}
        onOpenChange={(open) => !open && setDeleteLocTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteDialog.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteDialog.description", { name: deleteLocTarget?.name ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLocMut.isPending}>
              {t("actions.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteLocMut.isPending}
              onClick={() => {
                if (!deleteLocTarget) return;
                deleteLocMut.mutate(deleteLocTarget.id, {
                  onSuccess: () => setDeleteLocTarget(null),
                });
              }}
            >
              {deleteLocMut.isPending ? t("actions.deleting") : t("actions.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
