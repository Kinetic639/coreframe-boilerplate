import { SortConfig } from "../types";

/**
 * Apply sorting to data array
 */
export function applySort<T>(data: T[], sort: SortConfig | null): T[] {
  if (!sort) {
    return data;
  }

  return [...data].sort((a, b) => {
    const aValue = (a as any)[sort.key];
    const bValue = (b as any)[sort.key];

    // Handle null/undefined values
    if (aValue === null || aValue === undefined) return 1;
    if (bValue === null || bValue === undefined) return -1;

    // Handle different types
    if (typeof aValue === "string" && typeof bValue === "string") {
      const comparison = aValue.localeCompare(bValue);
      return sort.direction === "asc" ? comparison : -comparison;
    }

    if (typeof aValue === "number" && typeof bValue === "number") {
      return sort.direction === "asc" ? aValue - bValue : bValue - aValue;
    }

    if (aValue instanceof Date && bValue instanceof Date) {
      const comparison = aValue.getTime() - bValue.getTime();
      return sort.direction === "asc" ? comparison : -comparison;
    }

    // Fallback to string comparison
    const aString = String(aValue);
    const bString = String(bValue);
    const comparison = aString.localeCompare(bString);
    return sort.direction === "asc" ? comparison : -comparison;
  });
}

/**
 * Toggle sort direction
 */
export function toggleSortDirection(currentSort: SortConfig | null, key: string): SortConfig {
  if (!currentSort || currentSort.key !== key) {
    return { key, direction: "asc" };
  }

  if (currentSort.direction === "asc") {
    return { key, direction: "desc" };
  }

  // If already desc, remove sort
  return { key, direction: "asc" };
}
