import { z } from "zod";

export const updateCalendarItemDueDateSchema = z.object({
  sourceType: z.enum(["planning_task", "helpdesk_ticket", "kanban_card"]),
  sourceId: z.string().uuid(),
  boardId: z.string().uuid().optional(),
  dueAt: z.string().datetime().nullable(),
});

export type UpdateCalendarItemDueDateInput = z.infer<typeof updateCalendarItemDueDateSchema>;
