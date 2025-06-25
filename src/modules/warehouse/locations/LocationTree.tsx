"use client";

import { useState } from "react";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card } from "@/components/ui/card";
import ProductList, { Product } from "./ProductList";
import type { LocationOption } from "./LocationForm";

export interface Location {
  id: string;
  name: string;
  products?: Product[];
  children?: Location[];
}

interface Props {
  locations: Location[];
  isEditMode?: boolean;
  parentOptions?: LocationOption[];
  onEdit?: (location: Location) => void;
  onDelete?: (location: Location) => void;
}

function SortableItem({
  location,
  isEditMode,
  parentOptions,
  onEdit,
  onDelete,
}: {
  location: Location;
  isEditMode: boolean;
  parentOptions?: LocationOption[];
  onEdit?: (location: Location) => void;
  onDelete?: (location: Location) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: location.id,
    disabled: !isEditMode || (location.products && location.products.length > 0),
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`rounded border p-2 ${isDragging ? "opacity-50" : ""}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span>{location.name}</span>
        <div className="flex items-center gap-1">
          {location.products && location.products.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {location.products.length} prod.
            </span>
          )}
          {isEditMode && (
            <>
              <LocationForm
                parentOptions={parentOptions || []}
                defaultValues={{
                  name: location.name,
                  parentId: null,
                  locationId: location.id,
                  imageUrl: undefined,
                }}
                onSubmit={(vals) => onEdit?.({ ...location, name: vals.name })}
              >
                <Button size="icon" variant="ghost" type="button">
                  ✏️
                </Button>
              </LocationForm>
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="icon" variant="ghost" type="button">
                    🗑️
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-sm">
                  <DialogHeader>
                    <DialogTitle>Usuń lokalizację?</DialogTitle>
                  </DialogHeader>
                  <DialogFooter>
                    <Button variant="secondary" type="button" onClick={() => {}}>
                      Anuluj
                    </Button>
                    <Button
                      variant="destructive"
                      type="button"
                      onClick={() => onDelete?.(location)}
                    >
                      Usuń
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>
      </div>
      {location.products && location.products.length > 0 && (
        <div className="mt-2">
          <ProductList products={location.products} />
        </div>
      )}
    </div>
  );
}

function LocationNode({
  location,
  depth,
  isEditMode,
  parentOptions,
  onEdit,
  onDelete,
}: {
  location: Location;
  depth: number;
  isEditMode: boolean;
  parentOptions?: LocationOption[];
  onEdit?: (location: Location) => void;
  onDelete?: (location: Location) => void;
}) {
  return (
    <li className="mb-2">
      <SortableItem
        location={location}
        isEditMode={isEditMode}
        parentOptions={parentOptions}
        onEdit={onEdit}
        onDelete={onDelete}
      />
      {depth < 3 && location.children && location.children.length > 0 && (
        <ul className="ml-4 mt-2 space-y-2">
          <SortableContext items={location.children.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            {location.children.map((child) => (
              <LocationNode
                key={child.id}
                location={child}
                depth={depth + 1}
                isEditMode={isEditMode}
                parentOptions={parentOptions}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </SortableContext>
        </ul>
      )}
    </li>
  );
}

export default function LocationTree({
  locations: initial,
  isEditMode = false,
  parentOptions = [],
  onEdit,
  onDelete,
}: Props) {
  const [locations, setLocations] = useState<Location[]>(initial);

  const sensors = useSensors(useSensor(PointerSensor));

  const reorder = (
    nodes: Location[],
    activeId: string,
    overId: string
  ): { moved: boolean; nodes: Location[] } => {
    const activeIndex = nodes.findIndex((n) => n.id === activeId);
    const overIndex = nodes.findIndex((n) => n.id === overId);
    if (activeIndex !== -1 && overIndex !== -1) {
      return { moved: true, nodes: arrayMove(nodes, activeIndex, overIndex) };
    }
    let moved = false;
    const newNodes = nodes.map((n) => {
      if (!n.children) return n;
      const res = reorder(n.children, activeId, overId);
      if (res.moved) {
        moved = true;
        return { ...n, children: res.nodes };
      }
      return n;
    });
    return { moved, nodes: newNodes };
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setLocations((locs) => reorder(locs, active.id as string, over.id as string).nodes);
  };

  return (
    <DndContext sensors={isEditMode ? sensors : []} onDragEnd={isEditMode ? handleDragEnd : undefined}>
      <Card className="p-4">
        <ul className="space-y-2">
          <SortableContext items={locations.map((l) => l.id)} strategy={verticalListSortingStrategy}>
            {locations.map((loc) => (
              <LocationNode
                key={loc.id}
                location={loc}
                depth={1}
                isEditMode={isEditMode}
                parentOptions={parentOptions}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </SortableContext>
        </ul>
      </Card>
    </DndContext>
  );
}
