/**
 * @vitest-environment node
 *
 * Covers gap paths in branches.ts:
 *   - event emission for createBranchAction, updateBranchAction, deleteBranchAction
 *   - service error paths (not covered in actions-org-gaps.test.ts)
 *   - deleteBranchAction: pre-fetch branch name fallback behaviour
 *
 * Auth / validation / permission guards are already tested in actions-org-gaps.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoist mocks ──────────────────────────────────────────────────────────────

const {
  mockCreateClient,
  mockLoadDashboardContextV2,
  mockRequireModuleAccess,
  mockMapEntitlementError,
  mockEventEmit,
  mockCreateBranch,
  mockUpdateBranch,
  mockDeleteBranch,
} = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
  mockLoadDashboardContextV2: vi.fn(),
  mockRequireModuleAccess: vi.fn().mockResolvedValue(undefined),
  mockMapEntitlementError: vi.fn().mockReturnValue(null),
  mockEventEmit: vi.fn().mockResolvedValue({ success: true }),
  mockCreateBranch: vi.fn(),
  mockUpdateBranch: vi.fn(),
  mockDeleteBranch: vi.fn(),
}));

vi.mock("@/utils/supabase/server", () => ({ createClient: mockCreateClient }));
vi.mock("@/server/loaders/v2/load-dashboard-context.v2", () => ({
  loadDashboardContextV2: mockLoadDashboardContextV2,
}));
vi.mock("@/server/guards/entitlements-guards", () => ({
  entitlements: { requireModuleAccess: mockRequireModuleAccess },
  mapEntitlementError: mockMapEntitlementError,
}));
vi.mock("@/server/services/organization.service", () => ({
  OrgBranchesService: {
    listBranches: vi.fn(),
    createBranch: mockCreateBranch,
    updateBranch: mockUpdateBranch,
    deleteBranch: mockDeleteBranch,
  },
}));
vi.mock("@/server/services/event.service", () => ({
  eventService: { emit: mockEventEmit },
}));

import { createBranchAction, updateBranchAction, deleteBranchAction } from "../branches";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ORG_ID = "org-999";
const BRANCH_ID = "00000000-0000-0000-0000-000000000011";
const USER_ID = "user-abc";

const CTX = {
  app: { activeOrgId: ORG_ID },
  user: {
    user: { id: USER_ID },
    permissionSnapshot: {
      allow: ["module.organization-management.access", "branches.*"],
      deny: [],
    },
  },
};

/** Returns a minimal supabase mock where `from().select().eq().maybeSingle()` resolves to `singleData`. */
function makeSupabase(
  singleData: { data: unknown; error: unknown } = { data: { name: "HQ" }, error: null }
) {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue(singleData),
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireModuleAccess.mockResolvedValue(undefined);
  mockMapEntitlementError.mockReturnValue(null);
  mockEventEmit.mockResolvedValue({ success: true });
  mockLoadDashboardContextV2.mockResolvedValue(CTX);
  mockCreateClient.mockResolvedValue(makeSupabase());
});

// ─── createBranchAction ───────────────────────────────────────────────────────

describe("createBranchAction — event emission and service errors", () => {
  it("emits org.branch.created event on success", async () => {
    mockCreateBranch.mockResolvedValue({
      success: true,
      data: { id: BRANCH_ID, name: "New Branch" },
    });

    await createBranchAction({ name: "New Branch" });

    expect(mockEventEmit).toHaveBeenCalledWith(
      expect.objectContaining({
        actionKey: "org.branch.created",
        branchId: BRANCH_ID,
        entityType: "branch",
        entityId: BRANCH_ID,
        metadata: { branch_id: BRANCH_ID, branch_name: "New Branch" },
      })
    );
  });

  it("returns success even when event emission fails", async () => {
    mockCreateBranch.mockResolvedValue({
      success: true,
      data: { id: BRANCH_ID, name: "New Branch" },
    });
    mockEventEmit.mockResolvedValue({ success: false, error: "emit failed" });

    const result = await createBranchAction({ name: "New Branch" });
    expect(result.success).toBe(true);
  });

  it("returns service error when createBranch service fails", async () => {
    mockCreateBranch.mockResolvedValue({ success: false, error: "Branch creation failed" });

    const result = await createBranchAction({ name: "HQ" });

    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toBe("Branch creation failed");
    expect(mockEventEmit).not.toHaveBeenCalled();
  });
});

