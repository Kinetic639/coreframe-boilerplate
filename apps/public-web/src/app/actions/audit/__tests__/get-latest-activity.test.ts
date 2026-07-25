/**
 * @vitest-environment node
 *
 * Tests: src/app/actions/audit/get-latest-activity.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoist mock ───────────────────────────────────────────────────────────────

const { mockGetPersonalActivity } = vi.hoisted(() => ({
  mockGetPersonalActivity: vi.fn(),
}));

vi.mock("@/app/actions/audit/get-personal-activity", () => ({
  getPersonalActivityAction: mockGetPersonalActivity,
}));

import { getLatestActivityAction } from "../get-latest-activity";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const sampleEvent = {
  id: "evt-1",
  actionKey: "org.updated",
  actorUserId: "user-1",
  createdAt: "2026-03-31T10:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("getLatestActivityAction", () => {
  it("returns the first event when getPersonalActivityAction succeeds with events", async () => {
    mockGetPersonalActivity.mockResolvedValue({
      success: true,
      data: { events: [sampleEvent] },
    });

    const result = await getLatestActivityAction();

    expect(result.success).toBe(true);
    expect((result as { success: true; data: { event: unknown } }).data.event).toEqual(sampleEvent);
  });

  it("returns event: null when events array is empty", async () => {
    mockGetPersonalActivity.mockResolvedValue({
      success: true,
      data: { events: [] },
    });

    const result = await getLatestActivityAction();

    expect(result.success).toBe(true);
    expect((result as { success: true; data: { event: unknown } }).data.event).toBeNull();
  });

  it("propagates error when getPersonalActivityAction fails", async () => {
    mockGetPersonalActivity.mockResolvedValue({
      success: false,
      error: "Unauthorized",
    });

    const result = await getLatestActivityAction();

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe("Unauthorized");
  });

  it("calls getPersonalActivityAction with limit=1 and offset=0", async () => {
    mockGetPersonalActivity.mockResolvedValue({
      success: true,
      data: { events: [] },
    });

    await getLatestActivityAction();

    expect(mockGetPersonalActivity).toHaveBeenCalledWith(1, 0);
  });

  it("returns the first of multiple events (index 0)", async () => {
    const secondEvent = { ...sampleEvent, id: "evt-2" };
    mockGetPersonalActivity.mockResolvedValue({
      success: true,
      data: { events: [sampleEvent, secondEvent] },
    });

    const result = await getLatestActivityAction();

    expect((result as { success: true; data: { event: unknown } }).data.event).toEqual(sampleEvent);
  });
});
