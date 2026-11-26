import { redirect } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { HELPDESK_TICKETS_READ } from "@/lib/constants/permissions";
import { createClient } from "@/utils/supabase/server";
import { HelpdeskTicketsService } from "@/server/services/helpdesk-tickets.service";
import { HelpdeskTicketTypesService } from "@/server/services/helpdesk-ticket-types.service";
import { UUID_RE } from "@/lib/mentions";
import { TicketPageClient } from "./_components/ticket-page-client";

type PageProps = {
  params: Promise<{ ticketId: string }>;
};

export default async function TicketDetailPage({ params }: PageProps) {
  const [locale, context] = await Promise.all([getLocale(), loadDashboardContextV2()]);

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

  // Links that name the ticket by its internal id (older mentions, search
  // results, comment targets) open it by its number in the list's side panel.
  if (UUID_RE.test(ticketId)) {
    const ticketNumber = await HelpdeskTicketsService.getTicketNumber(supabase, orgId, ticketId);
    if (!ticketNumber) notFound();
    return redirect({
      href: { pathname: "/dashboard/help-desk/tickets", query: { selected: ticketNumber } },
      locale,
    });
  }

  // The ticket (with its QR code and whether the reader may handle it) and
  // the badge settings, in one wave.
  const [result, settingsResult] = await Promise.all([
    HelpdeskTicketsService.getDetail(supabase, orgId, ticketId),
    HelpdeskTicketTypesService.getSettings(supabase, orgId),
  ]);

  if (!result.success || !result.data) {
    notFound();
  }

  const settings = settingsResult.success ? settingsResult.data : null;

  return (
    <TicketPageClient
      ticket={result.data}
      currentUserId={context.user.user?.id ?? ""}
      statusConfigs={settings?.status_configs ?? null}
      priorityConfigs={settings?.priority_configs ?? null}
    />
  );
}
