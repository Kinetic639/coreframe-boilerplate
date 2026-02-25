/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AdminEntitlementsService } from "../admin-entitlements.service";

describe("AdminEntitlementsService.loadAdminEntitlements", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    vi.unstubAllEnvs();
  });

  function createMockSupabase(result: { data: any; error: any }) {
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue(result),
    };
    return {
      from: vi.fn(() => query),
      _query: query,
    } as any;
  }

  it("should return entitlements row when user has admin access enabled", async () => {
    const entitlementsRow = {
      user_id: "user-abc",
      enabled: true,
      updated_at: "2026-01-01T00:00:00Z",
    };
    const mockSupabase = createMockSupabase({ data: entitlementsRow, error: null });

    const result = await AdminEntitlementsService.loadAdminEntitlements(mockSupabase, "user-abc");

    expect(result).toEqual(entitlementsRow);
    expect(mockSupabase.from).toHaveBeenCalledWith("admin_entitlements");
    expect(mockSupabase._query.select).toHaveBeenCalledWith("user_id, enabled, updated_at");
    expect(mockSupabase._query.eq).toHaveBeenCalledWith("user_id", "user-abc");
    expect(mockSupabase._query.maybeSingle).toHaveBeenCalledTimes(1);
  });

  it("should return entitlements row when user has admin access disabled", async () => {
    const entitlementsRow = {
      user_id: "user-abc",
      enabled: false,
      updated_at: "2026-01-01T00:00:00Z",
    };
    const mockSupabase = createMockSupabase({ data: entitlementsRow, error: null });

    const result = await AdminEntitlementsService.loadAdminEntitlements(mockSupabase, "user-abc");

    expect(result).toEqual(entitlementsRow);
    expect(result?.enabled).toBe(false);
  });

  it("should return null when no row exists (user is not an admin)", async () => {
    const mockSupabase = createMockSupabase({ data: null, error: null });

    const result = await AdminEntitlementsService.loadAdminEntitlements(mockSupabase, "user-xyz");

    expect(result).toBeNull();
  });

  it("should return null and suppress error in production on DB error", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const mockSupabase = createMockSupabase({
      data: null,
      error: { message: "RLS denied", code: "PGRST301" },
    });

    const result = await AdminEntitlementsService.loadAdminEntitlements(mockSupabase, "user-abc");

    expect(result).toBeNull();
    // In production, no console.error
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("should return null and log error in development on DB error", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const dbError = { message: "RLS denied", code: "PGRST301" };
    const mockSupabase = createMockSupabase({ data: null, error: dbError });

    const result = await AdminEntitlementsService.loadAdminEntitlements(mockSupabase, "user-abc");

    expect(result).toBeNull();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[AdminEntitlementsService] Failed to load entitlements:",
      dbError
    );
  });

  it("should return null on RLS policy violation", async () => {
    const mockSupabase = createMockSupabase({
      data: null,
      error: { message: "new row violates row-level security policy", code: "42501" },
    });

    const result = await AdminEntitlementsService.loadAdminEntitlements(mockSupabase, "user-abc");

    expect(result).toBeNull();
  });

  it("should return null on network/connection error", async () => {
    const mockSupabase = createMockSupabase({
      data: null,
      error: { message: "connection refused", code: "ECONNREFUSED" },
    });

    const result = await AdminEntitlementsService.loadAdminEntitlements(mockSupabase, "user-abc");

    expect(result).toBeNull();
  });

  it("should query by the correct userId", async () => {
    const specificUserId = "specific-user-id-12345";
    const mockSupabase = createMockSupabase({ data: null, error: null });

    await AdminEntitlementsService.loadAdminEntitlements(mockSupabase, specificUserId);

    expect(mockSupabase._query.eq).toHaveBeenCalledWith("user_id", specificUserId);
  });
});
