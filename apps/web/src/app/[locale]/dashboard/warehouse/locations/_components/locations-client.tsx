"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  MapPin,
  Map as MapIcon,
  LayoutGrid,
  Plus,
  Copy,
  GitBranch,
  Pencil,
  Trash2,
  MoreVertical,
  ChevronRight,
  ChevronDown,
  Globe,
  FileEdit,
  GripVertical,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
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
import { toast } from "react-toastify";
import { usePermissions } from "@/hooks/v2/use-permissions";
import { useAppStoreV2 } from "@/lib/stores/v2/app-store";
import { useRouter } from "@/i18n/navigation";
import {
  WAREHOUSE_LOCATIONS_READ,
  WAREHOUSE_LOCATIONS_MANAGE,
  WAREHOUSE_LAYOUTS_MANAGE,
} from "@/lib/constants/permissions";
import {
  useWarehouseLocationsQuery,
  useWarehouseLayoutsQuery,
  useWarehouseLocationGroupsQuery,
  useCreateLayoutForLocationMutation,
  useCreateLocationMutation,
  useUpdateLocationMutation,
  useDeleteLocationMutation,
  usePlacedLocationIdsQuery,
  useReorderLocationsMutation,
  useCreateLocationGroupMutation,
  useUpdateLocationGroupMutation,
  useDeleteLocationGroupMutation,
  useReorderGroupsMutation,
} from "@/hooks/queries/warehouse";
import { buildLocationTree, getEffectiveLocationColor } from "@/lib/warehouse/location-tree";
import { resolveLocationMapContext } from "@/lib/warehouse/map-context";
import type {
  WarehouseLocation,
  WarehouseLocationTreeNode,
  WarehouseLocationGroup,
} from "@/lib/warehouse/location-tree";
import type { WarehouseLayout } from "@/lib/warehouse/layouts";
import type { CreateLocationInput, UpdateLocationInput } from "@/app/actions/warehouse/schemas";
import type {
  CreateLocationGroupInput,
  UpdateLocationGroupInput,
  ReorderGroupsInput,
  ReorderLocationsInput,
} from "@/app/actions/warehouse/schemas";
import { LocationFormDialog } from "@/app/[locale]/dashboard/warehouse/locations/_components/location-form-dialog";
import { LocationGroupFormDialog } from "@/app/[locale]/dashboard/warehouse/locations/_components/location-group-form-dialog";
import { WarehouseMapDialog } from "@/components/v2/warehouse/warehouse-map-dialog";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function findRootAncestor(
  locationId: string,
  locations: WarehouseLocation[]
): WarehouseLocation | null {
  const byId = new Map(locations.map((l) => [l.id, l]));
  let current = byId.get(locationId);
  while (current?.parent_id) {
    current = byId.get(current.parent_id);
  }
  return current ?? null;
}

function buildLocationPath(locationId: string, locations: WarehouseLocation[]): string {
  const byId = new Map(locations.map((location) => [location.id, location]));
  const path: string[] = [];
  let current = byId.get(locationId);

  while (current) {
    path.unshift(current.code?.trim() || current.name);
    current = current.parent_id ? byId.get(current.parent_id) : undefined;
  }

  return path.join("/");
}

function getDescendantLocationIds(locationId: string, locations: WarehouseLocation[]): string[] {
  const childrenByParentId = new Map<string | null, WarehouseLocation[]>();

  for (const location of locations) {
    const siblings = childrenByParentId.get(location.parent_id ?? null) ?? [];
    siblings.push(location);
    childrenByParentId.set(location.parent_id ?? null, siblings);
  }

  const descendantIds: string[] = [];
  const queue = [...(childrenByParentId.get(locationId) ?? [])];

  while (queue.length > 0) {
    const current = queue.shift()!;
    descendantIds.push(current.id);
    const children = childrenByParentId.get(current.id);
    if (children?.length) {
      queue.push(...children);
    }
  }

  return descendantIds;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface LocationsClientProps {
  initialLocations: WarehouseLocation[];
  initialGroups: WarehouseLocationGroup[];
}

// ─── Shared context passed through the tree ───────────────────────────────────

interface TreeCtx {
  t: ReturnType<typeof useTranslations<"warehouseLocationsPage">>;
  canManage: boolean;
  canManageLayouts: boolean;
  allLocations: WarehouseLocation[];
  groups: WarehouseLocationGroup[];
  placedLocationIds: Set<string>;
  layoutByLocationId: Record<string, WarehouseLayout>;
  onEdit: (l: WarehouseLocation) => void;
  onClone: (l: WarehouseLocation) => void;
  onDelete: (l: WarehouseLocation) => void;
  onShowOnMap: (l: WarehouseLocation) => void;
  onPreviewMap: (l: WarehouseLocation) => void;
  onOpenEditor: (layoutId: string) => void;
  onCreateMap: (l: WarehouseLocation) => void;
  onCreateGroup: (l: WarehouseLocation) => void;
  onEditGroup: (g: WarehouseLocationGroup) => void;
  onDeleteGroup: (g: WarehouseLocationGroup) => void;
  onPreviewGroupOnMap: (
    group: WarehouseLocationGroup,
    members: WarehouseLocationTreeNode[]
  ) => void;
  onReorderGroups: (input: ReorderGroupsInput) => void;
  onReorderChildLocations: (input: ReorderLocationsInput) => void;
  onAssignToGroup: (locationId: string, groupId: string) => void;
  onCopyLocationCode: (l: WarehouseLocation) => void;
  onCopyLocationPath: (l: WarehouseLocation) => void;
  canPreviewLocationOnMap: (l: WarehouseLocation) => boolean;
}

// ─── Shared drag sensors ──────────────────────────────────────────────────────

function useTreeSensors() {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
}

// ─── SortableNodeWrapper ──────────────────────────────────────────────────────
//
// Generic wrapper that makes any tree item (group or location) sortable.
// Uses render-props to inject the drag handle attributes into the child.

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
      {children({
        ...attributes,
        ...listeners,
      } as React.HTMLAttributes<HTMLButtonElement>)}
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
      className={`pointer-events-none absolute inset-y-1.5 right-24 w-12 rounded-full border transition-colors ${
        isActive || isOver
          ? "border-emerald-500 bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
          : "border-transparent bg-transparent"
      }`}
      title={title}
      aria-label={title}
    />
  );
}

