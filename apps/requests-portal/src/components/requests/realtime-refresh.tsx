"use client";

import { useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { LIST_CHANGED_EVENT, THREAD_CHANGED_EVENT } from "./live-events";

/**
 * Live updates through Supabase Realtime (RLS applies, so only readable rows arrive).
 * Nothing here re-renders the whole page for changes elsewhere:
 * - comments / attachments: the open thread reloads itself;
 * - tickets / activity: the list refetches itself; only a change to the open ticket
 *   (status, taken) re-renders the server tree, for its header.
 * Coming back to the tab refetches the list and the open thread the same way.
 */
export function RealtimeRefresh({ orgId }: { orgId: string }) {
  const router = useRouter();
  const { ticketId } = useParams<{ ticketId?: string }>();
  const openTicket = useRef(ticketId);
  openTicket.current = ticketId;

  useEffect(() => {
    const supabase = createClient();
    let listTimer: ReturnType<typeof setTimeout> | undefined;
    let detailTimer: ReturnType<typeof setTimeout> | undefined;
    const listChanged = () => {
      clearTimeout(listTimer);
      listTimer = setTimeout(() => window.dispatchEvent(new Event(LIST_CHANGED_EVENT)), 300);
    };
    const threadChanged = (id: string) =>
      window.dispatchEvent(new CustomEvent(THREAD_CHANGED_EVENT, { detail: { ticketId: id } }));
    const ticketChanged = (id: string | undefined) => {
      listChanged();
      if (!id || id !== openTicket.current) return;
      clearTimeout(detailTimer);
      detailTimer = setTimeout(() => router.refresh(), 300);
    };
    const commentChanged = (payload: { new: unknown; old: unknown }) => {
      const row = (payload.new ?? payload.old) as { target_type?: string; target_id?: string };
      if (row?.target_type !== "helpdesk.ticket" || !row.target_id) return;
      threadChanged(row.target_id);
      listChanged(); // comment count / unread dot
    };
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

    const catchUp = () => {
      listChanged();
      if (openTicket.current) threadChanged(openTicket.current);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") catchUp();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      clearTimeout(listTimer);
      clearTimeout(detailTimer);
      document.removeEventListener("visibilitychange", onVisible);
      void supabase.removeChannel(channel);
    };
  }, [orgId, router]);

  return null;
}
