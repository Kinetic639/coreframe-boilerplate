"use client";

import type { CSSProperties, ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/utils";

interface KanbanCardProps {
  id: string;
  children: ReactNode;
  disabled?: boolean;
  className?: string;
}

export function KanbanCard({ id, children, disabled = false, className }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group rounded-md border border-border bg-card p-3 shadow-xs transition",
        "hover:border-muted-foreground/35 focus-within:ring-2 focus-within:ring-ring/30",
        disabled ? "cursor-not-allowed opacity-60" : "cursor-grab active:cursor-grabbing",
        isDragging && "rotate-1 opacity-45 ring-2 ring-ring/30",
        className
      )}
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  );
}
