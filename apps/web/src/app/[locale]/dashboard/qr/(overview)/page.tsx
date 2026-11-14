import { redirect as redirectUrl } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { getPathname } from "@/i18n/navigation";
import { createClient } from "@/utils/supabase/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { QrCodesService } from "@/server/services/qr.service";
import { savedColumns } from "@/components/kolor-sensu/data-table/saved-columns";
import { QrWorkspace } from "../_components/qr-workspace";
import {
  loadQrState,
  migrateQrSearchParams,
  qrColumnSet,
  qrHref,
  qrListLabels,
} from "../_components/qr-state";
import "@/components/kolor-sensu/data-table/ambra-list.css";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

/** The organization's QR codes (Kolor Sensu list), all loaded; the address picks. */
export default async function QrCodesPage({ searchParams }: PageProps = {}) {
  const [locale, context, t] = await Promise.all([
    getLocale(),
    loadDashboardContextV2(),
    getTranslations("modules.qr.management"),
  ]);

  const path = getPathname({ locale, href: "/dashboard/qr" });
  const migration = migrateQrSearchParams(searchParams ? await searchParams : {});
  const state = loadQrState(migration.params);
  if (migration.changed || state.strona < 1) {
    return redirectUrl(qrHref(path, state, { strona: Math.max(1, state.strona) }));
  }

  const orgId = context?.app.activeOrgId ?? "";
  const supabase = await createClient();
  const result = orgId ? await QrCodesService.listWithStatus(supabase, orgId) : null;

  const set = qrColumnSet(qrListLabels(t as (key: string) => string, locale));
  const cookie = `ambra_qr_codes_${context?.user.user.id ?? ""}_${orgId}`;
  const { layout, widths } = await savedColumns(set, cookie);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 md:p-6">
      <QrWorkspace
        orgId={orgId}
        initialCodes={result?.success ? result.data : []}
        path={path}
        layout={layout}
        widths={widths}
        cookie={cookie}
      />
    </div>
  );
}
