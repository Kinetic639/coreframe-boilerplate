import { describe, expect, it } from "vitest";
import type { KanbanChecklistItem } from "@/lib/types/kanban";
import { buildTaskDates, dueState, fromDateInput, toDateInput } from "../task-dates";
import { checklistProgress } from "../task-checklist-progress";

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

describe("buildTaskDates", () => {
  it("keeps a plain due day at noon UTC", () => {
    expect(buildTaskDates({ start: "", due: "2026-11-20", time: "" }, "Europe/Warsaw")).toEqual({
      start_date: null,
      due_at: "2026-11-20T12:00:00.000Z",
      due_has_time: false,
      timezone: "Europe/Warsaw",
    });
  });

  it("gives a due day with an hour as that local moment", () => {
    const result = buildTaskDates({ start: "", due: "2026-11-20", time: "15:30" }, "UTC");
    expect(result.due_has_time).toBe(true);
    expect(result.due_at).toBe(new Date(2026, 10, 20, 15, 30).toISOString());
  });

  it("moves a start after the due day back to it, and keeps a start alone", () => {
    expect(
      buildTaskDates({ start: "2026-11-25", due: "2026-11-20", time: "" }, "UTC").start_date
    ).toBe("2026-11-20");
    expect(buildTaskDates({ start: "2026-11-25", due: "", time: "10:00" }, "UTC")).toEqual({
      start_date: "2026-11-25",
      due_at: null,
      due_has_time: false,
      timezone: "UTC",
    });
  });

  it("ignores an hour that is not one", () => {
    expect(
      buildTaskDates({ start: "", due: "2026-11-20", time: "25:00" }, "UTC").due_has_time
    ).toBe(false);
  });
});

describe("checklistProgress", () => {
  it("counts items across checklists", () => {
    const item = (is_done: boolean) => ({ is_done }) as KanbanChecklistItem;
    expect(checklistProgress([])).toEqual({ total: 0, done: 0 });
    expect(
      checklistProgress([{ items: [item(true), item(false)] }, { items: [item(true)] }])
    ).toEqual({ total: 3, done: 2 });
  });
});
