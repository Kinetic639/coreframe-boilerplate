import { describe, expect, it } from "vitest";
import { calculateSuggestedOrderQuantity, isBelowReorderPoint } from "../reorder-math";

describe("isBelowReorderPoint", () => {
  it("is true when on-hand is strictly below the reorder point", () => {
    expect(isBelowReorderPoint({ reorder_point: 10 }, 5)).toBe(true);
  });
  it("is false when on-hand equals the reorder point", () => {
    expect(isBelowReorderPoint({ reorder_point: 10 }, 10)).toBe(false);
  });
  it("is false when on-hand is above the reorder point", () => {
    expect(isBelowReorderPoint({ reorder_point: 10 }, 15)).toBe(false);
  });
});

describe("calculateSuggestedOrderQuantity", () => {
  it("returns 0 when on-hand is at or above the reorder point (not a suggestion)", () => {
    expect(calculateSuggestedOrderQuantity({ reorder_point: 10, reorder_quantity: 5 }, 10)).toBe(0);
    expect(calculateSuggestedOrderQuantity({ reorder_point: 10, reorder_quantity: 5 }, 20)).toBe(0);
  });

  it("uses reorder_quantity directly when set and below the reorder point", () => {
    expect(calculateSuggestedOrderQuantity({ reorder_point: 10, reorder_quantity: 25 }, 3)).toBe(
      25
    );
  });

  it("falls back to topping up to the reorder point when reorder_quantity is null", () => {
    expect(calculateSuggestedOrderQuantity({ reorder_point: 10, reorder_quantity: null }, 3)).toBe(
      7
    );
  });

  it("falls back to topping up to the reorder point when reorder_quantity is 0", () => {
    expect(calculateSuggestedOrderQuantity({ reorder_point: 10, reorder_quantity: 0 }, 3)).toBe(7);
  });

  it("never returns a negative suggested quantity in the fallback path", () => {
    // on_hand somehow exactly at reorder_point - 0 edge, still non-negative
    expect(calculateSuggestedOrderQuantity({ reorder_point: 10, reorder_quantity: null }, 9)).toBe(
      1
    );
  });
});
