// Temporary stubs for @tanstack/react-table until the package is installed
// These allow TypeScript to pass but should be replaced with real package

export interface ColumnDef<TData, TValue = unknown> {
  accessorKey?: string;
  id?: string;
  header?:
    | string
    | ((props: {
        column: {
          toggleSorting: (ascending?: boolean) => void;
          getIsSorted: () => false | "asc" | "desc";
        };
        table: {
          toggleAllPageRowsSelected: (selected: boolean) => void;
          getIsAllPageRowsSelected: () => boolean;
          getIsSomePageRowsSelected: () => boolean;
        };
      }) => React.ReactNode);
  cell?: (props: {
    row: {
      original: TData;
      getValue: (key: string) => TValue;
      getIsSelected: () => boolean;
      toggleSelected: (value: boolean) => void;
    };
  }) => React.ReactNode;
  enableSorting?: boolean;
  enableHiding?: boolean;
  filterFn?: (row: unknown, id: string, value: unknown) => boolean;
}

export type SortingState = Array<{
  id: string;
  desc: boolean;
}>;

export type ColumnFiltersState = Array<{
  id: string;
  value: unknown;
}>;

export interface VisibilityState {
  [key: string]: boolean;
}

export interface TableOptions<TData> {
  data: TData[];
  columns: ColumnDef<TData>[];
  onSortingChange?: (state: SortingState) => void;
  onColumnFiltersChange?: (state: ColumnFiltersState) => void;
  getCoreRowModel: () => unknown;
  getPaginationRowModel?: () => unknown;
  getSortedRowModel?: () => unknown;
  getFilteredRowModel?: () => unknown;
  onColumnVisibilityChange?: (state: VisibilityState) => void;
  onRowSelectionChange?: (state: Record<string, boolean>) => void;
  onGlobalFilterChange?: (value: string) => void;
  globalFilterFn?: string;
  state?: {
    sorting?: SortingState;
    columnFilters?: ColumnFiltersState;
    columnVisibility?: VisibilityState;
    rowSelection?: Record<string, boolean>;
    globalFilter?: string;
  };
}

export interface Table<TData> {
  getHeaderGroups: () => Array<{
    id: string;
    headers: Array<{
      id: string;
      isPlaceholder: boolean;
      column: { columnDef: ColumnDef<TData> };
      getContext: () => unknown;
    }>;
  }>;
  getRowModel: () => {
    rows: Array<{
      id: string;
      getIsSelected: () => boolean;
      getVisibleCells: () => Array<{
        id: string;
        column: { columnDef: ColumnDef<TData> };
        getContext: () => unknown;
      }>;
    }>;
  };
  getAllColumns: () => Array<{
    id: string;
    accessorFn?: unknown;
    getCanHide: () => boolean;
    getIsVisible: () => boolean;
    toggleVisibility: (value: boolean) => void;
  }>;
  getFilteredSelectedRowModel: () => { rows: unknown[] };
  getFilteredRowModel: () => { rows: unknown[] };
  getState: () => { pagination: { pageIndex: number } };
  getPageCount: () => number;
  previousPage: () => void;
  nextPage: () => void;
  getCanPreviousPage: () => boolean;
  getCanNextPage: () => boolean;
  toggleAllPageRowsSelected: (selected: boolean) => void;
  getIsAllPageRowsSelected: () => boolean;
  getIsSomePageRowsSelected: () => boolean;
}

export function useReactTable<TData>(_options: TableOptions<TData>): Table<TData> {
  throw new Error("@tanstack/react-table not installed. This is a stub implementation.");
}

export function getCoreRowModel() {
  return () => ({ rows: [] });
}

export function getPaginationRowModel() {
  return () => ({ rows: [] });
}

export function getSortedRowModel() {
  return () => ({ rows: [] });
}

export function getFilteredRowModel() {
  return () => ({ rows: [] });
}

export function flexRender(_component: unknown, _props: unknown): React.ReactNode {
  return null;
}
