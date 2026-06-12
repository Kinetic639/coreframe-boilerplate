"use client";

import React, { useRef, useState, useEffect } from "react";
import { isToday, isSameDay, format, startOfDay, addMinutes, differenceInMinutes } from "date-fns";
import {
  CalendarEvent,
  BackgroundEvent,
  UnscheduledTask,
  SchedulerLocale,
} from "./scheduler-types";
import {
  getWeekDays,
  calculateEventPositionInTimeGrid,
  detectAndLayoutGridEvents,
  getDisplayTime,
  formatInTimezone,
  formatGridHour,
  LABELS_MAP,
} from "./scheduler-utils";

interface SchedulerWeekViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  backgroundEvents: BackgroundEvent[];
  showWeekends: boolean;
  showBackgroundEvents: boolean;
  showCurrentTimeIndicator: boolean;
  dayStartHour: number;
  dayEndHour: number;
  locale: SchedulerLocale;
  timezone: string;
  timeFormat: "12h" | "24h";
  draggedTask?: UnscheduledTask | null;
  onSelectEvent: (event: CalendarEvent) => void;
  onCellClick: (date: Date, keepExactTime?: boolean, resourceId?: string, endDate?: Date) => void;
  onMoveEvent: (eventId: string, newDateTime: Date) => void;
  onResizeEvent: (eventId: string, newEndDateTime: Date, newStartDateTime?: Date) => void;
  onScheduleTask: (taskId: string, dateTime: Date) => void;
}

const HOUR_HEIGHT = 60; // 60px per hour means 1px = 1 minute! Incredible layout fluid math!

