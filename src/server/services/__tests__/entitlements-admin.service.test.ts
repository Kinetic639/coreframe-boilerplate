/**
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EntitlementsAdminService, AdminActionError } from "../entitlements-admin.service";

describe("EntitlementsAdminService", () => {
  let mockSupabase: any;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    mockSupabase = {
      from: vi.fn(),
      rpc: vi.fn(),
    };
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe("AdminActionError", () => {
    it("should have correct properties", () => {
      const error = new AdminActionError("Public message", "ERROR_CODE");

      expect(error.name).toBe("AdminActionError");
      expect(error.publicMessage).toBe("Public message");
      expect(error.code).toBe("ERROR_CODE");
      expect(error.message).toBe("Public message");
    });

    it("should work without code", () => {
      const error = new AdminActionError("Public message");

      expect(error.name).toBe("AdminActionError");
      expect(error.publicMessage).toBe("Public message");
      expect(error.code).toBeUndefined();
    });

    it("should be instanceof Error", () => {
      const error = new AdminActionError("Test");
      expect(error instanceof Error).toBe(true);
    });
  });

  describe("assertDevModeEnabled", () => {
    it("should resolve when dev_mode_enabled is true", async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { dev_mode_enabled: true },
          error: null,
        }),
      };

      mockSupabase.from.mockReturnValue(mockQuery);

      await expect(
        EntitlementsAdminService.assertDevModeEnabled(mockSupabase)
      ).resolves.toBeUndefined();

      expect(mockSupabase.from).toHaveBeenCalledWith("app_config");
      expect(mockQuery.select).toHaveBeenCalledWith("dev_mode_enabled");
      expect(mockQuery.eq).toHaveBeenCalledWith("id", 1);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it("should throw AdminActionError when query fails", async () => {
      const mockError = {
        code: "PGRST116",
        message: "Table not found",
        details: "Some details",
      };

      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: null,
          error: mockError,
        }),
      };

      mockSupabase.from.mockReturnValue(mockQuery);

      // Call once and capture error
      const thrownError = await EntitlementsAdminService.assertDevModeEnabled(mockSupabase).catch(
        (e) => e
      );

      // Verify error properties
      expect(thrownError).toBeInstanceOf(AdminActionError);
      expect(thrownError.message).toBe("Failed to check dev mode status");
      expect(thrownError.code).toBe("PGRST116");

      // Verify console.error was called with sanitized details
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[EntitlementsAdminService] assertDevModeEnabled query failed",
        {
          code: "PGRST116",
          message: "Table not found",
          details: "Some details",
        }
      );
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });

    it("should throw AdminActionError when dev mode is disabled", async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { dev_mode_enabled: false },
          error: null,
        }),
      };

      mockSupabase.from.mockReturnValue(mockQuery);

      await expect(EntitlementsAdminService.assertDevModeEnabled(mockSupabase)).rejects.toThrow(
        AdminActionError
      );

      await expect(EntitlementsAdminService.assertDevModeEnabled(mockSupabase)).rejects.toThrow(
        "Dev mode is disabled"
      );

      // Should NOT log console.error (only logs on query error)
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it("should throw when data is null", async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      };

      mockSupabase.from.mockReturnValue(mockQuery);

      await expect(EntitlementsAdminService.assertDevModeEnabled(mockSupabase)).rejects.toThrow(
        "Dev mode is disabled"
      );

      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it("should throw when dev_mode_enabled is null", async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { dev_mode_enabled: null },
          error: null,
        }),
      };

      mockSupabase.from.mockReturnValue(mockQuery);

      await expect(EntitlementsAdminService.assertDevModeEnabled(mockSupabase)).rejects.toThrow(
        "Dev mode is disabled"
      );
    });
  });

  describe("assertOrgOwner", () => {
    it("should resolve when RPC returns true", async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: true,
        error: null,
      });

      await expect(
        EntitlementsAdminService.assertOrgOwner(mockSupabase, "org-123")
      ).resolves.toBeUndefined();

      expect(mockSupabase.rpc).toHaveBeenCalledWith("is_org_owner", {
        p_org_id: "org-123",
      });
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it("should throw AdminActionError when RPC fails", async () => {
      const mockError = {
        code: "42P01",
        message: "undefined_function",
      };

      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: mockError,
      });

      // Call once and capture error
      const thrownError = await EntitlementsAdminService.assertOrgOwner(
        mockSupabase,
        "org-123"
      ).catch((e) => e);

      // Verify error properties
      expect(thrownError).toBeInstanceOf(AdminActionError);
      expect(thrownError.message).toBe("Failed to verify org ownership");
      expect(thrownError.code).toBe("42P01");

      // Verify console.error was called
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[EntitlementsAdminService] is_org_owner RPC failed",
        {
          orgId: "org-123",
          code: "42P01",
          message: "undefined_function",
        }
      );
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });

    it("should throw AdminActionError when not org owner", async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: false,
        error: null,
      });

      await expect(
        EntitlementsAdminService.assertOrgOwner(mockSupabase, "org-123")
      ).rejects.toThrow(AdminActionError);

      await expect(
        EntitlementsAdminService.assertOrgOwner(mockSupabase, "org-123")
      ).rejects.toThrow("Permission denied: not org owner");

      // Should NOT log console.error (only logs on RPC error)
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it("should throw when RPC returns null", async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: null,
      });

      await expect(
        EntitlementsAdminService.assertOrgOwner(mockSupabase, "org-123")
      ).rejects.toThrow("Permission denied: not org owner");

      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe("switchPlan", () => {
    it("should call dev_set_org_plan RPC with correct params", async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: null,
      });

      await EntitlementsAdminService.switchPlan(mockSupabase, "org-123", "pro");

      expect(mockSupabase.rpc).toHaveBeenCalledWith("dev_set_org_plan", {
        p_org_id: "org-123",
        p_plan_name: "pro",
      });
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it("should throw AdminActionError when RPC fails", async () => {
      const mockError = {
        code: "23503",
        message: "foreign key violation",
      };

      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: mockError,
      });

      // Call once and capture error
      const thrownError = await EntitlementsAdminService.switchPlan(
        mockSupabase,
        "org-123",
        "invalid-plan"
      ).catch((e) => e);

      // Verify error properties
      expect(thrownError).toBeInstanceOf(AdminActionError);
      expect(thrownError.message).toBe("Failed to switch plan");
      expect(thrownError.code).toBe("23503");

      // Verify logging
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[EntitlementsAdminService] dev_set_org_plan RPC failed",
        {
          orgId: "org-123",
          planName: "invalid-plan",
          code: "23503",
          message: "foreign key violation",
        }
      );
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("addModuleAddon", () => {
    it("should call dev_add_module_addon RPC with correct params", async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: null,
      });

      await EntitlementsAdminService.addModuleAddon(mockSupabase, "org-123", "analytics");

      expect(mockSupabase.rpc).toHaveBeenCalledWith("dev_add_module_addon", {
        p_org_id: "org-123",
        p_module_slug: "analytics",
      });
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it("should throw AdminActionError when RPC fails", async () => {
      const mockError = {
        code: "P0001",
        message: "Module addon already exists",
      };

      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: mockError,
      });

      await expect(
        EntitlementsAdminService.addModuleAddon(mockSupabase, "org-123", "analytics")
      ).rejects.toThrow(AdminActionError);

      await expect(
        EntitlementsAdminService.addModuleAddon(mockSupabase, "org-123", "analytics")
      ).rejects.toThrow("Failed to add module addon");

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[EntitlementsAdminService] dev_add_module_addon RPC failed",
        {
          orgId: "org-123",
          moduleSlug: "analytics",
          code: "P0001",
          message: "Module addon already exists",
        }
      );
    });
  });

  describe("removeModuleAddon", () => {
    it("should call dev_remove_module_addon RPC with correct params", async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: null,
      });

      await EntitlementsAdminService.removeModuleAddon(mockSupabase, "org-123", "analytics");

      expect(mockSupabase.rpc).toHaveBeenCalledWith("dev_remove_module_addon", {
        p_org_id: "org-123",
        p_module_slug: "analytics",
      });
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it("should throw AdminActionError when RPC fails", async () => {
      const mockError = {
        code: "P0001",
        message: "Module addon not found",
      };

      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: mockError,
      });

      await expect(
        EntitlementsAdminService.removeModuleAddon(mockSupabase, "org-123", "analytics")
      ).rejects.toThrow(AdminActionError);

      await expect(
        EntitlementsAdminService.removeModuleAddon(mockSupabase, "org-123", "analytics")
      ).rejects.toThrow("Failed to remove module addon");

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[EntitlementsAdminService] dev_remove_module_addon RPC failed",
        {
          orgId: "org-123",
          moduleSlug: "analytics",
          code: "P0001",
          message: "Module addon not found",
        }
      );
    });
  });

  describe("setLimitOverride", () => {
    it("should call dev_set_limit_override RPC with correct params", async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: null,
      });

      await EntitlementsAdminService.setLimitOverride(
        mockSupabase,
        "org-123",
        "warehouse.max_locations",
        50
      );

      expect(mockSupabase.rpc).toHaveBeenCalledWith("dev_set_limit_override", {
        p_org_id: "org-123",
        p_limit_key: "warehouse.max_locations",
        p_override_value: 50,
      });
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it("should accept -1 value", async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: null,
      });

      await EntitlementsAdminService.setLimitOverride(
        mockSupabase,
        "org-123",
        "warehouse.max_products",
        -1
      );

      expect(mockSupabase.rpc).toHaveBeenCalledWith("dev_set_limit_override", {
        p_org_id: "org-123",
        p_limit_key: "warehouse.max_products",
        p_override_value: -1,
      });
    });

    it("should throw AdminActionError when RPC fails", async () => {
      const mockError = {
        code: "23514",
        message: "check constraint violation",
      };

      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: mockError,
      });

      await expect(
        EntitlementsAdminService.setLimitOverride(mockSupabase, "org-123", "invalid.key", 100)
      ).rejects.toThrow(AdminActionError);

      await expect(
        EntitlementsAdminService.setLimitOverride(mockSupabase, "org-123", "invalid.key", 100)
      ).rejects.toThrow("Failed to set limit override");

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[EntitlementsAdminService] dev_set_limit_override RPC failed",
        {
          orgId: "org-123",
          limitKey: "invalid.key",
          value: 100,
          code: "23514",
          message: "check constraint violation",
        }
      );
    });
  });

  describe("resetToFree", () => {
    it("should call dev_reset_org_to_free RPC with correct params", async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: null,
      });

      await EntitlementsAdminService.resetToFree(mockSupabase, "org-123");

      expect(mockSupabase.rpc).toHaveBeenCalledWith("dev_reset_org_to_free", {
        p_org_id: "org-123",
      });
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it("should throw AdminActionError when RPC fails", async () => {
      const mockError = {
        code: "P0001",
        message: "Cannot reset with active subscription",
      };

      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: mockError,
      });

      await expect(EntitlementsAdminService.resetToFree(mockSupabase, "org-123")).rejects.toThrow(
        AdminActionError
      );

      await expect(EntitlementsAdminService.resetToFree(mockSupabase, "org-123")).rejects.toThrow(
        "Failed to reset to free plan"
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[EntitlementsAdminService] dev_reset_org_to_free RPC failed",
        {
          orgId: "org-123",
          code: "P0001",
          message: "Cannot reset with active subscription",
        }
      );
    });
  });
});
