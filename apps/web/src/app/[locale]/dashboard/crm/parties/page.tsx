import { cookies } from "next/headers";
import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { redirect as redirectUrl } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { getPathname, redirect } from "@/i18n/navigation";
import { toUnsafeI18nHref } from "@/lib/i18n/unsafe-href";
import { createClient } from "@/utils/supabase/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import {
  CRM_PARTIES_CREATE,
  CRM_PARTIES_DELETE,
  CRM_PARTIES_READ,
  CRM_PARTIES_UPDATE,
} from "@/lib/constants/permissions";
import { CrmPartiesService } from "@/server/services/crm-parties.service";
import { parseLayout, parseWidths } from "@/components/kolor-sensu/data-table/columns";
import { partyKeys } from "./_components/parties-query";
import { partyColumnSet } from "./_components/parties-table";
import { PartiesWorkspace } from "./_components/parties-workspace";
import {
  loadPartyState,
  migratePartySearchParams,
  partyHref,
  partyListParams,
  PARTY_ROLES,
  PARTY_STATUSES,
} from "./_components/parties-state";
import "@/components/kolor-sensu/data-table/ambra-list.css";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function cookieValue(value: string | undefined) {
  try {
    return value ? decodeURIComponent(value) : null;
  } catch {
    return null;
  }
}

/**
 * The counterparties (Kolor Sensu list): the search, a filter per column, the
 * sort, the page and the open counterparty in the address. The server puts
 * the first page in the list's cache; the list fetches the rest.
 */
export default async function CrmPartiesPage({ searchParams }: PageProps = {}) {
  const [locale, context, t] = await Promise.all([
    getLocale(),
    loadDashboardContextV2(),
    getTranslations("modules.crm"),
  ]);

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

  const path = getPathname({ locale, href: toUnsafeI18nHref("/dashboard/crm/parties") });
  const migration = migratePartySearchParams(searchParams ? await searchParams : {});
  const state = loadPartyState(migration.params);
  if (migration.changed || state.strona < 1) {
    return redirectUrl(partyHref(path, state, { strona: Math.max(1, state.strona) }));
  }

  const orgId = context.app.activeOrgId;
  const supabase = await createClient();
  const result = await CrmPartiesService.listForDataView(supabase, orgId, partyListParams(state));
  if (result.success) {
    const lastPage = Math.max(1, Math.ceil(result.data.totalCount / state.wierszy));
    if (state.strona > lastPage) {
      return redirectUrl(partyHref(path, state, { strona: lastPage }));
    }
  }

  // The first page goes straight into the list's cache (no request on the
  // client); a failed read is left to the client, which retries.
  const queryClient = new QueryClient();
  if (result.success) queryClient.setQueryData(partyKeys.list(orgId, state), result.data);

  const pl = locale === "pl";
  const labels: Record<string, string> = {
    locale,
    title: t("pages.parties.title"),
    newParty: t("actions.newParty"),
    column_party: t("fields.name"),
    column_number: t("fields.counterpartyNumber"),
    column_roles: t("fields.roles"),
    column_status: t("fields.status"),
    column_kind: t("fields.partyKind"),
    column_tax_id: t("fields.taxId"),
    column_email: t("fields.email"),
    column_phone: t("fields.phone"),
    column_created_at: pl ? "Utworzono" : "Created",
    column_updated_at: pl ? "Zaktualizowano" : "Updated",
    kind_organization: t("partyKinds.organization"),
    kind_individual: t("partyKinds.individual"),
    search: pl ? "Szukaj nazwy, NIP, e-maila, numeru…" : "Search name, tax ID, email, number…",
    preview: pl ? "Podgląd" : "Preview",
    close: pl ? "Zamknij" : "Close",
    empty: pl ? "Brak kontrahentów dla tych filtrów" : "No counterparties match these filters",
    emptyAll: pl ? "Brak kontrahentów" : "No counterparties yet",
    loadError: t("errors.loadRetry"),
    notFound: pl ? "Nie udało się wczytać kontrahenta" : "Could not load the counterparty",
    retry: t("errors.tryAgain"),
    loading: pl ? "Wczytywanie…" : "Loading…",
    countSuffix: pl ? "kontrahentów" : "counterparties",
  };
  for (const role of PARTY_ROLES) labels[`role_${role}`] = t(`roles.${role}`);
  for (const status of PARTY_STATUSES) labels[`status_${status}`] = t(`status.${status}`);

  const set = partyColumnSet(labels);
  const cookie = `ambra_crm_parties_${context.user.user.id}_${orgId}`;
  const jar = await cookies();
  const layout = parseLayout(set, cookieValue(jar.get(cookie)?.value));
  const widths = parseWidths(cookieValue(jar.get(`${cookie}_widths`)?.value), set);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <PartiesWorkspace
        orgId={orgId}
        path={path}
        set={set}
        layout={layout}
        widths={widths}
        cookie={cookie}
        labels={labels}
        canCreate={checkPermission(context.user.permissionSnapshot, CRM_PARTIES_CREATE)}
        canUpdate={checkPermission(context.user.permissionSnapshot, CRM_PARTIES_UPDATE)}
        canDelete={checkPermission(context.user.permissionSnapshot, CRM_PARTIES_DELETE)}
      />
    </HydrationBoundary>
  );
}
