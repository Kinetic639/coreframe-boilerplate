import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { ANALYTICS_READ } from "@/lib/constants/permissions";
import { getTranslations } from "next-intl/server";

export default async function AnalyticsOverviewPage() {
  const locale = await getLocale();
  const context = await loadDashboardContextV2();

  if (!context?.app.activeOrgId) {
    return redirect({ href: "/sign-in", locale });
  }

  if (!checkPermission(context.user.permissionSnapshot, ANALYTICS_READ)) {
    return redirect({
      href: { pathname: "/dashboard/access-denied", query: { reason: "analytics_read_required" } },
      locale,
    });
  }

  const t = await getTranslations("modules.analytics.pages.overview");

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t("subtitle")}</p>
      </div>
    </div>
  );
}
