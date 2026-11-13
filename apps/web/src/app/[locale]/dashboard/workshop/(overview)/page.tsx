import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { redirect as redirectUrl } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Plus, Upload } from "lucide-react";
import { getPathname, Link, redirect } from "@/i18n/navigation";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import {
  WORKSHOP_REPAIR_ORDERS_READ,
  WORKSHOP_REPAIR_ORDERS_MANAGE_OWN,
  WORKSHOP_REPAIR_ORDERS_MANAGE_ALL,
} from "@/lib/constants/permissions";
import { createClient } from "@/utils/supabase/server";
import { RepairOrdersService } from "@/server/services/repair-orders.service";
import { BranchWarehousesService } from "@/server/services/branch-warehouses.service";
import { parseLayout, parseWidths } from "@/components/kolor-sensu/data-table/columns";
import { Button } from "@/components/ui/button";
import { repairOrderKeys, type RepairOrdersScope } from "../_components/repair-orders-query";
import { repairOrderColumnSet } from "../_components/repair-orders-table";
import { RepairOrdersTotal, RepairOrdersWorkspace } from "../_components/repair-orders-workspace";
import {
  loadRepairOrderState,
  migrateRepairOrderSearchParams,
  repairOrderHref,
  repairOrderListParams,
  REPAIR_ORDER_STATUSES,
} from "../_components/repair-orders-state";
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
 * The workshop's repair orders (Kolor Sensu list): branch/org-scoped, the
 * search, a filter per column, the sort and the page in the address. The
 * server puts the first page in the list's cache; the list fetches the rest.
 */
