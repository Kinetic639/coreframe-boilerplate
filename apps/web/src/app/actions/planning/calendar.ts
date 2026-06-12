"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { PLANNING_READ, PLANNING_TASKS_UPDATE } from "@/lib/constants/permissions";
import { PlanningCalendarService } from "@/server/services/planning-calendar.service";
import { PlanningTasksService } from "@/server/services/planning-tasks.service";
import { HelpdeskTicketsService } from "@/server/services/helpdesk-tickets.service";
import { KanbanBoardsService } from "@/server/services/kanban-boards.service";
import {
  updateCalendarItemDueDateSchema,
  type UpdateCalendarItemDueDateInput,
} from "@/lib/validations/planning-calendar";
import type { PlanningCalendarData } from "@/lib/types/planning-calendar";

type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

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

function firstZodError(error: unknown) {
  const issues = (error as { issues?: Array<{ message?: string }> })?.issues;
  return issues?.[0]?.message ?? "Invalid input";
}

export async function getPlanningCalendarDataAction(): Promise<ActionResult<PlanningCalendarData>> {
  try {
    const ctx = await getAuthedContext();
    if (!ctx) return { success: false, error: "Unauthorized" };
    if (!checkPermission(ctx.context.user.permissionSnapshot, PLANNING_READ))
      return { success: false, error: "Insufficient permissions" };

    return PlanningCalendarService.getCalendarData(
      ctx.supabase,
      ctx.orgId,
      ctx.context.user.permissionSnapshot
    );
  } catch {
    return { success: false, error: "Unexpected error" };
  }
}

export async function updateCalendarItemDueDateAction(
  input: UpdateCalendarItemDueDateInput
): Promise<ActionResult<void>> {
  try {
    const ctx = await getAuthedContext();
    if (!ctx) return { success: false, error: "Unauthorized" };

    const parsed = updateCalendarItemDueDateSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: firstZodError(parsed.error) };

    const { sourceType, sourceId, boardId, dueAt } = parsed.data;

    switch (sourceType) {
      case "planning_task": {
        if (!checkPermission(ctx.context.user.permissionSnapshot, PLANNING_TASKS_UPDATE))
          return { success: false, error: "Insufficient permissions" };
        return PlanningTasksService.updateDueAt(
          ctx.supabase,
          ctx.orgId,
          ctx.userId,
          sourceId,
          dueAt
        );
      }
      case "helpdesk_ticket": {
        return HelpdeskTicketsService.updateDueAt(ctx.supabase, ctx.orgId, sourceId, dueAt);
      }
      case "kanban_card": {
        if (!boardId) return { success: false, error: "boardId is required for kanban cards" };
        const result = await KanbanBoardsService.updateCardDueAt(
          ctx.supabase,
          ctx.orgId,
          ctx.userId,
          sourceId,
          boardId,
          dueAt
        );
        if (result.success) {
          revalidatePath("/dashboard/planning/boards");
          revalidatePath("/dashboard/planowanie/tablice");
        }
        return result;
      }
    }
  } catch {
    return { success: false, error: "Unexpected error" };
  }
}
