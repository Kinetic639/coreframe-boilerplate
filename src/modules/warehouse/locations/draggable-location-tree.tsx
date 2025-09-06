"use client";

import * as React from "react";
import {
  DndContext,
  closestCenter,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  MeasuringStrategy,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { LocationTreeItem } from "@/lib/types/location-tree";
import { DraggableLocationNode } from "./draggable-location-node";
import { toast } from "react-toastify";
import { reorderLocations, LocationReorderItem } from "@/app/actions/warehouse/reorder-locations";

interface DraggableLocationTreeProps {
  locations: LocationTreeItem[];
  onEdit?: (location: LocationTreeItem) => void;
  onAddChild?: (parentLocation: LocationTreeItem) => void;
  onDelete?: (location: LocationTreeItem) => void;
  onMove?: (location: LocationTreeItem) => void;
  onReorderComplete?: () => void;
  branchId: string;
  level?: number;
}

const measuring = {
  droppable: {
    strategy: MeasuringStrategy.Always,
  },
};

export function DraggableLocationTree({
  locations,
  onEdit,
  onAddChild,
  onDelete,
  onMove,
  onReorderComplete,
  branchId,
  level = 0,
}: DraggableLocationTreeProps) {
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [isReordering, setIsReordering] = React.useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Flatten all locations for easier manipulation
  const flattenLocations = React.useCallback(
    (locs: LocationTreeItem[]): LocationTreeItem[] => {
      const flattened: LocationTreeItem[] = [];

      const traverse = (items: LocationTreeItem[], currentLevel: number) => {
        items.forEach((item) => {
          flattened.push({ ...item, level: currentLevel });
          if (item.children && item.children.length > 0) {
            traverse(item.children, currentLevel + 1);
          }
        });
      };

      traverse(locs, level);
      return flattened;
    },
    [level]
  );

  const flatLocations = React.useMemo(
    () => flattenLocations(locations),
    [locations, flattenLocations]
  );
  const locationIds = flatLocations.map((loc) => loc.id);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    setIsDragging(true);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setIsDragging(false);

    if (!over || active.id === over.id) {
      return;
    }

    const activeIndex = flatLocations.findIndex((loc) => loc.id === active.id);
    const overIndex = flatLocations.findIndex((loc) => loc.id === over.id);

    if (activeIndex === -1 || overIndex === -1) {
      return;
    }

    const activeLocation = flatLocations[activeIndex];
    const overLocation = flatLocations[overIndex];

    // Don't allow reordering between different levels or parents
    if (
      activeLocation.level !== overLocation.level ||
      (activeLocation as any).parent_id !== (overLocation as any).parent_id
    ) {
      toast.error("Można zmieniać kolejność tylko w ramach tego samego poziomu.");
      return;
    }

    // Create reordered array
    const reorderedLocations = [...flatLocations];
    reorderedLocations.splice(activeIndex, 1);
    reorderedLocations.splice(overIndex, 0, activeLocation);

    // Filter locations that belong to the same parent and level
    const siblingLocations = reorderedLocations.filter(
      (loc) =>
        loc.level === activeLocation.level &&
        (loc as any).parent_id === (activeLocation as any).parent_id
    );

    // Create update payload with new sort orders
    const locationUpdates: LocationReorderItem[] = siblingLocations.map((loc, index) => ({
      id: loc.id,
      sort_order: index + 1,
    }));

    try {
      setIsReordering(true);
      const result = await reorderLocations(branchId, locationUpdates);

      if (result.success) {
        toast.success("Kolejność lokalizacji została zaktualizowana.");
        onReorderComplete?.();
      } else {
        toast.error(result.error || "Błąd podczas zmiany kolejności lokalizacji.");
      }
    } catch (error) {
      console.error("Error reordering locations:", error);
      toast.error("Wystąpił błąd podczas zmiany kolejności lokalizacji.");
    } finally {
      setIsReordering(false);
    }
  };

  const activeLocation = activeId ? flatLocations.find((loc) => loc.id === activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      measuring={measuring}
    >
      <SortableContext items={locationIds} strategy={verticalListSortingStrategy}>
        <div className="space-y-0">
          {isReordering && (
            <div className="mb-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
              Aktualizowanie kolejności lokalizacji...
            </div>
          )}
          {locations.map((location) => (
            <DraggableLocationNode
              key={location.id}
              location={location}
              onEdit={onEdit}
              onAddChild={onAddChild}
              onDelete={onDelete}
              onMove={onMove}
              level={level}
              isDragging={isDragging}
            />
          ))}
        </div>
      </SortableContext>

      <DragOverlay>
        {activeLocation ? (
          <div className="rounded-lg border bg-card p-3 shadow-lg">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md text-white"
                style={{ backgroundColor: activeLocation.color || "#6b7280" }}
              >
                <span className="text-sm font-medium">
                  {activeLocation.icon_name?.charAt(0) || "L"}
                </span>
              </div>
              <div>
                <h3 className="text-sm font-medium">{activeLocation.name}</h3>
                {activeLocation.code && (
                  <p className="text-xs text-muted-foreground">{activeLocation.code}</p>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