// ─── updateBranchAction ───────────────────────────────────────────────────────

describe("updateBranchAction — event emission and service errors", () => {
  it("emits org.branch.updated event on success", async () => {
    mockUpdateBranch.mockResolvedValue({ success: true, data: undefined });

    await updateBranchAction({ branchId: BRANCH_ID, name: "Updated Name" });

    expect(mockEventEmit).toHaveBeenCalledWith(
      expect.objectContaining({
        actionKey: "org.branch.updated",
        branchId: BRANCH_ID,
        entityType: "branch",
        entityId: BRANCH_ID,
        metadata: expect.objectContaining({ branch_id: BRANCH_ID, branch_name: "Updated Name" }),
      })
    );
  });

  it("returns success even when event emission fails", async () => {
    mockUpdateBranch.mockResolvedValue({ success: true, data: undefined });
    mockEventEmit.mockResolvedValue({ success: false, error: "emit error" });

    const result = await updateBranchAction({ branchId: BRANCH_ID, name: "Name" });
    expect(result.success).toBe(true);
  });

  it("returns service error when updateBranch service fails", async () => {
    mockUpdateBranch.mockResolvedValue({ success: false, error: "DB constraint violation" });

    const result = await updateBranchAction({ branchId: BRANCH_ID, name: "X" });

    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toBe("DB constraint violation");
    expect(mockEventEmit).not.toHaveBeenCalled();
  });
});

// ─── deleteBranchAction ───────────────────────────────────────────────────────

describe("deleteBranchAction — event emission, name pre-fetch, and service errors", () => {
  it("emits org.branch.deleted event with branch name from pre-fetch", async () => {
    mockCreateClient.mockResolvedValue(
      makeSupabase({ data: { name: "Main Branch" }, error: null })
    );
    mockDeleteBranch.mockResolvedValue({ success: true, data: undefined });

    await deleteBranchAction({ branchId: BRANCH_ID });

    expect(mockEventEmit).toHaveBeenCalledWith(
      expect.objectContaining({
        actionKey: "org.branch.deleted",
        branchId: BRANCH_ID,
        metadata: { branch_id: BRANCH_ID, branch_name: "Main Branch" },
        eventTier: "enhanced",
      })
    );
  });

  it("falls back to branchId as branch name when pre-fetch returns null", async () => {
    mockCreateClient.mockResolvedValue(makeSupabase({ data: null, error: null }));
    mockDeleteBranch.mockResolvedValue({ success: true, data: undefined });

    await deleteBranchAction({ branchId: BRANCH_ID });

    expect(mockEventEmit).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: { branch_id: BRANCH_ID, branch_name: BRANCH_ID },
      })
    );
  });

  it("returns success even when event emission fails", async () => {
    mockDeleteBranch.mockResolvedValue({ success: true, data: undefined });
    mockEventEmit.mockResolvedValue({ success: false, error: "emit error" });

    const result = await deleteBranchAction({ branchId: BRANCH_ID });
    expect(result.success).toBe(true);
  });

  it("returns service error when deleteBranch service fails", async () => {
    mockDeleteBranch.mockResolvedValue({
      success: false,
      error: "Cannot delete branch with active members",
    });

    const result = await deleteBranchAction({ branchId: BRANCH_ID });

    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toBe("Cannot delete branch with active members");
    expect(mockEventEmit).not.toHaveBeenCalled();
  });

  it("returns validation error for invalid UUID branchId", async () => {
    const result = await deleteBranchAction({ branchId: "not-a-uuid" });
    expect(result.success).toBe(false);
  });
});
