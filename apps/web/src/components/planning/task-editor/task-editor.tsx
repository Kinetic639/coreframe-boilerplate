"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFormatter, useTranslations } from "next-intl";
import {
  AlignLeft,
  Archive,
  Check,
  ChevronDown,
  CircleDot,
  Copy,
  LayoutTemplate,
  ExternalLink,
  Flag,
  Hand,
  Loader2,
  MessageSquare,
  MoreHorizontal,
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
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { AttachmentsPanel } from "@/components/features/attachments";
import { CommentsThread } from "@/components/features/comments";
import { MentionChip } from "@/components/v2/mentions/mention-chip";
import { ENTITY_MENTIONS } from "@/components/v2/mentions/mention-suggestion-list";
import { useMentionAccess } from "@/hooks/queries/mentions";
import { useAppStoreV2 } from "@/lib/stores/v2/app-store";
import { useUserStoreV2 } from "@/lib/stores/v2/user-store";
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
  KanbanBoardLabel,
  KanbanCardActivity,
  KanbanRecurrence,
  KanbanTaskEditorData,
  KanbanTaskStatus,
} from "@/lib/types/kanban";
import {
  KANBAN_TASK_PRIORITIES,
  KANBAN_TASK_STATUSES,
  type PatchKanbanTaskInput,
} from "@/lib/validations/kanban";
import { cn } from "@/utils";
import {
  ChecklistsSection,
  CoverPicker,
  DatesChip,
  LabelsChip,
  WatchButton,
  chipClass,
} from "./task-editor-extras";
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
import { TaskRelationsSection } from "./task-relations";
import { CopyCardDialog } from "./copy-card-dialog";
import { CustomFieldsSection } from "./custom-fields";
import { RecurrencePicker } from "./recurrence-picker";

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
  /** A label was added to the task's board from the editor. */
  onBoardLabelCreated?: (label: KanbanBoardLabel) => void;
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
  onBoardLabelCreated,
}: TaskEditorProps & { data: KanbanTaskEditorData }) {
  const t = useTranslations("modules.planning");
  const format = useFormatter();
  const queryClient = useQueryClient();
  const { card, board, columns, labels: boardLabels = [], custom_fields: customFields = [] } = data;
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

  /** A change saved elsewhere (labels, checklists, watching): show it and tell the host. */
  const cardChanged = useCallback(
    (next: KanbanBoardCard) => {
      setCard(next);
      onChanged?.(next);
      void refreshActivity();
    },
    [onChanged, refreshActivity, setCard]
  );

  const labelCreated = useCallback(
    (label: KanbanBoardLabel) => {
      queryClient.setQueryData<KanbanTaskEditorData>(taskKey, (current) =>
        current ? { ...current, labels: [...(current.labels ?? []), label] } : current
      );
      onBoardLabelCreated?.(label);
    },
    [onBoardLabelCreated, queryClient, taskKey]
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
        ...(fields.is_template !== undefined ? { is_template: fields.is_template } : {}),
        ...(fields.recurrence !== undefined
          ? { recurrence: (fields.recurrence ?? null) as KanbanRecurrence | null }
          : {}),
        ...(fields.status !== undefined ? { status: fields.status } : {}),
        ...(fields.due_at !== undefined ? { due_at: fields.due_at, due_has_time: false } : {}),
        ...(fields.dates
          ? {
              due_at: fields.dates.due_at,
              due_has_time: fields.dates.due_has_time,
              start_date: fields.dates.start_date,
            }
          : {}),
        ...(fields.cover_color !== undefined
          ? { cover_color: fields.cover_color, cover_attachment_id: null, cover_url: null }
          : {}),
        ...(fields.cover_attachment_id !== undefined
          ? { cover_attachment_id: fields.cover_attachment_id, cover_color: null }
          : {}),
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

  const [copying, setCopying] = useState(false);
  const relationsCardChange = useCallback(
    (next: KanbanBoardCard) => {
      setCard(next);
      onChanged?.(next);
    },
    [onChanged, setCard]
  );

  const column = columns.find((candidate) => candidate.id === card.column_id);
  const formatDateTime = (value: string | null) =>
    value ? format.dateTime(new Date(value), { dateStyle: "medium", timeStyle: "short" }) : "—";

  const titleNode = (
    <TitleField value={card.title} disabled={!canUpdate} onSave={(title) => save({ title })} />
  );

  const rootRef = useRef<HTMLDivElement>(null);
  const wide = useWideLayout(rootRef);
  const [chosenTab, setChosenTab] = useState<EditorTab | null>(null);
  // Wide: the task is always on the left, the right side opens on its details.
  const tab: EditorTab =
    chosenTab === null || (wide && chosenTab === "task") ? (wide ? "details" : "task") : chosenTab;
  const isDone = card.status === "completed";
  const coverImage = card.cover_url;
  const coverColor = card.cover_color;
  const hasCover = Boolean(coverImage || coverColor);

  const toolbar = (
    <div
      className={cn(
        "flex h-12 shrink-0 items-center gap-2 px-3 pr-12 sm:px-4 sm:pr-14",
        hasCover ? "absolute inset-x-0 top-0 z-10" : "border-b"
      )}
    >
      <span
        className={cn(
          "shrink-0 rounded px-1.5 py-0.5 font-mono text-xs text-muted-foreground",
          hasCover && "bg-background/90 text-foreground shadow-sm backdrop-blur"
        )}
      >
        {card.task_number}
      </span>
      {board && !card.is_inbox ? (
        <ColumnMenu
          columns={columns}
          currentId={card.column_id}
          disabled={!canMove || move.isPending}
          onMove={(columnId) => move.mutate(columnId)}
          className={hasCover ? "bg-background/90 shadow-sm backdrop-blur" : undefined}
        />
      ) : null}
      <SaveIndicator
        saving={patch.isPending || move.isPending}
        saved={patch.isSuccess}
        className={cn(
          hasCover && "rounded bg-background/90 px-1.5 py-0.5 text-foreground backdrop-blur"
        )}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-8 w-8 shrink-0",
              !patch.isPending && !move.isPending && !patch.isSuccess && "ml-auto",
              hasCover && "bg-background/90 shadow-sm backdrop-blur hover:bg-background"
            )}
            aria-label={t("taskEditor.more")}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {showOpenFull ? (
            <DropdownMenuItem asChild>
              <Link
                href={{
                  pathname: "/dashboard/planning/tasks/[taskId]",
                  params: { taskId: card.task_number },
                }}
              >
                <ExternalLink className="mr-2 h-3.5 w-3.5" />
                {t("taskEditor.openFull")}
              </Link>
            </DropdownMenuItem>
          ) : null}
          {canUpdatePermission && !isArchived ? (
            <DropdownMenuItem onSelect={() => setCopying(true)}>
              <Copy className="mr-2 h-3.5 w-3.5" />
              {t("boardExtras.card.menu")}
            </DropdownMenuItem>
          ) : null}
          {board && !card.is_inbox && canUpdate ? (
            <DropdownMenuItem onSelect={() => save({ is_template: !card.is_template })}>
              <LayoutTemplate className="mr-2 h-3.5 w-3.5" />
              {card.is_template
                ? t("boardExtras.templates.unmarkCard")
                : t("boardExtras.templates.markCard")}
            </DropdownMenuItem>
          ) : null}
          {canArchive ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                disabled={archiving}
                onSelect={() => void archive()}
              >
                <Archive className="mr-2 h-3.5 w-3.5" />
                {t("boards.archiveCard")}
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  const cover = hasCover ? (
    <div
      className={cn("relative shrink-0 bg-muted", coverImage ? "h-28 sm:h-36" : "h-16")}
      style={coverColor && !coverImage ? { backgroundColor: coverColor } : undefined}
    >
      {coverImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- private signed URL
        <img src={coverImage} alt="" className="h-full w-full object-cover" />
      ) : null}
      {toolbar}
    </div>
  ) : (
    toolbar
  );

  const heading = (
    <div className="space-y-4 px-4 pt-4 sm:px-6">
      <div className="space-y-1">
        <p className="truncate pl-9 text-xs text-muted-foreground">
          {card.is_inbox
            ? t("boards.inbox.title")
            : board
              ? `${board.title}${column ? ` › ${column.title}` : ""}`
              : t("taskEditor.noBoard")}
        </p>
        <div className="flex items-start gap-2">
          <button
            type="button"
            disabled={!canUpdate}
            onClick={() => save({ status: isDone ? "open" : "completed" })}
            aria-pressed={isDone}
            aria-label={isDone ? t("taskEditor.reopen") : t("taskEditor.markDone")}
            title={isDone ? t("taskEditor.reopen") : t("taskEditor.markDone")}
            className={cn(
              "mt-1.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors disabled:cursor-default",
              isDone
                ? "border-emerald-500 bg-emerald-500 text-white"
                : "border-muted-foreground/40 text-transparent enabled:hover:border-emerald-500 enabled:hover:text-emerald-500"
            )}
          >
            <Check className="h-3.5 w-3.5" strokeWidth={3} />
          </button>
          <div className="min-w-0 flex-1">{renderTitle ? renderTitle(titleNode) : titleNode}</div>
        </div>
      </div>
      {isArchived ? (
        <p className="rounded-md bg-amber-500/10 px-3 py-2 text-sm">
          {t("taskEditor.archivedBanner")}
        </p>
      ) : null}
      <div
        className={cn(
          "flex gap-x-5 gap-y-3",
          wide
            ? "flex-wrap"
            : "-mx-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:-mx-6 sm:px-6"
        )}
      >
        <Property label={t("tasks.status")}>
          <StatusChip
            status={card.status}
            disabled={!canUpdate}
            onChange={(status) => save({ status })}
          />
        </Property>
        <Property label={t("tasks.priority")}>
          <PriorityChip
            priority={card.priority}
            disabled={!canUpdate}
            onChange={(priority) => save({ priority })}
          />
        </Property>
        <Property label={t("taskEditor.assignee")}>
          <AssigneeChip
            card={card}
            people={people}
            currentUserId={currentUserId}
            canAssign={canAssign}
            disabled={!canUpdate}
            onChange={(assignedTo) => save({ assigned_to: assignedTo })}
          />
        </Property>
        <Property label={t("taskEditor.dates")}>
          <DatesChip
            card={card}
            status={card.status}
            disabled={!canUpdate}
            onChange={(dates) => save({ dates })}
          />
        </Property>
        <Property label={t("taskEditor.labels")}>
          {board && !card.is_inbox ? (
            <LabelsChip
              card={card}
              boardId={board.id}
              labels={boardLabels}
              disabled={!canUpdate}
              onCardChange={cardChanged}
              onLabelCreated={labelCreated}
            />
          ) : (
            <LabelChip
              label={card.label}
              color={card.label_color}
              disabled={!canUpdate}
              onChange={(label, color) => save({ label, label_color: color })}
            />
          )}
        </Property>
      </div>
    </div>
  );

  const work = (
    <div className="space-y-7 px-4 py-5 sm:px-6">
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

      <ChecklistsSection
        orgId={orgId}
        card={card}
        people={people}
        currentUserId={currentUserId}
        canAssign={canAssign}
        disabled={!canUpdate}
        onCardChange={(next) => {
          setCard(next);
          onChanged?.(next);
        }}
        onTaskCreated={(created) => {
          onChanged?.(created);
          void refreshActivity();
        }}
      />

      <AttachmentsPanel
        targetType="planning.task"
        targetId={card.id}
        canUpload={canUpdate}
        canDelete={canUpdate}
        archiveName={card.task_number}
        labels={{ sectionTitle: t("taskEditor.attachments") }}
        onUploaded={(files) => {
          const current = queryClient.getQueryData<KanbanTaskEditorData>(taskKey)?.card ?? card;
          const next = {
            ...current,
            attachment_count: current.attachment_count + files.length,
          };
          setCard(next);
          onChanged?.(next);
        }}
        onDeleted={(attachmentId) => {
          const current = queryClient.getQueryData<KanbanTaskEditorData>(taskKey)?.card ?? card;
          const next = {
            ...current,
            attachment_count: Math.max(0, current.attachment_count - 1),
            ...(current.cover_attachment_id === attachmentId
              ? { cover_attachment_id: null, cover_url: null }
              : {}),
          };
          setCard(next);
          onChanged?.(next);
        }}
      />
    </div>
  );

  const details = (
    <div className="space-y-6 p-4">
      <section className="space-y-1">
        <SideHeading>{t("taskEditor.place")}</SideHeading>
        <SideRow label={t("taskEditor.board")}>
          {card.is_inbox ? t("boards.inbox.title") : (board?.title ?? t("taskEditor.noBoard"))}
        </SideRow>
        {column ? <SideRow label={t("taskEditor.column")}>{column.title}</SideRow> : null}
      </section>

      {board && !card.is_inbox ? (
        <CustomFieldsSection
          card={card}
          fields={customFields}
          disabled={!canUpdate}
          onCardChange={relationsCardChange}
        />
      ) : null}

      <TaskRelationsSection
        orgId={orgId}
        card={card}
        disabled={!canUpdate}
        onCardChange={relationsCardChange}
      />

      <section className="space-y-2">
        <SideHeading>{t("taskEditor.recurrence")}</SideHeading>
        <RecurrencePicker
          card={card}
          disabled={!canUpdate || card.is_template}
          onChange={(recurrence) => save({ recurrence })}
        />
      </section>

      <TaskQrSection taskId={card.id} canUpdate={canUpdate} />

      <section className="space-y-2">
        <SideHeading>{t("taskEditor.actions")}</SideHeading>
        <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-2">
          <WatchButton card={card} currentUserId={currentUserId} onCardChange={cardChanged} />
          {board && !card.is_inbox ? (
            <CoverPicker card={card} disabled={!canUpdate} onChange={(next) => save(next)} />
          ) : null}
          {canUpdatePermission && !isArchived ? (
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start gap-1.5"
              onClick={() => setCopying(true)}
            >
              <Copy className="h-3.5 w-3.5" />
              {t("boardExtras.card.menu")}
            </Button>
          ) : null}
          {board && !card.is_inbox && canUpdate ? (
            <Button
              variant={card.is_template ? "secondary" : "outline"}
              size="sm"
              className="w-full justify-start gap-1.5"
              aria-pressed={card.is_template}
              title={t("boardExtras.templates.cardHelp")}
              onClick={() => save({ is_template: !card.is_template })}
            >
              <LayoutTemplate className="h-3.5 w-3.5" />
              <span className="truncate">
                {card.is_template
                  ? t("boardExtras.templates.unmarkCard")
                  : t("boardExtras.templates.markCard")}
              </span>
            </Button>
          ) : null}
          {canArchive ? (
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start gap-1.5 text-destructive hover:text-destructive"
              onClick={() => void archive()}
              disabled={archiving}
            >
              <Archive className="h-3.5 w-3.5" />
              {t("boards.archiveCard")}
            </Button>
          ) : null}
        </div>
      </section>

      <section className="space-y-1 text-xs text-muted-foreground">
        <p>
          {t("boards.createdBy")}:{" "}
          <span className="text-foreground">
            {card.creator_name ?? card.creator_email ?? t("boards.unknown")}
          </span>
        </p>
        <p>
          {t("boards.created")}:{" "}
          <span className="text-foreground">{formatDateTime(card.created_at)}</span>
        </p>
        <p>
          {t("boards.updated")}:{" "}
          <span className="text-foreground">{formatDateTime(card.updated_at)}</span>
        </p>
      </section>
    </div>
  );

  const comments = (
    <div className="p-4">
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
          const current = queryClient.getQueryData<KanbanTaskEditorData>(taskKey)?.card ?? card;
          const next = { ...current, comment_count: current.comment_count + 1 };
          setCard(next);
          onChanged?.(next);
        }}
      />
    </div>
  );

  const activity = (
    <div className="p-4">
      <ActivitySection orgId={orgId} taskId={card.id} formatDateTime={formatDateTime} />
    </div>
  );

  const tabs: { id: EditorTab; label: string; count?: number }[] = [
    ...(wide ? [] : [{ id: "task" as const, label: t("taskEditor.tabTask") }]),
    { id: "details", label: t("taskEditor.tabDetails") },
    { id: "comments", label: t("taskEditor.tabComments"), count: card.comment_count },
    { id: "activity", label: t("taskEditor.tabActivity") },
  ];

  const tabBar = (
    <div
      role="tablist"
      aria-label={t("taskEditor.tabsLabel")}
      className="flex gap-1 rounded-lg bg-muted p-1"
    >
      {tabs.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          id={`task-tab-${item.id}`}
          aria-selected={tab === item.id}
          aria-controls={`task-panel-${item.id}`}
          onClick={() => setChosenTab(item.id)}
          className={cn(
            "flex h-8 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground sm:text-sm",
            tab === item.id && "bg-background text-foreground shadow-sm"
          )}
        >
          <span className="truncate">{item.label}</span>
          {item.count ? (
            <span className="rounded-full bg-muted-foreground/15 px-1.5 text-[11px] leading-4 tabular-nums">
              {item.count}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );

  const panel = (id: EditorTab, content: React.ReactNode) => (
    <div
      role="tabpanel"
      id={`task-panel-${id}`}
      aria-labelledby={`task-tab-${id}`}
      hidden={tab !== id}
    >
      {content}
    </div>
  );

  return (
    <div ref={rootRef} className="flex min-h-0 flex-1 flex-col">
      {wide ? (
        <>
          {cover}
          <div className="flex min-h-0 flex-1">
            <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
              {heading}
              {work}
            </div>
            <aside className="flex min-h-0 w-[22rem] shrink-0 flex-col border-l bg-muted/30 xl:w-96">
              <div className="shrink-0 p-3 pb-0">{tabBar}</div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {panel("details", details)}
                {panel("comments", comments)}
                {panel("activity", activity)}
              </div>
            </aside>
          </div>
        </>
      ) : (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {cover}
            {heading}
            <div className="sticky top-0 z-20 mt-3 border-b bg-background/95 px-4 py-2 backdrop-blur sm:px-6">
              {tabBar}
            </div>
            {panel("task", work)}
            {panel("details", details)}
            {panel("comments", comments)}
            {panel("activity", activity)}
          </div>
          {canUpdate && tab !== "comments" ? (
            <div className="shrink-0 border-t bg-background px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <Button
                className="h-11 w-full gap-2"
                variant={isDone ? "outline" : "default"}
                onClick={() => save({ status: isDone ? "open" : "completed" })}
              >
                <Check className="h-4 w-4" />
                {isDone ? t("taskEditor.reopen") : t("taskEditor.markDone")}
              </Button>
            </div>
          ) : null}
        </>
      )}
      <CopyCardDialog
        orgId={orgId}
        card={copying ? card : null}
        onOpenChange={setCopying}
        onCopied={(copy) => onChanged?.(copy)}
      />
    </div>
  );
}

type EditorTab = "task" | "details" | "comments" | "activity";

/** Wide enough for the task on the left and its tabs on the right (measured, not the window: the editor also sits in narrow side panels). */
const WIDE_LAYOUT_MIN_WIDTH = 820;

function useWideLayout(ref: React.RefObject<HTMLElement | null>) {
  const [wide, setWide] = useState(true);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => setWide(element.getBoundingClientRect().width >= WIDE_LAYOUT_MIN_WIDTH);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return wide;
}

function Property({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="shrink-0 space-y-1">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  );
}

function SideHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
      {children}
    </h3>
  );
}

function SideRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/60 py-1.5 text-sm last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-right">{children}</span>
    </div>
  );
}

function ColumnMenu({
  columns,
  currentId,
  disabled,
  onMove,
  className,
}: {
  columns: KanbanTaskEditorData["columns"];
  currentId: string;
  disabled: boolean;
  onMove: (columnId: string) => void;
  className?: string;
}) {
  const t = useTranslations("modules.planning");
  const current = columns.find((candidate) => candidate.id === currentId);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-7 min-w-0 gap-1.5 rounded-full px-2.5 text-xs font-medium disabled:opacity-100",
            className
          )}
        >
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: current?.color ?? "#64748b" }}
            aria-hidden="true"
          />
          <span className="truncate">{current?.title ?? t("taskEditor.column")}</span>
          {!disabled ? <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" /> : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-72 w-56 overflow-y-auto">
        <DropdownMenuLabel>{t("taskEditor.moveTo")}</DropdownMenuLabel>
        {columns.map((candidate) => (
          <DropdownMenuItem
            key={candidate.id}
            onSelect={() => candidate.id !== currentId && onMove(candidate.id)}
          >
            <span
              className="mr-2 h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: candidate.color ?? "#64748b" }}
              aria-hidden="true"
            />
            <span className="truncate">{candidate.title}</span>
            {candidate.id === currentId ? <Check className="ml-auto h-3.5 w-3.5" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SaveIndicator({
  saving,
  saved,
  className,
}: {
  saving: boolean;
  saved: boolean;
  className?: string;
}) {
  const t = useTranslations("modules.planning");
  if (saving) {
    return (
      <span
        className={cn("ml-auto flex items-center gap-1 text-xs text-muted-foreground", className)}
        role="status"
      >
        <Loader2 className="h-3 w-3 animate-spin" />
        {t("taskEditor.saving")}
      </span>
    );
  }
  if (saved) {
    return (
      <span
        className={cn("ml-auto flex items-center gap-1 text-xs text-muted-foreground", className)}
        role="status"
      >
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
  const orgId = useAppStoreV2((s) => s.activeOrgId);
  const meId = useUserStoreV2((s) => s.user?.id ?? null);
  const documents = useMemo(
    () => (disabled ? [card.description_rich] : []),
    [card.description_rich, disabled]
  );
  const mentionAccess = useMentionAccess(orgId, documents);
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
        renderMention={(mention) => (
          <MentionChip mention={mention} access={mentionAccess(mention)} meId={meId} />
        )}
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
        mention={ENTITY_MENTIONS}
        maxLength={4000}
        contentClassName="min-h-[140px] [&_.ProseMirror]:min-h-[120px]"
      />
    </div>
  );
}

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
    <section className="space-y-3" aria-label={t("boards.activity")}>
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
