"use client";

import { useCallback, useMemo } from "react";
import { useQueryStates, parseAsString, parseAsInteger, parseAsJson } from "nuqs";
import { z } from "zod";
import type { SortState, DataViewUrlState, DataViewListParams } from "./data-view.types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function parseSortString(sortStr: string): SortState {
  if (!sortStr) return null;
  const lastDot = sortStr.lastIndexOf(".");
  if (lastDot === -1) return null;
  const field = sortStr.slice(0, lastDot);
  const dir = sortStr.slice(lastDot + 1);
  if (dir !== "asc" && dir !== "desc") return null;
  return { field, direction: dir };
}

export function serializeSortString(sort: SortState): string {
  if (!sort) return "";
  return `${sort.field}.${sort.direction}`;
}

// ---------------------------------------------------------------------------
// nuqs parsers (defined at module level for stable references)
// ---------------------------------------------------------------------------

type FilterRecord = Record<string, string | string[] | boolean | null>;

const DEFAULT_FILTERS: FilterRecord = {};

const filterRecordSchema = z.record(
  z.union([z.string(), z.array(z.string()), z.boolean(), z.null()])
);

const DATA_VIEW_PARSERS = {
  selected: parseAsString.withDefault(""),
  search: parseAsString.withDefault(""),
  sort: parseAsString.withDefault(""),
  page: parseAsInteger.withDefault(1),
  pageSize: parseAsInteger.withDefault(50),
  filters: parseAsJson(filterRecordSchema).withDefault(DEFAULT_FILTERS),
};

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
  setFilters: (filters: FilterRecord) => void;
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
  const sort = parseSortString(raw.sort);

  const setSelected = useCallback(
    (id: string | null) => {
      void setState({ selected: id ?? "" }, { history: "push" });
    },
    [setState]
  );

  const closeDetail = useCallback(
    (page?: number) => {
      void setState(page !== undefined ? { selected: "", page } : { selected: "" }, {
        history: "push",
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
      void setState({ page: p }, { history: "replace" });
    },
    [setState]
  );

  const setPageSize = useCallback(
    (ps: number) => {
      void setState({ pageSize: ps, page: 1 }, { history: "replace" });
    },
    [setState]
  );

  const setFilters = useCallback(
    (f: FilterRecord) => {
      void setState({ filters: f, page: 1 }, { history: "replace" });
    },
    [setState]
  );

  // Stable memoized params — only recreates when URL state actually changes.

  const listParams = useMemo<DataViewListParams>(
    () => ({
      search: raw.search,
      sort,
      page: raw.page,
      pageSize: raw.pageSize,
      filters: raw.filters,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [raw.search, raw.sort, raw.page, raw.pageSize, raw.filters]
  );

  return {
    selected,
    search: raw.search,
    sort,
    page: raw.page,
    pageSize: raw.pageSize,
    filters: raw.filters,
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
