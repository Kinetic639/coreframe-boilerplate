"use client";

import React, { useState } from "react";
import { ChevronLeft, ChevronRight, Settings } from "lucide-react";
import {
  CalendarView,
  SchedulerLocale,
  SchedulerTimezone,
  SchedulerTheme,
  SchedulerSettings,
} from "./scheduler-types";
import { formatDateRangeTitle, LABELS_MAP } from "./scheduler-utils";

interface SchedulerToolbarProps {
  currentDate: Date;
  view: CalendarView;
  settings: SchedulerSettings;
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
}

export const SchedulerToolbar: React.FC<SchedulerToolbarProps> = ({
  currentDate,
  view,
  settings,
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
}) => {
  const label = LABELS_MAP[locale];

  // Format the title correctly depending on active view mode
  const title = formatDateRangeTitle(currentDate, view, locale, timezone);

  const displayCalendarViews: CalendarView[] = ["year", "month", "week", "day", "list"];

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const handleThemeChange = (theme: SchedulerTheme) => {
    onUpdateSettings({ theme });
  };

  const handleLocaleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onUpdateSettings({ locale: e.target.value as SchedulerLocale });
  };

  const handleTimezoneChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onUpdateSettings({ timezone: e.target.value as SchedulerTimezone });
  };

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

          {/* Settings dropdown */}
          <div className="relative shrink-0">
            <button
              onClick={() => setIsSettingsOpen((prev) => !prev)}
              title={label.configTitle || "System Config"}
              aria-label={label.configTitle || "System Config"}
              className={`flex cursor-pointer items-center justify-center rounded-md border p-2 transition ${
                isSettingsOpen
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
              id="btn-toolbar-settings"
            >
              <Settings size={15} />
            </button>

            {isSettingsOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsSettingsOpen(false)} />
                <div
                  className="bg-card border-border absolute right-0 top-full z-50 mt-2 w-72 space-y-3.5 rounded-lg border p-4 shadow-lg"
                  id="toolbar-settings-dropdown"
                >
                  <label className="block text-[9px] font-bold text-muted-foreground uppercase tracking-wider font-mono mb-1">
                    {label.configTitle || "System Config"}
                  </label>

                  <div className="space-y-3.5">
                    {/* Theme & Locale Row */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col gap-1 select-none">
                        <span className="text-[10px] text-muted-foreground font-medium">
                          {label.localeLabel || "Locale"}
                        </span>
                        <select
                          value={settings.locale}
                          onChange={handleLocaleChange}
                          className="w-full text-[10px] bg-background cursor-pointer text-foreground border border-border rounded-md p-1.5 outline-none font-semibold"
                          id="select-locale"
                        >
                          <option value="en">English (EN)</option>
                          <option value="pl">Polski (PL)</option>
                          <option value="de">Deutsch (DE)</option>
                        </select>
                      </div>

                      <div className="flex flex-col gap-1 select-none">
                        <span className="text-[10px] text-muted-foreground font-medium">
                          {label.theme || "Theme"}
                        </span>
                        <select
                          value={settings.theme}
                          onChange={(e) => handleThemeChange(e.target.value as SchedulerTheme)}
                          className="w-full text-[10px] bg-background cursor-pointer text-foreground border border-border rounded-md p-1.5 outline-none font-semibold"
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
                        <span className="text-[10px] text-muted-foreground font-medium">
                          {label.timeFormatLabel || "Time Format"}
                        </span>
                        <select
                          value={settings.timeFormat || "12h"}
                          onChange={(e) =>
                            onUpdateSettings({ timeFormat: e.target.value as "12h" | "24h" })
                          }
                          className="w-full text-[10px] bg-background cursor-pointer text-foreground border border-border rounded-md p-1.5 outline-none font-semibold"
                          id="select-timeformat"
                        >
                          <option value="12h">12-hour (12h)</option>
                          <option value="24h">24-hour (24h)</option>
                        </select>
                      </div>

                      <div className="flex flex-col gap-1 select-none">
                        <span className="text-[10px] text-muted-foreground font-medium">
                          {label.timeZoneLabel || "Time Zone"}
                        </span>
                        <select
                          value={settings.timezone}
                          onChange={handleTimezoneChange}
                          className="w-full text-[10px] bg-background cursor-pointer text-foreground border border-border rounded-md p-1.5 outline-none font-semibold truncate"
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
                  <div className="flex items-center justify-between text-[9px] text-muted-foreground font-mono pt-2">
                    <span className="truncate max-w-[150px]" title={settings.timezone}>
                      {settings.timezone}
                    </span>
                    <span className="font-extrabold uppercase">
                      {settings.locale} / {settings.timeFormat}
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
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
