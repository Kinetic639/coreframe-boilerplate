"use client";

import React, { createContext, useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type {
  DataViewColumnDef,
  DataViewFilterDef,
  DataViewProps,
  DataViewScope,
  PaginatedResult,
} from "./data-view.types";
import type { DataViewUrlStateHook } from "./data-view-url-state";
import { useDataViewUrlState } from "./data-view-url-state";
import {
  useDataViewListQuery,
  useDataViewDetailQuery,
  useDataViewSidebarInfiniteQuery,
} from "./use-data-view-query";
import { useColumnVisibility } from "./data-view-columns";
import { useDataViewReturn } from "./use-data-view-return";
import {
  dataViewKeys,
  invalidateDataViewEntity,
  synchronizeDataViewSidebarPage,
} from "./data-view-query-keys";
import { recoverDataViewPage } from "./data-view-search-params";

export type DataViewStaticContextValue<TListRow, TDetail> = {
  entity: string;
  scope: DataViewScope;
  queryKey: string[];
  columns: DataViewColumnDef<TListRow>[];
  filters: DataViewFilterDef[];
  getRowId: (row: TListRow) => string;
  renderCompactItem?: (row: TListRow) => React.ReactNode;
  renderMobileItem?: (row: TListRow) => React.ReactNode;
  renderExpandedRow?: (row: TListRow) => React.ReactNode;
  renderRowControl?: (row: TListRow) => React.ReactNode;
  renderToolbarControls?: () => React.ReactNode;
  renderDetail: (detail: TDetail) => React.ReactNode;
};

export type DataViewUrlContextValue = {
  urlState: DataViewUrlStateHook;
  isDetailOpen: boolean;
};

export type DataViewListContextValue<TListRow> = {
  listData: PaginatedResult<TListRow>;
  listIsLoading: boolean;
  listIsTransitioning: boolean;
  listIsRefreshing: boolean;
  listError: Error | null;
};

export type DataViewColumnsContextValue = {
  columnVisibility: Record<string, boolean>;
  setColumnVisibility: (key: string, visible: boolean) => void;
};

export type DataViewSelectionContextValue = {
  selectedRowIds: Record<string, true>;
  selectedRowCount: number;
  keepOnlySelected: boolean;
  isRowSelected: (id: string) => boolean;
  toggleRowSelected: (id: string) => void;
  toggleSelectAllCurrentPage: () => void;
  clearSelectedRows: () => void;
  enableKeepOnlySelected: () => void;
  disableKeepOnlySelected: () => void;
  allCurrentPageRowsSelected: boolean;
  someCurrentPageRowsSelected: boolean;
};

export type DataViewSidebarContextValue<TListRow> = {
  sidebarRows: TListRow[];
  sidebarTotalCount: number;
  sidebarIsLoading: boolean;
  sidebarIsFetchingNextPage: boolean;
  sidebarIsFetchingPreviousPage: boolean;
  sidebarHasNextPage: boolean;
  sidebarHasPreviousPage: boolean;
  sidebarError: Error | null;
  fetchSidebarNextPage: () => Promise<unknown>;
  fetchSidebarPreviousPage: () => Promise<unknown>;
};

export type DataViewDetailContextValue<TDetail> = {
  detailData: TDetail | null | undefined;
  detailIsLoading: boolean;
  detailIsRefreshing: boolean;
  detailError: Error | null;
  detailNotFound: boolean;
  selectedOutsideCurrentResults: boolean;
  closeDetail: () => void;
  isClosingDetail: boolean;
  returnHighlightId: string | null;
  clearReturnHighlight: () => void;
};

export const DataViewStaticContext = createContext<DataViewStaticContextValue<any, any> | null>(
  null
);
export const DataViewUrlContext = createContext<DataViewUrlContextValue | null>(null);
export const DataViewListContext = createContext<DataViewListContextValue<any> | null>(null);
export const DataViewColumnsContext = createContext<DataViewColumnsContextValue | null>(null);
export const DataViewSelectionContext = createContext<DataViewSelectionContextValue | null>(null);
export const DataViewSidebarContext = createContext<DataViewSidebarContextValue<any> | null>(null);
export const DataViewDetailContext = createContext<DataViewDetailContextValue<any> | null>(null);

type DataViewProviderProps<TListRow, TDetail> = Pick<
  DataViewProps<TListRow, TDetail>,
  | "entity"
  | "scope"
  | "columns"
  | "filters"
  | "initialData"
  | "initialDataUpdatedAt"
  | "queryKey"
  | "listFetcher"
  | "detailFetcher"
  | "resolveSelectedPage"
  | "getRowId"
  | "renderCompactItem"
  | "renderMobileItem"
  | "renderExpandedRow"
  | "renderRowControl"
  | "renderToolbarControls"
  | "renderDetail"
  | "onSelectionChange"
  | "refreshToken"
> & {
  children: React.ReactNode;
};

export function DataViewProvider<TListRow, TDetail>({
  entity,
  scope,
  columns,
  filters = [],
  initialData,
  initialDataUpdatedAt,
  queryKey,
  listFetcher,
  detailFetcher,
  resolveSelectedPage,
  getRowId,
  renderCompactItem,
  renderMobileItem,
  renderExpandedRow,
  renderRowControl,
  renderToolbarControls,
  renderDetail,
  onSelectionChange,
  refreshToken,
  children,
}: DataViewProviderProps<TListRow, TDetail>) {
  const queryClient = useQueryClient();
  const scopeKey = JSON.stringify(scope);
  const stableScope = useMemo<DataViewScope>(() => JSON.parse(scopeKey), [scopeKey]);
  const urlState = useDataViewUrlState(entity);
  const setUrlPage = urlState.setPage;
  const lastRefreshTokenRef = React.useRef(refreshToken);
  const { columnVisibility, setColumnVisibility } = useColumnVisibility(entity, columns);
  const [selectedRowIds, setSelectedRowIds] = React.useState<Record<string, true>>({});
  const [keepOnlySelected, setKeepOnlySelected] = React.useState(false);
  const initialListParamsRef = React.useRef(urlState.listParams);
  const initialScopeKeyRef = React.useRef(scopeKey);
  const initialParamsKey = JSON.stringify(initialListParamsRef.current);
  const currentParamsKey = JSON.stringify(urlState.listParams);
  const initialDataForCurrentParams =
    initialParamsKey === currentParamsKey && initialScopeKeyRef.current === scopeKey
      ? initialData
      : undefined;

  useEffect(() => {
    onSelectionChange?.(Object.keys(selectedRowIds));
  }, [selectedRowIds, onSelectionChange]);

  const listQuery = useDataViewListQuery<TListRow>({
    entity,
    scope: stableScope,
    listFetcher,
    listParams: urlState.listParams,
    initialData: initialDataForCurrentParams,
    initialDataUpdatedAt:
      initialDataForCurrentParams === undefined ? undefined : initialDataUpdatedAt,
  });

  const detailQuery = useDataViewDetailQuery<TDetail>({
    entity,
    scope: stableScope,
    detailFetcher,
    selectedId: urlState.selected,
  });

  useEffect(() => {
    if (refreshToken === undefined) return;
    if (lastRefreshTokenRef.current === refreshToken) return;
    lastRefreshTokenRef.current = refreshToken;
    void invalidateDataViewEntity(queryClient, entity, stableScope);
  }, [queryClient, entity, stableScope, refreshToken]);

  const isDetailOpen = !!urlState.selected;
  const resolvedListData = useMemo(
    () =>
      listQuery.data ??
      (initialScopeKeyRef.current === scopeKey ? initialData : undefined) ?? {
        rows: [],
        totalCount: 0,
        page: urlState.page,
        pageSize: urlState.pageSize,
      },
    [initialData, listQuery.data, scopeKey, urlState.page, urlState.pageSize]
  );
  const sidebarQuery = useDataViewSidebarInfiniteQuery<TListRow>({
    entity,
    scope: stableScope,
    listFetcher,
    listParams: urlState.listParams,
    initialPageData: listQuery.isPlaceholderData ? undefined : resolvedListData,
    initialDataUpdatedAt: queryClient.getQueryState(
      dataViewKeys.list(entity, stableScope, urlState.listParams)
    )?.dataUpdatedAt,
    enabled: isDetailOpen && !listQuery.isPlaceholderData,
  });

  useEffect(() => {
    if (!listQuery.isSuccess || listQuery.isPlaceholderData || !listQuery.data) return;

    synchronizeDataViewSidebarPage(
      queryClient,
      entity,
      stableScope,
      urlState.listParams,
      listQuery.data
    );
  }, [
    entity,
    stableScope,
    listQuery.data,
    listQuery.isPlaceholderData,
    listQuery.isSuccess,
    queryClient,
    urlState.listParams,
  ]);

  useEffect(() => {
    if (!listQuery.isSuccess || listQuery.isPlaceholderData || !listQuery.data) return;
    const recoveredPage = recoverDataViewPage(
      urlState.page,
      listQuery.data.totalCount,
      urlState.pageSize
    );
    if (recoveredPage !== urlState.page) setUrlPage(recoveredPage);
  }, [
    listQuery.data,
    listQuery.isPlaceholderData,
    listQuery.isSuccess,
    urlState.page,
    urlState.pageSize,
    setUrlPage,
  ]);

  const sidebarRows = useMemo(() => {
    const pages = sidebarQuery.data?.pages ?? [resolvedListData];
    const seen = new Set<string>();

    return pages
      .flatMap((page) => page.rows)
      .filter((row) => {
        const rowId = getRowId(row);
        if (seen.has(rowId)) return false;
        seen.add(rowId);
        return true;
      });
  }, [sidebarQuery.data?.pages, resolvedListData, getRowId]);

  const sidebarPages = sidebarQuery.data?.pages;
  const sidebarTotalCount = sidebarPages?.[0]?.totalCount ?? resolvedListData.totalCount;
  const { closeDetail, returnHighlightId, clearReturnHighlight } = useDataViewReturn({
    enabled: isDetailOpen,
    listParams: urlState.listParams,
    resolveSelectedPage,
    sidebarPages,
    getRowId,
    urlState,
  });
  const filtersKey = useMemo(() => JSON.stringify(urlState.filters), [urlState.filters]);

  const staticValue = useMemo<DataViewStaticContextValue<TListRow, TDetail>>(
    () => ({
      entity,
      scope: stableScope,
      queryKey,
      columns,
      filters,
      getRowId,
      renderCompactItem,
      renderMobileItem,
      renderExpandedRow,
      renderRowControl,
      renderToolbarControls,
      renderDetail,
    }),
    [
      entity,
      stableScope,
      queryKey,
      columns,
      filters,
      getRowId,
      renderCompactItem,
      renderMobileItem,
      renderExpandedRow,
      renderRowControl,
      renderToolbarControls,
      renderDetail,
    ]
  );

  const urlValue = useMemo<DataViewUrlContextValue>(
    () => ({
      urlState,
      isDetailOpen,
    }),
    [urlState, isDetailOpen]
  );

  const listValue = useMemo<DataViewListContextValue<TListRow>>(
    () => ({
      listData: resolvedListData,
      listIsLoading: listQuery.isPending && !listQuery.data,
      listIsTransitioning: listQuery.isFetching && listQuery.isPlaceholderData,
      listIsRefreshing: listQuery.isFetching && !listQuery.isPlaceholderData && !!listQuery.data,
      listError: listQuery.error,
    }),
    [
      resolvedListData,
      listQuery.data,
      listQuery.error,
      listQuery.isFetching,
      listQuery.isPending,
      listQuery.isPlaceholderData,
    ]
  );

  const columnsValue = useMemo<DataViewColumnsContextValue>(
    () => ({
      columnVisibility,
      setColumnVisibility,
    }),
    [columnVisibility, setColumnVisibility]
  );

  const currentPageRowIds = useMemo(
    () => resolvedListData.rows.map((row) => getRowId(row)),
    [resolvedListData.rows, getRowId]
  );

  const toggleRowSelected = React.useCallback((id: string) => {
    setSelectedRowIds((prev) => {
      if (prev[id]) {
        const next = { ...prev };
        delete next[id];
        return next;
      }
      return { ...prev, [id]: true };
    });
  }, []);

  const clearSelectedRows = React.useCallback(() => {
    setSelectedRowIds((current) => (Object.keys(current).length > 0 ? {} : current));
    setKeepOnlySelected((current) => (current ? false : current));
  }, []);

  const toggleSelectAllCurrentPage = React.useCallback(() => {
    setSelectedRowIds((prev) => {
      const allSelected =
        currentPageRowIds.length > 0 && currentPageRowIds.every((rowId) => !!prev[rowId]);

      if (allSelected) {
        const next = { ...prev };
        currentPageRowIds.forEach((rowId) => {
          delete next[rowId];
        });
        return next;
      }

      const next = { ...prev };
      currentPageRowIds.forEach((rowId) => {
        next[rowId] = true;
      });
      return next;
    });
  }, [currentPageRowIds]);

  const enableKeepOnlySelected = React.useCallback(() => {
    setKeepOnlySelected(true);
  }, []);

  const disableKeepOnlySelected = React.useCallback(() => {
    setKeepOnlySelected(false);
  }, []);

  const allCurrentPageRowsSelected =
    currentPageRowIds.length > 0 && currentPageRowIds.every((rowId) => !!selectedRowIds[rowId]);
  const someCurrentPageRowsSelected = currentPageRowIds.some((rowId) => !!selectedRowIds[rowId]);
  const selectedRowCount = Object.keys(selectedRowIds).length;

  const selectionValue = useMemo<DataViewSelectionContextValue>(
    () => ({
      selectedRowIds,
      selectedRowCount,
      keepOnlySelected,
      isRowSelected: (id: string) => !!selectedRowIds[id],
      toggleRowSelected,
      toggleSelectAllCurrentPage,
      clearSelectedRows,
      enableKeepOnlySelected,
      disableKeepOnlySelected,
      allCurrentPageRowsSelected,
      someCurrentPageRowsSelected,
    }),
    [
      selectedRowIds,
      selectedRowCount,
      keepOnlySelected,
      toggleRowSelected,
      toggleSelectAllCurrentPage,
      clearSelectedRows,
      enableKeepOnlySelected,
      disableKeepOnlySelected,
      allCurrentPageRowsSelected,
      someCurrentPageRowsSelected,
    ]
  );

  React.useEffect(() => {
    setSelectedRowIds((current) => (Object.keys(current).length > 0 ? {} : current));
    setKeepOnlySelected((current) => (current ? false : current));
  }, [
    urlState.search,
    urlState.sort?.field,
    urlState.sort?.direction,
    urlState.page,
    urlState.pageSize,
    filtersKey,
  ]);

  const sidebarValue = useMemo<DataViewSidebarContextValue<TListRow>>(
    () => ({
      sidebarRows,
      sidebarTotalCount,
      sidebarIsLoading: sidebarQuery.isFetching && !sidebarQuery.isFetchingNextPage,
      sidebarIsFetchingNextPage: sidebarQuery.isFetchingNextPage,
      sidebarIsFetchingPreviousPage: sidebarQuery.isFetchingPreviousPage,
      sidebarHasNextPage: !!sidebarQuery.hasNextPage,
      sidebarHasPreviousPage: !!sidebarQuery.hasPreviousPage,
      sidebarError: sidebarQuery.error ?? listQuery.error,
      fetchSidebarNextPage: sidebarQuery.fetchNextPage,
      fetchSidebarPreviousPage: sidebarQuery.fetchPreviousPage,
    }),
    [
      sidebarRows,
      sidebarTotalCount,
      sidebarQuery.isFetching,
      sidebarQuery.isFetchingNextPage,
      sidebarQuery.isFetchingPreviousPage,
      sidebarQuery.hasNextPage,
      sidebarQuery.hasPreviousPage,
      sidebarQuery.error,
      listQuery.error,
      sidebarQuery.fetchNextPage,
      sidebarQuery.fetchPreviousPage,
    ]
  );

  const detailValue = useMemo<DataViewDetailContextValue<TDetail>>(
    () => ({
      detailData: detailQuery.data,
      detailIsLoading: isDetailOpen && detailQuery.isPending,
      detailIsRefreshing: detailQuery.isFetching && detailQuery.data != null,
      detailError: detailQuery.error,
      detailNotFound: detailQuery.isSuccess && detailQuery.data === null,
      selectedOutsideCurrentResults:
        isDetailOpen && !resolvedListData.rows.some((row) => getRowId(row) === urlState.selected),
      closeDetail,
      isClosingDetail: false,
      returnHighlightId,
      clearReturnHighlight,
    }),
    [
      detailQuery.data,
      detailQuery.error,
      detailQuery.isFetching,
      detailQuery.isPending,
      detailQuery.isSuccess,
      isDetailOpen,
      resolvedListData.rows,
      getRowId,
      urlState.selected,
      closeDetail,
      returnHighlightId,
      clearReturnHighlight,
    ]
  );

  return (
    <DataViewStaticContext.Provider value={staticValue}>
      <DataViewUrlContext.Provider value={urlValue}>
        <DataViewListContext.Provider value={listValue}>
          <DataViewColumnsContext.Provider value={columnsValue}>
            <DataViewSelectionContext.Provider value={selectionValue}>
              <DataViewSidebarContext.Provider value={sidebarValue}>
                <DataViewDetailContext.Provider value={detailValue}>
                  {children}
                </DataViewDetailContext.Provider>
              </DataViewSidebarContext.Provider>
            </DataViewSelectionContext.Provider>
          </DataViewColumnsContext.Provider>
        </DataViewListContext.Provider>
      </DataViewUrlContext.Provider>
    </DataViewStaticContext.Provider>
  );
}
