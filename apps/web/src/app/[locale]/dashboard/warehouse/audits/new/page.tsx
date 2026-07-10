import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { checkPermission } from "@/lib/utils/permissions";
import { WAREHOUSE_AUDITS_MANAGE } from "@/lib/constants/permissions";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { createClient } from "@/utils/supabase/server";
import { WarehouseLocationsService } from "@/server/services/warehouse-locations.service";
import { InventoryProductsService } from "@/server/services/inventory-products.service";
import { AuditWizard } from "./_components/audit-wizard";

export default async function NewWarehouseAuditPage() {
  const locale = await getLocale();
  const context = await loadDashboardContextV2();

  if (!context?.app.activeOrgId) return redirect({ href: "/sign-in", locale });
  if (!checkPermission(context.user.permissionSnapshot, WAREHOUSE_AUDITS_MANAGE)) {
    return redirect({
      href: { pathname: "/dashboard/access-denied", query: { reason: "warehouse_audits_manage" } },
      locale,
    });
  }

  const branchId = context.app.activeBranchId ?? null;
  const supabase = await createClient();

  const [locationsResult, suppliersResult, variantsResult, balancesResult] = await Promise.all([
    branchId
      ? WarehouseLocationsService.listByBranch(supabase, context.app.activeOrgId, branchId)
      : Promise.resolve({ success: true as const, data: [] }),
    InventoryProductsService.listSuppliers(supabase, context.app.activeOrgId),
    supabase
      .from("inventory_variants")
      .select("id, default_supplier_id")
      .eq("organization_id", context.app.activeOrgId),
    branchId
      ? supabase
          .from("inventory_balances")
          .select("variant_id, location_id, on_hand_quantity")
          .eq("organization_id", context.app.activeOrgId)
          .eq("branch_id", branchId)
      : Promise.resolve({ data: [] }),
  ]);

  const allVariants = (variantsResult.data ?? []) as {
    id: string;
    default_supplier_id: string | null;
  }[];
  const variantSupplierById = new Map(allVariants.map((v) => [v.id, v.default_supplier_id]));

  const allBalances = (balancesResult.data ?? []) as {
    variant_id: string;
    location_id: string;
    on_hand_quantity: number;
  }[];
  const positiveBalances = allBalances.filter((b) => b.on_hand_quantity > 0);
  const zeroBalances = allBalances.filter((b) => b.on_hand_quantity <= 0);

  // Per-location annotations shown in the location picker row: how many
  // distinct variants are in stock (qty > 0) vs. assigned to this location
  // but currently at zero (a tracked balance row that reads 0).
  const statsByLocation = new Map<string, { inStock: Set<string>; zeroStock: Set<string> }>();
  const getEntry = (locationId: string) => {
    const existing = statsByLocation.get(locationId);
    if (existing) return existing;
    const created = { inStock: new Set<string>(), zeroStock: new Set<string>() };
    statsByLocation.set(locationId, created);
    return created;
  };
  for (const b of positiveBalances) getEntry(b.location_id).inStock.add(b.variant_id);
  for (const b of zeroBalances) getEntry(b.location_id).zeroStock.add(b.variant_id);

  const locations = locationsResult.success
    ? locationsResult.data.map((loc) => {
        const stats = statsByLocation.get(loc.id);
        return {
          id: loc.id,
          name: loc.name,
          code: loc.code,
          parent_id: loc.parent_id,
          level: loc.level,
          inStockCount: stats?.inStock.size ?? 0,
          zeroStockCount: stats?.zeroStock.size ?? 0,
        };
      })
    : [];

  const suppliers = suppliersResult.success ? suppliersResult.data : [];

  // Every existing balance row (positive AND zero) — the count-session RPC
  // only ever seeds lines from rows that already exist here, so this is the
  // exact source of truth the zero-stock preview math needs: how many of
  // these rows already read zero within the selected scope.
  const stockIndex = allBalances.map((b) => ({
    variantId: b.variant_id,
    locationId: b.location_id,
    supplierId: variantSupplierById.get(b.variant_id) ?? null,
    isZero: b.on_hand_quantity <= 0,
  }));

  return (
    <AuditWizard
      branchId={branchId}
      locations={locations}
      suppliers={suppliers}
      stockIndex={stockIndex}
    />
  );
}
