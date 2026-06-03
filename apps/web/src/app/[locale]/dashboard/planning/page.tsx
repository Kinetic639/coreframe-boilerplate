import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { PLANNING_READ } from "@/lib/constants/permissions";
import { getTranslations } from "next-intl/server";

const FEATURE_CARDS = ["tasks", "boards"] as const;

export default async function PlanningOverviewPage() {
  const locale = await getLocale();
  const context = await loadDashboardContextV2();

  if (!context?.app.activeOrgId) {
    return redirect({ href: "/sign-in", locale });
  }

  if (!checkPermission(context.user.permissionSnapshot, PLANNING_READ)) {
    return redirect({
      href: {
        pathname: "/dashboard/access-denied",
        query: { reason: "planning_read_required" },
      },
      locale,
    });
  }

  const t = await getTranslations("modules.planning");

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("pages.overview.title")}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t("pages.overview.subtitle")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURE_CARDS.map((key) => (
          <div
            key={key}
            className="bg-card text-card-foreground border-border flex flex-col gap-2 rounded-lg border p-5"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{t(`features.${key}`)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
