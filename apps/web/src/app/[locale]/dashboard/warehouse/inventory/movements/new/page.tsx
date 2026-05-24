import { redirect } from "@/i18n/navigation";
import { getLocale, getTranslations } from "next-intl/server";
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
import { InventoryProductsService } from "@/server/services/inventory-products.service";
import { WarehouseLocationsService } from "@/server/services/warehouse-locations.service";
import { InventoryMovementNewClient } from "./_components/inventory-movement-new-client";

export default async function WarehouseInventoryNewMovementPage() {
  const locale = await getLocale();
  const t = await getTranslations("warehouseInventory.movements");
  const context = await loadDashboardContextV2();

  if (!context?.app.activeOrgId) return redirect({ href: "/sign-in", locale });
  if (
    !checkPermission(context.user.permissionSnapshot, WAREHOUSE_READ) ||
    !checkPermission(context.user.permissionSnapshot, WAREHOUSE_INVENTORY_READ) ||
    !checkPermission(context.user.permissionSnapshot, WAREHOUSE_INVENTORY_OPERATE)
  ) {
    return redirect({
      href: {
        pathname: "/dashboard/access-denied",
        query: { reason: "warehouse_inventory_operate" },
      },
      locale,
    });
  }

  const branchId = context.app.activeBranchId;
  const supabase = await createClient();
  const [variantsResult, locationsResult] = branchId
    ? await Promise.all([
        checkPermission(context.user.permissionSnapshot, WAREHOUSE_PRODUCTS_READ)
          ? InventoryProductsService.listVariantOptions(supabase, context.app.activeOrgId, branchId)
          : Promise.resolve({ success: true as const, data: [] }),
        WarehouseLocationsService.listByBranch(supabase, context.app.activeOrgId, branchId),
      ])
    : [
        { success: true as const, data: [] },
        { success: true as const, data: [] },
      ];

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col gap-4 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">{t("newMovement")}</h1>
        <p className="text-sm text-muted-foreground">{t("newMovementDescription")}</p>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {branchId ? (
          <InventoryMovementNewClient
            activeBranchId={branchId}
            canAdjust={checkPermission(context.user.permissionSnapshot, WAREHOUSE_INVENTORY_ADJUST)}
            branches={context.app.accessibleBranches.map((branch) => ({
              id: branch.id,
              name: branch.name,
            }))}
            locations={
              locationsResult.success
                ? locationsResult.data.map((location) => ({
                    id: location.id,
                    name: location.name,
                    code: location.code,
                  }))
                : []
            }
            variants={variantsResult.success ? variantsResult.data : []}
          />
        ) : (
          <div className="rounded-md border p-6 text-sm text-muted-foreground">
            {t("selectBranch")}
          </div>
        )}
      </div>
    </div>
  );
}
