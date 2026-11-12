import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { redirect as redirectUrl } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { PackagePlus } from "lucide-react";
import { getPathname, Link, redirect } from "@/i18n/navigation";
import { checkPermission } from "@/lib/utils/permissions";
import {
  WAREHOUSE_INVENTORY_OPERATE,
  WAREHOUSE_INVENTORY_READ,
  WAREHOUSE_READ,
} from "@/lib/constants/permissions";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { createClient } from "@/utils/supabase/server";
import { InventoryMovementsService } from "@/server/services/inventory-movements.service";
import { WarehouseLocationsService } from "@/server/services/warehouse-locations.service";
import { InternalOrderOperationsService } from "@/server/services/internal-orders.service";
import { WarehouseStockService } from "@/server/services/warehouse-stock.service";
import { BranchTransfers } from "@/components/warehouse/branch-transfers";
import { parseLayout, parseWidths } from "@/components/kolor-sensu/data-table/columns";
import { Button } from "@/components/ui/button";
import { MovementFilters, MovementsTotal } from "./_components/inventory-movements-controls";
import {
  inventoryMovementKeys,
  type MovementsScope,
} from "./_components/inventory-movements-query";
import { movementColumnSet } from "./_components/inventory-movements-table";
import { InventoryMovementsWorkspace } from "./_components/inventory-movements-workspace";
import {
  loadMovementState,
  migrateMovementSearchParams,
  movementHref,
  movementListParams,
} from "./_components/inventory-movements-state";
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

