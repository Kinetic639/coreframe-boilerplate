import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { createClient } from "@/utils/supabase/server";
import { WAREHOUSE_READ, WAREHOUSE_LOCATIONS_READ } from "@/lib/constants/permissions";
import { WarehouseLocationsService } from "@/server/services/warehouse-locations.service";
import { WarehouseLocationGroupsService } from "@/server/services/warehouse-location-groups.service";
import { LocationsClient } from "./_components/locations-client";

/**
 * /dashboard/warehouse/locations
 *
 * SSR page that:
 *  1. Validates warehouse read permission
 *  2. Fetches the flat location list + location groups in parallel
 *  3. Passes them to LocationsClient as initialData (React Query seeds its cache)
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

  const [initialLocations, initialGroups] = app.activeBranchId
    ? await Promise.all([
        WarehouseLocationsService.listByBranch(supabase, app.activeOrgId, app.activeBranchId).then(
          (r) => (r.success ? r.data : [])
        ),
        WarehouseLocationGroupsService.listByBranch(
          supabase,
          app.activeOrgId,
          app.activeBranchId
        ).then((r) => (r.success ? r.data : [])),
      ])
    : [[], []];

  return <LocationsClient initialLocations={initialLocations} initialGroups={initialGroups} />;
}
