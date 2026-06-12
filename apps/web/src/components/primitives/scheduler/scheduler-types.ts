export type CalendarView = "month" | "week" | "day" | "list" | "timeline" | "year";

export type EventCategory = "meeting" | "task" | "workshop" | "warehouse" | "reminder" | "personal";

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  start: Date;
  end: Date;
  allDay?: boolean;
  color?: string; // Hex color or styling alias
  category: EventCategory;
  status?: "confirmed" | "tentative" | "cancelled";
  priority?: "low" | "medium" | "high";
  location?: string;
  attendees?: string[];
  sourceModule?: string;
  sourceType?: string;
  sourceId?: string;
  isDraggable?: boolean;
  isResizable?: boolean;
  isProvisional?: boolean;
  resourceId?: string;
  metadata?: Record<string, unknown>;
}

export interface BackgroundEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  color: string; // Tailwind bg class color, or hex
  opacity?: number; // e.g., 0.15
  type: "break" | "closed" | "holiday" | "unavailable" | "focus";
  resourceId?: string;
}

export interface UnscheduledTask {
  id: string;
  title: string;
  description?: string;
  estimatedDurationMinutes: number;
  priority?: "low" | "medium" | "high";
  category: EventCategory;
  color?: string;
}

export type SchedulerTheme = "light" | "dark" | "system";

export type SchedulerLocale = "en" | "pl" | "de";

export type SchedulerTimezone =
  | "Local"
  | "UTC"
  | "Europe/Warsaw"
  | "Europe/Berlin"
  | "America/New_York";

export interface SchedulerSettings {
  showWeekends: boolean;
  showBackgroundEvents: boolean;
  showTaskPool: boolean;
  showWeekNumbers: boolean;
  showCurrentTimeIndicator: boolean;
  theme: SchedulerTheme;
  locale: SchedulerLocale;
  timezone: SchedulerTimezone;
  timeFormat: "12h" | "24h";
  dayStartHour: number;
  dayEndHour: number;
  autoTimeScale?: boolean;
  visibleCategories: Record<EventCategory, boolean>;
}
