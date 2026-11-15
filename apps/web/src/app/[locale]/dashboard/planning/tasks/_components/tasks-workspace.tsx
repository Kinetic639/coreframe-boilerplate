"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useQueryStates } from "nuqs";
import { ExternalLink, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FilterBar, type FilterField } from "@/components/data-table/filter-bar";
import type { ColumnLayout, ColumnSet, ColumnWidths } from "@/components/data-table/columns";
import { TableNavigationProvider } from "@/components/data-table/table-navigation";
import type {
  PlanningTaskDetail,
  PlanningTaskListRow,
} from "@/server/services/planning-tasks.service";
import { PlanningViewSwitcher } from "../../_components/planning-view-switcher";
import { PlanningTaskCreateDialog } from "./planning-task-create-dialog";
import { PlanningTaskDetailPanel } from "./planning-task-detail-panel";
import { TasksTable, TaskStatus as TaskStatusBadge, type TaskBadgeConfigs } from "./tasks-table";
import { taskDetailQuery, taskKeys, taskListQuery, type TaskList } from "./tasks-query";
import {
  DUE_WITHIN,
  ORG_WIDE,
  taskHref,
  taskParsers,
  TASK_PRIORITIES,
  TASK_STATUSES,
  UNASSIGNED,
} from "./tasks-state";

/** How long the pointer rests on a row before its card is fetched. */
const HOVER_INTENT_MS = 150;

const EMPTY_LIST: TaskList = { rows: [], totalCount: 0, page: 1, pageSize: 50 };

type Member = { user_id: string; name: string | null; email: string | null };
type Option = { value: string; label: string };

/**
 * The tasks list: the title bar (views, create), the filters, and the list
 * with its side panel. The address is the one state: every change only
 * pushes a new address, and the list answers from its cache (the server put
 * the first page there) or fetches just its rows. A change to a task drops the section's cache.
 */
