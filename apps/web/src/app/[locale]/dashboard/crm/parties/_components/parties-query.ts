import type { PaginatedResult } from "@/lib/data-view/types";
import { getCrmPartyDetailAction, listCrmPartiesForDataViewAction } from "@/app/actions/crm";
import type { CrmPartyDetail, CrmPartyListRow } from "@/server/services/crm-parties.service";
import { partyListParams, type PartyState } from "./parties-state";

// The counterparty list's cache: one entry per page the address asks for and
// one per counterparty card, per organization. Everything that changes a
// counterparty drops the "crm-parties" entries.

export type PartyList = PaginatedResult<CrmPartyListRow>;

/** A list page stays fresh this long: going back and forth costs nothing. */
const LIST_STALE_TIME = 30 * 1000;
const DETAIL_STALE_TIME = 60 * 1000;

export const partyKeys = {
  all: (orgId: string) => ["crm-parties", orgId] as const,
  list: (orgId: string, state: PartyState) =>
    ["crm-parties", orgId, "list", partyListParams(state)] as const,
  detail: (orgId: string, id: string) => ["crm-parties", orgId, "detail", id] as const,
};

export const partyListQuery = (orgId: string, state: PartyState) => ({
  queryKey: partyKeys.list(orgId, state),
  queryFn: async (): Promise<PartyList> => {
    const result = await listCrmPartiesForDataViewAction(partyListParams(state), orgId);
    if (!result.success) throw new Error((result as { error: string }).error);
    return result.data;
  },
  staleTime: LIST_STALE_TIME,
});

export const partyDetailQuery = (orgId: string, id: string) => ({
  queryKey: partyKeys.detail(orgId, id),
  queryFn: async (): Promise<CrmPartyDetail> => {
    const result = await getCrmPartyDetailAction(id, orgId);
    if (!result.success) throw new Error((result as { error: string }).error);
    return result.data;
  },
  staleTime: DETAIL_STALE_TIME,
});
