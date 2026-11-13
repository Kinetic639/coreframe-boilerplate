import { describe, expect, it } from "vitest";
import {
  activeTicketQueue,
  loadTicketState,
  migrateTicketSearchParams,
  serializeTicketState,
  ticketHref,
  ticketListParams,
  ticketQueueFilters,
} from "../tickets-state";

const BRANCH = "11111111-1111-4111-8111-111111111111";
const USER = "22222222-2222-4222-8222-222222222222";
const who = { userId: USER, branchId: BRANCH };

describe("tickets list address", () => {
  it("reads the defaults: newest first, 50 rows, page 1, no filters", () => {
    expect(ticketListParams(loadTicketState({}))).toEqual({
      search: "",
      page: 1,
      pageSize: 50,
      sort: { field: "created_at", direction: "desc" },
      filters: {
        status: null,
        priority: null,
        ticketTypeId: null,
        branchId: null,
        createdBy: null,
        assignedTo: null,
        unassigned: null,
        createdAtFrom: null,
        createdAtTo: null,
      },
    });
  });

  it("maps its params to the service's filters and drops what it cannot read", () => {
    const state = loadTicketState({
      status: "open,nonsense,waiting",
      priorytet: "urgent",
      oddzial: `${BRANCH},not-a-uuid`,
      przypisanie: "brak",
      utworzono_od: "2026-11-01",
      utworzono_do: "2026-11-12",
    });
    const { filters } = ticketListParams(state);
    expect(filters.status).toEqual(["open", "waiting"]);
    expect(filters.priority).toEqual(["urgent"]);
    expect(filters.branchId).toEqual([BRANCH]);
    expect(filters.unassigned).toBe(true);
    expect(filters.createdAtFrom).toBe("2026-11-01T00:00:00.000Z");
    // The whole last day counts.
    expect(filters.createdAtTo).toBe("2026-11-12T23:59:59.999Z");
  });

  it("keeps the open ticket out of the list request", () => {
    const state = loadTicketState({ selected: "HD-0042", strona: "2" });
    expect(state.selected).toBe("HD-0042");
    expect(ticketListParams(state).page).toBe(2);
    expect(ticketHref("/zgloszenia", state, { selected: null, strona: 1 })).toBe("/zgloszenia");
  });

  it("translates an old DataView link once", () => {
    const { params, changed } = migrateTicketSearchParams({
      search: "drukarka",
      page: "3",
      sort: "updated_at.desc",
      filters: JSON.stringify({
        branchId: BRANCH,
        status: ["open", "in_progress"],
        priority: ["high", "urgent"],
        unassigned: true,
        createdAtFrom: "2026-10-01",
      }),
      selected: "HD-0007",
    });
    expect(changed).toBe(true);
    const state = loadTicketState(params);
    expect(state).toMatchObject({
      q: "drukarka",
      strona: 3,
      sort: "updated_at",
      direction: "desc",
      oddzial: [BRANCH],
      status: ["open", "in_progress"],
      priorytet: ["high", "urgent"],
      przypisanie: ["brak"],
      utworzono_od: "2026-10-01",
      selected: "HD-0007",
    });
    expect(migrateTicketSearchParams(params).changed).toBe(false);
  });

  it("recognizes a queue by its filters, whatever the search and sort", () => {
    for (const queue of [
      "unassigned",
      "mine",
      "waitingRequester",
      "waitingVendor",
      "all",
    ] as const) {
      const address = serializeTicketState({ ...ticketQueueFilters(queue, who), q: "x" });
      expect(activeTicketQueue(loadTicketState(new URLSearchParams(address)), who)).toBe(queue);
    }
    const handFiltered = loadTicketState({ status: "open" });
    expect(activeTicketQueue(handFiltered, who)).toBeNull();
  });
});
