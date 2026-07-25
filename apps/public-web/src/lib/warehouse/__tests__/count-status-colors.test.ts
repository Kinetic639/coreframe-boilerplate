import { describe, expect, it } from "vitest";
import { getCountLinePositionStatus } from "../count-status-colors";

describe("getCountLinePositionStatus", () => {
  it("returns not_started for a pending line", () => {
    expect(getCountLinePositionStatus({ status: "pending", variance_quantity: null }, true)).toBe(
      "not_started"
    );
  });

  it("returns skipped for a skipped line regardless of variance", () => {
    expect(getCountLinePositionStatus({ status: "skipped", variance_quantity: -5 }, true)).toBe(
      "skipped"
    );
  });

  it("returns needs_recount for a needs_recount line", () => {
    expect(
      getCountLinePositionStatus({ status: "needs_recount", variance_quantity: null }, true)
    ).toBe("needs_recount");
  });

  it("returns counted_ok for a zero-variance counted line", () => {
    expect(getCountLinePositionStatus({ status: "counted", variance_quantity: 0 }, true)).toBe(
      "counted_ok"
    );
  });

  it("returns shortage for a negative-variance counted or approved line", () => {
    expect(getCountLinePositionStatus({ status: "counted", variance_quantity: -3 }, true)).toBe(
      "shortage"
    );
    expect(getCountLinePositionStatus({ status: "approved", variance_quantity: -1 }, true)).toBe(
      "shortage"
    );
  });

  it("returns surplus for a positive-variance counted or approved line", () => {
    expect(getCountLinePositionStatus({ status: "counted", variance_quantity: 4 }, true)).toBe(
      "surplus"
    );
    expect(getCountLinePositionStatus({ status: "approved", variance_quantity: 2 }, true)).toBe(
      "surplus"
    );
  });

  it("in blind mode (showExpectedQuantity=false), any counted line is counted_ok regardless of variance", () => {
    expect(getCountLinePositionStatus({ status: "counted", variance_quantity: -3 }, false)).toBe(
      "counted_ok"
    );
    expect(getCountLinePositionStatus({ status: "counted", variance_quantity: 5 }, false)).toBe(
      "counted_ok"
    );
  });
});
