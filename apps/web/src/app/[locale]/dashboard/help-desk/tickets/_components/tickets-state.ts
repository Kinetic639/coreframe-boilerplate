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
import { TICKET_PRIORITIES, TICKET_STATUSES } from "@/lib/validations/helpdesk";

// The tickets list's whole state is its address: the search, a filter per
// column, the queue, the sort, the page and the ticket open in the side panel.

export const TICKET_PAGE_SIZES = [20, 50, 100] as const;
export const TICKET_SORTS = [
  "ticket_number",
  "title",
  "status",
  "priority",
  "created_at",
  "updated_at",
] as const;
export type TicketSort = (typeof TICKET_SORTS)[number];
/** Ready ranges of the "created" filter. */
export const CREATED_WITHIN = ["7d", "30d", "90d"] as const;
/** The one value of the "assignment" filter: nobody has taken the ticket yet. */
export const UNASSIGNED = "brak";
/** Statuses of tickets still being handled (the handler queues). */
export const OPEN_STATUSES = ["open", "in_progress", "waiting", "waiting_response"] as const;

/** A day, `2026-11-12` (anything else is dropped). */
const parseAsDay = createParser({
  parse: (value) => (/^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null),
  serialize: (value: string) => value,
});
const parseAsUuid = createParser({
  parse: (value) => (/^[\da-f-]{36}$/i.test(value) ? value : null),
  serialize: (value: string) => value,
});

export const ticketParsers = {
  q: parseAsString.withDefault(""),
  strona: parseAsInteger.withDefault(1),
  wierszy: parseAsNumberLiteral(TICKET_PAGE_SIZES).withDefault(50),
  sort: parseAsStringLiteral(TICKET_SORTS).withDefault("created_at"),
  direction: parseAsStringLiteral(["asc", "desc"] as const).withDefault("desc"),
  /** The open ticket: its number (`HD-0042`). */
  selected: createParser({
    parse: (value) => (/^[\w\-./]{1,60}$/.test(value) ? value : null),
    serialize: (value: string) => value,
  }),
  status: parseAsArrayOf(parseAsStringLiteral(TICKET_STATUSES)).withDefault([]),
  priorytet: parseAsArrayOf(parseAsStringLiteral(TICKET_PRIORITIES)).withDefault([]),
  typ: parseAsArrayOf(parseAsUuid).withDefault([]),
  oddzial: parseAsArrayOf(parseAsUuid).withDefault([]),
  zglaszajacy: parseAsArrayOf(parseAsUuid).withDefault([]),
  przypisani: parseAsArrayOf(parseAsUuid).withDefault([]),
  przypisanie: parseAsArrayOf(parseAsStringLiteral([UNASSIGNED] as const)).withDefault([]),
  utworzono: parseAsStringLiteral(CREATED_WITHIN),
  utworzono_od: parseAsDay,
  utworzono_do: parseAsDay,
};

export type TicketState = inferParserType<typeof ticketParsers>;
export const loadTicketState = createLoader(ticketParsers);
export const serializeTicketState = createSerializer(ticketParsers);

/** The keys that filter the list (the queues set them all at once). */
export const TICKET_FILTER_KEYS = [
  "status",
  "priorytet",
  "typ",
  "oddzial",
  "zglaszajacy",
  "przypisani",
  "przypisanie",
  "utworzono",
  "utworzono_od",
  "utworzono_do",
] as const satisfies readonly (keyof TicketState)[];
export type TicketFilters = Pick<TicketState, (typeof TICKET_FILTER_KEYS)[number]>;

export const NO_TICKET_FILTERS: TicketFilters = {
  status: [],
  priorytet: [],
  typ: [],
  oddzial: [],
  zglaszajacy: [],
  przypisani: [],
  przypisanie: [],
  utworzono: null,
  utworzono_od: null,
  utworzono_do: null,
};

export function ticketHref(path: string, state: TicketState, patch: Partial<TicketState> = {}) {
  return serializeTicketState(path, { ...state, ...patch });
}

export type TicketQueue = "unassigned" | "mine" | "waitingRequester" | "waitingVendor" | "all";
export const TICKET_QUEUES: TicketQueue[] = [
  "unassigned",
  "mine",
  "waitingRequester",
  "waitingVendor",
  "all",
];

