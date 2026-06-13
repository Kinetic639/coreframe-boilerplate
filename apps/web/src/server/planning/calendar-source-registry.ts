import {
  HELPDESK_TICKETS_MANAGE,
  HELPDESK_TICKETS_READ,
  PLANNING_BOARDS_READ,
  PLANNING_BOARDS_UPDATE,
  PLANNING_TASKS_READ,
  PLANNING_TASKS_UPDATE,
} from "@/lib/constants/permissions";
import {
  HELPDESK_TICKETS_SOURCE_ID,
  PLANNING_TASKS_SOURCE_ID,
} from "@/lib/constants/planning-calendar";
import type { CalendarItemSourceType } from "@/lib/types/planning-calendar";

export const PLANNING_CALENDAR_SOURCE_REGISTRY = {
  planning_task: {
    sourceId: PLANNING_TASKS_SOURCE_ID,
    readPermission: PLANNING_TASKS_READ,
    updatePermission: PLANNING_TASKS_UPDATE,
  },
  helpdesk_ticket: {
    sourceId: HELPDESK_TICKETS_SOURCE_ID,
    readPermission: HELPDESK_TICKETS_READ,
    updatePermission: HELPDESK_TICKETS_MANAGE,
  },
  kanban_card: {
    sourceIdPrefix: "kanban-board:",
    readPermission: PLANNING_BOARDS_READ,
    updatePermission: PLANNING_BOARDS_UPDATE,
  },
} satisfies Record<CalendarItemSourceType, Record<string, string>>;

export function kanbanCalendarSourceId(boardId: string): string {
  return `${PLANNING_CALENDAR_SOURCE_REGISTRY.kanban_card.sourceIdPrefix}${boardId}`;
}
