import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { createClient } from "@/utils/supabase/server";
import { WAREHOUSE_READ, WAREHOUSE_LOCATIONS_READ } from "@/lib/constants/permissions";
import { WarehouseLocationsService } from "@/server/services/warehouse-locations.service";
import { LocationsClient } from "./_components/locations-client";

/**
 * /dashboard/warehouse/locations
 *
 * SSR page that:
 *  1. Validates warehouse read permission (layout already gates MODULE_WAREHOUSE_ACCESS)
 *  2. Fetches the flat location list for the active branch server-side
 *  3. Passes it to LocationsClient as initialData (React Query seeds its cache)
 */
export default async function WarehouseLocationsPage() {
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

  if (!checkPermission(context.user.permissionSnapshot, WAREHOUSE_LOCATIONS_READ)) {
    return redirect({
      href: {
        pathname: "/dashboard/access-denied",
        query: { reason: "warehouse_locations_read_required" },
      },
      locale,
    });
  }

  const supabase = await createClient();
  const { app } = context;

  // If no active branch, render the client with empty initial data — it will show the
  // "no branch selected" state and react to branch changes.
  const initialLocations = app.activeBranchId
    ? await WarehouseLocationsService.listByBranch(
        supabase,
        app.activeOrgId,
        app.activeBranchId
      ).then((r) => (r.success ? r.data : []))
    : [];

  return <LocationsClient initialLocations={initialLocations} />;
}
