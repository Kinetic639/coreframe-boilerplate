import { describe, expect, it } from "vitest";
import { toUnsafeI18nHref } from "../unsafe-href";

describe("toUnsafeI18nHref", () => {
  it("returns the original href", () => {
    expect(toUnsafeI18nHref("/dashboard/start")).toBe("/dashboard/start");
  });
});
