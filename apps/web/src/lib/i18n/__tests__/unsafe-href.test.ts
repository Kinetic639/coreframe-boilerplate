import { describe, it, expect } from "vitest";

import { toUnsafeI18nHref } from "../unsafe-href";

describe("toUnsafeI18nHref", () => {
  it("returns the original href value", () => {
    expect(toUnsafeI18nHref("/dashboard/tools")).toBe("/dashboard/tools");
  });
});
