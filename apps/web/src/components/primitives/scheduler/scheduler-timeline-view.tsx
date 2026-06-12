"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  format,
  startOfDay,
  addMinutes,
  differenceInMinutes,
  isSameDay,
  addHours,
  setHours,
  setMinutes,
} from "date-fns";
import {
  CalendarEvent,
  BackgroundEvent,
  SchedulerLocale,
  SchedulerTimezone,
  EventCategory,
} from "./scheduler-types";
import { SchedulerResource } from "./scheduler-resource-types";
import {
  getVisibleResourceTree,
  layoutRowEvents,
  FlatResourceNode,
  LanedEvent,
} from "./scheduler-resource-utils";
import { INITIAL_RESOURCES } from "./scheduler-demo-data";
import {
  Search,
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  Clock,
  MapPin,
  Users,
  Filter,
  Boxes,
  CircleDot,
  LayoutGrid,
  CalendarRange,
} from "lucide-react";
import {
  LABELS_MAP,
  detectAndLayoutGridEvents,
  getDisplayTime,
  formatGridHour,
} from "./scheduler-utils";

interface SchedulerTimelineViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  backgroundEvents: BackgroundEvent[];
  showBackgroundEvents: boolean;
  showCurrentTimeIndicator: boolean;
  dayStartHour: number;
  dayEndHour: number;
  locale: SchedulerLocale;
  timezone: SchedulerTimezone;
  timeFormat: "12h" | "24h";
  onSelectEvent: (event: CalendarEvent) => void;
  onCellClick: (date: Date, keepExactTime?: boolean, resourceId?: string, endDate?: Date) => void;
  onMoveEvent: (eventId: string, newStartDate: Date, newResourceId?: string) => void;
  onResizeEvent: (eventId: string, newEndDateTime: Date, newStartDateTime?: Date) => void;
  onScheduleTask: (taskId: string, targetDate: Date, resourceId?: string) => void;
  autoTimeScale?: boolean;
}

const SLOT_WIDTH = 90; // width of each 1-hour slot in pixels
const ROW_MIN_HEIGHT = 76; // minimum height of a row
const LANE_HEIGHT = 72; // height of each event lane inside a row
const GRID_HOUR_HEIGHT = 72; // height of 1 hour in grid view

// Styling category mapping
const CATEGORY_STYLES: Record<
  string,
  { bg: string; text: string; border: string; accent: string }
> = {
  meeting: {
    bg: "bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100/30",
    text: "text-indigo-700 dark:text-indigo-300",
    border: "border-indigo-150 dark:border-indigo-900/60",
    accent: "bg-indigo-500",
  },
  task: {
    bg: "bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100/30",
    text: "text-emerald-700 dark:text-emerald-300",
    border: "border-emerald-150 dark:border-emerald-900/60",
    accent: "bg-emerald-500",
  },
  workshop: {
    bg: "bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100/30",
    text: "text-amber-700 dark:text-amber-300",
    border: "border-amber-150 dark:border-amber-900/60",
    accent: "bg-amber-500",
  },
  warehouse: {
    bg: "bg-cyan-50 dark:bg-cyan-950/40 hover:bg-cyan-100/30",
    text: "text-cyan-700 dark:text-cyan-300",
    border: "border-cyan-150 dark:border-cyan-900/60",
    accent: "bg-cyan-500",
  },
  reminder: {
    bg: "bg-fuchsia-50 dark:bg-fuchsia-950/40 hover:bg-fuchsia-100/30",
    text: "text-fuchsia-700 dark:text-fuchsia-300",
    border: "border-fuchsia-150 dark:border-fuchsia-900/60",
    accent: "bg-fuchsia-500",
  },
  personal: {
    bg: "bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100/30",
    text: "text-rose-700 dark:text-rose-300",
    border: "border-rose-150 dark:border-rose-900/60",
    accent: "bg-rose-500",
  },
};

// Unified style getters for perfect symmetry across Grid and Timeline views
const getResourceBgStyle = (isActive: boolean) =>
  isActive ? "bg-indigo-50/50 dark:bg-indigo-950/25" : "";

const getResourceHeaderStyle = (isActive: boolean, borderPos: "r" | "b") => {
  if (!isActive) return "bg-white dark:bg-neutral-900";
  const borderClass =
    borderPos === "r"
      ? "border-r-[1.5px] border-r-indigo-500/70"
      : "border-b-[1.5px] border-b-indigo-500/70";
  return `bg-indigo-50/90 dark:bg-indigo-950/45 font-semibold text-indigo-950 dark:text-indigo-150 ${borderClass} shadow-inner`;
};

const getEventCardHighlightStyle = (isEventHovered: boolean, isResourceHovered: boolean) => {
  if (isEventHovered) {
    return "ring-[1.5px] ring-indigo-500/75 dark:ring-indigo-400/85 scale-[1.012] z-35 shadow-md brightness-105";
  }
  if (isResourceHovered) {
    // Symmetrical subtle highlight for sibling cards when resource is hovered
    return "ring-[1.2px] ring-indigo-500/40 dark:ring-indigo-400/50 scale-[1.006] z-30 shadow-xs brightness-[100.5%]";
  }
  return "";
};

