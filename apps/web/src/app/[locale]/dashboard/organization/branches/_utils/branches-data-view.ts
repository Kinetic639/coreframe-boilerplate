import type { DataViewListParams, PaginatedResult } from "@/components/data-view/data-view.types";
import type { OrgBranch } from "@/server/services/organization.service";

function normalize(value: unknown): string {
  return String(value ?? "").toLowerCase();
}

function matchesDateRange(isoDate: string | null, from: string | null, to: string | null): boolean {
  if (!isoDate) return false;
  const date = isoDate.slice(0, 10); // YYYY-MM-DD
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

export function filterSortBranches(
  rows: OrgBranch[],
  params: Pick<DataViewListParams, "search" | "filters" | "sort">
): OrgBranch[] {
  let result = [...rows];

  // ── Global search ───────────────────────────────────────────────────────────
  if (params.search) {
    const q = params.search.toLowerCase();
    result = result.filter(
      (b) => b.name.toLowerCase().includes(q) || (b.slug?.toLowerCase().includes(q) ?? false)
    );
  }

  // ── Filters ─────────────────────────────────────────────────────────────────
  if (typeof params.filters.slug === "string" && params.filters.slug.trim()) {
    const q = params.filters.slug.toLowerCase();
    result = result.filter((b) => b.slug?.toLowerCase().includes(q) ?? false);
  }

  if (typeof params.filters.publicMapsEnabled === "boolean") {
    result = result.filter((b) =>
      params.filters.publicMapsEnabled
        ? !!b.public_warehouse_maps_enabled
        : !b.public_warehouse_maps_enabled
    );
  }

  const createdFrom =
    typeof params.filters.createdFrom === "string" ? params.filters.createdFrom : null;
  const createdTo = typeof params.filters.createdTo === "string" ? params.filters.createdTo : null;
  if (createdFrom || createdTo) {
    result = result.filter((b) => matchesDateRange(b.created_at, createdFrom, createdTo));
  }

  // ── Sort ─────────────────────────────────────────────────────────────────────
  if (params.sort) {
    const { field, direction } = params.sort;
    const dir = direction === "asc" ? 1 : -1;
    result = result.sort((a, b) => {
      const cmp = normalize(a[field as keyof OrgBranch]).localeCompare(
        normalize(b[field as keyof OrgBranch]),
        undefined,
        { numeric: true }
      );
      // Secondary sort by id for stable ordering
      if (cmp !== 0) return cmp * dir;
      return a.id.localeCompare(b.id);
    });
  }

  return result;
}

export function paginateBranches(
  rows: OrgBranch[],
  page: number,
  pageSize: number
): PaginatedResult<OrgBranch> {
  return {
    rows: rows.slice((page - 1) * pageSize, page * pageSize),
    totalCount: rows.length,
    page,
    pageSize,
  };
}
