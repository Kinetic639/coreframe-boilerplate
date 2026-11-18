import { ExternalLink, Eye, Lock } from "lucide-react";
import type { ReactNode } from "react";
import { ListPane } from "@/components/data-table/list-pane";
import {
  type ColumnLayout,
  type ColumnSet,
  type ColumnWidths,
} from "@/components/data-table/columns";
import { RowActions, RowActionLink } from "@/components/data-table/row-actions";
import { UserAvatar } from "@/components/primitives/avatar/user-avatar";
import { MemberAvatar, MemberProfilesProvider } from "@/components/planning/member-avatar";
import {
  PlanningTaskStatusBadge,
  type PlanningStatusBadgeConfig,
} from "@/components/planning/planning-task-status-badge";
import {
  PlanningTaskPriorityBadge,
  type PlanningPriorityBadgeConfig,
} from "@/components/planning/planning-task-priority-badge";
import type { PlanningTaskListRow } from "@/server/services/planning-tasks.service";
import { cn } from "@/lib/utils";
import type { TaskList } from "./tasks-query";
import { taskHref, TASK_PAGE_SIZES, type TaskSort, type TaskState } from "./tasks-state";

type Row = PlanningTaskListRow;

export interface TaskBadgeConfigs {
  status: Record<string, PlanningStatusBadgeConfig> | null;
  priority: Record<string, PlanningPriorityBadgeConfig> | null;
}

/** Columns the list sorts by (each the task's own field). */
const SORT_FIELD: Record<string, TaskSort> = {
  due_at: "due_at",
  created_at: "created_at",
  updated_at: "updated_at",
};

export function taskColumnSet(labels: Record<string, string>): ColumnSet<string> {
  const ids = [
    "status",
    "priority",
    "assignee",
    "branch",
    "board",
    "due_at",
    "creator",
    "created_at",
    "updated_at",
  ];
  return {
    ids,
    labels: Object.fromEntries(ids.map((id) => [id, labels[`column_${id}`]])),
    widths: {
      status: 150,
      priority: 120,
      assignee: 190,
      branch: 160,
      board: 200,
      due_at: 130,
      creator: 170,
      created_at: 140,
      updated_at: 140,
    },
    shownByDefault: ["status", "priority", "assignee", "board", "due_at", "updated_at"],
    pinned: { id: "task", label: labels.column_task, width: 320 },
  };
}

export function TaskStatus({
  row,
  configs,
}: {
  row: Pick<Row, "status">;
  configs: TaskBadgeConfigs;
}) {
  return <PlanningTaskStatusBadge status={row.status} config={configs.status?.[row.status]} />;
}

