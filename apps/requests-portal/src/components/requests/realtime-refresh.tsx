"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { isReplying, requestKeys, useRequestsScope } from "@/lib/requests-query";
import { createClient } from "@/utils/supabase/client";

/**
 * Live updates through Supabase Realtime (RLS applies, so only readable rows arrive).
 * A change marks the cached list pages and that request's card stale: what is on screen
 * refetches once (debounced), the rest when it is shown next. Nothing re-renders the page.
 * A reconnect after a dropped connection refetches what is on screen.
 */
export function RealtimeRefresh({ orgId }: { orgId: string }) {
  const qc = useQueryClient();
  const scope = useRequestsScope();

  useEffect(() => {
    const supabase = createClient();
    let listTimer: ReturnType<typeof setTimeout> | undefined;
    const detailTimers = new Map<string, ReturnType<typeof setTimeout>>();
    const listChanged = () => {
      clearTimeout(listTimer);
      listTimer = setTimeout(
        () => void qc.invalidateQueries({ queryKey: requestKeys.lists(scope) }),
        300
      );
    };
    const detailChanged = (id: string) => {
      clearTimeout(detailTimers.get(id));
      detailTimers.set(
        id,
        setTimeout(() => {
          detailTimers.delete(id);
          // A reply of ours still sending reloads the card itself when it is saved.
          if (isReplying(id)) return;
          void qc.invalidateQueries({ queryKey: requestKeys.detail(scope, id), exact: true });
        }, 300)
      );
    };
    const ticketChanged = (id: string | undefined) => {
      listChanged();
      if (id) detailChanged(id);
    };
    const commentChanged = (payload: { new: unknown; old: unknown }) => {
      const row = (payload.new ?? payload.old) as { target_type?: string; target_id?: string };
      if (row?.target_type !== "helpdesk.ticket" || !row.target_id) return;
      detailChanged(row.target_id);
      listChanged(); // comment count
    };
    const catchUp = () => void qc.invalidateQueries({ queryKey: requestKeys.all(scope) });
    const filter = `org_id=eq.${orgId}`;

    // Unique topic: supabase-js reuses a channel with the same topic, so a remount could
    // attach to the channel that is still being removed and receive nothing.
    const channel = supabase
      .channel(`portal-helpdesk:${orgId}:${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "helpdesk_tickets", filter },
        (payload) => ticketChanged(((payload.new ?? payload.old) as { id?: string })?.id)
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "helpdesk_ticket_activity", filter },
        (payload) => ticketChanged((payload.new as { ticket_id?: string }).ticket_id)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "app_comments", filter },
        commentChanged
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "app_attachments", filter },
        commentChanged
      );
    // The browser client does not hand the session to Realtime by itself; without this the
    // socket joins as anon and RLS filters out every change.
    let active = true;
    let joined = false;
    void supabase.realtime.setAuth().finally(() => {
      if (!active) return;
      channel.subscribe((status) => {
        if (status !== "SUBSCRIBED") return;
        // Re-joined after a dropped connection: changes made meanwhile were not delivered.
        if (joined) catchUp();
        joined = true;
      });
    });

    return () => {
      active = false;
      clearTimeout(listTimer);
      for (const timer of detailTimers.values()) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [orgId, qc, scope]);

  return null;
}
