import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { HELPDESK_TICKET_TYPES_MANAGE } from "@/lib/constants/permissions";
import { createClient } from "@/utils/supabase/server";
import { HelpdeskTicketTypesService } from "@/server/services/helpdesk-ticket-types.service";
import { OrgMembersService } from "@/server/services/organization.service";
import { TicketTypesClient } from "./_components/ticket-types-client";

export default async function HelpDeskTicketTypesPage() {
  const locale = await getLocale();
  const context = await loadDashboardContextV2();

  if (!context?.app.activeOrgId) return redirect({ href: "/sign-in", locale });

  if (!checkPermission(context.user.permissionSnapshot, HELPDESK_TICKET_TYPES_MANAGE)) {
    return redirect({
      href: {
        pathname: "/dashboard/access-denied",
        query: { reason: "helpdesk_ticket_types_manage_required" },
      },
      locale,
    });
  }

  const supabase = await createClient();
  const orgId = context.app.activeOrgId;

  const [typesResult, membersResult, settingsResult] = await Promise.all([
    HelpdeskTicketTypesService.listWithDetails(supabase, orgId),
    OrgMembersService.listMembers(supabase, orgId),
    HelpdeskTicketTypesService.getSettings(supabase, orgId),
  ]);

  const types = typesResult.success ? typesResult.data : [];
  const members = membersResult.success
    ? membersResult.data.map((m) => ({
        user_id: m.user_id,
        name: [m.user_first_name, m.user_last_name].filter(Boolean).join(" ") || null,
        email: m.user_email,
        avatar_url: m.user_avatar_url ?? null,
      }))
    : [];

  const settings = settingsResult.success ? settingsResult.data : null;

  return (
    <TicketTypesClient
      initialTypes={types}
      members={members}
      availableBranches={context.app.availableBranches.map((b) => ({ id: b.id, name: b.name }))}
      priorityConfigs={settings?.priority_configs ?? null}
    />
  );
}
