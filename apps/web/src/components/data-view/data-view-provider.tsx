"use client";

import React, { createContext, useMemo } from "react";
import type {
  DataViewColumnDef,
  DataViewFilterDef,
  DataViewProps,
  PaginatedResult,
} from "./data-view.types";
import type { DataViewUrlStateHook } from "./data-view-url-state";
import { useDataViewUrlState } from "./data-view-url-state";
import { useDataViewListQuery, useDataViewDetailQuery } from "./use-data-view-query";
import { useColumnVisibility } from "./data-view-columns";

type DataViewContextValue<TListRow, TDetail> = {
  // Entity
  entity: string;
  // Columns
  columns: DataViewColumnDef<TListRow>[];
  filters: DataViewFilterDef[];
  // Column visibility — single shared instance so table and manager stay in sync
  columnVisibility: Record<string, boolean>;
  setColumnVisibility: (key: string, visible: boolean) => void;
  // URL state
  urlState: DataViewUrlStateHook;
  // Data
  listData: PaginatedResult<TListRow>;
  listIsLoading: boolean;
  detailData: TDetail | null | undefined;
  detailIsLoading: boolean;
  // Actions
  getRowId: (row: TListRow) => string;
  renderCompactItem?: (row: TListRow) => React.ReactNode;
  renderDetail: (detail: TDetail) => React.ReactNode;
  isDetailOpen: boolean;
};

const DataViewContext = createContext<DataViewContextValue<any, any> | null>(null);

export { DataViewContext };

type DataViewProviderProps<TListRow, TDetail> = Pick<
  DataViewProps<TListRow, TDetail>,
  | "entity"
  | "columns"
  | "filters"
  | "initialData"
  | "queryKey"
  | "listFetcher"
  | "detailFetcher"
  | "getRowId"
  | "renderCompactItem"
  | "renderDetail"
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
  getRowId,
  renderCompactItem,
  renderDetail,
  children,
}: DataViewProviderProps<TListRow, TDetail>) {
  const urlState = useDataViewUrlState(entity);

  // Single column visibility instance — shared via context so table and manager
  // always read/write the same React state.
  const { columnVisibility, setColumnVisibility } = useColumnVisibility(
    entity,
    columns.map((c) => c.key)
  );

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

  const value = useMemo<DataViewContextValue<TListRow, TDetail>>(
    () => ({
      entity,
      columns,
      filters,
      columnVisibility,
      setColumnVisibility,
      urlState,
      listData: listQuery.data ?? initialData,
      listIsLoading: listQuery.isFetching,
      detailData: detailQuery.data,
      detailIsLoading: detailQuery.isFetching,
      getRowId,
      renderCompactItem,
      renderDetail,
      isDetailOpen,
    }),
    [
      entity,
      columns,
      filters,
      columnVisibility,
      setColumnVisibility,
      urlState,
      listQuery.data,
      listQuery.isFetching,
      detailQuery.data,
      detailQuery.isFetching,
      initialData,
      getRowId,
      renderCompactItem,
      renderDetail,
      isDetailOpen,
    ]
  );

  return <DataViewContext.Provider value={value}>{children}</DataViewContext.Provider>;
}
