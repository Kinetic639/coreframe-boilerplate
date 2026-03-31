/**
 * @vitest-environment node
 *
 * Tests: entitlements-guards.ts
 * - mapEntitlementError: all 5 error codes
 * - entitlements.requireModuleOrRedirect: success path, MODULE_ACCESS_DENIED redirect, other errors
 * - entitlements.requireWithinLimitOrRedirect: success, LIMIT_EXCEEDED redirect with params
 * - entitlements.requireOrgContext: authorized, unauthorized cases
 * - entitlements.requireModuleAccess: delegates to EntitlementsService
 * - entitlements.requireWithinLimit: delegates to EntitlementsService
 * - entitlements.checkLimit: delegates to EntitlementsService
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { EntitlementError, type EntitlementErrorCode } from "@/lib/types/entitlements";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "user-1" } },
        error: null,
      }),
    },
  }),
}));

vi.mock("@/server/loaders/v2/load-app-context.v2", () => ({
  loadAppContextV2: vi.fn().mockResolvedValue({
    activeOrgId: "org-1",
    activeBranchId: "branch-1",
  }),
}));

const { mockRequireModuleAccess, mockRequireWithinLimit, mockCheckLimit } = vi.hoisted(() => ({
  mockRequireModuleAccess: vi.fn(),
  mockRequireWithinLimit: vi.fn(),
  mockCheckLimit: vi.fn(),
}));

vi.mock("@/server/services/entitlements-service", () => ({
  EntitlementsService: {
    requireModuleAccess: mockRequireModuleAccess,
    requireWithinLimit: mockRequireWithinLimit,
    checkLimit: mockCheckLimit,
  },
}));

// redirect from next/navigation throws a specific error in Next.js — mock it
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { url, digest: `NEXT_REDIRECT;${url}` });
  }),
}));

// React cache — just call through in tests
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    cache: (fn: (...args: unknown[]) => unknown) => fn,
  };
});

import { mapEntitlementError, entitlements } from "../entitlements-guards";
import { redirect } from "next/navigation";
import { loadAppContextV2 } from "@/server/loaders/v2/load-app-context.v2";
import { createClient } from "@/utils/supabase/server";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeEntitlementError(
  code: EntitlementErrorCode,
  context: Partial<import("@/lib/types/entitlements").EntitlementErrorContext> = {}
) {
  return new EntitlementError(code, { orgId: "org-1", ...context });
}

// ─── mapEntitlementError ──────────────────────────────────────────────────────

describe("mapEntitlementError", () => {
  it("returns null for non-EntitlementError", () => {
    expect(mapEntitlementError(new Error("generic"))).toBeNull();
    expect(mapEntitlementError("string error")).toBeNull();
    expect(mapEntitlementError(null)).toBeNull();
    expect(mapEntitlementError(undefined)).toBeNull();
  });

  it("maps MODULE_ACCESS_DENIED", () => {
    const err = makeEntitlementError("MODULE_ACCESS_DENIED", { moduleSlug: "warehouse" });
    const result = mapEntitlementError(err);
    expect(result).not.toBeNull();
    expect(result!.code).toBe("MODULE_ACCESS_DENIED");
    expect(result!.message).toBe("This module is not available on your plan.");
    expect(result!.context?.moduleSlug).toBe("warehouse");
  });

  it("maps LIMIT_EXCEEDED", () => {
    const err = makeEntitlementError("LIMIT_EXCEEDED", { current: 10, limit: 5 });
    const result = mapEntitlementError(err);
    expect(result!.code).toBe("LIMIT_EXCEEDED");
    expect(result!.message).toBe("You've reached your plan limit.");
    expect(result!.context?.current).toBe(10);
    expect(result!.context?.limit).toBe(5);
  });

  it("maps LIMIT_CHECK_FAILED", () => {
    const err = makeEntitlementError("LIMIT_CHECK_FAILED");
    const result = mapEntitlementError(err);
    expect(result!.code).toBe("LIMIT_CHECK_FAILED");
    expect(result!.message).toBe("Couldn't verify your plan limits. Please try again.");
  });

  it("maps ENTITLEMENTS_MISSING", () => {
    const err = makeEntitlementError("ENTITLEMENTS_MISSING");
    const result = mapEntitlementError(err);
    expect(result!.code).toBe("ENTITLEMENTS_MISSING");
    expect(result!.message).toBe("Subscription configuration is missing. Contact support.");
  });

  it("maps NO_ACTIVE_SUBSCRIPTION", () => {
    const err = makeEntitlementError("NO_ACTIVE_SUBSCRIPTION");
    const result = mapEntitlementError(err);
    expect(result!.code).toBe("NO_ACTIVE_SUBSCRIPTION");
    expect(result!.message).toBe("No active subscription found. Contact support.");
  });

  it("includes context in result", () => {
    const err = makeEntitlementError("MODULE_ACCESS_DENIED", {
      orgId: "org-test",
      moduleSlug: "analytics",
    });
    const result = mapEntitlementError(err);
    expect(result!.context).toEqual(
      expect.objectContaining({ orgId: "org-test", moduleSlug: "analytics" })
    );
  });
});

// ─── entitlements.requireOrgContext ──────────────────────────────────────────

describe("entitlements.requireOrgContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
    } as never);
    vi.mocked(loadAppContextV2).mockResolvedValue({
      activeOrgId: "org-1",
      activeBranchId: "branch-1",
    } as never);
  });

  it("returns OrgContext with userId, orgId, branchId", async () => {
    const ctx = await entitlements.requireOrgContext();
    expect(ctx.userId).toBe("user-1");
    expect(ctx.orgId).toBe("org-1");
    expect(ctx.branchId).toBe("branch-1");
  });

  it("throws when user is null", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    } as never);
    await expect(entitlements.requireOrgContext()).rejects.toThrow("Unauthorized");
  });

  it("throws when auth returns error", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: { message: "JWT expired" },
        }),
      },
    } as never);
    await expect(entitlements.requireOrgContext()).rejects.toThrow("Unauthorized");
  });

  it("throws when no active org", async () => {
    vi.mocked(loadAppContextV2).mockResolvedValue({ activeOrgId: null } as never);
    await expect(entitlements.requireOrgContext()).rejects.toThrow("No active organization");
  });

  it("throws when appContext is null", async () => {
    vi.mocked(loadAppContextV2).mockResolvedValue(null as never);
    await expect(entitlements.requireOrgContext()).rejects.toThrow("No active organization");
  });
});

// ─── entitlements.requireModuleAccess ────────────────────────────────────────

describe("entitlements.requireModuleAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
    } as never);
    vi.mocked(loadAppContextV2).mockResolvedValue({
      activeOrgId: "org-1",
      activeBranchId: null,
    } as never);
    mockRequireModuleAccess.mockResolvedValue(undefined);
  });

  it("resolves when module access is granted", async () => {
    await expect(entitlements.requireModuleAccess("warehouse")).resolves.toBeUndefined();
    expect(mockRequireModuleAccess).toHaveBeenCalledWith("org-1", "warehouse", undefined);
  });

  it("throws EntitlementError when access is denied", async () => {
    mockRequireModuleAccess.mockRejectedValue(makeEntitlementError("MODULE_ACCESS_DENIED"));
    await expect(entitlements.requireModuleAccess("warehouse")).rejects.toBeInstanceOf(
      EntitlementError
    );
  });
});

// ─── entitlements.requireWithinLimit ─────────────────────────────────────────

describe("entitlements.requireWithinLimit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
    } as never);
    vi.mocked(loadAppContextV2).mockResolvedValue({
      activeOrgId: "org-1",
      activeBranchId: null,
    } as never);
    mockRequireWithinLimit.mockResolvedValue(undefined);
  });

  it("resolves when within limit", async () => {
    await expect(
      entitlements.requireWithinLimit("warehouse_max_locations" as never)
    ).resolves.toBeUndefined();
    expect(mockRequireWithinLimit).toHaveBeenCalledWith(
      "org-1",
      "warehouse_max_locations",
      undefined
    );
  });

  it("throws EntitlementError when limit exceeded", async () => {
    mockRequireWithinLimit.mockRejectedValue(makeEntitlementError("LIMIT_EXCEEDED"));
    await expect(
      entitlements.requireWithinLimit("warehouse_max_locations" as never)
    ).rejects.toBeInstanceOf(EntitlementError);
  });
});

// ─── entitlements.checkLimit ──────────────────────────────────────────────────

describe("entitlements.checkLimit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
    } as never);
    vi.mocked(loadAppContextV2).mockResolvedValue({
      activeOrgId: "org-1",
      activeBranchId: null,
    } as never);
  });

  it("returns LimitCheckResult", async () => {
    const mockResult = { limit: 10, current: 3, canProceed: true };
    mockCheckLimit.mockResolvedValue(mockResult);
    const result = await entitlements.checkLimit("warehouse_max_locations" as never);
    expect(result).toEqual(mockResult);
    expect(mockCheckLimit).toHaveBeenCalledWith("org-1", "warehouse_max_locations", undefined);
  });

  it("returns null when check fails", async () => {
    mockCheckLimit.mockResolvedValue(null);
    const result = await entitlements.checkLimit("warehouse_max_locations" as never);
    expect(result).toBeNull();
  });
});

// ─── entitlements.requireModuleOrRedirect ────────────────────────────────────

describe("entitlements.requireModuleOrRedirect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
    } as never);
    vi.mocked(loadAppContextV2).mockResolvedValue({
      activeOrgId: "org-1",
      activeBranchId: null,
    } as never);
    mockRequireModuleAccess.mockResolvedValue(undefined);
  });

  it("returns OrgContext when module access is granted", async () => {
    const ctx = await entitlements.requireModuleOrRedirect("warehouse");
    expect(ctx.orgId).toBe("org-1");
    expect(ctx.userId).toBe("user-1");
  });

  it("redirects to /upgrade when MODULE_ACCESS_DENIED", async () => {
    mockRequireModuleAccess.mockRejectedValue(
      makeEntitlementError("MODULE_ACCESS_DENIED", { moduleSlug: "warehouse" })
    );
    await expect(entitlements.requireModuleOrRedirect("warehouse")).rejects.toThrow(
      "NEXT_REDIRECT"
    );
    const redirectMock = vi.mocked(redirect);
    expect(redirectMock).toHaveBeenCalledTimes(1);
    const redirectUrl = (redirectMock.mock.calls[0] as string[])[0];
    expect(redirectUrl).toContain("/upgrade");
    expect(redirectUrl).toContain("reason=module");
    expect(redirectUrl).toContain("module=warehouse");
  });

  it("redirects to custom URL when redirectTo is provided", async () => {
    mockRequireModuleAccess.mockRejectedValue(makeEntitlementError("MODULE_ACCESS_DENIED"));
    await expect(
      entitlements.requireModuleOrRedirect("warehouse", { redirectTo: "/custom-upgrade" })
    ).rejects.toThrow("NEXT_REDIRECT");
    const redirectMock = vi.mocked(redirect);
    const redirectUrl = (redirectMock.mock.calls[0] as string[])[0];
    expect(redirectUrl).toContain("/custom-upgrade");
  });

  it("throws non-MODULE_ACCESS_DENIED EntitlementError", async () => {
    mockRequireModuleAccess.mockRejectedValue(makeEntitlementError("ENTITLEMENTS_MISSING"));
    await expect(entitlements.requireModuleOrRedirect("warehouse")).rejects.toBeInstanceOf(
      EntitlementError
    );
    expect(redirect).not.toHaveBeenCalled();
  });

  it("throws generic errors without redirecting", async () => {
    mockRequireModuleAccess.mockRejectedValue(new Error("DB connection failed"));
    await expect(entitlements.requireModuleOrRedirect("warehouse")).rejects.toThrow(
      "DB connection failed"
    );
    expect(redirect).not.toHaveBeenCalled();
  });
});

// ─── entitlements.requireWithinLimitOrRedirect ───────────────────────────────

describe("entitlements.requireWithinLimitOrRedirect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
    } as never);
    vi.mocked(loadAppContextV2).mockResolvedValue({
      activeOrgId: "org-1",
      activeBranchId: null,
    } as never);
    mockRequireWithinLimit.mockResolvedValue(undefined);
  });

  it("resolves when within limit", async () => {
    await expect(
      entitlements.requireWithinLimitOrRedirect("warehouse_max_locations" as never)
    ).resolves.toBeUndefined();
  });

  it("redirects to /upgrade when LIMIT_EXCEEDED", async () => {
    mockRequireWithinLimit.mockRejectedValue(
      makeEntitlementError("LIMIT_EXCEEDED", { current: 10, limit: 5 })
    );
    await expect(
      entitlements.requireWithinLimitOrRedirect("warehouse_max_locations" as never)
    ).rejects.toThrow("NEXT_REDIRECT");
    const redirectMock = vi.mocked(redirect);
    expect(redirectMock).toHaveBeenCalledTimes(1);
    const redirectUrl = (redirectMock.mock.calls[0] as string[])[0];
    expect(redirectUrl).toContain("/upgrade");
    expect(redirectUrl).toContain("reason=limit");
    expect(redirectUrl).toContain("key=warehouse_max_locations");
    expect(redirectUrl).toContain("current=10");
    expect(redirectUrl).toContain("limit=5");
  });

  it("redirects without current/limit params when not numbers", async () => {
    mockRequireWithinLimit.mockRejectedValue(makeEntitlementError("LIMIT_EXCEEDED"));
    await expect(
      entitlements.requireWithinLimitOrRedirect("warehouse_max_locations" as never)
    ).rejects.toThrow("NEXT_REDIRECT");
    const redirectMock = vi.mocked(redirect);
    const redirectUrl = (redirectMock.mock.calls[0] as string[])[0];
    expect(redirectUrl).not.toContain("current=");
    expect(redirectUrl).not.toContain("limit=");
  });

  it("redirects to custom URL when redirectTo is provided", async () => {
    mockRequireWithinLimit.mockRejectedValue(makeEntitlementError("LIMIT_EXCEEDED"));
    await expect(
      entitlements.requireWithinLimitOrRedirect("warehouse_max_locations" as never, {
        redirectTo: "/plans",
      })
    ).rejects.toThrow("NEXT_REDIRECT");
    const redirectMock = vi.mocked(redirect);
    const redirectUrl = (redirectMock.mock.calls[0] as string[])[0];
    expect(redirectUrl).toContain("/plans");
  });

  it("throws non-LIMIT_EXCEEDED EntitlementError", async () => {
    mockRequireWithinLimit.mockRejectedValue(makeEntitlementError("ENTITLEMENTS_MISSING"));
    await expect(
      entitlements.requireWithinLimitOrRedirect("warehouse_max_locations" as never)
    ).rejects.toBeInstanceOf(EntitlementError);
    expect(redirect).not.toHaveBeenCalled();
  });

  it("throws generic errors", async () => {
    mockRequireWithinLimit.mockRejectedValue(new Error("DB error"));
    await expect(
      entitlements.requireWithinLimitOrRedirect("warehouse_max_locations" as never)
    ).rejects.toThrow("DB error");
    expect(redirect).not.toHaveBeenCalled();
  });
});
