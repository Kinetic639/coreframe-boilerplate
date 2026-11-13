import { dataViewKeys } from "@/components/data-view/data-view-query-keys";
import { dataViewScope } from "@/lib/data-view/ambra-data-view-scope";
import type { PaginatedResult } from "@/lib/data-view/types";
import { getTicketDetailAction, listTicketsForDataViewAction } from "@/app/actions/help-desk";
import type {
  HelpdeskTicketDetail,
  HelpdeskTicketListRow,
} from "@/server/services/helpdesk-tickets.service";
import { ticketListParams, type TicketState } from "./tickets-state";

// The tickets list's cache keeps the keys the help desk already invalidates
// (realtime, the ticket mutations): one entry per page the address asks for
// and one per ticket card, per organization.

export const TICKETS_ENTITY = "helpdesk-tickets";
export type TicketList = PaginatedResult<HelpdeskTicketListRow>;

/** A list page stays fresh this long: going back and forth costs nothing. */
const LIST_STALE_TIME = 30 * 1000;
const DETAIL_STALE_TIME = 60 * 1000;

export const ticketKeys = {
  list: (orgId: string, state: TicketState) =>
    dataViewKeys.list(TICKETS_ENTITY, dataViewScope.organization(orgId), ticketListParams(state)),
  detail: (orgId: string, ticketNumber: string) =>
    dataViewKeys.detail(TICKETS_ENTITY, dataViewScope.organization(orgId), ticketNumber),
};

export const ticketListQuery = (orgId: string, state: TicketState) => ({
  queryKey: ticketKeys.list(orgId, state),
  queryFn: async (): Promise<TicketList> => {
    const result = await listTicketsForDataViewAction(ticketListParams(state), orgId);
    if (!result.success) throw new Error((result as { error: string }).error);
    return result.data;
  },
  staleTime: LIST_STALE_TIME,
});

export const ticketDetailQuery = (orgId: string, ticketNumber: string) => ({
  queryKey: ticketKeys.detail(orgId, ticketNumber),
  queryFn: async (): Promise<HelpdeskTicketDetail> => {
    const result = await getTicketDetailAction(ticketNumber, orgId);
    if (!result.success) throw new Error((result as { error: string }).error);
    if (!result.data) throw new Error("Ticket not found");
    return result.data;
  },
  staleTime: DETAIL_STALE_TIME,
});
