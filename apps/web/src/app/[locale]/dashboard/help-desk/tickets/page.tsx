import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import {
  HELPDESK_TICKETS_READ,
  HELPDESK_TICKETS_CREATE,
  HELPDESK_TICKETS_MANAGE,
} from "@/lib/constants/permissions";
import { createClient } from "@/utils/supabase/server";
import { HelpdeskTicketsService } from "@/server/services/helpdesk-tickets.service";
import { HelpdeskTicketTypesService } from "@/server/services/helpdesk-ticket-types.service";
import { OrgMembersService } from "@/server/services/organization.service";
import { parseDataViewSearchParams } from "@/components/data-view/data-view-search-params";
import { TicketsClient } from "./_components/tickets-client";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function HelpDeskTicketsPage({ searchParams }: PageProps = {}) {
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

  const params = parseDataViewSearchParams(searchParams ? await searchParams : {});
  const supabase = await createClient();
  const orgId = context.app.activeOrgId;

  const [ticketsResult, ticketTypesResult, membersResult, settingsResult] = await Promise.all([
    HelpdeskTicketsService.listForDataView(supabase, orgId, params),
    HelpdeskTicketTypesService.list(supabase, orgId, false),
    OrgMembersService.listMembers(supabase, orgId),
    HelpdeskTicketTypesService.getSettings(supabase, orgId),
  ]);

  const initialData = ticketsResult.success
    ? ticketsResult.data
    : { rows: [], totalCount: 0, page: params.page, pageSize: params.pageSize };

  const ticketTypes = ticketTypesResult.success ? ticketTypesResult.data : [];

  const members = membersResult.success
    ? membersResult.data.map((m) => ({
        user_id: m.user_id,
        name: [m.user_first_name, m.user_last_name].filter(Boolean).join(" ") || null,
        email: m.user_email,
      }))
    : [];

  const settings = settingsResult.success ? settingsResult.data : null;

  return (
    <TicketsClient
      initialData={initialData}
      ticketTypes={ticketTypes}
      members={members}
      branches={context.app.availableBranches.map((b) => ({ id: b.id, name: b.name }))}
      canCreate={checkPermission(context.user.permissionSnapshot, HELPDESK_TICKETS_CREATE)}
      canManage={checkPermission(context.user.permissionSnapshot, HELPDESK_TICKETS_MANAGE)}
      currentUserId={context.user.user?.id ?? ""}
      orgId={orgId}
      statusConfigs={settings?.status_configs ?? null}
      priorityConfigs={settings?.priority_configs ?? null}
    />
  );
}
