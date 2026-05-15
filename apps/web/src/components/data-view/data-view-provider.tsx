"use client";

import React, { createContext, useEffect, useMemo } from "react";
import type {
  DataViewColumnDef,
  DataViewFilterDef,
  DataViewProps,
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

export type DataViewStaticContextValue<TListRow, TDetail> = {
  entity: string;
  columns: DataViewColumnDef<TListRow>[];
  filters: DataViewFilterDef[];
  getRowId: (row: TListRow) => string;
  renderCompactItem?: (row: TListRow) => React.ReactNode;
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
  fetchSidebarNextPage: () => Promise<unknown>;
  fetchSidebarPreviousPage: () => Promise<unknown>;
};

export type DataViewDetailContextValue<TDetail> = {
  detailData: TDetail | null | undefined;
  detailIsLoading: boolean;
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
  | "columns"
  | "filters"
  | "initialData"
  | "queryKey"
  | "listFetcher"
  | "detailFetcher"
  | "resolveSelectedPage"
  | "getRowId"
  | "renderCompactItem"
  | "renderExpandedRow"
  | "renderRowControl"
  | "renderToolbarControls"
  | "renderDetail"
  | "onSelectionChange"
> & {
  children: React.ReactNode;
};

export function DataViewProvider<TListRow, TDetail>({
  entity,
  columns,
  filters = [],
  initialData,
  queryKey,
  listFetcher,
  detailFetcher,
  resolveSelectedPage,
  getRowId,
  renderCompactItem,
  renderExpandedRow,
  renderRowControl,
  renderToolbarControls,
  renderDetail,
  onSelectionChange,
  children,
}: DataViewProviderProps<TListRow, TDetail>) {
  const urlState = useDataViewUrlState(entity);

  const { columnVisibility, setColumnVisibility } = useColumnVisibility(
    entity,
    columns.map((c) => c.key)
  );
  const [selectedRowIds, setSelectedRowIds] = React.useState<Record<string, true>>({});
  const [keepOnlySelected, setKeepOnlySelected] = React.useState(false);

  useEffect(() => {
    onSelectionChange?.(Object.keys(selectedRowIds));
  }, [selectedRowIds, onSelectionChange]);

  const listQuery = useDataViewListQuery<TListRow>({
    queryKey,
    listFetcher,
    listParams: urlState.listParams,
    initialData,
  });

  const detailQuery = useDataViewDetailQuery<TDetail>({
    queryKey,
    detailFetcher,
    selectedId: urlState.selected,
  });

  const isDetailOpen = !!urlState.selected;
  const resolvedListData = listQuery.data ?? initialData;
  const sidebarQuery = useDataViewSidebarInfiniteQuery<TListRow>({
    queryKey,
    listFetcher,
    listParams: urlState.listParams,
    initialPageData: resolvedListData,
    enabled: isDetailOpen,
  });

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
      columns,
      filters,
      getRowId,
      renderCompactItem,
      renderExpandedRow,
      renderRowControl,
      renderToolbarControls,
      renderDetail,
    }),
    [
      entity,
      columns,
      filters,
      getRowId,
      renderCompactItem,
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
      listIsLoading: listQuery.isFetching,
      listIsTransitioning:
        listQuery.isFetching && listQuery.isPlaceholderData && listQuery.isFetched,
    }),
    [resolvedListData, listQuery.isFetching, listQuery.isPlaceholderData, listQuery.isFetched]
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
    setSelectedRowIds({});
    setKeepOnlySelected(false);
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
    setSelectedRowIds({});
    setKeepOnlySelected(false);
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
      sidebarQuery.fetchNextPage,
      sidebarQuery.fetchPreviousPage,
    ]
  );

  const detailValue = useMemo<DataViewDetailContextValue<TDetail>>(
    () => ({
      detailData: detailQuery.data,
      detailIsLoading: detailQuery.isFetching,
      closeDetail,
      isClosingDetail: false,
      returnHighlightId,
      clearReturnHighlight,
    }),
    [detailQuery.data, detailQuery.isFetching, closeDetail, returnHighlightId, clearReturnHighlight]
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
