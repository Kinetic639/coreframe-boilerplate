import type { QueryClient } from "@tanstack/react-query";
import type { PaginatedResult } from "@/lib/data-view/types";
import type {
  InventoryProductDetail,
  InventoryProductListRow,
} from "@/lib/warehouse/inventory-types";
import {
  productListParams,
  serializeProductState,
  type ProductState,
} from "./inventory-products-state";

// The products list's cache: one entry per page of rows the address asks for
// (search, filters, sort, page, size), per organization and branch, and one
// per product card. Shared by the server (which renders the first page and
// hands it over through a HydrationBoundary) and the client (which fetches
// every other page itself, without a server render of the whole page).
//
//   ["inventory-products", "<org>:<branch|all>", "list", <list params>]
//   ["inventory-products", "<org>:<branch|all>", "detail", <product id>]
//
// Every product mutation invalidates ["inventory-products"]: all lists and
// cards of every scope go stale and refetch when next shown.

export interface ProductsScope {
  organizationId: string;
  branchId: string | null;
}

export type ProductList = PaginatedResult<InventoryProductListRow>;

export const scopeKey = (scope: ProductsScope) =>
  `${scope.organizationId}:${scope.branchId ?? "all"}`;

export const inventoryProductKeys = {
  all: ["inventory-products"] as const,
  lists: (scope: ProductsScope) => [...inventoryProductKeys.all, scopeKey(scope), "list"] as const,
  // The params are normalised (productListParams), so two addresses that ask
  // for the same rows share an entry; the panel (selected, tab) is not in it.
  list: (scope: ProductsScope, state: ProductState) =>
    [...inventoryProductKeys.lists(scope), productListParams(state)] as const,
  /** The saved views of the list (the person's own and the shared ones). */
  views: (scope: ProductsScope) => [...inventoryProductKeys.all, scopeKey(scope), "views"] as const,
  detail: (scope: ProductsScope, productId: string) =>
    [...inventoryProductKeys.all, scopeKey(scope), "detail", productId] as const,
};

/** A list page stays fresh this long: going back and forth costs nothing. */
export const LIST_STALE_TIME = 30 * 1000;
/** A card changes less often than the list's quantities. */
export const DETAIL_STALE_TIME = 2 * 60 * 1000;

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal, credentials: "same-origin" });
  const body = (await response.json().catch(() => null)) as
    | { success: true; data: T }
    | { success: false; error: string }
    | null;
  if (!response.ok || !body || body.success !== true) {
    const error = body && "error" in body ? body.error : null;
    throw new Error(error || `HTTP ${response.status}`);
  }
  return (body as { data: T }).data;
}

function scopeQuery(scope: ProductsScope) {
  const query = new URLSearchParams({ organizationId: scope.organizationId });
  if (scope.branchId) query.set("branchId", scope.branchId);
  return query;
}

export function fetchProductList(scope: ProductsScope, state: ProductState, signal?: AbortSignal) {
  // The page's own query (without the panel), as the server would read it.
  const own = serializeProductState({ ...state, selected: null, tab: null });
  const query = new URLSearchParams(own.startsWith("?") ? own.slice(1) : own);
  for (const [key, value] of scopeQuery(scope)) query.set(key, value);
  return getJson<ProductList>(`/api/warehouse/products?${query}`, signal);
}

export function fetchProductDetail(scope: ProductsScope, productId: string, signal?: AbortSignal) {
  return getJson<InventoryProductDetail>(
    `/api/warehouse/products/${encodeURIComponent(productId)}?${scopeQuery(scope)}`,
    signal
  );
}

export const productListQuery = (scope: ProductsScope, state: ProductState) => ({
  queryKey: inventoryProductKeys.list(scope, state),
  queryFn: ({ signal }: { signal?: AbortSignal }) => fetchProductList(scope, state, signal),
  staleTime: LIST_STALE_TIME,
});

export const productDetailQuery = (scope: ProductsScope, productId: string) => ({
  queryKey: inventoryProductKeys.detail(scope, productId),
  queryFn: ({ signal }: { signal?: AbortSignal }) => fetchProductDetail(scope, productId, signal),
  staleTime: DETAIL_STALE_TIME,
});

/** After any change to products: every list and card refetches when shown. */
export function invalidateInventoryProducts(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: inventoryProductKeys.all });
}
