import {
  createLoader,
  createParser,
  createSerializer,
  parseAsArrayOf,
  parseAsBoolean,
  parseAsInteger,
  parseAsNumberLiteral,
  parseAsString,
  parseAsStringLiteral,
  type inferParserType,
} from "nuqs/server";
import type { DataViewListParams } from "@/lib/data-view/types";

type Filters = DataViewListParams["filters"];
const parseFilters = createParser<Filters>({
  parse(value) {
    try {
      const result: unknown = JSON.parse(value);
      if (!result || typeof result !== "object" || Array.isArray(result)) return null;
      return Object.fromEntries(
        Object.entries(result).filter(
          ([key, value]) => key.startsWith("custom_field:") && typeof value === "string"
        )
      );
    } catch {
      return null;
    }
  },
  serialize: JSON.stringify,
});
export const PRODUCT_TYPES = [
  "stocked",
  "consumable",
  "service",
  "serialized",
  "lot_tracked",
  "bundle",
] as const;
export const PRODUCT_STATUSES = ["active", "archived", "discontinued"] as const;
export const PAGE_SIZES = [20, 50, 100] as const;
export const productParsers = {
  q: parseAsString.withDefault(""),
  strona: parseAsInteger.withDefault(1),
  wierszy: parseAsNumberLiteral(PAGE_SIZES).withDefault(50),
  sort: parseAsStringLiteral(["name", "product_type", "status", "updated_at"] as const).withDefault(
    "updated_at"
  ),
  direction: parseAsStringLiteral(["asc", "desc"] as const).withDefault("desc"),
  selected: createParser({
    parse: (value) => (/^[\da-f-]{36}(::[\da-f-]{36})?$/i.test(value) ? value : null),
    serialize: (value) => value,
  }),
  tab: parseAsStringLiteral(["info", "variants", "stock"] as const).withDefault("info"),
  status: parseAsArrayOf(parseAsStringLiteral(PRODUCT_STATUSES)).withDefault([]),
  product_type: parseAsArrayOf(parseAsStringLiteral(PRODUCT_TYPES)).withDefault([]),
  grouped: parseAsBoolean.withDefault(true),
  is_variant: parseAsArrayOf(parseAsStringLiteral(["true", "false"] as const)).withDefault([]),
  filters: parseFilters.withDefault({}),
};
export type ProductState = inferParserType<typeof productParsers>;
export const loadProductState = createLoader(productParsers);
export const serializeProductState = createSerializer(productParsers);
export function productHref(path: string, state: ProductState, patch: Partial<ProductState> = {}) {
  return serializeProductState(path, { ...state, ...patch });
}
export function productListParams(state: ProductState): DataViewListParams {
  return {
    search: state.q.trim().slice(0, 100),
    page: Math.max(1, state.strona),
    pageSize: state.wierszy,
    sort: { field: state.sort, direction: state.direction },
    filters: {
      ...state.filters,
      status: state.status.length ? state.status : null,
      product_type: state.product_type.length ? state.product_type : null,
      __group_variants: state.grouped,
      is_variant:
        !state.grouped && state.is_variant.length === 1 ? state.is_variant[0] === "true" : null,
    },
  };
}

/** Translate old DataView links once; the shared controls then own the canonical URL. */
export function migrateProductSearchParams(raw: Record<string, string | string[] | undefined>) {
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
      const filters: Filters = JSON.parse(raw.filters);
      if (filters && typeof filters === "object" && !Array.isArray(filters)) {
        for (const key of ["status", "product_type"])
          if (filters[key]) {
            next[key] ??= Array.isArray(filters[key])
              ? (filters[key] as string[]).join(",")
              : String(filters[key]);
            changed = true;
          }
        if (filters.__group_variants !== undefined) {
          next.grouped = String(filters.__group_variants);
          changed = true;
        }
        if (typeof filters.is_variant === "boolean") {
          next.is_variant = String(filters.is_variant);
          changed = true;
        }
      }
    } catch {
      /* The parser safely discards malformed filters. */
    }
  }
  return { params: next, changed };
}
