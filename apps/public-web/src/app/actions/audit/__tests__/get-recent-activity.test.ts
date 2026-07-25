/**
 * @vitest-environment node
 *
 * Tests: src/app/actions/audit/get-recent-activity.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoist mock ───────────────────────────────────────────────────────────────

const { mockGetPersonalActivity } = vi.hoisted(() => ({
  mockGetPersonalActivity: vi.fn(),
}));

vi.mock("@/app/actions/audit/get-personal-activity", () => ({
  getPersonalActivityAction: mockGetPersonalActivity,
}));

import { getRecentActivityAction } from "../get-recent-activity";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const makeEvents = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    id: `evt-${i + 1}`,
    actionKey: "org.updated",
    createdAt: `2026-03-31T${String(i).padStart(2, "0")}:00:00Z`,
  }));

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("getRecentActivityAction", () => {
  it("returns events array when getPersonalActivityAction succeeds", async () => {
    const events = makeEvents(5);
    mockGetPersonalActivity.mockResolvedValue({
      success: true,
      data: { events },
    });

    const result = await getRecentActivityAction();

    expect(result.success).toBe(true);
    expect((result as { success: true; data: { events: unknown[] } }).data.events).toHaveLength(5);
    expect((result as { success: true; data: { events: unknown[] } }).data.events).toEqual(events);
  });

  it("returns empty events array when no events exist", async () => {
    mockGetPersonalActivity.mockResolvedValue({
      success: true,
      data: { events: [] },
    });

    const result = await getRecentActivityAction();

    expect(result.success).toBe(true);
    expect((result as { success: true; data: { events: unknown[] } }).data.events).toEqual([]);
  });

  it("propagates error when getPersonalActivityAction fails", async () => {
    mockGetPersonalActivity.mockResolvedValue({
      success: false,
      error: "Session expired",
    });

    const result = await getRecentActivityAction();

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe("Session expired");
  });

  it("calls getPersonalActivityAction with limit=10 and offset=0", async () => {
    mockGetPersonalActivity.mockResolvedValue({
      success: true,
      data: { events: [] },
    });

    await getRecentActivityAction();

    expect(mockGetPersonalActivity).toHaveBeenCalledWith(10, 0);
  });

  it("preserves all 10 events when exactly 10 events returned", async () => {
    const events = makeEvents(10);
    mockGetPersonalActivity.mockResolvedValue({
      success: true,
      data: { events },
    });

    const result = await getRecentActivityAction();

    expect((result as { success: true; data: { events: unknown[] } }).data.events).toHaveLength(10);
  });
});
