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
  canArchiveProducts,
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
  canArchiveProducts: boolean;
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

  // Rows ticked for actions on several at once: of this page of this list
  // only (a new search, filter, sort or page unticks them).
  const [ticked, setTicked] = useState<string[]>([]);
  const listKey = JSON.stringify(productListQuery(scope, state).queryKey);
  useEffect(() => setTicked([]), [listKey]);

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

  // The keyboard, as in a mail client: ↓ / ↑ open the next / previous product
  // (↓ with no panel open opens the first), Esc closes the panel. Keys typed
  // into a field, or with a modifier, stay the field's.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target?.closest(
          "input, textarea, select, [contenteditable='true'], [role='menu'], [role='dialog'], [role='listbox']"
        )
      ) {
        return;
      }
      if (event.key === "Escape" && state.selected) {
        event.preventDefault();
        preview(null);
        return;
      }
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      if (!data.rows.length) return;
      const at = data.rows.findIndex((row) => row.row_id === state.selected);
      if (at < 0 && event.key === "ArrowUp") return;
      const next =
        at < 0
          ? 0
          : Math.min(data.rows.length - 1, Math.max(0, at + (event.key === "ArrowDown" ? 1 : -1)));
      if (next === at) return;
      event.preventDefault();
      preview(data.rows[next].row_id, state.tab);
      // Keep the product in view in the list beside the panel.
      requestAnimationFrame(() =>
        document
          .querySelector(`[data-row-id="${CSS.escape(data.rows[next].row_id)}"]`)
          ?.scrollIntoView({ block: "nearest" })
      );
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [data.rows, preview, state.selected, state.tab]);

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
          ticked={ticked}
          onTickedChange={setTicked}
          canArchive={canArchiveProducts}
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