function GroupColorBadge({ color }: { color: string | null }) {
  if (!color) {
    return (
      <div className="flex h-5 w-5 shrink-0 items-center justify-center">
        <Layers className="h-3.5 w-3.5 text-muted-foreground/50" />
      </div>
    );
  }

  return (
    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md">
      <Layers className="h-3.5 w-3.5" style={{ color }} strokeWidth={2.25} />
    </div>
  );
}

function LocationColorBadge({ color }: { color: string | null }) {
  return (
    <div className="flex h-5 w-5 shrink-0 items-center justify-center">
      <div
        className="h-3 w-3 rounded-full shrink-0 border"
        style={{ backgroundColor: color ?? "#10b981" }}
      />
    </div>
  );
}

function RowMenu({
  triggerLabel,
  tooltipLabel,
  children,
}: {
  triggerLabel: string;
  tooltipLabel: string;
  children: React.ReactNode;
}) {
  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <DropdownMenu>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 text-muted-foreground"
                aria-label={triggerLabel}
                onClick={(event) => event.stopPropagation()}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <DropdownMenuContent align="end" className="w-52">
            {children}
          </DropdownMenuContent>
        </DropdownMenu>
        <TooltipContent>{tooltipLabel}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function LocationCodeActions({
  code,
  fullPath,
  onCopyCode,
  onCopyPath,
  codeTooltipLabel,
  copyCodeLabel,
  copyPathLabel,
}: {
  code: string;
  fullPath: string;
  onCopyCode: () => void;
  onCopyPath: () => void;
  codeTooltipLabel: string;
  copyCodeLabel: string;
  copyPathLabel: string;
}) {
  const [showFullPathPreview, setShowFullPathPreview] = useState(false);
  const displayedValue = showFullPathPreview ? fullPath : code;

  return (
    <div
      className="group/code flex items-center justify-end"
      onClick={(event) => event.stopPropagation()}
    >
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="block max-w-[16rem] cursor-default truncate text-xs font-mono text-muted-foreground transition-all duration-200 ease-out group-hover/code:-translate-x-1.5 group-focus-within/code:-translate-x-1.5">
              {displayedValue}
            </span>
          </TooltipTrigger>
          <TooltipContent>{codeTooltipLabel}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <div className="ml-0 flex w-0 items-center gap-1 overflow-hidden opacity-0 transition-all duration-200 ease-out group-hover/code:ml-2 group-hover/code:w-[3.5rem] group-hover/code:opacity-100 group-focus-within/code:ml-2 group-focus-within/code:w-[3.5rem] group-focus-within/code:opacity-100">
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0 text-muted-foreground transition-transform duration-200 ease-out hover:text-foreground group-hover/code:translate-x-0 translate-x-2 group-focus-within/code:translate-x-0"
                aria-label={copyCodeLabel}
                onClick={(event) => {
                  event.stopPropagation();
                  onCopyCode();
                }}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{copyCodeLabel}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0 text-muted-foreground transition-transform duration-200 ease-out delay-75 hover:text-foreground group-hover/code:translate-x-0 translate-x-2 group-focus-within/code:translate-x-0"
                aria-label={copyPathLabel}
                onMouseEnter={() => setShowFullPathPreview(true)}
                onMouseLeave={() => setShowFullPathPreview(false)}
                onFocus={() => setShowFullPathPreview(true)}
                onBlur={() => setShowFullPathPreview(false)}
                onClick={(event) => {
                  event.stopPropagation();
                  onCopyPath();
                }}
              >
                <GitBranch className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{copyPathLabel}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}

function LocationNameLabel({
  name,
  description,
  className,
}: {
  name: string;
  description: string | null;
  className: string;
}) {
  if (!description?.trim()) {
    return <span className={className}>{name}</span>;
  }

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={className}>{name}</span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs whitespace-pre-wrap break-words">
          {description}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ─── ChildrenList ─────────────────────────────────────────────────────────────
//
// Renders a location's direct children, interleaving inline groups with
// ungrouped children. Each ChildrenList has its own local DnD context so:
//   - groups can be reordered among themselves
//   - ungrouped locations can be reordered
//   - an ungrouped location can be dragged onto a group to assign it

function ChildrenList({
  parentNode,
  depth,
  ctx,
}: {
  parentNode: WarehouseLocationTreeNode;
  depth: number;
  ctx: TreeCtx;
}) {
  const [localActiveId, setLocalActiveId] = useState<string | null>(null);
  const [dropTargetGroupId, setDropTargetGroupId] = useState<string | null>(null);

  const sensors = useTreeSensors();

  // Groups whose parent_location_id matches this node
  const myGroups = ctx.groups
    .filter((g) => g.parent_location_id === parentNode.id)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));

  const knownGroupIds = new Set(myGroups.map((g) => g.id));

  // Children assigned to one of this node's groups
  const groupedChildIds = new Set(
    parentNode.children.filter((c) => c.group_id && knownGroupIds.has(c.group_id)).map((c) => c.id)
  );

  // Children NOT in any known group
  const ungroupedChildren = parentNode.children
    .filter((c) => !groupedChildIds.has(c.id))
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));

  // Interleave groups and ungrouped children by sort_order
  type Item =
    | { kind: "group"; g: WarehouseLocationGroup }
    | { kind: "loc"; n: WarehouseLocationTreeNode };

  const items: Item[] = [
    ...myGroups.map((g) => ({ kind: "group" as const, g })),
    ...ungroupedChildren.map((n) => ({ kind: "loc" as const, n })),
  ].sort((a, b) => {
    const ao = a.kind === "group" ? a.g.sort_order : a.n.sort_order;
    const bo = b.kind === "group" ? b.g.sort_order : b.n.sort_order;
    return ao - bo;
  });

  const allIds = items.map((item) => (item.kind === "group" ? item.g.id : item.n.id));

  // ── DnD handlers ──────────────────────────────────────────────────────────

  function handleDragStart(e: DragStartEvent) {
    setLocalActiveId(e.active.id as string);
  }

  function handleDragOver(e: DragOverEvent) {
    const overType = (e.over?.data.current as { type?: string } | null)?.type;
    const overGroupId = (e.over?.data.current as { groupId?: string } | null)?.groupId ?? null;

    if (!overType || !localActiveId) {
      setDropTargetGroupId(null);
      return;
    }
    const activeIsLocation = ungroupedChildren.some((n) => n.id === localActiveId);
    setDropTargetGroupId(activeIsLocation && overType === "group-dropzone" ? overGroupId : null);
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
    const overGroupId = overData?.groupId;

    const activeIsGroup = myGroups.some((g) => g.id === activeStr);
    const activeIsLocation = ungroupedChildren.some((n) => n.id === activeStr);

    if (activeIsLocation && overType === "group-dropzone" && overGroupId) {
      ctx.onAssignToGroup(activeStr, overGroupId);
      return;
    }

    if (!activeIsGroup && !activeIsLocation) return;

    const oldIdx = items.findIndex((item) =>
      item.kind === "group" ? item.g.id === activeStr : item.n.id === activeStr
    );
    const newIdx = items.findIndex((item) =>
      item.kind === "group" ? item.g.id === overStr : item.n.id === overStr
    );
    if (oldIdx === -1 || newIdx === -1) return;

    const reordered = arrayMove(items, oldIdx, newIdx);

    const groupUpdates = reordered.flatMap((item, index) =>
      item.kind === "group" ? [{ id: item.g.id, sort_order: index }] : []
    );
    const locationUpdates = reordered.flatMap((item, index) =>
      item.kind === "loc" ? [{ id: item.n.id, sort_order: index }] : []
    );

    if (groupUpdates.length > 0) {
      ctx.onReorderGroups({ items: groupUpdates });
    }
    if (locationUpdates.length > 0) {
      ctx.onReorderChildLocations({ items: locationUpdates });
    }
  }

  const activeItem = localActiveId
    ? items.find((item) =>
        item.kind === "group" ? item.g.id === localActiveId : item.n.id === localActiveId
      )
    : null;
  const showGroupDropZones =
    !!localActiveId && ungroupedChildren.some((node) => node.id === localActiveId);

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
              {(groupDragHandle) => (
                <InlineGroupSection
                  group={item.g}
                  members={parentNode.children
                    .filter((c) => c.group_id === item.g.id)
                    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))}
                  depth={depth}
                  ctx={ctx}
                  isDropTarget={dropTargetGroupId === item.g.id}
                  showDropZone={showGroupDropZones}
                  dragHandleProps={groupDragHandle}
                />
              )}
            </SortableNodeWrapper>
          ) : (
            <SortableNodeWrapper key={item.n.id} id={item.n.id} dataType="location">
              {(childDragHandle) => (
                <TreeNodeRow
                  node={item.n}
                  depth={depth}
                  ctx={ctx}
                  dragHandleProps={childDragHandle}
                />
              )}
            </SortableNodeWrapper>
          )
        )}
      </SortableContext>

      <DragOverlay dropAnimation={null}>
        {activeItem &&
          (activeItem.kind === "group" ? (
            <div className="flex items-center gap-2 rounded-md border bg-muted/80 shadow-lg px-3 py-2 text-xs font-semibold uppercase tracking-wide w-56 opacity-90">
              <Layers className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="truncate">{activeItem.g.name}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-md border bg-background shadow-lg px-3 py-2 text-sm font-medium w-64 opacity-90">
              {getEffectiveLocationColor(activeItem.n, ctx.groups, ctx.allLocations) && (
                <div
                  className="h-3 w-3 shrink-0 rounded-full border"
                  style={{
                    backgroundColor: getEffectiveLocationColor(
                      activeItem.n,
                      ctx.groups,
                      ctx.allLocations
                    )!,
                  }}
                />
              )}
              <span className="flex-1 truncate">{activeItem.n.name}</span>
            </div>
          ))}
      </DragOverlay>
    </DndContext>
  );
}

