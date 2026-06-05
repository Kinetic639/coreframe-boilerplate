"use client";

import { useState, useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus, CheckSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataView } from "@/components/data-view/data-view";
import type {
  DataViewColumnDef,
  DataViewFilterDef,
  DataViewListParams,
  PaginatedResult,
} from "@/components/data-view/data-view.types";
import { listTasksForDataViewAction, getTaskDetailAction } from "@/app/actions/planning";
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

const PLANNING_TASKS_QUERY_KEY = ["planning-tasks-dataview"];

interface Member {
  user_id: string;
  name: string | null;
  email: string | null;
}

interface TasksClientProps {
  initialData: PaginatedResult<PlanningTaskListRow>;
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

  const handleCreated = useCallback(
    (task: PlanningTaskDetail) => {
      refreshDataView();
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
          <span className="text-muted-foreground text-sm">
            {row.assignee_name ?? row.assignee_email ?? "—"}
          </span>
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
        {canCreate && (
          <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            {t("tasks.newTask")}
          </Button>
        )}
      </div>

      <div className="min-h-0 flex-1">
        <DataView<PlanningTaskListRow, PlanningTaskDetail>
          entity="planning-tasks"
          columns={columns}
          filters={filters}
          initialData={initialData}
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
              onRefresh={refreshDataView}
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
