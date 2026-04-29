"use client";

import { useQuery } from "@tanstack/react-query";
import type { PaginatedResult, DataViewListParams } from "./data-view.types";

type UseDataViewListQueryOptions<TListRow> = {
  queryKey: string[];
  listFetcher: (params: DataViewListParams) => Promise<PaginatedResult<TListRow>>;
  listParams: DataViewListParams;
  initialData: PaginatedResult<TListRow>;
};

export function useDataViewListQuery<TListRow>({
  queryKey,
  listFetcher,
  listParams,
  initialData,
}: UseDataViewListQueryOptions<TListRow>) {
  return useQuery({
    queryKey: [...queryKey, listParams],
    queryFn: () => listFetcher(listParams),
    // IMPORTANT: Do NOT use `initialData` here.
    // TanStack Query v5 sets dataUpdatedAt = Date.now() when initialData is provided
    // without initialDataUpdatedAt, making the data "fresh" for the full staleTime.
    // This blocks refetches when query params change (filter/sort/page), causing the
    // "only works after refresh" bug.
    // `placeholderData` shows prior data while loading (smooth UX) but always fetches.
    placeholderData: (prev) => prev ?? initialData,
    staleTime: 30_000,
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
  });
}
