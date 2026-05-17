import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { parseDataViewSearchParams } from "@/components/data-view/data-view-search-params";
import { checkPermission } from "@/lib/utils/permissions";
import {
  WAREHOUSE_PRODUCTS_MANAGE,
  WAREHOUSE_PRODUCTS_READ,
  WAREHOUSE_IMPORTS_MANAGE,
  WAREHOUSE_READ,
} from "@/lib/constants/permissions";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { createClient } from "@/utils/supabase/server";
import { InventoryProductsService } from "@/server/services/inventory-products.service";
import { InventoryProductsClient } from "./_components/inventory-products-client";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function WarehouseItemsPage({ searchParams }: PageProps = {}) {
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

  const params = parseDataViewSearchParams(searchParams ? await searchParams : {});
  const supabase = await createClient();
  const [productsResult, customFieldsResult] = await Promise.all([
    InventoryProductsService.listProducts(supabase, context.app.activeOrgId, {
      search: params.search,
      sort: params.sort,
      page: params.page,
      pageSize: params.pageSize,
      filters: params.filters,
    }),
    InventoryProductsService.listCustomFields(supabase, context.app.activeOrgId, ["product"]),
  ]);

  const initialData = productsResult.success
    ? productsResult.data
    : { rows: [], totalCount: 0, page: params.page, pageSize: params.pageSize };

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col gap-4 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">Products</h1>
        <p className="text-sm text-muted-foreground">Inventory product catalog and default SKUs</p>
      </div>
      <div className="min-h-0 flex-1">
        <InventoryProductsClient
          initialData={initialData}
          customFields={customFieldsResult.success ? customFieldsResult.data : []}
          canManageProducts={checkPermission(
            context.user.permissionSnapshot,
            WAREHOUSE_PRODUCTS_MANAGE
          )}
          canImportProducts={
            checkPermission(context.user.permissionSnapshot, WAREHOUSE_IMPORTS_MANAGE) ||
            checkPermission(context.user.permissionSnapshot, WAREHOUSE_PRODUCTS_MANAGE)
          }
        />
      </div>
    </div>
  );
}
