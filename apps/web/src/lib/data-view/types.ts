// The contract between a server-paged list and its source: what a list asks
// for (the search, the sort, the page, the filters) and the page it gets.

export type PaginatedResult<T> = {
  rows: T[];
  totalCount: number;
  page: number;
  pageSize: number;
};

export type SortState = {
  field: string;
  direction: "asc" | "desc";
} | null;

export type DataViewListParams = {
  search: string;
  sort: SortState;
  page: number;
  pageSize: number;
  filters: Record<string, string | string[] | boolean | null>;
};

export type DataViewScopePrimitive = string | number | boolean | null;

/** Whose rows a cache entry holds (an organization, a branch, everyone). */
export type DataViewScope = Readonly<Record<string, DataViewScopePrimitive>>;
