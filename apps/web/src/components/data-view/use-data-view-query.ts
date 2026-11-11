"use client";

import { useQuery } from "@tanstack/react-query";
import { useInfiniteQuery } from "@tanstack/react-query";
import type {
  PaginatedResult,
  DataViewListParams,
  DataViewScope,
  InfinitePaginatedData,
} from "./data-view.types";
import {
  DATA_VIEW_DETAIL_STALE_TIME,
  DATA_VIEW_LIST_STALE_TIME,
  dataViewKeys,
} from "./data-view-query-keys";

type UseDataViewListQueryOptions<TListRow> = {
  entity: string;
  scope: DataViewScope;
  listFetcher: (params: DataViewListParams) => Promise<PaginatedResult<TListRow>>;
  listParams: DataViewListParams;
  initialData?: PaginatedResult<TListRow>;
  initialDataUpdatedAt?: number;
};

export function useDataViewListQuery<TListRow>({
  entity,
  scope,
  listFetcher,
  listParams,
  initialData,
  initialDataUpdatedAt,
}: UseDataViewListQueryOptions<TListRow>) {
  return useQuery({
    queryKey: dataViewKeys.list(entity, scope, listParams),
    queryFn: () => listFetcher(listParams),
    initialData,
    initialDataUpdatedAt,
    placeholderData: (previous) => previous,
    staleTime: DATA_VIEW_LIST_STALE_TIME,
    refetchOnWindowFocus: false,
  });
}

type UseDataViewDetailQueryOptions<TDetail> = {
  entity: string;
  scope: DataViewScope;
  detailFetcher: (id: string) => Promise<TDetail | null>;
  selectedId: string | null;
};

export function useDataViewDetailQuery<TDetail>({
  entity,
  scope,
  detailFetcher,
  selectedId,
}: UseDataViewDetailQueryOptions<TDetail>) {
  return useQuery({
    queryKey: selectedId
      ? dataViewKeys.detail(entity, scope, selectedId)
      : [...dataViewKeys.details(entity, scope), "none"],
    queryFn: () => detailFetcher(selectedId!),
    enabled: !!selectedId,
    staleTime: DATA_VIEW_DETAIL_STALE_TIME,
    refetchOnWindowFocus: false,
  });
}

type UseDataViewSidebarInfiniteQueryOptions<TListRow> = {
  entity: string;
  scope: DataViewScope;
  listFetcher: (params: DataViewListParams) => Promise<PaginatedResult<TListRow>>;
  listParams: DataViewListParams;
  initialPageData?: PaginatedResult<TListRow>;
  initialDataUpdatedAt?: number;
  enabled: boolean;
};

export function useDataViewSidebarInfiniteQuery<TListRow>({
  entity,
  scope,
  listFetcher,
  listParams,
  initialPageData,
  initialDataUpdatedAt,
  enabled,
}: UseDataViewSidebarInfiniteQueryOptions<TListRow>) {
  const canSeedFromInitialPage =
    initialPageData?.page === listParams.page && initialPageData?.pageSize === listParams.pageSize;

  return useInfiniteQuery<
    PaginatedResult<TListRow>,
    Error,
    InfinitePaginatedData<TListRow>,
    readonly unknown[],
    number
  >({
    queryKey: dataViewKeys.sidebar(entity, scope, listParams),
    queryFn: ({ pageParam }) =>
      listFetcher({
        ...listParams,
        page: pageParam,
      }),
    enabled,
    initialPageParam: listParams.page,
    getNextPageParam: (lastPage) => {
      const totalPages = Math.max(1, Math.ceil(lastPage.totalCount / lastPage.pageSize));
      return lastPage.page < totalPages ? lastPage.page + 1 : undefined;
    },
    getPreviousPageParam: (firstPage) => {
      return firstPage.page > 1 ? firstPage.page - 1 : undefined;
    },
    initialData:
      enabled && canSeedFromInitialPage && initialPageData
        ? {
            pages: [initialPageData],
            pageParams: [listParams.page],
          }
        : undefined,
    initialDataUpdatedAt,
    staleTime: DATA_VIEW_LIST_STALE_TIME,
    refetchOnWindowFocus: false,
  });
}
