"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/utils/supabase/client";
import { invalidateDataViewEntity } from "@/components/data-view/data-view-query-keys";
import { dataViewScope } from "@/lib/data-view/ambra-data-view-scope";
import { commentsKeys } from "@/hooks/queries/comments";
import { attachmentsKeys } from "@/hooks/queries/attachments";

const TICKET_TARGET = "helpdesk.ticket";

/**
 * Live Help Desk updates (tickets, activity, comments, attachments) for the organization.
 * Realtime delivers postgres_changes through RLS, so only rows the user may read arrive.
 * `openTicket` is the ticket shown in a detail view, refreshed when its rows change.
 */
export function useHelpdeskRealtime(
  orgId: string,
  openTicket?: { id: string; ticketNumber: string } | null
) {
  const queryClient = useQueryClient();
  const openId = openTicket?.id ?? null;
  const openNumber = openTicket?.ticketNumber ?? null;

  useEffect(() => {
    if (!orgId) return;
    const supabase = createClient();
    const scope = dataViewScope.organization(orgId);
    const refreshTicket = (ticketId: string | null | undefined, ticketNumber?: string | null) => {
      const number = ticketNumber ?? (ticketId && ticketId === openId ? openNumber : null);
      void invalidateDataViewEntity(queryClient, "helpdesk-tickets", scope, number ?? undefined);
    };

    const channel = supabase
      .channel(`helpdesk:${orgId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "helpdesk_tickets", filter: `org_id=eq.${orgId}` },
        (payload) => {
          const row = (payload.new ?? payload.old) as { id?: string; ticket_number?: string };
          refreshTicket(row.id, row.ticket_number);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "helpdesk_ticket_activity",
          filter: `org_id=eq.${orgId}`,
        },
        (payload) => refreshTicket((payload.new as { ticket_id?: string }).ticket_id)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "app_comments", filter: `org_id=eq.${orgId}` },
        (payload) => {
          const row = (payload.new ?? payload.old) as { target_type?: string; target_id?: string };
          if (row.target_type !== TICKET_TARGET || !row.target_id) return;
          void queryClient.invalidateQueries({
            queryKey: commentsKeys.target(TICKET_TARGET, row.target_id),
          });
          refreshTicket(row.target_id);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "app_attachments", filter: `org_id=eq.${orgId}` },
        (payload) => {
          const row = (payload.new ?? payload.old) as { target_type?: string; target_id?: string };
          if (row.target_type !== TICKET_TARGET || !row.target_id) return;
          void queryClient.invalidateQueries({
            queryKey: attachmentsKeys.target(TICKET_TARGET, row.target_id),
          });
        }
      );
    // The browser client does not hand the session to Realtime by itself; without this the
    // socket joins as anon and RLS filters out every change.
    let active = true;
    void supabase.realtime.setAuth().finally(() => {
      if (active) channel.subscribe();
    });

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [orgId, openId, openNumber, queryClient]);
}
