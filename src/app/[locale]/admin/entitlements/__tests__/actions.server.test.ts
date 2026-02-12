/**
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  planNameSchema,
  moduleSlugSchema,
  limitKeySchema,
  overrideValueSchema,
  ADMIN_PATH,
  enforceAdminAccess,
  isAdminActionError,
  logActionError,
} from "../actions.server";
import {
  AdminActionError,
  EntitlementsAdminService,
} from "@/server/services/entitlements-admin.service";
import { LIMIT_KEYS } from "@/lib/types/entitlements";

// Mock dependencies
vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/api/load-app-context-server", () => ({
  loadAppContextWithClient: vi.fn(),
}));

vi.mock("@/server/services/entitlements-admin.service", async () => {
  const actual = await vi.importActual<
    typeof import("@/server/services/entitlements-admin.service")
  >("@/server/services/entitlements-admin.service");

  return {
    ...actual,
    EntitlementsAdminService: {
      ...actual.EntitlementsAdminService,
      assertDevModeEnabled: vi.fn(),
      assertOrgOwner: vi.fn(),
    },
  };
});

import { createClient } from "@/utils/supabase/server";
import { loadAppContextWithClient } from "@/lib/api/load-app-context-server";

describe("Entitlements Admin Server Helpers", () => {
  describe("Schemas", () => {
    describe("planNameSchema", () => {
      it("should accept valid plan name", () => {
        const result = planNameSchema.safeParse("pro");
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toBe("pro");
        }
      });

      it("should reject empty string", () => {
        const result = planNameSchema.safeParse("");
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.errors[0].message).toBe("Plan name is required");
        }
      });

      it("should reject non-string", () => {
        const result = planNameSchema.safeParse(123);
        expect(result.success).toBe(false);
      });
    });

    describe("moduleSlugSchema", () => {
      it("should accept valid module slug", () => {
        const result = moduleSlugSchema.safeParse("warehouse");
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toBe("warehouse");
        }
      });

      it("should reject empty string", () => {
        const result = moduleSlugSchema.safeParse("");
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.errors[0].message).toBe("Module slug is required");
        }
      });
    });

    describe("limitKeySchema", () => {
      it("should accept valid limit key from LIMIT_KEYS", () => {
        const validKey = LIMIT_KEYS.WAREHOUSE_MAX_LOCATIONS;
        const result = limitKeySchema.safeParse(validKey);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toBe(validKey);
        }
      });

      it("should reject invalid limit key not in LIMIT_KEYS", () => {
        const result = limitKeySchema.safeParse("invalid.key");
        expect(result.success).toBe(false);
      });

      it("should reject empty string", () => {
        const result = limitKeySchema.safeParse("");
        expect(result.success).toBe(false);
      });
    });

    describe("overrideValueSchema", () => {
      it("should accept number", () => {
        const result = overrideValueSchema.safeParse(5);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toBe(5);
        }
      });

      it("should accept numeric string (coerce)", () => {
        const result = overrideValueSchema.safeParse("5");
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toBe(5);
        }
      });

      it("should accept -1", () => {
        const result = overrideValueSchema.safeParse(-1);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toBe(-1);
        }
      });

      it("should accept 0", () => {
        const result = overrideValueSchema.safeParse(0);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toBe(0);
        }
      });

      it("should accept large integers", () => {
        const result = overrideValueSchema.safeParse(999999);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toBe(999999);
        }
      });

      it("should reject non-numeric string", () => {
        const result = overrideValueSchema.safeParse("abc");
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.errors[0].message).toBe("Override value must be a number");
        }
      });

      it("should reject float", () => {
        const result = overrideValueSchema.safeParse(1.5);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.errors[0].message).toBe("Override value must be an integer");
        }
      });

      it("should reject float string", () => {
        const result = overrideValueSchema.safeParse("1.5");
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.errors[0].message).toBe("Override value must be an integer");
        }
      });

      it("should reject value less than -1", () => {
        const result = overrideValueSchema.safeParse(-2);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.errors[0].message).toBe("Override value must be >= -1");
        }
      });

      it('should reject "NaN"', () => {
        const result = overrideValueSchema.safeParse("NaN");
        expect(result.success).toBe(false);
      });

      it('should reject "Infinity"', () => {
        const result = overrideValueSchema.safeParse("Infinity");
        expect(result.success).toBe(false);
      });
    });
  });

  describe("ADMIN_PATH", () => {
    it("should be the correct path", () => {
      expect(ADMIN_PATH).toBe("/[locale]/admin/entitlements");
    });
  });

  describe("isAdminActionError", () => {
    it("should return true for AdminActionError instance", () => {
      const error = new AdminActionError("Test message", "TEST_CODE");
      expect(isAdminActionError(error)).toBe(true);
    });

    it("should return true for shape object with publicMessage", () => {
      const error = { publicMessage: "Test message" };
      expect(isAdminActionError(error)).toBe(true);
    });

    it("should return true for shape object with publicMessage and code", () => {
      const error = { publicMessage: "Test message", code: "CODE" };
      expect(isAdminActionError(error)).toBe(true);
    });

    it("should return true for serialized AdminActionError (JSON roundtrip)", () => {
      const original = new AdminActionError("Test", "CODE");
      const serialized = JSON.parse(JSON.stringify(original));
      // After JSON roundtrip, it's no longer instanceof, but has the shape
      expect(isAdminActionError(serialized)).toBe(true);
    });

    it("should return true for empty string publicMessage", () => {
      const error = { publicMessage: "" };
      expect(isAdminActionError(error)).toBe(true);
    });

    it("should return false for null", () => {
      expect(isAdminActionError(null)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(isAdminActionError(undefined)).toBe(false);
    });

    it("should return false for primitive string", () => {
      expect(isAdminActionError("error")).toBe(false);
    });

    it("should return false for primitive number", () => {
      expect(isAdminActionError(123)).toBe(false);
    });

    it("should return false for object with publicMessage as number", () => {
      const error = { publicMessage: 123 };
      expect(isAdminActionError(error)).toBe(false);
    });

    it("should return false for object with message only", () => {
      const error = { message: "Test" };
      expect(isAdminActionError(error)).toBe(false);
    });

    it("should return false for generic Error", () => {
      const error = new Error("Generic error");
      expect(isAdminActionError(error)).toBe(false);
    });
  });

  describe("logActionError", () => {
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
    });

    it("should log AdminActionError with publicMessage and code", () => {
      const error = new AdminActionError("Public message", "ERROR_CODE");
      const meta = { orgId: "org-123", planName: "pro" };

      logActionError("actionSwitchPlan", meta, error);

      expect(consoleErrorSpy).toHaveBeenCalledOnce();
      expect(consoleErrorSpy).toHaveBeenCalledWith("[EntitlementsAdmin] actionSwitchPlan failed", {
        orgId: "org-123",
        planName: "pro",
        error: {
          name: "AdminActionError",
          publicMessage: "Public message",
          code: "ERROR_CODE",
        },
      });
    });

    it("should log AdminActionError with undefined code", () => {
      const error = new AdminActionError("Public message");
      const meta = { orgId: "org-123" };

      logActionError("actionResetToFree", meta, error);

      expect(consoleErrorSpy).toHaveBeenCalledOnce();
      const call = consoleErrorSpy.mock.calls[0];
      expect(call[0]).toBe("[EntitlementsAdmin] actionResetToFree failed");
      expect(call[1].error.code).toBeUndefined();
    });

    it("should log generic Error with only name (no message)", () => {
      const error = new Error("Internal database error");
      error.name = "DatabaseError";
      const meta = { orgId: "org-123" };

      logActionError("actionSwitchPlan", meta, error);

      expect(consoleErrorSpy).toHaveBeenCalledOnce();
      expect(consoleErrorSpy).toHaveBeenCalledWith("[EntitlementsAdmin] actionSwitchPlan failed", {
        orgId: "org-123",
        error: {
          name: "DatabaseError",
          isError: true,
        },
      });

      // Verify error.message is NOT logged
      const loggedObject = consoleErrorSpy.mock.calls[0][1];
      expect(loggedObject.error).not.toHaveProperty("message");
    });

    it("should log non-Error value with valueType", () => {
      const error = "string error";
      const meta = { orgId: "org-123" };

      logActionError("actionSwitchPlan", meta, error);

      expect(consoleErrorSpy).toHaveBeenCalledOnce();
      expect(consoleErrorSpy).toHaveBeenCalledWith("[EntitlementsAdmin] actionSwitchPlan failed", {
        orgId: "org-123",
        error: {
          valueType: "string",
        },
      });
    });

    it("should log number with valueType", () => {
      const error = 404;
      const meta = { orgId: "org-123" };

      logActionError("actionSwitchPlan", meta, error);

      expect(consoleErrorSpy).toHaveBeenCalledOnce();
      const call = consoleErrorSpy.mock.calls[0];
      expect(call[1].error.valueType).toBe("number");
    });

    it("should not throw even with weird meta values", () => {
      const error = new AdminActionError("Test");
      const weirdMeta = {
        orgId: undefined,
        circularRef: {} as any,
      };
      weirdMeta.circularRef.self = weirdMeta.circularRef;

      expect(() => {
        logActionError("actionSwitchPlan", weirdMeta, error);
      }).not.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalledOnce();
    });
  });

  describe("enforceAdminAccess", () => {
    let mockSupabase: any;
    let mockAppContext: any;

    beforeEach(() => {
      vi.clearAllMocks();

      mockSupabase = {
        auth: {
          getUser: vi.fn(),
        },
      };

      mockAppContext = {
        activeOrgId: "org-123",
      };

      vi.mocked(createClient).mockResolvedValue(mockSupabase);
      vi.mocked(loadAppContextWithClient).mockResolvedValue(mockAppContext);
      vi.mocked(EntitlementsAdminService.assertDevModeEnabled).mockResolvedValue(undefined);
      vi.mocked(EntitlementsAdminService.assertOrgOwner).mockResolvedValue(undefined);
    });

    it("should return supabase and orgId on success", async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: "user-123" } },
        error: null,
      });

      const result = await enforceAdminAccess();

      expect(result).toEqual({
        supabase: mockSupabase,
        orgId: "org-123",
      });

      // Verify call order and arguments
      expect(createClient).toHaveBeenCalledOnce();
      expect(mockSupabase.auth.getUser).toHaveBeenCalledOnce();
      expect(loadAppContextWithClient).toHaveBeenCalledOnce();
      expect(loadAppContextWithClient).toHaveBeenCalledWith(mockSupabase);
      expect(EntitlementsAdminService.assertDevModeEnabled).toHaveBeenCalledOnce();
      expect(EntitlementsAdminService.assertDevModeEnabled).toHaveBeenCalledWith(mockSupabase);
      expect(EntitlementsAdminService.assertOrgOwner).toHaveBeenCalledOnce();
      expect(EntitlementsAdminService.assertOrgOwner).toHaveBeenCalledWith(mockSupabase, "org-123");
    });

    it("should throw when auth error occurs", async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: "Auth error" },
      });

      await expect(enforceAdminAccess()).rejects.toThrow("Not authenticated");

      // Verify subsequent calls were NOT made
      expect(loadAppContextWithClient).not.toHaveBeenCalled();
      expect(EntitlementsAdminService.assertDevModeEnabled).not.toHaveBeenCalled();
      expect(EntitlementsAdminService.assertOrgOwner).not.toHaveBeenCalled();
    });

    it("should throw when user is null", async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      await expect(enforceAdminAccess()).rejects.toThrow("Not authenticated");

      expect(loadAppContextWithClient).not.toHaveBeenCalled();
      expect(EntitlementsAdminService.assertDevModeEnabled).not.toHaveBeenCalled();
      expect(EntitlementsAdminService.assertOrgOwner).not.toHaveBeenCalled();
    });

    it("should throw when no active organization", async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: "user-123" } },
        error: null,
      });

      vi.mocked(loadAppContextWithClient).mockResolvedValue({ activeOrgId: null } as any);

      await expect(enforceAdminAccess()).rejects.toThrow("No active organization");

      // Verify service methods were NOT called
      expect(EntitlementsAdminService.assertDevModeEnabled).not.toHaveBeenCalled();
      expect(EntitlementsAdminService.assertOrgOwner).not.toHaveBeenCalled();
    });

    it("should throw when appContext is null", async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: "user-123" } },
        error: null,
      });

      vi.mocked(loadAppContextWithClient).mockResolvedValue(null);

      await expect(enforceAdminAccess()).rejects.toThrow("No active organization");

      expect(EntitlementsAdminService.assertDevModeEnabled).not.toHaveBeenCalled();
      expect(EntitlementsAdminService.assertOrgOwner).not.toHaveBeenCalled();
    });

    it("should propagate dev mode check failure", async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: "user-123" } },
        error: null,
      });

      const devModeError = new AdminActionError("Dev mode is disabled");
      vi.mocked(EntitlementsAdminService.assertDevModeEnabled).mockRejectedValue(devModeError);

      await expect(enforceAdminAccess()).rejects.toThrow("Dev mode is disabled");

      // Verify assertOrgOwner was NOT called after dev mode check fails
      expect(EntitlementsAdminService.assertOrgOwner).not.toHaveBeenCalled();
    });

    it("should propagate generic error from dev mode check", async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: "user-123" } },
        error: null,
      });

      const genericError = new Error("Database connection failed");
      vi.mocked(EntitlementsAdminService.assertDevModeEnabled).mockRejectedValue(genericError);

      await expect(enforceAdminAccess()).rejects.toThrow("Database connection failed");

      expect(EntitlementsAdminService.assertOrgOwner).not.toHaveBeenCalled();
    });

    it("should propagate org owner check failure", async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: "user-123" } },
        error: null,
      });

      const ownerError = new AdminActionError("Permission denied: not org owner");
      vi.mocked(EntitlementsAdminService.assertOrgOwner).mockRejectedValue(ownerError);

      await expect(enforceAdminAccess()).rejects.toThrow("Permission denied: not org owner");

      // Verify both checks were called in order (using built-in Vitest invocationCallOrder)
      const devModeOrder = vi.mocked(EntitlementsAdminService.assertDevModeEnabled).mock
        .invocationCallOrder[0];
      const orgOwnerOrder = vi.mocked(EntitlementsAdminService.assertOrgOwner).mock
        .invocationCallOrder[0];

      expect(devModeOrder).toBeLessThan(orgOwnerOrder);
    });

    it("should return orgId from appContext.activeOrgId", async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: "user-123" } },
        error: null,
      });

      const specificOrgId = "org-specific-456";
      vi.mocked(loadAppContextWithClient).mockResolvedValue({
        activeOrgId: specificOrgId,
      } as any);

      const result = await enforceAdminAccess();

      expect(result.orgId).toBe(specificOrgId);
      expect(EntitlementsAdminService.assertOrgOwner).toHaveBeenCalledWith(
        mockSupabase,
        specificOrgId
      );
    });

    it("should not create a second Supabase client", async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: "user-123" } },
        error: null,
      });

      await enforceAdminAccess();

      // Verify createClient called exactly once
      expect(createClient).toHaveBeenCalledTimes(1);

      // Verify the same client instance passed to all functions
      expect(loadAppContextWithClient).toHaveBeenCalledWith(mockSupabase);
      expect(EntitlementsAdminService.assertDevModeEnabled).toHaveBeenCalledWith(mockSupabase);
      expect(EntitlementsAdminService.assertOrgOwner).toHaveBeenCalledWith(
        mockSupabase,
        expect.any(String)
      );
    });
  });
});
