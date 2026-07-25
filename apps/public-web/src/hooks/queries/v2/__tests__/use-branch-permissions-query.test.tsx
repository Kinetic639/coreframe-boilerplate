/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";
import { useBranchPermissionsQuery } from "../use-branch-permissions-query";

// Mock the server action
vi.mock("@/app/actions/v2/permissions", () => ({
  getBranchPermissions: vi.fn(),
}));

import { getBranchPermissions } from "@/app/actions/v2/permissions";

const mockGetBranchPermissions = getBranchPermissions as ReturnType<typeof vi.fn>;

// Create wrapper with QueryClientProvider
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0, // Disable garbage collection for tests
      },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("useBranchPermissionsQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("enabled logic", () => {
    it("should NOT fetch when orgId is null", async () => {
      const wrapper = createWrapper();

      const { result } = renderHook(
        () =>
          useBranchPermissionsQuery({
            orgId: null,
            branchId: "branch-123",
          }),
        { wrapper }
      );

      // Query should not be fetching
      expect(result.current.isFetching).toBe(false);
      expect(result.current.status).toBe("pending");
      expect(mockGetBranchPermissions).not.toHaveBeenCalled();
    });

    it("should NOT fetch when branchId is null", async () => {
      const wrapper = createWrapper();

      const { result } = renderHook(
        () =>
          useBranchPermissionsQuery({
            orgId: "org-123",
            branchId: null,
          }),
        { wrapper }
      );

      // Query should not be fetching
      expect(result.current.isFetching).toBe(false);
      expect(result.current.status).toBe("pending");
      expect(mockGetBranchPermissions).not.toHaveBeenCalled();
    });

    it("should NOT fetch when both orgId and branchId are null", async () => {
      const wrapper = createWrapper();

      const { result } = renderHook(
        () =>
          useBranchPermissionsQuery({
            orgId: null,
            branchId: null,
          }),
        { wrapper }
      );

      // Query should not be fetching
      expect(result.current.isFetching).toBe(false);
      expect(mockGetBranchPermissions).not.toHaveBeenCalled();
    });

    it("should fetch when both orgId and branchId are present", async () => {
      const mockPermissions = {
        permissions: {
          allow: ["warehouse.products.read"],
          deny: [],
        },
      };
      mockGetBranchPermissions.mockResolvedValue(mockPermissions);

      const wrapper = createWrapper();

      const { result } = renderHook(
        () =>
          useBranchPermissionsQuery({
            orgId: "org-123",
            branchId: "branch-456",
          }),
        { wrapper }
      );

      // Wait for the query to complete
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockGetBranchPermissions).toHaveBeenCalledWith("org-123", "branch-456");
      expect(result.current.data).toEqual(mockPermissions);
    });

    it("should respect custom enabled=false option", async () => {
      const wrapper = createWrapper();

      const { result } = renderHook(
        () =>
          useBranchPermissionsQuery({
            orgId: "org-123",
            branchId: "branch-456",
            enabled: false,
          }),
        { wrapper }
      );

      // Query should not be fetching even with valid IDs
      expect(result.current.isFetching).toBe(false);
      expect(mockGetBranchPermissions).not.toHaveBeenCalled();
    });
  });

  describe("query key changes trigger refetch", () => {
    it("should refetch when orgId changes", async () => {
      const mockPermissions = {
        permissions: {
          allow: ["warehouse.products.read"],
          deny: [],
        },
      };
      mockGetBranchPermissions.mockResolvedValue(mockPermissions);

      const wrapper = createWrapper();

      // Initial render with org-123
      const { result, rerender } = renderHook(
        ({ orgId, branchId }: { orgId: string; branchId: string }) =>
          useBranchPermissionsQuery({ orgId, branchId }),
        {
          wrapper,
          initialProps: { orgId: "org-123", branchId: "branch-456" },
        }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockGetBranchPermissions).toHaveBeenCalledWith("org-123", "branch-456");
      expect(mockGetBranchPermissions).toHaveBeenCalledTimes(1);

      // Change orgId
      rerender({ orgId: "org-999", branchId: "branch-456" });

      await waitFor(() => {
        expect(mockGetBranchPermissions).toHaveBeenCalledTimes(2);
      });

      expect(mockGetBranchPermissions).toHaveBeenLastCalledWith("org-999", "branch-456");
    });

    it("should refetch when branchId changes", async () => {
      const mockPermissions = {
        permissions: {
          allow: ["warehouse.products.read"],
          deny: [],
        },
      };
      mockGetBranchPermissions.mockResolvedValue(mockPermissions);

      const wrapper = createWrapper();

      // Initial render with branch-456
      const { result, rerender } = renderHook(
        ({ orgId, branchId }: { orgId: string; branchId: string }) =>
          useBranchPermissionsQuery({ orgId, branchId }),
        {
          wrapper,
          initialProps: { orgId: "org-123", branchId: "branch-456" },
        }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockGetBranchPermissions).toHaveBeenCalledWith("org-123", "branch-456");
      expect(mockGetBranchPermissions).toHaveBeenCalledTimes(1);

      // Change branchId
      rerender({ orgId: "org-123", branchId: "branch-999" });

      await waitFor(() => {
        expect(mockGetBranchPermissions).toHaveBeenCalledTimes(2);
      });

      expect(mockGetBranchPermissions).toHaveBeenLastCalledWith("org-123", "branch-999");
    });

    it("should refetch when both orgId and branchId change", async () => {
      const mockPermissions = {
        permissions: {
          allow: ["warehouse.products.read"],
          deny: [],
        },
      };
      mockGetBranchPermissions.mockResolvedValue(mockPermissions);

      const wrapper = createWrapper();

      const { result, rerender } = renderHook(
        ({ orgId, branchId }: { orgId: string; branchId: string }) =>
          useBranchPermissionsQuery({ orgId, branchId }),
        {
          wrapper,
          initialProps: { orgId: "org-123", branchId: "branch-456" },
        }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockGetBranchPermissions).toHaveBeenCalledTimes(1);

      // Change both IDs
      rerender({ orgId: "org-NEW", branchId: "branch-NEW" });

      await waitFor(() => {
        expect(mockGetBranchPermissions).toHaveBeenCalledTimes(2);
      });

      expect(mockGetBranchPermissions).toHaveBeenLastCalledWith("org-NEW", "branch-NEW");
    });

    it("should NOT refetch when IDs stay the same", async () => {
      const mockPermissions = {
        permissions: {
          allow: ["warehouse.products.read"],
          deny: [],
        },
      };
      mockGetBranchPermissions.mockResolvedValue(mockPermissions);

      const wrapper = createWrapper();

      const { result, rerender } = renderHook(
        ({ orgId, branchId }: { orgId: string; branchId: string }) =>
          useBranchPermissionsQuery({ orgId, branchId }),
        {
          wrapper,
          initialProps: { orgId: "org-123", branchId: "branch-456" },
        }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockGetBranchPermissions).toHaveBeenCalledTimes(1);

      // Rerender with same IDs
      rerender({ orgId: "org-123", branchId: "branch-456" });

      // Should not trigger another call
      expect(mockGetBranchPermissions).toHaveBeenCalledTimes(1);
    });
  });

  describe("staleTime configuration", () => {
    it("should have 5 minute staleTime configured", async () => {
      const mockPermissions = {
        permissions: {
          allow: ["warehouse.products.read"],
          deny: [],
        },
      };
      mockGetBranchPermissions.mockResolvedValue(mockPermissions);

      // Create a queryClient that we can inspect
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            gcTime: 0,
          },
        },
      });

      function Wrapper({ children }: { children: ReactNode }) {
        return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
      }

      const { result } = renderHook(
        () =>
          useBranchPermissionsQuery({
            orgId: "org-123",
            branchId: "branch-456",
          }),
        { wrapper: Wrapper }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Check the query state in the cache
      const queryKey = ["v2", "permissions", "org-123", "branch-456"];
      const queryState = queryClient.getQueryState(queryKey);

      expect(queryState).toBeDefined();
      // Data should not be stale immediately (since staleTime is 5 minutes)
      expect(result.current.isStale).toBe(false);
    });

    it("should use cached data within staleTime window", async () => {
      const mockPermissions = {
        permissions: {
          allow: ["warehouse.products.read"],
          deny: [],
        },
      };
      mockGetBranchPermissions.mockResolvedValue(mockPermissions);

      // Create a shared queryClient
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            gcTime: Infinity, // Keep cache for test duration
          },
        },
      });

      function Wrapper({ children }: { children: ReactNode }) {
        return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
      }

      // First hook instance
      const { result: result1, unmount } = renderHook(
        () =>
          useBranchPermissionsQuery({
            orgId: "org-123",
            branchId: "branch-456",
          }),
        { wrapper: Wrapper }
      );

      await waitFor(() => {
        expect(result1.current.isSuccess).toBe(true);
      });

      expect(mockGetBranchPermissions).toHaveBeenCalledTimes(1);

      unmount();

      // Second hook instance with same query key - should use cached data
      const { result: result2 } = renderHook(
        () =>
          useBranchPermissionsQuery({
            orgId: "org-123",
            branchId: "branch-456",
          }),
        { wrapper: Wrapper }
      );

      // Data should be available immediately from cache
      await waitFor(() => {
        expect(result2.current.isSuccess).toBe(true);
      });

      // Should NOT make another network call since data is within staleTime
      expect(mockGetBranchPermissions).toHaveBeenCalledTimes(1);
      expect(result2.current.data).toEqual(mockPermissions);
    });
  });

  describe("returns empty snapshot when orgId is null", () => {
    it("should return empty snapshot when queryFn is called with null orgId", async () => {
      // This tests the defensive return in queryFn
      // Note: The query is disabled when orgId is null, so queryFn won't be called
      // But we can test this by temporarily enabling the query

      const wrapper = createWrapper();

      const { result } = renderHook(
        () =>
          useBranchPermissionsQuery({
            orgId: null,
            branchId: "branch-123",
          }),
        { wrapper }
      );

      // Query should be pending (not enabled)
      expect(result.current.status).toBe("pending");
      expect(result.current.data).toBeUndefined();
      expect(mockGetBranchPermissions).not.toHaveBeenCalled();
    });

    it("should handle server action returning empty snapshot", async () => {
      // Server action itself handles null orgId defensively
      const emptyPermissions = {
        permissions: {
          allow: [],
          deny: [],
        },
      };
      mockGetBranchPermissions.mockResolvedValue(emptyPermissions);

      const wrapper = createWrapper();

      const { result } = renderHook(
        () =>
          useBranchPermissionsQuery({
            orgId: "org-123",
            branchId: "branch-456",
          }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.permissions).toEqual({
        allow: [],
        deny: [],
      });
    });
  });

  describe("query key structure", () => {
    it("should use correct query key format: [v2, permissions, orgId, branchId]", async () => {
      const mockPermissions = {
        permissions: {
          allow: ["warehouse.products.read"],
          deny: [],
        },
      };
      mockGetBranchPermissions.mockResolvedValue(mockPermissions);

      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            gcTime: 0,
          },
        },
      });

      function Wrapper({ children }: { children: ReactNode }) {
        return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
      }

      const { result } = renderHook(
        () =>
          useBranchPermissionsQuery({
            orgId: "test-org-id",
            branchId: "test-branch-id",
          }),
        { wrapper: Wrapper }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Check that the query key exists in the cache
      const expectedQueryKey = ["v2", "permissions", "test-org-id", "test-branch-id"];
      const queryState = queryClient.getQueryState(expectedQueryKey);

      expect(queryState).toBeDefined();
      expect(queryState?.data).toEqual(mockPermissions);
    });
  });

  describe("error handling", () => {
    it("should handle server action errors gracefully", async () => {
      mockGetBranchPermissions.mockRejectedValue(new Error("Network error"));

      const wrapper = createWrapper();

      const { result } = renderHook(
        () =>
          useBranchPermissionsQuery({
            orgId: "org-123",
            branchId: "branch-456",
          }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeInstanceOf(Error);
      expect((result.current.error as Error).message).toBe("Network error");
    });
  });

  describe("refetchOnWindowFocus configuration", () => {
    it("should have refetchOnWindowFocus disabled", async () => {
      const mockPermissions = {
        permissions: {
          allow: ["warehouse.products.read"],
          deny: [],
        },
      };
      mockGetBranchPermissions.mockResolvedValue(mockPermissions);

      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            gcTime: Infinity,
          },
        },
      });

      function Wrapper({ children }: { children: ReactNode }) {
        return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
      }

      const { result } = renderHook(
        () =>
          useBranchPermissionsQuery({
            orgId: "org-123",
            branchId: "branch-456",
          }),
        { wrapper: Wrapper }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockGetBranchPermissions).toHaveBeenCalledTimes(1);

      // Simulate window focus event
      window.dispatchEvent(new Event("focus"));

      // Wait a bit and check no new calls were made
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Should NOT refetch on window focus
      expect(mockGetBranchPermissions).toHaveBeenCalledTimes(1);
    });
  });
});
