import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { checkPermission, type PermissionSnapshot } from "@/lib/utils/permissions";
import {
  HELPDESK_TICKETS_READ,
  PLANNING_BOARDS_READ,
  PLANNING_READ,
  PLANNING_TASKS_READ,
} from "@/lib/constants/permissions";
import { MODULE_HELPDESK } from "@/lib/constants/modules";
import { EntitlementsService } from "./entitlements-service";
import { PlanningTasksService } from "./planning-tasks.service";
import { HelpdeskTicketsService } from "./helpdesk-tickets.service";
import { KanbanBoardsService } from "./kanban-boards.service";
import { AppCalendarService } from "./app-calendar.service";
import { CALENDAR_SOURCE_CATEGORY_CYCLE } from "@/components/primitives/scheduler/scheduler-utils";
import type {
  CalendarEventDTO,
  PlanningCalendarData,
  PlanningCalendarSource,
  UnscheduledItemDTO,
} from "@/lib/types/planning-calendar";
import {
  HELPDESK_TICKETS_DEFAULT_COLOR,
  HELPDESK_TICKETS_SOURCE_ID,
  PLANNING_TASKS_DEFAULT_COLOR,
  PLANNING_TASKS_SOURCE_ID,
} from "@/lib/constants/planning-calendar";
import {
  kanbanCalendarSourceId,
  nativeCalendarSourceId,
} from "@/server/planning/calendar-source-registry";

interface CalendarDataServiceInput {
  rangeStart: string;
  rangeEnd: string;
  rangeStartIso: string;
  rangeEndIso: string;
  visibleSourceIds?: string[];
  includeUnscheduled: boolean;
  unscheduledLimit: number;
  unscheduledSearch?: string;
}

export type ServiceResult<T> = { success: true; data: T } | { success: false; error: string };

function failureOf(result: { success: false; error: string } | { success: true; data: unknown }) {
  return { success: false as const, error: (result as { success: false; error: string }).error };
}

function systemSource(input: {
  id: string;
  label: string;
  category: PlanningCalendarSource["category"];
  module: PlanningCalendarSource["module"];
  defaultColor: string;
  sourceType: PlanningCalendarSource["sourceType"];
  sourceId?: string;
  boardId?: string;
}): PlanningCalendarSource {
  return {
    id: input.id,
    key: input.id,
    label: input.label,
    category: input.category,
    module: input.module,
    kind: "source",
    color: input.defaultColor,
    defaultColor: input.defaultColor,
    visible: true,
    position: null,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    boardId: input.boardId,
  };
}

function taskOrCardScheduleFields(row: {
  due_date: string | null;
  calendar_all_day: boolean | null;
  calendar_start_date: string | null;
  calendar_end_date: string | null;
  calendar_start_at: string | null;
  calendar_end_at: string | null;
  calendar_timezone: string | null;
}) {
  if (row.calendar_all_day === true && row.calendar_start_date && row.calendar_end_date) {
    return {
      startDate: row.calendar_start_date,
      endDate: row.calendar_end_date,
      allDay: true,
      displayMode: "scheduled" as const,
      metadata: {
        dueDate: row.due_date,
        timezone: row.calendar_timezone,
      },
    };
  }

  if (row.calendar_all_day === false && row.calendar_start_at && row.calendar_end_at) {
    return {
      startAt: row.calendar_start_at,
      endAt: row.calendar_end_at,
      allDay: false,
      displayMode: "scheduled" as const,
      metadata: {
        dueDate: row.due_date,
        timezone: row.calendar_timezone,
      },
    };
  }

  return {
    dueDate: row.due_date ?? undefined,
    allDay: true,
    displayMode: "deadline" as const,
    metadata: {},
  };
}

