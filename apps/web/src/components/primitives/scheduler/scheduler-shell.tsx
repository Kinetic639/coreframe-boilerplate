"use client";

import React, { useMemo, useState } from "react";
import {
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  addYears,
  subYears,
  startOfDay,
  isSameDay,
} from "date-fns";
import {
  CalendarEvent,
  BackgroundEvent,
  UnscheduledTask,
  CalendarView,
  SchedulerSettings,
  CalendarSource,
} from "./scheduler-types";
import {
  INITIAL_SETTINGS,
  INITIAL_EVENTS,
  INITIAL_BACKGROUND_EVENTS,
  INITIAL_UNSCHEDULED_TASKS,
} from "./scheduler-demo-data";

// Components
import { SchedulerToolbar } from "./scheduler-toolbar";
import { SchedulerSidebar } from "./scheduler-sidebar";
import { SchedulerYearView } from "./scheduler-year-view";
import { SchedulerMonthView } from "./scheduler-month-view";
import { SchedulerWeekView } from "./scheduler-week-view";
import { SchedulerDayView } from "./scheduler-day-view";
import { SchedulerListView } from "./scheduler-list-view";
import { SchedulerTimelineView } from "./scheduler-timeline-view";
import { SchedulerEventDialog } from "./scheduler-event-dialog";
import { SchedulerEventPopover } from "./scheduler-event-popover";
import {
  convertTaskToEvent,
  moveEventToDate,
  getLocalizedEvent,
  getWeekDays,
} from "./scheduler-utils";
import { Menu, X, CalendarRange } from "lucide-react";

export interface SchedulerWorkspaceProps {
  mode: "calendar" | "planner";
  initialDate?: Date;
  initialView?: Exclude<CalendarView, "timeline">;
  initialSettings?: Partial<SchedulerSettings>;
  initialEvents?: CalendarEvent[];
  initialBackgroundEvents?: BackgroundEvent[];
  initialUnscheduledTasks?: UnscheduledTask[];
  title?: string;
  calendarSources?: CalendarSource[];
  onSelectRealEvent?: (event: CalendarEvent) => void;
  onCreateAt?: (date: Date) => void;
  onMoveRealEvent?: (event: CalendarEvent, newDate: Date) => void;
  onScheduleRealTask?: (task: UnscheduledTask, date: Date) => void;
  onSettingsChange?: (settings: SchedulerSettings) => void;
}

