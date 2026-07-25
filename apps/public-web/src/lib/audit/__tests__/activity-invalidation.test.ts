/**
 * @vitest-environment jsdom
 *
 * Tests: src/lib/audit/activity-invalidation.ts
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { notifyActivityProduced, ACTIVITY_PRODUCED_EVENT } from "../activity-invalidation";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ACTIVITY_PRODUCED_EVENT", () => {
  it("is the correct event name string", () => {
    expect(ACTIVITY_PRODUCED_EVENT).toBe("coreframe:activity-produced");
  });
});

describe("notifyActivityProduced", () => {
  it("dispatches a CustomEvent with the correct type when window is defined", () => {
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");

    notifyActivityProduced();

    expect(dispatchSpy).toHaveBeenCalledOnce();
    const event = dispatchSpy.mock.calls[0][0] as CustomEvent;
    expect(event).toBeInstanceOf(CustomEvent);
    expect(event.type).toBe(ACTIVITY_PRODUCED_EVENT);
  });

  it("does not throw when window is undefined (SSR / server context)", () => {
    vi.stubGlobal("window", undefined);
    expect(() => notifyActivityProduced()).not.toThrow();
  });

  it("dispatches event on every call", () => {
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");

    notifyActivityProduced();
    notifyActivityProduced();
    notifyActivityProduced();

    expect(dispatchSpy).toHaveBeenCalledTimes(3);
  });
});
