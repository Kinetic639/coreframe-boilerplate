"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, Columns3, GripVertical } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cn } from "../lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "../popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../tooltip";
import { serializeLayout, type ColumnLayout } from "./columns";

// A table's "Kolumny" menu, in the header of its last column:
// tick the columns to show and drag them into order (by mouse, touch or
// keyboard: Space picks one up, arrows move it, Space puts it down). The
// layout goes to a cookie and the server renders the table again.

/** Saves a table's layout for a year (read by the server). */
function saveLayout(cookie: string, layout: ColumnLayout) {
  document.cookie = `${cookie}=${encodeURIComponent(
    serializeLayout(layout)
  )}; path=/; max-age=31536000; samesite=lax`;
}

const announcementsFor = (labels: Record<string, string>) => ({
  onDragStart: ({ active }: { active: { id: string | number } }) =>
    `Podniesiono kolumnę ${labels[String(active.id)]}.`,
  onDragOver: ({
    active,
    over,
  }: {
    active: { id: string | number };
    over: { id: string | number } | null;
  }) =>
    over
      ? `Kolumna ${labels[String(active.id)]} nad kolumną ${labels[String(over.id)]}.`
      : undefined,
  onDragEnd: ({
    active,
    over,
  }: {
    active: { id: string | number };
    over: { id: string | number } | null;
  }) =>
    over
      ? `Kolumna ${labels[String(active.id)]} odłożona w miejsce kolumny ${labels[String(over.id)]}.`
      : `Kolumna ${labels[String(active.id)]} odłożona.`,
  onDragCancel: ({ active }: { active: { id: string | number } }) =>
    `Anulowano przenoszenie kolumny ${labels[String(active.id)]}.`,
});

export function ColumnsMenu({
  layout: saved,
  cookie,
  labels,
  pinnedLabel,
  defaults,
  onChange,
}: {
  layout: ColumnLayout;
  /**
   * The table follows the layout itself (no server render): it gets each
   * change here. None: the server renders the table again.
   */
  onChange?: (layout: ColumnLayout) => void;
  /** The cookie the layout is kept in. */
  cookie: string;
  /** Each column's name, by its id. */
  labels: Record<string, string>;
  /** The pinned first column, always shown. */
  pinnedLabel: string;
  /** The usual layout ("Przywróć domyślne"). */
  defaults: ColumnLayout;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [layout, setLayout] = useState(saved);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const apply = (next: ColumnLayout) => {
    setLayout(next);
    saveLayout(cookie, next);
    if (onChange) onChange(next);
    else startTransition(() => router.refresh());
  };
  const toggle = (id: string) => {
    const next = layout.map((column) =>
      column.id === id ? { ...column, shown: !column.shown } : column
    );
    // One column besides the number stays.
    if (next.some((column) => column.shown)) apply(next);
  };
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = layout.findIndex((column) => column.id === active.id);
    const to = layout.findIndex((column) => column.id === over.id);
    apply(arrayMove(layout, from, to));
  };

  return (
    <Popover onOpenChange={(open) => open && setLayout(saved)}>
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger
              aria-label="Kolumny"
              className="inline-grid size-7 place-items-center rounded-[5px] text-[var(--text-muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:outline-none data-[state=open]:bg-[var(--surface-subtle)]"
            >
              <Columns3 aria-hidden="true" className="size-4" />
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>Kolumny</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <PopoverContent align="end" className="w-60 p-1 text-[0.8125rem]">
        <p className="px-2 py-1 text-[0.7rem] text-[var(--text-muted)]">
          Kolumny · przeciągnij, by zmienić kolejność
        </p>
        <div className="flex h-7 items-center gap-2 px-2 text-[var(--text-muted)]">
          <span className="w-3.5" />
          <Box checked />
          {pinnedLabel}
          <span className="ml-auto text-[0.7rem]">zawsze</span>
        </div>
        <DndContext
          accessibility={{
            announcements: announcementsFor(labels),
            screenReaderInstructions: {
              draggable:
                "Aby przenieść kolumnę, naciśnij spację, przesuń ją strzałkami i naciśnij spację, by ją odłożyć. Escape anuluje.",
            },
          }}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
          sensors={sensors}
        >
          <SortableContext
            items={layout.map((column) => column.id)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="grid gap-px">
              {layout.map((column) => (
                <ColumnRow
                  id={column.id}
                  key={column.id}
                  label={labels[column.id] ?? column.id}
                  onToggle={() => toggle(column.id)}
                  shown={column.shown}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
        <div className="my-1 h-px bg-[var(--border)]" />
        <button
          className="flex h-7 w-full items-center rounded-[5px] px-2 text-left hover:bg-[var(--surface-subtle)] focus-visible:bg-[var(--surface-subtle)] focus-visible:outline-none"
          onClick={() => apply(defaults)}
          type="button"
        >
          Przywróć domyślne
        </button>
      </PopoverContent>
    </Popover>
  );
}

function Box({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid size-3.5 shrink-0 place-items-center rounded-[3px] border",
        checked
          ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]"
          : "border-[var(--border-strong)]"
      )}
    >
      {checked ? <Check className="size-2.5" strokeWidth={3} /> : null}
    </span>
  );
}

function ColumnRow({
  id,
  label,
  shown,
  onToggle,
}: {
  id: string;
  label: string;
  shown: boolean;
  onToggle: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });
  return (
    <li
      className={cn(
        "flex items-center rounded-[5px] bg-[var(--surface)]",
        isDragging && "relative z-10 shadow-[var(--shadow-raised)]"
      )}
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <button
        aria-label={`Przenieś kolumnę ${label}`}
        className="grid h-7 w-5 shrink-0 cursor-grab touch-none place-items-center rounded-[4px] text-[var(--text-muted)] hover:text-[var(--text)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:outline-none active:cursor-grabbing"
        ref={setActivatorNodeRef}
        type="button"
        {...attributes}
        {...listeners}
      >
        <GripVertical aria-hidden="true" className="size-3.5" />
      </button>
      <button
        aria-checked={shown}
        className="flex h-7 flex-1 items-center gap-2 rounded-[5px] pr-2 pl-1 text-left hover:bg-[var(--surface-subtle)] focus-visible:bg-[var(--surface-subtle)] focus-visible:outline-none"
        onClick={onToggle}
        role="menuitemcheckbox"
        type="button"
      >
        <Box checked={shown} />
        {label}
      </button>
    </li>
  );
}
