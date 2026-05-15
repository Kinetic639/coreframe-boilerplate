import type React from "react";

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

export type DataViewFilterDef =
  | { type: "text"; key: string; label: string }
  | { type: "select"; key: string; label: string; options: { label: string; value: string }[] }
  | {
      type: "multi-select";
      key: string;
      label: string;
      options: { label: string; value: string }[];
    }
  | { type: "range"; key: string; label: string; minKey: string; maxKey: string }
  | { type: "boolean"; key: string; label: string }
  | { type: "date-range"; key: string; label: string; fromKey: string; toKey: string };

export type DataViewUrlState = {
  selected: string | null;
  search: string;
  sort: SortState;
  page: number;
  pageSize: number;
  filters: Record<string, string | string[] | boolean | null>;
};

export type DataViewListParams = {
  search: string;
  sort: SortState;
  page: number;
  pageSize: number;
  filters: Record<string, string | string[] | boolean | null>;
};

export type DataViewColumnDef<TRow> = {
  key: string;
  header: string;
  accessor: (row: TRow) => React.ReactNode;
  sortable?: boolean;
  defaultVisible?: boolean;
  compactLabel?: boolean; // show in compact sidebar
};

export type DataViewProps<TListRow, TDetail> = {
  entity: string;
  columns: DataViewColumnDef<TListRow>[];
  filters?: DataViewFilterDef[];
  initialData: PaginatedResult<TListRow>;
  queryKey: string[];
  listFetcher: (params: DataViewListParams) => Promise<PaginatedResult<TListRow>>;
  detailFetcher: (id: string) => Promise<TDetail | null>;
  resolveSelectedPage?: (args: {
    selectedId: string;
    listParams: DataViewListParams;
  }) => Promise<number | null>;
  getRowId: (row: TListRow) => string;
  renderCompactItem?: (row: TListRow) => React.ReactNode;
  renderExpandedRow?: (row: TListRow) => React.ReactNode;
  renderDetail: (detail: TDetail) => React.ReactNode;
  /** Called whenever the checkbox selection changes. Receives the current selected row IDs. */
  onSelectionChange?: (selectedIds: string[]) => void;
  className?: string;
};

export type InfinitePaginatedData<T> = {
  pages: PaginatedResult<T>[];
  pageParams: number[];
};
