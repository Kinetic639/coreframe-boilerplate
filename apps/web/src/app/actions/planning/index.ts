"use server";

import { createClient } from "@/utils/supabase/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import {
  PLANNING_READ,
  PLANNING_TASKS_READ,
  PLANNING_TASKS_CREATE,
  PLANNING_TASKS_UPDATE,
  PLANNING_TASKS_DELETE,
  PLANNING_TASKS_ASSIGN,
} from "@/lib/constants/permissions";
import {
  PlanningTasksService,
  type PlanningTaskListRow,
  type PlanningTaskDetail,
} from "@/server/services/planning-tasks.service";
import {
  createTaskSchema,
  updateTaskSchema,
  assignTaskSchema,
  type CreateTaskInput,
  type UpdateTaskInput,
  type AssignTaskInput,
  type TaskStatus,
  type TaskListFilters,
} from "@/lib/validations/planning";
import type { DataViewListParams, PaginatedResult } from "@/lib/data-view/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------

async function getAuthedContext() {
  const supabase = await createClient();
  const context = await loadDashboardContextV2();
  if (!context?.app.activeOrgId) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { supabase, context, userId: user.id, orgId: context.app.activeOrgId };
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export async function listTasksForDataViewAction(
  params: DataViewListParams,
  filters: TaskListFilters = {}
): Promise<ActionResult<PaginatedResult<PlanningTaskListRow>>> {
  try {
    const ctx = await getAuthedContext();
    if (!ctx) return { success: false, error: "Unauthorized" };
    if (!checkPermission(ctx.context.user.permissionSnapshot, PLANNING_TASKS_READ))
      return { success: false, error: "Insufficient permissions" };
    return PlanningTasksService.listForDataView(ctx.supabase, ctx.orgId, params, filters);
  } catch {
    return { success: false, error: "Unexpected error" };
  }
}

// ---------------------------------------------------------------------------
// Detail
// ---------------------------------------------------------------------------

export async function getTaskDetailAction(
  taskId: string
): Promise<ActionResult<PlanningTaskDetail>> {
  try {
    const ctx = await getAuthedContext();
    if (!ctx) return { success: false, error: "Unauthorized" };
    if (!checkPermission(ctx.context.user.permissionSnapshot, PLANNING_TASKS_READ))
      return { success: false, error: "Insufficient permissions" };
    return PlanningTasksService.getDetail(ctx.supabase, ctx.orgId, taskId);
  } catch {
    return { success: false, error: "Unexpected error" };
  }
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export async function createTaskAction(
  input: CreateTaskInput
): Promise<ActionResult<PlanningTaskDetail>> {
  try {
    const ctx = await getAuthedContext();
    if (!ctx) return { success: false, error: "Unauthorized" };
    if (!checkPermission(ctx.context.user.permissionSnapshot, PLANNING_TASKS_CREATE))
      return { success: false, error: "Insufficient permissions" };
    const parsed = createTaskSchema.safeParse(input);
    if (!parsed.success)
      return { success: false, error: parsed.error.errors[0]?.message ?? parsed.error.message };
    return PlanningTasksService.create(ctx.supabase, ctx.orgId, ctx.userId, parsed.data);
  } catch {
    return { success: false, error: "Unexpected error" };
  }
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

export async function updateTaskAction(
  input: UpdateTaskInput
): Promise<ActionResult<PlanningTaskDetail>> {
  try {
    const ctx = await getAuthedContext();
    if (!ctx) return { success: false, error: "Unauthorized" };
    if (!checkPermission(ctx.context.user.permissionSnapshot, PLANNING_TASKS_UPDATE))
      return { success: false, error: "Insufficient permissions" };
    const parsed = updateTaskSchema.safeParse(input);
    if (!parsed.success)
      return { success: false, error: parsed.error.errors[0]?.message ?? parsed.error.message };

    // Fetch current task to diff for activity
    const current = await PlanningTasksService.getDetail(ctx.supabase, ctx.orgId, parsed.data.id);
    if (!current.success)
      return { success: false, error: (current as { success: false; error: string }).error };

    return PlanningTasksService.update(ctx.supabase, ctx.orgId, ctx.userId, parsed.data, {
      title: current.data.title,
      priority: current.data.priority,
      due_at: current.data.due_at,
      description_plain: current.data.description_plain,
    });
  } catch {
    return { success: false, error: "Unexpected error" };
  }
}

// ---------------------------------------------------------------------------
// Status transitions
// ---------------------------------------------------------------------------

async function _changeStatus(
  taskId: string,
  newStatus: TaskStatus
): Promise<ActionResult<PlanningTaskDetail>> {
  const ctx = await getAuthedContext();
  if (!ctx) return { success: false, error: "Unauthorized" };
  if (!checkPermission(ctx.context.user.permissionSnapshot, PLANNING_TASKS_UPDATE))
    return { success: false, error: "Insufficient permissions" };

  const current = await PlanningTasksService.getDetail(ctx.supabase, ctx.orgId, taskId);
  if (!current.success)
    return { success: false, error: (current as { success: false; error: string }).error };

  return PlanningTasksService.changeStatus(
    ctx.supabase,
    ctx.orgId,
    ctx.userId,
    taskId,
    newStatus,
    current.data.status
  );
}

export async function changeTaskStatusAction(
  taskId: string,
  status: TaskStatus
): Promise<ActionResult<PlanningTaskDetail>> {
  try {
    return _changeStatus(taskId, status);
  } catch {
    return { success: false, error: "Unexpected error" };
  }
}

export async function startTaskAction(taskId: string): Promise<ActionResult<PlanningTaskDetail>> {
  try {
    return _changeStatus(taskId, "in_progress");
  } catch {
    return { success: false, error: "Unexpected error" };
  }
}

export async function completeTaskAction(
  taskId: string
): Promise<ActionResult<PlanningTaskDetail>> {
  try {
    return _changeStatus(taskId, "completed");
  } catch {
    return { success: false, error: "Unexpected error" };
  }
}

export async function reopenTaskAction(taskId: string): Promise<ActionResult<PlanningTaskDetail>> {
  try {
    return _changeStatus(taskId, "open");
  } catch {
    return { success: false, error: "Unexpected error" };
  }
}

export async function cancelTaskAction(taskId: string): Promise<ActionResult<PlanningTaskDetail>> {
  try {
    return _changeStatus(taskId, "cancelled");
  } catch {
    return { success: false, error: "Unexpected error" };
  }
}

// ---------------------------------------------------------------------------
// Assign
// ---------------------------------------------------------------------------

export async function assignTaskAction(
  input: AssignTaskInput
): Promise<ActionResult<PlanningTaskDetail>> {
  try {
    const ctx = await getAuthedContext();
    if (!ctx) return { success: false, error: "Unauthorized" };
    if (!checkPermission(ctx.context.user.permissionSnapshot, PLANNING_TASKS_ASSIGN))
      return { success: false, error: "Insufficient permissions" };
    const parsed = assignTaskSchema.safeParse(input);
    if (!parsed.success)
      return { success: false, error: parsed.error.errors[0]?.message ?? parsed.error.message };

    const current = await PlanningTasksService.getDetail(ctx.supabase, ctx.orgId, parsed.data.id);
    if (!current.success)
      return { success: false, error: (current as { success: false; error: string }).error };

    return PlanningTasksService.assign(
      ctx.supabase,
      ctx.orgId,
      ctx.userId,
      parsed.data,
      current.data.assigned_to
    );
  } catch {
    return { success: false, error: "Unexpected error" };
  }
}

// ---------------------------------------------------------------------------
// Delete (soft)
// ---------------------------------------------------------------------------

export async function deleteTaskAction(taskId: string): Promise<ActionResult<void>> {
  try {
    const ctx = await getAuthedContext();
    if (!ctx) return { success: false, error: "Unauthorized" };
    if (!checkPermission(ctx.context.user.permissionSnapshot, PLANNING_TASKS_DELETE))
      return { success: false, error: "Insufficient permissions" };
    return PlanningTasksService.softDelete(ctx.supabase, ctx.orgId, ctx.userId, taskId);
  } catch {
    return { success: false, error: "Unexpected error" };
  }
}

// Re-export for pages
export {
  PLANNING_READ,
  PLANNING_TASKS_READ,
  PLANNING_TASKS_CREATE,
  PLANNING_TASKS_UPDATE,
  PLANNING_TASKS_DELETE,
  PLANNING_TASKS_ASSIGN,
};
