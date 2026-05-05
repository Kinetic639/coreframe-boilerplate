import type { DataViewListParams, PaginatedResult } from "@/components/data-view/data-view.types";
import type { OrgRole } from "@/server/services/organization.service";

function normalize(value: unknown): string {
  return String(value ?? "").toLowerCase();
}

export function filterSortRoles(
  rows: OrgRole[],
  params: Pick<DataViewListParams, "search" | "filters" | "sort">
): OrgRole[] {
  let result = rows.filter((r) => !r.deleted_at);

  if (params.search) {
    const q = params.search.toLowerCase();
    result = result.filter(
      (r) => r.name.toLowerCase().includes(q) || (r.description?.toLowerCase().includes(q) ?? false)
    );
  }

  if (typeof params.filters.scope === "string" && params.filters.scope) {
    result = result.filter((r) => r.scope_type === params.filters.scope);
  }

  if (typeof params.filters.isBasic === "boolean") {
    result = result.filter((r) => (params.filters.isBasic ? r.is_basic : !r.is_basic));
  }

  if (params.sort) {
    const { field, direction } = params.sort;
    const dir = direction === "asc" ? 1 : -1;
    result = [...result].sort((a, b) => {
      const aVal = normalize(a[field as keyof OrgRole]);
      const bVal = normalize(b[field as keyof OrgRole]);
      const cmp = aVal.localeCompare(bVal, undefined, { numeric: true });
      return cmp !== 0 ? cmp * dir : a.id.localeCompare(b.id);
    });
  }

  return result;
}

export function paginateRoles(
  rows: OrgRole[],
  page: number,
  pageSize: number
): PaginatedResult<OrgRole> {
  return {
    rows: rows.slice((page - 1) * pageSize, page * pageSize),
    totalCount: rows.length,
    page,
    pageSize,
  };
}
