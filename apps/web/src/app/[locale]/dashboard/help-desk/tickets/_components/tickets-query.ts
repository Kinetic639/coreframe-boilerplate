import {
  ticketDetailQuery as detailQuery,
  ticketKeys as keys,
  ticketListQuery as listQuery,
  TICKETS_ENTITY,
  type TicketList,
} from "@/lib/help-desk/ticket-queries";
import { ticketListParams, type TicketState } from "./tickets-state";

// The list's queries by its address state (see lib/help-desk/ticket-queries.ts).

export { TICKETS_ENTITY, type TicketList };

export const ticketKeys = {
  list: (orgId: string, state: TicketState) => keys.list(orgId, ticketListParams(state)),
  detail: keys.detail,
};

export const ticketListQuery = (orgId: string, state: TicketState) =>
  listQuery(orgId, ticketListParams(state));

export const ticketDetailQuery = detailQuery;
