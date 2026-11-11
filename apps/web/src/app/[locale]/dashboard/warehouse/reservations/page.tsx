import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { WAREHOUSE_INVENTORY_OPERATE, WAREHOUSE_INVENTORY_READ } from "@/lib/constants/permissions";
import { createClient } from "@/utils/supabase/server";
import { InventoryReservationsService } from "@/server/services/inventory-reservations.service";
import { InventoryBlocksService } from "@/server/services/inventory-blocks.service";
import { BlocksList, ReservationsList } from "@/components/warehouse/stock-commitments";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type PageProps = { searchParams?: Promise<Record<string, string | string[] | undefined>> };

/**
 * Reservations (R) and blocked stock (B) of the active branch, one screen
 * with a tab each. A row is one document (REZ / BLK); its parts open below
 * it and can be released, moved, blocked, unblocked... together.
 */
export default async function WarehouseReservationsPage({ searchParams }: PageProps) {
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

  const tab = (searchParams ? await searchParams : {}).tab === "blocks" ? "blocks" : "reservations";
  const supabase = await createClient();
  const [reservations, blocks] = await Promise.all([
    InventoryReservationsService.listActiveDetailed(supabase, context.app.activeOrgId, branchId),
    InventoryBlocksService.listActiveDetailed(supabase, context.app.activeOrgId, branchId),
  ]);
  const canOperate = checkPermission(snapshot, WAREHOUSE_INVENTORY_OPERATE);
  const loadError = <p className="text-sm text-destructive">{t("loadError")}</p>;

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-4 p-4 sm:p-6" data-testid="reservations-page">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>
      <Tabs defaultValue={tab}>
        <TabsList>
          <TabsTrigger value="reservations" data-testid="tab-reservations">
            {t("tabs.reservations")}
          </TabsTrigger>
          <TabsTrigger value="blocks" data-testid="tab-blocks">
            {t("tabs.blocks")}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="reservations" className="mt-4">
          <p className="mb-3 text-sm text-muted-foreground">{t("reservationsSubtitle")}</p>
          {reservations.success ? (
            <ReservationsList lines={reservations.data} canOperate={canOperate} />
          ) : (
            loadError
          )}
        </TabsContent>
        <TabsContent value="blocks" className="mt-4">
          <p className="mb-3 text-sm text-muted-foreground">{t("blocksSubtitle")}</p>
          {blocks.success ? (
            <BlocksList lines={blocks.data} canOperate={canOperate} branchId={branchId} />
          ) : (
            loadError
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
