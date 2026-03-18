/**
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EntitlementsService } from "../entitlements-service";
import {
  EntitlementError,
  LIMIT_KEYS,
  type OrganizationEntitlements,
} from "@/lib/types/entitlements";

// Mock dependencies
vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@/utils/supabase/server";

describe("EntitlementsService", () => {
  let mockSupabase: any;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  const mockEntitlements: OrganizationEntitlements = {
    organization_id: "org-123",
    plan_id: "plan-pro-123",
    plan_name: "pro",
    enabled_modules: ["warehouse", "teams"],
    enabled_contexts: ["b2b", "ecommerce"],
    features: {
      advanced_analytics: true,
      priority_support: true,
      basic_feature: false,
      number_feature: 123 as any, // Test non-boolean values
    },
    limits: {
      [LIMIT_KEYS.WAREHOUSE_MAX_LOCATIONS]: 50,
      [LIMIT_KEYS.WAREHOUSE_MAX_PRODUCTS]: -1, // unlimited
      "custom.limit": 100,
    },
    updated_at: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-12T10:00:00Z"));

    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    mockSupabase = {
      from: vi.fn(),
      rpc: vi.fn(),
    };

    vi.mocked(createClient).mockResolvedValue(mockSupabase);
  });

  afterEach(() => {
    vi.useRealTimers();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe("loadEntitlements", () => {
    it("should load entitlements from database", async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockEntitlements,
          error: null,
        }),
      };

      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await EntitlementsService.loadEntitlements("org-123");

      expect(result).toEqual(mockEntitlements);
      expect(mockSupabase.from).toHaveBeenCalledWith("organization_entitlements");
      expect(mockQuery.select).toHaveBeenCalledWith("*");
      expect(mockQuery.eq).toHaveBeenCalledWith("organization_id", "org-123");
    });

    it("should return null when no entitlements found", async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: "PGRST116", message: "Not found" },
        }),
      };

      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await EntitlementsService.loadEntitlements("org-123");

      expect(result).toBeNull();
    });

    it("should return null on database error", async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "Connection failed" },
        }),
      };

      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await EntitlementsService.loadEntitlements("org-123");

      expect(result).toBeNull();
    });
  });

  describe("hasModuleAccess / requireModuleAccess", () => {
    describe("with snapshot provided", () => {
      it("should return true when module is enabled", async () => {
        const result = await EntitlementsService.hasModuleAccess(
          "org-123",
          "warehouse",
          mockEntitlements
        );

        expect(result).toBe(true);
        // Verify no DB call when snapshot provided
        expect(mockSupabase.from).not.toHaveBeenCalled();
      });

      it("should return false when module is not enabled", async () => {
        const result = await EntitlementsService.hasModuleAccess(
          "org-123",
          "analytics",
          mockEntitlements
        );

        expect(result).toBe(false);
        expect(mockSupabase.from).not.toHaveBeenCalled();
      });

      it("should resolve when module is enabled", async () => {
        await expect(
          EntitlementsService.requireModuleAccess("org-123", "warehouse", mockEntitlements)
        ).resolves.toBeUndefined();

        expect(mockSupabase.from).not.toHaveBeenCalled();
      });

      it("should throw MODULE_ACCESS_DENIED when module not enabled", async () => {
        await expect(
          EntitlementsService.requireModuleAccess("org-123", "analytics", mockEntitlements)
        ).rejects.toThrow(EntitlementError);

        try {
          await EntitlementsService.requireModuleAccess("org-123", "analytics", mockEntitlements);
        } catch (error) {
          expect(error).toBeInstanceOf(EntitlementError);
          const entError = error as EntitlementError;
          expect(entError.code).toBe("MODULE_ACCESS_DENIED");
          expect(entError.context).toEqual({
            orgId: "org-123",
            moduleSlug: "analytics",
            planName: "pro",
          });
        }
      });
    });

    describe("with snapshot null", () => {
      it("should return false for hasModuleAccess", async () => {
        const result = await EntitlementsService.hasModuleAccess("org-123", "warehouse", null);

        expect(result).toBe(false);
        // Verify no DB call (null is treated as explicitly missing)
        expect(mockSupabase.from).not.toHaveBeenCalled();
      });

      it("should throw ENTITLEMENTS_MISSING for requireModuleAccess", async () => {
        await expect(
          EntitlementsService.requireModuleAccess("org-123", "warehouse", null)
        ).rejects.toThrow(EntitlementError);

        try {
          await EntitlementsService.requireModuleAccess("org-123", "warehouse", null);
        } catch (error) {
          const entError = error as EntitlementError;
          expect(entError.code).toBe("ENTITLEMENTS_MISSING");
          expect(entError.context).toEqual({ orgId: "org-123" });
        }

        expect(mockSupabase.from).not.toHaveBeenCalled();
      });
    });

    describe("with snapshot undefined (triggers DB load)", () => {
      it("should load from DB and return true when module enabled", async () => {
        const mockQuery = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: mockEntitlements,
            error: null,
          }),
        };

        mockSupabase.from.mockReturnValue(mockQuery);

        const result = await EntitlementsService.hasModuleAccess("org-123", "warehouse", undefined);

        expect(result).toBe(true);
        // Verify DB call was made
        expect(mockSupabase.from).toHaveBeenCalledWith("organization_entitlements");
      });

      it("should load from DB and return false when entitlements not found", async () => {
        const mockQuery = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { code: "PGRST116" },
          }),
        };

        mockSupabase.from.mockReturnValue(mockQuery);

        const result = await EntitlementsService.hasModuleAccess("org-123", "warehouse", undefined);

        expect(result).toBe(false);
        expect(mockSupabase.from).toHaveBeenCalled();
      });

      it("should throw ENTITLEMENTS_MISSING when DB returns null", async () => {
        const mockQuery = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
        };

        mockSupabase.from.mockReturnValue(mockQuery);

        await expect(
          EntitlementsService.requireModuleAccess("org-123", "warehouse", undefined)
        ).rejects.toThrow("ENTITLEMENTS_MISSING");
      });
    });
  });

  describe("hasFeatureAccess / requireFeatureAccess", () => {
    it("should return true only for boolean true", async () => {
      const trueResult = await EntitlementsService.hasFeatureAccess(
        "org-123",
        "advanced_analytics",
        mockEntitlements
      );
      expect(trueResult).toBe(true);

      const falseResult = await EntitlementsService.hasFeatureAccess(
        "org-123",
        "basic_feature",
        mockEntitlements
      );
      expect(falseResult).toBe(false);

      // Number should be treated as false
      const numberResult = await EntitlementsService.hasFeatureAccess(
        "org-123",
        "number_feature",
        mockEntitlements
      );
      expect(numberResult).toBe(false);

      // Missing key should be false
      const missingResult = await EntitlementsService.hasFeatureAccess(
        "org-123",
        "nonexistent_feature",
        mockEntitlements
      );
      expect(missingResult).toBe(false);
    });

    it("should require feature access to succeed when enabled", async () => {
      await expect(
        EntitlementsService.requireFeatureAccess("org-123", "advanced_analytics", mockEntitlements)
      ).resolves.toBeUndefined();
    });

    it("should throw FEATURE_UNAVAILABLE when feature not enabled", async () => {
      await expect(
        EntitlementsService.requireFeatureAccess("org-123", "basic_feature", mockEntitlements)
      ).rejects.toThrow(EntitlementError);

      try {
        await EntitlementsService.requireFeatureAccess(
          "org-123",
          "basic_feature",
          mockEntitlements
        );
      } catch (error) {
        const entError = error as EntitlementError;
        expect(entError.code).toBe("FEATURE_UNAVAILABLE");
        expect(entError.context).toEqual({
          orgId: "org-123",
          featureKey: "basic_feature",
          planName: "pro",
        });
      }
    });

    it("should throw ENTITLEMENTS_MISSING when entitlements null", async () => {
      await expect(
        EntitlementsService.requireFeatureAccess("org-123", "advanced_analytics", null)
      ).rejects.toThrow("ENTITLEMENTS_MISSING");
    });
  });

  describe("getEffectiveLimit", () => {
    it("should return limit from entitlements", async () => {
      const result = await EntitlementsService.getEffectiveLimit(
        "org-123",
        LIMIT_KEYS.WAREHOUSE_MAX_LOCATIONS,
        mockEntitlements
      );

      expect(result).toBe(50);
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it("should return -1 for unlimited", async () => {
      const result = await EntitlementsService.getEffectiveLimit(
        "org-123",
        LIMIT_KEYS.WAREHOUSE_MAX_PRODUCTS,
        mockEntitlements
      );

      expect(result).toBe(-1);
    });

    it("should return 0 when entitlements missing", async () => {
      const result = await EntitlementsService.getEffectiveLimit(
        "org-123",
        LIMIT_KEYS.WAREHOUSE_MAX_LOCATIONS,
        null
      );

      expect(result).toBe(0);
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it("should return 0 when limit key missing", async () => {
      const result = await EntitlementsService.getEffectiveLimit(
        "org-123",
        "nonexistent.limit" as any,
        mockEntitlements
      );

      expect(result).toBe(0);
    });

    it("should return 0 when limit value is not a number", async () => {
      const badEntitlements = {
        ...mockEntitlements,
        limits: {
          "bad.limit": "not-a-number" as any,
        },
      };

      const result = await EntitlementsService.getEffectiveLimit(
        "org-123",
        "bad.limit" as any,
        badEntitlements
      );

      expect(result).toBe(0);
    });

    it("should trigger DB load when snapshot undefined", async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockEntitlements,
          error: null,
        }),
      };

      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await EntitlementsService.getEffectiveLimit(
        "org-123",
        LIMIT_KEYS.WAREHOUSE_MAX_LOCATIONS,
        undefined
      );

      expect(result).toBe(50);
      expect(mockSupabase.from).toHaveBeenCalledWith("organization_entitlements");
    });
  });

  describe("Explicit limit=0 Semantics", () => {
    it("should return 0 for missing limit key (explicit contract)", async () => {
      // Contract: Missing limit keys default to 0 (not unlimited)
      const result = await EntitlementsService.getEffectiveLimit(
        "org-123",
        "missing.key" as any,
        mockEntitlements
      );

      expect(result).toBe(0);
    });

    it("should handle limit=0 in checkLimit without NaN or Infinity", async () => {
      const zeroLimitEnts = {
        ...mockEntitlements,
        limits: {
          [LIMIT_KEYS.WAREHOUSE_MAX_LOCATIONS]: 0,
        },
      };

      const mockCountQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn(),
      };

      mockCountQuery.is.mockResolvedValue({ count: 5, error: null });
      mockSupabase.from.mockReturnValue(mockCountQuery);

      const result = await EntitlementsService.checkLimit(
        "org-123",
        LIMIT_KEYS.WAREHOUSE_MAX_LOCATIONS,
        zeroLimitEnts
      );

      // Contract: limit=0 means "no usage allowed"
      expect(result?.limit).toBe(0);
      expect(result?.current).toBe(5);
      expect(result?.canProceed).toBe(false);
      // Contract: percentageUsed should be 0 (not Infinity) when limit=0
      expect(result?.percentageUsed).toBe(0);
      expect(result?.percentageUsed).not.toBe(Infinity);
      expect(result?.percentageUsed).not.toBeNaN();
    });

    it("should throw LIMIT_EXCEEDED for limit=0 in requireWithinLimit", async () => {
      const zeroLimitEnts = {
        ...mockEntitlements,
        limits: {
          [LIMIT_KEYS.WAREHOUSE_MAX_LOCATIONS]: 0,
        },
      };

      const mockCountQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn(),
      };

      mockCountQuery.is.mockResolvedValue({ count: 1, error: null });
      mockSupabase.from.mockReturnValue(mockCountQuery);

      await expect(
        EntitlementsService.requireWithinLimit(
          "org-123",
          LIMIT_KEYS.WAREHOUSE_MAX_LOCATIONS,
          zeroLimitEnts
        )
      ).rejects.toThrow("LIMIT_EXCEEDED");
    });
  });

  describe("Extended Snapshot Semantics", () => {
    it("hasFeatureAccess should trigger DB load when snapshot undefined", async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockEntitlements,
          error: null,
        }),
      };

      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await EntitlementsService.hasFeatureAccess(
        "org-123",
        "advanced_analytics",
        undefined
      );

      expect(result).toBe(true);
      expect(mockSupabase.from).toHaveBeenCalledWith("organization_entitlements");
    });

    it("hasFeatureAccess should not trigger DB load when snapshot null", async () => {
      const result = await EntitlementsService.hasFeatureAccess(
        "org-123",
        "advanced_analytics",
        null
      );

      expect(result).toBe(false);
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it("checkLimit should trigger DB load when snapshot undefined", async () => {
      const mockEntQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockEntitlements,
          error: null,
        }),
      };

      const mockCountQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn(),
      };

      mockCountQuery.is.mockResolvedValue({ count: 30, error: null });

      // Need to handle multiple from() calls
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "organization_entitlements") {
          return mockEntQuery;
        }
        return mockCountQuery;
      });

      const result = await EntitlementsService.checkLimit(
        "org-123",
        LIMIT_KEYS.WAREHOUSE_MAX_LOCATIONS,
        undefined
      );

      expect(result?.current).toBe(30);
      expect(mockSupabase.from).toHaveBeenCalledWith("organization_entitlements");
    });
  });

  describe("checkLimit", () => {
    it("should return unlimited status for -1 limit without querying usage", async () => {
      const result = await EntitlementsService.checkLimit(
        "org-123",
        LIMIT_KEYS.WAREHOUSE_MAX_PRODUCTS,
        mockEntitlements
      );

      expect(result).toEqual({
        limit: -1,
        current: 0,
        canProceed: true,
      });

      // Verify no usage query was made
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it("should return correct status when within limit", async () => {
      const mockCountQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn(),
      };

      // Return count of 30 - resolve on the LAST method in chain (.is())
      mockCountQuery.is.mockResolvedValue({ count: 30, error: null });
      mockSupabase.from.mockReturnValue(mockCountQuery);

      const result = await EntitlementsService.checkLimit(
        "org-123",
        LIMIT_KEYS.WAREHOUSE_MAX_LOCATIONS,
        mockEntitlements
      );

      expect(result).toEqual({
        limit: 50,
        current: 30,
        canProceed: true,
        percentageUsed: 60, // (30/50) * 100
      });
    });

    it("should return correct status when at limit", async () => {
      const mockCountQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn(),
      };

      mockCountQuery.is.mockResolvedValue({ count: 50, error: null });
      mockSupabase.from.mockReturnValue(mockCountQuery);

      const result = await EntitlementsService.checkLimit(
        "org-123",
        LIMIT_KEYS.WAREHOUSE_MAX_LOCATIONS,
        mockEntitlements
      );

      expect(result).toEqual({
        limit: 50,
        current: 50,
        canProceed: false,
        percentageUsed: 100,
      });
    });

    it("should return correct status when over limit", async () => {
      const mockCountQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn(),
      };

      mockCountQuery.is.mockResolvedValue({ count: 60, error: null });
      mockSupabase.from.mockReturnValue(mockCountQuery);

      const result = await EntitlementsService.checkLimit(
        "org-123",
        LIMIT_KEYS.WAREHOUSE_MAX_LOCATIONS,
        mockEntitlements
      );

      expect(result).toEqual({
        limit: 50,
        current: 60,
        canProceed: false,
        percentageUsed: 120,
      });
    });

    // Note: limit=0 is covered by getEffectiveLimit returning 0 for missing limits
    // The percentageUsed calculation is tested in other tests with valid limits

    it("should return null when getCurrentUsage throws", async () => {
      const mockCountQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn(),
      };

      mockCountQuery.is.mockResolvedValue({
        count: null,
        error: { message: "Database error" },
      });
      mockSupabase.from.mockReturnValue(mockCountQuery);

      const result = await EntitlementsService.checkLimit(
        "org-123",
        LIMIT_KEYS.WAREHOUSE_MAX_LOCATIONS,
        mockEntitlements
      );

      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe("requireWithinLimit (fail-closed)", () => {
    it("should resolve for unlimited limit (-1) without querying usage", async () => {
      await expect(
        EntitlementsService.requireWithinLimit(
          "org-123",
          LIMIT_KEYS.WAREHOUSE_MAX_PRODUCTS,
          mockEntitlements
        )
      ).resolves.toBeUndefined();

      // Verify no usage query
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it("should resolve when within limit", async () => {
      const mockCountQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn(),
      };

      mockCountQuery.is.mockResolvedValue({ count: 30, error: null });
      mockSupabase.from.mockReturnValue(mockCountQuery);

      await expect(
        EntitlementsService.requireWithinLimit(
          "org-123",
          LIMIT_KEYS.WAREHOUSE_MAX_LOCATIONS,
          mockEntitlements
        )
      ).resolves.toBeUndefined();
    });

    it("should throw LIMIT_EXCEEDED when at limit", async () => {
      const mockCountQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn(),
      };

      mockCountQuery.is.mockResolvedValue({ count: 50, error: null });
      mockSupabase.from.mockReturnValue(mockCountQuery);

      await expect(
        EntitlementsService.requireWithinLimit(
          "org-123",
          LIMIT_KEYS.WAREHOUSE_MAX_LOCATIONS,
          mockEntitlements
        )
      ).rejects.toThrow(EntitlementError);

      try {
        await EntitlementsService.requireWithinLimit(
          "org-123",
          LIMIT_KEYS.WAREHOUSE_MAX_LOCATIONS,
          mockEntitlements
        );
      } catch (error) {
        const entError = error as EntitlementError;
        expect(entError.code).toBe("LIMIT_EXCEEDED");
        expect(entError.context).toEqual({
          orgId: "org-123",
          limitKey: LIMIT_KEYS.WAREHOUSE_MAX_LOCATIONS,
          current: 50,
          limit: 50,
        });
      }
    });

    it("should throw LIMIT_EXCEEDED when over limit", async () => {
      const mockCountQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn(),
      };

      mockCountQuery.is.mockResolvedValue({ count: 60, error: null });
      mockSupabase.from.mockReturnValue(mockCountQuery);

      await expect(
        EntitlementsService.requireWithinLimit(
          "org-123",
          LIMIT_KEYS.WAREHOUSE_MAX_LOCATIONS,
          mockEntitlements
        )
      ).rejects.toThrow("LIMIT_EXCEEDED");
    });

    it("should throw LIMIT_CHECK_FAILED when getCurrentUsage throws generic Error", async () => {
      const mockCountQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn(),
      };

      mockCountQuery.is.mockResolvedValue({
        count: null,
        error: { message: "Connection timeout" },
      });
      mockSupabase.from.mockReturnValue(mockCountQuery);

      await expect(
        EntitlementsService.requireWithinLimit(
          "org-123",
          LIMIT_KEYS.WAREHOUSE_MAX_LOCATIONS,
          mockEntitlements
        )
      ).rejects.toThrow(EntitlementError);

      try {
        await EntitlementsService.requireWithinLimit(
          "org-123",
          LIMIT_KEYS.WAREHOUSE_MAX_LOCATIONS,
          mockEntitlements
        );
      } catch (error) {
        const entError = error as EntitlementError;
        expect(entError.code).toBe("LIMIT_CHECK_FAILED");
        expect(entError.context).toEqual({
          orgId: "org-123",
          limitKey: LIMIT_KEYS.WAREHOUSE_MAX_LOCATIONS,
        });
      }
    });

    it("should rethrow EntitlementError as-is without wrapping", async () => {
      const mockCountQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn(),
      };

      mockCountQuery.is.mockResolvedValue({ count: 50, error: null });
      mockSupabase.from.mockReturnValue(mockCountQuery);

      try {
        await EntitlementsService.requireWithinLimit(
          "org-123",
          LIMIT_KEYS.WAREHOUSE_MAX_LOCATIONS,
          mockEntitlements
        );
      } catch (error) {
        expect(error).toBeInstanceOf(EntitlementError);
        const entError = error as EntitlementError;
        // Should be LIMIT_EXCEEDED, not LIMIT_CHECK_FAILED
        expect(entError.code).toBe("LIMIT_EXCEEDED");
      }
    });
  });

  describe("getDerivedCount query building", () => {
    it("should build query with eq operator and $orgId replacement", async () => {
      const mockCountQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn(),
      };

      mockCountQuery.is.mockResolvedValue({ count: 10, error: null });
      mockSupabase.from.mockReturnValue(mockCountQuery);

      // Test locations strategy (has $orgId and deleted_at is null)
      await EntitlementsService.checkLimit(
        "org-123",
        LIMIT_KEYS.WAREHOUSE_MAX_LOCATIONS,
        mockEntitlements
      );

      expect(mockSupabase.from).toHaveBeenCalledWith("locations");
      expect(mockCountQuery.select).toHaveBeenCalledWith("id", { count: "exact", head: true });
      expect(mockCountQuery.eq).toHaveBeenCalledWith("organization_id", "org-123");
      expect(mockCountQuery.is).toHaveBeenCalledWith("deleted_at", null);
    });

    it("should throw error when count query fails", async () => {
      const mockCountQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn(),
      };

      mockCountQuery.is.mockResolvedValue({
        count: null,
        error: { message: "Table not found" },
      });
      mockSupabase.from.mockReturnValue(mockCountQuery);

      const result = await EntitlementsService.checkLimit(
        "org-123",
        LIMIT_KEYS.WAREHOUSE_MAX_LOCATIONS,
        mockEntitlements
      );

      // checkLimit returns null on error
      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it("should return 0 when count is null or undefined", async () => {
      const mockCountQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn(),
      };

      // Mock the entire query chain to return count as null (last method in chain)
      mockCountQuery.is.mockResolvedValue({ count: null, error: null });
      mockSupabase.from.mockReturnValue(mockCountQuery);

      const result = await EntitlementsService.checkLimit(
        "org-123",
        LIMIT_KEYS.WAREHOUSE_MAX_LOCATIONS,
        mockEntitlements
      );

      expect(result?.current).toBe(0);
    });
  });

  describe("getMeteredUsage", () => {
    beforeEach(() => {
      // Set system time to 2026-02-12T10:00:00Z for deterministic boundaries
      vi.setSystemTime(new Date("2026-02-12T10:00:00Z"));
    });

    it("should query monthly boundary range correctly", async () => {
      const mockUsageQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: [{ current_value: 1500, period_start: "2026-02-01T00:00:00.000Z" }],
          error: null,
        }),
      };

      mockSupabase.from.mockReturnValue(mockUsageQuery);

      // Use actual metered limit key
      const testLimitKey = LIMIT_KEYS.ANALYTICS_MONTHLY_EXPORTS;
      const testEntitlements = {
        ...mockEntitlements,
        limits: { [testLimitKey]: 5000 },
      };

      await EntitlementsService.checkLimit("org-123", testLimitKey, testEntitlements);

      expect(mockSupabase.from).toHaveBeenCalledWith("subscription_usage");
      expect(mockUsageQuery.eq).toHaveBeenCalledWith("organization_id", "org-123");
      expect(mockUsageQuery.eq).toHaveBeenCalledWith("feature_key", testLimitKey);

      // Verify boundary: Feb 2026 = [2026-02-01, 2026-03-01)
      expect(mockUsageQuery.gte).toHaveBeenCalledWith("period_start", "2026-02-01T00:00:00.000Z");
      expect(mockUsageQuery.lt).toHaveBeenCalledWith("period_start", "2026-03-01T00:00:00.000Z");

      expect(mockUsageQuery.order).toHaveBeenCalledWith("period_start", { ascending: false });
      expect(mockUsageQuery.limit).toHaveBeenCalledWith(2);
    });

    it("should return 0 when no rows found", async () => {
      const mockUsageQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      };

      mockSupabase.from.mockReturnValue(mockUsageQuery);

      const testLimitKey = LIMIT_KEYS.ANALYTICS_MONTHLY_EXPORTS;
      const testEntitlements = {
        ...mockEntitlements,
        limits: { [testLimitKey]: 5000 },
      };

      const result = await EntitlementsService.checkLimit(
        "org-123",
        testLimitKey,
        testEntitlements
      );

      expect(result?.current).toBe(0);
    });

    it("should return first row value", async () => {
      const mockUsageQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: [{ current_value: 2500, period_start: "2026-02-01T00:00:00.000Z" }],
          error: null,
        }),
      };

      mockSupabase.from.mockReturnValue(mockUsageQuery);

      const testLimitKey = LIMIT_KEYS.ANALYTICS_MONTHLY_EXPORTS;
      const testEntitlements = {
        ...mockEntitlements,
        limits: { [testLimitKey]: 5000 },
      };

      const result = await EntitlementsService.checkLimit(
        "org-123",
        testLimitKey,
        testEntitlements
      );

      expect(result?.current).toBe(2500);
    });

    it("should default to 0 when current_value is null", async () => {
      const mockUsageQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: [{ current_value: null, period_start: "2026-02-01T00:00:00.000Z" }],
          error: null,
        }),
      };

      mockSupabase.from.mockReturnValue(mockUsageQuery);

      const testLimitKey = LIMIT_KEYS.ANALYTICS_MONTHLY_EXPORTS;
      const testEntitlements = {
        ...mockEntitlements,
        limits: { [testLimitKey]: 5000 },
      };

      const result = await EntitlementsService.checkLimit(
        "org-123",
        testLimitKey,
        testEntitlements
      );

      expect(result?.current).toBe(0);
    });

    it("should warn when multiple rows found (duplicates)", async () => {
      const mockUsageQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: [
            { current_value: 2500, period_start: "2026-02-01T00:00:00.000Z" },
            { current_value: 2400, period_start: "2026-02-01T00:00:00.000Z" },
          ],
          error: null,
        }),
      };

      mockSupabase.from.mockReturnValue(mockUsageQuery);

      const testLimitKey = LIMIT_KEYS.ANALYTICS_MONTHLY_EXPORTS;
      const testEntitlements = {
        ...mockEntitlements,
        limits: { [testLimitKey]: 5000 },
      };

      const result = await EntitlementsService.checkLimit(
        "org-123",
        testLimitKey,
        testEntitlements
      );

      expect(result?.current).toBe(2500); // First row wins
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Duplicate subscription_usage rows")
      );
    });

    it("should throw when subscription_usage query fails", async () => {
      const mockUsageQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "Permission denied" },
        }),
      };

      mockSupabase.from.mockReturnValue(mockUsageQuery);

      const testLimitKey = LIMIT_KEYS.ANALYTICS_MONTHLY_EXPORTS;
      const testEntitlements = {
        ...mockEntitlements,
        limits: { [testLimitKey]: 5000 },
      };

      const result = await EntitlementsService.checkLimit(
        "org-123",
        testLimitKey,
        testEntitlements
      );

      // checkLimit catches and returns null
      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    describe("Month Boundary Edge Cases", () => {
      it("should handle month start boundary correctly", async () => {
        // Set time to exactly month start
        vi.setSystemTime(new Date("2026-03-01T00:00:00Z"));

        const mockUsageQuery = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lt: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({
            data: [{ current_value: 100, period_start: "2026-03-01T00:00:00.000Z" }],
            error: null,
          }),
        };

        mockSupabase.from.mockReturnValue(mockUsageQuery);

        const testLimitKey = LIMIT_KEYS.ANALYTICS_MONTHLY_EXPORTS;
        const testEntitlements = {
          ...mockEntitlements,
          limits: { [testLimitKey]: 5000 },
        };

        await EntitlementsService.checkLimit("org-123", testLimitKey, testEntitlements);

        // Verify March boundary: [2026-03-01, 2026-04-01)
        expect(mockUsageQuery.gte).toHaveBeenCalledWith("period_start", "2026-03-01T00:00:00.000Z");
        expect(mockUsageQuery.lt).toHaveBeenCalledWith("period_start", "2026-04-01T00:00:00.000Z");
      });

      it("should handle end-of-month boundary correctly", async () => {
        // Set time to last moment of January
        vi.setSystemTime(new Date("2026-01-31T23:59:59Z"));

        const mockUsageQuery = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lt: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({
            data: [{ current_value: 200, period_start: "2026-01-01T00:00:00.000Z" }],
            error: null,
          }),
        };

        mockSupabase.from.mockReturnValue(mockUsageQuery);

        const testLimitKey = LIMIT_KEYS.ANALYTICS_MONTHLY_EXPORTS;
        const testEntitlements = {
          ...mockEntitlements,
          limits: { [testLimitKey]: 5000 },
        };

        await EntitlementsService.checkLimit("org-123", testLimitKey, testEntitlements);

        // Should still query January range
        expect(mockUsageQuery.gte).toHaveBeenCalledWith("period_start", "2026-01-01T00:00:00.000Z");
        expect(mockUsageQuery.lt).toHaveBeenCalledWith("period_start", "2026-02-01T00:00:00.000Z");
      });

      it("should pick latest period_start when multiple rows in range", async () => {
        vi.setSystemTime(new Date("2026-02-15T10:00:00Z"));

        const mockUsageQuery = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lt: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({
            data: [
              { current_value: 3000, period_start: "2026-02-10T00:00:00.000Z" }, // Latest (due to order desc)
              { current_value: 2500, period_start: "2026-02-01T00:00:00.000Z" }, // Older
            ],
            error: null,
          }),
        };

        mockSupabase.from.mockReturnValue(mockUsageQuery);

        const testLimitKey = LIMIT_KEYS.ANALYTICS_MONTHLY_EXPORTS;
        const testEntitlements = {
          ...mockEntitlements,
          limits: { [testLimitKey]: 5000 },
        };

        const result = await EntitlementsService.checkLimit(
          "org-123",
          testLimitKey,
          testEntitlements
        );

        // Should use first row (latest due to order desc)
        expect(result?.current).toBe(3000);
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining("Duplicate subscription_usage rows")
        );
      });
    });
  });

  describe("percentageUsed Contract (explicit)", () => {
    it("should calculate raw percentage that can exceed 100", async () => {
      // Contract: percentageUsed is raw calculation, can be >100
      const mockCountQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn(),
      };

      mockCountQuery.is.mockResolvedValue({ count: 75, error: null });
      mockSupabase.from.mockReturnValue(mockCountQuery);

      const result = await EntitlementsService.checkLimit(
        "org-123",
        LIMIT_KEYS.WAREHOUSE_MAX_LOCATIONS,
        mockEntitlements
      );

      // 75/50 * 100 = 150%
      expect(result?.percentageUsed).toBe(150);
      expect(result?.canProceed).toBe(false);
    });

    it("should round percentageUsed to nearest integer", async () => {
      // Contract: percentageUsed is rounded via Math.round()
      const mockCountQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn(),
      };

      mockCountQuery.is.mockResolvedValue({ count: 33, error: null });
      mockSupabase.from.mockReturnValue(mockCountQuery);

      const result = await EntitlementsService.checkLimit(
        "org-123",
        LIMIT_KEYS.WAREHOUSE_MAX_LOCATIONS,
        mockEntitlements
      );

      // 33/50 * 100 = 66% (Math.round)
      expect(result?.percentageUsed).toBe(66);
    });
  });
});