export const SchedulerTimelineView: React.FC<SchedulerTimelineViewProps> = ({
  currentDate,
  events,
  backgroundEvents,
  showBackgroundEvents,
  showCurrentTimeIndicator,
  dayStartHour: propDayStartHour,
  dayEndHour: propDayEndHour,
  autoTimeScale = false,
  locale,
  timezone,
  timeFormat,
  onSelectEvent,
  onCellClick,
  onMoveEvent,
  onResizeEvent,
  onScheduleTask,
}) => {
  const label = LABELS_MAP[locale];

  // Resources States
  const [resources, setResources] = useState<SchedulerResource[]>(INITIAL_RESOURCES);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    new Set(INITIAL_RESOURCES.filter((r) => r.expanded).map((r) => r.id))
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [plannerViewMode, setPlannerViewMode] = useState<"timeline" | "grid">("timeline");

  // Grid-specific states and selection tree
  const [gridExpandedIds, setGridExpandedIds] = useState<Set<string>>(() => {
    const folderIds = new Set<string>();
    INITIAL_RESOURCES.forEach((r) => {
      const hasChildren = INITIAL_RESOURCES.some((child) => child.parentId === r.id);
      if (hasChildren) {
        folderIds.add(r.id);
      }
    });
    return folderIds;
  });

  const [gridSelectedIds, setGridSelectedIds] = useState<Set<string>>(() => {
    const leafIds = new Set<string>();
    INITIAL_RESOURCES.forEach((r) => {
      const hasChildren = INITIAL_RESOURCES.some((child) => child.parentId === r.id);
      if (!hasChildren) {
        leafIds.add(r.id);
      }
    });
    return leafIds;
  });

  const [gridSidebarOpen, setGridSidebarOpen] = useState(true);

  // Recursive helper to get descendant leaves for checking/unchecking folders in Grid View
  const getDescendantLeaves = React.useCallback(
    (parentId: string): string[] => {
      const leaves: string[] = [];
      const childrenMap = new Map<string, SchedulerResource[]>();
      resources.forEach((r) => {
        if (r.parentId) {
          const list = childrenMap.get(r.parentId) || [];
          list.push(r);
          childrenMap.set(r.parentId, list);
        }
      });

      function traverse(id: string) {
        const children = childrenMap.get(id) || [];
        if (children.length === 0) {
          leaves.push(id);
        } else {
          children.forEach((c) => traverse(c.id));
        }
      }

      traverse(parentId);
      return leaves;
    },
    [resources]
  );

  const handleToggleGridCheck = (resourceId: string, hasChildren: boolean) => {
    if (!hasChildren) {
      setGridSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(resourceId)) {
          next.delete(resourceId);
        } else {
          next.add(resourceId);
        }
        return next;
      });
    } else {
      const leaves = getDescendantLeaves(resourceId);
      const allChecked = leaves.every((id) => gridSelectedIds.has(id));
      setGridSelectedIds((prev) => {
        const next = new Set(prev);
        if (allChecked) {
          leaves.forEach((id) => next.delete(id));
        } else {
          leaves.forEach((id) => next.add(id));
        }
        return next;
      });
    }
  };

  // Real-time ticking state for indicators
  const [nowDate, setNowDate] = useState<Date>(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setNowDate(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Hover highlights between the sidebar tree and the main view
  const [hoveredEventId, setHoveredEventId] = useState<string | null>(null);
  const [hoveredResourceId, setHoveredResourceId] = useState<string | null>(null);

  // Dragging event state
  const [draggingEventId, setDraggingEventId] = useState<string | null>(null);
  const [dragOverRowId, setDragOverRowId] = useState<string | null>(null);
  const [dragOverTime, setDragOverTime] = useState<{ hours: number; minutes: number } | null>(null);

  // Resize live interactions state
  const [resizingEventId, setResizingEventId] = useState<string | null>(null);
  const [resizeEdge, setResizeEdge] = useState<"start" | "end" | null>(null);
  const [resizeInitialX, setResizeInitialX] = useState<number>(0);
  const [resizeInitialY, setResizeInitialY] = useState<number>(0);
  const [resizeInitialStart, setResizeInitialStart] = useState<Date | null>(null);
  const [resizeInitialEnd, setResizeInitialEnd] = useState<Date | null>(null);
  const [resizeDeltaMinutes, setResizeDeltaMinutes] = useState<number>(0);
  const [isHoveringHandle, setIsHoveringHandle] = useState(false);

  const gridWrapperRef = useRef<HTMLDivElement>(null);
  const isPointerInteracting = useRef(false);
  const isCurrentlyResizingRef = useRef(false);
  const dragGrabOffsetRef = useRef<number>(0);
  const isJustResizedRef = useRef<boolean>(false);

  // States for click & drag range selection in Resource Planning views
  const [timelineSelection, setTimelineSelection] = useState<{
    resourceId: string;
    startMins: number; // in range [dayStartHour * 60, dayEndHour * 60]
    endMins: number;
  } | null>(null);

  const [gridSelection, setGridSelection] = useState<{
    resourceId: string;
    startMins: number;
    endMins: number;
  } | null>(null);

  const [timelineHover, setTimelineHover] = useState<{
    resourceId: string;
    minutes: number;
  } | null>(null);

  const [gridHover, setGridHover] = useState<{
    resourceId: string;
    minutes: number;
  } | null>(null);

  const getMinutesFromClientX = (clientX: number, containerElement: HTMLElement) => {
    const rect = containerElement.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const totalHours = dayEndHour - dayStartHour;
    const minutesFromDayStart = (x / rect.width) * (totalHours * 60);
    const clickStartMinutes = dayStartHour * 60 + minutesFromDayStart;
    return Math.round(clickStartMinutes / 15) * 15; // snap to 15m intervals
  };

  // Effect to handle global mouse up for Horizontal Timeline drag select
  useEffect(() => {
    if (!timelineSelection) return;

    const handleGlobalMouseUp = () => {
      const sMins = Math.min(timelineSelection.startMins, timelineSelection.endMins);
      const eMins = Math.max(timelineSelection.startMins, timelineSelection.endMins);

      const startDate = startOfDay(currentDate);
      startDate.setHours(Math.floor(sMins / 60));
      startDate.setMinutes(sMins % 60);

      if (eMins - sMins >= 15) {
        const endDate = startOfDay(currentDate);
        endDate.setHours(Math.floor(eMins / 60));
        endDate.setMinutes(eMins % 60);

        onCellClick(startDate, true, timelineSelection.resourceId, endDate);
      } else {
        onCellClick(startDate, true, timelineSelection.resourceId);
      }

      setTimelineSelection(null);
    };

    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => {
      window.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, [timelineSelection, currentDate, onCellClick]);

  // Effect to handle global mouse up for Grid Column drag select
  useEffect(() => {
    if (!gridSelection) return;

    const handleGlobalMouseUp = () => {
      const sMins = Math.min(gridSelection.startMins, gridSelection.endMins);
      const eMins = Math.max(gridSelection.startMins, gridSelection.endMins);

      const startDate = startOfDay(currentDate);
      startDate.setHours(Math.floor(sMins / 60));
      startDate.setMinutes(sMins % 60);

      if (eMins - sMins >= 15) {
        const endDate = startOfDay(currentDate);
        endDate.setHours(Math.floor(eMins / 60));
        endDate.setMinutes(eMins % 60);

        onCellClick(startDate, true, gridSelection.resourceId, endDate);
      } else {
        onCellClick(startDate, true, gridSelection.resourceId);
      }

      setGridSelection(null);
    };

    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => {
      window.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, [gridSelection, currentDate, onCellClick]);

  useEffect(() => {
    const handleGlobalDragEnd = () => {
      setDraggingEventId(null);
      setDragOverRowId(null);
      setDragOverTime(null);
    };
    window.addEventListener("dragend", handleGlobalDragEnd);
    return () => {
      window.removeEventListener("dragend", handleGlobalDragEnd);
    };
  }, []);

  // Filter and flatten visible resources hierarchy
  const visibleResources = useMemo(() => {
    return getVisibleResourceTree(resources, expandedIds, searchQuery);
  }, [resources, expandedIds, searchQuery]);

  // Leaf columns for the GRID View - now consumes its own tree selection!
  const gridColumns = useMemo(() => {
    return resources
      .filter((r) => !resources.some((child) => child.parentId === r.id)) // only leaf nodes
      .filter((r) => gridSelectedIds.has(r.id))
      .map((r) => ({ resource: r, depth: 0, hasChildren: false }));
  }, [resources, gridSelectedIds]);

  // Expand / collapse trigger
  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Filter scheduled calendar events belonging to active timeline day
  const timelineEvents = useMemo(() => {
    return events.filter((ev) => isSameDay(new Date(ev.start), currentDate));
  }, [events, currentDate]);

  // Calculate dynamic start/end hour if autoTimeScale is true, based on visible resources' events on this day
  const { dayStartHour, dayEndHour } = useMemo(() => {
    if (!autoTimeScale) {
      return { dayStartHour: propDayStartHour, dayEndHour: propDayEndHour };
    }

    // Find events that belong to visible resources
    const visibleResourceIds = new Set(gridColumns.map((gc) => gc.resource.id));
    const dayEvents = timelineEvents.filter((ev) => {
      if (ev.allDay) return false;
      if (!ev.resourceId) return false;
      return visibleResourceIds.has(ev.resourceId);
    });

    if (dayEvents.length > 0) {
      const minStart = Math.min(...dayEvents.map((ev) => new Date(ev.start).getHours()));
      const maxEnd = Math.max(
        ...dayEvents.map((ev) => {
          const d = new Date(ev.end);
          return d.getMinutes() === 0 ? d.getHours() : d.getHours() + 1;
        })
      );
      return {
        dayStartHour: Math.max(0, minStart),
        dayEndHour: Math.min(24, maxEnd),
      };
    }

    return { dayStartHour: propDayStartHour, dayEndHour: propDayEndHour };
  }, [autoTimeScale, gridColumns, timelineEvents, propDayStartHour, propDayEndHour]);

  // List of hour labels for top scales
  const hoursScale = useMemo(() => {
    const list = [];
    for (let i = dayStartHour; i < dayEndHour; i++) {
      const labelText = formatGridHour(i, timeFormat);
      list.push({ hourIndex: i, label: labelText });
    }
    return list;
  }, [timeFormat, dayStartHour, dayEndHour]);

  // Dynamic state representation during mouse drag/resize transitions!
  const projectedTimelineEvents = useMemo(() => {
    return timelineEvents.map((ev) => {
      // 1. Live Resizing Event Projection
      if (resizingEventId === ev.id && resizeEdge) {
        let liveStart = new Date(ev.start);
        let liveEnd = new Date(ev.end);

        if (resizeEdge === "start" && resizeInitialStart) {
          liveStart = addMinutes(resizeInitialStart, resizeDeltaMinutes);
          const maxStart = addMinutes(new Date(ev.end), -15);
          if (liveStart > maxStart) liveStart = maxStart;
        } else if (resizeEdge === "end" && resizeInitialEnd) {
          liveEnd = addMinutes(resizeInitialEnd, resizeDeltaMinutes);
          const minEnd = addMinutes(new Date(ev.start), 15);
          if (liveEnd < minEnd) liveEnd = minEnd;
        }

        return {
          ...ev,
          start: liveStart,
          end: liveEnd,
        };
      }

      // 2. Live Dragging Event Projection
      if (draggingEventId === ev.id && dragOverRowId && dragOverTime) {
        const originalDuration = differenceInMinutes(new Date(ev.end), new Date(ev.start));

        const provisionalStart = startOfDay(currentDate);
        provisionalStart.setHours(dragOverTime.hours, dragOverTime.minutes, 0, 0);

        const provisionalEnd = addMinutes(provisionalStart, originalDuration);

        return {
          ...ev,
          resourceId: dragOverRowId,
          start: provisionalStart,
          end: provisionalEnd,
        };
      }
      return ev;
    });
  }, [
    timelineEvents,
    draggingEventId,
    dragOverRowId,
    dragOverTime,
    resizingEventId,
    resizeEdge,
    resizeInitialStart,
    resizeInitialEnd,
    resizeDeltaMinutes,
    currentDate,
  ]);

  // Group events by resources and layout coordinates to deal with overlaps (Timeline View)
  const layedOutEventsByResource = useMemo(() => {
    const map = new Map<string, LanedEvent<CalendarEvent>[]>();
    const grouped = new Map<string, CalendarEvent[]>();

    projectedTimelineEvents.forEach((ev) => {
      if (ev.resourceId) {
        const list = grouped.get(ev.resourceId) || [];
        list.push(ev);
        grouped.set(ev.resourceId, list);
      }
    });

    grouped.forEach((groupEvents, resourceId) => {
      map.set(resourceId, layoutRowEvents(groupEvents));
    });

    return map;
  }, [projectedTimelineEvents]);

  // Overlap map for Grid View per Column
  const columnEventsMap = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    projectedTimelineEvents.forEach((ev) => {
      if (ev.resourceId) {
        const list = map.get(ev.resourceId) || [];
        list.push(ev);
        map.set(ev.resourceId, list);
      }
    });
    return map;
  }, [projectedTimelineEvents]);

  const columnLayouts = useMemo(() => {
    const map = new Map<string, Map<string, { colIndex: number; totalCols: number }>>();
    gridColumns.forEach((res) => {
      const evs = (columnEventsMap.get(res.resource.id) || []).filter((ev) => !ev.allDay);
      map.set(res.resource.id, detectAndLayoutGridEvents(evs));
    });
    return map;
  }, [gridColumns, columnEventsMap]);

  // Check if any all-day events are active on this specific date
  const hasAnyAllDayEvents = useMemo(() => {
    return timelineEvents.some((ev) => ev.allDay);
  }, [timelineEvents]);

  // Match live current system time for red line indicator (Timeline)
  const currentTimePercentage = useMemo(() => {
    const displayTime = getDisplayTime(nowDate, timezone);
    const totalMins = displayTime.hour * 60 + displayTime.minute;
    const dayStartMins = dayStartHour * 60;
    const dayEndMins = dayEndHour * 60;
    if (totalMins < dayStartMins || totalMins > dayEndMins) return null;
    return ((totalMins - dayStartMins) / (dayEndMins - dayStartMins)) * 100;
  }, [nowDate, dayStartHour, dayEndHour, timezone]);

  // Vertical time line for Grid View
  const gridCurrentTimeY = useMemo(() => {
    const displayTime = getDisplayTime(nowDate, timezone);
    const totalMinutes = displayTime.hour * 60 + displayTime.minute;
    const dayStartMins = dayStartHour * 60;
    const dayEndMins = dayEndHour * 60;
    if (totalMinutes < dayStartMins || totalMinutes > dayEndMins) return null;
    return ((totalMinutes - dayStartMins) / 60) * GRID_HOUR_HEIGHT;
  }, [nowDate, dayStartHour, dayEndHour, timezone]);

  // Standard Drag & Drop helper logic (Timeline)
  const handleDragEventStart = (e: React.DragEvent<HTMLDivElement>, event: CalendarEvent) => {
    e.dataTransfer.setData("text/plain", JSON.stringify({ type: "event", id: event.id }));
    e.dataTransfer.effectAllowed = "move";

    // Suppress default ghost image by setting a custom 1x1px transparent GIF
    const img = new Image();
    img.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    e.dataTransfer.setDragImage(img, 0, 0);

    setDraggingEventId(event.id);

    const rect = e.currentTarget.getBoundingClientRect();
    const totalDurationMins = differenceInMinutes(new Date(event.end), new Date(event.start));

    if (plannerViewMode === "timeline") {
      const grabXPixels = e.clientX - rect.left;
      const grabOffsetMinutes = (grabXPixels / rect.width) * totalDurationMins;
      dragGrabOffsetRef.current = grabOffsetMinutes;
    } else {
      const grabYPixels = e.clientY - rect.top;
      const grabOffsetMinutes = (grabYPixels / rect.height) * totalDurationMins;
      dragGrabOffsetRef.current = grabOffsetMinutes;
    }
  };

  const handleDragEnd = () => {
    setDraggingEventId(null);
    setDragOverRowId(null);
    setDragOverTime(null);
  };

  const handleDragOverRow = (e: React.DragEvent, resourceId: string) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const totalHours = dayEndHour - dayStartHour;

    // Convert current mouse cursor's X coordinate to total minutes from the day start
    const minutesFromDayStart = (x / rect.width) * (totalHours * 60);

    // Subtract grabOffsetMinutes
    let targetMins = minutesFromDayStart - dragGrabOffsetRef.current;

    // Snap to 15 mins
    targetMins = Math.round(targetMins / 15) * 15;

    // Compute total minutes from midnight
    const dayStartMins = dayStartHour * 60;
    const dayEndMins = dayEndHour * 60;

    let duration = 60; // default for tasks/fallback
    if (draggingEventId) {
      const liveEv = events.find((ev) => ev.id === draggingEventId);
      if (liveEv) {
        duration = differenceInMinutes(new Date(liveEv.end), new Date(liveEv.start));
      }
    }

    // Clamp so the event doesn't slide outside the visible day boundaries
    const minMins = 0;
    const maxMins = totalHours * 60 - duration;
    const clampedMins = Math.max(minMins, Math.min(maxMins, targetMins));
    const finalMinsFromMidnight = clampedMins + dayStartMins;

    setDragOverRowId(resourceId);
    setDragOverTime({
      hours: Math.floor(finalMinsFromMidnight / 60),
      minutes: finalMinsFromMidnight % 60,
    });
  };

  // Drag & Drop helper logic (Grid View Column)
  const handleDragOverColumn = (e: React.DragEvent, resourceId: string) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;

    const minutesFromMidnight = (y / GRID_HOUR_HEIGHT) * 60 + dayStartHour * 60;
    // Subtract grabOffsetMinutes
    let startMinutes = minutesFromMidnight - dragGrabOffsetRef.current;

    // Snap to 15 mins
    startMinutes = Math.round(startMinutes / 15) * 15;

    // Clamp so the event doesn't slide outside of visible day hour boundaries
    let duration = 60; // default for tasks/fallback
    if (draggingEventId) {
      const liveEv = events.find((ev) => ev.id === draggingEventId);
      if (liveEv) {
        duration = differenceInMinutes(new Date(liveEv.end), new Date(liveEv.start));
      }
    }
    const dayStartMins = dayStartHour * 60;
    const dayEndMins = dayEndHour * 65; // expand buffer

    startMinutes = Math.max(dayStartMins, Math.min(dayEndMins - duration, startMinutes));

    setDragOverRowId(resourceId);
    setDragOverTime({
      hours: Math.floor(startMinutes / 60),
      minutes: startMinutes % 60,
    });
  };

  const handleDragLeaveRowOrColumn = () => {
    // Doing nothing prevents flickering when dragging over grid boundaries inside rows/columns,
    // keeping the position stable until a new dragover updates the coordinate or dragend clears it.
  };

  const handleDropOnRow = (e: React.DragEvent, resourceId: string) => {
    e.preventDefault();
    const draggedRowId = dragOverRowId;
    const draggedTime = dragOverTime;

    setDragOverRowId(null);
    setDragOverTime(null);
    setDraggingEventId(null);

    // Block drop on heading rows (resources that have children)
    const targetResource = resources.find((r) => r.id === resourceId);
    const targetHasChildren = targetResource
      ? resources.some((r) => r.parentId === targetResource.id)
      : false;
    if (targetHasChildren) {
      return;
    }

    try {
      const rawData = e.dataTransfer.getData("text/plain");
      if (!rawData) return;

      const payload = JSON.parse(rawData);

      const targetStart = startOfDay(currentDate);
      if (draggedTime) {
        targetStart.setHours(draggedTime.hours, draggedTime.minutes, 0, 0);
      } else {
        targetStart.setHours(dayStartHour, 0, 0, 0);
      }

      const verifiedResourceId = resourceId || draggedRowId || undefined;

      if (payload.type === "event" && payload.id) {
        onMoveEvent(payload.id, targetStart, verifiedResourceId);
      } else if (payload.type === "task" && payload.id) {
        onScheduleTask(payload.id, targetStart, verifiedResourceId);
      }
    } catch (err) {
      console.error("Drop error:", err);
    }
  };

  const handleDropOnColumn = (e: React.DragEvent, resourceId: string) => {
    e.preventDefault();
    const draggedColId = dragOverRowId;
    const draggedTime = dragOverTime;

    setDragOverRowId(null);
    setDragOverTime(null);
    setDraggingEventId(null);

    try {
      const rawData = e.dataTransfer.getData("text/plain");
      if (!rawData) return;

      const payload = JSON.parse(rawData);

      const targetStart = startOfDay(currentDate);
      if (draggedTime) {
        targetStart.setHours(draggedTime.hours, draggedTime.minutes, 0, 0);
      } else {
        targetStart.setHours(dayStartHour, 0, 0, 0);
      }

      const verifiedResourceId = resourceId || draggedColId || undefined;

      if (payload.type === "event" && payload.id) {
        onMoveEvent(payload.id, targetStart, verifiedResourceId);
      } else if (payload.type === "task" && payload.id) {
        onScheduleTask(payload.id, targetStart, verifiedResourceId);
      }
    } catch (err) {
      console.error("Column drop error:", err);
    }
  };

  // PointerResize helper functions (Live resizing start and end edges)
  const handleResizePointerDown = (
    e: React.PointerEvent,
    event: CalendarEvent,
    edge: "start" | "end"
  ) => {
    e.stopPropagation();
    e.preventDefault();
    isPointerInteracting.current = true;
    isCurrentlyResizingRef.current = true;

    setResizingEventId(event.id);
    setResizeEdge(edge);
    setResizeInitialX(e.clientX);
    setResizeInitialY(e.clientY);
    setResizeInitialStart(new Date(event.start));
    setResizeInitialEnd(new Date(event.end));
    setResizeDeltaMinutes(0);

    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleResizePointerMove = (e: React.PointerEvent) => {
    if (!isPointerInteracting.current || !resizingEventId || !resizeEdge) return;

    if (plannerViewMode === "timeline") {
      const deltaX = e.clientX - resizeInitialX;
      const totalTimelinePx = hoursScale.length * SLOT_WIDTH;
      const hoursCount = dayEndHour - dayStartHour;
      const minutesDelta = (deltaX / totalTimelinePx) * (hoursCount * 60);
      const snappedDelta = Math.round(minutesDelta / 15) * 15;
      setResizeDeltaMinutes(snappedDelta);
    } else {
      // In GRID mode, scaling is vertical!
      const deltaY = e.clientY - resizeInitialY;
      // 1 hour = GRID_HOUR_HEIGHT px (72px)
      // delta minutes = (deltaY / GRID_HOUR_HEIGHT) * 60 mins
      const minutesDelta = (deltaY / GRID_HOUR_HEIGHT) * 60;
      const snappedDelta = Math.round(minutesDelta / 15) * 15;
      setResizeDeltaMinutes(snappedDelta);
    }
  };

  const handleResizePointerUp = (e: React.PointerEvent) => {
    isPointerInteracting.current = false;
    isJustResizedRef.current = true;

    if (resizingEventId && resizeEdge) {
      const targetEvent = events.find((ev) => ev.id === resizingEventId);
      if (targetEvent) {
        if (resizeEdge === "start" && resizeInitialStart) {
          const newStart = addMinutes(resizeInitialStart, resizeDeltaMinutes);
          const maxStart = addMinutes(new Date(targetEvent.end), -15);
          const finalStart = newStart < maxStart ? newStart : maxStart;
          onResizeEvent(resizingEventId, new Date(targetEvent.end), finalStart);
        } else if (resizeEdge === "end" && resizeInitialEnd) {
          const newEnd = addMinutes(resizeInitialEnd, resizeDeltaMinutes);
          const minEnd = addMinutes(new Date(targetEvent.start), 15);
          const finalEnd = newEnd > minEnd ? newEnd : minEnd;
          onResizeEvent(resizingEventId, finalEnd, new Date(targetEvent.start));
        }
      }
    }

    setResizingEventId(null);
    setResizeEdge(null);
    setResizeInitialStart(null);
    setResizeInitialEnd(null);
    setResizeDeltaMinutes(0);

    setTimeout(() => {
      isCurrentlyResizingRef.current = false;
    }, 100);

    setTimeout(() => {
      isJustResizedRef.current = false;
    }, 150);

    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch (ignore) {}
  };

  // Convert dates boundaries to slot coordinates for Timeline view
  const getEventPositionStyles = (
    event: CalendarEvent,
    lane: number,
    totalLanes: number,
    rowMaxLanes?: number
  ) => {
    let startD = new Date(event.start);
    let endD = new Date(event.end);

    if (resizingEventId === event.id && resizeEdge) {
      if (resizeEdge === "start" && resizeInitialStart) {
        startD = addMinutes(resizeInitialStart, resizeDeltaMinutes);
        const maxStart = addMinutes(new Date(event.end), -15);
        if (startD > maxStart) startD = maxStart;
      } else if (resizeEdge === "end" && resizeInitialEnd) {
        endD = addMinutes(resizeInitialEnd, resizeDeltaMinutes);
        const minEnd = addMinutes(new Date(event.start), 15);
        if (endD < minEnd) endD = minEnd;
      }
    }

    const dayStart = startOfDay(currentDate);
    const startMins = Math.max(0, differenceInMinutes(startD, dayStart));
    const endMins = Math.min(1440, differenceInMinutes(endD, dayStart));

    const dayStartMins = dayStartHour * 60;
    const dayEndMins = dayEndHour * 60;
    const totalDayMins = dayEndMins - dayStartMins;

    const clampedStartMins = Math.max(dayStartMins, Math.min(dayEndMins, startMins));
    const clampedEndMins = Math.max(dayStartMins, Math.min(dayEndMins, endMins));
    const duration = Math.max(0, clampedEndMins - clampedStartMins);

    const leftPercent = ((clampedStartMins - dayStartMins) / totalDayMins) * 100;
    const widthPercent = (duration / totalDayMins) * 100;

    // Center the lanes inside the row height perfectly
    const maxLanes = rowMaxLanes !== undefined ? rowMaxLanes : totalLanes || 1;
    const actualH = Math.max(ROW_MIN_HEIGHT, maxLanes * LANE_HEIGHT + 4);
    const verticalStartOffset = (actualH - maxLanes * LANE_HEIGHT) / 2;

    // We want the event to fill the height nicely and be beautifully centered.
    // Margin of 3px from top/bottom inside the lane maintains a slight separation between lanes
    // but makes the event elements look full, deep, and centered.
    const marginY = 3;
    const topOffset = verticalStartOffset + lane * LANE_HEIGHT + marginY;
    const eventHeight = LANE_HEIGHT - 2 * marginY;

    return {
      left: `${leftPercent}%`,
      width: `${widthPercent}%`,
      top: `${topOffset}px`,
      height: `${eventHeight}px`,
    };
  };

  // Convert dates boundaries to slot coordinates for Grid column view
  const getGridEventPositionStyles = (event: CalendarEvent) => {
    let startD = new Date(event.start);
    let endD = new Date(event.end);

    if (resizingEventId === event.id && resizeEdge) {
      if (resizeEdge === "start" && resizeInitialStart) {
        startD = addMinutes(resizeInitialStart, resizeDeltaMinutes);
        const maxStart = addMinutes(new Date(event.end), -15);
        if (startD > maxStart) startD = maxStart;
      } else if (resizeEdge === "end" && resizeInitialEnd) {
        endD = addMinutes(resizeInitialEnd, resizeDeltaMinutes);
        const minEnd = addMinutes(new Date(event.start), 15);
        if (endD < minEnd) endD = minEnd;
      }
    }

    const dayStart = startOfDay(currentDate);
    const startMins = Math.max(0, differenceInMinutes(startD, dayStart));
    const endMins = Math.min(1440, differenceInMinutes(endD, dayStart));

    const dayStartMins = dayStartHour * 60;
    const dayEndMins = dayEndHour * 60;

    const clampedStart = Math.max(dayStartMins, Math.min(dayEndMins, startMins));
    const clampedEnd = Math.max(dayStartMins, Math.min(dayEndMins, endMins));
    const duration = Math.max(0, clampedEnd - clampedStart);

    const top = ((clampedStart - dayStartMins) / 60) * GRID_HOUR_HEIGHT;
    const height = (duration / 60) * GRID_HOUR_HEIGHT;

    return {
      top: `${top}px`,
      height: `${height}px`,
      isOutside: duration <= 0,
    };
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-neutral-950 transition-all text-slate-700 dark:text-neutral-300">
      {/* Search and Filters Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-b border-slate-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-3xs shrink-0">
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <Boxes className="text-indigo-600 dark:text-indigo-400" size={18} />
          <h3 className="font-bold text-sm text-slate-800 dark:text-white leading-none">
            {label.resourcePlanner || "Resource Planner"}
          </h3>
        </div>

        <div className="flex items-center flex-wrap gap-3 w-full sm:w-auto justify-end">
          {/* Switcher: Timeline View vs Grid View */}
          <div className="flex p-0.5 bg-slate-100 dark:bg-neutral-800 rounded-lg border border-slate-200/40 dark:border-neutral-700 text-xs font-semibold">
            {(["timeline", "grid"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => {
                  setPlannerViewMode(mode);
                  setDragOverRowId(null);
                  setDragOverTime(null);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all cursor-pointer capitalize text-[11px] font-bold ${
                  plannerViewMode === mode
                    ? "bg-white dark:bg-neutral-700 text-slate-800 dark:text-white shadow-xs font-extrabold"
                    : "text-slate-500 dark:text-neutral-400 hover:text-slate-700 dark:hover:text-neutral-300"
                }`}
              >
                {mode === "timeline" ? (
                  <>
                    <CalendarRange size={13} />
                    <span>{label.timelineView || "Timeline View"}</span>
                  </>
                ) : (
                  <>
                    <LayoutGrid size={13} />
                    <span>{label.gridView || "Grid View"}</span>
                  </>
                )}
              </button>
            ))}
          </div>

          <div className="h-4 w-px bg-slate-200 dark:bg-neutral-800 mx-0.5 hidden md:block"></div>

          {/* Realtime Search Field */}
          <div className="relative w-full sm:w-48">
            <Search
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-neutral-500"
              size={13}
            />
            <input
              type="text"
              placeholder={label.searchResources || "Search resources..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-neutral-800/60 border border-slate-200 dark:border-neutral-700 rounded-lg placeholder-slate-400 dark:placeholder-neutral-500 text-slate-800 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-indigo-500 transition-all font-medium"
            />
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden bg-white dark:bg-neutral-900 select-none relative">
        {/* Collapsible Left Sidebar for Resource Tree Selection */}
        <div
          className="shrink-0 flex bg-slate-50/45 dark:bg-neutral-900/45 h-full select-none transition-all duration-300 ease-in-out border-r border-slate-200/60 dark:border-neutral-800/80 z-20 overflow-hidden"
          style={{ width: gridSidebarOpen ? "274px" : "22px" }}
        >
          {/* Sidebar Content Tree */}
          <div
            className="flex-col h-full shrink-0 transition-all duration-300 overflow-hidden flex"
            style={{
              width: gridSidebarOpen ? "252px" : "0px",
              opacity: gridSidebarOpen ? 1 : 0,
            }}
          >
            {/* Sidebar Header */}
            <div className="p-3.5 border-b border-slate-100 dark:border-neutral-800 flex items-center justify-between">
              <span className="font-bold text-[10px] uppercase tracking-wider text-slate-450 dark:text-neutral-400">
                Resources
              </span>

              {/* Actions: All / None */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const allLeafIds = new Set<string>();
                    resources.forEach((r) => {
                      const hasChildren = resources.some((child) => child.parentId === r.id);
                      if (!hasChildren) allLeafIds.add(r.id);
                    });
                    setGridSelectedIds(allLeafIds);
                  }}
                  className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                >
                  All
                </button>
                <span className="text-[10px] text-slate-300 dark:text-neutral-700">|</span>
                <button
                  onClick={() => setGridSelectedIds(new Set())}
                  className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Recursive Sidebar Tree Panel */}
            <div className="flex-1 overflow-auto p-2 space-y-1 scrollbar-none">
              {(() => {
                const treeNodes = getVisibleResourceTree(resources, gridExpandedIds, searchQuery);

                if (treeNodes.length === 0) {
                  return (
                    <div className="text-center text-xs text-slate-400 dark:text-neutral-500 py-8 font-medium">
                      No resources found
                    </div>
                  );
                }

                return treeNodes.map((node) => {
                  const rId = node.resource.id;
                  const rName = node.resource.name;
                  const isExpanded = gridExpandedIds.has(rId);

                  const leaves = getDescendantLeaves(rId);
                  const checkedCount = leaves.filter((id) => gridSelectedIds.has(id)).length;
                  const isChecked = leaves.length > 0 && checkedCount === leaves.length;
                  const isIndeterminate = checkedCount > 0 && checkedCount < leaves.length;

                  const resourceEvents = timelineEvents.filter((ev) => ev.resourceId === rId);

                  return (
                    <React.Fragment key={rId}>
                      <div
                        key={rId}
                        onMouseEnter={() => setHoveredResourceId(rId)}
                        onMouseLeave={() => setHoveredResourceId(null)}
                        className={`flex items-center group py-1 rounded-lg transition-all cursor-pointer ${
                          hoveredResourceId === rId
                            ? "bg-indigo-50/70 dark:bg-indigo-950/35 border-l-[1.5px] border-l-indigo-500/70 font-semibold text-indigo-950 dark:text-indigo-150 shadow-3xs"
                            : "hover:bg-slate-100/60 dark:hover:bg-neutral-800/40"
                        }`}
                        style={{ paddingLeft: `${node.depth * 14 + 6}px` }}
                      >
                        {/* Chevron expand/collapse toggle for parent folders */}
                        {node.hasChildren ? (
                          <button
                            onClick={() => {
                              setGridExpandedIds((prev) => {
                                const next = new Set(prev);
                                if (next.has(rId)) {
                                  next.delete(rId);
                                } else {
                                  next.add(rId);
                                }
                                return next;
                              });
                            }}
                            className="p-0.5 text-slate-400 hover:text-slate-650 dark:hover:text-neutral-200 hover:bg-slate-200/60 dark:hover:bg-neutral-700 rounded transition shrink-0 cursor-pointer mr-0.5"
                          >
                            {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                          </button>
                        ) : (
                          <div className="w-[18px] shrink-0" />
                        )}

                        {/* Beautiful Checkbox */}
                        <div className="flex items-center mr-2 relative">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            ref={(el) => {
                              if (el) {
                                el.indeterminate = isIndeterminate;
                              }
                            }}
                            onChange={() => handleToggleGridCheck(rId, node.hasChildren)}
                            className="h-3.5 w-3.5 rounded border-slate-300 dark:border-neutral-700 text-indigo-600 dark:text-indigo-500 focus:ring-indigo-500 cursor-pointer accent-indigo-600 transition"
                          />
                        </div>

                        {/* Resource Name Label */}
                        <button
                          onClick={() => handleToggleGridCheck(rId, node.hasChildren)}
                          className="flex items-center gap-1.5 text-left flex-1 min-w-0 select-none cursor-pointer"
                        >
                          {!node.hasChildren && node.resource.color && (
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0 shadow-3xs"
                              style={{ backgroundColor: node.resource.color }}
                            />
                          )}
                          <span
                            className={`text-[11px] font-medium leading-tight truncate ${
                              isChecked || isIndeterminate
                                ? "text-slate-800 dark:text-neutral-150 font-semibold"
                                : "text-slate-450 dark:text-neutral-500"
                            }`}
                          >
                            {rName}
                          </span>
                        </button>
                      </div>

                      {/* Nested Events list under this resource (always display if leaf node exists) */}
                      {!node.hasChildren && resourceEvents.length > 0 && (
                        <div
                          className="space-y-1 mt-1 mb-1.5 mr-2 font-sans animate-fade-in"
                          style={{ paddingLeft: `${node.depth * 14 + 46}px` }}
                        >
                          {resourceEvents.map((event) => {
                            const isSelectedEvent = hoveredEventId === event.id;
                            const resColor = node.resource.color || "#6366f1";
                            return (
                              <div
                                key={event.id}
                                onMouseEnter={() => {
                                  setHoveredEventId(event.id);
                                  setHoveredResourceId(rId);
                                }}
                                onMouseLeave={() => {
                                  setHoveredEventId(null);
                                  setHoveredResourceId(null);
                                }}
                                style={{
                                  backgroundColor: isSelectedEvent
                                    ? `${resColor}15`
                                    : "transparent",
                                  borderColor: isSelectedEvent ? `${resColor}45` : "transparent",
                                  color: isSelectedEvent ? resColor : "inherit",
                                }}
                                className={`flex items-center py-1 px-2.5 rounded-md text-xs cursor-pointer transition-all border border-transparent ${
                                  isSelectedEvent
                                    ? "border-l-2 shadow-xs font-semibold"
                                    : "text-slate-500/90 dark:text-neutral-450 hover:bg-slate-100/35 dark:hover:bg-neutral-800/15"
                                }`}
                              >
                                <span className="truncate flex-1 font-medium leading-none">
                                  {event.title}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </React.Fragment>
                  );
                });
              })()}
            </div>

            {/* Sidebar Footer Info */}
            <div className="p-3 border-t border-slate-100 dark:border-neutral-800 text-[9px] font-bold text-slate-400 dark:text-neutral-500 uppercase tracking-widest text-center shrink-0">
              {gridColumns.length} active resources
            </div>
          </div>

          {/* Sleek Vertical Stripped Collapse Handle */}
          <div
            onClick={() => setGridSidebarOpen(!gridSidebarOpen)}
            className="w-[21px] flex flex-col items-center justify-center cursor-pointer bg-slate-100/30 hover:bg-slate-200/40 dark:bg-neutral-800/5 dark:hover:bg-neutral-800/15 border-l border-slate-200/45 dark:border-neutral-800/40 transition-colors select-none h-full shrink-0 relative group/strip"
            title={gridSidebarOpen ? "Collapse Resources" : "Expand Resources"}
          >
            {/* Minimal vertical line hover highlight */}
            <div className="absolute inset-y-0 left-0 w-[1.5px] bg-indigo-500/0 group-hover/strip:bg-indigo-500/20 transition-all rounded-r" />

            {/* Subtle center capsule toggle element - perfectly centered, inside strip with comfortable clearance */}
            <div className="w-4 h-9 flex items-center justify-center bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700/80 rounded-md shadow-3xs text-slate-400 group-hover/strip:text-indigo-600 dark:group-hover/strip:text-indigo-400 transition-all font-bold pointer-events-none shrink-0 z-35 relative">
              {gridSidebarOpen ? <ChevronLeft size={10} /> : <ChevronRight size={10} />}
            </div>
          </div>
        </div>

        {/* Unified Main Content Area Wrapper */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {plannerViewMode === "timeline" ? (
            /* ======================== TIMELINE VIEW ======================== */
            <div
              ref={gridWrapperRef}
              className="flex-1 overflow-auto relative select-none"
              onDragOver={(e) => e.preventDefault()}
            >
              <div className="min-w-max flex flex-col">
                {/* Timeline header: Resource on left, Hours ruler scale on right */}
                <div className="flex sticky top-0 z-30 bg-white dark:bg-neutral-900 border-b border-slate-100 dark:border-neutral-800 min-w-max">
                  {/* Left Header */}
                  <div className="w-[220px] shrink-0 p-4 border-r border-slate-100 dark:border-neutral-800 flex items-center justify-between font-extrabold text-[11px] text-slate-400 dark:text-neutral-500 uppercase tracking-widest bg-slate-50/50 dark:bg-neutral-900/50 sticky left-0 z-40">
                    <span>Resources</span>
                    <span className="text-[10px] font-medium text-slate-350">
                      ({gridColumns.length})
                    </span>
                  </div>

                  {/* Right Hours Ruler */}
                  <div
                    className="flex bg-slate-50/50 dark:bg-neutral-900/50 relative flex-none"
                    style={{ width: `${hoursScale.length * SLOT_WIDTH}px` }}
                  >
                    {hoursScale.map(({ hourIndex, label: hourText }) => (
                      <div
                        key={hourIndex}
                        onClick={() => {
                          const slottedDate = startOfDay(currentDate);
                          slottedDate.setHours(hourIndex);
                          onCellClick(slottedDate, true);
                        }}
                        className="w-[90px] h-12 p-3 font-mono text-[11px] text-slate-400 dark:text-neutral-500 border-r border-slate-100 dark:border-neutral-800 flex items-center justify-center font-bold hover:bg-indigo-50/20 dark:hover:bg-neutral-800/40 cursor-pointer transition select-none"
                        style={{ width: `${SLOT_WIDTH}px` }}
                      >
                        {hourText}
                      </div>
                    ))}

                    {/* Hover active indicator time text badge inside top hours ruler */}
                    {timelineHover && !timelineSelection && (
                      <div
                        className="absolute bg-indigo-600 text-white font-mono text-[9px] px-1.5 py-0.5 rounded shadow-sm z-50 pointer-events-none opacity-95 whitespace-nowrap animate-fade-in"
                        style={{
                          left: `${(timelineHover.minutes - dayStartHour * 60) * (SLOT_WIDTH / 60)}px`,
                          transform: "translateX(-50%)",
                          top: "8px",
                        }}
                      >
                        {(() => {
                          const d = new Date(currentDate);
                          d.setHours(
                            Math.floor(timelineHover.minutes / 60),
                            timelineHover.minutes % 60,
                            0,
                            0
                          );
                          return format(d, timeFormat === "24h" ? "HH:mm" : "h:mm a");
                        })()}
                      </div>
                    )}
                  </div>
                </div>

                {/* Timeline Body Rows */}
                <div className="flex flex-col min-w-max divide-y divide-slate-100 dark:divide-neutral-800/60 relative">
                  {/* Global vertical dashed line across all resource rows */}
                  {timelineHover && !timelineSelection && (
                    <div
                      className="absolute top-0 bottom-0 border-l border-dashed border-indigo-500/50 pointer-events-none z-30"
                      style={{
                        left: `${220 + (timelineHover.minutes - dayStartHour * 60) * (SLOT_WIDTH / 60)}px`,
                      }}
                    />
                  )}
                  {gridColumns.length === 0 ? (
                    <div className="flex-grow flex flex-col items-center justify-center p-12 py-24 text-slate-400 dark:text-neutral-500 font-sans bg-white dark:bg-neutral-900/40">
                      <CalendarRange
                        size={32}
                        className="text-slate-300 dark:text-neutral-700 mb-3 animate-pulse shrink-0"
                      />
                      <p className="text-xs font-bold text-slate-705 dark:text-neutral-200">
                        No Resources Selected
                      </p>
                      <p className="text-[11px] text-slate-400 dark:text-neutral-500 mt-1 text-center max-w-xs leading-normal font-medium">
                        Select resources from the left Resources panel to show their timeline.
                      </p>
                    </div>
                  ) : (
                    gridColumns.map(({ resource }) => {
                      const hasColoredIndicator = !!resource.color;

                      // Get pre-grouped scheduled events for this row
                      const rowLanedEvents = layedOutEventsByResource.get(resource.id) || [];
                      const maxLanes =
                        rowLanedEvents.length > 0
                          ? Math.max(...rowLanedEvents.map((le) => le.totalLanes))
                          : 1;

                      const rowHeight = maxLanes * LANE_HEIGHT + 4;

                      const isResourceHovered = hoveredResourceId === resource.id;
                      return (
                        <div
                          key={resource.id}
                          onMouseEnter={() => setHoveredResourceId(resource.id)}
                          onMouseLeave={() => setHoveredResourceId(null)}
                          className={`flex items-stretch bg-white dark:bg-neutral-900 border-b border-dashed border-slate-100 dark:border-neutral-800/40 transition-colors min-h-[76px] hover:bg-slate-50/35 dark:hover:bg-neutral-900/15 group/row ${
                            dragOverRowId === resource.id
                              ? "bg-indigo-50/15 dark:bg-indigo-950/25 ring-2 ring-indigo-500/20 ring-inset"
                              : ""
                          } ${getResourceBgStyle(isResourceHovered)}`}
                          style={{ height: `${Math.max(ROW_MIN_HEIGHT, rowHeight)}px` }}
                        >
                          {/* Sticky Left Resource Panel */}
                          <div
                            className={`w-[220px] shrink-0 px-4 border-r border-slate-150/45 dark:border-neutral-800 sticky left-0 z-35 flex gap-2 select-none shadow-[2px_0_5px_-3px_rgba(0,0,0,0.03)] py-3 items-center transition-colors ${getResourceHeaderStyle(
                              isResourceHovered,
                              "r"
                            )}`}
                          >
                            <div className="flex flex-col truncate leading-tight w-full">
                              <div className="flex items-center gap-1.5 truncate">
                                {hasColoredIndicator && (
                                  <span
                                    className="w-2.5 h-2.5 rounded-full shrink-0 inline-block shadow-3xs"
                                    style={{ backgroundColor: resource.color }}
                                  />
                                )}
                                <span className="text-xs font-bold font-sans text-slate-900 dark:text-neutral-100">
                                  {resource.name}
                                </span>
                              </div>
                              {resource.description && (
                                <span className="text-[10px] text-slate-500 dark:text-neutral-400 font-medium leading-tight truncate mt-0.5 animate-fade-in font-sans">
                                  {resource.description}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Right Timeline Lane Content */}
                          <div
                            className={`shrink-0 flex-none relative overflow-hidden h-full cursor-pointer transition-colors ${
                              isResourceHovered
                                ? "bg-indigo-50/50 dark:bg-indigo-950/25"
                                : "hover:bg-slate-50/20 dark:hover:bg-neutral-800/10"
                            }`}
                            style={{ width: `${hoursScale.length * SLOT_WIDTH}px` }}
                            onDragOver={(e) => handleDragOverRow(e, resource.id)}
                            onDragLeave={handleDragLeaveRowOrColumn}
                            onDrop={(e) => handleDropOnRow(e, resource.id)}
                            onMouseDown={(e) => {
                              const isInteractive =
                                (e.target as HTMLElement).closest('[class*="group/event"]') ||
                                (e.target as HTMLElement).closest("button");
                              if (isInteractive || resizingEventId || draggingEventId) return;
                              if (e.button !== 0) return;

                              const mins = getMinutesFromClientX(e.clientX, e.currentTarget);
                              setTimelineSelection({
                                resourceId: resource.id,
                                startMins: mins,
                                endMins: mins,
                              });
                            }}
                            onMouseMove={(e) => {
                              const isInteractive = (e.target as HTMLElement).closest(
                                '[class*="group/event"], [class*="event-card"], button'
                              );
                              if (isInteractive) {
                                setTimelineHover(null);
                                return;
                              }
                              const mins = getMinutesFromClientX(e.clientX, e.currentTarget);
                              setTimelineHover({ resourceId: resource.id, minutes: mins });
                              if (
                                timelineSelection &&
                                timelineSelection.resourceId === resource.id
                              ) {
                                setTimelineSelection((prev) =>
                                  prev ? { ...prev, endMins: mins } : null
                                );
                              }
                            }}
                            onMouseLeave={() => {
                              setTimelineHover(null);
                            }}
                          >
                            {/* Selection block horizontal overlay */}
                            {(() => {
                              if (
                                !timelineSelection ||
                                timelineSelection.resourceId !== resource.id
                              )
                                return null;
                              const sMins = Math.min(
                                timelineSelection.startMins,
                                timelineSelection.endMins
                              );
                              const eMins = Math.max(
                                timelineSelection.startMins,
                                timelineSelection.endMins
                              );

                              const totalDayMins = (dayEndHour - dayStartHour) * 60;
                              const dayStartMins = dayStartHour * 60;

                              const leftPercent = ((sMins - dayStartMins) / totalDayMins) * 100;
                              const widthPercent = ((eMins - sMins) / totalDayMins) * 100;

                              const startD = new Date(currentDate);
                              startD.setHours(Math.floor(sMins / 60), sMins % 60, 0, 0);
                              const endD = new Date(currentDate);
                              endD.setHours(Math.floor(eMins / 60), eMins % 60, 0, 0);

                              return (
                                <div
                                  className="absolute top-0 bottom-0 bg-indigo-500/20 border-x-2 border-indigo-500/50 pointer-events-none z-30 animate-pulse"
                                  style={{
                                    left: `${leftPercent}%`,
                                    width: `${widthPercent}%`,
                                  }}
                                >
                                  <span className="absolute left-1 top-0.5 bg-indigo-600 text-white font-mono text-[9px] px-1 py-0.2 rounded shadow-xs select-none opacity-95 whitespace-nowrap">
                                    Start:{" "}
                                    {format(startD, timeFormat === "24h" ? "HH:mm" : "h:mm a")}
                                  </span>
                                  <span className="absolute right-1 bottom-0.5 bg-indigo-600 text-white font-mono text-[9px] px-1 py-0.2 rounded shadow-xs select-none opacity-95 whitespace-nowrap">
                                    End: {format(endD, timeFormat === "24h" ? "HH:mm" : "h:mm a")}
                                  </span>
                                </div>
                              );
                            })()}

                            {/* Vertical Grid Background lines */}
                            <div className="absolute inset-0 flex pointer-events-none">
                              {hoursScale.map(({ hourIndex }) => (
                                <div
                                  key={hourIndex}
                                  className="h-full border-r border-gray-100 dark:border-neutral-800/40"
                                  style={{ width: `${SLOT_WIDTH}px` }}
                                />
                              ))}
                            </div>

                            {/* Drop Feedback Tooltip Overlay removed as requested */}

                            {/* Background events (underlay) */}
                            {showBackgroundEvents &&
                              backgroundEvents
                                .filter((bg) => !bg.resourceId || bg.resourceId === resource.id)
                                .map((bg) => {
                                  const bgStart = new Date(bg.start);
                                  const bgEnd = new Date(bg.end);

                                  const dayStart = startOfDay(currentDate);
                                  const startMins = Math.max(
                                    0,
                                    differenceInMinutes(bgStart, dayStart)
                                  );
                                  const endMins = Math.min(
                                    1440,
                                    differenceInMinutes(bgEnd, dayStart)
                                  );
                                  const dayStartMins = dayStartHour * 60;
                                  const dayEndMins = dayEndHour * 60;
                                  const totalDayMins = dayEndMins - dayStartMins;

                                  const clampedStartMins = Math.max(
                                    dayStartMins,
                                    Math.min(dayEndMins, startMins)
                                  );
                                  const clampedEndMins = Math.max(
                                    dayStartMins,
                                    Math.min(dayEndMins, endMins)
                                  );
                                  const dur = Math.max(0, clampedEndMins - clampedStartMins);

                                  const lPercent =
                                    ((clampedStartMins - dayStartMins) / totalDayMins) * 100;
                                  const wPercent = (dur / totalDayMins) * 100;

                                  if (dur <= 0) return null;

                                  return (
                                    <div
                                      key={bg.id}
                                      className="absolute h-full bg-slate-100/50 dark:bg-neutral-800/40 pointer-events-none opacity-40"
                                      style={{
                                        left: `${lPercent}%`,
                                        width: `${wPercent}%`,
                                        borderLeft: "1px solid rgba(220, 38, 38, 0.1)",
                                        borderRight: "1px solid rgba(220, 38, 38, 0.1)",
                                      }}
                                      title={`${bg.title} (${bg.type})`}
                                    />
                                  );
                                })}

                            {/* Scheduled Active Events Render */}
                            {rowLanedEvents.map(({ event, lane, totalLanes }) => {
                              const stylePreset =
                                CATEGORY_STYLES[event.color || event.category] ||
                                CATEGORY_STYLES.meeting;
                              const pos = getEventPositionStyles(event, lane, totalLanes, maxLanes);

                              let liveStart = new Date(event.start);
                              let liveEnd = new Date(event.end);
                              if (resizingEventId === event.id && resizeEdge) {
                                if (resizeEdge === "start" && resizeInitialStart) {
                                  liveStart = addMinutes(resizeInitialStart, resizeDeltaMinutes);
                                  const maxStart = addMinutes(new Date(event.end), -15);
                                  if (liveStart > maxStart) liveStart = maxStart;
                                } else if (resizeEdge === "end" && resizeInitialEnd) {
                                  liveEnd = addMinutes(resizeInitialEnd, resizeDeltaMinutes);
                                  const minEnd = addMinutes(new Date(event.start), 15);
                                  if (liveEnd < minEnd) liveEnd = minEnd;
                                }
                              }

                              const formattedStart = format(
                                liveStart,
                                timeFormat === "24h" ? "HH:mm" : "p"
                              );
                              const formattedEnd = format(
                                liveEnd,
                                timeFormat === "24h" ? "HH:mm" : "p"
                              );

                              const isCurrentlyResizing = resizingEventId === event.id;
                              const isCurrentlyDragging = draggingEventId === event.id;

                              return (
                                <div
                                  key={event.id}
                                  draggable={
                                    event.isDraggable !== false &&
                                    !isCurrentlyResizing &&
                                    !isHoveringHandle
                                  }
                                  onDragStart={(e) => handleDragEventStart(e, event)}
                                  onDragEnd={handleDragEnd}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (
                                      isCurrentlyDragging ||
                                      isCurrentlyResizingRef.current ||
                                      isJustResizedRef.current
                                    )
                                      return;
                                    onSelectEvent(event);
                                  }}
                                  onMouseEnter={() => {
                                    setHoveredEventId(event.id);
                                    setHoveredResourceId(event.resourceId || null);
                                  }}
                                  onMouseLeave={() => {
                                    setHoveredEventId(null);
                                    setHoveredResourceId(null);
                                  }}
                                  className={`absolute select-none cursor-pointer border rounded-xl shadow-3xs px-2.5 py-1.5 transition-all flex flex-col justify-center overflow-hidden group/event z-20 ${stylePreset.bg} ${stylePreset.text} ${stylePreset.border} ${
                                    isCurrentlyDragging
                                      ? "opacity-100 border-dashed scale-[0.97] shadow-none cursor-grabbing z-40"
                                      : "active:cursor-grabbing"
                                  } ${getEventCardHighlightStyle(
                                    hoveredEventId === event.id,
                                    hoveredResourceId === event.resourceId
                                  )}`}
                                  style={pos}
                                >
                                  {/* Accent indicator bar */}
                                  <div
                                    className={`absolute top-0 left-0 bottom-0 w-1 ${stylePreset.accent}`}
                                  />

                                  <div className="flex flex-col pl-2 h-full justify-between items-start text-left w-full">
                                    <h4 className="text-[11px] font-bold truncate leading-tight w-full shrink-0">
                                      {event.title}
                                    </h4>

                                    {event.description && (
                                      <p className="text-[9.5px] opacity-75 line-clamp-1 leading-normal w-full shrink-0">
                                        {event.description}
                                      </p>
                                    )}

                                    <div className="flex items-center gap-1 text-[8px] opacity-80 mt-auto leading-none w-full shrink-0">
                                      <Clock size={8.5} className="shrink-0" />
                                      <span className="font-mono">
                                        {formattedStart} - {formattedEnd}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Pointer Resize Handles */}
                                  {event.isResizable !== false && !isCurrentlyDragging && (
                                    <>
                                      <div
                                        onPointerDown={(e) => {
                                          setIsHoveringHandle(true);
                                          handleResizePointerDown(e, event, "start");
                                        }}
                                        onPointerMove={handleResizePointerMove}
                                        onPointerUp={(e) => {
                                          handleResizePointerUp(e);
                                          setIsHoveringHandle(false);
                                        }}
                                        onMouseEnter={() => setIsHoveringHandle(true)}
                                        onMouseLeave={() => setIsHoveringHandle(false)}
                                        onDragStart={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                        }}
                                        draggable={false}
                                        className="absolute left-0 top-0 bottom-0 w-2.5 cursor-ew-resize hover:bg-indigo-500/15 active:bg-indigo-500/30 z-30 transition-colors"
                                        title="Drag to change start time"
                                      />
                                      <div
                                        onPointerDown={(e) => {
                                          setIsHoveringHandle(true);
                                          handleResizePointerDown(e, event, "end");
                                        }}
                                        onPointerMove={handleResizePointerMove}
                                        onPointerUp={(e) => {
                                          handleResizePointerUp(e);
                                          setIsHoveringHandle(false);
                                        }}
                                        onMouseEnter={() => setIsHoveringHandle(true)}
                                        onMouseLeave={() => setIsHoveringHandle(false)}
                                        onDragStart={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                        }}
                                        draggable={false}
                                        className="absolute right-0 top-0 bottom-0 w-2.5 cursor-ew-resize hover:bg-indigo-500/15 active:bg-indigo-500/30 z-30 transition-colors"
                                        title="Drag to change end time"
                                      />
                                    </>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Vertical Current system time indicator line */}
                {showCurrentTimeIndicator &&
                  isSameDay(currentDate, nowDate) &&
                  currentTimePercentage !== null && (
                    <div
                      className="absolute top-12 bottom-0 pointer-events-none z-10 w-0"
                      style={{
                        left: `calc(220px + ${currentTimePercentage}%)`,
                      }}
                    >
                      <div className="absolute top-0 w-2.5 h-2.5 rounded-full bg-rose-600 dark:bg-rose-500 ring-4 ring-rose-500/20 shadow-sm -left-[5px]" />
                      <div className="w-[1.5px] h-full bg-rose-600 dark:bg-rose-500" />
                    </div>
                  )}
              </div>
            </div>
          ) : (
            /* ======================== GRID COLUMN VIEW ======================== */
            <div className="flex-1 flex flex-col overflow-auto bg-white dark:bg-neutral-900 select-none pl-1 font-sans">
              {gridColumns.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-400 dark:text-neutral-500">
                  <LayoutGrid
                    size={32}
                    className="text-slate-300 dark:text-neutral-700 mb-3 animate-pulse"
                  />
                  <p className="text-xs font-bold text-slate-700 dark:text-neutral-300">
                    No Columns Selected
                  </p>
                  <p className="text-[11px] text-slate-400 dark:text-neutral-500 mt-1 text-center max-w-xs leading-normal font-medium">
                    Select resources or folder groups from the left Select Columns panel to see
                    columns.
                  </p>
                </div>
              ) : (
                <div
                  className="flex flex-1 min-w-max relative"
                  onDragOver={(e) => e.preventDefault()}
                >
                  {/* Global hover dashed line spanning all columns */}
                  {gridHover && !gridSelection && (
                    <div
                      className="absolute left-14 right-0 border-t border-dashed border-indigo-500/50 pointer-events-none z-30"
                      style={{
                        top: `calc(56px + ${hasAnyAllDayEvents ? "56px" : "0px"} + ${((gridHover.minutes - dayStartHour * 60) / 60) * GRID_HOUR_HEIGHT}px)`,
                      }}
                    />
                  )}

                  {/* Sticky Left time ruler column */}
                  <div className="w-14 shrink-0 border-r border-gray-150 dark:border-neutral-800 bg-white/95 dark:bg-neutral-900/95 font-mono text-[10px] text-gray-400/90 flex flex-col sticky left-0 z-30 font-mono">
                    {/* Gap at the top left corner */}
                    <div className="h-14 border-b border-gray-150 dark:border-neutral-800 bg-white dark:bg-neutral-900 sticky top-0 z-40 shrink-0" />

                    {/* All-Day header gap spacer for left time ruler */}
                    {hasAnyAllDayEvents && (
                      <div className="h-14 border-b border-gray-150 dark:border-neutral-800 bg-amber-50/10 dark:bg-amber-950/5 sticky top-14 z-30 shrink-0 flex items-center justify-center">
                        <span className="text-[9px] font-extrabold uppercase font-mono tracking-wide text-amber-600 bg-amber-50/50 dark:bg-amber-950/30 border border-amber-100/40 dark:border-amber-900/10 px-1 py-0.5 rounded">
                          All Day
                        </span>
                      </div>
                    )}

                    {/* Hour slots */}
                    <div
                      className="relative"
                      style={{ height: `${hoursScale.length * GRID_HOUR_HEIGHT}px` }}
                    >
                      {hoursScale.map(({ hourIndex, label: hourText }, index) => (
                        <div
                          key={hourIndex}
                          className="absolute left-0 right-0 pl-2 flex items-start select-none"
                          style={{
                            top: `${index * GRID_HOUR_HEIGHT}px`,
                            height: `${GRID_HOUR_HEIGHT}px`,
                          }}
                        >
                          <span className={`relative ${index === 0 ? "top-1.5" : "top-[-6px]"}`}>
                            {hourText}
                          </span>
                        </div>
                      ))}
                      {/* The final ending hour label at the very bottom */}
                      <div
                        className="absolute bottom-0 left-0 right-0 pl-2 flex items-start"
                        style={{ height: "0px", top: `${hoursScale.length * GRID_HOUR_HEIGHT}px` }}
                      >
                        <span className="relative top-[-6px]">
                          {formatGridHour(dayEndHour, timeFormat)}
                        </span>
                      </div>

                      {/* Hover active indicator time text badge inside side ruler */}
                      {gridHover && !gridSelection && (
                        <div
                          className="absolute right-1.5 bg-indigo-600 text-white font-mono text-[9px] px-1 py-0.5 rounded shadow-sm z-30 pointer-events-none opacity-95 whitespace-nowrap animate-fade-in"
                          style={{
                            top: `${((gridHover.minutes - dayStartHour * 60) / 60) * GRID_HOUR_HEIGHT}px`,
                            transform: "translateY(-50%)",
                          }}
                        >
                          {(() => {
                            const d = new Date(currentDate);
                            d.setHours(
                              Math.floor(gridHover.minutes / 60),
                              gridHover.minutes % 60,
                              0,
                              0
                            );
                            return format(d, timeFormat === "24h" ? "HH:mm" : "h:mm a");
                          })()}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Columns list */}
                  <div className="flex flex-1">
                    {gridColumns.map((col) => {
                      const colEvents = columnEventsMap.get(col.resource.id) || [];
                      const colAllDayEvents = colEvents.filter((ev) => ev.allDay);
                      const colTimedEvents = colEvents.filter((ev) => !ev.allDay);
                      const layoutMap = columnLayouts.get(col.resource.id);
                      const hasColoredIndicator = !!col.resource.color;

                      const isColHovered = hoveredResourceId === col.resource.id;
                      return (
                        <div
                          key={col.resource.id}
                          onMouseEnter={() => setHoveredResourceId(col.resource.id)}
                          onMouseLeave={() => setHoveredResourceId(null)}
                          className={`w-[210px] shrink-0 border-r border-slate-100/85 dark:border-neutral-800/80 flex flex-col relative transition-colors ${
                            dragOverRowId === col.resource.id
                              ? "bg-indigo-50/15 dark:bg-indigo-950/20 ring-1 ring-indigo-500/20 ring-inset"
                              : ""
                          } ${getResourceBgStyle(isColHovered)}`}
                        >
                          {/* Sticky Table Column Header representing resource */}
                          <div
                            className={`h-14 px-3 py-2 border-b border-slate-100 dark:border-neutral-800 sticky top-0 z-25 flex flex-col justify-center select-none shadow-3xs w-full font-sans transition-colors ${getResourceHeaderStyle(
                              isColHovered,
                              "b"
                            )}`}
                          >
                            <div className="flex items-center gap-1.5 truncate">
                              {hasColoredIndicator && (
                                <span
                                  className="w-2.5 h-2.5 rounded-full shrink-0 inline-block shadow-3xs"
                                  style={{ backgroundColor: col.resource.color }}
                                />
                              )}
                              <span className="text-xs font-bold font-sans text-slate-800 dark:text-neutral-100 leading-none truncate">
                                {col.resource.name}
                              </span>
                            </div>
                            {col.resource.description && (
                              <span className="text-[10px] text-slate-400 dark:text-neutral-500 font-medium leading-normal truncate mt-0.5">
                                {col.resource.description}
                              </span>
                            )}
                          </div>

                          {/* All-Day Events block for this column */}
                          {hasAnyAllDayEvents && (
                            <div className="h-14 shrink-0 border-b border-slate-100 dark:border-neutral-800 bg-amber-50/5 dark:bg-amber-950/5 sticky top-14 z-20 px-2.5 py-1.5 flex flex-col justify-center space-y-1 overflow-y-auto">
                              {colAllDayEvents.map((ev) => {
                                const stylePreset =
                                  CATEGORY_STYLES[ev.color || ev.category] ||
                                  CATEGORY_STYLES.meeting;
                                return (
                                  <div
                                    key={ev.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onSelectEvent(ev);
                                    }}
                                    onMouseEnter={() => {
                                      setHoveredEventId(ev.id);
                                      setHoveredResourceId(ev.resourceId || col.resource.id);
                                    }}
                                    onMouseLeave={() => {
                                      setHoveredEventId(null);
                                      setHoveredResourceId(null);
                                    }}
                                    title={ev.title}
                                    className={`px-2 py-0.5 border text-[10px] font-semibold rounded-md truncate cursor-pointer transition w-full block whitespace-nowrap overflow-hidden ${stylePreset.bg} ${stylePreset.text} ${stylePreset.border} ${getEventCardHighlightStyle(
                                      hoveredEventId === ev.id,
                                      hoveredResourceId === ev.resourceId
                                    )}`}
                                  >
                                    {ev.title}
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Column Hour slots vertical grid backing */}
                          <div
                            className="relative flex-1 w-full"
                            style={{ height: `${hoursScale.length * GRID_HOUR_HEIGHT}px` }}
                            onDragOver={(e) => handleDragOverColumn(e, col.resource.id)}
                            onDragLeave={handleDragLeaveRowOrColumn}
                            onDrop={(e) => handleDropOnColumn(e, col.resource.id)}
                            onMouseDown={(e) => {
                              const isInteractive =
                                (e.target as HTMLElement).closest('[class*="group/event"]') ||
                                (e.target as HTMLElement).closest("button");
                              if (isInteractive || resizingEventId || draggingEventId) return;
                              if (e.button !== 0) return;

                              const rect = e.currentTarget.getBoundingClientRect();
                              const y = e.clientY - rect.top;
                              const minutesFromDayStart = (y / GRID_HOUR_HEIGHT) * 60;
                              const totalMins = Math.round(minutesFromDayStart / 15) * 15;
                              const finalMinsFromMidnight = totalMins + dayStartHour * 60;

                              setGridSelection({
                                resourceId: col.resource.id,
                                startMins: finalMinsFromMidnight,
                                endMins: finalMinsFromMidnight,
                              });
                            }}
                            onMouseMove={(e) => {
                              const isInteractive = (e.target as HTMLElement).closest(
                                '[class*="group/event"], [class*="event-card"], button'
                              );
                              if (isInteractive) {
                                setGridHover(null);
                                return;
                              }
                              const rect = e.currentTarget.getBoundingClientRect();
                              const y = e.clientY - rect.top;
                              const minutesFromDayStart = (y / GRID_HOUR_HEIGHT) * 60;
                              const totalMins = Math.round(minutesFromDayStart / 15) * 15;
                              const finalMinsFromMidnight = totalMins + dayStartHour * 60;

                              setGridHover({
                                resourceId: col.resource.id,
                                minutes: finalMinsFromMidnight,
                              });

                              if (gridSelection && gridSelection.resourceId === col.resource.id) {
                                setGridSelection((prev) =>
                                  prev ? { ...prev, endMins: finalMinsFromMidnight } : null
                                );
                              }
                            }}
                            onMouseLeave={() => {
                              setGridHover(null);
                            }}
                          >
                            {/* Selection block vertical overlay */}
                            {(() => {
                              if (!gridSelection || gridSelection.resourceId !== col.resource.id)
                                return null;
                              const sMins = Math.min(
                                gridSelection.startMins,
                                gridSelection.endMins
                              );
                              const eMins = Math.max(
                                gridSelection.startMins,
                                gridSelection.endMins
                              );

                              const gridStartMins = dayStartHour * 60;
                              const gridEndMins = dayEndHour * 60;

                              const clampedStart = Math.max(
                                gridStartMins,
                                Math.min(gridEndMins, sMins)
                              );
                              const clampedEnd = Math.max(
                                gridStartMins,
                                Math.min(gridEndMins, eMins)
                              );

                              if (clampedEnd <= clampedStart) return null;

                              const topPx =
                                ((clampedStart - gridStartMins) / 60) * GRID_HOUR_HEIGHT;
                              const heightPx =
                                ((clampedEnd - clampedStart) / 60) * GRID_HOUR_HEIGHT;

                              const startD = new Date(currentDate);
                              startD.setHours(Math.floor(sMins / 60), sMins % 60, 0, 0);
                              const endD = new Date(currentDate);
                              endD.setHours(Math.floor(eMins / 60), eMins % 60, 0, 0);

                              return (
                                <div
                                  className="absolute left-0 right-0 bg-indigo-500/20 border-y-2 border-indigo-500/50 pointer-events-none z-30 animate-pulse"
                                  style={{
                                    top: `${topPx}px`,
                                    height: `${heightPx}px`,
                                  }}
                                >
                                  <span className="absolute top-0.5 left-1 bg-indigo-600 text-white font-mono text-[9px] px-1 py-0.2 rounded shadow-xs select-none opacity-95 whitespace-nowrap">
                                    Start:{" "}
                                    {format(startD, timeFormat === "24h" ? "HH:mm" : "h:mm a")}
                                  </span>
                                  <span className="absolute bottom-0.5 right-1 bg-indigo-600 text-white font-mono text-[9px] px-1 py-0.2 rounded shadow-xs select-none opacity-95 whitespace-nowrap">
                                    End: {format(endD, timeFormat === "24h" ? "HH:mm" : "h:mm a")}
                                  </span>
                                </div>
                              );
                            })()}
                            {hoursScale.map((_, index) => (
                              <div
                                key={index}
                                className="absolute left-0 right-0 border-b border-gray-100 dark:border-neutral-800/40 pointer-events-none"
                                style={{
                                  top: `${index * GRID_HOUR_HEIGHT}px`,
                                  height: `${GRID_HOUR_HEIGHT}px`,
                                }}
                              />
                            ))}

                            {/* Scheduled Column Events List */}
                            {colTimedEvents.map((event) => {
                              const stylePreset =
                                CATEGORY_STYLES[event.color || event.category] ||
                                CATEGORY_STYLES.meeting;
                              const pos = getGridEventPositionStyles(event);
                              if (pos.isOutside) return null;

                              const layout = layoutMap?.get(event.id) || {
                                colIndex: 0,
                                totalCols: 1,
                              };
                              const widthPercent = 100 / layout.totalCols;
                              const leftPercent = layout.colIndex * widthPercent;

                              let liveStart = new Date(event.start);
                              let liveEnd = new Date(event.end);
                              if (resizingEventId === event.id && resizeEdge) {
                                if (resizeEdge === "start" && resizeInitialStart) {
                                  liveStart = addMinutes(resizeInitialStart, resizeDeltaMinutes);
                                  const maxStart = addMinutes(new Date(event.end), -15);
                                  if (liveStart > maxStart) liveStart = maxStart;
                                } else if (resizeEdge === "end" && resizeInitialEnd) {
                                  liveEnd = addMinutes(resizeInitialEnd, resizeDeltaMinutes);
                                  const minEnd = addMinutes(new Date(event.start), 15);
                                  if (liveEnd < minEnd) liveEnd = minEnd;
                                }
                              }

                              const formattedStart = format(
                                liveStart,
                                timeFormat === "24h" ? "HH:mm" : "p"
                              );
                              const formattedEnd = format(
                                liveEnd,
                                timeFormat === "24h" ? "HH:mm" : "p"
                              );

                              const isCurrentlyResizing = resizingEventId === event.id;
                              const isCurrentlyDragging = draggingEventId === event.id;

                              return (
                                <div
                                  key={event.id}
                                  draggable={
                                    event.isDraggable !== false &&
                                    !isCurrentlyResizing &&
                                    !isHoveringHandle
                                  }
                                  onDragStart={(e) => handleDragEventStart(e, event)}
                                  onDragEnd={handleDragEnd}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (
                                      isCurrentlyDragging ||
                                      isCurrentlyResizingRef.current ||
                                      isJustResizedRef.current
                                    )
                                      return;
                                    onSelectEvent(event);
                                  }}
                                  onMouseEnter={() => {
                                    setHoveredEventId(event.id);
                                    setHoveredResourceId(event.resourceId || null);
                                  }}
                                  onMouseLeave={() => {
                                    setHoveredEventId(null);
                                    setHoveredResourceId(null);
                                  }}
                                  className={`absolute select-none cursor-pointer border rounded-xl shadow-3xs px-2.5 py-1.5 transition-all flex flex-col overflow-hidden group/event z-20 ${stylePreset.bg} ${stylePreset.text} ${stylePreset.border} ${
                                    isCurrentlyDragging
                                      ? "opacity-100 border-dashed scale-[0.97] shadow-none cursor-grabbing z-40"
                                      : "active:cursor-grabbing"
                                  } ${getEventCardHighlightStyle(
                                    hoveredEventId === event.id,
                                    hoveredResourceId === event.resourceId
                                  )}`}
                                  style={{
                                    top: pos.top,
                                    height: pos.height,
                                    left: `${leftPercent}%`,
                                    width: `${widthPercent - 1}%`,
                                  }}
                                >
                                  {/* Accent indicator line */}
                                  <div
                                    className={`absolute top-0 left-0 bottom-0 w-1 ${stylePreset.accent}`}
                                  />

                                  <div className="flex flex-col pl-2 h-full justify-between items-start text-left w-full font-sans">
                                    <h4 className="text-[11px] font-bold truncate leading-tight w-full shrink-0">
                                      {event.title}
                                    </h4>

                                    {event.description && (
                                      <p className="text-[9.5px] opacity-75 line-clamp-1 leading-normal w-full shrink-0 mt-0.5">
                                        {event.description}
                                      </p>
                                    )}

                                    <div className="flex items-center gap-1.5 text-[8.5px] opacity-80 mt-auto leading-none w-full shrink-0">
                                      <Clock size={9} className="shrink-0" />
                                      <span className="font-mono">
                                        {formattedStart} - {formattedEnd}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Pointer Resize Handles (Vertical Up/Down inside grid) */}
                                  {event.isResizable !== false && !isCurrentlyDragging && (
                                    <>
                                      <div
                                        onPointerDown={(e) => {
                                          setIsHoveringHandle(true);
                                          handleResizePointerDown(e, event, "start");
                                        }}
                                        onPointerMove={handleResizePointerMove}
                                        onPointerUp={(e) => {
                                          handleResizePointerUp(e);
                                          setIsHoveringHandle(false);
                                        }}
                                        onMouseEnter={() => setIsHoveringHandle(true)}
                                        onMouseLeave={() => setIsHoveringHandle(false)}
                                        onDragStart={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                        }}
                                        draggable={false}
                                        className="absolute left-0 right-0 top-0 h-2 cursor-ns-resize hover:bg-indigo-500/15 active:bg-indigo-500/30 z-30 transition-colors"
                                        title="Drag top edge to resize"
                                      />
                                      <div
                                        onPointerDown={(e) => {
                                          setIsHoveringHandle(true);
                                          handleResizePointerDown(e, event, "end");
                                        }}
                                        onPointerMove={handleResizePointerMove}
                                        onPointerUp={(e) => {
                                          handleResizePointerUp(e);
                                          setIsHoveringHandle(false);
                                        }}
                                        onMouseEnter={() => setIsHoveringHandle(true)}
                                        onMouseLeave={() => setIsHoveringHandle(false)}
                                        onDragStart={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                        }}
                                        draggable={false}
                                        className="absolute left-0 right-0 bottom-0 h-2 cursor-ns-resize hover:bg-indigo-500/15 active:bg-indigo-500/30 z-30 transition-colors"
                                        title="Drag bottom edge to resize"
                                      />
                                    </>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Red Current System Time line inside Grid Columns */}
                  {showCurrentTimeIndicator &&
                    isSameDay(currentDate, nowDate) &&
                    gridCurrentTimeY !== null && (
                      <div
                        className="absolute left-[70px] right-0 pointer-events-none z-15 border-t border-rose-600 dark:border-rose-500 flex items-center"
                        style={{
                          top: `calc(${hasAnyAllDayEvents ? "112px" : "56px"} + ${gridCurrentTimeY}px)`,
                        }}
                      >
                        <div className="w-2.5 h-2.5 rounded-full bg-rose-600 dark:bg-rose-500 ring-4 ring-rose-500/20 shadow-sm -ml-[5px] text-center shrink-0" />
                        <div className="flex-1 h-[2px] bg-rose-600 dark:bg-rose-500" />
                      </div>
                    )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
