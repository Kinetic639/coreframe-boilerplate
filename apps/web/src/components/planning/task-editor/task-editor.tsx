"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFormatter, useTranslations } from "next-intl";
import {
  Activity,
  AlignLeft,
  Archive,
  Calendar,
  Check,
  CircleDot,
  Columns3,
  ExternalLink,
  Flag,
  Hand,
  Loader2,
  MessageSquare,
  Tag,
  User,
  X,
} from "lucide-react";
import { toast } from "react-toastify";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { CommentsThread } from "@/components/features/comments";
import { RichTextEditorField } from "@/components/primitives/rich-text/rich-text-editor-field";
import { RichTextRenderer } from "@/components/primitives/rich-text/rich-text-renderer";
import type { RichTextValue } from "@/components/primitives/rich-text/rich-text-types";
import {
  createEmptyRichText,
  extractPlainText,
  normalizeRichText,
} from "@/components/primitives/rich-text/rich-text-utils";
import { moveKanbanTaskAction, patchKanbanTaskAction } from "@/app/actions/kanban";
import { deleteTaskAction } from "@/app/actions/planning";
import type {
  KanbanBoardCard,
  KanbanCardActivity,
  KanbanTaskEditorData,
  KanbanTaskStatus,
} from "@/lib/types/kanban";
import {
  KANBAN_TASK_PRIORITIES,
  KANBAN_TASK_STATUSES,
  type PatchKanbanTaskInput,
} from "@/lib/validations/kanban";
import { cn } from "@/utils";
import { DUE_STATE_CLASSES, dueState, fromDateInput, toDateInput } from "./task-dates";
import {
  LABEL_COLORS,
  PRIORITY_FLAG_COLORS,
  STATUS_DOT_COLORS,
  activityLabel,
  initials,
  priorityLabel,
  statusLabel,
} from "./task-labels";
import {
  taskActivityQuery,
  taskEditorKeys,
  taskEditorQuery,
  unwrapTaskResult,
} from "./task-editor-queries";
import { TaskQrSection } from "./task-qr-section";

export interface TaskEditorPerson {
  user_id: string;
  name: string | null;
  email: string | null;
}

export interface TaskEditorProps {
  orgId: string;
  /** The task's id or number (TSK-0042). */
  taskRef: string;
  /** What the host already has (the board's card): the editor shows it at once. */
  initialData?: KanbanTaskEditorData;
  people: TaskEditorPerson[];
  currentUserId: string;
  /** Can edit the task's fields. */
  canUpdate: boolean;
  /** Can give the task to someone else (anyone who edits can take it). */
  canAssign: boolean;
  /** Can archive it. */
  canArchive: boolean;
  /** Can move it between the board's columns. */
  canMove?: boolean;
  /** "Open full task" link (left out on the task's own page). */
  showOpenFull?: boolean;
  /** Every saved change, so the host can update its list. */
  onChanged?: (card: KanbanBoardCard) => void;
  /** The host archives (the board shows an Undo); default: archive and report. */
  onArchive?: (card: KanbanBoardCard) => Promise<boolean>;
  /** After archiving, or from the close button of a dialog. */
  onClose?: () => void;
  /** The dialog title slot (a dialog needs a title element for screen readers). */
  renderTitle?: (title: React.ReactNode) => React.ReactNode;
}

type Patch = Omit<PatchKanbanTaskInput, "id">;

const DESCRIPTION_SAVE_DELAY_MS = 1200;

/**
 * One editor for a task wherever it opens: the board, the task list and the
 * calendar. Every field saves on its own (no Save button), so nothing typed
 * is lost when the window closes, and a refresh of the board never
 * overwrites what is being typed.
 */
export function TaskEditor(props: TaskEditorProps) {
  const { orgId, taskRef, initialData } = props;
  const task = useQuery({
    ...taskEditorQuery(orgId, taskRef),
    initialData,
    // What the host passed may be a little old: check it in the background.
    initialDataUpdatedAt: 0,
  });

  if (task.isPending) return <TaskEditorSkeleton />;
  if (task.isError) {
    return <p className="p-6 text-sm text-destructive">{task.error.message}</p>;
  }
  // Keyed by the task: another task starts with fresh fields.
  return <TaskEditorBody key={task.data.card.id} {...props} data={task.data} />;
}

