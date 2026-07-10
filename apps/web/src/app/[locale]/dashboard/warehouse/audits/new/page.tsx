import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { checkPermission } from "@/lib/utils/permissions";
import { WAREHOUSE_AUDITS_MANAGE } from "@/lib/constants/permissions";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { createClient } from "@/utils/supabase/server";
import { WarehouseLocationsService } from "@/server/services/warehouse-locations.service";
import { InventoryProductsService } from "@/server/services/inventory-products.service";
import { AuditWizard } from "./_components/audit-wizard";

export default async function NewWarehouseAuditPage() {
  const locale = await getLocale();
  const context = await loadDashboardContextV2();

  if (!context?.app.activeOrgId) return redirect({ href: "/sign-in", locale });
  if (!checkPermission(context.user.permissionSnapshot, WAREHOUSE_AUDITS_MANAGE)) {
    return redirect({
      href: { pathname: "/dashboard/access-denied", query: { reason: "warehouse_audits_manage" } },
      locale,
    });
  }

  const branchId = context.app.activeBranchId ?? null;
  const supabase = await createClient();

  const [locationsResult, suppliersResult] = await Promise.all([
    branchId
      ? WarehouseLocationsService.listByBranch(supabase, context.app.activeOrgId, branchId)
      : Promise.resolve({ success: true as const, data: [] }),
    InventoryProductsService.listSuppliers(supabase, context.app.activeOrgId),
  ]);

  const locations = locationsResult.success
    ? locationsResult.data.map((loc) => ({
        id: loc.id,
        name: loc.name,
        code: loc.code,
        parent_id: loc.parent_id,
        level: loc.level,
      }))
    : [];

  const suppliers = suppliersResult.success ? suppliersResult.data : [];

  return (
    <AuditWizard
      branchId={branchId}
      locations={locations}
      suppliers={suppliers}
      countNumberHint="CNT-NEW"
    />
  );
}