export function TasksWorkspace({
  orgId,
  path,
  set,
  layout: savedLayout,
  widths,
  cookie,
  labels,
  configs,
  members,
  branches,
  activeBranchId,
  currentUserId,
  canCreate,
  canUpdate,
  canAssign,
  canDelete,
  taskPathTemplate,
}: {
  orgId: string;
  path: string;
  set: ColumnSet<string>;
  layout: ColumnLayout;
  widths: ColumnWidths;
  cookie: string;
  labels: Record<string, string>;
  configs: TaskBadgeConfigs;
  members: Member[];
  branches: { id: string; name: string }[];
  activeBranchId: string | null;
  currentUserId: string;
  canCreate: boolean;
  canUpdate: boolean;
  canAssign: boolean;
  canDelete: boolean;
  taskPathTemplate: string;
}) {
  const queryClient = useQueryClient();
  const [state] = useQueryStates(taskParsers);
  const list = useQuery({ ...taskListQuery(orgId, state), placeholderData: keepPreviousData });
  const data = list.data ?? EMPTY_LIST;
  const [layout, setLayout] = useState(savedLayout);
  const [createOpen, setCreateOpen] = useState(false);

  /** Same page, new address: Next keeps useSearchParams in step with it. */
  const navigate = useCallback((href: string) => {
    window.history.pushState(null, "", href);
  }, []);
  const taskPath = useCallback(
    (taskNumber: string) => taskPathTemplate.replace("__TASK__", encodeURIComponent(taskNumber)),
    [taskPathTemplate]
  );
  const preview = useCallback(
    (selected: string | null) => navigate(taskHref(path, state, { selected })),
    [navigate, path, state]
  );
  const refresh = useCallback(
    () => void queryClient.invalidateQueries({ queryKey: taskKeys.all(orgId) }),
    [queryClient, orgId]
  );

  // A page past the end (a filter narrowed): go to the last one.
  useEffect(() => {
    if (list.isPlaceholderData || !list.data) return;
    const last = Math.max(1, Math.ceil(list.data.totalCount / state.wierszy));
    if (state.strona > last) {
      window.history.replaceState(null, "", taskHref(path, state, { strona: last }));
    }
  }, [list.data, list.isPlaceholderData, path, state]);

  // The next page is a click away: fetch it once this one is shown.
  useEffect(() => {
    if (list.isPlaceholderData || !list.data) return;
    if (state.strona * state.wierszy >= list.data.totalCount) return;
    void queryClient.prefetchQuery(taskListQuery(orgId, { ...state, strona: state.strona + 1 }));
  }, [list.data, list.isPlaceholderData, queryClient, orgId, state]);

  // A task's card, fetched when the pointer rests on its row.
  const hover = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prefetchPreview = useCallback(
    (taskNumber: string | null) => {
      if (hover.current) clearTimeout(hover.current);
      hover.current = null;
      if (!taskNumber) return;
      hover.current = setTimeout(() => {
        void queryClient.prefetchQuery(taskDetailQuery(orgId, taskNumber));
      }, HOVER_INTENT_MS);
    },
    [queryClient, orgId]
  );
  useEffect(() => () => void (hover.current && clearTimeout(hover.current)), []);

  // ↓ / ↑ open the next / previous task, Esc closes the panel.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target?.closest(
          "input, textarea, select, [contenteditable='true'], [role='menu'], [role='dialog'], [role='listbox']"
        )
      ) {
        return;
      }
      if (event.key === "Escape" && state.selected) {
        event.preventDefault();
        preview(null);
        return;
      }
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      if (!data.rows.length) return;
      const at = data.rows.findIndex((row) => row.task_number === state.selected);
      if (at < 0 && event.key === "ArrowUp") return;
      const next =
        at < 0
          ? 0
          : Math.min(data.rows.length - 1, Math.max(0, at + (event.key === "ArrowDown" ? 1 : -1)));
      if (next === at) return;
      event.preventDefault();
      preview(data.rows[next].task_number);
      requestAnimationFrame(() =>
        document
          .querySelector(`[data-row-id="${CSS.escape(data.rows[next].task_number)}"]`)
          ?.scrollIntoView({ block: "nearest" })
      );
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [data.rows, preview, state.selected]);

  const branchNames = useMemo(
    () => Object.fromEntries(branches.map((b) => [b.id, b.name])),
    [branches]
  );
  const memberOptions: Option[] = members.map((m) => ({
    value: m.user_id,
    label: m.name || m.email || m.user_id,
  }));
  const fields: FilterField[] = [
    {
      kind: "list",
      id: "status",
      label: labels.column_status,
      options: TASK_STATUSES.map((value) => ({ value, label: labels[`status_${value}`] })),
    },
    {
      kind: "list",
      id: "priorytet",
      label: labels.column_priority,
      options: TASK_PRIORITIES.map((value) => ({ value, label: labels[`priority_${value}`] })),
    },
    {
      kind: "list",
      id: "przypisani",
      label: labels.column_assignee,
      options: [{ value: UNASSIGNED, label: labels.unassigned }, ...memberOptions],
    },
    ...(branches.length > 1
      ? [
          {
            kind: "list" as const,
            id: "oddzial",
            label: labels.column_branch,
            options: [
              { value: ORG_WIDE, label: labels.orgWide },
              ...branches.map((b) => ({ value: b.id, label: b.name })),
            ],
          },
        ]
      : []),
    {
      kind: "dates",
      id: "due_at",
      label: labels.column_due_at,
      options: DUE_WITHIN.map((value) => ({ value, label: labels[`due_${value}`] })),
      keys: { scope: "termin", from: "termin_od", to: "termin_do" },
    },
  ];
  // The filter ids that are not columns sit where their column is.
  const order = ["task", ...layout.map((column) => column.id)].map((id) =>
    id === "priority"
      ? "priorytet"
      : id === "assignee"
        ? "przypisani"
        : id === "branch"
          ? "oddzial"
          : id
  );

  const selectedRow = useMemo<PlanningTaskListRow | null>(
    () => data.rows.find((row) => row.task_number === state.selected) ?? null,
    [data.rows, state.selected]
  );

  return (
    <TableNavigationProvider navigate={navigate}>
      <section className="dt-list-view flex min-w-0 flex-col overflow-hidden rounded-lg border bg-background">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b px-3 py-2.5 md:px-4">
          <div className="flex items-baseline gap-2">
            <h1 className="text-lg font-semibold tracking-tight">{labels.title}</h1>
            <span className="text-xs tabular-nums text-muted-foreground">{data.totalCount}</span>
          </div>
          <div className="flex items-center gap-2">
            <PlanningViewSwitcher current="list" />
            {canCreate ? (
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="mr-1.5 size-3.5" />
                {labels.newTask}
              </Button>
            ) : null}
          </div>
        </header>
        <div className="dt-list-filter-row">
          <FilterBar
            parsers={taskParsers}
            fields={fields}
            resetOnChange={["strona", "selected"]}
            shallow
            pending={list.isFetching}
            order={order}
            search={{ label: labels.search, placeholder: labels.search }}
          />
        </div>
        <div className="flex min-h-0 min-w-0 flex-1">
          <TasksTable
            data={data}
            state={state}
            path={path}
            set={set}
            layout={layout}
            onLayoutChange={setLayout}
            widths={widths}
            cookie={cookie}
            labels={labels}
            configs={configs}
            branchNames={branchNames}
            taskPath={taskPath}
            loading={list.isPending}
            refreshing={list.isFetching && !list.isPending}
            error={list.isError ? list.error.message : null}
            onRetry={() => void list.refetch()}
            onPreview={preview}
            onPrefetch={prefetchPreview}
          />
          {state.selected ? (
            <aside
              aria-labelledby="planning-task-panel-title"
              className="dt-list-panel fixed inset-y-0 right-0 z-[var(--z-modal)] flex w-full max-w-3xl flex-col overflow-hidden border-l bg-background shadow-2xl xl:static xl:z-auto xl:min-w-0 xl:flex-1 xl:max-w-none xl:shadow-none"
            >
              <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
                <button
                  type="button"
                  onClick={() => preview(null)}
                  className="inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label={labels.close}
                >
                  <X className="size-4" />
                  <span className="hidden sm:inline">{labels.title}</span>
                </button>
                <span className="text-muted-foreground/50">/</span>
                <span id="planning-task-panel-title" className="truncate font-mono text-sm">
                  {state.selected}
                </span>
                <Link
                  href={taskPath(state.selected)}
                  className="ml-auto inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-3 text-xs font-medium hover:bg-muted"
                >
                  <ExternalLink className="size-3.5" />
                  {labels.viewFull}
                </Link>
              </header>
              <TaskCard
                key={state.selected}
                orgId={orgId}
                taskNumber={state.selected}
                row={selectedRow}
                labels={labels}
                configs={configs}
                members={members}
                canUpdate={canUpdate}
                canAssign={canAssign}
                canDelete={canDelete}
                onChanged={refresh}
              />
            </aside>
          ) : null}
        </div>
      </section>

      <PlanningTaskCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        members={members}
        branches={branches}
        activeBranchId={activeBranchId}
        currentUserId={currentUserId}
        canAssign={canAssign}
        priorityConfigs={configs.priority}
        onCreated={(task: PlanningTaskDetail) => {
          queryClient.setQueryData(taskKeys.detail(orgId, task.task_number), task);
          refresh();
          preview(task.task_number);
        }}
      />
    </TableNavigationProvider>
  );
}