// ─── InlineGroupSection ───────────────────────────────────────────────────────
//
// Inline collapsible group header within a location's children list.
// Has its own DnD context for reordering members within the group.

function InlineGroupSection({
  group,
  members,
  depth,
  ctx,
  isDropTarget = false,
  showDropZone = false,
  dragHandleProps,
}: {
  group: WarehouseLocationGroup;
  members: WarehouseLocationTreeNode[];
  depth: number;
  ctx: TreeCtx;
  isDropTarget?: boolean;
  showDropZone?: boolean;
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [memberActiveId, setMemberActiveId] = useState<string | null>(null);
  const { t, canManage, placedLocationIds } = ctx;
  const indent = depth * 20 + 8;
  const hasPlacedMembers = members.some((member) => placedLocationIds.has(member.id));

  const memberSensors = useTreeSensors();

  function handleMemberDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setMemberActiveId(null);
    if (!over || active.id === over.id) return;
    const oldIdx = members.findIndex((m) => m.id === (active.id as string));
    const newIdx = members.findIndex((m) => m.id === (over.id as string));
    if (oldIdx === -1 || newIdx === -1) return;
    const reordered = arrayMove(members, oldIdx, newIdx);
    ctx.onReorderChildLocations({
      items: reordered.map((m, i) => ({ id: m.id, sort_order: i })),
    });
  }

  const activeMember = memberActiveId ? members.find((m) => m.id === memberActiveId) : null;

  return (
    <>
      {/* Group header row */}
      <div
        className={`group/grp relative flex items-center gap-2 rounded-md px-2 py-2 transition-colors ${
          isDropTarget
            ? "bg-emerald-50 dark:bg-emerald-950/30 ring-2 ring-inset ring-emerald-400"
            : "bg-muted/30 hover:bg-muted/50"
        }`}
        style={{ paddingLeft: `${indent}px` }}
        onClick={() => setExpanded((v) => !v)}
      >
        <button
          type="button"
          className="h-4 w-4 shrink-0 text-muted-foreground"
          onClick={(event) => {
            event.stopPropagation();
            setExpanded((v) => !v);
          }}
          aria-label={expanded ? t("tree.collapse") : t("tree.expand")}
        >
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>

        <GroupColorBadge color={group.color} />

        <span className="flex-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {group.name}
        </span>
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
          {members.length}
        </Badge>

        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex">
                <Button
                  variant="ghost"
                  size="icon"
                  className={
                    hasPlacedMembers
                      ? "h-7 w-7 shrink-0 text-muted-foreground hover:text-emerald-600"
                      : "h-7 w-7 shrink-0 text-muted-foreground/30 cursor-not-allowed"
                  }
                  onClick={(event) => {
                    event.stopPropagation();
                    if (hasPlacedMembers) {
                      ctx.onPreviewGroupOnMap(group, members);
                    }
                  }}
                  disabled={!hasPlacedMembers}
                >
                  <MapIcon className="h-3.5 w-3.5" />
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {hasPlacedMembers ? t("actions.previewGroupOnMap") : t("groups.noPlacedMembers")}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {canManage && showDropZone && (
          <GroupAssignDropZone
            groupId={group.id}
            isActive={isDropTarget}
            title={t("groups.addLocation")}
          />
        )}

        {canManage && (
          <RowMenu triggerLabel={group.name} tooltipLabel={t("actions.moreActions")}>
            <DropdownMenuItem onClick={() => ctx.onEditGroup(group)}>
              <Pencil className="mr-2 h-4 w-4" />
              {t("groups.editGroup")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => ctx.onDeleteGroup(group)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {t("groups.deleteGroup")}
            </DropdownMenuItem>
          </RowMenu>
        )}

        {/* Drag handle for group reordering */}
        {canManage && dragHandleProps && (
          <button
            type="button"
            {...dragHandleProps}
            className="h-6 w-6 shrink-0 flex items-center justify-center text-muted-foreground/40 hover:text-muted-foreground touch-none cursor-grab active:cursor-grabbing"
            aria-label={t("actions.dragToReorder")}
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Members — with their own DnD for reordering within the group */}
      {expanded &&
        (members.length === 0 ? (
          <div
            className="flex items-center gap-2 py-2.5 text-xs text-muted-foreground italic"
            style={{ paddingLeft: `${indent + 24}px` }}
          >
            <Layers className="h-3.5 w-3.5 shrink-0" />
            {t("groups.emptyGroup")}
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
                  {(memberDragHandle) => (
                    <TreeNodeRow
                      node={member}
                      depth={depth + 1}
                      ctx={ctx}
                      dragHandleProps={memberDragHandle}
                    />
                  )}
                </SortableNodeWrapper>
              ))}
            </SortableContext>

            <DragOverlay dropAnimation={null}>
              {activeMember && (
                <div className="flex items-center gap-2 rounded-md border bg-background shadow-lg px-3 py-2 text-sm font-medium w-64 opacity-90">
                  {getEffectiveLocationColor(activeMember, ctx.groups, ctx.allLocations) && (
                    <div
                      className="h-3 w-3 shrink-0 rounded-full border"
                      style={{
                        backgroundColor: getEffectiveLocationColor(
                          activeMember,
                          ctx.groups,
                          ctx.allLocations
                        )!,
                      }}
                    />
                  )}
                  <span className="flex-1 truncate">{activeMember.name}</span>
                </div>
              )}
            </DragOverlay>
          </DndContext>
        ))}
    </>
  );
}

