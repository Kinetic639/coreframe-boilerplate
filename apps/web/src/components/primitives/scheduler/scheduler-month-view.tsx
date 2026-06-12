"use client";

import React from "react";
import { isSameMonth, isToday, isSameDay, format, startOfDay } from "date-fns";
import {
  CalendarEvent,
  BackgroundEvent,
  UnscheduledTask,
  SchedulerLocale,
} from "./scheduler-types";
import { getMonthGridDays, formatInTimezone, LABELS_MAP } from "./scheduler-utils";

interface SchedulerMonthViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  backgroundEvents: BackgroundEvent[];
  showWeekends: boolean;
  showBackgroundEvents: boolean;
  locale: SchedulerLocale;
  timezone: string;
  timeFormat: "12h" | "24h";
  draggedTask?: UnscheduledTask | null;
  onSelectEvent: (event: CalendarEvent) => void;
  onCellClick: (date: Date, keepExactTime?: boolean, resourceId?: string, endDate?: Date) => void;
  onNavigateToDay?: (date: Date) => void;
  onMoveEvent: (eventId: string, newDate: Date) => void;
  onScheduleTask: (taskId: string, date: Date) => void;
}

export const getEventStyles = (categoryOrColor: string) => {
  const map: Record<string, { bg: string; text: string; border: string; indicator: string }> = {
    meeting: {
      bg: "bg-indigo-50/80 hover:bg-indigo-100/40 dark:bg-indigo-950/30",
      text: "text-slate-800 dark:text-indigo-200 font-bold",
      border: "border-l-3 border-indigo-500 border-y-0 border-r-0",
      indicator: "bg-indigo-500",
    },
    task: {
      bg: "bg-emerald-50/80 hover:bg-emerald-100/40 dark:bg-emerald-950/30",
      text: "text-slate-800 dark:text-emerald-200 font-bold",
      border: "border-l-3 border-emerald-500 border-y-0 border-r-0",
      indicator: "bg-emerald-500",
    },
    workshop: {
      bg: "bg-amber-50/80 hover:bg-amber-100/40 dark:bg-amber-950/30",
      text: "text-slate-800 dark:text-amber-200 font-bold",
      border: "border-l-3 border-amber-500 border-y-0 border-r-0",
      indicator: "bg-amber-500",
    },
    warehouse: {
      bg: "bg-rose-50/80 hover:bg-rose-100/40 dark:bg-rose-950/30",
      text: "text-slate-800 dark:text-rose-200 font-bold",
      border: "border-l-3 border-rose-500 border-y-0 border-r-0",
      indicator: "bg-rose-500",
    },
    reminder: {
      bg: "bg-purple-50/80 hover:bg-purple-100/40 dark:bg-purple-950/30",
      text: "text-slate-800 dark:text-purple-200 font-bold",
      border: "border-l-3 border-purple-500 border-y-0 border-r-0",
      indicator: "bg-purple-500",
    },
    personal: {
      bg: "bg-fuchsia-50/80 hover:bg-fuchsia-100/40 dark:bg-fuchsia-950/30",
      text: "text-slate-800 dark:text-fuchsia-200 font-bold",
      border: "border-l-3 border-fuchsia-500 border-y-0 border-r-0",
      indicator: "bg-fuchsia-500",
    },
  };
  return map[categoryOrColor] || map.meeting;
};

