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
} from "lucide-react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
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
import type { WarehouseLocation } from "@/lib/warehouse/location-tree";
import { useDeleteLocationMutation, useReorderLocationsMutation } from "@/hooks/queries/warehouse";
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

function DragPreview({ location }: { location: WarehouseLocation }) {
  return (
    <div className="flex items-center gap-1.5 py-1 px-2 rounded-md bg-background border border-primary/30 shadow-lg text-xs select-none">
      <GripVertical className="w-3 h-3 text-muted-foreground shrink-0" />
      <div
        className="w-2 h-2 rounded-sm shrink-0"
        style={{ backgroundColor: location.color ?? "#10b981" }}
      />
      <span className="truncate font-medium">{location.name}</span>
      {location.code && (
        <span className="font-mono text-muted-foreground text-[10px]">{location.code}</span>
      )}
    </div>
  );
}

// ─── Sortable tree node ───────────────────────────────────────────────────────

function SortableTreeNode({
  location,
  allLocations,
  placedLocationIds,
  onSelect,
  depth,
  t,
}: {
  location: WarehouseLocation;
  allLocations: WarehouseLocation[];
  placedLocationIds: Set<string>;
  onSelect: (id: string) => void;
  depth: number;
  t: ReturnType<typeof useTranslations>;
}) {
  const [expanded, setExpanded] = React.useState(true);

  const children = allLocations
    .filter((l) => l.parent_id === location.id)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));

  const isPlaced = placedLocationIds.has(location.id);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: location.id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div
        className={cn(
          "flex items-center gap-1 py-1 pr-2 rounded-md mx-1 transition-colors group/node",
          isPlaced ? "cursor-pointer hover:bg-accent" : "cursor-default hover:bg-muted/50"
        )}
        style={{ paddingLeft: 6 + depth * 14 }}
        onClick={() => {
          if (isPlaced) onSelect(location.id);
        }}
      >
        {/* Drag handle — only activates dnd-kit drag */}
        <button
          type="button"
          className="shrink-0 touch-none cursor-grab active:cursor-grabbing text-muted-foreground/30 group-hover/node:text-muted-foreground transition-colors"
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          tabIndex={-1}
        >
          <GripVertical className="w-3 h-3" />
        </button>

        {/* Expand toggle */}
        <button
          type="button"
          className={cn(
            "shrink-0 w-4 h-4 flex items-center justify-center text-muted-foreground hover:text-foreground",
            children.length === 0 && "invisible pointer-events-none"
          )}
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
        >
          {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </button>

        {/* Color dot */}
        <div
          className="w-2 h-2 rounded-sm shrink-0"
          style={{ backgroundColor: location.color ?? "#10b981" }}
        />

        <span className="text-xs truncate flex-1 min-w-0">{location.name}</span>
        {location.code && (
          <span className="text-[10px] font-mono text-muted-foreground shrink-0">
            {location.code}
          </span>
        )}
        {isPlaced && (
          <div
            className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 ml-1"
            title={t("indicators.placedOnCanvas")}
          />
        )}
      </div>

      {expanded && children.length > 0 && (
        <SortableContext items={children.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {children.map((child) => (
            <SortableTreeNode
              key={child.id}
              location={child}
              allLocations={allLocations}
              placedLocationIds={placedLocationIds}
              onSelect={onSelect}
              depth={depth + 1}
              t={t}
            />
          ))}
        </SortableContext>
      )}
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface LocationToolboxProps {
  locations: WarehouseLocation[];
  rootLocationId: string | null;
  branchId: string;
  placedLocationIds: Set<string>;
  selectedId: string | null;
  onSelectLocation: (locationId: string) => void;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function LocationToolbox({
  locations,
  rootLocationId,
  branchId,
  placedLocationIds,
  selectedId,
  onSelectLocation,
}: LocationToolboxProps) {
  const t = useTranslations("warehouseMapToolbox");
  const [treeOpen, setTreeOpen] = React.useState(true);
  const [shapesOpen, setShapesOpen] = React.useState(true);
  const [unplacedOpen, setUnplacedOpen] = React.useState(true);
  const [deleteTarget, setDeleteTarget] = React.useState<WarehouseLocation | null>(null);
  const [activeId, setActiveId] = React.useState<string | null>(null);

  const deleteMut = useDeleteLocationMutation(branchId);
  const reorderMut = useReorderLocationsMutation(branchId);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // All descendants of rootLocationId
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

  const treeRoots = descendants
    .filter((l) => l.parent_id === rootLocationId)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));

  const unplaced = descendants.filter((l) => !placedLocationIds.has(l.id));

  const activeLocation = activeId ? descendants.find((l) => l.id === activeId) : null;

  // ── DnD handlers ────────────────────────────────────────────────────────────

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeLoc = descendants.find((l) => l.id === activeId);
    const overLoc = descendants.find((l) => l.id === overId);

    // Only reorder within the same parent
    if (!activeLoc || !overLoc || activeLoc.parent_id !== overLoc.parent_id) return;

    const siblings = descendants
      .filter((l) => l.parent_id === activeLoc.parent_id)
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));

    const oldIndex = siblings.findIndex((l) => l.id === activeId);
    const newIndex = siblings.findIndex((l) => l.id === overId);
    if (oldIndex === newIndex) return;

    const reordered = arrayMove(siblings, oldIndex, newIndex);
    reorderMut.mutate({
      items: reordered.map((l, i) => ({ id: l.id, sort_order: i * 10 })),
    });
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteMut.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
  };

  return (
    <div className="w-56 h-full border-r bg-background flex flex-col shrink-0 overflow-hidden">
      {/* ── Locations tree ─────────────────────────────────────────────── */}
      <SectionHeader
        title={t("sections.locations")}
        count={descendants.length}
        open={treeOpen}
        onToggle={() => setTreeOpen((v) => !v)}
      />
      {treeOpen && (
        <div className="overflow-y-auto border-b py-1 max-h-52 shrink-0">
          {treeRoots.length === 0 ? (
            <p className="text-[10px] text-muted-foreground px-3 py-2 leading-relaxed">
              {t("states.noLocations")}
            </p>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              modifiers={[restrictToVerticalAxis]}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={treeRoots.map((l) => l.id)}
                strategy={verticalListSortingStrategy}
              >
                {treeRoots.map((loc) => (
                  <SortableTreeNode
                    key={loc.id}
                    location={loc}
                    allLocations={descendants}
                    placedLocationIds={placedLocationIds}
                    onSelect={onSelectLocation}
                    depth={0}
                    t={t}
                  />
                ))}
              </SortableContext>

              <DragOverlay dropAnimation={null}>
                {activeLocation && <DragPreview location={activeLocation} />}
              </DragOverlay>
            </DndContext>
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
                    style={{ backgroundColor: loc.color ?? "#10b981" }}
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
                    onClick={() => setDeleteTarget(loc)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Delete confirmation ──────────────────────────────────────────── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteDialog.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteDialog.description", { name: deleteTarget?.name ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMut.isPending}>
              {t("actions.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMut.isPending}
              onClick={confirmDelete}
            >
              {deleteMut.isPending ? t("actions.deleting") : t("actions.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
