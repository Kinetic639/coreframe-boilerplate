import { describe, expect, it } from "vitest";
import { buildRecurrence, describeRecurrence, isoWeekday } from "../recurrence-format";

const t = (key: string, values?: Record<string, string | number>) =>
  `${key}${values ? JSON.stringify(values) : ""}`;
const weekday = (day: number) => ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][day];
const formatDay = (ymd: string) => ymd.split("-").reverse().join(".");

describe("buildRecurrence", () => {
  it("keeps only what applies to the frequency", () => {
    expect(
      buildRecurrence({ freq: "daily", interval: 1, weekdays: [1], monthday: 5, until: null })
    ).toEqual({ freq: "daily" });
    expect(
      buildRecurrence({
        freq: "weekly",
        interval: 2,
        weekdays: [5, 1, 1],
        monthday: 5,
        until: null,
      })
    ).toEqual({ freq: "weekly", interval: 2, weekdays: [1, 5] });
    expect(
      buildRecurrence({
        freq: "monthly",
        interval: 1,
        weekdays: [],
        monthday: 40,
        until: "2027-01-01",
      })
    ).toEqual({ freq: "monthly", monthday: 31, until: "2027-01-01" });
  });

  it("clamps the interval", () => {
    expect(
      buildRecurrence({ freq: "yearly", interval: 0, weekdays: [], monthday: null, until: null })
    ).toEqual({ freq: "yearly" });
    expect(
      buildRecurrence({ freq: "daily", interval: 999, weekdays: [], monthday: null, until: null })
        .interval
    ).toBe(365);
  });
});

describe("describeRecurrence", () => {
  it("reads weekly days and the end", () => {
    expect(
      describeRecurrence(
        t,
        { freq: "weekly", interval: 2, weekdays: [3, 1], until: "2026-12-31" },
        weekday,
        formatDay
      )
    ).toBe('every.weekly{"count":2} onDays{"days":"Mon, Wed"}, untilDay{"day":"31.12.2026"}');
  });

  it("reads a monthly day", () => {
    expect(describeRecurrence(t, { freq: "monthly", monthday: 15 }, weekday, formatDay)).toBe(
      'every.monthly{"count":1} onMonthday{"day":15}'
    );
  });
});

describe("isoWeekday", () => {
  it("counts Monday as 1 and Sunday as 7", () => {
    expect(isoWeekday("2026-11-16")).toBe(1);
    expect(isoWeekday("2026-11-22")).toBe(7);
  });
});
