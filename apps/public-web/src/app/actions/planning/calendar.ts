"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { MODULE_HELPDESK } from "@/lib/constants/modules";
import { PlanningCalendarService } from "@/server/services/planning-calendar.service";
import { PlanningTasksService } from "@/server/services/planning-tasks.service";
import { HelpdeskTicketsService } from "@/server/services/helpdesk-tickets.service";
import { KanbanBoardsService } from "@/server/services/kanban-boards.service";
import { EntitlementsService } from "@/server/services/entitlements-service";
import { UserPreferencesService } from "@/server/services/user-preferences.service";
import { AppCalendarService } from "@/server/services/app-calendar.service";
import { dateOnlyToZonedIso } from "@/lib/planning/calendar-dates";
import {
  PLANNING_CALENDAR_SOURCE_REGISTRY,
  sourceIdToKanbanBoardId,
  sourceIdToNativeCalendarId,
} from "@/server/planning/calendar-source-registry";
import { serverLogger } from "@/server/observability/logger";
import { withServerSpan } from "@/server/observability/tracing";
import {
  createNativeCalendarSchema,
  deleteNativeCalendarEventSchema,
  deleteNativeCalendarSchema,
  getPlanningCalendarDataSchema,
  nativeCalendarEventSchema,
  resetCalendarSourceColorSchema,
  updateCalendarSourceSettingsSchema,
  updateCalendarItemDueDateSchema,
  updateCalendarItemScheduleSchema,
  type CreateNativeCalendarInput,
  type DeleteNativeCalendarEventInput,
  type GetPlanningCalendarDataInput,
  type NativeCalendarEventInput,
  type UpdateCalendarItemDueDateInput,
  type UpdateCalendarItemScheduleInput,
  type UpdateCalendarSourceSettingsInput,
} from "@/lib/validations/planning-calendar";
import type { PlanningCalendarData } from "@/lib/types/planning-calendar";
import {
  HELPDESK_TICKETS_SOURCE_ID,
  NATIVE_CALENDAR_KEY_PREFIX,
  PLANNING_TASKS_SOURCE_ID,
} from "@/lib/constants/planning-calendar";
import {
  HELPDESK_TICKETS_READ,
  PLANNING_BOARDS_READ,
  PLANNING_READ,
  PLANNING_TASKS_READ,
} from "@/lib/constants/permissions";

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

async function canAccessCalendarKey(
  ctx: NonNullable<Awaited<ReturnType<typeof getAuthedContext>>>,
  calendarKey: string
) {
  if (calendarKey === PLANNING_TASKS_SOURCE_ID) {
    return checkPermission(ctx.context.user.permissionSnapshot, PLANNING_TASKS_READ);
  }

  if (calendarKey === HELPDESK_TICKETS_SOURCE_ID) {
    return (
      checkPermission(ctx.context.user.permissionSnapshot, HELPDESK_TICKETS_READ) &&
      (await EntitlementsService.hasModuleAccess(ctx.orgId, MODULE_HELPDESK))
    );
  }

  const boardId = sourceIdToKanbanBoardId(calendarKey);
  if (boardId) {
    if (!checkPermission(ctx.context.user.permissionSnapshot, PLANNING_BOARDS_READ)) return false;
    const boardResult = await KanbanBoardsService.getBoard(
      ctx.supabase,
      ctx.orgId,
      boardId,
      ctx.userId
    );
    return boardResult.success;
  }

  const calendarId = sourceIdToNativeCalendarId(calendarKey);
  if (calendarId) {
    if (!checkPermission(ctx.context.user.permissionSnapshot, PLANNING_READ)) return false;
    const calendarsResult = await AppCalendarService.listNativeCalendars(ctx.supabase, ctx.orgId);
    return (
      calendarsResult.success && calendarsResult.data.some((calendar) => calendar.id === calendarId)
    );
  }

  return false;
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
        case "native_event":
          return { success: false, error: "Native event date updates are not supported yet" };
      }
    });
  } catch (error) {
    serverLogger.error("planning_calendar.update_due_date.failed", error);
    return { success: false, error: "Unexpected error" };
  }
}

