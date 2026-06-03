import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { PLANNING_SETTINGS_MANAGE } from "@/lib/constants/permissions";
import { createClient } from "@/utils/supabase/server";
import { PlanningSettingsService } from "@/server/services/planning-settings.service";
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
  const settingsResult = await PlanningSettingsService.getSettings(
    supabase,
    context.app.activeOrgId
  );
  const settings = settingsResult.success ? settingsResult.data : null;

  return <PlanningSettingsClient settings={settings} />;
}
