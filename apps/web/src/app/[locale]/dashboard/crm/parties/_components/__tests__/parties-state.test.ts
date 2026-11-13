import { describe, expect, it } from "vitest";
import {
  loadPartyState,
  migratePartySearchParams,
  partyHref,
  partyListParams,
} from "../parties-state";

const ID = "33333333-3333-4333-8333-333333333333";

describe("counterparty list address", () => {
  it("reads the defaults, and drops what it cannot read", () => {
    const state = loadPartyState({ rola: "client,bogus", status: "nope", selected: "x" });
    expect(state).toMatchObject({
      q: "",
      strona: 1,
      wierszy: 50,
      sort: "counterparty_number",
      direction: "desc",
      selected: null,
      status: [],
    });
    expect(state.rola).toEqual(["client"]);
  });

  it("asks the service for the roles and statuses chosen", () => {
    const state = loadPartyState({ q: "  ambra ", rola: "client,supplier", status: "active" });
    expect(partyListParams(state)).toEqual({
      search: "ambra",
      page: 1,
      pageSize: 50,
      sort: { field: "counterparty_number", direction: "desc" },
      filters: { role: ["client", "supplier"], status: ["active"] },
    });
    expect(partyListParams(loadPartyState({})).filters).toEqual({ role: null, status: null });
  });

  it("writes only what differs from the defaults", () => {
    const state = loadPartyState({});
    expect(partyHref("/pl/dashboard/crm/parties", state, { selected: ID })).toBe(
      `/pl/dashboard/crm/parties?selected=${ID}`
    );
  });

  it("translates old DataView links", () => {
    const { params, changed } = migratePartySearchParams({
      search: "a",
      page: "2",
      sort: "display_name.asc",
      filters: JSON.stringify({ role: "supplier", status: "active" }),
      selected: ID,
    });
    expect(changed).toBe(true);
    expect(loadPartyState(params)).toMatchObject({
      q: "a",
      strona: 2,
      sort: "display_name",
      direction: "asc",
      rola: ["supplier"],
      status: ["active"],
      selected: ID,
    });
    expect(migratePartySearchParams({ q: "a" }).changed).toBe(false);
  });
});
