import { z } from "zod";

const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected yyyy-MM-dd date");
const timezoneSchema = z.string().trim().min(1).max(80);
const calendarScheduleSchema = z.discriminatedUnion("allDay", [
  z.object({
    allDay: z.literal(true),
    startDate: dateOnlySchema,
    endDate: dateOnlySchema,
    timezone: timezoneSchema,
  }),
  z.object({
    allDay: z.literal(false),
    startAt: z.string().datetime(),
    endAt: z.string().datetime(),
    timezone: timezoneSchema,
  }),
]);

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
  sourceType: z.enum(["planning_task", "helpdesk_ticket", "kanban_card", "native_event"]),
  sourceId: z.string().uuid(),
  boardId: z.string().uuid().optional(),
  dueDate: dateOnlySchema.nullable(),
});

export const updateCalendarItemScheduleSchema = z.object({
  sourceType: z.enum(["planning_task", "kanban_card", "native_event"]),
  sourceId: z.string().uuid(),
  boardId: z.string().uuid().optional(),
  calendarId: z.string().uuid().optional(),
  schedule: calendarScheduleSchema.nullable(),
});

const calendarKeySchema = z
  .string()
  .min(1)
  .max(220)
  .regex(
    /^(source:(planning_tasks|helpdesk_tickets|kanban-board:[0-9a-fA-F-]{36})|native:[0-9a-fA-F-]{36})$/
  );

const colorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Expected hex color")
  .nullable();

export const updateCalendarSourceSettingsSchema = z.object({
  calendarKey: calendarKeySchema,
  color: colorSchema.optional(),
  visible: z.boolean().nullable().optional(),
  position: z.number().int().min(0).max(10000).nullable().optional(),
});

export const resetCalendarSourceColorSchema = z.object({
  calendarKey: calendarKeySchema,
});

export const createNativeCalendarSchema = z.object({
  name: z.string().trim().min(1).max(160),
  defaultColor: colorSchema.optional(),
  visibility: z.enum(["private", "organization"]).optional(),
});

export const deleteNativeCalendarSchema = z.object({
  calendarId: z.string().uuid(),
});

export const nativeCalendarEventSchema = z.object({
  id: z.string().uuid().optional(),
  calendarId: z.string().uuid(),
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().max(4000).nullable().optional(),
  schedule: calendarScheduleSchema,
});

export const deleteNativeCalendarEventSchema = z.object({
  id: z.string().uuid(),
  calendarId: z.string().uuid(),
});

export type CalendarScheduleInput =
  | { allDay: true; startDate: string; endDate: string; timezone: string }
  | { allDay: false; startAt: string; endAt: string; timezone: string };
export type GetPlanningCalendarDataInput = z.infer<typeof getPlanningCalendarDataSchema>;
export type UpdateCalendarItemDueDateInput = z.infer<typeof updateCalendarItemDueDateSchema>;
export type UpdateCalendarItemScheduleInput = {
  sourceType: "planning_task" | "kanban_card" | "native_event";
  sourceId: string;
  boardId?: string;
  calendarId?: string;
  schedule: CalendarScheduleInput | null;
};
export type UpdateCalendarSourceSettingsInput = z.infer<typeof updateCalendarSourceSettingsSchema>;
export type CreateNativeCalendarInput = z.infer<typeof createNativeCalendarSchema>;
export type NativeCalendarEventInput = {
  id?: string;
  calendarId: string;
  title: string;
  description?: string | null;
  schedule: CalendarScheduleInput;
};
export type DeleteNativeCalendarEventInput = z.infer<typeof deleteNativeCalendarEventSchema>;
