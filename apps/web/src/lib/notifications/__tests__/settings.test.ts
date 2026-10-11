import { describe, expect, it } from "vitest";
import { DEFAULT_EMAIL_TYPES, isEventOn, toggleEvent } from "../settings";

describe("notification settings per event", () => {
  it("defaults: everything in the app, e-mail for assignments and mentions", () => {
    expect(isEventOn({}, "inApp", "comment")).toBe(true);
    expect(isEventOn(null, "email", "mention")).toBe(true);
    expect(isEventOn(null, "email", "ticket.assigned")).toBe(true);
    expect(isEventOn(null, "email", "comment")).toBe(false);
    expect(DEFAULT_EMAIL_TYPES).toEqual([
      "ticket.new",
      "ticket.assigned",
      "task.assigned",
      "mention",
    ]);
  });

  it("in-app: switching off adds the type to disabledTypes and keeps the channel switch", () => {
    const off = toggleEvent({ inApp: { enabled: false } }, "inApp", "comment", false);
    expect(off).toEqual({ inApp: { enabled: false, disabledTypes: ["comment"] } });
    const settings = { inApp: { enabled: true, disabledTypes: ["comment", "task.status"] } };
    expect(isEventOn(settings, "inApp", "comment")).toBe(false);
    expect(toggleEvent(settings, "inApp", "comment", true)).toEqual({
      inApp: { enabled: true, disabledTypes: ["task.status"] },
    });
  });

  it("e-mail: the first change stores the full list, starting from the defaults", () => {
    expect(toggleEvent({}, "email", "comment", true)).toEqual({
      email: { enabled: true, types: [...DEFAULT_EMAIL_TYPES, "comment"] },
    });
    const settings = { email: { enabled: true, types: ["mention"] } };
    expect(isEventOn(settings, "email", "ticket.assigned")).toBe(false);
    expect(toggleEvent(settings, "email", "mention", false)).toEqual({
      email: { enabled: true, types: [] },
    });
  });

  it("ignores malformed stored values", () => {
    const broken = {
      inApp: { enabled: true, disabledTypes: "x" },
      email: { enabled: true, types: 5 },
    };
    expect(isEventOn(broken as never, "inApp", "comment")).toBe(true);
    expect(isEventOn(broken as never, "email", "mention")).toBe(true);
  });
});