export async function updateCalendarItemScheduleAction(
  input: UpdateCalendarItemScheduleInput
): Promise<ActionResult<void>> {
  try {
    return await withServerSpan("planning.calendar.update_schedule", {}, async () => {
      const ctx = await getAuthedContext();
      if (!ctx) return { success: false, error: "Unauthorized" };

      const parsed = updateCalendarItemScheduleSchema.safeParse(input);
      if (!parsed.success) return { success: false, error: firstZodError(parsed.error) };

      const { sourceType, sourceId, boardId, calendarId } =
        parsed.data as UpdateCalendarItemScheduleInput;
      const schedule = (parsed.data as UpdateCalendarItemScheduleInput).schedule;

      switch (sourceType) {
        case "planning_task": {
          if (
            !checkPermission(
              ctx.context.user.permissionSnapshot,
              PLANNING_CALENDAR_SOURCE_REGISTRY.planning_task.updatePermission
            )
          )
            return { success: false, error: "Insufficient permissions" };
          return PlanningTasksService.updateCalendarSchedule(
            ctx.supabase,
            ctx.orgId,
            ctx.userId,
            sourceId,
            schedule
          );
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
          return KanbanBoardsService.updateCardCalendarSchedule(
            ctx.supabase,
            ctx.orgId,
            ctx.userId,
            sourceId,
            boardId,
            schedule
          );
        }
        case "native_event": {
          if (!schedule) return { success: false, error: "Native event schedule is required" };
          if (!calendarId) return { success: false, error: "calendarId is required" };
          if (!(await canAccessCalendarKey(ctx, `${NATIVE_CALENDAR_KEY_PREFIX}${calendarId}`))) {
            return { success: false, error: "Calendar is not available" };
          }
          return AppCalendarService.updateNativeEventSchedule(
            ctx.supabase,
            ctx.orgId,
            ctx.userId,
            sourceId,
            calendarId,
            schedule
          );
        }
      }
    });
  } catch (error) {
    serverLogger.error("planning_calendar.update_schedule.failed", error);
    return { success: false, error: "Unexpected error" };
  }
}

export async function updateCalendarSourceSettingsAction(
  input: UpdateCalendarSourceSettingsInput
): Promise<ActionResult<void>> {
  try {
    return await withServerSpan("planning.calendar.update_source_settings", {}, async () => {
      const ctx = await getAuthedContext();
      if (!ctx) return { success: false, error: "Unauthorized" };
      if (!checkPermission(ctx.context.user.permissionSnapshot, PLANNING_READ))
        return { success: false, error: "Insufficient permissions" };

      const parsed = updateCalendarSourceSettingsSchema.safeParse(input);
      if (!parsed.success) return { success: false, error: firstZodError(parsed.error) };

      if (!(await canAccessCalendarKey(ctx, parsed.data.calendarKey))) {
        return { success: false, error: "Calendar is not available" };
      }

      return AppCalendarService.upsertUserSettings(
        ctx.supabase,
        ctx.orgId,
        ctx.userId,
        parsed.data.calendarKey,
        {
          color: parsed.data.color,
          visible: parsed.data.visible,
          position: parsed.data.position,
        }
      );
    });
  } catch (error) {
    serverLogger.error("planning_calendar.update_source_settings.failed", error);
    return { success: false, error: "Unexpected error" };
  }
}

export async function resetCalendarSourceColorAction(input: {
  calendarKey: string;
}): Promise<ActionResult<void>> {
  try {
    return await withServerSpan("planning.calendar.reset_source_color", {}, async () => {
      const ctx = await getAuthedContext();
      if (!ctx) return { success: false, error: "Unauthorized" };
      if (!checkPermission(ctx.context.user.permissionSnapshot, PLANNING_READ))
        return { success: false, error: "Insufficient permissions" };

      const parsed = resetCalendarSourceColorSchema.safeParse(input);
      if (!parsed.success) return { success: false, error: firstZodError(parsed.error) };

      if (!(await canAccessCalendarKey(ctx, parsed.data.calendarKey))) {
        return { success: false, error: "Calendar is not available" };
      }

      return AppCalendarService.resetUserColor(
        ctx.supabase,
        ctx.orgId,
        ctx.userId,
        parsed.data.calendarKey
      );
    });
  } catch (error) {
    serverLogger.error("planning_calendar.reset_source_color.failed", error);
    return { success: false, error: "Unexpected error" };
  }
}

export async function createNativeCalendarAction(
  input: CreateNativeCalendarInput
): Promise<ActionResult<{ id: string }>> {
  try {
    return await withServerSpan("planning.calendar.create_native_calendar", {}, async () => {
      const ctx = await getAuthedContext();
      if (!ctx) return { success: false, error: "Unauthorized" };
      if (!checkPermission(ctx.context.user.permissionSnapshot, PLANNING_READ))
        return { success: false, error: "Insufficient permissions" };

      const parsed = createNativeCalendarSchema.safeParse(input);
      if (!parsed.success) return { success: false, error: firstZodError(parsed.error) };

      const result = await AppCalendarService.createNativeCalendar(
        ctx.supabase,
        ctx.orgId,
        ctx.userId,
        {
          name: parsed.data.name ?? "",
          defaultColor: parsed.data.defaultColor ?? undefined,
          visibility: parsed.data.visibility,
        }
      );
      if (!result.success) return result;
      return { success: true, data: { id: result.data.id } };
    });
  } catch (error) {
    serverLogger.error("planning_calendar.create_native_calendar.failed", error);
    return { success: false, error: "Unexpected error" };
  }
}

