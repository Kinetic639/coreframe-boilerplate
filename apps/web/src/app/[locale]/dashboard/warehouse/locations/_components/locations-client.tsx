"use client";

import { useState } from "react";
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
  useCreateLayoutForLocationMutation,
  useCreateLocationMutation,
  useUpdateLocationMutation,
  useDeleteLocationMutation,
  usePlacedLocationIdsQuery,
  useReorderLocationsMutation,
} from "@/hooks/queries/warehouse";
import { buildLocationTree } from "@/lib/warehouse/location-tree";
import type { WarehouseLocation, WarehouseLocationTreeNode } from "@/lib/warehouse/location-tree";
import type { WarehouseLayout } from "@/lib/warehouse/layouts";
import type { CreateLocationInput, UpdateLocationInput } from "@/app/actions/warehouse/schemas";
import { LocationFormDialog } from "@/app/[locale]/dashboard/warehouse/locations/_components/location-form-dialog";
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
}

// ─── Tree node row ─────────────────────────────────────────────────────────────

interface TreeNodeRowProps {
  node: WarehouseLocationTreeNode;
  depth: number;
  t: ReturnType<typeof useTranslations>;
  canManage: boolean;
  canManageLayouts: boolean;
  layout?: WarehouseLayout | null;
  placedLocationIds: Set<string>;
  /** If provided, renders a grip handle at depth=0 (drag handle attrs) */
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
  onEdit: (location: WarehouseLocation) => void;
  onDelete: (location: WarehouseLocation) => void;
  onShowOnMap: (location: WarehouseLocation) => void;
  onPreviewMap: (location: WarehouseLocation) => void;
  onOpenEditor: (layoutId: string) => void;
  onCreateMap: (location: WarehouseLocation) => void;
}

function TreeNodeRow({
  node,
  depth,
  t,
  canManage,
  canManageLayouts,
  layout,
  placedLocationIds,
  dragHandleProps,
  onEdit,
  onDelete,
  onShowOnMap,
  onPreviewMap,
  onOpenEditor,
  onCreateMap,
}: TreeNodeRowProps) {
  const [expanded, setExpanded] = useState(true);
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
        <span className={`flex-1 text-sm font-medium ${isRoot ? "font-semibold" : ""}`}>
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
                  onClick={() => onPreviewMap(node)}
                  title={t("actions.previewMap")}
                >
                  <MapIcon className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-primary"
                  onClick={() => onOpenEditor(layout.id)}
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
                onClick={() => onCreateMap(node)}
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
              onClick={isPlaced ? () => onShowOnMap(node) : undefined}
              disabled={!isPlaced}
              title={isPlaced ? t("actions.showOnMap") : t("actions.notPlacedOnAnyMap")}
            >
              <MapIcon className="h-3.5 w-3.5" />
            </Button>
          )}

          {canManage && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => onEdit(node)}
                aria-label={t("actions.editLocation", { name: node.name })}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={() => onDelete(node)}
                aria-label={t("actions.deleteLocation", { name: node.name })}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>

        {/* Drag handle — root only, always visible */}
        {isRoot && canManage && dragHandleProps && (
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

      {/* Children */}
      {expanded &&
        [...node.children]
          .sort((a, b) => {
            const aPlaced = placedLocationIds.has(a.id) ? 0 : 1;
            const bPlaced = placedLocationIds.has(b.id) ? 0 : 1;
            if (aPlaced !== bPlaced) return aPlaced - bPlaced;
            return a.sort_order - b.sort_order || a.name.localeCompare(b.name);
          })
          .map((child) => (
            <TreeNodeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              t={t}
              canManage={canManage}
              canManageLayouts={canManageLayouts}
              placedLocationIds={placedLocationIds}
              onEdit={onEdit}
              onDelete={onDelete}
              onShowOnMap={onShowOnMap}
              onPreviewMap={onPreviewMap}
              onOpenEditor={onOpenEditor}
              onCreateMap={onCreateMap}
            />
          ))}
    </>
  );
}

// ─── Sortable root row wrapper ────────────────────────────────────────────────

function SortableRootRow(props: Omit<TreeNodeRowProps, "dragHandleProps">) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.node.id,
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
        {...props}
        dragHandleProps={{ ...attributes, ...listeners } as React.HTMLAttributes<HTMLButtonElement>}
      />
    </div>
  );
}

// ─── Drag preview ─────────────────────────────────────────────────────────────

