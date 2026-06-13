import type { CalendarSource, EventCategory } from "@/components/primitives/scheduler";

export type CalendarItemSourceModule = "planning" | "helpdesk" | "kanban";
export type CalendarItemSourceType = "planning_task" | "helpdesk_ticket" | "kanban_card";

export interface CalendarEventDTO {
  id: string;
  title: string;
  dueDate: string;
  category: EventCategory;
  calendarSourceId: string;
  sourceModule: CalendarItemSourceModule;
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
  sources: CalendarSource[];
  events: CalendarEventDTO[];
  unscheduled: UnscheduledItemDTO[];
  hasMoreUnscheduled?: boolean;
  unscheduledLimit?: number;
}
