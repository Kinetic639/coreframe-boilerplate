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
import type { RepairOrderListParams } from "@/server/services/repair-orders.service";

// The repair order list's whole state is its address: the search, a filter
// per column, the sort and the page. A row opens the order's own page.

export const REPAIR_ORDER_PAGE_SIZES = [20, 50, 100] as const;
export const REPAIR_ORDER_SORTS = [
  "created_at",
  "updated_at",
  "warehouse_code",
  "order_number",
  "vin",
  "vehicle_brand",
  "client_name",
  "status",
] as const satisfies readonly RepairOrderListParams["sort"]["field"][];
export type RepairOrderSort = (typeof REPAIR_ORDER_SORTS)[number];
export const REPAIR_ORDER_STATUSES = ["open", "closed", "archived"] as const;
/** Ready ranges of the "created" filter. */
export const CREATED_WITHIN = ["7d", "30d", "90d"] as const;
/** The advisor filter's value for orders nobody advises yet. */
export const NO_ADVISOR = "brak";

/** A day, `2026-11-12` (anything else is dropped). */
const parseAsDay = createParser({
  parse: (value) => (/^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null),
  serialize: (value: string) => value,
});
/** A contact id, or "brak". */
const parseAsAdvisor = createParser({
  parse: (value) => (value === NO_ADVISOR || /^[\da-f-]{36}$/i.test(value) ? value : null),
  serialize: (value: string) => value,
});
/** A DMS warehouse code (`3112`). */
const parseAsWarehouse = createParser({
  parse: (value) => (/^[\w-]{1,20}$/.test(value) ? value : null),
  serialize: (value: string) => value,
});

export const repairOrderParsers = {
  q: parseAsString.withDefault(""),
  strona: parseAsInteger.withDefault(1),
  wierszy: parseAsNumberLiteral(REPAIR_ORDER_PAGE_SIZES).withDefault(50),
  sort: parseAsStringLiteral(REPAIR_ORDER_SORTS).withDefault("created_at"),
  direction: parseAsStringLiteral(["asc", "desc"] as const).withDefault("desc"),
  status: parseAsArrayOf(parseAsStringLiteral(REPAIR_ORDER_STATUSES)).withDefault([]),
  magazyn: parseAsArrayOf(parseAsWarehouse).withDefault([]),
  doradca: parseAsArrayOf(parseAsAdvisor).withDefault([]),
  utworzono: parseAsStringLiteral(CREATED_WITHIN),
  utworzono_od: parseAsDay,
  utworzono_do: parseAsDay,
};

export type RepairOrderState = inferParserType<typeof repairOrderParsers>;
export const loadRepairOrderState = createLoader(repairOrderParsers);
export const serializeRepairOrderState = createSerializer(repairOrderParsers);

export function repairOrderHref(
  path: string,
  state: RepairOrderState,
  patch: Partial<RepairOrderState> = {}
) {
  return serializeRepairOrderState(path, { ...state, ...patch });
}

/** The first day of a ready range (days back from today, UTC). */
function since(within: (typeof CREATED_WITHIN)[number], today = new Date()) {
  const days = Number.parseInt(within, 10);
  const day = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  day.setUTCDate(day.getUTCDate() - days);
  return day.toISOString().slice(0, 10);
}

/** What the service is asked for. */
export function repairOrderListParams(state: RepairOrderState): RepairOrderListParams {
  const createdFrom = state.utworzono_od ?? (state.utworzono ? since(state.utworzono) : null);
  return {
    search: state.q.trim().slice(0, 100) || null,
    page: Math.max(1, state.strona),
    pageSize: state.wierszy,
    sort: { field: state.sort, direction: state.direction },
    statuses: [...state.status],
    warehouseCodes: [...state.magazyn],
    advisorIds: state.doradca.filter((value) => value !== NO_ADVISOR),
    withoutAdvisor: state.doradca.includes(NO_ADVISOR),
    createdFrom: createdFrom ? `${createdFrom}T00:00:00.000Z` : null,
    // The whole last day counts.
    createdTo: state.utworzono_do ? `${state.utworzono_do}T23:59:59.999Z` : null,
  };
}

/** The old list's warehouse filter (`mag=3112`) becomes this list's `magazyn`. */
export function migrateRepairOrderSearchParams(raw: Record<string, string | string[] | undefined>) {
  const next = { ...raw };
  let changed = false;
  if (raw.mag !== undefined) {
    next.magazyn ??= raw.mag;
    delete next.mag;
    changed = true;
  }
  // A leftover of the "new order" page's redirect, which nothing reads.
  if (raw.noBranch !== undefined) {
    delete next.noBranch;
    changed = true;
  }
  return { params: next, changed };
}
