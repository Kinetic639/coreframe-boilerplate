/**
 * @vitest-environment node
 *
 * Tests: changeBranch and removeBranchPreference server actions
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock setup ───────────────────────────────────────────────────────────────

const { mockCreateClient, mockLoadDashboardContextV2 } = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
  mockLoadDashboardContextV2: vi.fn(),
}));

vi.mock("@/utils/supabase/server", () => ({
  createClient: mockCreateClient,
}));

vi.mock("@/server/loaders/v2/load-dashboard-context.v2", () => ({
  loadDashboardContextV2: mockLoadDashboardContextV2,
}));

import { changeBranch, removeBranchPreference } from "../changeBranch";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeSupabase(
  options: {
    user?: object | null;
    authError?: object | null;
    dbError?: object | null;
  } = {}
) {
  const { user = { id: "user-1" }, authError = null, dbError = null } = options;
  const updateChain = {
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue({ error: dbError }),
  };
  const supabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user },
        error: authError,
      }),
    },
    from: vi.fn().mockReturnValue(updateChain),
    _updateChain: updateChain,
  };
  return supabase;
}

function makeContext(
  options: {
    activeOrgId?: string | null;
    availableBranches?: Array<{ id: string; name: string }>;
    accessibleBranches?: Array<{ id: string; name: string }>;
    permissions?: string[];
  } = {}
) {
  const {
    activeOrgId = "org-1",
    availableBranches = [
      { id: "branch-1", name: "Branch 1" },
      { id: "branch-2", name: "Branch 2" },
    ],
    accessibleBranches = [{ id: "branch-1", name: "Branch 1" }],
    permissions = [],
  } = options;

  return {
    app: {
      activeOrgId,
      availableBranches,
      accessibleBranches,
    },
    user: {
      permissionSnapshot: { allow: permissions, deny: [] },
    },
  };
}

// ─── changeBranch ─────────────────────────────────────────────────────────────

describe("changeBranch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateClient.mockResolvedValue(makeSupabase());
    mockLoadDashboardContextV2.mockResolvedValue(makeContext());
  });

  it("returns error when branchId is empty string", async () => {
    const result = await changeBranch("");
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe("Invalid branch ID");
  });

  it("returns error when auth fails", async () => {
    mockCreateClient.mockResolvedValue(
      makeSupabase({ user: null, authError: { message: "JWT expired" } })
    );
    const result = await changeBranch("branch-1");
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe("Unauthorized");
  });

  it("returns error when user is null", async () => {
    mockCreateClient.mockResolvedValue(makeSupabase({ user: null }));
    const result = await changeBranch("branch-1");
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe("Unauthorized");
  });

  it("returns error when context is null", async () => {
    mockLoadDashboardContextV2.mockResolvedValue(null);
    const result = await changeBranch("branch-1");
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe("Unauthorized");
  });

  it("returns error when no activeOrgId in context", async () => {
    mockLoadDashboardContextV2.mockResolvedValue(makeContext({ activeOrgId: null }));
    const result = await changeBranch("branch-1");
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe("No active organization");
  });

  it("returns error when branch not in org availableBranches", async () => {
    mockLoadDashboardContextV2.mockResolvedValue(
      makeContext({ availableBranches: [{ id: "branch-1", name: "Branch 1" }] })
    );
    const result = await changeBranch("branch-999");
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe(
      "Branch not found in your organization"
    );
  });

  it("returns error when branch not accessible and no BRANCHES_VIEW_UPDATE_ANY permission", async () => {
    mockLoadDashboardContextV2.mockResolvedValue(
      makeContext({
        availableBranches: [
          { id: "branch-1", name: "Branch 1" },
          { id: "branch-2", name: "Branch 2" },
        ],
        accessibleBranches: [{ id: "branch-1", name: "Branch 1" }],
        permissions: [],
      })
    );
    const result = await changeBranch("branch-2");
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe(
      "You do not have access to this branch"
    );
  });

  it("succeeds when branch is in accessibleBranches", async () => {
    mockLoadDashboardContextV2.mockResolvedValue(
      makeContext({
        accessibleBranches: [{ id: "branch-1", name: "Branch 1" }],
      })
    );
    const result = await changeBranch("branch-1");
    expect(result.success).toBe(true);
  });

  it("succeeds when user has BRANCHES_VIEW_UPDATE_ANY permission even for inaccessible branch", async () => {
    mockLoadDashboardContextV2.mockResolvedValue(
      makeContext({
        availableBranches: [
          { id: "branch-1", name: "Branch 1" },
          { id: "branch-2", name: "Branch 2" },
        ],
        accessibleBranches: [{ id: "branch-1", name: "Branch 1" }],
        permissions: ["branches.view.update.any"],
      })
    );
    const result = await changeBranch("branch-2");
    expect(result.success).toBe(true);
  });

  it("returns error when DB update fails", async () => {
    const supabase = makeSupabase({ dbError: { message: "update failed" } });
    mockCreateClient.mockResolvedValue(supabase);
    const result = await changeBranch("branch-1");
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe(
      "Failed to update branch preference"
    );
  });

  it("calls supabase.from('user_preferences').update with correct data", async () => {
    const supabase = makeSupabase();
    mockCreateClient.mockResolvedValue(supabase);
    await changeBranch("branch-1");
    expect(supabase.from).toHaveBeenCalledWith("user_preferences");
    expect(supabase._updateChain.update).toHaveBeenCalledWith({ default_branch_id: "branch-1" });
    expect(supabase._updateChain.eq).toHaveBeenCalledWith("user_id", "user-1");
  });
});

// ─── removeBranchPreference ───────────────────────────────────────────────────

describe("removeBranchPreference", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateClient.mockResolvedValue(makeSupabase());
    mockLoadDashboardContextV2.mockResolvedValue(makeContext());
  });

  it("returns success when user is authenticated and DB update succeeds", async () => {
    const result = await removeBranchPreference();
    expect(result.success).toBe(true);
  });

  it("returns error when auth fails", async () => {
    mockCreateClient.mockResolvedValue(
      makeSupabase({ user: null, authError: { message: "JWT expired" } })
    );
    const result = await removeBranchPreference();
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe("Unauthorized");
  });

  it("returns error when user is null", async () => {
    mockCreateClient.mockResolvedValue(makeSupabase({ user: null }));
    const result = await removeBranchPreference();
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe("Unauthorized");
  });

  it("returns error when DB update fails", async () => {
    const supabase = makeSupabase({ dbError: { message: "permission denied" } });
    mockCreateClient.mockResolvedValue(supabase);
    const result = await removeBranchPreference();
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe(
      "Failed to clear branch preference"
    );
  });

  it("clears default_branch_id by setting it to null", async () => {
    const supabase = makeSupabase();
    mockCreateClient.mockResolvedValue(supabase);
    await removeBranchPreference();
    expect(supabase.from).toHaveBeenCalledWith("user_preferences");
    expect(supabase._updateChain.update).toHaveBeenCalledWith({ default_branch_id: null });
    expect(supabase._updateChain.eq).toHaveBeenCalledWith("user_id", "user-1");
  });

  it("still succeeds when context is null (optional context)", async () => {
    mockLoadDashboardContextV2.mockResolvedValue(null);
    const result = await removeBranchPreference();
    expect(result.success).toBe(true);
  });
});
