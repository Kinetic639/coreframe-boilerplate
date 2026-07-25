/**
 * @vitest-environment node
 *
 * Guards unit tests — security-critical, verifies:
 * 1. requireAdminAccess throws for non-admins (null, disabled row)
 * 2. requireAdminOrRedirect calls redirect for non-admins
 * 3. mapAdminEntitlementError produces correct user-facing messages
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { requireAdminAccess, requireAdminOrRedirect, mapAdminEntitlementError } from "../guards";

// ---------------------------------------------------------------------------
// Mock @/i18n/navigation redirect to avoid real Next.js redirect
// ---------------------------------------------------------------------------
const mockRedirect = vi.fn();
vi.mock("@/i18n/navigation", () => ({
  redirect: (...args: any[]) => mockRedirect(...args),
}));

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------
const enabledEntitlements = {
  user_id: "user-123",
  enabled: true,
  updated_at: "2026-01-01T00:00:00Z",
};

const disabledEntitlements = {
  user_id: "user-123",
  enabled: false,
  updated_at: "2026-01-01T00:00:00Z",
};

// ---------------------------------------------------------------------------
// requireAdminAccess
// ---------------------------------------------------------------------------
describe("requireAdminAccess", () => {
  it("should NOT throw when entitlements.enabled is true", () => {
    expect(() => requireAdminAccess(enabledEntitlements)).not.toThrow();
  });

  it("should throw when entitlements is null", () => {
    expect(() => requireAdminAccess(null)).toThrow("Admin access required");
  });

  it("should throw when entitlements.enabled is false", () => {
    expect(() => requireAdminAccess(disabledEntitlements)).toThrow("Admin access required");
  });

  it("should throw an Error instance", () => {
    expect(() => requireAdminAccess(null)).toThrow(Error);
  });

  it("should narrow type — enabled entitlements pass type check", () => {
    // TypeScript narrowing: after guard runs, value is AdminEntitlements (non-null)
    const entitlements = enabledEntitlements as typeof enabledEntitlements | null;
    requireAdminAccess(entitlements);
    // If we get here, narrowing worked — entitlements is now typed as non-null
    expect(entitlements.enabled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// requireAdminOrRedirect
// ---------------------------------------------------------------------------
describe("requireAdminOrRedirect", () => {
  beforeEach(() => {
    mockRedirect.mockClear();
  });

  it("should NOT call redirect when entitlements.enabled is true", () => {
    requireAdminOrRedirect(enabledEntitlements, "en");
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("should call redirect to /dashboard/start when entitlements is null", () => {
    requireAdminOrRedirect(null, "en");
    expect(mockRedirect).toHaveBeenCalledWith({ href: "/dashboard/start", locale: "en" });
  });

  it("should call redirect when entitlements.enabled is false", () => {
    requireAdminOrRedirect(disabledEntitlements, "pl");
    expect(mockRedirect).toHaveBeenCalledWith({ href: "/dashboard/start", locale: "pl" });
  });

  it("should pass the locale correctly to redirect", () => {
    requireAdminOrRedirect(null, "pl");
    expect(mockRedirect).toHaveBeenCalledWith({ href: "/dashboard/start", locale: "pl" });
  });

  it("should call redirect exactly once (not double-redirect)", () => {
    requireAdminOrRedirect(null, "en");
    expect(mockRedirect).toHaveBeenCalledTimes(1);
  });

  it("should redirect to /dashboard/start NOT /sign-in (non-admin gets back to app, not login)", () => {
    requireAdminOrRedirect(disabledEntitlements, "en");
    const callArgs = mockRedirect.mock.calls[0][0];
    expect(callArgs.href).toBe("/dashboard/start");
    expect(callArgs.href).not.toBe("/sign-in");
  });
});

// ---------------------------------------------------------------------------
// mapAdminEntitlementError
// ---------------------------------------------------------------------------
describe("mapAdminEntitlementError", () => {
  it("should return access denied message for 'Admin access required' error", () => {
    const error = new Error("Admin access required");
    const message = mapAdminEntitlementError(error);
    expect(message).toBe("You do not have permission to access the admin panel.");
  });

  it("should return generic message for unknown Error", () => {
    const error = new Error("Something else");
    const message = mapAdminEntitlementError(error);
    expect(message).toBe("An unexpected error occurred while verifying admin access.");
  });

  it("should return generic message for non-Error object", () => {
    const message = mapAdminEntitlementError({ code: "unknown" });
    expect(message).toBe("An unexpected error occurred while verifying admin access.");
  });

  it("should return generic message for null", () => {
    const message = mapAdminEntitlementError(null);
    expect(message).toBe("An unexpected error occurred while verifying admin access.");
  });

  it("should return generic message for string errors", () => {
    const message = mapAdminEntitlementError("Admin access required");
    // Only Error instances match — raw strings should return generic
    expect(message).toBe("An unexpected error occurred while verifying admin access.");
  });
});
