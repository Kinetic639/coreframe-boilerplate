/**
 * @vitest-environment node
 */

import { describe, expect, it } from "vitest";
import {
  dateOnlyToLocalDate,
  dateOnlyToZonedIso,
  dateToDateOnly,
  isoToDateOnlyInTimeZone,
  isDateOnly,
} from "../calendar-dates";

describe("planning calendar date helpers", () => {
  it("validates yyyy-MM-dd date-only strings", () => {
    expect(isDateOnly("2026-06-12")).toBe(true);
    expect(isDateOnly("2026-6-12")).toBe(false);
    expect(isDateOnly("2026-06-12T00:00:00.000Z")).toBe(false);
  });

  it("round-trips a date-only value through an org timezone without changing the calendar day", () => {
    const dueDate = "2026-06-12";
    const dueAt = dateOnlyToZonedIso(dueDate, "Europe/Warsaw");

    expect(isoToDateOnlyInTimeZone(dueAt, "Europe/Warsaw")).toBe(dueDate);
  });

  it("preserves milliseconds when converting end-of-day range boundaries", () => {
    expect(
      dateOnlyToZonedIso("2026-06-30", "Europe/Warsaw", {
        hour: 23,
        minute: 59,
        second: 59,
        millisecond: 999,
      })
    ).toBe("2026-06-30T21:59:59.999Z");
  });

  it("uses local calendar dates when converting Date instances to date-only values", () => {
    expect(dateToDateOnly(new Date(2026, 5, 12))).toBe("2026-06-12");
    expect(dateOnlyToLocalDate("2026-06-12")).toEqual(new Date(2026, 5, 12));
  });

  it("throws before converting timestamp-shaped values to zoned ISO strings", () => {
    expect(() => dateOnlyToZonedIso("2026-06-12T00:00:00.000Z", "UTC")).toThrow(
      "Expected yyyy-MM-dd date"
    );
  });
});