export async function deleteNativeCalendarAction(input: {
  calendarId: string;
}): Promise<ActionResult<void>> {
  try {
    return await withServerSpan("planning.calendar.delete_native_calendar", {}, async () => {
      const ctx = await getAuthedContext();
      if (!ctx) return { success: false, error: "Unauthorized" };
      if (!checkPermission(ctx.context.user.permissionSnapshot, PLANNING_READ))
        return { success: false, error: "Insufficient permissions" };

      const parsed = deleteNativeCalendarSchema.safeParse(input);
      if (!parsed.success) return { success: false, error: firstZodError(parsed.error) };

      return AppCalendarService.softDeleteNativeCalendar(
        ctx.supabase,
        ctx.orgId,
        ctx.userId,
        parsed.data.calendarId
      );
    });
  } catch (error) {
    serverLogger.error("planning_calendar.delete_native_calendar.failed", error);
    return { success: false, error: "Unexpected error" };
  }
}

export async function createNativeCalendarEventAction(
  input: NativeCalendarEventInput
): Promise<ActionResult<{ id: string }>> {
  try {
    return await withServerSpan("planning.calendar.create_native_event", {}, async () => {
      const ctx = await getAuthedContext();
      if (!ctx) return { success: false, error: "Unauthorized" };
      if (!checkPermission(ctx.context.user.permissionSnapshot, PLANNING_READ))
        return { success: false, error: "Insufficient permissions" };

      const parsed = nativeCalendarEventSchema.safeParse(input);
      if (!parsed.success) return { success: false, error: firstZodError(parsed.error) };
      const eventInput = parsed.data as NativeCalendarEventInput;

      if (
        !(await canAccessCalendarKey(ctx, `${NATIVE_CALENDAR_KEY_PREFIX}${eventInput.calendarId}`))
      ) {
        return { success: false, error: "Calendar is not available" };
      }

      const result = await AppCalendarService.createNativeEvent(
        ctx.supabase,
        ctx.orgId,
        ctx.userId,
        eventInput
      );
      if (!result.success) return result;
      return { success: true, data: { id: result.data.id } };
    });
  } catch (error) {
    serverLogger.error("planning_calendar.create_native_event.failed", error);
    return { success: false, error: "Unexpected error" };
  }
}

export async function updateNativeCalendarEventAction(
  input: NativeCalendarEventInput
): Promise<ActionResult<{ id: string }>> {
  try {
    return await withServerSpan("planning.calendar.update_native_event", {}, async () => {
      const ctx = await getAuthedContext();
      if (!ctx) return { success: false, error: "Unauthorized" };
      if (!checkPermission(ctx.context.user.permissionSnapshot, PLANNING_READ))
        return { success: false, error: "Insufficient permissions" };

      const parsed = nativeCalendarEventSchema.safeParse(input);
      if (!parsed.success) return { success: false, error: firstZodError(parsed.error) };
      const eventInput = parsed.data as NativeCalendarEventInput;
      if (!eventInput.id) return { success: false, error: "Event id is required" };

      if (
        !(await canAccessCalendarKey(ctx, `${NATIVE_CALENDAR_KEY_PREFIX}${eventInput.calendarId}`))
      ) {
        return { success: false, error: "Calendar is not available" };
      }

      const result = await AppCalendarService.updateNativeEvent(
        ctx.supabase,
        ctx.orgId,
        ctx.userId,
        eventInput.id,
        eventInput
      );
      if (!result.success) return result;
      return { success: true, data: { id: result.data.id } };
    });
  } catch (error) {
    serverLogger.error("planning_calendar.update_native_event.failed", error);
    return { success: false, error: "Unexpected error" };
  }
}

export async function deleteNativeCalendarEventAction(
  input: DeleteNativeCalendarEventInput
): Promise<ActionResult<void>> {
  try {
    return await withServerSpan("planning.calendar.delete_native_event", {}, async () => {
      const ctx = await getAuthedContext();
      if (!ctx) return { success: false, error: "Unauthorized" };
      if (!checkPermission(ctx.context.user.permissionSnapshot, PLANNING_READ))
        return { success: false, error: "Insufficient permissions" };

      const parsed = deleteNativeCalendarEventSchema.safeParse(input);
      if (!parsed.success) return { success: false, error: firstZodError(parsed.error) };

      if (
        !(await canAccessCalendarKey(ctx, `${NATIVE_CALENDAR_KEY_PREFIX}${parsed.data.calendarId}`))
      ) {
        return { success: false, error: "Calendar is not available" };
      }

      return AppCalendarService.softDeleteNativeEvent(
        ctx.supabase,
        ctx.orgId,
        ctx.userId,
        parsed.data.id,
        parsed.data.calendarId
      );
    });
  } catch (error) {
    serverLogger.error("planning_calendar.delete_native_event.failed", error);
    return { success: false, error: "Unexpected error" };
  }
}
