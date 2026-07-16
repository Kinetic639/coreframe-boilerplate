import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { checkPermission } from "@/lib/utils/permissions";
import { WAREHOUSE_AUDITS_MANAGE } from "@/lib/constants/permissions";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { createClient } from "@/utils/supabase/server";
import { InventoryCountSessionsService } from "@/server/services/inventory-count-sessions.service";
import { WarehouseLocationsService } from "@/server/services/warehouse-locations.service";
import { enrichCountLines } from "@/server/services/warehouse-audit-enrichment.service";
import { GuidedCountScreen } from "./_components/guided-count";
import type { GuidedCountSessionInfo } from "./_components/guided-count/types";
import type { CountSessionScope } from "@/lib/warehouse/count-session-types";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function GuidedCountPage({ params }: PageProps) {
  const { id } = await params;
  const locale = await getLocale();
  const context = await loadDashboardContextV2();

  if (!context?.app.activeOrgId) return redirect({ href: "/sign-in", locale });
  if (!checkPermission(context.user.permissionSnapshot, WAREHOUSE_AUDITS_MANAGE)) {
    return redirect({
      href: { pathname: "/dashboard/access-denied", query: { reason: "warehouse_audits_manage" } },
      locale,
    });
  }

  const supabase = await createClient();
  const branchId = context.app.activeBranchId ?? null;
  if (!branchId) {
    return redirect({ href: "/dashboard/warehouse/audits", locale });
  }

  const detailResult = await InventoryCountSessionsService.getSessionDetail(
    supabase,
    context.app.activeOrgId,
    branchId,
    id
  );

  if (!detailResult.success) {
    return redirect({ href: "/dashboard/warehouse/audits", locale });
  }

  const session = detailResult.data.session as { id: string; status: string; scope: unknown };
  const lines = detailResult.data.lines;

  // Sessions already submitted/approved/cancelled aren't counted here anymore.
  if (session.status === "submitted") {
    return redirect({
      href: { pathname: "/dashboard/warehouse/audits/[id]/review", params: { id } },
      locale,
    });
  }
  if (session.status === "approved" || session.status === "cancelled") {
    return redirect({
      href: { pathname: "/dashboard/warehouse/audits/[id]/report", params: { id } },
      locale,
    });
  }

  const enrichedLines = await enrichCountLines(supabase, lines);

  const locationsResult = branchId
    ? await WarehouseLocationsService.listByBranch(supabase, context.app.activeOrgId, branchId)
    : { success: true as const, data: [] };
  const locations = locationsResult.success
    ? locationsResult.data.map((loc) => ({
        id: loc.id,
        code: loc.code ?? loc.name,
        name: loc.name,
      }))
    : [];

  const sessionInfo: GuidedCountSessionInfo = {
    id: session.id,
    status: session.status,
    scope: session.scope as CountSessionScope,
  };

  return (
    <GuidedCountScreen session={sessionInfo} initialLines={enrichedLines} locations={locations} />
  );
}