export const SchedulerMonthView: React.FC<SchedulerMonthViewProps> = ({
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
  onMoveEvent,
  onScheduleTask,
}) => {
  const days = getMonthGridDays(currentDate, showWeekends);
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

  // Effect to handle global mouse up for Month drag select
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

  // Compute displayed events, mapping dragged event to its provisional day cell
  const displayedEvents = React.useMemo(() => {
    return events.map((event) => {
      if (draggedEventId === event.id && activeDragOverDay) {
        return {
          ...event,
          start: activeDragOverDay,
        };
      }
      return event;
    });
  }, [events, draggedEventId, activeDragOverDay]);

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

  // Drag handles
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
      // Ignore parser errors for other browser highlights
    }
  };

  const handleDragEventStart = (e: React.DragEvent, eventId: string) => {
    e.dataTransfer.setData("text/plain", JSON.stringify({ type: "event", id: eventId }));
    e.dataTransfer.effectAllowed = "move";

    // Suppress default ghost image by setting a custom 1x1px transparent GIF
    const img = new Image();
    img.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    e.dataTransfer.setDragImage(img, 0, 0);

    setDraggedEventId(eventId);
  };

  const handleDragEnd = () => {
    setActiveDragOverDay(null);
    setDraggedEventId(null);
  };

  return (
    <div className="flex flex-col h-full bg-background transition-colors duration-200">
      {/* Columns grid for days headers */}
      <div
        className={`grid ${filteredHeadings.length === 5 ? "grid-cols-5" : "grid-cols-7"} border-b border-border select-none bg-muted/50`}
      >
        {filteredHeadings.map((head, i) => (
          <div
            key={i}
            className="py-3 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground font-mono"
          >
            {formatInTimezone(head, "EEE", timezone, locale)}
          </div>
        ))}
      </div>

      {/* Month Days viewport representation */}
      <div
        className={`grid ${filteredHeadings.length === 5 ? "grid-cols-5" : "grid-cols-7"} grid-rows-6 flex-1 min-h-[500px]`}
      >
        {days.map((day, idx) => {
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isTodayDate = isToday(day);

          // Events active on this cell date (ignoring times)
          const cellEvents = displayedEvents.filter((ev) => isSameDay(new Date(ev.start), day));

          // Background events tint check
          const cellBackgroundEvents = showBackgroundEvents
            ? backgroundEvents.filter((bg) => {
                const bgStart = new Date(bg.start);
                return (
                  isSameDay(bgStart, day) &&
                  (bg.type === "closed" || bg.type === "holiday" || bg.type === "unavailable")
                );
              })
            : [];

          const hasBackgroundBlocked = cellBackgroundEvents.length > 0;
          const bgBlockLabel = cellBackgroundEvents[0]?.title || "";

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

          // Layout limits
          const limit = 2;
          let visibleEvents = cellEvents;
          let overflowCount = 0;
          if (cellEvents.length > limit) {
            visibleEvents = cellEvents.slice(0, 1);
            overflowCount = cellEvents.length - 1;
          }

          return (
            <div
              key={idx}
              onDragOver={(e) => handleDragOver(e, day)}
              onDrop={(e) => handleDrop(e, day)}
              onMouseDown={(e) => {
                if (e.button !== 0) return; // Only trigger for left-clicks
                const isInteractive =
                  (e.target as HTMLElement).closest('[id^="month-event-card-"]') ||
                  (e.target as HTMLElement).closest("button");
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
              className={`relative border-r border-b border-border p-1.5 flex flex-col min-h-16 h-full transition duration-150 group select-none cursor-pointer ${
                isSelected
                  ? "bg-primary/10 ring-2 ring-inset ring-primary/40 z-30"
                  : "hover:bg-primary/[0.04] hover:ring-1 hover:ring-inset hover:ring-primary/15 hover:z-40"
              } ${
                isCurrentMonth
                  ? "bg-transparent"
                  : isSelected
                    ? ""
                    : "bg-muted/40 text-muted-foreground/50"
              } ${hasBackgroundBlocked && showBackgroundEvents ? "bg-rose-50/10 hover:bg-rose-50/20 dark:bg-rose-950/5 dark:hover:bg-rose-950/10" : ""}`}
              id={`month-cell-${format(day, "yyyy-MM-dd")}`}
            >
              {/* Day Badge Number */}
              <div className="flex items-center justify-between mb-1">
                <span className="opacity-0 group-hover:opacity-100 text-[10px] font-bold text-primary font-semibold tracking-wider transition-opacity duration-100 pointer-events-none pl-1">
                  {LABELS_MAP[locale]?.hoverAddAt || "+ Add"}
                </span>
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onNavigateToDay) {
                      onNavigateToDay(day);
                    } else {
                      onCellClick(day);
                    }
                  }}
                  className={`text-xs ml-auto font-bold flex items-center justify-center rounded-full w-6 h-6 transition-colors ${
                    isTodayDate
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : isCurrentMonth
                        ? "text-foreground group-hover:bg-muted"
                        : "text-muted-foreground/50"
                  }`}
                >
                  {format(day, "d")}
                </span>
              </div>

              {/* Background block thin tag indicator */}
              {showBackgroundEvents && hasBackgroundBlocked && (
                <div
                  className="mb-1 px-1.5 py-0.5 rounded bg-rose-100/40 dark:bg-rose-900/10 border border-rose-100/30 dark:border-rose-900/20 text-[9px] font-mono text-rose-500 font-bold truncate leading-none cursor-pointer hover:brightness-95 hover:shadow-xs transition"
                  title={bgBlockLabel}
                  onClick={(e) => {
                    e.stopPropagation();
                    const bg = cellBackgroundEvents[0];
                    if (bg) {
                      onSelectEvent({
                        id: bg.id,
                        title: bg.title,
                        start: new Date(bg.start),
                        end: new Date(bg.end),
                        category: "meeting",
                        color: bg.color,
                        isDraggable: false,
                        isResizable: false,
                        metadata: { isBackground: true, bgType: bg.type, opacity: bg.opacity },
                      } as any);
                    }
                  }}
                >
                  ⚠ {bgBlockLabel}
                </div>
              )}

              {/* Event Cards inside cell */}
              <div className="space-y-1 overflow-visible flex-1 flex flex-col">
                {visibleEvents.map((event) => {
                  const style = getEventStyles(event.color || event.category);
                  const isAllDay = !!event.allDay;
                  const isDragging = event.id === draggedEventId;

                  return (
                    <div
                      key={event.id}
                      draggable={event.isDraggable !== false}
                      onDragStart={(e) => handleDragEventStart(e, event.id)}
                      onDragEnd={handleDragEnd}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isDragging) return;
                        onSelectEvent(event);
                      }}
                      className={`px-2 py-1 rounded-r-lg rounded-l-none text-[10px] flex items-center gap-1.5 transition duration-150 shadow-xs leading-tight truncate shrink-0 ${style.bg} ${style.text} ${style.border} ${isDragging ? "cursor-grabbing z-50 shadow-sm opacity-80" : "cursor-pointer active:cursor-grabbing"}`}
                      id={`month-event-card-${event.id}`}
                    >
                      {/* Left category visual indicator dot */}
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${style.indicator}`} />

                      {/* Short Hour badge */}
                      {!isAllDay && (
                        <span className="font-mono text-[9px] opacity-75 mr-0.5 shrink-0">
                          {formatInTimezone(
                            new Date(event.start),
                            timeFormat === "24h" ? "HH:mm" : "h:mm a",
                            timezone,
                            locale
                          )}
                        </span>
                      )}

                      <span className="truncate">{event.title}</span>
                    </div>
                  );
                })}

                {draggedTask &&
                  activeDragOverDay &&
                  isSameDay(day, activeDragOverDay) &&
                  (() => {
                    const style = getEventStyles(draggedTask.color || draggedTask.category);
                    return (
                      <div
                        className={`px-2 py-1 rounded-r-lg rounded-l-none text-[10px] flex items-center gap-1.5 leading-tight truncate shrink-0 pointer-events-none mt-0.5 ${style.bg} ${style.text} ${style.border}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${style.indicator}`} />
                        <span className="truncate">{draggedTask.title}</span>
                      </div>
                    );
                  })()}

                {/* Overflow indicatory toggle */}
                {overflowCount > 0 && (
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const dayStr = format(day, "yyyy-MM-dd");
                        setOpenTooltipDay((prev) => (prev === dayStr ? null : dayStr));
                      }}
                      className="w-full text-left px-2 py-1 rounded-md bg-muted hover:bg-border text-[10px] font-medium text-muted-foreground transition duration-150 flex items-center gap-1.5 mt-0.5 cursor-pointer"
                    >
                      <span>+{overflowCount} more</span>
                    </button>

                    {/* Tooltip Popup - shown on click instead of hover */}
                    {openTooltipDay === format(day, "yyyy-MM-dd") && (
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 pb-1.5 flex flex-col z-[100] w-48 pointer-events-auto">
                        <div className="bg-popover border border-border shadow-xl rounded-xl p-3 flex flex-col">
                          <div className="font-bold text-xs mb-2 border-b border-border pb-2 text-foreground">
                            {formatInTimezone(day, "MMM d, yyyy", timezone, locale)}
                          </div>
                          <div className="flex flex-col gap-1 max-h-[150px] overflow-auto mb-2 custom-scrollbar">
                            {cellEvents.slice(1).map((ev) => {
                              const style = getEventStyles(ev.color || ev.category);
                              return (
                                <div
                                  key={ev.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenTooltipDay(null);
                                    onSelectEvent(ev);
                                  }}
                                  className={`px-2 py-1 rounded text-[9px] flex items-center gap-1.5 align-middle font-medium truncate cursor-pointer hover:opacity-80 transition ${style.bg} ${style.text}`}
                                >
                                  <span
                                    className={`w-1 h-1 rounded-full shrink-0 ${style.indicator}`}
                                  />
                                  <span className="truncate">{ev.title}</span>
                                </div>
                              );
                            })}
                          </div>
                          <button
                            className="bg-primary hover:bg-primary/90 text-primary-foreground text-[10px] py-1.5 px-3 rounded-lg font-bold w-full transition-colors cursor-pointer mt-1"
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
};
