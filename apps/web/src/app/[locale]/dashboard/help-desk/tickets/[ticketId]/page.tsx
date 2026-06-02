import { redirect } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { HELPDESK_TICKETS_READ, HELPDESK_TICKETS_MANAGE } from "@/lib/constants/permissions";
import { createClient } from "@/utils/supabase/server";
import { HelpdeskTicketsService } from "@/server/services/helpdesk-tickets.service";
import { HelpdeskTicketTypesService } from "@/server/services/helpdesk-ticket-types.service";
import { getQrAssignmentForTicketAction } from "@/app/actions/qr/assign";
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

  // Fetch ticket + settings in parallel; QR assignment needs the ticket UUID
  // which comes from getDetail, so it runs after.
  const [result, settingsResult] = await Promise.all([
    HelpdeskTicketsService.getDetail(supabase, orgId, ticketId),
    HelpdeskTicketTypesService.getSettings(supabase, orgId),
  ]);

  if (!result.success || !result.data) {
    notFound();
  }

  // Now we have the UUID — look up the QR assignment with the correct target_id
  const qrAssignmentResult = await getQrAssignmentForTicketAction(result.data.id);

  const canManage = checkPermission(context.user.permissionSnapshot, HELPDESK_TICKETS_MANAGE);
  const currentUserId = context.user.user?.id ?? "";
  const settings = settingsResult.success ? settingsResult.data : null;
  const qrAssignment = qrAssignmentResult.success ? qrAssignmentResult.data : null;

  return (
    <TicketDetailClient
      ticket={result.data}
      canManage={canManage}
      currentUserId={currentUserId}
      statusConfigs={settings?.status_configs ?? null}
      priorityConfigs={settings?.priority_configs ?? null}
      initialQrAssignment={qrAssignment}
    />
  );
}
