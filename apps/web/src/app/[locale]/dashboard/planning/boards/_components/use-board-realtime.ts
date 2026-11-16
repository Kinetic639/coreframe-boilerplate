"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/client";
import { taskEditorKeys } from "@/components/planning/task-editor/task-editor-queries";
import { boardKeys } from "./boards-query";

export interface BoardViewer {
  user_id: string;
  name: string;
}

const REFRESH_DELAY_MS = 600;

/**
 * Keeps an open board live: a change by someone else (a card, its labels or
 * checklist, a column) refetches the board, and the people who have the
 * board open show in its header. Changes arrive through RLS, so only rows
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
    const refresh = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (queryClient.isMutating({ mutationKey: boardKeys.moves(orgId) }) > 0) {
          refresh();
          return;
        }
        void queryClient.invalidateQueries({ queryKey: boardKeys.board(orgId, boardId) });
      }, REFRESH_DELAY_MS);
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
          refresh();
          const row = (payload.new ?? payload.old) as { id?: string; task_number?: string };
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
        refresh
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
      void supabase.removeChannel(changes);
      if (presence) void supabase.removeChannel(presence);
      setViewers([]);
    };
  }, [boardId, meId, orgId, queryClient]);

  return viewers;
}
