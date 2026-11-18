import type {
  KANBAN_TASK_STATUSES,
  KanbanMemberRole,
  KanbanVisibility,
} from "@/lib/validations/kanban";

export type KanbanTaskStatus = (typeof KANBAN_TASK_STATUSES)[number];

export const MAX_KANBAN_BOARDS_PER_USER = 5;

export interface KanbanBoardSummary {
  id: string;
  organization_id: string;
  title: string;
  description: string | null;
  color: string | null;
  visibility: KanbanVisibility;
  /** Set for the branch scope. */
  branch_id: string | null;
  created_by: string;
  creator_name: string | null;
  creator_email: string | null;
  created_at: string;
  updated_at: string;
  /** Set while the board is archived (hidden, can be restored). */
  archived_at: string | null;
  /** The current user's role: owner, editor (adds and moves tasks) or viewer (only looks). */
  my_access: KanbanBoardAccess;
  /** The current user starred the board (favourites come first). */
  starred: boolean;
  /** Offered as a template when making a new board. */
  is_template: boolean;
  /** How many people the board is shared with (members besides its owner). */
  shared_with: number;
}

export type KanbanBoardAccess = "owner" | KanbanMemberRole;

export interface KanbanBoardMember {
  user_id: string;
  role: KanbanMemberRole;
  name: string | null;
  email: string | null;
  created_at: string;
}

