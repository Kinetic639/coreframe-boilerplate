"use client";

import React, { useState } from "react";
import {
  Settings,
  Palette,
  Filter,
  Layers,
  Inbox,
  Clock,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Globe,
  Languages,
  Search,
} from "lucide-react";
import {
  SchedulerSettings,
  EventCategory,
  UnscheduledTask,
  CalendarEvent,
  CalendarSource,
  SchedulerLocale,
} from "./scheduler-types";
import { LABELS_MAP, LOCALE_MAP } from "./scheduler-utils";
import {
  isSameDay,
  isToday,
  isSameMonth,
  format,
  addMonths,
  subMonths,
  startOfDay,
} from "date-fns";

interface SchedulerSidebarProps {
  settings: SchedulerSettings;
  onUpdateSettings: (settings: Partial<SchedulerSettings>) => void;
  unscheduledTasks: UnscheduledTask[];
  onDragTaskStart?: (taskId: string) => void;
  onDragTaskEnd?: () => void;
  currentDate?: Date;
  onNavigateDate?: (date: Date) => void;
  calendarSources?: CalendarSource[];
  events?: CalendarEvent[];
  hasMoreUnscheduled?: boolean;
  unscheduledSearch?: string;
  onUnscheduledSearchChange?: (value: string) => void;
  onLoadMoreUnscheduled?: () => void;
  isLoadingMoreUnscheduled?: boolean;
}