function TaskEditorBody({
  orgId,
  taskRef,
  data,
  people,
  currentUserId,
  canUpdate: canUpdatePermission,
  canAssign,
  canArchive: canArchivePermission,
  canMove: canMovePermission = false,
  showOpenFull = true,
  onChanged,
  onArchive,
  onClose,
  renderTitle,
}: TaskEditorProps & { data: KanbanTaskEditorData }) {
  const t = useTranslations("modules.planning");
  const format = useFormatter();
  const queryClient = useQueryClient();
  const { card, board, columns } = data;
  const taskKey = useMemo(() => taskEditorKeys.task(orgId, taskRef), [orgId, taskRef]);

  const isArchived = Boolean(card.archived_at);
  const isViewer = board?.my_access === "viewer";
  const readOnlyBoard = Boolean(board?.archived_at);
  const canUpdate = canUpdatePermission && !isArchived && !isViewer && !readOnlyBoard;
  const canMove = canMovePermission && canUpdate && Boolean(board) && !card.is_inbox;
  const canArchive = canArchivePermission && !isArchived && !isViewer && !readOnlyBoard;

  const setCard = useCallback(
    (next: KanbanBoardCard) =>
      queryClient.setQueryData<KanbanTaskEditorData>(taskKey, (current) =>
        current ? { ...current, card: next } : current
      ),
    [queryClient, taskKey]
  );

  const refreshActivity = useCallback(
    () => queryClient.invalidateQueries({ queryKey: taskEditorKeys.activity(orgId, card.id) }),
    [card.id, orgId, queryClient]
  );

  const patch = useMutation({
    // One save after another, in the order they were made.
    scope: { id: `planning-task-${card.id}` },
    mutationFn: (fields: Patch) =>
      unwrapTaskResult(patchKanbanTaskAction({ id: card.id, ...fields })),
    onMutate: (fields) => {
      const current = queryClient.getQueryData<KanbanTaskEditorData>(taskKey);
      if (!current) return;
      const person =
        fields.assigned_to !== undefined
          ? people.find((candidate) => candidate.user_id === fields.assigned_to)
          : undefined;
      setCard({
        ...current.card,
        ...(fields.title !== undefined ? { title: fields.title } : {}),
        ...(fields.priority !== undefined ? { priority: fields.priority } : {}),
        ...(fields.status !== undefined ? { status: fields.status } : {}),
        ...(fields.due_at !== undefined ? { due_at: fields.due_at } : {}),
        ...(fields.label !== undefined
          ? { label: fields.label, label_color: fields.label ? (fields.label_color ?? null) : null }
          : {}),
        ...(fields.assigned_to !== undefined
          ? {
              assigned_to: fields.assigned_to,
              assignee_name: person?.name ?? person?.email ?? null,
              assignee_email: person?.email ?? null,
            }
          : {}),
      });
    },
    onSuccess: (saved) => {
      setCard(saved);
      onChanged?.(saved);
      void refreshActivity();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Operation failed");
      void queryClient.invalidateQueries({ queryKey: taskKey });
    },
  });
  const save = patch.mutate;

  const move = useMutation({
    scope: { id: `planning-task-${card.id}` },
    mutationFn: (columnId: string) =>
      unwrapTaskResult(
        moveKanbanTaskAction({
          card_id: card.id,
          board_id: board?.id ?? null,
          column_id: columnId,
          // The bottom of the column (the database clamps it).
          position: 100000,
        })
      ),
    onSuccess: (result) => {
      const current = queryClient.getQueryData<KanbanTaskEditorData>(taskKey)?.card ?? card;
      const moved: KanbanBoardCard = {
        ...current,
        column_id: result.column_id ?? "",
        board_id: result.board_id ?? "",
        is_inbox: result.is_inbox,
        status: result.status,
        position: result.position,
      };
      setCard(moved);
      onChanged?.(moved);
      void refreshActivity();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Operation failed"),
  });

  const [archiving, setArchiving] = useState(false);
  const archive = async () => {
    setArchiving(true);
    let archived: boolean;
    if (onArchive) {
      archived = await onArchive(card);
    } else {
      const result = await deleteTaskAction(card.id);
      archived = result.success;
      if (result.success) toast.success(t("tasks.taskArchived"));
      else toast.error("error" in result ? result.error : "Operation failed");
    }
    setArchiving(false);
    if (archived) {
      void queryClient.invalidateQueries({ queryKey: taskKey });
      onClose?.();
    }
  };

  const column = columns.find((candidate) => candidate.id === card.column_id);
  const formatDateTime = (value: string | null) =>
    value ? format.dateTime(new Date(value), { dateStyle: "medium", timeStyle: "short" }) : "—";

  const titleNode = (
    <TitleField value={card.title} disabled={!canUpdate} onSave={(title) => save({ title })} />
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="space-y-2 border-b px-5 py-4">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pr-8 text-xs text-muted-foreground">
          <span className="font-mono">{card.task_number}</span>
          <span aria-hidden="true">·</span>
          {card.is_inbox ? (
            <span>{t("boards.inbox.title")}</span>
          ) : board ? (
            <span className="truncate">
              {board.title}
              {column ? ` › ${column.title}` : ""}
            </span>
          ) : (
            <span>{t("taskEditor.noBoard")}</span>
          )}
          <SaveIndicator saving={patch.isPending || move.isPending} saved={patch.isSuccess} />
        </div>
        {renderTitle ? renderTitle(titleNode) : titleNode}
        {isArchived ? (
          <p className="rounded-md bg-amber-500/10 px-3 py-2 text-sm">
            {t("taskEditor.archivedBanner")}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusChip
            status={card.status}
            disabled={!canUpdate}
            onChange={(status) => save({ status })}
          />
          <PriorityChip
            priority={card.priority}
            disabled={!canUpdate}
            onChange={(priority) => save({ priority })}
          />
          <AssigneeChip
            card={card}
            people={people}
            currentUserId={currentUserId}
            canAssign={canAssign}
            disabled={!canUpdate}
            onChange={(assignedTo) => save({ assigned_to: assignedTo })}
          />
          <DueChip
            dueAt={card.due_at}
            status={card.status}
            disabled={!canUpdate}
            onChange={(dueAt) => save({ due_at: dueAt })}
          />
          <LabelChip
            label={card.label}
            color={card.label_color}
            disabled={!canUpdate}
            onChange={(label, color) => save({ label, label_color: color })}
          />
        </div>
      </header>

      <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_16rem] lg:overflow-hidden">
        <div className="min-h-0 space-y-6 px-5 py-4 lg:overflow-y-auto">
          <section className="space-y-2">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold">
              <AlignLeft className="h-4 w-4 text-muted-foreground" />
              {t("tasks.description")}
            </h3>
            <DescriptionField
              card={card}
              disabled={!canUpdate}
              onSave={(description, descriptionRich) =>
                save({ description, description_rich: descriptionRich })
              }
            />
          </section>

          <Separator />

          <CommentsThread
            targetType="planning.task"
            targetId={card.id}
            density="compact"
            labels={{
              title: t("boards.comments.title"),
              empty: t("boards.comments.empty"),
              placeholder: t("boards.comments.placeholder"),
              submit: t("boards.comments.submit"),
            }}
            onCommentAdded={() => {
              void refreshActivity();
              const next = { ...card, comment_count: card.comment_count + 1 };
              setCard(next);
              onChanged?.(next);
            }}
          />

          <Separator />

          <ActivitySection orgId={orgId} taskId={card.id} formatDateTime={formatDateTime} />
        </div>

        <aside className="min-h-0 space-y-5 border-t bg-muted/10 p-4 lg:overflow-y-auto lg:border-l lg:border-t-0">
          {showOpenFull ? (
            <Button variant="outline" size="sm" className="w-full justify-start gap-1.5" asChild>
              <Link
                href={{
                  pathname: "/dashboard/planning/tasks/[taskId]",
                  params: { taskId: card.task_number },
                }}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {t("boards.task.openFull")}
              </Link>
            </Button>
          ) : null}

          {board && !card.is_inbox ? (
            <section className="space-y-2">
              <h3 className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <Columns3 className="h-3.5 w-3.5" />
                {t("boards.column")}
              </h3>
              <div className="flex flex-col gap-1">
                {columns.map((candidate) => (
                  <button
                    key={candidate.id}
                    type="button"
                    disabled={!canMove || move.isPending || candidate.id === card.column_id}
                    onClick={() => move.mutate(candidate.id)}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors enabled:hover:bg-muted disabled:cursor-default",
                      candidate.id === card.column_id && "bg-muted font-medium"
                    )}
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: candidate.color ?? "#64748b" }}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1 truncate">{candidate.title}</span>
                    {candidate.id === card.column_id ? (
                      <Check className="h-3.5 w-3.5 shrink-0" />
                    ) : null}
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          <TaskQrSection taskId={card.id} canUpdate={canUpdate} />

          <section className="space-y-2 text-xs">
            <p className="text-muted-foreground">
              {t("boards.createdBy")}:{" "}
              <span className="text-foreground">
                {card.creator_name ?? card.creator_email ?? t("boards.unknown")}
              </span>
            </p>
            <p className="text-muted-foreground">
              {t("boards.created")}:{" "}
              <span className="text-foreground">{formatDateTime(card.created_at)}</span>
            </p>
            <p className="text-muted-foreground">
              {t("boards.updated")}:{" "}
              <span className="text-foreground">{formatDateTime(card.updated_at)}</span>
            </p>
          </section>

          {canArchive ? (
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-1.5 text-destructive hover:text-destructive"
              onClick={() => void archive()}
              disabled={archiving}
            >
              <Archive className="h-3.5 w-3.5" />
              {t("boards.archiveCard")}
            </Button>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function SaveIndicator({ saving, saved }: { saving: boolean; saved: boolean }) {
  const t = useTranslations("modules.planning");
  if (saving) {
    return (
      <span className="ml-auto flex items-center gap-1" role="status">
        <Loader2 className="h-3 w-3 animate-spin" />
        {t("taskEditor.saving")}
      </span>
    );
  }
  if (saved) {
    return (
      <span className="ml-auto flex items-center gap-1" role="status">
        <Check className="h-3 w-3" />
        {t("taskEditor.saved")}
      </span>
    );
  }
  return null;
}

/** The title, edited in place: Enter or leaving the field saves, Esc puts it back. */
function TitleField({
  value,
  disabled,
  onSave,
}: {
  value: string;
  disabled: boolean;
  onSave: (title: string) => void;
}) {
  const t = useTranslations("modules.planning");
  const [draft, setDraft] = useState(value);
  const editing = useRef(false);

  useEffect(() => {
    if (!editing.current) setDraft(value);
  }, [value]);

  const commit = () => {
    editing.current = false;
    const next = draft.trim();
    if (!next) {
      setDraft(value);
      return;
    }
    if (next !== value) onSave(next);
  };

  return (
    <Textarea
      value={draft}
      rows={1}
      disabled={disabled}
      aria-label={t("boards.cardTitle")}
      onFocus={() => {
        editing.current = true;
      }}
      onChange={(event) => setDraft(event.target.value.replace(/\n/g, " "))}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          event.currentTarget.blur();
        }
        if (event.key === "Escape") {
          event.stopPropagation();
          setDraft(value);
          editing.current = false;
          event.currentTarget.blur();
        }
      }}
      className="min-h-0 resize-none border-transparent bg-transparent px-1 py-0.5 text-xl font-semibold shadow-none hover:border-border focus-visible:border-input focus-visible:ring-1 disabled:cursor-default disabled:opacity-100"
    />
  );
}

/** The description saves itself a moment after typing stops, and when the window closes. */
function DescriptionField({
  card,
  disabled,
  onSave,
}: {
  card: KanbanBoardCard;
  disabled: boolean;
  onSave: (plain: string, rich: RichTextValue) => void;
}) {
  const t = useTranslations("modules.planning");
  const [value, setValue] = useState<RichTextValue>(
    () => normalizeRichText(card.description_rich) ?? createEmptyRichText()
  );
  const dirty = useRef(false);
  const latest = useRef(value);
  const saveRef = useRef(onSave);
  saveRef.current = onSave;

  const flush = useCallback(() => {
    if (!dirty.current) return;
    dirty.current = false;
    saveRef.current(extractPlainText(latest.current).trim(), latest.current);
  }, []);

  useEffect(() => {
    if (!dirty.current) return;
    const timer = window.setTimeout(flush, DESCRIPTION_SAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [flush, value]);

  // Closing the window saves what was typed.
  useEffect(() => flush, [flush]);

  if (disabled) {
    return (
      <RichTextRenderer
        value={normalizeRichText(card.description_rich) ?? undefined}
        emptyText={card.description ?? t("boards.noDescription")}
      />
    );
  }

  return (
    <div onBlur={flush}>
      <RichTextEditorField
        value={value}
        onChange={(next) => {
          dirty.current = true;
          latest.current = next;
          setValue(next);
        }}
        placeholder={t("boards.cardDescriptionPlaceholder")}
        mode="full"
        maxLength={4000}
        contentClassName="min-h-[140px] [&_.ProseMirror]:min-h-[120px]"
      />
    </div>
  );
}

const chipClass =
  "h-7 gap-1.5 rounded-md px-2 text-xs font-medium disabled:opacity-100 disabled:cursor-default";

function StatusChip({
  status,
  disabled,
  onChange,
}: {
  status: KanbanTaskStatus;
  disabled: boolean;
  onChange: (status: KanbanTaskStatus) => void;
}) {
  const t = useTranslations("modules.planning");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <Button variant="secondary" size="sm" className={chipClass}>
          <span className={cn("h-2 w-2 rounded-full", STATUS_DOT_COLORS[status])} />
          {statusLabel(t, status)}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>{t("tasks.status")}</DropdownMenuLabel>
        {KANBAN_TASK_STATUSES.map((item) => (
          <DropdownMenuItem key={item} onSelect={() => item !== status && onChange(item)}>
            <span className={cn("mr-2 h-2 w-2 rounded-full", STATUS_DOT_COLORS[item])} />
            {statusLabel(t, item)}
            {item === status ? <Check className="ml-auto h-3.5 w-3.5" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PriorityChip({
  priority,
  disabled,
  onChange,
}: {
  priority: string;
  disabled: boolean;
  onChange: (priority: (typeof KANBAN_TASK_PRIORITIES)[number]) => void;
}) {
  const t = useTranslations("modules.planning");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <Button variant="secondary" size="sm" className={chipClass}>
          <Flag
            className={cn(
              "h-3.5 w-3.5 fill-current",
              PRIORITY_FLAG_COLORS[priority as keyof typeof PRIORITY_FLAG_COLORS]
            )}
          />
          {priorityLabel(t, priority)}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>{t("tasks.priority")}</DropdownMenuLabel>
        {KANBAN_TASK_PRIORITIES.map((item) => (
          <DropdownMenuItem key={item} onSelect={() => item !== priority && onChange(item)}>
            <Flag className={cn("mr-2 h-3.5 w-3.5 fill-current", PRIORITY_FLAG_COLORS[item])} />
            {priorityLabel(t, item)}
            {item === priority ? <Check className="ml-auto h-3.5 w-3.5" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AssigneeChip({
  card,
  people,
  currentUserId,
  canAssign,
  disabled,
  onChange,
}: {
  card: KanbanBoardCard;
  people: TaskEditorPerson[];
  currentUserId: string;
  canAssign: boolean;
  disabled: boolean;
  onChange: (userId: string | null) => void;
}) {
  const t = useTranslations("modules.planning");
  // Someone who cannot assign may take the task or let go of their own.
  const options = useMemo(
    () =>
      canAssign
        ? people
        : people.filter(
            (person) => person.user_id === currentUserId || person.user_id === card.assigned_to
          ),
    [canAssign, card.assigned_to, currentUserId, people]
  );
  const name = card.assignee_name ?? card.assignee_email;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <Button variant="secondary" size="sm" className={chipClass}>
          {name ? (
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-semibold text-primary-foreground">
              {initials(card.assignee_name, card.assignee_email)}
            </span>
          ) : (
            <User className="h-3.5 w-3.5" />
          )}
          {name ?? t("boards.task.unassigned")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-72 overflow-y-auto">
        <DropdownMenuLabel>{t("boards.task.assignee")}</DropdownMenuLabel>
        {card.assigned_to !== currentUserId ? (
          <DropdownMenuItem onSelect={() => onChange(currentUserId)}>
            <Hand className="mr-2 h-3.5 w-3.5" />
            {t("boards.task.takeIt")}
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onSelect={() => card.assigned_to && onChange(null)}>
          <X className="mr-2 h-3.5 w-3.5" />
          {t("boards.task.unassigned")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {options.map((person) => (
          <DropdownMenuItem
            key={person.user_id}
            onSelect={() => person.user_id !== card.assigned_to && onChange(person.user_id)}
          >
            <span className="mr-2 flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-semibold">
              {initials(person.name, person.email)}
            </span>
            <span className="truncate">{person.name || person.email || person.user_id}</span>
            {person.user_id === card.assigned_to ? <Check className="ml-auto h-3.5 w-3.5" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DueChip({
  dueAt,
  status,
  disabled,
  onChange,
}: {
  dueAt: string | null;
  status: KanbanTaskStatus;
  disabled: boolean;
  onChange: (dueAt: string | null) => void;
}) {
  const t = useTranslations("modules.planning");
  const format = useFormatter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(toDateInput(dueAt));
  const state = dueState(dueAt, status);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) setDraft(toDateInput(dueAt));
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
          {dueAt
            ? format.dateTime(new Date(dueAt), { dateStyle: "medium" })
            : t("taskEditor.noDueDate")}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 space-y-3">
        <p className="text-sm font-medium">{t("boards.dueDate")}</p>
        <Input
          type="date"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          aria-label={t("boards.dueDate")}
        />
        <div className="flex gap-2">
          <Button
            size="sm"
            className="flex-1"
            onClick={() => {
              const next = fromDateInput(draft);
              if (next !== dueAt) onChange(next);
              setOpen(false);
            }}
          >
            {t("boards.save")}
          </Button>
          {dueAt ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                onChange(null);
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

function LabelChip({
  label,
  color,
  disabled,
  onChange,
}: {
  label: string | null;
  color: string | null;
  disabled: boolean;
  onChange: (label: string | null, color: string | null) => void;
}) {
  const t = useTranslations("modules.planning");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(label ?? "");
  const [draftColor, setDraftColor] = useState(color ?? LABEL_COLORS[0]);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setDraft(label ?? "");
          setDraftColor(color ?? LABEL_COLORS[0]);
        }
        setOpen(next);
      }}
    >
      <PopoverTrigger asChild disabled={disabled}>
        {label ? (
          <button
            type="button"
            className="h-7 rounded-md px-2 text-xs font-semibold text-white disabled:cursor-default"
            style={{ backgroundColor: color ?? "#64748b" }}
          >
            {label}
          </button>
        ) : (
          <Button variant="secondary" size="sm" className={chipClass}>
            <Tag className="h-3.5 w-3.5" />
            {t("boards.label")}
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 space-y-3">
        <p className="text-sm font-medium">{t("boards.label")}</p>
        <Input
          value={draft}
          maxLength={80}
          onChange={(event) => setDraft(event.target.value)}
          aria-label={t("boards.label")}
          placeholder={t("taskEditor.labelPlaceholder")}
        />
        <div className="grid grid-cols-5 gap-1.5">
          {LABEL_COLORS.map((candidate) => (
            <button
              key={candidate}
              type="button"
              className={cn(
                "h-7 rounded-md",
                draftColor === candidate && "ring-2 ring-ring ring-offset-2 ring-offset-background"
              )}
              style={{ backgroundColor: candidate }}
              onClick={() => setDraftColor(candidate)}
              aria-label={t("taskEditor.labelColor", { color: candidate })}
              aria-pressed={draftColor === candidate}
            />
          ))}
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            className="flex-1"
            onClick={() => {
              const next = draft.trim();
              onChange(next || null, next ? draftColor : null);
              setOpen(false);
            }}
          >
            {t("boards.save")}
          </Button>
          {label ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                onChange(null, null);
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

function ActivitySection({
  orgId,
  taskId,
  formatDateTime,
}: {
  orgId: string;
  taskId: string;
  formatDateTime: (value: string | null) => string;
}) {
  const t = useTranslations("modules.planning");
  const activity = useQuery(taskActivityQuery(orgId, taskId));
  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold">
        <Activity className="h-4 w-4 text-muted-foreground" />
        {t("boards.activity")}
      </h3>
      {activity.isPending ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("boards.loading")}
        </div>
      ) : (
        <ActivityList activity={activity.data ?? []} formatDateTime={formatDateTime} />
      )}
    </section>
  );
}

function ActivityList({
  activity,
  formatDateTime,
}: {
  activity: KanbanCardActivity[];
  formatDateTime: (value: string | null) => string;
}) {
  const t = useTranslations("modules.planning");
  if (!activity.length) {
    return <p className="text-xs text-muted-foreground">{t("boards.noActivity")}</p>;
  }
  return (
    <ol className="space-y-2.5">
      {[...activity].reverse().map((item) => (
        <li key={item.id} className="flex gap-2.5">
          {item.activity_type === "comment_added" ? (
            <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <CircleDot className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm">{activityLabel(t, item.activity_type, item.message)}</p>
            <p className="text-xs text-muted-foreground">
              {item.actor_name ?? item.actor_email ?? t("boards.systemActor")} ·{" "}
              {formatDateTime(item.created_at)}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function TaskEditorSkeleton() {
  return (
    <div className="space-y-4 p-5">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-7 w-2/3" />
      <div className="flex gap-2">
        <Skeleton className="h-7 w-24" />
        <Skeleton className="h-7 w-24" />
        <Skeleton className="h-7 w-28" />
      </div>
      <Skeleton className="h-32 w-full" />
    </div>
  );
}