export function TasksTable({
  data,
  state,
  path,
  set,
  layout,
  widths,
  cookie,
  labels,
  configs,
  branchNames,
  taskPath,
  loading,
  refreshing,
  error,
  onRetry,
  onLayoutChange,
  onPreview,
  onPrefetch,
}: {
  data: TaskList;
  state: TaskState;
  path: string;
  set: ColumnSet<string>;
  layout: ColumnLayout;
  widths: ColumnWidths;
  cookie: string;
  labels: Record<string, string>;
  configs: TaskBadgeConfigs;
  branchNames: Record<string, string>;
  taskPath: (taskNumber: string) => string;
  /** Nothing to show yet (no rows of this address in the cache). */
  loading: boolean;
  /** The rows shown are an older address's, new ones are coming. */
  refreshing: boolean;
  error: string | null;
  onRetry: () => void;
  onLayoutChange: (layout: ColumnLayout) => void;
  onPreview: (taskNumber: string | null) => void;
  /** The pointer rests on a row (null: it left): its card can be fetched. */
  onPrefetch: (taskNumber: string | null) => void;
}) {
  const href = (patch: Partial<TaskState>) => taskHref(path, state, patch);
  const rowHref = (row: Row) =>
    href({ selected: state.selected === row.task_number ? null : row.task_number });
  const sortOf = (field: TaskSort) => ({
    href: href({
      sort: field,
      direction: state.sort === field && state.direction === "asc" ? "desc" : "asc",
      strona: 1,
      selected: null,
    }),
    direction: state.sort === field ? state.direction : null,
  });
  const date = (value: string | null, withTime = true) =>
    value ? (
      <span className="text-xs text-muted-foreground">
        {new Date(value).toLocaleString(
          labels.locale,
          withTime ? { dateStyle: "short", timeStyle: "short" } : { dateStyle: "short" }
        )}
      </span>
    ) : (
      "—"
    );
  const isOverdue = (row: Row) =>
    !!row.due_at &&
    (row.status === "open" || row.status === "in_progress") &&
    new Date(row.due_at).getTime() < Date.now();
  const actions = (row: Row) => (
    <RowActions label={row.task_number}>
      <RowActionLink href={rowHref(row)} icon={<Eye className="size-4" />}>
        {labels.preview}
      </RowActionLink>
      <RowActionLink href={taskPath(row.task_number)} icon={<ExternalLink className="size-4" />}>
        {labels.viewFull}
      </RowActionLink>
    </RowActions>
  );
  const value = (row: Row, id: string): ReactNode => {
    switch (id) {
      case "status":
        return <TaskStatus row={row} configs={configs} />;
      case "priority":
        return (
          <PlanningTaskPriorityBadge
            priority={row.priority}
            config={configs.priority?.[row.priority]}
          />
        );
      case "assignee":
        return row.assigned_to ? (
          <span className="flex min-w-0 items-center gap-2">
            <UserAvatar
              src={row.assignee_avatar_url}
              fullName={row.assignee_name}
              email={row.assignee_email}
              profileHref={row.assignee_profile_href}
              fallback={row.assignee_name ?? row.assignee_email ?? undefined}
              className="size-6"
              popoverSide="top"
              popoverAlign="start"
            />
            <span className="truncate">{row.assignee_name ?? row.assignee_email}</span>
          </span>
        ) : (
          <span className="text-muted-foreground">{labels.unassigned}</span>
        );
      case "branch":
        return row.branch_id ? (branchNames[row.branch_id] ?? "—") : labels.orgWide;
      case "board":
        if (row.is_inbox) return labels.inbox;
        if (!row.board_id) return labels.noBoard;
        return (
          <span
            className="truncate"
            title={[row.board_title, row.column_title].filter(Boolean).join(" · ")}
          >
            {row.is_private ? (
              <Lock
                className="mr-1 inline size-3 align-[-1px] text-muted-foreground"
                aria-hidden="true"
              />
            ) : null}
            {row.board_title ?? "—"}
            {row.column_title ? (
              <span className="text-muted-foreground"> · {row.column_title}</span>
            ) : null}
          </span>
        );
      case "due_at":
        return row.due_at ? (
          <span
            className={cn(
              "text-xs",
              isOverdue(row) ? "font-medium text-destructive" : "text-muted-foreground"
            )}
            title={isOverdue(row) ? labels.overdue : undefined}
          >
            {new Date(row.due_at).toLocaleDateString(labels.locale)}
          </span>
        ) : (
          "—"
        );
      case "creator":
        return row.created_by ? (
          <span className="flex min-w-0 items-center gap-2">
            <MemberAvatar
              userId={row.created_by}
              name={row.creator_name}
              email={row.creator_email}
              className="size-6"
            />
            <span className="truncate">{row.creator_name ?? row.creator_email}</span>
          </span>
        ) : (
          "—"
        );
      case "created_at":
        return date(row.created_at);
      case "updated_at":
        return date(row.updated_at);
      default:
        return "—";
    }
  };
  // The phone card is one link: people show as names there, not avatar links.
  const plainValue = (row: Row, id: string): ReactNode =>
    id === "assignee"
      ? (row.assignee_name ?? row.assignee_email ?? labels.unassigned)
      : id === "creator"
        ? (row.creator_name ?? row.creator_email ?? "—")
        : id === "board" && row.board_id
          ? [row.board_title, row.column_title].filter(Boolean).join(" · ") || "—"
          : value(row, id);
  const identity = (row: Row) => (
    <span className="min-w-0">
      <span className="flex min-w-0 items-center gap-1.5 text-[13px] font-medium">
        {row.is_private ? (
          <Lock
            className="size-3 shrink-0 text-muted-foreground"
            role="img"
            aria-label={row.is_inbox ? labels.privateInbox : labels.privateBoard}
          >
            <title>{row.is_inbox ? labels.privateInbox : labels.privateBoard}</title>
          </Lock>
        ) : null}
        <span className="truncate" title={row.title}>
          {row.title}
        </span>
      </span>
      <span className="block truncate font-mono text-[11px] leading-4 font-normal text-muted-foreground">
        {row.task_number}
      </span>
    </span>
  );
  return (
    <MemberProfilesProvider userIds={data.rows.map((row) => row.created_by)}>
      <ListPane
        rows={data.rows}
        totalCount={data.totalCount}
        page={state.strona}
        size={state.wierszy}
        sizes={TASK_PAGE_SIZES}
        selected={state.selected}
        rowKey={(row) => row.task_number}
        rowHref={rowHref}
        pageHref={(page) => href({ strona: page, selected: null })}
        sizeHref={(size) =>
          href({ wierszy: size as TaskState["wierszy"], strona: 1, selected: null })
        }
        set={set}
        layout={layout}
        widths={widths}
        cookie={cookie}
        onLayoutChange={onLayoutChange}
        sortOf={(id) => (SORT_FIELD[id] ? sortOf(SORT_FIELD[id]) : undefined)}
        pinnedSort={sortOf("task_number")}
        identity={identity}
        value={value}
        plainValue={plainValue}
        badge={(row) => <TaskStatus row={row} configs={configs} />}
        cardHidden={["status"]}
        actions={actions}
        cellClassName={(id) =>
          id === "branch" || id === "creator" ? "text-muted-foreground" : undefined
        }
        labels={labels}
        empty={labels.empty}
        loading={loading}
        refreshing={refreshing}
        error={error}
        onRetry={onRetry}
        onPreview={onPreview}
        onPrefetch={onPrefetch}
      />
    </MemberProfilesProvider>
  );
}
