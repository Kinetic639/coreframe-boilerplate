import type { KanbanTaskStatus } from "@/lib/types/kanban";

function pad(value: number) {
  return String(value).padStart(2, "0");
}

/**
 * The day of a due date as a date input shows it, in the viewer's own time
 * zone (toISOString would give the UTC day, a day off late in the evening).
 */
export function toDateInput(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** A picked day is stored at noon UTC, which is the same day in every European zone. */
export function fromDateInput(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return new Date(`${value}T12:00:00.000Z`).toISOString();
}

/** How a due date looks on a card: done (green), overdue (red), soon (amber) or plain. */
export type DueState = "done" | "overdue" | "soon" | "normal";

function dayNumber(date: Date) {
  return Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / (24 * 60 * 60 * 1000)
  );
}

export function dueState(
  dueAt: string | null,
  status: KanbanTaskStatus,
  now: Date = new Date()
): DueState | null {
  if (!dueAt) return null;
  if (status === "completed") return "done";
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) return null;
  const days = dayNumber(due) - dayNumber(now);
  if (status === "cancelled") return "normal";
  if (days < 0) return "overdue";
  if (days <= 1) return "soon";
  return "normal";
}

export const DUE_STATE_CLASSES: Record<DueState, string> = {
  done: "bg-emerald-600 text-white",
  overdue: "bg-red-600 text-white",
  soon: "bg-amber-400 text-amber-950",
  normal: "text-muted-foreground",
};
