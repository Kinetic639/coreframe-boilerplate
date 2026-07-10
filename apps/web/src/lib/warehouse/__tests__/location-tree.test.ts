import { describe, it, expect } from "vitest";
import { flattenLocationTreeDepthFirst } from "../location-tree";

interface Loc {
  id: string;
  parent_id: string | null;
}

describe("flattenLocationTreeDepthFirst", () => {
  it("orders each parent immediately followed by its own children, not breadth-first", () => {
    // Simulates the DB's breadth-first query order (level ASC, sort_order
    // ASC): all level-0 rows first, then every level-1 row across every
    // parent mixed together.
    const locations: Loc[] = [
      { id: "a", parent_id: null },
      { id: "b", parent_id: null },
      { id: "a1", parent_id: "a" },
      { id: "a2", parent_id: "a" },
      { id: "b1", parent_id: "b" },
    ];

    expect(flattenLocationTreeDepthFirst(locations).map((l) => l.id)).toEqual([
      "a",
      "a1",
      "a2",
      "b",
      "b1",
    ]);
  });

  it("recurses through multiple levels depth-first", () => {
    const locations: Loc[] = [
      { id: "a", parent_id: null },
      { id: "b", parent_id: null },
      { id: "a1", parent_id: "a" },
      { id: "b1", parent_id: "b" },
      { id: "a1x", parent_id: "a1" },
    ];

    expect(flattenLocationTreeDepthFirst(locations).map((l) => l.id)).toEqual([
      "a",
      "a1",
      "a1x",
      "b",
      "b1",
    ]);
  });

  it("promotes orphaned nodes (parent_id set but parent absent from the list) to roots", () => {
    const locations: Loc[] = [
      { id: "a", parent_id: null },
      { id: "orphan", parent_id: "missing-parent" },
    ];

    expect(flattenLocationTreeDepthFirst(locations).map((l) => l.id)).toEqual(["a", "orphan"]);
  });

  it("preserves relative sibling order from the input", () => {
    const locations: Loc[] = [
      { id: "z", parent_id: null },
      { id: "a", parent_id: null },
      { id: "z1", parent_id: "z" },
      { id: "a1", parent_id: "a" },
    ];

    expect(flattenLocationTreeDepthFirst(locations).map((l) => l.id)).toEqual([
      "z",
      "z1",
      "a",
      "a1",
    ]);
  });
});
