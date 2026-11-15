import { z } from "zod";

/**
 * Who sees a board, besides its owner and the people added to it:
 * nobody else (private), one branch, or the whole organization.
 */
export const KANBAN_VISIBILITIES = ["private", "branch", "organization"] as const;
export type KanbanVisibility = (typeof KANBAN_VISIBILITIES)[number];

export const KANBAN_MEMBER_ROLES = ["editor", "viewer"] as const;
export type KanbanMemberRole = (typeof KANBAN_MEMBER_ROLES)[number];

const kanbanBoardFields = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).nullable().optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable()
    .optional(),
  visibility: z.enum(KANBAN_VISIBILITIES).default("private"),
  /** Required for, and only kept with, the branch scope. */
  branch_id: z.string().uuid().nullable().optional(),
});

const branchScopeHasBranch = (value: { visibility: KanbanVisibility; branch_id?: string | null }) =>
  value.visibility !== "branch" || Boolean(value.branch_id);
const branchScopeMessage = { message: "Choose a branch", path: ["branch_id"] };

export const createKanbanBoardSchema = kanbanBoardFields
  .extend({
    /** People added to the board right away (same as adding them in its settings). */
    members: z
      .array(
        z.object({
          user_id: z.string().uuid(),
          role: z.enum(KANBAN_MEMBER_ROLES),
        })
      )
      .max(100)
      .optional(),
  })
  .refine(branchScopeHasBranch, branchScopeMessage);

export const deleteKanbanBoardSchema = z.object({
  id: z.string().uuid(),
});

export const updateKanbanBoardSchema = kanbanBoardFields
  .extend({ id: z.string().uuid() })
  .refine(branchScopeHasBranch, branchScopeMessage);

export const addKanbanBoardMemberSchema = z.object({
  board_id: z.string().uuid(),
  user_id: z.string().uuid(),
  role: z.enum(KANBAN_MEMBER_ROLES).default("editor"),
});

export const updateKanbanBoardMemberSchema = z.object({
  board_id: z.string().uuid(),
  user_id: z.string().uuid(),
  role: z.enum(KANBAN_MEMBER_ROLES),
});

export const removeKanbanBoardMemberSchema = z.object({
  board_id: z.string().uuid(),
  user_id: z.string().uuid(),
});

export const KANBAN_TASK_STATUSES = ["open", "in_progress", "completed", "cancelled"] as const;

export const createKanbanColumnSchema = z.object({
  board_id: z.string().uuid(),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).nullable().optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable()
    .optional(),
  /** A task moved into the column takes this status; null = the column is just a group. */
  status_category: z.enum(KANBAN_TASK_STATUSES).nullable().optional(),
});

export const updateKanbanColumnSchema = createKanbanColumnSchema.extend({
  id: z.string().uuid(),
});

export const deleteKanbanColumnSchema = z.object({
  board_id: z.string().uuid(),
  id: z.string().uuid(),
});

export const createKanbanCardSchema = z.object({
  board_id: z.string().uuid(),
  column_id: z.string().uuid(),
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().max(4000).nullable().optional(),
  description_rich: z.unknown().nullable().optional(),
  due_at: z.string().datetime().nullable().optional(),
  label: z.string().trim().max(80).nullable().optional(),
  label_color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable()
    .optional(),
});

export const updateKanbanCardSchema = createKanbanCardSchema.extend({
  id: z.string().uuid(),
  /** A card is a task: its status and assignee can be changed from the board. */
  status: z.enum(KANBAN_TASK_STATUSES).optional(),
  assigned_to: z.string().uuid().nullable().optional(),
});

export const moveKanbanCardSchema = z.object({
  card_id: z.string().uuid(),
  board_id: z.string().uuid(),
  to_column_id: z.string().uuid(),
  to_position: z.number().int().min(0),
});

export const moveKanbanCardToInboxSchema = z.object({
  card_id: z.string().uuid(),
  board_id: z.string().uuid(),
});

export const moveKanbanInboxCardToBoardSchema = z.object({
  card_id: z.string().uuid(),
  board_id: z.string().uuid(),
  column_id: z.string().uuid(),
  position: z.number().int().min(0),
});

export const reorderKanbanColumnsSchema = z.object({
  board_id: z.string().uuid(),
  column_ids: z.array(z.string().uuid()).min(1),
});

export type CreateKanbanBoardInput = z.infer<typeof createKanbanBoardSchema>;
export type UpdateKanbanBoardInput = z.infer<typeof updateKanbanBoardSchema>;
export type DeleteKanbanBoardInput = z.infer<typeof deleteKanbanBoardSchema>;
export type CreateKanbanColumnInput = z.infer<typeof createKanbanColumnSchema>;
export type UpdateKanbanColumnInput = z.infer<typeof updateKanbanColumnSchema>;
export type DeleteKanbanColumnInput = z.infer<typeof deleteKanbanColumnSchema>;
export type CreateKanbanCardInput = z.infer<typeof createKanbanCardSchema>;
export type UpdateKanbanCardInput = z.infer<typeof updateKanbanCardSchema>;
export type MoveKanbanCardInput = z.infer<typeof moveKanbanCardSchema>;
export type MoveKanbanCardToInboxInput = z.infer<typeof moveKanbanCardToInboxSchema>;
export type MoveKanbanInboxCardToBoardInput = z.infer<typeof moveKanbanInboxCardToBoardSchema>;
export type ReorderKanbanColumnsInput = z.infer<typeof reorderKanbanColumnsSchema>;
export type AddKanbanBoardMemberInput = z.infer<typeof addKanbanBoardMemberSchema>;
export type UpdateKanbanBoardMemberInput = z.infer<typeof updateKanbanBoardMemberSchema>;
export type RemoveKanbanBoardMemberInput = z.infer<typeof removeKanbanBoardMemberSchema>;
