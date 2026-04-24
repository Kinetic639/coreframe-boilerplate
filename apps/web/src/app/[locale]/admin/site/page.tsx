import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { loadAdminContextV2 } from "@/server/loaders/v2/load-admin-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { SUPERADMIN_ADMIN_READ } from "@/lib/constants/permissions";
import { createServiceClient } from "@/utils/supabase/service";
import { SiteSettingsService } from "@/server/services/site-settings.service";
import { SiteSettingsClient } from "./_components/site-settings-client";

export default async function SiteSettingsPage() {
  const locale = await getLocale();
  const context = await loadAdminContextV2();

  if (!context?.adminEntitlements?.enabled) {
    return redirect({ href: "/sign-in", locale });
  }

  if (!checkPermission(context.permissionSnapshot, SUPERADMIN_ADMIN_READ)) {
    return redirect({ href: "/dashboard/start", locale });
  }

  const settings = await SiteSettingsService.getSettings(createServiceClient());

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Site Settings</h1>
        <p className="mt-1 text-muted-foreground">
          Control public-facing features and page visibility.
        </p>
      </div>
      <SiteSettingsClient initialSettings={settings} />
    </div>
  );
}
