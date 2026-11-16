"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useFormatter, useTranslations } from "next-intl";
import { Activity, Archive, Calendar, ExternalLink, Hand, Loader2, Save, User } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CommentsThread } from "@/components/features/comments";
import { RichTextEditorField } from "@/components/primitives/rich-text/rich-text-editor-field";
import { RichTextRenderer } from "@/components/primitives/rich-text/rich-text-renderer";
import type { RichTextValue } from "@/components/primitives/rich-text/rich-text-types";
import {
  createEmptyRichText,
  extractPlainText,
  normalizeRichText,
} from "@/components/primitives/rich-text/rich-text-utils";
import type {
  KanbanBoardCard,
  KanbanBoardColumn,
  KanbanCardActivity,
  KanbanTaskStatus,
} from "@/lib/types/kanban";
import { KANBAN_TASK_STATUSES } from "@/lib/validations/kanban";
import { cn } from "@/utils";
import { useBoardSharing } from "./board-sharing";
import {
  LABEL_COLORS,
  activityLabel,
  fromDateInput,
  statusLabel,
  toDateInput,
} from "./board-format";
import { boardKeys, cardActivityQuery } from "./boards-query";
import type { BoardActions } from "./use-board-actions";

interface CardDetailDialogProps {
  orgId: string;
  card: KanbanBoardCard | null;
  columns: KanbanBoardColumn[];
  canUpdate: boolean;
  canDelete: boolean;
  actions: BoardActions;
  onClose: () => void;
}

