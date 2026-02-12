/**
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  actionSwitchPlan,
  actionAddModuleAddon,
  actionRemoveModuleAddon,
  actionSetLimitOverride,
  actionResetToFree,
} from "../actions";
import { LIMIT_KEYS } from "@/lib/types/entitlements";

// Mock dependencies
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/server/services/entitlements-admin.service", async () => {
  const actual = await vi.importActual<
    typeof import("@/server/services/entitlements-admin.service")
  >("@/server/services/entitlements-admin.service");

  return {
    ...actual,
    EntitlementsAdminService: {
      ...actual.EntitlementsAdminService,
      switchPlan: vi.fn(),
      addModuleAddon: vi.fn(),
      removeModuleAddon: vi.fn(),
      setLimitOverride: vi.fn(),
      resetToFree: vi.fn(),
    },
  };
});

vi.mock("../actions.server", async () => {
  const actual = await vi.importActual<typeof import("../actions.server")>("../actions.server");

  return {
    ...actual,
    // Keep schemas mocked for unit test control flow
    planNameSchema: {
      safeParse: vi.fn((val) => {
        if (typeof val === "string" && val.length > 0) {
          return { success: true, data: val };
        }
        return { success: false, error: { errors: [{ message: "Plan name is required" }] } };
      }),
    },
    moduleSlugSchema: {
      safeParse: vi.fn((val) => {
        if (typeof val === "string" && val.length > 0) {
          return { success: true, data: val };
        }
        return { success: false, error: { errors: [{ message: "Module slug is required" }] } };
      }),
    },
    limitKeySchema: {
      safeParse: vi.fn((val) => {
        const validKeys = Object.values(LIMIT_KEYS);
        if (validKeys.includes(val as any)) {
          return { success: true, data: val };
        }
        return { success: false, error: { errors: [{ message: "Invalid limit key" }] } };
      }),
    },
    overrideValueSchema: {
      safeParse: vi.fn((val) => {
        const num = typeof val === "string" ? parseFloat(val) : val;
        if (isNaN(num)) {
          return {
            success: false,
            error: { errors: [{ message: "Override value must be a number" }] },
          };
        }
        if (!Number.isInteger(num)) {
          return {
            success: false,
            error: { errors: [{ message: "Override value must be an integer" }] },
          };
        }
        if (num < -1) {
          return {
            success: false,
            error: { errors: [{ message: "Override value must be >= -1" }] },
          };
        }
        return { success: true, data: num };
      }),
    },
    ADMIN_PATH: "/[locale]/admin/entitlements",
    enforceAdminAccess: vi.fn(),
    logActionError: vi.fn(),
    // Use REAL isAdminActionError (not mocked) - Goal A
    // isAdminActionError: actual.isAdminActionError (implicit via ...actual)
  };
});

import { revalidatePath } from "next/cache";
import {
  EntitlementsAdminService,
  AdminActionError,
} from "@/server/services/entitlements-admin.service";
import { enforceAdminAccess, logActionError, ADMIN_PATH } from "../actions.server";

describe("Entitlements Admin Actions", () => {
  const mockSupabase = {} as any;
  const mockOrgId = "org-123";
  const mockCtx = { supabase: mockSupabase, orgId: mockOrgId };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(enforceAdminAccess).mockResolvedValue(mockCtx);
  });

  describe("actionSwitchPlan", () => {
    it("should succeed and return ok: true", async () => {
      vi.mocked(EntitlementsAdminService.switchPlan).mockResolvedValue(undefined);

      const result = await actionSwitchPlan("pro");

      expect(result).toEqual({ ok: true });
      expect(enforceAdminAccess).toHaveBeenCalledOnce();
      expect(EntitlementsAdminService.switchPlan).toHaveBeenCalledOnce();
      expect(EntitlementsAdminService.switchPlan).toHaveBeenCalledWith(
        mockSupabase,
        mockOrgId,
        "pro"
      );
      expect(revalidatePath).toHaveBeenCalledOnce();
      expect(revalidatePath).toHaveBeenCalledWith(ADMIN_PATH, "page");
      expect(logActionError).not.toHaveBeenCalled();
    });

    it("should return validation error for empty plan name", async () => {
      const result = await actionSwitchPlan("");

      expect(result).toEqual({ ok: false, message: "Plan name is required" });
      expect(enforceAdminAccess).not.toHaveBeenCalled();
      expect(EntitlementsAdminService.switchPlan).not.toHaveBeenCalled();
      expect(revalidatePath).not.toHaveBeenCalled();
      expect(logActionError).not.toHaveBeenCalled();
    });

    it("should return publicMessage when enforceAdminAccess throws AdminActionError", async () => {
      const error = new AdminActionError("Dev mode is disabled", "DEV_MODE_DISABLED");
      vi.mocked(enforceAdminAccess).mockRejectedValue(error);

      const result = await actionSwitchPlan("pro");

      expect(result).toEqual({ ok: false, message: "Dev mode is disabled" });
      expect(logActionError).toHaveBeenCalledOnce();
      expect(logActionError).toHaveBeenCalledWith(
        "actionSwitchPlan",
        { orgId: undefined, planName: "pro" },
        error
      );
      expect(revalidatePath).not.toHaveBeenCalled();
    });

    it("should return fallback message when enforceAdminAccess throws generic Error", async () => {
      const error = new Error("Internal database error");
      vi.mocked(enforceAdminAccess).mockRejectedValue(error);

      const result = await actionSwitchPlan("pro");

      expect(result).toEqual({ ok: false, message: "Failed to switch plan" });
      expect(logActionError).toHaveBeenCalledOnce();
    });

    it("should return publicMessage when service throws AdminActionError", async () => {
      const error = new AdminActionError("Plan not found", "PLAN_NOT_FOUND");
      vi.mocked(EntitlementsAdminService.switchPlan).mockRejectedValue(error);

      const result = await actionSwitchPlan("invalid-plan");

      expect(result).toEqual({ ok: false, message: "Plan not found" });
      expect(logActionError).toHaveBeenCalledOnce();
      expect(logActionError).toHaveBeenCalledWith(
        "actionSwitchPlan",
        { orgId: mockOrgId, planName: "invalid-plan" },
        error
      );
    });

    it("should return fallback message when service throws generic Error", async () => {
      const error = new Error("permission denied for table plans");
      vi.mocked(EntitlementsAdminService.switchPlan).mockRejectedValue(error);

      const result = await actionSwitchPlan("pro");

      expect(result).toEqual({ ok: false, message: "Failed to switch plan" });
      expect(logActionError).toHaveBeenCalledOnce();
      // Verify the raw error message is NOT returned
      expect(result.message).not.toContain("permission denied");
    });

    it("should include orgId in logActionError meta when available", async () => {
      const error = new AdminActionError("Test error");
      vi.mocked(EntitlementsAdminService.switchPlan).mockRejectedValue(error);

      await actionSwitchPlan("pro");

      expect(logActionError).toHaveBeenCalledWith(
        "actionSwitchPlan",
        { orgId: mockOrgId, planName: "pro" },
        error
      );
    });
  });

  describe("actionAddModuleAddon", () => {
    it("should succeed and return ok: true", async () => {
      vi.mocked(EntitlementsAdminService.addModuleAddon).mockResolvedValue(undefined);

      const result = await actionAddModuleAddon("analytics");

      expect(result).toEqual({ ok: true });
      expect(EntitlementsAdminService.addModuleAddon).toHaveBeenCalledWith(
        mockSupabase,
        mockOrgId,
        "analytics"
      );
      expect(revalidatePath).toHaveBeenCalledWith(ADMIN_PATH, "page");
    });

    it("should return validation error for empty module slug", async () => {
      const result = await actionAddModuleAddon("");

      expect(result).toEqual({ ok: false, message: "Module slug is required" });
      expect(enforceAdminAccess).not.toHaveBeenCalled();
      expect(EntitlementsAdminService.addModuleAddon).not.toHaveBeenCalled();
    });

    it("should return publicMessage on AdminActionError", async () => {
      const error = new AdminActionError("Module addon already exists");
      vi.mocked(EntitlementsAdminService.addModuleAddon).mockRejectedValue(error);

      const result = await actionAddModuleAddon("analytics");

      expect(result).toEqual({ ok: false, message: "Module addon already exists" });
      expect(logActionError).toHaveBeenCalledWith(
        "actionAddModuleAddon",
        { orgId: mockOrgId, moduleSlug: "analytics" },
        error
      );
    });

    it("should return fallback message on generic Error", async () => {
      const error = new Error("Database constraint violation");
      vi.mocked(EntitlementsAdminService.addModuleAddon).mockRejectedValue(error);

      const result = await actionAddModuleAddon("analytics");

      expect(result).toEqual({ ok: false, message: "Failed to add module addon" });
    });
  });

  describe("actionRemoveModuleAddon", () => {
    it("should succeed and return ok: true", async () => {
      vi.mocked(EntitlementsAdminService.removeModuleAddon).mockResolvedValue(undefined);

      const result = await actionRemoveModuleAddon("analytics");

      expect(result).toEqual({ ok: true });
      expect(EntitlementsAdminService.removeModuleAddon).toHaveBeenCalledWith(
        mockSupabase,
        mockOrgId,
        "analytics"
      );
      expect(revalidatePath).toHaveBeenCalledWith(ADMIN_PATH, "page");
    });

    it("should return validation error for empty module slug", async () => {
      const result = await actionRemoveModuleAddon("");

      expect(result).toEqual({ ok: false, message: "Module slug is required" });
      expect(EntitlementsAdminService.removeModuleAddon).not.toHaveBeenCalled();
    });

    it("should return publicMessage on AdminActionError", async () => {
      const error = new AdminActionError("Module addon not found");
      vi.mocked(EntitlementsAdminService.removeModuleAddon).mockRejectedValue(error);

      const result = await actionRemoveModuleAddon("analytics");

      expect(result).toEqual({ ok: false, message: "Module addon not found" });
      expect(logActionError).toHaveBeenCalledWith(
        "actionRemoveModuleAddon",
        { orgId: mockOrgId, moduleSlug: "analytics" },
        error
      );
    });

    it("should return fallback message on generic Error", async () => {
      const error = new Error("Foreign key constraint");
      vi.mocked(EntitlementsAdminService.removeModuleAddon).mockRejectedValue(error);

      const result = await actionRemoveModuleAddon("analytics");

      expect(result).toEqual({ ok: false, message: "Failed to remove module addon" });
    });
  });

  describe("actionSetLimitOverride", () => {
    const validLimitKey = LIMIT_KEYS.WAREHOUSE_MAX_LOCATIONS;

    it("should succeed with number value", async () => {
      vi.mocked(EntitlementsAdminService.setLimitOverride).mockResolvedValue(undefined);

      const result = await actionSetLimitOverride(validLimitKey, 10);

      expect(result).toEqual({ ok: true });
      expect(EntitlementsAdminService.setLimitOverride).toHaveBeenCalledWith(
        mockSupabase,
        mockOrgId,
        validLimitKey,
        10
      );
      expect(revalidatePath).toHaveBeenCalledWith(ADMIN_PATH, "page");
    });

    it("should succeed with numeric string (coerce)", async () => {
      vi.mocked(EntitlementsAdminService.setLimitOverride).mockResolvedValue(undefined);

      const result = await actionSetLimitOverride(validLimitKey, "5");

      expect(result).toEqual({ ok: true });
      expect(EntitlementsAdminService.setLimitOverride).toHaveBeenCalledWith(
        mockSupabase,
        mockOrgId,
        validLimitKey,
        5
      );
    });

    it("should accept -1 value", async () => {
      vi.mocked(EntitlementsAdminService.setLimitOverride).mockResolvedValue(undefined);

      const result = await actionSetLimitOverride(validLimitKey, -1);

      expect(result).toEqual({ ok: true });
      expect(EntitlementsAdminService.setLimitOverride).toHaveBeenCalledWith(
        mockSupabase,
        mockOrgId,
        validLimitKey,
        -1
      );
    });

    it("should return error for invalid limit key", async () => {
      const result = await actionSetLimitOverride("invalid.key", 10);

      expect(result).toEqual({ ok: false, message: "Invalid limit key" });
      expect(EntitlementsAdminService.setLimitOverride).not.toHaveBeenCalled();
    });

    it("should return error for non-numeric value", async () => {
      const result = await actionSetLimitOverride(validLimitKey, "abc" as any);

      expect(result).toEqual({ ok: false, message: "Override value must be a number" });
      expect(EntitlementsAdminService.setLimitOverride).not.toHaveBeenCalled();
    });

    it("should return error for float value", async () => {
      const result = await actionSetLimitOverride(validLimitKey, 1.5);

      expect(result).toEqual({ ok: false, message: "Override value must be an integer" });
      expect(EntitlementsAdminService.setLimitOverride).not.toHaveBeenCalled();
    });

    it("should return error for value less than -1", async () => {
      const result = await actionSetLimitOverride(validLimitKey, -2);

      expect(result).toEqual({ ok: false, message: "Override value must be >= -1" });
      expect(EntitlementsAdminService.setLimitOverride).not.toHaveBeenCalled();
    });

    it("should return publicMessage on AdminActionError", async () => {
      const error = new AdminActionError("Limit override failed");
      vi.mocked(EntitlementsAdminService.setLimitOverride).mockRejectedValue(error);

      const result = await actionSetLimitOverride(validLimitKey, 10);

      expect(result).toEqual({ ok: false, message: "Limit override failed" });
      expect(logActionError).toHaveBeenCalledWith(
        "actionSetLimitOverride",
        { orgId: mockOrgId, limitKey: validLimitKey, overrideValue: 10 },
        error
      );
    });

    it("should return fallback message on generic Error", async () => {
      const error = new Error("Database write failed");
      vi.mocked(EntitlementsAdminService.setLimitOverride).mockRejectedValue(error);

      const result = await actionSetLimitOverride(validLimitKey, 10);

      expect(result).toEqual({ ok: false, message: "Failed to set limit override" });
    });

    it("should include all params in logActionError meta", async () => {
      const error = new AdminActionError("Test");
      vi.mocked(EntitlementsAdminService.setLimitOverride).mockRejectedValue(error);

      await actionSetLimitOverride(validLimitKey, 100);

      expect(logActionError).toHaveBeenCalledWith(
        "actionSetLimitOverride",
        { orgId: mockOrgId, limitKey: validLimitKey, overrideValue: 100 },
        error
      );
    });
  });

  describe("actionResetToFree", () => {
    it("should succeed and return ok: true", async () => {
      vi.mocked(EntitlementsAdminService.resetToFree).mockResolvedValue(undefined);

      const result = await actionResetToFree();

      expect(result).toEqual({ ok: true });
      expect(EntitlementsAdminService.resetToFree).toHaveBeenCalledWith(mockSupabase, mockOrgId);
      expect(revalidatePath).toHaveBeenCalledWith(ADMIN_PATH, "page");
    });

    it("should return publicMessage on AdminActionError", async () => {
      const error = new AdminActionError("Cannot reset active subscription");
      vi.mocked(EntitlementsAdminService.resetToFree).mockRejectedValue(error);

      const result = await actionResetToFree();

      expect(result).toEqual({ ok: false, message: "Cannot reset active subscription" });
      expect(logActionError).toHaveBeenCalledWith("actionResetToFree", { orgId: mockOrgId }, error);
    });

    it("should return fallback message on generic Error", async () => {
      const error = new Error("Transaction rollback");
      vi.mocked(EntitlementsAdminService.resetToFree).mockRejectedValue(error);

      const result = await actionResetToFree();

      expect(result).toEqual({ ok: false, message: "Failed to reset to free plan" });
    });

    it("should include orgId in logActionError meta", async () => {
      const error = new AdminActionError("Test");
      vi.mocked(EntitlementsAdminService.resetToFree).mockRejectedValue(error);

      await actionResetToFree();

      expect(logActionError).toHaveBeenCalledWith("actionResetToFree", { orgId: mockOrgId }, error);
    });

    it("should handle enforceAdminAccess failure", async () => {
      const error = new AdminActionError("Permission denied: not org owner");
      vi.mocked(enforceAdminAccess).mockRejectedValue(error);

      const result = await actionResetToFree();

      expect(result).toEqual({ ok: false, message: "Permission denied: not org owner" });
      expect(EntitlementsAdminService.resetToFree).not.toHaveBeenCalled();
      expect(logActionError).toHaveBeenCalledWith("actionResetToFree", { orgId: undefined }, error);
    });
  });
});