export interface KanbanBoardColumn {
  id: string;
  board_id: string;
  organization_id: string;
  title: string;
  description: string | null;
  color: string | null;
  /** open / in_progress / completed / cancelled, or null for a plain group. */
  status_category: KanbanTaskStatus | null;
  /** Soft limit of cards (the header turns red past it), or null. */
  wip_limit: number | null;
  position: number;
  /** Set while the column is archived: hidden with its tasks, can be restored. */
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * A task as a board shows it. Since phase 2 every card is a planning task
 * (same id); board_id and column_id are empty strings for a task in the inbox.
 */
export interface KanbanBoardCard {
  id: string;
  board_id: string;
  column_id: string;
  task_number: string;
  status: KanbanTaskStatus;
  priority: string;
  assigned_to: string | null;
  assignee_name: string | null;
  assignee_email: string | null;
  organization_id: string;
  title: string;
  description: string | null;
  description_rich: unknown | null;
  due_at: string | null;
  label: string | null;
  label_color: string | null;
  is_inbox: boolean;
  position: number;
  created_by: string;
  creator_name: string | null;
  creator_email: string | null;
  created_at: string;
  updated_at: string;
  /** Set while the task is archived (planning_tasks.deleted_at). */
  archived_at: string | null;
  /** Comments on the task (the board shows the count on the card). */
  comment_count: number;
  /** The board's labels on this task, in the board's order. */
  labels: KanbanBoardLabel[];
  /** Checklist items, and how many are done ("3/7" on the card). */
  checklist_total: number;
  checklist_done: number;
  /** Files attached to the task. */
  attachment_count: number;
  /** People following the task. */
  watcher_ids: string[];
  /** The due date has an hour (otherwise it is a plain day). */
  due_has_time: boolean;
  /** The first day of the task (a range from start to due), or null. */
  start_date: string | null;
  /** Cover: a colour, or an image attachment (with a short-lived link). */
  cover_color: string | null;
  cover_attachment_id: string | null;
  cover_url: string | null;
  /** A template card ("New card from template"); left out of WIP counts. */
  is_template: boolean;
  /** The task this one is a sub-task of. */
  parent_task_id: string | null;
  /** Its sub-tasks, and how many are done. */
  subtask_total: number;
  subtask_done: number;
  /** Open tasks this one waits for ("blocked"). */
  blocked_by_open: number;
  /** "Repeat every …": completing the task makes the next one. */
  recurrence: KanbanRecurrence | null;
  /** Custom field values, by field id (fields of the task's board). */
  custom_values: Record<string, KanbanCustomFieldValue>;
}

export const KANBAN_RECURRENCE_FREQS = ["daily", "weekly", "monthly", "yearly"] as const;
export type KanbanRecurrenceFreq = (typeof KANBAN_RECURRENCE_FREQS)[number];

/** How a task repeats (stored as JSON on the task). */
export interface KanbanRecurrence {
  freq: KanbanRecurrenceFreq;
  /** Every N days / weeks / months / years (1 when left out). */
  interval?: number;
  /** Weekly: ISO days, 1 = Monday … 7 = Sunday. */
  weekdays?: number[];
  /** Monthly: the day of the month (clamped to the month's last day). */
  monthday?: number;
  /** No copies after this day (YYYY-MM-DD). */
  until?: string;
}

export const KANBAN_CUSTOM_FIELD_TYPES = ["text", "number", "date", "select", "checkbox"] as const;
export type KanbanCustomFieldType = (typeof KANBAN_CUSTOM_FIELD_TYPES)[number];

export interface KanbanCustomFieldOption {
  id: string;
  name: string;
  color: string;
}

/** A board's own field: its cards fill it in. */
export interface KanbanCustomField {
  id: string;
  board_id: string;
  name: string;
  field_type: KanbanCustomFieldType;
  /** Choices of a select field. */
  options: KanbanCustomFieldOption[];
  /** Shown on the card on the board, not only in its window. */
  show_on_card: boolean;
  position: number;
}

/** text and date (YYYY-MM-DD) and select (an option id) are strings. */
export type KanbanCustomFieldValue = string | number | boolean;

/** A task named from another one: its parent, a sub-task, a dependency. */
export interface KanbanTaskRef {
  id: string;
  task_number: string;
  title: string;
  status: KanbanTaskStatus;
  board_id: string | null;
  assignee_name: string | null;
}

export interface KanbanTaskRelations {
  parent: KanbanTaskRef | null;
  subtasks: KanbanTaskRef[];
  /** Tasks this one waits for. */
  blocked_by: KanbanTaskRef[];
  /** Tasks waiting for this one. */
  blocking: KanbanTaskRef[];
}

/** A label of a board (name + colour); a task carries several. */
export interface KanbanBoardLabel {
  id: string;
  name: string;
  color: string;
  position: number;
}

export interface KanbanChecklistItem {
  id: string;
  checklist_id: string;
  task_id: string;
  title: string;
  is_done: boolean;
  assigned_to: string | null;
  assignee_name: string | null;
  due_at: string | null;
  position: number;
  /** The sub-task this item stands for (ticking it completes the task). */
  linked_task_id: string | null;
  /** That sub-task, when the viewer may read it. */
  linked_task: {
    id: string;
    task_number: string;
    title: string;
    status: KanbanTaskStatus;
    board_id: string | null;
  } | null;
}

export interface KanbanChecklist {
  id: string;
  task_id: string;
  title: string;
  position: number;
  items: KanbanChecklistItem[];
}

/** One line of a checklist template. */
export interface ChecklistTemplateItem {
  title: string;
  /** Assigned when the template is added (if still in the organization). */
  assigned_to: string | null;
  /** Due this many days after the template is added, or no date. */
  due_offset_days: number | null;
}

/** A reusable checklist: adding it to a task copies its items. */
export interface ChecklistTemplate {
  id: string;
  title: string;
  items: ChecklistTemplateItem[];
  created_by: string | null;
  creator_name: string | null;
  updated_at: string;
}

/** One line of a board's activity: what happened to which task. */
export interface KanbanBoardActivity extends KanbanCardActivity {
  task_number: string;
  task_title: string;
}

export interface KanbanCardActivity {
  id: string;
  organization_id: string;
  board_id: string;
  card_id: string;
  actor_id: string | null;
  actor_name: string | null;
  actor_email: string | null;
  activity_type: string;
  message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface KanbanBoardDetail extends KanbanBoardSummary {
  columns: KanbanBoardColumn[];
  /** The board's labels, in order. */
  labels: KanbanBoardLabel[];
  cards: KanbanBoardCard[];
  members: KanbanBoardMember[];
  /** The board's custom fields, in order. */
  custom_fields: KanbanCustomField[];
}

/** Where a task ended up after a move (the database may change its status). */
export interface KanbanMoveResult {
  card_id: string;
  board_id: string | null;
  column_id: string | null;
  is_inbox: boolean;
  status: KanbanTaskStatus;
  position: number;
}

/** What a board's archive holds: archived columns (with their tasks) and archived tasks. */
export interface KanbanBoardArchive {
  columns: Array<KanbanBoardColumn & { card_count: number }>;
  cards: KanbanBoardCard[];
}

export interface KanbanTaskEditorBoard {
  id: string;
  title: string;
  color: string | null;
  archived_at: string | null;
  my_access: KanbanBoardAccess;
}

/** Everything the task editor shows: the task, and its board and columns when it is on one. */
export interface KanbanTaskEditorData {
  card: KanbanBoardCard;
  board: KanbanTaskEditorBoard | null;
  columns: KanbanBoardColumn[];
  /** The labels a task on this board can carry (empty off a board). */
  labels: KanbanBoardLabel[];
  /** The board's custom fields (empty off a board). */
  custom_fields?: KanbanCustomField[];
}
