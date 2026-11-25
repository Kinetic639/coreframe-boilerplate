import { describe, expect, it } from "vitest";
import {
  DEFAULT_TIME_ZONE,
  effectiveTimeZone,
  isValidTimeZone,
  resolveTimeZone,
} from "../time-zone";

describe("time-zone", () => {
  it("defaults to Europe/Warsaw", () => {
    expect(DEFAULT_TIME_ZONE).toBe("Europe/Warsaw");
  });

  it("validates IANA zones", () => {
    expect(isValidTimeZone("Europe/Warsaw")).toBe(true);
    expect(isValidTimeZone("UTC")).toBe(true);
    expect(isValidTimeZone("Not/AZone")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
    expect(isValidTimeZone(null)).toBe(false);
  });

  it("falls back to the default for missing or invalid preferences", () => {
    expect(resolveTimeZone("America/New_York")).toBe("America/New_York");
    expect(resolveTimeZone(undefined)).toBe(DEFAULT_TIME_ZONE);
    expect(resolveTimeZone("garbage")).toBe(DEFAULT_TIME_ZONE);
  });

  it("formats a UTC timestamp in Polish winter time", () => {
    const formatted = new Intl.DateTimeFormat("pl-PL", {
      timeStyle: "short",
      timeZone: DEFAULT_TIME_ZONE,
    }).format(new Date("2026-11-25T13:25:00Z"));
    expect(formatted).toBe("14:25");
  });

  it("prefers the user's zone, then the organization's, then the default", () => {
    expect(effectiveTimeZone("Asia/Tokyo", "Europe/London")).toBe("Asia/Tokyo");
    expect(effectiveTimeZone(null, "Europe/London")).toBe("Europe/London");
    expect(effectiveTimeZone(null, null)).toBe(DEFAULT_TIME_ZONE);
    expect(effectiveTimeZone("bogus", "also-bogus")).toBe(DEFAULT_TIME_ZONE);
  });
});