export const PlanningCalendarService = {
  async getCalendarData(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    permissionSnapshot: PermissionSnapshot,
    input: CalendarDataServiceInput,
    _timeZone: string
  ): Promise<ServiceResult<PlanningCalendarData>> {
    const discoveredSources: PlanningCalendarSource[] = [];
    const events: CalendarEventDTO[] = [];
    const unscheduled: UnscheduledItemDTO[] = [];
    let hasMoreUnscheduled = false;
    const requestedSources = input.visibleSourceIds ? new Set(input.visibleSourceIds) : null;

    if (checkPermission(permissionSnapshot, PLANNING_TASKS_READ)) {
      discoveredSources.push(
        systemSource({
          id: PLANNING_TASKS_SOURCE_ID,
          label: "Tasks",
          category: CALENDAR_SOURCE_CATEGORY_CYCLE[0],
          module: "planning",
          defaultColor: PLANNING_TASKS_DEFAULT_COLOR,
          sourceType: "planning_tasks",
        })
      );
    }

    const canReadTickets = checkPermission(permissionSnapshot, HELPDESK_TICKETS_READ);
    const hasHelpdeskModule = canReadTickets
      ? await EntitlementsService.hasModuleAccess(orgId, MODULE_HELPDESK)
      : false;

    if (canReadTickets && hasHelpdeskModule) {
      discoveredSources.push(
        systemSource({
          id: HELPDESK_TICKETS_SOURCE_ID,
          label: "Tickets",
          category: CALENDAR_SOURCE_CATEGORY_CYCLE[1],
          module: "helpdesk",
          defaultColor: HELPDESK_TICKETS_DEFAULT_COLOR,
          sourceType: "helpdesk_tickets",
        })
      );
    }

    let visibleBoards: Array<{ id: string; title: string; color: string | null }> = [];
    const canReadBoards = checkPermission(permissionSnapshot, PLANNING_BOARDS_READ);
    if (canReadBoards) {
      const boardsResult = await KanbanBoardsService.listBoards(supabase, orgId, userId);
      if (!boardsResult.success) return failureOf(boardsResult);
      visibleBoards = boardsResult.data;

      visibleBoards.forEach((board, index) => {
        const sourceId = kanbanCalendarSourceId(board.id);
        discoveredSources.push(
          systemSource({
            id: sourceId,
            label: board.title,
            category:
              CALENDAR_SOURCE_CATEGORY_CYCLE[(index + 2) % CALENDAR_SOURCE_CATEGORY_CYCLE.length],
            module: "kanban",
            defaultColor: board.color ?? "#6366f1",
            sourceType: "kanban_board",
            sourceId: board.id,
            boardId: board.id,
          })
        );
      });
    }

    const nativeCalendarsResult = checkPermission(permissionSnapshot, PLANNING_READ)
      ? await AppCalendarService.listNativeCalendars(supabase, orgId)
      : { success: true as const, data: [] };
    if (!nativeCalendarsResult.success) return failureOf(nativeCalendarsResult);

    nativeCalendarsResult.data.forEach((calendar, index) => {
      discoveredSources.push(
        AppCalendarService.nativeCalendarToSource(
          calendar,
          CALENDAR_SOURCE_CATEGORY_CYCLE[
            (index + visibleBoards.length + 2) % CALENDAR_SOURCE_CATEGORY_CYCLE.length
          ]
        )
      );
    });

    const settingsResult = await AppCalendarService.listUserSettings(
      supabase,
      orgId,
      userId,
      discoveredSources.map((source) => source.key)
    );
    if (!settingsResult.success) return failureOf(settingsResult);

    const sources = AppCalendarService.mergeUserSettings(discoveredSources, settingsResult.data);
    const sourceById = new Map(sources.map((source) => [source.id, source]));
    const shouldLoadSource = (sourceId: string) => {
      if (!sourceById.has(sourceId)) return false;
      return !requestedSources || requestedSources.has(sourceId);
    };

    const tasksSource = sourceById.get(PLANNING_TASKS_SOURCE_ID);
    const ticketsSource = sourceById.get(HELPDESK_TICKETS_SOURCE_ID);
    const requestedBoardIds = canReadBoards
      ? visibleBoards
          .filter((board) => shouldLoadSource(kanbanCalendarSourceId(board.id)))
          .map((board) => board.id)
      : [];
    const requestedNativeCalendarIds = nativeCalendarsResult.data
      .filter((calendar) => shouldLoadSource(nativeCalendarSourceId(calendar.id)))
      .map((calendar) => calendar.id);

    const [tasksResult, ticketsResult, cardsResult, nativeEventsResult] = await Promise.all([
      tasksSource && shouldLoadSource(PLANNING_TASKS_SOURCE_ID)
        ? PlanningTasksService.listForCalendar(supabase, orgId, input)
        : Promise.resolve(null),
      ticketsSource && shouldLoadSource(HELPDESK_TICKETS_SOURCE_ID)
        ? HelpdeskTicketsService.listForCalendar(supabase, orgId, input)
        : Promise.resolve(null),
      canReadBoards
        ? KanbanBoardsService.listCardsForCalendar(supabase, orgId, {
            ...input,
            boardIds: requestedBoardIds,
          })
        : Promise.resolve(null),
      AppCalendarService.listEventsForCalendar(supabase, orgId, requestedNativeCalendarIds, input),
    ]);

    if (tasksResult && !tasksResult.success) return failureOf(tasksResult);
    if (ticketsResult && !ticketsResult.success) return failureOf(ticketsResult);
    if (cardsResult && !cardsResult.success) return failureOf(cardsResult);
    if (!nativeEventsResult.success) return failureOf(nativeEventsResult);

    if (tasksResult && tasksSource) {
      hasMoreUnscheduled = hasMoreUnscheduled || tasksResult.data.hasMoreUnscheduled;
      for (const row of tasksResult.data.scheduled) {
        const schedule = taskOrCardScheduleFields(row);
        events.push({
          id: `planning_task:${row.id}`,
          title: row.title,
          dueDate: schedule.dueDate,
          startDate: schedule.startDate,
          endDate: schedule.endDate,
          startAt: schedule.startAt,
          endAt: schedule.endAt,
          allDay: schedule.allDay,
          displayMode: schedule.displayMode,
          color: tasksSource.color,
          category: tasksSource.category,
          calendarSourceId: PLANNING_TASKS_SOURCE_ID,
          sourceModule: "planning",
          sourceType: "planning_task",
          sourceId: row.id,
          metadata: {
            ...schedule.metadata,
            status: row.status,
            priority: row.priority,
            taskNumber: row.task_number,
          },
        });
      }
      for (const row of tasksResult.data.unscheduled) {
        unscheduled.push({
          id: `planning_task:${row.id}`,
          title: row.title,
          category: tasksSource.category,
          calendarSourceId: PLANNING_TASKS_SOURCE_ID,
          sourceModule: "planning",
          sourceType: "planning_task",
          sourceId: row.id,
          metadata: { status: row.status, priority: row.priority, taskNumber: row.task_number },
        });
      }
    }

    if (ticketsResult && ticketsSource) {
      hasMoreUnscheduled = hasMoreUnscheduled || ticketsResult.data.hasMoreUnscheduled;
      for (const row of ticketsResult.data.scheduled) {
        events.push({
          id: `helpdesk_ticket:${row.id}`,
          title: `#${row.ticket_number} ${row.title}`,
          dueDate: row.due_date as string,
          allDay: true,
          displayMode: "deadline",
          color: ticketsSource.color,
          category: ticketsSource.category,
          calendarSourceId: HELPDESK_TICKETS_SOURCE_ID,
          sourceModule: "helpdesk",
          sourceType: "helpdesk_ticket",
          sourceId: row.id,
          metadata: {
            status: row.status,
            priority: row.priority,
            ticketNumber: row.ticket_number,
          },
        });
      }
      for (const row of ticketsResult.data.unscheduled) {
        unscheduled.push({
          id: `helpdesk_ticket:${row.id}`,
          title: `#${row.ticket_number} ${row.title}`,
          category: ticketsSource.category,
          calendarSourceId: HELPDESK_TICKETS_SOURCE_ID,
          sourceModule: "helpdesk",
          sourceType: "helpdesk_ticket",
          sourceId: row.id,
          metadata: {
            status: row.status,
            priority: row.priority,
            ticketNumber: row.ticket_number,
          },
        });
      }
    }

    if (cardsResult) {
      hasMoreUnscheduled = hasMoreUnscheduled || cardsResult.data.hasMoreUnscheduled;

      const cardsByBoard = new Map<string, typeof cardsResult.data.scheduled>();
      for (const card of [...cardsResult.data.scheduled, ...cardsResult.data.unscheduled]) {
        const list = cardsByBoard.get(card.board_id);
        if (list) {
          list.push(card);
        } else {
          cardsByBoard.set(card.board_id, [card]);
        }
      }

      for (const board of visibleBoards) {
        const sourceId = kanbanCalendarSourceId(board.id);
        const source = sourceById.get(sourceId);
        if (!source || !shouldLoadSource(sourceId)) continue;

        for (const card of cardsByBoard.get(board.id) ?? []) {
          if (card.calendar_all_day !== null || card.due_date) {
            const schedule = taskOrCardScheduleFields(card);
            events.push({
              id: `kanban_card:${card.id}`,
              title: card.title,
              dueDate: schedule.dueDate,
              startDate: schedule.startDate,
              endDate: schedule.endDate,
              startAt: schedule.startAt,
              endAt: schedule.endAt,
              allDay: schedule.allDay,
              displayMode: schedule.displayMode,
              color: source.color,
              category: source.category,
              calendarSourceId: sourceId,
              sourceModule: "kanban",
              sourceType: "kanban_card",
              sourceId: card.id,
              metadata: {
                ...schedule.metadata,
                boardId: board.id,
                label: card.label,
                labelColor: card.label_color,
              },
            });
          } else {
            unscheduled.push({
              id: `kanban_card:${card.id}`,
              title: card.title,
              category: source.category,
              calendarSourceId: sourceId,
              sourceModule: "kanban",
              sourceType: "kanban_card",
              sourceId: card.id,
              metadata: { boardId: board.id, label: card.label, labelColor: card.label_color },
            });
          }
        }
      }
    }

    for (const row of nativeEventsResult.data) {
      const sourceId = nativeCalendarSourceId(row.calendar_id);
      const source = sourceById.get(sourceId);
      if (!source) continue;

      events.push({
        id: `native_event:${row.id}`,
        title: row.title,
        dueDate: row.all_day ? (row.start_date ?? undefined) : undefined,
        startDate: row.start_date ?? undefined,
        endDate: row.end_date ?? undefined,
        startAt: row.start_at ?? undefined,
        endAt: row.end_at ?? undefined,
        allDay: row.all_day,
        displayMode: "scheduled",
        color: source.color,
        category: source.category,
        calendarSourceId: sourceId,
        sourceModule: "calendar",
        sourceType: "native_event",
        sourceId: row.id,
        metadata: {
          calendarId: row.calendar_id,
          description: row.description,
          timezone: row.timezone,
        },
      });
    }

    return {
      success: true,
      data: {
        sources,
        events,
        unscheduled,
        hasMoreUnscheduled,
        unscheduledLimit: input.unscheduledLimit,
      },
    };
  },
};
