/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  useAppStoreV2,
  AppContextV2,
  BranchDataV2,
  ActiveOrgV2,
  LoadedUserModuleV2,
} from "../app-store";

describe("useAppStoreV2", () => {
  beforeEach(() => {
    // Clear store state before each test
    useAppStoreV2.getState().clear();
  });

  describe("Initial State", () => {
    it("should have correct initial state", () => {
      const state = useAppStoreV2.getState();

      expect(state.activeOrgId).toBeNull();
      expect(state.activeBranchId).toBeNull();
      expect(state.activeOrg).toBeNull();
      expect(state.activeBranch).toBeNull();
      expect(state.availableBranches).toEqual([]);
      expect(state.userModules).toEqual([]);
      expect(state.isLoaded).toBe(false);
    });
  });

  describe("hydrateFromServer", () => {
    it("should hydrate store with valid app context", () => {
      const mockOrg: ActiveOrgV2 = {
        id: "org-123",
        name: "Test Organization",
        slug: "test-org",
      };

      const mockBranches: BranchDataV2[] = [
        {
          id: "branch-1",
          name: "Main Branch",
          organization_id: "org-123",
          slug: "main",
          created_at: "2024-01-01T00:00:00Z",
        },
        {
          id: "branch-2",
          name: "Secondary Branch",
          organization_id: "org-123",
          slug: "secondary",
          created_at: "2024-01-02T00:00:00Z",
        },
      ];

      const mockModules: LoadedUserModuleV2[] = [
        {
          id: "module-1",
          slug: "warehouse",
          label: "Warehouse",
          settings: { enabled: true },
        },
        {
          id: "module-2",
          slug: "teams",
          label: "Teams",
          settings: { enabled: false },
        },
      ];

      const context: AppContextV2 = {
        activeOrgId: "org-123",
        activeBranchId: "branch-1",
        activeOrg: mockOrg,
        activeBranch: mockBranches[0],
        availableBranches: mockBranches,
        userModules: mockModules,
      };

      useAppStoreV2.getState().hydrateFromServer(context);

      const state = useAppStoreV2.getState();

      expect(state.activeOrgId).toBe("org-123");
      expect(state.activeBranchId).toBe("branch-1");
      expect(state.activeOrg).toEqual(mockOrg);
      expect(state.activeBranch).toEqual(mockBranches[0]);
      expect(state.availableBranches).toEqual(mockBranches);
      expect(state.userModules).toEqual(mockModules);
      expect(state.isLoaded).toBe(true);
    });

    it("should replace arrays (not merge) when hydrating", () => {
      // First hydration
      const firstBranches: BranchDataV2[] = [
        {
          id: "branch-1",
          name: "First Branch",
          organization_id: "org-1",
          slug: "first",
          created_at: "2024-01-01T00:00:00Z",
        },
      ];

      const firstModules: LoadedUserModuleV2[] = [
        {
          id: "module-1",
          slug: "warehouse",
          label: "Warehouse",
          settings: {},
        },
      ];

      const firstContext: AppContextV2 = {
        activeOrgId: "org-1",
        activeBranchId: "branch-1",
        activeOrg: {
          id: "org-1",
          name: "First Org",
          slug: "first-org",
        },
        activeBranch: firstBranches[0],
        availableBranches: firstBranches,
        userModules: firstModules,
      };

      useAppStoreV2.getState().hydrateFromServer(firstContext);

      // Second hydration - should replace, not merge
      const secondBranches: BranchDataV2[] = [
        {
          id: "branch-2",
          name: "Second Branch",
          organization_id: "org-2",
          slug: "second",
          created_at: "2024-01-02T00:00:00Z",
        },
        {
          id: "branch-3",
          name: "Third Branch",
          organization_id: "org-2",
          slug: "third",
          created_at: "2024-01-03T00:00:00Z",
        },
      ];

      const secondModules: LoadedUserModuleV2[] = [
        {
          id: "module-2",
          slug: "teams",
          label: "Teams",
          settings: {},
        },
      ];

      const secondContext: AppContextV2 = {
        activeOrgId: "org-2",
        activeBranchId: "branch-2",
        activeOrg: {
          id: "org-2",
          name: "Second Org",
          slug: "second-org",
        },
        activeBranch: secondBranches[0],
        availableBranches: secondBranches,
        userModules: secondModules,
      };

      useAppStoreV2.getState().hydrateFromServer(secondContext);

      const state = useAppStoreV2.getState();

      expect(state.activeOrgId).toBe("org-2");
      expect(state.availableBranches).toHaveLength(2);
      expect(state.availableBranches[0].id).toBe("branch-2");
      expect(state.userModules).toHaveLength(1);
      expect(state.userModules[0].slug).toBe("teams");
    });

    it("should set isLoaded=true and reset to initial state when context is null", () => {
      // First hydrate with data
      const context: AppContextV2 = {
        activeOrgId: "org-123",
        activeBranchId: "branch-1",
        activeOrg: {
          id: "org-123",
          name: "Test Org",
          slug: "test-org",
        },
        activeBranch: {
          id: "branch-1",
          name: "Main Branch",
          organization_id: "org-123",
          slug: "main",
          created_at: "2024-01-01T00:00:00Z",
        },
        availableBranches: [],
        userModules: [],
      };

      useAppStoreV2.getState().hydrateFromServer(context);

      // Then hydrate with null
      useAppStoreV2.getState().hydrateFromServer(null);

      const state = useAppStoreV2.getState();

      expect(state.activeOrgId).toBeNull();
      expect(state.activeBranchId).toBeNull();
      expect(state.activeOrg).toBeNull();
      expect(state.activeBranch).toBeNull();
      expect(state.availableBranches).toEqual([]);
      expect(state.userModules).toEqual([]);
      expect(state.isLoaded).toBe(true); // CRITICAL: should be true, not false
    });

    it("should handle context with empty arrays", () => {
      const context: AppContextV2 = {
        activeOrgId: "org-123",
        activeBranchId: "branch-1",
        activeOrg: {
          id: "org-123",
          name: "Test Org",
          slug: "test-org",
        },
        activeBranch: {
          id: "branch-1",
          name: "Main Branch",
          organization_id: "org-123",
          slug: "main",
          created_at: "2024-01-01T00:00:00Z",
        },
        availableBranches: [],
        userModules: [],
      };

      useAppStoreV2.getState().hydrateFromServer(context);

      const state = useAppStoreV2.getState();

      expect(state.availableBranches).toEqual([]);
      expect(state.userModules).toEqual([]);
      expect(state.isLoaded).toBe(true);
    });
  });

  describe("setActiveBranch", () => {
    beforeEach(() => {
      // Setup initial state with branches
      const branches: BranchDataV2[] = [
        {
          id: "branch-1",
          name: "Main Branch",
          organization_id: "org-123",
          slug: "main",
          created_at: "2024-01-01T00:00:00Z",
        },
        {
          id: "branch-2",
          name: "Secondary Branch",
          organization_id: "org-123",
          slug: "secondary",
          created_at: "2024-01-02T00:00:00Z",
        },
      ];

      const context: AppContextV2 = {
        activeOrgId: "org-123",
        activeBranchId: "branch-1",
        activeOrg: {
          id: "org-123",
          name: "Test Org",
          slug: "test-org",
        },
        activeBranch: branches[0],
        availableBranches: branches,
        userModules: [],
      };

      useAppStoreV2.getState().hydrateFromServer(context);
    });

    it("should update active branch when valid branch ID is provided", () => {
      useAppStoreV2.getState().setActiveBranch("branch-2");

      const state = useAppStoreV2.getState();

      expect(state.activeBranchId).toBe("branch-2");
      expect(state.activeBranch?.id).toBe("branch-2");
      expect(state.activeBranch?.name).toBe("Secondary Branch");
    });

    it("should set activeBranch to null when invalid branch ID is provided", () => {
      useAppStoreV2.getState().setActiveBranch("non-existent-branch");

      const state = useAppStoreV2.getState();

      expect(state.activeBranchId).toBe("non-existent-branch");
      expect(state.activeBranch).toBeNull();
    });

    it("should NOT fetch data (dumb setter only)", () => {
      const initialState = useAppStoreV2.getState();

      useAppStoreV2.getState().setActiveBranch("branch-2");

      const newState = useAppStoreV2.getState();

      // Only IDs and branch object should change
      expect(newState.activeBranchId).toBe("branch-2");
      expect(newState.activeBranch?.id).toBe("branch-2");

      // Everything else should remain unchanged (value equality, not reference)
      expect(newState.activeOrgId).toEqual(initialState.activeOrgId);
      expect(newState.activeOrg).toEqual(initialState.activeOrg);
      expect(newState.availableBranches).toEqual(initialState.availableBranches);
      expect(newState.userModules).toEqual(initialState.userModules);
    });

    it("should update activeBranch from availableBranches array", () => {
      const state = useAppStoreV2.getState();
      const expectedBranch = state.availableBranches.find((b) => b.id === "branch-2");

      useAppStoreV2.getState().setActiveBranch("branch-2");

      const newState = useAppStoreV2.getState();

      expect(newState.activeBranch).toEqual(expectedBranch);
    });
  });

  describe("clear", () => {
    it("should reset store to initial state", () => {
      // First hydrate with data
      const context: AppContextV2 = {
        activeOrgId: "org-123",
        activeBranchId: "branch-1",
        activeOrg: {
          id: "org-123",
          name: "Test Org",
          slug: "test-org",
        },
        activeBranch: {
          id: "branch-1",
          name: "Main Branch",
          organization_id: "org-123",
          slug: "main",
          created_at: "2024-01-01T00:00:00Z",
        },
        availableBranches: [
          {
            id: "branch-1",
            name: "Main Branch",
            organization_id: "org-123",
            slug: "main",
            created_at: "2024-01-01T00:00:00Z",
          },
        ],
        userModules: [
          {
            id: "module-1",
            slug: "warehouse",
            label: "Warehouse",
            settings: {},
          },
        ],
      };

      useAppStoreV2.getState().hydrateFromServer(context);

      // Then clear
      useAppStoreV2.getState().clear();

      const state = useAppStoreV2.getState();

      expect(state.activeOrgId).toBeNull();
      expect(state.activeBranchId).toBeNull();
      expect(state.activeOrg).toBeNull();
      expect(state.activeBranch).toBeNull();
      expect(state.availableBranches).toEqual([]);
      expect(state.userModules).toEqual([]);
      expect(state.isLoaded).toBe(false); // CRITICAL: should be false after clear
    });

    it("should be idempotent (clearing twice should have same effect)", () => {
      const context: AppContextV2 = {
        activeOrgId: "org-123",
        activeBranchId: "branch-1",
        activeOrg: {
          id: "org-123",
          name: "Test Org",
          slug: "test-org",
        },
        activeBranch: {
          id: "branch-1",
          name: "Main Branch",
          organization_id: "org-123",
          slug: "main",
          created_at: "2024-01-01T00:00:00Z",
        },
        availableBranches: [],
        userModules: [],
      };

      useAppStoreV2.getState().hydrateFromServer(context);
      useAppStoreV2.getState().clear();

      const stateAfterFirstClear = useAppStoreV2.getState();

      useAppStoreV2.getState().clear();

      const stateAfterSecondClear = useAppStoreV2.getState();

      expect(stateAfterFirstClear).toEqual(stateAfterSecondClear);
    });
  });

  describe("Architecture Compliance", () => {
    it("should NOT have subscription field", () => {
      const context: AppContextV2 = {
        activeOrgId: "org-123",
        activeBranchId: "branch-1",
        activeOrg: {
          id: "org-123",
          name: "Test Org",
          slug: "test-org",
        },
        activeBranch: {
          id: "branch-1",
          name: "Main Branch",
          organization_id: "org-123",
          slug: "main",
          created_at: "2024-01-01T00:00:00Z",
        },
        availableBranches: [],
        userModules: [],
      };

      useAppStoreV2.getState().hydrateFromServer(context);

      const state = useAppStoreV2.getState();

      // CRITICAL: No subscription field should exist
      expect(state).not.toHaveProperty("subscription");
    });

    it("should NOT have any data fetching methods", () => {
      const store = useAppStoreV2.getState();

      // Verify no fetch-like methods exist
      expect(store).not.toHaveProperty("fetchOrganization");
      expect(store).not.toHaveProperty("loadBranches");
      expect(store).not.toHaveProperty("refreshModules");
    });

    it("should only store thin snapshots (minimal data)", () => {
      const branches: BranchDataV2[] = [
        {
          id: "branch-1",
          name: "Main Branch",
          organization_id: "org-123",
          slug: "main",
          created_at: "2024-01-01T00:00:00Z",
        },
      ];

      const context: AppContextV2 = {
        activeOrgId: "org-123",
        activeBranchId: "branch-1",
        activeOrg: {
          id: "org-123",
          name: "Test Org",
          slug: "test-org",
        },
        activeBranch: branches[0],
        availableBranches: branches,
        userModules: [],
      };

      useAppStoreV2.getState().hydrateFromServer(context);

      const state = useAppStoreV2.getState();

      // ActiveOrg should only have minimal fields
      expect(Object.keys(state.activeOrg!)).toEqual(["id", "name", "slug"]);

      // BranchData should only have minimal fields
      const branchKeys = Object.keys(state.activeBranch!);
      expect(branchKeys).toContain("id");
      expect(branchKeys).toContain("name");
      expect(branchKeys).toContain("organization_id");
      expect(branchKeys).toContain("slug");
      expect(branchKeys).toContain("created_at");

      // Should NOT have heavy data fields
      expect(state.activeBranch).not.toHaveProperty("products");
      expect(state.activeBranch).not.toHaveProperty("inventory");
      expect(state.activeBranch).not.toHaveProperty("users");
    });

    it("should use hydrateFromServer pattern", () => {
      const store = useAppStoreV2.getState();

      expect(store).toHaveProperty("hydrateFromServer");
      expect(typeof store.hydrateFromServer).toBe("function");
    });
  });

  describe("Store Behavior", () => {
    it("should maintain singleton instance", () => {
      const state1 = useAppStoreV2.getState();
      const state2 = useAppStoreV2.getState();

      expect(state1).toBe(state2); // Same instance (Zustand singleton)
    });

    it("should allow subscribers to react to changes", () => {
      const context: AppContextV2 = {
        activeOrgId: "org-123",
        activeBranchId: "branch-1",
        activeOrg: {
          id: "org-123",
          name: "Test Org",
          slug: "test-org",
        },
        activeBranch: {
          id: "branch-1",
          name: "Main Branch",
          organization_id: "org-123",
          slug: "main",
          created_at: "2024-01-01T00:00:00Z",
        },
        availableBranches: [],
        userModules: [],
      };

      let callCount = 0;
      const unsubscribe = useAppStoreV2.subscribe(() => {
        callCount++;
      });

      useAppStoreV2.getState().hydrateFromServer(context);

      expect(callCount).toBeGreaterThan(0);

      unsubscribe();
    });
  });

  describe("Edge Cases", () => {
    it("should handle null slug in branch data", () => {
      const branch: BranchDataV2 = {
        id: "branch-1",
        name: "Main Branch",
        organization_id: "org-123",
        slug: null,
        created_at: "2024-01-01T00:00:00Z",
      };

      const context: AppContextV2 = {
        activeOrgId: "org-123",
        activeBranchId: "branch-1",
        activeOrg: {
          id: "org-123",
          name: "Test Org",
          slug: "test-org",
        },
        activeBranch: branch,
        availableBranches: [branch],
        userModules: [],
      };

      useAppStoreV2.getState().hydrateFromServer(context);

      const state = useAppStoreV2.getState();

      expect(state.activeBranch?.slug).toBeNull();
    });

    it("should handle module with empty settings", () => {
      const module: LoadedUserModuleV2 = {
        id: "module-1",
        slug: "warehouse",
        label: "Warehouse",
        settings: {},
      };

      const context: AppContextV2 = {
        activeOrgId: "org-123",
        activeBranchId: "branch-1",
        activeOrg: {
          id: "org-123",
          name: "Test Org",
          slug: "test-org",
        },
        activeBranch: {
          id: "branch-1",
          name: "Main Branch",
          organization_id: "org-123",
          slug: "main",
          created_at: "2024-01-01T00:00:00Z",
        },
        availableBranches: [],
        userModules: [module],
      };

      useAppStoreV2.getState().hydrateFromServer(context);

      const state = useAppStoreV2.getState();

      expect(state.userModules[0].settings).toEqual({});
    });
  });
});
