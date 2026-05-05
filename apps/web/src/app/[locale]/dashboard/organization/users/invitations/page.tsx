import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { INVITES_READ } from "@/lib/constants/permissions";
import { createClient } from "@/utils/supabase/server";
import {
  OrgInvitationsService,
  OrgRolesService,
  OrgBranchesService,
} from "@/server/services/organization.service";
import { InvitationsClient } from "./_components/invitations-client";
import { parseDataViewSearchParams } from "@/components/data-view/data-view-search-params";
import { filterSortInvitations, paginateInvitations } from "./_utils/data-view";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function InvitationsPage({ searchParams }: PageProps) {
  const locale = await getLocale();
  const context = await loadDashboardContextV2();
  if (!context?.app.activeOrgId) return redirect({ href: "/sign-in", locale });

  if (!checkPermission(context.user.permissionSnapshot, INVITES_READ)) {
    return redirect({
      href: { pathname: "/dashboard/access-denied", query: { reason: "invites_read_required" } },
      locale,
    });
  }

  const params = await searchParams;
  const urlState = parseDataViewSearchParams(params);

  const supabase = await createClient();
  const [invitationsResult, rolesResult, branchesResult] = await Promise.all([
    OrgInvitationsService.listInvitations(supabase, context.app.activeOrgId),
    OrgRolesService.listRoles(supabase, context.app.activeOrgId),
    OrgBranchesService.listBranches(supabase, context.app.activeOrgId),
  ]);

  const allInvitations = invitationsResult.success ? invitationsResult.data : [];

  const filtered = filterSortInvitations(allInvitations, {
    search: urlState.search,
    filters: urlState.filters,
    sort: urlState.sort,
  });
  const initialData = paginateInvitations(filtered, urlState.page, urlState.pageSize);

  return (
    <InvitationsClient
      initialData={initialData}
      allInvitations={allInvitations}
      initialRoles={rolesResult.success ? rolesResult.data : []}
      initialBranches={branchesResult.success ? branchesResult.data : []}
    />
  );
}
