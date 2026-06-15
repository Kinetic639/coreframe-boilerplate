"use client";

import React from "react";
import { isSameMonth, isToday, isSameDay, format, startOfDay } from "date-fns";
import {
  CalendarEvent,
  BackgroundEvent,
  UnscheduledTask,
  SchedulerLocale,
} from "./scheduler-types";
import {
  eventIntersectsDay,
  eventSpansMultipleDays,
  getMonthGridDays,
  formatInTimezone,
  isHexColor,
  LABELS_MAP,
  moveEventToDate,
} from "./scheduler-utils";

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

const MONTH_EVENT_ROW_LIMIT = 4;
const MONTH_EVENT_ROW_MIN_HEIGHT = 158;
const MONTH_EVENT_SLOT_HEIGHT = 22;
const MONTH_MULTI_DAY_TOP_OFFSET = 34;
const OVERFLOW_EVENT_POINT_SIZE = 8;

type MonthSegment = {
  event: CalendarEvent;
  rowIndex: number;
  startCol: number;
  endCol: number;
  continuesBefore: boolean;
  continuesAfter: boolean;
};

type VisibleMonthSegment = MonthSegment & { lane: number };

type EventDragState = {
  eventId: string;
  startX: number;
  startY: number;
  isDragging: boolean;
  originEvent: CalendarEvent;
  originSegments: VisibleMonthSegment[];
  pointerOffsetX: number;
  pointerOffsetY: number;
  dragWidth: number;
};

type CommittedDragPreview = {
  eventId: string;
  targetDay: Date;
  originEvent: CalendarEvent;
  originSegments: VisibleMonthSegment[];
};

const getDayKey = (day: Date) => format(day, "yyyy-MM-dd");

function getOverflowEventShapeStyle(event: CalendarEvent, day: Date): React.CSSProperties {
  const dayStart = startOfDay(day).getTime();
  const continuesBefore = startOfDay(new Date(event.start)).getTime() < dayStart;
  const continuesAfter = startOfDay(new Date(event.end)).getTime() > dayStart;

  if (!continuesBefore && !continuesAfter) return {};

  const point = `${OVERFLOW_EVENT_POINT_SIZE}px`;
  const left = continuesBefore ? `${point} 0, ` : "0 0, ";
  const right = continuesAfter
    ? `calc(100% - ${point}) 0, 100% 50%, calc(100% - ${point}) 100%, `
    : "100% 0, 100% 100%, ";
  const bottomLeft = continuesBefore ? `${point} 100%, 0 50%` : "0 100%";

  return {
    clipPath: `polygon(${left}${right}${bottomLeft})`,
    paddingLeft: continuesBefore ? `${OVERFLOW_EVENT_POINT_SIZE + 8}px` : undefined,
    paddingRight: continuesAfter ? `${OVERFLOW_EVENT_POINT_SIZE + 8}px` : undefined,
  };
}

function getMonthEventColorStyle(color: string | undefined): React.CSSProperties | undefined {
  if (!isHexColor(color)) return undefined;

  const red = parseInt(color.slice(1, 3), 16);
  const green = parseInt(color.slice(3, 5), 16);
  const blue = parseInt(color.slice(5, 7), 16);
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;

  return {
    backgroundColor: color,
    borderColor: color,
    color: luminance > 0.62 ? "#1f2937" : "#ffffff",
  };
}

