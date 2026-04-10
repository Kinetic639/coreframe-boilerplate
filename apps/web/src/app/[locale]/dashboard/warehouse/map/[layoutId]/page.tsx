import { notFound } from "next/navigation";
import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { createClient } from "@/utils/supabase/server";
import {
  WAREHOUSE_READ,
  WAREHOUSE_LAYOUTS_READ,
  WAREHOUSE_LAYOUTS_MANAGE,
  WAREHOUSE_LAYOUTS_PUBLISH,
} from "@/lib/constants/permissions";
import { WarehouseLayoutsService } from "@/server/services/warehouse-layouts.service";
import { WarehouseLocationsService } from "@/server/services/warehouse-locations.service";
import { MapEditorShell } from "./_components/map-editor-shell";

// ─── Page ─────────────────────────────────────────────────────────────────────

interface Props {
  params: Promise<{ layoutId: string }>;
}

export default async function WarehouseMapEditorPage({ params }: Props) {
  const { layoutId } = await params;
  const locale = await getLocale();
  const context = await loadDashboardContextV2();

  if (!context?.app.activeOrgId) {
    return redirect({ href: "/sign-in", locale });
  }

  const { app, user } = context;
  const snapshot = user.permissionSnapshot;

  if (!checkPermission(snapshot, WAREHOUSE_READ)) {
    return redirect({
      href: {
        pathname: "/dashboard/access-denied",
        query: { reason: "warehouse_read_required" },
      },
      locale,
    });
  }

  if (!checkPermission(snapshot, WAREHOUSE_LAYOUTS_READ)) {
    return redirect({
      href: {
        pathname: "/dashboard/access-denied",
        query: { reason: "warehouse_layouts_read_required" },
      },
      locale,
    });
  }

  if (!app.activeBranchId) {
    return redirect({ href: "/dashboard/warehouse/map", locale });
  }

  const supabase = await createClient();

  // Load layout + shapes in parallel with location list
  const [layoutResult, locationsResult] = await Promise.all([
    WarehouseLayoutsService.getWithShapes(supabase, app.activeOrgId, layoutId),
    WarehouseLocationsService.listByBranch(supabase, app.activeOrgId, app.activeBranchId),
  ]);

  if (!layoutResult.success || !layoutResult.data) {
    notFound();
  }

  // Verify the layout belongs to the active branch
  if (layoutResult.data.branch_id !== app.activeBranchId) {
    return redirect({ href: "/dashboard/warehouse/map", locale });
  }

  const locations = locationsResult.success ? locationsResult.data : [];
  const canManage = checkPermission(snapshot, WAREHOUSE_LAYOUTS_MANAGE);
  const canPublish = checkPermission(snapshot, WAREHOUSE_LAYOUTS_PUBLISH);

  return (
    <div className="-m-4 -mb-12 flex h-[calc(100vh-9rem)] flex-col overflow-hidden">
      <MapEditorShell
        initialLayout={layoutResult.data}
        locations={locations}
        branchId={app.activeBranchId}
        canManage={canManage}
        canPublish={canPublish}
      />
    </div>
  );
}
