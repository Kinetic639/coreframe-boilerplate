import { redirect } from "@/i18n/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { checkPermission } from "@/lib/utils/permissions";
import { WAREHOUSE_REPORTS_READ } from "@/lib/constants/permissions";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { createClient } from "@/utils/supabase/server";
import { InventoryCountSessionsService } from "@/server/services/inventory-count-sessions.service";
import { enrichReorderReportRows } from "../../_lib/enrich-reorder-report.server";
import { ReorderSuggestionsPanel } from "../../_components/reorder-suggestions-panel";

export default async function ReorderReportPage() {
  const locale = await getLocale();
  const t = await getTranslations("warehouseReports.reorder");
  const context = await loadDashboardContextV2();

  if (!context?.app.activeOrgId) return redirect({ href: "/sign-in", locale });
  if (!checkPermission(context.user.permissionSnapshot, WAREHOUSE_REPORTS_READ)) {
    return redirect({
      href: { pathname: "/dashboard/access-denied", query: { reason: "warehouse_reports_read" } },
      locale,
    });
  }

  const branchId = context.app.activeBranchId ?? null;
  if (!branchId) {
    return (
      <div className="p-4 md:p-6">
        <ReorderSuggestionsPanel rows={[]} branchId="" />
      </div>
    );
  }

  const supabase = await createClient();
  const reportResult = await InventoryCountSessionsService.getReorderReport(
    supabase,
    context.app.activeOrgId,
    branchId
  );
  const rows = reportResult.success
    ? await enrichReorderReportRows(supabase, context.app.activeOrgId, branchId, reportResult.data)
    : [];

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div>
        <h1 className="text-lg font-bold text-foreground">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>
      <ReorderSuggestionsPanel rows={rows} branchId={branchId} />
    </div>
  );
}
