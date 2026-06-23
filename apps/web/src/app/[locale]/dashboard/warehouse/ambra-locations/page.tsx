import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { checkPermission } from "@/lib/utils/permissions";
import { WAREHOUSE_LOCATIONS_READ, WAREHOUSE_READ } from "@/lib/constants/permissions";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { WarehouseLocationsService } from "@/server/services/warehouse-locations.service";
import { AmbraLocationInventoryService } from "@/server/services/ambra-location-inventory.service";
import { InventoryProductsService } from "@/server/services/inventory-products.service";
import { createClient } from "@/utils/supabase/server";
import { AmbraLocationsClient } from "./_components/ambra-locations-client";
import { createAmbraBranch, warehouseLocationsToAmbra } from "./_lib/warehouse-location-adapter";

export default async function AmbraWarehouseLocationsPage() {
  const locale = await getLocale();
  const context = await loadDashboardContextV2();

  if (!context?.app.activeOrgId) {
    return redirect({ href: "/sign-in", locale });
  }

  if (
    !checkPermission(context.user.permissionSnapshot, WAREHOUSE_READ) ||
    !checkPermission(context.user.permissionSnapshot, WAREHOUSE_LOCATIONS_READ)
  ) {
    return redirect({
      href: {
        pathname: "/dashboard/access-denied",
        query: { reason: "warehouse_locations_read_required" },
      },
      locale,
    });
  }

  const branchId = context.app.activeBranchId;
  const supabase = await createClient();
  const locationsResult = branchId
    ? await WarehouseLocationsService.listByBranch(supabase, context.app.activeOrgId, branchId)
    : { success: true as const, data: [] };
  const inventorySnapshotResult = branchId
    ? await AmbraLocationInventoryService.getSnapshot(supabase, context.app.activeOrgId, branchId)
    : {
        success: true as const,
        data: { balances: [], movements: [], containers: [], putawayRules: [] },
      };
  const variantOptionsResult = branchId
    ? await InventoryProductsService.listVariantOptions(supabase, context.app.activeOrgId, branchId)
    : { success: true as const, data: [] };

  return (
    <AmbraLocationsClient
      activeBranch={createAmbraBranch(branchId, context.app.activeBranch?.name)}
      initialLocations={
        locationsResult.success ? warehouseLocationsToAmbra(locationsResult.data) : []
      }
      initialInventorySnapshot={
        inventorySnapshotResult.success
          ? inventorySnapshotResult.data
          : { balances: [], movements: [], containers: [], putawayRules: [] }
      }
      variantOptions={
        variantOptionsResult.success
          ? variantOptionsResult.data.filter((v) => (v.on_hand_quantity ?? 0) > 0)
          : []
      }
    />
  );
}
