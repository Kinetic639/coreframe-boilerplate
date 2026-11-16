"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFormatter, useTranslations } from "next-intl";
import {
  ArrowUpRight,
  Calendar,
  Check,
  CheckSquare,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Loader2,
  MoreHorizontal,
  Plus,
  Tag,
  Trash2,
  User,
  X,
} from "lucide-react";
import { toast } from "react-toastify";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import {
  addKanbanChecklistItemAction,
  convertKanbanChecklistItemAction,
  createKanbanBoardLabelAction,
  createKanbanChecklistAction,
  deleteKanbanChecklistAction,
  deleteKanbanChecklistItemAction,
  listKanbanChecklistsAction,
  renameKanbanChecklistAction,
  setKanbanTaskLabelsAction,
  setKanbanTaskWatchingAction,
  updateKanbanChecklistItemAction,
} from "@/app/actions/kanban";
import { useAttachmentsQuery } from "@/hooks/queries/attachments";
import type {
  KanbanBoardCard,
  KanbanBoardLabel,
  KanbanChecklist,
  KanbanChecklistItem,
  KanbanTaskStatus,
} from "@/lib/types/kanban";
import { cn } from "@/utils";
import {
  DUE_STATE_CLASSES,
  buildTaskDates,
  dueState,
  toDateInput,
  toTimeInput,
  viewerTimeZone,
  type TaskDatesPayload,
} from "./task-dates";
import { LABEL_COLORS, initials } from "./task-labels";
import { unwrapTaskResult } from "./task-editor-queries";
import { checklistProgress } from "./task-checklist-progress";
import type { TaskEditorPerson } from "./task-editor";

export const chipClass =
  "h-7 gap-1.5 rounded-md px-2 text-xs font-medium disabled:opacity-100 disabled:cursor-default";

export const checklistsKey = (orgId: string, taskId: string) =>
  ["planning-task-editor", orgId, "checklists", taskId] as const;

/* ------------------------------------------------------------------ */
/* Labels                                                              */
/* ------------------------------------------------------------------ */

