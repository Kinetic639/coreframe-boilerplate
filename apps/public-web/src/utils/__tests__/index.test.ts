import { describe, expect, it } from "vitest";

import { cn } from "../index";

describe("utils/index", () => {
  it("re-exports cn", () => {
    expect(cn("a", undefined, "b")).toContain("a");
    expect(cn("a", undefined, "b")).toContain("b");
  });
});
