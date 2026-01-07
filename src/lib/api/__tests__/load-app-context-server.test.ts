/**
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { _loadAppContextServer } from "../load-app-context-server";
import { createClient } from "@/utils/supabase/server";

// Mock dependencies
vi.mock("@/utils/supabase/server");
vi.mock("@/lib/services/subscription-service", () => ({
  subscriptionService: {
    getActiveSubscription: vi.fn(),
  },
}));

describe("loadAppContextServer", () => {
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock Supabase client
    mockSupabase = {
      auth: {
        getSession: vi.fn(),
      },
      from: vi.fn(),
    };

    // Mock createClient to return our mock
    vi.mocked(createClient).mockResolvedValue(mockSupabase);
  });

  describe("Contract: Returns null when no session", () => {
    it("should return null when session is null", async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
      });

      const result = await _loadAppContextServer();

      expect(result).toBeNull();
    });

    it("should return null when session is undefined", async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: undefined },
      });

      const result = await _loadAppContextServer();

      expect(result).toBeNull();
    });
  });

  describe("Contract: Deterministic org selection", () => {
    const mockSession = {
      user: {
        id: "user-123",
        email: "test@example.com",
      },
      access_token: "mock-jwt-token",
    };

    beforeEach(() => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
      });
    });

    it("should use preferences.organization_id when present", async () => {
      const mockPreferences = {
        organization_id: "org-from-prefs",
        default_branch_id: null,
      };

      const mockOrgProfile = {
        organization_id: "org-from-prefs",
        name: "Org from Preferences",
      };

      const mockPrefQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockPreferences }),
      };

      const mockOrgQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockOrgProfile }),
      };

      const mockBranchQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [] }),
      };

      const mockModulesQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockResolvedValue({ data: [] }),
      };

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "user_preferences") return mockPrefQuery;
        if (table === "organization_profiles") return mockOrgQuery;
        if (table === "branches") return mockBranchQuery;
        if (table === "user_modules") return mockModulesQuery;
        return mockPrefQuery;
      });

      const result = await _loadAppContextServer();

      expect(result?.activeOrgId).toBe("org-from-prefs");
      expect(result?.activeOrg?.organization_id).toBe("org-from-prefs");
    });

    it("should fallback to owned org when preferences.organization_id is null", async () => {
      const mockPreferences = {
        organization_id: null,
        default_branch_id: null,
      };

      const mockOwnedOrg = {
        id: "owned-org-123",
      };

      const mockOrgProfile = {
        organization_id: "owned-org-123",
        name: "Owned Organization",
      };

      const mockPrefQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockPreferences }),
      };

      const mockOwnedOrgQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(), // Support .order() for deterministic fallback
        limit: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockOwnedOrg }),
      };

      const mockOrgProfileQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockOrgProfile }),
      };

      const mockBranchQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [] }),
      };

      const mockModulesQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockResolvedValue({ data: [] }),
      };

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "user_preferences") return mockPrefQuery;
        if (table === "organizations") return mockOwnedOrgQuery;
        if (table === "organization_profiles") return mockOrgProfileQuery;
        if (table === "branches") return mockBranchQuery;
        if (table === "user_modules") return mockModulesQuery;
        return mockPrefQuery;
      });

      const result = await _loadAppContextServer();

      expect(result?.activeOrgId).toBe("owned-org-123");
    });

    it("should return null activeOrgId when no preferences and no owned org", async () => {
      const mockPrefQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null }),
      };

      const mockOwnedOrgQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(), // Support .order() for deterministic fallback
        limit: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null }),
      };

      const mockModulesQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockResolvedValue({ data: [] }),
      };

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "user_preferences") return mockPrefQuery;
        if (table === "organizations") return mockOwnedOrgQuery;
        if (table === "user_modules") return mockModulesQuery;
        return mockPrefQuery;
      });

      const result = await _loadAppContextServer();

      expect(result?.activeOrgId).toBeNull();
      expect(result?.activeOrg).toBeNull();
    });
  });

  describe("Contract: Minimal data loading", () => {
    const mockSession = {
      user: {
        id: "user-123",
        email: "test@example.com",
      },
      access_token: "mock-jwt-token",
    };

    beforeEach(() => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
      });
    });

    it("should load organization profile when org chosen", async () => {
      const mockPreferences = {
        organization_id: "org-123",
        default_branch_id: null,
      };

      const mockOrgProfile = {
        organization_id: "org-123",
        name: "Test Organization",
        description: "Test Desc",
      };

      const mockPrefQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockPreferences }),
      };

      const mockOrgQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockOrgProfile }),
      };

      const mockBranchQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [] }),
      };

      const mockModulesQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockResolvedValue({ data: [] }),
      };

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "user_preferences") return mockPrefQuery;
        if (table === "organization_profiles") return mockOrgQuery;
        if (table === "branches") return mockBranchQuery;
        if (table === "user_modules") return mockModulesQuery;
        return mockPrefQuery;
      });

      const result = await _loadAppContextServer();

      expect(result?.activeOrg).not.toBeNull();
      expect(result?.activeOrg?.name).toBe("Test Organization");
    });

    it("should load branches for the organization", async () => {
      const mockPreferences = {
        organization_id: "org-123",
        default_branch_id: "branch-456",
      };

      const mockBranches = [
        {
          id: "branch-456",
          name: "Main Branch",
          organization_id: "org-123",
        },
        {
          id: "branch-789",
          name: "Secondary Branch",
          organization_id: "org-123",
        },
      ];

      const mockPrefQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockPreferences }),
      };

      const mockOrgQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null }),
      };

      const mockBranchQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockBranches }),
      };

      const mockModulesQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockResolvedValue({ data: [] }),
      };

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "user_preferences") return mockPrefQuery;
        if (table === "organization_profiles") return mockOrgQuery;
        if (table === "branches") return mockBranchQuery;
        if (table === "user_modules") return mockModulesQuery;
        return mockPrefQuery;
      });

      const result = await _loadAppContextServer();

      expect(result?.availableBranches).toHaveLength(2);
      expect(result?.activeBranch?.id).toBe("branch-456");
    });

    it("should fallback to first branch when preference branch not found (deterministic)", async () => {
      const mockPreferences = {
        organization_id: "org-123",
        default_branch_id: "non-existent-branch",
      };

      const mockBranches = [
        {
          id: "branch-456",
          name: "Main Branch",
          organization_id: "org-123",
          branch_id: "branch-456",
        },
      ];

      const mockPrefQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockPreferences }),
      };

      const mockOrgQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null }),
      };

      const mockBranchQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockBranches }),
      };

      const mockModulesQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockResolvedValue({ data: [] }),
      };

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "user_preferences") return mockPrefQuery;
        if (table === "organization_profiles") return mockOrgQuery;
        if (table === "branches") return mockBranchQuery;
        if (table === "user_modules") return mockModulesQuery;
        return mockPrefQuery;
      });

      const result = await _loadAppContextServer();

      // New behavior: fallback to first available branch (deterministic)
      expect(result?.activeBranch).toEqual({
        id: "branch-456",
        name: "Main Branch",
        organization_id: "org-123",
        branch_id: "branch-456",
      });
      expect(result?.availableBranches).toHaveLength(1);
    });

    it("should load userModules with merged settings", async () => {
      const mockModulesData = [
        {
          setting_overrides: { feature_x: false },
          modules: {
            id: "mod-1",
            slug: "warehouse",
            label: "Warehouse",
            settings: { feature_x: true, feature_y: true },
          },
        },
      ];

      const mockPrefQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null }),
      };

      const mockOwnedOrgQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(), // Support .order() for deterministic fallback
        limit: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null }),
      };

      const mockModulesQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockResolvedValue({ data: mockModulesData }),
      };

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "user_preferences") return mockPrefQuery;
        if (table === "organizations") return mockOwnedOrgQuery;
        if (table === "user_modules") return mockModulesQuery;
        return mockPrefQuery;
      });

      const result = await _loadAppContextServer();

      expect(result?.userModules).toHaveLength(1);
      expect(result?.userModules[0]).toEqual({
        id: "mod-1",
        slug: "warehouse",
        label: "Warehouse",
        settings: {
          feature_x: false, // Override wins
          feature_y: true, // From module settings
        },
      });
    });
  });

  describe("Forbidden: Heavy data loading", () => {
    const mockSession = {
      user: {
        id: "user-123",
        email: "test@example.com",
      },
      access_token: "mock-jwt-token",
    };

    beforeEach(() => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
      });

      const mockPrefQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null }),
      };

      const mockOwnedOrgQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(), // Support .order() for deterministic fallback
        limit: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null }),
      };

      const mockModulesQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockResolvedValue({ data: [] }),
      };

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "user_preferences") return mockPrefQuery;
        if (table === "organizations") return mockOwnedOrgQuery;
        if (table === "user_modules") return mockModulesQuery;
        return mockPrefQuery;
      });
    });

    it("should return empty locations array", async () => {
      const result = await _loadAppContextServer();

      expect(result?.locations).toEqual([]);
    });

    it("should return empty suppliers array", async () => {
      const result = await _loadAppContextServer();

      expect(result?.suppliers).toEqual([]);
    });

    it("should return empty organizationUsers array", async () => {
      const result = await _loadAppContextServer();

      expect(result?.organizationUsers).toEqual([]);
    });

    it("should return empty privateContacts array", async () => {
      const result = await _loadAppContextServer();

      expect(result?.privateContacts).toEqual([]);
    });

    it("should return null subscription", async () => {
      const result = await _loadAppContextServer();

      expect(result?.subscription).toBeNull();
    });
  });

  describe("Forbidden: No JWT decode for org selection", () => {
    it("should NOT decode JWT to pick organization", async () => {
      const mockSession = {
        user: {
          id: "user-123",
          email: "test@example.com",
        },
        access_token: "mock-jwt-token-with-org",
      };

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
      });

      const mockPrefQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null }),
      };

      const mockOwnedOrgQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(), // Support .order() for deterministic fallback
        limit: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null }),
      };

      const mockModulesQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockResolvedValue({ data: [] }),
      };

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "user_preferences") return mockPrefQuery;
        if (table === "organizations") return mockOwnedOrgQuery;
        if (table === "user_modules") return mockModulesQuery;
        return mockPrefQuery;
      });

      const result = await _loadAppContextServer();

      // Should return null, NOT decode JWT to find org
      expect(result?.activeOrgId).toBeNull();
    });
  });
});
