import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { MEMBERS_READ } from "@/lib/constants/permissions";
import { createClient } from "@/utils/supabase/server";
import { OrgPositionsService } from "@/server/services/organization.service";
import { PositionsClient } from "./_components/positions-client";
import { parseDataViewSearchParams } from "@/components/data-view/data-view-search-params";
import { filterSortPositions, paginatePositions } from "./_utils/data-view";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PositionsPage({ searchParams }: PageProps) {
  const locale = await getLocale();
  const context = await loadDashboardContextV2();
  if (!context?.app.activeOrgId) return redirect({ href: "/sign-in", locale });

  if (!checkPermission(context.user.permissionSnapshot, MEMBERS_READ)) {
    return redirect({ href: "/dashboard/organization/users/members", locale });
  }

  const params = await searchParams;
  const urlState = parseDataViewSearchParams(params);

  const supabase = await createClient();
  const result = await OrgPositionsService.listPositions(supabase, context.app.activeOrgId);
  const allPositions = result.success ? result.data : [];

  const filtered = filterSortPositions(allPositions, {
    search: urlState.search,
    filters: urlState.filters,
    sort: urlState.sort,
  });
  const initialData = paginatePositions(filtered, urlState.page, urlState.pageSize);

  return <PositionsClient initialData={initialData} allPositions={allPositions} />;
}
