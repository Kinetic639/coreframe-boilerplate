"use client";

import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
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
  const t = useTranslations("modules.helpDesk");
  const { data: ticket = initialTicket } = useTicketDetailQuery(
    initialTicket.ticket_number,
    initialTicket.org_id,
    initialTicket
  );
  useHelpdeskRealtime(initialTicket.org_id);

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div>
        <Button asChild type="button" variant="ghost" size="sm">
          <Link href="/dashboard/help-desk/tickets">
            <ArrowLeft className="mr-1 h-4 w-4" />
            {t("tickets.backToList")}
          </Link>
        </Button>
      </div>
      <TicketDetailPanel
        key={ticket.id}
        detail={ticket}
        currentUserId={currentUserId}
        statusConfigs={statusConfigs}
        priorityConfigs={priorityConfigs}
      />
    </div>
  );
}
