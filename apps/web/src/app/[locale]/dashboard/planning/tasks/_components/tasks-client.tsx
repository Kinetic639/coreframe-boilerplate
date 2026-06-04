"use client";

import { useState, useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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

const FILTERS: DataViewFilterDef[] = [
  {
    key: "status",
    label: "Status",
    type: "multi-select",
    options: [
      { value: "open", label: "Open" },
      { value: "in_progress", label: "In Progress" },
      { value: "completed", label: "Completed" },
      { value: "cancelled", label: "Cancelled" },
    ],
  },
  {
    key: "priority",
    label: "Priority",
    type: "multi-select",
    options: [
      { value: "low", label: "Low" },
      { value: "normal", label: "Normal" },
      { value: "high", label: "High" },
      { value: "urgent", label: "Urgent" },
    ],
  },
];

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
  const [createOpen, setCreateOpen] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const listFetcher = useCallback(
    async (params: DataViewListParams): Promise<PaginatedResult<PlanningTaskListRow>> => {
      const result = await listTasksForDataViewAction(params, orgId);
      if (result.success) return result.data;
      throw new Error((result as { success: false; error: string }).error);
    },
    [orgId]
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

  const columns = useMemo<DataViewColumnDef<PlanningTaskListRow>[]>(
    () => [
      {
        key: "task_number",
        header: "ID",
        accessor: (row) => (
          <span className="text-muted-foreground font-mono text-xs">{row.task_number}</span>
        ),
      },
      {
        key: "title",
        header: "Title",
        accessor: (row) => (
          <span className="block max-w-[260px] truncate font-medium" title={row.title}>
            {row.title}
          </span>
        ),
        sortable: true,
      },
      {
        key: "status",
        header: "Status",
        accessor: (row) => (
          <PlanningTaskStatusBadge status={row.status} config={statusConfigs?.[row.status]} />
        ),
        sortable: true,
      },
      {
        key: "priority",
        header: "Priority",
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
        header: "Assignee",
        accessor: (row) => (
          <span className="text-muted-foreground text-sm">
            {row.assignee_name ?? row.assignee_email ?? "—"}
          </span>
        ),
      },
      {
        key: "due_at",
        header: "Due",
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
        header: "Updated",
        accessor: (row) => (
          <span className="text-muted-foreground text-sm">
            {new Date(row.updated_at).toLocaleDateString()}
          </span>
        ),
        sortable: true,
      },
    ],
    [priorityConfigs, statusConfigs]
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-2">
          <CheckSquare className="h-5 w-5 text-teal-600" />
          <h1 className="text-lg font-semibold">Tasks</h1>
        </div>
        {canCreate && (
          <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            New task
          </Button>
        )}
      </div>

      <div className="min-h-0 flex-1">
        <DataView<PlanningTaskListRow, PlanningTaskDetail>
          entity="planning-tasks"
          columns={columns}
          filters={FILTERS}
          initialData={initialData}
          queryKey={PLANNING_TASKS_QUERY_KEY}
          refreshToken={refreshToken}
          listFetcher={listFetcher}
          detailFetcher={detailFetcher}
          getRowId={(row) => row.task_number}
          renderCompactItem={(row) => (
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="text-muted-foreground shrink-0 font-mono text-xs">
                    {row.task_number}
                  </span>
                  <PlanningTaskPriorityBadge
                    priority={row.priority}
                    config={priorityConfigs?.[row.priority]}
                  />
                </div>
                <PlanningTaskStatusBadge status={row.status} config={statusConfigs?.[row.status]} />
              </div>
              <span className="truncate text-sm font-medium" title={row.title}>
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
                    New task
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
      />
    </div>
  );
}
