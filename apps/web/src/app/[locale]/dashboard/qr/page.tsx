import { createClient } from "@/utils/supabase/server";
import { getTranslations } from "next-intl/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { QrCodesService } from "@/server/services/qr.service";
import { QrManagementClient } from "./_components/qr-management-client";
import { parseDataViewSearchParams } from "@/components/data-view/data-view-search-params";
import { filterSortQrCodes, paginateQrCodes } from "./_utils/data-view";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function QrCodesPage({ searchParams }: PageProps) {
  const t = await getTranslations("modules.qr.page");
  const supabase = await createClient();
  const context = await loadDashboardContextV2();
  const orgId = context?.app.activeOrgId ?? "";

  const result = orgId ? await QrCodesService.listWithStatus(supabase, orgId) : null;
  const allCodes = result?.success ? result.data : [];

  const params = await searchParams;
  const urlState = parseDataViewSearchParams(params);

  const filtered = filterSortQrCodes(allCodes, {
    search: urlState.search,
    filters: urlState.filters,
    sort: urlState.sort,
  });
  const initialData = paginateQrCodes(filtered, urlState.page, urlState.pageSize);

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col gap-4 p-4 md:p-6">
      <div className="shrink-0">
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        <QrManagementClient initialData={initialData} allCodes={allCodes} />
      </div>
    </div>
  );
}
