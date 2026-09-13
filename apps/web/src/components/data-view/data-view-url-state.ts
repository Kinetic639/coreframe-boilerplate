"use client";

import { useCallback, useMemo } from "react";
import { useQueryStates } from "nuqs";
import type { SortState, DataViewUrlState, DataViewListParams } from "./data-view.types";
import {
  DATA_VIEW_PARSERS,
  normalizeDataViewListParams,
  normalizeDataViewPage,
  normalizeDataViewPageSize,
  parseDataViewSort,
  type DataViewFilterRecord,
} from "./data-view-search-params";
import { getSelectionHistoryMode } from "./data-view-query-keys";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export const parseSortString = parseDataViewSort;

export function serializeSortString(sort: SortState): string {
  if (!sort) return "";
  return `${sort.field}.${sort.direction}`;
}

// ---------------------------------------------------------------------------
// nuqs parsers (defined at module level for stable references)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Hook return type
// ---------------------------------------------------------------------------

export type DataViewUrlStateHook = DataViewUrlState & {
  /** Stable memoized params object — safe to use as TanStack Query key dependency. */
  listParams: DataViewListParams;
  setSelected: (id: string | null) => void;
  closeDetail: (page?: number) => void;
  setSearch: (search: string) => void;
  setSort: (sort: SortState) => void;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  setFilters: (filters: DataViewFilterRecord) => void;
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Manages DataView URL state via nuqs.
 * - `selected` uses history.push so the back button clears the detail panel.
 * - All other changes use history.replace to avoid polluting the back stack.
 */
export function useDataViewUrlState(_entity: string): DataViewUrlStateHook {
  const [raw, setState] = useQueryStates(DATA_VIEW_PARSERS);

  const selected = raw.selected || null;
  const normalized = useMemo(
    () =>
      normalizeDataViewListParams({
        search: raw.search,
        sort: parseSortString(raw.sort),
        page: raw.page,
        pageSize: raw.pageSize,
        filters: raw.filters,
      }),
    [raw.filters, raw.page, raw.pageSize, raw.search, raw.sort]
  );
  const sort = normalized.sort;

  const setSelected = useCallback(
    (id: string | null) => {
      void setState({ selected: id ?? "" }, { history: getSelectionHistoryMode(selected, id) });
    },
    [selected, setState]
  );

  const closeDetail = useCallback(
    (page?: number) => {
      void setState(page !== undefined ? { selected: "", page } : { selected: "" }, {
        history: "replace",
      });
    },
    [setState]
  );

  const setSearch = useCallback(
    (search: string) => {
      void setState({ search: search ?? "", page: 1 }, { history: "replace" });
    },
    [setState]
  );

  const setSort = useCallback(
    (s: SortState) => {
      void setState({ sort: serializeSortString(s), page: 1 }, { history: "replace" });
    },
    [setState]
  );

  const setPage = useCallback(
    (p: number) => {
      void setState({ page: normalizeDataViewPage(p) }, { history: "replace" });
    },
    [setState]
  );

  const setPageSize = useCallback(
    (ps: number) => {
      void setState({ pageSize: normalizeDataViewPageSize(ps), page: 1 }, { history: "replace" });
    },
    [setState]
  );

  const setFilters = useCallback(
    (f: DataViewFilterRecord) => {
      void setState({ filters: f, page: 1 }, { history: "replace" });
    },
    [setState]
  );

  // Stable memoized params — only recreates when URL state actually changes.

  const listParams: DataViewListParams = normalized;

  return {
    selected,
    search: normalized.search,
    sort,
    page: normalized.page,
    pageSize: normalized.pageSize,
    filters: normalized.filters,
    listParams,
    setSelected,
    closeDetail,
    setSearch,
    setSort,
    setPage,
    setPageSize,
    setFilters,
  };
}
