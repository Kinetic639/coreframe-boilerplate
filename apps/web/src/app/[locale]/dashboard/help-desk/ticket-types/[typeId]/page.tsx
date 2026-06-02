import { notFound, redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { HELPDESK_TICKET_TYPES_MANAGE } from "@/lib/constants/permissions";
import { createClient } from "@/utils/supabase/server";
import { HelpdeskTicketTypesService } from "@/server/services/helpdesk-ticket-types.service";
import { OrgMembersService } from "@/server/services/organization.service";
import { TicketTypeDetailClient } from "./_components/ticket-type-detail-client";

type PageProps = {
  params: Promise<{ typeId: string }>;
};

export default async function TicketTypeDetailPage({ params }: PageProps) {
  const locale = await getLocale();
  const context = await loadDashboardContextV2();

  if (!context?.app.activeOrgId) {
    redirect("/sign-in");
    return null;
  }

  if (!checkPermission(context.user.permissionSnapshot, HELPDESK_TICKET_TYPES_MANAGE)) {
    redirect("/dashboard/access-denied");
    return null;
  }

  const { typeId } = await params;
  const supabase = await createClient();
  const orgId = context.app.activeOrgId;

  const [typeResult, membersResult, settingsResult] = await Promise.all([
    HelpdeskTicketTypesService.getDetailById(supabase, orgId, typeId),
    OrgMembersService.listMembers(supabase, orgId),
    HelpdeskTicketTypesService.getSettings(supabase, orgId),
  ]);

  if (!typeResult.success || !typeResult.data) {
    notFound();
  }

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
    <TicketTypeDetailClient
      type={typeResult.data}
      members={members}
      availableBranches={context.app.availableBranches.map((b) => ({ id: b.id, name: b.name }))}
      priorityConfigs={settings?.priority_configs ?? null}
    />
  );
}
