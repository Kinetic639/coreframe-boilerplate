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
import type { ContactDirectoryFilter } from "@/lib/contacts/types";

// The contacts list's whole state is its address: the search, the kind
// (employees, external contacts), the name order, the page and the contact
// open in the side panel.

export const CONTACT_PAGE_SIZES = [20, 50, 100] as const;
export const CONTACT_KINDS = ["member", "external"] as const;

const UUID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;

export const contactParsers = {
  q: parseAsString.withDefault(""),
  strona: parseAsInteger.withDefault(1),
  wierszy: parseAsNumberLiteral(CONTACT_PAGE_SIZES).withDefault(50),
  /** The directory sorts by name only. */
  sort: parseAsStringLiteral(["display_name"] as const).withDefault("display_name"),
  direction: parseAsStringLiteral(["asc", "desc"] as const).withDefault("asc"),
  /** The open contact: an external contact's id, or `member:<user id>`. */
  selected: createParser({
    parse: (value) => {
      const id = value.startsWith("member:") ? value.slice("member:".length) : value;
      return UUID.test(id) ? value : null;
    },
    serialize: (value: string) => value,
  }),
  rodzaj: parseAsArrayOf(parseAsStringLiteral(CONTACT_KINDS)).withDefault([]),
};

export type ContactState = inferParserType<typeof contactParsers>;
export const loadContactState = createLoader(contactParsers);
export const serializeContactState = createSerializer(contactParsers);

export function contactHref(path: string, state: ContactState, patch: Partial<ContactState> = {}) {
  return serializeContactState(path, { ...state, ...patch });
}

/** What the list asks the directory for (the panel is not part of it). */
export function contactListParams(state: ContactState) {
  // One kind narrows the list; both (or none) are everyone.
  const kind: ContactDirectoryFilter = state.rodzaj.length === 1 ? state.rodzaj[0] : "all";
  return {
    kind,
    search: state.q.trim().slice(0, 80) || null,
    descending: state.direction === "desc",
    page: Math.max(1, state.strona),
    pageSize: state.wierszy,
  };
}

/**
 * Old DataView links (`search`, `page`, `pageSize`, `sort=field.dir`,
 * `filters={...}`) are translated once into this list's address. `selected`
 * keeps its name (mentions and the global search link with it).
 */
export function migrateContactSearchParams(raw: Record<string, string | string[] | undefined>) {
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
      if (filters && typeof filters === "object" && typeof filters.kind === "string") {
        next.rodzaj ??= filters.kind;
      }
    } catch {
      /* The parsers drop what they cannot read. */
    }
    delete next.filters;
    changed = true;
  }
  return { params: next, changed };
}
