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
import { InventoryReceivingService } from "@/server/services/inventory-receiving.service";
import { ReceiptPutawayReport } from "./_components/receipt-putaway-report";
import { ReceiptCorrectionDialog } from "./_components/receipt-correction-dialog";

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

  const detail = movementResult.data;
  // Zone 5: a posted PZ shows where each of its lines was put away.
  const reportResult =
    detail.movement_type_code === "101" && detail.status === "posted"
      ? await InventoryReceivingService.getReceiptReport(
          supabase,
          context.app.activeOrgId,
          branchId,
          {
            movementId: detail.id,
            postedAt: detail.posted_at,
            lines: detail.lines,
          }
        )
      : null;

  const canOperate = checkPermission(context.user.permissionSnapshot, WAREHOUSE_INVENTORY_OPERATE);
  // KPZ: a posted PZ can be corrected downwards, line by line.
  const correctedResult =
    canOperate && detail.movement_type_code === "101" && detail.status === "posted"
      ? await InventoryMovementsService.getCorrectableReceiptLines(supabase, detail.id)
      : null;
  const correctionLines = correctedResult?.success
    ? detail.lines.map((line) => ({
        id: line.id,
        lineNumber: line.line_number,
        sku: line.sku,
        productName: line.product_name,
        unitCode: line.unit_code,
        quantity: line.quantity,
        correctable: Math.max(line.quantity - (correctedResult.data[line.id] ?? 0), 0),
      }))
    : null;

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
          canOperate={canOperate}
          showOpenPageAction={false}
          showPrintAction
          extraActions={
            correctionLines ? (
              <ReceiptCorrectionDialog
                movementId={detail.id}
                documentNumber={detail.document_number}
                lines={correctionLines}
              />
            ) : null
          }
        />
      </section>

      {reportResult?.success && (
        <ReceiptPutawayReport documentNumber={detail.document_number} lines={reportResult.data} />
      )}
    </div>
  );
}
