"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { parseAsString, useQueryStates } from "nuqs";
import { Inbox, KanbanSquare } from "lucide-react";
import { toast } from "react-toastify";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useUiStoreV2 } from "@/lib/stores/v2/ui-store";
import {
  BoardSharingProvider,
  type BoardSharingOption,
  type BoardSharingPerson,
} from "./board-sharing";
import { BoardSwitcherDialog } from "./board-switcher-dialog";
import { withColumnCollapsed, writeBoardUiPrefs, type BoardUiPrefs } from "./board-ui-prefs";
import { BoardWorkspace } from "./board-workspace";
import { boardListQuery, boardQuery, inboxQuery } from "./boards-query";
import { useBoardsAdmin } from "./use-boards-admin";

interface PlanningBoardsClientProps {
  orgId: string;
  /** What the browser remembered (cookie), with the board the server opened. */
  initialPrefs: BoardUiPrefs;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  /** Can give a task to someone else; anyone who edits can take one. */
  canAssign: boolean;
  /** Branches the board owner can pick for the branch scope. */
  branches: BoardSharingOption[];
  /** Organization members the owner can add to a board. */
  people: BoardSharingPerson[];
  currentUserId: string;
}

// The address holds the open board and card (?board=…&karta=TSK-12), so a
// link opens the same view and Back closes a card or returns to the last board.
const urlParams = {
  board: parseAsString,
  karta: parseAsString,
};

export function PlanningBoardsClient({
  orgId,
  initialPrefs,
  canCreate,
  canUpdate,
  canDelete,
  canAssign,
  branches,
  people,
  currentUserId,
}: PlanningBoardsClientProps) {
  const t = useTranslations("modules.planning");
  const queryClient = useQueryClient();
  const setFlushContent = useUiStoreV2((state) => state.setFlushContent);
  const [params, setParams] = useQueryStates(urlParams, { history: "push" });
  const [prefs, setPrefs] = useState(initialPrefs);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const admin = useBoardsAdmin(orgId);

  const sharing = useMemo(
    () => ({ branches, people, currentUserId, canAssign }),
    [branches, people, currentUserId, canAssign]
  );

  useEffect(() => {
    setFlushContent(true);
    return () => setFlushContent(false);
  }, [setFlushContent]);

  /** Changes what this browser remembers, and keeps it in the cookie. */
  const updatePrefs = useCallback((update: (current: BoardUiPrefs) => BoardUiPrefs) => {
    setPrefs((current) => {
      const next = update(current);
      if (next !== current) writeBoardUiPrefs(next);
      return next;
    });
  }, []);

  const boardsQuery = useQuery(boardListQuery(orgId));
  const boards = useMemo(() => boardsQuery.data ?? [], [boardsQuery.data]);

  // Without ?board, the last board this browser had open, or the first one.
  const fallbackBoardId =
    boards.find((board) => board.id === prefs.lastBoardId)?.id ?? boards[0]?.id ?? null;
  const activeBoardId = params.board ?? fallbackBoardId;

  const activeBoard = useQuery({
    ...boardQuery(orgId, activeBoardId ?? ""),
    enabled: Boolean(activeBoardId),
  });
  const inbox = useQuery(inboxQuery(orgId));

  // The board opened fine: remember it for the next visit.
  const loadedBoardId = activeBoard.data?.id;
  const loadedBoardArchived = Boolean(activeBoard.data?.archived_at);
  useEffect(() => {
    if (!loadedBoardId || loadedBoardArchived) return;
    updatePrefs((current) =>
      current.lastBoardId === loadedBoardId ? current : { ...current, lastBoardId: loadedBoardId }
    );
  }, [loadedBoardArchived, loadedBoardId, updatePrefs]);

  // A board from an old link that is gone or no longer shared: say so and
  // fall back to the remembered board.
  const boardError = activeBoard.isError ? activeBoard.error.message : null;
  useEffect(() => {
    if (!boardError || !params.board) return;
    toast.error(boardError);
    void setParams({ board: null, karta: null }, { history: "replace" });
  }, [boardError, params.board, setParams]);

  const selectBoard = useCallback(
    (boardId: string) => {
      setSwitcherOpen(false);
      if (boardId === activeBoardId) return;
      void setParams({ board: boardId, karta: null });
    },
    [activeBoardId, setParams]
  );

  const prefetchBoard = useCallback(
    (boardId: string) => {
      void queryClient.prefetchQuery(boardQuery(orgId, boardId));
    },
    [orgId, queryClient]
  );

  const handleBoardArchived = useCallback(
    (boardId: string) => {
      const next = boards.find((board) => board.id !== boardId)?.id ?? null;
      updatePrefs((current) => ({ ...current, lastBoardId: next }));
      void setParams({ board: next, karta: null }, { history: "replace" });
    },
    [boards, setParams, updatePrefs]
  );

  const setOpenCard = useCallback(
    (taskNumber: string | null) => {
      void setParams({ karta: taskNumber });
    },
    [setParams]
  );

  const handleColumnCollapsedChange = useCallback(
    (columnId: string, collapsed: boolean) => {
      if (!activeBoardId) return;
      updatePrefs((current) => withColumnCollapsed(current, activeBoardId, columnId, collapsed));
    },
    [activeBoardId, updatePrefs]
  );

  const collapsedColumnIds = useMemo(
    () => (activeBoardId ? (prefs.collapsed[activeBoardId] ?? []) : []),
    [activeBoardId, prefs.collapsed]
  );

  return (
    <BoardSharingProvider value={sharing}>
      <TooltipProvider delayDuration={250}>
        <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_3rem] overflow-hidden">
          <main className="min-h-0 overflow-hidden">
            <BoardWorkspace
              orgId={orgId}
              boardId={activeBoardId}
              board={activeBoard.data}
              boardLoading={Boolean(activeBoardId) && activeBoard.isPending}
              inboxOpen={prefs.inboxOpen}
              inboxCards={inbox.data ?? []}
              inboxLoading={inbox.isPending}
              canUpdate={canUpdate}
              canDelete={canDelete}
              collapsedColumnIds={collapsedColumnIds}
              onColumnCollapsedChange={handleColumnCollapsedChange}
              openCardNumber={params.karta}
              onOpenCardChange={setOpenCard}
              admin={admin}
              onBoardArchived={handleBoardArchived}
            />
          </main>
          <aside className="flex min-h-0 flex-col items-center border-l bg-muted/10 px-1.5 py-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  variant={prefs.inboxOpen ? "default" : "ghost"}
                  className="h-8 w-8"
                  onClick={() =>
                    updatePrefs((current) => ({ ...current, inboxOpen: !current.inboxOpen }))
                  }
                  aria-pressed={prefs.inboxOpen}
                  aria-label={t("boards.inbox.toggle")}
                >
                  <Inbox className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">{t("boards.inbox.toggle")}</TooltipContent>
            </Tooltip>

            <div className="mt-auto">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setSwitcherOpen(true)}
                    aria-label={t("boards.switchBoards")}
                  >
                    <KanbanSquare className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">{t("boards.switchBoards")}</TooltipContent>
              </Tooltip>
            </div>
          </aside>
          <BoardSwitcherDialog
            orgId={orgId}
            open={switcherOpen}
            onOpenChange={setSwitcherOpen}
            boards={boards}
            activeBoardId={activeBoardId}
            canCreate={canCreate}
            canManageAll={canDelete}
            canUpdate={canUpdate}
            admin={admin}
            onSelectBoard={selectBoard}
            onPrefetchBoard={prefetchBoard}
          />
        </div>
      </TooltipProvider>
    </BoardSharingProvider>
  );
}
