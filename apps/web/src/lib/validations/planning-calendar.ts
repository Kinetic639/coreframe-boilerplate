import { z } from "zod";

const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected yyyy-MM-dd date");

export const getPlanningCalendarDataSchema = z
  .object({
    rangeStart: dateOnlySchema,
    rangeEnd: dateOnlySchema,
    visibleSourceIds: z.array(z.string().min(1)).max(100).optional(),
    includeUnscheduled: z.boolean().optional().default(true),
    unscheduledLimit: z.number().int().min(0).max(200).optional().default(50),
    unscheduledSearch: z.string().trim().max(120).optional(),
  })
  .refine((input) => input.rangeStart <= input.rangeEnd, {
    message: "rangeStart must be before or equal to rangeEnd",
    path: ["rangeEnd"],
  });

export const updateCalendarItemDueDateSchema = z.object({
  sourceType: z.enum(["planning_task", "helpdesk_ticket", "kanban_card"]),
  sourceId: z.string().uuid(),
  boardId: z.string().uuid().optional(),
  dueDate: dateOnlySchema.nullable(),
});

export type GetPlanningCalendarDataInput = z.infer<typeof getPlanningCalendarDataSchema>;
export type UpdateCalendarItemDueDateInput = z.infer<typeof updateCalendarItemDueDateSchema>;
