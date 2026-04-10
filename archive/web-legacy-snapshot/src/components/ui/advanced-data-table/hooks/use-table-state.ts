import { useState, useCallback, useMemo } from "react";
import { TableState, ActiveFilters, SortConfig } from "../types";
import { applyFilters, applySearch } from "../utils/filter-utils";
import { applySort } from "../utils/sort-utils";

interface UseTableStateProps<T> {
  data: T[];
  defaultFilters?: ActiveFilters;
  defaultSort?: SortConfig;
  onFiltersChange?: (filters: ActiveFilters) => void;
  onSortChange?: (sort: SortConfig | null) => void;
  columns: any[];
}

export function useTableState<T>({
  data,
  defaultFilters = {},
  defaultSort,
  onFiltersChange,
  onSortChange,
  columns,
}: UseTableStateProps<T>) {
  const [state, setState] = useState<TableState<T>>({
    selectedRow: null,
    layoutMode: "full",
    filters: defaultFilters,
    sort: defaultSort || null,
    searchQuery: "",
    selectedRowIds: new Set(),
    filterPanelOpen: false,
  });

  // Set selected row and switch to sidebar-detail layout
  const selectRow = useCallback((row: T | null) => {
    setState((prev) => ({
      ...prev,
      selectedRow: row,
      layoutMode: row ? "sidebar-detail" : "full",
    }));
  }, []);

  // Close detail panel and return to full layout
  const closeDetail = useCallback(() => {
    setState((prev) => ({
      ...prev,
      selectedRow: null,
      layoutMode: "full",
    }));
  }, []);

  // Update filters
  const setFilters = useCallback(
    (filters: ActiveFilters) => {
      setState((prev) => ({ ...prev, filters }));
      onFiltersChange?.(filters);
    },
    [onFiltersChange]
  );

  // Update sort
  const setSort = useCallback(
    (sort: SortConfig | null) => {
      setState((prev) => ({ ...prev, sort }));
      onSortChange?.(sort);
    },
    [onSortChange]
  );

  // Update search query
  const setSearchQuery = useCallback((query: string) => {
    setState((prev) => ({ ...prev, searchQuery: query }));
  }, []);

  // Toggle row selection
  const toggleRowSelection = useCallback((rowId: string) => {
    setState((prev) => {
      const newSelectedIds = new Set(prev.selectedRowIds);
      if (newSelectedIds.has(rowId)) {
        newSelectedIds.delete(rowId);
      } else {
        newSelectedIds.add(rowId);
      }
      return { ...prev, selectedRowIds: newSelectedIds };
    });
  }, []);

  // Select all rows
  const selectAllRows = useCallback((rowIds: string[]) => {
    setState((prev) => ({
      ...prev,
      selectedRowIds: new Set(rowIds),
    }));
  }, []);

  // Clear all selections
  const clearSelection = useCallback(() => {
    setState((prev) => ({
      ...prev,
      selectedRowIds: new Set(),
    }));
  }, []);

  // Toggle filter panel
  const toggleFilterPanel = useCallback(() => {
    setState((prev) => ({
      ...prev,
      filterPanelOpen: !prev.filterPanelOpen,
    }));
  }, []);

  // Apply all filtering, searching, and sorting
  const processedData = useMemo(() => {
    let result = [...data];

    // Apply search
    result = applySearch(result, state.searchQuery, columns);

    // Apply filters
    result = applyFilters(result, state.filters, columns);

    // Apply sort
    result = applySort(result, state.sort);

    return result;
  }, [data, state.searchQuery, state.filters, state.sort, columns]);

  return {
    state,
    processedData,
    selectRow,
    closeDetail,
    setFilters,
    setSort,
    setSearchQuery,
    toggleRowSelection,
    selectAllRows,
    clearSelection,
    toggleFilterPanel,
  };
}
