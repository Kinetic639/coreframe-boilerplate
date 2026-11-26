import { describe, expect, it } from "vitest";
import { formatGreetingDate, isEvening } from "../_components/greeting-time";

describe("greeting time (Europe/Warsaw)", () => {
  it.each([
    ["2026-11-26T03:59:00Z", true], // 04:59 in Warsaw
    ["2026-11-26T04:00:00Z", false], // 05:00
    ["2026-11-26T16:59:00Z", false], // 17:59
    ["2026-11-26T17:00:00Z", true], // 18:00
    ["2026-07-01T16:00:00Z", true], // 18:00 in summer time
  ])("isEvening(%s) is %s", (iso, expected) => {
    expect(isEvening(new Date(iso))).toBe(expected);
  });

  it("formats the date with a capital first letter", () => {
    const date = new Date("2026-11-26T12:00:00Z");
    expect(formatGreetingDate(date, "pl")).toBe("Czwartek, 26 listopada");
    expect(formatGreetingDate(date, "en")).toBe("Thursday 26 November");
  });
});
