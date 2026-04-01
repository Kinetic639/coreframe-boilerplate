/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { loadDashboardContextV2 } from "../load-dashboard-context.v2";
import { loadAppContextV2 } from "../load-app-context.v2";
import { loadUserContextV2 } from "../load-user-context.v2";

// Mock the individual loaders
vi.mock("../load-app-context.v2");
vi.mock("../load-user-context.v2");

// Mock createClient for slow-path branch queries
const { mockSupabaseFrom } = vi.hoisted(() => {
  const mockSupabaseFrom = vi.fn();
  return { mockSupabaseFrom };
});
vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({ from: mockSupabaseFrom }),
}));

// resolveActiveBranch: return first arg if it's in the second array, else first of array or null
vi.mock("@repo/domain/branch", () => ({
  resolveActiveBranch: vi.fn((activeBranchId: string | null, ids: string[]) => {
    if (activeBranchId && ids.includes(activeBranchId)) return activeBranchId;
    return ids[0] ?? null;
  }),
}));

// React cache — identity in tests
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, cache: (fn: unknown) => fn };
});

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
      accessibleBranches: [],
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
    const mockBranch = {
      id: "branch-456",
      name: "Main Branch",
      organization_id: "org-123",
      slug: "main-branch",
      created_at: "2024-01-01T00:00:00Z",
    };
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
      activeBranch: mockBranch,
      availableBranches: [mockBranch],
      accessibleBranches: [],
      userModules: [],
    };

    const mockUserContext = {
      user: {
        id: "user-123",
        email: "test@example.com",
        first_name: "John",
        last_name: "Doe",
        avatar_url: null,
        avatar_signed_url: null,
      },
      roles: [],
      // branches.view.any → fast path in _computeAccessibleBranches (no createClient call)
      permissionSnapshot: { allow: ["warehouse.products.view", "branches.view.any"], deny: [] },
    };

    vi.mocked(loadAppContextV2).mockResolvedValue(mockAppContext);
    vi.mocked(loadUserContextV2).mockResolvedValue(mockUserContext);

    const result = await loadDashboardContextV2();

    expect(result).toEqual({
      app: { ...mockAppContext, accessibleBranches: [mockBranch] },
      user: mockUserContext,
    });
    expect(loadAppContextV2).toHaveBeenCalledTimes(1);
    expect(loadUserContextV2).toHaveBeenCalledWith("org-123", "branch-456");
  });

  it("should pass resolved org/branch IDs to user context loader", async () => {
    const mockBranch = {
      id: "branch-888",
      name: "Main Branch",
      organization_id: "org-999",
      slug: "main-branch",
      created_at: "2024-01-01T00:00:00Z",
    };
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
      activeBranch: mockBranch,
      availableBranches: [mockBranch],
      accessibleBranches: [],
      userModules: [],
    };

    const mockUserContext = {
      user: {
        id: "user-123",
        email: "test@example.com",
        first_name: "John",
        last_name: "Doe",
        avatar_url: null,
        avatar_signed_url: null,
      },
      roles: [],
      // branches.view.any → fast path in _computeAccessibleBranches (no createClient call)
      permissionSnapshot: { allow: ["warehouse.products.view", "branches.view.any"], deny: [] },
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
      accessibleBranches: [],
      userModules: [],
    };

    const mockUserContext = {
      user: {
        id: "user-123",
        email: "test@example.com",
        first_name: "John",
        last_name: "Doe",
        avatar_url: null,
        avatar_signed_url: null,
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

// ─── Slow path + branch resolution ───────────────────────────────────────────

describe("_computeAccessibleBranches — slow path", () => {
  const BRANCH_1 = {
    id: "b-1",
    name: "Branch 1",
    organization_id: "org-1",
    slug: "b1",
    created_at: "2024-01-01T00:00:00Z",
  };
  const BRANCH_2 = {
    id: "b-2",
    name: "Branch 2",
    organization_id: "org-1",
    slug: "b2",
    created_at: "2024-01-02T00:00:00Z",
  };

  const baseAppContext = {
    activeOrgId: "org-1",
    activeBranchId: "b-1",
    activeOrg: { id: "org-1", name: "Org", name_2: null, slug: "org", logo_url: null },
    activeBranch: BRANCH_1,
    availableBranches: [BRANCH_1, BRANCH_2],
    accessibleBranches: [],
    userModules: [],
  };

  const baseUserContext = {
    user: {
      id: "user-1",
      email: "u@x.com",
      first_name: null,
      last_name: null,
      avatar_url: null,
      avatar_signed_url: null,
    },
    roles: [],
    permissionSnapshot: { allow: ["module.organization-management.access"], deny: [] }, // NO branches.view.any
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadAppContextV2).mockResolvedValue(baseAppContext);
    vi.mocked(loadUserContextV2).mockResolvedValue(baseUserContext);
  });

  it("slow path: returns branches matching user role assignments", async () => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockResolvedValue({ data: [{ scope_id: "b-1" }], error: null }),
    };
    mockSupabaseFrom.mockReturnValue(chain);

    const result = await loadDashboardContextV2();
    expect(result!.app.accessibleBranches).toEqual([BRANCH_1]);
  });

  it("slow path: returns empty when no assignments", async () => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    mockSupabaseFrom.mockReturnValue(chain);

    const result = await loadDashboardContextV2();
    expect(result!.app.accessibleBranches).toEqual([]);
  });

  it("slow path: tolerates DB error (logs, returns empty)", async () => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockResolvedValue({ data: null, error: { message: "RLS violation" } }),
    };
    mockSupabaseFrom.mockReturnValue(chain);

    const result = await loadDashboardContextV2();
    // On error, assignments is null → empty set → no accessible branches
    expect(result!.app.accessibleBranches).toEqual([]);
  });

  it("fast path: BRANCHES_VIEW_ANY skips DB query and returns all branches", async () => {
    vi.mocked(loadUserContextV2).mockResolvedValue({
      ...baseUserContext,
      permissionSnapshot: { allow: ["branches.view.any"], deny: [] },
    });

    const result = await loadDashboardContextV2();
    // All available branches returned without DB call
    expect(result!.app.accessibleBranches).toEqual([BRANCH_1, BRANCH_2]);
    expect(mockSupabaseFrom).not.toHaveBeenCalled();
  });
});

