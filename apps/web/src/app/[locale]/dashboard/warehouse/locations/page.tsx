import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { createClient } from "@/utils/supabase/server";
import { WAREHOUSE_READ, WAREHOUSE_LOCATIONS_READ } from "@/lib/constants/permissions";
import { WarehouseLocationsService } from "@/server/services/warehouse-locations.service";
import { WarehouseLayoutsService } from "@/server/services/warehouse-layouts.service";
import { WarehouseLocationVisualNodesService } from "@/server/services/warehouse-location-visual-nodes.service";
import { LocationsPageShell } from "./_components/locations-page-shell";
import type { LocationV2 } from "@/lib/types/warehouse/locations-v2";

/**
 * /dashboard/warehouse/locations — V2 Top-Down Plan Editor
 *
 * SSR page:
 * 1. Validate warehouse read permissions
 * 2. Fetch locations, layouts, and top-down visual nodes in parallel
 * 3. Pass as initialData to LocationsPageShell (React Query cache seed)
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

  if (!app.activeBranchId) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <p className="text-sm">Select a branch to view the warehouse plan.</p>
      </div>
    );
  }

  // Fetch locations + layouts in parallel
  const [locationsResult, layoutsResult] = await Promise.all([
    WarehouseLocationsService.listByBranch(supabase, app.activeOrgId, app.activeBranchId),
    WarehouseLayoutsService.listByBranch(supabase, app.activeOrgId, app.activeBranchId),
  ]);

  const initialLocations = (locationsResult.success
    ? locationsResult.data
    : []) as unknown as LocationV2[];

  const initialLayouts = layoutsResult.success ? layoutsResult.data : [];

  // Load top-down visual nodes for the first available layout
  const firstLayout = initialLayouts[0];
  let initialVisualNodes: import("@/lib/types/warehouse/locations-v2").LocationVisualNode[] = [];

  if (firstLayout) {
    const nodesResult = await WarehouseLocationVisualNodesService.listByLayout(
      supabase,
      app.activeOrgId,
      firstLayout.id,
      { viewType: "top_down" }
    );
    if (nodesResult.success) {
      initialVisualNodes =
        nodesResult.data as import("@/lib/types/warehouse/locations-v2").LocationVisualNode[];
    }
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col overflow-hidden">
      <LocationsPageShell
        initialLocations={initialLocations}
        initialLayouts={initialLayouts as import("@/lib/warehouse/layouts").WarehouseLayout[]}
        initialVisualNodes={initialVisualNodes}
        branchId={app.activeBranchId}
        orgId={app.activeOrgId}
      />
    </div>
  );
}
