import { describe, expect, it } from "vitest";
import {
  loadRepairOrderState,
  migrateRepairOrderSearchParams,
  repairOrderHref,
  repairOrderListParams,
} from "../repair-orders-state";

const ADVISOR = "11111111-2222-3333-4444-555555555555";

describe("repair order list state", () => {
  it("reads the address, dropping what it cannot use", () => {
    const state = loadRepairOrderState({
      q: "WVW",
      strona: "3",
      wierszy: "20",
      sort: "vin",
      direction: "asc",
      status: "open,bogus",
      magazyn: "3112,bad code!",
      doradca: `brak,${ADVISOR},nope`,
    });
    expect(state).toMatchObject({
      q: "WVW",
      strona: 3,
      wierszy: 20,
      sort: "vin",
      direction: "asc",
      status: ["open"],
      magazyn: ["3112"],
      doradca: ["brak", ADVISOR],
    });
  });

  it("asks the service for the page, the filters and the whole last day", () => {
    const state = loadRepairOrderState({
      q: "  ZL/900 ",
      doradca: `brak,${ADVISOR}`,
      utworzono_od: "2026-11-01",
      utworzono_do: "2026-11-12",
    });
    expect(repairOrderListParams(state)).toEqual({
      search: "ZL/900",
      page: 1,
      pageSize: 50,
      sort: { field: "created_at", direction: "desc" },
      statuses: [],
      warehouseCodes: [],
      advisorIds: [ADVISOR],
      withoutAdvisor: true,
      createdFrom: "2026-11-01T00:00:00.000Z",
      createdTo: "2026-11-12T23:59:59.999Z",
    });
  });

  it("keeps defaults out of the address", () => {
    const state = loadRepairOrderState({});
    expect(repairOrderHref("/dashboard/workshop", state)).toBe("/dashboard/workshop");
    expect(repairOrderHref("/dashboard/workshop", state, { magazyn: ["3112"], strona: 2 })).toBe(
      "/dashboard/workshop?strona=2&magazyn=3112"
    );
  });

  it("turns the old warehouse filter into the new one", () => {
    expect(migrateRepairOrderSearchParams({ q: "x", mag: "3112", noBranch: "1" })).toEqual({
      params: { q: "x", magazyn: "3112" },
      changed: true,
    });
    expect(migrateRepairOrderSearchParams({ q: "x" })).toEqual({
      params: { q: "x" },
      changed: false,
    });
  });
});
