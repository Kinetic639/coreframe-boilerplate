import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { createClient } from "@/utils/supabase/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import {
  CRM_PARTIES_CREATE,
  CRM_PARTIES_DELETE,
  CRM_PARTIES_READ,
  CRM_PARTIES_UPDATE,
} from "@/lib/constants/permissions";
import { parseDataViewSearchParams } from "@/components/data-view/data-view-search-params";
import { CrmPartiesService } from "@/server/services/crm-parties.service";
import { CrmPartiesClient } from "./_components/crm-parties-client";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CrmPartiesPage({ searchParams }: PageProps = {}) {
  const locale = await getLocale();
  const context = await loadDashboardContextV2();

  if (!context?.app.activeOrgId) return redirect({ href: "/sign-in", locale });
  if (!checkPermission(context.user.permissionSnapshot, CRM_PARTIES_READ)) {
    return redirect({
      href: {
        pathname: "/dashboard/access-denied",
        query: { reason: "crm_parties_read_required" },
      },
      locale,
    });
  }

  const params = parseDataViewSearchParams(searchParams ? await searchParams : {});
  const supabase = await createClient();
  const result = await CrmPartiesService.listForDataView(supabase, context.app.activeOrgId, params);

  return (
    <CrmPartiesClient
      orgId={context.app.activeOrgId}
      initialData={
        result.success
          ? result.data
          : { rows: [], totalCount: 0, page: params.page, pageSize: params.pageSize }
      }
      canCreate={checkPermission(context.user.permissionSnapshot, CRM_PARTIES_CREATE)}
      canUpdate={checkPermission(context.user.permissionSnapshot, CRM_PARTIES_UPDATE)}
      canDelete={checkPermission(context.user.permissionSnapshot, CRM_PARTIES_DELETE)}
    />
  );
}
