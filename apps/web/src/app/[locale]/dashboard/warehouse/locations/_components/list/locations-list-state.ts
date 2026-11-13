import {
  createParser,
  createSerializer,
  parseAsArrayOf,
  parseAsInteger,
  parseAsNumberLiteral,
  parseAsString,
  parseAsStringLiteral,
  type inferParserType,
} from "nuqs/server";
import type { ColumnSet } from "@/components/kolor-sensu/data-table/columns";
import type { WarehouseLocation } from "@/lib/warehouse/location-tree";

// The locations list's whole state is its address, as the products and
// movements lists': the search, a filter per column, the sort, the page and
// the location open in the side panel. The branch's locations are already on
// the page (the tree needs them all), so the list filters, sorts and pages
// them here, with no request.

export const LOCATION_PAGE_SIZES = [20, 50, 100] as const;
/** `struktura`: the tree's own order (each parent, then its children). */
export const LOCATION_SORTS = ["struktura", "code", "name", "level", "created_at"] as const;
export type LocationSort = (typeof LOCATION_SORTS)[number];
/** The "stores stock" filter: `tak` / `nie`. */
export const STORES_STOCK = ["tak", "nie"] as const;

const parseAsUuid = createParser({
  parse: (value) => (/^[\da-f-]{36}$/i.test(value) ? value : null),
  serialize: (value: string) => value,
});

export const locationParsers = {
  q: parseAsString.withDefault(""),
  strona: parseAsInteger.withDefault(1),
  wierszy: parseAsNumberLiteral(LOCATION_PAGE_SIZES).withDefault(50),
  sort: parseAsStringLiteral(LOCATION_SORTS).withDefault("struktura"),
  direction: parseAsStringLiteral(["asc", "desc"] as const).withDefault("asc"),
  /** The open location (its id); the tree view keeps it when switching. */
  selected: parseAsUuid,
  magazynowa: parseAsArrayOf(parseAsStringLiteral(STORES_STOCK)).withDefault([]),
  tryb: parseAsArrayOf(parseAsString).withDefault([]),
  poziom: parseAsArrayOf(parseAsInteger).withDefault([]),
};

export type LocationState = inferParserType<typeof locationParsers>;
const serialize = createSerializer(locationParsers);

/**
 * The address for `state` with `patch`. The view (`view=list`) and anything
 * else on the address that is not the list's own are kept.
 */
export function locationHref(
  path: string,
  state: LocationState,
  patch: Partial<LocationState> = {},
  keep: Record<string, string> = { view: "list" }
) {
  const own = serialize({ ...state, ...patch });
  const query = new URLSearchParams(own.startsWith("?") ? own.slice(1) : own);
  for (const [key, value] of Object.entries(keep)) query.set(key, value);
  const text = query.toString();
  return text ? `${path}?${text}` : path;
}

export function locationColumnSet(labels: Record<string, string>): ColumnSet<string> {
  const ids = ["name", "path", "level", "storage_mode", "can_store_inventory", "created_at"];
  return {
    ids,
    labels: {
      name: labels.name,
      path: labels.path,
      level: labels.level,
      storage_mode: labels.storageMode,
      can_store_inventory: labels.canStoreInventory,
      created_at: labels.created,
    },
    widths: {
      name: 240,
      path: 280,
      level: 90,
      storage_mode: 150,
      can_store_inventory: 130,
      created_at: 160,
    },
    shownByDefault: ["path", "level", "storage_mode", "can_store_inventory"],
    pinned: { id: "code", label: labels.code, width: 200 },
  };
}

export interface LocationListRow {
  id: string;
  name: string;
  code: string | null;
  /** Codes (or names) from the root down: `MAG / A / 01`. */
  path: string;
  level: number;
  storage_mode: string | null;
  can_store_inventory: boolean;
  color: string | null;
  created_at: string;
  /** Its place in the tree's own order. */
  order: number;
}

