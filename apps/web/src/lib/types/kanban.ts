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
  cards: KanbanBoardCard[];
  members: KanbanBoardMember[];
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
