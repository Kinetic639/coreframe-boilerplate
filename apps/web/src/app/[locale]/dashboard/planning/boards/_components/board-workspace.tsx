"use client";

import { useCallback, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import { KanbanBoard, type KanbanCardMoveParams } from "@/components/primitives/kanban";
import { PageLoader } from "@/components/page-loader";
import { TaskEditorDialog } from "@/components/planning/task-editor";
import type { KanbanBoardCard, KanbanBoardDetail, KanbanTaskEditorData } from "@/lib/types/kanban";
import { cn } from "@/utils";
import { BoardArchiveDialog } from "./board-archive-dialog";
import { BoardCard } from "./board-card";
import { boardBackground } from "./board-colors";
import {
  AddCardButton,
  AddCardComposer,
  AddColumnPanel,
  ColumnMenu,
  ColumnTitle,
} from "./board-columns";
import { INBOX_COLUMN_ID } from "./board-format";
import { BoardHeader } from "./board-header";
import { useBoardSharing } from "./board-sharing";
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
  onOpenAllBoards: () => void;
}

const emptyColumns: KanbanBoardDetail["columns"] = [];
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
  onOpenAllBoards,
}: BoardWorkspaceProps) {
  const t = useTranslations("modules.planning");
  const actions = useBoardActions(orgId, board?.id ?? null);
  const { people, currentUserId, canAssign } = useBoardSharing();
  const [archiveOpen, setArchiveOpen] = useState(false);
  /** The column where a card is being added, and whether at its top. */
  const [composer, setComposer] = useState<{ columnId: string; atTop: boolean } | null>(null);

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

  // What the editor shows at once, before it loads the task itself.
  const editorInitialData = useMemo((): KanbanTaskEditorData | undefined => {
    if (!openCard) return undefined;
    if (openCard.is_inbox || !board) return { card: openCard, board: null, columns: [] };
    return {
      card: openCard,
      board: {
        id: board.id,
        title: board.title,
        color: board.color,
        archived_at: board.archived_at,
        my_access: board.my_access,
      },
      columns: board.columns,
    };
  }, [board, openCard]);

  const closeComposer = useCallback(() => setComposer(null), []);

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

  const background = showBoard ? boardBackground(board?.color) : undefined;

  return (
    <div className="h-full min-h-0 overflow-hidden" style={background ? { background } : undefined}>
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
        scrollAreaClassName={cn(
          "m-3 ml-3 overflow-hidden rounded-lg border",
          background ? "border-white/20 bg-black/10" : "bg-muted/10"
        )}
        className="flex-1 gap-3 p-3 pb-3"
        // On a coloured board the lists are nearly opaque cards over it.
        columnClassName={cn(
          "min-h-0 rounded-md",
          background && "border-transparent bg-background/90"
        )}
        fixedStartColumnIds={inboxOpen ? [INBOX_COLUMN_ID] : []}
        fixedStartClassName={cn(
          "m-3 mr-0 w-[18rem] overflow-hidden rounded-lg border shadow-sm",
          background ? "bg-background/90" : "bg-muted/10"
        )}
        fixedColumnClassName="w-full rounded-none border-0 bg-transparent"
        nonDraggableColumnIds={[INBOX_COLUMN_ID]}
        renderScrollableHeader={
          board && showBoard
            ? () => (
                <BoardHeader
                  board={board}
                  canUpdate={canUpdate}
                  canManageBoard={canManageBoard}
                  admin={admin}
                  onOpenArchive={() => setArchiveOpen(true)}
                  onOpenAllBoards={onOpenAllBoards}
                  onBoardArchived={onBoardArchived}
                />
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
        columnAccent="bar"
        renderColumnTitle={(column) => {
          const full = board?.columns.find((candidate) => candidate.id === column.id);
          return full ? <ColumnTitle column={full} canEdit={canUpdate} actions={actions} /> : null;
        }}
        renderColumnActions={(column) => {
          if (column.id === INBOX_COLUMN_ID || !board || !(canUpdate || canDelete)) return null;
          const full = board.columns.find((candidate) => candidate.id === column.id);
          return full ? (
            <ColumnMenu
              boardId={board.id}
              column={full}
              cardCount={board.cards.filter((card) => card.column_id === full.id).length}
              canUpdate={canUpdate}
              canDelete={canDelete}
              actions={actions}
              onAddCardTop={() => setComposer({ columnId: full.id, atTop: true })}
            />
          ) : null;
        }}
        renderColumnTop={(column) =>
          composer?.atTop && composer.columnId === column.id ? (
            <AddCardComposer
              key="top"
              columnId={column.id}
              atTop
              actions={actions}
              onClose={closeComposer}
            />
          ) : null
        }
        renderColumnFooter={(column) => {
          if (column.id === INBOX_COLUMN_ID || !board || !canUpdate) return null;
          return composer && !composer.atTop && composer.columnId === column.id ? (
            <AddCardComposer
              key="bottom"
              columnId={column.id}
              actions={actions}
              onClose={closeComposer}
            />
          ) : (
            <AddCardButton onClick={() => setComposer({ columnId: column.id, atTop: false })} />
          );
        }}
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
            columns={board?.columns ?? emptyColumns}
            canEdit={card.is_inbox ? canUpdatePermission : canUpdate}
            canArchive={card.is_inbox ? canDeletePermission : canDelete}
            currentUserId={currentUserId}
            actions={actions}
            onOpen={handleOpenCard}
          />
        )}
      />

      <TaskEditorDialog
        orgId={orgId}
        taskRef={openCardNumber}
        initialData={editorInitialData}
        people={people}
        currentUserId={currentUserId}
        canAssign={canAssign}
        canUpdate={openCard?.is_inbox ? canUpdatePermission : canUpdate}
        canArchive={openCard?.is_inbox ? canDeletePermission : canDelete}
        canMove={canUpdate}
        showOpenFull
        onChanged={actions.cardChanged}
        onArchive={actions.archiveCard}
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
