import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { checkPermission, type PermissionSnapshot } from "@/lib/utils/permissions";
import { HELPDESK_TICKETS_READ } from "@/lib/constants/permissions";
import { MODULE_HELPDESK } from "@/lib/constants/modules";
import { EntitlementsService } from "./entitlements-service";
import { PlanningTasksService } from "./planning-tasks.service";
import { HelpdeskTicketsService } from "./helpdesk-tickets.service";
import { KanbanBoardsService } from "./kanban-boards.service";
import { CALENDAR_SOURCE_CATEGORY_CYCLE } from "@/components/primitives/scheduler/scheduler-utils";
import type { CalendarSource } from "@/components/primitives/scheduler";
import type {
  CalendarEventDTO,
  PlanningCalendarData,
  UnscheduledItemDTO,
} from "@/lib/types/planning-calendar";
import {
  PLANNING_TASKS_SOURCE_ID,
  HELPDESK_TICKETS_SOURCE_ID,
} from "@/lib/constants/planning-calendar";

export type ServiceResult<T> = { success: true; data: T } | { success: false; error: string };

function failureOf(result: { success: false; error: string } | { success: true; data: unknown }) {
  return { success: false as const, error: (result as { success: false; error: string }).error };
}

export const PlanningCalendarService = {
  async getCalendarData(
    supabase: SupabaseClient,
    orgId: string,
    permissionSnapshot: PermissionSnapshot
  ): Promise<ServiceResult<PlanningCalendarData>> {
    const sources: CalendarSource[] = [];
    const events: CalendarEventDTO[] = [];
    const unscheduled: UnscheduledItemDTO[] = [];

    // ── Planning tasks ──────────────────────────────────────────────────────
    const tasksCategory = CALENDAR_SOURCE_CATEGORY_CYCLE[0];
    sources.push({
      id: PLANNING_TASKS_SOURCE_ID,
      label: "Tasks",
      category: tasksCategory,
      module: "planning",
    });

    const tasksResult = await PlanningTasksService.listForCalendar(supabase, orgId);
    if (!tasksResult.success) return failureOf(tasksResult);

    for (const row of tasksResult.data.scheduled) {
      events.push({
        id: `planning_task:${row.id}`,
        title: row.title,
        dueAt: row.due_at as string,
        category: tasksCategory,
        calendarSourceId: PLANNING_TASKS_SOURCE_ID,
        sourceModule: "planning",
        sourceType: "planning_task",
        sourceId: row.id,
        metadata: { status: row.status, priority: row.priority },
      });
    }
    for (const row of tasksResult.data.unscheduled) {
      unscheduled.push({
        id: `planning_task:${row.id}`,
        title: row.title,
        category: tasksCategory,
        calendarSourceId: PLANNING_TASKS_SOURCE_ID,
        sourceModule: "planning",
        sourceType: "planning_task",
        sourceId: row.id,
        metadata: { status: row.status, priority: row.priority },
      });
    }

    // ── Helpdesk tickets (gated by permission + module entitlement) ─────────
    const canReadTickets = checkPermission(permissionSnapshot, HELPDESK_TICKETS_READ);
    const hasHelpdeskModule = canReadTickets
      ? await EntitlementsService.hasModuleAccess(orgId, MODULE_HELPDESK)
      : false;

    if (canReadTickets && hasHelpdeskModule) {
      const ticketsCategory = CALENDAR_SOURCE_CATEGORY_CYCLE[1];
      sources.push({
        id: HELPDESK_TICKETS_SOURCE_ID,
        label: "Tickets",
        category: ticketsCategory,
        module: "helpdesk",
      });

      const ticketsResult = await HelpdeskTicketsService.listForCalendar(supabase, orgId);
      if (!ticketsResult.success) return failureOf(ticketsResult);

      for (const row of ticketsResult.data.scheduled) {
        events.push({
          id: `helpdesk_ticket:${row.id}`,
          title: `#${row.ticket_number} ${row.title}`,
          dueAt: row.due_at as string,
          category: ticketsCategory,
          calendarSourceId: HELPDESK_TICKETS_SOURCE_ID,
          sourceModule: "helpdesk",
          sourceType: "helpdesk_ticket",
          sourceId: row.id,
          metadata: { status: row.status, priority: row.priority, ticketNumber: row.ticket_number },
        });
      }
      for (const row of ticketsResult.data.unscheduled) {
        unscheduled.push({
          id: `helpdesk_ticket:${row.id}`,
          title: `#${row.ticket_number} ${row.title}`,
          category: ticketsCategory,
          calendarSourceId: HELPDESK_TICKETS_SOURCE_ID,
          sourceModule: "helpdesk",
          sourceType: "helpdesk_ticket",
          sourceId: row.id,
          metadata: { status: row.status, priority: row.priority, ticketNumber: row.ticket_number },
        });
      }
    }

    // ── Kanban boards (one calendar source per visible board) ───────────────
    const boardsResult = await KanbanBoardsService.listBoards(supabase, orgId);
    if (!boardsResult.success) return failureOf(boardsResult);

    const cardsResult = await KanbanBoardsService.listCardsForCalendar(supabase, orgId);
    if (!cardsResult.success) return failureOf(cardsResult);

    const cardsByBoard = new Map<string, typeof cardsResult.data>();
    for (const card of cardsResult.data) {
      const list = cardsByBoard.get(card.board_id);
      if (list) {
        list.push(card);
      } else {
        cardsByBoard.set(card.board_id, [card]);
      }
    }

    boardsResult.data.forEach((board, index) => {
      const category =
        CALENDAR_SOURCE_CATEGORY_CYCLE[(index + 2) % CALENDAR_SOURCE_CATEGORY_CYCLE.length];
      const sourceId = `kanban-board:${board.id}`;

      sources.push({
        id: sourceId,
        label: board.title,
        category,
        module: "kanban",
        boardId: board.id,
      });

      for (const card of cardsByBoard.get(board.id) ?? []) {
        if (card.due_at) {
          events.push({
            id: `kanban_card:${card.id}`,
            title: card.title,
            dueAt: card.due_at,
            category,
            calendarSourceId: sourceId,
            sourceModule: "kanban",
            sourceType: "kanban_card",
            sourceId: card.id,
            metadata: { boardId: board.id, label: card.label, labelColor: card.label_color },
          });
        } else {
          unscheduled.push({
            id: `kanban_card:${card.id}`,
            title: card.title,
            category,
            calendarSourceId: sourceId,
            sourceModule: "kanban",
            sourceType: "kanban_card",
            sourceId: card.id,
            metadata: { boardId: board.id, label: card.label, labelColor: card.label_color },
          });
        }
      }
    });

    return { success: true, data: { sources, events, unscheduled } };
  },
};
