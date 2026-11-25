import {
  canManageTicketBranchAction,
  getTicketDetailAction,
  getTicketTypeDefaultAcceptorsAction,
  getTicketTypeDefaultRespondersAction,
  listOrgMembersForTicketAssignmentAction,
  listTicketTypesAction,
  listTicketsForDataViewAction,
} from "@/app/actions/help-desk";
import { getQrAssignmentForTicketAction } from "@/app/actions/qr/assign";

/**
 * Help desk reads served over GET (/api/help-desk/read/<name>), like the
 * planning reads.
 *
 * Next.js runs Server Actions one at a time per page, so a read sent as an
 * action waits behind every save and every other read: the next page, a
 * ticket opened from the list and the hover prefetch queued up. A GET runs
 * at once, next to the others. Each entry is the existing action: sign-in,
 * permission and input checks stay exactly where they are. Only reads
 * belong here.
 */
export const helpdeskReads = {
  ticketsDataView: listTicketsForDataViewAction,
  ticketDetail: getTicketDetailAction,
  ticketQrAssignment: getQrAssignmentForTicketAction,
  canManageTicketBranch: canManageTicketBranchAction,
  ticketTypes: listTicketTypesAction,
  ticketTypeDefaultResponders: getTicketTypeDefaultRespondersAction,
  ticketTypeDefaultAcceptors: getTicketTypeDefaultAcceptorsAction,
  membersForAssignment: listOrgMembersForTicketAssignmentAction,
} as const;

export type HelpdeskReads = typeof helpdeskReads;
export type HelpdeskReadName = keyof HelpdeskReads;
