"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { CheckSquare, Columns3, LayoutList, Plus } from "lucide-react";
import { toast } from "react-toastify";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { PageLoader } from "@/components/page-loader";
import { DataView } from "@/components/data-view/data-view";
import { DataViewFilters } from "@/components/data-view/data-view-filters";
import { DataViewSearchControl } from "@/components/data-view/data-view-search-control";
import {
  DataViewStaticContext,
  DataViewUrlContext,
} from "@/components/data-view/data-view-provider";
import {
  useDataViewUrlState,
  type DataViewUrlStateHook,
} from "@/components/data-view/data-view-url-state";
import { KanbanBoard, KanbanCard, type KanbanCardMoveParams } from "@/components/primitives/kanban";
import { UserAvatar } from "@/components/primitives/avatar";
import type {
  DataViewColumnDef,
  DataViewFilterDef,
  DataViewListParams,
  PaginatedResult,
} from "@/components/data-view/data-view.types";
import {
  changeTaskStatusAction,
  getTaskDetailAction,
  listTasksForDataViewAction,
  listTasksForKanbanAction,
} from "@/app/actions/planning";
import { PlanningTaskDetailPanel } from "./planning-task-detail-panel";
import { PlanningTaskCreateDialog } from "./planning-task-create-dialog";
import {
  PlanningTaskStatusBadge,
  type PlanningStatusBadgeConfig,
} from "@/components/planning/planning-task-status-badge";
import {
  PlanningTaskPriorityBadge,
  type PlanningPriorityBadgeConfig,
} from "@/components/planning/planning-task-priority-badge";
import type {
  PlanningTaskListRow,
  PlanningTaskDetail,
} from "@/server/services/planning-tasks.service";
import type { TaskStatus } from "@/lib/validations/planning";

const PLANNING_TASKS_QUERY_KEY = ["planning-tasks-dataview"];

interface Member {
  user_id: string;
  name: string | null;
  email: string | null;
}

interface TasksClientProps {
  initialData: PaginatedResult<PlanningTaskListRow>;
  initialKanbanTasks: PlanningTaskListRow[];
  canCreate: boolean;
  canUpdate: boolean;
  canAssign: boolean;
  canDelete: boolean;
  members: Member[];
  currentUserId: string;
  orgId: string;
  statusConfigs: Record<string, PlanningStatusBadgeConfig> | null;
  priorityConfigs: Record<string, PlanningPriorityBadgeConfig> | null;
}

