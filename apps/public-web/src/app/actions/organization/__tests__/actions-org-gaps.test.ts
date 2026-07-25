/**
 * @vitest-environment node
 *
 * Covers gap paths in:
 *   - branches.ts (listBranchesAction, createBranchAction, updateBranchAction, deleteBranchAction)
 *   - members.ts (listMembersAction, updateMemberStatusAction, removeMemberAction)
 *   - profile.ts (getOrgProfileAction, updateOrgProfileAction)
 *   - billing.ts (getBillingOverviewAction)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoist mocks ──────────────────────────────────────────────────────────────

const { mockCreateClient, mockLoadDashboardContextV2, mockRequireModuleAccess } = vi.hoisted(
  () => ({
    mockCreateClient: vi.fn(),
    mockLoadDashboardContextV2: vi.fn(),
    mockRequireModuleAccess: vi.fn().mockResolvedValue(undefined),
  })
);

vi.mock("@/utils/supabase/server", () => ({ createClient: mockCreateClient }));
vi.mock("@/server/loaders/v2/load-dashboard-context.v2", () => ({
  loadDashboardContextV2: mockLoadDashboardContextV2,
}));
vi.mock("@/server/guards/entitlements-guards", () => ({
  entitlements: { requireModuleAccess: mockRequireModuleAccess },
  mapEntitlementError: vi.fn().mockReturnValue(null),
}));
vi.mock("@/server/services/organization.service", () => ({
  OrgBranchesService: {
    listBranches: vi.fn(),
    createBranch: vi.fn(),
    updateBranch: vi.fn(),
    deleteBranch: vi.fn(),
  },
  OrgMembersService: {
    listMembers: vi.fn(),
    updateMemberStatus: vi.fn(),
    removeMember: vi.fn(),
  },
  OrgProfileService: {
    getProfile: vi.fn(),
    updateProfile: vi.fn(),
    uploadLogo: vi.fn(),
    removeLogo: vi.fn(),
  },
  OrgBillingService: {
    getBillingOverview: vi.fn(),
  },
}));
vi.mock("@/server/services/event.service", () => ({
  eventService: { emit: vi.fn().mockResolvedValue({ success: true }) },
}));

import {
  OrgBranchesService,
  OrgMembersService,
  OrgProfileService,
  OrgBillingService,
} from "@/server/services/organization.service";
import {
  listBranchesAction,
  createBranchAction,
  updateBranchAction,
  deleteBranchAction,
} from "../branches";
import { listMembersAction, updateMemberStatusAction, removeMemberAction } from "../members";
import { getOrgProfileAction, updateOrgProfileAction } from "../profile";
import { getBillingOverviewAction } from "../billing";

// ─── Context helpers ──────────────────────────────────────────────────────────

const VALID_UUID = "00000000-0000-0000-0000-000000000001";
const VALID_UUID_2 = "00000000-0000-0000-0000-000000000002";

const CTX_FULL = {
  app: { activeOrgId: "org-1" },
  user: {
    permissionSnapshot: {
      allow: ["module.organization-management.access", "branches.*", "members.*", "org.*"],
      deny: [],
    },
  },
};

const CTX_NO_PERM = {
  app: { activeOrgId: "org-1" },
  user: { permissionSnapshot: { allow: [], deny: [] } },
};

function setCtx(ctx: unknown) {
  mockLoadDashboardContextV2.mockResolvedValue(ctx);
}

function resetClient() {
  mockCreateClient.mockResolvedValue({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { name: "Test Branch" }, error: null }),
    }),
  });
}

// ─── branches.ts ──────────────────────────────────────────────────────────────

describe("listBranchesAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireModuleAccess.mockResolvedValue(undefined);
    resetClient();
    setCtx(CTX_FULL);
  });

  it("returns branches when authorized", async () => {
    vi.mocked(OrgBranchesService.listBranches).mockResolvedValue({
      success: true,
      data: [] as never,
    });
    const result = await listBranchesAction();
    expect(result.success).toBe(true);
  });

  it("returns error when no active org", async () => {
    setCtx({ app: { activeOrgId: null }, user: { permissionSnapshot: { allow: [], deny: [] } } });
    const result = await listBranchesAction();
    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toBe("No active organization");
  });

  it("returns unauthorized when no module access", async () => {
    setCtx(CTX_NO_PERM);
    const result = await listBranchesAction();
    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toBe("Unauthorized");
  });
});

describe("createBranchAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireModuleAccess.mockResolvedValue(undefined);
    resetClient();
    setCtx(CTX_FULL);
  });

  it("creates branch with valid input", async () => {
    vi.mocked(OrgBranchesService.createBranch).mockResolvedValue({
      success: true,
      data: { id: VALID_UUID, name: "HQ" } as never,
    });
    const result = await createBranchAction({ name: "HQ" });
    expect(result.success).toBe(true);
  });

  it("returns validation error for empty name", async () => {
    const result = await createBranchAction({ name: "" });
    expect(result.success).toBe(false);
  });

  it("returns unauthorized when missing branches.create", async () => {
    setCtx({
      app: { activeOrgId: "org-1" },
      user: {
        permissionSnapshot: {
          allow: ["module.organization-management.access"],
          deny: [],
        },
      },
    });
    const result = await createBranchAction({ name: "HQ" });
    expect(result.success).toBe(false);
  });
});

describe("updateBranchAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireModuleAccess.mockResolvedValue(undefined);
    resetClient();
    setCtx(CTX_FULL);
  });

  it("updates branch with valid input", async () => {
    vi.mocked(OrgBranchesService.updateBranch).mockResolvedValue({
      success: true,
      data: {} as never,
    });
    const result = await updateBranchAction({ branchId: VALID_UUID, name: "Updated" });
    expect(result.success).toBe(true);
  });

  it("returns validation error for invalid UUID", async () => {
    const result = await updateBranchAction({ branchId: "not-a-uuid", name: "Test" });
    expect(result.success).toBe(false);
  });

  it("returns unauthorized when no manage permission", async () => {
    setCtx({
      app: { activeOrgId: "org-1" },
      user: { permissionSnapshot: { allow: ["module.organization-management.access"], deny: [] } },
    });
    const result = await updateBranchAction({ branchId: VALID_UUID, name: "Test" });
    expect(result.success).toBe(false);
  });
});

describe("deleteBranchAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireModuleAccess.mockResolvedValue(undefined);
    resetClient();
    setCtx(CTX_FULL);
  });

  it("deletes branch with valid UUID", async () => {
    vi.mocked(OrgBranchesService.deleteBranch).mockResolvedValue({
      success: true,
      data: null as never,
    });
    const result = await deleteBranchAction({ branchId: VALID_UUID });
    expect(result.success).toBe(true);
  });

  it("returns validation error for invalid UUID", async () => {
    const result = await deleteBranchAction({ branchId: "bad-id" });
    expect(result.success).toBe(false);
  });
});

// ─── members.ts ───────────────────────────────────────────────────────────────

describe("listMembersAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireModuleAccess.mockResolvedValue(undefined);
    resetClient();
    setCtx(CTX_FULL);
  });

  it("returns members when authorized", async () => {
    vi.mocked(OrgMembersService.listMembers).mockResolvedValue({
      success: true,
      data: [] as never,
    });
    const result = await listMembersAction();
    expect(result.success).toBe(true);
  });

  it("returns error when no active org", async () => {
    setCtx({ app: { activeOrgId: null }, user: { permissionSnapshot: { allow: [], deny: [] } } });
    const result = await listMembersAction();
    expect(result.success).toBe(false);
  });

  it("returns unauthorized when no module access", async () => {
    setCtx(CTX_NO_PERM);
    const result = await listMembersAction();
    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toBe("Unauthorized");
  });
});

describe("updateMemberStatusAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireModuleAccess.mockResolvedValue(undefined);
    resetClient();
    setCtx(CTX_FULL);
  });

  it("updates member status with valid input", async () => {
    vi.mocked(OrgMembersService.updateMemberStatus).mockResolvedValue({
      success: true,
      data: {} as never,
    });
    const result = await updateMemberStatusAction({ userId: VALID_UUID, status: "active" });
    expect(result.success).toBe(true);
  });

  it("returns validation error for invalid status", async () => {
    const result = await updateMemberStatusAction({ userId: VALID_UUID, status: "banned" });
    expect(result.success).toBe(false);
  });

  it("returns validation error for missing userId", async () => {
    const result = await updateMemberStatusAction({ status: "active" });
    expect(result.success).toBe(false);
  });

  it("returns unauthorized when no manage permission", async () => {
    setCtx({
      app: { activeOrgId: "org-1" },
      user: { permissionSnapshot: { allow: ["module.organization-management.access"], deny: [] } },
    });
    const result = await updateMemberStatusAction({ userId: VALID_UUID, status: "inactive" });
    expect(result.success).toBe(false);
  });
});

describe("removeMemberAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireModuleAccess.mockResolvedValue(undefined);
    resetClient();
    setCtx(CTX_FULL);
  });

  it("removes member with valid UUID", async () => {
    vi.mocked(OrgMembersService.removeMember).mockResolvedValue({
      success: true,
      data: null as never,
    });
    const result = await removeMemberAction({ userId: VALID_UUID_2 });
    expect(result.success).toBe(true);
  });

  it("returns validation error for invalid UUID", async () => {
    const result = await removeMemberAction({ userId: "not-a-uuid" });
    expect(result.success).toBe(false);
  });

  it("returns unauthorized when no manage permission", async () => {
    setCtx({
      app: { activeOrgId: "org-1" },
      user: { permissionSnapshot: { allow: ["module.organization-management.access"], deny: [] } },
    });
    const result = await removeMemberAction({ userId: VALID_UUID_2 });
    expect(result.success).toBe(false);
  });
});

// ─── profile.ts ───────────────────────────────────────────────────────────────

describe("getOrgProfileAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireModuleAccess.mockResolvedValue(undefined);
    resetClient();
    setCtx(CTX_FULL);
  });

  it("returns org profile when authorized", async () => {
    vi.mocked(OrgProfileService.getProfile).mockResolvedValue({
      success: true,
      data: { id: "org-1" } as never,
    });
    const result = await getOrgProfileAction();
    expect(result.success).toBe(true);
  });

  it("returns error when no active org", async () => {
    setCtx({ app: { activeOrgId: null }, user: { permissionSnapshot: { allow: [], deny: [] } } });
    const result = await getOrgProfileAction();
    expect(result.success).toBe(false);
  });

  it("returns unauthorized when no module access", async () => {
    setCtx(CTX_NO_PERM);
    const result = await getOrgProfileAction();
    expect(result.success).toBe(false);
  });
});

describe("updateOrgProfileAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireModuleAccess.mockResolvedValue(undefined);
    resetClient();
    setCtx(CTX_FULL);
  });

  it("updates org profile with valid input", async () => {
    vi.mocked(OrgProfileService.updateProfile).mockResolvedValue({
      success: true,
      data: {} as never,
    });
    const result = await updateOrgProfileAction({ name: "My Org" });
    expect(result.success).toBe(true);
  });

  it("returns validation error for empty name", async () => {
    const result = await updateOrgProfileAction({ name: "" });
    expect(result.success).toBe(false);
  });

  it("returns unauthorized when no update permission", async () => {
    setCtx({
      app: { activeOrgId: "org-1" },
      user: { permissionSnapshot: { allow: ["module.organization-management.access"], deny: [] } },
    });
    const result = await updateOrgProfileAction({ name: "Test" });
    expect(result.success).toBe(false);
  });
});

// ─── billing.ts ───────────────────────────────────────────────────────────────

describe("getBillingOverviewAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireModuleAccess.mockResolvedValue(undefined);
    resetClient();
    setCtx(CTX_FULL);
  });

  it("returns billing overview when authorized", async () => {
    vi.mocked(OrgBillingService.getBillingOverview).mockResolvedValue({
      success: true,
      data: {} as never,
    });
    const result = await getBillingOverviewAction();
    expect(result.success).toBe(true);
  });

  it("returns error when no active org", async () => {
    setCtx({ app: { activeOrgId: null }, user: { permissionSnapshot: { allow: [], deny: [] } } });
    const result = await getBillingOverviewAction();
    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toBe("No active organization");
  });

  it("returns unauthorized when no module access", async () => {
    setCtx(CTX_NO_PERM);
    const result = await getBillingOverviewAction();
    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toBe("Unauthorized");
  });

  it("returns unauthorized when no org.update permission", async () => {
    setCtx({
      app: { activeOrgId: "org-1" },
      user: {
        permissionSnapshot: {
          allow: ["module.organization-management.access"],
          deny: [],
        },
      },
    });
    const result = await getBillingOverviewAction();
    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toBe("Unauthorized");
  });
});
