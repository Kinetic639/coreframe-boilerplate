import type { useTranslations } from "next-intl";
import type { KanbanTaskStatus } from "@/lib/types/kanban";
import type { KanbanTaskPriority } from "@/lib/validations/kanban";

/** Translator for the "modules.planning" namespace. */
type Translate = ReturnType<typeof useTranslations>;

export const LABEL_COLORS = [
  "#16a34a",
  "#ca8a04",
  "#ea580c",
  "#dc2626",
  "#7c3aed",
  "#2563eb",
  "#0891b2",
  "#0d9488",
  "#db2777",
  "#475569",
];

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

/** Flag colour per priority (low has no flag on a card). */
export const PRIORITY_FLAG_COLORS: Record<KanbanTaskPriority, string> = {
  low: "text-slate-400",
  normal: "text-blue-500",
  high: "text-orange-500",
  urgent: "text-red-600",
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

export function priorityLabel(t: Translate, priority: string) {
  return ["low", "normal", "high", "urgent"].includes(priority) ? t(`tasks.${priority}`) : priority;
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

/** Initials for an avatar: "Anna Nowak" → "AN", "anna@x.pl" → "A". */
export function initials(name: string | null, email: string | null) {
  const source = (name ?? "").trim() || (email ?? "").trim();
  if (!source) return "?";
  const parts = source.split(/[\s@.]+/).filter(Boolean);
  if (name && parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source[0].toUpperCase();
}