export const SchedulerWeekView: React.FC<SchedulerWeekViewProps> = ({
  currentDate,
  events,
  backgroundEvents,
  showWeekends,
  showBackgroundEvents,
  showCurrentTimeIndicator,
  dayStartHour,
  dayEndHour,
  locale,
  timezone,
  timeFormat,
  draggedTask,
  onSelectEvent,
  onCellClick,
  onMoveEvent,
  onResizeEvent,
  onScheduleTask,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const weekDays = getWeekDays(currentDate, showWeekends);

  // States for click & drag selection of times/days
  const [selectionStart, setSelectionStart] = useState<{ day: Date; minutes: number } | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<{ day: Date; minutes: number } | null>(null);
  const [hoveredTime, setHoveredTime] = useState<{ day: Date; minutes: number } | null>(null);

  // Vertical time line tracker
  const [nowDate, setNowDate] = useState<Date>(new Date());

  // Dynamic Pointer Resizing States
  const [resizingEvent, setResizingEvent] = useState<string | null>(null);
  const [resizeInitialY, setResizeInitialY] = useState(0);
  const [resizeInitialEnd, setResizeInitialEnd] = useState<Date | null>(null);
  const [resizingDeltaMinutes, setResizingDeltaMinutes] = useState<number>(0);
  const isResizingRef = useRef(false);

  // Drag Pointer and HTML5 Drag states
  const [draggingEventId, setDraggingEventId] = useState<string | null>(null);
  const [draggingCurrentDay, setDraggingCurrentDay] = useState<Date | null>(null);
  const [draggingCurrentMinutes, setDraggingCurrentMinutes] = useState<number>(0);
  const dragGrabOffsetRef = useRef<number>(0);
  const [isResizeHandleActive, setIsResizeHandleActive] = useState(false);
  const [taskDragDay, setTaskDragDay] = useState<Date | null>(null);
  const [taskDragMinutes, setTaskDragMinutes] = useState<number | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setNowDate(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Helpers for managing hour selection
  const getMinutesFromClientY = (clientY: number, containerElement: HTMLElement) => {
    const rect = containerElement.getBoundingClientRect();
    const y = clientY - rect.top;
    const minutesFromDayStart = (y / HOUR_HEIGHT) * 60;
    const totalMins = minutesFromDayStart + dayStartHour * 60;
    return Math.round(totalMins / 15) * 15;
  };

  const getSelectionRangeDates = React.useCallback(() => {
    if (!selectionStart || !selectionEnd) return null;

    const startDateTime = new Date(selectionStart.day);
    startDateTime.setHours(
      Math.floor(selectionStart.minutes / 60),
      selectionStart.minutes % 60,
      0,
      0
    );

    const endDateTime = new Date(selectionEnd.day);
    endDateTime.setHours(Math.floor(selectionEnd.minutes / 60), selectionEnd.minutes % 60, 0, 0);

    const start = startDateTime < endDateTime ? startDateTime : endDateTime;
    const end = startDateTime < endDateTime ? endDateTime : startDateTime;
    return { start, end };
  }, [selectionStart, selectionEnd]);

  const getSelectionBlockStyles = (day: Date) => {
    if (!selectionStart || !selectionEnd) return null;
    const range = getSelectionRangeDates();
    if (!range) return null;

    const { start, end } = range;

    const dayStart = startOfDay(day);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayStart.getDate() + 1);

    if (end <= dayStart || start >= dayEnd) return null;

    const overlapStart = start > dayStart ? start : dayStart;
    const overlapEnd = end < dayEnd ? end : dayEnd;

    const startMins = overlapStart.getHours() * 60 + overlapStart.getMinutes();
    const endMins = overlapEnd.getHours() * 60 + overlapEnd.getMinutes();

    const gridStartMins = dayStartHour * 60;
    const gridEndMins = dayEndHour * 60;

    const clampedStart = Math.max(gridStartMins, Math.min(gridEndMins, startMins));
    const clampedEnd = Math.max(gridStartMins, Math.min(gridEndMins, endMins));

    if (clampedEnd <= clampedStart) return null;

    const topPx = ((clampedStart - gridStartMins) / 60) * HOUR_HEIGHT;
    const heightPx = ((clampedEnd - clampedStart) / 60) * HOUR_HEIGHT;

    return {
      top: `${topPx}px`,
      height: `${heightPx}px`,
    };
  };

  // Handle global mouse up to complete selecting a custom range in Week view
  useEffect(() => {
    if (!selectionStart) return;

    const handleGlobalMouseUp = () => {
      const range = getSelectionRangeDates();
      if (range) {
        const duration = differenceInMinutes(range.end, range.start);
        if (duration >= 15) {
          onCellClick(range.start, true, undefined, range.end);
        } else {
          // Fallback to standard 1 hour prefill
          onCellClick(range.start, true);
        }
      }
      setSelectionStart(null);
      setSelectionEnd(null);
    };

    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => {
      window.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, [selectionStart, selectionEnd, onCellClick, getSelectionRangeDates]);

  // Scrolling into business hours initially (e.g. 7 AM)
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 7 * HOUR_HEIGHT; // scroll to 7:00
    }
  }, []);

  // PROJECTED DISPLAYED EVENTS WITH DYNAMIC MOUSE MOVEMENT END TIME
  const displayedEvents = events.map((event) => {
    if (resizingEvent === event.id && resizeInitialEnd) {
      const originalDuration = differenceInMinutes(new Date(event.end), new Date(event.start));
      const targetDuration = Math.max(15, originalDuration + resizingDeltaMinutes);
      const provisionalEnd = addMinutes(new Date(event.start), targetDuration);
      return {
        ...event,
        end: provisionalEnd,
      };
    }

    if (draggingEventId === event.id && draggingCurrentDay) {
      const originalDuration = differenceInMinutes(new Date(event.end), new Date(event.start));

      const provisionalStart = new Date(draggingCurrentDay);
      provisionalStart.setHours(
        Math.floor(draggingCurrentMinutes / 60),
        draggingCurrentMinutes % 60,
        0,
        0
      );

      const provisionalEnd = addMinutes(provisionalStart, originalDuration);

      return {
        ...event,
        start: provisionalStart,
        end: provisionalEnd,
      };
    }

    return event;
  });

  // All-day vs Timed events filtering
  const weekAllDayEvents = displayedEvents.filter((ev) => {
    return ev.allDay && weekDays.some((day) => isSameDay(day, new Date(ev.start)));
  });

  // Category Styling Map
  const categoryStyles: Record<
    string,
    { bg: string; text: string; border: string; indicator: string }
  > = {
    meeting: {
      bg: "bg-indigo-50/90 dark:bg-indigo-950/40 hover:bg-indigo-100/50",
      text: "text-slate-800 dark:text-indigo-200 font-bold",
      border: "border-l-4 border-indigo-500 border-y-0 border-r-0",
      indicator: "bg-indigo-500",
    },
    task: {
      bg: "bg-emerald-50/90 dark:bg-emerald-950/40 hover:bg-emerald-100/50",
      text: "text-slate-800 dark:text-emerald-200 font-bold",
      border: "border-l-4 border-emerald-500 border-y-0 border-r-0",
      indicator: "bg-emerald-500",
    },
    workshop: {
      bg: "bg-amber-50/90 dark:bg-amber-950/40 hover:bg-amber-100/50",
      text: "text-slate-800 dark:text-amber-200 font-bold",
      border: "border-l-4 border-amber-500 border-y-0 border-r-0",
      indicator: "bg-amber-500",
    },
    warehouse: {
      bg: "bg-rose-50/90 dark:bg-rose-950/40 hover:bg-rose-100/50",
      text: "text-slate-800 dark:text-rose-200 font-bold",
      border: "border-l-4 border-rose-500 border-y-0 border-r-0",
      indicator: "bg-rose-500",
    },
    reminder: {
      bg: "bg-purple-50/90 dark:bg-purple-950/40 hover:bg-purple-100/50",
      text: "text-slate-800 dark:text-purple-200 font-bold",
      border: "border-l-4 border-purple-500 border-y-0 border-r-0",
      indicator: "bg-purple-500",
    },
    personal: {
      bg: "bg-fuchsia-50/90 dark:bg-fuchsia-950/40 hover:bg-fuchsia-100/50",
      text: "text-slate-800 dark:text-fuchsia-200 font-bold",
      border: "border-l-4 border-fuchsia-500 border-y-0 border-r-0",
      indicator: "bg-fuchsia-500",
    },
  };

  // Dragstart handler for calendar scheduled events
  const handleDragEventStart = (e: React.DragEvent, eventId: string, eventStart: Date) => {
    e.dataTransfer.setData("text/plain", JSON.stringify({ type: "event", id: eventId }));
    e.dataTransfer.effectAllowed = "move";

    // Suppress default ghost image by setting a custom 1x1px transparent GIF
    const img = new Image();
    img.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    e.dataTransfer.setDragImage(img, 0, 0);

    setDraggingEventId(eventId);
    setDraggingCurrentDay(new Date(eventStart));

    // Measure where the user grabbed the card relative to the top of the card
    const rect = e.currentTarget.getBoundingClientRect();
    const grabYPixels = e.clientY - rect.top;
    const grabOffsetMinutes = grabYPixels / (HOUR_HEIGHT / 60);
    dragGrabOffsetRef.current = grabOffsetMinutes;

    const displayTime = getDisplayTime(new Date(eventStart), timezone);
    const startMinutes = displayTime.hour * 60 + displayTime.minute;
    setDraggingCurrentMinutes(startMinutes);
  };

  const handleDragOverOnColumn = (e: React.DragEvent, cellDate: Date) => {
    e.preventDefault();
    if (draggingEventId) {
      const rect = e.currentTarget.getBoundingClientRect();
      const y = e.clientY - rect.top; // pixels from column top

      // Convert Y inside the day column grid to minutes from midnight
      const minutesFromMidnight = y / (HOUR_HEIGHT / 60) + dayStartHour * 60;

      // Subtract the grab offset (in minutes) so the cursor position on the card remains stable relative to the start time of the card
      let startMinutes = minutesFromMidnight - dragGrabOffsetRef.current;

      // Snap to 15 minutes
      startMinutes = Math.round(startMinutes / 15) * 15;

      // Constrain to typical day boundaries
      startMinutes = Math.max(0, Math.min(1425, startMinutes)); // At least 15 mins before midnight

      setDraggingCurrentDay(cellDate);
      setDraggingCurrentMinutes(startMinutes);
    } else if (draggedTask) {
      const rect = e.currentTarget.getBoundingClientRect();
      const y = e.clientY - rect.top;

      const minutesFromMidnight = y / (HOUR_HEIGHT / 60) + dayStartHour * 60;
      let startMinutes = minutesFromMidnight;
      startMinutes = Math.round(startMinutes / 15) * 15;

      const maxMins = dayEndHour * 60 - draggedTask.estimatedDurationMinutes;
      startMinutes = Math.max(dayStartHour * 60, Math.min(maxMins, startMinutes));

      setTaskDragDay(cellDate);
      setTaskDragMinutes(startMinutes);
    }
  };

  const handleDragEnd = () => {
    setDraggingEventId(null);
    setDraggingCurrentDay(null);
    setDraggingCurrentMinutes(0);
    setTaskDragDay(null);
    setTaskDragMinutes(null);
  };

  // Drag over handler
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  // Calculate coordinates where dropped vertically inside the grid column
  const handleDropOnColumn = (e: React.DragEvent, cellDate: Date) => {
    e.preventDefault();

    try {
      const rawData = e.dataTransfer.getData("text/plain");
      if (!rawData) return;
      const data = JSON.parse(rawData);

      if (data.type === "event" && data.id) {
        if (draggingCurrentDay && draggingEventId === data.id) {
          const finalDateTime = new Date(draggingCurrentDay);
          finalDateTime.setHours(
            Math.floor(draggingCurrentMinutes / 60),
            draggingCurrentMinutes % 60,
            0,
            0
          );
          onMoveEvent(data.id, finalDateTime);
        } else {
          const rect = e.currentTarget.getBoundingClientRect();
          const y = e.clientY - rect.top;
          const calculatedMins = y / (HOUR_HEIGHT / 60) + dayStartHour * 60;
          const minutesFromMidnight = Math.max(0, Math.min(1439, calculatedMins));
          const snappedMinutes = Math.round(minutesFromMidnight / 15) * 15;
          const finalDateTime = new Date(cellDate);
          finalDateTime.setHours(Math.floor(snappedMinutes / 60), snappedMinutes % 60, 0, 0);
          onMoveEvent(data.id, finalDateTime);
        }
      } else if (data.type === "task" && data.id) {
        let finalMinutes = taskDragMinutes;
        const isTargetMatch = taskDragDay && isSameDay(taskDragDay, cellDate);
        if (finalMinutes === null || !isTargetMatch) {
          const rect = e.currentTarget.getBoundingClientRect();
          const y = e.clientY - rect.top;
          const calculatedMins = y / (HOUR_HEIGHT / 60) + dayStartHour * 60;
          const minutesFromMidnight = Math.max(0, Math.min(1439, calculatedMins));
          finalMinutes = Math.round(minutesFromMidnight / 15) * 15;
        }
        const finalDateTime = new Date(cellDate);
        finalDateTime.setHours(Math.floor(finalMinutes / 60), finalMinutes % 60, 0, 0);
        onScheduleTask(data.id, finalDateTime);
      }
    } catch (err) {
      // Catch format warnings
    } finally {
      handleDragEnd();
    }
  };

  // Hourly grid lines array
  const totalHours = dayEndHour - dayStartHour;
  const hours = Array.from({ length: totalHours }).map((_, i) => i + dayStartHour);

  const handleResizePointerDown = (e: React.PointerEvent, eventId: string, currentEnd: Date) => {
    e.stopPropagation();
    e.preventDefault();
    isResizingRef.current = true;
    setResizingEvent(eventId);
    setResizeInitialY(e.clientY);
    setResizeInitialEnd(currentEnd);
    setResizingDeltaMinutes(0);

    // Capture pointer
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleResizePointerMove = (e: React.PointerEvent) => {
    if (!resizingEvent || !resizeInitialEnd) return;
    e.stopPropagation();

    const deltaY = e.clientY - resizeInitialY;

    // Since 1px = 1 minute, convert vertical offset to minutes
    const deltaMinutes = Math.round(deltaY / 15) * 15; // Snaps in 15m offsets
    setResizingDeltaMinutes(deltaMinutes);
  };

  const handleResizePointerUp = (e: React.PointerEvent, eventId: string) => {
    if (!resizingEvent || !resizeInitialEnd) return;
    e.stopPropagation();

    const deltaY = e.clientY - resizeInitialY;
    const deltaMinutes = Math.round(deltaY / 15) * 15;

    // Ensure final duration is at least 15 minutes
    const eventToFind = events.find((ev) => ev.id === eventId);
    if (eventToFind) {
      const originalDuration = differenceInMinutes(
        new Date(eventToFind.end),
        new Date(eventToFind.start)
      );
      const targetDuration = Math.max(15, originalDuration + deltaMinutes);

      const newEnd = addMinutes(new Date(eventToFind.start), targetDuration);
      onResizeEvent(eventId, newEnd);
    }

    // Clear state
    setResizingEvent(null);
    setResizeInitialEnd(null);
    setResizingDeltaMinutes(0);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);

    setTimeout(() => {
      isResizingRef.current = false;
    }, 100);
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-neutral-900 transition-colors duration-200 overflow-hidden select-none">
      {/* Main vertical scrollable Grid Container */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden relative scrollbar-thin"
      >
        {/* Sticky Header and All-Day Shelf container to perfectly align margins and widths with scrollbar visible area */}
        <div className="sticky top-0 z-40 bg-white dark:bg-neutral-900 border-b border-gray-150 dark:border-neutral-800 shadow-sm">
          {/* Week Shelf header row */}
          <div
            className={`grid bg-gray-50/50 dark:bg-neutral-900/50 ${
              weekAllDayEvents.length > 0 ? "border-b border-gray-150 dark:border-neutral-800" : ""
            }`}
            style={{ gridTemplateColumns: `56px repeat(${weekDays.length}, minmax(0, 1fr))` }}
          >
            <div /> {/* Corner spacer for hours axis */}
            {weekDays.map((day) => {
              const isTodayDate = isToday(day);
              return (
                <div
                  key={day.toString()}
                  onClick={() => onCellClick(day)}
                  className="py-3 px-1 border-l border-gray-100 dark:border-neutral-800/60 text-center flex flex-col items-center cursor-pointer hover:bg-gray-100/40 dark:hover:bg-neutral-800/40 transition"
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-neutral-500 font-mono">
                    {formatInTimezone(day, "EEE", timezone, locale)}
                  </span>
                  <span
                    className={`mt-1 text-sm font-extrabold w-7 h-7 flex items-center justify-center rounded-full ${
                      isTodayDate
                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/15"
                        : "text-gray-800 dark:text-neutral-200"
                    }`}
                  >
                    {format(day, "d")}
                  </span>
                </div>
              );
            })}
          </div>

          {/* All-Day events shelf */}
          {weekAllDayEvents.length > 0 && (
            <div
              className="grid bg-amber-50/10 dark:bg-amber-950/5 py-1.5"
              style={{ gridTemplateColumns: `56px repeat(${weekDays.length}, minmax(0, 1fr))` }}
            >
              <div className="flex items-center justify-center">
                <span className="text-[9px] font-extrabold uppercase font-mono tracking-wide text-amber-600 bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900/40 px-1 py-0.5 rounded">
                  All Day
                </span>
              </div>
              {weekDays.map((day) => {
                const dayAllDayEvents = weekAllDayEvents.filter((ev) =>
                  isSameDay(new Date(ev.start), day)
                );
                return (
                  <div
                    key={day.toString()}
                    className="border-l border-gray-100 dark:border-neutral-800/60 px-2 space-y-1 min-w-0 overflow-hidden"
                  >
                    {dayAllDayEvents.map((ev) => {
                      const style =
                        categoryStyles[ev.color || ev.category] || categoryStyles.meeting;
                      return (
                        <div
                          key={ev.id}
                          onClick={() => onSelectEvent(ev)}
                          title={ev.title}
                          className={`px-2 py-0.5 border text-[10px] font-semibold rounded-md truncate cursor-pointer transition w-full block whitespace-nowrap overflow-hidden ${style.bg} ${style.text} ${style.border}`}
                        >
                          {ev.title}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="relative w-full" style={{ height: `${totalHours * HOUR_HEIGHT}px` }}>
          {/* Day Grid Lines */}
          <div className="absolute inset-0 z-0 pointer-events-none">
            {hours.map((hr) => (
              <div
                key={hr}
                className="border-b border-gray-100 dark:border-neutral-800/40 flex items-start text-[10px] text-gray-400 font-mono"
                style={{ height: `${HOUR_HEIGHT}px` }}
              >
                {/* Visual grid row spacer */}
              </div>
            ))}
          </div>

          {/* Time axis Labels column */}
          <div className="absolute left-0 top-0 bottom-0 w-14 border-r border-gray-150 dark:border-neutral-800 z-30 bg-white/95 dark:bg-neutral-900/95 font-mono text-[10px] text-gray-400/90">
            {hours.map((hr, idx) => {
              const formattedHour = formatGridHour(hr, timeFormat);
              return (
                <div
                  key={hr}
                  className="pl-2 flex items-start"
                  style={{ height: `${HOUR_HEIGHT}px` }}
                >
                  <span className={`relative ${idx === 0 ? "top-1.5" : "top-[-6px]"}`}>
                    {formattedHour}
                  </span>
                </div>
              );
            })}
            {/* The final ending hour label at the very bottom */}
            <div
              className="absolute bottom-0 left-0 right-0 pl-2 flex items-start"
              style={{ height: "0px" }}
            >
              <span className="relative top-[-6px]">{formatGridHour(dayEndHour, timeFormat)}</span>
            </div>

            {/* Hover active indicator time text badge inside side ruler */}
            {hoveredTime && !selectionStart && (
              <div
                className="absolute right-1.5 bg-indigo-600 text-white font-mono text-[9px] px-1 py-0.5 rounded shadow-sm z-30 pointer-events-none opacity-95 whitespace-nowrap animate-fade-in"
                style={{
                  top: `${((hoveredTime.minutes - dayStartHour * 60) / 60) * HOUR_HEIGHT}px`,
                  transform: "translateY(-50%)",
                }}
              >
                {(() => {
                  const d = new Date(hoveredTime.day);
                  d.setHours(Math.floor(hoveredTime.minutes / 60), hoveredTime.minutes % 60, 0, 0);
                  return format(d, timeFormat === "24h" ? "HH:mm" : "h:mm a");
                })()}
              </div>
            )}
          </div>

          {/* Global hover dashed line spanning all columns */}
          {hoveredTime && !selectionStart && (
            <div
              className="absolute left-14 right-0 border-t border-dashed border-indigo-500/50 pointer-events-none z-30"
              style={{ top: `${((hoveredTime.minutes - dayStartHour * 60) / 60) * HOUR_HEIGHT}px` }}
            />
          )}

          {/* Columns representation (matching columns layout grid) */}
          <div
            className="absolute inset-y-0 left-14 right-0 z-10 grid"
            style={{ gridTemplateColumns: `repeat(${weekDays.length}, minmax(0, 1fr))` }}
          >
            {weekDays.map((day) => {
              const isTodayColumn = isToday(day);

              // Filter to timed events active on this specific date
              const baseEvents = displayedEvents.filter(
                (ev) => !ev.allDay && isSameDay(day, new Date(ev.start))
              );

              const dayEvents = (() => {
                if (
                  draggedTask &&
                  taskDragDay &&
                  isSameDay(day, taskDragDay) &&
                  taskDragMinutes !== null
                ) {
                  const start = new Date(day);
                  start.setHours(Math.floor(taskDragMinutes / 60), taskDragMinutes % 60, 0, 0);
                  const end = addMinutes(start, draggedTask.estimatedDurationMinutes);
                  const provisionalEvent: CalendarEvent = {
                    id: `provisional-task-${draggedTask.id}`,
                    title: draggedTask.title,
                    description: draggedTask.description,
                    start,
                    end,
                    category: draggedTask.category,
                    color: draggedTask.color,
                    isDraggable: false,
                    isResizable: false,
                    isProvisional: true,
                  };
                  return [...baseEvents, provisionalEvent];
                }
                return baseEvents;
              })();

              // Detect layout overlap columns mapping
              const overlapLayoutMap = detectAndLayoutGridEvents(dayEvents);

              // Background event slots on this day
              const dayBackgroundEvents = showBackgroundEvents
                ? backgroundEvents.filter((bg) => isSameDay(day, new Date(bg.start)))
                : [];

              return (
                <div
                  key={day.toString()}
                  onDragOver={(e) => handleDragOverOnColumn(e, day)}
                  onDragLeave={() => {
                    setTaskDragDay(null);
                    setTaskDragMinutes(null);
                  }}
                  onDrop={(e) => handleDropOnColumn(e, day)}
                  onMouseDown={(e) => {
                    const isInteractive =
                      (e.target as HTMLElement).closest('[id^="week-event-card-"]') ||
                      (e.target as HTMLElement).closest("button");
                    if (isInteractive || isResizingRef.current || draggingEventId || draggedTask)
                      return;
                    if (e.button !== 0) return;

                    const mins = getMinutesFromClientY(e.clientY, e.currentTarget);
                    setSelectionStart({ day, minutes: mins });
                    setSelectionEnd({ day, minutes: mins });
                  }}
                  onMouseMove={(e) => {
                    const isInteractive = (e.target as HTMLElement).closest(
                      '[id^="week-event-card-"], [class*="event-card"], [class*="group/event"], button'
                    );
                    if (isInteractive) {
                      setHoveredTime(null);
                      return;
                    }
                    const mins = getMinutesFromClientY(e.clientY, e.currentTarget);
                    setHoveredTime({ day, minutes: mins });
                    if (selectionStart) {
                      setSelectionEnd({ day, minutes: mins });
                    }
                  }}
                  onMouseEnter={() => {
                    if (selectionStart) {
                      setSelectionEnd((prev) => (prev ? { ...prev, day } : { day, minutes: 0 }));
                    }
                  }}
                  onMouseLeave={() => {
                    setHoveredTime(null);
                  }}
                  className="relative border-l border-gray-100 dark:border-neutral-800/60 h-full hover:bg-gray-50/10 transition"
                >
                  {/* Selection block visual overlay */}
                  {(() => {
                    const style = getSelectionBlockStyles(day);
                    if (!style) return null;
                    const range = getSelectionRangeDates();
                    if (!range) return null;

                    const isStartDay = isSameDay(day, range.start);
                    const isEndDay = isSameDay(day, range.end);

                    return (
                      <div
                        className="absolute left-0 right-0 bg-indigo-500/20 border-y-2 border-indigo-500/50 pointer-events-none z-30 animate-pulse"
                        style={style}
                      >
                        {isStartDay && (
                          <span className="absolute top-0.5 left-1 bg-indigo-600 text-white font-mono text-[9px] px-1 py-0.2 rounded shadow-xs select-none opacity-95 whitespace-nowrap">
                            Start: {format(range.start, timeFormat === "24h" ? "HH:mm" : "h:mm a")}
                          </span>
                        )}
                        {isEndDay && (
                          <span className="absolute bottom-0.5 right-1 bg-indigo-600 text-white font-mono text-[9px] px-1 py-0.2 rounded shadow-xs select-none opacity-95 whitespace-nowrap">
                            End: {format(range.end, timeFormat === "24h" ? "HH:mm" : "h:mm a")}
                          </span>
                        )}
                      </div>
                    );
                  })()}

                  {/* Hourly hover/click cell interactive segments */}
                  <div
                    className={`absolute inset-0 z-0 flex flex-col pointer-events-none ${draggingEventId || selectionStart ? "opacity-0" : ""}`}
                  >
                    {hours.map((hr) => {
                      const isThisDayHovered = hoveredTime && isSameDay(day, hoveredTime.day);
                      const isThisHourHovered =
                        isThisDayHovered && Math.floor(hoveredTime!.minutes / 60) === hr;

                      const formatPreciseMins = (minutes: number) => {
                        const h = Math.floor(minutes / 60);
                        const m = minutes % 60;
                        if (timeFormat === "24h") {
                          return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
                        } else {
                          const ampm = h >= 12 ? "PM" : "AM";
                          const displayHour = h % 12 === 0 ? 12 : h % 12;
                          return `${displayHour}:${String(m).padStart(2, "0")} ${ampm}`;
                        }
                      };

                      return (
                        <div
                          key={hr}
                          className="w-full border-b border-gray-100/30 dark:border-neutral-800/5 hover:bg-indigo-500/[0.04] dark:hover:bg-indigo-400/[0.04] cursor-pointer pointer-events-auto transition duration-75 flex items-start pl-1 text-[8px] font-mono font-medium text-slate-350 dark:text-neutral-650 tracking-wider group"
                          style={{ height: `${HOUR_HEIGHT}px` }}
                          id={`week-hour-slot-${day.getDay()}-${hr}`}
                        >
                          <span className="opacity-0 group-hover:opacity-100 mt-1 text-indigo-600 dark:text-indigo-400 font-semibold transition-opacity duration-100 font-mono">
                            {LABELS_MAP[locale]?.hoverAddAt || "+ Add"}{" "}
                            {isThisHourHovered
                              ? formatPreciseMins(hoveredTime!.minutes)
                              : formatGridHour(hr, timeFormat)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  {/* Background shade blocks */}
                  {showBackgroundEvents &&
                    dayBackgroundEvents.map((bg) => {
                      const pos = calculateEventPositionInTimeGrid(
                        { start: new Date(bg.start), end: new Date(bg.end) } as CalendarEvent,
                        day,
                        dayStartHour,
                        dayEndHour
                      );

                      if ((pos as any).isFullyOutside) return null;

                      const bgColors: Record<string, string> = {
                        break:
                          "bg-emerald-500/5 hover:bg-emerald-500/10 border-emerald-500/10 text-emerald-500",
                        closed:
                          "bg-rose-500/5 hover:bg-rose-500/10 border-rose-500/10 text-rose-500",
                        holiday:
                          "bg-rose-500/5 hover:bg-rose-500/10 border-rose-500/10 text-rose-500",
                        unavailable:
                          "bg-neutral-500/5 hover:bg-neutral-500/10 border-neutral-500/10 text-neutral-400",
                        focus:
                          "bg-indigo-500/5 hover:bg-indigo-505/15 border-indigo-500/10 text-indigo-500",
                      };

                      const bgStartStr = formatInTimezone(
                        new Date(bg.start),
                        timeFormat === "24h" ? "HH:mm" : "h:mm a",
                        timezone,
                        locale
                      );
                      const bgEndStr = formatInTimezone(
                        new Date(bg.end),
                        timeFormat === "24h" ? "HH:mm" : "h:mm a",
                        timezone,
                        locale
                      );

                      return (
                        <div
                          key={bg.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectEvent({
                              id: bg.id,
                              title: bg.title,
                              start: new Date(bg.start),
                              end: new Date(bg.end),
                              category: "meeting",
                              color: bg.color,
                              isDraggable: false,
                              isResizable: false,
                              metadata: {
                                isBackground: true,
                                bgType: bg.type,
                                opacity: bg.opacity,
                              },
                            } as any);
                          }}
                          className={`absolute left-0 right-0 border-y py-1.5 px-3 cursor-pointer hover:brightness-95 hover:shadow-xs select-none flex items-start gap-1 font-mono text-[9px] font-extrabold overflow-hidden leading-tight ${bgColors[bg.type]}`}
                          style={{ top: pos.top, height: pos.height }}
                          title={`${bg.title}: ${bgStartStr} - ${bgEndStr}`}
                        >
                          <span className="truncate">⚠ {bg.title}</span>
                        </div>
                      );
                    })}

                  {/* Red/Blue Current-Time Indicator Line */}
                  {showCurrentTimeIndicator &&
                    isTodayColumn &&
                    (() => {
                      const displayTime = getDisplayTime(nowDate, timezone);
                      const minutesFromMidnight = displayTime.hour * 60 + displayTime.minute;
                      const dayStartMinutes = dayStartHour * 60;
                      const dayEndMinutes = dayEndHour * 60;
                      if (
                        minutesFromMidnight < dayStartMinutes ||
                        minutesFromMidnight > dayEndMinutes
                      )
                        return null;

                      const lineOffset =
                        ((minutesFromMidnight - dayStartMinutes) /
                          (dayEndMinutes - dayStartMinutes)) *
                        100;
                      return (
                        <div
                          className="absolute left-0 right-0 z-30 flex items-center pointer-events-none"
                          style={{ top: `${lineOffset}%` }}
                        >
                          <div className="w-2 h-2 rounded-full bg-rose-600 dark:bg-rose-500 ring-4 ring-rose-500/20 shadow-sm" />
                          <div className="h-[2px] flex-1 bg-rose-600 dark:bg-rose-500" />
                        </div>
                      );
                    })()}

                  {/* Scheduled Calendar Events */}
                  {dayEvents.map((event) => {
                    const pos = calculateEventPositionInTimeGrid(
                      event,
                      day,
                      dayStartHour,
                      dayEndHour
                    );
                    if ((pos as any).isFullyOutside) return null;

                    const isProvisional = !!event.isProvisional;
                    const isDragging = event.id === draggingEventId;
                    const isResizableEvent =
                      event.isResizable !== false && !isProvisional && !isDragging;
                    const style =
                      categoryStyles[event.color || event.category] || categoryStyles.meeting;

                    // Retrieve overlap positioning indices
                    const layoutData = overlapLayoutMap.get(event.id) || {
                      colIndex: 0,
                      totalCols: 1,
                    };
                    const colWidth = 100 / layoutData.totalCols;
                    const colLeft = layoutData.colIndex * colWidth;

                    const showDetails = parseInt(pos.height) > 8; // If space permits, show locations/desc

                    return (
                      <div
                        key={event.id}
                        draggable={event.isDraggable !== false && !isResizeHandleActive}
                        onDragStart={(e) =>
                          handleDragEventStart(e, event.id, new Date(event.start))
                        }
                        onDragEnd={handleDragEnd}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isResizingRef.current || isProvisional || isDragging) {
                            return;
                          }
                          onSelectEvent(event);
                        }}
                        className={`absolute rounded-r-xl rounded-l-none p-2.5 text-[10px] leading-tight select-none transition-all duration-150 overflow-hidden ${
                          isProvisional
                            ? "pointer-events-none z-30 shadow-none"
                            : isDragging
                              ? "cursor-grabbing z-40 shadow-md ring-1 ring-black/5 dark:ring-white/10"
                              : "cursor-pointer active:cursor-grabbing hover:shadow-sm hover:shadow-slate-100/50 group/card z-20"
                        } ${style.bg} ${style.text} ${style.border}`}
                        style={{
                          top: pos.top,
                          height: pos.height,
                          left: `${colLeft}%`,
                          width: `${colWidth - 1}%`, // small gap spacing
                        }}
                        id={`week-event-card-${event.id}`}
                      >
                        <div className="space-y-1 overflow-hidden h-full flex flex-col justify-start">
                          {/* Heading summary */}
                          <div className="flex items-start gap-1 justify-between shrink-0">
                            <span className="font-extrabold text-xs tracking-tight line-clamp-1 leading-none">
                              {event.title}
                            </span>
                          </div>

                          {/* Time display */}
                          <p className="font-mono text-[9px] opacity-75 font-semibold leading-none shrink-0">
                            {formatInTimezone(
                              new Date(event.start),
                              timeFormat === "24h" ? "HH:mm" : "h:mm a",
                              timezone,
                              locale
                            )}{" "}
                            -{" "}
                            {formatInTimezone(
                              new Date(event.end),
                              timeFormat === "24h" ? "HH:mm" : "h:mm a",
                              timezone,
                              locale
                            )}
                          </p>

                          {/* Location details */}
                          {showDetails && event.location && (
                            <p className="text-[9px] text-gray-500 dark:text-neutral-400 font-semibold truncate leading-none shrink-0 pt-0.5">
                              📍 {event.location}
                            </p>
                          )}

                          {/* Description details */}
                          {showDetails && event.description && (
                            <p className="text-[9.5px] text-gray-400 dark:text-neutral-500 line-clamp-2 leading-normal mt-0.5 font-medium overflow-hidden">
                              {event.description}
                            </p>
                          )}
                        </div>

                        {/* Resize drag visual handle at bottom border of the card */}
                        {isResizableEvent && (
                          <div
                            onMouseEnter={() => setIsResizeHandleActive(true)}
                            onMouseLeave={() => setIsResizeHandleActive(false)}
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                            }}
                            onPointerDown={(e) => {
                              setIsResizeHandleActive(true);
                              handleResizePointerDown(e, event.id, event.end);
                            }}
                            onPointerMove={handleResizePointerMove}
                            onPointerUp={(e) => {
                              setIsResizeHandleActive(false);
                              handleResizePointerUp(e, event.id);
                            }}
                            className="absolute bottom-0 left-0 right-0 h-2 bg-transparent group-hover/card:bg-indigo-300/20 active:bg-indigo-500/30 cursor-ns-resize transition duration-150 flex items-center justify-center pointer-events-auto"
                            title="Drag bottom to resize duration"
                          >
                            {/* Visual resizing indicator grip bars */}
                            <span className="w-4 h-[2px] bg-indigo-500/40 rounded" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
