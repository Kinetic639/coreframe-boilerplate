"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/client";
import { taskEditorKeys } from "@/components/planning/task-editor/task-editor-queries";
import type { KanbanBoardCard, KanbanBoardDetail } from "@/lib/types/kanban";
import { boardKeys } from "./boards-query";

export interface BoardViewer {
  user_id: string;
  name: string;
}

const REFRESH_DELAY_MS = 600;
/** A change by someone else is patched in at once; the full refetch that fills in names and counts can wait. */
const PATCHED_REFRESH_DELAY_MS = 2500;
/** An echo of this browser's own save arrives within this window after the save settles. */
const OWN_ECHO_WINDOW_MS = 4000;

type TaskRow = {
  id?: string;
  task_number?: string;
  board_id?: string | null;
  column_id?: string | null;
  deleted_at?: string | null;
  updated_by?: string | null;
  updated_at?: string;
  title?: string;
  status?: KanbanBoardCard["status"];
  priority?: KanbanBoardCard["priority"];
  due_at?: string | null;
  due_has_time?: boolean | null;
  label?: string | null;
  label_color?: string | null;
  cover_color?: string | null;
  board_position?: number | null;
};

/**
 * Writes a changed task row straight into the cached board, so a move or an
 * edit by someone else shows at once. Only plain fields are taken from the
 * row; names, counts and covers come with the refetch that follows. Returns
 * null when the change cannot be applied this way.
 */
function patchBoardCard(board: KanbanBoardDetail, row: TaskRow): KanbanBoardDetail | null {
  if (!row.id) return null;
  const index = board.cards.findIndex((card) => card.id === row.id);
  const leaves =
    Boolean(row.deleted_at) ||
    (row.board_id !== undefined && row.board_id !== board.id) ||
    row.column_id === null ||
    (row.column_id !== undefined && !board.columns.some((column) => column.id === row.column_id));
  if (leaves) {
    if (index === -1) return board;
    return { ...board, cards: board.cards.filter((card) => card.id !== row.id) };
  }
  // A card that is new here needs its full shape: left to the refetch.
  if (index === -1) return null;
  const current = board.cards[index];
  if (row.updated_at && current.updated_at && row.updated_at < current.updated_at) return board;
  const next: KanbanBoardCard = {
    ...current,
    ...(row.title !== undefined ? { title: row.title } : {}),
    ...(row.status !== undefined ? { status: row.status } : {}),
    ...(row.priority !== undefined ? { priority: row.priority ?? current.priority } : {}),
    ...(row.due_at !== undefined ? { due_at: row.due_at } : {}),
    ...(row.due_has_time !== undefined ? { due_has_time: Boolean(row.due_has_time) } : {}),
    ...(row.label !== undefined ? { label: row.label } : {}),
    ...(row.label_color !== undefined ? { label_color: row.label_color } : {}),
    ...(row.cover_color !== undefined ? { cover_color: row.cover_color } : {}),
    ...(row.column_id ? { column_id: row.column_id } : {}),
    ...(typeof row.board_position === "number" ? { position: row.board_position } : {}),
    ...(row.updated_at ? { updated_at: row.updated_at } : {}),
  };
  const cards = board.cards.slice();
  cards[index] = next;
  return { ...board, cards };
}

/**
 * Keeps an open board live: a change by someone else to a card is written
 * into the cached board at once and followed by a refetch (names, counts,
 * covers); a column change refetches the board. Echoes of this browser's own
 * saves are skipped. The people who have the board open show in its header.
 * Changes arrive through RLS, so only rows
 * the viewer may read come in. A refetch waits while this browser is still
 * saving a move, so it never undoes a drop on screen.
 */
export function useBoardRealtime(
  orgId: string,
  boardId: string | null,
  me: { id: string; name: string } | null
): BoardViewer[] {
  const queryClient = useQueryClient();
  const [viewers, setViewers] = useState<BoardViewer[]>([]);
  const meRef = useRef(me);
  meRef.current = me;
  const meId = me?.id ?? null;

  useEffect(() => {
    if (!orgId || !boardId) return;
    const supabase = createClient();
    let timer: number | undefined;
    const refresh = (delay = REFRESH_DELAY_MS) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (queryClient.isMutating({ mutationKey: boardKeys.moves(orgId) }) > 0) {
          refresh(delay);
          return;
        }
        void queryClient.invalidateQueries({ queryKey: boardKeys.board(orgId, boardId) });
      }, delay);
    };

    // When this browser last finished a save: an echo of it changes nothing
    // the cache does not already show.
    let lastOwnSaveAt = 0;
    const unsubscribeMutations = queryClient.getMutationCache().subscribe((event) => {
      if (event.type === "updated" && event.mutation.state.status !== "pending") {
        lastOwnSaveAt = Date.now();
      }
    });
    const isOwnEcho = (row: TaskRow) =>
      Boolean(meId) &&
      row.updated_by === meId &&
      (queryClient.isMutating() > 0 || Date.now() - lastOwnSaveAt < OWN_ECHO_WINDOW_MS);

    const onTaskChange = (row: TaskRow) => {
      if (isOwnEcho(row)) return;
      const key = boardKeys.board(orgId, boardId);
      const board = queryClient.getQueryData<KanbanBoardDetail>(key);
      const moving = queryClient.isMutating({ mutationKey: boardKeys.moves(orgId) }) > 0;
      const patched = board && !moving ? patchBoardCard(board, row) : null;
      if (patched) {
        if (patched !== board) queryClient.setQueryData(key, patched);
        refresh(PATCHED_REFRESH_DELAY_MS);
      } else {
        refresh();
      }
    };

    const changes = supabase
      // A unique topic: supabase-js reuses a channel with the same name while
      // the previous one is still being removed.
      .channel(`planning-board-changes:${boardId}:${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "planning_tasks",
          filter: `board_id=eq.${boardId}`,
        },
        (payload) => {
          const row = (
            payload.eventType === "DELETE" ? { ...payload.old, deleted_at: "deleted" } : payload.new
          ) as TaskRow;
          onTaskChange(row);
          if (row.task_number) {
            void queryClient.invalidateQueries({
              queryKey: taskEditorKeys.task(orgId, row.task_number),
              refetchType: "active",
            });
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "planning_kanban_columns",
          filter: `board_id=eq.${boardId}`,
        },
        () => refresh()
      );

    let presence: RealtimeChannel | null = null;
    let active = true;
    let joined = false;

    void supabase.realtime.setAuth().finally(() => {
      if (!active) return;
      changes.subscribe((status) => {
        if (status !== "SUBSCRIBED") return;
        // Re-joined after a dropped connection: what changed meanwhile was not delivered.
        if (joined) refresh();
        joined = true;
      });

      if (!meId) return;
      const channel = supabase.channel(`planning-board:${boardId}`, {
        config: { private: true, presence: { key: meId } },
      });
      presence = channel;
      channel
        .on("presence", { event: "sync" }, () => {
          const state = channel.presenceState<{ name?: string }>();
          setViewers(
            Object.entries(state)
              .filter(([userId]) => userId !== meId)
              .map(([userId, metas]) => ({ user_id: userId, name: metas[0]?.name ?? "" }))
          );
        })
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            void channel.track({ name: meRef.current?.name ?? "" });
          }
        });
    });

    return () => {
      active = false;
      window.clearTimeout(timer);
      unsubscribeMutations();
      void supabase.removeChannel(changes);
      if (presence) void supabase.removeChannel(presence);
      setViewers([]);
    };
  }, [boardId, meId, orgId, queryClient]);

  return viewers;
}
