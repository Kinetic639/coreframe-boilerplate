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
  Globe,
  Languages,
} from "lucide-react";
import {
  SchedulerSettings,
  EventCategory,
  UnscheduledTask,
  SchedulerTheme,
  SchedulerLocale,
  SchedulerTimezone,
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
}

export const SchedulerSidebar: React.FC<SchedulerSidebarProps> = ({
  settings,
  onUpdateSettings,
  unscheduledTasks,
  onDragTaskStart,
  onDragTaskEnd,
  currentDate = startOfDay(new Date()),
  onNavigateDate,
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

  const handleThemeChange = (theme: SchedulerTheme) => {
    onUpdateSettings({ theme });
  };

  const handleLocaleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onUpdateSettings({ locale: e.target.value as SchedulerLocale });
  };

  const handleTimezoneChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onUpdateSettings({ timezone: e.target.value as SchedulerTimezone });
  };

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
            className="w-4.5 h-4.5 text-white"
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
        <span className="text-foreground text-xl font-semibold tracking-tight">Scheduler</span>
      </div>

      {/* Dynamic Mini Calendar Section */}
      <div className="space-y-3.5" id="sidebar-mini-calendar">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-800 dark:text-neutral-200 capitalize">
            {format(miniBrowseDate, "MMMM yyyy", { locale: LOCALE_MAP[settings.locale] })}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setMiniBrowseDate((prev) => subMonths(prev, 1))}
              className="p-1 text-slate-400 hover:text-slate-800 dark:hover:text-white rounded-md hover:bg-slate-200/50 dark:hover:bg-neutral-800 transition cursor-pointer"
              aria-label="Previous Month mini calendar"
            >
              <ChevronLeft size={14} strokeWidth={2.5} />
            </button>
            <button
              onClick={() => setMiniBrowseDate((prev) => addMonths(prev, 1))}
              className="p-1 text-slate-400 hover:text-slate-800 dark:hover:text-white rounded-md hover:bg-slate-200/50 dark:hover:bg-neutral-800 transition cursor-pointer"
              aria-label="Next Month mini calendar"
            >
              <ChevronRight size={14} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {/* Days Column Header Grid */}
        <div className="grid grid-cols-7 gap-y-1.5 text-center text-[10px] font-extrabold text-slate-400 dark:text-neutral-500 uppercase tracking-wider font-mono">
          {dayAbbrs[settings.locale].map((abbr, idx) => (
            <div key={idx}>{abbr}</div>
          ))}
        </div>

        {/* Day numbers body element */}
        <div className="grid grid-cols-7 gap-y-1 text-center text-xs font-medium text-slate-600 dark:text-neutral-300">
          {miniDays.map((md, idx) => {
            const isTodayDay = isToday(md.date);

            let textClass =
              "text-slate-600 dark:text-neutral-350 hover:bg-slate-200/55 dark:hover:bg-neutral-800";
            if (!md.currentMonth) {
              textClass = "text-slate-300 dark:text-neutral-600";
            }

            return (
              <div
                key={idx}
                onClick={() => onNavigateDate && onNavigateDate(md.date)}
                className={`h-6 w-6 flex items-center justify-center mx-auto rounded-full cursor-pointer transition duration-150 ${textClass} ${
                  isTodayDay
                    ? "bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow-sm"
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
        <h3 className="text-[10px] font-extrabold text-slate-400 dark:text-neutral-500 uppercase tracking-widest font-mono">
          {label.filters}
        </h3>
        <div className="space-y-2.5">
          {categories.map((cat) => {
            const isSelected = settings.visibleCategories[cat.key];
            return (
              <label
                key={cat.key}
                onClick={() => handleCategoryToggle(cat.key)}
                className="flex items-center gap-3 text-xs text-slate-600 dark:text-neutral-300 cursor-pointer p-1.5 rounded-lg hover:bg-slate-100/50 dark:hover:bg-neutral-800/40 transition duration-150"
              >
                <div
                  className={`w-4 h-4 rounded border flex items-center justify-center transition duration-150 ${
                    isSelected
                      ? `${cat.bg} border-transparent text-white`
                      : "border-slate-300 dark:border-neutral-700 bg-transparent"
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
                <span className="font-semibold text-slate-700 dark:text-neutral-250">
                  {cat.labelText}
                </span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Unscheduled Task Pool */}
      {settings.showTaskPool && (
        <div className="flex-1 space-y-4 flex flex-col border-t border-slate-200/50 dark:border-neutral-800 pt-5 text-left">
          <div className="flex items-center justify-between shrink-0">
            <h3 className="text-[10px] font-extrabold text-slate-400 dark:text-neutral-500 uppercase tracking-widest font-mono text-left">
              {label.taskPool}
            </h3>
            <span className="bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-extrabold px-2 py-0.5 rounded-full text-[10px]">
              {unscheduledTasks.length}
            </span>
          </div>

          <div className="space-y-2.5 overflow-y-auto max-h-56 lg:max-h-none flex-1 pr-1 scrollbar-thin">
            {unscheduledTasks.length === 0 ? (
              <div className="py-6 text-center text-[11px] text-slate-400 dark:text-neutral-500 border border-dashed border-slate-200 dark:border-neutral-800 rounded-lg bg-white/40 dark:bg-transparent">
                {label.allTasksScheduled || "All tasks scheduled"}
              </div>
            ) : (
              unscheduledTasks.map((task) => (
                <div
                  key={task.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, task.id)}
                  onDragEnd={() => onDragTaskEnd?.()}
                  className="p-3 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-800 rounded-lg shadow-xs hover:border-indigo-300 dark:hover:border-neutral-700 hover:shadow-xs transition duration-200 cursor-pointer active:cursor-grabbing group"
                >
                  <div className="flex justify-between items-start mb-1 gap-2">
                    <span className="text-[11px] font-bold text-slate-800 dark:text-white line-clamp-1 group-hover:text-indigo-600 transition-colors">
                      {task.title}
                    </span>
                    <span className="text-[9px] bg-slate-50 dark:bg-neutral-800 text-slate-500 dark:text-neutral-400 px-1.5 py-0.5 rounded border border-slate-100 dark:border-neutral-700/60 font-mono font-semibold shrink-0">
                      {task.estimatedDurationMinutes}m
                    </span>
                  </div>
                  {task.description && (
                    <p className="text-[9.5px] text-slate-400 dark:text-neutral-450 line-clamp-1 leading-normal mb-1">
                      {task.description}
                    </p>
                  )}
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                    <span className="text-[8.5px] text-slate-400 uppercase tracking-tighter font-extrabold font-mono dark:text-neutral-500">
                      {getCategoryLabel(task.category)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Options Panel section */}
      <div className="pt-4 border-t border-slate-200/50 dark:border-neutral-800 space-y-2.5">
        <h3 className="text-[10px] font-extrabold text-slate-400 dark:text-neutral-500 uppercase tracking-widest font-mono">
          {label.optionsTitle || "Calendar Options"}
        </h3>
        <div className="space-y-2 text-xs">
          <label className="flex items-center justify-between cursor-pointer text-slate-600 dark:text-neutral-300">
            <span>{label.weekends || "Show Weekends"}</span>
            <input
              type="checkbox"
              checked={settings.showWeekends}
              onChange={(e) => onUpdateSettings({ showWeekends: e.target.checked })}
              className="accent-indigo-600 w-3.5 h-3.5 cursor-pointer"
            />
          </label>
          <label className="flex items-center justify-between cursor-pointer text-slate-600 dark:text-neutral-300">
            <span>{label.showLunch || "Show Background Events"}</span>
            <input
              type="checkbox"
              checked={settings.showBackgroundEvents}
              onChange={(e) => onUpdateSettings({ showBackgroundEvents: e.target.checked })}
              className="accent-indigo-600 w-3.5 h-3.5 cursor-pointer"
            />
          </label>
        </div>
      </div>

      {/* Language / Theme / Settings Configuration drawer pop-up area */}
      <div className="pt-4 border-t border-slate-200/50 dark:border-neutral-800 space-y-3">
        <label className="block text-[9px] font-bold text-slate-400 dark:text-neutral-500 uppercase tracking-wider font-mono mb-1">
          {label.configTitle || "System Config"}
        </label>

        <div className="space-y-3.5">
          {/* Theme & Locale Row */}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1 select-none">
              <span className="text-[10px] text-slate-500 dark:text-neutral-400 font-medium">
                {label.localeLabel || "Locale"}
              </span>
              <select
                value={settings.locale}
                onChange={handleLocaleChange}
                className="w-full text-[10px] bg-white dark:bg-neutral-800 cursor-pointer text-slate-700 dark:text-neutral-200 border border-slate-200 dark:border-neutral-700 rounded-md p-1.5 outline-none font-semibold"
                id="select-locale"
              >
                <option value="en">English (EN)</option>
                <option value="pl">Polski (PL)</option>
                <option value="de">Deutsch (DE)</option>
              </select>
            </div>

            <div className="flex flex-col gap-1 select-none">
              <span className="text-[10px] text-slate-500 dark:text-neutral-400 font-medium">
                {label.theme || "Theme"}
              </span>
              <select
                value={settings.theme}
                onChange={(e) => handleThemeChange(e.target.value as SchedulerTheme)}
                className="w-full text-[10px] bg-white dark:bg-neutral-800 cursor-pointer text-slate-700 dark:text-neutral-200 border border-slate-200 dark:border-neutral-700 rounded-md p-1.5 outline-none font-semibold"
                id="select-theme"
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="system">System</option>
              </select>
            </div>
          </div>

          {/* Timezone & Clock format Row */}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1 select-none">
              <span className="text-[10px] text-slate-500 dark:text-neutral-400 font-medium">
                {label.timeFormatLabel || "Time Format"}
              </span>
              <select
                value={settings.timeFormat || "12h"}
                onChange={(e) => onUpdateSettings({ timeFormat: e.target.value as "12h" | "24h" })}
                className="w-full text-[10px] bg-white dark:bg-neutral-800 cursor-pointer text-slate-700 dark:text-neutral-200 border border-slate-200 dark:border-neutral-700 rounded-md p-1.5 outline-none font-semibold"
                id="select-timeformat"
              >
                <option value="12h">12-hour (12h)</option>
                <option value="24h">24-hour (24h)</option>
              </select>
            </div>

            <div className="flex flex-col gap-1 select-none">
              <span className="text-[10px] text-slate-500 dark:text-neutral-400 font-medium">
                {label.timeZoneLabel || "Time Zone"}
              </span>
              <select
                value={settings.timezone}
                onChange={handleTimezoneChange}
                className="w-full text-[10px] bg-white dark:bg-neutral-800 cursor-pointer text-slate-700 dark:text-neutral-200 border border-slate-200 dark:border-neutral-700 rounded-md p-1.5 outline-none font-semibold truncate"
                id="select-timezone"
              >
                <option value="Local">Local</option>
                <option value="UTC">UTC</option>
                <option value="Europe/Warsaw">Warsaw</option>
                <option value="Europe/Berlin">Berlin</option>
                <option value="America/New_York">New York</option>
              </select>
            </div>
          </div>
        </div>

        {/* Global info and timezone footer details */}
        <div className="flex items-center justify-between text-[9px] text-slate-400 dark:text-neutral-500 font-mono pt-2">
          <span className="truncate max-w-[150px]" title={settings.timezone}>
            {settings.timezone}
          </span>
          <span className="font-extrabold uppercase">
            {settings.locale} / {settings.timeFormat}
          </span>
        </div>
      </div>
    </aside>
  );
};
