import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { WAREHOUSE_INVENTORY_OPERATE, WAREHOUSE_INVENTORY_READ } from "@/lib/constants/permissions";
import { createClient } from "@/utils/supabase/server";
import { InventoryReceivingService } from "@/server/services/inventory-receiving.service";
import { PutawayScanService } from "@/server/services/putaway-scan.service";
import { InternalOrderOperationsService } from "@/server/services/internal-orders.service";
import { PutawayBoard } from "./_components/putaway-board";
import type { RepairOrderInfo } from "./_components/putaway-utils";

/**
 * Zone 5 -- "Rozlokowanie": everything waiting in the active branch's
 * receiving zone, in the order it is worked through: fixed locations,
 * orders that already lie somewhere (add to their container), new orders
 * (new container), free stock. The history of location changes is on its
 * own page (putaway/changes).
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
  // The QR codes of the organization load alongside: scans are then
  // recognised on the phone. Without them each scan asks the server (slower,
  // still correct), so a failed read does not block the screen.
  const [pending, qrIndex, transfers, branches] = await Promise.all([
    InventoryReceivingService.listPending(supabase, context.app.activeOrgId, branchId),
    PutawayScanService.listQrIndex(supabase, context.app.activeOrgId),
    // Between branches: arriving here, and reserved here by other branches.
    InternalOrderOperationsService.listTransfers(supabase, context.app.activeOrgId, branchId),
    InternalOrderOperationsService.listBranches(supabase, context.app.activeOrgId),
  ]);

  // Per repair order in the receiving zone: client and existing containers,
  // so the list says where each order already sits.
  // Each waiting quantity carries the documents (PZ, MM, ...) that brought it in.
  const sourced = pending.success
    ? await InventoryReceivingService.attachSources(
        supabase,
        context.app.activeOrgId,
        branchId,
        pending.data.receivingLocationId,
        pending.data.items
      )
    : null;
  const items = sourced?.success ? sourced.data : [];
  let loadError = !pending.success || !sourced?.success;
  const orderIds = [
    ...new Set(items.map((i) => i.repairOrderId).filter((id): id is string => !!id)),
  ];
  const orders: Record<string, RepairOrderInfo> = {};
  if (orderIds.length > 0) {
    const [roRes, containersRes, looseRes] = await Promise.all([
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
      // Reserved parts of these orders lying outside containers (bulk material).
      supabase
        .from("inventory_reservation_lines")
        .select(
          "location_id, reserved_quantity, released_quantity, fulfilled_quantity, repair_order_lines!inner(repair_order_id), warehouse_locations(id, code, name)"
        )
        .eq("organization_id", context.app.activeOrgId)
        .eq("branch_id", branchId)
        .in("repair_order_lines.repair_order_id", orderIds),
    ]);
    // Without them every order would look like it has nothing put away yet.
    if (roRes.error || !containersRes.success || looseRes.error) loadError = true;
    const containers = containersRes.success ? containersRes.data : {};
    const receivingId = pending.success ? pending.data.receivingLocationId : null;
    const looseByOrder = new Map<
      string,
      Map<string, NonNullable<RepairOrderInfo["looseLocations"]>[number]>
    >();
    for (const row of (looseRes.data ?? []) as unknown as Array<{
      location_id: string;
      reserved_quantity: number;
      released_quantity: number;
      fulfilled_quantity: number;
      repair_order_lines: { repair_order_id: string } | Array<{ repair_order_id: string }>;
      warehouse_locations: { id: string; code: string | null; name: string | null } | null;
    }>) {
      const open =
        Number(row.reserved_quantity) -
        Number(row.released_quantity) -
        Number(row.fulfilled_quantity);
      const rol = Array.isArray(row.repair_order_lines)
        ? row.repair_order_lines[0]
        : row.repair_order_lines;
      if (open <= 0 || !rol || !row.warehouse_locations || row.location_id === receivingId)
        continue;
      const places = looseByOrder.get(rol.repair_order_id) ?? new Map();
      places.set(row.location_id, row.warehouse_locations);
      looseByOrder.set(rol.repair_order_id, places);
    }
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
        looseLocations: [...(looseByOrder.get(ro.id)?.values() ?? [])],
      };
    }
  }

  return (
    <PutawayBoard
      branchId={branchId}
      organizationId={context.app.activeOrgId}
      qrCodes={qrIndex.success ? qrIndex.data : []}
      receivingLocationId={pending.success ? pending.data.receivingLocationId : null}
      items={items}
      orders={orders}
      loadError={loadError}
      canOperate={checkPermission(snapshot, WAREHOUSE_INVENTORY_OPERATE)}
      transfers={transfers.success ? transfers.data : { incoming: [], toSend: [], outgoing: [] }}
      transfersLoadError={!transfers.success}
      branches={(branches.success ? branches.data : []).filter((b) => b.id !== branchId)}
    />
  );
}
