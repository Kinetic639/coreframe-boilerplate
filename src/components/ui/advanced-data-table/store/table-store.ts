import { create } from "zustand";
import { ActiveFilters, SortConfig, LayoutMode } from "../types";

/**
 * Store state interface
 */
interface TableStoreState<T = any> {
  // Selection state
  selectedRow: T | null;
  selectedRowIds: Set<string>;

  // Layout state
  layoutMode: LayoutMode;

  // Filter state
  filters: ActiveFilters;
  searchQuery: string;
  filterPanelOpen: boolean;

  // Sort state
  sort: SortConfig | null;

  // Pagination state (if needed)
  pagination: {
    pageIndex: number;
    pageSize: number;
  };
}

/**
 * Store actions interface
 */
interface TableStoreActions<T = any> {
  // Selection actions
  setSelectedRow: (row: T | null) => void;
  toggleRowSelection: (rowId: string) => void;
  setSelectedRowIds: (ids: Set<string>) => void;
  selectAllRows: (rowIds: string[]) => void;
  clearSelection: () => void;

  // Layout actions
  setLayoutMode: (mode: LayoutMode) => void;
  openDetail: (row: T) => void;
  closeDetail: () => void;

  // Filter actions
  setFilters: (filters: ActiveFilters) => void;
  updateFilter: (key: string, value: any) => void;
  removeFilter: (key: string) => void;
  clearFilters: () => void;
  setSearchQuery: (query: string) => void;
  toggleFilterPanel: () => void;

  // Sort actions
  setSort: (sort: SortConfig | null) => void;
  toggleSort: (key: string) => void;

  // Pagination actions
  setPagination: (pagination: { pageIndex: number; pageSize: number }) => void;
  setPageIndex: (pageIndex: number) => void;
  setPageSize: (pageSize: number) => void;

  // Reset action
  reset: () => void;
}

/**
 * Combined store type
 */
type TableStore<T = any> = TableStoreState<T> & TableStoreActions<T>;

/**
 * Initial state
 */
const initialState: TableStoreState = {
  selectedRow: null,
  selectedRowIds: new Set(),
  layoutMode: "full",
  filters: {},
  searchQuery: "",
  filterPanelOpen: false,
  sort: null,
  pagination: {
    pageIndex: 0,
    pageSize: 20,
  },
};

/**
 * Create table store factory
 * This allows creating multiple independent table stores
 */
export const createTableStore = <T = any>() => {
  return create<TableStore<T>>((set) => ({
    ...initialState,

    // Selection actions
    setSelectedRow: (row) => set({ selectedRow: row }),

    toggleRowSelection: (rowId) =>
      set((state) => {
        const newSelectedIds = new Set(state.selectedRowIds);
        if (newSelectedIds.has(rowId)) {
          newSelectedIds.delete(rowId);
        } else {
          newSelectedIds.add(rowId);
        }
        return { selectedRowIds: newSelectedIds };
      }),

    setSelectedRowIds: (ids) => set({ selectedRowIds: ids }),

    selectAllRows: (rowIds) => set({ selectedRowIds: new Set(rowIds) }),

    clearSelection: () => set({ selectedRowIds: new Set() }),

    // Layout actions
    setLayoutMode: (mode) => set({ layoutMode: mode }),

    openDetail: (row) =>
      set({
        selectedRow: row,
        layoutMode: "sidebar-detail",
      }),

    closeDetail: () =>
      set({
        selectedRow: null,
        layoutMode: "full",
      }),

    // Filter actions
    setFilters: (filters) => set({ filters }),

    updateFilter: (key, value) =>
      set((state) => ({
        filters: {
          ...state.filters,
          [key]: value,
        },
      })),

    removeFilter: (key) =>
      set((state) => {
        const newFilters = { ...state.filters };
        delete newFilters[key];
        return { filters: newFilters };
      }),

    clearFilters: () => set({ filters: {}, searchQuery: "" }),

    setSearchQuery: (query) => set({ searchQuery: query }),

    toggleFilterPanel: () => set((state) => ({ filterPanelOpen: !state.filterPanelOpen })),

    // Sort actions
    setSort: (sort) => set({ sort }),

    toggleSort: (key) =>
      set((state) => {
        const currentSort = state.sort;

        // If not sorting by this key, start with ascending
        if (!currentSort || currentSort.key !== key) {
          return { sort: { key, direction: "asc" } };
        }

        // If ascending, switch to descending
        if (currentSort.direction === "asc") {
          return { sort: { key, direction: "desc" } };
        }

        // If descending, remove sort
        return { sort: null };
      }),

    // Pagination actions
    setPagination: (pagination) => set({ pagination }),

    setPageIndex: (pageIndex) =>
      set((state) => ({
        pagination: { ...state.pagination, pageIndex },
      })),

    setPageSize: (pageSize) =>
      set((state) => ({
        pagination: { ...state.pagination, pageSize, pageIndex: 0 },
      })),

    // Reset action
    reset: () => set(initialState),
  }));
};

/**
 * Default table store (can be used for single-table applications)
 */
export const useTableStore = createTableStore();
