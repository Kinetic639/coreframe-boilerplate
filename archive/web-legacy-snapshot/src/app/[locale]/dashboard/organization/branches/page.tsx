import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { BRANCHES_READ } from "@/lib/constants/permissions";
import { createClient } from "@/utils/supabase/server";
import { OrgBranchesService } from "@/server/services/organization.service";
import { BranchesClient } from "./_components/branches-client";

export default async function BranchesPage() {
  const locale = await getLocale();
  const context = await loadDashboardContextV2();
  if (!context?.app.activeOrgId) return redirect({ href: "/sign-in", locale });

  if (!checkPermission(context.user.permissionSnapshot, BRANCHES_READ)) {
    return redirect({ href: "/dashboard/organization/profile", locale });
  }

  const supabase = await createClient();
  const branchesResult = await OrgBranchesService.listBranches(supabase, context.app.activeOrgId);

  return <BranchesClient initialBranches={branchesResult.success ? branchesResult.data : []} />;
}
