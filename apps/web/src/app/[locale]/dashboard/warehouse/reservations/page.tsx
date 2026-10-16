import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { WAREHOUSE_INVENTORY_OPERATE, WAREHOUSE_INVENTORY_READ } from "@/lib/constants/permissions";
import { createClient } from "@/utils/supabase/server";
import { InventoryReservationsService } from "@/server/services/inventory-reservations.service";
import { ReservationsList } from "@/components/warehouse/stock-commitments";

/** Reservations (R) of the active branch: release, transfer, block (stage E6). */
export default async function WarehouseReservationsPage() {
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
  const t = await getTranslations("modules.warehouse.stockCommitments.pages");
  const branchId = context.app.activeBranchId;
  if (!branchId) return <p className="p-6 text-sm text-muted-foreground">{t("noBranch")}</p>;

  const supabase = await createClient();
  const result = await InventoryReservationsService.listActiveDetailed(
    supabase,
    context.app.activeOrgId,
    branchId
  );

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-4 p-4 sm:p-6" data-testid="reservations-page">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          {t("reservationsTitle")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("reservationsSubtitle")}</p>
      </div>
      {result.success ? (
        <ReservationsList
          lines={result.data}
          canOperate={checkPermission(snapshot, WAREHOUSE_INVENTORY_OPERATE)}
        />
      ) : (
        <p className="text-sm text-destructive">{t("loadError")}</p>
      )}
    </div>
  );
}
