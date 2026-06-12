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
  calculateEventPositionInTimeGrid,
  detectAndLayoutGridEvents,
  getDisplayTime,
  formatInTimezone,
  formatGridHour,
  LABELS_MAP,
} from "./scheduler-utils";

interface SchedulerDayViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  backgroundEvents: BackgroundEvent[];
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

const HOUR_HEIGHT = 64; // Slightly taller for Day View to give maximum negative space luxury

export const SchedulerDayView: React.FC<SchedulerDayViewProps> = ({
  currentDate,
  events,
  backgroundEvents,
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

  // States for click & drag selection of times/minutes (on today)
  const [selectionStartMinutes, setSelectionStartMinutes] = useState<number | null>(null);
  const [selectionEndMinutes, setSelectionEndMinutes] = useState<number | null>(null);
  const [hoveredMinutes, setHoveredMinutes] = useState<number | null>(null);

  // Time tracker state
  const [nowDate, setNowDate] = useState<Date>(new Date());

  // Resize Pointer states
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

  const getSelectionBlockStyles = () => {
    if (selectionStartMinutes === null || selectionEndMinutes === null) return null;

    const startMins = Math.min(selectionStartMinutes, selectionEndMinutes);
    const endMins = Math.max(selectionStartMinutes, selectionEndMinutes);

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

  // Handle global mouse up to complete selecting a custom range in Day view
  useEffect(() => {
    if (selectionStartMinutes === null) return;

    const handleGlobalMouseUp = () => {
      if (selectionStartMinutes !== null && selectionEndMinutes !== null) {
        const startMins = Math.min(selectionStartMinutes, selectionEndMinutes);
        const endMins = Math.max(selectionStartMinutes, selectionEndMinutes);

        if (endMins - startMins >= 15) {
          const startDate = new Date(currentDate);
          startDate.setHours(Math.floor(startMins / 60), startMins % 60, 0, 0);

          const endDate = new Date(currentDate);
          endDate.setHours(Math.floor(endMins / 60), endMins % 60, 0, 0);

          onCellClick(startDate, true, undefined, endDate);
        } else {
          // Just clicked, trigger standard 1 hour prefill
          const startDate = new Date(currentDate);
          startDate.setHours(Math.floor(startMins / 60), startMins % 60, 0, 0);
          onCellClick(startDate, true);
        }
      }
      setSelectionStartMinutes(null);
      setSelectionEndMinutes(null);
    };

    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => {
      window.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, [selectionStartMinutes, selectionEndMinutes, currentDate, onCellClick]);

  // Soft scroll to starting 7 AM business hours
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 7 * HOUR_HEIGHT;
    }
  }, []);

  // Filter all events landing on today
  const dayEvents = events.filter((ev) => !ev.allDay && isSameDay(currentDate, new Date(ev.start)));
  const dayAllDayEvents = events.filter(
    (ev) => ev.allDay && isSameDay(currentDate, new Date(ev.start))
  );

  const baseDayEvents = dayEvents.map((event) => {
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

  const displayedDayEvents = React.useMemo(() => {
    if (draggedTask && taskDragMinutes !== null) {
      const start = new Date(currentDate);
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
      return [...baseDayEvents, provisionalEvent];
    }
    return baseDayEvents;
  }, [baseDayEvents, draggedTask, taskDragMinutes, currentDate]);

  const isTodayColumn = isToday(currentDate);

  // Layout calculations for overlaps
  const overlapLayoutMap = detectAndLayoutGridEvents(displayedDayEvents);

  const dayBackgroundEvents = showBackgroundEvents
    ? backgroundEvents.filter((bg) => isSameDay(currentDate, new Date(bg.start)))
    : [];

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
      indicator: "bg-purple-550 bg-purple-500",
    },
    personal: {
      bg: "bg-fuchsia-50/90 dark:bg-fuchsia-950/40 hover:bg-fuchsia-100/50",
      text: "text-slate-800 dark:text-fuchsia-200 font-bold",
      border: "border-l-4 border-fuchsia-500 border-y-0 border-r-0",
      indicator: "bg-fuchsia-500",
    },
  };

  const handleDragEventStart = (e: React.DragEvent, eventId: string, eventStart: Date) => {
    e.dataTransfer.setData("text/plain", JSON.stringify({ type: "event", id: eventId }));
    e.dataTransfer.effectAllowed = "move";

    // Suppress default ghost image by setting a custom 1x1px transparent GIF
    const img = new Image();
    img.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    e.dataTransfer.setDragImage(img, 0, 0);

    setDraggingEventId(eventId);
    setDraggingCurrentDay(new Date(eventStart));

    const rect = e.currentTarget.getBoundingClientRect();
    const grabYPixels = e.clientY - rect.top;
    const grabOffsetMinutes = grabYPixels / (HOUR_HEIGHT / 60);
    dragGrabOffsetRef.current = grabOffsetMinutes;

    const displayTime = getDisplayTime(new Date(eventStart), timezone);
    const startMinutes = displayTime.hour * 60 + displayTime.minute;
    setDraggingCurrentMinutes(startMinutes);
  };

  const handleDragOverOnColumn = (e: React.DragEvent) => {
    e.preventDefault();
    if (draggingEventId) {
      const rect = e.currentTarget.getBoundingClientRect();
      const y = e.clientY - rect.top;

      const minutesFromMidnight = y / (HOUR_HEIGHT / 60) + dayStartHour * 60;
      let startMinutes = minutesFromMidnight - dragGrabOffsetRef.current;
      startMinutes = Math.round(startMinutes / 15) * 15;
      startMinutes = Math.max(0, Math.min(1425, startMinutes));

      setDraggingCurrentDay(currentDate);
      setDraggingCurrentMinutes(startMinutes);
    } else if (draggedTask) {
      const rect = e.currentTarget.getBoundingClientRect();
      const y = e.clientY - rect.top;

      const minutesFromMidnight = y / (HOUR_HEIGHT / 60) + dayStartHour * 60;
      let startMinutes = minutesFromMidnight;
      startMinutes = Math.round(startMinutes / 15) * 15;

      const maxMins = dayEndHour * 60 - draggedTask.estimatedDurationMinutes;
      startMinutes = Math.max(dayStartHour * 60, Math.min(maxMins, startMinutes));

      setTaskDragMinutes(startMinutes);
    }
  };

  const handleDragEnd = () => {
    setDraggingEventId(null);
    setDraggingCurrentDay(null);
    setDraggingCurrentMinutes(0);
    setTaskDragMinutes(null);
  };

  // Click & Drag targets coordinates
  const handleDropOnColumn = (e: React.DragEvent) => {
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
          const finalDateTime = new Date(currentDate);
          finalDateTime.setHours(Math.floor(snappedMinutes / 60), snappedMinutes % 60, 0, 0);
          onMoveEvent(data.id, finalDateTime);
        }
      } else if (data.type === "task" && data.id) {
        let finalMinutes = taskDragMinutes;
        if (finalMinutes === null) {
          const rect = e.currentTarget.getBoundingClientRect();
          const y = e.clientY - rect.top;
          const calculatedMins = y / (HOUR_HEIGHT / 60) + dayStartHour * 60;
          const minutesFromMidnight = Math.max(0, Math.min(1439, calculatedMins));
          finalMinutes = Math.round(minutesFromMidnight / 15) * 15;
        }
        const finalDateTime = new Date(currentDate);
        finalDateTime.setHours(Math.floor(finalMinutes / 60), finalMinutes % 60, 0, 0);
        onScheduleTask(data.id, finalDateTime);
      }
    } catch (err) {
      // Ignore parse validation errors
    } finally {
      handleDragEnd();
    }
  };

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

    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleResizePointerMove = (e: React.PointerEvent) => {
    if (!resizingEvent || !resizeInitialEnd) return;
    e.stopPropagation();

    const deltaY = e.clientY - resizeInitialY;
    const deltaMinutes = Math.round(deltaY / (HOUR_HEIGHT / 60) / 15) * 15;
    setResizingDeltaMinutes(deltaMinutes);
  };

  const handleResizePointerUp = (e: React.PointerEvent, eventId: string) => {
    if (!resizingEvent || !resizeInitialEnd) return;
    e.stopPropagation();

    const deltaY = e.clientY - resizeInitialY;
    const deltaMinutes = Math.round(deltaY / (HOUR_HEIGHT / 60) / 15) * 15;

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
      {/* Day header row */}
      <div
        className="grid border-b border-gray-150 dark:border-neutral-800 bg-gray-50/50 dark:bg-neutral-900/50"
        style={{ gridTemplateColumns: "56px 1fr" }}
      >
        <div /> {/* Corner cell Spacer */}
        <div className="py-4 px-6 text-left flex flex-col justify-center">
          <span className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-neutral-500 font-mono">
            {formatInTimezone(currentDate, "EEEE", timezone, locale)}
          </span>
          <h3 className="font-extrabold text-xl text-gray-900 dark:text-white mt-1">
            {format(currentDate, "MMMM d, yyyy")}
          </h3>
        </div>
      </div>

      {/* All-day Section */}
      {dayAllDayEvents.length > 0 && (
        <div
          className="grid border-b border-gray-150 dark:border-neutral-800 bg-amber-50/10 dark:bg-amber-950/5 p-3"
          style={{ gridTemplateColumns: "56px minmax(0, 1fr)" }}
        >
          <div className="flex items-center justify-center">
            <span className="text-[10px] font-extrabold uppercase font-mono tracking-wider text-amber-600 bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900/40 px-2 py-0.5 rounded">
              All Day
            </span>
          </div>
          <div className="px-4 space-y-1">
            {dayAllDayEvents.map((ev) => {
              const style = categoryStyles[ev.color || ev.category] || categoryStyles.meeting;
              return (
                <div
                  key={ev.id}
                  onClick={() => onSelectEvent(ev)}
                  className={`px-3 py-1.5 border text-xs font-semibold rounded-lg truncate cursor-pointer hover:shadow-sm transition ${style.bg} ${style.text} ${style.border}`}
                >
                  {ev.title}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Hourly View viewport */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden relative scrollbar-thin"
      >
        <div className="relative w-full" style={{ height: `${totalHours * HOUR_HEIGHT}px` }}>
          {/* Hour subdivision lines */}
          <div className="absolute inset-0 z-0 pointer-events-none">
            {hours.map((hr) => (
              <div
                key={hr}
                className="border-b border-gray-100 dark:border-neutral-800/40"
                style={{ height: `${HOUR_HEIGHT}px` }}
              />
            ))}
          </div>

          {/* Hour labels axis panel */}
          <div className="absolute left-0 top-0 bottom-0 w-14 border-r border-gray-150 dark:border-neutral-800 z-30 bg-white/95 dark:bg-neutral-900/95 font-mono text-[10px] text-gray-400 select-none">
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
            {hoveredMinutes !== null && selectionStartMinutes === null && (
              <div
                className="absolute right-1.5 bg-indigo-600 text-white font-mono text-[9px] px-1 py-0.5 rounded shadow-sm z-30 pointer-events-none opacity-95 whitespace-nowrap animate-fade-in"
                style={{
                  top: `${((hoveredMinutes - dayStartHour * 60) / 60) * HOUR_HEIGHT}px`,
                  transform: "translateY(-50%)",
                }}
              >
                {(() => {
                  const d = new Date(currentDate);
                  d.setHours(Math.floor(hoveredMinutes / 60), hoveredMinutes % 60, 0, 0);
                  return format(d, timeFormat === "24h" ? "HH:mm" : "h:mm a");
                })()}
              </div>
            )}
          </div>

          {/* Global hover dashed line spanning all columns */}
          {hoveredMinutes !== null && selectionStartMinutes === null && (
            <div
              className="absolute left-14 right-0 border-t border-dashed border-indigo-500/50 pointer-events-none z-30"
              style={{ top: `${((hoveredMinutes - dayStartHour * 60) / 60) * HOUR_HEIGHT}px` }}
            />
          )}

          {/* Main Column day canvas content */}
          <div
            onDragOver={handleDragOverOnColumn}
            onDragLeave={() => setTaskDragMinutes(null)}
            onDrop={handleDropOnColumn}
            onMouseDown={(e) => {
              const isInteractive =
                (e.target as HTMLElement).closest('[id^="day-event-card-"]') ||
                (e.target as HTMLElement).closest("button");
              if (isInteractive || isResizingRef.current || draggingEventId || draggedTask) return;
              if (e.button !== 0) return;

              const mins = getMinutesFromClientY(e.clientY, e.currentTarget);
              setSelectionStartMinutes(mins);
              setSelectionEndMinutes(mins);
            }}
            onMouseMove={(e) => {
              const isInteractive = (e.target as HTMLElement).closest(
                '[id^="day-event-card-"], [class*="event-card"], [class*="group/event"], button'
              );
              if (isInteractive) {
                setHoveredMinutes(null);
                return;
              }
              const mins = getMinutesFromClientY(e.clientY, e.currentTarget);
              setHoveredMinutes(mins);
              if (selectionStartMinutes !== null) {
                setSelectionEndMinutes(mins);
              }
            }}
            onMouseLeave={() => {
              setHoveredMinutes(null);
            }}
            className="absolute inset-y-0 left-14 right-0 z-10 cursor-pointer"
          >
            {/* Selection block visual overlay */}
            {(() => {
              const style = getSelectionBlockStyles();
              if (!style) return null;
              if (selectionStartMinutes === null || selectionEndMinutes === null) return null;

              const startM = Math.min(selectionStartMinutes, selectionEndMinutes);
              const endM = Math.max(selectionStartMinutes, selectionEndMinutes);
              const startD = new Date(currentDate);
              startD.setHours(Math.floor(startM / 60), startM % 60, 0, 0);
              const endD = new Date(currentDate);
              endD.setHours(Math.floor(endM / 60), endM % 60, 0, 0);

              return (
                <div
                  className="absolute left-0 right-0 bg-indigo-500/20 border-y-2 border-indigo-500/50 pointer-events-none z-30 animate-pulse"
                  style={style}
                >
                  <span className="absolute top-0.5 left-2 bg-indigo-600 text-white font-mono text-[9px] px-1 py-0.2 rounded shadow-xs select-none opacity-95 whitespace-nowrap">
                    Start: {format(startD, timeFormat === "24h" ? "HH:mm" : "h:mm a")}
                  </span>
                  <span className="absolute bottom-0.5 right-2 bg-indigo-600 text-white font-mono text-[9px] px-1 py-0.2 rounded shadow-xs select-none opacity-95 whitespace-nowrap">
                    End: {format(endD, timeFormat === "24h" ? "HH:mm" : "h:mm a")}
                  </span>
                </div>
              );
            })()}

            {/* Hourly hover/click cell interactive segments */}
            <div
              className={`absolute inset-0 z-0 flex flex-col pointer-events-none ${draggingEventId || selectionStartMinutes !== null ? "opacity-0" : ""}`}
            >
              {hours.map((hr) => {
                const isThisHourHovered =
                  hoveredMinutes !== null && Math.floor(hoveredMinutes / 60) === hr;

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
                    className="w-full border-b border-gray-100/30 dark:border-neutral-800/5 hover:bg-indigo-500/[0.04] dark:hover:bg-indigo-400/[0.04] cursor-pointer pointer-events-auto transition duration-75 flex items-start pl-2 text-[9px] font-mono font-medium text-slate-350 dark:text-neutral-650 tracking-wider group"
                    style={{ height: `${HOUR_HEIGHT}px` }}
                    id={`day-hour-slot-${hr}`}
                  >
                    <span className="opacity-0 group-hover:opacity-100 mt-1.5 text-indigo-600 dark:text-indigo-400 font-semibold transition-opacity duration-100 font-mono">
                      {LABELS_MAP[locale]?.hoverScheduleAt || "+ Click to schedule at"}{" "}
                      {isThisHourHovered
                        ? formatPreciseMins(hoveredMinutes)
                        : formatGridHour(hr, timeFormat)}
                    </span>
                  </div>
                );
              })}
            </div>
            {/* Background Block shades */}
            {showBackgroundEvents &&
              dayBackgroundEvents.map((bg) => {
                const pos = calculateEventPositionInTimeGrid(
                  { start: new Date(bg.start), end: new Date(bg.end) } as CalendarEvent,
                  currentDate,
                  dayStartHour,
                  dayEndHour
                );

                if ((pos as any).isFullyOutside) return null;

                const bgColors: Record<string, string> = {
                  break:
                    "bg-emerald-500/5 hover:bg-emerald-500/10 border-emerald-500/15 text-emerald-600 dark:text-emerald-400",
                  closed:
                    "bg-rose-500/5 hover:bg-rose-500/10 border-rose-500/15 text-rose-600 dark:text-rose-450",
                  holiday:
                    "bg-rose-500/5 hover:bg-rose-500/10 border-rose-500/15 text-rose-600 dark:text-rose-450",
                  unavailable:
                    "bg-neutral-500/5 hover:bg-neutral-500/10 border-neutral-500/15 text-neutral-400",
                  focus:
                    "bg-indigo-500/5 hover:bg-indigo-500/10 border-indigo-500/15 text-indigo-600 dark:text-indigo-400",
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
                        metadata: { isBackground: true, bgType: bg.type, opacity: bg.opacity },
                      } as any);
                    }}
                    className={`absolute left-4 right-4 border rounded-xl py-3 px-4 cursor-pointer hover:brightness-95 hover:shadow-xs select-none flex flex-col justify-start font-sans text-xs font-bold overflow-hidden leading-snug z-10 shadow-xs ${bgColors[bg.type]}`}
                    style={{ top: pos.top, height: pos.height }}
                    title={`${bg.title}: ${bgStartStr} - ${bgEndStr}`}
                  >
                    <span>⚠ {bg.title}</span>
                    <span className="text-[10px] opacity-75 font-mono font-medium mt-0.5">
                      Blocked ({bgStartStr} - {bgEndStr})
                    </span>
                  </div>
                );
              })}

            {/* Red / Blue Timeline indicator */}
            {showCurrentTimeIndicator &&
              isTodayColumn &&
              (() => {
                const displayTime = getDisplayTime(nowDate, timezone);
                const minutesFromMidnight = displayTime.hour * 60 + displayTime.minute;
                const dayStartMinutes = dayStartHour * 60;
                const dayEndMinutes = dayEndHour * 60;
                if (minutesFromMidnight < dayStartMinutes || minutesFromMidnight > dayEndMinutes)
                  return null;
                const lineOffset =
                  ((minutesFromMidnight - dayStartMinutes) / (dayEndMinutes - dayStartMinutes)) *
                  100;
                return (
                  <div
                    className="absolute left-0 right-0 z-30 flex items-center pointer-events-none"
                    style={{ top: `${lineOffset}%` }}
                  >
                    <div className="w-2.5 h-2.5 rounded-full bg-rose-600 ring-4 ring-rose-500/20 shadow-md ml-[-5px]" />
                    <div className="h-[2px] flex-1 bg-rose-600" />
                  </div>
                );
              })()}

            {/* Calendar Events (absolute layer) */}
            {displayedDayEvents.map((event) => {
              const pos = calculateEventPositionInTimeGrid(
                event,
                currentDate,
                dayStartHour,
                dayEndHour
              );
              if ((pos as any).isFullyOutside) return null;

              const isProvisional = !!event.isProvisional;
              const isDragging = event.id === draggingEventId;
              const isResizableEvent = event.isResizable !== false && !isProvisional && !isDragging;
              const style = categoryStyles[event.color || event.category] || categoryStyles.meeting;

              const layoutData = overlapLayoutMap.get(event.id) || { colIndex: 0, totalCols: 1 };
              const colWidth = 100 / layoutData.totalCols;
              const colLeft = layoutData.colIndex * colWidth;

              const showDetails = parseInt(pos.height) > 10;

              return (
                <div
                  key={event.id}
                  draggable={event.isDraggable !== false && !isResizeHandleActive}
                  onDragStart={(e) => handleDragEventStart(e, event.id, new Date(event.start))}
                  onDragEnd={handleDragEnd}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isResizingRef.current || isProvisional || isDragging) {
                      return;
                    }
                    onSelectEvent(event);
                  }}
                  className={`absolute rounded-r-xl rounded-l-none p-4 shadow-xs transition duration-200 select-none overflow-hidden ${
                    isProvisional
                      ? "pointer-events-none z-30 shadow-none"
                      : isDragging
                        ? "cursor-grabbing z-40 shadow-md ring-1 ring-black/5 dark:ring-white/10"
                        : "cursor-pointer active:cursor-grabbing hover:shadow-md hover:shadow-slate-100/50 group/card z-20"
                  } ${style.bg} ${style.text} ${style.border}`}
                  style={{
                    top: pos.top,
                    height: pos.height,
                    left: `${colLeft}%`,
                    width: `${colWidth - 1}%`,
                  }}
                  id={`day-event-card-${event.id}`}
                >
                  <div className="space-y-1.5 overflow-hidden h-full flex flex-col justify-start">
                    {/* Event Title */}
                    <h4 className="font-extrabold text-sm tracking-tight leading-tight line-clamp-2 shrink-0">
                      {event.title}
                    </h4>

                    {/* Event Times range */}
                    <p className="font-mono text-[10px] opacity-80 font-bold shrink-0">
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

                    {/* Location Badge */}
                    {showDetails && event.location && (
                      <p className="text-[10px] text-gray-500 dark:text-neutral-400 font-semibold truncate flex items-center gap-1 leading-none pt-0.5 shrink-0">
                        📍 <span>{event.location}</span>
                      </p>
                    )}

                    {/* Short Description */}
                    {showDetails && event.description && (
                      <p className="text-[10px] text-gray-400 dark:text-neutral-400 line-clamp-2 mt-1 leading-normal font-medium overflow-hidden">
                        {event.description}
                      </p>
                    )}
                  </div>

                  {/* Pull handler resize bar at bottom */}
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
                      className="absolute bottom-0 left-0 right-0 h-3 bg-transparent group-hover/card:bg-indigo-500/5 active:bg-indigo-555/20 cursor-ns-resize transition duration-150 flex items-center justify-center pointer-events-auto"
                      title="Drag to resize duration"
                    >
                      <span className="w-6 h-[3px] bg-indigo-500/40 rounded-full" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
