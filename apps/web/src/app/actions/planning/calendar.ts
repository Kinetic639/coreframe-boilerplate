"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { PLANNING_READ } from "@/lib/constants/permissions";
import { MODULE_HELPDESK } from "@/lib/constants/modules";
import { PlanningCalendarService } from "@/server/services/planning-calendar.service";
import { PlanningTasksService } from "@/server/services/planning-tasks.service";
import { HelpdeskTicketsService } from "@/server/services/helpdesk-tickets.service";
import { KanbanBoardsService } from "@/server/services/kanban-boards.service";
import { EntitlementsService } from "@/server/services/entitlements-service";
import { UserPreferencesService } from "@/server/services/user-preferences.service";
import { dateOnlyToZonedIso } from "@/lib/planning/calendar-dates";
import { PLANNING_CALENDAR_SOURCE_REGISTRY } from "@/server/planning/calendar-source-registry";
import { serverLogger } from "@/server/observability/logger";
import { withServerSpan } from "@/server/observability/tracing";
import {
  getPlanningCalendarDataSchema,
  updateCalendarItemDueDateSchema,
  type GetPlanningCalendarDataInput,
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

export async function getPlanningCalendarDataAction(
  input: GetPlanningCalendarDataInput
): Promise<ActionResult<PlanningCalendarData>> {
  const startedAt = Date.now();
  try {
    return await withServerSpan("planning.calendar.load", {}, async (span) => {
      const ctx = await getAuthedContext();
      if (!ctx) return { success: false, error: "Unauthorized" };
      if (!checkPermission(ctx.context.user.permissionSnapshot, PLANNING_READ))
        return { success: false, error: "Insufficient permissions" };

      const parsed = getPlanningCalendarDataSchema.safeParse(input);
      if (!parsed.success) return { success: false, error: firstZodError(parsed.error) };
      const preferences = await UserPreferencesService.getOrCreatePreferences(
        ctx.supabase,
        ctx.userId
      );
      const timeZone = preferences.timezone || "UTC";
      const boundedInput = {
        rangeStart: parsed.data.rangeStart,
        rangeEnd: parsed.data.rangeEnd,
        visibleSourceIds: parsed.data.visibleSourceIds,
        includeUnscheduled: parsed.data.includeUnscheduled ?? true,
        unscheduledLimit: parsed.data.unscheduledLimit ?? 50,
        unscheduledSearch: parsed.data.unscheduledSearch,
        rangeStartIso: dateOnlyToZonedIso(parsed.data.rangeStart, timeZone, { hour: 0 }),
        rangeEndIso: dateOnlyToZonedIso(parsed.data.rangeEnd, timeZone, {
          hour: 23,
          minute: 59,
          second: 59,
          millisecond: 999,
        }),
      };

      const result = await PlanningCalendarService.getCalendarData(
        ctx.supabase,
        ctx.orgId,
        ctx.userId,
        ctx.context.user.permissionSnapshot,
        boundedInput,
        timeZone
      );
      serverLogger.timing("planning_calendar.load.slow", startedAt, {
        orgId: ctx.orgId,
        userId: ctx.userId,
        traceId: span.traceId,
        rangeStart: parsed.data.rangeStart,
        rangeEnd: parsed.data.rangeEnd,
        visibleSourceCount: parsed.data.visibleSourceIds?.length,
        unscheduledLimit: boundedInput.unscheduledLimit,
        hasUnscheduledSearch: Boolean(boundedInput.unscheduledSearch),
        success: result.success,
        eventCount: result.success ? result.data.events.length : undefined,
        unscheduledCount: result.success ? result.data.unscheduled.length : undefined,
      });
      return result;
    });
  } catch (error) {
    serverLogger.error("planning_calendar.load.failed", error);
    return { success: false, error: "Unexpected error" };
  }
}

export async function updateCalendarItemDueDateAction(
  input: UpdateCalendarItemDueDateInput
): Promise<ActionResult<void>> {
  const startedAt = Date.now();
  try {
    return await withServerSpan("planning.calendar.update_due_date", {}, async (span) => {
      const ctx = await getAuthedContext();
      if (!ctx) return { success: false, error: "Unauthorized" };

      const parsed = updateCalendarItemDueDateSchema.safeParse(input);
      if (!parsed.success) return { success: false, error: firstZodError(parsed.error) };

      const { sourceType, sourceId, boardId, dueDate } = parsed.data;
      const preferences = await UserPreferencesService.getOrCreatePreferences(
        ctx.supabase,
        ctx.userId
      );
      const timeZone = preferences.timezone || "UTC";
      const dueAt = dueDate ? dateOnlyToZonedIso(dueDate, timeZone) : null;

      switch (sourceType) {
        case "planning_task": {
          if (
            !checkPermission(
              ctx.context.user.permissionSnapshot,
              PLANNING_CALENDAR_SOURCE_REGISTRY.planning_task.updatePermission
            )
          )
            return { success: false, error: "Insufficient permissions" };
          const result = await PlanningTasksService.updateDueAt(
            ctx.supabase,
            ctx.orgId,
            ctx.userId,
            sourceId,
            dueAt,
            dueDate
          );
          serverLogger.timing("planning_calendar.update_due_date.slow", startedAt, {
            orgId: ctx.orgId,
            userId: ctx.userId,
            traceId: span.traceId,
            sourceType,
            dueDate,
            success: result.success,
          });
          return result;
        }
        case "helpdesk_ticket": {
          if (
            !checkPermission(
              ctx.context.user.permissionSnapshot,
              PLANNING_CALENDAR_SOURCE_REGISTRY.helpdesk_ticket.updatePermission
            )
          )
            return { success: false, error: "Insufficient permissions" };
          const hasHelpdeskModule = await EntitlementsService.hasModuleAccess(
            ctx.orgId,
            MODULE_HELPDESK
          );
          if (!hasHelpdeskModule) return { success: false, error: "Insufficient permissions" };
          const result = await HelpdeskTicketsService.updateDueAt(
            ctx.supabase,
            ctx.orgId,
            sourceId,
            dueAt,
            dueDate
          );
          serverLogger.timing("planning_calendar.update_due_date.slow", startedAt, {
            orgId: ctx.orgId,
            userId: ctx.userId,
            traceId: span.traceId,
            sourceType,
            dueDate,
            success: result.success,
          });
          return result;
        }
        case "kanban_card": {
          if (
            !checkPermission(
              ctx.context.user.permissionSnapshot,
              PLANNING_CALENDAR_SOURCE_REGISTRY.kanban_card.updatePermission
            )
          )
            return { success: false, error: "Insufficient permissions" };
          if (!boardId) return { success: false, error: "boardId is required for kanban cards" };
          const result = await KanbanBoardsService.updateCardDueAt(
            ctx.supabase,
            ctx.orgId,
            ctx.userId,
            sourceId,
            boardId,
            dueAt,
            dueDate
          );
          if (result.success) {
            revalidatePath("/dashboard/planning/boards");
            revalidatePath("/dashboard/planowanie/tablice");
          }
          serverLogger.timing("planning_calendar.update_due_date.slow", startedAt, {
            orgId: ctx.orgId,
            userId: ctx.userId,
            traceId: span.traceId,
            sourceType,
            dueDate,
            success: result.success,
          });
          return result;
        }
      }
    });
  } catch (error) {
    serverLogger.error("planning_calendar.update_due_date.failed", error);
    return { success: false, error: "Unexpected error" };
  }
}
