"use client";

import { useCallback, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import {
  archiveKanbanCardAction,
  archiveKanbanColumnAction,
  archiveKanbanColumnCardsAction,
  copyKanbanCardAction,
  copyKanbanColumnAction,
  createKanbanCardAction,
  createKanbanColumnAction,
  deleteKanbanColumnAction,
  moveKanbanTaskAction,
  patchKanbanTaskAction,
  reorderKanbanColumnsAction,
  restoreKanbanCardAction,
  restoreKanbanColumnAction,
  updateKanbanCardAction,
  updateKanbanColumnAction,
} from "@/app/actions/kanban";
import type {
  KanbanBoardCard,
  KanbanBoardDetail,
  KanbanBoardLabel,
  KanbanMoveResult,
} from "@/lib/types/kanban";
import type {
  CreateKanbanColumnInput,
  MoveKanbanTaskInput,
  PatchKanbanTaskInput,
  UpdateKanbanCardInput,
  UpdateKanbanColumnInput,
} from "@/lib/validations/kanban";
import {
  findCardPlace,
  moveCard,
  removeCard,
  removeColumn,
  reorderColumns,
  upsertCard,
  upsertColumn,
  type BoardCacheState,
  type CardPlace,
} from "./board-cache";
import { boardKeys, unwrap } from "./boards-query";
import { toastWithUndo } from "./undo-toast";

/** A repeating task just got completed (its rule moved to the next one). */
function spawnedNext(before: KanbanBoardCard | undefined, after: KanbanBoardCard) {
  return Boolean(
    before?.recurrence && before.status !== "completed" && after.status === "completed"
  );
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Operation failed";
}

interface MoveVariables {
  input: MoveKanbanTaskInput;
  /** Where the card was before the drag, to put it back if the move fails. */
  from: CardPlace;
}

/**
 * Every change to a board: written into the cache first (the board reacts at
 * once), then saved. A failed save puts back only what it changed. The board
 * and inbox are refetched in the background once no move is pending, so a
 * burst of drags costs one refetch.
 */
export function useBoardActions(orgId: string, boardId: string | null) {
  const t = useTranslations("modules.planning");
  const queryClient = useQueryClient();
  const boardKey = useMemo(
    () => (boardId ? boardKeys.board(orgId, boardId) : null),
    [boardId, orgId]
  );
  const inboxKey = useMemo(() => boardKeys.inbox(orgId), [orgId]);

  const readState = useCallback(
    (): BoardCacheState => ({
      board: boardKey ? queryClient.getQueryData<KanbanBoardDetail>(boardKey) : undefined,
      inbox: queryClient.getQueryData<KanbanBoardCard[]>(inboxKey),
    }),
    [boardKey, inboxKey, queryClient]
  );

  /** Writes a new board + inbox into the cache, cancelling refetches that would overwrite it. */
  const writeState = useCallback(
    (update: (state: BoardCacheState) => BoardCacheState) => {
      if (boardKey) void queryClient.cancelQueries({ queryKey: boardKey });
      void queryClient.cancelQueries({ queryKey: inboxKey });
      const next = update(readState());
      if (boardKey && next.board) queryClient.setQueryData(boardKey, next.board);
      if (next.inbox) queryClient.setQueryData(inboxKey, next.inbox);
    },
    [boardKey, inboxKey, queryClient, readState]
  );

  const refreshWhenIdle = useCallback(
    (pendingMoves = 0) => {
      if (queryClient.isMutating({ mutationKey: boardKeys.moves(orgId) }) > pendingMoves) return;
      if (boardKey) void queryClient.invalidateQueries({ queryKey: boardKey });
      void queryClient.invalidateQueries({ queryKey: inboxKey });
    },
    [boardKey, inboxKey, orgId, queryClient]
  );

  const moveMutation = useMutation({
    mutationKey: boardKeys.moves(orgId),
    // One after another, in the order they were dropped.
    scope: { id: `planning-board-moves-${orgId}` },
    mutationFn: ({ input }: MoveVariables) => unwrap(moveKanbanTaskAction(input)),
    onSuccess: (result: KanbanMoveResult) => {
      // The database may have given the card a status (status column).
      writeState((state) => {
        const card =
          state.board?.cards.find((candidate) => candidate.id === result.card_id) ??
          state.inbox?.find((candidate) => candidate.id === result.card_id);
        if (!card || card.status === result.status) return state;
        return upsertCard(state, { ...card, status: result.status });
      });
    },
    onError: (error, { input, from }) => {
      writeState((state) => moveCard(state, input.card_id, from));
      toast.error(errorMessage(error));
    },
    onSettled: () => refreshWhenIdle(1),
  });

  // mutate is stable; the mutation object itself is new on every render.
  const mutateMove = moveMutation.mutate;

  /** Drops a card at a place (column or inbox). The board shows it there at once. */
  const moveCardTo = useCallback(
    (cardId: string, to: CardPlace) => {
      const state = readState();
      const from = findCardPlace(state, cardId);
      if (!from) return;
      if (from.columnId === to.columnId && from.index === to.index) return;
      writeState((current) => moveCard(current, cardId, to));
      mutateMove({
        input: {
          card_id: cardId,
          board_id: to.columnId === null ? null : (state.board?.id ?? null),
          column_id: to.columnId,
          position: to.index,
        },
        from,
      });
    },
    [mutateMove, readState, writeState]
  );

  const setColumnsOrder = useCallback(
    async (columnIds: string[]) => {
      if (!boardKey || !boardId) return;
      const previous = queryClient.getQueryData<KanbanBoardDetail>(boardKey);
      if (!previous) return;
      const previousOrder = previous.columns.map((column) => column.id);
      void queryClient.cancelQueries({ queryKey: boardKey });
      queryClient.setQueryData(boardKey, reorderColumns(previous, columnIds));
      try {
        await unwrap(reorderKanbanColumnsAction({ board_id: boardId, column_ids: columnIds }));
      } catch (error) {
        const current = queryClient.getQueryData<KanbanBoardDetail>(boardKey);
        if (current) queryClient.setQueryData(boardKey, reorderColumns(current, previousOrder));
        toast.error(errorMessage(error));
      }
    },
    [boardId, boardKey, queryClient]
  );

  /**
   * Adds a card at the bottom of a column, or at the top (position 0). The
   * board refetches afterwards when it went to the top (the others moved).
   */
  const createCard = useCallback(
    async (columnId: string, title: string, options: { atTop?: boolean } = {}) => {
      if (!boardId) return false;
      try {
        const card = await unwrap(
          createKanbanCardAction({
            board_id: boardId,
            column_id: columnId,
            title,
            ...(options.atTop ? { position: 0 } : {}),
          })
        );
        writeState((state) => {
          const added = upsertCard(state, card);
          return options.atTop ? moveCard(added, card.id, { columnId, index: 0 }) : added;
        });
        return true;
      } catch (error) {
        toast.error(errorMessage(error));
        return false;
      }
    },
    [boardId, writeState]
  );

  /** A card saved somewhere else (the task editor): it goes into the board and inbox. */
  const cardChanged = useCallback(
    (card: KanbanBoardCard) => {
      const state = readState();
      const before =
        state.board?.cards.find((candidate) => candidate.id === card.id) ??
        state.inbox?.find((candidate) => candidate.id === card.id);
      writeState((current) => upsertCard(current, card));
      // A repeating task was completed: the database made the next one.
      if (spawnedNext(before, card)) refreshWhenIdle();
    },
    [readState, refreshWhenIdle, writeState]
  );

  /** A label made from the task editor: the board's filters and label list show it. */
  const boardLabelCreated = useCallback(
    (label: KanbanBoardLabel) => {
      if (!boardKey) return;
      queryClient.setQueryData<KanbanBoardDetail>(boardKey, (current) =>
        current && !(current.labels ?? []).some((item) => item.id === label.id)
          ? { ...current, labels: [...(current.labels ?? []), label] }
          : current
      );
    },
    [boardKey, queryClient]
  );

  /** Quick edit from the card's menu: shown at once, put back if the save fails. */
  const patchCard = useCallback(
    async (card: KanbanBoardCard, fields: Omit<PatchKanbanTaskInput, "id">) => {
      writeState((state) => upsertCard(state, { ...card, ...fields } as KanbanBoardCard));
      try {
        const saved = await unwrap(patchKanbanTaskAction({ id: card.id, ...fields }));
        writeState((state) => upsertCard(state, saved));
        if (spawnedNext(card, saved)) refreshWhenIdle();
        return true;
      } catch (error) {
        writeState((state) => upsertCard(state, card));
        toast.error(errorMessage(error));
        return false;
      }
    },
    [refreshWhenIdle, writeState]
  );

  const updateCard = useCallback(
    async (input: UpdateKanbanCardInput) => {
      try {
        const card = await unwrap(updateKanbanCardAction(input));
        writeState((state) => upsertCard(state, card));
        void queryClient.invalidateQueries({ queryKey: boardKeys.activity(orgId, card.id) });
        return card;
      } catch (error) {
        toast.error(errorMessage(error));
        return null;
      }
    },
    [orgId, queryClient, writeState]
  );

  const restoreCard = useCallback(
    async (cardId: string) => {
      try {
        const card = await unwrap(restoreKanbanCardAction({ card_id: cardId }));
        writeState((state) => upsertCard(state, card));
        if (boardId) {
          void queryClient.invalidateQueries({ queryKey: boardKeys.archive(orgId, boardId) });
        }
        refreshWhenIdle();
        return true;
      } catch (error) {
        toast.error(errorMessage(error));
        return false;
      }
    },
    [boardId, orgId, queryClient, refreshWhenIdle, writeState]
  );

  /** Archives a card (it leaves the board at once) with an Undo in the toast. */
  const archiveCard = useCallback(
    async (card: KanbanBoardCard) => {
      const from = findCardPlace(readState(), card.id);
      writeState((state) => removeCard(state, card.id));
      try {
        await unwrap(archiveKanbanCardAction({ card_id: card.id }));
        toastWithUndo(t("boards.archive.cardArchived"), t("boards.archive.undo"), () => {
          void restoreCard(card.id);
        });
        if (boardId) {
          void queryClient.invalidateQueries({ queryKey: boardKeys.archive(orgId, boardId) });
        }
        return true;
      } catch (error) {
        if (from) {
          writeState((state) => {
            const back = upsertCard(state, card);
            return moveCard(back, card.id, from);
          });
        }
        toast.error(errorMessage(error));
        return false;
      }
    },
    [boardId, orgId, queryClient, readState, restoreCard, t, writeState]
  );

  const createColumn = useCallback(
    async (input: CreateKanbanColumnInput) => {
      try {
        const column = await unwrap(createKanbanColumnAction(input));
        if (boardKey) {
          queryClient.setQueryData<KanbanBoardDetail>(boardKey, (board) =>
            board ? upsertColumn(board, column) : board
          );
        }
        return true;
      } catch (error) {
        toast.error(errorMessage(error));
        return false;
      }
    },
    [boardKey, queryClient]
  );

  const updateColumn = useCallback(
    async (input: UpdateKanbanColumnInput) => {
      try {
        const column = await unwrap(updateKanbanColumnAction(input));
        if (boardKey) {
          queryClient.setQueryData<KanbanBoardDetail>(boardKey, (board) =>
            board ? upsertColumn(board, column) : board
          );
        }
        return true;
      } catch (error) {
        toast.error(errorMessage(error));
        return false;
      }
    },
    [boardKey, queryClient]
  );

  const restoreColumn = useCallback(
    async (columnId: string) => {
      if (!boardId) return false;
      try {
        await unwrap(restoreKanbanColumnAction({ board_id: boardId, id: columnId }));
        // The column comes back with its cards: take both from the server.
        if (boardKey) await queryClient.invalidateQueries({ queryKey: boardKey });
        void queryClient.invalidateQueries({ queryKey: boardKeys.archive(orgId, boardId) });
        return true;
      } catch (error) {
        toast.error(errorMessage(error));
        return false;
      }
    },
    [boardId, boardKey, orgId, queryClient]
  );

  /** Archives a column with its cards, with an Undo in the toast. */
  const archiveColumn = useCallback(
    async (columnId: string) => {
      if (!boardId || !boardKey) return false;
      const previous = queryClient.getQueryData<KanbanBoardDetail>(boardKey);
      void queryClient.cancelQueries({ queryKey: boardKey });
      if (previous) queryClient.setQueryData(boardKey, removeColumn(previous, columnId));
      try {
        await unwrap(archiveKanbanColumnAction({ board_id: boardId, id: columnId }));
        toastWithUndo(t("boards.archive.columnArchived"), t("boards.archive.undo"), () => {
          void restoreColumn(columnId);
        });
        void queryClient.invalidateQueries({ queryKey: boardKeys.archive(orgId, boardId) });
        return true;
      } catch (error) {
        if (previous) queryClient.setQueryData(boardKey, previous);
        toast.error(errorMessage(error));
        return false;
      }
    },
    [boardId, boardKey, orgId, queryClient, restoreColumn, t]
  );

  /** Archives every card of a column ("clear Done"), with an Undo for all of them. */
  const archiveColumnCards = useCallback(
    async (columnId: string) => {
      if (!boardId || !boardKey) return false;
      const previous = queryClient.getQueryData<KanbanBoardDetail>(boardKey);
      void queryClient.cancelQueries({ queryKey: boardKey });
      if (previous) {
        queryClient.setQueryData(boardKey, {
          ...previous,
          cards: previous.cards.filter((card) => card.column_id !== columnId),
        });
      }
      try {
        const ids = await unwrap(
          archiveKanbanColumnCardsAction({ board_id: boardId, id: columnId })
        );
        toastWithUndo(
          t("boards.list.cardsArchived", { count: ids.length }),
          t("boards.archive.undo"),
          () => {
            void Promise.all(
              ids.map((id) => unwrap(restoreKanbanCardAction({ card_id: id })))
            ).then(
              () => queryClient.invalidateQueries({ queryKey: boardKey }),
              (error) => toast.error(errorMessage(error))
            );
          }
        );
        void queryClient.invalidateQueries({ queryKey: boardKeys.archive(orgId, boardId) });
        return true;
      } catch (error) {
        if (previous) queryClient.setQueryData(boardKey, previous);
        toast.error(errorMessage(error));
        return false;
      }
    },
    [boardId, boardKey, orgId, queryClient, t]
  );

  /** "New card from template": a copy of the template card at the bottom of a list. */
  const createFromTemplate = useCallback(
    async (template: KanbanBoardCard, columnId: string) => {
      try {
        const card = await unwrap(
          copyKanbanCardAction({ card_id: template.id, column_id: columnId, as_template: false })
        );
        writeState((state) => upsertCard(state, card));
        return card;
      } catch (error) {
        toast.error(errorMessage(error));
        return null;
      }
    },
    [writeState]
  );

  /**
   * Copies a list with its cards, next to it or onto another board. The
   * board it lands on comes back whole and replaces that board's cache entry.
   */
  const copyColumn = useCallback(
    async (columnId: string, options: { title?: string; boardId?: string } = {}) => {
      try {
        const target = await unwrap(
          copyKanbanColumnAction({
            column_id: columnId,
            ...(options.boardId && options.boardId !== boardId
              ? { board_id: options.boardId }
              : {}),
            ...(options.title ? { title: options.title } : {}),
          })
        );
        queryClient.setQueryData(boardKeys.board(orgId, target.id), target);
        toast.success(t("boardExtras.column.copied"));
        return target;
      } catch (error) {
        toast.error(errorMessage(error));
        return null;
      }
    },
    [boardId, orgId, queryClient, t]
  );

  const deleteColumn = useCallback(
    async (columnId: string) => {
      if (!boardId) return false;
      try {
        await unwrap(deleteKanbanColumnAction({ board_id: boardId, id: columnId }));
        void queryClient.invalidateQueries({ queryKey: boardKeys.archive(orgId, boardId) });
        toast.success(t("boards.archive.columnDeleted"));
        return true;
      } catch (error) {
        toast.error(errorMessage(error));
        return false;
      }
    },
    [boardId, orgId, queryClient, t]
  );

  // One object for the life of the board, so memoized cards and columns
  // don't re-render when the board does.
  return useMemo(
    () => ({
      moveCardTo,
      setColumnsOrder,
      createCard,
      cardChanged,
      boardLabelCreated,
      patchCard,
      updateCard,
      archiveCard,
      restoreCard,
      createColumn,
      updateColumn,
      archiveColumn,
      archiveColumnCards,
      restoreColumn,
      deleteColumn,
      createFromTemplate,
      copyColumn,
    }),
    [
      moveCardTo,
      setColumnsOrder,
      createCard,
      cardChanged,
      boardLabelCreated,
      patchCard,
      updateCard,
      archiveCard,
      restoreCard,
      createColumn,
      updateColumn,
      archiveColumn,
      archiveColumnCards,
      restoreColumn,
      deleteColumn,
      createFromTemplate,
      copyColumn,
    ]
  );
}

export type BoardActions = ReturnType<typeof useBoardActions>;
