import { planningRead } from "@/lib/planning/read";
import type {
  KanbanBoardArchive,
  KanbanBoardCard,
  KanbanBoardDetail,
  KanbanBoardSummary,
  KanbanCardActivity,
} from "@/lib/types/kanban";

// The boards' client cache, per organization: the board list, each board
// (columns + cards), the private inbox, a card's activity and a board's
// archive. Changes write into these entries right away (optimistic) and the
// entries are refetched in the background once the changes settle.

const BOARD_STALE_TIME = 30 * 1000;
const LIST_STALE_TIME = 60 * 1000;

export const boardKeys = {
  all: (orgId: string) => ["planning-boards", orgId] as const,
  list: (orgId: string) => ["planning-boards", orgId, "list"] as const,
  archivedList: (orgId: string) => ["planning-boards", orgId, "archived"] as const,
  board: (orgId: string, boardId: string) => ["planning-boards", orgId, "board", boardId] as const,
  inbox: (orgId: string) => ["planning-boards", orgId, "inbox"] as const,
  activity: (orgId: string, cardId: string) =>
    ["planning-boards", orgId, "activity", cardId] as const,
  archive: (orgId: string, boardId: string) =>
    ["planning-boards", orgId, "archive", boardId] as const,
  /** Mutations that move cards: they run one after another and share a refetch. */
  moves: (orgId: string) => ["planning-boards", orgId, "moves"] as const,
};

export async function unwrap<T>(
  promise: Promise<{ success: true; data: T } | { success: false; error: string }>
): Promise<T> {
  const result = await promise;
  if ("error" in result) throw new Error(result.error);
  return result.data;
}

export const boardListQuery = (orgId: string) => ({
  queryKey: boardKeys.list(orgId),
  queryFn: (): Promise<KanbanBoardSummary[]> => unwrap(planningRead("boardsByState", false)),
  staleTime: LIST_STALE_TIME,
});

export const archivedBoardListQuery = (orgId: string) => ({
  queryKey: boardKeys.archivedList(orgId),
  queryFn: (): Promise<KanbanBoardSummary[]> => unwrap(planningRead("boardsByState", true)),
  staleTime: LIST_STALE_TIME,
});

export const boardQuery = (orgId: string, boardId: string) => ({
  queryKey: boardKeys.board(orgId, boardId),
  queryFn: (): Promise<KanbanBoardDetail> => unwrap(planningRead("board", boardId)),
  staleTime: BOARD_STALE_TIME,
});

export const inboxQuery = (orgId: string) => ({
  queryKey: boardKeys.inbox(orgId),
  queryFn: (): Promise<KanbanBoardCard[]> => unwrap(planningRead("inbox")),
  staleTime: BOARD_STALE_TIME,
});

export const cardActivityQuery = (orgId: string, cardId: string) => ({
  queryKey: boardKeys.activity(orgId, cardId),
  queryFn: (): Promise<KanbanCardActivity[]> => unwrap(planningRead("cardActivity", cardId)),
  staleTime: BOARD_STALE_TIME,
});

export const boardArchiveQuery = (orgId: string, boardId: string) => ({
  queryKey: boardKeys.archive(orgId, boardId),
  queryFn: (): Promise<KanbanBoardArchive> => unwrap(planningRead("boardArchive", boardId)),
  staleTime: 0,
});
