import { ArrowDown, ArrowUp, ChevronsUpDown, ExternalLink, Eye } from "lucide-react";
import type { MouseEvent, ReactNode } from "react";
import { TableLink as PageLink } from "@/components/kolor-sensu/data-table/table-navigation";
import {
  DataTable,
  TablePagination,
  pageState,
  TD,
} from "@/components/kolor-sensu/data-table/data-table";
import { ColumnsMenu } from "@/components/kolor-sensu/data-table/columns-menu";
import {
  defaultLayout,
  type ColumnLayout,
  type ColumnSet,
  type ColumnWidths,
} from "@/components/kolor-sensu/data-table/columns";
import { RowActions, RowActionLink } from "@/components/kolor-sensu/row-actions";
import { UserAvatar } from "@/components/primitives/avatar/user-avatar";
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
      due_at: 130,
      creator: 170,
      created_at: 140,
      updated_at: 140,
    },
    shownByDefault: ["status", "priority", "assignee", "branch", "due_at", "updated_at"],
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
  const shown = layout.filter((c) => c.shown).map((c) => c.id);
  const { page, pages, range } = pageState(
    { page: state.strona, size: state.wierszy },
    data.totalCount,
    data.rows.length
  );
  const href = (patch: Partial<TaskState>) => taskHref(path, state, patch);
  const rowHref = (row: Row) =>
    href({ selected: state.selected === row.task_number ? null : row.task_number });
  const openPreview = (event: MouseEvent, row: Row) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;
    event.preventDefault();
    onPreview(state.selected === row.task_number ? null : row.task_number);
  };
  const sortOf = (field: TaskSort) => ({
    href: href({
      sort: field,
      direction: state.sort === field && state.direction === "asc" ? "desc" : "asc",
      strona: 1,
      selected: null,
    }),
    direction: state.sort === field ? state.direction : null,
  });
  const menu = (
    <ColumnsMenu
      cookie={cookie}
      defaults={defaultLayout(set)}
      labels={set.labels}
      layout={layout}
      onChange={onLayoutChange}
      pinnedLabel={set.pinned.label}
    />
  );
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
        return row.creator_name ?? row.creator_email ?? "—";
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
      : value(row, id);
  const pagination = (
    <TablePagination
      sizes={TASK_PAGE_SIZES.map((size) => ({
        size,
        current: state.wierszy === size,
        href: href({ wierszy: size, strona: 1, selected: null }),
      }))}
      range={range}
      previousHref={page > 1 ? href({ strona: page - 1, selected: null }) : null}
      nextHref={page < pages ? href({ strona: page + 1, selected: null }) : null}
    />
  );
  const numberSort = sortOf("task_number");
  const NumberSortIcon =
    numberSort.direction === "asc"
      ? ArrowUp
      : numberSort.direction === "desc"
        ? ArrowDown
        : ChevronsUpDown;
  const identity = (row: Row) => (
    <span className="min-w-0">
      <span className="block truncate text-[13px] font-medium" title={row.title}>
        {row.title}
      </span>
      <span className="block truncate font-mono text-[11px] leading-4 font-normal text-muted-foreground">
        {row.task_number}
      </span>
    </span>
  );
  const linkProps = (row: Row) => ({
    href: rowHref(row),
    scroll: false,
    onClick: (event: MouseEvent) => openPreview(event, row),
    onMouseEnter: () => onPrefetch(row.task_number),
    onMouseLeave: () => onPrefetch(null),
    onFocus: () => onPrefetch(row.task_number),
  });
  const empty = loading ? labels.loading : error ? labels.loadError : labels.empty;
  return (
    <div
      className={cn(
        "ks-list-pane relative flex min-h-0 min-w-0 flex-1 flex-col",
        state.selected && "ks-list-pane--preview"
      )}
      aria-busy={loading || refreshing}
      data-refreshing={refreshing ? "" : undefined}
    >
      {/* The rows stay while new ones come: a thin bar says so, not a skeleton. */}
      {loading || refreshing ? (
        <div className="ks-list-progress" role="progressbar" aria-label={labels.loading} />
      ) : null}
      {error ? (
        <div role="alert" className="border-b bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {labels.loadError} <span className="block text-xs">{error}</span>
          <button type="button" onClick={onRetry} className="underline">
            {labels.retry}
          </button>
        </div>
      ) : null}
      {state.selected ? (
        <aside
          className="ks-list-mini-list min-h-0 flex-1 overflow-y-auto border-r bg-background"
          aria-label={labels.title}
        >
          <header className="sticky top-0 z-10 flex h-[34px] items-center border-b bg-muted/70 px-3 text-[10px] font-medium text-muted-foreground backdrop-blur-sm">
            <PageLink
              href={numberSort.href}
              scroll={false}
              className={cn(
                "inline-flex items-center gap-1 rounded hover:text-foreground",
                numberSort.direction && "text-foreground"
              )}
            >
              {set.pinned.label}
              <NumberSortIcon
                className={cn("size-3", !numberSort.direction && "opacity-40")}
                aria-hidden="true"
              />
            </PageLink>
          </header>
          <ul>
            {data.rows.map((row) => {
              const selected = row.task_number === state.selected;
              return (
                <li key={row.id} data-row-id={row.task_number}>
                  <PageLink
                    {...linkProps(row)}
                    className={cn(
                      "group flex h-[49px] items-center gap-2.5 border-b px-3 py-1 hover:bg-muted/50",
                      selected &&
                        "border-l-[3px] border-l-primary bg-primary/10 pl-[9px] hover:bg-primary/10"
                    )}
                    aria-current={selected ? "true" : undefined}
                  >
                    {identity(row)}
                  </PageLink>
                </li>
              );
            })}
          </ul>
        </aside>
      ) : (
        <div className="ks-list-desktop-table min-h-0 flex-1 flex-col">
          <DataTable
            caption={labels.title}
            set={set}
            columns={shown.map((id) => ({
              id,
              label: set.labels[id],
              sort: SORT_FIELD[id] ? sortOf(SORT_FIELD[id]) : undefined,
            }))}
            rows={data.rows}
            rowKey={(row) => row.task_number}
            rowHref={rowHref}
            selected={(row) => row.task_number === state.selected}
            pinnedSort={numberSort}
            onRowIntent={(row) => onPrefetch(row ? row.task_number : null)}
            pinned={(row) => (
              <PageLink {...linkProps(row)} className="flex min-w-0 items-center gap-2.5 py-1">
                {identity(row)}
              </PageLink>
            )}
            cell={(row, id) => (
              <td
                key={id}
                className={cn(
                  TD,
                  id === "branch" || id === "creator" ? "text-muted-foreground" : ""
                )}
              >
                {value(row, id)}
              </td>
            )}
            actions={actions}
            menu={menu}
            widths={widths}
            widthsCookie={`${cookie}_widths`}
            empty={empty}
            pagination={pagination}
          />
        </div>
      )}
      <div className="ks-list-mobile min-h-0 flex-1 flex-col">
        <header className="flex h-10 shrink-0 items-center justify-between border-b px-3 text-xs text-muted-foreground">
          <span>
            {data.totalCount} {labels.countSuffix}
          </span>
          <div className="flex items-center gap-2">
            <PageLink href={numberSort.href}>
              {labels.column_task}{" "}
              {numberSort.direction === "asc" ? "↑" : numberSort.direction === "desc" ? "↓" : "↕"}
            </PageLink>
            {menu}
          </div>
        </header>
        <ul className="min-h-0 flex-1 overflow-auto overscroll-contain">
          {data.rows.map((row) => (
            <li key={row.id} className="flex items-start border-b px-3 py-2.5 hover:bg-muted/30">
              <PageLink {...linkProps(row)} className="flex min-w-0 flex-1 items-start gap-2.5">
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <strong className="truncate text-[13px] font-medium leading-5">
                      {row.title}
                    </strong>
                    <TaskStatus row={row} configs={configs} />
                  </span>
                  <span className="block truncate font-mono text-[11px] text-muted-foreground">
                    {row.task_number}
                  </span>
                  <span className="mt-1.5 grid grid-cols-2 gap-x-2 gap-y-1">
                    {shown
                      .filter((id) => id !== "status")
                      .map((id) => (
                        <span key={id} className="min-w-0 text-xs">
                          <span className="block text-[10px] text-muted-foreground">
                            {set.labels[id]}
                          </span>
                          <span className="block truncate">{plainValue(row, id)}</span>
                        </span>
                      ))}
                  </span>
                </span>
              </PageLink>
              <div className="ml-1 shrink-0">{actions(row)}</div>
            </li>
          ))}
          {!data.rows.length ? (
            <li className="px-4 py-12 text-center text-sm text-muted-foreground">{empty}</li>
          ) : null}
        </ul>
        {pagination}
      </div>
    </div>
  );
}
