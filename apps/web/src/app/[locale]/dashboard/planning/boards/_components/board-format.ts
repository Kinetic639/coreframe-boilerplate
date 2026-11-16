import type { useTranslations } from "next-intl";
import type { KanbanTaskStatus } from "@/lib/types/kanban";

type Translate = ReturnType<typeof useTranslations>;

export const COLUMN_COLORS = ["#64748b", "#0d9488", "#f59e0b", "#6366f1", "#22c55e", "#ef4444"];
export const LABEL_COLORS = ["#0d9488", "#2563eb", "#7c3aed", "#e11d48", "#ea580c", "#16a34a"];
export const INBOX_COLUMN_ID = "__kanban_inbox__";

const STATUS_LABEL_KEYS: Record<KanbanTaskStatus, string> = {
  open: "tasks.open",
  in_progress: "tasks.inProgress",
  completed: "tasks.completed",
  cancelled: "tasks.cancelled",
};

export const STATUS_DOT_COLORS: Record<KanbanTaskStatus, string> = {
  open: "bg-slate-400",
  in_progress: "bg-amber-500",
  completed: "bg-emerald-500",
  cancelled: "bg-zinc-400",
};

const TASK_ACTIVITY_TYPES = new Set([
  "task_created",
  "title_changed",
  "description_changed",
  "assigned",
  "unassigned",
  "status_changed",
  "priority_changed",
  "due_date_changed",
  "completed",
  "reopened",
  "cancelled",
  "archived",
  "restored",
]);

export function statusLabel(t: Translate, status: KanbanTaskStatus) {
  return t(STATUS_LABEL_KEYS[status]);
}

export function activityLabel(t: Translate, type: string, fallback: string | null) {
  if (TASK_ACTIVITY_TYPES.has(type)) return t(`tasks.activityMessages.${type}`);
  const keys: Record<string, string> = {
    card_created: "activityMessages.cardCreated",
    card_updated: "activityMessages.cardUpdated",
    card_moved: "activityMessages.cardMoved",
    card_moved_to_inbox: "activityMessages.cardMovedToInbox",
    card_moved_from_inbox: "activityMessages.cardMovedFromInbox",
    card_archived: "activityMessages.cardArchived",
    comment_added: "activityMessages.commentAdded",
  };
  const key = keys[type];
  return key ? t(`boards.${key}`) : (fallback ?? type);
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

/**
 * The day of a due date as the date input shows it, in the viewer's own time
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