// ─── TreeNodeRow ──────────────────────────────────────────────────────────────

function TreeNodeRow({
  node,
  depth,
  ctx,
  layout,
  dragHandleProps,
}: {
  node: WarehouseLocationTreeNode;
  depth: number;
  ctx: TreeCtx;
  layout?: WarehouseLayout | null;
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
}) {
  const [expanded, setExpanded] = useState(false);
  const { t, canManage, canManageLayouts, placedLocationIds } = ctx;
  const hasChildren = node.children.length > 0;
  const isLogicalContainer = (node.map_role ?? "logical") === "logical";
  const isRoot = depth === 0;
  const isPlaced = placedLocationIds.has(node.id);
  const canPreviewOnMap = isRoot || ctx.canPreviewLocationOnMap(node);
  const effectiveColor = getEffectiveLocationColor(node, ctx.groups, ctx.allLocations);
  const rootMapStatusLabel = layout
    ? layout.status === "published"
      ? t("badges.published")
      : t("badges.draft")
    : t("badges.noMap");
  const rootMapActionLabel = layout
    ? t("actions.previewMap")
    : canManageLayouts
      ? t("actions.createMapForLocation")
      : t("badges.noMap");

  return (
    <>
      <div
        className={`group/row flex items-center gap-2 rounded-md px-2 py-2 hover:bg-muted/50 ${
          hasChildren ? "cursor-pointer" : ""
        }`}
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
        onClick={() => {
          if (hasChildren) {
            setExpanded((v) => !v);
          }
        }}
      >
        {/* Expand/collapse toggle */}
        <button
          type="button"
          className="h-4 w-4 shrink-0 text-muted-foreground"
          onClick={(event) => {
            event.stopPropagation();
            if (hasChildren) {
              setExpanded((v) => !v);
            }
          }}
          aria-label={expanded ? t("tree.collapse") : t("tree.expand")}
        >
          {hasChildren ? (
            expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )
          ) : (
            <span className="h-4 w-4 block" />
          )}
        </button>

        {/* Color dot */}
        {effectiveColor ? (
          isLogicalContainer ? (
            <GroupColorBadge color={effectiveColor} />
          ) : (
            <LocationColorBadge color={effectiveColor} />
          )
        ) : (
          <MapPin className="h-3 w-3 shrink-0 text-muted-foreground/50" />
        )}

        {/* Name + code */}
        <LocationNameLabel
          name={node.name}
          description={node.description}
          className={`flex-1 text-sm ${isRoot ? "font-semibold" : "font-medium"}`}
        />
        {node.code && (
          <LocationCodeActions
            code={node.code}
            fullPath={buildLocationPath(node.id, ctx.allLocations)}
            onCopyCode={() => ctx.onCopyLocationCode(node)}
            onCopyPath={() => ctx.onCopyLocationPath(node)}
            codeTooltipLabel={t("actions.locationCode")}
            copyCodeLabel={t("actions.copyLocationCode")}
            copyPathLabel={t("actions.copyLocationPath")}
          />
        )}

        {isRoot ? (
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <Button
                    variant="outline"
                    size="icon"
                    className={
                      layout?.status === "published"
                        ? "h-7 w-7 shrink-0 border-emerald-200 bg-emerald-100 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-700"
                        : layout?.status === "draft"
                          ? "h-7 w-7 shrink-0"
                          : "h-7 w-7 shrink-0 border-dashed text-muted-foreground"
                    }
                    onClick={(event) => {
                      event.stopPropagation();
                      if (layout) {
                        ctx.onPreviewMap(node);
                        return;
                      }
                      if (canManageLayouts) {
                        ctx.onCreateMap(node);
                      }
                    }}
                    disabled={!layout && !canManageLayouts}
                  >
                    <MapIcon className="h-3.5 w-3.5" />
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <div className="flex flex-col gap-0.5">
                  <span>{rootMapActionLabel}</span>
                  <span className="text-xs text-muted-foreground">{rootMapStatusLabel}</span>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <Button
                    variant="ghost"
                    size="icon"
                    className={
                      canPreviewOnMap
                        ? "h-7 w-7 shrink-0 text-muted-foreground hover:text-emerald-600"
                        : "h-7 w-7 shrink-0 text-muted-foreground/30 cursor-not-allowed"
                    }
                    onClick={
                      canPreviewOnMap
                        ? (event) => {
                            event.stopPropagation();
                            ctx.onShowOnMap(node);
                          }
                        : (event) => event.stopPropagation()
                    }
                    disabled={!canPreviewOnMap}
                  >
                    <MapIcon className="h-3.5 w-3.5" />
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {canPreviewOnMap ? t("actions.showOnMap") : t("actions.notPlacedOnAnyMap")}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        <RowMenu triggerLabel={node.name} tooltipLabel={t("actions.moreActions")}>
          {isRoot && layout && (
            <DropdownMenuItem onClick={() => ctx.onOpenEditor(layout.id)}>
              <LayoutGrid className="mr-2 h-4 w-4" />
              {t("actions.openMapEditor")}
            </DropdownMenuItem>
          )}
          {isRoot && !layout && canManageLayouts && (
            <DropdownMenuItem onClick={() => ctx.onCreateMap(node)}>
              <MapIcon className="mr-2 h-4 w-4" />
              {t("actions.createMapForLocation")}
            </DropdownMenuItem>
          )}
          {(isRoot || isLogicalContainer) && canManage && (
            <DropdownMenuItem onClick={() => ctx.onCreateGroup(node)}>
              <Layers className="mr-2 h-4 w-4" />
              {t("groups.createGroup")}
            </DropdownMenuItem>
          )}
          {canManage && (
            <DropdownMenuItem onClick={() => ctx.onEdit(node)}>
              <Pencil className="mr-2 h-4 w-4" />
              {t("actions.editLocation", { name: node.name })}
            </DropdownMenuItem>
          )}
          {canManage && (
            <DropdownMenuItem onClick={() => ctx.onClone(node)}>
              <Copy className="mr-2 h-4 w-4" />
              {t("actions.cloneLocation", { name: node.name })}
            </DropdownMenuItem>
          )}
          {canManage && (
            <DropdownMenuItem
              onClick={() => ctx.onDelete(node)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {t("actions.deleteLocation", { name: node.name })}
            </DropdownMenuItem>
          )}
        </RowMenu>

        {/* Drag handle — shown whenever dragHandleProps are provided */}
        {canManage && dragHandleProps && (
          <button
            type="button"
            {...dragHandleProps}
            className="h-6 w-6 shrink-0 flex items-center justify-center text-muted-foreground/40 hover:text-muted-foreground touch-none cursor-grab active:cursor-grabbing"
            aria-label={t("actions.dragToReorder")}
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Children — interleaved with inline groups via ChildrenList */}
      {expanded && node.children.length > 0 && (
        <ChildrenList parentNode={node} depth={depth + 1} ctx={ctx} />
      )}
    </>
  );
}

// ─── Sortable root row wrapper ────────────────────────────────────────────────

function SortableRootRow({
  node,
  ctx,
  layout,
}: {
  node: WarehouseLocationTreeNode;
  ctx: TreeCtx;
  layout?: WarehouseLayout | null;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: node.id,
    data: { type: "location" },
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
      <TreeNodeRow
        node={node}
        depth={0}
        ctx={ctx}
        layout={layout}
        dragHandleProps={{ ...attributes, ...listeners } as React.HTMLAttributes<HTMLButtonElement>}
      />
    </div>
  );
}

// ─── Root drag preview ────────────────────────────────────────────────────────

function RootDragPreview({
  node,
  groups,
  locations,
}: {
  node: WarehouseLocationTreeNode;
  groups: WarehouseLocationGroup[];
  locations: WarehouseLocation[];
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border bg-background shadow-lg px-3 py-2 text-sm font-semibold w-64">
      {getEffectiveLocationColor(node, groups, locations) && (
        <div
          className="h-3 w-3 shrink-0 rounded-full border"
          style={{ backgroundColor: getEffectiveLocationColor(node, groups, locations)! }}
        />
      )}
      <span className="flex-1 truncate">{node.name}</span>
      {node.code && <span className="text-xs font-mono text-muted-foreground">{node.code}</span>}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function LocationsClient({ initialLocations, initialGroups }: LocationsClientProps) {
  const t = useTranslations("warehouseLocationsPage");
  const { can } = usePermissions();
  const router = useRouter();
  const activeBranchId = useAppStoreV2((s) => s.activeBranchId);

  const canRead = can(WAREHOUSE_LOCATIONS_READ);
  const canManage = can(WAREHOUSE_LOCATIONS_MANAGE);
  const canManageLayouts = can(WAREHOUSE_LAYOUTS_MANAGE);

  const { data: locations = initialLocations } = useWarehouseLocationsQuery(
    activeBranchId,
    initialLocations
  );
  const { data: groups = initialGroups } = useWarehouseLocationGroupsQuery(
    activeBranchId,
    initialGroups
  );
  const { data: layouts = [] } = useWarehouseLayoutsQuery(activeBranchId);

  const layoutByLocationId = useMemo(
    () =>
      layouts.reduce<Record<string, WarehouseLayout>>((acc, l) => {
        if (l.root_location_id) {
          const existing = acc[l.root_location_id];
          if (!existing || l.updated_at > existing.updated_at) acc[l.root_location_id] = l;
        }
        return acc;
      }, {}),
    [layouts]
  );

  const { data: placedIdsData = [] } = usePlacedLocationIdsQuery(activeBranchId);
  const placedLocationIds = useMemo(() => new Set(placedIdsData), [placedIdsData]);

  const createMutation = useCreateLocationMutation(activeBranchId);
  const updateMutation = useUpdateLocationMutation(activeBranchId);
  const deleteMutation = useDeleteLocationMutation(activeBranchId);
  const createMapMutation = useCreateLayoutForLocationMutation(activeBranchId);
  const reorderMut = useReorderLocationsMutation(activeBranchId);
  const createGroupMut = useCreateLocationGroupMutation(activeBranchId);
  const updateGroupMut = useUpdateLocationGroupMutation(activeBranchId);
  const deleteGroupMut = useDeleteLocationGroupMutation(activeBranchId);
  const reorderGroupsMut = useReorderGroupsMutation(activeBranchId);

  // ── Dialog state ──────────────────────────────────────────────────────────
  const [formOpen, setFormOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<WarehouseLocation | null>(null);
  const [templateLocation, setTemplateLocation] = useState<WarehouseLocation | null>(null);
  const [defaultGroupId, setDefaultGroupId] = useState<string | null>(null);
  const [defaultParentId, setDefaultParentId] = useState<string | null>(null);
  const [deletingLocation, setDeletingLocation] = useState<WarehouseLocation | null>(null);
  const [mapDialog, setMapDialog] = useState<{
    rootLocationId: string | null;
    highlightLocationId: string | null;
    highlightLocationIds?: string[] | null;
    showTree: boolean;
  } | null>(null);
  const [groupFormOpen, setGroupFormOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<WarehouseLocationGroup | null>(null);
  const [deletingGroup, setDeletingGroup] = useState<WarehouseLocationGroup | null>(null);
  const [groupParentLocationId, setGroupParentLocationId] = useState<string | null>(null);

  // ── Root-level DnD state ──────────────────────────────────────────────────
  const [activeRootId, setActiveRootId] = useState<string | null>(null);
  const rootSensors = useTreeSensors();

  // ── Derived data ──────────────────────────────────────────────────────────

  const allTree = useMemo(() => buildLocationTree(locations), [locations]);

  const rootNodes = useMemo(
    () =>
      [...allTree].sort((a, b) => {
        const aHasLayout = layoutByLocationId[a.id] ? 0 : 1;
        const bHasLayout = layoutByLocationId[b.id] ? 0 : 1;
        if (aHasLayout !== bHasLayout) return aHasLayout - bHasLayout;
        return a.sort_order - b.sort_order || a.name.localeCompare(b.name);
      }),
    [allTree, layoutByLocationId]
  );

  const availableParents = editingLocation
    ? locations.filter((l) => l.id !== editingLocation.id)
    : locations;

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleCreate() {
    setEditingLocation(null);
    setTemplateLocation(null);
    setDefaultGroupId(null);
    setDefaultParentId(null);
    setFormOpen(true);
  }

  function handleEdit(location: WarehouseLocation) {
    setEditingLocation(location);
    setTemplateLocation(null);
    setDefaultGroupId(null);
    setDefaultParentId(null);
    setFormOpen(true);
  }

  function handleClone(location: WarehouseLocation) {
    setEditingLocation(null);
    setTemplateLocation(location);
    setDefaultGroupId(null);
    setDefaultParentId(null);
    setFormOpen(true);
  }

  function handleDelete(location: WarehouseLocation) {
    setDeletingLocation(location);
  }

  async function copyToClipboard(value: string, successMessage: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(successMessage);
    } catch (error) {
      console.error("Failed to copy warehouse location value:", error);
      toast.error(t("feedback.copyFailed"));
    }
  }

  function handleCopyLocationCode(location: WarehouseLocation) {
    if (!location.code) return;
    void copyToClipboard(location.code, t("feedback.locationCodeCopied", { code: location.code }));
  }

  function handleCopyLocationPath(location: WarehouseLocation) {
    const path = buildLocationPath(location.id, locations);
    if (!path) return;
    void copyToClipboard(path, t("feedback.locationPathCopied"));
  }

  function handleFormSubmit(data: CreateLocationInput | (UpdateLocationInput & { id: string })) {
    let enriched = data;
    if (!("id" in data)) {
      if (defaultGroupId) enriched = { ...enriched, group_id: defaultGroupId };
      if (defaultParentId)
        enriched = {
          ...enriched,
          parent_id: (enriched as CreateLocationInput).parent_id ?? defaultParentId,
        };
    }

    if ("id" in enriched) {
      updateMutation.mutate(enriched as UpdateLocationInput & { id: string }, {
        onSuccess: () => setFormOpen(false),
      });
    } else {
      createMutation.mutate(enriched as CreateLocationInput, {
        onSuccess: () => setFormOpen(false),
      });
    }
  }

  function handleConfirmDelete() {
    if (!deletingLocation) return;
    deleteMutation.mutate(deletingLocation.id, { onSuccess: () => setDeletingLocation(null) });
  }

  function handlePreviewMap(location: WarehouseLocation) {
    setMapDialog({ rootLocationId: location.id, highlightLocationId: null, showTree: true });
  }

  function handleShowOnMap(location: WarehouseLocation) {
    if ((location.map_role ?? "logical") === "logical") {
      const highlightLocationIds = getDescendantLocationIds(location.id, locations).filter((id) => {
        const descendant = locations.find((entry) => entry.id === id);
        return descendant ? canPreviewLocationOnMap(descendant) : false;
      });
      const root = findRootAncestor(location.id, locations);

      setMapDialog({
        rootLocationId: root?.id ?? null,
        highlightLocationId: null,
        highlightLocationIds,
        showTree: false,
      });
      return;
    }

    const root = findRootAncestor(location.id, locations);
    setMapDialog({
      rootLocationId: root?.id ?? null,
      highlightLocationId: location.id,
      highlightLocationIds: [location.id],
      showTree: false,
    });
  }

  function canPreviewLocationOnMap(location: WarehouseLocation) {
    if ((location.map_role ?? "logical") === "logical") {
      return getDescendantLocationIds(location.id, locations).some((id) => {
        const descendant = locations.find((entry) => entry.id === id);
        return descendant ? canPreviewLocationOnMap(descendant) : false;
      });
    }

    if (placedLocationIds.has(location.id)) return true;

    const root = findRootAncestor(location.id, locations);
    if (!root) return false;

    const context = resolveLocationMapContext(location.id, locations, root.id);
    return !!context.topDownAnchorLocationId;
  }

  function handlePreviewGroupOnMap(
    group: WarehouseLocationGroup,
    members: WarehouseLocationTreeNode[]
  ) {
    const root = group.parent_location_id
      ? findRootAncestor(group.parent_location_id, locations)
      : members[0]
        ? findRootAncestor(members[0].id, locations)
        : null;
    setMapDialog({
      rootLocationId: root?.id ?? null,
      highlightLocationId: null,
      highlightLocationIds: members.map((member) => member.id),
      showTree: false,
    });
  }

  function handleOpenEditor(layoutId: string) {
    router.push({ pathname: "/dashboard/warehouse/map/[layoutId]", params: { layoutId } });
  }

  function handleCreateMap(location: WarehouseLocation) {
    createMapMutation.mutate(
      { location_id: location.id, name: location.name },
      {
        onSuccess: (layout) =>
          router.push({
            pathname: "/dashboard/warehouse/map/[layoutId]",
            params: { layoutId: layout.id },
          }),
      }
    );
  }

  // ── Group handlers ────────────────────────────────────────────────────────

  function handleCreateGroupForLocation(location: WarehouseLocation) {
    setEditingGroup(null);
    setGroupParentLocationId(location.id);
    setGroupFormOpen(true);
  }

  function handleEditGroup(group: WarehouseLocationGroup) {
    setEditingGroup(group);
    setGroupParentLocationId(null);
    setGroupFormOpen(true);
  }

  function handleDeleteGroup(group: WarehouseLocationGroup) {
    setDeletingGroup(group);
  }

  function handleGroupFormSubmit(
    data: CreateLocationGroupInput | (UpdateLocationGroupInput & { id: string })
  ) {
    if ("id" in data) {
      updateGroupMut.mutate(data as UpdateLocationGroupInput & { id: string }, {
        onSuccess: () => setGroupFormOpen(false),
      });
    } else {
      createGroupMut.mutate(
        { ...(data as CreateLocationGroupInput), parent_location_id: groupParentLocationId },
        { onSuccess: () => setGroupFormOpen(false) }
      );
    }
  }

  function handleConfirmDeleteGroup() {
    if (!deletingGroup) return;
    deleteGroupMut.mutate(deletingGroup.id, { onSuccess: () => setDeletingGroup(null) });
  }

  // ── Root-level DnD ────────────────────────────────────────────────────────

  function handleRootDragStart(event: DragStartEvent) {
    setActiveRootId(event.active.id as string);
  }

  function handleRootDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveRootId(null);
    if (!over || active.id === over.id) return;

    const oldIndex = rootNodes.findIndex((n) => n.id === (active.id as string));
    const newIndex = rootNodes.findIndex((n) => n.id === (over.id as string));
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(rootNodes, oldIndex, newIndex);
    reorderMut.mutate({ items: reordered.map((n, i) => ({ id: n.id, sort_order: i })) });
  }

  const activeRootNode = activeRootId
    ? (rootNodes.find((n) => n.id === activeRootId) ?? null)
    : null;

  // ── Tree context ──────────────────────────────────────────────────────────

  const treeCtx: TreeCtx = {
    t,
    canManage,
    canManageLayouts,
    allLocations: locations,
    groups,
    placedLocationIds,
    layoutByLocationId,
    onEdit: handleEdit,
    onClone: handleClone,
    onDelete: handleDelete,
    onShowOnMap: handleShowOnMap,
    onPreviewMap: handlePreviewMap,
    onOpenEditor: handleOpenEditor,
    onCreateMap: handleCreateMap,
    onCreateGroup: handleCreateGroupForLocation,
    onEditGroup: handleEditGroup,
    onDeleteGroup: handleDeleteGroup,
    onPreviewGroupOnMap: handlePreviewGroupOnMap,
    onReorderGroups: (input) => reorderGroupsMut.mutate(input),
    onReorderChildLocations: (input) => reorderMut.mutate(input),
    onAssignToGroup: (locationId, groupId) =>
      updateMutation.mutate({ id: locationId, group_id: groupId }),
    onCopyLocationCode: handleCopyLocationCode,
    onCopyLocationPath: handleCopyLocationPath,
    canPreviewLocationOnMap,
  };

  // ── Guards ────────────────────────────────────────────────────────────────

  if (!canRead) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
        <MapPin className="mb-4 h-10 w-10 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">{t("states.noPermission")}</p>
      </div>
    );
  }

  if (!activeBranchId) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
        <MapPin className="mb-4 h-10 w-10 text-muted-foreground/50" />
        <p className="text-sm font-medium">{t("states.noBranchTitle")}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t("states.noBranchDescription")}</p>
      </div>
    );
  }

  const rootIds = rootNodes.map((n) => n.id);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("header.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("header.description")}</p>
        </div>
        {canManage && (
          <Button onClick={handleCreate} size="sm">
            <MapPin className="mr-2 h-4 w-4" />
            {t("actions.addLocation")}
          </Button>
        )}
      </div>

      {/* Content */}
      {rootNodes.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <MapPin className="mb-4 h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm font-medium">{t("states.emptyTitle")}</p>
          {canManage && (
            <>
              <p className="mt-1 text-sm text-muted-foreground">{t("states.emptyDescription")}</p>
              <Button onClick={handleCreate} className="mt-4" size="sm" variant="outline">
                <MapPin className="mr-2 h-4 w-4" />
                {t("actions.addLocation")}
              </Button>
            </>
          )}
        </div>
      ) : (
        <DndContext
          sensors={rootSensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragStart={handleRootDragStart}
          onDragEnd={handleRootDragEnd}
        >
          <div className="rounded-lg border overflow-hidden divide-y">
            <SortableContext items={rootIds} strategy={verticalListSortingStrategy}>
              {rootNodes.map((node) =>
                canManage ? (
                  <SortableRootRow
                    key={node.id}
                    node={node}
                    ctx={treeCtx}
                    layout={layoutByLocationId[node.id] ?? null}
                  />
                ) : (
                  <TreeNodeRow
                    key={node.id}
                    node={node}
                    depth={0}
                    ctx={treeCtx}
                    layout={layoutByLocationId[node.id] ?? null}
                  />
                )
              )}
            </SortableContext>
          </div>

          <DragOverlay dropAnimation={null}>
            {activeRootNode && (
              <RootDragPreview node={activeRootNode} groups={groups} locations={locations} />
            )}
          </DragOverlay>
        </DndContext>
      )}

      {/* Create / Edit location dialog */}
      <LocationFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) {
            setTemplateLocation(null);
            setDefaultGroupId(null);
            setDefaultParentId(null);
          }
        }}
        location={editingLocation}
        templateLocation={templateLocation}
        availableParents={availableParents}
        availableGroups={groups}
        onSubmit={handleFormSubmit}
        isPending={createMutation.isPending || updateMutation.isPending}
      />

      {/* Create / Edit group dialog */}
      <LocationGroupFormDialog
        open={groupFormOpen}
        onOpenChange={(open) => {
          setGroupFormOpen(open);
          if (!open) setGroupParentLocationId(null);
        }}
        group={editingGroup}
        onSubmit={handleGroupFormSubmit}
        isPending={createGroupMut.isPending || updateGroupMut.isPending}
      />

      {/* Delete location confirmation */}
      <AlertDialog
        open={!!deletingLocation}
        onOpenChange={(open) => !open && setDeletingLocation(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteDialog.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.rich("deleteDialog.description", {
                name: () => (
                  <span className="font-medium text-foreground">
                    {deletingLocation?.name ?? ""}
                  </span>
                ),
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("deleteDialog.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleConfirmDelete}
            >
              {deleteMutation.isPending ? t("deleteDialog.deleting") : t("deleteDialog.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete group confirmation */}
      <AlertDialog open={!!deletingGroup} onOpenChange={(open) => !open && setDeletingGroup(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("groups.deleteGroupTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("groups.deleteGroupDescription", { name: deletingGroup?.name ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("deleteDialog.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleConfirmDeleteGroup}
            >
              {deleteGroupMut.isPending ? t("deleteDialog.deleting") : t("deleteDialog.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Map preview/editor dialog */}
      {mapDialog && (
        <WarehouseMapDialog
          open={!!mapDialog}
          onOpenChange={(open) => !open && setMapDialog(null)}
          rootLocationId={mapDialog.rootLocationId}
          highlightLocationId={mapDialog.highlightLocationId}
          highlightLocationIds={mapDialog.highlightLocationIds}
          locations={locations}
          locationGroups={groups}
          showTree={mapDialog.showTree}
        />
      )}
    </div>
  );
}
