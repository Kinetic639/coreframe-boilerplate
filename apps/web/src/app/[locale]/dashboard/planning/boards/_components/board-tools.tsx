"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFormatter, useTranslations } from "next-intl";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "react-toastify";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  createKanbanBoardLabelAction,
  deleteKanbanBoardLabelAction,
  listKanbanBoardActivityAction,
  updateKanbanBoardLabelAction,
} from "@/app/actions/kanban";
import type { KanbanBoardDetail, KanbanBoardLabel } from "@/lib/types/kanban";
import { activityLabel } from "@/components/planning/task-editor/task-labels";
import { LABEL_COLORS } from "@/components/planning/task-editor/task-labels";
import { cn } from "@/utils";
import { MemberAvatar } from "@/components/planning/member-avatar";
import { boardKeys, unwrap } from "./boards-query";
import type { BoardViewer } from "./use-board-realtime";

/** Who else has the board open right now. */
export function BoardViewers({ viewers }: { viewers: BoardViewer[] }) {
  const t = useTranslations("modules.planning");
  if (!viewers.length) return null;
  const shown = viewers.slice(0, 3);
  const names = viewers.map((viewer) => viewer.name || "?").join(", ");
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className="flex items-center gap-1.5 rounded-full border bg-background/70 py-0.5 pl-1 pr-2"
          aria-label={t("boardTools.viewingNow", { names })}
        >
          <div className="flex -space-x-1.5">
            {shown.map((viewer) => (
              <MemberAvatar
                key={viewer.user_id}
                userId={viewer.user_id}
                name={viewer.name}
                disabledPopover
                className="h-6 w-6 border-2 border-background"
              />
            ))}
          </div>
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
          {viewers.length > shown.length ? (
            <span className="text-[11px] text-muted-foreground">
              +{viewers.length - shown.length}
            </span>
          ) : null}
        </div>
      </TooltipTrigger>
      <TooltipContent>{t("boardTools.viewingNow", { names })}</TooltipContent>
    </Tooltip>
  );
}

