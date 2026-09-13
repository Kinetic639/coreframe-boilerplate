import { redirect } from "@/i18n/navigation";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getLocale, getTranslations } from "next-intl/server";
import { parseDataViewSearchParams } from "@/components/data-view/data-view-search-params";
import {
  createDataViewServerQueryClient,
  prefetchDataViewList,
} from "@/components/data-view/data-view-ssr";
import { dataViewKeys } from "@/components/data-view/data-view-query-keys";
import { dataViewScope } from "@/lib/data-view/ambra-data-view-scope";
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
import { prefetchInventoryProductDetail } from "./_lib/prefetch-inventory-product-detail";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function WarehouseItemsPage({ searchParams }: PageProps = {}) {
  const locale = await getLocale();
  const t = await getTranslations("warehouseInventory.list");
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
  const queryClient = createDataViewServerQueryClient();
  const entity = "inventory-products";
  const scope = dataViewScope.branch(context.app.activeOrgId, context.app.activeBranchId);
  const listParams = {
    search: params.search,
    sort: params.sort,
    page: params.page,
    pageSize: params.pageSize,
    filters: params.filters,
  };

  const prefetches: Promise<unknown>[] = [
    prefetchDataViewList({
      queryClient,
      entity,
      scope,
      params: listParams,
      fetcher: async () => {
        const result = await InventoryProductsService.listProducts(
          supabase,
          context.app.activeOrgId,
          listParams,
          context.app.activeBranchId
        );
        if (!result.success) throw new Error((result as { success: false; error: string }).error);
        return result.data;
      },
    }),
    InventoryProductsService.listCustomFields(supabase, context.app.activeOrgId, ["product"]),
  ];

  if (params.selected) {
    prefetches.push(
      prefetchInventoryProductDetail({
        queryClient,
        scope,
        selectedId: params.selected,
        fetchProduct: async (productId) => {
          const result = await InventoryProductsService.getProductDetail(
            supabase,
            context.app.activeOrgId,
            productId,
            context.app.activeBranchId
          );
          if (!result.success) throw new Error((result as { success: false; error: string }).error);
          return result.data;
        },
      })
    );
  }

  const results = await Promise.all(prefetches);
  const customFieldsResult = results[1] as Awaited<
    ReturnType<typeof InventoryProductsService.listCustomFields>
  >;

  const initialData = queryClient.getQueryData<
    Awaited<ReturnType<typeof InventoryProductsService.listProducts>> extends { data: infer T }
      ? T
      : never
  >(dataViewKeys.list(entity, scope, listParams)) ?? {
    rows: [],
    totalCount: 0,
    page: params.page,
    pageSize: params.pageSize,
  };
  const initialDataUpdatedAt =
    queryClient.getQueryState(dataViewKeys.list(entity, scope, listParams))?.dataUpdatedAt ?? 0;

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col gap-4 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>
      <div className="min-h-0 flex-1">
        <HydrationBoundary state={dehydrate(queryClient)}>
          <InventoryProductsClient
            organizationId={context.app.activeOrgId}
            branchId={context.app.activeBranchId}
            initialData={initialData}
            initialDataUpdatedAt={initialDataUpdatedAt}
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
        </HydrationBoundary>
      </div>
    </div>
  );
}
