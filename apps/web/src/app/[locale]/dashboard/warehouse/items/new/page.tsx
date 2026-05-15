import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { checkPermission } from "@/lib/utils/permissions";
import {
  WAREHOUSE_PRODUCTS_MANAGE,
  WAREHOUSE_PRODUCTS_READ,
  WAREHOUSE_READ,
} from "@/lib/constants/permissions";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { createClient } from "@/utils/supabase/server";
import { InventoryProductsService } from "@/server/services/inventory-products.service";
import { WarehouseLocationsService } from "@/server/services/warehouse-locations.service";
import { InventoryProductCreateClient } from "./_components/inventory-product-create-client";

export default async function WarehouseNewItemPage() {
  const locale = await getLocale();
  const context = await loadDashboardContextV2();

  if (!context?.app.activeOrgId) return redirect({ href: "/sign-in", locale });
  if (
    !checkPermission(context.user.permissionSnapshot, WAREHOUSE_READ) ||
    !checkPermission(context.user.permissionSnapshot, WAREHOUSE_PRODUCTS_READ) ||
    !checkPermission(context.user.permissionSnapshot, WAREHOUSE_PRODUCTS_MANAGE)
  ) {
    return redirect({
      href: {
        pathname: "/dashboard/access-denied",
        query: { reason: "warehouse_products_manage" },
      },
      locale,
    });
  }

  const supabase = await createClient();
  const [
    unitsResult,
    suppliersResult,
    optionGroupsResult,
    locationsResult,
    tagsResult,
    customFieldsResult,
    brandsResult,
    manufacturersResult,
    skuTemplatesResult,
  ] = await Promise.all([
    InventoryProductsService.listUnits(supabase, context.app.activeOrgId),
    InventoryProductsService.listSuppliers(supabase, context.app.activeOrgId),
    InventoryProductsService.listOptionGroupsWithValues(supabase, context.app.activeOrgId),
    context.app.activeBranchId
      ? WarehouseLocationsService.listByBranch(
          supabase,
          context.app.activeOrgId,
          context.app.activeBranchId
        )
      : Promise.resolve({ success: true as const, data: [] }),
    InventoryProductsService.listTags(supabase, context.app.activeOrgId),
    InventoryProductsService.listCustomFields(supabase, context.app.activeOrgId),
    InventoryProductsService.listBrands(supabase, context.app.activeOrgId),
    InventoryProductsService.listManufacturers(supabase, context.app.activeOrgId),
    InventoryProductsService.listSkuTemplates(supabase, context.app.activeOrgId),
  ]);

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col bg-background">
      <InventoryProductCreateClient
        units={unitsResult.success ? unitsResult.data : []}
        suppliers={suppliersResult.success ? suppliersResult.data : []}
        optionGroups={optionGroupsResult.success ? optionGroupsResult.data : []}
        locations={
          locationsResult.success
            ? locationsResult.data.map((location) => ({
                id: location.id,
                name: location.name,
                code: location.code,
              }))
            : []
        }
        tags={tagsResult.success ? tagsResult.data : []}
        customFields={customFieldsResult.success ? customFieldsResult.data : []}
        brands={brandsResult.success ? brandsResult.data : []}
        manufacturers={manufacturersResult.success ? manufacturersResult.data : []}
        skuTemplates={skuTemplatesResult.success ? skuTemplatesResult.data : []}
      />
    </div>
  );
}
