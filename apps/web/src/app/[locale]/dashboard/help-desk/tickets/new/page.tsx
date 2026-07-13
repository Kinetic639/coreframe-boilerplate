import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { HELPDESK_TICKETS_CREATE } from "@/lib/constants/permissions";
import { createClient } from "@/utils/supabase/server";
import { HelpdeskTicketTypesService } from "@/server/services/helpdesk-ticket-types.service";
import { OrgMembersService } from "@/server/services/organization.service";
import { NewTicketForm } from "./_components/new-ticket-form";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function NewTicketPage({ searchParams }: PageProps = {}) {
  const locale = await getLocale();
  const context = await loadDashboardContextV2();

  if (!context?.app.activeOrgId) return redirect({ href: "/sign-in", locale });

  if (!checkPermission(context.user.permissionSnapshot, HELPDESK_TICKETS_CREATE)) {
    return redirect({
      href: {
        pathname: "/dashboard/access-denied",
        query: { reason: "helpdesk_tickets_create_required" },
      },
      locale,
    });
  }

  const supabase = await createClient();
  const orgId = context.app.activeOrgId;

  const [ticketTypesResult, membersResult, settingsResult] = await Promise.all([
    HelpdeskTicketTypesService.list(supabase, orgId, false),
    OrgMembersService.listMembers(supabase, orgId),
    HelpdeskTicketTypesService.getSettings(supabase, orgId),
  ]);

  const ticketTypes = ticketTypesResult.success ? ticketTypesResult.data : [];

  const members = membersResult.success
    ? membersResult.data.map((m) => ({
        user_id: m.user_id,
        name: [m.user_first_name, m.user_last_name].filter(Boolean).join(" ") || null,
        email: m.user_email,
        avatar_url: m.user_avatar_url ?? null,
      }))
    : [];

  const settings = settingsResult.success ? settingsResult.data : null;

  const params = searchParams ? await searchParams : {};
  const asString = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const qrCodeId = asString(params.qrCodeId);
  const qrToken = asString(params.qrToken);
  const initialQr =
    qrCodeId && qrToken
      ? { qrCodeId, token: qrToken, label: asString(params.qrLabel) ?? null }
      : null;

  return (
    <NewTicketForm
      ticketTypes={ticketTypes}
      members={members}
      activeBranchId={context.app.activeBranchId ?? null}
      statusConfigs={settings?.status_configs ?? null}
      priorityConfigs={settings?.priority_configs ?? null}
      initialQr={initialQr}
    />
  );
}
