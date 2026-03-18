import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { MEMBERS_READ } from "@/lib/constants/permissions";
import { createClient } from "@/utils/supabase/server";
import { OrgPositionsService } from "@/server/services/organization.service";
import { PositionsClient } from "./_components/positions-client";

export default async function PositionsPage() {
  const locale = await getLocale();
  const context = await loadDashboardContextV2();
  if (!context?.app.activeOrgId) return redirect({ href: "/sign-in", locale });

  if (!checkPermission(context.user.permissionSnapshot, MEMBERS_READ)) {
    return redirect({ href: "/dashboard/organization/users/members", locale });
  }

  const supabase = await createClient();
  const positionsResult = await OrgPositionsService.listPositions(
    supabase,
    context.app.activeOrgId
  );

  return <PositionsClient initialPositions={positionsResult.success ? positionsResult.data : []} />;
}
