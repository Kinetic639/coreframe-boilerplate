import type { KanbanColumnDefinition } from "./kanban-types";

export function groupKanbanItems<TItem>(
  columns: KanbanColumnDefinition[],
  items: TItem[],
  getItemColumnId: (item: TItem) => string
): Record<string, TItem[]> {
  const groups: Record<string, TItem[]> = {};
  for (const column of columns) groups[column.id] = [];

  for (const item of items) {
    const columnId = getItemColumnId(item);
    groups[columnId] ??= [];
    groups[columnId].push(item);
  }

  return groups;
}

export function reorderKanbanItems<TItem>(items: TItem[], oldIndex: number, newIndex: number) {
  const next = [...items];
  const [moved] = next.splice(oldIndex, 1);
  if (!moved) return next;
  next.splice(newIndex, 0, moved);
  return next;
}

export function moveKanbanItem<TItem>(
  sourceItems: TItem[],
  destinationItems: TItem[],
  sourceIndex: number,
  destinationIndex: number
) {
  const source = [...sourceItems];
  const destination = [...destinationItems];
  const [moved] = source.splice(sourceIndex, 1);
  if (!moved) return { source, destination };
  destination.splice(destinationIndex, 0, moved);
  return { source, destination };
}
