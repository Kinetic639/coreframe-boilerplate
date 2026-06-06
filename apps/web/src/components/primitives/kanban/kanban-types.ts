import type { ReactNode } from "react";

export interface KanbanColumnDefinition {
  id: string;
  title: string;
  description?: string | null;
  color?: string | null;
}

export interface KanbanCardMoveParams {
  itemId: string;
  fromColumnId: string;
  toColumnId: string;
  oldIndex: number;
  newIndex: number;
}

export interface KanbanBoardLabels {
  emptyColumn?: string;
  dragColumn?: string;
  collapseColumn?: string;
  expandColumn?: string;
}

export interface KanbanBoardProps<TItem> {
  columns: KanbanColumnDefinition[];
  items: TItem[];
  getItemId: (item: TItem) => string;
  getItemColumnId: (item: TItem) => string;
  renderCard: (item: TItem, isOverlay?: boolean) => ReactNode;
  onCardMove?: (params: KanbanCardMoveParams) => void | Promise<void>;
  onColumnsChange?: (columns: KanbanColumnDefinition[]) => void | Promise<void>;
  renderColumnActions?: (column: KanbanColumnDefinition) => ReactNode;
  renderColumnFooter?: (column: KanbanColumnDefinition) => ReactNode;
  renderColumnEmpty?: (column: KanbanColumnDefinition) => ReactNode;
  renderAddColumn?: () => ReactNode;
  renderScrollableHeader?: () => ReactNode;
  renderScrollableEmpty?: () => ReactNode;
  labels?: KanbanBoardLabels;
  className?: string;
  columnClassName?: string;
  scrollAreaClassName?: string;
  fixedStartColumnIds?: string[];
  fixedStartClassName?: string;
  fixedColumnClassName?: string;
  disabled?: boolean;
  columnsDraggable?: boolean;
  nonDraggableColumnIds?: string[];
  collapsedColumnIds?: string[];
  onColumnCollapsedChange?: (columnId: string, collapsed: boolean) => void;
}
