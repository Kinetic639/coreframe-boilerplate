import {
  createLoader,
  createSerializer,
  parseAsArrayOf,
  parseAsInteger,
  parseAsNumberLiteral,
  parseAsString,
  parseAsStringLiteral,
  type inferParserType,
} from "nuqs/server";
import type { ColumnSet } from "@/components/data-table/columns";
import {
  matchesSearch,
  migrateDataViewParams,
  pageOf,
  parseAsUuid,
  sortRows,
} from "@/components/data-table/local-list";
import type { QrCodeWithStatus } from "@/server/services/qr.service";

// The QR codes list's whole state is its address: the search, the status
// filter, the sort, the page and the code open in the side panel. All codes
// are loaded; the codes ticked for labels stay on the page, not the address.

export const QR_PAGE_SIZES = [20, 50, 100] as const;
export const QR_SORTS = [
  "label",
  "status",
  "created_at",
  "last_scanned_at",
  "scan_count",
  "batch",
] as const;
export const QR_STATUSES = ["assigned", "unassigned", "expired", "revoked"] as const;
export type QrDisplayStatus = (typeof QR_STATUSES)[number];
/** "Not used for X days" choices (days). */
export const QR_UNUSED_DAYS = ["30", "90", "180", "365"] as const;

export const qrParsers = {
  q: parseAsString.withDefault(""),
  strona: parseAsInteger.withDefault(1),
  wierszy: parseAsNumberLiteral(QR_PAGE_SIZES).withDefault(50),
  sort: parseAsStringLiteral(QR_SORTS).withDefault("created_at"),
  direction: parseAsStringLiteral(["asc", "desc"] as const).withDefault("desc"),
  selected: parseAsUuid,
  status: parseAsArrayOf(parseAsStringLiteral(QR_STATUSES)).withDefault([]),
  nieuzywane: parseAsArrayOf(parseAsStringLiteral(QR_UNUSED_DAYS)).withDefault([]),
  partia: parseAsArrayOf(parseAsString).withDefault([]),
};

export type QrState = inferParserType<typeof qrParsers>;
export const loadQrState = createLoader(qrParsers);
export const serializeQrState = createSerializer(qrParsers);

export function qrHref(path: string, state: QrState, patch: Partial<QrState> = {}) {
  return serializeQrState(path, { ...state, ...patch });
}

export function getQrStatus(qr: QrCodeWithStatus): QrDisplayStatus {
  if (qr.status === "revoked") return "revoked";
  if (qr.status === "expired") return "expired";
  return qr.assignment ? "assigned" : "unassigned";
}

/**
 * When the code was last used: its last scan, its assignment or its creation,
 * whichever is latest. Drives "not used for X days".
 */
export function qrLastUsedAt(qr: QrCodeWithStatus): string {
  return [qr.last_scanned_at, qr.assignment?.assigned_at, qr.created_at]
    .filter((value): value is string => !!value)
    .reduce((latest, value) => (value > latest ? value : latest));
}

function unusedFor(qr: QrCodeWithStatus, days: string[], now: number) {
  if (!days.length) return true;
  const limit = Math.min(...days.map(Number));
  return now - new Date(qrLastUsedAt(qr)).getTime() >= limit * 24 * 60 * 60 * 1000;
}

function sortValue(qr: QrCodeWithStatus, sort: QrState["sort"]) {
  switch (sort) {
    case "status":
      return getQrStatus(qr);
    case "batch":
      return qr.batch?.created_at ?? null;
    case "last_scanned_at":
      return qr.last_scanned_at ?? null;
    case "scan_count":
      return qr.scan_count ?? 0;
    default:
      return qr[sort];
  }
}

/** The codes the address shows, before paging (deleted ones never). */
export function filterQrCodes(rows: QrCodeWithStatus[], state: QrState, now = Date.now()) {
  const matching = rows.filter(
    (qr) =>
      !qr.deleted_at &&
      matchesSearch(state.q, qr.label, qr.token, qr.batch?.name) &&
      (!state.status.length || state.status.includes(getQrStatus(qr))) &&
      (!state.partia.length || (qr.batch_id != null && state.partia.includes(qr.batch_id))) &&
      unusedFor(qr, state.nieuzywane, now)
  );
  return sortRows(
    matching,
    (qr) => sortValue(qr, state.sort),
    state.direction,
    (qr) => qr.id
  );
}

/** The page of codes the address shows. */
export function qrPage(rows: QrCodeWithStatus[], state: QrState) {
  return pageOf(filterQrCodes(rows, state), state.strona, state.wierszy);
}

export function migrateQrSearchParams(raw: Record<string, string | string[] | undefined>) {
  return migrateDataViewParams(raw, { status: { param: "status" } }, { displayStatus: "status" });
}

export function qrColumnSet(labels: Record<string, string>): ColumnSet<string> {
  const ids = [
    "token",
    "status",
    "assignment",
    "batch",
    "last_scanned_at",
    "scan_count",
    "created_at",
  ];
  return {
    ids,
    labels: Object.fromEntries(ids.map((id) => [id, labels[`column_${id}`]])),
    widths: {
      token: 160,
      status: 140,
      assignment: 180,
      batch: 180,
      last_scanned_at: 150,
      scan_count: 110,
      created_at: 130,
    },
    shownByDefault: ["token", "status", "assignment", "last_scanned_at", "created_at"],
    pinned: { id: "label", label: labels.column_label, width: 280 },
  };
}

/** The QR list's words (the server builds the same ones for the saved columns). */
export function qrListLabels(
  t: (key: string, values?: Record<string, string | number>) => string,
  locale: string
): Record<string, string> {
  const pl = locale === "pl";
  return {
    locale,
    title: pl ? "Kody QR" : "QR codes",
    column_label: t("table.label"),
    column_token: t("table.token"),
    column_status: t("table.statusHeader"),
    column_assignment: t("table.assignment"),
    column_created_at: t("table.created"),
    column_batch: pl ? "Partia wydruku" : "Print batch",
    column_last_scanned_at: pl ? "Ostatni skan" : "Last scan",
    column_scan_count: pl ? "Skany" : "Scans",
    search: pl ? "Szukaj etykiety, tokenu, partii…" : "Search label, token, batch…",
    close: pl ? "Zamknij" : "Close",
    empty: t("table.empty"),
    emptyAll: pl ? "Nie ma jeszcze kodów QR" : "There are no QR codes yet",
    notFound: pl ? "Nie ma takiego kodu QR" : "No such QR code",
    loadError: pl ? "Nie udało się wczytać kodów QR" : "Could not load the QR codes",
    retry: pl ? "Spróbuj ponownie" : "Try again",
    loading: pl ? "Wczytywanie…" : "Loading…",
    countSuffix: pl ? "kodów" : "codes",
    selectAll: pl ? "Zaznacz wszystkie na stronie" : "Select all on the page",
    selectRow: pl ? "Zaznacz: {name}" : "Select: {name}",
  };
}
