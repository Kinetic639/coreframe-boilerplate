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
import type { OrgInvitation } from "@/server/services/organization.service";

// The invitations list's whole state is its address: the search, the status
// filter, the sort, the page and the invitation open in the side panel.

export const INVITATION_PAGE_SIZES = [20, 50, 100] as const;
export const INVITATION_SORTS = ["email", "status", "created_at", "expires_at"] as const;
export const INVITATION_STATUSES = [
  "pending",
  "accepted",
  "declined",
  "cancelled",
  "expired",
] as const;

export const invitationParsers = {
  q: parseAsString.withDefault(""),
  strona: parseAsInteger.withDefault(1),
  wierszy: parseAsNumberLiteral(INVITATION_PAGE_SIZES).withDefault(50),
  sort: parseAsStringLiteral(INVITATION_SORTS).withDefault("created_at"),
  direction: parseAsStringLiteral(["asc", "desc"] as const).withDefault("desc"),
  selected: parseAsUuid,
  status: parseAsArrayOf(parseAsStringLiteral(INVITATION_STATUSES)).withDefault([]),
};

export type InvitationState = inferParserType<typeof invitationParsers>;
export const loadInvitationState = createLoader(invitationParsers);
export const serializeInvitationState = createSerializer(invitationParsers);

export function invitationHref(
  path: string,
  state: InvitationState,
  patch: Partial<InvitationState> = {}
) {
  return serializeInvitationState(path, { ...state, ...patch });
}

/** The person invited, as a name when one was given. */
export function invitedName(invitation: OrgInvitation) {
  return [invitation.invited_first_name, invitation.invited_last_name].filter(Boolean).join(" ");
}

/** The page of invitations the address shows (deleted ones never). */
export function invitationPage(rows: OrgInvitation[], state: InvitationState) {
  const matching = rows.filter(
    (invitation) =>
      !invitation.deleted_at &&
      matchesSearch(state.q, invitation.email, invitedName(invitation), invitation.role_summary) &&
      (!state.status.length || (state.status as string[]).includes(invitation.status))
  );
  const sorted = sortRows(
    matching,
    (invitation) => invitation[state.sort],
    state.direction,
    (invitation) => invitation.id
  );
  return pageOf(sorted, state.strona, state.wierszy);
}

export function migrateInvitationSearchParams(raw: Record<string, string | string[] | undefined>) {
  return migrateDataViewParams(raw, { status: { param: "status" } });
}

export function invitationColumnSet(labels: Record<string, string>): ColumnSet<string> {
  const ids = ["status", "roles", "created_at", "expires_at"];
  return {
    ids,
    labels: Object.fromEntries(ids.map((id) => [id, labels[`column_${id}`]])),
    widths: { status: 140, roles: 280, created_at: 130, expires_at: 130 },
    shownByDefault: ids,
    pinned: { id: "invitation", label: labels.column_invitation, width: 300 },
  };
}
