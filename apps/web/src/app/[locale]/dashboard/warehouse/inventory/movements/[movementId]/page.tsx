import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { redirect, Link } from "@/i18n/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { checkPermission } from "@/lib/utils/permissions";
import {
  WAREHOUSE_INVENTORY_OPERATE,
  WAREHOUSE_INVENTORY_READ,
  WAREHOUSE_READ,
} from "@/lib/constants/permissions";
import { Button } from "@/components/ui/button";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { createClient } from "@/utils/supabase/server";
import { InventoryMovementsService } from "@/server/services/inventory-movements.service";
import { WarehouseLocationsService } from "@/server/services/warehouse-locations.service";
import { InventoryMovementDetailPanel } from "../_components/inventory-movement-detail-panel";

type PageProps = {
  params: Promise<{ movementId: string }>;
};

export default async function WarehouseInventoryMovementDetailPage({ params }: PageProps) {
  const locale = await getLocale();
  const t = await getTranslations("warehouseInventory.movements");
  const context = await loadDashboardContextV2();
  const { movementId } = await params;

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

  const branchId = context.app.activeBranchId;
  if (!branchId) return notFound();

  const supabase = await createClient();
  const [movementResult, locationsResult] = await Promise.all([
    InventoryMovementsService.getMovementDetail(
      supabase,
      context.app.activeOrgId,
      branchId,
      movementId
    ),
    WarehouseLocationsService.listByBranch(supabase, context.app.activeOrgId, branchId),
  ]);

  if (!movementResult.success || !movementResult.data) notFound();

  const stockableLocations = locationsResult.success
    ? locationsResult.data
        .filter((loc) => loc.can_store_inventory)
        .map((loc) => ({ id: loc.id, name: loc.name, code: loc.code }))
    : [];

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-6 p-6">
      <Button asChild type="button" variant="ghost" size="sm" className="w-fit">
        <Link href="/dashboard/warehouse/inventory/movements">
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t("backToMovements")}
        </Link>
      </Button>

      <section className="rounded-md border p-4 print:border-0">
        <InventoryMovementDetailPanel
          detail={movementResult.data}
          activeBranchId={branchId}
          locations={stockableLocations}
          canOperate={checkPermission(context.user.permissionSnapshot, WAREHOUSE_INVENTORY_OPERATE)}
          showOpenPageAction={false}
          showPrintAction
        />
      </section>
    </div>
  );
}
