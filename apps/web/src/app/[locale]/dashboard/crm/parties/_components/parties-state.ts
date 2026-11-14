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
import { crmPartyRoleSchema, crmPartyStatusSchema } from "@/lib/validations/crm";

// The counterparty list's whole state is its address: the search, a filter
// per column, the sort, the page and the counterparty open in the side panel.

export const PARTY_PAGE_SIZES = [20, 50, 100] as const;
export const PARTY_SORTS = [
  "counterparty_number",
  "display_name",
  "status",
  "created_at",
  "updated_at",
] as const;
export type PartySort = (typeof PARTY_SORTS)[number];
export const PARTY_ROLES = crmPartyRoleSchema.options;
export const PARTY_STATUSES = crmPartyStatusSchema.options;

const UUID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;

export const partyParsers = {
  q: parseAsString.withDefault(""),
  strona: parseAsInteger.withDefault(1),
  wierszy: parseAsNumberLiteral(PARTY_PAGE_SIZES).withDefault(50),
  sort: parseAsStringLiteral(PARTY_SORTS).withDefault("counterparty_number"),
  direction: parseAsStringLiteral(["asc", "desc"] as const).withDefault("desc"),
  /** The open counterparty: its id. */
  selected: createParser({
    parse: (value) => (UUID.test(value) ? value : null),
    serialize: (value: string) => value,
  }),
  rola: parseAsArrayOf(parseAsStringLiteral(PARTY_ROLES)).withDefault([]),
  status: parseAsArrayOf(parseAsStringLiteral(PARTY_STATUSES)).withDefault([]),
};

export type PartyState = inferParserType<typeof partyParsers>;
export const loadPartyState = createLoader(partyParsers);
export const serializePartyState = createSerializer(partyParsers);

export function partyHref(path: string, state: PartyState, patch: Partial<PartyState> = {}) {
  return serializePartyState(path, { ...state, ...patch });
}

/** What the list asks the service for (the panel is not part of it). */
export function partyListParams(state: PartyState): DataViewListParams {
  return {
    search: state.q.trim().slice(0, 100),
    page: Math.max(1, state.strona),
    pageSize: state.wierszy,
    sort: { field: state.sort, direction: state.direction },
    filters: {
      role: state.rola.length ? [...state.rola] : null,
      status: state.status.length ? [...state.status] : null,
    },
  };
}

/**
 * Old DataView links (`search`, `page`, `pageSize`, `sort=field.dir`,
 * `filters={...}`) are translated once into this list's address. `selected`
 * keeps its name.
 */
export function migratePartySearchParams(raw: Record<string, string | string[] | undefined>) {
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
          ["role", "rola"],
          ["status", "status"],
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
