import { describe, expect, it } from "vitest";
import { cn, formatDate } from "../utils";

describe("lib/utils", () => {
  it("merges classes with tailwind precedence", () => {
    expect(cn("px-2", undefined, "px-4", "font-medium")).toBe("px-4 font-medium");
  });

  it("formats date strings with the provided locale", () => {
    const value = "2026-04-01T10:20:00.000Z";
    const expected = new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));

    expect(formatDate(value, "en-US")).toBe(expected);
  });

  it("accepts Date instances", () => {
    const date = new Date("2026-04-01T10:20:00.000Z");

    expect(formatDate(date, "en-US")).toContain("2026");
  });
});
