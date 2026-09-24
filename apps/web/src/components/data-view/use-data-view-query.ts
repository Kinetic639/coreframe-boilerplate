"use client";

import { useQuery } from "@tanstack/react-query";
import { useInfiniteQuery } from "@tanstack/react-query";
import type { PaginatedResult, DataViewListParams, InfinitePaginatedData } from "./data-view.types";

/**
 * Merges an optional branch identity into a DataView's base query key.
 *
 * branchId participates in React Query CACHE IDENTITY ONLY — it is never
 * forwarded to a listFetcher/detailFetcher as part of the request payload
 * (that stays governed entirely by DataViewListParams). Omitting branchId
 * (null/undefined) returns baseKey unchanged, so existing org-scoped callers
 * that never pass it keep the exact key shape they have today.
 */
export function buildDataViewQueryKey(baseKey: string[], branchId?: string | null): string[] {
  return branchId == null ? baseKey : [...baseKey, branchId];
}

type UseDataViewListQueryOptions<TListRow> = {
  queryKey: string[];
  listFetcher: (params: DataViewListParams) => Promise<PaginatedResult<TListRow>>;
  listParams: DataViewListParams;
  initialData: PaginatedResult<TListRow>;
  /** Optional branch scope for cache identity only — see buildDataViewQueryKey. */
  branchId?: string | null;
};

export function useDataViewListQuery<TListRow>({
  queryKey,
  listFetcher,
  listParams,
  initialData,
  branchId,
}: UseDataViewListQueryOptions<TListRow>) {
  return useQuery({
    queryKey: [...buildDataViewQueryKey(queryKey, branchId), listParams],
    queryFn: () => listFetcher(listParams),
    // IMPORTANT: Do NOT use `initialData` here.
    // TanStack Query v5 sets dataUpdatedAt = Date.now() when initialData is provided
    // without initialDataUpdatedAt, making the data "fresh" for the full staleTime.
    // This blocks refetches when query params change (filter/sort/page), causing the
    // "only works after refresh" bug.
    // `placeholderData` shows prior data while loading (smooth UX) but always fetches.
    placeholderData: (prev) => prev ?? initialData,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

type UseDataViewDetailQueryOptions<TDetail> = {
  queryKey: string[];
  detailFetcher: (id: string) => Promise<TDetail | null>;
  selectedId: string | null;
};

export function useDataViewDetailQuery<TDetail>({
  queryKey,
  detailFetcher,
  selectedId,
}: UseDataViewDetailQueryOptions<TDetail>) {
  return useQuery({
    queryKey: [...queryKey, "detail", selectedId],
    queryFn: () => detailFetcher(selectedId!),
    enabled: !!selectedId,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

type UseDataViewSidebarInfiniteQueryOptions<TListRow> = {
  queryKey: string[];
  listFetcher: (params: DataViewListParams) => Promise<PaginatedResult<TListRow>>;
  listParams: DataViewListParams;
  initialPageData: PaginatedResult<TListRow>;
  enabled: boolean;
  /** Optional branch scope for cache identity only — see buildDataViewQueryKey. */
  branchId?: string | null;
};

export function useDataViewSidebarInfiniteQuery<TListRow>({
  queryKey,
  listFetcher,
  listParams,
  initialPageData,
  enabled,
  branchId,
}: UseDataViewSidebarInfiniteQueryOptions<TListRow>) {
  const canSeedFromInitialPage =
    initialPageData.page === listParams.page && initialPageData.pageSize === listParams.pageSize;

  return useInfiniteQuery<
    PaginatedResult<TListRow>,
    Error,
    InfinitePaginatedData<TListRow>,
    readonly unknown[],
    number
  >({
    queryKey: [
      ...buildDataViewQueryKey(queryKey, branchId),
      "sidebar",
      {
        search: listParams.search,
        sort: listParams.sort,
        filters: listParams.filters,
        pageSize: listParams.pageSize,
      },
    ],
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
      enabled && canSeedFromInitialPage
        ? {
            pages: [initialPageData],
            pageParams: [listParams.page],
          }
        : undefined,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}
