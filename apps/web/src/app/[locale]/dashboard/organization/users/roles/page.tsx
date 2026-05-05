import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { MEMBERS_READ } from "@/lib/constants/permissions";
import { createClient } from "@/utils/supabase/server";
import { OrgRolesService } from "@/server/services/organization.service";
import { RolesClient } from "./_components/roles-client";
import { parseDataViewSearchParams } from "@/components/data-view/data-view-search-params";
import { filterSortRoles, paginateRoles } from "./_utils/data-view";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function RolesPage({ searchParams }: PageProps) {
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
  const rolesResult = await OrgRolesService.listRoles(supabase, context.app.activeOrgId);
  const allRoles = rolesResult.success ? rolesResult.data : [];

  const filtered = filterSortRoles(allRoles, {
    search: urlState.search,
    filters: urlState.filters,
    sort: urlState.sort,
  });
  const initialData = paginateRoles(filtered, urlState.page, urlState.pageSize);

  return <RolesClient initialData={initialData} allRoles={allRoles} />;
}
