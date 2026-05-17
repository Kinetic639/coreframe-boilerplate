import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { checkPermission } from "@/lib/utils/permissions";
import {
  WAREHOUSE_IMPORTS_MANAGE,
  WAREHOUSE_PRODUCTS_MANAGE,
  WAREHOUSE_PRODUCTS_READ,
  WAREHOUSE_READ,
} from "@/lib/constants/permissions";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { createClient } from "@/utils/supabase/server";
import { InventoryProductsService } from "@/server/services/inventory-products.service";
import { InventoryProductsClient } from "../_components/inventory-products-client";

export default async function WarehouseItemsImportPage() {
  const locale = await getLocale();
  const context = await loadDashboardContextV2();

  if (!context?.app.activeOrgId) return redirect({ href: "/sign-in", locale });
  if (
    !checkPermission(context.user.permissionSnapshot, WAREHOUSE_READ) ||
    !checkPermission(context.user.permissionSnapshot, WAREHOUSE_PRODUCTS_READ)
  ) {
    return redirect({
      href: { pathname: "/dashboard/access-denied", query: { reason: "warehouse_products_read" } },
      locale,
    });
  }

  const canImportProducts =
    checkPermission(context.user.permissionSnapshot, WAREHOUSE_IMPORTS_MANAGE) ||
    checkPermission(context.user.permissionSnapshot, WAREHOUSE_PRODUCTS_MANAGE);

  if (!canImportProducts) {
    return redirect({
      href: { pathname: "/dashboard/access-denied", query: { reason: "warehouse_imports_manage" } },
      locale,
    });
  }

  const supabase = await createClient();
  const [unitsResult, taxRatesResult, tagsResult, customFieldsResult] = await Promise.all([
    InventoryProductsService.listUnits(supabase, context.app.activeOrgId),
    InventoryProductsService.listTaxRates(supabase, context.app.activeOrgId),
    InventoryProductsService.listTags(supabase, context.app.activeOrgId),
    InventoryProductsService.listCustomFields(supabase, context.app.activeOrgId, [
      "product",
      "variant",
    ]),
  ]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4 md:p-6">
      <InventoryProductsClient
        initialData={{ rows: [], totalCount: 0, page: 1, pageSize: 50 }}
        customFields={customFieldsResult.success ? customFieldsResult.data : []}
        units={unitsResult.success ? unitsResult.data : []}
        taxRates={taxRatesResult.success ? taxRatesResult.data : []}
        tags={tagsResult.success ? tagsResult.data : []}
        canManageProducts={checkPermission(
          context.user.permissionSnapshot,
          WAREHOUSE_PRODUCTS_MANAGE
        )}
        canImportProducts={canImportProducts}
        importOnly
      />
    </div>
  );
}
