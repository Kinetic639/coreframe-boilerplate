import { notFound, redirect as nextRedirect } from "next/navigation";
import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { checkPermission } from "@/lib/utils/permissions";
import {
  WAREHOUSE_INVENTORY_OPERATE,
  WAREHOUSE_INVENTORY_READ,
  WAREHOUSE_PRODUCTS_READ,
  WAREHOUSE_READ,
} from "@/lib/constants/permissions";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { createClient } from "@/utils/supabase/server";
import { InventoryMovementsService } from "@/server/services/inventory-movements.service";
import { InventoryProductsService } from "@/server/services/inventory-products.service";
import { WarehouseLocationsService } from "@/server/services/warehouse-locations.service";
import {
  MovementDocumentForm,
  type MovementFormInitialValues,
} from "../../new/_components/movement-document-form";

type PageProps = {
  params: Promise<{ movementId: string }>;
};

export default async function EditDraftMovementPage({ params }: PageProps) {
  const locale = await getLocale();
  const context = await loadDashboardContextV2();
  const { movementId } = await params;

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
  if (!branchId) return notFound();

  const supabase = await createClient();
  const [movementResult, locationsResult, variantsResult, typesResult] = await Promise.all([
    InventoryMovementsService.getMovementDetail(
      supabase,
      context.app.activeOrgId,
      branchId,
      movementId
    ),
    WarehouseLocationsService.listByBranch(supabase, context.app.activeOrgId, branchId),
    checkPermission(context.user.permissionSnapshot, WAREHOUSE_PRODUCTS_READ)
      ? InventoryProductsService.listVariantOptions(supabase, context.app.activeOrgId, branchId)
      : Promise.resolve({ success: true as const, data: [] }),
    InventoryMovementsService.listMovementTypes(supabase, context.app.activeOrgId),
  ]);

  if (!movementResult.success || !movementResult.data) return notFound();

  const detail = movementResult.data;

  if (detail.status !== "draft") {
    return nextRedirect(`/${locale}/dashboard/warehouse/inventory/movements/${movementId}`);
  }

  const stockableLocations = locationsResult.success
    ? locationsResult.data
        .filter((loc) => loc.can_store_inventory)
        .map((loc) => ({ id: loc.id, name: loc.name, code: loc.code }))
    : [];

  const allVariants = variantsResult.success ? variantsResult.data : [];

  const initialValues: MovementFormInitialValues = {
    movementId: detail.id,
    movementTypeCode: detail.movement_type_code,
    draftNumber: detail.draft_number ?? "",
    documentDate: detail.document_date ?? new Date().toISOString().split("T")[0],
    operationDate: detail.operation_date ?? new Date().toISOString().split("T")[0],
    counterpartyName: detail.counterparty_name ?? "",
    externalReference: detail.external_reference ?? "",
    note: detail.note ?? "",
    lines: detail.lines.map((l) => {
      const variant = allVariants.find((v) => v.id === l.variant_id);
      return {
        variant_id: l.variant_id,
        unit_id: variant?.unit_id ?? "",
        sku: l.sku,
        product_name: l.product_name,
        unit_code: l.unit_code,
        quantity: l.quantity,
        source_location_id: l.source_location_id ?? null,
        destination_location_id: l.destination_location_id ?? null,
      };
    }),
  };

  return (
    <MovementDocumentForm
      mode="edit"
      branchName={context.app.activeBranch?.name ?? ""}
      movementTypes={typesResult.success ? typesResult.data : []}
      stockableLocations={stockableLocations}
      variants={allVariants}
      initialValues={initialValues}
    />
  );
}
