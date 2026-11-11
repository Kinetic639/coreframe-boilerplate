import { getLocale, getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { Link, redirect } from "@/i18n/navigation";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { WAREHOUSE_INVENTORY_READ } from "@/lib/constants/permissions";
import { Button } from "@/components/ui/button";
import { LocationChanges } from "../_components/location-changes";

/**
 * Putaway history: repair orders whose locations changed (put away, moved,
 * issued) -- what to copy into AutoStacja. Kept off the putaway screen so
 * that one only does the putaway.
 */
export default async function PutawayChangesPage() {
  const locale = await getLocale();
  const context = await loadDashboardContextV2();
  if (!context?.app.activeOrgId) return redirect({ href: "/sign-in", locale });
  if (!checkPermission(context.user.permissionSnapshot, WAREHOUSE_INVENTORY_READ)) {
    return redirect({
      href: {
        pathname: "/dashboard/access-denied",
        query: { reason: "warehouse_inventory_read_required" },
      },
      locale,
    });
  }
  const t = await getTranslations("modules.warehouse.putaway");
  if (!context.app.activeBranchId) {
    return <p className="text-muted-foreground p-6 text-sm">{t("noBranch")}</p>;
  }

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6" data-testid="putaway-changes-page">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-1">
          <Link href="/dashboard/warehouse/putaway">
            <ArrowLeft className="mr-1 h-4 w-4" />
            {t("board.back")}
          </Link>
        </Button>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          {t("board.historyTitle")}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">{t("board.historyHint")}</p>
      </div>
      <LocationChanges />
    </div>
  );
}
