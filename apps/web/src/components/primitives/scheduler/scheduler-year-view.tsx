"use client";

import React from "react";
import { format, isSameMonth, isToday, isSameDay, startOfDay } from "date-fns";
import {
  CalendarEvent,
  BackgroundEvent,
  UnscheduledTask,
  SchedulerLocale,
  SchedulerTimezone,
} from "./scheduler-types";
import { getMonthGridDays, formatInTimezone, LABELS_MAP } from "./scheduler-utils";
import { getEventStyles } from "./scheduler-month-view";

interface SchedulerYearViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  backgroundEvents: BackgroundEvent[];
  showWeekends: boolean;
  showBackgroundEvents: boolean;
  locale: SchedulerLocale;
  timezone: SchedulerTimezone;
  timeFormat: "12h" | "24h";
  draggedTask?: UnscheduledTask | null;
  onSelectEvent: (event: CalendarEvent) => void;
  onCellClick: (date: Date, keepExactTime?: boolean, resourceId?: string, endDate?: Date) => void;
  onNavigateToDay?: (date: Date) => void;
  onNavigateToMonth?: (date: Date) => void;
  onMoveEvent: (eventId: string, newDate: Date) => void;
  onScheduleTask: (taskId: string, date: Date) => void;
}

export const SchedulerYearView: React.FC<SchedulerYearViewProps> = ({
  currentDate,
  events,
  backgroundEvents,
  showWeekends,
  showBackgroundEvents,
  locale,
  timezone,
  timeFormat,
  draggedTask,
  onSelectEvent,
  onCellClick,
  onNavigateToDay,
  onNavigateToMonth,
  onMoveEvent,
  onScheduleTask,
}) => {
  const label = LABELS_MAP[locale];
  const targetYear = currentDate.getFullYear();

  const [activeDragOverDay, setActiveDragOverDay] = React.useState<Date | null>(null);
  const [draggedEventId, setDraggedEventId] = React.useState<string | null>(null);
  const [openTooltipDay, setOpenTooltipDay] = React.useState<string | null>(null);

  // States for click & drag selection
  const [selectionStart, setSelectionStart] = React.useState<Date | null>(null);
  const [selectionEnd, setSelectionEnd] = React.useState<Date | null>(null);

  React.useEffect(() => {
    const handleGlobalClick = () => {
      setOpenTooltipDay(null);
    };
    window.addEventListener("click", handleGlobalClick);
    return () => {
      window.removeEventListener("click", handleGlobalClick);
    };
  }, []);

  // Effect to handle global mouse up for Year drag select
  React.useEffect(() => {
    if (!selectionStart) return;

    const handleGlobalMouseUp = () => {
      if (selectionStart && selectionEnd) {
        const sTime = startOfDay(selectionStart).getTime();
        const eTime = startOfDay(selectionEnd).getTime();
        const minDate = sTime < eTime ? selectionStart : selectionEnd;
        const maxDate = sTime < eTime ? selectionEnd : selectionStart;

        if (sTime === eTime) {
          onCellClick(minDate);
        } else {
          // Multi-day selection triggers starting at 09:00 AM on the first day to 18:00 PM on the last day
          const prefillStart = startOfDay(minDate);
          prefillStart.setHours(9, 0, 0, 0);

          const prefillEnd = startOfDay(maxDate);
          prefillEnd.setHours(18, 0, 0, 0);

          onCellClick(prefillStart, true, undefined, prefillEnd);
        }
      }
      setSelectionStart(null);
      setSelectionEnd(null);
    };

    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => {
      window.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, [selectionStart, selectionEnd, onCellClick]);

  // Filter events active inside target year
  const displayedEvents = React.useMemo(() => {
    const startOfYear = new Date(targetYear, 0, 1);
    const endOfYear = new Date(targetYear, 11, 31, 23, 59, 59);

    let active = events.filter((ev) => {
      const s = new Date(ev.start);
      return s >= startOfYear && s <= endOfYear;
    });

    if (draggedEventId) {
      const draggedObj = events.find((e) => e.id === draggedEventId);
      if (draggedObj && activeDragOverDay) {
        const diffMs = new Date(draggedObj.end).getTime() - new Date(draggedObj.start).getTime();
        const start = new Date(activeDragOverDay);
        start.setHours(
          new Date(draggedObj.start).getHours(),
          new Date(draggedObj.start).getMinutes()
        );
        const end = new Date(start.getTime() + diffMs);

        active = active.map((ev) =>
          ev.id === draggedEventId ? { ...ev, start, end, isProvisional: true } : ev
        );
      }
    }
    return active;
  }, [events, targetYear, draggedEventId, activeDragOverDay]);

  // Weekday column headings
  const baseWeekStartDate = new Date(2024, 0, 1);
  const weekDayHeadings = Array.from({ length: 7 }).map((_, i) => {
    const headingDay = new Date(baseWeekStartDate);
    headingDay.setDate(baseWeekStartDate.getDate() + i);
    return headingDay;
  });

  const filteredHeadings = showWeekends
    ? weekDayHeadings
    : weekDayHeadings.filter((d) => d.getDay() !== 0 && d.getDay() !== 6);

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent, cellDate: Date) => {
    e.preventDefault();
    if (draggedTask || draggedEventId) {
      if (!activeDragOverDay || activeDragOverDay.getTime() !== cellDate.getTime()) {
        setActiveDragOverDay(cellDate);
      }
    }
  };

  const handleDrop = (e: React.DragEvent, cellDate: Date) => {
    e.preventDefault();
    setActiveDragOverDay(null);
    setDraggedEventId(null);
    try {
      const rawData = e.dataTransfer.getData("text/plain");
      if (!rawData) return;

      const data = JSON.parse(rawData);
      if (data.type === "event" && data.id) {
        onMoveEvent(data.id, cellDate);
      } else if (data.type === "task" && data.id) {
        onScheduleTask(data.id, cellDate);
      }
    } catch (err) {
      // Ignored
    }
  };

  const handleDragEventStart = (e: React.DragEvent, eventId: string) => {
    e.dataTransfer.setData("text/plain", JSON.stringify({ type: "event", id: eventId }));
    e.dataTransfer.effectAllowed = "move";

    const img = new Image();
    img.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    e.dataTransfer.setDragImage(img, 0, 0);

    setDraggedEventId(eventId);
  };

  const handleDragEnd = () => {
    setActiveDragOverDay(null);
    setDraggedEventId(null);
  };

  // Build the 12 month descriptors
  const monthsData = React.useMemo(() => {
    return Array.from({ length: 12 }).map((_, i) => {
      const monthDate = new Date(targetYear, i, 1);
      const days = getMonthGridDays(monthDate, showWeekends);
      return {
        monthIndex: i,
        date: monthDate,
        days,
      };
    });
  }, [targetYear, showWeekends]);

  return (
    <div className="absolute inset-0 overflow-y-auto custom-scrollbar bg-slate-50/50 dark:bg-neutral-950/10 p-4 sm:p-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-[1100px] mx-auto pb-8">
        {monthsData.map(({ monthIndex, date: monthDate, days }) => {
          return (
            <div
              key={monthIndex}
              className="bg-white dark:bg-neutral-900 border border-slate-200/60 dark:border-neutral-800/80 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow duration-200 flex flex-col min-h-[380px]"
            >
              {/* Localized Month Name & Click Zoom action */}
              <button
                onClick={() => onNavigateToMonth?.(monthDate)}
                className="text-sm font-bold text-slate-800 dark:text-neutral-200 hover:text-indigo-600 dark:hover:text-indigo-400 transition cursor-pointer font-sans text-left mb-3 shrink-0 flex items-center justify-between"
              >
                <span>{formatInTimezone(monthDate, "MMMM", timezone, locale)}</span>
                <span className="text-[10px] bg-slate-100 hover:bg-slate-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 px-2 py-0.5 rounded-md text-slate-500 dark:text-neutral-400 transition ml-2 font-medium">
                  {label.month} view
                </span>
              </button>

              {/* Day Headers Column Grid */}
              <div
                className={`grid ${filteredHeadings.length === 5 ? "grid-cols-5" : "grid-cols-7"} border-b border-gray-100 dark:border-neutral-800/80 pb-1.5 shrink-0`}
              >
                {filteredHeadings.map((head, i) => (
                  <div
                    key={i}
                    className="text-center text-[9px] font-bold text-gray-400 dark:text-neutral-500 font-mono select-none uppercase tracking-wider"
                  >
                    {formatInTimezone(head, "EEE", timezone, locale).substring(0, 2)}
                  </div>
                ))}
              </div>

              {/* Day Cells Grid */}
              <div
                className={`grid ${filteredHeadings.length === 5 ? "grid-cols-5" : "grid-cols-7"} grid-rows-6 flex-1 min-h-[280px] mt-1`}
              >
                {days.map((day, idx) => {
                  const isCurrentMonth = isSameMonth(day, monthDate);
                  const isTodayDate = isToday(day);

                  // Filter active events
                  const cellEvents = displayedEvents.filter((ev) =>
                    isSameDay(new Date(ev.start), day)
                  );

                  // Extract background blocks details
                  const cellBgEvents = showBackgroundEvents
                    ? backgroundEvents.filter((bg) => {
                        const bgStart = new Date(bg.start);
                        return (
                          isSameDay(bgStart, day) &&
                          (bg.type === "closed" ||
                            bg.type === "holiday" ||
                            bg.type === "unavailable")
                        );
                      })
                    : [];

                  const hasBackgroundBlocked = cellBgEvents.length > 0;
                  const bgBlockLabel = cellBgEvents[0]?.title || "";

                  const isDragOver = activeDragOverDay && isSameDay(activeDragOverDay, day);

                  // Determine if this cell is part of the current click & drag selection
                  const sTime = selectionStart ? startOfDay(selectionStart).getTime() : null;
                  const eTime = selectionEnd ? startOfDay(selectionEnd).getTime() : null;
                  const isSelected =
                    sTime !== null &&
                    eTime !== null &&
                    (() => {
                      const minTime = Math.min(sTime, eTime);
                      const maxTime = Math.max(sTime, eTime);
                      const cellTime = startOfDay(day).getTime();
                      return cellTime >= minTime && cellTime <= maxTime;
                    })();

                  return (
                    <div
                      key={idx}
                      onDragOver={(e) => handleDragOver(e, day)}
                      onDrop={(e) => handleDrop(e, day)}
                      onMouseDown={(e) => {
                        if (e.button !== 0) return; // Only trigger for left-clicks
                        const isInteractive = (e.target as HTMLElement).closest("button");
                        if (!isInteractive) {
                          setSelectionStart(day);
                          setSelectionEnd(day);
                        }
                      }}
                      onMouseEnter={() => {
                        if (selectionStart) {
                          setSelectionEnd(day);
                        }
                      }}
                      className={`relative border-r border-b border-gray-50/50 dark:border-neutral-800/30 p-1 flex flex-col justify-between min-h-[46px] select-none cursor-pointer duration-100 ${
                        isSelected
                          ? "bg-indigo-50/70 dark:bg-indigo-950/30 shadow-[inset_0_0_0_1.5px_rgba(99,102,241,0.4)] dark:shadow-[inset_0_0_0_1.5px_rgba(129,140,248,0.4)] z-30"
                          : isCurrentMonth
                            ? "bg-transparent text-gray-800 dark:text-neutral-200"
                            : "bg-gray-50/20 dark:bg-neutral-950/10 text-gray-300 dark:text-neutral-700 opacity-40"
                      } ${
                        isDragOver
                          ? "bg-indigo-50 dark:bg-indigo-950/20 shadow-sm duration-0 scale-[0.98]"
                          : ""
                      } ${
                        hasBackgroundBlocked && showBackgroundEvents
                          ? "bg-rose-50/5 dark:bg-rose-950/5"
                          : ""
                      }`}
                      id={`year-cell-${monthIndex}-${format(day, "yyyy-MM-dd")}`}
                    >
                      {/* Day Number and Background Warning marker */}
                      <div className="flex items-center justify-between mb-0.5 pointer-events-none">
                        <span
                          className={`text-[9px] font-bold h-4 w-4 flex items-center justify-center rounded-full ${
                            isTodayDate
                              ? "bg-indigo-600 text-white font-extrabold shadow-3xs"
                              : isCurrentMonth
                                ? "text-gray-700 dark:text-neutral-300"
                                : "text-gray-300 dark:text-neutral-700"
                          }`}
                        >
                          {format(day, "d")}
                        </span>

                        {showBackgroundEvents && hasBackgroundBlocked && (
                          <span className="text-[8px] text-rose-500 font-bold" title={bgBlockLabel}>
                            ⚠
                          </span>
                        )}
                      </div>

                      {/* Display Count pill instead of individual events */}
                      <div className="flex flex-col gap-0.5 overflow-visible">
                        {cellEvents.length > 0 && (
                          <div className="relative w-full">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const dayStr = `${monthIndex}-${format(day, "yyyy-MM-dd")}`;
                                setOpenTooltipDay((prev) => (prev === dayStr ? null : dayStr));
                              }}
                              className="w-full text-center py-1 px-1 rounded-md bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50 font-sans text-[8px] font-bold text-indigo-600 dark:text-indigo-400 border border-indigo-100/50 dark:border-indigo-900/40 transition duration-150 cursor-pointer shadow-3xs"
                            >
                              +{cellEvents.length}
                            </button>

                            {openTooltipDay === `${monthIndex}-${format(day, "yyyy-MM-dd")}` && (
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 pb-1.5 flex flex-col z-[100] w-52 pointer-events-auto">
                                <div className="bg-white dark:bg-neutral-900 border border-gray-250 dark:border-neutral-700 shadow-xl rounded-xl p-3 flex flex-col">
                                  <div className="font-bold text-xs mb-2 border-b border-gray-100 dark:border-neutral-800 pb-2 text-slate-800 dark:text-white flex items-center justify-between">
                                    <span>
                                      {formatInTimezone(day, "MMM d, yyyy", timezone, locale)}
                                    </span>
                                    <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950 px-1.5 py-0.5 rounded-full text-indigo-600 dark:text-indigo-400 font-bold">
                                      {cellEvents.length}
                                    </span>
                                  </div>
                                  <div className="flex flex-col gap-1 max-h-[150px] overflow-auto mb-2 custom-scrollbar">
                                    {cellEvents.map((ev) => {
                                      const style = getEventStyles(ev.color || ev.category);
                                      return (
                                        <div
                                          key={ev.id}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setOpenTooltipDay(null);
                                            onSelectEvent(ev);
                                          }}
                                          className={`px-2 py-1.5 rounded-lg text-[9px] flex items-center gap-1.5 align-middle font-medium truncate cursor-pointer hover:opacity-80 transition ${style.bg} ${style.text} ${style.border}`}
                                        >
                                          <span
                                            className={`w-1.5 h-1.5 rounded-full shrink-0 ${style.indicator}`}
                                          />
                                          <span className="truncate">{ev.title}</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                  <button
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] py-1.5 px-3 rounded-lg font-bold w-full transition-colors cursor-pointer mt-1"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setOpenTooltipDay(null);
                                      if (onNavigateToDay) {
                                        onNavigateToDay(day);
                                      } else {
                                        onCellClick(day);
                                      }
                                    }}
                                  >
                                    See day view
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
