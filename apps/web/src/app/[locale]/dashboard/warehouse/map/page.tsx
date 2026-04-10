import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { createClient } from "@/utils/supabase/server";
import { WAREHOUSE_READ, WAREHOUSE_LAYOUTS_READ } from "@/lib/constants/permissions";
import { WarehouseLayoutsService } from "@/server/services/warehouse-layouts.service";
import { MapListClient } from "./_components/map-list-client";

/**
 * /dashboard/warehouse/map
 *
 * SSR page that:
 *  1. Validates warehouse.layouts.read permission
 *  2. Fetches all layouts for the active branch server-side
 *  3. Passes them to MapListClient as initialData (React Query seeds its cache)
 */
export default async function WarehouseMapPage() {
  const locale = await getLocale();
  const context = await loadDashboardContextV2();

  if (!context?.app.activeOrgId) {
    return redirect({ href: "/sign-in", locale });
  }

  if (!checkPermission(context.user.permissionSnapshot, WAREHOUSE_READ)) {
    return redirect({
      href: {
        pathname: "/dashboard/access-denied",
        query: { reason: "warehouse_read_required" },
      },
      locale,
    });
  }

  if (!checkPermission(context.user.permissionSnapshot, WAREHOUSE_LAYOUTS_READ)) {
    return redirect({
      href: {
        pathname: "/dashboard/access-denied",
        query: { reason: "warehouse_layouts_read_required" },
      },
      locale,
    });
  }

  const supabase = await createClient();
  const { app } = context;

  const initialLayouts = app.activeBranchId
    ? await WarehouseLayoutsService.listByBranch(
        supabase,
        app.activeOrgId,
        app.activeBranchId
      ).then((r) => (r.success ? r.data : []))
    : [];

  return <MapListClient initialLayouts={initialLayouts} />;
}
