"use client";

import { useCallback, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Archive, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { KanbanBoard, type KanbanCardMoveParams } from "@/components/primitives/kanban";
import { PageLoader } from "@/components/page-loader";
import type { KanbanBoardCard, KanbanBoardDetail } from "@/lib/types/kanban";
import { BoardArchiveDialog } from "./board-archive-dialog";
import { BoardCard } from "./board-card";
import { AddCardForm, AddColumnPanel, ColumnMenu } from "./board-columns";
import { INBOX_COLUMN_ID } from "./board-format";
import { BoardSettingsDialog } from "./board-settings-dialog";
import { BoardVisibilityIcon } from "./board-sharing";
import { CardDetailDialog } from "./card-detail-dialog";
import { useBoardActions } from "./use-board-actions";
import type { BoardsAdmin } from "./use-boards-admin";

interface BoardWorkspaceProps {
  orgId: string;
  boardId: string | null;
  board: KanbanBoardDetail | undefined;
  boardLoading: boolean;
  inboxOpen: boolean;
  inboxCards: KanbanBoardCard[];
  inboxLoading: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  collapsedColumnIds: string[];
  onColumnCollapsedChange: (columnId: string, collapsed: boolean) => void;
  /** The open card's task number (from the address), or null. */
  openCardNumber: string | null;
  onOpenCardChange: (taskNumber: string | null) => void;
  admin: BoardsAdmin;
  onBoardArchived: (boardId: string) => void;
}

const getCardId = (card: KanbanBoardCard) => card.id;
const getCardColumnId = (card: KanbanBoardCard) =>
  card.is_inbox ? INBOX_COLUMN_ID : card.column_id;

export function BoardWorkspace({
  orgId,
  boardId,
  board,
  boardLoading,
  inboxOpen,
  inboxCards,
  inboxLoading,
  canUpdate: canUpdatePermission,
  canDelete: canDeletePermission,
  collapsedColumnIds,
  onColumnCollapsedChange,
  openCardNumber,
  onOpenCardChange,
  admin,
  onBoardArchived,
}: BoardWorkspaceProps) {
  const t = useTranslations("modules.planning");
  const actions = useBoardActions(orgId, board?.id ?? null);
  const [archiveOpen, setArchiveOpen] = useState(false);

  const isArchived = Boolean(board?.archived_at);
  // A viewer only looks; the database refuses their writes anyway. An archived
  // board is read-only until it is restored.
  const isViewer = board?.my_access === "viewer";
  const canUpdate = canUpdatePermission && !isViewer && !isArchived;
  const canDelete = canDeletePermission && !isViewer && !isArchived;
  const canManageBoard =
    canUpdatePermission && (board?.my_access === "owner" || (canDeletePermission && !isViewer));
  const showBoard = Boolean(board) && !boardLoading;

  const columnColors = useMemo(
    () => new Map(board?.columns.map((column) => [column.id, column.color]) ?? []),
    [board?.columns]
  );

  const columns = useMemo(() => {
    const boardColumns =
      board && showBoard
        ? board.columns.map((column) => ({
            id: column.id,
            title: column.title,
            description: column.description,
            color: column.color,
          }))
        : [];
    if (!inboxOpen) return boardColumns;
    return [
      {
        id: INBOX_COLUMN_ID,
        title: t("boards.inbox.title"),
        description: t("boards.inbox.description"),
        color: null,
      },
      ...boardColumns,
    ];
  }, [board, inboxOpen, showBoard, t]);

  const items = useMemo(
    () => [
      ...(inboxOpen && !inboxLoading ? inboxCards : []),
      ...(board && showBoard ? board.cards : []),
    ],
    [board, inboxCards, inboxLoading, inboxOpen, showBoard]
  );

  const openCard = useMemo(() => {
    if (!openCardNumber) return null;
    return (
      board?.cards.find((card) => card.task_number === openCardNumber) ??
      inboxCards.find((card) => card.task_number === openCardNumber) ??
      null
    );
  }, [board?.cards, inboxCards, openCardNumber]);

  const handleOpenCard = useCallback(
    (card: KanbanBoardCard) => onOpenCardChange(card.task_number),
    [onOpenCardChange]
  );

  const { moveCardTo, setColumnsOrder } = actions;

  const handleCardMove = useCallback(
    ({ itemId, toColumnId, newIndex }: KanbanCardMoveParams) => {
      moveCardTo(itemId, {
        columnId: toColumnId === INBOX_COLUMN_ID ? null : toColumnId,
        index: newIndex,
      });
    },
    [moveCardTo]
  );

  const handleColumnsChange = useCallback(
    (next: Array<{ id: string }>) =>
      setColumnsOrder(
        next.filter((column) => column.id !== INBOX_COLUMN_ID).map((column) => column.id)
      ),
    [setColumnsOrder]
  );

  const handleCollapsedChange = useCallback(
    (columnId: string, collapsed: boolean) => {
      if (columnId === INBOX_COLUMN_ID) return;
      onColumnCollapsedChange(columnId, collapsed);
    },
    [onColumnCollapsedChange]
  );

  return (
    <div className="h-full min-h-0 overflow-hidden">
      <KanbanBoard
        columns={columns}
        items={items}
        getItemId={getCardId}
        getItemColumnId={getCardColumnId}
        disabled={!canUpdate || !showBoard}
        labels={{
          emptyColumn: t("boards.emptyColumn"),
          dragColumn: t("boards.dragColumn"),
          collapseColumn: t("boards.collapseColumn"),
          expandColumn: t("boards.expandColumn"),
        }}
        scrollAreaClassName="m-3 ml-3 overflow-hidden rounded-lg border bg-muted/10"
        className="flex-1 gap-3 p-3 pb-3"
        columnClassName="min-h-0 rounded-md"
        fixedStartColumnIds={inboxOpen ? [INBOX_COLUMN_ID] : []}
        fixedStartClassName="m-3 mr-0 w-[18rem] overflow-hidden rounded-lg border bg-muted/10 shadow-sm"
        fixedColumnClassName="w-full rounded-none border-0 bg-transparent"
        nonDraggableColumnIds={[INBOX_COLUMN_ID]}
        renderScrollableHeader={
          board && showBoard
            ? () => (
                <div className="border-b bg-background/40">
                  {isArchived ? (
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-amber-500/10 px-5 py-2 text-sm">
                      <span className="flex items-center gap-2">
                        <Archive className="h-4 w-4" />
                        {t("boards.archive.bannerText")}
                      </span>
                      {canManageBoard ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7"
                          onClick={() => void admin.restoreBoard(board.id)}
                        >
                          <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                          {t("boards.archive.restore")}
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="flex items-start justify-between gap-3 px-5 py-4">
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2">
                        <h2 className="truncate text-xl font-semibold">{board.title}</h2>
                        <Badge variant="outline" className="shrink-0 gap-1.5 bg-background/60">
                          <BoardVisibilityIcon visibility={board.visibility} />
                          {t(`boards.visibility.${board.visibility}`)}
                        </Badge>
                      </div>
                      {board.description ? (
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                          {board.description}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            aria-label={t("boards.archive.title")}
                            onClick={() => setArchiveOpen(true)}
                          >
                            <Archive className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t("boards.archive.title")}</TooltipContent>
                      </Tooltip>
                      {!isArchived ? (
                        <BoardSettingsDialog
                          board={board}
                          canUpdate={canUpdate}
                          canArchive={canManageBoard}
                          admin={admin}
                          onArchived={onBoardArchived}
                        />
                      ) : null}
                    </div>
                  </div>
                </div>
              )
            : undefined
        }
        renderScrollableEmpty={
          !showBoard
            ? () =>
                boardId ? (
                  <PageLoader className="h-full min-h-0 flex-1" />
                ) : (
                  <div className="flex h-full flex-1 items-center justify-center p-8 text-center text-sm text-muted-foreground">
                    {t("boards.selectBoard")}
                  </div>
                )
            : undefined
        }
        collapsedColumnIds={collapsedColumnIds}
        onColumnCollapsedChange={handleCollapsedChange}
        onCardMove={handleCardMove}
        onColumnsChange={handleColumnsChange}
        renderColumnActions={(column) => {
          if (column.id === INBOX_COLUMN_ID || !board || !(canUpdate || canDelete)) return null;
          const full = board.columns.find((candidate) => candidate.id === column.id);
          return full ? (
            <ColumnMenu
              boardId={board.id}
              column={full}
              canUpdate={canUpdate}
              canDelete={canDelete}
              actions={actions}
            />
          ) : null;
        }}
        renderColumnFooter={(column) =>
          column.id === INBOX_COLUMN_ID || !board || !canUpdate ? null : (
            <AddCardForm columnId={column.id} actions={actions} />
          )
        }
        renderColumnEmpty={(column) =>
          column.id === INBOX_COLUMN_ID && inboxLoading ? <InboxLoadingSkeleton /> : null
        }
        renderAddColumn={
          canUpdate && board && showBoard
            ? () => <AddColumnPanel boardId={board.id} actions={actions} />
            : undefined
        }
        renderCard={(card) => (
          <BoardCard
            card={card}
            columnColor={card.is_inbox ? null : columnColors.get(card.column_id)}
            onOpen={handleOpenCard}
          />
        )}
      />

      <CardDetailDialog
        orgId={orgId}
        card={openCard}
        columns={board?.columns ?? []}
        canUpdate={openCard?.is_inbox ? canUpdatePermission : canUpdate}
        canDelete={openCard?.is_inbox ? canDeletePermission : canDelete}
        actions={actions}
        onClose={() => onOpenCardChange(null)}
      />

      {board ? (
        <BoardArchiveDialog
          orgId={orgId}
          boardId={board.id}
          open={archiveOpen}
          onOpenChange={setArchiveOpen}
          canRestore={canDelete}
          canDelete={canDelete}
          actions={actions}
        />
      ) : null}
    </div>
  );
}

function InboxLoadingSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="rounded-md border border-border bg-card p-3 shadow-xs">
          <div className="flex items-start justify-between gap-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-2 w-2 rounded-full" />
          </div>
          <Skeleton className="mt-3 h-3 w-24" />
          <Skeleton className="mt-4 h-3 w-full" />
          <Skeleton className="mt-2 h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}