export const SchedulerWorkspace: React.FC<SchedulerWorkspaceProps> = ({
  mode,
  initialDate,
  initialView = "month",
  initialSettings,
  initialEvents = INITIAL_EVENTS,
  initialBackgroundEvents = INITIAL_BACKGROUND_EVENTS,
  initialUnscheduledTasks = INITIAL_UNSCHEDULED_TASKS,
  title = "Scheduler",
  calendarSources,
  onSelectRealEvent,
  onCreateAt,
  onMoveRealEvent,
  onScheduleRealTask,
  onSettingsChange,
}) => {
  const today = useMemo(() => startOfDay(new Date()), []);
  const mergedInitialSettings = useMemo<SchedulerSettings>(
    () => ({ ...INITIAL_SETTINGS, ...initialSettings }),
    [initialSettings]
  );

  // Navigation State
  const [currentDate, setCurrentDate] = useState<Date>(() => initialDate ?? today);

  const [calendarView, setCalendarView] = useState<Exclude<CalendarView, "timeline">>(initialView);

  const activeView: CalendarView = mode === "planner" ? "timeline" : calendarView;

  // Datastore States
  const [settings, setSettings] = useState<SchedulerSettings>(mergedInitialSettings);
  const [events, setEvents] = useState<CalendarEvent[]>(initialEvents);
  const [backgroundEvents, setBackgroundEvents] =
    useState<BackgroundEvent[]>(initialBackgroundEvents);
  const [unscheduledTasks, setUnscheduledTasks] =
    useState<UnscheduledTask[]>(initialUnscheduledTasks);

  // Drag-and-drop live preview tracker state
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const draggedTask = unscheduledTasks.find((t) => t.id === draggedTaskId) || null;

  // Overlay States
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isDialogModelOpen, setIsDialogModelOpen] = useState(false);
  const [dialogPrefillEvent, setDialogPrefillEvent] = useState<Partial<CalendarEvent> | null>(null);

  // Responsive mobile sidebar control
  const [isSidebarMobileOpen, setIsSidebarMobileOpen] = useState(false);

  // Desktop sidebar collapse control
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Navigate dates step-wise corresponding to active range constraints
  const handleNavigate = (direction: "prev" | "next" | "today") => {
    if (direction === "today") {
      setCurrentDate(today);
      return;
    }

    const value = direction === "next" ? 1 : -1;

    switch (activeView) {
      case "year":
        setCurrentDate((curr) => (value === 1 ? addYears(curr, 1) : subYears(curr, 1)));
        break;
      case "month":
        setCurrentDate((curr) => (value === 1 ? addMonths(curr, 1) : subMonths(curr, 1)));
        break;
      case "week":
        setCurrentDate((curr) => (value === 1 ? addWeeks(curr, 1) : subWeeks(curr, 1)));
        break;
      case "day":
      case "timeline":
        setCurrentDate((curr) => (value === 1 ? addDays(curr, 1) : subDays(curr, 1)));
        break;
      case "list":
        // list expands over dynamic items; nav changes month reference
        setCurrentDate((curr) => (value === 1 ? addMonths(curr, 1) : subMonths(curr, 1)));
        break;
    }
  };

  // Safe category/source filtering for showing calendar items and translating on-the-fly
  const activeEvents = events
    .filter((ev) =>
      calendarSources
        ? settings.visibleCalendarSources?.[ev.calendarSourceId ?? ""] !== false
        : settings.visibleCategories[ev.category]
    )
    .map((ev) => getLocalizedEvent(ev, settings.locale));

  const localizedBackgroundEvents = backgroundEvents.map((bg) =>
    getLocalizedEvent(bg, settings.locale)
  );

  const localizedUnscheduledTasks = unscheduledTasks.map((task) =>
    getLocalizedEvent(task, settings.locale)
  );

  const handleUpdateSettings = (newSettings: Partial<SchedulerSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      if (newSettings.locale && newSettings.locale !== prev.locale) {
        updated.timeFormat = newSettings.locale === "en" ? "12h" : "24h";
      }
      onSettingsChange?.(updated);
      return updated;
    });
  };

  // Trigger creating modal prefilled on visual click cell slot
  const handleCellClick = (
    date: Date,
    keepExactTime = false,
    resourceId?: string,
    endDate?: Date
  ) => {
    if (onCreateAt) {
      onCreateAt(date);
      return;
    }

    const now = new Date();
    // Maintain clicked day but prefill hours nicely
    const startObj = new Date(date);
    if (!keepExactTime) {
      startObj.setHours(now.getHours() + 1, 0, 0, 0);
    }
    const endObj = endDate ? new Date(endDate) : new Date(startObj.getTime() + 60 * 60 * 1000); // 1h duration

    setDialogPrefillEvent({
      start: startObj,
      end: endObj,
      resourceId: resourceId,
      isDraggable: true,
      isResizable: true,
    });
    setIsDialogModelOpen(true);
  };

  const handleSelectEvent = (event: CalendarEvent) => {
    if (event.sourceModule && onSelectRealEvent) {
      onSelectRealEvent(event);
      return;
    }
    setSelectedEvent(event);
  };

  // CRUD Save handler
  const handleSaveEvent = (savedEvent: CalendarEvent) => {
    if (savedEvent.metadata?.isBackground) {
      const bgEvent: BackgroundEvent = {
        id: savedEvent.id.startsWith("ev-") ? `bg-${savedEvent.id.slice(3)}` : savedEvent.id,
        title: savedEvent.title,
        start: savedEvent.start,
        end: savedEvent.end,
        color: savedEvent.color || "indigo",
        type:
          typeof savedEvent.metadata?.bgType === "string"
            ? (savedEvent.metadata.bgType as BackgroundEvent["type"])
            : "break",
        opacity:
          typeof savedEvent.metadata?.opacity === "number" ? savedEvent.metadata.opacity : 0.15,
        resourceId: savedEvent.resourceId,
      };

      // Remove from normal events
      setEvents((prev) => prev.filter((e) => e.id !== savedEvent.id && e.id !== bgEvent.id));

      // Save to backgroundEvents
      setBackgroundEvents((prev) => {
        const exists = prev.some((e) => e.id === bgEvent.id);
        if (exists) {
          return prev.map((e) => (e.id === bgEvent.id ? bgEvent : e));
        } else {
          return [...prev, bgEvent];
        }
      });
    } else {
      const cleanId = savedEvent.id;
      const bgId = cleanId.startsWith("ev-")
        ? `bg-${cleanId.slice(3)}`
        : cleanId.startsWith("bg-")
          ? `ev-${cleanId.slice(3)}`
          : cleanId;

      const cleanEvent: CalendarEvent = {
        ...savedEvent,
        id: cleanId.startsWith("bg-") ? `ev-${cleanId.slice(3)}` : cleanId,
      };

      // Remove from backgroundEvents if it was previously one
      setBackgroundEvents((prev) =>
        prev.filter((e) => e.id !== cleanEvent.id && e.id !== cleanId && e.id !== bgId)
      );

      setEvents((prev) => {
        const exists = prev.some((e) => e.id === cleanEvent.id);
        if (exists) {
          return prev.map((e) => (e.id === cleanEvent.id ? cleanEvent : e));
        } else {
          return [...prev, cleanEvent];
        }
      });
    }
    setIsDialogModelOpen(false);
    setDialogPrefillEvent(null);
    setSelectedEvent(null);
  };

  // CRUD Delete handler
  const handleDeleteEvent = (eventId: string) => {
    const altId = eventId.startsWith("ev-")
      ? `bg-${eventId.slice(3)}`
      : eventId.startsWith("bg-")
        ? `ev-${eventId.slice(3)}`
        : eventId;
    setEvents((prev) => prev.filter((e) => e.id !== eventId && e.id !== altId));
    setBackgroundEvents((prev) => prev.filter((e) => e.id !== eventId && e.id !== altId));
    setSelectedEvent(null);
  };

  // Drag event handler for moving items on grid columns
  const handleMoveEvent = (eventId: string, newStartDate: Date, newResourceId?: string) => {
    const sourceEvent = events.find((ev) => ev.id === eventId);

    setEvents((prev) =>
      prev.map((ev) => {
        if (ev.id === eventId) {
          const moved = moveEventToDate(ev, newStartDate);
          if (newResourceId !== undefined) {
            moved.resourceId = newResourceId;
          }
          return moved;
        }
        return ev;
      })
    );

    if (sourceEvent?.sourceModule && onMoveRealEvent) {
      onMoveRealEvent(sourceEvent, newStartDate);
    }
  };

  // Resizing event card boundaries handler
  const handleResizeEvent = (eventId: string, newEndDateTime: Date, newStartDateTime?: Date) => {
    setEvents((prev) =>
      prev.map((ev) => {
        if (ev.id === eventId) {
          return {
            ...ev,
            end: newEndDateTime,
            start: newStartDateTime !== undefined ? newStartDateTime : ev.start,
          };
        }
        return ev;
      })
    );
  };

  // Drag tasks into active columns handler
  const handleScheduleTask = (taskId: string, targetDate: Date, resourceId?: string) => {
    const task = unscheduledTasks.find((t) => t.id === taskId);
    if (!task) return;

    const newEvent = convertTaskToEvent(task, targetDate);
    if (resourceId) {
      newEvent.resourceId = resourceId;
    }
    setEvents((prev) => [...prev, newEvent]);
    setUnscheduledTasks((prev) => prev.filter((t) => t.id !== taskId));

    if (task.calendarSourceId && onScheduleRealTask) {
      onScheduleRealTask(task, targetDate);
    }
  };

  let computedStartHour = settings.dayStartHour;
  let computedEndHour = settings.dayEndHour;

  if (settings.autoTimeScale) {
    if (activeView === "day" || activeView === "timeline") {
      const dayEvents = activeEvents.filter(
        (ev) => !ev.allDay && isSameDay(new Date(ev.start), currentDate)
      );
      if (dayEvents.length > 0) {
        const minStart = Math.min(...dayEvents.map((ev) => new Date(ev.start).getHours()));
        const maxEnd = Math.max(
          ...dayEvents.map((ev) => {
            const d = new Date(ev.end);
            return d.getMinutes() === 0 ? d.getHours() : d.getHours() + 1;
          })
        );
        computedStartHour = Math.max(0, minStart);
        computedEndHour = Math.min(24, maxEnd);
      }
    } else if (activeView === "week") {
      const weekDays = getWeekDays(currentDate, settings.showWeekends);
      const weekEvents = activeEvents.filter(
        (ev) => !ev.allDay && weekDays.some((d) => isSameDay(new Date(ev.start), d))
      );
      if (weekEvents.length > 0) {
        const minStart = Math.min(...weekEvents.map((ev) => new Date(ev.start).getHours()));
        const maxEnd = Math.max(
          ...weekEvents.map((ev) => {
            const d = new Date(ev.end);
            return d.getMinutes() === 0 ? d.getHours() : d.getHours() + 1;
          })
        );
        computedStartHour = Math.max(0, minStart);
        computedEndHour = Math.min(24, maxEnd);
      }
    }
  }

  return (
    <div className="bg-background flex h-full w-full flex-col overflow-hidden font-sans transition-colors duration-200 lg:flex-row">
      {/* Mobile Top Navigation layout drawer bar */}
      <div className="bg-card flex shrink-0 items-center justify-between border-b px-5 py-3 lg:hidden">
        <div className="flex items-center gap-2">
          <CalendarRange className="text-primary" size={20} />
          <h1 className="text-foreground text-sm font-semibold">{title}</h1>
        </div>

        <button
          onClick={() => setIsSidebarMobileOpen(!isSidebarMobileOpen)}
          className="text-muted-foreground hover:bg-muted rounded-md border p-2 transition active:scale-95"
          aria-label="Toggle configurations sidebar"
        >
          {isSidebarMobileOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {/* 1. Left controls column (With overlay animation drawer properties on Mobile) */}
      <div
        className={`fixed inset-y-0 left-0 z-40 lg:relative lg:flex shrink-0 transform transition-transform duration-300 ease-in-out lg:transform-none ${
          isSidebarMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        } ${isSidebarCollapsed ? "lg:hidden" : ""}`}
      >
        {/* Backdrop for mobile drawer */}
        {isSidebarMobileOpen && (
          <div
            className="fixed inset-0 bg-neutral-950/20 backdrop-blur-xs lg:hidden z-30"
            onClick={() => setIsSidebarMobileOpen(false)}
          />
        )}

        <div className="bg-card relative z-40 h-full">
          <SchedulerSidebar
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            unscheduledTasks={localizedUnscheduledTasks}
            onDragTaskStart={setDraggedTaskId}
            onDragTaskEnd={() => setDraggedTaskId(null)}
            currentDate={currentDate}
            onNavigateDate={setCurrentDate}
            calendarSources={calendarSources}
            events={activeEvents}
          />
        </div>
      </div>

      {/* 2. Main content block segment */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Navigation Toolbar */}
        <SchedulerToolbar
          currentDate={currentDate}
          view={activeView}
          settings={settings}
          locale={settings.locale}
          timezone={settings.timezone}
          mode={mode}
          dayStartHour={computedStartHour}
          dayEndHour={computedEndHour}
          autoTimeScale={settings.autoTimeScale || false}
          showWeekends={settings.showWeekends}
          showBackgroundEvents={settings.showBackgroundEvents}
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          onUpdateSettings={handleUpdateSettings}
          onNavigate={handleNavigate}
          onViewChange={(v) => {
            if (v !== "timeline") {
              setCalendarView(v as Exclude<CalendarView, "timeline">);
            }
          }}
        />

        {/* Dynamic active calendar views mapping */}
        <section className="flex-1 min-h-0 relative">
          {activeView === "year" && (
            <SchedulerYearView
              currentDate={currentDate}
              events={activeEvents}
              backgroundEvents={localizedBackgroundEvents}
              showWeekends={settings.showWeekends}
              showBackgroundEvents={settings.showBackgroundEvents}
              locale={settings.locale}
              timezone={settings.timezone}
              timeFormat={settings.timeFormat}
              draggedTask={draggedTask}
              onSelectEvent={handleSelectEvent}
              onCellClick={handleCellClick}
              onNavigateToDay={(date) => {
                setCurrentDate(date);
                setCalendarView("day");
              }}
              onNavigateToMonth={(date) => {
                setCurrentDate(date);
                setCalendarView("month");
              }}
              onMoveEvent={handleMoveEvent}
              onScheduleTask={handleScheduleTask}
            />
          )}

          {activeView === "month" && (
            <SchedulerMonthView
              currentDate={currentDate}
              events={activeEvents}
              backgroundEvents={localizedBackgroundEvents}
              showWeekends={settings.showWeekends}
              showBackgroundEvents={settings.showBackgroundEvents}
              locale={settings.locale}
              timezone={settings.timezone}
              timeFormat={settings.timeFormat}
              draggedTask={draggedTask}
              onSelectEvent={handleSelectEvent}
              onCellClick={handleCellClick}
              onNavigateToDay={(date) => {
                setCurrentDate(date);
                setCalendarView("day");
              }}
              onMoveEvent={handleMoveEvent}
              onScheduleTask={handleScheduleTask}
            />
          )}

          {activeView === "week" && (
            <SchedulerWeekView
              currentDate={currentDate}
              events={activeEvents}
              backgroundEvents={localizedBackgroundEvents}
              showWeekends={settings.showWeekends}
              showBackgroundEvents={settings.showBackgroundEvents}
              showCurrentTimeIndicator={settings.showCurrentTimeIndicator}
              dayStartHour={computedStartHour}
              dayEndHour={computedEndHour}
              locale={settings.locale}
              timezone={settings.timezone}
              timeFormat={settings.timeFormat}
              draggedTask={draggedTask}
              onSelectEvent={handleSelectEvent}
              onCellClick={handleCellClick}
              onMoveEvent={handleMoveEvent}
              onResizeEvent={handleResizeEvent}
              onScheduleTask={handleScheduleTask}
            />
          )}

          {activeView === "day" && (
            <SchedulerDayView
              currentDate={currentDate}
              events={activeEvents}
              backgroundEvents={localizedBackgroundEvents}
              showBackgroundEvents={settings.showBackgroundEvents}
              showCurrentTimeIndicator={settings.showCurrentTimeIndicator}
              dayStartHour={computedStartHour}
              dayEndHour={computedEndHour}
              locale={settings.locale}
              timezone={settings.timezone}
              timeFormat={settings.timeFormat}
              draggedTask={draggedTask}
              onSelectEvent={handleSelectEvent}
              onCellClick={handleCellClick}
              onMoveEvent={handleMoveEvent}
              onResizeEvent={handleResizeEvent}
              onScheduleTask={handleScheduleTask}
            />
          )}

          {activeView === "list" && (
            <SchedulerListView
              events={activeEvents}
              locale={settings.locale}
              timezone={settings.timezone}
              timeFormat={settings.timeFormat}
              onSelectEvent={handleSelectEvent}
            />
          )}

          {activeView === "timeline" && (
            <SchedulerTimelineView
              currentDate={currentDate}
              events={activeEvents}
              backgroundEvents={localizedBackgroundEvents}
              showBackgroundEvents={settings.showBackgroundEvents}
              showCurrentTimeIndicator={settings.showCurrentTimeIndicator}
              dayStartHour={computedStartHour}
              dayEndHour={computedEndHour}
              autoTimeScale={settings.autoTimeScale || false}
              locale={settings.locale}
              timezone={settings.timezone}
              timeFormat={settings.timeFormat}
              onSelectEvent={handleSelectEvent}
              onCellClick={handleCellClick}
              onMoveEvent={handleMoveEvent}
              onResizeEvent={handleResizeEvent}
              onScheduleTask={handleScheduleTask}
            />
          )}
        </section>
      </main>

      {/* 3. Global Popup / Dialog Modals layer */}
      <SchedulerEventDialog
        isOpen={isDialogModelOpen}
        event={dialogPrefillEvent}
        onClose={() => {
          setIsDialogModelOpen(false);
          setDialogPrefillEvent(null);
        }}
        onSave={handleSaveEvent}
        locale={settings.locale}
        timezone={settings.timezone}
      />

      {selectedEvent && (
        <SchedulerEventPopover
          event={getLocalizedEvent(selectedEvent, settings.locale)}
          onClose={() => setSelectedEvent(null)}
          onEdit={() => {
            setDialogPrefillEvent(selectedEvent);
            setSelectedEvent(null);
            setIsDialogModelOpen(true);
          }}
          onDelete={() => handleDeleteEvent(selectedEvent.id)}
          locale={settings.locale}
          timezone={settings.timezone}
        />
      )}
    </div>
  );
};
