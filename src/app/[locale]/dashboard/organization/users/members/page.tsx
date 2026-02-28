import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { MEMBERS_READ } from "@/lib/constants/permissions";
import { createClient } from "@/utils/supabase/server";
import {
  OrgMembersService,
  OrgPositionsService,
  OrgRolesService,
  OrgBranchesService,
} from "@/server/services/organization.service";
import { MembersClient } from "./_components/members-client";

export default async function MembersPage() {
  const locale = await getLocale();
  const context = await loadDashboardContextV2();
  if (!context?.app.activeOrgId) return redirect({ href: "/sign-in", locale });

  if (!checkPermission(context.user.permissionSnapshot, MEMBERS_READ)) {
    return redirect({ href: "/dashboard/start", locale });
  }

  const supabase = await createClient();
  const orgId = context.app.activeOrgId;

  const [membersResult, positionsResult, assignmentsResult, rolesResult, branchesResult] =
    await Promise.all([
      OrgMembersService.listMembers(supabase, orgId),
      OrgPositionsService.listPositions(supabase, orgId),
      OrgPositionsService.listAssignmentsForOrg(supabase, orgId),
      OrgRolesService.listRoles(supabase, orgId),
      OrgBranchesService.listBranches(supabase, orgId),
    ]);

  return (
    <MembersClient
      initialMembers={membersResult.success ? membersResult.data : []}
      initialPositions={positionsResult.success ? positionsResult.data : []}
      initialAssignments={assignmentsResult.success ? assignmentsResult.data : []}
      initialRoles={rolesResult.success ? rolesResult.data : []}
      initialBranches={branchesResult.success ? branchesResult.data : []}
    />
  );
}
