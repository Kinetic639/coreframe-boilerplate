"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { THREAD_CHANGED_EVENT } from "./thread";

/**
 * Live updates through Supabase Realtime (RLS applies, so only readable rows arrive).
 * - comments / attachments: the open thread reloads itself (no page re-render);
 * - tickets / activity (status, new request, taken): re-render the server tree, coalesced.
 * Also refreshes when the tab becomes visible again.
 */
export function RealtimeRefresh({ orgId }: { orgId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 400);
    };
    const threadChanged = (payload: { new: unknown; old: unknown }) => {
      const row = (payload.new ?? payload.old) as { target_type?: string; target_id?: string };
      if (row?.target_type !== "helpdesk.ticket" || !row.target_id) return;
      window.dispatchEvent(
        new CustomEvent(THREAD_CHANGED_EVENT, { detail: { ticketId: row.target_id } })
      );
    };
    const filter = `org_id=eq.${orgId}`;

    const channel = supabase
      .channel(`portal-helpdesk:${orgId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "helpdesk_tickets", filter },
        refresh
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "helpdesk_ticket_activity", filter },
        refresh
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "app_comments", filter },
        threadChanged
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "app_attachments", filter },
        threadChanged
      );
    // The browser client does not hand the session to Realtime by itself; without this the
    // socket joins as anon and RLS filters out every change.
    let active = true;
    void supabase.realtime.setAuth().finally(() => {
      if (active) channel.subscribe();
    });

    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      void supabase.removeChannel(channel);
    };
  }, [orgId, router]);

  return null;
}
