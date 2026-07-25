import type { CalendarSource, EventCategory } from "@/components/primitives/scheduler";

export type CalendarItemSourceModule = "planning" | "helpdesk" | "kanban";
export type CalendarItemSourceType =
  | "planning_task"
  | "helpdesk_ticket"
  | "kanban_card"
  | "native_event";

export type PlanningCalendarSourceKind = "source" | "native";
export type PlanningCalendarSourceType =
  | "planning_tasks"
  | "helpdesk_tickets"
  | "kanban_board"
  | "native_calendar";

export interface PlanningCalendarSource extends CalendarSource {
  id: string;
  key: string;
  kind: PlanningCalendarSourceKind;
  color: string;
  defaultColor: string;
  visible: boolean;
  position?: number | null;
  sourceType: PlanningCalendarSourceType;
  sourceId?: string;
}

export interface CalendarEventDTO {
  id: string;
  title: string;
  dueDate?: string;
  startDate?: string;
  endDate?: string;
  startAt?: string;
  endAt?: string;
  allDay?: boolean;
  displayMode?: "deadline" | "scheduled";
  color?: string;
  category: EventCategory;
  calendarSourceId: string;
  sourceModule: CalendarItemSourceModule | "calendar";
  sourceType: CalendarItemSourceType;
  sourceId: string;
  metadata: Record<string, unknown>;
}

export interface UnscheduledItemDTO {
  id: string;
  title: string;
  category: EventCategory;
  calendarSourceId: string;
  sourceModule: CalendarItemSourceModule;
  sourceType: CalendarItemSourceType;
  sourceId: string;
  metadata: Record<string, unknown>;
}

export interface PlanningCalendarData {
  sources: PlanningCalendarSource[];
  events: CalendarEventDTO[];
  unscheduled: UnscheduledItemDTO[];
  hasMoreUnscheduled?: boolean;
  unscheduledLimit?: number;
}
