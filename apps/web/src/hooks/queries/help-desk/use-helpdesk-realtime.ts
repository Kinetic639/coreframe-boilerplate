"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/utils/supabase/client";
import { commentsKeys } from "@/hooks/queries/comments";
import { attachmentsKeys } from "@/hooks/queries/attachments";
import {
  cachedTicketNumber,
  patchTicket,
  refreshTicket,
  ticketKeys,
  type TicketPatch,
} from "@/lib/help-desk/ticket-queries";
import { isOwnTicketSave } from "./own-saves";

const TICKET_TARGET = "helpdesk.ticket";
/** Changes arriving together (a save and its activity entry) refetch once. */
const REFRESH_DELAY_MS = 800;

/** The columns of a helpdesk_tickets change that the list and the card show. */
export function ticketPatchFromChange(row: Record<string, unknown>): TicketPatch {
  const patch: TicketPatch = {};
  const keys = [
    "title",
    "status",
    "priority",
    "branch_id",
    "assigned_to",
    "closed_at",
    "updated_at",
    "requires_acceptance",
    "accepted_by",
    "accepted_at",
    "ticket_type_id",
  ] as const;
  for (const key of keys) {
    if (key in row) (patch as Record<string, unknown>)[key] = row[key];
  }
  return patch;
}

/**
 * Live Help Desk updates for the organization. Realtime delivers
 * postgres_changes through RLS, so only rows the user may read arrive.
 *
 * A change to a ticket is written into the cached list pages and card at once
 * from the event itself; one fetch of the list and of that ticket's card
 * follows (names, counts, rows leaving a filter), shared by changes that
 * arrive together. This browser's own saves are already in the cache, so
 * their echoes fetch nothing.
 */
export function useHelpdeskRealtime(orgId: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!orgId) return;
    const supabase = createClient();

    // Pending refetch: the lists, and the cards by ticket id.
    let timer: ReturnType<typeof setTimeout> | null = null;
    let lists = false;
    const tickets = new Set<string>();
    const flush = () => {
      timer = null;
      if (lists) {
        void queryClient.invalidateQueries({ queryKey: ticketKeys.lists(orgId) });
      }
      for (const id of tickets) {
        const number = cachedTicketNumber(queryClient, orgId, id);
        // A ticket in no cached card or page has nothing on screen to refresh.
        if (number) void refreshTicket(queryClient, orgId, number, { lists: false });
      }
      lists = false;
      tickets.clear();
    };
    const schedule = (ticketId: string | null, withLists: boolean) => {
      if (ticketId) tickets.add(ticketId);
      lists ||= withLists;
      if (!timer) timer = setTimeout(flush, REFRESH_DELAY_MS);
    };
    /** Counts on list rows go stale; they refresh when a page is next shown. */
    const markListsStale = () =>
      void queryClient.invalidateQueries({
        queryKey: ticketKeys.lists(orgId),
        refetchType: "none",
      });

    const channel = supabase
      // Unique topic: supabase-js reuses a channel with the same topic, so the detail view
      // mounted right after the list would attach to the list's channel while it is being
      // removed and receive nothing.
      .channel(`helpdesk:${orgId}:${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "helpdesk_tickets", filter: `org_id=eq.${orgId}` },
        (payload) => {
          const row = (payload.new ?? {}) as Record<string, unknown>;
          const id = ((row.id ?? (payload.old as { id?: string } | null)?.id) as string) ?? null;
          if (payload.eventType === "UPDATE" && id && !row.deleted_at) {
            patchTicket(queryClient, orgId, id, ticketPatchFromChange(row));
          }
          if (isOwnTicketSave(id)) return;
          schedule(id, true);
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
        (payload) => {
          const ticketId = (payload.new as { ticket_id?: string }).ticket_id ?? null;
          // Activity shows on the card only; the ticket row change refreshes lists.
          if (!isOwnTicketSave(ticketId)) schedule(ticketId, false);
        }
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
          markListsStale();
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
          markListsStale();
        }
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
        if (joined) {
          void queryClient.invalidateQueries({ queryKey: commentsKeys.all });
          void queryClient.invalidateQueries({ queryKey: attachmentsKeys.all });
          void queryClient.invalidateQueries({ queryKey: ticketKeys.all(orgId) });
        }
        joined = true;
      });
    });

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [orgId, queryClient]);
}
