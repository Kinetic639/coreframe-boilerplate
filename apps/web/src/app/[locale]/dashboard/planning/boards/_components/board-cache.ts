import type {
  KanbanBoardCard,
  KanbanBoardColumn,
  KanbanBoardDetail,
  KanbanTaskStatus,
} from "@/lib/types/kanban";

// Pure changes to the board and inbox caches. Every optimistic update goes
// through these, so the same move can be undone by moving the card back.

/** Where a card sits: a column of the board, or the inbox (columnId null). */
export interface CardPlace {
  columnId: string | null;
  index: number;
}

export interface BoardCacheState {
  board: KanbanBoardDetail | undefined;
  inbox: KanbanBoardCard[] | undefined;
}

function byPosition(a: KanbanBoardCard, b: KanbanBoardCard) {
  return a.position - b.position || a.created_at.localeCompare(b.created_at);
}

/** The board's cards of one column, in order. */
export function columnCards(board: KanbanBoardDetail, columnId: string): KanbanBoardCard[] {
  return board.cards.filter((card) => card.column_id === columnId).sort(byPosition);
}

/** Where a card is now, or null when neither the board nor the inbox has it. */
export function findCardPlace(state: BoardCacheState, cardId: string): CardPlace | null {
  const inboxIndex = state.inbox?.findIndex((card) => card.id === cardId) ?? -1;
  if (inboxIndex !== -1) return { columnId: null, index: inboxIndex };
  const card = state.board?.cards.find((candidate) => candidate.id === cardId);
  if (!card || !state.board) return null;
  const index = columnCards(state.board, card.column_id).findIndex((c) => c.id === cardId);
  return { columnId: card.column_id, index };
}

function renumber(cards: KanbanBoardCard[]): KanbanBoardCard[] {
  return cards.map((card, position) => (card.position === position ? card : { ...card, position }));
}

/**
 * Moves a card to a column of the board or to the inbox, at an index of the
 * destination list. A column with a status gives the card that status, the
 * same as the database does.
 */
export function moveCard(state: BoardCacheState, cardId: string, to: CardPlace): BoardCacheState {
  const fromInbox = state.inbox?.find((card) => card.id === cardId);
  const fromBoard = state.board?.cards.find((card) => card.id === cardId);
  const moving = fromInbox ?? fromBoard;
  if (!moving) return state;

  let inbox = state.inbox?.filter((card) => card.id !== cardId);
  let board = state.board;

  if (to.columnId === null) {
    const list = [...(inbox ?? [])];
    const index = Math.max(0, Math.min(to.index, list.length));
    list.splice(index, 0, {
      ...moving,
      board_id: "",
      column_id: "",
      is_inbox: true,
    });
    inbox = renumber(list);
    if (board && fromBoard) {
      board = { ...board, cards: board.cards.filter((card) => card.id !== cardId) };
    }
    return { board, inbox };
  }

  if (!board) return state;
  const column = board.columns.find((candidate) => candidate.id === to.columnId);
  if (!column) return state;

  const status: KanbanTaskStatus =
    column.status_category && moving.column_id !== column.id
      ? column.status_category
      : moving.status;
  const placed: KanbanBoardCard = {
    ...moving,
    board_id: board.id,
    column_id: column.id,
    is_inbox: false,
    status,
  };

  const others = board.cards.filter((card) => card.id !== cardId);
  const destination = others.filter((card) => card.column_id === column.id).sort(byPosition);
  const index = Math.max(0, Math.min(to.index, destination.length));
  destination.splice(index, 0, placed);
  const renumbered = renumber(destination);
  const rest = others.filter((card) => card.column_id !== column.id);

  board = { ...board, cards: [...rest, ...renumbered] };
  return { board, inbox };
}

/** Replaces a card wherever it is (after a save), or adds it to its column or the inbox. */
export function upsertCard(state: BoardCacheState, card: KanbanBoardCard): BoardCacheState {
  let { board, inbox } = state;
  const onBoard = Boolean(
    board && card.board_id === board.id && card.column_id && !card.archived_at
  );
  const inInbox = card.is_inbox && !card.archived_at;

  if (board) {
    const exists = board.cards.some((candidate) => candidate.id === card.id);
    const knownColumn = board.columns.some((column) => column.id === card.column_id);
    if (onBoard && knownColumn) {
      board = {
        ...board,
        cards: exists
          ? board.cards.map((candidate) => (candidate.id === card.id ? card : candidate))
          : [...board.cards, card],
      };
    } else if (exists) {
      board = { ...board, cards: board.cards.filter((candidate) => candidate.id !== card.id) };
    }
  }

  if (inbox) {
    const exists = inbox.some((candidate) => candidate.id === card.id);
    if (inInbox) {
      inbox = exists
        ? inbox.map((candidate) => (candidate.id === card.id ? card : candidate))
        : [card, ...inbox];
    } else if (exists) {
      inbox = inbox.filter((candidate) => candidate.id !== card.id);
    }
  }

  return { board, inbox };
}

export function removeCard(state: BoardCacheState, cardId: string): BoardCacheState {
  return {
    board: state.board && {
      ...state.board,
      cards: state.board.cards.filter((card) => card.id !== cardId),
    },
    inbox: state.inbox?.filter((card) => card.id !== cardId),
  };
}

/** Replaces or adds a column (keeps the board's column order). */
export function upsertColumn(
  board: KanbanBoardDetail,
  column: KanbanBoardColumn
): KanbanBoardDetail {
  if (column.archived_at) return removeColumn(board, column.id);
  const exists = board.columns.some((candidate) => candidate.id === column.id);
  const columns = exists
    ? board.columns.map((candidate) => (candidate.id === column.id ? column : candidate))
    : [...board.columns, column];
  return {
    ...board,
    columns: [...columns].sort((a, b) => a.position - b.position),
  };
}

/** Takes a column off the board view together with its cards (they wait in the archive). */
export function removeColumn(board: KanbanBoardDetail, columnId: string): KanbanBoardDetail {
  return {
    ...board,
    columns: board.columns.filter((column) => column.id !== columnId),
    cards: board.cards.filter((card) => card.column_id !== columnId),
  };
}

export function reorderColumns(board: KanbanBoardDetail, columnIds: string[]): KanbanBoardDetail {
  const order = new Map(columnIds.map((id, index) => [id, index]));
  const columns = board.columns
    .map((column) => {
      const position = order.get(column.id);
      return position === undefined || position === column.position
        ? column
        : { ...column, position };
    })
    .sort((a, b) => a.position - b.position);
  return { ...board, columns };
}
