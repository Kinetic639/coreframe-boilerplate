import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { HELPDESK_READ } from "@/lib/constants/permissions";
import { getTranslations } from "next-intl/server";

const FEATURE_CARDS = [
  "tickets",
  "ticketTypes",
  "crossModule",
  "comments",
  "activity",
  "settings",
] as const;

export default async function HelpDeskOverviewPage() {
  const locale = await getLocale();
  const context = await loadDashboardContextV2();

  if (!context?.app.activeOrgId) {
    return redirect({ href: "/sign-in", locale });
  }

  if (!checkPermission(context.user.permissionSnapshot, HELPDESK_READ)) {
    return redirect({
      href: {
        pathname: "/dashboard/access-denied",
        query: { reason: "helpdesk_read_required" },
      },
      locale,
    });
  }

  const t = await getTranslations("modules.helpDesk");

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
            className="bg-card text-card-foreground border-border flex flex-col gap-2 rounded-lg border p-5 opacity-60"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{t(`features.${key}`)}</span>
              <span className="bg-muted text-muted-foreground rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                {t("features.comingSoon")}
              </span>
            </div>
            <p className="text-muted-foreground text-xs">{t("pages.overview.subtitle")}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