/** A task's card in the side panel: fetched by its number. */
function TaskCard({
  orgId,
  taskNumber,
  row,
  labels,
  configs,
  members,
  canUpdate,
  canAssign,
  canDelete,
  onChanged,
}: {
  orgId: string;
  taskNumber: string;
  /** The list's row of this task, shown while its card comes. */
  row: PlanningTaskListRow | null;
  labels: Record<string, string>;
  configs: TaskBadgeConfigs;
  members: Member[];
  canUpdate: boolean;
  canAssign: boolean;
  canDelete: boolean;
  onChanged: () => void;
}) {
  const query = useQuery(taskDetailQuery(orgId, taskNumber));
  if (query.isPending) {
    return (
      <div className="space-y-4 p-5" aria-busy="true" aria-label={labels.loading}>
        {row ? (
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">{row.title}</h2>
            <TaskStatusBadge row={row} configs={configs} />
          </div>
        ) : (
          <div className="h-6 w-1/2 animate-pulse rounded bg-muted" />
        )}
        {[0, 1, 2, 3, 4].map((key) => (
          <div key={key} className="h-4 animate-pulse rounded bg-muted" />
        ))}
      </div>
    );
  }
  if (query.isError) {
    return (
      <div className="grid flex-1 place-items-center p-8 text-center text-sm">
        <div>
          <p className="text-destructive">{labels.notFound}</p>
          <button className="mt-3 underline" type="button" onClick={() => query.refetch()}>
            {labels.retry}
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <PlanningTaskDetailPanel
        key={`${query.data.id}-${query.data.updated_at}`}
        detail={query.data}
        canUpdate={canUpdate}
        canAssign={canAssign}
        canDelete={canDelete}
        members={members}
        onRefresh={onChanged}
        statusConfigs={configs.status}
        priorityConfigs={configs.priority}
      />
    </div>
  );
}
