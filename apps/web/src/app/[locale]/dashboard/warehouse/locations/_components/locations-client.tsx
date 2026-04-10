"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  MapPin,
  Map as MapIcon,
  LayoutGrid,
  Plus,
  Pencil,
  Trash2,
  ChevronRight,
  ChevronDown,
  Globe,
  FileEdit,
  GripVertical,
  Layers,
  FolderOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
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
import { buildLocationTree } from "@/lib/warehouse/location-tree";
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
  groups: WarehouseLocationGroup[];
  placedLocationIds: Set<string>;
  layoutByLocationId: Record<string, WarehouseLayout>;
  onEdit: (l: WarehouseLocation) => void;
  onDelete: (l: WarehouseLocation) => void;
  onShowOnMap: (l: WarehouseLocation) => void;
  onPreviewMap: (l: WarehouseLocation) => void;
  onOpenEditor: (layoutId: string) => void;
  onCreateMap: (l: WarehouseLocation) => void;
  onCreateGroup: (l: WarehouseLocation) => void;
  onEditGroup: (g: WarehouseLocationGroup) => void;
  onDeleteGroup: (g: WarehouseLocationGroup) => void;
  onAddToGroup: (g: WarehouseLocationGroup) => void;
  onReorderGroups: (input: ReorderGroupsInput) => void;
  onReorderChildLocations: (input: ReorderLocationsInput) => void;
  onAssignToGroup: (locationId: string, groupId: string) => void;
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
    const overId = e.over?.id as string | undefined;
    if (!overId || !localActiveId) {
      setDropTargetGroupId(null);
      return;
    }
    const activeIsLocation = ungroupedChildren.some((n) => n.id === localActiveId);
    const overIsGroup = myGroups.some((g) => g.id === overId);
    setDropTargetGroupId(activeIsLocation && overIsGroup ? overId : null);
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    setLocalActiveId(null);
    setDropTargetGroupId(null);
    if (!over || active.id === over.id) return;

    const activeStr = active.id as string;
    const overStr = over.id as string;

    const activeIsGroup = myGroups.some((g) => g.id === activeStr);
    const activeIsLocation = ungroupedChildren.some((n) => n.id === activeStr);
    const overIsGroup = myGroups.some((g) => g.id === overStr);

    // Reorder groups
    if (activeIsGroup && overIsGroup) {
      const oldIdx = myGroups.findIndex((g) => g.id === activeStr);
      const newIdx = myGroups.findIndex((g) => g.id === overStr);
      if (oldIdx === -1 || newIdx === -1) return;
      const reordered = arrayMove(myGroups, oldIdx, newIdx);
      ctx.onReorderGroups({ items: reordered.map((g, i) => ({ id: g.id, sort_order: i })) });
      return;
    }

    // Assign location to group
    if (activeIsLocation && overIsGroup) {
      ctx.onAssignToGroup(activeStr, overStr);
      return;
    }

    // Reorder ungrouped locations
    if (activeIsLocation && !overIsGroup) {
      const oldIdx = ungroupedChildren.findIndex((n) => n.id === activeStr);
      const newIdx = ungroupedChildren.findIndex((n) => n.id === overStr);
      if (oldIdx === -1 || newIdx === -1) return;
      const reordered = arrayMove(ungroupedChildren, oldIdx, newIdx);
      ctx.onReorderChildLocations({
        items: reordered.map((n, i) => ({ id: n.id, sort_order: i })),
      });
    }
  }

  const activeItem = localActiveId
    ? items.find((item) =>
        item.kind === "group" ? item.g.id === localActiveId : item.n.id === localActiveId
      )
    : null;

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
              {activeItem.n.color && (
                <div
                  className="h-3 w-3 shrink-0 rounded-full border"
                  style={{ backgroundColor: activeItem.n.color }}
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
  dragHandleProps,
}: {
  group: WarehouseLocationGroup;
  members: WarehouseLocationTreeNode[];
  depth: number;
  ctx: TreeCtx;
  isDropTarget?: boolean;
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
}) {
  const [expanded, setExpanded] = useState(true);
  const [memberActiveId, setMemberActiveId] = useState<string | null>(null);
  const { t, canManage } = ctx;
  const indent = depth * 20 + 8;

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
        className={`group/grp flex items-center gap-2 py-2 transition-colors ${
          isDropTarget
            ? "bg-emerald-50 dark:bg-emerald-950/30 ring-2 ring-inset ring-emerald-400"
            : "bg-muted/30 hover:bg-muted/50"
        }`}
        style={{ paddingLeft: `${indent}px`, paddingRight: "8px" }}
      >
        <button
          type="button"
          className="h-4 w-4 shrink-0 text-muted-foreground"
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? t("tree.collapse") : t("tree.expand")}
        >
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>

        {group.color ? (
          <div
            className="h-3 w-3 shrink-0 rounded-full border"
            style={{ backgroundColor: group.color }}
          />
        ) : (
          <Layers className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
        )}

        <span className="flex-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {group.name}
        </span>
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
          {members.length}
        </Badge>

        {canManage && (
          <div className="flex gap-1 opacity-0 group-hover/grp:opacity-100 focus-within:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground"
              onClick={() => ctx.onAddToGroup(group)}
              title={t("groups.addLocation")}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground"
              onClick={() => ctx.onEditGroup(group)}
              title={t("groups.editGroup")}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={() => ctx.onDeleteGroup(group)}
              title={t("groups.deleteGroup")}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
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
            <FolderOpen className="h-3.5 w-3.5 shrink-0" />
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
                      depth={depth}
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
                  {activeMember.color && (
                    <div
                      className="h-3 w-3 shrink-0 rounded-full border"
                      style={{ backgroundColor: activeMember.color }}
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
  const [expanded, setExpanded] = useState(true);
  const { t, canManage, canManageLayouts, placedLocationIds } = ctx;
  const hasChildren = node.children.length > 0;
  const isRoot = depth === 0;
  const isPlaced = placedLocationIds.has(node.id);

  return (
    <>
      <div
        className="group/row flex items-center gap-2 rounded-md px-2 py-2 hover:bg-muted/50"
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
      >
        {/* Expand/collapse toggle */}
        <button
          type="button"
          className="h-4 w-4 shrink-0 text-muted-foreground"
          onClick={() => setExpanded((v) => !v)}
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
        {node.color ? (
          <div
            className="h-3 w-3 shrink-0 rounded-full border"
            style={{ backgroundColor: node.color }}
          />
        ) : (
          <MapPin className="h-3 w-3 shrink-0 text-muted-foreground/50" />
        )}

        {/* Name + code */}
        <span className={`flex-1 text-sm ${isRoot ? "font-semibold" : "font-medium"}`}>
          {node.name}
        </span>
        {node.code && <span className="text-xs font-mono text-muted-foreground">{node.code}</span>}

        {/* Layout status badge — root nodes only */}
        {isRoot && (
          <span className="shrink-0">
            {layout?.status === "published" ? (
              <Badge className="gap-1 bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px] px-1.5 py-0.5">
                <Globe className="h-2.5 w-2.5" />
                {t("badges.published")}
              </Badge>
            ) : layout?.status === "draft" ? (
              <Badge variant="secondary" className="gap-1 text-[10px] px-1.5 py-0.5">
                <FileEdit className="h-2.5 w-2.5" />
                {t("badges.draft")}
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0.5 text-muted-foreground border-dashed"
              >
                {t("badges.noMap")}
              </Badge>
            )}
          </span>
        )}

        {/* Actions */}
        <div className="flex gap-1 opacity-0 group-hover/row:opacity-100 focus-within:opacity-100 transition-opacity">
          {isRoot ? (
            layout ? (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-emerald-600"
                  onClick={() => ctx.onPreviewMap(node)}
                  title={t("actions.previewMap")}
                >
                  <MapIcon className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-primary"
                  onClick={() => ctx.onOpenEditor(layout.id)}
                  title={t("actions.openMapEditor")}
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                </Button>
              </>
            ) : canManageLayouts ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-emerald-600"
                onClick={() => ctx.onCreateMap(node)}
                title={t("actions.createMapForLocation")}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            ) : null
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className={
                isPlaced
                  ? "h-7 w-7 text-muted-foreground hover:text-emerald-600"
                  : "h-7 w-7 text-muted-foreground/30 cursor-not-allowed"
              }
              onClick={isPlaced ? () => ctx.onShowOnMap(node) : undefined}
              disabled={!isPlaced}
              title={isPlaced ? t("actions.showOnMap") : t("actions.notPlacedOnAnyMap")}
            >
              <MapIcon className="h-3.5 w-3.5" />
            </Button>
          )}

          {canManage && (
            <>
              {/* Add Group button — creates inline group for this location's children */}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground"
                onClick={() => ctx.onCreateGroup(node)}
                title={t("groups.createGroup")}
              >
                <Layers className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => ctx.onEdit(node)}
                aria-label={t("actions.editLocation", { name: node.name })}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={() => ctx.onDelete(node)}
                aria-label={t("actions.deleteLocation", { name: node.name })}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>

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

function RootDragPreview({ node }: { node: WarehouseLocationTreeNode }) {
  return (
    <div className="flex items-center gap-2 rounded-md border bg-background shadow-lg px-3 py-2 text-sm font-semibold w-64">
      {node.color && (
        <div
          className="h-3 w-3 shrink-0 rounded-full border"
          style={{ backgroundColor: node.color }}
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
  const [defaultGroupId, setDefaultGroupId] = useState<string | null>(null);
  const [defaultParentId, setDefaultParentId] = useState<string | null>(null);
  const [deletingLocation, setDeletingLocation] = useState<WarehouseLocation | null>(null);
  const [mapDialog, setMapDialog] = useState<{
    rootLocationId: string | null;
    highlightLocationId: string | null;
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
    setDefaultGroupId(null);
    setDefaultParentId(null);
    setFormOpen(true);
  }

  function handleEdit(location: WarehouseLocation) {
    setEditingLocation(location);
    setDefaultGroupId(null);
    setDefaultParentId(null);
    setFormOpen(true);
  }

  function handleDelete(location: WarehouseLocation) {
    setDeletingLocation(location);
  }

  function handleAddToGroup(group: WarehouseLocationGroup) {
    setEditingLocation(null);
    setDefaultGroupId(group.id);
    setDefaultParentId(group.parent_location_id ?? null);
    setFormOpen(true);
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
    const root = findRootAncestor(location.id, locations);
    setMapDialog({
      rootLocationId: root?.id ?? null,
      highlightLocationId: location.id,
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
    groups,
    placedLocationIds,
    layoutByLocationId,
    onEdit: handleEdit,
    onDelete: handleDelete,
    onShowOnMap: handleShowOnMap,
    onPreviewMap: handlePreviewMap,
    onOpenEditor: handleOpenEditor,
    onCreateMap: handleCreateMap,
    onCreateGroup: handleCreateGroupForLocation,
    onEditGroup: handleEditGroup,
    onDeleteGroup: handleDeleteGroup,
    onAddToGroup: handleAddToGroup,
    onReorderGroups: (input) => reorderGroupsMut.mutate(input),
    onReorderChildLocations: (input) => reorderMut.mutate(input),
    onAssignToGroup: (locationId, groupId) =>
      updateMutation.mutate({ id: locationId, group_id: groupId }),
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
            <Plus className="mr-2 h-4 w-4" />
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
                <Plus className="mr-2 h-4 w-4" />
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
            {activeRootNode && <RootDragPreview node={activeRootNode} />}
          </DragOverlay>
        </DndContext>
      )}

      {/* Create / Edit location dialog */}
      <LocationFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) {
            setDefaultGroupId(null);
            setDefaultParentId(null);
          }
        }}
        location={editingLocation}
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
              {t("deleteDialog.description", { name: deletingLocation?.name ?? "" })}
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
          locations={mapDialog.showTree ? locations : undefined}
        />
      )}
    </div>
  );
}
