"use client";

import * as React from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Settings2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { ColumnConfig } from "../types";
import { useTableStore } from "../store/table-store";

interface ColumnManagerProps<T> {
  columns: ColumnConfig<T>[];
}

interface SortableColumnItemProps {
  column: ColumnConfig<any>;
  isVisible: boolean;
  onToggle: (key: string) => void;
  canHide: boolean;
}

function SortableColumnItem({ column, isVisible, onToggle, canHide }: SortableColumnItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: column.key,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent",
        isDragging && "opacity-50"
      )}
    >
      <div {...attributes} {...listeners} className="cursor-grab touch-none active:cursor-grabbing">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>
      <Checkbox
        checked={isVisible}
        onCheckedChange={() => onToggle(column.key)}
        disabled={!canHide}
        id={`column-${column.key}`}
      />
      <label htmlFor={`column-${column.key}`} className="flex-1 cursor-pointer select-none">
        {column.header}
      </label>
    </div>
  );
}

export function ColumnManager<T>({ columns }: ColumnManagerProps<T>) {
  const columnVisibility = useTableStore((state) => state.columnVisibility);
  const columnOrder = useTableStore((state) => state.columnOrder);
  const setColumnVisibility = useTableStore((state) => state.setColumnVisibility);
  const setColumnOrder = useTableStore((state) => state.setColumnOrder);

  // Initialize column order if empty
  React.useEffect(() => {
    if (columnOrder.length === 0) {
      setColumnOrder(columns.map((col) => col.key));
    }
  }, [columns, columnOrder.length, setColumnOrder]);

  // Initialize column visibility
  React.useEffect(() => {
    const initialVisibility: Record<string, boolean> = {};
    columns.forEach((col) => {
      if (columnVisibility[col.key] === undefined) {
        initialVisibility[col.key] = col.defaultVisible !== false;
      }
    });
    if (Object.keys(initialVisibility).length > 0) {
      Object.entries(initialVisibility).forEach(([key, visible]) => {
        setColumnVisibility(key, visible);
      });
    }
  }, [columns, columnVisibility, setColumnVisibility]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Get ordered columns
  const orderedColumns = React.useMemo(() => {
    if (columnOrder.length === 0) return columns;

    const columnMap = new Map(columns.map((col) => [col.key, col]));
    const ordered = columnOrder
      .map((key) => columnMap.get(key))
      .filter((col): col is ColumnConfig<T> => col !== undefined);

    // Add any columns not in order
    columns.forEach((col) => {
      if (!columnOrder.includes(col.key)) {
        ordered.push(col);
      }
    });

    return ordered;
  }, [columns, columnOrder]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = orderedColumns.findIndex((col) => col.key === active.id);
      const newIndex = orderedColumns.findIndex((col) => col.key === over.id);
      const newOrder = arrayMove(orderedColumns, oldIndex, newIndex).map((col) => col.key);
      setColumnOrder(newOrder);
    }
  };

  const handleToggle = (key: string) => {
    const currentVisibility = columnVisibility[key] ?? true;
    setColumnVisibility(key, !currentVisibility);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 px-2">
          <Settings2 className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[200px] p-2">
        <div className="mb-2 px-2 text-xs font-semibold text-muted-foreground">
          Show/Hide Columns
        </div>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={orderedColumns.map((col) => col.key)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-0.5">
              {orderedColumns.map((column) => (
                <SortableColumnItem
                  key={column.key}
                  column={column}
                  isVisible={columnVisibility[column.key] ?? true}
                  onToggle={handleToggle}
                  canHide={column.canHide !== false}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
