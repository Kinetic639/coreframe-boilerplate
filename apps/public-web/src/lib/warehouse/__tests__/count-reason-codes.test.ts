import { describe, expect, it } from "vitest";
import { COUNT_VARIANCE_REASON_OPTIONS, getReasonOptionsForVariance } from "../count-reason-codes";

describe("COUNT_VARIANCE_REASON_OPTIONS", () => {
  it("has exactly the 5-code taxonomy", () => {
    expect(COUNT_VARIANCE_REASON_OPTIONS.map((o) => o.value).sort()).toEqual(
      ["damaged", "placement_error", "supplier_shortage", "theft", "unexpected_surplus"].sort()
    );
  });
});

describe("getReasonOptionsForVariance", () => {
  it("leads with surplus-typical reasons when variance is positive", () => {
    const options = getReasonOptionsForVariance(5);
    expect(options[0].value).toBe("placement_error");
    expect(options[1].value).toBe("unexpected_surplus");
  });

  it("leads with shortage-typical reasons when variance is negative", () => {
    const options = getReasonOptionsForVariance(-5);
    expect(options[0].value).toBe("damaged");
  });

  it("returns all 4 options in both directions (theft/unidentified always included)", () => {
    expect(getReasonOptionsForVariance(5)).toHaveLength(4);
    expect(getReasonOptionsForVariance(-5)).toHaveLength(4);
  });
});
