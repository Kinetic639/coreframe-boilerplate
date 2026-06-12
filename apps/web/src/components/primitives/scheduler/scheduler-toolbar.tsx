"use client";

import React from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import {
  CalendarView,
  SchedulerLocale,
  SchedulerTimezone,
  SchedulerSettings,
} from "./scheduler-types";
import { formatDateRangeTitle, LABELS_MAP } from "./scheduler-utils";

interface SchedulerToolbarProps {
  currentDate: Date;
  view: CalendarView;
  locale: SchedulerLocale;
  timezone: SchedulerTimezone;
  mode: "calendar" | "planner";
  dayStartHour: number;
  dayEndHour: number;
  autoTimeScale: boolean;
  showWeekends: boolean;
  showBackgroundEvents: boolean;
  isSidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  onUpdateSettings: (settings: Partial<SchedulerSettings>) => void;
  onNavigate: (direction: "prev" | "next" | "today") => void;
  onViewChange: (view: CalendarView) => void;
  onCreateEventClick: () => void;
}

export const SchedulerToolbar: React.FC<SchedulerToolbarProps> = ({
  currentDate,
  view,
  locale,
  timezone,
  mode,
  dayStartHour,
  dayEndHour,
  autoTimeScale,
  showWeekends,
  showBackgroundEvents,
  isSidebarCollapsed,
  onToggleSidebar,
  onUpdateSettings,
  onNavigate,
  onViewChange,
  onCreateEventClick,
}) => {
  const label = LABELS_MAP[locale];

  // Format the title correctly depending on active view mode
  const title = formatDateRangeTitle(currentDate, view, locale, timezone);

  const displayCalendarViews: CalendarView[] = ["year", "month", "week", "day", "list"];

  return (
    <header className="bg-card border-border flex shrink-0 flex-col border-b transition-colors duration-200">
      {/* Prime Level Toolbar Row */}
      <div className="flex w-full flex-wrap items-center justify-between gap-3 p-3 sm:px-5 sm:py-3">
        {/* 1. Date Navigation & Title */}
        <div className="flex items-center gap-3 md:gap-4 flex-wrap">
          {/* Sidebar Toggle Button (Inline on desktop to match side layout) */}
          <button
            onClick={onToggleSidebar}
            title={isSidebarCollapsed ? "Show Sidebar" : "Hide Sidebar"}
            className="text-muted-foreground hover:bg-muted hover:text-foreground hidden shrink-0 cursor-pointer items-center justify-center rounded-md border p-1.5 transition lg:flex"
            id="btn-toggle-sidebar"
          >
            {isSidebarCollapsed ? (
              <svg
                className="w-4.5 h-4.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 3v18M13 9l3 3-3 3" />
              </svg>
            ) : (
              <svg
                className="w-4.5 h-4.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 3v18M11 15l-3-3 3-3" />
              </svg>
            )}
          </button>

          <div className="bg-muted/40 flex shrink-0 items-center gap-1 rounded-md border p-1">
            <button
              onClick={() => onNavigate("today")}
              className="text-foreground hover:bg-background cursor-pointer rounded px-2.5 py-1 text-xs font-medium transition-all"
              id="btn-today"
            >
              {label.today}
            </button>

            <div className="bg-border mx-0.5 h-4 w-px"></div>

            <button
              onClick={() => onNavigate("prev")}
              className="text-muted-foreground hover:bg-background hover:text-foreground cursor-pointer rounded p-1 transition-all"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => onNavigate("next")}
              className="text-muted-foreground hover:bg-background hover:text-foreground cursor-pointer rounded p-1 transition-all"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <h2 className="text-foreground min-w-[120px] whitespace-nowrap font-sans text-[14px] font-semibold leading-none tracking-tight sm:text-base md:text-lg">
            {title}
          </h2>
        </div>

        {/* 2. Workspace & Views & Actions */}
        <div className="flex flex-1 flex-wrap items-center justify-end gap-2 sm:gap-3">
          {/* View Switcher */}
          {mode === "calendar" && (
            <div className="bg-muted/40 flex shrink-0 rounded-md border p-1 font-sans">
              {displayCalendarViews.map((v) => (
                <button
                  key={v}
                  onClick={() => onViewChange(v)}
                  className={`cursor-pointer rounded px-2 py-1.5 text-[11px] font-semibold transition-all duration-150 sm:px-3 sm:text-xs ${
                    view === v
                      ? "bg-background text-foreground border shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label[v]}
                </button>
              ))}
            </div>
          )}

          {/* Create Event CTA */}
          <button
            onClick={onCreateEventClick}
            className="bg-primary text-primary-foreground hover:bg-primary/90 flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold shadow-xs transition-all sm:px-4"
            id="btn-create-event-top"
          >
            <Plus size={15} />
            <span className="hidden sm:inline">{label.createEvent}</span>
            <span className="sm:hidden">New</span>
          </button>
        </div>
      </div>

      {/* Secondary Tools and Layout Options Ribbon */}
      <div className="bg-muted/20 border-border flex shrink-0 select-none flex-wrap items-center justify-between gap-3 border-t px-3 py-2 font-sans text-xs sm:px-5">
        {/* Left Side: Layout & Display Toggles */}
        <div className="flex items-center gap-4 flex-wrap">
          {/* Weekends Toggle */}
          <label className="text-muted-foreground hover:text-foreground flex cursor-pointer items-center gap-2 transition-colors">
            <input
              type="checkbox"
              checked={showWeekends}
              onChange={(e) => onUpdateSettings({ showWeekends: e.target.checked })}
              className="accent-primary h-3.5 w-3.5 cursor-pointer rounded"
            />
            <span className="text-[11px] font-semibold">{label.weekends || "Show Weekends"}</span>
          </label>

          {/* Background events/Lunch Toggle */}
          <label className="text-muted-foreground hover:text-foreground flex cursor-pointer items-center gap-2 transition-colors">
            <input
              type="checkbox"
              checked={showBackgroundEvents}
              onChange={(e) => onUpdateSettings({ showBackgroundEvents: e.target.checked })}
              className="accent-primary h-3.5 w-3.5 cursor-pointer rounded"
            />
            <span className="text-[11px] font-semibold">
              {label.showLunch || "Show Background Events"}
            </span>
          </label>
        </div>

        {/* Right Side: Hour constraints (Rendered on appropriate views) */}
        {(view === "day" || view === "week" || view === "timeline") && (
          <div className="flex items-center gap-2">
            <div className="bg-muted/40 flex shrink-0 items-center gap-1.5 rounded-md border p-0.5">
              <span className="text-muted-foreground select-none px-1.5 py-0.5 font-sans text-[11px] font-semibold">
                Hours
              </span>
              <button
                onClick={() => onUpdateSettings({ autoTimeScale: !autoTimeScale })}
                className={`px-2 py-0.5 text-[11px] font-semibold rounded-md transition-all cursor-pointer ${
                  autoTimeScale
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:bg-background hover:text-foreground"
                }`}
              >
                Auto
              </button>

              {!autoTimeScale && (
                <div className="border-border flex items-center gap-0.5 border-l pl-1">
                  <select
                    value={dayStartHour}
                    onChange={(e) =>
                      onUpdateSettings({ dayStartHour: parseInt(e.target.value, 10) })
                    }
                    className="text-foreground max-w-[64px] cursor-pointer bg-transparent p-0.5 text-[11px] font-semibold outline-none"
                  >
                    {Array.from({ length: 24 }).map((_, i) => (
                      <option key={`start-${i}`} value={i} disabled={i >= dayEndHour}>
                        {`${i}:00`}
                      </option>
                    ))}
                  </select>
                  <div className="text-muted-foreground mx-px text-[10px]">-</div>
                  <select
                    value={dayEndHour}
                    onChange={(e) => onUpdateSettings({ dayEndHour: parseInt(e.target.value, 10) })}
                    className="text-foreground max-w-[64px] cursor-pointer bg-transparent p-0.5 text-[11px] font-semibold outline-none"
                  >
                    {Array.from({ length: 24 }).map((_, i) => {
                      const val = i + 1;
                      return (
                        <option key={`end-${val}`} value={val} disabled={val <= dayStartHour}>
                          {val < 24 ? `${val}:00` : "24:00"}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
