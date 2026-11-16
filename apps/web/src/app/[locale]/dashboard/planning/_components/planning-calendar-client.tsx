"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  keepPreviousData,
  type QueryKey,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "react-toastify";
import {
  addDays,
  endOfMonth,
  format,
  startOfMonth,
  startOfWeek,
  endOfWeek,
  differenceInCalendarDays,
} from "date-fns";
import { ExternalLink, Loader2, Trash2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageLoader } from "@/components/page-loader";
import {
  CalendarScheduler,
  type CalendarEvent,
  type CalendarSource,
  type SchedulerSettings,
  type UnscheduledTask,
} from "@/components/primitives/scheduler";
import { LABELS_MAP, LOCALE_MAP } from "@/components/primitives/scheduler/scheduler-utils";
import {
  createNativeCalendarEventAction,
  createNativeCalendarAction,
  deleteNativeCalendarEventAction,
  getPlanningCalendarDataAction,
  resetCalendarSourceColorAction,
  updateCalendarSourceSettingsAction,
  updateCalendarItemDueDateAction,
  updateCalendarItemScheduleAction,
  updateNativeCalendarEventAction,
} from "@/app/actions/planning/calendar";
import { useDebounce } from "@/hooks/use-debounce";
import { dateOnlyToLocalDate, dateToDateOnly } from "@/lib/planning/calendar-dates";
import { useUiStoreV2 } from "@/lib/stores/v2/ui-store";
import {
  HELPDESK_TICKETS_SOURCE_ID,
  KANBAN_CALENDAR_KEY_PREFIX,
  PLANNING_TASKS_SOURCE_ID,
} from "@/lib/constants/planning-calendar";
import type {
  CalendarEventDTO,
  CalendarItemSourceType,
  PlanningCalendarData,
  UnscheduledItemDTO,
} from "@/lib/types/planning-calendar";
import type { GetPlanningCalendarDataInput } from "@/lib/validations/planning-calendar";
import type { PlanningPriorityBadgeConfig } from "@/components/planning/planning-task-priority-badge";

interface Member {
  user_id: string;
  name: string | null;
  email: string | null;
}

interface PlanningCalendarClientProps {
  members: Member[];
  currentUserId: string;
  canAssign: boolean;
  canCreateTasks: boolean;
  priorityConfigs: Record<string, PlanningPriorityBadgeConfig> | null;
  initialVisibleSources: Record<string, boolean>;
}

const CATEGORY_DOT_MAP: Record<string, string> = {
  meeting: "bg-indigo-500",
  workshop: "bg-emerald-500",
  reminder: "bg-amber-500",
  warehouse: "bg-rose-500",
  task: "bg-cyan-500",
  personal: "bg-fuchsia-500",
};

function parseSourceId(id: string): { sourceType: CalendarItemSourceType; sourceId: string } {
  const separatorIndex = id.indexOf(":");
  return {
    sourceType: id.slice(0, separatorIndex) as CalendarItemSourceType,
    sourceId: id.slice(separatorIndex + 1),
  };
}

function boardIdFromCalendarSource(calendarSourceId?: string): string | undefined {
  return calendarSourceId?.startsWith(KANBAN_CALENDAR_KEY_PREFIX)
    ? calendarSourceId.slice(KANBAN_CALENDAR_KEY_PREFIX.length)
    : undefined;
}

function dtoToCalendarEvent(dto: CalendarEventDTO): CalendarEvent {
  const start = dto.startAt
    ? new Date(dto.startAt)
    : dateOnlyToLocalDate(dto.startDate ?? dto.dueDate ?? new Date().toISOString().slice(0, 10));
  const end = dto.endAt
    ? new Date(dto.endAt)
    : dateOnlyToLocalDate(
        dto.endDate ?? dto.startDate ?? dto.dueDate ?? new Date().toISOString().slice(0, 10)
      );
  return {
    id: dto.id,
    title: dto.title,
    start,
    end,
    allDay: dto.allDay ?? true,
    color: dto.color,
    category: dto.category,
    calendarSourceId: dto.calendarSourceId,
    sourceModule: dto.sourceModule,
    sourceType: dto.sourceType,
    sourceId: dto.sourceId,
    dueDate: dto.dueDate,
    displayMode: dto.displayMode ?? (dto.startAt || dto.startDate ? "scheduled" : "deadline"),
    metadata: dto.metadata,
    isDraggable: true,
    isResizable: false,
  };
}

function dtoToUnscheduledTask(dto: UnscheduledItemDTO): UnscheduledTask {
  return {
    id: dto.id,
    title: dto.title,
    category: dto.category,
    calendarSourceId: dto.calendarSourceId,
    estimatedDurationMinutes: 60,
  };
}

