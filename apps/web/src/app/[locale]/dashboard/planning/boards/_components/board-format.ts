// Formatting shared by the board and the task editor lives with the editor;
// the board re-exports it under the old names.
export {
  LABEL_COLORS,
  STATUS_DOT_COLORS,
  activityLabel,
  columnName,
  initials,
  priorityLabel,
  statusLabel,
} from "@/components/planning/task-editor/task-labels";
export {
  dueState,
  DUE_STATE_CLASSES,
  fromDateInput,
  toDateInput,
} from "@/components/planning/task-editor/task-dates";

export const COLUMN_COLORS = [
  "#64748b",
  "#0d9488",
  "#16a34a",
  "#ca8a04",
  "#ea580c",
  "#dc2626",
  "#db2777",
  "#7c3aed",
  "#2563eb",
  "#0891b2",
];
export const INBOX_COLUMN_ID = "__kanban_inbox__";
