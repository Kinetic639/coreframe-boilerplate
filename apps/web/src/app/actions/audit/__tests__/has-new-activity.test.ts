/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetAuthUser, mockFrom, query } = vi.hoisted(() => {
  const query: Record<string, ReturnType<typeof vi.fn>> = {};
  return { mockGetAuthUser: vi.fn(), mockFrom: vi.fn(), query };
});

vi.mock("@/server/auth/get-auth-user", () => ({ getAuthUser: mockGetAuthUser }));
vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({ from: mockFrom }),
}));

import { hasNewActivityAction } from "../has-new-activity";

function respond(result: { data: unknown; error: unknown }) {
  for (const m of ["select", "gt", "or"]) query[m] = vi.fn().mockReturnValue(query);
  query.limit = vi.fn().mockResolvedValue(result);
  mockFrom.mockReturnValue(query);
}

describe("hasNewActivityAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
  });

  it("asks one query for a newer event about the user", async () => {
    respond({ data: [{ id: "e1" }], error: null });

    const result = await hasNewActivityAction("2026-11-20T07:00:00.000Z");

    expect(result).toMatchObject({ success: true, data: { hasNew: true } });
    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledWith("platform_events");
    expect(query.gt).toHaveBeenCalledWith("created_at", "2026-11-20T07:00:00.000Z");
    expect(query.or).toHaveBeenCalledWith(
      "actor_user_id.eq.user-1,and(entity_type.eq.user,entity_id.eq.user-1),and(target_type.eq.user,target_id.eq.user-1)"
    );
    expect(query.limit).toHaveBeenCalledWith(1);
  });

  it("reports nothing new and the server time of the check", async () => {
    respond({ data: [], error: null });
    const before = Date.now();

    const result = await hasNewActivityAction("2026-11-20T07:00:00.000Z");

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.hasNew).toBe(false);
    expect(new Date(result.data.checkedAt).getTime()).toBeGreaterThanOrEqual(before - 1);
  });

  it("refuses an invalid date without a query", async () => {
    expect(await hasNewActivityAction("not a date")).toEqual({
      success: false,
      error: "Invalid date",
    });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("refuses without a session", async () => {
    mockGetAuthUser.mockResolvedValue({ data: { user: null }, error: null });
    expect(await hasNewActivityAction("2026-11-20T07:00:00.000Z")).toEqual({
      success: false,
      error: "Unauthorized",
    });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("reports a failed query", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    respond({ data: null, error: { message: "boom" } });
    expect(await hasNewActivityAction("2026-11-20T07:00:00.000Z")).toEqual({
      success: false,
      error: "Failed to check activity",
    });
    spy.mockRestore();
  });
});