function getMonthEventGhostStyle(color: string | undefined): React.CSSProperties | undefined {
  if (!isHexColor(color)) return undefined;

  return {
    backgroundColor: `${color}24`,
    borderColor: color,
    boxShadow: `0 0 0 1px ${color}66, 0 8px 20px ${color}24`,
  };
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
  const [dragPointer, setDragPointer] = React.useState<{ x: number; y: number } | null>(null);
  const [committedDragPreview, setCommittedDragPreview] =
    React.useState<CommittedDragPreview | null>(null);
  const [openTooltipDay, setOpenTooltipDay] = React.useState<string | null>(null);
  const monthGridRef = React.useRef<HTMLDivElement | null>(null);
  const eventDragRef = React.useRef<EventDragState | null>(null);
  const pendingDragPointerRef = React.useRef<{ x: number; y: number } | null>(null);
  const dragPointerFrameRef = React.useRef<number | null>(null);
  const suppressNextEventClickRef = React.useRef(false);

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

  React.useEffect(() => {
    return () => {
      if (dragPointerFrameRef.current !== null) {
        window.cancelAnimationFrame(dragPointerFrameRef.current);
      }
    };
  }, []);

  const queueDragPointer = React.useCallback((x: number, y: number) => {
    pendingDragPointerRef.current = { x, y };

    if (dragPointerFrameRef.current !== null) return;

    dragPointerFrameRef.current = window.requestAnimationFrame(() => {
      dragPointerFrameRef.current = null;
      if (pendingDragPointerRef.current) {
        setDragPointer(pendingDragPointerRef.current);
      }
    });
  }, []);

  const clearDragPointer = React.useCallback(() => {
    pendingDragPointerRef.current = null;
    if (dragPointerFrameRef.current !== null) {
      window.cancelAnimationFrame(dragPointerFrameRef.current);
      dragPointerFrameRef.current = null;
    }
    setDragPointer(null);
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

  // Compute displayed events. During active drag the moving event leaves normal layout and is
  // rendered as an overlay, then after drop it briefly rejoins through the committed preview.
  const displayedEvents = React.useMemo(() => {
    if (draggedEventId && activeDragOverDay) {
      return events.filter((event) => event.id !== draggedEventId);
    }

    const preview = committedDragPreview;

    return events.map((event) => {
      if (preview?.eventId === event.id) {
        return moveEventToDate(event, preview.targetDay);
      }
      return event;
    });
  }, [events, draggedEventId, activeDragOverDay, committedDragPreview]);

  React.useEffect(() => {
    if (!committedDragPreview) return;

    const updatedEvent = events.find((event) => event.id === committedDragPreview.eventId);
    if (!updatedEvent) {
      setCommittedDragPreview(null);
      return;
    }

    if (
      startOfDay(new Date(updatedEvent.start)).getTime() ===
      startOfDay(committedDragPreview.targetDay).getTime()
    ) {
      setCommittedDragPreview(null);
    }
  }, [events, committedDragPreview]);

  React.useEffect(() => {
    if (!committedDragPreview) return;

    const timeout = window.setTimeout(() => {
      setCommittedDragPreview(null);
    }, 3000);

    return () => window.clearTimeout(timeout);
  }, [committedDragPreview]);

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
  const monthColumnCount = filteredHeadings.length;
  const monthRowCount = Math.ceil(days.length / monthColumnCount);

  const monthMultiDayLayout = React.useMemo(() => {
    const visibleSegments: VisibleMonthSegment[] = [];
    const segmentsByRow = new Map<number, MonthSegment[]>();
    const hiddenEventsByDay = new Map<string, CalendarEvent[]>();
    const visibleEventCountsByDay = new Map<string, number>();

    for (const day of days) {
      const key = getDayKey(day);
      hiddenEventsByDay.set(key, []);
      visibleEventCountsByDay.set(key, 0);
    }

    const sortEventsForMonth = (a: CalendarEvent, b: CalendarEvent) => {
      if (draggedEventId) {
        if (a.id === draggedEventId && b.id !== draggedEventId) return -1;
        if (b.id === draggedEventId && a.id !== draggedEventId) return 1;
      }

      const aStart = new Date(a.start).getTime();
      const bStart = new Date(b.start).getTime();
      if (aStart !== bStart) return aStart - bStart;

      const aDuration = new Date(a.end).getTime() - aStart;
      const bDuration = new Date(b.end).getTime() - bStart;
      if (aDuration !== bDuration) return bDuration - aDuration;

      return a.id.localeCompare(b.id);
    };

    const eventsByDay = new Map<string, CalendarEvent[]>();
    for (const day of days) {
      eventsByDay.set(
        getDayKey(day),
        displayedEvents.filter((event) => eventIntersectsDay(event, day)).sort(sortEventsForMonth)
      );
    }

    const getVisibleBudgetForDay = (day: Date) => {
      const total = eventsByDay.get(getDayKey(day))?.length ?? 0;
      return total > MONTH_EVENT_ROW_LIMIT
        ? Math.max(0, MONTH_EVENT_ROW_LIMIT - 1)
        : MONTH_EVENT_ROW_LIMIT;
    };

    const addHiddenEventForDay = (day: Date, event: CalendarEvent) => {
      const key = getDayKey(day);
      const hiddenEvents = hiddenEventsByDay.get(key) ?? [];
      if (!hiddenEvents.some((hiddenEvent) => hiddenEvent.id === event.id)) {
        hiddenEvents.push(event);
      }
      hiddenEventsByDay.set(key, hiddenEvents);
    };

    const getSegmentDays = (segment: Pick<MonthSegment, "rowIndex" | "startCol" | "endCol">) => {
      const rowDays = days.slice(
        segment.rowIndex * monthColumnCount,
        segment.rowIndex * monthColumnCount + monthColumnCount
      );
      return rowDays.slice(segment.startCol, segment.endCol + 1);
    };

    for (const event of [...displayedEvents].sort(sortEventsForMonth)) {
      for (let rowIndex = 0; rowIndex < monthRowCount; rowIndex += 1) {
        const rowDays = days.slice(
          rowIndex * monthColumnCount,
          rowIndex * monthColumnCount + monthColumnCount
        );
        const startCol = rowDays.findIndex((day) => eventIntersectsDay(event, day));
        if (startCol < 0) continue;
        const reverseEndCol = [...rowDays]
          .reverse()
          .findIndex((day) => eventIntersectsDay(event, day));
        const endCol = rowDays.length - 1 - reverseEndCol;
        const firstSegmentDay = rowDays[startCol];
        const lastSegmentDay = rowDays[endCol];

        const segment = {
          event,
          rowIndex,
          startCol,
          endCol,
          continuesBefore:
            startOfDay(new Date(event.start)).getTime() < startOfDay(firstSegmentDay).getTime(),
          continuesAfter:
            startOfDay(new Date(event.end)).getTime() > startOfDay(lastSegmentDay).getTime(),
        };
        const rowSegments = segmentsByRow.get(rowIndex) ?? [];
        rowSegments.push(segment);
        segmentsByRow.set(rowIndex, rowSegments);
      }
    }

    for (let rowIndex = 0; rowIndex < monthRowCount; rowIndex += 1) {
      const rowSegments = segmentsByRow.get(rowIndex) ?? [];
      const packedLanes: MonthSegment[][] = [];

      rowSegments
        .sort((a, b) => {
          if (draggedEventId) {
            if (a.event.id === draggedEventId && b.event.id !== draggedEventId) return -1;
            if (b.event.id === draggedEventId && a.event.id !== draggedEventId) return 1;
          }
          if (a.startCol !== b.startCol) return a.startCol - b.startCol;
          const aSpan = a.endCol - a.startCol;
          const bSpan = b.endCol - b.startCol;
          if (aSpan !== bSpan) return bSpan - aSpan;
          return sortEventsForMonth(a.event, b.event);
        })
        .forEach((segment) => {
          const laneIndex = packedLanes.findIndex((lane) =>
            lane.every(
              (laneSegment) =>
                segment.endCol < laneSegment.startCol || segment.startCol > laneSegment.endCol
            )
          );
          const targetLaneIndex = laneIndex >= 0 ? laneIndex : packedLanes.length;
          packedLanes[targetLaneIndex] = packedLanes[targetLaneIndex] ?? [];
          packedLanes[targetLaneIndex].push(segment);
        });

      packedLanes.forEach((lane, laneIndex) => {
        for (const segment of lane) {
          const segmentDays = getSegmentDays(segment);
          const segmentBudget = Math.min(...segmentDays.map(getVisibleBudgetForDay));
          const canShowWholeSegment =
            laneIndex < segmentBudget ||
            (draggedEventId !== null && segment.event.id === draggedEventId);

          if (canShowWholeSegment) {
            visibleSegments.push({
              ...segment,
              lane: Math.min(laneIndex, MONTH_EVENT_ROW_LIMIT - 1),
            });
            for (const day of segmentDays) {
              const key = getDayKey(day);
              visibleEventCountsByDay.set(key, (visibleEventCountsByDay.get(key) ?? 0) + 1);
            }
          } else {
            for (const day of segmentDays) {
              addHiddenEventForDay(day, segment.event);
            }
          }
        }
      });
    }

    return {
      segments: visibleSegments,
      hiddenEventsByDay,
      visibleEventCountsByDay,
    };
  }, [displayedEvents, days, monthColumnCount, monthRowCount, draggedEventId]);

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
    e.stopPropagation();
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
    } catch {
      // Ignore parser errors for other browser highlights
    }
  };

  const getDayFromGridPoint = React.useCallback(
    (clientX: number, clientY: number) => {
      const grid = monthGridRef.current;
      if (!grid) return null;

      const rect = grid.getBoundingClientRect();
      if (
        clientX < rect.left ||
        clientX > rect.right ||
        clientY < rect.top ||
        clientY > rect.bottom
      ) {
        return null;
      }

      const columnWidth = rect.width / monthColumnCount;
      const rowHeight = rect.height / monthRowCount;
      const columnIndex = Math.min(
        monthColumnCount - 1,
        Math.max(0, Math.floor((clientX - rect.left) / columnWidth))
      );
      const rowIndex = Math.min(
        monthRowCount - 1,
        Math.max(0, Math.floor((clientY - rect.top) / rowHeight))
      );

      return days[rowIndex * monthColumnCount + columnIndex] ?? null;
    },
    [days, monthColumnCount, monthRowCount]
  );

  const handleGridDragOver = (e: React.DragEvent) => {
    if (!draggedTask) return;
    const day = getDayFromGridPoint(e.clientX, e.clientY);
    if (!day) return;
    e.preventDefault();
    if (!activeDragOverDay || activeDragOverDay.getTime() !== day.getTime()) {
      setActiveDragOverDay(day);
    }
  };

  const handleGridDrop = (e: React.DragEvent) => {
    if (!draggedTask) return;
    const day = getDayFromGridPoint(e.clientX, e.clientY);
    if (!day) return;
    handleDrop(e, day);
  };

  const startEventPointerDrag = (e: React.MouseEvent, eventId: string) => {
    if (e.button !== 0) return;
    const originEvent = events.find((event) => event.id === eventId);
    if (!originEvent) return;
    const eventRect = e.currentTarget.getBoundingClientRect();

    e.preventDefault();
    e.stopPropagation();

    suppressNextEventClickRef.current = false;
    setCommittedDragPreview(null);
    eventDragRef.current = {
      eventId,
      startX: e.clientX,
      startY: e.clientY,
      isDragging: false,
      originEvent,
      originSegments: monthMultiDayLayout.segments.filter(
        (segment) => segment.event.id === eventId
      ),
      pointerOffsetX: e.clientX - eventRect.left,
      pointerOffsetY: e.clientY - eventRect.top,
      dragWidth: Math.min(Math.max(eventRect.width, 160), 420),
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const drag = eventDragRef.current;
      if (!drag) return;

      const distance = Math.hypot(moveEvent.clientX - drag.startX, moveEvent.clientY - drag.startY);
      if (!drag.isDragging && distance > 4) {
        drag.isDragging = true;
        setDraggedEventId(drag.eventId);
      }

      if (!drag.isDragging) return;
      queueDragPointer(moveEvent.clientX, moveEvent.clientY);
      const day = getDayFromGridPoint(moveEvent.clientX, moveEvent.clientY);
      if (day) {
        setActiveDragOverDay((currentDay) =>
          currentDay?.getTime() === day.getTime() ? currentDay : day
        );
      }
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      const drag = eventDragRef.current;
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);

      if (!drag?.isDragging) {
        eventDragRef.current = null;
        setDraggedEventId(null);
        setActiveDragOverDay(null);
        clearDragPointer();
        return;
      }
      suppressNextEventClickRef.current = true;

      const targetDay = getDayFromGridPoint(upEvent.clientX, upEvent.clientY);
      if (targetDay) {
        const originDay = startOfDay(new Date(drag.originEvent.start)).getTime();
        const targetTime = startOfDay(targetDay).getTime();

        if (originDay !== targetTime) {
          setCommittedDragPreview({
            eventId: drag.eventId,
            targetDay,
            originEvent: drag.originEvent,
            originSegments: drag.originSegments,
          });
          onMoveEvent(drag.eventId, targetDay);
        }
      }

      eventDragRef.current = null;
      setDraggedEventId(null);
      setActiveDragOverDay(null);
      clearDragPointer();
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const originGhostSegments =
    draggedEventId && eventDragRef.current?.originSegments
      ? eventDragRef.current.originSegments
      : (committedDragPreview?.originSegments ?? []);
  const dragOverlayEvent =
    draggedEventId && dragPointer
      ? (eventDragRef.current?.originEvent ?? events.find((event) => event.id === draggedEventId))
      : null;
  const isMonthEventDragActive = draggedEventId !== null;

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
        ref={monthGridRef}
        onDragOver={handleGridDragOver}
        onDrop={handleGridDrop}
        className={`grid ${filteredHeadings.length === 5 ? "grid-cols-5" : "grid-cols-7"} flex-1`}
        style={{
          gridTemplateRows: `repeat(${monthRowCount}, minmax(${MONTH_EVENT_ROW_MIN_HEIGHT}px, 1fr))`,
          minHeight: `${monthRowCount * MONTH_EVENT_ROW_MIN_HEIGHT}px`,
        }}
      >
        {days.map((day, idx) => {
          const rowIndex = Math.floor(idx / monthColumnCount);
          const columnIndex = idx % monthColumnCount;
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isTodayDate = isToday(day);

          // Events active on this cell date (ignoring times)
          const dayKey = getDayKey(day);

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
          const isEventDropTarget =
            isMonthEventDragActive &&
            activeDragOverDay !== null &&
            isSameDay(day, activeDragOverDay);

          const overflowEvents = monthMultiDayLayout.hiddenEventsByDay.get(dayKey) ?? [];
          const overflowCount = overflowEvents.length;
          const isTooltipOpen = openTooltipDay === dayKey;
          const visibleEventCount = monthMultiDayLayout.visibleEventCountsByDay.get(dayKey) ?? 0;
          const overflowTop =
            MONTH_MULTI_DAY_TOP_OFFSET +
            Math.min(visibleEventCount, MONTH_EVENT_ROW_LIMIT - 1) * MONTH_EVENT_SLOT_HEIGHT;
          const popupEvents = displayedEvents
            .filter((event) => eventIntersectsDay(event, day))
            .sort((a, b) => {
              const aMultiDay = eventSpansMultipleDays(a) ? 0 : 1;
              const bMultiDay = eventSpansMultipleDays(b) ? 0 : 1;
              if (aMultiDay !== bMultiDay) return aMultiDay - bMultiDay;

              const startDelta = new Date(a.start).getTime() - new Date(b.start).getTime();
              if (startDelta !== 0) return startDelta;

              const aDuration = new Date(a.end).getTime() - new Date(a.start).getTime();
              const bDuration = new Date(b.end).getTime() - new Date(b.start).getTime();
              if (aDuration !== bDuration) return bDuration - aDuration;

              return a.id.localeCompare(b.id);
            });

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
              className={`relative border-r border-b border-border p-1.5 flex flex-col min-h-16 h-full transition duration-150 group select-none cursor-pointer ${isTooltipOpen ? "overflow-visible" : "overflow-hidden"} ${
                isTooltipOpen
                  ? "z-[200]"
                  : isEventDropTarget
                    ? "bg-primary/10 ring-2 ring-inset ring-primary/30 z-10"
                    : isSelected
                      ? "bg-primary/10 ring-2 ring-inset ring-primary/40 z-10"
                      : "hover:bg-primary/[0.04] hover:ring-1 hover:ring-inset hover:ring-primary/15 hover:z-10"
              } ${
                isCurrentMonth
                  ? "bg-transparent"
                  : isSelected
                    ? ""
                    : "bg-muted/40 text-muted-foreground/50"
              } ${hasBackgroundBlocked && showBackgroundEvents ? "bg-rose-50/10 hover:bg-rose-50/20 dark:bg-rose-950/5 dark:hover:bg-rose-950/10" : ""}`}
              style={{
                gridColumn: columnIndex + 1,
                gridRow: rowIndex + 1,
              }}
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

              {draggedTask &&
                activeDragOverDay &&
                isSameDay(day, activeDragOverDay) &&
                (() => {
                  const style = getEventStyles(draggedTask.color || draggedTask.category);
                  const customStyle = getMonthEventColorStyle(draggedTask.color);
                  return (
                    <div
                      className={`pointer-events-none absolute left-1.5 right-1.5 z-40 h-5 rounded-md border px-2 py-0.5 text-[10px] font-semibold leading-4 truncate ${style.bg} ${style.text}`}
                      style={{
                        top: `${overflowTop}px`,
                        ...customStyle,
                      }}
                    >
                      <span className="truncate">{draggedTask.title}</span>
                    </div>
                  );
                })()}

              {/* Overflow indicator toggle */}
              {overflowCount > 0 && (
                <div
                  className="absolute left-1.5 right-1.5 z-30"
                  style={{ top: `${overflowTop}px` }}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const dayStr = dayKey;
                      setOpenTooltipDay((prev) => (prev === dayStr ? null : dayStr));
                    }}
                    className={`h-5 w-full text-left px-2 py-0.5 rounded-md bg-muted hover:bg-border text-[10px] font-medium text-muted-foreground transition duration-150 flex items-center gap-1.5 mt-0.5 cursor-pointer leading-4 ${isMonthEventDragActive ? "pointer-events-none opacity-30 saturate-50" : ""}`}
                  >
                    <span>+{overflowCount} more</span>
                  </button>

                  {/* Tooltip Popup - shown on click instead of hover */}
                  {isTooltipOpen && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 pb-1.5 flex flex-col z-[300] w-72 pointer-events-auto">
                      <div className="bg-popover border border-border shadow-xl rounded-xl p-3 flex flex-col">
                        <div className="font-bold text-xs mb-2 border-b border-border pb-2 text-foreground">
                          {formatInTimezone(day, "MMM d, yyyy", timezone, locale)}
                        </div>
                        <div className="flex flex-col gap-1 max-h-72 overflow-auto mb-2 custom-scrollbar">
                          {popupEvents.map((ev) => {
                            const style = getEventStyles(ev.color || ev.category);
                            const customStyle = getMonthEventColorStyle(ev.color);
                            const shapeStyle = getOverflowEventShapeStyle(ev, day);
                            return (
                              <div
                                key={ev.id}
                                onMouseDown={(e) => {
                                  if (ev.isDraggable === false) {
                                    e.stopPropagation();
                                    return;
                                  }
                                  setOpenTooltipDay(null);
                                  startEventPointerDrag(e, ev.id);
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (suppressNextEventClickRef.current) {
                                    suppressNextEventClickRef.current = false;
                                    return;
                                  }
                                  setOpenTooltipDay(null);
                                  onSelectEvent(ev);
                                }}
                                className={`min-h-6 rounded-md border px-3 py-1 text-[11px] font-semibold leading-4 hover:brightness-105 hover:ring-1 hover:ring-foreground/10 transition ${style.bg} ${style.text} ${ev.isDraggable === false ? "cursor-pointer" : "cursor-grab active:cursor-grabbing"}`}
                                style={{
                                  ...customStyle,
                                  ...shapeStyle,
                                }}
                              >
                                <span className="block truncate">{ev.title}</span>
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
          );
        })}
        {originGhostSegments.map((segment) => {
          const ghostStyle = getMonthEventGhostStyle(segment.event.color);

          return (
            <div
              key={`origin-ghost-${segment.event.id}-${segment.rowIndex}`}
              className="pointer-events-none z-[55] mx-1 h-5 rounded-md border-2 border-dashed bg-background/90 px-2 py-0.5 text-[10px] font-bold leading-4 text-foreground shadow-md ring-2 ring-background/80 backdrop-blur-[1px]"
              style={{
                gridColumn: `${segment.startCol + 1} / ${segment.endCol + 2}`,
                gridRow: segment.rowIndex + 1,
                alignSelf: "start",
                marginTop: `${MONTH_MULTI_DAY_TOP_OFFSET + segment.lane * MONTH_EVENT_SLOT_HEIGHT}px`,
                ...ghostStyle,
              }}
              aria-hidden="true"
            >
              <span className="truncate">{segment.event.title}</span>
            </div>
          );
        })}
        {dragOverlayEvent &&
          dragPointer &&
          (() => {
            const drag = eventDragRef.current;
            const style = getEventStyles(dragOverlayEvent.color || dragOverlayEvent.category);
            const customStyle = getMonthEventColorStyle(dragOverlayEvent.color);
            const left = dragPointer.x - (drag?.pointerOffsetX ?? 16);
            const top = dragPointer.y - (drag?.pointerOffsetY ?? 10);

            return (
              <div
                className={`pointer-events-none fixed left-0 top-0 z-[1000] h-5 rounded-md border px-2 py-0.5 text-[10px] font-semibold leading-4 truncate shadow-xl ring-2 ring-foreground/20 will-change-transform ${style.bg} ${style.text}`}
                style={{
                  width: `${drag?.dragWidth ?? 220}px`,
                  transform: `translate3d(${left}px, ${top}px, 0)`,
                  ...customStyle,
                }}
                aria-hidden="true"
              >
                <span className="truncate">{dragOverlayEvent.title}</span>
              </div>
            );
          })()}
        {monthMultiDayLayout.segments.map((segment) => {
          const style = getEventStyles(segment.event.color || segment.event.category);
          const customStyle = getMonthEventColorStyle(segment.event.color);
          const isDragging = segment.event.id === draggedEventId;
          const isBackgroundDuringDrag = isMonthEventDragActive && !isDragging;

          return (
            <div
              key={`${segment.event.id}-${segment.rowIndex}`}
              onMouseDown={(e) => {
                if (segment.event.isDraggable === false) {
                  e.stopPropagation();
                  return;
                }
                startEventPointerDrag(e, segment.event.id);
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (isDragging || suppressNextEventClickRef.current) {
                  suppressNextEventClickRef.current = false;
                  return;
                }
                onSelectEvent(segment.event);
              }}
              className={`z-40 mx-1 h-5 rounded-md border px-2 py-0.5 text-[10px] font-semibold transition duration-150 shadow-xs leading-4 truncate shrink-0 hover:z-50 hover:brightness-105 hover:ring-1 hover:ring-foreground/10 hover:shadow-sm ${style.bg} ${style.text} ${segment.event.isDraggable === false ? "cursor-pointer" : isDragging ? "cursor-grabbing opacity-80" : "cursor-grab active:cursor-grabbing"} ${isBackgroundDuringDrag ? "pointer-events-none opacity-[0.18] saturate-50 blur-[0.3px]" : ""}`}
              style={{
                gridColumn: `${segment.startCol + 1} / ${segment.endCol + 2}`,
                gridRow: segment.rowIndex + 1,
                alignSelf: "start",
                marginTop: `${MONTH_MULTI_DAY_TOP_OFFSET + segment.lane * MONTH_EVENT_SLOT_HEIGHT}px`,
                ...customStyle,
              }}
              id={`month-event-card-${segment.event.id}`}
              title={segment.event.title}
            >
              <span className="truncate">{segment.event.title}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
