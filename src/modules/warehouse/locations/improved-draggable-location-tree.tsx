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
  DragOverEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { LocationTreeItem } from "@/lib/types/location-tree";
import { ImprovedDraggableLocationNode } from "./improved-draggable-location-node";
import { toast } from "react-toastify";
import { reorderLocations, LocationReorderItem } from "@/app/actions/warehouse/reorder-locations";

interface ImprovedDraggableLocationTreeProps {
  locations: LocationTreeItem[];
  onEdit?: (location: LocationTreeItem) => void;
  onAddChild?: (parentLocation: LocationTreeItem) => void;
  onDelete?: (location: LocationTreeItem) => void;
  onMove?: (location: LocationTreeItem) => void;
  onReorderComplete?: () => void;
  branchId: string;
  level?: number;
  parentId?: string | null;
}

const measuring = {
  droppable: {
    strategy: MeasuringStrategy.Always,
  },
};

export function ImprovedDraggableLocationTree({
  locations,
  onEdit,
  onAddChild,
  onDelete,
  onMove,
  onReorderComplete,
  branchId,
  level = 0,
}: ImprovedDraggableLocationTreeProps) {
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [isReordering, setIsReordering] = React.useState(false);
  const [localLocations, setLocalLocations] = React.useState(locations);
  const [overId, setOverId] = React.useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Update local locations when props change
  React.useEffect(() => {
    setLocalLocations(locations);
  }, [locations]);

  // Get all location IDs at this level for sortable context
  const locationIds = localLocations.map((loc) => loc.id);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    setIsDragging(true);
  };

  const handleDragOver = (event: DragOverEvent) => {
    setOverId((event.over?.id as string) || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setIsDragging(false);
    setOverId(null);

    if (!over || active.id === over.id) {
      return;
    }

    const activeIndex = localLocations.findIndex((loc) => loc.id === active.id);
    const overIndex = localLocations.findIndex((loc) => loc.id === over.id);

    if (activeIndex === -1 || overIndex === -1) {
      return;
    }

    // Optimistically update the local state for immediate UI feedback
    const newOrder = arrayMove(localLocations, activeIndex, overIndex);
    setLocalLocations(newOrder);

    // Create update payload with new sort orders
    const locationUpdates: LocationReorderItem[] = newOrder.map((loc, index) => ({
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
        // Revert the optimistic update on error
        setLocalLocations(locations);
      }
    } catch (error) {
      console.error("Error reordering locations:", error);
      toast.error("Wystąpił błąd podczas zmiany kolejności lokalizacji.");
      // Revert the optimistic update on error
      setLocalLocations(locations);
    } finally {
      setIsReordering(false);
    }
  };

  const activeLocation = activeId ? localLocations.find((loc) => loc.id === activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      measuring={measuring}
      modifiers={[restrictToVerticalAxis]}
    >
      <SortableContext items={locationIds} strategy={verticalListSortingStrategy}>
        <div className="space-y-1">
          {isReordering && level === 0 && (
            <div className="mb-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
              Aktualizowanie kolejności lokalizacji...
            </div>
          )}
          {localLocations.map((location, index) => (
            <ImprovedDraggableLocationNode
              key={location.id}
              location={location}
              onEdit={onEdit}
              onAddChild={onAddChild}
              onDelete={onDelete}
              onMove={onMove}
              onReorderComplete={onReorderComplete}
              branchId={branchId}
              level={level}
              index={index}
              isDragging={isDragging}
              isOver={overId === location.id}
              isActive={activeId === location.id}
            />
          ))}
        </div>
      </SortableContext>

      <DragOverlay>
        {activeLocation ? (
          <div className="rotate-2 rounded-lg border-2 border-blue-500 bg-card p-3 opacity-90 shadow-2xl">
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
