/**
 * @vitest-environment node
 * Tests: src/lib/help-desk/ticket-queries.ts
 */
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import {
  cachedTicketNumber,
  patchTicket,
  restoreTickets,
  ticketKeys,
  type TicketList,
} from "../ticket-queries";

const params = (page: number) => ({ search: "", page, pageSize: 20, sort: null, filters: {} });

const row = (id: string, status = "open") =>
  ({ id, ticket_number: `HD-${id}`, status, title: id }) as unknown as TicketList["rows"][number];

function seeded() {
  const queryClient = new QueryClient();
  queryClient.setQueryData(ticketKeys.list("org-1", params(1)), {
    rows: [row("1"), row("2")],
    totalCount: 3,
    page: 1,
    pageSize: 20,
  });
  queryClient.setQueryData(ticketKeys.list("org-1", params(2)), {
    rows: [row("3")],
    totalCount: 3,
    page: 2,
    pageSize: 20,
  });
  queryClient.setQueryData(ticketKeys.detail("org-1", "HD-2"), { ...row("2"), activity: [] });
  queryClient.setQueryData(ticketKeys.list("org-2", params(1)), {
    rows: [row("2")],
    totalCount: 1,
    page: 1,
    pageSize: 20,
  });
  return queryClient;
}

describe("ticket cache", () => {
  it("writes a change into every page and the card of that ticket only, in its organization", () => {
    const queryClient = seeded();
    patchTicket(queryClient, "org-1", "2", { status: "resolved" });

    const page1 = queryClient.getQueryData<TicketList>(ticketKeys.list("org-1", params(1)));
    expect(page1?.rows.map((r) => r.status)).toEqual(["open", "resolved"]);
    expect(
      queryClient.getQueryData<{ status: string }>(ticketKeys.detail("org-1", "HD-2"))?.status
    ).toBe("resolved");
    const other = queryClient.getQueryData<TicketList>(ticketKeys.list("org-2", params(1)));
    expect(other?.rows[0].status).toBe("open");
  });

  it("puts back what a change replaced", () => {
    const queryClient = seeded();
    const snapshot = patchTicket(queryClient, "org-1", "2", { status: "closed" });
    restoreTickets(queryClient, snapshot);
    const page1 = queryClient.getQueryData<TicketList>(ticketKeys.list("org-1", params(1)));
    expect(page1?.rows[1].status).toBe("open");
    expect(
      queryClient.getQueryData<{ status: string }>(ticketKeys.detail("org-1", "HD-2"))?.status
    ).toBe("open");
  });

  it("finds a ticket's number from its card or a list row", () => {
    const queryClient = seeded();
    expect(cachedTicketNumber(queryClient, "org-1", "2")).toBe("HD-2");
    expect(cachedTicketNumber(queryClient, "org-1", "3")).toBe("HD-3");
    expect(cachedTicketNumber(queryClient, "org-1", "9")).toBeNull();
  });
});
