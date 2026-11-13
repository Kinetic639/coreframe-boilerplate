import type { QueryClient } from "@tanstack/react-query";
import type { DataViewListParams, DataViewScope } from "./types";

// Query keys shared by the server-paged lists (one entry per page the address
// asks for and one per record, per entity and scope), and how a change to a
// record drops them.

export const dataViewKeys = {
  all: ["data-view"] as const,
  entity: (entity: string) => [...dataViewKeys.all, entity] as const,
  scope: (entity: string, scope: DataViewScope) =>
    [...dataViewKeys.entity(entity), "scope", scope] as const,
  lists: (entity: string, scope: DataViewScope) =>
    [...dataViewKeys.scope(entity, scope), "list"] as const,
  list: (entity: string, scope: DataViewScope, params: DataViewListParams) =>
    [...dataViewKeys.lists(entity, scope), params] as const,
  details: (entity: string, scope: DataViewScope) =>
    [...dataViewKeys.scope(entity, scope), "detail"] as const,
  detail: (entity: string, scope: DataViewScope, id: string) =>
    [...dataViewKeys.details(entity, scope), id] as const,
};

/** Drops an entity's list pages, and its record when one is named (else all of the scope). */
export function invalidateDataViewEntity(
  queryClient: QueryClient,
  entity: string,
  scope: DataViewScope,
  id?: string
) {
  if (id) {
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: dataViewKeys.lists(entity, scope) }),
      queryClient.invalidateQueries({ queryKey: dataViewKeys.detail(entity, scope, id) }),
    ]);
  }
  return queryClient.invalidateQueries({ queryKey: dataViewKeys.scope(entity, scope) });
}
