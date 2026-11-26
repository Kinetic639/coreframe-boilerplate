"use client";

import type { StatusBadgeConfig } from "@/components/help-desk/ticket-status-badge";
import type { PriorityBadgeConfig } from "@/components/help-desk/ticket-priority-badge";
import { useTicketDetailQuery } from "@/hooks/queries/help-desk";
import { useHelpdeskRealtime } from "@/hooks/queries/help-desk/use-helpdesk-realtime";
import type { HelpdeskTicketDetail } from "@/server/services/helpdesk-tickets.service";
import { TicketDetailPanel } from "../../_components/ticket-detail-panel";

/**
 * The ticket page: the same card as the list's side panel, full width. The
 * server's copy seeds the cache, so it renders complete without a request;
 * saves and realtime keep it current.
 */
export function TicketPageClient({
  ticket: initialTicket,
  currentUserId,
  statusConfigs,
  priorityConfigs,
}: {
  ticket: HelpdeskTicketDetail;
  currentUserId: string;
  statusConfigs: Record<string, StatusBadgeConfig> | null;
  priorityConfigs: Record<string, PriorityBadgeConfig> | null;
}) {
  const { data: ticket = initialTicket } = useTicketDetailQuery(
    initialTicket.ticket_number,
    initialTicket.org_id,
    initialTicket
  );
  useHelpdeskRealtime(initialTicket.org_id);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border bg-background">
      <TicketDetailPanel
        key={ticket.id}
        detail={ticket}
        currentUserId={currentUserId}
        statusConfigs={statusConfigs}
        priorityConfigs={priorityConfigs}
        navigation={{ back: true }}
      />
    </div>
  );
}
