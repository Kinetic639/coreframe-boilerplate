import { describe, expect, it } from "vitest";
import { dueState, fromDateInput, toDateInput } from "../task-dates";

const NOW = new Date(2026, 10, 16, 10, 0, 0);
const day = (offset: number) => new Date(2026, 10, 16 + offset, 12, 0, 0).toISOString();

describe("task due dates", () => {
  it("has no state without a due date", () => {
    expect(dueState(null, "open", NOW)).toBeNull();
  });

  it("marks a finished task done, whatever the date", () => {
    expect(dueState(day(-5), "completed", NOW)).toBe("done");
  });

  it("marks past dates overdue, today and tomorrow soon, later ones plain", () => {
    expect(dueState(day(-1), "open", NOW)).toBe("overdue");
    expect(dueState(day(0), "in_progress", NOW)).toBe("soon");
    expect(dueState(day(1), "open", NOW)).toBe("soon");
    expect(dueState(day(2), "open", NOW)).toBe("normal");
  });

  it("never shows a cancelled task as overdue", () => {
    expect(dueState(day(-3), "cancelled", NOW)).toBe("normal");
  });

  it("round-trips a picked day", () => {
    const stored = fromDateInput("2026-11-20");
    expect(stored).toBe("2026-11-20T12:00:00.000Z");
    expect(toDateInput(stored)).toBe("2026-11-20");
    expect(fromDateInput("20.11.2026")).toBeNull();
  });
});