export const SchedulerSidebar: React.FC<SchedulerSidebarProps> = ({
  settings,
  onUpdateSettings,
  unscheduledTasks,
  onDragTaskStart,
  onDragTaskEnd,
  currentDate = startOfDay(new Date()),
  onNavigateDate,
  calendarSources,
  events = [],
  hasMoreUnscheduled = false,
  unscheduledSearch = "",
  onUnscheduledSearchChange,
  onLoadMoreUnscheduled,
  isLoadingMoreUnscheduled = false,
}) => {
  const label = LABELS_MAP[settings.locale];

  const dayAbbrs: Record<SchedulerLocale, string[]> = {
    en: ["M", "T", "W", "T", "F", "S", "S"],
    pl: ["P", "W", "Ś", "C", "P", "S", "N"],
    de: ["M", "D", "M", "D", "F", "S", "S"],
  };

  const getCategoryLabel = (cat: EventCategory) => {
    const map: Record<EventCategory, string> = {
      meeting: label.catMeeting || "Meetings",
      workshop: label.catWorkshop || "Workshop",
      reminder: label.catReminder || "Reminders",
      warehouse: label.catWarehouse || "Warehouse",
      task: label.catTask || "Tasks",
      personal: label.catPersonal || "Personal",
    };
    return map[cat] || cat;
  };

  // Local state for browse-months in the sidebar's mini calendar independently
  const [miniBrowseDate, setMiniBrowseDate] = useState<Date>(currentDate);

  // Foldable sidebar sections
  const [isCalendarsOpen, setIsCalendarsOpen] = useState(true);
  const [isTaskPoolOpen, setIsTaskPoolOpen] = useState(true);

  // Synchronize mini-calendar state with active grid date changes
  React.useEffect(() => {
    setMiniBrowseDate(currentDate);
  }, [currentDate]);

  // Mini calendar day generator helper
  const getMiniCalendarDays = (refDate: Date) => {
    const year = refDate.getFullYear();
    const month = refDate.getMonth(); // 0-indexed

    const firstDay = new Date(year, month, 1);
    let startOffset = firstDay.getDay() - 1; // Monday index 0
    if (startOffset === -1) startOffset = 6; // Sunday index 6

    const daysList: { date: Date; currentMonth: boolean }[] = [];

    // Prev month days fill
    const prevMonthLast = new Date(year, month, 0);
    const prevMonthDaysCount = prevMonthLast.getDate();
    for (let i = startOffset - 1; i >= 0; i--) {
      daysList.push({
        date: new Date(year, month - 1, prevMonthDaysCount - i),
        currentMonth: false,
      });
    }

    // Active month days fill
    const currentMonthLast = new Date(year, month + 1, 0);
    const currentDaysCount = currentMonthLast.getDate();
    for (let i = 1; i <= currentDaysCount; i++) {
      daysList.push({
        date: new Date(year, month, i),
        currentMonth: true,
      });
    }

    // Next month days fill
    const totalSlots = 42; // standard 6x7 panel
    const remaining = totalSlots - daysList.length;
    for (let i = 1; i <= remaining; i++) {
      daysList.push({
        date: new Date(year, month + 1, i),
        currentMonth: false,
      });
    }

    return daysList;
  };

  const miniDays = getMiniCalendarDays(miniBrowseDate);

  // Helper for category filters matching design specs
  const categories: { key: EventCategory; labelText: string; bg: string; border: string }[] = [
    {
      key: "meeting",
      labelText: label.catMeeting || "Meetings",
      bg: "bg-indigo-500",
      border: "border-indigo-200",
    },
    {
      key: "workshop",
      labelText: label.catWorkshop || "Workshop",
      bg: "bg-emerald-500",
      border: "border-emerald-200",
    },
    {
      key: "reminder",
      labelText: label.catReminder || "Reminders",
      bg: "bg-amber-500",
      border: "border-amber-200",
    },
    {
      key: "warehouse",
      labelText: label.catWarehouse || "Warehouse",
      bg: "bg-rose-500",
      border: "border-rose-200",
    },
    {
      key: "task",
      labelText: label.catTask || "Tasks",
      bg: "bg-cyan-500",
      border: "border-cyan-200",
    },
    {
      key: "personal",
      labelText: label.catPersonal || "Personal",
      bg: "bg-fuchsia-500",
      border: "border-fuchsia-200",
    },
  ];

  const handleCategoryToggle = (cat: EventCategory) => {
    const updated = {
      ...settings.visibleCategories,
      [cat]: !settings.visibleCategories[cat],
    };
    onUpdateSettings({ visibleCategories: updated });
  };

  // Color swatches reused for dynamic calendar sources (keyed by their cycled category)
  const CATEGORY_COLOR_MAP: Record<EventCategory, { bg: string; border: string }> = {
    meeting: { bg: "bg-indigo-500", border: "border-indigo-200" },
    workshop: { bg: "bg-emerald-500", border: "border-emerald-200" },
    reminder: { bg: "bg-amber-500", border: "border-amber-200" },
    warehouse: { bg: "bg-rose-500", border: "border-rose-200" },
    task: { bg: "bg-cyan-500", border: "border-cyan-200" },
    personal: { bg: "bg-fuchsia-500", border: "border-fuchsia-200" },
  };

  const isSourceVisible = (sourceId: string) =>
    settings.visibleCalendarSources?.[sourceId] !== false;

  const handleCalendarSourceToggle = (sourceId: string) => {
    const updated = {
      ...(settings.visibleCalendarSources ?? {}),
      [sourceId]: !isSourceVisible(sourceId),
    };
    onUpdateSettings({ visibleCalendarSources: updated });
  };

  const getSourceForTask = (task: UnscheduledTask) =>
    calendarSources?.find((source) => source.id === task.calendarSourceId);

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData("text/plain", JSON.stringify({ type: "task", id: taskId }));
    e.dataTransfer.effectAllowed = "copyMove";

    // Suppress standard ghost preview image
    const img = new Image();
    img.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    e.dataTransfer.setDragImage(img, 0, 0);

    if (onDragTaskStart) {
      onDragTaskStart(taskId);
    }
  };

  return (
    <aside className="bg-card border-border flex h-full w-full select-none flex-col gap-6 overflow-y-auto border-r p-6 transition-colors duration-200 lg:w-72">
      {/* Sidebar Branding Header */}
      <div className="border-border hidden items-center gap-2.5 border-b pb-2 lg:flex">
        <div className="bg-primary flex h-8 w-8 items-center justify-center rounded-md shadow-xs">
          <svg
            className="w-4.5 h-4.5 text-primary-foreground"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5V15z"
            />
          </svg>
        </div>
        <span className="text-foreground text-xl font-semibold tracking-tight">
          {label.modeCalendar}
        </span>
      </div>

      {/* Dynamic Mini Calendar Section */}
      <div className="space-y-3.5" id="sidebar-mini-calendar">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-foreground capitalize">
            {format(miniBrowseDate, "MMMM yyyy", { locale: LOCALE_MAP[settings.locale] })}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setMiniBrowseDate((prev) => subMonths(prev, 1))}
              className="p-1 text-muted-foreground hover:text-foreground rounded-md hover:bg-muted transition cursor-pointer"
              aria-label="Previous Month mini calendar"
            >
              <ChevronLeft size={14} strokeWidth={2.5} />
            </button>
            <button
              onClick={() => setMiniBrowseDate((prev) => addMonths(prev, 1))}
              className="p-1 text-muted-foreground hover:text-foreground rounded-md hover:bg-muted transition cursor-pointer"
              aria-label="Next Month mini calendar"
            >
              <ChevronRight size={14} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {/* Days Column Header Grid */}
        <div className="grid grid-cols-7 gap-y-1.5 text-center text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider font-mono">
          {dayAbbrs[settings.locale].map((abbr, idx) => (
            <div key={idx}>{abbr}</div>
          ))}
        </div>

        {/* Day numbers body element */}
        <div className="grid grid-cols-7 gap-y-1 text-center text-xs font-medium text-muted-foreground">
          {miniDays.map((md, idx) => {
            const isTodayDay = isToday(md.date);

            let textClass = "text-foreground hover:bg-muted";
            if (!md.currentMonth) {
              textClass = "text-muted-foreground/50";
            }

            return (
              <div
                key={idx}
                onClick={() => onNavigateDate && onNavigateDate(md.date)}
                className={`h-6 w-6 flex items-center justify-center mx-auto rounded-full cursor-pointer transition duration-150 ${textClass} ${
                  isTodayDay
                    ? "bg-primary text-primary-foreground font-bold hover:bg-primary/90 shadow-sm"
                    : ""
                }`}
              >
                {format(md.date, "d")}
              </div>
            );
          })}
        </div>
      </div>

      {/* Calendars / Filters Categories */}
      <div className="space-y-4 pt-1">
        <button
          type="button"
          onClick={() => setIsCalendarsOpen((prev) => !prev)}
          className="flex w-full cursor-pointer items-center justify-between"
          id="btn-toggle-calendars-section"
        >
          <h3 className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest font-mono">
            {calendarSources ? label.calendarsTitle || "Calendars" : label.filters}
          </h3>
          <ChevronDown
            size={14}
            className={`text-muted-foreground transition-transform duration-200 ${
              isCalendarsOpen ? "" : "-rotate-90"
            }`}
          />
        </button>
        {isCalendarsOpen && (
          <div className="space-y-2.5">
            {calendarSources
              ? calendarSources.map((source) => {
                  const isSelected = isSourceVisible(source.id);
                  const colors = CATEGORY_COLOR_MAP[source.category];
                  const count = events.filter((ev) => ev.calendarSourceId === source.id).length;
                  return (
                    <label
                      key={source.id}
                      onClick={() => handleCalendarSourceToggle(source.id)}
                      className="flex items-center gap-3 text-xs text-muted-foreground cursor-pointer p-1.5 rounded-lg hover:bg-muted/50 transition duration-150"
                    >
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center transition duration-150 shrink-0 ${
                          isSelected
                            ? `${colors.bg} border-transparent text-white`
                            : "border-border bg-transparent"
                        }`}
                      >
                        {isSelected && (
                          <svg
                            className="w-3 h-3 text-white"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth="3"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <span className="font-semibold text-foreground flex-1 line-clamp-1">
                        {source.label}
                      </span>
                      <span className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded border border-border font-mono font-semibold shrink-0">
                        {count}
                      </span>
                    </label>
                  );
                })
              : categories.map((cat) => {
                  const isSelected = settings.visibleCategories[cat.key];
                  return (
                    <label
                      key={cat.key}
                      onClick={() => handleCategoryToggle(cat.key)}
                      className="flex items-center gap-3 text-xs text-muted-foreground cursor-pointer p-1.5 rounded-lg hover:bg-muted/50 transition duration-150"
                    >
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center transition duration-150 ${
                          isSelected
                            ? `${cat.bg} border-transparent text-white`
                            : "border-border bg-transparent"
                        }`}
                      >
                        {isSelected && (
                          <svg
                            className="w-3 h-3 text-white"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth="3"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <span className="font-semibold text-foreground">{cat.labelText}</span>
                    </label>
                  );
                })}
          </div>
        )}
      </div>

      {/* Unscheduled Task Pool */}
      {settings.showTaskPool && (
        <div
          className={`space-y-4 flex flex-col border-t border-border pt-5 text-left ${
            isTaskPoolOpen ? "flex-1" : ""
          }`}
        >
          <button
            type="button"
            onClick={() => setIsTaskPoolOpen((prev) => !prev)}
            className="flex w-full cursor-pointer items-center justify-between shrink-0"
            id="btn-toggle-taskpool-section"
          >
            <div className="flex items-center gap-2">
              <h3 className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest font-mono text-left">
                {calendarSources ? label.noDueDateTitle || "No due date" : label.taskPool}
              </h3>
              <span className="bg-primary/10 text-primary font-extrabold px-2 py-0.5 rounded-full text-[10px]">
                {unscheduledTasks.length}
              </span>
            </div>
            <ChevronDown
              size={14}
              className={`text-muted-foreground transition-transform duration-200 ${
                isTaskPoolOpen ? "" : "-rotate-90"
              }`}
            />
          </button>

          {isTaskPoolOpen && (
            <div className="space-y-2.5 overflow-y-auto max-h-56 lg:max-h-none flex-1 pr-1 scrollbar-thin">
              {calendarSources && onUnscheduledSearchChange && (
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={unscheduledSearch}
                    onChange={(event) => onUnscheduledSearchChange(event.target.value)}
                    placeholder={label.searchNoDueDate}
                    className="h-8 w-full rounded-md border border-border bg-background pl-8 pr-2 text-[11px] font-medium text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary/60"
                  />
                </div>
              )}
              {unscheduledTasks.length === 0 ? (
                <div className="py-6 text-center text-[11px] text-muted-foreground border border-dashed border-border rounded-lg bg-muted/40">
                  {label.allTasksScheduled || "All tasks scheduled"}
                </div>
              ) : (
                unscheduledTasks.map((task) => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, task.id)}
                    onDragEnd={() => onDragTaskEnd?.()}
                    className="p-3 bg-card border border-border rounded-lg shadow-xs hover:border-primary/40 hover:shadow-xs transition duration-200 cursor-pointer active:cursor-grabbing group"
                  >
                    <div className="flex justify-between items-start mb-1 gap-2">
                      <span className="text-[11px] font-bold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                        {task.title}
                      </span>
                      <span className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded border border-border font-mono font-semibold shrink-0">
                        {task.estimatedDurationMinutes}m
                      </span>
                    </div>
                    {task.description && (
                      <p className="text-[9.5px] text-muted-foreground line-clamp-1 leading-normal mb-1">
                        {task.description}
                      </p>
                    )}
                    {calendarSources ? (
                      (() => {
                        const source = getSourceForTask(task);
                        const colors = source
                          ? CATEGORY_COLOR_MAP[source.category]
                          : CATEGORY_COLOR_MAP.task;
                        return (
                          <div className="flex items-center gap-1">
                            <div className={`w-1.5 h-1.5 rounded-full ${colors.bg}`} />
                            <span className="text-[8.5px] text-muted-foreground uppercase tracking-tighter font-extrabold font-mono">
                              {source?.label ?? getCategoryLabel(task.category)}
                            </span>
                          </div>
                        );
                      })()
                    ) : (
                      <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                        <span className="text-[8.5px] text-muted-foreground uppercase tracking-tighter font-extrabold font-mono">
                          {getCategoryLabel(task.category)}
                        </span>
                      </div>
                    )}
                  </div>
                ))
              )}
              {hasMoreUnscheduled && (
                <div className="space-y-2 rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2 text-[10px] leading-relaxed text-muted-foreground">
                  <p>{label.moreUnscheduledAvailable}</p>
                  {onLoadMoreUnscheduled && (
                    <button
                      type="button"
                      onClick={onLoadMoreUnscheduled}
                      disabled={isLoadingMoreUnscheduled}
                      className="inline-flex h-7 items-center rounded-md border border-border bg-background px-2 text-[10px] font-bold text-foreground transition hover:border-primary/50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isLoadingMoreUnscheduled
                        ? label.loadingMoreUnscheduled
                        : label.loadMoreUnscheduled}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Options Panel section */}
      <div className="pt-4 border-t border-border space-y-2.5">
        <h3 className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest font-mono">
          {label.optionsTitle || "Calendar Options"}
        </h3>
        <div className="space-y-2 text-xs">
          <label className="flex items-center justify-between cursor-pointer text-muted-foreground">
            <span>{label.weekends || "Show Weekends"}</span>
            <input
              type="checkbox"
              checked={settings.showWeekends}
              onChange={(e) => onUpdateSettings({ showWeekends: e.target.checked })}
              className="accent-primary w-3.5 h-3.5 cursor-pointer"
            />
          </label>
          <label className="flex items-center justify-between cursor-pointer text-muted-foreground">
            <span>{label.showLunch || "Show Background Events"}</span>
            <input
              type="checkbox"
              checked={settings.showBackgroundEvents}
              onChange={(e) => onUpdateSettings({ showBackgroundEvents: e.target.checked })}
              className="accent-primary w-3.5 h-3.5 cursor-pointer"
            />
          </label>
        </div>
      </div>
    </aside>
  );
};
