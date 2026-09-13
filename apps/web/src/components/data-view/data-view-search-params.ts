import { createLoader, parseAsInteger, parseAsJson, parseAsString } from "nuqs/server";
import { z } from "zod";
import type { DataViewListParams, DataViewUrlState, SortState } from "./data-view.types";

export type DataViewFilterRecord = Record<string, string | string[] | boolean | null>;

export const DATA_VIEW_PAGE_SIZES = [10, 25, 50, 100] as const;
export const DATA_VIEW_DEFAULT_PAGE_SIZE = 50;

const EMPTY_FILTERS: DataViewFilterRecord = {};
const filterRecordSchema = z.record(
  z.union([z.string(), z.array(z.string()), z.boolean(), z.null()])
);

export const DATA_VIEW_PARSERS = {
  selected: parseAsString.withDefault(""),
  search: parseAsString.withDefault(""),
  sort: parseAsString.withDefault(""),
  page: parseAsInteger.withDefault(1),
  pageSize: parseAsInteger.withDefault(DATA_VIEW_DEFAULT_PAGE_SIZE),
  filters: parseAsJson(filterRecordSchema).withDefault(EMPTY_FILTERS),
};

const loadDataViewSearchParams = createLoader(DATA_VIEW_PARSERS);

export function parseDataViewSort(sortStr: string): SortState {
  if (!sortStr) return null;
  const lastDot = sortStr.lastIndexOf(".");
  if (lastDot === -1) return null;
  const field = sortStr.slice(0, lastDot);
  const dir = sortStr.slice(lastDot + 1);
  if (dir !== "asc" && dir !== "desc") return null;
  return { field, direction: dir };
}

export function normalizeDataViewPage(page: number): number {
  return Number.isInteger(page) && page >= 1 ? page : 1;
}

export function normalizeDataViewPageSize(pageSize: number): number {
  return DATA_VIEW_PAGE_SIZES.includes(pageSize as (typeof DATA_VIEW_PAGE_SIZES)[number])
    ? pageSize
    : DATA_VIEW_DEFAULT_PAGE_SIZE;
}

export function recoverDataViewPage(page: number, totalCount: number, pageSize: number): number {
  const normalizedPageSize = normalizeDataViewPageSize(pageSize);
  const pageCount = Math.max(1, Math.ceil(Math.max(0, totalCount) / normalizedPageSize));
  return Math.min(normalizeDataViewPage(page), pageCount);
}

export function normalizeDataViewListParams(params: DataViewListParams): DataViewListParams {
  return {
    search: params.search ?? "",
    sort: params.sort,
    page: normalizeDataViewPage(params.page),
    pageSize: normalizeDataViewPageSize(params.pageSize),
    filters: Object.fromEntries(
      Object.entries(params.filters ?? {}).sort(([left], [right]) => left.localeCompare(right))
    ),
  };
}

/**
 * Parses Next.js searchParams (from a server component's page props)
 * into DataViewUrlState. Safe to import in server components.
 */
export function parseDataViewSearchParams(
  params: Record<string, string | string[] | undefined> | URLSearchParams | string
): DataViewUrlState {
  const raw = loadDataViewSearchParams(params);
  const listParams = normalizeDataViewListParams({
    search: raw.search,
    sort: parseDataViewSort(raw.sort),
    page: raw.page,
    pageSize: raw.pageSize,
    filters: raw.filters,
  });

  return {
    selected: raw.selected || null,
    ...listParams,
  };
}
