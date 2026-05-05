import type { DataViewListParams, PaginatedResult } from "@/components/data-view/data-view.types";
import type { OrgPosition } from "@/server/services/organization.service";

function normalize(value: unknown): string {
  return String(value ?? "").toLowerCase();
}

export function filterSortPositions(
  rows: OrgPosition[],
  params: Pick<DataViewListParams, "search" | "filters" | "sort">
): OrgPosition[] {
  let result = rows.filter((p) => !p.deleted_at);

  if (params.search) {
    const q = params.search.toLowerCase();
    result = result.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.description?.toLowerCase().includes(q) ?? false)
    );
  }

  if (params.sort) {
    const { field, direction } = params.sort;
    const dir = direction === "asc" ? 1 : -1;
    result = [...result].sort((a, b) => {
      const cmp = normalize(a[field as keyof OrgPosition]).localeCompare(
        normalize(b[field as keyof OrgPosition]),
        undefined,
        { numeric: true }
      );
      return cmp !== 0 ? cmp * dir : a.id.localeCompare(b.id);
    });
  }

  return result;
}

export function paginatePositions(
  rows: OrgPosition[],
  page: number,
  pageSize: number
): PaginatedResult<OrgPosition> {
  return {
    rows: rows.slice((page - 1) * pageSize, page * pageSize),
    totalCount: rows.length,
    page,
    pageSize,
  };
}
