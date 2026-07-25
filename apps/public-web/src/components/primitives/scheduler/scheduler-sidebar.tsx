"use client";

import React, { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Search,
  Eye,
  EyeOff,
  RotateCcw,
  Plus,
  X,
  Check,
  MoreVertical,
  Pipette,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SchedulerSettings,
  EventCategory,
  UnscheduledTask,
  CalendarEvent,
  CalendarSource,
  SchedulerLocale,
} from "./scheduler-types";
import { LABELS_MAP, LOCALE_MAP } from "./scheduler-utils";
import { isToday, format, addMonths, subMonths, startOfDay } from "date-fns";

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
  onCalendarSourceSettingsChange?: (
    sourceId: string,
    settings: { color?: string | null; visible?: boolean | null; position?: number | null }
  ) => void;
  onCreateCalendar?: (name: string) => void;
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
  onCalendarSourceSettingsChange,
  onCreateCalendar,
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
  const [isCreateCalendarOpen, setIsCreateCalendarOpen] = useState(false);
  const [calendarName, setCalendarName] = useState("");
  const [settingsSourceId, setSettingsSourceId] = useState<string | null>(null);
  const [customColor, setCustomColor] = useState("#6366f1");
  const [openCalendarSections, setOpenCalendarSections] = useState<Record<string, boolean>>({
    system: true,
    kanban: true,
    custom: true,
  });

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
    const nextVisible = !isSourceVisible(sourceId);
    const updated = {
      ...(settings.visibleCalendarSources ?? {}),
      [sourceId]: nextVisible,
    };
    onUpdateSettings({ visibleCalendarSources: updated });
    onCalendarSourceSettingsChange?.(sourceId, { visible: nextVisible });
  };

  const setCalendarSectionVisibility = (sources: CalendarSource[], visible: boolean) => {
    if (!sources.length) return;
    const updated = { ...(settings.visibleCalendarSources ?? {}) };
    for (const source of sources) {
      updated[source.id] = visible;
      onCalendarSourceSettingsChange?.(source.id, { visible });
    }
    onUpdateSettings({ visibleCalendarSources: updated });
  };

  const getSourceForTask = (task: UnscheduledTask) =>
    calendarSources?.find((source) => source.id === task.calendarSourceId);

  const visibleUnscheduledTasks = unscheduledTasks.filter((task) =>
    calendarSources
      ? isSourceVisible(task.calendarSourceId ?? "")
      : settings.visibleCategories[task.category]
  );

  const colorPresets = [
    "#d81b60",
    "#e67c73",
    "#f4511e",
    "#f6bf26",
    "#33b679",
    "#0b8043",
    "#039be5",
    "#3f51b5",
    "#7986cb",
    "#8e24aa",
    "#616161",
    "#795548",
    "#ef4444",
    "#fb923c",
    "#eab308",
    "#84cc16",
    "#14b8a6",
    "#06b6d4",
    "#6366f1",
    "#a855f7",
    "#ec4899",
    "#94a3b8",
    "#64748b",
    "#1f2937",
  ];
  const settingsSource = calendarSources?.find((source) => source.id === settingsSourceId);
  const getReadableColor = (color: string) => {
    const match = /^#?([0-9a-f]{6})$/i.exec(color);
    if (!match) return "hsl(var(--foreground))";
    const value = match[1];
    const red = parseInt(value.slice(0, 2), 16);
    const green = parseInt(value.slice(2, 4), 16);
    const blue = parseInt(value.slice(4, 6), 16);
    const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;
    return luminance > 0.58 ? "#111827" : "#ffffff";
  };

  const normalizeHexColor = (value: string) => {
    const trimmed = value.trim();
    const prefixed = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
    return /^#[0-9a-f]{6}$/i.test(prefixed) ? prefixed.toLowerCase() : null;
  };

  const handleShowOnlySource = (sourceId: string) => {
    if (!calendarSources?.length) return;
    const updated = { ...(settings.visibleCalendarSources ?? {}) };
    for (const source of calendarSources) {
      const visible = source.id === sourceId;
      updated[source.id] = visible;
      onCalendarSourceSettingsChange?.(source.id, { visible });
    }
    onUpdateSettings({ visibleCalendarSources: updated });
  };

  const openCustomColorDialog = (source: CalendarSource) => {
    setCustomColor(source.color ?? source.defaultColor ?? "#6366f1");
    setSettingsSourceId(source.id);
  };

  const calendarSections = calendarSources
    ? [
        {
          id: "system",
          label: label.systemCalendars,
          sources: calendarSources.filter(
            (source) =>
              source.sourceType !== "kanban_board" &&
              source.sourceType !== "native_calendar" &&
              source.kind !== "native"
          ),
        },
        {
          id: "kanban",
          label: label.kanbanCalendars,
          sources: calendarSources.filter((source) => source.sourceType === "kanban_board"),
        },
        {
          id: "custom",
          label: label.customCalendars,
          sources: calendarSources.filter(
            (source) => source.sourceType === "native_calendar" || source.kind === "native"
          ),
        },
      ].filter(
        (section) => section.sources.length > 0 || (section.id === "custom" && onCreateCalendar)
      )
    : [];

  const shouldShowNoDueDatePool =
    settings.showTaskPool ||
    Boolean(calendarSources && (unscheduledTasks.length > 0 || onUnscheduledSearchChange));

  const handleCreateCalendar = () => {
    const trimmed = calendarName.trim();
    if (!trimmed) return;
    onCreateCalendar?.(trimmed);
    setCalendarName("");
    setIsCreateCalendarOpen(false);
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
              ? calendarSections.map((section) => {
                  const isOpen = openCalendarSections[section.id] !== false;
                  const allVisible = section.sources.every((source) => isSourceVisible(source.id));
                  const visibleCount = section.sources.filter((source) =>
                    isSourceVisible(source.id)
                  ).length;

                  return (
                    <div key={section.id} className="space-y-1.5">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            setOpenCalendarSections((current) => ({
                              ...current,
                              [section.id]: !isOpen,
                            }))
                          }
                          className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 text-left text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground transition hover:text-foreground"
                        >
                          <ChevronDown
                            size={12}
                            className={`shrink-0 transition-transform ${
                              isOpen ? "" : "-rotate-90"
                            }`}
                          />
                          <span className="truncate">{section.label}</span>
                          <span className="font-mono text-[9px] normal-case tracking-normal">
                            {visibleCount}/{section.sources.length}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setCalendarSectionVisibility(section.sources, !allVisible)}
                          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
                          aria-label={allVisible ? label.hideAll : label.showAll}
                        >
                          {allVisible ? (
                            <Eye size={12} strokeWidth={2.4} />
                          ) : (
                            <EyeOff size={12} strokeWidth={2.4} />
                          )}
                        </button>
                      </div>

                      {isOpen && (
                        <div className="space-y-1">
                          {section.sources.map((source) => {
                            const isSelected = isSourceVisible(source.id);
                            const sourceColor = source.color ?? source.defaultColor ?? "#6366f1";
                            const count =
                              events.filter((ev) => ev.calendarSourceId === source.id).length +
                              unscheduledTasks.filter((task) => task.calendarSourceId === source.id)
                                .length;
                            const checkboxTextColor = getReadableColor(sourceColor);

                            return (
                              <div
                                key={source.id}
                                className="group flex h-8 items-center gap-2 rounded-full px-1.5 text-xs text-foreground transition duration-150 hover:bg-muted/70"
                              >
                                <button
                                  type="button"
                                  onClick={() => handleCalendarSourceToggle(source.id)}
                                  className="flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-[5px] border-2 transition duration-150"
                                  style={{
                                    backgroundColor: isSelected ? sourceColor : "hsl(var(--muted))",
                                    borderColor: isSelected ? sourceColor : "transparent",
                                    color: isSelected ? checkboxTextColor : "transparent",
                                    opacity: isSelected ? 1 : 0.65,
                                  }}
                                  aria-label={
                                    isSelected
                                      ? `${source.label}: ${label.hideAll}`
                                      : `${source.label}: ${label.showAll}`
                                  }
                                >
                                  {isSelected && <Check size={14} strokeWidth={3} />}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleCalendarSourceToggle(source.id)}
                                  className={`min-w-0 flex-1 cursor-pointer truncate text-left text-[13px] font-medium transition ${
                                    isSelected ? "text-foreground" : "text-muted-foreground"
                                  }`}
                                  title={source.label}
                                >
                                  {source.label}
                                </button>
                                <span className="shrink-0 rounded-full px-1.5 py-0.5 font-mono text-[9px] font-semibold text-muted-foreground">
                                  {count}
                                </span>
                                {onCalendarSourceSettingsChange && (
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <button
                                        type="button"
                                        className="inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground opacity-0 transition hover:bg-muted hover:text-foreground group-hover:opacity-100 data-[state=open]:bg-muted data-[state=open]:opacity-100"
                                        aria-label={`${label.calendarSettings}: ${source.label}`}
                                      >
                                        <MoreVertical size={16} strokeWidth={2.3} />
                                      </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-64 p-2">
                                      <DropdownMenuItem
                                        className="cursor-pointer text-[13px]"
                                        onSelect={() => handleShowOnlySource(source.id)}
                                      >
                                        {label.showOnlyThis}
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        className="cursor-pointer text-[13px]"
                                        onSelect={() => openCustomColorDialog(source)}
                                      >
                                        {label.settingsAndSharing}
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <div className="grid grid-cols-6 gap-2 p-2">
                                        {colorPresets.map((color) => {
                                          const isActive =
                                            (source.color ?? source.defaultColor) === color;
                                          return (
                                            <button
                                              key={color}
                                              type="button"
                                              onClick={() =>
                                                onCalendarSourceSettingsChange?.(source.id, {
                                                  color,
                                                })
                                              }
                                              className={`flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border transition hover:scale-105 ${
                                                isActive
                                                  ? "border-foreground"
                                                  : "border-transparent"
                                              }`}
                                              style={{ backgroundColor: color }}
                                              aria-label={`${source.label} ${label.calendarColor} ${color}`}
                                            >
                                              {isActive && (
                                                <Check
                                                  size={14}
                                                  strokeWidth={3}
                                                  style={{ color: getReadableColor(color) }}
                                                />
                                              )}
                                            </button>
                                          );
                                        })}
                                        <button
                                          type="button"
                                          onClick={() => openCustomColorDialog(source)}
                                          className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border border-border bg-muted text-muted-foreground transition hover:bg-muted/70 hover:text-foreground"
                                          aria-label={label.chooseCustomColor}
                                        >
                                          <Plus size={14} strokeWidth={2.5} />
                                        </button>
                                      </div>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        className="cursor-pointer text-[13px]"
                                        onSelect={() =>
                                          onCalendarSourceSettingsChange?.(source.id, {
                                            color: null,
                                          })
                                        }
                                      >
                                        <RotateCcw size={14} />
                                        {label.resetColor}
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                )}
                              </div>
                            );
                          })}
                          {section.id === "custom" && onCreateCalendar && (
                            <div className="pt-1">
                              {isCreateCalendarOpen ? (
                                <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-2">
                                  <input
                                    value={calendarName}
                                    onChange={(event) => setCalendarName(event.target.value)}
                                    onKeyDown={(event) => {
                                      if (event.key === "Enter") handleCreateCalendar();
                                      if (event.key === "Escape") setIsCreateCalendarOpen(false);
                                    }}
                                    placeholder={label.calendarNamePlaceholder}
                                    className="h-8 w-full rounded-md border border-border bg-background px-2 text-[11px] font-medium text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary/60"
                                  />
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={handleCreateCalendar}
                                      className="inline-flex h-7 flex-1 items-center justify-center rounded-md bg-primary px-2 text-[10px] font-bold text-primary-foreground transition hover:bg-primary/90"
                                    >
                                      {label.createCalendar}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setCalendarName("");
                                        setIsCreateCalendarOpen(false);
                                      }}
                                      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground transition hover:text-foreground"
                                      aria-label={label.cancel}
                                    >
                                      <X size={12} />
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setIsCreateCalendarOpen(true)}
                                  className="inline-flex h-8 w-full items-center justify-center gap-2 rounded-md border border-dashed border-border text-[11px] font-bold text-muted-foreground transition hover:border-primary/50 hover:text-foreground"
                                >
                                  <Plus size={13} />
                                  {label.addCalendar}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
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

      <Dialog
        open={Boolean(settingsSource)}
        onOpenChange={(open) => !open && setSettingsSourceId(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{label.chooseCustomColor}</DialogTitle>
          </DialogHeader>
          {settingsSource && (
            <div className="space-y-5">
              <p className="text-sm leading-relaxed text-muted-foreground">
                {label.chooseCustomColorDescription}
              </p>

              <div className="flex items-center gap-4">
                <div
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-2xl font-semibold"
                  style={{
                    backgroundColor: customColor,
                    color: getReadableColor(customColor),
                  }}
                >
                  {settingsSource.label.charAt(0).toUpperCase()}
                </div>
                <label className="flex h-14 w-14 cursor-pointer items-center justify-center rounded-full border-2 border-primary/70 bg-muted text-muted-foreground shadow-sm transition hover:bg-muted/70">
                  <input
                    type="color"
                    value={normalizeHexColor(customColor) ?? "#6366f1"}
                    onChange={(event) => setCustomColor(event.target.value)}
                    className="sr-only"
                    aria-label={label.chooseCustomColor}
                  />
                  <Pipette size={22} strokeWidth={2.2} />
                </label>
              </div>

              <div className="grid grid-cols-6 gap-2">
                {colorPresets.slice(0, 12).map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setCustomColor(color)}
                    className={`flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border transition hover:scale-105 ${
                      customColor.toLowerCase() === color.toLowerCase()
                        ? "border-foreground"
                        : "border-transparent"
                    }`}
                    style={{ backgroundColor: color }}
                    aria-label={`${label.calendarColor} ${color}`}
                  >
                    {customColor.toLowerCase() === color.toLowerCase() && (
                      <Check size={15} strokeWidth={3} style={{ color: getReadableColor(color) }} />
                    )}
                  </button>
                ))}
              </div>

              <label className="block space-y-1">
                <span className="text-xs font-medium text-muted-foreground">{label.hexCode}</span>
                <input
                  value={customColor}
                  onChange={(event) => setCustomColor(event.target.value)}
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm font-medium text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary/60"
                  placeholder="#668BE1"
                />
              </label>

              <div className="flex justify-between gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() =>
                    onCalendarSourceSettingsChange?.(settingsSource.id, { color: null })
                  }
                >
                  <RotateCcw size={14} />
                  {label.resetColor}
                </Button>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSettingsSourceId(null)}
                  >
                    {label.cancel}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      const normalizedColor = normalizeHexColor(customColor);
                      if (!normalizedColor) return;
                      onCalendarSourceSettingsChange?.(settingsSource.id, {
                        color: normalizedColor,
                      });
                      setSettingsSourceId(null);
                    }}
                  >
                    {label.save}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Unscheduled Task Pool */}
      {shouldShowNoDueDatePool && (
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
                {visibleUnscheduledTasks.length}
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
              {visibleUnscheduledTasks.length === 0 ? (
                <div className="py-6 text-center text-[11px] text-muted-foreground border border-dashed border-border rounded-lg bg-muted/40">
                  {label.allTasksScheduled || "All tasks scheduled"}
                </div>
              ) : (
                visibleUnscheduledTasks.map((task) => (
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
