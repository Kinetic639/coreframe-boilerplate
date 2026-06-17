import { z } from "zod";

export const KANBAN_VISIBILITIES = ["private", "public"] as const;
export type KanbanVisibility = (typeof KANBAN_VISIBILITIES)[number];

export const createKanbanBoardSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).nullable().optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable()
    .optional(),
  visibility: z.enum(KANBAN_VISIBILITIES).default("private"),
});

export const deleteKanbanBoardSchema = z.object({
  id: z.string().uuid(),
});

export const updateKanbanBoardSchema = createKanbanBoardSchema.extend({
  id: z.string().uuid(),
});

export const createKanbanColumnSchema = z.object({
  board_id: z.string().uuid(),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).nullable().optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable()
    .optional(),
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
