import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { checkPermission } from "@/lib/utils/permissions";
import { WAREHOUSE_AUDITS_MANAGE, WAREHOUSE_AUDITS_READ } from "@/lib/constants/permissions";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { createClient } from "@/utils/supabase/server";
import { InventoryCountSessionsService } from "@/server/services/inventory-count-sessions.service";
import { AuditsDashboardClient } from "./_components/audits-dashboard-client";

export default async function WarehouseAuditsPage() {
  const locale = await getLocale();
  const context = await loadDashboardContextV2();

  if (!context?.app.activeOrgId) return redirect({ href: "/sign-in", locale });
  if (!checkPermission(context.user.permissionSnapshot, WAREHOUSE_AUDITS_READ)) {
    return redirect({
      href: { pathname: "/dashboard/access-denied", query: { reason: "warehouse_audits_read" } },
      locale,
    });
  }

  const branchId = context.app.activeBranchId ?? null;
  const supabase = await createClient();

  const listResult = branchId
    ? await InventoryCountSessionsService.listSessions(
        supabase,
        context.app.activeOrgId,
        branchId,
        {
          page: 1,
          pageSize: 50,
        }
      )
    : { success: true as const, data: { rows: [], totalCount: 0, page: 1, pageSize: 50 } };

  return (
    <div className="p-4 md:p-6">
      <AuditsDashboardClient
        branchId={branchId}
        initialData={
          listResult.success ? listResult.data : { rows: [], totalCount: 0, page: 1, pageSize: 50 }
        }
        canManage={checkPermission(context.user.permissionSnapshot, WAREHOUSE_AUDITS_MANAGE)}
      />
    </div>
  );
}
