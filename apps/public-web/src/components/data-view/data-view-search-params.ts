import type { DataViewUrlState, SortState } from "./data-view.types";

type FilterRecord = Record<string, string | string[] | boolean | null>;

function parseSortStr(sortStr: string): SortState {
  if (!sortStr) return null;
  const lastDot = sortStr.lastIndexOf(".");
  if (lastDot === -1) return null;
  const field = sortStr.slice(0, lastDot);
  const dir = sortStr.slice(lastDot + 1);
  if (dir !== "asc" && dir !== "desc") return null;
  return { field, direction: dir };
}

/**
 * Parses Next.js searchParams (from a server component's page props)
 * into DataViewUrlState. Safe to import in server components.
 */
export function parseDataViewSearchParams(
  params: Record<string, string | string[] | undefined>
): DataViewUrlState {
  const get = (key: string): string => {
    const v = params[key];
    return typeof v === "string" ? v : "";
  };

  let filters: FilterRecord = {};
  try {
    const raw = get("filters");
    if (raw) {
      const parsed = JSON.parse(decodeURIComponent(raw));
      if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
        filters = parsed as FilterRecord;
      }
    }
  } catch {
    // ignore malformed JSON
  }

  return {
    selected: get("selected") || null,
    search: get("search"),
    sort: parseSortStr(get("sort")),
    page: parseInt(get("page") || "1", 10) || 1,
    pageSize: parseInt(get("pageSize") || "50", 10) || 50,
    filters,
  };
}
