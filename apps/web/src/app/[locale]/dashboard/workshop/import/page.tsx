import { ArrowLeft } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import {
  WORKSHOP_REPAIR_ORDERS_READ,
  WORKSHOP_REPAIR_ORDERS_MANAGE_OWN,
  WORKSHOP_REPAIR_ORDERS_MANAGE_ALL,
} from "@/lib/constants/permissions";
import { createClient } from "@/utils/supabase/server";
import { RepairOrderImportService } from "@/server/services/repair-order-import.service";
import { RepairOrderImportPanel } from "./_components/repair-order-import-panel";

/** Workshop -- import repair orders from a source (the Matcher first). */
export default async function RepairOrderImportPage() {
  const locale = await getLocale();
  const t = await getTranslations("modules.workshop.repairOrders.import");
  const context = await loadDashboardContextV2();
  if (!context?.app.activeOrgId) return redirect({ href: "/sign-in", locale });

  const snapshot = context.user.permissionSnapshot;
  if (!checkPermission(snapshot, WORKSHOP_REPAIR_ORDERS_READ)) {
    return redirect({
      href: {
        pathname: "/dashboard/access-denied",
        query: { reason: "workshop_repair_orders_read_required" },
      },
      locale,
    });
  }
  const canApply =
    checkPermission(snapshot, WORKSHOP_REPAIR_ORDERS_MANAGE_OWN) ||
    checkPermission(snapshot, WORKSHOP_REPAIR_ORDERS_MANAGE_ALL);

  const branchId = context.app.activeBranchId;
  const sources = branchId
    ? await RepairOrderImportService.listSources(
        await createClient(),
        context.app.activeOrgId,
        branchId
      )
    : null;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 sm:p-6">
      <Button asChild type="button" variant="ghost" size="sm" className="w-fit">
        <Link href="/dashboard/workshop">
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t("back")}
        </Link>
      </Button>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t("subtitle")}</p>
      </div>
      {!branchId ? (
        <p className="text-muted-foreground text-sm">{t("noBranch")}</p>
      ) : sources?.success ? (
        <RepairOrderImportPanel sources={sources.data} canApply={canApply} />
      ) : (
        <p className="text-destructive text-sm">{t("errors.unexpected")}</p>
      )}
    </div>
  );
}