/** Every location as a list row, in the tree's order, with its path. */
export function locationRows(locations: WarehouseLocation[]): LocationListRow[] {
  const byId = new Map(locations.map((location) => [location.id, location]));
  const children = new Map<string | null, WarehouseLocation[]>();
  for (const location of locations) {
    const parent = location.parent_id && byId.has(location.parent_id) ? location.parent_id : null;
    const bucket = children.get(parent);
    if (bucket) bucket.push(location);
    else children.set(parent, [location]);
  }
  for (const bucket of children.values()) {
    bucket.sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name)
    );
  }
  const rows: LocationListRow[] = [];
  const visit = (parent: string | null, trail: string[], seen: Set<string>) => {
    for (const location of children.get(parent) ?? []) {
      if (seen.has(location.id)) continue;
      seen.add(location.id);
      const path = [...trail, location.code || location.name];
      rows.push({
        id: location.id,
        name: location.name,
        code: location.code,
        path: path.join(" / "),
        level: location.level ?? trail.length,
        storage_mode: location.storage_mode ?? null,
        can_store_inventory: Boolean(location.can_store_inventory),
        color: location.color,
        created_at: location.created_at ?? "",
        order: rows.length,
      });
      visit(location.id, path, seen);
    }
  };
  visit(null, [], new Set());
  return rows;
}

const collator = new Intl.Collator("pl", { numeric: true, sensitivity: "base" });

/** The page of rows the address asks for, and how many rows it finds. */
export function listLocations(rows: LocationListRow[], state: LocationState) {
  const search = state.q.trim().toLocaleLowerCase("pl");
  const stores = new Set(state.magazynowa);
  const modes = new Set(state.tryb);
  const levels = new Set(state.poziom);
  const found = rows.filter(
    (row) =>
      (!search ||
        row.name.toLocaleLowerCase("pl").includes(search) ||
        (row.code ?? "").toLocaleLowerCase("pl").includes(search) ||
        row.path.toLocaleLowerCase("pl").includes(search)) &&
      (!stores.size || stores.has(row.can_store_inventory ? "tak" : "nie")) &&
      (!modes.size || modes.has(row.storage_mode ?? "")) &&
      (!levels.size || levels.has(row.level))
  );
  const sign = state.direction === "desc" ? -1 : 1;
  const compare: Record<LocationSort, (a: LocationListRow, b: LocationListRow) => number> = {
    struktura: (a, b) => a.order - b.order,
    code: (a, b) => collator.compare(a.code ?? "", b.code ?? "") || a.order - b.order,
    name: (a, b) => collator.compare(a.name, b.name) || a.order - b.order,
    level: (a, b) => a.level - b.level || a.order - b.order,
    created_at: (a, b) => a.created_at.localeCompare(b.created_at) || a.order - b.order,
  };
  const sorted = [...found].sort((a, b) => sign * compare[state.sort](a, b));
  const pages = Math.max(1, Math.ceil(sorted.length / state.wierszy));
  const page = Math.min(Math.max(1, state.strona), pages);
  return {
    rows: sorted.slice((page - 1) * state.wierszy, page * state.wierszy),
    totalCount: sorted.length,
    page,
    /** Every row found, in order (↓ / ↑ across pages, "select all found"). */
    all: sorted,
  };
}

/**
 * Old DataView links (`search`, `page`, `pageSize`, `sort=field.dir`,
 * `filters={...}`) as this list's address; null when there is nothing to
 * translate.
 */
export function migrateLocationSearch(search: string): string | null {
  const params = new URLSearchParams(search);
  let changed = false;
  for (const [oldKey, newKey] of [
    ["search", "q"],
    ["page", "strona"],
    ["pageSize", "wierszy"],
  ] as const) {
    const value = params.get(oldKey);
    if (value === null) continue;
    if (!params.has(newKey)) params.set(newKey, value);
    params.delete(oldKey);
    changed = true;
  }
  const sort = params.get("sort");
  if (sort?.includes(".")) {
    const [field, direction] = sort.split(".");
    params.set("sort", field);
    params.set("direction", direction);
    changed = true;
  }
  const filters = params.get("filters");
  if (filters !== null) {
    try {
      const parsed = JSON.parse(filters) as Record<string, unknown>;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const value = (key: string) => {
          const raw = parsed[key];
          return Array.isArray(raw) ? raw.join(",") : raw == null ? null : String(raw);
        };
        const stores = value("can_store_inventory");
        if (stores && !params.has("magazynowa")) {
          params.set("magazynowa", stores === "true" ? "tak" : "nie");
        }
        const mode = value("storage_mode");
        if (mode && !params.has("tryb")) params.set("tryb", mode);
        const level = value("level");
        if (level && !params.has("poziom")) params.set("poziom", level);
      }
    } catch {
      /* The parsers drop what they cannot read. */
    }
    params.delete("filters");
    changed = true;
  }
  return changed ? params.toString() : null;
}