function capitalize(value: string): string {
  return value.length ? value[0].toUpperCase() + value.slice(1) : value;
}

function actionErrorMessage(
  result: { success: false; error: string } | { success: true; data: unknown }
): string {
  return (result as { success: false; error: string }).error;
}

const planningCalendarKeys = {
  all: ["planning-calendar"] as const,
  range: (input: GetPlanningCalendarDataInput) =>
    [
      ...planningCalendarKeys.all,
      input.rangeStart,
      input.rangeEnd,
      input.includeUnscheduled,
      input.unscheduledLimit,
      input.unscheduledSearch ?? "",
      ...(input.visibleSourceIds ?? []),
    ] as const,
};

function planningRangeFromQueryKey(queryKey: QueryKey) {
  if (
    !Array.isArray(queryKey) ||
    queryKey[0] !== planningCalendarKeys.all[0] ||
    typeof queryKey[1] !== "string" ||
    typeof queryKey[2] !== "string"
  ) {
    return null;
  }
  return { rangeStart: queryKey[1], rangeEnd: queryKey[2] };
}

function makeInitialRange() {
  const today = new Date();
  return {
    rangeStart: dateToDateOnly(startOfWeek(startOfMonth(today), { weekStartsOn: 1 })),
    rangeEnd: dateToDateOnly(endOfWeek(endOfMonth(today), { weekStartsOn: 1 })),
  };
}

function toDateInputValue(date: Date) {
  return format(date, "yyyy-MM-dd");
}

function toDateTimeLocalValue(date: Date) {
  return format(date, "yyyy-MM-dd'T'HH:mm");
}

function browserTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

interface NativeEventDraft {
  id?: string;
  calendarId: string;
  title: string;
  description: string;
  allDay: boolean;
  start: Date;
  end: Date;
}

function nativeEventScheduleFromDraft(draft: NativeEventDraft, timezone: string) {
  return draft.allDay
    ? {
        allDay: true as const,
        startDate: toDateInputValue(draft.start),
        endDate: toDateInputValue(draft.end),
        timezone,
      }
    : {
        allDay: false as const,
        startAt: draft.start.toISOString(),
        endAt: draft.end.toISOString(),
        timezone,
      };
}

function nativeDraftToCalendarEventDTO(
  draft: NativeEventDraft,
  eventId: string,
  source: CalendarSource,
  timezone: string,
  optimistic = false
): CalendarEventDTO {
  const schedule = nativeEventScheduleFromDraft(draft, timezone);
  return {
    id: `native_event:${eventId}`,
    title: draft.title.trim(),
    dueDate: schedule.allDay ? schedule.startDate : undefined,
    startDate: schedule.allDay ? schedule.startDate : undefined,
    endDate: schedule.allDay ? schedule.endDate : undefined,
    startAt: schedule.allDay ? undefined : schedule.startAt,
    endAt: schedule.allDay ? undefined : schedule.endAt,
    allDay: schedule.allDay,
    displayMode: "scheduled",
    color: source.color,
    category: source.category,
    calendarSourceId: source.id,
    sourceModule: "calendar",
    sourceType: "native_event",
    sourceId: eventId,
    metadata: {
      calendarId: draft.calendarId,
      description: draft.description || null,
      timezone,
      optimistic,
    },
  };
}

function calendarEventDTOIntersectsRange(
  event: CalendarEventDTO,
  range: { rangeStart: string; rangeEnd: string }
) {
  const startDate = event.startAt
    ? dateToDateOnly(new Date(event.startAt))
    : (event.startDate ?? event.dueDate);
  const endDate = event.endAt
    ? dateToDateOnly(new Date(event.endAt))
    : (event.endDate ?? event.startDate ?? event.dueDate);

  if (!startDate || !endDate) return false;
  return startDate <= range.rangeEnd && endDate >= range.rangeStart;
}

