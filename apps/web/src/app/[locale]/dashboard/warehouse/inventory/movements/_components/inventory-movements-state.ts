import {
  createLoader,
  createParser,
  createSerializer,
  parseAsArrayOf,
  parseAsInteger,
  parseAsNumberLiteral,
  parseAsString,
  parseAsStringLiteral,
  type inferParserType,
} from "nuqs/server";
import type { DataViewListParams } from "@/lib/data-view/types";

// The movements list's whole state is its address: the search, a filter per
// column, the sort, the page and the movement open in the side panel.

export const MOVEMENT_STATUSES = [
  "draft",
  "posted",
  "reversed",
  "cancelled",
  "in_transit",
  "accepted",
  "declined",
] as const;
export const MOVEMENT_PAGE_SIZES = [20, 50, 100] as const;
export const MOVEMENT_SORTS = [
  "document_number",
  "movement_type_code",
  "status",
  "posted_at",
  "created_at",
] as const;
export type MovementSort = (typeof MOVEMENT_SORTS)[number];
/** Ready ranges of the "posted" filter. */
export const POSTED_WITHIN = ["7d", "30d", "90d"] as const;

/** A day, `2026-11-12` (anything else is dropped). */
const parseAsDay = createParser({
  parse: (value) => (/^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null),
  serialize: (value: string) => value,
});
/** A movement type's code (`101`, `311`, …). */
const parseAsTypeCode = createParser({
  parse: (value) => (/^\d{3}$/.test(value) ? value : null),
  serialize: (value: string) => value,
});
const parseAsUuid = createParser({
  parse: (value) => (/^[\da-f-]{36}$/i.test(value) ? value : null),
  serialize: (value: string) => value,
});

export const movementParsers = {
  q: parseAsString.withDefault(""),
  strona: parseAsInteger.withDefault(1),
  wierszy: parseAsNumberLiteral(MOVEMENT_PAGE_SIZES).withDefault(50),
  sort: parseAsStringLiteral(MOVEMENT_SORTS).withDefault("created_at"),
  direction: parseAsStringLiteral(["asc", "desc"] as const).withDefault("desc"),
  /** The open movement: its route key (`PZ(115)-1-26-3112`). */
  selected: createParser({
    parse: (value) => (/^[\w()+\-.]{1,80}$/.test(value) ? value : null),
    serialize: (value: string) => value,
  }),
  rodzaj: parseAsArrayOf(parseAsTypeCode).withDefault([]),
  status: parseAsArrayOf(parseAsStringLiteral(MOVEMENT_STATUSES)).withDefault([]),
  jednostka: parseAsArrayOf(parseAsUuid).withDefault([]),
  magazyn: parseAsArrayOf(parseAsUuid).withDefault([]),
  ksiegowanie: parseAsStringLiteral(POSTED_WITHIN),
  ksiegowanie_od: parseAsDay,
  ksiegowanie_do: parseAsDay,
};

export type MovementState = inferParserType<typeof movementParsers>;
export const loadMovementState = createLoader(movementParsers);
export const serializeMovementState = createSerializer(movementParsers);

export function movementHref(
  path: string,
  state: MovementState,
  patch: Partial<MovementState> = {}
) {
  return serializeMovementState(path, { ...state, ...patch });
}

/** The first day of a ready range (days back from today, UTC). */
function since(within: (typeof POSTED_WITHIN)[number], today = new Date()) {
  const days = Number.parseInt(within, 10);
  const day = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  day.setUTCDate(day.getUTCDate() - days);
  return day.toISOString().slice(0, 10);
}

/** What the service is asked for (the panel is not part of it). */
export function movementListParams(state: MovementState): DataViewListParams {
  return {
    search: state.q.trim().slice(0, 100),
    page: Math.max(1, state.strona),
    pageSize: state.wierszy,
    sort: { field: state.sort, direction: state.direction },
    filters: {
      movement_type_code: state.rodzaj.length ? state.rodzaj : null,
      status: state.status.length ? [...state.status] : null,
      unit_id: state.jednostka.length ? state.jednostka : null,
      warehouse_id: state.magazyn.length ? state.magazyn : null,
      posted_from:
        state.ksiegowanie_od ?? (state.ksiegowanie ? since(state.ksiegowanie) : null) ?? null,
      posted_to: state.ksiegowanie_do ?? null,
    },
  };
}

/**
 * Old DataView links (`search`, `page`, `pageSize`, `sort=field.dir`,
 * `filters={...}`, `selected`) are translated once into this list's address.
 */
export function migrateMovementSearchParams(raw: Record<string, string | string[] | undefined>) {
  const next = { ...raw };
  let changed = false;
  for (const [oldKey, newKey] of [
    ["search", "q"],
    ["page", "strona"],
    ["pageSize", "wierszy"],
  ]) {
    if (raw[oldKey] !== undefined) {
      next[newKey] ??= raw[oldKey];
      delete next[oldKey];
      changed = true;
    }
  }
  if (typeof raw.sort === "string" && raw.sort.includes(".")) {
    const [field, direction] = raw.sort.split(".");
    next.sort = field;
    next.direction = direction;
    changed = true;
  }
  if (typeof raw.filters === "string") {
    try {
      const filters = JSON.parse(raw.filters) as Record<string, unknown>;
      if (filters && typeof filters === "object" && !Array.isArray(filters)) {
        for (const [oldKey, newKey] of [
          ["movement_type_code", "rodzaj"],
          ["status", "status"],
          ["unit_id", "jednostka"],
          ["warehouse_id", "magazyn"],
        ]) {
          const value = filters[oldKey];
          if (typeof value === "string" || Array.isArray(value)) {
            next[newKey] ??= Array.isArray(value) ? value.join(",") : value;
          }
        }
      }
    } catch {
      /* The parsers drop what they cannot read. */
    }
    delete next.filters;
    changed = true;
  }
  return { params: next, changed };
}
