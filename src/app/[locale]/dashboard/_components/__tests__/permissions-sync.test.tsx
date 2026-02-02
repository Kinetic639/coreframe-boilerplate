/**
 * @vitest-environment jsdom
 *
 * Integration tests for PermissionsSync component
 *
 * Tests the critical bridge between:
 * - React Query (fetching permissions from server action)
 * - Zustand stores (app context with org/branch IDs, user context with permissions)
 *
 * This validates the SSR hydration flow:
 * 1. Server loads context via loadDashboardContextV2()
 * 2. DashboardV2Providers hydrates Zustand stores with org/branch IDs
 * 3. PermissionsSync detects IDs and fetches permissions via React Query
 * 4. Permissions sync to user store, enabling usePermissions() hook
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";
import { PermissionsSync } from "../permissions-sync";
import { useAppStoreV2 } from "@/lib/stores/v2/app-store";
import { useUserStoreV2 } from "@/lib/stores/v2/user-store";

// Mock the server action
vi.mock("@/app/actions/v2/permissions", () => ({
  getBranchPermissions: vi.fn(),
}));

import { getBranchPermissions } from "@/app/actions/v2/permissions";

const mockGetBranchPermissions = getBranchPermissions as ReturnType<typeof vi.fn>;

// Test wrapper with QueryClientProvider
function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("PermissionsSync", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset Zustand stores before each test
    useAppStoreV2.getState().clear();
    useUserStoreV2.getState().clear();

    // Create fresh QueryClient for each test
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
        },
      },
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe("SSR Hydration Flow", () => {
    it("should sync permissions after stores are hydrated with org/branch IDs", async () => {
      const mockPermissions = {
        permissions: {
          allow: ["warehouse.products.read", "warehouse.inventory.view"],
          deny: ["warehouse.products.delete"],
        },
      };
      mockGetBranchPermissions.mockResolvedValue(mockPermissions);

      // Step 1: Simulate server hydration (what DashboardV2Providers does)
      act(() => {
        useAppStoreV2.getState().hydrateFromServer({
          activeOrgId: "org-123",
          activeBranchId: "branch-456",
          activeOrg: {
            id: "org-123",
            name: "Test Org",
            name_2: null,
            slug: "test-org",
            logo_url: null,
          },
          activeBranch: {
            id: "branch-456",
            name: "Main Branch",
            organization_id: "org-123",
            slug: "main",
            created_at: "2024-01-01",
          },
          availableBranches: [],
          userModules: [],
        });
      });

      // Verify store is hydrated
      expect(useAppStoreV2.getState().activeOrgId).toBe("org-123");
      expect(useAppStoreV2.getState().activeBranchId).toBe("branch-456");
      expect(useAppStoreV2.getState().isLoaded).toBe(true);

      // Step 2: Render PermissionsSync (this triggers the React Query fetch)
      const Wrapper = createWrapper(queryClient);
      render(
        <Wrapper>
          <PermissionsSync />
        </Wrapper>
      );

      // Step 3: Wait for permissions to sync to user store
      await waitFor(() => {
        const snapshot = useUserStoreV2.getState().permissionSnapshot;
        expect(snapshot.allow).toContain("warehouse.products.read");
      });

      // Verify full permission snapshot synced
      const finalSnapshot = useUserStoreV2.getState().permissionSnapshot;
      expect(finalSnapshot).toEqual(mockPermissions.permissions);
      expect(finalSnapshot.deny).toContain("warehouse.products.delete");

      // Verify server action was called with correct IDs
      expect(mockGetBranchPermissions).toHaveBeenCalledWith("org-123", "branch-456");
    });

    it("should NOT fetch when stores are not hydrated (no org/branch IDs)", async () => {
      // Don't hydrate stores - leave them empty

      const Wrapper = createWrapper(queryClient);
      render(
        <Wrapper>
          <PermissionsSync />
        </Wrapper>
      );

      // Wait a bit to ensure no fetch happens
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Server action should NOT be called
      expect(mockGetBranchPermissions).not.toHaveBeenCalled();

      // Permission snapshot should remain empty
      expect(useUserStoreV2.getState().permissionSnapshot).toEqual({ allow: [], deny: [] });
    });

    it("should NOT fetch when only orgId is present (no branchId)", async () => {
      // Hydrate with only orgId
      act(() => {
        useAppStoreV2.getState().hydrateFromServer({
          activeOrgId: "org-123",
          activeBranchId: null,
          activeOrg: {
            id: "org-123",
            name: "Test Org",
            name_2: null,
            slug: "test-org",
            logo_url: null,
          },
          activeBranch: null,
          availableBranches: [],
          userModules: [],
        });
      });

      const Wrapper = createWrapper(queryClient);
      render(
        <Wrapper>
          <PermissionsSync />
        </Wrapper>
      );

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockGetBranchPermissions).not.toHaveBeenCalled();
    });
  });

  describe("Branch Switching Flow", () => {
    it("should refetch permissions when activeBranchId changes", async () => {
      const mockPermissionsBranch1 = {
        permissions: {
          allow: ["warehouse.products.read"],
          deny: [],
        },
      };
      const mockPermissionsBranch2 = {
        permissions: {
          allow: [
            "warehouse.products.read",
            "warehouse.products.create",
            "warehouse.products.delete",
          ],
          deny: [],
        },
      };

      mockGetBranchPermissions
        .mockResolvedValueOnce(mockPermissionsBranch1)
        .mockResolvedValueOnce(mockPermissionsBranch2);

      // Initial hydration with branch-1
      act(() => {
        useAppStoreV2.getState().hydrateFromServer({
          activeOrgId: "org-123",
          activeBranchId: "branch-1",
          activeOrg: {
            id: "org-123",
            name: "Test Org",
            name_2: null,
            slug: "test-org",
            logo_url: null,
          },
          activeBranch: {
            id: "branch-1",
            name: "Branch 1",
            organization_id: "org-123",
            slug: "branch-1",
            created_at: "2024-01-01",
          },
          availableBranches: [
            {
              id: "branch-1",
              name: "Branch 1",
              organization_id: "org-123",
              slug: "branch-1",
              created_at: "2024-01-01",
            },
            {
              id: "branch-2",
              name: "Branch 2",
              organization_id: "org-123",
              slug: "branch-2",
              created_at: "2024-01-01",
            },
          ],
          userModules: [],
        });
      });

      const Wrapper = createWrapper(queryClient);
      const { rerender } = render(
        <Wrapper>
          <PermissionsSync />
        </Wrapper>
      );

      // Wait for initial permissions
      await waitFor(() => {
        expect(useUserStoreV2.getState().permissionSnapshot.allow).toContain(
          "warehouse.products.read"
        );
      });

      expect(mockGetBranchPermissions).toHaveBeenCalledTimes(1);
      expect(mockGetBranchPermissions).toHaveBeenCalledWith("org-123", "branch-1");

      // Simulate branch switch (what BranchSwitcher does after changeBranch server action)
      act(() => {
        useAppStoreV2.getState().setActiveBranch("branch-2");
      });

      // Verify store updated
      expect(useAppStoreV2.getState().activeBranchId).toBe("branch-2");

      // Re-render to trigger React Query refetch with new branch ID
      rerender(
        <Wrapper>
          <PermissionsSync />
        </Wrapper>
      );

      // Wait for new permissions
      await waitFor(() => {
        expect(mockGetBranchPermissions).toHaveBeenCalledTimes(2);
      });

      expect(mockGetBranchPermissions).toHaveBeenLastCalledWith("org-123", "branch-2");

      // Verify new permissions synced
      await waitFor(() => {
        const snapshot = useUserStoreV2.getState().permissionSnapshot;
        expect(snapshot.allow).toContain("warehouse.products.delete");
      });
    });
  });

  describe("Empty Permissions Handling", () => {
    it("should sync empty arrays correctly (prevents stale state)", async () => {
      const emptyPermissions = {
        permissions: {
          allow: [],
          deny: [],
        },
      };
      mockGetBranchPermissions.mockResolvedValue(emptyPermissions);

      // Pre-populate user store with some permissions (simulating previous state)
      act(() => {
        useUserStoreV2.getState().setPermissionSnapshot({
          allow: ["old.permission.read"],
          deny: ["old.permission.delete"],
        });
      });

      // Verify pre-populated state
      expect(useUserStoreV2.getState().permissionSnapshot.allow).toContain("old.permission.read");

      // Hydrate app store
      act(() => {
        useAppStoreV2.getState().hydrateFromServer({
          activeOrgId: "org-123",
          activeBranchId: "branch-456",
          activeOrg: {
            id: "org-123",
            name: "Test Org",
            name_2: null,
            slug: "test-org",
            logo_url: null,
          },
          activeBranch: {
            id: "branch-456",
            name: "Branch",
            organization_id: "org-123",
            slug: "branch",
            created_at: "2024-01-01",
          },
          availableBranches: [],
          userModules: [],
        });
      });

      const Wrapper = createWrapper(queryClient);
      render(
        <Wrapper>
          <PermissionsSync />
        </Wrapper>
      );

      // Wait for sync
      await waitFor(() => {
        expect(mockGetBranchPermissions).toHaveBeenCalled();
      });

      // Empty arrays should replace old permissions (not leave stale state)
      await waitFor(() => {
        const snapshot = useUserStoreV2.getState().permissionSnapshot;
        expect(snapshot.allow).toEqual([]);
        expect(snapshot.deny).toEqual([]);
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle server action errors gracefully", async () => {
      mockGetBranchPermissions.mockRejectedValue(new Error("Network error"));

      act(() => {
        useAppStoreV2.getState().hydrateFromServer({
          activeOrgId: "org-123",
          activeBranchId: "branch-456",
          activeOrg: {
            id: "org-123",
            name: "Test Org",
            name_2: null,
            slug: "test-org",
            logo_url: null,
          },
          activeBranch: {
            id: "branch-456",
            name: "Branch",
            organization_id: "org-123",
            slug: "branch",
            created_at: "2024-01-01",
          },
          availableBranches: [],
          userModules: [],
        });
      });

      const Wrapper = createWrapper(queryClient);

      // Should not throw
      expect(() => {
        render(
          <Wrapper>
            <PermissionsSync />
          </Wrapper>
        );
      }).not.toThrow();

      // Wait for error to be processed
      await waitFor(() => {
        expect(mockGetBranchPermissions).toHaveBeenCalled();
      });

      // Permission snapshot should remain unchanged (not corrupted)
      // Note: The component doesn't sync on error since isFetched with data check
    });
  });

  describe("Component Rendering", () => {
    it("should render null (no UI)", async () => {
      mockGetBranchPermissions.mockResolvedValue({
        permissions: { allow: [], deny: [] },
      });

      act(() => {
        useAppStoreV2.getState().hydrateFromServer({
          activeOrgId: "org-123",
          activeBranchId: "branch-456",
          activeOrg: {
            id: "org-123",
            name: "Test Org",
            name_2: null,
            slug: "test-org",
            logo_url: null,
          },
          activeBranch: {
            id: "branch-456",
            name: "Branch",
            organization_id: "org-123",
            slug: "branch",
            created_at: "2024-01-01",
          },
          availableBranches: [],
          userModules: [],
        });
      });

      const Wrapper = createWrapper(queryClient);
      const { container } = render(
        <Wrapper>
          <PermissionsSync />
        </Wrapper>
      );

      // Should not render any DOM elements
      expect(container.firstChild).toBeNull();
    });
  });

  describe("Integration with usePermissions hook", () => {
    it("should enable can() checks after permissions sync", async () => {
      const mockPermissions = {
        permissions: {
          allow: ["warehouse.*"],
          deny: ["warehouse.products.delete"],
        },
      };
      mockGetBranchPermissions.mockResolvedValue(mockPermissions);

      act(() => {
        useAppStoreV2.getState().hydrateFromServer({
          activeOrgId: "org-123",
          activeBranchId: "branch-456",
          activeOrg: {
            id: "org-123",
            name: "Test Org",
            name_2: null,
            slug: "test-org",
            logo_url: null,
          },
          activeBranch: {
            id: "branch-456",
            name: "Branch",
            organization_id: "org-123",
            slug: "branch",
            created_at: "2024-01-01",
          },
          availableBranches: [],
          userModules: [],
        });
      });

      const Wrapper = createWrapper(queryClient);
      render(
        <Wrapper>
          <PermissionsSync />
        </Wrapper>
      );

      // Wait for permissions to sync
      await waitFor(() => {
        const snapshot = useUserStoreV2.getState().permissionSnapshot;
        expect(snapshot.allow).toContain("warehouse.*");
      });

      // Now verify the snapshot is ready for usePermissions hook
      const snapshot = useUserStoreV2.getState().permissionSnapshot;

      // These checks simulate what usePermissions.can() would do
      expect(snapshot.allow.some((p) => p === "warehouse.*" || p.startsWith("warehouse."))).toBe(
        true
      );
      expect(snapshot.deny).toContain("warehouse.products.delete");
    });
  });
});
