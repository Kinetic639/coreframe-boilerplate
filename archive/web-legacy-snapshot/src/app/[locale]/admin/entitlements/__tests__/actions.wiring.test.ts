/**
 * @vitest-environment node
 *
 * Wiring tests: Use REAL schemas + REAL action modules
 * Mock only external I/O (Supabase, service methods, revalidatePath)
 *
 * Purpose: Verify that actions correctly wire to schemas and that
 * validation actually happens with production schema logic.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { LIMIT_KEYS } from "@/lib/types/entitlements";

// Mock only I/O, NOT schemas or AdminActionError
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
      assertDevModeEnabled: vi.fn().mockResolvedValue(undefined),
      assertOrgOwner: vi.fn().mockResolvedValue(undefined),
      switchPlan: vi.fn().mockResolvedValue(undefined),
      addModuleAddon: vi.fn().mockResolvedValue(undefined),
      setLimitOverride: vi.fn().mockResolvedValue(undefined),
    },
  };
});

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/api/load-app-context-server", () => ({
  loadAppContextWithClient: vi.fn(),
}));

// Import AFTER mocks
import { revalidatePath } from "next/cache";
import { actionSwitchPlan, actionAddModuleAddon, actionSetLimitOverride } from "../actions";
import {
  EntitlementsAdminService,
  AdminActionError,
} from "@/server/services/entitlements-admin.service";
import { createClient } from "@/utils/supabase/server";
import { loadAppContextWithClient } from "@/lib/api/load-app-context-server";

describe("Actions Wiring Tests (Real Schemas)", () => {
  const mockSupabase = {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
    rpc: vi.fn(),
  } as any;

  const mockAppContext = {
    activeOrgId: "org-123",
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mocks for enforceAdminAccess dependencies
    vi.mocked(createClient).mockResolvedValue(mockSupabase);
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "user-123" } },
      error: null,
    });
    vi.mocked(loadAppContextWithClient).mockResolvedValue(mockAppContext as any);

    // No need to mock Supabase queries - we mock the service methods directly
  });

  describe("actionSwitchPlan - Real Schema Validation", () => {
    it("should reject empty string with REAL schema error message", async () => {
      const result = await actionSwitchPlan("");

      expect(result).toEqual({
        ok: false,
        message: "Plan name is required", // Real Zod error
      });

      // Verify service was NOT called
      expect(EntitlementsAdminService.switchPlan).not.toHaveBeenCalled();
      expect(revalidatePath).not.toHaveBeenCalled();
    });

    it("should succeed with valid plan name using REAL schema", async () => {
      const result = await actionSwitchPlan("pro");

      expect(result).toEqual({ ok: true });
      expect(EntitlementsAdminService.switchPlan).toHaveBeenCalledWith(
        mockSupabase,
        "org-123",
        "pro"
      );
      expect(revalidatePath).toHaveBeenCalledWith("/[locale]/admin/entitlements", "page");
    });

    it("should handle AdminActionError with real error class", async () => {
      const realError = new AdminActionError("Plan not found", "PLAN_NOT_FOUND");
      vi.mocked(EntitlementsAdminService.switchPlan).mockRejectedValue(realError);

      const result = await actionSwitchPlan("invalid-plan");

      expect(result).toEqual({
        ok: false,
        message: "Plan not found",
      });

      // Verify real AdminActionError properties
      expect(realError).toBeInstanceOf(AdminActionError);
      expect(realError.publicMessage).toBe("Plan not found");
      expect(realError.code).toBe("PLAN_NOT_FOUND");
    });
  });

  describe("actionSetLimitOverride - Real Schema Validation", () => {
    const validLimitKey = LIMIT_KEYS.WAREHOUSE_MAX_LOCATIONS;

    it("should reject invalid limit key with REAL schema", async () => {
      const result = await actionSetLimitOverride("invalid.key.not.in.enum", 10);

      expect(result.ok).toBe(false);
      // Type assertion after checking ok: false
      expect((result as { ok: false; message: string }).message).toContain("Invalid"); // Real Zod enum error

      expect(EntitlementsAdminService.setLimitOverride).not.toHaveBeenCalled();
    });

    it("should reject non-numeric string with REAL schema error", async () => {
      const result = await actionSetLimitOverride(validLimitKey, "abc" as any);

      expect(result).toEqual({
        ok: false,
        message: "Override value must be a number",
      });

      expect(EntitlementsAdminService.setLimitOverride).not.toHaveBeenCalled();
    });

    it("should reject float with REAL schema error", async () => {
      const result = await actionSetLimitOverride(validLimitKey, 1.5);

      expect(result).toEqual({
        ok: false,
        message: "Override value must be an integer",
      });

      expect(EntitlementsAdminService.setLimitOverride).not.toHaveBeenCalled();
    });

    it("should reject value < -1 with REAL schema error", async () => {
      const result = await actionSetLimitOverride(validLimitKey, -2);

      expect(result).toEqual({
        ok: false,
        message: "Override value must be >= -1",
      });

      expect(EntitlementsAdminService.setLimitOverride).not.toHaveBeenCalled();
    });

    it("should accept -1 (unlimited) using REAL schema", async () => {
      const result = await actionSetLimitOverride(validLimitKey, -1);

      expect(result).toEqual({ ok: true });
      expect(EntitlementsAdminService.setLimitOverride).toHaveBeenCalledWith(
        mockSupabase,
        "org-123",
        validLimitKey,
        -1
      );
    });

    it("should coerce numeric string using REAL schema", async () => {
      const result = await actionSetLimitOverride(validLimitKey, "50" as any);

      expect(result).toEqual({ ok: true });
      expect(EntitlementsAdminService.setLimitOverride).toHaveBeenCalledWith(
        mockSupabase,
        "org-123",
        validLimitKey,
        50 // Coerced to number
      );
    });
  });

  describe("actionAddModuleAddon - Real Schema Validation", () => {
    it("should reject empty module slug with REAL schema error", async () => {
      const result = await actionAddModuleAddon("");

      expect(result).toEqual({
        ok: false,
        message: "Module slug is required",
      });

      expect(EntitlementsAdminService.addModuleAddon).not.toHaveBeenCalled();
    });

    it("should succeed with valid module slug using REAL schema", async () => {
      const result = await actionAddModuleAddon("analytics");

      expect(result).toEqual({ ok: true });
      expect(EntitlementsAdminService.addModuleAddon).toHaveBeenCalledWith(
        mockSupabase,
        "org-123",
        "analytics"
      );
      expect(revalidatePath).toHaveBeenCalled();
    });
  });

  describe("Real AdminActionError Integration", () => {
    it("should correctly identify real AdminActionError instances", async () => {
      const realError = new AdminActionError("Test error", "TEST_CODE");

      expect(realError).toBeInstanceOf(Error);
      expect(realError).toBeInstanceOf(AdminActionError);
      expect(realError.name).toBe("AdminActionError");
      expect(realError.publicMessage).toBe("Test error");
      expect(realError.code).toBe("TEST_CODE");
      expect(realError.message).toBe("Test error");
    });

    it("should handle serialized AdminActionError (shape-based detection)", async () => {
      const original = new AdminActionError("Original", "CODE");
      const serialized = JSON.parse(JSON.stringify(original));

      // After JSON roundtrip, instanceof fails but shape-based detection should work
      expect(serialized).not.toBeInstanceOf(AdminActionError);
      expect(serialized).toHaveProperty("publicMessage");
      expect(typeof serialized.publicMessage).toBe("string");
    });
  });
});
