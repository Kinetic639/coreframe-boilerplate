import { describe, expect, it } from "vitest";
import { groupCountLines, type GroupableCountLine } from "../count-line-grouping";

function line(overrides: Partial<GroupableCountLine> & { id: string }): GroupableCountLine {
  return {
    status: "pending",
    variance_quantity: null,
    source: "generated",
    ...overrides,
  };
}

describe("groupCountLines", () => {
  it("buckets pending lines separately", () => {
    const groups = groupCountLines([line({ id: "1", status: "pending" })]);
    expect(groups.pending).toHaveLength(1);
    expect(groups.shortages).toHaveLength(0);
  });

  it("buckets skipped lines separately, regardless of any stale variance value", () => {
    const groups = groupCountLines([line({ id: "1", status: "skipped", variance_quantity: -5 })]);
    expect(groups.skipped).toHaveLength(1);
    expect(groups.shortages).toHaveLength(0);
  });

  it("buckets needs_recount lines separately", () => {
    const groups = groupCountLines([line({ id: "1", status: "needs_recount" })]);
    expect(groups.needsRecount).toHaveLength(1);
  });

  it("zero-variance counted lines go to matches, not shortages/surpluses", () => {
    const groups = groupCountLines([line({ id: "1", status: "counted", variance_quantity: 0 })]);
    expect(groups.matches).toHaveLength(1);
    expect(groups.shortages).toHaveLength(0);
    expect(groups.surpluses).toHaveLength(0);
  });

  it("zero-variance approved lines also go to matches", () => {
    const groups = groupCountLines([line({ id: "1", status: "approved", variance_quantity: 0 })]);
    expect(groups.matches).toHaveLength(1);
  });

  it("negative-variance lines (counted or approved) go to shortages", () => {
    const groups = groupCountLines([
      line({ id: "1", status: "counted", variance_quantity: -3 }),
      line({ id: "2", status: "approved", variance_quantity: -1 }),
    ]);
    expect(groups.shortages).toHaveLength(2);
    expect(groups.surpluses).toHaveLength(0);
  });

  it("positive-variance lines (counted or approved) go to surpluses", () => {
    const groups = groupCountLines([
      line({ id: "1", status: "counted", variance_quantity: 4 }),
      line({ id: "2", status: "approved", variance_quantity: 2 }),
    ]);
    expect(groups.surpluses).toHaveLength(2);
    expect(groups.shortages).toHaveLength(0);
  });

  it("an unexpected-found line with a positive counted quantity is grouped as a surplus", () => {
    const groups = groupCountLines([
      line({ id: "1", status: "counted", variance_quantity: 6, source: "unexpected_found" }),
    ]);
    expect(groups.surpluses).toHaveLength(1);
    expect(groups.surpluses[0].source).toBe("unexpected_found");
  });

  it("groups a realistic mixed batch correctly", () => {
    const groups = groupCountLines([
      line({ id: "1", status: "pending" }),
      line({ id: "2", status: "skipped" }),
      line({ id: "3", status: "needs_recount" }),
      line({ id: "4", status: "counted", variance_quantity: 0 }),
      line({ id: "5", status: "counted", variance_quantity: -2 }),
      line({ id: "6", status: "approved", variance_quantity: 3 }),
    ]);
    expect(groups.pending.map((l) => l.id)).toEqual(["1"]);
    expect(groups.skipped.map((l) => l.id)).toEqual(["2"]);
    expect(groups.needsRecount.map((l) => l.id)).toEqual(["3"]);
    expect(groups.matches.map((l) => l.id)).toEqual(["4"]);
    expect(groups.shortages.map((l) => l.id)).toEqual(["5"]);
    expect(groups.surpluses.map((l) => l.id)).toEqual(["6"]);
  });
});
