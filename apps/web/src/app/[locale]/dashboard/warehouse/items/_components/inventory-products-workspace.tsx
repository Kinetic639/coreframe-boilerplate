"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useQueryStates } from "nuqs";
import type {
  ColumnLayout,
  ColumnSet,
  ColumnWidths,
} from "@/components/kolor-sensu/data-table/columns";
import { TableNavigationProvider } from "@/components/kolor-sensu/data-table/table-navigation";
import type {
  InventoryCustomFieldDefinition,
  InventoryProductListRow,
} from "@/lib/warehouse/inventory-types";
import { InventoryProductsTable } from "./inventory-products-table";
import { ProductRecordPanel } from "./inventory-product-record-panel";
import { STOCK_CHANGED_EVENT } from "@/components/warehouse/stock-commitments";
import {
  invalidateInventoryProducts,
  productDetailQuery,
  productListQuery,
  type ProductList,
  type ProductsScope,
} from "./inventory-product-query";
import { productHref, productParsers } from "./inventory-products-state";

/** How long the pointer rests on a row before its card is fetched. */
const HOVER_INTENT_MS = 150;

const EMPTY_LIST: ProductList = { rows: [], totalCount: 0, page: 1, pageSize: 50 };

/**
 * The products list and its side panel. The address is the one state
 * (search, filters, sort, page, size, the open product and its tab): every
 * change only pushes a new address (no server render of the page), and the
 * list answers from its cache, keyed by that address, or fetches just its
 * rows, keeping the rows it shows until the new ones are there. The server
 * rendered the first page and handed it to the cache (HydrationBoundary in
 * page.tsx), so the first paint needs no request at all.
 */
export function InventoryProductsWorkspace({
  scope,
  path,
  set,
  layout: savedLayout,
  widths,
  cookie,
  customFields,
  labels,
  canManageProducts,
  canReadStock,
  productPathTemplate,
  productEditPathTemplate,
}: {
  scope: ProductsScope;
  path: string;
  set: ColumnSet<string>;
  layout: ColumnLayout;
  widths: ColumnWidths;
  cookie: string;
  customFields: InventoryCustomFieldDefinition[];
  labels: Record<string, string>;
  canManageProducts: boolean;
  canReadStock: boolean;
  productPathTemplate: string;
  productEditPathTemplate: string;
}) {
  const queryClient = useQueryClient();
  const [state] = useQueryStates(productParsers);
  const list = useQuery({
    ...productListQuery(scope, state),
    placeholderData: keepPreviousData,
  });
  const data = list.data ?? EMPTY_LIST;

  // The columns follow the menu at once; the cookie keeps them for the server.
  const [layout, setLayout] = useState(savedLayout);

  /** Same page, new address: Next keeps useSearchParams in step with it. */
  const navigate = useCallback((href: string) => {
    window.history.pushState(null, "", href);
  }, []);

  const productPath = useCallback(
    (id: string, edit = false) =>
      (edit ? productEditPathTemplate : productPathTemplate).replace("__PRODUCT_ID__", id),
    [productEditPathTemplate, productPathTemplate]
  );

  const preview = useCallback(
    (selected: string | null, tab: "info" | "variants" | "stock" = "info") =>
      navigate(productHref(path, state, { selected, tab })),
    [navigate, path, state]
  );

  // A page past the end (rows removed, a filter narrowed): go to the last one.
  useEffect(() => {
    if (list.isPlaceholderData || !list.data) return;
    const last = Math.max(1, Math.ceil(list.data.totalCount / state.wierszy));
    if (state.strona > last) {
      window.history.replaceState(null, "", productHref(path, state, { strona: last }));
    }
  }, [list.data, list.isPlaceholderData, path, state]);

  // The next page is a click away: fetch it once this one is shown.
  useEffect(() => {
    if (list.isPlaceholderData || !list.data) return;
    if (state.strona * state.wierszy >= list.data.totalCount) return;
    void queryClient.prefetchQuery(productListQuery(scope, { ...state, strona: state.strona + 1 }));
  }, [list.data, list.isPlaceholderData, queryClient, scope, state]);

  // A product's card, fetched when the pointer rests on its row (not on
  // every row it crosses), so opening the panel is instant.
  const hover = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prefetchPreview = useCallback(
    (selectionId: string | null) => {
      if (hover.current) clearTimeout(hover.current);
      hover.current = null;
      if (!selectionId) return;
      hover.current = setTimeout(() => {
        void queryClient.prefetchQuery(productDetailQuery(scope, selectionId.split("::")[0]));
      }, HOVER_INTENT_MS);
    },
    [queryClient, scope]
  );
  useEffect(() => () => void (hover.current && clearTimeout(hover.current)), []);

  // A reservation / block made in the panel changes the quantities shown.
  useEffect(() => {
    const changed = () => void invalidateInventoryProducts(queryClient);
    window.addEventListener(STOCK_CHANGED_EVENT, changed);
    return () => window.removeEventListener(STOCK_CHANGED_EVENT, changed);
  }, [queryClient]);

  const selectedRow = useMemo<InventoryProductListRow | null>(
    () => data.rows.find((row) => row.row_id === state.selected) ?? null,
    [data.rows, state.selected]
  );

  return (
    <TableNavigationProvider navigate={navigate}>
      <div className="flex min-h-0 min-w-0 flex-1">
        <InventoryProductsTable
          data={data}
          state={state}
          path={path}
          set={set}
          layout={layout}
          onLayoutChange={setLayout}
          widths={widths}
          cookie={cookie}
          labels={labels}
          canManageProducts={canManageProducts}
          productPath={productPath}
          loading={list.isPending}
          refreshing={list.isFetching && !list.isPending}
          error={list.isError ? list.error.message : null}
          onRetry={() => void list.refetch()}
          onPreview={(selected) => preview(selected)}
          onPrefetch={prefetchPreview}
        />
        {state.selected ? (
          <ProductRecordPanel
            key={state.selected.split("::")[0]}
            selectionId={state.selected}
            row={selectedRow}
            scope={scope}
            tab={state.tab}
            labels={labels}
            customFields={customFields}
            canManageProducts={canManageProducts}
            canReadStock={canReadStock}
            fullPath={productPath(state.selected.split("::")[0])}
            editPath={productPath(state.selected.split("::")[0], true)}
            onClose={() => preview(null)}
            onTabChange={(tab) => preview(state.selected, tab)}
          />
        ) : null}
      </div>
    </TableNavigationProvider>
  );
}
