import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { parseDataViewSearchParams } from "@/components/data-view/data-view-search-params";
import { checkPermission } from "@/lib/utils/permissions";
import {
  WAREHOUSE_INVENTORY_ADJUST,
  WAREHOUSE_INVENTORY_OPERATE,
  WAREHOUSE_INVENTORY_READ,
  WAREHOUSE_PRODUCTS_READ,
  WAREHOUSE_READ,
} from "@/lib/constants/permissions";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { createClient } from "@/utils/supabase/server";
import { InventoryBalancesService } from "@/server/services/inventory-balances.service";
import { InventoryProductsService } from "@/server/services/inventory-products.service";
import { WarehouseLocationsService } from "@/server/services/warehouse-locations.service";
import { InventoryClient } from "./_components/inventory-client";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function WarehouseInventoryPage({ searchParams }: PageProps = {}) {
  const locale = await getLocale();
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

  const [balancesResult, variantsResult, locationsResult] = branchId
    ? await Promise.all([
        InventoryBalancesService.listBalances(supabase, context.app.activeOrgId, branchId, {
          search: params.search,
          sort: params.sort,
          page: params.page,
          pageSize: params.pageSize,
          filters: params.filters,
        }),
        checkPermission(context.user.permissionSnapshot, WAREHOUSE_PRODUCTS_READ)
          ? InventoryProductsService.listVariantOptions(supabase, context.app.activeOrgId)
          : Promise.resolve({ success: true as const, data: [] }),
        WarehouseLocationsService.listByBranch(supabase, context.app.activeOrgId, branchId),
      ])
    : [
        {
          success: true as const,
          data: { rows: [], totalCount: 0, page: params.page, pageSize: params.pageSize },
        },
        { success: true as const, data: [] },
        { success: true as const, data: [] },
      ];

  const initialData = balancesResult.success
    ? balancesResult.data
    : { rows: [], totalCount: 0, page: params.page, pageSize: params.pageSize };

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col gap-4 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">Inventory</h1>
        <p className="text-sm text-muted-foreground">Location-level stock balances</p>
      </div>
      <div className="min-h-0 flex-1">
        <InventoryClient
          initialData={initialData}
          variants={variantsResult.success ? variantsResult.data : []}
          locations={
            locationsResult.success
              ? locationsResult.data.map((location) => ({
                  id: location.id,
                  name: location.name,
                  code: location.code,
                }))
              : []
          }
          canOperate={checkPermission(context.user.permissionSnapshot, WAREHOUSE_INVENTORY_OPERATE)}
          canAdjust={checkPermission(context.user.permissionSnapshot, WAREHOUSE_INVENTORY_ADJUST)}
        />
      </div>
    </div>
  );
}