/** The board's labels, several per task; a new one can be made in place. */
export function LabelsChip({
  card,
  boardId,
  labels,
  disabled,
  onCardChange,
  onLabelCreated,
}: {
  card: KanbanBoardCard;
  boardId: string;
  labels: KanbanBoardLabel[];
  disabled: boolean;
  onCardChange: (card: KanbanBoardCard) => void;
  onLabelCreated: (label: KanbanBoardLabel) => void;
}) {
  const t = useTranslations("modules.planning");
  const [query, setQuery] = useState("");
  const [color, setColor] = useState(LABEL_COLORS[5]);
  const selected = useMemo(() => new Set(card.labels.map((label) => label.id)), [card.labels]);

  const apply = useMutation({
    scope: { id: `planning-task-${card.id}` },
    mutationFn: (labelIds: string[]) =>
      unwrapTaskResult(setKanbanTaskLabelsAction({ task_id: card.id, label_ids: labelIds })),
    onSuccess: onCardChange,
    onError: (error) => toast.error(error instanceof Error ? error.message : "Operation failed"),
  });

  const toggle = (label: KanbanBoardLabel, pool: KanbanBoardLabel[] = labels) => {
    const next = selected.has(label.id)
      ? card.labels.filter((item) => item.id !== label.id)
      : [...card.labels, label].sort((a, b) => a.position - b.position);
    // Show it at once; the saved card replaces it.
    onCardChange({ ...card, labels: next });
    apply.mutate(
      next.map((item) => item.id).filter((id) => pool.some((candidate) => candidate.id === id))
    );
  };

  const create = useMutation({
    mutationFn: (name: string) =>
      unwrapTaskResult(createKanbanBoardLabelAction({ board_id: boardId, name, color })),
    onSuccess: (label) => {
      onLabelCreated(label);
      setQuery("");
      toggle(label, [...labels, label]);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Operation failed"),
  });

  const needle = query.trim().toLowerCase();
  const visible = needle
    ? labels.filter((label) => label.name.toLowerCase().includes(needle))
    : labels;
  const exact = labels.some((label) => label.name.toLowerCase() === needle);

  return (
    <Popover onOpenChange={(open) => !open && setQuery("")}>
      <PopoverTrigger asChild disabled={disabled}>
        {card.labels.length ? (
          <button
            type="button"
            className="flex h-7 flex-wrap items-center gap-1 rounded-md disabled:cursor-default"
            aria-label={t("taskEditor.labels")}
          >
            {card.labels.map((label) => (
              <LabelPill key={label.id} label={label} />
            ))}
          </button>
        ) : (
          <Button variant="secondary" size="sm" className={chipClass}>
            <Tag className="h-3.5 w-3.5" />
            {t("taskEditor.labels")}
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 space-y-2 p-2">
        <Input
          value={query}
          maxLength={60}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && needle && !exact && !create.isPending) {
              event.preventDefault();
              create.mutate(query.trim());
            }
          }}
          aria-label={t("taskEditor.labelSearch")}
          placeholder={t("taskEditor.labelSearch")}
          className="h-8"
        />
        <div className="max-h-56 space-y-0.5 overflow-y-auto">
          {visible.map((label) => (
            <button
              key={label.id}
              type="button"
              onClick={() => toggle(label)}
              className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-sm hover:bg-muted"
              aria-pressed={selected.has(label.id)}
            >
              <span
                className="h-5 min-w-10 flex-1 truncate rounded px-1.5 text-xs font-semibold leading-5 text-white"
                style={{ backgroundColor: label.color }}
              >
                {label.name}
              </span>
              <Check
                className={cn("h-3.5 w-3.5 shrink-0", !selected.has(label.id) && "invisible")}
              />
            </button>
          ))}
          {!visible.length && !needle ? (
            <p className="px-1.5 py-2 text-xs text-muted-foreground">
              {t("taskEditor.noBoardLabels")}
            </p>
          ) : null}
        </div>
        {needle && !exact ? (
          <div className="space-y-2 border-t pt-2">
            <div className="grid grid-cols-10 gap-1">
              {LABEL_COLORS.map((candidate) => (
                <button
                  key={candidate}
                  type="button"
                  className={cn(
                    "h-5 rounded",
                    color === candidate && "ring-2 ring-ring ring-offset-1 ring-offset-background"
                  )}
                  style={{ backgroundColor: candidate }}
                  onClick={() => setColor(candidate)}
                  aria-label={t("taskEditor.labelColor", { color: candidate })}
                  aria-pressed={color === candidate}
                />
              ))}
            </div>
            <Button
              size="sm"
              className="w-full gap-1.5"
              disabled={create.isPending}
              onClick={() => create.mutate(query.trim())}
            >
              {create.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              {t("taskEditor.createLabel", { name: query.trim() })}
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

export function LabelPill({
  label,
  compact = false,
}: {
  label: KanbanBoardLabel;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <span
        className="h-1.5 w-8 rounded-full"
        style={{ backgroundColor: label.color }}
        title={label.name}
      />
    );
  }
  return (
    <span
      className="inline-flex h-5 max-w-[10rem] items-center truncate rounded px-1.5 text-[11px] font-semibold text-white"
      style={{ backgroundColor: label.color }}
      title={label.name}
    >
      {label.name || " "}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Dates                                                               */
/* ------------------------------------------------------------------ */

export function formatCardDates(
  format: ReturnType<typeof useFormatter>,
  card: Pick<KanbanBoardCard, "start_date" | "due_at" | "due_has_time">
): string | null {
  const due = card.due_at
    ? format.dateTime(
        new Date(card.due_at),
        card.due_has_time
          ? { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }
          : { day: "numeric", month: "short" }
      )
    : null;
  const start = card.start_date
    ? format.dateTime(new Date(`${card.start_date}T12:00:00.000Z`), {
        day: "numeric",
        month: "short",
      })
    : null;
  if (start && due) return `${start} – ${due}`;
  return due ?? start;
}

/** Start day, due day and an optional hour, saved together. */
export function DatesChip({
  card,
  status,
  disabled,
  onChange,
}: {
  card: KanbanBoardCard;
  status: KanbanTaskStatus;
  disabled: boolean;
  onChange: (dates: TaskDatesPayload) => void;
}) {
  const t = useTranslations("modules.planning");
  const format = useFormatter();
  const [open, setOpen] = useState(false);
  const initial = () => ({
    start: card.start_date ?? "",
    due: toDateInput(card.due_at),
    time: card.due_has_time ? toTimeInput(card.due_at) : "",
  });
  const [draft, setDraft] = useState(initial);
  const state = dueState(card.due_at, status);
  const text = formatCardDates(format, card);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) setDraft(initial());
        setOpen(next);
      }}
    >
      <PopoverTrigger asChild disabled={disabled}>
        <Button
          variant="secondary"
          size="sm"
          className={cn(chipClass, state && state !== "normal" && DUE_STATE_CLASSES[state])}
        >
          <Calendar className="h-3.5 w-3.5" />
          {text ?? t("taskEditor.noDueDate")}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 space-y-3">
        <p className="text-sm font-medium">{t("taskEditor.dates")}</p>
        <label className="block space-y-1 text-xs text-muted-foreground">
          {t("taskEditor.startDate")}
          <Input
            type="date"
            value={draft.start}
            max={draft.due || undefined}
            onChange={(event) => setDraft((d) => ({ ...d, start: event.target.value }))}
          />
        </label>
        <div className="grid grid-cols-[1fr_6.5rem] gap-2">
          <label className="block space-y-1 text-xs text-muted-foreground">
            {t("boards.dueDate")}
            <Input
              type="date"
              value={draft.due}
              onChange={(event) => setDraft((d) => ({ ...d, due: event.target.value }))}
            />
          </label>
          <label className="block space-y-1 text-xs text-muted-foreground">
            {t("taskEditor.dueTime")}
            <Input
              type="time"
              value={draft.time}
              disabled={!draft.due}
              onChange={(event) => setDraft((d) => ({ ...d, time: event.target.value }))}
            />
          </label>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            className="flex-1"
            onClick={() => {
              onChange(buildTaskDates(draft, viewerTimeZone()));
              setOpen(false);
            }}
          >
            {t("boards.save")}
          </Button>
          {card.due_at || card.start_date ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                onChange(buildTaskDates({ start: "", due: "", time: "" }, viewerTimeZone()));
                setOpen(false);
              }}
            >
              {t("taskEditor.clear")}
            </Button>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ------------------------------------------------------------------ */
/* Watching                                                            */
/* ------------------------------------------------------------------ */

export function WatchButton({
  card,
  currentUserId,
  onCardChange,
}: {
  card: KanbanBoardCard;
  currentUserId: string;
  onCardChange: (card: KanbanBoardCard) => void;
}) {
  const t = useTranslations("modules.planning");
  const watching = card.watcher_ids.includes(currentUserId);
  const toggle = useMutation({
    mutationFn: (next: boolean) =>
      unwrapTaskResult(setKanbanTaskWatchingAction({ task_id: card.id, watching: next })),
    onMutate: (next) =>
      onCardChange({
        ...card,
        watcher_ids: next
          ? [...card.watcher_ids.filter((id) => id !== currentUserId), currentUserId]
          : card.watcher_ids.filter((id) => id !== currentUserId),
      }),
    onError: (error) => {
      onCardChange(card);
      toast.error(error instanceof Error ? error.message : "Operation failed");
    },
  });
  const others = card.watcher_ids.length - (watching ? 1 : 0);

  return (
    <Button
      variant={watching ? "secondary" : "outline"}
      size="sm"
      className="w-full justify-start gap-1.5"
      onClick={() => toggle.mutate(!watching)}
      disabled={toggle.isPending}
      aria-pressed={watching}
    >
      {watching ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      {watching ? t("taskEditor.stopWatching") : t("taskEditor.watch")}
      {others > 0 ? <span className="ml-auto text-xs text-muted-foreground">+{others}</span> : null}
    </Button>
  );
}

/* ------------------------------------------------------------------ */
/* Cover                                                               */
/* ------------------------------------------------------------------ */

export function CoverPicker({
  card,
  disabled,
  onChange,
}: {
  card: KanbanBoardCard;
  disabled: boolean;
  onChange: (cover: { cover_color?: string | null; cover_attachment_id?: string | null }) => void;
}) {
  const t = useTranslations("modules.planning");
  const [open, setOpen] = useState(false);
  const attachments = useAttachmentsQuery({ targetType: "planning.task", targetId: card.id });
  const images = (attachments.data ?? []).filter((file) => file.content_type?.startsWith("image/"));
  const hasCover = Boolean(card.cover_color || card.cover_attachment_id);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <Button variant="outline" size="sm" className="w-full justify-start gap-1.5">
          <ImageIcon className="h-3.5 w-3.5" />
          {t("taskEditor.cover")}
          {card.cover_color ? (
            <span
              className="ml-auto h-3 w-6 rounded"
              style={{ backgroundColor: card.cover_color }}
              aria-hidden="true"
            />
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 space-y-3">
        <p className="text-xs font-medium text-muted-foreground">{t("taskEditor.coverColor")}</p>
        <div className="grid grid-cols-5 gap-1.5">
          {LABEL_COLORS.map((candidate) => (
            <button
              key={candidate}
              type="button"
              className={cn(
                "h-7 rounded-md",
                card.cover_color === candidate &&
                  "ring-2 ring-ring ring-offset-2 ring-offset-background"
              )}
              style={{ backgroundColor: candidate }}
              onClick={() => {
                onChange({ cover_color: candidate });
                setOpen(false);
              }}
              aria-label={t("taskEditor.labelColor", { color: candidate })}
              aria-pressed={card.cover_color === candidate}
            />
          ))}
        </div>
        <p className="text-xs font-medium text-muted-foreground">{t("taskEditor.coverImage")}</p>
        {attachments.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : images.length ? (
          <div className="grid grid-cols-3 gap-1.5">
            {images.map((file) => (
              <button
                key={file.id}
                type="button"
                className={cn(
                  "aspect-video overflow-hidden rounded-md border bg-muted",
                  card.cover_attachment_id === file.id && "ring-2 ring-ring ring-offset-2"
                )}
                onClick={() => {
                  onChange({ cover_attachment_id: file.id });
                  setOpen(false);
                }}
                title={file.file_name}
              >
                {file.download_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={file.download_url}
                    alt={file.file_name}
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">{t("taskEditor.coverNoImages")}</p>
        )}
        {hasCover ? (
          <Button
            size="sm"
            variant="outline"
            className="w-full"
            onClick={() => {
              onChange({ cover_color: null, cover_attachment_id: null });
              setOpen(false);
            }}
          >
            {t("taskEditor.removeCover")}
          </Button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

/* ------------------------------------------------------------------ */
/* Checklists                                                          */
/* ------------------------------------------------------------------ */

export function ChecklistsSection({
  orgId,
  card,
  people,
  currentUserId,
  canAssign,
  disabled,
  onCardChange,
  onTaskCreated,
}: {
  orgId: string;
  card: KanbanBoardCard;
  people: TaskEditorPerson[];
  currentUserId: string;
  canAssign: boolean;
  disabled: boolean;
  /** The card's checklist counts changed. */
  onCardChange: (card: KanbanBoardCard) => void;
  /** An item became a task of its own. */
  onTaskCreated?: (card: KanbanBoardCard) => void;
}) {
  const t = useTranslations("modules.planning");
  const queryClient = useQueryClient();
  const key = checklistsKey(orgId, card.id);
  const query = useQuery({
    queryKey: key,
    queryFn: () => unwrapTaskResult(listKanbanChecklistsAction(card.id)),
    staleTime: 15 * 1000,
  });
  const lists = query.data ?? [];
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  const commit = (next: KanbanChecklist[]) => {
    queryClient.setQueryData<KanbanChecklist[]>(key, next);
    const { total, done } = checklistProgress(next);
    if (total !== card.checklist_total || done !== card.checklist_done) {
      onCardChange({ ...card, checklist_total: total, checklist_done: done });
    }
  };
  const current = () => queryClient.getQueryData<KanbanChecklist[]>(key) ?? [];
  const fail = (error: unknown) => {
    toast.error(error instanceof Error ? error.message : "Operation failed");
    void queryClient.invalidateQueries({ queryKey: key });
  };
  const scope = { id: `planning-checklists-${card.id}` };

  const createList = useMutation({
    scope,
    mutationFn: (title: string) =>
      unwrapTaskResult(createKanbanChecklistAction({ task_id: card.id, title })),
    onSuccess: (list) => commit([...current(), list]),
    onError: fail,
  });
  const renameList = useMutation({
    scope,
    mutationFn: (input: { id: string; title: string }) =>
      unwrapTaskResult(renameKanbanChecklistAction(input)),
    onMutate: (input) =>
      commit(
        current().map((list) => (list.id === input.id ? { ...list, title: input.title } : list))
      ),
    onError: fail,
  });
  const deleteList = useMutation({
    scope,
    mutationFn: (id: string) => unwrapTaskResult(deleteKanbanChecklistAction({ id })),
    onMutate: (id) => commit(current().filter((list) => list.id !== id)),
    onError: fail,
  });
  const addItem = useMutation({
    scope,
    mutationFn: (input: { checklist_id: string; title: string }) =>
      unwrapTaskResult(addKanbanChecklistItemAction({ ...input, task_id: card.id })),
    onSuccess: (item) =>
      commit(
        current().map((list) =>
          list.id === item.checklist_id ? { ...list, items: [...list.items, item] } : list
        )
      ),
    onError: fail,
  });
  const updateItem = useMutation({
    scope,
    mutationFn: (input: {
      id: string;
      title?: string;
      is_done?: boolean;
      assigned_to?: string | null;
      due_at?: string | null;
    }) => unwrapTaskResult(updateKanbanChecklistItemAction(input)),
    onMutate: (input) =>
      commit(
        current().map((list) => ({
          ...list,
          items: list.items.map((item) => {
            if (item.id !== input.id) return item;
            const person =
              input.assigned_to !== undefined
                ? people.find((p) => p.user_id === input.assigned_to)
                : undefined;
            return {
              ...item,
              ...(input.title !== undefined ? { title: input.title } : {}),
              ...(input.is_done !== undefined ? { is_done: input.is_done } : {}),
              ...(input.due_at !== undefined ? { due_at: input.due_at } : {}),
              ...(input.assigned_to !== undefined
                ? {
                    assigned_to: input.assigned_to,
                    assignee_name: person?.name ?? person?.email ?? null,
                  }
                : {}),
            };
          }),
        }))
      ),
    onSuccess: (saved) =>
      queryClient.setQueryData<KanbanChecklist[]>(key, (lists = []) =>
        lists.map((list) => ({
          ...list,
          items: list.items.map((item) => (item.id === saved.id ? saved : item)),
        }))
      ),
    onError: fail,
  });
  const removeItem = (id: string) =>
    commit(current().map((list) => ({ ...list, items: list.items.filter((i) => i.id !== id) })));
  const deleteItem = useMutation({
    scope,
    mutationFn: (id: string) => unwrapTaskResult(deleteKanbanChecklistItemAction({ id })),
    onMutate: removeItem,
    onError: fail,
  });
  const convertItem = useMutation({
    scope,
    mutationFn: (id: string) => unwrapTaskResult(convertKanbanChecklistItemAction({ id })),
    onSuccess: (created, id) => {
      removeItem(id);
      onTaskCreated?.(created);
      toast.success(t("taskEditor.convertedToTask", { number: created.task_number }));
    },
    onError: fail,
  });

  if (query.isPending) return null;
  if (!lists.length && disabled) return null;

  return (
    <section className="space-y-4">
      {lists.map((list) => (
        <ChecklistBlock
          key={list.id}
          list={list}
          people={people}
          currentUserId={currentUserId}
          canAssign={canAssign}
          disabled={disabled}
          onRename={(title) => renameList.mutate({ id: list.id, title })}
          onDelete={() => deleteList.mutate(list.id)}
          onAdd={(title) => addItem.mutate({ checklist_id: list.id, title })}
          onUpdate={(input) => updateItem.mutate(input)}
          onDeleteItem={(id) => deleteItem.mutate(id)}
          onConvert={(id) => convertItem.mutate(id)}
        />
      ))}
      {!disabled ? (
        adding ? (
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const title = newTitle.trim();
              if (!title) return;
              createList.mutate(title);
              setNewTitle("");
              setAdding(false);
            }}
          >
            <Input
              autoFocus
              value={newTitle}
              maxLength={200}
              onChange={(event) => setNewTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.stopPropagation();
                  setAdding(false);
                }
              }}
              aria-label={t("taskEditor.checklistTitle")}
              placeholder={t("taskEditor.checklistTitle")}
              className="h-8"
            />
            <Button type="submit" size="sm">
              {t("taskEditor.addChecklist")}
            </Button>
          </form>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => {
              setNewTitle(lists.length ? "" : t("taskEditor.defaultChecklistTitle"));
              setAdding(true);
            }}
          >
            <CheckSquare className="h-3.5 w-3.5" />
            {t("taskEditor.addChecklist")}
          </Button>
        )
      ) : null}
    </section>
  );
}

function ChecklistBlock({
  list,
  people,
  currentUserId,
  canAssign,
  disabled,
  onRename,
  onDelete,
  onAdd,
  onUpdate,
  onDeleteItem,
  onConvert,
}: {
  list: KanbanChecklist;
  people: TaskEditorPerson[];
  currentUserId: string;
  canAssign: boolean;
  disabled: boolean;
  onRename: (title: string) => void;
  onDelete: () => void;
  onAdd: (title: string) => void;
  onUpdate: (input: {
    id: string;
    title?: string;
    is_done?: boolean;
    assigned_to?: string | null;
    due_at?: string | null;
  }) => void;
  onDeleteItem: (id: string) => void;
  onConvert: (id: string) => void;
}) {
  const t = useTranslations("modules.planning");
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [hideDone, setHideDone] = useState(false);
  const { total, done } = checklistProgress([list]);
  const percent = total ? Math.round((done / total) * 100) : 0;
  const items = hideDone ? list.items.filter((item) => !item.is_done) : list.items;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <CheckSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
        <InlineText
          value={list.title}
          disabled={disabled}
          className="text-sm font-semibold"
          label={t("taskEditor.checklistTitle")}
          onSave={onRename}
        />
        {done > 0 ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 px-2 text-xs"
            onClick={() => setHideDone((value) => !value)}
          >
            {hideDone ? t("taskEditor.showDone", { count: done }) : t("taskEditor.hideDone")}
          </Button>
        ) : null}
        {!disabled ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={onDelete}
            aria-label={t("taskEditor.deleteChecklist")}
            title={t("taskEditor.deleteChecklist")}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">
          {percent}%
        </span>
        <Progress
          value={percent}
          className={cn("h-1.5 flex-1", total > 0 && done === total && "[&>div]:bg-emerald-500")}
        />
      </div>
      <ul className="space-y-0.5">
        {items.map((item) => (
          <ChecklistRow
            key={item.id}
            item={item}
            people={people}
            currentUserId={currentUserId}
            canAssign={canAssign}
            disabled={disabled}
            onUpdate={onUpdate}
            onDelete={() => onDeleteItem(item.id)}
            onConvert={() => onConvert(item.id)}
          />
        ))}
      </ul>
      {!disabled ? (
        adding ? (
          <form
            className="space-y-2 pl-6"
            onSubmit={(event) => {
              event.preventDefault();
              const title = draft.trim();
              if (!title) return;
              onAdd(title);
              // The field stays open for the next item.
              setDraft("");
            }}
          >
            <Input
              autoFocus
              value={draft}
              maxLength={500}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.stopPropagation();
                  setAdding(false);
                }
              }}
              aria-label={t("taskEditor.itemTitle")}
              placeholder={t("taskEditor.itemTitle")}
              className="h-8"
            />
            <div className="flex gap-2">
              <Button type="submit" size="sm">
                {t("taskEditor.addItem")}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(false)}>
                {t("taskEditor.close")}
              </Button>
            </div>
          </form>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="ml-5 h-7 gap-1.5 px-2 text-xs"
            onClick={() => setAdding(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            {t("taskEditor.addItem")}
          </Button>
        )
      ) : null}
    </div>
  );
}

function ChecklistRow({
  item,
  people,
  currentUserId,
  canAssign,
  disabled,
  onUpdate,
  onDelete,
  onConvert,
}: {
  item: KanbanChecklistItem;
  people: TaskEditorPerson[];
  currentUserId: string;
  canAssign: boolean;
  disabled: boolean;
  onUpdate: (input: {
    id: string;
    title?: string;
    is_done?: boolean;
    assigned_to?: string | null;
    due_at?: string | null;
  }) => void;
  onDelete: () => void;
  onConvert: () => void;
}) {
  const t = useTranslations("modules.planning");
  const format = useFormatter();
  const assignable = canAssign ? people : people.filter((p) => p.user_id === currentUserId);
  const [dueDraft, setDueDraft] = useState(toDateInput(item.due_at));

  return (
    <li className="group flex items-start gap-2 rounded-md px-1 py-1 hover:bg-muted/50">
      <Checkbox
        className="mt-0.5"
        checked={item.is_done}
        disabled={disabled}
        onCheckedChange={(checked) => onUpdate({ id: item.id, is_done: checked === true })}
        aria-label={item.title}
      />
      <div className="min-w-0 flex-1">
        <InlineText
          value={item.title}
          disabled={disabled}
          className={cn("text-sm", item.is_done && "text-muted-foreground line-through")}
          label={t("taskEditor.itemTitle")}
          onSave={(title) => onUpdate({ id: item.id, title })}
        />
        {item.assigned_to || item.due_at ? (
          <div className="mt-0.5 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
            {item.assigned_to ? (
              <span className="inline-flex items-center gap-1">
                <User className="h-3 w-3" />
                {item.assignee_name ?? "—"}
              </span>
            ) : null}
            {item.due_at ? (
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {format.dateTime(new Date(item.due_at), { day: "numeric", month: "short" })}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
      {!disabled ? (
        <DropdownMenu
          onOpenChange={(open) => {
            if (open) setDueDraft(toDateInput(item.due_at));
          }}
        >
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0 opacity-60 group-hover:opacity-100 focus-visible:opacity-100"
              aria-label={t("taskEditor.itemActions")}
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <User className="mr-2 h-3.5 w-3.5" />
                {t("boards.task.assignee")}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="max-h-72 overflow-y-auto">
                <DropdownMenuItem onSelect={() => onUpdate({ id: item.id, assigned_to: null })}>
                  <X className="mr-2 h-3.5 w-3.5" />
                  {t("boards.task.unassigned")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {assignable.map((person) => (
                  <DropdownMenuItem
                    key={person.user_id}
                    onSelect={() => onUpdate({ id: item.id, assigned_to: person.user_id })}
                  >
                    <span className="mr-2 flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-semibold">
                      {initials(person.name, person.email)}
                    </span>
                    <span className="truncate">{person.name || person.email}</span>
                    {person.user_id === item.assigned_to ? (
                      <Check className="ml-auto h-3.5 w-3.5" />
                    ) : null}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Calendar className="mr-2 h-3.5 w-3.5" />
                {t("boards.dueDate")}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-56 space-y-2 p-2">
                <DropdownMenuLabel className="px-0">{t("boards.dueDate")}</DropdownMenuLabel>
                <Input
                  type="date"
                  value={dueDraft}
                  onKeyDown={(event) => event.stopPropagation()}
                  onChange={(event) => setDueDraft(event.target.value)}
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={() =>
                      onUpdate({
                        id: item.id,
                        due_at: buildTaskDates({ start: "", due: dueDraft, time: "" }, "UTC")
                          .due_at,
                      })
                    }
                  >
                    {t("boards.save")}
                  </Button>
                  {item.due_at ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onUpdate({ id: item.id, due_at: null })}
                    >
                      {t("taskEditor.clear")}
                    </Button>
                  ) : null}
                </div>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuItem onSelect={onConvert}>
              <ArrowUpRight className="mr-2 h-3.5 w-3.5" />
              {t("taskEditor.convertToTask")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onDelete} className="text-destructive">
              <Trash2 className="mr-2 h-3.5 w-3.5" />
              {t("taskEditor.deleteItem")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </li>
  );
}

/** Text edited in place: click, type, Enter or leaving saves, Esc puts it back. */
function InlineText({
  value,
  disabled,
  className,
  label,
  onSave,
}: {
  value: string;
  disabled: boolean;
  className?: string;
  label: string;
  onSave: (value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  if (!editing || disabled) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
        className={cn(
          "min-w-0 flex-1 break-words rounded px-1 text-left enabled:hover:bg-muted disabled:cursor-default",
          className
        )}
      >
        {value}
      </button>
    );
  }
  const commit = () => {
    setEditing(false);
    const next = draft.trim();
    if (next && next !== value) onSave(next);
  };
  return (
    <Input
      autoFocus
      value={draft}
      aria-label={label}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          commit();
        }
        if (event.key === "Escape") {
          event.stopPropagation();
          setEditing(false);
        }
      }}
      className="h-7 flex-1"
    />
  );
}
