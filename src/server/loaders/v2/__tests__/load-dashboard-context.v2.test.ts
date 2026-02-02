import { describe, it, expect, vi, beforeEach } from "vitest";
import { loadDashboardContextV2 } from "../load-dashboard-context.v2";
import { loadAppContextV2 } from "../load-app-context.v2";
import { loadUserContextV2 } from "../load-user-context.v2";

// Mock the individual loaders
vi.mock("../load-app-context.v2");
vi.mock("../load-user-context.v2");

describe("loadDashboardContextV2", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return null when app context is null", async () => {
    vi.mocked(loadAppContextV2).mockResolvedValue(null);

    const result = await loadDashboardContextV2();

    expect(result).toBeNull();
    expect(loadAppContextV2).toHaveBeenCalledTimes(1);
    expect(loadUserContextV2).not.toHaveBeenCalled();
  });

  it("should return null when user context is null", async () => {
    const mockAppContext = {
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
        slug: "main-branch",
        created_at: "2024-01-01T00:00:00Z",
      },
      availableBranches: [],
      userModules: [],
    };

    vi.mocked(loadAppContextV2).mockResolvedValue(mockAppContext);
    vi.mocked(loadUserContextV2).mockResolvedValue(null);

    const result = await loadDashboardContextV2();

    expect(result).toBeNull();
    expect(loadAppContextV2).toHaveBeenCalledTimes(1);
    expect(loadUserContextV2).toHaveBeenCalledWith("org-123", "branch-456");
  });

  it("should return combined context when both loaders succeed", async () => {
    const mockAppContext = {
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
        slug: "main-branch",
        created_at: "2024-01-01T00:00:00Z",
      },
      availableBranches: [],
      userModules: [],
    };

    const mockUserContext = {
      user: {
        id: "user-123",
        email: "test@example.com",
        first_name: "John",
        last_name: "Doe",
        avatar_url: null,
      },
      roles: [],
      permissionSnapshot: { allow: ["warehouse.products.view"], deny: [] },
    };

    vi.mocked(loadAppContextV2).mockResolvedValue(mockAppContext);
    vi.mocked(loadUserContextV2).mockResolvedValue(mockUserContext);

    const result = await loadDashboardContextV2();

    expect(result).toEqual({
      app: mockAppContext,
      user: mockUserContext,
    });
    expect(loadAppContextV2).toHaveBeenCalledTimes(1);
    expect(loadUserContextV2).toHaveBeenCalledWith("org-123", "branch-456");
  });

  it("should pass resolved org/branch IDs to user context loader", async () => {
    const mockAppContext = {
      activeOrgId: "org-999",
      activeBranchId: "branch-888",
      activeOrg: {
        id: "org-999",
        name: "Test Org",
        name_2: null,
        slug: "test-org",
        logo_url: null,
      },
      activeBranch: {
        id: "branch-888",
        name: "Main Branch",
        organization_id: "org-999",
        slug: "main-branch",
        created_at: "2024-01-01T00:00:00Z",
      },
      availableBranches: [],
      userModules: [],
    };

    const mockUserContext = {
      user: {
        id: "user-123",
        email: "test@example.com",
        first_name: "John",
        last_name: "Doe",
        avatar_url: null,
      },
      roles: [],
      permissionSnapshot: { allow: ["warehouse.products.view"], deny: [] },
    };

    vi.mocked(loadAppContextV2).mockResolvedValue(mockAppContext);
    vi.mocked(loadUserContextV2).mockResolvedValue(mockUserContext);

    await loadDashboardContextV2();

    // CRITICAL: User context loader receives RESOLVED IDs from app context
    // NOT from user preferences (which may be stale)
    expect(loadUserContextV2).toHaveBeenCalledWith("org-999", "branch-888");
  });

  it("should handle null org/branch IDs correctly", async () => {
    const mockAppContext = {
      activeOrgId: null,
      activeBranchId: null,
      activeOrg: null,
      activeBranch: null,
      availableBranches: [],
      userModules: [],
    };

    const mockUserContext = {
      user: {
        id: "user-123",
        email: "test@example.com",
        first_name: "John",
        last_name: "Doe",
        avatar_url: null,
      },
      roles: [],
      permissionSnapshot: { allow: [], deny: [] },
    };

    vi.mocked(loadAppContextV2).mockResolvedValue(mockAppContext);
    vi.mocked(loadUserContextV2).mockResolvedValue(mockUserContext);

    const result = await loadDashboardContextV2();

    expect(result).toEqual({
      app: mockAppContext,
      user: mockUserContext,
    });
    expect(loadUserContextV2).toHaveBeenCalledWith(null, null);
  });
});
