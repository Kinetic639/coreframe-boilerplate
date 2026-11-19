"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Inbox, Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { KanbanBoardCard, KanbanTaskEditorData } from "@/lib/types/kanban";
import { cn } from "@/utils";
import { useCopyTargetBoards, useCopyTargetColumns } from "./copy-card-dialog";
import { columnName } from "./task-labels";

const INBOX = "__inbox__";

export interface PlacementTarget {
  /** Both null: the author's inbox. */
  board_id: string | null;
  column_id: string | null;
}

/**
 * Where the task is, editable: its board (or the author's inbox) and column.
 * Picking another board asks for its column first; the move happens then.
 * Only boards the user can add cards to are offered.
 */
export function PlacementFields({
  orgId,
  card,
  board,
  columns,
  canUseInbox,
  pending,
  onMove,
}: {
  orgId: string;
  card: KanbanBoardCard;
  board: KanbanTaskEditorData["board"];
  columns: KanbanTaskEditorData["columns"];
  /** Only the task's author may put it in their inbox. */
  canUseInbox: boolean;
  pending: boolean;
  onMove: (target: PlacementTarget) => void;
}) {
  const t = useTranslations("modules.planning");
  const currentBoardId = card.is_inbox ? INBOX : card.board_id || board?.id || "";
  // A board picked here, waiting for its column.
  const [pickedBoardId, setPickedBoardId] = useState<string | null>(null);
  const boardId = pickedBoardId ?? currentBoardId;
  const onRealBoard = boardId !== "" && boardId !== INBOX;

  // The other boards are only needed once the list is opened.
  const [listOpened, setListOpened] = useState(false);
  const boards = useCopyTargetBoards(orgId, listOpened);
  const otherColumns = useCopyTargetColumns(
    orgId,
    onRealBoard && boardId !== board?.id ? boardId : null,
    true
  );
  const boardColumns = (boardId === board?.id ? columns : (otherColumns.data ?? [])).filter(
    (column) => !column.archived_at
  );

  const options = boards.data ?? [];
  // The task's own board stays in the list even where the user only views it.
  const boardOptions =
    board && !options.some((item) => item.id === board.id)
      ? [{ id: board.id, title: board.title }, ...options]
      : options;

  const columnValue = pickedBoardId ? "" : card.column_id || "";
  const waitingForColumn = Boolean(pickedBoardId && onRealBoard);

  return (
    <div className="space-y-2 py-1.5">
      <div className="grid gap-1">
        <span className="text-xs text-muted-foreground">{t("taskEditor.board")}</span>
        <Select
          value={boardId || undefined}
          disabled={pending}
          onOpenChange={(open) => {
            if (open) setListOpened(true);
          }}
          onValueChange={(value) => {
            if (value === currentBoardId) {
              setPickedBoardId(null);
              return;
            }
            if (value === INBOX) {
              setPickedBoardId(null);
              onMove({ board_id: null, column_id: null });
              return;
            }
            setPickedBoardId(value);
          }}
        >
          <SelectTrigger className="h-8 text-sm" aria-label={t("taskEditor.board")}>
            <SelectValue placeholder={t("taskEditor.noBoard")} />
          </SelectTrigger>
          <SelectContent>
            {canUseInbox || card.is_inbox ? (
              <>
                <SelectItem value={INBOX}>
                  <span className="flex items-center gap-2">
                    <Inbox className="h-3.5 w-3.5 text-muted-foreground" />
                    {t("boards.inbox.title")}
                  </span>
                </SelectItem>
                {boardOptions.length ? <SelectSeparator /> : null}
              </>
            ) : null}
            {boards.isPending && listOpened ? (
              <div className="flex items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {t("tasks.placement.loading")}
              </div>
            ) : boardOptions.length ? (
              boardOptions.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.title}
                </SelectItem>
              ))
            ) : (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">
                {t("tasks.placement.noBoards")}
              </div>
            )}
          </SelectContent>
        </Select>
      </div>

      {onRealBoard ? (
        <div className="grid gap-1">
          <span className="text-xs text-muted-foreground">{t("taskEditor.column")}</span>
          <Select
            value={columnValue || undefined}
            disabled={pending || (boardId !== board?.id && otherColumns.isPending)}
            onValueChange={(value) => {
              if (!pickedBoardId && value === card.column_id) return;
              onMove({ board_id: boardId, column_id: value });
              setPickedBoardId(null);
            }}
          >
            <SelectTrigger
              className={cn(
                "h-8 text-sm",
                waitingForColumn && "border-primary ring-1 ring-primary"
              )}
              aria-label={t("taskEditor.column")}
            >
              <SelectValue
                placeholder={
                  boardId !== board?.id && otherColumns.isPending
                    ? t("tasks.placement.loading")
                    : t("taskEditor.chooseColumn")
                }
              />
            </SelectTrigger>
            <SelectContent>
              {boardColumns.map((column) => (
                <SelectItem key={column.id} value={column.id}>
                  <span className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: column.color ?? "#64748b" }}
                      aria-hidden="true"
                    />
                    {columnName(t, column)}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {waitingForColumn ? (
            <p className="text-xs text-muted-foreground">{t("taskEditor.chooseColumnHint")}</p>
          ) : null}
        </div>
      ) : null}

      {pending ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          {t("taskEditor.moving")}
        </p>
      ) : null}
    </div>
  );
}
