import {
  createLoader,
  createSerializer,
  parseAsArrayOf,
  parseAsInteger,
  parseAsNumberLiteral,
  parseAsString,
  parseAsStringLiteral,
  type inferParserType,
} from "nuqs/server";
import {
  CREATED_WITHIN,
  createdWindow,
  inWindow,
  matchesSearch,
  migrateDataViewParams,
  pageOf,
  parseAsDay,
  parseAsUuid,
  sortRows,
} from "@/components/kolor-sensu/data-table/local-list";
import type { ColumnSet } from "@/components/kolor-sensu/data-table/columns";
import type { OrgBranch } from "@/server/services/organization.service";

// The branch list's whole state is its address: the search, the filters, the
// sort, the page and the branch open in the side panel. All branches are
// loaded; the address picks among them.

export const BRANCH_PAGE_SIZES = [20, 50, 100] as const;
export const BRANCH_SORTS = ["branch_number", "name", "slug", "created_at"] as const;
/** Public warehouse maps: on, off. */
export const BRANCH_MAPS = ["tak", "nie"] as const;

export const branchParsers = {
  q: parseAsString.withDefault(""),
  strona: parseAsInteger.withDefault(1),
  wierszy: parseAsNumberLiteral(BRANCH_PAGE_SIZES).withDefault(50),
  sort: parseAsStringLiteral(BRANCH_SORTS).withDefault("branch_number"),
  direction: parseAsStringLiteral(["asc", "desc"] as const).withDefault("asc"),
  selected: parseAsUuid,
  mapy: parseAsArrayOf(parseAsStringLiteral(BRANCH_MAPS)).withDefault([]),
  utworzono: parseAsStringLiteral(CREATED_WITHIN),
  utworzono_od: parseAsDay,
  utworzono_do: parseAsDay,
};

export type BranchState = inferParserType<typeof branchParsers>;
export const loadBranchState = createLoader(branchParsers);
export const serializeBranchState = createSerializer(branchParsers);

export function branchHref(path: string, state: BranchState, patch: Partial<BranchState> = {}) {
  return serializeBranchState(path, { ...state, ...patch });
}

/** The branches the address asks for, in its order. */
export function filterBranches(rows: OrgBranch[], state: BranchState, today = new Date()) {
  const created = createdWindow(
    { within: state.utworzono, from: state.utworzono_od, to: state.utworzono_do },
    today
  );
  const maps = state.mapy.length === 1 ? state.mapy[0] === "tak" : null;
  const matching = rows.filter(
    (branch) =>
      matchesSearch(state.q, branch.name, branch.slug, branch.branch_number) &&
      (maps === null || !!branch.public_warehouse_maps_enabled === maps) &&
      inWindow(branch.created_at, created)
  );
  return sortRows(
    matching,
    (branch) => branch[state.sort as keyof OrgBranch] as unknown,
    state.direction,
    (branch) => branch.id
  );
}

/** The page of branches the address shows. */
export function branchPage(rows: OrgBranch[], state: BranchState, today = new Date()) {
  return pageOf(filterBranches(rows, state, today), state.strona, state.wierszy);
}

/** Old DataView links, translated once. */
export function migrateBranchSearchParams(raw: Record<string, string | string[] | undefined>) {
  return migrateDataViewParams(raw, {
    publicMapsEnabled: {
      param: "mapy",
      value: (value) => (value === true ? "tak" : value === false ? "nie" : null),
    },
    slug: { param: "q" },
    createdFrom: { param: "utworzono_od" },
    createdTo: { param: "utworzono_do" },
  });
}

export function branchColumnSet(labels: Record<string, string>): ColumnSet<string> {
  const ids = ["number", "slug", "public_maps", "created_at"];
  return {
    ids,
    labels: Object.fromEntries(ids.map((id) => [id, labels[`column_${id}`]])),
    widths: { number: 90, slug: 180, public_maps: 170, created_at: 140 },
    shownByDefault: ids,
    pinned: { id: "branch", label: labels.column_branch, width: 300 },
  };
}