export function PlanningCalendarClient({
  priorityConfigs,
  initialVisibleSources,
}: PlanningCalendarClientProps) {
  const locale = useLocale() as "en" | "pl";
  const t = useTranslations("modules.planning");
  const tTasks = useTranslations("modules.planning.tasks");
  const labels = LABELS_MAP[locale];
  const queryClient = useQueryClient();

  const setFlushContent = useUiStoreV2((state) => state.setFlushContent);
  useEffect(() => {
    setFlushContent(true);
    return () => setFlushContent(false);
  }, [setFlushContent]);

  const [refreshKey] = useState(0);
  const [visibleSources, setVisibleSources] =
    useState<Record<string, boolean>>(initialVisibleSources);
  const [visibleRange, setVisibleRange] = useState(makeInitialRange);
  const [knownSources, setKnownSources] = useState<CalendarSource[]>([]);
  const [unscheduledLimit, setUnscheduledLimit] = useState(50);
  const [unscheduledSearch, setUnscheduledSearch] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [nativeEventDraft, setNativeEventDraft] = useState<NativeEventDraft | null>(null);
  const [schedulerTimezone] = useState(browserTimeZone);

  const debouncedUnscheduledSearch = useDebounce(unscheduledSearch.trim(), 350);

  useEffect(() => {
    setUnscheduledLimit(50);
  }, [debouncedUnscheduledSearch]);

  const calendarQueryInput = useMemo<GetPlanningCalendarDataInput>(
    () => ({
      rangeStart: visibleRange.rangeStart,
      rangeEnd: visibleRange.rangeEnd,
      includeUnscheduled: true,
      unscheduledLimit,
      unscheduledSearch: debouncedUnscheduledSearch || undefined,
    }),
    [visibleRange, unscheduledLimit, debouncedUnscheduledSearch]
  );

  const calendarQuery = useQuery({
    queryKey: planningCalendarKeys.range(calendarQueryInput),
    queryFn: async () => {
      const result = await getPlanningCalendarDataAction(calendarQueryInput);
      if (!result.success) throw new Error(actionErrorMessage(result));
      return result.data;
    },
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  const calendarData = calendarQuery.data ?? null;

  useEffect(() => {
    if (calendarQuery.error) {
      toast.error(calendarQuery.error.message);
    }
  }, [calendarQuery.error]);

  useEffect(() => {
    if (calendarData?.sources) {
      setKnownSources((current) => {
        if (
          current.length === calendarData.sources.length &&
          current.every((source, index) => {
            const next = calendarData.sources[index];
            return (
              next &&
              source.id === next.id &&
              source.visible === next.visible &&
              source.color === next.color &&
              source.defaultColor === next.defaultColor
            );
          })
        ) {
          return current;
        }
        return calendarData.sources;
      });
      setVisibleSources((current) => {
        let next: Record<string, boolean> | null = null;
        for (const source of calendarData.sources) {
          if (current[source.id] === undefined) {
            next ??= { ...current };
            next[source.id] = source.visible;
          }
        }
        return next ?? current;
      });
    }
  }, [calendarData?.sources]);

  const updateDueDateMutation = useMutation({
    mutationFn: async (input: {
      eventId: string;
      sourceType: CalendarItemSourceType;
      sourceId: string;
      boardId?: string;
      dueDate: string | null;
    }) => {
      const result = await updateCalendarItemDueDateAction({
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        boardId: input.boardId,
        dueDate: input.dueDate,
      });
      if (!result.success) throw new Error(actionErrorMessage(result));
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: planningCalendarKeys.all });
      const snapshots = queryClient.getQueriesData<PlanningCalendarData>({
        queryKey: planningCalendarKeys.all,
      });
      const sourceEvent = snapshots
        .flatMap(([, data]) => data?.events ?? [])
        .find((event) => event.id === input.eventId);
      const sourceUnscheduled = snapshots
        .flatMap(([, data]) => data?.unscheduled ?? [])
        .find((item) => item.id === input.eventId);
      const sourceCalendar = snapshots
        .flatMap(([, data]) => data?.sources ?? [])
        .find((source) => source.id === sourceUnscheduled?.calendarSourceId);
      const updatedEvent =
        sourceEvent && input.dueDate
          ? {
              ...sourceEvent,
              dueDate: input.dueDate,
              startDate:
                sourceEvent.displayMode === "scheduled" ? sourceEvent.startDate : undefined,
              endDate: sourceEvent.displayMode === "scheduled" ? sourceEvent.endDate : undefined,
            }
          : sourceUnscheduled && input.dueDate
            ? {
                id: input.eventId,
                title: sourceUnscheduled.title,
                dueDate: input.dueDate,
                allDay: true,
                displayMode: "deadline" as const,
                color: sourceCalendar?.color,
                category: sourceUnscheduled.category,
                calendarSourceId: sourceUnscheduled.calendarSourceId,
                sourceModule: sourceUnscheduled.sourceModule,
                sourceType: sourceUnscheduled.sourceType,
                sourceId: sourceUnscheduled.sourceId,
                metadata: sourceUnscheduled.metadata,
              }
            : null;

      for (const [queryKey, data] of snapshots) {
        if (!data) continue;
        const range = planningRangeFromQueryKey(queryKey);
        const shouldKeepEvent =
          updatedEvent && range
            ? calendarEventDTOIntersectsRange(updatedEvent, range)
            : Boolean(updatedEvent);

        queryClient.setQueryData<PlanningCalendarData>(queryKey, {
          ...data,
          events:
            shouldKeepEvent && updatedEvent
              ? [...data.events.filter((event) => event.id !== input.eventId), updatedEvent]
              : data.events.filter((event) => event.id !== input.eventId),
          unscheduled:
            input.dueDate === null
              ? data.unscheduled
              : data.unscheduled.filter((item) => item.id !== input.eventId),
        });
      }

      return { snapshots };
    },
    onError: (error, _input, context) => {
      for (const [queryKey, data] of context?.snapshots ?? []) {
        queryClient.setQueryData(queryKey, data);
      }
      toast.error(error.message);
      void queryClient.invalidateQueries({ queryKey: planningCalendarKeys.all });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: planningCalendarKeys.all });
    },
  });

  const updateScheduleMutation = useMutation({
    mutationFn: async (input: {
      eventId: string;
      sourceType: "planning_task" | "kanban_card" | "native_event";
      sourceId: string;
      boardId?: string;
      calendarId?: string;
      schedule:
        | { allDay: true; startDate: string; endDate: string; timezone: string }
        | { allDay: false; startAt: string; endAt: string; timezone: string };
    }) => {
      const result = await updateCalendarItemScheduleAction({
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        boardId: input.boardId,
        calendarId: input.calendarId,
        schedule: input.schedule,
      });
      if (!result.success) throw new Error(actionErrorMessage(result));
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: planningCalendarKeys.all });
      const snapshots = queryClient.getQueriesData<PlanningCalendarData>({
        queryKey: planningCalendarKeys.all,
      });
      const sourceEvent = snapshots
        .flatMap(([, data]) => data?.events ?? [])
        .find((event) => event.id === input.eventId);
      const updatedEvent =
        sourceEvent &&
        (input.schedule.allDay === true
          ? {
              ...sourceEvent,
              dueDate:
                sourceEvent.displayMode === "deadline"
                  ? input.schedule.startDate
                  : sourceEvent.dueDate,
              startDate: input.schedule.startDate,
              endDate: input.schedule.endDate,
              startAt: undefined,
              endAt: undefined,
              allDay: true,
              displayMode: "scheduled" as const,
            }
          : {
              ...sourceEvent,
              startDate: undefined,
              endDate: undefined,
              startAt: input.schedule.startAt,
              endAt: input.schedule.endAt,
              allDay: false,
              displayMode: "scheduled" as const,
            });

      for (const [queryKey, data] of snapshots) {
        if (!data) continue;
        const range = planningRangeFromQueryKey(queryKey);
        const shouldKeepEvent =
          updatedEvent && range
            ? calendarEventDTOIntersectsRange(updatedEvent, range)
            : Boolean(updatedEvent);

        queryClient.setQueryData<PlanningCalendarData>(queryKey, {
          ...data,
          events:
            shouldKeepEvent && updatedEvent
              ? [...data.events.filter((event) => event.id !== input.eventId), updatedEvent]
              : data.events.filter((event) => event.id !== input.eventId),
        });
      }

      return { snapshots };
    },
    onError: (error, _input, context) => {
      for (const [queryKey, data] of context?.snapshots ?? []) {
        queryClient.setQueryData(queryKey, data);
      }
      toast.error(error.message);
      void queryClient.invalidateQueries({ queryKey: planningCalendarKeys.all });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: planningCalendarKeys.all });
    },
  });

  const nativeEventMutation = useMutation({
    mutationFn: async (draft: NativeEventDraft) => {
      const schedule = nativeEventScheduleFromDraft(draft, schedulerTimezone);

      const result = draft.id
        ? await updateNativeCalendarEventAction({
            id: draft.id,
            calendarId: draft.calendarId,
            title: draft.title,
            description: draft.description || null,
            schedule,
          })
        : await createNativeCalendarEventAction({
            calendarId: draft.calendarId,
            title: draft.title,
            description: draft.description || null,
            schedule,
          });

      if (!result.success) throw new Error(actionErrorMessage(result));
      return result.data;
    },
    onMutate: async (draft) => {
      await queryClient.cancelQueries({ queryKey: planningCalendarKeys.all });
      const snapshots = queryClient.getQueriesData<PlanningCalendarData>({
        queryKey: planningCalendarKeys.all,
      });
      const source = calendarSources.find(
        (calendarSource) =>
          calendarSource.sourceType === "native_calendar" &&
          calendarSource.sourceId === draft.calendarId
      );

      if (!source) return { snapshots, draft, optimisticEventId: draft.id, optimisticEvent: null };

      const optimisticEventId = draft.id ?? `optimistic-${crypto.randomUUID()}`;
      const optimisticEvent = nativeDraftToCalendarEventDTO(
        draft,
        optimisticEventId,
        source,
        schedulerTimezone,
        true
      );
      const previousEventId = draft.id ? `native_event:${draft.id}` : optimisticEvent.id;

      for (const [queryKey, data] of snapshots) {
        if (!data) continue;
        const range = planningRangeFromQueryKey(queryKey);
        const shouldKeepEvent = range
          ? calendarEventDTOIntersectsRange(optimisticEvent, range)
          : true;

        queryClient.setQueryData<PlanningCalendarData>(queryKey, {
          ...data,
          events: shouldKeepEvent
            ? [
                ...data.events.filter(
                  (event) => event.id !== previousEventId && event.id !== optimisticEvent.id
                ),
                optimisticEvent,
              ]
            : data.events.filter(
                (event) => event.id !== previousEventId && event.id !== optimisticEvent.id
              ),
        });
      }

      setNativeEventDraft(null);
      setSelectedEvent(null);

      return { snapshots, draft, optimisticEventId, optimisticEvent };
    },
    onSuccess: (data, _draft, context) => {
      if (context?.optimisticEvent && context.optimisticEventId) {
        const realEvent = {
          ...context.optimisticEvent,
          id: `native_event:${data.id}`,
          sourceId: data.id,
          metadata: {
            ...context.optimisticEvent.metadata,
            optimistic: false,
          },
        };

        queryClient.setQueriesData<PlanningCalendarData>(
          { queryKey: planningCalendarKeys.all },
          (current) => {
            if (!current) return current;
            return {
              ...current,
              events: current.events.map((event) =>
                event.id === context.optimisticEvent?.id ? realEvent : event
              ),
            };
          }
        );
      }
      void queryClient.invalidateQueries({ queryKey: planningCalendarKeys.all });
    },
    onError: (error, _draft, context) => {
      for (const [queryKey, data] of context?.snapshots ?? []) {
        queryClient.setQueryData(queryKey, data);
      }
      if (context?.draft) setNativeEventDraft(context.draft);
      toast.error(error.message);
    },
  });

  const deleteNativeEventMutation = useMutation({
    mutationFn: async (input: { id: string; calendarId: string }) => {
      const result = await deleteNativeCalendarEventAction(input);
      if (!result.success) throw new Error(actionErrorMessage(result));
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: planningCalendarKeys.all });
      const snapshots = queryClient.getQueriesData<PlanningCalendarData>({
        queryKey: planningCalendarKeys.all,
      });
      const eventId = `native_event:${input.id}`;

      queryClient.setQueriesData<PlanningCalendarData>(
        { queryKey: planningCalendarKeys.all },
        (current) => {
          if (!current) return current;
          return {
            ...current,
            events: current.events.filter((event) => event.id !== eventId),
          };
        }
      );

      setNativeEventDraft(null);
      setSelectedEvent(null);

      return { snapshots };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: planningCalendarKeys.all });
    },
    onError: (error, _input, context) => {
      for (const [queryKey, data] of context?.snapshots ?? []) {
        queryClient.setQueryData(queryKey, data);
      }
      toast.error(error.message);
    },
  });

  const calendarSources = useMemo<CalendarSource[]>(() => {
    if (!calendarData) return [];
    return calendarData.sources.map((source) => {
      if (source.id === PLANNING_TASKS_SOURCE_ID) return { ...source, label: labels.catTask };
      if (source.id === HELPDESK_TICKETS_SOURCE_ID)
        return { ...source, label: labels.ticketsSource };
      return source;
    });
  }, [calendarData, labels]);

  const nativeCalendarSources = useMemo(
    () =>
      calendarSources.filter(
        (source) => source.sourceType === "native_calendar" && source.sourceId
      ),
    [calendarSources]
  );

  const initialEvents = useMemo<CalendarEvent[]>(
    () => calendarData?.events.map(dtoToCalendarEvent) ?? [],
    [calendarData]
  );

  const initialUnscheduledTasks = useMemo<UnscheduledTask[]>(
    () => calendarData?.unscheduled.map(dtoToUnscheduledTask) ?? [],
    [calendarData]
  );

  const initialSettings = useMemo<Partial<SchedulerSettings>>(
    () => ({ visibleCalendarSources: visibleSources, locale }),
    // Only used as the initializer for the (re)mounted scheduler instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [refreshKey, locale]
  );

  const handleSettingsChange = useCallback((settings: SchedulerSettings) => {
    setVisibleSources(settings.visibleCalendarSources ?? {});
  }, []);

  const handleCalendarSourceSettingsChange = useCallback(
    (sourceId: string, settings: { color?: string | null; visible?: boolean | null }) => {
      if (settings.visible !== undefined && settings.visible !== null) {
        setVisibleSources((current) => ({ ...current, [sourceId]: settings.visible as boolean }));
      }

      if (settings.color !== undefined) {
        const defaultColor =
          knownSources.find((source) => source.id === sourceId)?.defaultColor ?? "#6366f1";
        const nextColor = settings.color ?? defaultColor;
        queryClient.setQueriesData<PlanningCalendarData>(
          { queryKey: planningCalendarKeys.all },
          (current) => {
            if (!current) return current;
            return {
              ...current,
              sources: current.sources.map((source) =>
                source.id === sourceId
                  ? { ...source, color: settings.color ?? source.defaultColor }
                  : source
              ),
              events: current.events.map((event) =>
                event.calendarSourceId === sourceId ? { ...event, color: nextColor } : event
              ),
            };
          }
        );
      }

      const action =
        settings.color === null
          ? resetCalendarSourceColorAction({ calendarKey: sourceId })
          : updateCalendarSourceSettingsAction({ calendarKey: sourceId, ...settings });

      void action.then((result) => {
        if (!result.success) {
          toast.error("error" in result ? result.error : "Unexpected error");
          void queryClient.invalidateQueries({ queryKey: planningCalendarKeys.all });
        }
      });
    },
    [knownSources, queryClient]
  );

  const handleCreateCalendar = useCallback(
    (name: string) => {
      void createNativeCalendarAction({ name }).then((result) => {
        if (!result.success) {
          toast.error("error" in result ? result.error : "Unexpected error");
          return;
        }
        void queryClient.invalidateQueries({ queryKey: planningCalendarKeys.all });
      });
    },
    [queryClient]
  );

  const handleSelectRealEvent = useCallback((event: CalendarEvent) => {
    if (
      event.sourceType === "native_event" &&
      event.sourceId &&
      typeof event.metadata?.calendarId === "string"
    ) {
      setNativeEventDraft({
        id: event.sourceId,
        calendarId: event.metadata.calendarId,
        title: event.title,
        description:
          typeof event.metadata.description === "string" ? event.metadata.description : "",
        allDay: event.allDay ?? true,
        start: event.start,
        end: event.end,
      });
      return;
    }

    setSelectedEvent(event);
  }, []);

  const handleCreateAt = useCallback(
    (date: Date, endDate?: Date, allDay = true) => {
      const calendar = nativeCalendarSources[0];
      if (!calendar?.sourceId) {
        toast.info(t("calendar.createCalendarFirst"));
        return;
      }

      setNativeEventDraft({
        calendarId: calendar.sourceId,
        title: "",
        description: "",
        allDay,
        start: date,
        end: endDate ?? (allDay ? date : new Date(date.getTime() + 60 * 60 * 1000)),
      });
    },
    [nativeCalendarSources, t]
  );

  const handleMoveRealEvent = useCallback(
    async (event: CalendarEvent, newDate: Date) => {
      if (!event.sourceType || !event.sourceId) return;
      const boardId =
        event.sourceType === "kanban_card"
          ? boardIdFromCalendarSource(event.calendarSourceId)
          : undefined;

      if (
        event.sourceType === "native_event" ||
        event.displayMode === "scheduled" ||
        event.start.getTime() !== event.end.getTime()
      ) {
        const durationMs = Math.max(event.end.getTime() - event.start.getTime(), 0);
        const calendarId =
          event.sourceType === "native_event" && typeof event.metadata?.calendarId === "string"
            ? event.metadata.calendarId
            : undefined;

        updateScheduleMutation.mutate({
          eventId: event.id,
          sourceType: event.sourceType as "planning_task" | "kanban_card" | "native_event",
          sourceId: event.sourceId,
          boardId,
          calendarId,
          schedule:
            (event.allDay ?? true)
              ? {
                  allDay: true,
                  startDate: dateToDateOnly(newDate),
                  endDate: dateToDateOnly(
                    addDays(newDate, Math.max(differenceInCalendarDays(event.end, event.start), 0))
                  ),
                  timezone: schedulerTimezone,
                }
              : {
                  allDay: false,
                  startAt: newDate.toISOString(),
                  endAt: new Date(newDate.getTime() + durationMs).toISOString(),
                  timezone: schedulerTimezone,
                },
        });
        return;
      }

      updateDueDateMutation.mutate({
        eventId: event.id,
        sourceType: event.sourceType as CalendarItemSourceType,
        sourceId: event.sourceId,
        boardId,
        dueDate: dateToDateOnly(newDate),
      });
    },
    [schedulerTimezone, updateDueDateMutation, updateScheduleMutation]
  );

  const handleScheduleRealTask = useCallback(
    async (task: UnscheduledTask, date: Date) => {
      const { sourceType, sourceId } = parseSourceId(task.id);
      const boardId =
        sourceType === "kanban_card" ? boardIdFromCalendarSource(task.calendarSourceId) : undefined;

      updateDueDateMutation.mutate({
        eventId: task.id,
        sourceType,
        sourceId,
        boardId,
        dueDate: dateToDateOnly(date),
      });
    },
    [updateDueDateMutation]
  );

  const handleLoadMoreUnscheduled = useCallback(() => {
    setUnscheduledLimit((current) => Math.min(current + 50, 200));
  }, []);

  const openHref = useMemo(() => {
    if (!selectedEvent) return null;
    switch (selectedEvent.sourceType) {
      case "planning_task":
        return {
          pathname: "/dashboard/planning/tasks/[taskId]" as const,
          params: {
            taskId: String(selectedEvent.metadata?.taskNumber ?? selectedEvent.sourceId ?? ""),
          },
        };
      case "helpdesk_ticket":
        return {
          pathname: "/dashboard/help-desk/tickets/[ticketId]" as const,
          params: {
            ticketId: String(selectedEvent.metadata?.ticketNumber ?? selectedEvent.sourceId ?? ""),
          },
        };
      case "kanban_card": {
        const boardId = boardIdFromCalendarSource(selectedEvent.calendarSourceId);
        return boardId
          ? { pathname: "/dashboard/planning/boards" as const, query: { board: boardId } }
          : { pathname: "/dashboard/planning/boards" as const };
      }
      default:
        return null;
    }
  }, [selectedEvent]);

  const selectedSource = useMemo(
    () => calendarSources.find((source) => source.id === selectedEvent?.calendarSourceId),
    [calendarSources, selectedEvent]
  );

  const status = selectedEvent?.metadata?.status as string | undefined;
  const priority = selectedEvent?.metadata?.priority as string | undefined;
  const priorityLabel =
    selectedEvent?.sourceType === "planning_task" && priority
      ? (priorityConfigs?.[priority]?.label ?? capitalize(priority))
      : priority
        ? capitalize(priority)
        : undefined;

  const handleVisibleRangeChange = useCallback((range: { start: Date; end: Date }) => {
    const nextRange = {
      rangeStart: dateToDateOnly(range.start),
      rangeEnd: dateToDateOnly(range.end),
    };
    setVisibleRange((current) =>
      current.rangeStart === nextRange.rangeStart && current.rangeEnd === nextRange.rangeEnd
        ? current
        : nextRange
    );
  }, []);

  if (calendarQuery.isLoading && !calendarData) {
    return <PageLoader />;
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="relative min-h-0 flex-1">
        {calendarQuery.isFetching && calendarData && !calendarQuery.isLoading && (
          <div className="bg-background/95 text-muted-foreground pointer-events-none absolute bottom-4 right-4 z-30 flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium shadow-sm">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {t("calendar.syncing")}
          </div>
        )}
        <CalendarScheduler
          key={refreshKey}
          title={t("pages.overview.title")}
          calendarSources={calendarSources}
          events={initialEvents}
          unscheduledTasks={initialUnscheduledTasks}
          hasMoreUnscheduled={calendarData?.hasMoreUnscheduled ?? false}
          initialSettings={initialSettings}
          onSelectRealEvent={handleSelectRealEvent}
          onCreateAt={handleCreateAt}
          onMoveRealEvent={handleMoveRealEvent}
          onScheduleRealTask={handleScheduleRealTask}
          onSettingsChange={handleSettingsChange}
          onCalendarSourceSettingsChange={handleCalendarSourceSettingsChange}
          onCreateCalendar={handleCreateCalendar}
          onVisibleRangeChange={handleVisibleRangeChange}
          unscheduledSearch={unscheduledSearch}
          onUnscheduledSearchChange={setUnscheduledSearch}
          onLoadMoreUnscheduled={handleLoadMoreUnscheduled}
          isLoadingMoreUnscheduled={calendarQuery.isFetching && Boolean(calendarData)}
        />
      </div>

      <Dialog
        open={Boolean(nativeEventDraft)}
        onOpenChange={(open) => !open && setNativeEventDraft(null)}
      >
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>
              {nativeEventDraft?.id ? t("calendar.editEvent") : t("calendar.createEvent")}
            </DialogTitle>
          </DialogHeader>

          {nativeEventDraft && (
            <div className="grid gap-4 py-1">
              <div className="grid gap-2">
                <Label htmlFor="native-event-calendar">{t("calendar.calendar")}</Label>
                <Select
                  value={nativeEventDraft.calendarId}
                  onValueChange={(value) =>
                    setNativeEventDraft((draft) =>
                      draft ? { ...draft, calendarId: value } : draft
                    )
                  }
                >
                  <SelectTrigger id="native-event-calendar">
                    <SelectValue placeholder={t("calendar.selectCalendar")} />
                  </SelectTrigger>
                  <SelectContent>
                    {nativeCalendarSources.map((source) => (
                      <SelectItem key={source.id} value={source.sourceId ?? source.id}>
                        {source.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="native-event-title">{t("calendar.title")}</Label>
                <Input
                  id="native-event-title"
                  value={nativeEventDraft.title}
                  placeholder={t("calendar.titlePlaceholder")}
                  onChange={(event) =>
                    setNativeEventDraft((draft) =>
                      draft ? { ...draft, title: event.target.value } : draft
                    )
                  }
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="native-event-description">{t("calendar.description")}</Label>
                <Textarea
                  id="native-event-description"
                  value={nativeEventDraft.description}
                  placeholder={t("calendar.descriptionPlaceholder")}
                  rows={4}
                  onChange={(event) =>
                    setNativeEventDraft((draft) =>
                      draft ? { ...draft, description: event.target.value } : draft
                    )
                  }
                />
              </div>

              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                <Label htmlFor="native-event-all-day" className="text-sm font-medium">
                  {t("calendar.allDay")}
                </Label>
                <Switch
                  id="native-event-all-day"
                  checked={nativeEventDraft.allDay}
                  onCheckedChange={(checked) =>
                    setNativeEventDraft((draft) => (draft ? { ...draft, allDay: checked } : draft))
                  }
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="native-event-start">{t("calendar.start")}</Label>
                  <Input
                    id="native-event-start"
                    type={nativeEventDraft.allDay ? "date" : "datetime-local"}
                    value={
                      nativeEventDraft.allDay
                        ? toDateInputValue(nativeEventDraft.start)
                        : toDateTimeLocalValue(nativeEventDraft.start)
                    }
                    onChange={(event) =>
                      setNativeEventDraft((draft) =>
                        draft
                          ? {
                              ...draft,
                              start: draft.allDay
                                ? new Date(`${event.target.value}T00:00:00`)
                                : new Date(event.target.value),
                            }
                          : draft
                      )
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="native-event-end">{t("calendar.end")}</Label>
                  <Input
                    id="native-event-end"
                    type={nativeEventDraft.allDay ? "date" : "datetime-local"}
                    value={
                      nativeEventDraft.allDay
                        ? toDateInputValue(nativeEventDraft.end)
                        : toDateTimeLocalValue(nativeEventDraft.end)
                    }
                    onChange={(event) =>
                      setNativeEventDraft((draft) =>
                        draft
                          ? {
                              ...draft,
                              end: draft.allDay
                                ? new Date(`${event.target.value}T00:00:00`)
                                : new Date(event.target.value),
                            }
                          : draft
                      )
                    }
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:justify-between">
            <div>
              {nativeEventDraft?.id && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() =>
                    nativeEventDraft &&
                    deleteNativeEventMutation.mutate({
                      id: nativeEventDraft.id as string,
                      calendarId: nativeEventDraft.calendarId,
                    })
                  }
                  disabled={deleteNativeEventMutation.isPending}
                >
                  <Trash2 className="mr-1.5 h-4 w-4" />
                  {t("calendar.deleteEvent")}
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setNativeEventDraft(null)}>
                {t("calendar.cancel")}
              </Button>
              <Button
                type="button"
                onClick={() => nativeEventDraft && nativeEventMutation.mutate(nativeEventDraft)}
                disabled={
                  nativeEventMutation.isPending ||
                  !nativeEventDraft?.title.trim() ||
                  nativeCalendarSources.length === 0
                }
              >
                {nativeEventMutation.isPending ? t("calendar.saving") : t("calendar.save")}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(selectedEvent)}
        onOpenChange={(open) => !open && setSelectedEvent(null)}
      >
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>{selectedEvent?.title}</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-3 py-1">
            {selectedSource && (
              <div className="flex items-center gap-2 text-sm">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${CATEGORY_DOT_MAP[selectedSource.category]}`}
                />
                <span className="text-muted-foreground">{selectedSource.label}</span>
              </div>
            )}

            {selectedEvent && (
              <div className="text-sm">
                <span className="text-muted-foreground">{tTasks("dueDate")}: </span>
                {format(selectedEvent.start, "PPP", { locale: LOCALE_MAP[locale] })}
              </div>
            )}

            {(status || priorityLabel) && (
              <div className="flex flex-wrap items-center gap-2">
                {status && (
                  <Badge variant="secondary">
                    {tTasks("status")}: {capitalize(status)}
                  </Badge>
                )}
                {priorityLabel && (
                  <Badge variant="outline">
                    {tTasks("priority")}: {priorityLabel}
                  </Badge>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            {openHref && (
              <Button asChild>
                <Link href={openHref}>
                  <ExternalLink className="mr-1.5 h-4 w-4" />
                  {labels.openItem}
                </Link>
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