export function TasksClient({
  initialData,
  initialKanbanTasks,
  canCreate,
  canUpdate,
  canAssign,
  canDelete,
  members,
  currentUserId,
  orgId,
  statusConfigs,
  priorityConfigs,
}: TasksClientProps) {
  const t = useTranslations("modules.planning");
  const [createOpen, setCreateOpen] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");
  const [dataViewData, setDataViewData] = useState(initialData);
  const [kanbanTasks, setKanbanTasks] = useState(initialKanbanTasks);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const statusLabel = useCallback(
    (status: "open" | "in_progress" | "completed" | "cancelled") =>
      statusConfigs?.[status]?.label ??
      t(`tasks.${status === "in_progress" ? "inProgress" : status}`),
    [statusConfigs, t]
  );

  const priorityLabel = useCallback(
    (priority: "low" | "normal" | "high" | "urgent") =>
      priorityConfigs?.[priority]?.label ?? t(`tasks.${priority}`),
    [priorityConfigs, t]
  );

  const listFetcher = useCallback(
    async (params: DataViewListParams): Promise<PaginatedResult<PlanningTaskListRow>> => {
      const result = await listTasksForDataViewAction(params, orgId);
      if (result.success) return result.data;
      throw new Error(t("errors.loadFailed"));
    },
    [orgId, t]
  );

  const detailFetcher = useCallback(
    async (id: string): Promise<PlanningTaskDetail | null> => {
      const result = await getTaskDetailAction(id, orgId);
      if (!result.success) return null;
      return result.data;
    },
    [orgId]
  );

  const refreshDataView = useCallback(() => {
    setRefreshToken((current) => current + 1);
  }, []);

  const refreshKanban = useCallback(async () => {
    const result = await listTasksForKanbanAction(orgId);
    if (result.success) setKanbanTasks(result.data);
  }, [orgId]);

  const applyTaskUpdate = useCallback((task: PlanningTaskListRow) => {
    setDataViewData((current) => ({
      ...current,
      rows: current.rows.map((row) => (row.id === task.id ? { ...row, ...task } : row)),
    }));
    setKanbanTasks((current) =>
      current.map((row) => (row.id === task.id ? { ...row, ...task } : row))
    );
  }, []);

  const handleCreated = useCallback(
    (task: PlanningTaskDetail) => {
      refreshDataView();
      setDataViewData((current) => ({
        ...current,
        totalCount: current.rows.some((item) => item.id === task.id)
          ? current.totalCount
          : current.totalCount + 1,
        rows: [task, ...current.rows.filter((item) => item.id !== task.id)].slice(
          0,
          current.pageSize
        ),
      }));
      setKanbanTasks((current) => [task, ...current.filter((item) => item.id !== task.id)]);
      const params = new URLSearchParams(searchParams.toString());
      params.set("selected", task.task_number);
      router.push(`${pathname}?${params.toString()}`);
    },
    [pathname, refreshDataView, router, searchParams]
  );

  const filters = useMemo<DataViewFilterDef[]>(
    () => [
      {
        key: "status",
        label: t("tasks.status"),
        type: "multi-select",
        options: [
          { value: "open", label: statusLabel("open") },
          { value: "in_progress", label: statusLabel("in_progress") },
          { value: "completed", label: statusLabel("completed") },
          { value: "cancelled", label: statusLabel("cancelled") },
        ],
      },
      {
        key: "priority",
        label: t("tasks.priority"),
        type: "multi-select",
        options: [
          { value: "low", label: priorityLabel("low") },
          { value: "normal", label: priorityLabel("normal") },
          { value: "high", label: priorityLabel("high") },
          { value: "urgent", label: priorityLabel("urgent") },
        ],
      },
    ],
    [priorityLabel, statusLabel, t]
  );

  const columns = useMemo<DataViewColumnDef<PlanningTaskListRow>[]>(
    () => [
      {
        key: "task_number",
        header: t("tasks.id"),
        accessor: (row) => (
          <span className="text-muted-foreground font-mono text-xs">{row.task_number}</span>
        ),
      },
      {
        key: "title",
        header: t("tasks.title"),
        accessor: (row) => (
          <span className="block max-w-[260px] truncate font-medium" title={row.title}>
            {row.title}
          </span>
        ),
        sortable: true,
      },
      {
        key: "status",
        header: t("tasks.status"),
        accessor: (row) => (
          <PlanningTaskStatusBadge status={row.status} config={statusConfigs?.[row.status]} />
        ),
        sortable: true,
      },
      {
        key: "priority",
        header: t("tasks.priority"),
        accessor: (row) => (
          <PlanningTaskPriorityBadge
            priority={row.priority}
            config={priorityConfigs?.[row.priority]}
          />
        ),
        sortable: true,
      },
      {
        key: "assigned_to",
        header: t("tasks.assignee"),
        accessor: (row) => (
          <div className="flex items-center">
            {row.assigned_to ? (
              <UserAvatar
                src={row.assignee_avatar_url}
                fullName={row.assignee_name}
                email={row.assignee_email}
                profileHref={row.assignee_profile_href}
                fallback={row.assignee_name ?? row.assignee_email ?? undefined}
                className="h-7 w-7"
                popoverSide="top"
                popoverAlign="start"
              />
            ) : (
              <span className="text-muted-foreground text-sm">—</span>
            )}
          </div>
        ),
      },
      {
        key: "due_at",
        header: t("tasks.due"),
        accessor: (row) =>
          row.due_at ? (
            <span className="text-sm">{new Date(row.due_at).toLocaleDateString()}</span>
          ) : (
            <span className="text-muted-foreground text-sm">—</span>
          ),
        sortable: true,
      },
      {
        key: "updated_at",
        header: t("tasks.updated"),
        accessor: (row) => (
          <span className="text-muted-foreground text-sm">
            {new Date(row.updated_at).toLocaleDateString()}
          </span>
        ),
        sortable: true,
      },
    ],
    [priorityConfigs, statusConfigs, t]
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-2">
          <CheckSquare className="h-5 w-5 text-teal-600" />
          <h1 className="text-lg font-semibold">{t("pages.tasks.title")}</h1>
        </div>
        <div className="flex items-center gap-2">
          <ToggleGroup
            type="single"
            value={viewMode}
            onValueChange={(value) => {
              if (value === "list" || value === "kanban") setViewMode(value);
            }}
            variant="outline"
            size="sm"
          >
            <ToggleGroupItem value="list" aria-label={t("tasks.listView")}>
              <LayoutList className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="kanban" aria-label={t("tasks.kanbanView")}>
              <Columns3 className="h-4 w-4" />
            </ToggleGroupItem>
          </ToggleGroup>
          {canCreate && (
            <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              {t("tasks.newTask")}
            </Button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1">
        {viewMode === "list" ? (
          <DataView<PlanningTaskListRow, PlanningTaskDetail>
            entity="planning-tasks"
            columns={columns}
            filters={filters}
            initialData={dataViewData}
            queryKey={PLANNING_TASKS_QUERY_KEY}
            refreshToken={refreshToken}
            listFetcher={listFetcher}
            detailFetcher={detailFetcher}
            getRowId={(row) => row.task_number}
            renderCompactItem={(row) => (
              <div className="flex min-w-0 flex-col gap-1 overflow-hidden">
                <div className="flex min-w-0 items-center justify-between gap-2">
                  <span className="text-muted-foreground shrink-0 font-mono text-xs">
                    {row.task_number}
                  </span>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <PlanningTaskPriorityBadge
                      priority={row.priority}
                      config={priorityConfigs?.[row.priority]}
                    />
                    <PlanningTaskStatusBadge
                      status={row.status}
                      config={statusConfigs?.[row.status]}
                    />
                  </div>
                </div>
                <span
                  className="block min-w-0 max-w-full truncate text-sm font-medium"
                  title={row.title}
                >
                  {row.title}
                </span>
              </div>
            )}
            renderDetail={(detail) => (
              <PlanningTaskDetailPanel
                key={detail.id}
                detail={detail}
                canUpdate={canUpdate}
                canAssign={canAssign}
                canDelete={canDelete}
                members={members}
                onRefresh={() => {
                  refreshDataView();
                  void refreshKanban();
                }}
                statusConfigs={statusConfigs}
                priorityConfigs={priorityConfigs}
              />
            )}
            renderToolbarControls={
              canCreate
                ? () => (
                    <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
                      <Plus className="h-4 w-4" />
                      {t("tasks.newTask")}
                    </Button>
                  )
                : undefined
            }
          />
        ) : (
          <TaskKanbanView
            tasks={kanbanTasks}
            canUpdate={canUpdate}
            statusLabel={statusLabel}
            statusConfigs={statusConfigs}
            priorityConfigs={priorityConfigs}
            detailFetcher={detailFetcher}
            filters={filters}
            members={members}
            canAssign={canAssign}
            canDelete={canDelete}
            onTasksChange={setKanbanTasks}
            onTaskUpdate={applyTaskUpdate}
            onRefresh={() => {
              refreshDataView();
              void refreshKanban();
            }}
          />
        )}
      </div>

      <PlanningTaskCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        members={members}
        currentUserId={currentUserId}
        canAssign={canAssign}
        onCreated={handleCreated}
        priorityConfigs={priorityConfigs}
      />
    </div>
  );
}

interface TaskKanbanViewProps {
  tasks: PlanningTaskListRow[];
  canUpdate: boolean;
  canAssign: boolean;
  canDelete: boolean;
  members: Member[];
  statusLabel: (status: TaskStatus) => string;
  statusConfigs: Record<string, PlanningStatusBadgeConfig> | null;
  priorityConfigs: Record<string, PlanningPriorityBadgeConfig> | null;
  detailFetcher: (id: string) => Promise<PlanningTaskDetail | null>;
  filters: DataViewFilterDef[];
  onTasksChange: (tasks: PlanningTaskListRow[]) => void;
  onTaskUpdate: (task: PlanningTaskListRow) => void;
  onRefresh: () => void;
}

interface TaskKanbanDataViewToolbarProps {
  filters: DataViewFilterDef[];
  urlState: DataViewUrlStateHook;
}

function TaskKanbanDataViewToolbar({ filters, urlState }: TaskKanbanDataViewToolbarProps) {
  const staticValue = useMemo(
    () => ({
      entity: "planning-tasks",
      queryKey: PLANNING_TASKS_QUERY_KEY,
      columns: [],
      filters,
      getRowId: (row: PlanningTaskListRow) => row.task_number,
      renderDetail: () => null,
    }),
    [filters]
  );

  const urlValue = useMemo(
    () => ({
      urlState,
      isDetailOpen: Boolean(urlState.selected),
    }),
    [urlState]
  );

  return (
    <DataViewStaticContext.Provider value={staticValue}>
      <DataViewUrlContext.Provider value={urlValue}>
        <div className="mb-3 flex min-h-12 shrink-0 items-center gap-2 border-b bg-background px-3 py-1">
          <DataViewSearchControl mode="list" />
          <DataViewFilters mode="inline" />
        </div>
      </DataViewUrlContext.Provider>
    </DataViewStaticContext.Provider>
  );
}

function TaskKanbanView({
  tasks,
  canUpdate,
  canAssign,
  canDelete,
  members,
  statusLabel,
  statusConfigs,
  priorityConfigs,
  detailFetcher,
  filters,
  onTasksChange,
  onTaskUpdate,
  onRefresh,
}: TaskKanbanViewProps) {
  const t = useTranslations("modules.planning");
  const urlState = useDataViewUrlState("planning-tasks");
  const [selectedDetail, setSelectedDetail] = useState<PlanningTaskDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const columns = useMemo(
    () => [
      { id: "open", title: statusLabel("open"), color: statusConfigs?.open?.color ?? "#64748b" },
      {
        id: "in_progress",
        title: statusLabel("in_progress"),
        color: statusConfigs?.in_progress?.color ?? "#f59e0b",
      },
      {
        id: "completed",
        title: statusLabel("completed"),
        color: statusConfigs?.completed?.color ?? "#22c55e",
      },
      {
        id: "cancelled",
        title: statusLabel("cancelled"),
        color: statusConfigs?.cancelled?.color ?? "#ef4444",
      },
    ],
    [statusConfigs, statusLabel]
  );

  const filteredTasks = useMemo(() => {
    const search = urlState.search.trim().toLowerCase();
    const statusFilter = urlState.filters.status;
    const priorityFilter = urlState.filters.priority;
    const statuses = Array.isArray(statusFilter)
      ? statusFilter
      : typeof statusFilter === "string"
        ? [statusFilter]
        : [];
    const priorities = Array.isArray(priorityFilter)
      ? priorityFilter
      : typeof priorityFilter === "string"
        ? [priorityFilter]
        : [];

    return tasks.filter((task) => {
      if (statuses.length && !statuses.includes(task.status)) return false;
      if (priorities.length && !priorities.includes(task.priority)) return false;
      if (!search) return true;

      return [task.task_number, task.title, task.assignee_name, task.assignee_email]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(search));
    });
  }, [tasks, urlState.filters.priority, urlState.filters.status, urlState.search]);

  useEffect(() => {
    let cancelled = false;

    if (!urlState.selected) {
      setSelectedDetail(null);
      setDetailLoading(false);
      return;
    }

    setDetailLoading(true);
    void detailFetcher(urlState.selected)
      .then((detail) => {
        if (!cancelled) setSelectedDetail(detail);
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [detailFetcher, urlState.selected]);

  const handleCardMove = useCallback(
    async ({ itemId, toColumnId }: KanbanCardMoveParams) => {
      const task = tasks.find((candidate) => candidate.id === itemId);
      if (!task || task.status === toColumnId) return;

      const nextStatus = toColumnId as TaskStatus;
      const previousTasks = tasks;
      onTasksChange(
        tasks.map((candidate) =>
          candidate.id === itemId
            ? { ...candidate, status: nextStatus, updated_at: new Date().toISOString() }
            : candidate
        )
      );

      const result = await changeTaskStatusAction(itemId, nextStatus);
      if (!result.success) {
        onTasksChange(previousTasks);
        toast.error(t("errors.operationFailed"));
        return;
      }

      onTasksChange(
        previousTasks.map((candidate) => (candidate.id === itemId ? result.data : candidate))
      );
      onTaskUpdate(result.data);
      setSelectedDetail((current) => (current?.id === result.data.id ? result.data : current));
      onRefresh();
    },
    [onRefresh, onTaskUpdate, onTasksChange, t, tasks]
  );

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <TaskKanbanDataViewToolbar filters={filters} urlState={urlState} />

      <KanbanBoard
        columns={columns}
        items={filteredTasks}
        getItemId={(task) => task.id}
        getItemColumnId={(task) => task.status}
        disabled={!canUpdate}
        columnsDraggable={false}
        labels={{
          emptyColumn: t("tasks.emptyColumn"),
          dragColumn: t("tasks.dragColumn"),
        }}
        onCardMove={handleCardMove}
        className="flex-1 px-4"
        renderCard={(task) => (
          <KanbanCard id={task.id} disabled={!canUpdate}>
            <div
              role="button"
              tabIndex={0}
              className="flex w-full min-w-0 flex-col gap-2 text-left outline-none"
              onClick={() => urlState.setSelected(task.task_number)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  urlState.setSelected(task.task_number);
                }
              }}
            >
              <div className="flex min-w-0 items-center justify-between gap-2">
                <PlanningTaskPriorityBadge
                  priority={task.priority}
                  config={priorityConfigs?.[task.priority]}
                />
                <span className="text-muted-foreground shrink-0 text-xs">
                  {new Date(task.created_at).toLocaleDateString()}
                </span>
              </div>
              <span className="line-clamp-2 text-sm font-medium">{task.title}</span>
              {task.due_at ? (
                <span className="text-muted-foreground text-xs">
                  {t("tasks.due")}: {new Date(task.due_at).toLocaleDateString()}
                </span>
              ) : null}
              <div className="flex items-end justify-between gap-2 text-xs text-muted-foreground">
                <div className="flex min-w-0 items-center gap-2">
                  <div onClick={(event) => event.stopPropagation()}>
                    {task.assigned_to ? (
                      <UserAvatar
                        src={task.assignee_avatar_url}
                        fullName={task.assignee_name}
                        email={task.assignee_email}
                        profileHref={task.assignee_profile_href}
                        fallback={task.assignee_name ?? task.assignee_email ?? undefined}
                        className="h-7 w-7"
                        popoverSide="top"
                        popoverAlign="start"
                      />
                    ) : (
                      <UserAvatar
                        fallback={t("tasks.unassigned")}
                        disabledPopover
                        className="h-7 w-7 opacity-60"
                      />
                    )}
                  </div>
                </div>
                <span className="text-muted-foreground mb-0.5 shrink-0 font-mono text-[10px] leading-none">
                  {task.task_number}
                </span>
              </div>
            </div>
          </KanbanCard>
        )}
      />

      <Dialog
        open={Boolean(urlState.selected)}
        onOpenChange={(open) => !open && urlState.closeDetail()}
      >
        <DialogContent className="h-[min(88vh,52rem)] max-w-[min(96vw,72rem)] overflow-hidden p-0">
          <DialogTitle className="sr-only">{selectedDetail?.title ?? t("tasks.title")}</DialogTitle>
          <DialogDescription className="sr-only">
            {selectedDetail?.task_number ?? urlState.selected}
          </DialogDescription>
          {detailLoading ? (
            <PageLoader className="h-full min-h-0" />
          ) : selectedDetail ? (
            <PlanningTaskDetailPanel
              key={selectedDetail.id}
              detail={selectedDetail}
              canUpdate={canUpdate}
              canAssign={canAssign}
              canDelete={canDelete}
              members={members}
              onRefresh={() => {
                void detailFetcher(selectedDetail.task_number).then((freshDetail) => {
                  if (!freshDetail) return;
                  setSelectedDetail(freshDetail);
                  onTaskUpdate(freshDetail);
                });
                onRefresh();
              }}
              showFullLink
              statusConfigs={statusConfigs}
              priorityConfigs={priorityConfigs}
            />
          ) : (
            <div className="flex h-full items-center justify-center px-6 text-sm text-muted-foreground">
              {t("empty.noDataDescription")}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