export default async function WorkshopOverviewPage({ searchParams }: PageProps = {}) {
  const [locale, context, t] = await Promise.all([
    getLocale(),
    loadDashboardContextV2(),
    getTranslations("modules.workshop.repairOrders"),
  ]);

  if (!context?.app.activeOrgId) {
    return redirect({ href: "/sign-in", locale });
  }

  if (!checkPermission(context.user.permissionSnapshot, WORKSHOP_REPAIR_ORDERS_READ)) {
    return redirect({
      href: {
        pathname: "/dashboard/access-denied",
        query: { reason: "workshop_repair_orders_read_required" },
      },
      locale,
    });
  }

  const path = getPathname({ locale, href: "/dashboard/workshop" });
  const migration = migrateRepairOrderSearchParams(searchParams ? await searchParams : {});
  const state = loadRepairOrderState(migration.params);
  if (migration.changed || state.strona < 1) {
    return redirectUrl(repairOrderHref(path, state, { strona: Math.max(1, state.strona) }));
  }

  const canCreate =
    checkPermission(context.user.permissionSnapshot, WORKSHOP_REPAIR_ORDERS_MANAGE_OWN) ||
    checkPermission(context.user.permissionSnapshot, WORKSHOP_REPAIR_ORDERS_MANAGE_ALL);

  const supabase = await createClient();
  const organizationId = context.app.activeOrgId;
  const branchId = context.app.activeBranchId ?? null;
  const scope: RepairOrdersScope = { organizationId, branchId };

  const [listResult, warehousesResult, advisorsResult] = await Promise.all([
    RepairOrdersService.listPageForWorkshop(
      supabase,
      organizationId,
      branchId,
      repairOrderListParams(state)
    ),
    BranchWarehousesService.list(supabase, organizationId, branchId),
    RepairOrdersService.listAdvisorCandidates(supabase, organizationId),
  ]);

  const data = listResult.success
    ? listResult.data
    : { rows: [], totalCount: 0, page: state.strona, pageSize: state.wierszy };
  const lastPage = Math.max(1, Math.ceil(data.totalCount / state.wierszy));
  if (listResult.success && state.strona > lastPage) {
    return redirectUrl(repairOrderHref(path, state, { strona: lastPage }));
  }

  // The first page goes straight into the list's cache (no request on the
  // client); a failed read is left to the client, which retries.
  const queryClient = new QueryClient();
  if (listResult.success) {
    queryClient.setQueryData(repairOrderKeys.list(scope, state), listResult.data);
  }

  const pl = locale === "pl";
  const labels: Record<string, string> = {
    locale,
    title: t("title"),
    column_order: pl ? "Zlecenie" : "Order",
    column_warehouse: t("columns.warehouse"),
    column_order_number: t("columns.orderNumber"),
    column_vin: t("columns.vin"),
    column_vehicle_brand: t("detail.vehicleBrand"),
    column_client: pl ? "Klient" : "Client",
    column_dealer: t("detail.dealerName"),
    column_status: t("columns.status"),
    column_advisor: t("columns.advisor"),
    column_created_at: t("columns.created"),
    column_updated_at: pl ? "Zaktualizowano" : "Updated",
    noAdvisor: t("detail.unassignedAdvisor"),
    noNumber: pl ? "Bez numeru" : "No number",
    open: t("openRepairOrder"),
    search: pl ? "Szukaj ZL, VIN, zamówienia, klienta…" : "Search ZL, VIN, order, client…",
    empty: t("emptyState.noResultsTitle"),
    emptyAll: t("emptyState.title"),
    loadError: t("errors.loadFailed"),
    retry: pl ? "Spróbuj ponownie" : "Try again",
    loading: pl ? "Wczytywanie…" : "Loading…",
    countSuffix: pl ? "zleceń" : "orders",
    within_7d: pl ? "Ostatnie 7 dni" : "Last 7 days",
    within_30d: pl ? "Ostatnie 30 dni" : "Last 30 days",
    within_90d: pl ? "Ostatnie 90 dni" : "Last 90 days",
  };
  for (const status of REPAIR_ORDER_STATUSES) {
    labels[`status_${status}`] = t(`status.${status}`);
  }

  const warehouses = warehousesResult.success
    ? warehousesResult.data.map((w) => ({ value: w.code, label: w.name }))
    : [];
  const advisors = advisorsResult.success
    ? advisorsResult.data.map((a) => ({ value: a.id, label: a.displayName }))
    : [];

  const set = repairOrderColumnSet(labels);
  const cookie = `ambra_workshop_orders_${context.user.user.id}_${organizationId}`;
  const jar = await cookies();
  const layout = parseLayout(set, cookieValue(jar.get(cookie)?.value));
  const widths = parseWidths(cookieValue(jar.get(`${cookie}_widths`)?.value), set);
  const orderPathTemplate = getPathname({
    locale,
    href: { pathname: "/dashboard/workshop/[id]", params: { id: "__ORDER__" } },
  });

  const header = (count: ReactNode) => (
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b px-3 py-2.5 md:px-4">
      <div className="flex items-baseline gap-2">
        <h1 className="text-lg font-semibold tracking-tight">{labels.title}</h1>
        {count}
      </div>
      {canCreate ? (
        <div className="flex items-center gap-2">
          <Button asChild size="sm" variant="outline" data-testid="import-repair-orders-link">
            <Link href="/dashboard/workshop/import">
              <Upload className="size-3.5 sm:mr-1.5" />
              <span className="sr-only sm:not-sr-only">{t("import.cta")}</span>
            </Link>
          </Button>
          <Button asChild size="sm" data-testid="new-repair-order-link">
            <Link href="/dashboard/workshop/new">
              <Plus className="mr-1.5 size-3.5" />
              <span className="sm:hidden">{pl ? "Nowe" : "New"}</span>
              <span className="hidden sm:inline">{t("newOrder.cta")}</span>
            </Link>
          </Button>
        </div>
      ) : null}
    </header>
  );

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <section className="ks-list-view flex min-w-0 flex-col overflow-hidden rounded-lg border bg-background">
        {header(<RepairOrdersTotal scope={scope} initial={data.totalCount} />)}
        <RepairOrdersWorkspace
          scope={scope}
          path={path}
          set={set}
          layout={layout}
          widths={widths}
          cookie={cookie}
          labels={labels}
          warehouses={warehouses}
          advisors={advisors}
          orderPathTemplate={orderPathTemplate}
        />
      </section>
    </HydrationBoundary>
  );
}
