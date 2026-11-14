import { createParser } from "nuqs/server";

// Helpers for Kolor Sensu lists whose rows are all loaded at once (a few
// hundred at most): the address filters, sorts and pages them in place.

/** Ready ranges of a "created" filter. */
export const CREATED_WITHIN = ["7d", "30d", "90d"] as const;
export type CreatedWithin = (typeof CREATED_WITHIN)[number];

/** A day, `2026-11-12` (anything else is dropped). */
export const parseAsDay = createParser({
  parse: (value) => (/^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null),
  serialize: (value: string) => value,
});

const UUID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;

/** An id (a uuid); anything else is dropped. */
export const parseAsUuid = createParser({
  parse: (value) => (UUID.test(value) ? value : null),
  serialize: (value: string) => value,
});

/** The whole days a created filter asks for (both included; null: open). */
export function createdWindow(
  state: { within: CreatedWithin | null; from: string | null; to: string | null },
  today = new Date()
): { from: string | null; to: string | null } {
  if (state.from || state.to) return { from: state.from, to: state.to };
  if (!state.within) return { from: null, to: null };
  const day = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  day.setUTCDate(day.getUTCDate() - Number.parseInt(state.within, 10));
  return { from: day.toISOString().slice(0, 10), to: null };
}

/** Whether a timestamp's day falls in a window. */
export function inWindow(
  value: string | null | undefined,
  window: { from: string | null; to: string | null }
) {
  if (!window.from && !window.to) return true;
  if (!value) return false;
  const day = value.slice(0, 10);
  return (!window.from || day >= window.from) && (!window.to || day <= window.to);
}

/** Text folded for a search: no case, no accents ("ł" too). */
export function fold(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/ł/g, "l");
}

/** Whether any of the texts holds the search (folded); an empty search matches. */
export function matchesSearch(search: string, ...texts: unknown[]) {
  const q = fold(search.trim());
  return !q || texts.some((text) => fold(text).includes(q));
}

/**
 * Rows sorted by one value (numbers as numbers, text in the locale's order,
 * empty last), then by key so the order never shuffles.
 */
export function sortRows<Row>(
  rows: Row[],
  valueOf: (row: Row) => unknown,
  direction: "asc" | "desc",
  keyOf: (row: Row) => string
) {
  const dir = direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const x = valueOf(a);
    const y = valueOf(b);
    const xEmpty = x === null || x === undefined || x === "";
    const yEmpty = y === null || y === undefined || y === "";
    if (xEmpty !== yEmpty) return xEmpty ? 1 : -1;
    let cmp = 0;
    if (!xEmpty) {
      cmp =
        typeof x === "number" && typeof y === "number"
          ? x - y
          : String(x).localeCompare(String(y), "pl", { numeric: true, sensitivity: "base" });
    }
    return cmp ? cmp * dir : keyOf(a).localeCompare(keyOf(b));
  });
}

/** One page of the rows (the page clamped to the last). */
export function pageOf<Row>(rows: Row[], page: number, size: number) {
  const last = Math.max(1, Math.ceil(rows.length / size));
  const current = Math.min(Math.max(1, page), last);
  return {
    rows: rows.slice((current - 1) * size, current * size),
    totalCount: rows.length,
    page: current,
  };
}

/**
 * Old DataView links (`search`, `page`, `pageSize`, `sort=field.dir`,
 * `filters={...}`) translated into a Kolor Sensu list's address. `filters`
 * maps each old filter key to its new param and how its value reads there
 * (null: drop it). `selected` keeps its name.
 */
export function migrateDataViewParams(
  raw: Record<string, string | string[] | undefined>,
  filters: Record<string, { param: string; value?: (value: unknown) => string | null }> = {},
  sorts: Record<string, string> = {}
) {
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
    next.sort = sorts[field] ?? field;
    next.direction = direction;
    changed = true;
  }
  if (typeof raw.filters === "string") {
    try {
      const parsed = JSON.parse(raw.filters) as Record<string, unknown>;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        for (const [oldKey, rule] of Object.entries(filters)) {
          if (!(oldKey in parsed)) continue;
          const value = parsed[oldKey];
          const read = rule.value
            ? rule.value(value)
            : Array.isArray(value)
              ? value.join(",")
              : typeof value === "string" && value
                ? value
                : null;
          if (read) next[rule.param] ??= read;
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
