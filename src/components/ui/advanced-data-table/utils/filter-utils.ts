import { ActiveFilters, FilterValue, ColumnConfig } from "../types";

/**
 * Apply filters to data array
 */
export function applyFilters<T>(
  data: T[],
  filters: ActiveFilters,
  columns: ColumnConfig<T>[]
): T[] {
  if (Object.keys(filters).length === 0) {
    return data;
  }

  return data.filter((row) => {
    return Object.entries(filters).every(([key, filterValue]) => {
      const column = columns.find((col) => col.key === key);
      if (!column) return true;

      const cellValue = (row as any)[key];

      switch (filterValue.type) {
        case "text":
          if (!filterValue.value) return true;
          const searchTerm = filterValue.value.toLowerCase();
          const cellText = String(cellValue || "").toLowerCase();
          return cellText.includes(searchTerm);

        case "select":
          if (!filterValue.value || filterValue.value === "all") return true;
          return cellValue === filterValue.value;

        case "multi-select":
          if (!filterValue.value || filterValue.value.length === 0) return true;
          return filterValue.value.includes(cellValue);

        case "number-range":
          const { min, max } = filterValue.value || {};
          const numValue = Number(cellValue);
          if (isNaN(numValue)) return true;
          if (min !== undefined && numValue < min) return false;
          if (max !== undefined && numValue > max) return false;
          return true;

        case "date-range":
          const { start, end } = filterValue.value || {};
          if (!cellValue) return true;
          const dateValue = new Date(cellValue).getTime();
          if (start && dateValue < new Date(start).getTime()) return false;
          if (end && dateValue > new Date(end).getTime()) return false;
          return true;

        case "boolean":
          if (filterValue.value === null || filterValue.value === undefined) return true;
          return Boolean(cellValue) === Boolean(filterValue.value);

        default:
          return true;
      }
    });
  });
}

/**
 * Apply search query to data
 */
export function applySearch<T>(data: T[], searchQuery: string, columns: ColumnConfig<T>[]): T[] {
  if (!searchQuery.trim()) {
    return data;
  }

  const query = searchQuery.toLowerCase();

  return data.filter((row) => {
    return columns.some((column) => {
      const value = (row as any)[column.key];
      if (value === null || value === undefined) return false;

      const stringValue = String(value).toLowerCase();
      return stringValue.includes(query);
    });
  });
}

/**
 * Get active filter count
 */
export function getActiveFilterCount(filters: ActiveFilters): number {
  return Object.values(filters).filter((filter) => {
    if (!filter.value) return false;
    if (filter.value === "all") return false;
    if (Array.isArray(filter.value) && filter.value.length === 0) return false;
    if (typeof filter.value === "object" && Object.values(filter.value).every((v) => !v))
      return false;
    return true;
  }).length;
}

/**
 * Clear all filters
 */
export function clearFilters(): ActiveFilters {
  return {};
}

/**
 * Remove a specific filter
 */
export function removeFilter(filters: ActiveFilters, key: string): ActiveFilters {
  const newFilters = { ...filters };
  delete newFilters[key];
  return newFilters;
}

/**
 * Check if a filter is active
 */
export function isFilterActive(filter: FilterValue | undefined): boolean {
  if (!filter) return false;
  if (!filter.value) return false;
  if (filter.value === "all") return false;
  if (Array.isArray(filter.value) && filter.value.length === 0) return false;
  if (typeof filter.value === "object") {
    return Object.values(filter.value).some((v) => v !== undefined && v !== null && v !== "");
  }
  return true;
}
