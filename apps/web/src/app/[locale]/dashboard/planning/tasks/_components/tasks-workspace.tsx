"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useQueryStates } from "nuqs";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TaskEditor, taskEditorQuery } from "@/components/planning/task-editor";
import { FilterBar, type FilterField } from "@/components/data-table/filter-bar";
import type { ColumnLayout, ColumnSet, ColumnWidths } from "@/components/data-table/columns";
import { TableNavigationProvider } from "@/components/data-table/table-navigation";
import type { PlanningTaskDetail } from "@/server/services/planning-tasks.service";
import { PlanningTaskCreateDialog } from "./planning-task-create-dialog";
import { TasksTable, type TaskBadgeConfigs } from "./tasks-table";
import { taskKeys, taskListQuery, type TaskList } from "./tasks-query";
import {
  DUE_WITHIN,
  NO_BOARD,
  TASK_VISIBILITIES,
  ORG_WIDE,
  taskHref,
  taskParsers,
  TASK_PRIORITIES,
  TASK_STATUSES,
  UNASSIGNED,
} from "./tasks-state";

/** How long the pointer rests on a row before its card is fetched. */
const HOVER_INTENT_MS = 300;

/**
 * A card fetched on hover in the last minute is not fetched again on hover:
 * moving the pointer up and down the list refetched the same tasks. Opening
 * the task still refreshes it after the editor's own 15 s.
 */
const HOVER_PREFETCH_STALE_MS = 60 * 1000;

const EMPTY_LIST: TaskList = { rows: [], totalCount: 0, page: 1, pageSize: 50 };

type Member = { user_id: string; name: string | null; email: string | null };
type Option = { value: string; label: string };

/**
 * The tasks list: the title bar (create), the filters, and the list
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
  boards,
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
  /** Boards the person can see (the board filter's options). */
  boards: { id: string; title: string }[];
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
        void queryClient.prefetchQuery({
          ...taskEditorQuery(orgId, taskNumber),
          staleTime: HOVER_PREFETCH_STALE_MS,
        });
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
      kind: "list",
      id: "tablica",
      label: labels.column_board,
      options: [
        { value: NO_BOARD, label: labels.noBoard },
        ...boards.map((board) => ({ value: board.id, label: board.title })),
      ],
    },
    {
      kind: "list",
      id: "widocznosc",
      label: labels.visibility,
      options: TASK_VISIBILITIES.map((value) => ({ value, label: labels[`visibility_${value}`] })),
    },
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
          : id === "board"
            ? "tablica"
            : id
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
              aria-label={state.selected}
              className="dt-list-panel fixed inset-y-0 right-0 z-[var(--z-modal)] flex w-full max-w-5xl flex-col overflow-hidden border-l bg-background shadow-2xl xl:static xl:z-auto xl:min-w-0 xl:flex-1 xl:max-w-none xl:shadow-none"
            >
              <TaskCard
                key={state.selected}
                orgId={orgId}
                taskNumber={state.selected}
                members={members}
                currentUserId={currentUserId}
                canUpdate={canUpdate}
                canAssign={canAssign}
                canDelete={canDelete}
                onChanged={refresh}
                onClose={() => preview(null)}
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
          refresh();
          preview(task.task_number);
        }}
      />
    </TableNavigationProvider>
  );
}

/** A task in the side panel: the same editor as on the boards and the calendar. */
function TaskCard({
  orgId,
  taskNumber,
  members,
  currentUserId,
  canUpdate,
  canAssign,
  canDelete,
  onChanged,
  onClose,
}: {
  orgId: string;
  taskNumber: string;
  members: Member[];
  currentUserId: string;
  canUpdate: boolean;
  canAssign: boolean;
  canDelete: boolean;
  onChanged: () => void;
  onClose: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <TaskEditor
        orgId={orgId}
        taskRef={taskNumber}
        people={members}
        currentUserId={currentUserId}
        canUpdate={canUpdate}
        canAssign={canAssign}
        canArchive={canDelete}
        showClose
        closePosition="start"
        onChanged={onChanged}
        onClose={() => {
          onChanged();
          onClose();
        }}
      />
    </div>
  );
}
