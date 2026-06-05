"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  closestCorners,
  defaultDropAnimationSideEffects,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { cn } from "@/utils";
import { KanbanColumn } from "./kanban-column";
import type { KanbanBoardProps, KanbanColumnDefinition } from "./kanban-types";
import { groupKanbanItems, moveKanbanItem, reorderKanbanItems } from "./kanban-utils";

export function KanbanBoard<TItem>({
  columns,
  items,
  getItemId,
  getItemColumnId,
  renderCard,
  onCardMove,
  onColumnsChange,
  renderColumnActions,
  renderColumnFooter,
  renderAddColumn,
  labels,
  className,
  columnClassName,
  disabled = false,
  columnsDraggable = true,
  collapsedColumnIds = [],
  onColumnCollapsedChange,
}: KanbanBoardProps<TItem>) {
  const [orderedColumns, setOrderedColumns] = useState(columns);
  const [groupedItems, setGroupedItems] = useState(() =>
    groupKanbanItems(columns, items, getItemColumnId)
  );
  const [activeItem, setActiveItem] = useState<TItem | null>(null);
  const [activeColumn, setActiveColumn] = useState<KanbanColumnDefinition | null>(null);
  const sourceColumnIdRef = useRef<string | null>(null);
  const originalIndexRef = useRef(0);

  useEffect(() => {
    setOrderedColumns(columns);
    setGroupedItems(groupKanbanItems(columns, items, getItemColumnId));
  }, [columns, getItemColumnId, items]);

  useEffect(() => {
    if (!activeItem && !activeColumn) return;

    const previousBodyCursor = document.body.style.cursor;
    const previousRootCursor = document.documentElement.style.cursor;
    document.body.style.cursor = "grabbing";
    document.documentElement.style.cursor = "grabbing";

    return () => {
      document.body.style.cursor = previousBodyCursor;
      document.documentElement.style.cursor = previousRootCursor;
    };
  }, [activeColumn, activeItem]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const columnIds = useMemo(() => orderedColumns.map((column) => column.id), [orderedColumns]);
  const collapsedColumnSet = useMemo(() => new Set(collapsedColumnIds), [collapsedColumnIds]);

  const resetToProps = useCallback(() => {
    setOrderedColumns(columns);
    setGroupedItems(groupKanbanItems(columns, items, getItemColumnId));
  }, [columns, getItemColumnId, items]);

  const findColumnForItem = useCallback(
    (itemId: string) =>
      Object.entries(groupedItems).find(([, list]) =>
        list.some((item) => getItemId(item) === itemId)
      )?.[0] ?? null,
    [getItemId, groupedItems]
  );

  const handleDragStart = (event: DragStartEvent) => {
    const activeId = String(event.active.id);
    const column = orderedColumns.find((candidate) => candidate.id === activeId);

    if (column) {
      if (!columnsDraggable) return;
      setActiveColumn(column);
      return;
    }

    const sourceColumnId = findColumnForItem(activeId);
    if (!sourceColumnId) return;

    const sourceItems = groupedItems[sourceColumnId] ?? [];
    const index = sourceItems.findIndex((item) => getItemId(item) === activeId);
    if (index === -1) return;

    sourceColumnIdRef.current = sourceColumnId;
    originalIndexRef.current = index;
    setActiveItem(sourceItems[index] ?? null);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    const draggingColumn =
      columnsDraggable && orderedColumns.some((column) => column.id === activeId);
    if (draggingColumn) {
      const activeIndex = orderedColumns.findIndex((column) => column.id === activeId);
      const overIndex = orderedColumns.findIndex((column) => column.id === overId);
      if (activeIndex !== -1 && overIndex !== -1 && activeIndex !== overIndex) {
        setOrderedColumns((current) => arrayMove(current, activeIndex, overIndex));
      }
      return;
    }

    const activeColumnId = findColumnForItem(activeId);
    const overIsColumn = orderedColumns.some((column) => column.id === overId);
    const overColumnId = overIsColumn ? overId : findColumnForItem(overId);
    if (!activeColumnId || !overColumnId) return;

    if (activeColumnId === overColumnId) {
      const list = groupedItems[activeColumnId] ?? [];
      const activeIndex = list.findIndex((item) => getItemId(item) === activeId);
      const overIndex = list.findIndex((item) => getItemId(item) === overId);
      if (activeIndex !== -1 && overIndex !== -1 && activeIndex !== overIndex) {
        setGroupedItems((current) => ({
          ...current,
          [activeColumnId]: reorderKanbanItems(list, activeIndex, overIndex),
        }));
      }
      return;
    }

    setGroupedItems((current) => {
      const sourceItems = current[activeColumnId] ?? [];
      const destinationItems = current[overColumnId] ?? [];
      const sourceIndex = sourceItems.findIndex((item) => getItemId(item) === activeId);
      const destinationIndex = overIsColumn
        ? destinationItems.length
        : destinationItems.findIndex((item) => getItemId(item) === overId);
      const { source, destination } = moveKanbanItem(
        sourceItems,
        destinationItems,
        sourceIndex,
        destinationIndex === -1 ? destinationItems.length : destinationIndex
      );

      return { ...current, [activeColumnId]: source, [overColumnId]: destination };
    });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    const wasColumnDrag = activeColumn !== null;
    setActiveItem(null);
    setActiveColumn(null);

    if (!over) {
      sourceColumnIdRef.current = null;
      resetToProps();
      return;
    }

    const activeId = String(active.id);
    const overId = String(over.id);

    if (wasColumnDrag) {
      if (!columnsDraggable) {
        resetToProps();
        return;
      }

      const activeIndex = columns.findIndex((column) => column.id === activeId);
      const overIndex = columns.findIndex((column) => column.id === overId);
      if (activeIndex !== -1 && overIndex !== -1 && activeIndex !== overIndex) {
        await onColumnsChange?.(arrayMove(columns, activeIndex, overIndex));
      } else {
        resetToProps();
      }
      return;
    }

    const fromColumnId = sourceColumnIdRef.current;
    sourceColumnIdRef.current = null;

    const toColumnId = findColumnForItem(activeId);
    if (!fromColumnId || !toColumnId) {
      resetToProps();
      return;
    }

    const destinationItems = groupedItems[toColumnId] ?? [];
    const newIndex = destinationItems.findIndex((item) => getItemId(item) === activeId);
    if (fromColumnId === toColumnId && originalIndexRef.current === newIndex) return;

    try {
      await onCardMove?.({
        itemId: activeId,
        fromColumnId,
        toColumnId,
        oldIndex: originalIndexRef.current,
        newIndex,
      });
    } catch {
      resetToProps();
    }
  };

  return (
    <DndContext
      id="ambra-kanban"
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={disabled ? undefined : handleDragStart}
      onDragOver={disabled ? undefined : handleDragOver}
      onDragEnd={disabled ? undefined : handleDragEnd}
    >
      <div className={cn("flex h-full min-h-0 gap-4 overflow-x-auto p-1 pb-4", className)}>
        <SortableContext items={columnIds} strategy={horizontalListSortingStrategy}>
          {orderedColumns.map((column) => (
            <KanbanColumn
              key={column.id}
              column={column}
              items={groupedItems[column.id] ?? []}
              getItemId={getItemId}
              renderCard={(item) => renderCard(item, false)}
              actions={renderColumnActions?.(column)}
              footer={renderColumnFooter?.(column)}
              labels={labels}
              className={columnClassName}
              disabled={disabled}
              columnDraggable={columnsDraggable}
              collapsed={collapsedColumnSet.has(column.id)}
              onCollapsedChange={
                onColumnCollapsedChange
                  ? (collapsed) => onColumnCollapsedChange(column.id, collapsed)
                  : undefined
              }
            />
          ))}
        </SortableContext>
        {renderAddColumn ? <div className="shrink-0">{renderAddColumn()}</div> : null}
      </div>

      <DragOverlay
        dropAnimation={{
          sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: "0.4" } } }),
        }}
      >
        {activeItem ? (
          <div className="pointer-events-none w-[20rem] rotate-1 shadow-lg">
            {renderCard(activeItem, true)}
          </div>
        ) : activeColumn ? (
          <KanbanColumn
            column={activeColumn}
            items={groupedItems[activeColumn.id] ?? []}
            getItemId={getItemId}
            renderCard={(item) => renderCard(item, false)}
            labels={labels}
            columnDraggable={columnsDraggable}
            isOverlay
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
