import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { HELPDESK_SETTINGS_MANAGE } from "@/lib/constants/permissions";
import { createClient } from "@/utils/supabase/server";
import { HelpdeskTicketTypesService } from "@/server/services/helpdesk-ticket-types.service";
import { HelpDeskSettingsClient } from "./_components/help-desk-settings-client";

export default async function HelpDeskSettingsPage() {
  const locale = await getLocale();
  const context = await loadDashboardContextV2();

  if (!context?.app.activeOrgId) return redirect({ href: "/sign-in", locale });

  if (!checkPermission(context.user.permissionSnapshot, HELPDESK_SETTINGS_MANAGE)) {
    return redirect({
      href: {
        pathname: "/dashboard/access-denied",
        query: { reason: "helpdesk_settings_manage_required" },
      },
      locale,
    });
  }

  const supabase = await createClient();
  const settingsResult = await HelpdeskTicketTypesService.getSettings(
    supabase,
    context.app.activeOrgId
  );
  const settings = settingsResult.success ? settingsResult.data : null;

  return <HelpDeskSettingsClient settings={settings} />;
}
