import { redirect } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { HELPDESK_TICKETS_READ, HELPDESK_TICKETS_MANAGE } from "@/lib/constants/permissions";
import { createClient } from "@/utils/supabase/server";
import { HelpdeskTicketsService } from "@/server/services/helpdesk-tickets.service";
import { TicketDetailClient } from "./_components/ticket-detail-client";

type PageProps = {
  params: Promise<{ ticketId: string }>;
};

export default async function TicketDetailPage({ params }: PageProps) {
  const locale = await getLocale();
  const context = await loadDashboardContextV2();

  if (!context?.app.activeOrgId) return redirect({ href: "/sign-in", locale });

  if (!checkPermission(context.user.permissionSnapshot, HELPDESK_TICKETS_READ)) {
    return redirect({
      href: {
        pathname: "/dashboard/access-denied",
        query: { reason: "helpdesk_tickets_read_required" },
      },
      locale,
    });
  }

  const { ticketId } = await params;
  const supabase = await createClient();
  const orgId = context.app.activeOrgId;

  const result = await HelpdeskTicketsService.getDetail(supabase, orgId, ticketId);

  if (!result.success || !result.data) {
    notFound();
  }

  const canManage = checkPermission(context.user.permissionSnapshot, HELPDESK_TICKETS_MANAGE);
  const currentUserId = context.user.user?.id ?? "";

  return (
    <TicketDetailClient ticket={result.data} canManage={canManage} currentUserId={currentUserId} />
  );
}
