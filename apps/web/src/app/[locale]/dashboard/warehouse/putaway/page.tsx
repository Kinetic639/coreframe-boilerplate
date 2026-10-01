import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { WAREHOUSE_INVENTORY_OPERATE, WAREHOUSE_INVENTORY_READ } from "@/lib/constants/permissions";
import { createClient } from "@/utils/supabase/server";
import { InventoryReceivingService } from "@/server/services/inventory-receiving.service";
import { PutawayBoard } from "./_components/putaway-board";

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

  return (
    <PutawayBoard
      branchId={branchId}
      receivingLocationId={pending.success ? pending.data.receivingLocationId : null}
      items={pending.success ? pending.data.items : []}
      loadError={!pending.success}
      canOperate={checkPermission(snapshot, WAREHOUSE_INVENTORY_OPERATE)}
    />
  );
}
