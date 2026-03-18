import { redirect } from "@/i18n/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { ACCOUNT_PREFERENCES_READ } from "@/lib/constants/permissions";
import { PreferencesClient } from "./_components/preferences-client";

export default async function PreferencesPage() {
  const locale = await getLocale();
  const context = await loadDashboardContextV2();
  if (!context?.app.activeOrgId) return redirect({ href: "/sign-in", locale });

  if (!checkPermission(context.user.permissionSnapshot, ACCOUNT_PREFERENCES_READ)) {
    return redirect({ href: "/dashboard/start", locale });
  }

  const t = await getTranslations("PreferencesPage");

  return (
    <PreferencesClient
      translations={{
        description: t("description"),
      }}
    />
  );
}
