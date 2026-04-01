import { useMemo } from "react";
import { ColumnConfig } from "../types";
import { applyFilters, applySearch } from "../utils/filter-utils";
import { applySort } from "../utils/sort-utils";
import { useTableStore } from "../store/table-store";

/**
 * Hook to process table data with filters, search, and sorting
 * Uses Zustand store for state management
 */
export function useTableData<T>(data: T[], columns: ColumnConfig<T>[]) {
  const filters = useTableStore((state) => state.filters);
  const searchQuery = useTableStore((state) => state.searchQuery);
  const sort = useTableStore((state) => state.sort);

  const processedData = useMemo(() => {
    let result = [...data];

    // Apply search
    if (searchQuery) {
      result = applySearch(result, searchQuery, columns);
    }

    // Apply filters
    if (Object.keys(filters).length > 0) {
      result = applyFilters(result, filters, columns);
    }

    // Apply sort
    if (sort) {
      result = applySort(result, sort);
    }

    return result;
  }, [data, searchQuery, filters, sort, columns]);

  return processedData;
}
