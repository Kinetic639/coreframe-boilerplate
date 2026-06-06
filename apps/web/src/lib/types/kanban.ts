import type { KanbanVisibility } from "@/lib/validations/kanban";

export const MAX_KANBAN_BOARDS_PER_USER = 5;

export interface KanbanBoardSummary {
  id: string;
  organization_id: string;
  title: string;
  description: string | null;
  visibility: KanbanVisibility;
  created_by: string;
  creator_name: string | null;
  creator_email: string | null;
  created_at: string;
  updated_at: string;
}

export interface KanbanBoardColumn {
  id: string;
  board_id: string;
  organization_id: string;
  title: string;
  description: string | null;
  color: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface KanbanBoardCard {
  id: string;
  board_id: string;
  column_id: string;
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
}
