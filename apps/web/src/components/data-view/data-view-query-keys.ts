import type { QueryClient } from "@tanstack/react-query";
import type {
  DataViewListParams,
  DataViewScope,
  InfinitePaginatedData,
  PaginatedResult,
} from "./data-view.types";

export const DATA_VIEW_LIST_STALE_TIME = 60_000;
export const DATA_VIEW_DETAIL_STALE_TIME = 60_000;

export const dataViewKeys = {
  all: ["data-view"] as const,
  entity: (entity: string) => [...dataViewKeys.all, entity] as const,
  scopes: (entity: string) => [...dataViewKeys.entity(entity), "scope"] as const,
  scope: (entity: string, scope: DataViewScope) => [...dataViewKeys.scopes(entity), scope] as const,
  lists: (entity: string, scope: DataViewScope) =>
    [...dataViewKeys.scope(entity, scope), "list"] as const,
  list: (entity: string, scope: DataViewScope, params: DataViewListParams) =>
    [...dataViewKeys.lists(entity, scope), params] as const,
  sidebars: (entity: string, scope: DataViewScope) =>
    [...dataViewKeys.scope(entity, scope), "sidebar"] as const,
  sidebar: (entity: string, scope: DataViewScope, params: DataViewListParams) =>
    [
      ...dataViewKeys.sidebars(entity, scope),
      {
        search: params.search,
        sort: params.sort,
        filters: params.filters,
        page: params.page,
        pageSize: params.pageSize,
      },
    ] as const,
  details: (entity: string, scope: DataViewScope) =>
    [...dataViewKeys.scope(entity, scope), "detail"] as const,
  detail: (entity: string, scope: DataViewScope, id: string) =>
    [...dataViewKeys.details(entity, scope), id] as const,
};

export function getSelectionHistoryMode(
  currentSelectedId: string | null,
  nextSelectedId: string | null
): "push" | "replace" {
  return currentSelectedId === null && nextSelectedId !== null ? "push" : "replace";
}

export async function invalidateDataViewList(
  queryClient: QueryClient,
  entity: string,
  scope: DataViewScope
) {
  await queryClient.invalidateQueries({
    queryKey: dataViewKeys.sidebars(entity, scope),
    refetchType: "none",
  });
  await queryClient.invalidateQueries({ queryKey: dataViewKeys.lists(entity, scope) });
}

export function invalidateDataViewDetail(
  queryClient: QueryClient,
  entity: string,
  scope: DataViewScope,
  id: string
) {
  return queryClient.invalidateQueries({ queryKey: dataViewKeys.detail(entity, scope, id) });
}

export function invalidateDataViewEntity(
  queryClient: QueryClient,
  entity: string,
  scope: DataViewScope,
  id?: string
) {
  if (id) {
    return Promise.all([
      invalidateDataViewList(queryClient, entity, scope),
      invalidateDataViewDetail(queryClient, entity, scope, id),
    ]);
  }

  return queryClient.invalidateQueries({ queryKey: dataViewKeys.scope(entity, scope) });
}

export function invalidateDataViewEntityAllScopes(queryClient: QueryClient, entity: string) {
  return queryClient.invalidateQueries({ queryKey: dataViewKeys.entity(entity) });
}

export function synchronizeDataViewSidebarPage<TListRow>(
  queryClient: QueryClient,
  entity: string,
  scope: DataViewScope,
  params: DataViewListParams,
  freshPage: PaginatedResult<TListRow>
) {
  const key = dataViewKeys.sidebar(entity, scope, params);
  const wasInvalidated = queryClient.getQueryState(key)?.isInvalidated === true;

  queryClient.setQueryData<InfinitePaginatedData<TListRow>>(key, (current) => {
    if (!current) return current;
    if (wasInvalidated) {
      return { pages: [freshPage], pageParams: [freshPage.page] };
    }

    let replaced = false;
    const pages = current.pages.map((page) => {
      if (page.page !== freshPage.page) return page;
      replaced = true;
      return freshPage;
    });
    return replaced ? { ...current, pages } : current;
  });
}
