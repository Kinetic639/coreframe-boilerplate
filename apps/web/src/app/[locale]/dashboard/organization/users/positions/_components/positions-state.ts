import {
  createLoader,
  createSerializer,
  parseAsInteger,
  parseAsNumberLiteral,
  parseAsString,
  parseAsStringLiteral,
  type inferParserType,
} from "nuqs/server";
import type { ColumnSet } from "@/components/kolor-sensu/data-table/columns";
import {
  matchesSearch,
  migrateDataViewParams,
  pageOf,
  parseAsUuid,
  sortRows,
} from "@/components/kolor-sensu/data-table/local-list";
import type { OrgPosition } from "@/server/services/organization.service";

// The positions list's whole state is its address: the search, the sort, the
// page and the position open in the side panel. All positions are loaded.

export const POSITION_PAGE_SIZES = [20, 50, 100] as const;
export const POSITION_SORTS = ["name", "created_at"] as const;

export const positionParsers = {
  q: parseAsString.withDefault(""),
  strona: parseAsInteger.withDefault(1),
  wierszy: parseAsNumberLiteral(POSITION_PAGE_SIZES).withDefault(50),
  sort: parseAsStringLiteral(POSITION_SORTS).withDefault("name"),
  direction: parseAsStringLiteral(["asc", "desc"] as const).withDefault("asc"),
  selected: parseAsUuid,
};

export type PositionState = inferParserType<typeof positionParsers>;
export const loadPositionState = createLoader(positionParsers);
export const serializePositionState = createSerializer(positionParsers);

export function positionHref(
  path: string,
  state: PositionState,
  patch: Partial<PositionState> = {}
) {
  return serializePositionState(path, { ...state, ...patch });
}

/** The page of positions the address shows. */
export function positionPage(rows: OrgPosition[], state: PositionState) {
  const matching = rows.filter((position) =>
    matchesSearch(state.q, position.name, position.description)
  );
  const sorted = sortRows(
    matching,
    (position) => position[state.sort],
    state.direction,
    (position) => position.id
  );
  return pageOf(sorted, state.strona, state.wierszy);
}

export function migratePositionSearchParams(raw: Record<string, string | string[] | undefined>) {
  return migrateDataViewParams(raw);
}

export function positionColumnSet(labels: Record<string, string>): ColumnSet<string> {
  const ids = ["description", "created_at"];
  return {
    ids,
    labels: Object.fromEntries(ids.map((id) => [id, labels[`column_${id}`]])),
    widths: { description: 420, created_at: 140 },
    shownByDefault: ids,
    pinned: { id: "position", label: labels.column_position, width: 280 },
  };
}
