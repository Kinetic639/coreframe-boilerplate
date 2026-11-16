"use client";

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import {
  archiveKanbanBoardAction,
  deleteKanbanBoardAction,
  restoreKanbanBoardAction,
} from "@/app/actions/kanban";
import type { KanbanBoardDetail, KanbanBoardSummary } from "@/lib/types/kanban";
import { boardKeys, unwrap } from "./boards-query";
import { toastWithUndo } from "./undo-toast";

function toSummary(board: KanbanBoardDetail | KanbanBoardSummary): KanbanBoardSummary {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { columns, cards, members, ...summary } = board as KanbanBoardDetail;
  return summary;
}

function withBoard(list: KanbanBoardSummary[] | undefined, board: KanbanBoardSummary) {
  return [board, ...(list ?? []).filter((item) => item.id !== board.id)];
}

function withoutBoard(list: KanbanBoardSummary[] | undefined, boardId: string) {
  return list?.filter((item) => item.id !== boardId);
}

/** Changes to whole boards: the open list, the archived list and each board's entry. */
export function useBoardsAdmin(orgId: string) {
  const t = useTranslations("modules.planning");
  const queryClient = useQueryClient();

  /** A board came back from the server (created, renamed, shared): it goes into every cache. */
  const boardChanged = useCallback(
    (board: KanbanBoardDetail) => {
      queryClient.setQueryData(boardKeys.board(orgId, board.id), board);
      const summary = toSummary(board);
      queryClient.setQueryData<KanbanBoardSummary[]>(boardKeys.list(orgId), (list) =>
        board.archived_at
          ? withoutBoard(list, board.id)
          : list?.some((item) => item.id === board.id)
            ? list.map((item) => (item.id === board.id ? summary : item))
            : withBoard(list, summary)
      );
    },
    [orgId, queryClient]
  );

  const restoreBoard = useCallback(
    async (boardId: string) => {
      try {
        const board = await unwrap(restoreKanbanBoardAction({ id: boardId }));
        queryClient.setQueryData<KanbanBoardSummary[]>(boardKeys.list(orgId), (list) =>
          withBoard(list, board)
        );
        queryClient.setQueryData<KanbanBoardSummary[]>(boardKeys.archivedList(orgId), (list) =>
          withoutBoard(list, boardId)
        );
        queryClient.setQueryData<KanbanBoardDetail>(boardKeys.board(orgId, boardId), (detail) =>
          detail ? { ...detail, archived_at: null } : detail
        );
        void queryClient.invalidateQueries({ queryKey: boardKeys.board(orgId, boardId) });
        toast.success(t("boards.archive.boardRestored"));
        return board;
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Operation failed");
        return null;
      }
    },
    [orgId, queryClient, t]
  );

  /** Archives a board (confirmed before); its columns and tasks wait for it untouched. */
  const archiveBoard = useCallback(
    async (boardId: string) => {
      try {
        const board = await unwrap(archiveKanbanBoardAction({ id: boardId }));
        queryClient.setQueryData<KanbanBoardSummary[]>(boardKeys.list(orgId), (list) =>
          withoutBoard(list, boardId)
        );
        queryClient.setQueryData<KanbanBoardSummary[]>(boardKeys.archivedList(orgId), (list) =>
          list ? withBoard(list, board) : list
        );
        queryClient.setQueryData<KanbanBoardDetail>(boardKeys.board(orgId, boardId), (detail) =>
          detail ? { ...detail, archived_at: board.archived_at } : detail
        );
        toastWithUndo(t("boards.boardArchived"), t("boards.archive.undo"), () => {
          void restoreBoard(boardId);
        });
        return board;
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Operation failed");
        return null;
      }
    },
    [orgId, queryClient, restoreBoard, t]
  );

  /** Deletes an archived board for good (its tasks stay in the task list). */
  const deleteBoard = useCallback(
    async (boardId: string) => {
      try {
        await unwrap(deleteKanbanBoardAction({ id: boardId }));
        queryClient.setQueryData<KanbanBoardSummary[]>(boardKeys.archivedList(orgId), (list) =>
          withoutBoard(list, boardId)
        );
        queryClient.removeQueries({ queryKey: boardKeys.board(orgId, boardId) });
        toast.success(t("boards.archive.boardDeleted"));
        return true;
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Operation failed");
        return false;
      }
    },
    [orgId, queryClient, t]
  );

  return { boardChanged, archiveBoard, restoreBoard, deleteBoard };
}

export type BoardsAdmin = ReturnType<typeof useBoardsAdmin>;