describe("resolveActiveBranch + userContext reload", () => {
  const BRANCH_1 = { id: "b-1", name: "B1", organization_id: "org-1", slug: "b1", created_at: "" };
  const BRANCH_2 = { id: "b-2", name: "B2", organization_id: "org-1", slug: "b2", created_at: "" };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("falls back to first accessible branch when active branch is not accessible", async () => {
    // appContext says active is b-1, but user only has access to b-2
    vi.mocked(loadAppContextV2).mockResolvedValue({
      activeOrgId: "org-1",
      activeBranchId: "b-1",
      activeOrg: null,
      activeBranch: BRANCH_1,
      availableBranches: [BRANCH_1, BRANCH_2],
      accessibleBranches: [],
      userModules: [],
    });
    const userCtx = {
      user: {
        id: "u-1",
        email: "x@y.com",
        first_name: null,
        last_name: null,
        avatar_url: null,
        avatar_signed_url: null,
      },
      roles: [],
      permissionSnapshot: { allow: [], deny: [] },
    };
    vi.mocked(loadUserContextV2).mockResolvedValue(userCtx);

    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockResolvedValue({ data: [{ scope_id: "b-2" }], error: null }),
    };
    mockSupabaseFrom.mockReturnValue(chain);

    const result = await loadDashboardContextV2();
    // b-1 not in [b-2] → resolveActiveBranch returns b-2
    expect(result!.app.activeBranchId).toBe("b-2");
    // activeBranchId changed → reloads user context for new branch
    expect(vi.mocked(loadUserContextV2)).toHaveBeenCalledWith("org-1", "b-2");
  });

  it("keeps active branch when it IS accessible", async () => {
    vi.mocked(loadAppContextV2).mockResolvedValue({
      activeOrgId: "org-1",
      activeBranchId: "b-1",
      activeOrg: null,
      activeBranch: BRANCH_1,
      availableBranches: [BRANCH_1, BRANCH_2],
      accessibleBranches: [],
      userModules: [],
    });
    vi.mocked(loadUserContextV2).mockResolvedValue({
      user: {
        id: "u-1",
        email: "x@y.com",
        first_name: null,
        last_name: null,
        avatar_url: null,
        avatar_signed_url: null,
      },
      roles: [],
      permissionSnapshot: { allow: ["branches.view.any"], deny: [] },
    });

    const result = await loadDashboardContextV2();
    expect(result!.app.activeBranchId).toBe("b-1");
    // No reload needed — loadUserContextV2 called only once
    expect(vi.mocked(loadUserContextV2)).toHaveBeenCalledTimes(1);
  });
});
