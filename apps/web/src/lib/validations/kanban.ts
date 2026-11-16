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

export const kanbanColumnRefSchema = z.object({
  board_id: z.string().uuid(),
  id: z.string().uuid(),
});

export const createKanbanCardSchema = z.object({
  board_id: z.string().uuid(),
  column_id: z.string().uuid(),
  /** Where in the column; left out for the bottom. */
  position: z.number().int().min(0).optional(),
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

export const updateKanbanCardSchema = createKanbanCardSchema
  .omit({ board_id: true, column_id: true, position: true })
  .extend({
    id: z.string().uuid(),
    /** Empty for a task in the inbox. */
    board_id: z.string().uuid().nullable(),
    /** A new column on the same board; left out to keep the task where it is. */
    column_id: z.string().uuid().nullable().optional(),
    /** A card is a task: its status and assignee can be changed from the board. */
    status: z.enum(KANBAN_TASK_STATUSES).optional(),
    assigned_to: z.string().uuid().nullable().optional(),
  });

/**
 * Moves a task to a board column (board_id + column_id) or to its author's
 * inbox (both null), at a position in the destination list.
 */
export const moveKanbanTaskSchema = z
  .object({
    card_id: z.string().uuid(),
    board_id: z.string().uuid().nullable(),
    column_id: z.string().uuid().nullable(),
    position: z.number().int().min(0),
  })
  .refine((value) => (value.board_id === null) === (value.column_id === null), {
    message: "A column needs its board",
    path: ["column_id"],
  });

export const KANBAN_TASK_PRIORITIES = ["low", "normal", "high", "urgent"] as const;

/**
 * Saves some fields of a task (the editor saves each field on its own).
 * Only the fields present are changed.
 */
export const patchKanbanTaskSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(300).optional(),
  description: z.string().trim().max(4000).nullable().optional(),
  description_rich: z.unknown().nullable().optional(),
  priority: z.enum(KANBAN_TASK_PRIORITIES).optional(),
  due_at: z.string().datetime().nullable().optional(),
  label: z.string().trim().max(80).nullable().optional(),
  label_color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable()
    .optional(),
  status: z.enum(KANBAN_TASK_STATUSES).optional(),
  assigned_to: z.string().uuid().nullable().optional(),
});

export const kanbanBoardStarSchema = z.object({
  board_id: z.string().uuid(),
  starred: z.boolean(),
});

/** A task by id, or by its number (TSK-0042) as the address shows it. */
export const kanbanTaskLookupSchema = z.object({
  ref: z.string().trim().min(1).max(64),
});

export const kanbanBoardRefSchema = z.object({
  id: z.string().uuid(),
});

export const kanbanCardRefSchema = z.object({
  card_id: z.string().uuid(),
});

export const reorderKanbanColumnsSchema = z.object({
  board_id: z.string().uuid(),
  column_ids: z.array(z.string().uuid()).min(1),
});

export type CreateKanbanBoardInput = z.infer<typeof createKanbanBoardSchema>;
export type UpdateKanbanBoardInput = z.infer<typeof updateKanbanBoardSchema>;
export type KanbanBoardRefInput = z.infer<typeof kanbanBoardRefSchema>;
export type KanbanCardRefInput = z.infer<typeof kanbanCardRefSchema>;
export type PatchKanbanTaskInput = z.infer<typeof patchKanbanTaskSchema>;
export type KanbanBoardStarInput = z.infer<typeof kanbanBoardStarSchema>;
export type KanbanTaskPriority = (typeof KANBAN_TASK_PRIORITIES)[number];
export type CreateKanbanColumnInput = z.infer<typeof createKanbanColumnSchema>;
export type UpdateKanbanColumnInput = z.infer<typeof updateKanbanColumnSchema>;
export type KanbanColumnRefInput = z.infer<typeof kanbanColumnRefSchema>;
export type CreateKanbanCardInput = z.infer<typeof createKanbanCardSchema>;
export type UpdateKanbanCardInput = z.infer<typeof updateKanbanCardSchema>;
export type MoveKanbanTaskInput = z.infer<typeof moveKanbanTaskSchema>;
export type ReorderKanbanColumnsInput = z.infer<typeof reorderKanbanColumnsSchema>;
export type AddKanbanBoardMemberInput = z.infer<typeof addKanbanBoardMemberSchema>;
export type UpdateKanbanBoardMemberInput = z.infer<typeof updateKanbanBoardMemberSchema>;
export type RemoveKanbanBoardMemberInput = z.infer<typeof removeKanbanBoardMemberSchema>;
