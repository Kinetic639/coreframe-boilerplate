import { redirect } from "@/i18n/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { parseDataViewSearchParams } from "@/components/data-view/data-view-search-params";
import { checkPermission } from "@/lib/utils/permissions";
import {
  WAREHOUSE_INVENTORY_READ,
  WAREHOUSE_INVENTORY_REVERSE,
  WAREHOUSE_READ,
} from "@/lib/constants/permissions";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { createClient } from "@/utils/supabase/server";
import { InventoryMovementsService } from "@/server/services/inventory-movements.service";
import { InventoryMovementsClient } from "./_components/inventory-movements-client";

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
  const movementsResult = branchId
    ? await InventoryMovementsService.listMovements(supabase, context.app.activeOrgId, branchId, {
        search: params.search,
        sort: params.sort,
        page: params.page,
        pageSize: params.pageSize,
        filters: params.filters,
      })
    : {
        success: true as const,
        data: { rows: [], totalCount: 0, page: params.page, pageSize: params.pageSize },
      };

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col gap-4 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>
      <div className="min-h-0 flex-1">
        <InventoryMovementsClient
          initialData={
            movementsResult.success
              ? movementsResult.data
              : { rows: [], totalCount: 0, page: params.page, pageSize: params.pageSize }
          }
          canReverse={checkPermission(context.user.permissionSnapshot, WAREHOUSE_INVENTORY_REVERSE)}
        />
      </div>
    </div>
  );
}
