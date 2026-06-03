"use client";

import { useCallback } from "react";
import { Plus, CheckSquare, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataView } from "@/components/data-view/data-view";
import type {
  DataViewColumnDef,
  DataViewFilterDef,
  DataViewListParams,
  PaginatedResult,
} from "@/components/data-view/data-view.types";
import { listTasksForDataViewAction, getTaskDetailAction } from "@/app/actions/planning";
import type {
  PlanningTaskListRow,
  PlanningTaskDetail,
} from "@/server/services/planning-tasks.service";
import type { TaskStatus, TaskPriority } from "@/lib/validations/planning";

const PLANNING_TASKS_QUERY_KEY = ["planning-tasks-dataview"];

interface TasksClientProps {
  initialData: PaginatedResult<PlanningTaskListRow>;
  canCreate: boolean;
  canAssign: boolean;
  members: Array<{ user_id: string; name: string | null; email: string | null }>;
  orgId: string;
}

const STATUS_LABELS: Record<TaskStatus, string> = {
  open: "Open",
  in_progress: "In Progress",
  completed: "Completed",
};

const STATUS_COLORS: Record<TaskStatus, string> = {
  open: "bg-blue-100 text-blue-700 border-blue-200",
  in_progress: "bg-amber-100 text-amber-700 border-amber-200",
  completed: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  low: "bg-slate-100 text-slate-600 border-slate-200",
  normal: "bg-blue-100 text-blue-600 border-blue-200",
  high: "bg-orange-100 text-orange-700 border-orange-200",
  urgent: "bg-red-100 text-red-700 border-red-200",
};

function TaskDetailPanel({ detail }: { detail: PlanningTaskDetail }) {
  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Title</p>
        <p className="mt-1 text-sm">{detail.title}</p>
      </div>
      {detail.description && (
        <div>
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
            Description
          </p>
          <p className="mt-1 text-sm">{detail.description}</p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
            Status
          </p>
          <Badge variant="outline" className={`mt-1 text-xs ${STATUS_COLORS[detail.status] ?? ""}`}>
            {STATUS_LABELS[detail.status] ?? detail.status}
          </Badge>
        </div>
        <div>
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
            Priority
          </p>
          <Badge
            variant="outline"
            className={`mt-1 text-xs ${PRIORITY_COLORS[detail.priority] ?? ""}`}
          >
            {PRIORITY_LABELS[detail.priority] ?? detail.priority}
          </Badge>
        </div>
      </div>
      {detail.assignee_name && (
        <div>
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
            Assigned to
          </p>
          <p className="mt-1 text-sm">{detail.assignee_name}</p>
        </div>
      )}
      {detail.due_at && (
        <div>
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
            Due date
          </p>
          <p className="mt-1 text-sm">{new Date(detail.due_at).toLocaleDateString()}</p>
        </div>
      )}
      <div>
        <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
          Created by
        </p>
        <p className="mt-1 text-sm">{detail.creator_name ?? detail.creator_email ?? "Unknown"}</p>
      </div>
    </div>
  );
}

const COLUMNS: DataViewColumnDef<PlanningTaskListRow>[] = [
  {
    key: "title",
    header: "Title",
    accessor: (row) => (
      <span className="block max-w-[280px] truncate font-medium">{row.title}</span>
    ),
    sortable: true,
  },
  {
    key: "status",
    header: "Status",
    accessor: (row) => (
      <Badge variant="outline" className={`text-xs ${STATUS_COLORS[row.status] ?? ""}`}>
        {STATUS_LABELS[row.status] ?? row.status}
      </Badge>
    ),
    sortable: true,
  },
  {
    key: "priority",
    header: "Priority",
    accessor: (row) => (
      <Badge variant="outline" className={`text-xs ${PRIORITY_COLORS[row.priority] ?? ""}`}>
        {PRIORITY_LABELS[row.priority] ?? row.priority}
      </Badge>
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
    header: "Due date",
    accessor: (row) =>
      row.due_at ? (
        <span className="text-sm">{new Date(row.due_at).toLocaleDateString()}</span>
      ) : (
        <span className="text-muted-foreground text-sm">—</span>
      ),
    sortable: true,
  },
  {
    key: "created_at",
    header: "Created",
    accessor: (row) => (
      <span className="text-muted-foreground text-sm">
        {new Date(row.created_at).toLocaleDateString()}
      </span>
    ),
    sortable: true,
  },
];

const FILTERS: DataViewFilterDef[] = [
  {
    key: "status",
    label: "Status",
    type: "multi-select",
    options: [
      { value: "open", label: "Open" },
      { value: "in_progress", label: "In Progress" },
      { value: "completed", label: "Completed" },
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

export function TasksClient({ initialData, canCreate, orgId }: TasksClientProps) {
  const listFetcher = useCallback(
    async (params: DataViewListParams): Promise<PaginatedResult<PlanningTaskListRow>> => {
      const result = await listTasksForDataViewAction(params);
      if (result.success) return result.data;
      throw new Error((result as { success: false; error: string }).error);
    },
    []
  );

  const detailFetcher = useCallback(async (id: string): Promise<PlanningTaskDetail | null> => {
    const result = await getTaskDetailAction(id);
    if (!result.success) return null;
    return result.data;
  }, []);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-2">
          <CheckSquare className="h-5 w-5 text-teal-600" />
          <h1 className="text-lg font-semibold">Tasks</h1>
        </div>
        {canCreate && (
          <Button size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" />
            New task
          </Button>
        )}
      </div>

      <div className="min-h-0 flex-1">
        <DataView<PlanningTaskListRow, PlanningTaskDetail>
          entity="planning-tasks"
          columns={COLUMNS}
          filters={FILTERS}
          initialData={initialData}
          queryKey={PLANNING_TASKS_QUERY_KEY}
          listFetcher={listFetcher}
          detailFetcher={detailFetcher}
          getRowId={(row) => row.id}
          renderCompactItem={(row) => (
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2">
                <Badge variant="outline" className={`text-xs ${STATUS_COLORS[row.status] ?? ""}`}>
                  {STATUS_LABELS[row.status] ?? row.status}
                </Badge>
                <Badge
                  variant="outline"
                  className={`text-xs ${PRIORITY_COLORS[row.priority] ?? ""}`}
                >
                  {PRIORITY_LABELS[row.priority] ?? row.priority}
                </Badge>
              </div>
              <span className="truncate text-sm font-medium" title={row.title}>
                {row.title}
              </span>
            </div>
          )}
          renderDetail={(detail) => <TaskDetailPanel key={detail.id} detail={detail} />}
          renderToolbarControls={
            canCreate
              ? () => (
                  <Button size="sm" className="gap-1.5">
                    <Plus className="h-4 w-4" />
                    New task
                  </Button>
                )
              : undefined
          }
        />
      </div>
    </div>
  );
}
