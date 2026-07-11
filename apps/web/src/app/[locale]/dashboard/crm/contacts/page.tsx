import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { createClient } from "@/utils/supabase/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import {
  CRM_CONTACTS_CREATE,
  CRM_CONTACTS_DELETE,
  CRM_CONTACTS_READ,
  CRM_CONTACTS_UPDATE,
} from "@/lib/constants/permissions";
import { parseDataViewSearchParams } from "@/components/data-view/data-view-search-params";
import { CrmContactsService } from "@/server/services/crm-contacts.service";
import { CrmContactsClient } from "./_components/crm-contacts-client";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CrmContactsPage({ searchParams }: PageProps = {}) {
  const locale = await getLocale();
  const context = await loadDashboardContextV2();

  if (!context?.app.activeOrgId) return redirect({ href: "/sign-in", locale });
  if (!checkPermission(context.user.permissionSnapshot, CRM_CONTACTS_READ)) {
    return redirect({
      href: {
        pathname: "/dashboard/access-denied",
        query: { reason: "crm_contacts_read_required" },
      },
      locale,
    });
  }

  const params = parseDataViewSearchParams(searchParams ? await searchParams : {});
  const supabase = await createClient();
  const result = await CrmContactsService.listForDataView(
    supabase,
    context.app.activeOrgId,
    params
  );

  return (
    <CrmContactsClient
      orgId={context.app.activeOrgId}
      initialData={
        result.success
          ? result.data
          : { rows: [], totalCount: 0, page: params.page, pageSize: params.pageSize }
      }
      canCreate={checkPermission(context.user.permissionSnapshot, CRM_CONTACTS_CREATE)}
      canUpdate={checkPermission(context.user.permissionSnapshot, CRM_CONTACTS_UPDATE)}
      canDelete={checkPermission(context.user.permissionSnapshot, CRM_CONTACTS_DELETE)}
    />
  );
}
