import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { PLANNING_SETTINGS_MANAGE } from "@/lib/constants/permissions";
import { createClient } from "@/utils/supabase/server";
import { PlanningSettingsService } from "@/server/services/planning-settings.service";
import { OrgMembersService } from "@/server/services/organization.service";
import { PlanningSettingsClient } from "./_components/planning-settings-client";

export default async function PlanningSettingsPage() {
  const locale = await getLocale();
  const context = await loadDashboardContextV2();

  if (!context?.app.activeOrgId) return redirect({ href: "/sign-in", locale });

  if (!checkPermission(context.user.permissionSnapshot, PLANNING_SETTINGS_MANAGE)) {
    return redirect({
      href: {
        pathname: "/dashboard/access-denied",
        query: { reason: "planning_settings_manage_required" },
      },
      locale,
    });
  }

  const supabase = await createClient();
  const orgId = context.app.activeOrgId;
  const [settingsResult, membersResult] = await Promise.all([
    PlanningSettingsService.getSettings(supabase, orgId),
    OrgMembersService.listMembers(supabase, orgId),
  ]);
  const settings = settingsResult.success ? settingsResult.data : null;
  const members = membersResult.success
    ? membersResult.data.map((m) => ({
        user_id: m.user_id,
        name: [m.user_first_name, m.user_last_name].filter(Boolean).join(" ") || null,
        email: m.user_email,
      }))
    : [];

  return (
    <PlanningSettingsClient
      settings={settings}
      orgId={orgId}
      currentUserId={context.user.user?.id ?? ""}
      members={members}
    />
  );
}
