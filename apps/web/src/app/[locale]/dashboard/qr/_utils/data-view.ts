import type { DataViewListParams, PaginatedResult } from "@/components/data-view/data-view.types";
import type { QrCodeWithStatus } from "@/server/services/qr.service";

export type QrDisplayStatus = "assigned" | "unassigned" | "revoked";

export function getQrStatus(qr: QrCodeWithStatus): QrDisplayStatus {
  if (qr.status === "revoked") return "revoked";
  return qr.assignment ? "assigned" : "unassigned";
}

function normalize(value: unknown): string {
  return String(value ?? "").toLowerCase();
}

export function filterSortQrCodes(
  rows: QrCodeWithStatus[],
  params: Pick<DataViewListParams, "search" | "filters" | "sort">
): QrCodeWithStatus[] {
  let result = rows.filter((qr) => !qr.deleted_at);

  if (params.search) {
    const q = params.search.toLowerCase();
    result = result.filter(
      (qr) => (qr.label?.toLowerCase().includes(q) ?? false) || qr.token.toLowerCase().includes(q)
    );
  }

  if (typeof params.filters.status === "string" && params.filters.status) {
    result = result.filter((qr) => getQrStatus(qr) === params.filters.status);
  }

  if (params.sort) {
    const { field, direction } = params.sort;
    const dir = direction === "asc" ? 1 : -1;
    result = [...result].sort((a, b) => {
      let aVal: string;
      let bVal: string;
      if (field === "label") {
        aVal = (a.label ?? "").toLowerCase();
        bVal = (b.label ?? "").toLowerCase();
      } else if (field === "displayStatus") {
        aVal = getQrStatus(a);
        bVal = getQrStatus(b);
      } else {
        aVal = normalize(a[field as keyof QrCodeWithStatus]);
        bVal = normalize(b[field as keyof QrCodeWithStatus]);
      }
      const cmp = aVal.localeCompare(bVal, undefined, { numeric: true });
      return cmp !== 0 ? cmp * dir : a.id.localeCompare(b.id);
    });
  }

  return result;
}

export function paginateQrCodes(
  rows: QrCodeWithStatus[],
  page: number,
  pageSize: number
): PaginatedResult<QrCodeWithStatus> {
  return {
    rows: rows.slice((page - 1) * pageSize, page * pageSize),
    totalCount: rows.length,
    page,
    pageSize,
  };
}
