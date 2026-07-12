import { redirect } from "@/i18n/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Building2, Users } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { CRM_CONTACTS_READ, CRM_PARTIES_READ, CRM_READ } from "@/lib/constants/permissions";
import { CrmPartiesService } from "@/server/services/crm-parties.service";
import { CrmContactsService } from "@/server/services/crm-contacts.service";

export default async function CrmOverviewPage() {
  const locale = await getLocale();
  const t = await getTranslations("modules.crm");
  const context = await loadDashboardContextV2();

  if (!context?.app.activeOrgId) return redirect({ href: "/sign-in", locale });
  if (!checkPermission(context.user.permissionSnapshot, CRM_READ)) {
    return redirect({
      href: { pathname: "/dashboard/access-denied", query: { reason: "crm_read_required" } },
      locale,
    });
  }

  const supabase = await createClient();
  const orgId = context.app.activeOrgId;

  const [partiesResult, contactsResult] = await Promise.all([
    checkPermission(context.user.permissionSnapshot, CRM_PARTIES_READ)
      ? CrmPartiesService.listForDataView(supabase, orgId, {
          search: "",
          sort: null,
          page: 1,
          pageSize: 1,
          filters: {},
        })
      : Promise.resolve({
          success: true as const,
          data: { rows: [], totalCount: 0, page: 1, pageSize: 1 },
        }),
    checkPermission(context.user.permissionSnapshot, CRM_CONTACTS_READ)
      ? CrmContactsService.listForDataView(supabase, orgId, {
          search: "",
          sort: null,
          page: 1,
          pageSize: 1,
          filters: {},
        })
      : Promise.resolve({
          success: true as const,
          data: { rows: [], totalCount: 0, page: 1, pageSize: 1 },
        }),
  ]);

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal">{t("pages.overview.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("pages.overview.description")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border border-border p-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Building2 className="h-4 w-4" />
            {t("stats.parties")}
          </div>
          <div className="mt-3 text-3xl font-semibold">
            {partiesResult.success ? partiesResult.data.totalCount : 0}
          </div>
        </div>
        <div className="rounded-lg border border-border p-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            {t("stats.contacts")}
          </div>
          <div className="mt-3 text-3xl font-semibold">
            {contactsResult.success ? contactsResult.data.totalCount : 0}
          </div>
        </div>
      </div>
    </div>
  );
}
