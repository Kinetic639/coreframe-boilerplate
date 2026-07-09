import { describe, expect, it } from "vitest";
import { expandLocationIds } from "../count-session-scope";

type Loc = { id: string; parent_id: string | null };

const LOCATIONS: Loc[] = [
  { id: "warehouse-a", parent_id: null },
  { id: "rack-a1", parent_id: "warehouse-a" },
  { id: "shelf-a1-1", parent_id: "rack-a1" },
  { id: "bin-a1-1-1", parent_id: "shelf-a1-1" },
  { id: "bin-a1-1-2", parent_id: "shelf-a1-1" },
  { id: "rack-a2", parent_id: "warehouse-a" },
  { id: "warehouse-b", parent_id: null },
  { id: "rack-b1", parent_id: "warehouse-b" },
];

describe("expandLocationIds", () => {
  it("returns exactly the selected ids when includeChildren is false", () => {
    const result = expandLocationIds(LOCATIONS, ["warehouse-a"], false);
    expect(result.sort()).toEqual(["warehouse-a"]);
  });

  it("expands a single location with nested children (multi-level)", () => {
    const result = expandLocationIds(LOCATIONS, ["warehouse-a"], true);
    expect(result.sort()).toEqual(
      ["warehouse-a", "rack-a1", "shelf-a1-1", "bin-a1-1-1", "bin-a1-1-2", "rack-a2"].sort()
    );
  });

  it("expands a mid-tree selection to only its own descendants", () => {
    const result = expandLocationIds(LOCATIONS, ["rack-a1"], true);
    expect(result.sort()).toEqual(["rack-a1", "shelf-a1-1", "bin-a1-1-1", "bin-a1-1-2"].sort());
  });

  it("leaf locations with no children expand to just themselves", () => {
    const result = expandLocationIds(LOCATIONS, ["bin-a1-1-1"], true);
    expect(result).toEqual(["bin-a1-1-1"]);
  });

  it("dedupes when an overlapping parent+child selection is made", () => {
    const result = expandLocationIds(LOCATIONS, ["warehouse-a", "rack-a1"], true);
    const sorted = result.sort();
    expect(sorted).toEqual(
      ["warehouse-a", "rack-a1", "shelf-a1-1", "bin-a1-1-1", "bin-a1-1-2", "rack-a2"].sort()
    );
    // No duplicate entries.
    expect(new Set(result).size).toBe(result.length);
  });

  it("handles multiple disjoint selections independently", () => {
    const result = expandLocationIds(LOCATIONS, ["rack-a2", "warehouse-b"], true);
    expect(result.sort()).toEqual(["rack-a2", "warehouse-b", "rack-b1"].sort());
  });

  it("returns an empty array when nothing is selected", () => {
    expect(expandLocationIds(LOCATIONS, [], true)).toEqual([]);
    expect(expandLocationIds(LOCATIONS, [], false)).toEqual([]);
  });

  it("does not mutate the input locations array", () => {
    const before = JSON.stringify(LOCATIONS);
    expandLocationIds(LOCATIONS, ["warehouse-a"], true);
    expect(JSON.stringify(LOCATIONS)).toBe(before);
  });
});
