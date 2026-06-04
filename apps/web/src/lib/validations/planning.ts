import { z } from "zod";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const TASK_STATUSES = ["open", "in_progress", "completed", "cancelled"] as const;
export const TASK_PRIORITIES = ["low", "normal", "high", "urgent"] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

// ---------------------------------------------------------------------------
// Task schemas
// ---------------------------------------------------------------------------

export const createTaskSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(500),
  description_plain: z.string().max(10000).optional(),
  description_rich: z.string().optional(), // JSON-stringified on client to bypass React serialization
  priority: z.enum(TASK_PRIORITIES).default("normal"),
  branch_id: z.string().uuid().nullable().optional(),
  assigned_to: z.string().uuid().nullable().optional(),
  due_at: z.string().datetime().nullable().optional(),
});

export const updateTaskSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1, "Title is required").max(500),
  description_plain: z.string().max(10000).optional(),
  description_rich: z.string().optional(), // JSON-stringified on client
  priority: z.enum(TASK_PRIORITIES),
  branch_id: z.string().uuid().nullable().optional(),
  due_at: z.string().datetime().nullable().optional(),
});

export const changeTaskStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(TASK_STATUSES),
});

export const assignTaskSchema = z.object({
  id: z.string().uuid(),
  assigned_to: z.string().uuid().nullable(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type ChangeTaskStatusInput = z.infer<typeof changeTaskStatusSchema>;
export type AssignTaskInput = z.infer<typeof assignTaskSchema>;

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

const planningBadgeConfigSchema = z.object({
  label: z.string().trim().min(1).max(50),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color must be a hex value"),
});

export const savePlanningSettingsSchema = z.object({
  status_configs: z.record(z.enum(TASK_STATUSES), planningBadgeConfigSchema).optional(),
  priority_configs: z.record(z.enum(TASK_PRIORITIES), planningBadgeConfigSchema).optional(),
});

export type SavePlanningSettingsInput = z.infer<typeof savePlanningSettingsSchema>;

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

export interface TaskListFilters {
  search?: string;
  status?: TaskStatus[];
  priority?: TaskPriority[];
  branch_id?: string | null;
  assigned_to?: string | null;
}
