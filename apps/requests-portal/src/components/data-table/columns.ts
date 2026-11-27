// A table's columns, for every table of the portals (bookings, clients):
// which there are, their names and usual widths, which show by default.
// The person arranges them (which, the order, the widths); the layout and
// the widths live in cookies, so the server renders the table as they left
// it. The pinned first column is not in the layout, only its width.

export interface ColumnSet<Id extends string> {
  /** Every column, in its usual order. */
  ids: readonly Id[];
  labels: Record<Id, string>;
  /** Usual widths, px. */
  widths: Record<Id, number>;
  shownByDefault: readonly Id[];
  /** The pinned first column: its key among the widths and its width. */
  pinned: { id: string; label: string; width: number };
}

export type ColumnLayout<Id extends string = string> = {
  id: Id;
  shown: boolean;
}[];

export type ColumnWidths = Partial<Record<string, number>>;

export const MIN_COLUMN_WIDTH = 60;
export const MAX_COLUMN_WIDTH = 640;

/** The columns in their usual order, the usual ones shown. */
export function defaultLayout<Id extends string>(
  set: ColumnSet<Id>,
  available: readonly Id[] = set.ids
): ColumnLayout<Id> {
  return set.ids
    .filter((id) => available.includes(id))
    .map((id) => ({ id, shown: set.shownByDefault.includes(id) }));
}

/**
 * A saved layout (`termin,klient,-telefon,…`: the order, `-` for hidden),
 * kept to the columns this table has; any the save does not know come
 * after, as they would by default. Nonsense gives the default.
 */
export function parseLayout<Id extends string>(
  set: ColumnSet<Id>,
  saved: string | undefined | null,
  available: readonly Id[] = set.ids
): ColumnLayout<Id> {
  const fallback = defaultLayout(set, available);
  if (!saved) return fallback;
  const seen = new Set<Id>();
  const layout: ColumnLayout<Id> = [];
  for (const part of saved.split(",")) {
    const hidden = part.startsWith("-");
    const id = (hidden ? part.slice(1) : part) as Id;
    if (!available.includes(id) || seen.has(id)) continue;
    seen.add(id);
    layout.push({ id, shown: !hidden });
  }
  if (!layout.length) return fallback;
  for (const column of fallback) {
    if (!seen.has(column.id)) layout.push(column);
  }
  // At least one column besides the pinned one.
  if (!layout.some((column) => column.shown)) layout[0]!.shown = true;
  return layout;
}

export function serializeLayout(layout: ColumnLayout) {
  return layout.map((column) => (column.shown ? column.id : `-${column.id}`)).join(",");
}

export function clampColumnWidth(width: number) {
  return Math.round(Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, width)));
}

/**
 * Saved widths (`termin:150,klient:220`); unknown or broken parts are left
 * out (with a set, only its columns and the pinned one count).
 */
export function parseWidths(
  saved: string | undefined | null,
  set?: ColumnSet<string>
): ColumnWidths {
  const known = set ? [set.pinned.id, ...set.ids] : null;
  const widths: ColumnWidths = {};
  for (const part of (saved ?? "").split(",")) {
    const [id, value] = part.split(":");
    const width = Number(value);
    if (id && (!known || known.includes(id)) && Number.isFinite(width) && width > 0) {
      widths[id] = clampColumnWidth(width);
    }
  }
  return widths;
}

export function serializeWidths(widths: ColumnWidths) {
  return Object.entries(widths)
    .map(([id, width]) => `${id}:${width}`)
    .join(",");
}

/** A column's usual width (the pinned one by its key). */
export function usualWidth<Id extends string>(set: ColumnSet<Id>, id: string) {
  return id === set.pinned.id ? set.pinned.width : set.widths[id as Id];
}

/** A column's width: the person's own, or the usual one. */
export function widthOf<Id extends string>(set: ColumnSet<Id>, id: string, widths: ColumnWidths) {
  return widths[id] ?? usualWidth(set, id);
}

/** The cookie a table's layout is kept in, e.g. `ks_cols_rezerwacje`. */
export function columnsCookieName(table: string) {
  return `ks_cols_${table}`;
}

/** The cookie a table's widths are kept in, e.g. `ks_widths_rezerwacje`. */
export function widthsCookieName(table: string) {
  return `ks_widths_${table}`;
}
