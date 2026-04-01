import { describe, expect, it } from "vitest";

import { toUnsafeI18nHref } from "../unsafe-href";

describe("toUnsafeI18nHref", () => {
  it("returns the same href string", () => {
    expect(toUnsafeI18nHref("/dashboard/tools")).toBe("/dashboard/tools");
  });
});
