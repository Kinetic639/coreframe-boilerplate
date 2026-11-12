import { describe, expect, it } from "vitest";
import { productColumnFilters } from "../inventory-products.service";

describe("productColumnFilters", () => {
  it("builds the database's ranges, name and change days", () => {
    const columns = productColumnFilters({
      name: " szyba ",
      on_hand_min: "1",
      on_hand_max: "10",
      blocked_min: "0.5",
      available_max: "abc",
      updated_from: "2026-11-01",
      updated_to: "2026-11-10",
    });
    expect(columns.name).toBe("szyba");
    expect(columns.ranges).toEqual({ on_hand: { min: 1, max: 10 }, blocked: { min: 0.5 } });
    expect(columns.updatedFrom).toBe("2026-11-01T00:00:00Z");
    // The last day counts whole: up to the next midnight.
    expect(columns.updatedTo).toBe("2026-11-11T00:00:00.000Z");
  });
  it("says nothing when nothing is set", () => {
    expect(productColumnFilters({})).toEqual({
      name: null,
      updatedFrom: null,
      updatedTo: null,
      ranges: null,
    });
  });
});
