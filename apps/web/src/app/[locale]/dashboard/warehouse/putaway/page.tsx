import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { WAREHOUSE_INVENTORY_OPERATE, WAREHOUSE_INVENTORY_READ } from "@/lib/constants/permissions";
import { createClient } from "@/utils/supabase/server";
import { InventoryReceivingService } from "@/server/services/inventory-receiving.service";
import { PutawayScanService } from "@/server/services/putaway-scan.service";
import { PutawayBoard } from "./_components/putaway-board";
import type { RepairOrderInfo } from "./_components/putaway-utils";

/**
 * Zone 5 -- "Do rozlokowania": everything waiting in the active branch's
 * receiving zone. Mobile-first: pick an item, scan the location, confirm.
 * Stock in the receiving zone is not available until it is put away.
 */
export default async function PutawayPage() {
  const locale = await getLocale();
  const context = await loadDashboardContextV2();
  if (!context?.app.activeOrgId) return redirect({ href: "/sign-in", locale });

  const snapshot = context.user.permissionSnapshot;
  if (!checkPermission(snapshot, WAREHOUSE_INVENTORY_READ)) {
    return redirect({
      href: {
        pathname: "/dashboard/access-denied",
        query: { reason: "warehouse_inventory_read_required" },
      },
      locale,
    });
  }

  const t = await getTranslations("modules.warehouse.putaway");
  const branchId = context.app.activeBranchId;
  if (!branchId) {
    return <p className="text-muted-foreground p-6 text-sm">{t("noBranch")}</p>;
  }

  const supabase = await createClient();
  const pending = await InventoryReceivingService.listPending(
    supabase,
    context.app.activeOrgId,
    branchId
  );

  // Per repair order in the receiving zone: client and existing containers,
  // so the list says where each order already sits.
  const items = pending.success ? pending.data.items : [];
  const orderIds = [
    ...new Set(items.map((i) => i.repairOrderId).filter((id): id is string => !!id)),
  ];
  const orders: Record<string, RepairOrderInfo> = {};
  if (orderIds.length > 0) {
    const [roRes, containersRes] = await Promise.all([
      supabase
        .from("repair_orders")
        .select("id, zl_number, client_name, vehicle_brand")
        .in("id", orderIds),
      PutawayScanService.containersForRepairOrders(
        supabase,
        context.app.activeOrgId,
        branchId,
        orderIds
      ),
    ]);
    const containers = containersRes.success ? containersRes.data : {};
    for (const ro of (roRes.data ?? []) as Array<{
      id: string;
      zl_number: string | null;
      client_name: string | null;
      vehicle_brand: string | null;
    }>) {
      orders[ro.id] = {
        zlNumber: ro.zl_number,
        clientName: ro.client_name,
        vehicleBrand: ro.vehicle_brand,
        containers: containers[ro.id] ?? [],
      };
    }
  }

  return (
    <PutawayBoard
      branchId={branchId}
      receivingLocationId={pending.success ? pending.data.receivingLocationId : null}
      items={items}
      orders={orders}
      loadError={!pending.success}
      canOperate={checkPermission(snapshot, WAREHOUSE_INVENTORY_OPERATE)}
    />
  );
}