export function CardDetailDialog({
  orgId,
  card,
  columns,
  canUpdate,
  canDelete,
  actions,
  onClose,
}: CardDetailDialogProps) {
  return (
    <Dialog open={Boolean(card)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[88vh] max-w-5xl flex-col overflow-hidden p-0">
        {card ? (
          // Keyed by the card: the form starts from the card when another one
          // opens, and a refetch of the board never overwrites what is typed.
          <CardDetailForm
            key={card.id}
            orgId={orgId}
            card={card}
            columns={columns}
            canUpdate={canUpdate}
            canDelete={canDelete}
            actions={actions}
            onClose={onClose}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function CardDetailForm({
  orgId,
  card,
  columns,
  canUpdate,
  canDelete,
  actions,
  onClose,
}: CardDetailDialogProps & { card: KanbanBoardCard }) {
  const t = useTranslations("modules.planning");
  const format = useFormatter();
  const queryClient = useQueryClient();
  const { people, currentUserId, canAssign } = useBoardSharing();
  const [title, setTitle] = useState(card.title);
  const [descriptionRich, setDescriptionRich] = useState<RichTextValue>(
    () => normalizeRichText(card.description_rich) ?? createEmptyRichText()
  );
  const [columnId, setColumnId] = useState(card.is_inbox ? "" : card.column_id);
  const [dueAt, setDueAt] = useState(toDateInput(card.due_at));
  const [label, setLabel] = useState(card.label ?? "");
  const [labelColor, setLabelColor] = useState(card.label_color ?? LABEL_COLORS[0]);
  const [status, setStatus] = useState<KanbanTaskStatus>(card.status);
  const [assignedTo, setAssignedTo] = useState<string | null>(card.assigned_to);
  const [isPending, setIsPending] = useState(false);
  const activity = useQuery(cardActivityQuery(orgId, card.id));

  const formatDateTime = (value: string | null) =>
    value ? format.dateTime(new Date(value), { dateStyle: "medium", timeStyle: "short" }) : "—";

  const save = async (overrides?: { assigned_to?: string | null }) => {
    const nextAssignee =
      overrides && "assigned_to" in overrides ? (overrides.assigned_to ?? null) : assignedTo;
    setIsPending(true);
    const saved = await actions.updateCard({
      id: card.id,
      board_id: card.is_inbox ? null : card.board_id,
      column_id: card.is_inbox ? undefined : columnId,
      title,
      description: extractPlainText(descriptionRich).trim(),
      description_rich: descriptionRich,
      due_at: fromDateInput(dueAt),
      label,
      label_color: label ? labelColor : null,
      status,
      assigned_to: nextAssignee,
    });
    setIsPending(false);
    if (saved) {
      setAssignedTo(saved.assigned_to);
      setStatus(saved.status);
      if (!saved.is_inbox) setColumnId(saved.column_id);
    }
  };

  const archive = async () => {
    setIsPending(true);
    const archived = await actions.archiveCard(card);
    setIsPending(false);
    if (archived) onClose();
  };

  // Whom the assignee select offers: everyone for a user who can assign,
  // otherwise only "nobody", themselves and whoever has it now.
  const assigneeOptions = useMemo(
    () =>
      canAssign
        ? people
        : people.filter(
            (person) => person.user_id === currentUserId || person.user_id === card.assigned_to
          ),
    [canAssign, card.assigned_to, currentUserId, people]
  );
  const canTakeIt = canUpdate && card.assigned_to !== currentUserId;

  return (
    <>
      <DialogHeader>
        <div className="border-b px-5 py-4">
          <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-mono">{card.task_number}</span>
            <span>•</span>
            <span>
              {card.is_inbox
                ? t("boards.inbox.title")
                : columns.find((column) => column.id === card.column_id)?.title}
            </span>
          </div>
          <DialogTitle asChild>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              disabled={!canUpdate || isPending}
              aria-label={t("boards.cardTitle")}
              className="h-auto border-0 bg-transparent px-0 text-xl font-semibold shadow-none focus-visible:ring-0"
            />
          </DialogTitle>
        </div>
      </DialogHeader>

      <div className="grid min-h-0 flex-1 overflow-hidden lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-h-0 overflow-y-auto px-5 py-4">
          <div className="space-y-5">
            <section className="space-y-2">
              <Label>{t("boards.cardDescription")}</Label>
              {canUpdate ? (
                <RichTextEditorField
                  value={descriptionRich}
                  onChange={setDescriptionRich}
                  placeholder={t("boards.cardDescriptionPlaceholder")}
                  disabled={isPending}
                  mode="full"
                  maxLength={4000}
                  contentClassName="min-h-[180px] [&_.ProseMirror]:min-h-[160px]"
                />
              ) : (
                <RichTextRenderer
                  value={normalizeRichText(card.description_rich) ?? undefined}
                  emptyText={card.description ?? t("boards.noDescription")}
                />
              )}
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
              onCommentAdded={() =>
                queryClient.invalidateQueries({ queryKey: boardKeys.activity(orgId, card.id) })
              }
            />

            <Separator />

            <section>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("boards.activity")}
              </p>
              {activity.isPending ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("boards.loading")}
                </div>
              ) : (
                <CardActivityList activity={activity.data ?? []} formatDateTime={formatDateTime} />
              )}
            </section>
          </div>
        </div>

        <aside className="min-h-0 overflow-y-auto border-t bg-muted/10 p-4 lg:border-l lg:border-t-0">
          <div className="space-y-4">
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
            <div className="space-y-2">
              <Label>{t("boards.task.status")}</Label>
              <Select
                value={status}
                onValueChange={(value) => setStatus(value as KanbanTaskStatus)}
                disabled={!canUpdate}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KANBAN_TASK_STATUSES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {statusLabel(t, item)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("boards.task.assignee")}</Label>
              <Select
                value={assignedTo ?? "__unassigned__"}
                onValueChange={(value) => setAssignedTo(value === "__unassigned__" ? null : value)}
                disabled={!canUpdate}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__unassigned__">{t("boards.task.unassigned")}</SelectItem>
                  {assigneeOptions.map((person) => (
                    <SelectItem key={person.user_id} value={person.user_id}>
                      {person.name || person.email || person.user_id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {canTakeIt ? (
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full gap-1.5"
                  disabled={isPending}
                  onClick={() => void save({ assigned_to: currentUserId })}
                >
                  <Hand className="h-3.5 w-3.5" />
                  {t("boards.task.takeIt")}
                </Button>
              ) : null}
            </div>
            {!card.is_inbox ? (
              <div className="space-y-2">
                <Label>{t("boards.column")}</Label>
                <Select value={columnId} onValueChange={setColumnId} disabled={!canUpdate}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {columns.map((column) => (
                      <SelectItem key={column.id} value={column.id}>
                        {column.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="kanban-card-due">{t("boards.dueDate")}</Label>
              <Input
                id="kanban-card-due"
                type="date"
                value={dueAt}
                disabled={!canUpdate}
                onChange={(event) => setDueAt(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="kanban-card-label">{t("boards.label")}</Label>
              <Input
                id="kanban-card-label"
                value={label}
                disabled={!canUpdate}
                onChange={(event) => setLabel(event.target.value)}
              />
              <div className="flex flex-wrap gap-1">
                {LABEL_COLORS.map((candidate) => (
                  <button
                    key={candidate}
                    type="button"
                    disabled={!canUpdate}
                    className={cn(
                      "h-6 w-6 rounded-full border border-border",
                      labelColor === candidate &&
                        "ring-2 ring-ring ring-offset-2 ring-offset-background"
                    )}
                    style={{ backgroundColor: candidate }}
                    onClick={() => setLabelColor(candidate)}
                    aria-label={candidate}
                  />
                ))}
              </div>
            </div>

            <Separator />

            <div className="space-y-3 rounded-lg border bg-background p-3">
              <div className="flex items-start gap-2">
                <User className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-[10px] uppercase text-muted-foreground">
                    {t("boards.createdBy")}
                  </p>
                  <p className="truncate text-xs">
                    {card.creator_name ?? card.creator_email ?? t("boards.unknown")}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Calendar className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-[10px] uppercase text-muted-foreground">
                    {t("boards.created")}
                  </p>
                  <p className="text-xs">{formatDateTime(card.created_at)}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Calendar className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-[10px] uppercase text-muted-foreground">
                    {t("boards.updated")}
                  </p>
                  <p className="text-xs">{formatDateTime(card.updated_at)}</p>
                </div>
              </div>
            </div>

            <div className="flex gap-2 lg:flex-col">
              {canUpdate ? (
                <Button
                  className="flex-1 gap-1.5"
                  onClick={() => void save()}
                  disabled={!title.trim() || (!card.is_inbox && !columnId) || isPending}
                >
                  {isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {t("boards.save")}
                </Button>
              ) : null}
              {canDelete ? (
                <Button
                  variant="outline"
                  className="flex-1 gap-1.5 text-destructive hover:text-destructive"
                  onClick={() => void archive()}
                  disabled={isPending}
                >
                  <Archive className="h-4 w-4" />
                  {t("boards.archiveCard")}
                </Button>
              ) : null}
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}

function CardActivityList({
  activity,
  formatDateTime,
}: {
  activity: KanbanCardActivity[];
  formatDateTime: (value: string | null) => string;
}) {
  const t = useTranslations("modules.planning");

  if (activity.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <Activity className="h-5 w-5 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">{t("boards.noActivity")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {[...activity].reverse().map((item) => (
        <div key={item.id} className="flex gap-2.5">
          <span className="mt-0.5 shrink-0 text-sm">•</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm">{activityLabel(t, item.activity_type, item.message)}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {item.actor_name ?? item.actor_email ?? t("boards.systemActor")} ·{" "}
              {formatDateTime(item.created_at)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
