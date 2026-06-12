"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "react-toastify";
import { format, startOfDay } from "date-fns";
import { ExternalLink } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  getPlanningCalendarDataAction,
  updateCalendarItemDueDateAction,
} from "@/app/actions/planning/calendar";
import { updateModuleSettingsAction } from "@/app/actions/user-preferences";
import { useDebounce } from "@/hooks/use-debounce";
import { useUiStoreV2 } from "@/lib/stores/v2/ui-store";
import {
  HELPDESK_TICKETS_SOURCE_ID,
  PLANNING_TASKS_SOURCE_ID,
} from "@/lib/constants/planning-calendar";
import type {
  CalendarEventDTO,
  CalendarItemSourceType,
  PlanningCalendarData,
  UnscheduledItemDTO,
} from "@/lib/types/planning-calendar";
import type { PlanningTaskDetail } from "@/server/services/planning-tasks.service";
import type { PlanningPriorityBadgeConfig } from "@/components/planning/planning-task-priority-badge";
import { PlanningTaskCreateDialog } from "../tasks/_components/planning-task-create-dialog";

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
  return calendarSourceId?.startsWith("kanban-board:")
    ? calendarSourceId.slice("kanban-board:".length)
    : undefined;
}

function dtoToCalendarEvent(dto: CalendarEventDTO): CalendarEvent {
  const date = startOfDay(new Date(dto.dueAt));
  return {
    id: dto.id,
    title: dto.title,
    start: date,
    end: date,
    allDay: true,
    category: dto.category,
    calendarSourceId: dto.calendarSourceId,
    sourceModule: dto.sourceModule,
    sourceType: dto.sourceType,
    sourceId: dto.sourceId,
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

export function PlanningCalendarClient({
  members,
  currentUserId,
  canAssign,
  canCreateTasks,
  priorityConfigs,
  initialVisibleSources,
}: PlanningCalendarClientProps) {
  const locale = useLocale() as "en" | "pl";
  const t = useTranslations("modules.planning");
  const tTasks = useTranslations("modules.planning.tasks");
  const labels = LABELS_MAP[locale];

  const setFlushContent = useUiStoreV2((state) => state.setFlushContent);
  useEffect(() => {
    setFlushContent(true);
    return () => setFlushContent(false);
  }, [setFlushContent]);

  const [calendarData, setCalendarData] = useState<PlanningCalendarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [visibleSources, setVisibleSources] =
    useState<Record<string, boolean>>(initialVisibleSources);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createDueAt, setCreateDueAt] = useState<string | undefined>(undefined);

  const debouncedVisibleSources = useDebounce(visibleSources, 800);

  const loadCalendarData = useCallback(async () => {
    const result = await getPlanningCalendarDataAction();
    if (result.success) {
      setCalendarData(result.data);
    } else {
      toast.error(actionErrorMessage(result));
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const result = await getPlanningCalendarDataAction();
      if (!active) return;
      if (result.success) {
        setCalendarData(result.data);
      } else {
        toast.error(actionErrorMessage(result));
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (debouncedVisibleSources === initialVisibleSources) return;
    void updateModuleSettingsAction("calendar", { visibleSources: debouncedVisibleSources });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedVisibleSources]);

  const reloadCalendarData = useCallback(async () => {
    await loadCalendarData();
    setRefreshKey((key) => key + 1);
  }, [loadCalendarData]);

  const calendarSources = useMemo<CalendarSource[]>(() => {
    if (!calendarData) return [];
    return calendarData.sources.map((source) => {
      if (source.id === PLANNING_TASKS_SOURCE_ID) return { ...source, label: labels.catTask };
      if (source.id === HELPDESK_TICKETS_SOURCE_ID)
        return { ...source, label: labels.ticketsSource };
      return source;
    });
  }, [calendarData, labels]);

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

  const handleSelectRealEvent = useCallback((event: CalendarEvent) => {
    setSelectedEvent(event);
  }, []);

  const handleCreateAt = useCallback(
    (date: Date) => {
      if (!canCreateTasks) return;
      setCreateDueAt(format(date, "yyyy-MM-dd"));
      setCreateOpen(true);
    },
    [canCreateTasks]
  );

  const handleMoveRealEvent = useCallback(
    async (event: CalendarEvent, newDate: Date) => {
      if (!event.sourceType || !event.sourceId) return;
      const boardId =
        event.sourceType === "kanban_card"
          ? boardIdFromCalendarSource(event.calendarSourceId)
          : undefined;

      const result = await updateCalendarItemDueDateAction({
        sourceType: event.sourceType as CalendarItemSourceType,
        sourceId: event.sourceId,
        boardId,
        dueAt: newDate.toISOString(),
      });

      if (!result.success) {
        toast.error(actionErrorMessage(result));
        await reloadCalendarData();
      }
    },
    [reloadCalendarData]
  );

  const handleScheduleRealTask = useCallback(
    async (task: UnscheduledTask, date: Date) => {
      const { sourceType, sourceId } = parseSourceId(task.id);
      const boardId =
        sourceType === "kanban_card" ? boardIdFromCalendarSource(task.calendarSourceId) : undefined;

      const result = await updateCalendarItemDueDateAction({
        sourceType,
        sourceId,
        boardId,
        dueAt: date.toISOString(),
      });

      if (!result.success) {
        toast.error(actionErrorMessage(result));
      }
      await reloadCalendarData();
    },
    [reloadCalendarData]
  );

  const handleTaskCreated = useCallback(
    (_task: PlanningTaskDetail) => {
      void reloadCalendarData();
    },
    [reloadCalendarData]
  );

  const openHref = useMemo(() => {
    if (!selectedEvent) return null;
    switch (selectedEvent.sourceType) {
      case "planning_task":
        return {
          pathname: "/dashboard/planning/tasks/[taskId]" as const,
          params: { taskId: selectedEvent.sourceId ?? "" },
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

  if (loading) {
    return <PageLoader />;
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1">
        <CalendarScheduler
          key={refreshKey}
          title={t("pages.overview.title")}
          calendarSources={calendarSources}
          initialEvents={initialEvents}
          initialUnscheduledTasks={initialUnscheduledTasks}
          initialSettings={initialSettings}
          onSelectRealEvent={handleSelectRealEvent}
          onCreateAt={handleCreateAt}
          onMoveRealEvent={handleMoveRealEvent}
          onScheduleRealTask={handleScheduleRealTask}
          onSettingsChange={handleSettingsChange}
        />
      </div>

      <PlanningTaskCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        members={members}
        currentUserId={currentUserId}
        canAssign={canAssign}
        onCreated={handleTaskCreated}
        priorityConfigs={priorityConfigs}
        initialDueAt={createDueAt}
      />

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
