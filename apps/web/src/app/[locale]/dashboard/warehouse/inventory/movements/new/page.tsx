import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { checkPermission } from "@/lib/utils/permissions";
import {
  WAREHOUSE_INVENTORY_OPERATE,
  WAREHOUSE_INVENTORY_READ,
  WAREHOUSE_PRODUCTS_MANAGE,
  WAREHOUSE_PRODUCTS_READ,
  WAREHOUSE_READ,
} from "@/lib/constants/permissions";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { createClient } from "@/utils/supabase/server";
import { InventoryProductsService } from "@/server/services/inventory-products.service";
import { InventoryMovementsService } from "@/server/services/inventory-movements.service";
import { InventoryMovementFieldPoliciesService } from "@/server/services/inventory-movement-field-policies.service";
import { WarehouseLocationsService } from "@/server/services/warehouse-locations.service";
import { MovementDocumentForm } from "./_components/movement-document-form";

export default async function WarehouseInventoryNewMovementPage() {
  const locale = await getLocale();
  const context = await loadDashboardContextV2();

  if (!context?.app.activeOrgId) return redirect({ href: "/sign-in", locale });
  if (
    !checkPermission(context.user.permissionSnapshot, WAREHOUSE_READ) ||
    !checkPermission(context.user.permissionSnapshot, WAREHOUSE_INVENTORY_READ) ||
    !checkPermission(context.user.permissionSnapshot, WAREHOUSE_INVENTORY_OPERATE)
  ) {
    return redirect({
      href: {
        pathname: "/dashboard/access-denied",
        query: { reason: "warehouse_inventory_operate" },
      },
      locale,
    });
  }

  const branchId = context.app.activeBranchId;
  if (!branchId) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center p-6">
        <div className="rounded-md border p-6 text-sm text-muted-foreground">
          Select a branch to create movements.
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const [variantsResult, locationsResult, typesResult, unitsResult, policiesResult] =
    await Promise.all([
      checkPermission(context.user.permissionSnapshot, WAREHOUSE_PRODUCTS_READ)
        ? InventoryProductsService.listVariantOptions(supabase, context.app.activeOrgId, branchId)
        : Promise.resolve({ success: true as const, data: [] }),
      WarehouseLocationsService.listByBranch(supabase, context.app.activeOrgId, branchId),
      InventoryMovementsService.listMovementTypes(supabase, context.app.activeOrgId),
      InventoryProductsService.listUnits(supabase, context.app.activeOrgId),
      InventoryMovementFieldPoliciesService.listForOrganization(supabase, context.app.activeOrgId),
    ]);

  const stockableLocations = locationsResult.success
    ? locationsResult.data
        .filter((loc) => loc.can_store_inventory)
        .map((loc) => ({ id: loc.id, name: loc.name, code: loc.code }))
    : [];

  return (
    <MovementDocumentForm
      mode="create"
      organizationName={context.app.activeOrg?.name ?? ""}
      branchName={context.app.activeBranch?.name ?? ""}
      createdByName={
        [context.user.user?.first_name, context.user.user?.last_name].filter(Boolean).join(" ") ||
        context.user.user?.email ||
        ""
      }
      movementTypes={typesResult.success ? typesResult.data : []}
      fieldPolicies={policiesResult.success ? policiesResult.data : {}}
      stockableLocations={stockableLocations}
      variants={variantsResult.success ? variantsResult.data : []}
      units={unitsResult.success ? unitsResult.data : []}
      canManageProducts={checkPermission(
        context.user.permissionSnapshot,
        WAREHOUSE_PRODUCTS_MANAGE
      )}
    />
  );
}
