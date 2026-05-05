import type { DataViewListParams, PaginatedResult } from "@/components/data-view/data-view.types";
import type { OrgMember } from "@/server/services/organization.service";

function memberDisplayName(m: OrgMember): string {
  if (m.user_first_name || m.user_last_name) {
    return `${m.user_first_name ?? ""} ${m.user_last_name ?? ""}`.trim();
  }
  return m.user_email ?? "";
}

function normalize(value: unknown): string {
  return String(value ?? "").toLowerCase();
}

export function filterSortMembers(
  rows: OrgMember[],
  params: Pick<DataViewListParams, "search" | "filters" | "sort">
): OrgMember[] {
  let result = [...rows];

  if (params.search) {
    const q = params.search.toLowerCase();
    result = result.filter(
      (m) =>
        memberDisplayName(m).toLowerCase().includes(q) ||
        (m.user_email?.toLowerCase().includes(q) ?? false)
    );
  }

  if (typeof params.filters.status === "string" && params.filters.status) {
    result = result.filter((m) => m.status === params.filters.status);
  }

  if (params.sort) {
    const { field, direction } = params.sort;
    const dir = direction === "asc" ? 1 : -1;
    result = [...result].sort((a, b) => {
      let aVal: string;
      let bVal: string;
      if (field === "member") {
        aVal = memberDisplayName(a).toLowerCase();
        bVal = memberDisplayName(b).toLowerCase();
      } else if (field === "joined") {
        aVal = a.joined_at ?? "";
        bVal = b.joined_at ?? "";
      } else {
        aVal = normalize(a[field as keyof OrgMember]);
        bVal = normalize(b[field as keyof OrgMember]);
      }
      const cmp = aVal.localeCompare(bVal, undefined, { numeric: true });
      return cmp !== 0 ? cmp * dir : a.id.localeCompare(b.id);
    });
  }

  return result;
}

export function paginateMembers(
  rows: OrgMember[],
  page: number,
  pageSize: number
): PaginatedResult<OrgMember> {
  return {
    rows: rows.slice((page - 1) * pageSize, page * pageSize),
    totalCount: rows.length,
    page,
    pageSize,
  };
}