/**
 * The handler queues are presets of the filters, so a queue is just a
 * filtered list and the usual filters keep working on top of it. Queues
 * bound to a branch use the active one.
 */
export function ticketQueueFilters(
  queue: TicketQueue,
  { userId, branchId }: { userId: string; branchId: string | null }
): TicketFilters {
  const branch = branchId ? [branchId] : [];
  switch (queue) {
    case "unassigned":
      return {
        ...NO_TICKET_FILTERS,
        oddzial: branch,
        przypisanie: [UNASSIGNED],
        status: [...OPEN_STATUSES],
      };
    case "mine":
      return { ...NO_TICKET_FILTERS, przypisani: [userId], status: [...OPEN_STATUSES] };
    case "waitingRequester":
      return { ...NO_TICKET_FILTERS, oddzial: branch, status: ["waiting_response"] };
    case "waitingVendor":
      return { ...NO_TICKET_FILTERS, oddzial: branch, status: ["waiting"] };
    case "all":
      return NO_TICKET_FILTERS;
  }
}

const sameValues = (a: unknown, b: unknown) => {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && [...a].sort().join(",") === [...b].sort().join(",");
  }
  return (a ?? null) === (b ?? null);
};

/** The queue whose filters the address has, exactly (none: filtered by hand). */
export function activeTicketQueue(
  state: TicketState,
  who: { userId: string; branchId: string | null }
): TicketQueue | null {
  return (
    TICKET_QUEUES.find((queue) => {
      const filters = ticketQueueFilters(queue, who);
      return TICKET_FILTER_KEYS.every((key) => sameValues(state[key], filters[key]));
    }) ?? null
  );
}

/** The first day of a ready range (days back from today, UTC). */
function since(within: (typeof CREATED_WITHIN)[number], today = new Date()) {
  const days = Number.parseInt(within, 10);
  const day = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  day.setUTCDate(day.getUTCDate() - days);
  return day.toISOString().slice(0, 10);
}

/** What the service is asked for (the panel is not part of it). */
export function ticketListParams(state: TicketState): DataViewListParams {
  const createdFrom =
    state.utworzono_od ?? (state.utworzono ? since(state.utworzono) : null) ?? null;
  return {
    search: state.q.trim().slice(0, 100),
    page: Math.max(1, state.strona),
    pageSize: state.wierszy,
    sort: { field: state.sort, direction: state.direction },
    filters: {
      status: state.status.length ? [...state.status] : null,
      priority: state.priorytet.length ? [...state.priorytet] : null,
      ticketTypeId: state.typ.length ? state.typ : null,
      branchId: state.oddzial.length ? state.oddzial : null,
      createdBy: state.zglaszajacy.length ? state.zglaszajacy : null,
      assignedTo: state.przypisani.length ? state.przypisani : null,
      unassigned: state.przypisanie.includes(UNASSIGNED) ? true : null,
      createdAtFrom: createdFrom ? `${createdFrom}T00:00:00.000Z` : null,
      // The whole last day counts.
      createdAtTo: state.utworzono_do ? `${state.utworzono_do}T23:59:59.999Z` : null,
    },
  };
}

/**
 * Old DataView links (`search`, `page`, `pageSize`, `sort=field.dir`,
 * `filters={...}`) are translated once into this list's address. `selected`
 * keeps its name.
 */
export function migrateTicketSearchParams(raw: Record<string, string | string[] | undefined>) {
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
          ["status", "status"],
          ["priority", "priorytet"],
          ["ticketTypeId", "typ"],
          ["branchId", "oddzial"],
          ["createdBy", "zglaszajacy"],
          ["assignedTo", "przypisani"],
        ]) {
          const value = filters[oldKey];
          if (typeof value === "string" || Array.isArray(value)) {
            next[newKey] ??= Array.isArray(value) ? value.join(",") : value;
          }
        }
        if (filters.unassigned === true) next.przypisanie ??= UNASSIGNED;
        for (const [oldKey, newKey] of [
          ["createdAtFrom", "utworzono_od"],
          ["createdAtTo", "utworzono_do"],
        ]) {
          const value = filters[oldKey];
          if (typeof value === "string") next[newKey] ??= value.slice(0, 10);
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
