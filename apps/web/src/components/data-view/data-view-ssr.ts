import "server-only";

import { QueryClient } from "@tanstack/react-query";
import type { DataViewListParams, DataViewScope, PaginatedResult } from "./data-view.types";
import {
  DATA_VIEW_DETAIL_STALE_TIME,
  DATA_VIEW_LIST_STALE_TIME,
  dataViewKeys,
} from "./data-view-query-keys";

export function createDataViewServerQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: DATA_VIEW_LIST_STALE_TIME,
        retry: false,
      },
    },
  });
}

export function prefetchDataViewList<TListRow>(args: {
  queryClient: QueryClient;
  entity: string;
  scope: DataViewScope;
  params: DataViewListParams;
  fetcher: () => Promise<PaginatedResult<TListRow>>;
}) {
  return args.queryClient.prefetchQuery({
    queryKey: dataViewKeys.list(args.entity, args.scope, args.params),
    queryFn: args.fetcher,
    staleTime: DATA_VIEW_LIST_STALE_TIME,
  });
}

export function prefetchDataViewDetail<TDetail>(args: {
  queryClient: QueryClient;
  entity: string;
  scope: DataViewScope;
  selectedId: string;
  fetcher: () => Promise<TDetail | null>;
}) {
  return args.queryClient.prefetchQuery({
    queryKey: dataViewKeys.detail(args.entity, args.scope, args.selectedId),
    queryFn: args.fetcher,
    staleTime: DATA_VIEW_DETAIL_STALE_TIME,
  });
}
