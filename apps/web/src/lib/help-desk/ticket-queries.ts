import type { QueryClient } from "@tanstack/react-query";
import { dataViewKeys } from "@/lib/data-view/query-keys";
import { dataViewScope } from "@/lib/data-view/ambra-data-view-scope";
import type { DataViewListParams, PaginatedResult } from "@/lib/data-view/types";
import { helpdeskRead } from "@/lib/help-desk/read";
import type {
  HelpdeskTicketDetail,
  HelpdeskTicketListRow,
} from "@/server/services/helpdesk-tickets.service";

// The tickets' cache, in one place for the list, the side panel, the ticket
// page and the realtime hook: one entry per list page the address asks for
// and one per ticket card, per organization. Reads go over GET
// (/api/help-desk/read), so they never wait behind a save.

export const TICKETS_ENTITY = "helpdesk-tickets";
export type TicketList = PaginatedResult<HelpdeskTicketListRow>;

/** A list page stays fresh this long: going back and forth costs nothing. */
const LIST_STALE_TIME = 30 * 1000;
const DETAIL_STALE_TIME = 60 * 1000;

const scope = (orgId: string) => dataViewScope.organization(orgId);

export const ticketKeys = {
  all: (orgId: string) => dataViewKeys.scope(TICKETS_ENTITY, scope(orgId)),
  lists: (orgId: string) => dataViewKeys.lists(TICKETS_ENTITY, scope(orgId)),
  list: (orgId: string, params: DataViewListParams) =>
    dataViewKeys.list(TICKETS_ENTITY, scope(orgId), params),
  details: (orgId: string) => dataViewKeys.details(TICKETS_ENTITY, scope(orgId)),
  detail: (orgId: string, ticketNumber: string) =>
    dataViewKeys.detail(TICKETS_ENTITY, scope(orgId), ticketNumber),
};

export const ticketListQuery = (orgId: string, params: DataViewListParams) => ({
  queryKey: ticketKeys.list(orgId, params),
  queryFn: async (): Promise<TicketList> => {
    const result = await helpdeskRead("ticketsDataView", params, orgId);
    if (!result.success) throw new Error((result as { error: string }).error);
    return result.data;
  },
  staleTime: LIST_STALE_TIME,
  // Coming back to the tab refetches the page when it is older than the stale
  // time, so changes missed while away (a dropped realtime connection) show
  // without a reload. The global default is off; a background tab makes no
  // requests.
  refetchOnWindowFocus: true,
});

export const ticketDetailQuery = (orgId: string, ticketNumber: string) => ({
  queryKey: ticketKeys.detail(orgId, ticketNumber),
  queryFn: async (): Promise<HelpdeskTicketDetail> => {
    const result = await helpdeskRead("ticketDetail", ticketNumber, orgId);
    if (!result.success) throw new Error((result as { error: string }).error);
    if (!result.data) throw new Error("Ticket not found");
    return result.data;
  },
  staleTime: DETAIL_STALE_TIME,
});

// ---------------------------------------------------------------------------
// Writing into the cache (saves, optimistic changes, realtime)
// ---------------------------------------------------------------------------

/** The fields of a ticket the list shows, as a save or realtime brings them. */
export type TicketPatch = Partial<Omit<HelpdeskTicketListRow, "id" | "org_id">> & {
  /** Card-only fields (lists ignore them). */
  description_plain?: string | null;
  description_rich?: unknown;
};

/** What a patch replaced, to put back if the save fails. */
export type TicketSnapshot = Array<[readonly unknown[], unknown]>;

/**
 * Writes changed fields of a ticket (found by id) into every cached list page
 * and its card, without fetching. Returns what was there before.
 */
export function patchTicket(
  queryClient: QueryClient,
  orgId: string,
  ticketId: string,
  patch: TicketPatch
): TicketSnapshot {
  const snapshot: TicketSnapshot = [];
  for (const [key, list] of queryClient.getQueriesData<TicketList>({
    queryKey: ticketKeys.lists(orgId),
  })) {
    if (!list?.rows?.some((row) => row.id === ticketId)) continue;
    snapshot.push([key, list]);
    queryClient.setQueryData<TicketList>(key, {
      ...list,
      rows: list.rows.map((row) => (row.id === ticketId ? { ...row, ...patch } : row)),
    });
  }
  for (const [key, detail] of queryClient.getQueriesData<HelpdeskTicketDetail>({
    queryKey: ticketKeys.details(orgId),
  })) {
    if (detail?.id !== ticketId) continue;
    snapshot.push([key, detail]);
    queryClient.setQueryData<HelpdeskTicketDetail>(key, { ...detail, ...patch });
  }
  return snapshot;
}

/** Puts back what patchTicket replaced. */
export function restoreTickets(queryClient: QueryClient, snapshot: TicketSnapshot) {
  for (const [key, value] of snapshot) queryClient.setQueryData(key, value);
}

/** The ticket's number when its card or a list row is in the cache. */
export function cachedTicketNumber(
  queryClient: QueryClient,
  orgId: string,
  ticketId: string
): string | null {
  for (const [, detail] of queryClient.getQueriesData<HelpdeskTicketDetail>({
    queryKey: ticketKeys.details(orgId),
  })) {
    if (detail?.id === ticketId) return detail.ticket_number;
  }
  for (const [, list] of queryClient.getQueriesData<TicketList>({
    queryKey: ticketKeys.lists(orgId),
  })) {
    const row = list?.rows?.find((r) => r.id === ticketId);
    if (row) return row.ticket_number;
  }
  return null;
}

/**
 * Marks a ticket's card stale (fetched again when shown; an open card at
 * once) and, with `lists`, every list page. Pages not on screen are only
 * marked: nothing is fetched for them until they are opened.
 */
export function refreshTicket(
  queryClient: QueryClient,
  orgId: string,
  ticketNumber: string | null,
  { lists = true }: { lists?: boolean } = {}
) {
  const jobs: Promise<unknown>[] = [];
  if (lists) jobs.push(queryClient.invalidateQueries({ queryKey: ticketKeys.lists(orgId) }));
  jobs.push(
    queryClient.invalidateQueries({
      queryKey: ticketNumber ? ticketKeys.detail(orgId, ticketNumber) : ticketKeys.details(orgId),
    })
  );
  return Promise.all(jobs);
}
