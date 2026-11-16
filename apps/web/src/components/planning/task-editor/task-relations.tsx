"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Ban, CornerLeftUp, GitBranch, Plus, Search, X } from "lucide-react";
import { toast } from "react-toastify";
import { Link } from "@/i18n/navigation";
import {
  addKanbanDependencyAction,
  patchKanbanTaskAction,
  removeKanbanDependencyAction,
  searchKanbanTasksAction,
} from "@/app/actions/kanban";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebounce } from "@/hooks/use-debounce";
import type { KanbanBoardCard, KanbanTaskRef } from "@/lib/types/kanban";
import { cn } from "@/utils";
import {
  taskEditorKeys,
  taskRelationsQuery,
  unwrapTaskResult as unwrap,
} from "./task-editor-queries";

const isClosed = (task: KanbanTaskRef) =>
  task.status === "completed" || task.status === "cancelled";

interface TaskRelationsSectionProps {
  orgId: string;
  card: KanbanBoardCard;
  disabled: boolean;
  /** The card's counts or parent changed. */
  onCardChange: (card: KanbanBoardCard) => void;
}

/**
 * A task's parent and its dependencies: what it waits for ("blocked by") and
 * what waits for it. Its sub-tasks are items of its checklist.
 */
export function TaskRelationsSection({
  orgId,
  card,
  disabled,
  onCardChange,
}: TaskRelationsSectionProps) {
  const t = useTranslations("modules.planning.boardExtras.relations");
  const queryClient = useQueryClient();
  const relations = useQuery(taskRelationsQuery(orgId, card.id));
  const [busy, setBusy] = useState(false);

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: taskEditorKeys.relations(orgId, card.id) });

  // The board's badges follow what the relations say.
  const data = relations.data;
  useEffect(() => {
    if (!data) return;
    const total = data.subtasks.length;
    const done = data.subtasks.filter(isClosed).length;
    const blocked = data.blocked_by.filter((task) => !isClosed(task)).length;
    if (
      total !== card.subtask_total ||
      done !== card.subtask_done ||
      blocked !== card.blocked_by_open
    ) {
      onCardChange({ ...card, subtask_total: total, subtask_done: done, blocked_by_open: blocked });
    }
  }, [card, data, onCardChange]);

  const run = async (work: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await work();
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Operation failed");
    } finally {
      setBusy(false);
    }
  };

  const setParent = (parentId: string | null) =>
    run(async () => {
      const saved = await unwrap(patchKanbanTaskAction({ id: card.id, parent_task_id: parentId }));
      onCardChange(saved);
    });

  const excluded = new Set([
    card.id,
    ...(data?.blocked_by.map((task) => task.id) ?? []),
    ...(data?.subtasks.map((task) => task.id) ?? []),
  ]);

  if (relations.isPending) {
    return (
      <section className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-full" />
      </section>
    );
  }
  if (!data) return null;

  return (
    <section className="space-y-4">
      {data.parent ? (
        <div className="flex items-center gap-2 text-sm">
          <CornerLeftUp className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="text-muted-foreground">{t("subtaskOf")}</span>
          <TaskLink task={data.parent} />
          {!disabled ? (
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto h-7 w-7"
              aria-label={t("removeParent")}
              title={t("removeParent")}
              disabled={busy}
              onClick={() => void setParent(null)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold">
            <GitBranch className="h-4 w-4 text-muted-foreground" />
            {t("dependencies")}
          </h3>
          {!disabled && !data.parent ? (
            <TaskPicker
              orgId={orgId}
              excluded={excluded}
              label={t("setParent")}
              trigger={
                <Button variant="ghost" size="sm" className="ml-auto h-7 gap-1 px-2 text-xs">
                  <CornerLeftUp className="h-3.5 w-3.5" />
                  {t("setParent")}
                </Button>
              }
              onPick={(task) => void setParent(task.id)}
            />
          ) : null}
          {!disabled ? (
            <TaskPicker
              orgId={orgId}
              excluded={excluded}
              label={t("addBlocker")}
              trigger={
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn("h-7 gap-1 px-2 text-xs", (disabled || data.parent) && "ml-auto")}
                >
                  <Plus className="h-3.5 w-3.5" />
                  {t("addBlocker")}
                </Button>
              }
              onPick={(task) =>
                void run(() =>
                  unwrap(
                    addKanbanDependencyAction({ task_id: card.id, depends_on_task_id: task.id })
                  )
                )
              }
            />
          ) : null}
        </div>
        {data.blocked_by.length ? (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">{t("blockedBy")}</p>
            <ul className="space-y-1">
              {data.blocked_by.map((task) => (
                <li key={task.id} className="flex items-center gap-2 text-sm">
                  {isClosed(task) ? null : <Ban className="h-3.5 w-3.5 shrink-0 text-red-600" />}
                  <TaskLink task={task} />
                  {!disabled ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="ml-auto h-7 w-7"
                      aria-label={t("remove")}
                      title={t("remove")}
                      disabled={busy}
                      onClick={() =>
                        void run(() =>
                          unwrap(
                            removeKanbanDependencyAction({
                              task_id: card.id,
                              depends_on_task_id: task.id,
                            })
                          )
                        )
                      }
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {data.blocking.length ? (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">{t("blocking")}</p>
            <ul className="space-y-1">
              {data.blocking.map((task) => (
                <li key={task.id} className="flex items-center gap-2 text-sm">
                  <TaskLink task={task} />
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {!data.blocked_by.length && !data.blocking.length ? (
          <p className="text-xs text-muted-foreground">{t("noDependencies")}</p>
        ) : null}
      </div>
    </section>
  );
}

function TaskLink({ task }: { task: KanbanTaskRef }) {
  return (
    <Link
      href={{
        pathname: "/dashboard/planning/tasks/[taskId]",
        params: { taskId: task.task_number },
      }}
      className={cn(
        "flex min-w-0 items-center gap-1.5 hover:underline",
        isClosed(task) && "text-muted-foreground line-through"
      )}
    >
      <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
        {task.task_number}
      </span>
      <span className="truncate">{task.title}</span>
    </Link>
  );
}

/** Finds a task by number or title (tasks the user can read). */
function TaskPicker({
  orgId,
  excluded,
  label,
  trigger,
  onPick,
}: {
  orgId: string;
  excluded: Set<string>;
  label: string;
  trigger: React.ReactNode;
  onPick: (task: KanbanTaskRef) => void;
}) {
  const t = useTranslations("modules.planning.boardExtras.relations");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const debounced = useDebounce(query.trim(), 250);
  const results = useQuery({
    queryKey: ["planning-task-search", orgId, debounced],
    queryFn: () => unwrap(searchKanbanTasksAction({ query: debounced })),
    enabled: open && debounced.length > 0,
    staleTime: 15 * 1000,
  });
  const tasks = (results.data ?? []).filter((task) => !excluded.has(task.id));

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-2">
        <p className="px-1 pb-2 text-xs font-medium text-muted-foreground">{label}</p>
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            placeholder={t("search")}
            aria-label={t("search")}
            className="h-8 pl-7"
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="mt-2 max-h-64 overflow-y-auto">
          {debounced && results.isFetching && !results.data ? (
            <Skeleton className="h-8 w-full" />
          ) : debounced && !tasks.length ? (
            <p className="px-1 py-2 text-xs text-muted-foreground">{t("noResults")}</p>
          ) : (
            tasks.map((task) => (
              <button
                key={task.id}
                type="button"
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
                onClick={() => {
                  onPick(task);
                  setOpen(false);
                  setQuery("");
                }}
              >
                <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                  {task.task_number}
                </span>
                <span className="truncate">{task.title}</span>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
