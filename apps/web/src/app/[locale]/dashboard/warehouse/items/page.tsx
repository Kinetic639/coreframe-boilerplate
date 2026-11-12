import { cookies } from "next/headers";
import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { redirect as redirectUrl } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Plus, Upload, SlidersHorizontal } from "lucide-react";
import { redirect, getPathname, Link } from "@/i18n/navigation";
import { checkPermission } from "@/lib/utils/permissions";
import {
  WAREHOUSE_PRODUCTS_MANAGE,
  WAREHOUSE_PRODUCTS_ARCHIVE,
  WAREHOUSE_PRODUCTS_READ,
  WAREHOUSE_IMPORTS_MANAGE,
  WAREHOUSE_INVENTORY_READ,
  WAREHOUSE_READ,
} from "@/lib/constants/permissions";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { createClient } from "@/utils/supabase/server";
import { InventoryProductsService } from "@/server/services/inventory-products.service";
import { parseLayout, parseWidths } from "@/components/kolor-sensu/data-table/columns";
import { Button } from "@/components/ui/button";
import {
  ProductExport,
  ProductFilters,
  ProductsTotal,
} from "./_components/inventory-products-controls";
import { inventoryProductKeys, type ProductsScope } from "./_components/inventory-product-query";
import { PRODUCT_VIEWS_ENTITY } from "./_components/inventory-products-views";
import { InventoryEnterpriseService } from "@/server/services/inventory-enterprise.service";
import { productColumnSet } from "./_components/inventory-products-table";
import { InventoryProductsWorkspace } from "./_components/inventory-products-workspace";
import {
  loadProductState,
  productListParams,
  productHref,
  migrateProductSearchParams,
} from "./_components/inventory-products-state";
import "./_components/inventory-products.css";

type PageProps = { searchParams?: Promise<Record<string, string | string[] | undefined>> };
function cookieValue(value: string | undefined) {
  try {
    return value ? decodeURIComponent(value) : null;
  } catch {
    return null;
  }
}

