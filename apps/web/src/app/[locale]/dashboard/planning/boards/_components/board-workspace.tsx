"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useQueryStates } from "nuqs";
import { toast } from "react-toastify";
import { useUserStoreV2 } from "@/lib/stores/v2/user-store";
import { LayoutGrid, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { KanbanBoard, type KanbanCardMoveParams } from "@/components/primitives/kanban";
import { PageLoader } from "@/components/page-loader";
import { CopyCardDialog, TaskEditorDialog } from "@/components/planning/task-editor";
import type { KanbanBoardCard, KanbanBoardDetail, KanbanTaskEditorData } from "@/lib/types/kanban";
import { cn } from "@/utils";
import { BoardArchiveDialog } from "./board-archive-dialog";
import { BoardFieldsDialog } from "./board-fields-dialog";
import { BoardCard } from "./board-card";
import { boardBackground } from "./board-colors";
import {
  AddCardButton,
  AddCardComposer,
  AddColumnPanel,
  ColumnMenu,
  ColumnTitle,
  WipBadge,
} from "./board-columns";
import { moveExceedsWip, wipCount } from "./board-wip";
import {
  boardFilterParams,
  cardMatches,
  fullIndexFromVisible,
  hasActiveFilters,
  type BoardFilters,
} from "./board-filters";
import { INBOX_COLUMN_ID } from "./board-format";
import { BoardFilterBar } from "./board-filter-bar";
import type { BoardSwitcherProps } from "./board-switcher-menu";
import {
  BoardActivitySheet,
  BoardLabelsDialog,
  BoardShortcutsDialog,
  BoardViewers,
} from "./board-tools";
import { useBoardRealtime } from "./use-board-realtime";
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
  /** Can make boards (copy this one). */
  canCreate: boolean;
  /** Opens another board (a copy just made). */
  onOpenBoard: (boardId: string) => void;
  /** The other boards, behind the board's name. */
  switcher: BoardSwitcherProps;
  onToggleInbox: () => void;
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
  canCreate,
  onOpenBoard,
  switcher,
  onToggleInbox,
}: BoardWorkspaceProps) {
  const t = useTranslations("modules.planning");
  const actions = useBoardActions(orgId, board?.id ?? null);
  const { people, currentUserId, canAssign } = useBoardSharing();
  const [archiveOpen, setArchiveOpen] = useState(false);
  /** The column where a card is being added, and whether at its top. */
  const [composer, setComposer] = useState<{ columnId: string; atTop: boolean } | null>(null);
  const [labelsOpen, setLabelsOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [fieldsOpen, setFieldsOpen] = useState(false);
  const [copyingCard, setCopyingCard] = useState<KanbanBoardCard | null>(null);
  const hoveredCard = useRef<KanbanBoardCard | null>(null);

  const [filterParams, setFilterParams] = useQueryStates(boardFilterParams, { history: "replace" });
  const filters = useMemo<BoardFilters>(
    () => ({
      q: filterParams.q,
      people: filterParams.osoby,
      labels: filterParams.etykiety,
      due: filterParams.termin[0] ?? null,
      priority: filterParams.priorytet,
    }),
    [filterParams]
  );
  const filtering = hasActiveFilters(filters);
  const setFilters = useCallback(
    (next: Partial<BoardFilters>) =>
      void setFilterParams({
        ...(next.q !== undefined ? { q: next.q || null } : {}),
        ...(next.people !== undefined ? { osoby: next.people.length ? next.people : null } : {}),
        ...(next.labels !== undefined ? { etykiety: next.labels.length ? next.labels : null } : {}),
        ...(next.due !== undefined ? { termin: next.due ? [next.due] : null } : {}),
        ...(next.priority !== undefined
          ? { priorytet: next.priority.length ? next.priority : null }
          : {}),
      }),
    [setFilterParams]
  );
  const clearFilters = useCallback(
    () =>
      void setFilterParams({ q: null, osoby: null, etykiety: null, termin: null, priorytet: null }),
    [setFilterParams]
  );

  const user = useUserStoreV2((state) => state.user);
  const me = useMemo(
    () =>
      user
        ? {
            id: user.id,
            name: [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email,
          }
        : null,
    [user]
  );
  const viewers = useBoardRealtime(orgId, board?.id ?? null, me);

  const isArchived = Boolean(board?.archived_at);
  // A viewer only looks; the database refuses their writes anyway. An archived
  // board is read-only until it is restored.
  const isViewer = board?.my_access === "viewer";
  const canUpdate = canUpdatePermission && !isViewer && !isArchived;
  const canDelete = canDeletePermission && !isViewer && !isArchived;
  const canManageBoard =
    canUpdatePermission && (board?.my_access === "owner" || (canDeletePermission && !isViewer));
  const showBoard = Boolean(board) && !boardLoading;

  const cardFields = useMemo(
    () => board?.custom_fields?.filter((field) => field.show_on_card) ?? [],
    [board?.custom_fields]
  );

  const cardTemplates = useMemo(
    () => board?.cards.filter((card) => card.is_template) ?? [],
    [board?.cards]
  );

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

  const allItems = useMemo(
    () => [
      ...(inboxOpen && !inboxLoading ? inboxCards : []),
      ...(board && showBoard ? board.cards : []),
    ],
    [board, inboxCards, inboxLoading, inboxOpen, showBoard]
  );

  // A filter hides cards; the card that is open stays, so it does not vanish while edited.
  const items = useMemo(() => {
    if (!filtering) return allItems;
    const now = new Date();
    return allItems.filter(
      (card) =>
        card.task_number === openCardNumber || cardMatches(card, filters, currentUserId, now)
    );
  }, [allItems, currentUserId, filtering, filters, openCardNumber]);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const allItemsRef = useRef(allItems);
  allItemsRef.current = allItems;

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
    if (openCard.is_inbox || !board)
      return { card: openCard, board: null, columns: [], labels: [] };
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
      labels: board.labels ?? [],
    };
  }, [board, openCard]);

  const closeComposer = useCallback(() => setComposer(null), []);

  const handleOpenCard = useCallback(
    (card: KanbanBoardCard) => onOpenCardChange(card.task_number),
    [onOpenCardChange]
  );

  const { moveCardTo, setColumnsOrder } = actions;
  const boardRef = useRef(board);
  boardRef.current = board;

  const handleCardMove = useCallback(
    ({ itemId, toColumnId, newIndex }: KanbanCardMoveParams) => {
      // The limit is soft: the move goes through with a warning.
      const current = boardRef.current;
      const target = current?.columns.find((column) => column.id === toColumnId);
      const moved = allItemsRef.current.find((card) => card.id === itemId);
      if (
        current &&
        target &&
        moved &&
        moveExceedsWip(current.cards, moved, target.id, target.wip_limit)
      ) {
        toast.warning(
          t("boardExtras.wip.over", { title: target.title, limit: target.wip_limit ?? 0 })
        );
      }
      let index = newIndex;
      if (filtering) {
        // The drop index counts the cards shown; the move needs all of the column's cards.
        const inColumn = (card: KanbanBoardCard) =>
          card.id !== itemId && getCardColumnId(card) === toColumnId;
        const order = (list: KanbanBoardCard[]) =>
          toColumnId === INBOX_COLUMN_ID
            ? list.filter(inColumn)
            : list.filter(inColumn).sort((a, b) => a.position - b.position);
        index = fullIndexFromVisible(
          order(allItemsRef.current).map(getCardId),
          order(itemsRef.current).map(getCardId),
          newIndex
        );
      }
      moveCardTo(itemId, {
        columnId: toColumnId === INBOX_COLUMN_ID ? null : toColumnId,
        index,
      });
    },
    [filtering, moveCardTo, t]
  );

  const handleHover = useCallback((card: KanbanBoardCard | null) => {
    hoveredCard.current = card;
  }, []);

  // Keyboard shortcuts on the board (not while typing or with a window open).
  const shortcutState = useRef({
    onToggleInbox,
    filters,
    canUpdate,
    canDelete,
    canUpdatePermission,
    canDeletePermission,
  });
  shortcutState.current = {
    onToggleInbox,
    filters,
    canUpdate,
    canDelete,
    canUpdatePermission,
    canDeletePermission,
  };
  useEffect(() => {
    if (!showBoard) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
      ) {
        return;
      }
      if (document.querySelector('[role="dialog"], [role="menu"], [role="alertdialog"]')) return;
      // A focused button or link keeps its own Enter and Space.
      if ((event.key === " " || event.key === "Enter") && target?.closest("button, a")) return;
      const state = shortcutState.current;
      const hovered = hoveredCard.current;
      const key = event.key;
      // "/" is the filter bar's own.
      if (key === "f" || key === "F") {
        event.preventDefault();
        document.querySelector<HTMLInputElement>('.board-filter-row input[type="search"]')?.focus();
      } else if (key === "i" || key === "I") {
        event.preventDefault();
        state.onToggleInbox();
      } else if (key === "q" || key === "Q") {
        event.preventDefault();
        const onlyMine = state.filters.people.length === 1 && state.filters.people[0] === "me";
        setFilters({ people: onlyMine ? [] : ["me"] });
      } else if (key === "Escape") {
        if (hasActiveFilters(state.filters)) {
          event.preventDefault();
          clearFilters();
        }
      } else if (key === "?") {
        event.preventDefault();
        setShortcutsOpen(true);
      } else if (hovered && key === "Enter") {
        event.preventDefault();
        onOpenCardChange(hovered.task_number);
      } else if (hovered && key === " ") {
        const canEdit = hovered.is_inbox ? state.canUpdatePermission : state.canUpdate;
        if (!canEdit) return;
        event.preventDefault();
        const mine = hovered.assigned_to === currentUserId;
        void actions.patchCard(hovered, { assigned_to: mine ? null : currentUserId });
      } else if (hovered && (key === "c" || key === "C")) {
        const canArchive = hovered.is_inbox ? state.canDeletePermission : state.canDelete;
        if (!canArchive) return;
        event.preventDefault();
        hoveredCard.current = null;
        void actions.archiveCard(hovered);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [actions, clearFilters, currentUserId, onOpenCardChange, setFilters, showBoard]);

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
                  viewers={<BoardViewers viewers={viewers} />}
                  onOpenLabels={() => setLabelsOpen(true)}
                  onOpenActivity={() => setActivityOpen(true)}
                  onOpenShortcuts={() => setShortcutsOpen(true)}
                  onOpenFields={() => setFieldsOpen(true)}
                  canCreate={canCreate}
                  onOpenBoard={onOpenBoard}
                  switcher={switcher}
                  inbox={{
                    open: inboxOpen,
                    count: inboxCards.length,
                    onToggle: onToggleInbox,
                  }}
                  toolbar={
                    <BoardFilterBar
                      boardId={board.id}
                      labels={board.labels ?? []}
                      people={people}
                      onlyMine={filters.people.length === 1 && filters.people[0] === "me"}
                      onToggleOnlyMine={() =>
                        setFilters({
                          people:
                            filters.people.length === 1 && filters.people[0] === "me" ? [] : ["me"],
                        })
                      }
                      filtering={filtering}
                      shown={items.length}
                      total={allItems.length}
                    />
                  }
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
                  <div className="flex h-full flex-1 flex-col items-center justify-center gap-3 p-8 text-center text-sm text-muted-foreground">
                    {t("boards.selectBoard")}
                    <div className="flex gap-2">
                      {switcher.onCreateBoard ? (
                        <Button size="sm" onClick={switcher.onCreateBoard}>
                          <Plus className="mr-1.5 h-4 w-4" />
                          {t("boards.newBoard")}
                        </Button>
                      ) : null}
                      <Button size="sm" variant="outline" onClick={onOpenAllBoards}>
                        <LayoutGrid className="mr-1.5 h-4 w-4" />
                        {t("boards.all.title")}
                      </Button>
                    </div>
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
          return full ? (
            <div className="flex min-w-0 items-center gap-1.5">
              <ColumnTitle column={full} canEdit={canUpdate} actions={actions} />
              <WipBadge count={wipCount(board?.cards ?? [], full.id)} limit={full.wip_limit} />
            </div>
          ) : null;
        }}
        renderColumnActions={(column) => {
          if (column.id === INBOX_COLUMN_ID || !board || !(canUpdate || canDelete)) return null;
          const full = board.columns.find((candidate) => candidate.id === column.id);
          return full ? (
            <ColumnMenu
              orgId={orgId}
              boardId={board.id}
              column={full}
              cardCount={board.cards.filter((card) => card.column_id === full.id).length}
              cardTemplates={cardTemplates}
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
            onHover={handleHover}
            onCopy={canUpdatePermission ? setCopyingCard : undefined}
            cardFields={card.is_inbox ? undefined : cardFields}
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
        onBoardLabelCreated={actions.boardLabelCreated}
      />

      <CopyCardDialog
        orgId={orgId}
        card={copyingCard}
        onOpenChange={(open) => !open && setCopyingCard(null)}
        onCopied={actions.cardChanged}
      />

      {board ? (
        <>
          <BoardLabelsDialog
            orgId={orgId}
            board={board}
            open={labelsOpen}
            onOpenChange={setLabelsOpen}
            canEdit={canUpdate}
          />
          <BoardFieldsDialog
            orgId={orgId}
            board={board}
            open={fieldsOpen}
            onOpenChange={setFieldsOpen}
            canEdit={canUpdate}
          />
          <BoardActivitySheet
            orgId={orgId}
            boardId={board.id}
            open={activityOpen}
            onOpenChange={setActivityOpen}
            onOpenCard={onOpenCardChange}
          />
        </>
      ) : null}
      <BoardShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />

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
