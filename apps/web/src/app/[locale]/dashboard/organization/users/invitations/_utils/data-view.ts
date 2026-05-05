import type { DataViewListParams, PaginatedResult } from "@/components/data-view/data-view.types";
import type { OrgInvitation } from "@/server/services/organization.service";

function normalize(value: unknown): string {
  return String(value ?? "").toLowerCase();
}

export function filterSortInvitations(
  rows: OrgInvitation[],
  params: Pick<DataViewListParams, "search" | "filters" | "sort">
): OrgInvitation[] {
  let result = rows.filter((i) => !i.deleted_at);

  if (params.search) {
    const q = params.search.toLowerCase();
    result = result.filter(
      (i) =>
        i.email.toLowerCase().includes(q) || (i.role_summary?.toLowerCase().includes(q) ?? false)
    );
  }

  if (Array.isArray(params.filters.status) && params.filters.status.length > 0) {
    const statuses = params.filters.status as string[];
    result = result.filter((i) => statuses.includes(i.status));
  } else if (typeof params.filters.status === "string" && params.filters.status) {
    result = result.filter((i) => i.status === params.filters.status);
  }

  if (params.sort) {
    const { field, direction } = params.sort;
    const dir = direction === "asc" ? 1 : -1;
    result = [...result].sort((a, b) => {
      const aVal = normalize(a[field as keyof OrgInvitation]);
      const bVal = normalize(b[field as keyof OrgInvitation]);
      const cmp = aVal.localeCompare(bVal, undefined, { numeric: true });
      return cmp !== 0 ? cmp * dir : a.id.localeCompare(b.id);
    });
  }

  return result;
}

export function paginateInvitations(
  rows: OrgInvitation[],
  page: number,
  pageSize: number
): PaginatedResult<OrgInvitation> {
  return {
    rows: rows.slice((page - 1) * pageSize, page * pageSize),
    totalCount: rows.length,
    page,
    pageSize,
  };
}
