"use client";

import type { CSSProperties, ReactNode } from "react";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronsLeftRight, ChevronsRightLeft, GripVertical } from "lucide-react";
import type { KanbanBoardLabels, KanbanColumnDefinition } from "./kanban-types";
import { cn } from "@/utils";

interface KanbanColumnProps<TItem> {
  column: KanbanColumnDefinition;
  items: TItem[];
  getItemId: (item: TItem) => string;
  renderCard: (item: TItem) => ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  emptyContent?: ReactNode;
  labels?: KanbanBoardLabels;
  className?: string;
  disabled?: boolean;
  columnDraggable?: boolean;
  isOverlay?: boolean;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}

export function KanbanColumn<TItem>({
  column,
  items,
  getItemId,
  renderCard,
  actions,
  footer,
  emptyContent,
  labels,
  className,
  disabled = false,
  columnDraggable = true,
  isOverlay = false,
  collapsed = false,
  onCollapsedChange,
}: KanbanColumnProps<TItem>) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } =
    useSortable({
      id: column.id,
      disabled: disabled || isOverlay,
    });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const itemIds = items.map(getItemId);
  const accent = column.color || "hsl(var(--muted-foreground))";

  if (collapsed) {
    return (
      <section
        ref={setNodeRef}
        style={style}
        className={cn(
          "flex max-h-[min(70vh,32rem)] w-12 shrink-0 flex-col items-center self-start rounded-md border border-border bg-muted/20",
          "transition-[border-color,background-color,box-shadow,opacity]",
          isOver && "border-dashed bg-muted/40 ring-1 ring-border",
          isDragging && "opacity-50 ring-2 ring-ring/30",
          className
        )}
      >
        <div className="flex min-h-0 flex-col items-center gap-3 px-2 py-3">
          <button
            type="button"
            className="rounded p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            aria-label={labels?.expandColumn}
            onClick={() => onCollapsedChange?.(false)}
          >
            <ChevronsLeftRight className="h-4 w-4" />
          </button>
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: accent }}
            aria-hidden="true"
          />
          <button
            type="button"
            className="flex min-h-0 max-h-72 items-center justify-center rounded text-left text-sm font-semibold text-foreground"
            title={column.title}
            onClick={() => onCollapsedChange?.(false)}
          >
            <span className="max-h-full [writing-mode:vertical-rl]">{column.title}</span>
          </button>
          <span className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-muted px-1.5 text-[11px] font-medium text-muted-foreground">
            {items.length}
          </span>
        </div>
      </section>
    );
  }

  return (
    <section
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex h-full min-h-[420px] w-[min(88vw,21rem)] shrink-0 flex-col rounded-md border border-border bg-muted/20",
        "transition-[border-color,background-color,box-shadow,opacity]",
        isOver && "border-dashed bg-muted/40 ring-1 ring-border",
        isDragging && "opacity-50 ring-2 ring-ring/30",
        className
      )}
    >
      <div className="flex min-w-0 items-start justify-between gap-2 border-b border-border px-3 py-3">
        <div className="flex min-w-0 items-start gap-2">
          {columnDraggable ? (
            <button
              type="button"
              className={cn(
                "mt-0.5 cursor-grab rounded p-0.5 text-muted-foreground transition hover:bg-muted hover:text-foreground active:cursor-grabbing",
                isDragging && "cursor-grabbing",
                disabled && "cursor-not-allowed opacity-50"
              )}
              aria-label={labels?.dragColumn}
              disabled={disabled}
              {...attributes}
              {...listeners}
            >
              <GripVertical className="h-4 w-4" />
            </button>
          ) : null}
          <span
            className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: accent }}
            aria-hidden="true"
          />
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <h2 className="truncate text-sm font-semibold" title={column.title}>
                {column.title}
              </h2>
              <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-muted px-1.5 text-[11px] font-medium text-muted-foreground">
                {items.length}
              </span>
            </div>
            {column.description ? (
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                {column.description}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {onCollapsedChange ? (
            <button
              type="button"
              className="rounded p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
              aria-label={labels?.collapseColumn}
              onClick={() => onCollapsedChange(true)}
            >
              <ChevronsRightLeft className="h-4 w-4" />
            </button>
          ) : null}
          {actions}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
          <div className="flex min-h-full flex-col gap-2">
            {items.length ? (
              items.map((item) => <div key={getItemId(item)}>{renderCard(item)}</div>)
            ) : emptyContent ? (
              emptyContent
            ) : (
              <div className="flex min-h-24 items-center justify-center rounded-md border border-dashed border-border bg-background/40 px-3 text-center text-xs text-muted-foreground">
                {labels?.emptyColumn}
              </div>
            )}
          </div>
        </SortableContext>
      </div>

      {footer ? <div className="border-t border-border p-3">{footer}</div> : null}
    </section>
  );
}
