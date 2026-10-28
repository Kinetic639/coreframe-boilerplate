import { redirect } from "@/i18n/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { parseDataViewSearchParams } from "@/components/data-view/data-view-search-params";
import { checkPermission } from "@/lib/utils/permissions";
import {
  WAREHOUSE_INVENTORY_OPERATE,
  WAREHOUSE_INVENTORY_READ,
  WAREHOUSE_READ,
} from "@/lib/constants/permissions";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { createClient } from "@/utils/supabase/server";
import { InventoryMovementsService } from "@/server/services/inventory-movements.service";
import { WarehouseLocationsService } from "@/server/services/warehouse-locations.service";
import { InventoryMovementsClient } from "./_components/inventory-movements-client";
import { InternalOrderOperationsService } from "@/server/services/internal-orders.service";
import { BranchTransfers } from "@/components/warehouse/branch-transfers";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function WarehouseInventoryMovementsPage({ searchParams }: PageProps = {}) {
  const locale = await getLocale();
  const t = await getTranslations("warehouseInventory.movements");
  const context = await loadDashboardContextV2();

  if (!context?.app.activeOrgId) return redirect({ href: "/sign-in", locale });
  if (
    !checkPermission(context.user.permissionSnapshot, WAREHOUSE_READ) ||
    !checkPermission(context.user.permissionSnapshot, WAREHOUSE_INVENTORY_READ)
  ) {
    return redirect({
      href: { pathname: "/dashboard/access-denied", query: { reason: "warehouse_inventory_read" } },
      locale,
    });
  }

  const params = parseDataViewSearchParams(searchParams ? await searchParams : {});
  const supabase = await createClient();
  const branchId = context.app.activeBranchId;
  const [movementsResult, locationsResult] = branchId
    ? await Promise.all([
        InventoryMovementsService.listMovements(supabase, context.app.activeOrgId, branchId, {
          search: params.search,
          sort: params.sort,
          page: params.page,
          pageSize: params.pageSize,
          filters: params.filters,
        }),
        WarehouseLocationsService.listByBranch(supabase, context.app.activeOrgId, branchId),
      ])
    : [
        {
          success: true as const,
          data: { rows: [], totalCount: 0, page: params.page, pageSize: params.pageSize },
        },
        { success: true as const, data: [] },
      ];

  // MMJ- / MMJ+ not yet accepted ("w drodze", drafts): they have no number
  // yet, so they are not in the movement list below.
  const transfers = branchId
    ? await InternalOrderOperationsService.listTransfers(
        supabase,
        context.app.activeOrgId,
        branchId
      )
    : null;
  const canOperate = checkPermission(context.user.permissionSnapshot, WAREHOUSE_INVENTORY_OPERATE);

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col gap-4 overflow-y-auto p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>
      {transfers?.success && <BranchTransfers transfers={transfers.data} canOperate={canOperate} />}
      <div className="min-h-0 flex-1">
        <InventoryMovementsClient
          organizationId={context.app.activeOrgId}
          initialData={
            movementsResult.success
              ? movementsResult.data
              : { rows: [], totalCount: 0, page: params.page, pageSize: params.pageSize }
          }
          activeBranchId={branchId ?? null}
          locations={
            locationsResult.success
              ? locationsResult.data.map((location) => ({
                  id: location.id,
                  name: location.name,
                  code: location.code,
                }))
              : []
          }
          canOperate={canOperate}
        />
      </div>
    </div>
  );
}
