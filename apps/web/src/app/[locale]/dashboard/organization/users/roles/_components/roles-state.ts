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
import type { ColumnSet } from "@/components/kolor-sensu/data-table/columns";
import {
  matchesSearch,
  migrateDataViewParams,
  pageOf,
  parseAsUuid,
  sortRows,
} from "@/components/kolor-sensu/data-table/local-list";
import type { OrgRole } from "@/server/services/organization.service";

// The roles list's whole state is its address: the search, the scope and
// kind filters, the sort, the page and the role open in the side panel.

export const ROLE_PAGE_SIZES = [20, 50, 100] as const;
export const ROLE_SORTS = ["name", "scope_type", "permissions"] as const;
export const ROLE_SCOPES = ["org", "branch", "both"] as const;
/** System roles (basic, read-only) and the organization's own. */
export const ROLE_KINDS = ["systemowa", "wlasna"] as const;

export const roleParsers = {
  q: parseAsString.withDefault(""),
  strona: parseAsInteger.withDefault(1),
  wierszy: parseAsNumberLiteral(ROLE_PAGE_SIZES).withDefault(50),
  sort: parseAsStringLiteral(ROLE_SORTS).withDefault("name"),
  direction: parseAsStringLiteral(["asc", "desc"] as const).withDefault("asc"),
  selected: parseAsUuid,
  zakres: parseAsArrayOf(parseAsStringLiteral(ROLE_SCOPES)).withDefault([]),
  rodzaj: parseAsArrayOf(parseAsStringLiteral(ROLE_KINDS)).withDefault([]),
};

export type RoleState = inferParserType<typeof roleParsers>;
export const loadRoleState = createLoader(roleParsers);
export const serializeRoleState = createSerializer(roleParsers);

export function roleHref(path: string, state: RoleState, patch: Partial<RoleState> = {}) {
  return serializeRoleState(path, { ...state, ...patch });
}

/** The page of roles the address shows (deleted roles never). */
export function rolePage(rows: OrgRole[], state: RoleState) {
  const kind = state.rodzaj.length === 1 ? state.rodzaj[0] === "systemowa" : null;
  const matching = rows.filter(
    (role) =>
      !role.deleted_at &&
      matchesSearch(state.q, role.name, role.description) &&
      (!state.zakres.length || (state.zakres as string[]).includes(role.scope_type)) &&
      (kind === null || role.is_basic === kind)
  );
  const sorted = sortRows(
    matching,
    (role) => (state.sort === "permissions" ? role.permission_slugs.length : role[state.sort]),
    state.direction,
    (role) => role.id
  );
  return pageOf(sorted, state.strona, state.wierszy);
}

export function migrateRoleSearchParams(raw: Record<string, string | string[] | undefined>) {
  return migrateDataViewParams(
    raw,
    {
      scope: { param: "zakres" },
      isBasic: {
        param: "rodzaj",
        value: (value) => (value === true ? "systemowa" : value === false ? "wlasna" : null),
      },
    },
    { permission_slugs: "permissions" }
  );
}

export function roleColumnSet(labels: Record<string, string>): ColumnSet<string> {
  const ids = ["scope", "permissions", "description"];
  return {
    ids,
    labels: Object.fromEntries(ids.map((id) => [id, labels[`column_${id}`]])),
    widths: { scope: 150, permissions: 130, description: 380 },
    shownByDefault: ids,
    pinned: { id: "role", label: labels.column_role, width: 300 },
  };
}