/** The board's labels: rename, recolour, remove, add. */
export function BoardLabelsDialog({
  orgId,
  board,
  open,
  onOpenChange,
  canEdit,
}: {
  orgId: string;
  board: KanbanBoardDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canEdit: boolean;
}) {
  const t = useTranslations("modules.planning");
  const queryClient = useQueryClient();
  const key = boardKeys.board(orgId, board.id);
  const [name, setName] = useState("");
  const [color, setColor] = useState(LABEL_COLORS[5]);
  const labels = board.labels ?? [];

  const write = (update: (labels: KanbanBoardLabel[]) => KanbanBoardLabel[]) =>
    queryClient.setQueryData<KanbanBoardDetail>(key, (current) => {
      if (!current) return current;
      const nextLabels = update(current.labels ?? []);
      const byId = new Map(nextLabels.map((label) => [label.id, label]));
      return {
        ...current,
        labels: nextLabels,
        // Cards show the new name and colour (and lose a removed label) at once.
        cards: current.cards.map((card) => ({
          ...card,
          labels: (card.labels ?? [])
            .filter((label) => byId.has(label.id))
            .map((label) => byId.get(label.id)!),
        })),
      };
    });
  const fail = (error: unknown) => {
    toast.error(error instanceof Error ? error.message : "Operation failed");
    void queryClient.invalidateQueries({ queryKey: key });
  };

  const create = useMutation({
    mutationFn: () =>
      unwrap(createKanbanBoardLabelAction({ board_id: board.id, name: name.trim(), color })),
    onSuccess: (label) => {
      write((current) => [...current, label]);
      setName("");
    },
    onError: fail,
  });
  const update = useMutation({
    mutationFn: (label: KanbanBoardLabel) =>
      unwrap(
        updateKanbanBoardLabelAction({
          board_id: board.id,
          id: label.id,
          name: label.name,
          color: label.color,
        })
      ),
    onMutate: (label) =>
      write((current) => current.map((item) => (item.id === label.id ? label : item))),
    onError: fail,
  });
  const remove = useMutation({
    mutationFn: (id: string) => unwrap(deleteKanbanBoardLabelAction({ board_id: board.id, id })),
    onMutate: (id) => write((current) => current.filter((item) => item.id !== id)),
    onError: fail,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("boardTools.labelsTitle")}</DialogTitle>
          <DialogDescription>{t("boardTools.labelsDescription")}</DialogDescription>
        </DialogHeader>
        <div className="max-h-[50vh] space-y-2 overflow-y-auto">
          {labels.length ? (
            labels.map((label) => (
              <LabelRow
                key={label.id}
                label={label}
                disabled={!canEdit}
                onSave={(next) => update.mutate(next)}
                onDelete={() => remove.mutate(label.id)}
              />
            ))
          ) : (
            <p className="text-sm text-muted-foreground">{t("taskEditor.noBoardLabels")}</p>
          )}
        </div>
        {canEdit ? (
          <>
            <Separator />
            <form
              className="space-y-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (!create.isPending) create.mutate();
              }}
            >
              <div className="flex gap-2">
                <Input
                  value={name}
                  maxLength={60}
                  onChange={(event) => setName(event.target.value)}
                  placeholder={t("taskEditor.labelPlaceholder")}
                  aria-label={t("taskEditor.labelPlaceholder")}
                  className="h-8"
                />
                <Button type="submit" size="sm" className="gap-1.5" disabled={create.isPending}>
                  {create.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                  {t("boardTools.addLabel")}
                </Button>
              </div>
              <ColorRow value={color} onChange={setColor} />
            </form>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ColorRow({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  const t = useTranslations("modules.planning");
  return (
    <div className="grid grid-cols-10 gap-1">
      {LABEL_COLORS.map((candidate) => (
        <button
          key={candidate}
          type="button"
          className={cn(
            "h-6 rounded",
            value === candidate && "ring-2 ring-ring ring-offset-1 ring-offset-background"
          )}
          style={{ backgroundColor: candidate }}
          onClick={() => onChange(candidate)}
          aria-label={t("taskEditor.labelColor", { color: candidate })}
          aria-pressed={value === candidate}
        />
      ))}
    </div>
  );
}

function LabelRow({
  label,
  disabled,
  onSave,
  onDelete,
}: {
  label: KanbanBoardLabel;
  disabled: boolean;
  onSave: (label: KanbanBoardLabel) => void;
  onDelete: () => void;
}) {
  const t = useTranslations("modules.planning");
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(label.name);
  const [color, setColor] = useState(label.color);

  if (editing) {
    return (
      <form
        className="space-y-2 rounded-md border p-2"
        onSubmit={(event) => {
          event.preventDefault();
          onSave({ ...label, name: name.trim(), color });
          setEditing(false);
        }}
      >
        <Input
          autoFocus
          value={name}
          maxLength={60}
          onChange={(event) => setName(event.target.value)}
          aria-label={t("taskEditor.labelPlaceholder")}
          className="h-8"
        />
        <ColorRow value={color} onChange={setColor} />
        <div className="flex gap-2">
          <Button type="submit" size="sm">
            {t("boards.save")}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
            {t("taskEditor.close")}
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setName(label.name);
          setColor(label.color);
          setEditing(true);
        }}
        className="h-8 flex-1 truncate rounded-md px-2 text-left text-sm font-semibold text-white disabled:cursor-default"
        style={{ backgroundColor: label.color }}
      >
        {label.name || " "}
      </button>
      {!disabled ? (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onDelete}
          aria-label={t("boardTools.deleteLabel", { name: label.name })}
          title={t("boardTools.deleteLabel", { name: label.name })}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      ) : null}
    </div>
  );
}

/** Everything that happened on the board's cards, newest first. */
export function BoardActivitySheet({
  orgId,
  boardId,
  open,
  onOpenChange,
  onOpenCard,
}: {
  orgId: string;
  boardId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenCard: (taskNumber: string) => void;
}) {
  const t = useTranslations("modules.planning");
  const format = useFormatter();
  const activity = useQuery({
    queryKey: [...boardKeys.board(orgId, boardId), "activity"],
    queryFn: () => unwrap(listKanbanBoardActivityAction(boardId)),
    enabled: open,
    staleTime: 0,
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{t("boardTools.activityTitle")}</SheetTitle>
          <SheetDescription>{t("boardTools.activityDescription")}</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          {activity.isPending ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("boards.loading")}
            </div>
          ) : activity.isError ? (
            <p className="text-sm text-destructive">{activity.error.message}</p>
          ) : !activity.data.length ? (
            <p className="text-sm text-muted-foreground">{t("boards.noActivity")}</p>
          ) : (
            <ol className="space-y-1">
              {activity.data.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className="flex w-full gap-2.5 rounded-md p-2 text-left hover:bg-muted"
                    onClick={() => {
                      onOpenChange(false);
                      onOpenCard(item.task_number);
                    }}
                  >
                    <MemberAvatar
                      userId={item.actor_id}
                      name={item.actor_name}
                      email={item.actor_email}
                      disabledPopover
                      className="h-7 w-7 shrink-0"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm">
                        <span className="font-medium">
                          {item.actor_name ?? item.actor_email ?? t("boards.systemActor")}
                        </span>{" "}
                        {activityLabel(t, item.activity_type, item.message).toLowerCase()}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        <span className="font-mono">{item.task_number}</span> · {item.task_title}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {format.relativeTime(new Date(item.created_at))}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export const BOARD_SHORTCUTS: Array<{ keys: string[]; label: string }> = [
  { keys: ["/", "F"], label: "search" },
  { keys: ["Q"], label: "onlyMine" },
  { keys: ["I"], label: "inbox" },
  { keys: ["Esc"], label: "clear" },
  { keys: ["Enter"], label: "open" },
  { keys: ["E"], label: "menu" },
  { keys: ["Space"], label: "take" },
  { keys: ["C"], label: "archive" },
  { keys: ["?"], label: "help" },
];

export function BoardShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("modules.planning");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("boardTools.shortcutsTitle")}</DialogTitle>
          <DialogDescription>{t("boardTools.shortcutsDescription")}</DialogDescription>
        </DialogHeader>
        <dl className="space-y-2 text-sm">
          {BOARD_SHORTCUTS.map((shortcut) => (
            <div key={shortcut.label} className="flex items-center justify-between gap-4">
              <dt>{t(`boardTools.shortcuts.${shortcut.label}`)}</dt>
              <dd className="flex gap-1">
                {shortcut.keys.map((key) => (
                  <kbd
                    key={key}
                    className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[11px]"
                  >
                    {key}
                  </kbd>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
}
