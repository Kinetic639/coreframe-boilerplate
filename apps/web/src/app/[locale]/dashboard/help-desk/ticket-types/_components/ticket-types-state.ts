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
import { TICKET_PRIORITIES } from "@/lib/validations/helpdesk";
import type { PaginatedResult } from "@/lib/data-view/types";
import type { HelpdeskTicketTypeWithDetails } from "@/server/services/helpdesk-ticket-types.service";

// The ticket types list's whole state is its address: the search, a filter
// per column, the sort, the page and the type open in the side panel. An
// organization has a handful of types, so the page loads them all and the
// list narrows, sorts and pages them in place.

export const TYPE_PAGE_SIZES = [20, 50, 100] as const;
export const TYPE_SORTS = ["sort_order", "name", "default_priority", "updated_at"] as const;
export type TypeSort = (typeof TYPE_SORTS)[number];
export const TYPE_SCOPES = ["org", "branch"] as const;
export const TYPE_ACTIVITY = ["aktywne", "nieaktywne"] as const;
export const YES_NO = ["tak", "nie"] as const;

const parseAsUuid = createParser({
  parse: (value) => (/^[\da-f-]{36}$/i.test(value) ? value : null),
  serialize: (value: string) => value,
});

export const ticketTypeParsers = {
  q: parseAsString.withDefault(""),
  strona: parseAsInteger.withDefault(1),
  wierszy: parseAsNumberLiteral(TYPE_PAGE_SIZES).withDefault(50),
  sort: parseAsStringLiteral(TYPE_SORTS).withDefault("sort_order"),
  direction: parseAsStringLiteral(["asc", "desc"] as const).withDefault("asc"),
  /** The open type: its id. */
  selected: parseAsUuid,
  zakres: parseAsArrayOf(parseAsStringLiteral(TYPE_SCOPES)).withDefault([]),
  oddzial: parseAsArrayOf(parseAsUuid).withDefault([]),
  priorytet: parseAsArrayOf(parseAsStringLiteral(TICKET_PRIORITIES)).withDefault([]),
  stan: parseAsArrayOf(parseAsStringLiteral(TYPE_ACTIVITY)).withDefault([]),
  akceptacja: parseAsArrayOf(parseAsStringLiteral(YES_NO)).withDefault([]),
};

export type TicketTypeState = inferParserType<typeof ticketTypeParsers>;
export const loadTicketTypeState = createLoader(ticketTypeParsers);
export const serializeTicketTypeState = createSerializer(ticketTypeParsers);

export function ticketTypeHref(
  path: string,
  state: TicketTypeState,
  patch: Partial<TicketTypeState> = {}
) {
  return serializeTicketTypeState(path, { ...state, ...patch });
}

const PRIORITY_RANK: Record<string, number> = { low: 0, medium: 1, high: 2, urgent: 3 };

const fold = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    // "ł" has no accent to strip.
    .replace(/ł/g, "l");

/** The page of types the address asks for (filtered, sorted, paged). */
export function ticketTypePage(
  types: HelpdeskTicketTypeWithDetails[],
  state: TicketTypeState
): PaginatedResult<HelpdeskTicketTypeWithDetails> {
  const search = fold(state.q.trim());
  const matches = types.filter((type) => {
    if (search && !fold(`${type.name} ${type.description ?? ""}`).includes(search)) return false;
    if (state.zakres.length && !state.zakres.includes(type.scope)) return false;
    if (state.oddzial.length && !(type.branch_id && state.oddzial.includes(type.branch_id))) {
      return false;
    }
    if (state.priorytet.length && !state.priorytet.includes(type.default_priority)) return false;
    if (state.stan.length && !state.stan.includes(type.is_active ? "aktywne" : "nieaktywne")) {
      return false;
    }
    if (
      state.akceptacja.length &&
      !state.akceptacja.includes(type.requires_acceptance ? "tak" : "nie")
    ) {
      return false;
    }
    return true;
  });
  const sign = state.direction === "asc" ? 1 : -1;
  const byName = (a: HelpdeskTicketTypeWithDetails, b: HelpdeskTicketTypeWithDetails) =>
    a.name.localeCompare(b.name, "pl");
  const sorted = [...matches].sort((a, b) => {
    let order = 0;
    switch (state.sort) {
      case "name":
        order = byName(a, b);
        break;
      case "default_priority":
        order = (PRIORITY_RANK[a.default_priority] ?? 0) - (PRIORITY_RANK[b.default_priority] ?? 0);
        break;
      case "updated_at":
        order = a.updated_at.localeCompare(b.updated_at);
        break;
      case "sort_order":
        order = a.sort_order - b.sort_order;
        break;
    }
    return order * sign || byName(a, b);
  });
  const pages = Math.max(1, Math.ceil(sorted.length / state.wierszy));
  const page = Math.min(Math.max(1, state.strona), pages);
  return {
    rows: sorted.slice((page - 1) * state.wierszy, page * state.wierszy),
    totalCount: sorted.length,
    page,
    pageSize: state.wierszy,
  };
}

/**
 * Old DataView links (`search`, `page`, `pageSize`, `sort=field.dir`,
 * `filters`) are translated once into this list's address. `selected`
 * keeps its name.
 */
export function migrateTicketTypeSearchParams(raw: Record<string, string | string[] | undefined>) {
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
  // The old list had no filters.
  if (raw.filters !== undefined) {
    delete next.filters;
    changed = true;
  }
  return { params: next, changed };
}