export default async function WarehouseInventoryMovementsPage({ searchParams }: PageProps = {}) {
  const [locale, context, t, td, tc] = await Promise.all([
    getLocale(),
    loadDashboardContextV2(),
    getTranslations("warehouseInventory.movements"),
    getTranslations("warehouseInventory.movementDetail"),
    getTranslations("warehouseInventory.common"),
  ]);

  if (!context?.app.activeOrgId) return redirect({ href: "/sign-in", locale });
  if (
    !checkPermission(context.user.permissionSnapshot, WAREHOUSE_READ) ||
    !checkPermission(context.user.permissionSnapshot, WAREHOUSE_INVENTORY_READ)
  ) {
    return redirect({
      href: { pathname: "/dashboard/access-denied", query: { reason: "warehouse_inventory_read" } },
      locale,
    });
  }

  const path = getPathname({ locale, href: "/dashboard/warehouse/inventory/movements" });
  const migration = migrateMovementSearchParams(searchParams ? await searchParams : {});
  const state = loadMovementState(migration.params);
  if (migration.changed || state.strona < 1) {
    return redirectUrl(movementHref(path, state, { strona: Math.max(1, state.strona) }));
  }

  const organizationId = context.app.activeOrgId;
  const branchId = context.app.activeBranchId ?? null;
  const canOperate = checkPermission(context.user.permissionSnapshot, WAREHOUSE_INVENTORY_OPERATE);
  const supabase = await createClient();
  // MMJ- / MMJ+ not yet accepted ("w drodze", drafts) have no number yet, so
  // they are not in the movement list: they show above it.
  const [movementsResult, locationsResult, transfers, unitsResult, typesResult] = branchId
    ? await Promise.all([
        InventoryMovementsService.listMovements(
          supabase,
          organizationId,
          branchId,
          movementListParams(state)
        ),
        WarehouseLocationsService.listByBranch(supabase, organizationId, branchId),
        InternalOrderOperationsService.listTransfers(supabase, organizationId, branchId),
        WarehouseStockService.documentUnits(supabase, organizationId, branchId),
        InventoryMovementsService.listMovementTypes(supabase, organizationId),
      ])
    : [null, null, null, null, null];

  const pl = locale === "pl";
  const statusLabel = (key: string) => td(key as Parameters<typeof td>[0]);
  const labels: Record<string, string> = {
    locale,
    title: t("title"),
    movement: t("movement"),
    kind: t("kind"),
    status: tc("status"),
    warehouse: t("warehouse"),
    unit: t("unit"),
    reference: t("reference"),
    lines: t("lines"),
    posted: t("posted"),
    created: pl ? "Utworzono" : "Created",
    counterparty: pl ? "Kontrahent" : "Counterparty",
    openMovement: t("openMovement"),
    editDraft: td("editDraft"),
    preview: pl ? "Podgląd" : "Preview",
    close: pl ? "Zamknij szczegóły" : "Close details",
    search: pl ? "Szukaj numeru, referencji, kontrahenta…" : "Search number, reference, party…",
    empty: pl
      ? "Brak ruchów pasujących do wyszukiwania i filtrów."
      : "No movements match the search and filters.",
    noBranch: t("selectBranch"),
    loadError: pl ? "Nie udało się wczytać danych." : "Could not load data.",
    notFound: pl
      ? "Ruch nie istnieje lub nie jest dostępny."
      : "Movement not found or unavailable.",
    retry: pl ? "Spróbuj ponownie" : "Try again",
    loading: pl ? "Wczytywanie…" : "Loading…",
    countSuffix: pl ? "ruchów" : "movements",
    within_7d: pl ? "Ostatnie 7 dni" : "Last 7 days",
    within_30d: pl ? "Ostatnie 30 dni" : "Last 30 days",
    within_90d: pl ? "Ostatnie 90 dni" : "Last 90 days",
    status_draft: statusLabel("statusDraft"),
    status_posted: statusLabel("statusPosted"),
    status_reversed: statusLabel("statusReversed"),
    status_cancelled: statusLabel("statusCancelled"),
    status_in_transit: statusLabel("statusInTransit"),
    status_accepted: statusLabel("statusAccepted"),
    status_declined: statusLabel("statusDeclined"),
  };

  const header = (count: ReactNode) => (
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b px-3 py-2.5 md:px-4">
      <div className="flex items-baseline gap-2">
        <h1 className="text-lg font-semibold tracking-tight">{t("title")}</h1>
        {count}
      </div>
      {canOperate ? (
        <Button asChild size="sm">
          <Link href="/dashboard/warehouse/inventory/movements/new">
            <PackagePlus className="mr-1.5 size-3.5" />
            {t("newMovement")}
          </Link>
        </Button>
      ) : null}
    </header>
  );

  if (!branchId) {
    return (
      <section className="flex flex-col rounded-lg border bg-background">
        {header(null)}
        <p className="px-4 py-12 text-center text-sm text-muted-foreground">{labels.noBranch}</p>
      </section>
    );
  }

  const data = movementsResult?.success
    ? movementsResult.data
    : { rows: [], totalCount: 0, page: state.strona, pageSize: state.wierszy };
  const lastPage = Math.max(1, Math.ceil(data.totalCount / state.wierszy));
  if (movementsResult?.success && state.strona > lastPage) {
    return redirectUrl(movementHref(path, state, { strona: lastPage }));
  }

  const scope: MovementsScope = { organizationId, branchId };
  // The first page goes straight into the list's cache (no request on the
  // client); a failed read is left to the client, which retries.
  const queryClient = new QueryClient();
  if (movementsResult?.success) {
    queryClient.setQueryData(inventoryMovementKeys.list(scope, state), movementsResult.data);
  }

  const set = movementColumnSet(labels);
  const cookie = `ambra_movements_${context.user.user.id}_${organizationId}`;
  const jar = await cookies();
  const layout = parseLayout(set, cookieValue(jar.get(cookie)?.value));
  const widths = parseWidths(cookieValue(jar.get(`${cookie}_widths`)?.value), set);
  const movementPathTemplate = getPathname({
    locale,
    href: {
      pathname: "/dashboard/warehouse/inventory/movements/[movementId]",
      params: { movementId: "__MOVEMENT__" },
    },
  });
  // The draft editor has no localized path of its own.
  const movementEditPathTemplate = getPathname({
    locale,
    href: "/dashboard/warehouse/inventory/movements/__MOVEMENT__/edit" as Parameters<
      typeof getPathname
    >[0]["href"],
  });
  const units = unitsResult?.success ? unitsResult.data : [];
  const types = typesResult?.success
    ? typesResult.data.map((type) => ({
        code: type.code,
        name: (pl ? type.name_pl : type.name_en) ?? type.name,
      }))
    : [];
  const locations = locationsResult?.success
    ? locationsResult.data.map((location) => ({
        id: location.id,
        name: location.name,
        code: location.code,
      }))
    : [];

  return (
    <div className="flex flex-col gap-3">
      {transfers?.success ? (
        <BranchTransfers transfers={transfers.data} canOperate={canOperate} />
      ) : null}
      <HydrationBoundary state={dehydrate(queryClient)}>
        <section className="ks-list-view flex min-w-0 flex-col overflow-hidden rounded-lg border bg-background">
          {header(<MovementsTotal scope={scope} initial={data.totalCount} />)}
          <MovementFilters
            scope={scope}
            order={["document_number", ...layout.map((column) => column.id)]}
            units={units}
            types={types}
            labels={labels}
          />
          <InventoryMovementsWorkspace
            scope={scope}
            path={path}
            set={set}
            layout={layout}
            widths={widths}
            cookie={cookie}
            labels={labels}
            canOperate={canOperate}
            locations={locations}
            movementPathTemplate={movementPathTemplate}
            movementEditPathTemplate={movementEditPathTemplate}
          />
        </section>
      </HydrationBoundary>
    </div>
  );
}
