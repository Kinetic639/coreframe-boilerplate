import { cookies } from "next/headers";
import { redirect as redirectUrl } from "next/navigation";
import { getPathname, redirect } from "@/i18n/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { checkPermission } from "@/lib/utils/permissions";
import {
  WAREHOUSE_LOCATIONS_MANAGE,
  WAREHOUSE_LOCATIONS_READ,
  WAREHOUSE_READ,
} from "@/lib/constants/permissions";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { WarehouseLocationsService } from "@/server/services/warehouse-locations.service";
import { AmbraLocationInventoryService } from "@/server/services/ambra-location-inventory.service";
import { InventoryProductsService } from "@/server/services/inventory-products.service";
import { createClient } from "@/utils/supabase/server";
import { AmbraLocationsClient } from "./_components/ambra-locations-client";
import { createAmbraBranch, warehouseLocationsToAmbra } from "./_lib/warehouse-location-adapter";
import { parseLayout, parseWidths } from "@/components/kolor-sensu/data-table/columns";
import { locationColumnSet, migrateLocationSearch } from "./_components/list/locations-list-state";
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

export default async function AmbraWarehouseLocationsPage({ searchParams }: PageProps) {
  const [locale, context, t, tAmbra] = await Promise.all([
    getLocale(),
    loadDashboardContextV2(),
    getTranslations("warehouseLocations.listView"),
    getTranslations("ambraLocations.actions"),
  ]);

  if (!context?.app.activeOrgId) {
    return redirect({ href: "/sign-in", locale });
  }

  if (
    !checkPermission(context.user.permissionSnapshot, WAREHOUSE_READ) ||
    !checkPermission(context.user.permissionSnapshot, WAREHOUSE_LOCATIONS_READ)
  ) {
    return redirect({
      href: {
        pathname: "/dashboard/access-denied",
        query: { reason: "warehouse_locations_read_required" },
      },
      locale,
    });
  }

  const canManageLocations = checkPermission(
    context.user.permissionSnapshot,
    WAREHOUSE_LOCATIONS_MANAGE
  );

  const path = getPathname({ locale, href: "/dashboard/warehouse/locations" });
  // Old DataView links of the list view become this list's address.
  const raw = searchParams ? await searchParams : {};
  if (raw.view === "list") {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(raw)) {
      for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) {
        query.append(key, item);
      }
    }
    const migrated = migrateLocationSearch(query.toString());
    if (migrated !== null) return redirectUrl(`${path}?${migrated}`);
  }

  const branchId = context.app.activeBranchId;
  const supabase = await createClient();
  const locationsResult = branchId
    ? await WarehouseLocationsService.listByBranch(supabase, context.app.activeOrgId, branchId)
    : { success: true as const, data: [] };
  const inventorySnapshotResult = branchId
    ? await AmbraLocationInventoryService.getSnapshot(supabase, context.app.activeOrgId, branchId)
    : {
        success: true as const,
        data: { balances: [], movements: [], containers: [], putawayRules: [] },
      };
  // A failed read must not render as an empty tree with zero stock.
  if (!locationsResult.success || !inventorySnapshotResult.success) {
    throw new Error("Failed to load warehouse locations or their stock");
  }
  const variantOptionsResult = branchId
    ? await InventoryProductsService.listVariantOptions(supabase, context.app.activeOrgId, branchId)
    : { success: true as const, data: [] };

  const pl = locale === "pl";
  const labels: Record<string, string> = {
    locale,
    title: pl ? "Lokalizacje" : "Locations",
    code: t("code"),
    name: t("name"),
    path: t("path"),
    level: t("level"),
    storageMode: t("storageMode"),
    canStoreInventory: t("canStoreInventory"),
    created: t("created"),
    yes: t("yes"),
    no: pl ? "Nie" : "No",
    preview: pl ? "Podgląd" : "Preview",
    showInTree: pl ? "Pokaż w drzewie" : "Show in tree",
    printLabel: pl ? "Drukuj etykietę" : "Print label",
    auditLocation: tAmbra("auditLocation"),
    bentoView: tAmbra("bentoView"),
    streamlinedView: tAmbra("streamlinedView"),
    selection: pl ? "Zaznaczone lokalizacje" : "Selected locations",
    selectedCount: pl ? "Zaznaczono: {count}" : "Selected: {count}",
    printSelected: pl ? "Drukuj etykiety ({count})" : "Print labels ({count})",
    auditSelected: tAmbra("auditSelected", { count: "{count}" }),
    clearSelection: pl ? "Odznacz" : "Clear selection",
    selectAll: pl ? "Zaznacz wszystkie na stronie" : "Select all on this page",
    selectRow: pl ? "Zaznacz" : "Select",
    search: pl ? "Szukaj kodu, nazwy, ścieżki…" : "Search code, name, path…",
    empty: pl
      ? "Brak lokalizacji pasujących do wyszukiwania i filtrów."
      : "No locations match the search and filters.",
    notFound: pl
      ? "Lokalizacja nie istnieje w tym oddziale."
      : "This location is not in this branch.",
    close: pl ? "Zamknij szczegóły" : "Close details",
    countSuffix: pl ? "lokalizacji" : "locations",
  };
  const set = locationColumnSet(labels);
  const cookie = `ambra_locations_${context.user.user.id}_${context.app.activeOrgId}`;
  const jar = await cookies();

  return (
    <AmbraLocationsClient
      // Zone 1 / Phase 6: keying on branchId forces a full remount whenever the
      // active branch changes. router.refresh() re-executes this Server
      // Component and passes fresh props down, but by design does NOT reset an
      // already-mounted client component's own useState (locations,
      // treeSelectedId, etc.) -- without this key, a same-route branch switch
      // (the new cross-branch QR confirm flow) would leave this component
      // showing stale, wrong-branch client state even after a successful,
      // server-confirmed switch.
      key={branchId ?? "no-branch"}
      organizationId={context.app.activeOrgId}
      activeBranch={createAmbraBranch(branchId, context.app.activeBranch?.name)}
      initialLocations={
        locationsResult.success ? warehouseLocationsToAmbra(locationsResult.data) : []
      }
      rawLocations={locationsResult.success ? locationsResult.data : []}
      initialInventorySnapshot={
        inventorySnapshotResult.success
          ? inventorySnapshotResult.data
          : { balances: [], movements: [], containers: [], putawayRules: [] }
      }
      variantOptions={
        variantOptionsResult.success
          ? variantOptionsResult.data.filter((v) => (v.on_hand_quantity ?? 0) > 0)
          : []
      }
      list={{
        path,
        set,
        layout: parseLayout(set, cookieValue(jar.get(cookie)?.value)),
        widths: parseWidths(cookieValue(jar.get(`${cookie}_widths`)?.value), set),
        cookie,
        labels,
      }}
      canCreateLocation={canManageLocations}
    />
  );
}
