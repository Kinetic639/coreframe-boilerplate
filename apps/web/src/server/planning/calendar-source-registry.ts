import {
  HELPDESK_TICKETS_MANAGE,
  HELPDESK_TICKETS_READ,
  PLANNING_READ,
  PLANNING_BOARDS_READ,
  PLANNING_BOARDS_UPDATE,
  PLANNING_TASKS_READ,
  PLANNING_TASKS_UPDATE,
} from "@/lib/constants/permissions";
import {
  HELPDESK_TICKETS_SOURCE_ID,
  HELPDESK_TICKETS_DEFAULT_COLOR,
  KANBAN_CALENDAR_KEY_PREFIX,
  NATIVE_CALENDAR_KEY_PREFIX,
  NATIVE_CALENDAR_DEFAULT_COLOR,
  PLANNING_TASKS_DEFAULT_COLOR,
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
    sourceIdPrefix: KANBAN_CALENDAR_KEY_PREFIX,
    readPermission: PLANNING_BOARDS_READ,
    updatePermission: PLANNING_BOARDS_UPDATE,
  },
  native_event: {
    sourceIdPrefix: NATIVE_CALENDAR_KEY_PREFIX,
    readPermission: PLANNING_READ,
    updatePermission: PLANNING_READ,
  },
} satisfies Record<CalendarItemSourceType, Record<string, string>>;

export function kanbanCalendarSourceId(boardId: string): string {
  return `${PLANNING_CALENDAR_SOURCE_REGISTRY.kanban_card.sourceIdPrefix}${boardId}`;
}

export function nativeCalendarSourceId(calendarId: string): string {
  return `${NATIVE_CALENDAR_KEY_PREFIX}${calendarId}`;
}

export function sourceIdToKanbanBoardId(sourceId: string): string | null {
  return sourceId.startsWith(KANBAN_CALENDAR_KEY_PREFIX)
    ? sourceId.slice(KANBAN_CALENDAR_KEY_PREFIX.length)
    : null;
}

export function sourceIdToNativeCalendarId(sourceId: string): string | null {
  return sourceId.startsWith(NATIVE_CALENDAR_KEY_PREFIX)
    ? sourceId.slice(NATIVE_CALENDAR_KEY_PREFIX.length)
    : null;
}

export const SYSTEM_CALENDAR_SOURCE_DEFAULTS = {
  [PLANNING_TASKS_SOURCE_ID]: {
    defaultColor: PLANNING_TASKS_DEFAULT_COLOR,
    sourceType: "planning_tasks" as const,
  },
  [HELPDESK_TICKETS_SOURCE_ID]: {
    defaultColor: HELPDESK_TICKETS_DEFAULT_COLOR,
    sourceType: "helpdesk_tickets" as const,
  },
};

export { NATIVE_CALENDAR_DEFAULT_COLOR };
