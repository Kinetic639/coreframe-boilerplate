import { redirect } from "@/i18n/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { PLANNING_TASKS_READ } from "@/lib/constants/permissions";
import { LayoutGrid } from "lucide-react";

export default async function PlanningBoardsPage() {
  const locale = await getLocale();
  const t = await getTranslations("modules.planning.pages.board");
  const context = await loadDashboardContextV2();

  if (!context?.app.activeOrgId) return redirect({ href: "/sign-in", locale });

  if (!checkPermission(context.user.permissionSnapshot, PLANNING_TASKS_READ)) {
    return redirect({
      href: {
        pathname: "/dashboard/access-denied",
        query: { reason: "planning_tasks_read_required" },
      },
      locale,
    });
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4 p-12 text-center">
      <LayoutGrid className="h-10 w-10 text-muted-foreground" />
      <div>
        <p className="font-medium">{t("title")}</p>
        <p className="text-muted-foreground mt-1 text-sm">{t("comingSoon")}</p>
      </div>
    </div>
  );
}
