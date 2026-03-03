import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { INVITES_READ } from "@/lib/constants/permissions";
import { createClient } from "@/utils/supabase/server";
import { OrgInvitationsService } from "@/server/services/organization.service";
import { InvitationsClient } from "./_components/invitations-client";

export default async function InvitationsPage() {
  const locale = await getLocale();
  const context = await loadDashboardContextV2();
  if (!context?.app.activeOrgId) return redirect({ href: "/sign-in", locale });

  if (!checkPermission(context.user.permissionSnapshot, INVITES_READ)) {
    return redirect({
      href: { pathname: "/dashboard/access-denied", query: { reason: "invites_read_required" } },
      locale,
    });
  }

  const supabase = await createClient();
  const invitationsResult = await OrgInvitationsService.listInvitations(
    supabase,
    context.app.activeOrgId
  );

  return (
    <InvitationsClient
      initialInvitations={invitationsResult.success ? invitationsResult.data : []}
    />
  );
}
