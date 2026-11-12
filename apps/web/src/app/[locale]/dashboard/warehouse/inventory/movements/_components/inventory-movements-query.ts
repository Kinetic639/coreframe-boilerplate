import type { QueryClient } from "@tanstack/react-query";
import type { PaginatedResult } from "@/lib/data-view/types";
import type {
  InventoryMovementDetail,
  InventoryMovementListRow,
} from "@/lib/warehouse/inventory-types";
import {
  movementListParams,
  serializeMovementState,
  type MovementState,
} from "./inventory-movements-state";

// The movements list's cache, as the products list's: one entry per page the
// address asks for, per organization and branch, and one per movement card.
//
//   ["inventory-movements", "<org>:<branch>", "list", <list params>]
//   ["inventory-movements", "<org>:<branch>", "detail", <route key>]

export interface MovementsScope {
  organizationId: string;
  branchId: string;
}

export type MovementList = PaginatedResult<InventoryMovementListRow>;

const scopeKey = (scope: MovementsScope) => `${scope.organizationId}:${scope.branchId}`;

export const inventoryMovementKeys = {
  all: ["inventory-movements"] as const,
  list: (scope: MovementsScope, state: MovementState) =>
    [...inventoryMovementKeys.all, scopeKey(scope), "list", movementListParams(state)] as const,
  detail: (scope: MovementsScope, routeKey: string) =>
    [...inventoryMovementKeys.all, scopeKey(scope), "detail", routeKey] as const,
};

/** A list page stays fresh this long: going back and forth costs nothing. */
const LIST_STALE_TIME = 30 * 1000;
const DETAIL_STALE_TIME = 60 * 1000;

/**
 * Sent after a movement changes in the panel (posted, cancelled, reversed,
 * accepted): the lists and cards refetch.
 */
export const MOVEMENTS_CHANGED_EVENT = "ambra:inventory-movements-changed";
export function notifyMovementsChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(MOVEMENTS_CHANGED_EVENT));
}

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

function scopeQuery(scope: MovementsScope) {
  return new URLSearchParams({ organizationId: scope.organizationId, branchId: scope.branchId });
}

export function fetchMovementList(
  scope: MovementsScope,
  state: MovementState,
  signal?: AbortSignal
) {
  const own = serializeMovementState({ ...state, selected: null });
  const query = new URLSearchParams(own.startsWith("?") ? own.slice(1) : own);
  for (const [key, value] of scopeQuery(scope)) query.set(key, value);
  return getJson<MovementList>(`/api/warehouse/movements?${query}`, signal);
}

export function fetchMovementDetail(scope: MovementsScope, routeKey: string, signal?: AbortSignal) {
  return getJson<InventoryMovementDetail>(
    `/api/warehouse/movements/${encodeURIComponent(routeKey)}?${scopeQuery(scope)}`,
    signal
  );
}

export const movementListQuery = (scope: MovementsScope, state: MovementState) => ({
  queryKey: inventoryMovementKeys.list(scope, state),
  queryFn: ({ signal }: { signal?: AbortSignal }) => fetchMovementList(scope, state, signal),
  staleTime: LIST_STALE_TIME,
});

export const movementDetailQuery = (scope: MovementsScope, routeKey: string) => ({
  queryKey: inventoryMovementKeys.detail(scope, routeKey),
  queryFn: ({ signal }: { signal?: AbortSignal }) => fetchMovementDetail(scope, routeKey, signal),
  staleTime: DETAIL_STALE_TIME,
});

export function invalidateInventoryMovements(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: inventoryMovementKeys.all });
}
