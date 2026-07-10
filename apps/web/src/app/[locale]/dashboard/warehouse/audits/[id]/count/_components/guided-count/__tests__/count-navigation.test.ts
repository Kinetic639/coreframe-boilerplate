import { describe, it, expect } from "vitest";
import {
  sortLinesByLocation,
  filterByLocation,
  getNextUnresolvedIndex,
  getPreviousUnresolvedIndex,
  computeProgressStats,
} from "../count-navigation";
import type { EnrichedCountLine } from "../types";

function makeLine(overrides: Partial<EnrichedCountLine> = {}): EnrichedCountLine {
  return {
    id: "line-1",
    count_session_id: "session-1",
    sequence_no: 1,
    variant_id: "variant-1",
    location_id: "loc-1",
    lot_id: null,
    serial_id: null,
    expected_quantity: 10,
    counted_quantity: null,
    variance_quantity: null,
    unit_id: "unit-1",
    status: "pending",
    source: "generated",
    reason_code: null,
    note: null,
    counted_by: null,
    counted_at: null,
    sku: "SKU-1",
    productName: "Widget",
    unitCode: "pcs",
    locationCode: "A-01",
    locationName: "Aisle A, Shelf 1",
    ...overrides,
  };
}

describe("sortLinesByLocation", () => {
  it("sorts by location code, then sequence_no", () => {
    const lines = [
      makeLine({ id: "b", locationCode: "B-01", sequence_no: 1 }),
      makeLine({ id: "a2", locationCode: "A-01", sequence_no: 2 }),
      makeLine({ id: "a1", locationCode: "A-01", sequence_no: 1 }),
    ];
    const sorted = sortLinesByLocation(lines);
    expect(sorted.map((l) => l.id)).toEqual(["a1", "a2", "b"]);
  });
});

describe("filterByLocation", () => {
  it("returns all lines when locationId is null", () => {
    const lines = [makeLine({ id: "a" }), makeLine({ id: "b", location_id: "loc-2" })];
    expect(filterByLocation(lines, null)).toHaveLength(2);
  });

  it("filters to only the matching location", () => {
    const lines = [makeLine({ id: "a" }), makeLine({ id: "b", location_id: "loc-2" })];
    const result = filterByLocation(lines, "loc-2");
    expect(result.map((l) => l.id)).toEqual(["b"]);
  });
});

describe("getNextUnresolvedIndex / getPreviousUnresolvedIndex", () => {
  it("finds the next unresolved line, wrapping around", () => {
    const lines = [
      makeLine({ id: "a", status: "counted", counted_quantity: 10 }),
      makeLine({ id: "b", status: "pending" }),
      makeLine({ id: "c", status: "pending" }),
    ];
    expect(getNextUnresolvedIndex(lines, 0)).toBe(1);
    expect(getNextUnresolvedIndex(lines, 2)).toBe(1); // wraps past resolved index 0
  });

  it("returns -1 when every line is resolved", () => {
    const lines = [
      makeLine({ id: "a", status: "counted", counted_quantity: 10 }),
      makeLine({ id: "b", status: "approved", counted_quantity: 5 }),
    ];
    expect(getNextUnresolvedIndex(lines, 0)).toBe(-1);
  });

  it("skipped and needs_recount lines are still unresolved", () => {
    const lines = [
      makeLine({ id: "a", status: "counted", counted_quantity: 10 }),
      makeLine({ id: "b", status: "skipped" }),
      makeLine({ id: "c", status: "needs_recount" }),
    ];
    expect(getNextUnresolvedIndex(lines, 0)).toBe(1);
    expect(getPreviousUnresolvedIndex(lines, 0)).toBe(2);
  });

  it("returns -1 for an empty list", () => {
    expect(getNextUnresolvedIndex([], 0)).toBe(-1);
    expect(getPreviousUnresolvedIndex([], 0)).toBe(-1);
  });
});

describe("computeProgressStats", () => {
  it("computes counted/total/percent", () => {
    const lines = [
      makeLine({ id: "a", status: "counted", counted_quantity: 10 }),
      makeLine({ id: "b", status: "pending" }),
    ];
    expect(computeProgressStats(lines)).toEqual({ total: 2, counted: 1, percent: 50 });
  });

  it("returns 0 percent for an empty list", () => {
    expect(computeProgressStats([])).toEqual({ total: 0, counted: 0, percent: 0 });
  });
});