export default async function WarehouseItemsPage({ searchParams }: PageProps = {}) {
  const [locale, context, t, tc, td, tCommit] = await Promise.all([
    getLocale(),
    loadDashboardContextV2(),
    getTranslations("warehouseInventory.list"),
    getTranslations("warehouseInventory.common"),
    getTranslations("warehouseInventory.detail"),
    getTranslations("modules.warehouse.stockCommitments"),
  ]);
  if (!context?.app.activeOrgId) return redirect({ href: "/sign-in", locale });
  if (
    !checkPermission(context.user.permissionSnapshot, WAREHOUSE_READ) ||
    !checkPermission(context.user.permissionSnapshot, WAREHOUSE_PRODUCTS_READ)
  )
    return redirect({
      href: { pathname: "/dashboard/access-denied", query: { reason: "warehouse_products_read" } },
      locale,
    });
  const path = getPathname({ locale, href: "/dashboard/warehouse/items" });
  const migration = migrateProductSearchParams(searchParams ? await searchParams : {});
  const state = loadProductState(migration.params);
  if (migration.changed || state.strona < 1)
    return redirectUrl(productHref(path, state, { strona: Math.max(1, state.strona) }));
  const supabase = await createClient();
  const [productsResult, customFieldsResult, viewsResult] = await Promise.all([
    InventoryProductsService.listProducts(
      supabase,
      context.app.activeOrgId,
      productListParams(state),
      context.app.activeBranchId
    ),
    InventoryProductsService.listCustomFields(supabase, context.app.activeOrgId, ["product"]),
    InventoryEnterpriseService.listViews(supabase, context.app.activeOrgId, PRODUCT_VIEWS_ENTITY),
  ]);
  const data = productsResult.success
    ? productsResult.data
    : { rows: [], totalCount: 0, page: state.strona, pageSize: state.wierszy };
  const lastPage = Math.max(1, Math.ceil(data.totalCount / state.wierszy));
  if (productsResult.success && state.strona > lastPage)
    return redirectUrl(productHref(path, state, { strona: lastPage }));
  const customFields = customFieldsResult.success ? customFieldsResult.data : [];
  const pl = locale === "pl";
  const labels: Record<string, string> = {
    locale,
    title: t("title"),
    productColumn: t("productColumn"),
    onHand: t("onHand"),
    available: t("available"),
    reserved: tCommit("states.reserved"),
    blocked: tCommit("states.blocked"),
    updated: t("updated"),
    isVariant: t("isVariant"),
    groupVariants: t("groupVariants"),
    type: tc("type"),
    status: tc("status"),
    sku: tc("sku"),
    variants: tc("variants"),
    unit: tc("unit"),
    customFields: tc("customFields"),
    noSku: tc("noSku"),
    yes: tc("yes"),
    no: tc("no"),
    edit: pl ? "Edytuj" : "Edit",
    description: pl ? "Opis" : "Description",
    images: pl ? "Zdjęcia" : "Images",
    barcode: tc("barcode"),
    brand: td("brand"),
    manufacturer: td("manufacturer"),
    returnable: td("returnable"),
    purchase: td("purchase"),
    sales: td("sales"),
    reorderPoint: td("reorderPoint"),
    preview: pl ? "Podgląd" : "Preview",
    fullCard: pl ? "Pełna karta" : "Full record",
    close: pl ? "Zamknij szczegóły" : "Close details",
    info: pl ? "Informacje" : "Information",
    stock: pl ? "Stany" : "Stock",
    sections: pl ? "Sekcje produktu" : "Product sections",
    tags: pl ? "Etykiety" : "Tags",
    search: pl ? "Szukaj nazwy lub SKU…" : "Search name or SKU…",
    apply: pl ? "Zastosuj" : "Apply",
    clear: pl ? "Wyczyść" : "Clear",
    sortName: pl ? "Nazwa" : "Name",
    empty: pl
      ? "Brak produktów pasujących do wyszukiwania i filtrów."
      : "No products match the search and filters.",
    loadError: pl ? "Nie udało się wczytać danych." : "Could not load data.",
    retry: pl ? "Spróbuj ponownie" : "Try again",
    loading: pl ? "Wczytywanie…" : "Loading…",
    stockFilter: pl ? "Stan" : "Stock",
    bulkActions: pl ? "Akcje na zaznaczonych" : "Actions on selected",
    bulkSelected: pl ? "Zaznaczono" : "Selected",
    bulkSelectAll: pl ? "Zaznacz wszystkie na stronie" : "Select all on page",
    bulkSelectRow: pl ? "Zaznacz" : "Select",
    bulkExport: pl ? "Eksport CSV" : "Export CSV",
    bulkArchive: pl ? "Archiwizuj" : "Archive",
    bulkArchiveTitle: pl ? "Zarchiwizować zaznaczone produkty?" : "Archive the selected products?",
    bulkArchiveHint: pl
      ? "Produkty znikną z list i wyszukiwania. Historia ruchów i dokumentów zostaje bez zmian."
      : "The products leave lists and search. Movement and document history stays unchanged.",
    bulkArchived: pl ? "Zarchiwizowano" : "Archived",
    bulkArchiveFailed: pl ? "Nie udało się zarchiwizować" : "Could not archive",
    bulkClear: pl ? "Odznacz" : "Clear",
    cancel: pl ? "Anuluj" : "Cancel",
    views: pl ? "Widoki" : "Views",
    viewAll: pl ? "Wszystkie produkty" : "All products",
    viewActive: pl ? "Aktywne" : "Active",
    viewsMine: pl ? "Moje widoki" : "My views",
    viewsShared: pl ? "Wspólne widoki" : "Shared views",
    viewSaveCurrent: pl
      ? "Zapisz bieżące wyszukiwanie, filtry i sortowanie"
      : "Save the current search, filters and sort",
    viewName: pl ? "Nazwa widoku" : "View name",
    viewShare: pl ? "Widoczny dla całej organizacji" : "Visible to the whole organization",
    viewSave: pl ? "Zapisz widok" : "Save view",
    viewSaved: pl ? "Zapisano widok" : "View saved",
    viewDelete: pl ? "Usuń widok" : "Delete view",
    stock_available: pl ? "Dostępne > 0" : "Available > 0",
    stock_unavailable: pl ? "Brak dostępnych" : "None available",
    stock_reserved: pl ? "Zarezerwowane (R)" : "Reserved (R)",
    stock_blocked: pl ? "Zablokowane (B)" : "Blocked (B)",
    notFound: pl
      ? "Produkt nie istnieje lub nie jest dostępny."
      : "Product not found or unavailable.",
    active: pl ? "Aktywny" : "Active",
    archived: pl ? "Archiwalny" : "Archived",
    discontinued: pl ? "Wycofany" : "Discontinued",
    stocked: pl ? "Magazynowy" : "Stocked",
    consumable: pl ? "Eksploatacyjny" : "Consumable",
    service: pl ? "Usługa" : "Service",
    serialized: pl ? "Numerowany" : "Serialized",
    lot_tracked: pl ? "Śledzony partiami" : "Lot tracked",
    bundle: pl ? "Zestaw" : "Bundle",
  };
  const set = productColumnSet(customFields, labels);
  // The first page goes straight into the list's cache (the client renders it
  // with no request); a failed read is left to the client, which retries.
  const scope: ProductsScope = {
    organizationId: context.app.activeOrgId,
    branchId: context.app.activeBranchId ?? null,
  };
  const queryClient = new QueryClient();
  if (productsResult.success) {
    queryClient.setQueryData(inventoryProductKeys.list(scope, state), productsResult.data);
  }
  if (viewsResult.success) {
    queryClient.setQueryData(inventoryProductKeys.views(scope), viewsResult.data);
  }
  const cookie = `ambra_products_${context.user.user.id}_${context.app.activeOrgId}`;
  const jar = await cookies();
  const layout = parseLayout(set, cookieValue(jar.get(cookie)?.value));
  const widths = parseWidths(cookieValue(jar.get(`${cookie}_widths`)?.value), set);
  const canManageProducts = checkPermission(
    context.user.permissionSnapshot,
    WAREHOUSE_PRODUCTS_MANAGE
  );
  const productPath = (productId: string, edit = false) =>
    getPathname({
      locale,
      href: {
        pathname: edit
          ? "/dashboard/warehouse/items/[productId]/edit"
          : "/dashboard/warehouse/items/[productId]",
        params: { productId },
      },
    });
  return (
    // The whole view (the count in the header too) reads the hydrated first page.
    <HydrationBoundary state={dehydrate(queryClient)}>
      <section className="inventory-products-view flex min-w-0 flex-col overflow-hidden rounded-lg border bg-background">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b px-3 py-2.5 md:px-4">
          <div className="flex items-baseline gap-2">
            <h1 className="text-lg font-semibold tracking-tight">{t("title")}</h1>
            <ProductsTotal scope={scope} initial={data.totalCount} />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <ProductExport label={tc("exportCsv")} />
            {checkPermission(context.user.permissionSnapshot, WAREHOUSE_IMPORTS_MANAGE) ||
            canManageProducts ? (
              <Button asChild size="sm" variant="outline">
                <Link
                  href="/dashboard/warehouse/items/import"
                  aria-label={tc("importExcel")}
                  title={tc("importExcel")}
                >
                  <Upload className="size-3.5 sm:mr-1.5" />
                  <span className="hidden sm:inline">{tc("importExcel")}</span>
                </Link>
              </Button>
            ) : null}
            {canManageProducts ? (
              <>
                <Button asChild size="sm" variant="ghost" className="hidden md:inline-flex">
                  <Link href="/dashboard/warehouse/items/custom-fields">
                    <SlidersHorizontal className="mr-1.5 size-3.5" />
                    {tc("customFields")}
                  </Link>
                </Button>
                <Button asChild size="sm">
                  <Link href="/dashboard/warehouse/items/new">
                    <Plus className="mr-1.5 size-3.5" />
                    {tc("create")}
                  </Link>
                </Button>
              </>
            ) : null}
          </div>
        </header>
        {!customFieldsResult.success ? (
          <p role="alert" className="border-b px-3 py-2 text-xs text-destructive">
            {labels.customFields}: {labels.loadError}
          </p>
        ) : null}
        <ProductFilters
          scope={scope}
          path={path}
          userId={context.user.user.id}
          canShareViews={canManageProducts}
          order={layout.map((column) => column.id)}
          customFields={customFields}
          labels={labels}
        />
        <InventoryProductsWorkspace
          scope={scope}
          path={path}
          set={set}
          layout={layout}
          widths={widths}
          cookie={cookie}
          customFields={customFields}
          labels={labels}
          canManageProducts={canManageProducts}
          canArchiveProducts={checkPermission(
            context.user.permissionSnapshot,
            WAREHOUSE_PRODUCTS_ARCHIVE
          )}
          productPathTemplate={productPath("__PRODUCT_ID__")}
          productEditPathTemplate={productPath("__PRODUCT_ID__", true)}
          canReadStock={checkPermission(context.user.permissionSnapshot, WAREHOUSE_INVENTORY_READ)}
        />
      </section>
    </HydrationBoundary>
  );
}