function DragPreview({
  node,
  layout,
}: {
  node: WarehouseLocationTreeNode;
  layout?: WarehouseLayout | null;
}) {
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

export function LocationsClient({ initialLocations }: LocationsClientProps) {
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
  const { data: layouts = [] } = useWarehouseLayoutsQuery(activeBranchId);

  const layoutByLocationId = layouts.reduce<Record<string, WarehouseLayout>>((acc, l) => {
    if (l.root_location_id) {
      const existing = acc[l.root_location_id];
      if (!existing || l.updated_at > existing.updated_at) acc[l.root_location_id] = l;
    }
    return acc;
  }, {});

  const { data: placedIdsData = [] } = usePlacedLocationIdsQuery(activeBranchId);
  const placedLocationIds = new Set(placedIdsData);

  const createMutation = useCreateLocationMutation(activeBranchId);
  const updateMutation = useUpdateLocationMutation(activeBranchId);
  const deleteMutation = useDeleteLocationMutation(activeBranchId);
  const createMapMutation = useCreateLayoutForLocationMutation(activeBranchId);
  const reorderMut = useReorderLocationsMutation(activeBranchId);

  // Dialog state
  const [formOpen, setFormOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<WarehouseLocation | null>(null);
  const [deletingLocation, setDeletingLocation] = useState<WarehouseLocation | null>(null);
  const [mapDialog, setMapDialog] = useState<{
    rootLocationId: string | null;
    highlightId: string | null;
    showTree: boolean;
  } | null>(null);

  // dnd-kit state
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const tree = buildLocationTree(locations).sort((a, b) => {
    const aPlaced = layoutByLocationId[a.id] ? 0 : 1;
    const bPlaced = layoutByLocationId[b.id] ? 0 : 1;
    if (aPlaced !== bPlaced) return aPlaced - bPlaced;
    return a.sort_order - b.sort_order || a.name.localeCompare(b.name);
  });

  const availableParents = editingLocation
    ? locations.filter((l) => l.id !== editingLocation.id)
    : locations;

  function handleCreate() {
    setEditingLocation(null);
    setFormOpen(true);
  }
  function handleEdit(location: WarehouseLocation) {
    setEditingLocation(location);
    setFormOpen(true);
  }
  function handleDelete(location: WarehouseLocation) {
    setDeletingLocation(location);
  }

  function handleFormSubmit(data: CreateLocationInput | (UpdateLocationInput & { id: string })) {
    if ("id" in data) {
      updateMutation.mutate(data as UpdateLocationInput & { id: string }, {
        onSuccess: () => setFormOpen(false),
      });
    } else {
      createMutation.mutate(data as CreateLocationInput, {
        onSuccess: () => setFormOpen(false),
      });
    }
  }

  function handleConfirmDelete() {
    if (!deletingLocation) return;
    deleteMutation.mutate(deletingLocation.id, { onSuccess: () => setDeletingLocation(null) });
  }

  function handlePreviewMap(location: WarehouseLocation) {
    setMapDialog({ rootLocationId: location.id, highlightId: null, showTree: true });
  }

  function handleShowOnMap(location: WarehouseLocation) {
    const root = findRootAncestor(location.id, locations);
    setMapDialog({ rootLocationId: root?.id ?? null, highlightId: location.id, showTree: false });
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

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = tree.findIndex((n) => n.id === active.id);
    const newIndex = tree.findIndex((n) => n.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(tree, oldIndex, newIndex);
    const items = reordered.map((n, i) => ({ id: n.id, sort_order: i }));
    reorderMut.mutate({ items });
  }

  const activeNode = activeId ? (tree.find((n) => n.id === activeId) ?? null) : null;

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

      {/* Tree */}
      {tree.length === 0 ? (
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
        <div className="rounded-lg border">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={tree.map((n) => n.id)} strategy={verticalListSortingStrategy}>
              <div className="divide-y">
                {tree.map((node) =>
                  canManage ? (
                    <SortableRootRow
                      key={node.id}
                      node={node}
                      depth={0}
                      t={t}
                      canManage={canManage}
                      canManageLayouts={canManageLayouts}
                      layout={layoutByLocationId[node.id] ?? null}
                      placedLocationIds={placedLocationIds}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      onShowOnMap={handleShowOnMap}
                      onPreviewMap={handlePreviewMap}
                      onOpenEditor={handleOpenEditor}
                      onCreateMap={handleCreateMap}
                    />
                  ) : (
                    <TreeNodeRow
                      key={node.id}
                      node={node}
                      depth={0}
                      t={t}
                      canManage={false}
                      canManageLayouts={canManageLayouts}
                      layout={layoutByLocationId[node.id] ?? null}
                      placedLocationIds={placedLocationIds}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      onShowOnMap={handleShowOnMap}
                      onPreviewMap={handlePreviewMap}
                      onOpenEditor={handleOpenEditor}
                      onCreateMap={handleCreateMap}
                    />
                  )
                )}
              </div>
            </SortableContext>

            <DragOverlay dropAnimation={null}>
              {activeNode && (
                <DragPreview node={activeNode} layout={layoutByLocationId[activeNode.id] ?? null} />
              )}
            </DragOverlay>
          </DndContext>
        </div>
      )}

      {/* Create / Edit dialog */}
      <LocationFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        location={editingLocation}
        availableParents={availableParents}
        onSubmit={handleFormSubmit}
        isPending={createMutation.isPending || updateMutation.isPending}
      />

      {/* Map dialog */}
      <WarehouseMapDialog
        open={!!mapDialog}
        onOpenChange={(open) => {
          if (!open) setMapDialog(null);
        }}
        rootLocationId={mapDialog?.rootLocationId ?? null}
        highlightLocationId={mapDialog?.highlightId ?? null}
        locations={mapDialog?.showTree ? locations : undefined}
        title={t("mapDialog.title")}
      />

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deletingLocation}
        onOpenChange={(open) => !open && setDeletingLocation(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteDialog.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.rich("deleteDialog.description", {
                name: () => <strong>{deletingLocation?.name}</strong>,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              {t("actions.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? t("actions.deleting") : t("actions.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
