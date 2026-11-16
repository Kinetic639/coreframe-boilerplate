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

/** "HH:MM" of a moment in the viewer's own time zone ("" for none). */
export function toTimeInput(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export interface TaskDatesDraft {
  /** YYYY-MM-DD or "". */
  start: string;
  /** YYYY-MM-DD or "". */
  due: string;
  /** HH:MM or "" (a plain day). */
  time: string;
}

export interface TaskDatesPayload {
  start_date: string | null;
  due_at: string | null;
  due_has_time: boolean;
  timezone: string;
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * What the dates picker sends. A due day with an hour is that moment in the
 * viewer's zone; a plain day is noon UTC (the same day across Europe). A start
 * day after the due day is moved back to it, and a start alone is kept.
 */
export function buildTaskDates(draft: TaskDatesDraft, timezone: string): TaskDatesPayload {
  const due = DAY_RE.test(draft.due) ? draft.due : "";
  let start = DAY_RE.test(draft.start) ? draft.start : "";
  if (start && due && start > due) start = due;
  const hasTime = Boolean(due) && TIME_RE.test(draft.time);
  let dueAt: string | null = null;
  if (due && hasTime) {
    const [y, m, d] = due.split("-").map(Number);
    const [hh, mm] = draft.time.split(":").map(Number);
    dueAt = new Date(y, m - 1, d, hh, mm, 0, 0).toISOString();
  } else if (due) {
    dueAt = fromDateInput(due);
  }
  return { start_date: start || null, due_at: dueAt, due_has_time: hasTime, timezone };
}

/** The viewer's IANA time zone, e.g. "Europe/Warsaw". */
export function viewerTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}
