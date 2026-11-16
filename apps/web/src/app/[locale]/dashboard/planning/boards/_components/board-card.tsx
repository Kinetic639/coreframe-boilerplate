"use client";

import { memo, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import {
  AlignLeft,
  Archive,
  ArrowRightLeft,
  Calendar,
  Ban,
  Check,
  CheckSquare,
  Copy,
  ExternalLink,
  LayoutTemplate,
  ListTree,
  Eye,
  Flag,
  Hand,
  Inbox,
  MessageSquare,
  Paperclip,
  Pencil,
  X,
} from "lucide-react";
import { KanbanCard } from "@/components/primitives/kanban";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import type { KanbanBoardCard, KanbanBoardColumn } from "@/lib/types/kanban";
import { KANBAN_TASK_PRIORITIES } from "@/lib/validations/kanban";
import { PRIORITY_FLAG_COLORS } from "@/components/planning/task-editor/task-labels";
import { formatCardDates } from "@/components/planning/task-editor/task-editor-extras";
import { cn } from "@/utils";
import {
  DUE_STATE_CLASSES,
  STATUS_DOT_COLORS,
  dueState,
  initials,
  priorityLabel,
  statusLabel,
} from "./board-format";
import type { BoardActions } from "./use-board-actions";

interface BoardCardProps {
  card: KanbanBoardCard;
  columnColor?: string | null;
  /** The board's columns, for "Move to". */
  columns: KanbanBoardColumn[];
  canEdit: boolean;
  canArchive: boolean;
  currentUserId: string;
  actions: BoardActions;
  onOpen: (card: KanbanBoardCard) => void;
  /** The pointer is over the card (keyboard shortcuts act on it). */
  onHover?: (card: KanbanBoardCard | null) => void;
  /** Labels as thin bars (the board's compact setting). */
  compactLabels?: boolean;
  /** Opens "Copy card" (left out where cards can't be added). */
  onCopy?: (card: KanbanBoardCard) => void;
}

/**
 * A task on the board, Trello style: label, title, and a row of badges (due
 * date coloured by how close it is, priority, comments, description) with the
 * assignee's avatar. The pencil (or a right click) opens quick actions.
 * Memoized: a move re-renders only the cards that changed.
 */
export const BoardCard = memo(function BoardCard({
  card,
  columnColor,
  columns,
  canEdit,
  canArchive,
  currentUserId,
  actions,
  onOpen,
  onHover,
  compactLabels = false,
  onCopy,
}: BoardCardProps) {
  const t = useTranslations("modules.planning");
  const format = useFormatter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const due = dueState(card.due_at, card.status);
  const showPriority = card.priority === "high" || card.priority === "urgent";
  const assignee = card.assignee_name ?? card.assignee_email;
  const hasQuickActions = canEdit || canArchive || Boolean(onCopy);
  const subtasksDone = card.subtask_total > 0 && card.subtask_done === card.subtask_total;
  const dates = formatCardDates(format, card);
  const watching = card.watcher_ids?.includes(currentUserId) ?? false;
  const checklistComplete =
    card.checklist_total > 0 && card.checklist_done === card.checklist_total;

  return (
    <KanbanCard id={card.id} className="overflow-hidden p-0">
      {card.cover_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={card.cover_url}
          alt=""
          className="h-32 w-full rounded-t-md object-cover"
          draggable={false}
          loading="lazy"
        />
      ) : card.cover_color ? (
        <div className="h-8 w-full rounded-t-md" style={{ backgroundColor: card.cover_color }} />
      ) : null}
      <div
        onMouseEnter={onHover ? () => onHover(card) : undefined}
        onMouseLeave={onHover ? () => onHover(null) : undefined}
        role="button"
        tabIndex={0}
        aria-label={card.title}
        className="relative flex w-full min-w-0 cursor-grab flex-col gap-2 rounded-md p-3 text-left outline-none active:cursor-grabbing"
        onClick={() => !editingTitle && onOpen(card)}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          if (event.key === "Enter") onOpen(card);
          if ((event.key === "e" || event.key === "E") && hasQuickActions) {
            event.preventDefault();
            setMenuOpen(true);
          }
        }}
        onContextMenu={(event) => {
          if (!hasQuickActions) return;
          event.preventDefault();
          setMenuOpen(true);
        }}
      >
        {card.labels?.length ? (
          <div className="flex flex-wrap gap-1 pr-6">
            {card.labels.map((label) =>
              compactLabels ? (
                <span
                  key={label.id}
                  className="h-2 w-10 rounded-full"
                  style={{ backgroundColor: label.color }}
                  title={label.name}
                />
              ) : (
                <span
                  key={label.id}
                  className="max-w-full truncate rounded px-1.5 py-0.5 text-[10px] font-semibold text-white"
                  style={{ backgroundColor: label.color }}
                  title={label.name}
                >
                  {label.name || "\u00a0"}
                </span>
              )
            )}
          </div>
        ) : card.label ? (
          <span
            className="w-fit max-w-full truncate rounded px-1.5 py-0.5 text-[10px] font-semibold text-white"
            style={{ backgroundColor: card.label_color ?? "#64748b" }}
          >
            {card.label}
          </span>
        ) : null}

        {editingTitle ? (
          <QuickTitle
            card={card}
            onDone={(title) => {
              setEditingTitle(false);
              if (title && title !== card.title) void actions.patchCard(card, { title });
            }}
          />
        ) : (
          <h3 className="line-clamp-3 break-words pr-6 text-sm font-medium">{card.title}</h3>
        )}

        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
          {card.is_template ? (
            <span className="flex items-center gap-1 rounded bg-sky-600/15 px-1.5 py-0.5 font-medium text-sky-700 dark:text-sky-300">
              <LayoutTemplate className="h-3 w-3" />
              {t("boardExtras.templates.badge")}
            </span>
          ) : null}
          {card.blocked_by_open ? (
            <span
              className="flex items-center gap-1 rounded bg-red-600 px-1.5 py-0.5 font-medium text-white"
              title={t("boardExtras.relations.blockedHelp", { count: card.blocked_by_open })}
            >
              <Ban className="h-3 w-3" />
              {t("boardExtras.relations.blocked")}
            </span>
          ) : null}
          {due ? (
            <span
              className={cn(
                "flex items-center gap-1 rounded px-1.5 py-0.5 font-medium",
                due === "normal" ? "bg-muted" : DUE_STATE_CLASSES[due]
              )}
              title={t(`boards.cardBadges.due.${due}`)}
            >
              {due === "done" ? <Check className="h-3 w-3" /> : <Calendar className="h-3 w-3" />}
              {dates}
            </span>
          ) : dates ? (
            <span className="flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 font-medium">
              <Calendar className="h-3 w-3" />
              {dates}
            </span>
          ) : null}
          {showPriority ? (
            <span
              className="flex items-center gap-0.5"
              title={`${t("tasks.priority")}: ${priorityLabel(t, card.priority)}`}
            >
              <Flag
                className={cn(
                  "h-3 w-3 fill-current",
                  PRIORITY_FLAG_COLORS[card.priority as keyof typeof PRIORITY_FLAG_COLORS]
                )}
              />
            </span>
          ) : null}
          {card.description ? (
            <AlignLeft className="h-3 w-3" aria-label={t("boards.cardBadges.hasDescription")} />
          ) : null}
          {watching ? (
            <Eye className="h-3 w-3" aria-label={t("boardTools.badges.watching")} />
          ) : null}
          {card.checklist_total ? (
            <span
              className={cn(
                "flex items-center gap-0.5 rounded px-1 py-0.5",
                checklistComplete && "bg-emerald-600 font-medium text-white"
              )}
              title={t("boardTools.badges.checklist", {
                done: card.checklist_done,
                total: card.checklist_total,
              })}
            >
              <CheckSquare className="h-3 w-3" />
              {card.checklist_done}/{card.checklist_total}
            </span>
          ) : null}
          {card.subtask_total ? (
            <span
              className={cn(
                "flex items-center gap-0.5 rounded px-1 py-0.5",
                subtasksDone && "bg-emerald-600 font-medium text-white"
              )}
              title={t("boardExtras.relations.subtaskProgress", {
                done: card.subtask_done,
                total: card.subtask_total,
              })}
            >
              <ListTree className="h-3 w-3" />
              {card.subtask_done}/{card.subtask_total}
            </span>
          ) : null}
          {card.attachment_count ? (
            <span
              className="flex items-center gap-0.5"
              title={t("boardTools.badges.attachments", { count: card.attachment_count })}
            >
              <Paperclip className="h-3 w-3" />
              {card.attachment_count}
            </span>
          ) : null}
          {card.comment_count ? (
            <span
              className="flex items-center gap-0.5"
              title={t("boards.cardBadges.comments", { count: card.comment_count })}
            >
              <MessageSquare className="h-3 w-3" />
              {card.comment_count}
            </span>
          ) : null}
          <span
            className="flex items-center gap-1"
            title={`${t("tasks.status")}: ${statusLabel(t, card.status)}`}
          >
            <span
              className={cn("h-1.5 w-1.5 shrink-0 rounded-full", STATUS_DOT_COLORS[card.status])}
              aria-hidden="true"
            />
            <span className="sr-only">{statusLabel(t, card.status)}</span>
          </span>
          <span className="ml-auto flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground/80">
              {card.task_number}
            </span>
            {assignee ? (
              <span
                className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground"
                title={assignee}
              >
                {initials(card.assignee_name, card.assignee_email)}
              </span>
            ) : null}
          </span>
        </div>

        {columnColor ? (
          <span
            className="absolute bottom-0 left-0 top-0 w-1 rounded-l-md"
            style={{ backgroundColor: columnColor }}
            aria-hidden="true"
          />
        ) : null}

        {hasQuickActions ? (
          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  "absolute right-1.5 top-1.5 rounded p-1 text-muted-foreground opacity-0 transition hover:bg-muted hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100",
                  menuOpen && "opacity-100"
                )}
                aria-label={t("boards.quick.menu")}
                onClick={(event) => event.stopPropagation()}
                onPointerDown={(event) => event.stopPropagation()}
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="w-56"
              onClick={(event) => event.stopPropagation()}
            >
              <DropdownMenuItem onSelect={() => onOpen(card)}>
                <ExternalLink className="mr-2 h-4 w-4" />
                {t("boards.quick.open")}
              </DropdownMenuItem>
              {canEdit ? (
                <>
                  <DropdownMenuItem onSelect={() => setEditingTitle(true)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    {t("boards.quick.editTitle")}
                  </DropdownMenuItem>
                  {card.assigned_to === currentUserId ? (
                    <DropdownMenuItem
                      onSelect={() => void actions.patchCard(card, { assigned_to: null })}
                    >
                      <X className="mr-2 h-4 w-4" />
                      {t("boards.quick.letGo")}
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      onSelect={() => void actions.patchCard(card, { assigned_to: currentUserId })}
                    >
                      <Hand className="mr-2 h-4 w-4" />
                      {t("boards.task.takeIt")}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <Flag className="mr-2 h-4 w-4" />
                      {t("tasks.priority")}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      {KANBAN_TASK_PRIORITIES.map((priority) => (
                        <DropdownMenuItem
                          key={priority}
                          onSelect={() =>
                            priority !== card.priority && void actions.patchCard(card, { priority })
                          }
                        >
                          <Flag
                            className={cn(
                              "mr-2 h-3.5 w-3.5 fill-current",
                              PRIORITY_FLAG_COLORS[priority]
                            )}
                          />
                          {priorityLabel(t, priority)}
                          {priority === card.priority ? (
                            <Check className="ml-auto h-3.5 w-3.5" />
                          ) : null}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  {columns.length > 1 || card.is_inbox ? (
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <ArrowRightLeft className="mr-2 h-4 w-4" />
                        {t("boards.quick.moveTo")}
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="max-h-72 overflow-y-auto">
                        {columns
                          .filter((column) => column.id !== card.column_id || card.is_inbox)
                          .map((column) => (
                            <DropdownMenuItem
                              key={column.id}
                              onSelect={() =>
                                actions.moveCardTo(card.id, {
                                  columnId: column.id,
                                  index: 100000,
                                })
                              }
                            >
                              <span
                                className="mr-2 h-2.5 w-2.5 rounded-full"
                                style={{ backgroundColor: column.color ?? "#64748b" }}
                              />
                              {column.title}
                            </DropdownMenuItem>
                          ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  ) : null}
                  {!card.is_inbox && card.created_by === currentUserId ? (
                    <DropdownMenuItem
                      onSelect={() => actions.moveCardTo(card.id, { columnId: null, index: 0 })}
                    >
                      <Inbox className="mr-2 h-4 w-4" />
                      {t("boards.quick.toInbox")}
                    </DropdownMenuItem>
                  ) : null}
                </>
              ) : null}
              {onCopy ? (
                <DropdownMenuItem onSelect={() => onCopy(card)}>
                  <Copy className="mr-2 h-4 w-4" />
                  {t("boardExtras.card.menu")}
                </DropdownMenuItem>
              ) : null}
              {canArchive ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={() => void actions.archiveCard(card)}
                  >
                    <Archive className="mr-2 h-4 w-4" />
                    {t("boards.archiveCard")}
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </KanbanCard>
  );
});

/** The title edited on the card: Enter saves, Esc or leaving cancels nothing typed. */
function QuickTitle({
  card,
  onDone,
}: {
  card: KanbanBoardCard;
  onDone: (title: string | null) => void;
}) {
  const t = useTranslations("modules.planning");
  const [value, setValue] = useState(card.title);
  return (
    <Textarea
      autoFocus
      value={value}
      rows={2}
      aria-label={t("boards.cardTitle")}
      className="min-h-0 resize-none text-sm"
      // The card is draggable: typing and selecting must not start a drag.
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onChange={(event) => setValue(event.target.value.replace(/\n/g, " "))}
      onFocus={(event) => event.currentTarget.select()}
      onBlur={() => onDone(value.trim() || null)}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Enter") {
          event.preventDefault();
          onDone(value.trim() || null);
        }
        if (event.key === "Escape") {
          event.preventDefault();
          onDone(null);
        }
      }}
    />
  );
}
