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
import type { OrgMember, OrgPositionAssignment } from "@/server/services/organization.service";

// The members list's whole state is its address: the search, the status, role
// and position filters, the sort, the page and the member open in the side
// panel (by their user id). All members are loaded.

export const MEMBER_PAGE_SIZES = [20, 50, 100] as const;
export const MEMBER_SORTS = ["name", "status", "joined_at"] as const;
export const MEMBER_STATUSES = ["active", "inactive"] as const;

export const memberParsers = {
  q: parseAsString.withDefault(""),
  strona: parseAsInteger.withDefault(1),
  wierszy: parseAsNumberLiteral(MEMBER_PAGE_SIZES).withDefault(50),
  sort: parseAsStringLiteral(MEMBER_SORTS).withDefault("name"),
  direction: parseAsStringLiteral(["asc", "desc"] as const).withDefault("asc"),
  selected: parseAsUuid,
  status: parseAsArrayOf(parseAsStringLiteral(MEMBER_STATUSES)).withDefault([]),
  rola: parseAsArrayOf(parseAsUuid).withDefault([]),
  stanowisko: parseAsArrayOf(parseAsUuid).withDefault([]),
};

export type MemberState = inferParserType<typeof memberParsers>;
export const loadMemberState = createLoader(memberParsers);
export const serializeMemberState = createSerializer(memberParsers);

export function memberHref(path: string, state: MemberState, patch: Partial<MemberState> = {}) {
  return serializeMemberState(path, { ...state, ...patch });
}

/** The member's name, or their email when they gave none. */
export function memberName(member: OrgMember) {
  const name = [member.user_first_name, member.user_last_name].filter(Boolean).join(" ");
  return name || member.user_email || "";
}

/** Each user's current position (an assignment not removed). */
export function positionsByUser(assignments: OrgPositionAssignment[]) {
  return new Map(assignments.filter((a) => !a.deleted_at).map((a) => [a.user_id, a]));
}

/** The page of members the address shows. */
export function memberPage(
  rows: OrgMember[],
  state: MemberState,
  positions: Map<string, OrgPositionAssignment> = new Map()
) {
  const matching = rows.filter(
    (member) =>
      matchesSearch(state.q, memberName(member), member.user_email) &&
      (!state.status.length || (state.status as string[]).includes(member.status)) &&
      (!state.rola.length || member.roles.some((role) => state.rola.includes(role.id))) &&
      (!state.stanowisko.length ||
        state.stanowisko.includes(positions.get(member.user_id)?.position_id ?? ""))
  );
  const sorted = sortRows(
    matching,
    (member) =>
      state.sort === "name"
        ? memberName(member)
        : state.sort === "status"
          ? member.status
          : member.joined_at,
    state.direction,
    (member) => member.user_id
  );
  return pageOf(sorted, state.strona, state.wierszy);
}

export function migrateMemberSearchParams(raw: Record<string, string | string[] | undefined>) {
  return migrateDataViewParams(
    raw,
    { status: { param: "status" } },
    { member: "name", joined: "joined_at" }
  );
}

export function memberColumnSet(labels: Record<string, string>): ColumnSet<string> {
  const ids = ["status", "roles", "position", "joined_at"];
  return {
    ids,
    labels: Object.fromEntries(ids.map((id) => [id, labels[`column_${id}`]])),
    widths: { status: 120, roles: 280, position: 200, joined_at: 130 },
    shownByDefault: ids,
    pinned: { id: "member", label: labels.column_member, width: 300 },
  };
}
