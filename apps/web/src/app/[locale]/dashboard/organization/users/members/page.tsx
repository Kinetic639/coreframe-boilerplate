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
import { parseDataViewSearchParams } from "@/components/data-view/data-view-search-params";
import { filterSortMembers, paginateMembers } from "./_utils/data-view";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function MembersPage({ searchParams }: PageProps) {
  const locale = await getLocale();
  const context = await loadDashboardContextV2();
  if (!context?.app.activeOrgId) return redirect({ href: "/sign-in", locale });

  if (!checkPermission(context.user.permissionSnapshot, MEMBERS_READ)) {
    return redirect({
      href: { pathname: "/dashboard/access-denied", query: { reason: "members_read_required" } },
      locale,
    });
  }

  const params = await searchParams;
  const urlState = parseDataViewSearchParams(params);

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

  const allMembers = membersResult.success ? membersResult.data : [];

  const filtered = filterSortMembers(allMembers, {
    search: urlState.search,
    filters: urlState.filters,
    sort: urlState.sort,
  });
  const initialData = paginateMembers(filtered, urlState.page, urlState.pageSize);

  return (
    <MembersClient
      initialData={initialData}
      allMembers={allMembers}
      initialPositions={positionsResult.success ? positionsResult.data : []}
      initialAssignments={assignmentsResult.success ? assignmentsResult.data : []}
      initialRoles={rolesResult.success ? rolesResult.data : []}
      initialBranches={branchesResult.success ? branchesResult.data : []}
    />
  );
}
