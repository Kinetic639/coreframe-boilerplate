/**
 * @vitest-environment node
 *
 * T2: Action deny-path unit tests for Organization Management module.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.mock factories must NOT reference outer variables (they are hoisted)
vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/server/loaders/v2/load-dashboard-context.v2", () => ({
  loadDashboardContextV2: vi.fn().mockResolvedValue({
    app: { activeOrgId: "org-123" },
    user: {
      user: { id: "user-123" },
      permissionSnapshot: { allow: [], deny: [] },
    },
  }),
}));

vi.mock("@/server/guards/entitlements-guards", () => ({
  entitlements: { requireModuleAccess: vi.fn().mockResolvedValue(undefined) },
  mapEntitlementError: vi.fn().mockReturnValue(null),
}));

vi.mock("@/server/services/email.service", () => {
  function EmailServiceMock() {}
  EmailServiceMock.prototype.sendInvitationEmailWithTemplate = vi
    .fn()
    .mockResolvedValue({ success: true });
  return { EmailService: EmailServiceMock };
});

vi.mock("@/server/services/organization.service", () => ({
  OrgProfileService: { getProfile: vi.fn(), updateProfile: vi.fn(), uploadLogo: vi.fn() },
  OrgMembersService: { listMembers: vi.fn(), updateMemberStatus: vi.fn(), removeMember: vi.fn() },
  OrgInvitationsService: {
    listInvitations: vi.fn(),
    createInvitation: vi.fn(),
    cancelInvitation: vi.fn(),
    resendInvitation: vi.fn(),
    cleanupExpiredInvitations: vi.fn(),
    acceptInvitation: vi.fn(),
  },
  OrgRolesService: {
    listRoles: vi.fn(),
    createRole: vi.fn(),
    updateRole: vi.fn(),
    deleteRole: vi.fn(),
    assignRoleToUser: vi.fn(),
    removeRoleFromUser: vi.fn(),
    getUserRoleAssignments: vi.fn(),
    getMemberAccess: vi.fn(),
  },
  OrgBillingService: { getBillingOverview: vi.fn() },
  OrgPositionsService: {
    listPositions: vi.fn(),
    listAssignmentsForOrg: vi.fn(),
    createPosition: vi.fn(),
    updatePosition: vi.fn(),
    deletePosition: vi.fn(),
    assignPosition: vi.fn(),
    removeAssignment: vi.fn(),
  },
  OrgBranchesService: {
    listBranches: vi.fn(),
    createBranch: vi.fn(),
    updateBranch: vi.fn(),
    deleteBranch: vi.fn(),
  },
}));

import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { entitlements, mapEntitlementError } from "@/server/guards/entitlements-guards";
import {
  OrgProfileService,
  OrgMembersService,
  OrgInvitationsService,
  OrgRolesService,
  OrgBillingService,
  OrgPositionsService,
  OrgBranchesService,
} from "@/server/services/organization.service";

import { getOrgProfileAction, updateOrgProfileAction } from "../profile";
import { listMembersAction, updateMemberStatusAction, removeMemberAction } from "../members";
import {
  listInvitationsAction,
  createInvitationAction,
  cancelInvitationAction,
  acceptInvitationAction,
} from "../invitations";
import {
  listRolesAction,
  createRoleAction,
  updateRoleAction,
  deleteRoleAction,
  assignRoleToUserAction,
  removeRoleFromUserAction,
} from "../roles";
import { getBillingOverviewAction } from "../billing";
import { listPositionsAction, createPositionAction } from "../positions";
import { listBranchesAction, createBranchAction } from "../branches";

// Context presets — used in test bodies only
const CTX_NO_PERM = {
  app: { activeOrgId: "org-123" },
  user: { user: { id: "user-123" }, permissionSnapshot: { allow: [], deny: [] } },
};
const CTX_ORG_ADMIN = {
  app: { activeOrgId: "org-123" },
  user: {
    user: { id: "user-123" },
    permissionSnapshot: {
      allow: [
        "module.organization-management.access",
        "org.*",
        "members.*",
        "invites.*",
        "branches.*",
      ],
      deny: [],
    },
  },
};
// Has all capability permissions but is missing module access — used to test the module gate
const CTX_HAS_ORG_PERMS_NO_MODULE_ACCESS = {
  app: { activeOrgId: "org-123" },
  user: {
    user: { id: "user-123" },
    permissionSnapshot: { allow: ["org.*", "members.*", "invites.*", "branches.*"], deny: [] },
  },
};
const CTX_NO_ORG = {
  app: { activeOrgId: null },
  user: { user: { id: "user-123" }, permissionSnapshot: { allow: ["org.*"], deny: [] } },
};

function setCtx(ctx: unknown) {
  (loadDashboardContextV2 as ReturnType<typeof vi.fn>).mockResolvedValue(ctx);
}

// ─── Profile ──────────────────────────────────────────────────────────────────

describe("getOrgProfileAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setCtx(CTX_NO_PERM);
  });

  it("Unauthorized — no permissions", async () => {
    const result = await getOrgProfileAction();
    expect(result).toEqual({ success: false, error: "Unauthorized" });
    expect(OrgProfileService.getProfile).not.toHaveBeenCalled();
  });

  it("No active org error", async () => {
    setCtx(CTX_NO_ORG);
    const result = await getOrgProfileAction();
    expect(result).toEqual({ success: false, error: "No active organization" });
    expect(OrgProfileService.getProfile).not.toHaveBeenCalled();
  });

  it("calls service when org.read granted", async () => {
    setCtx(CTX_ORG_ADMIN);
    (OrgProfileService.getProfile as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: { organization_id: "org-123" },
    });
    const result = await getOrgProfileAction();
    expect(result).toEqual({ success: true, data: { organization_id: "org-123" } });
    expect(OrgProfileService.getProfile).toHaveBeenCalledOnce();
  });
});

describe("updateOrgProfileAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setCtx(CTX_NO_PERM);
  });

  it("Unauthorized — no permissions", async () => {
    const result = await updateOrgProfileAction({ name: "New Name" });
    expect(result).toEqual({ success: false, error: "Unauthorized" });
    expect(OrgProfileService.updateProfile).not.toHaveBeenCalled();
  });

  it("Zod validation error for empty name (even with permission)", async () => {
    setCtx(CTX_ORG_ADMIN);
    const result = await updateOrgProfileAction({ name: "" });
    expect(result).toMatchObject({ success: false });
    expect(OrgProfileService.updateProfile).not.toHaveBeenCalled();
  });
});

// ─── Members ──────────────────────────────────────────────────────────────────

describe("listMembersAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setCtx(CTX_NO_PERM);
  });

  it("Unauthorized — no members.read", async () => {
    const result = await listMembersAction();
    expect(result).toEqual({ success: false, error: "Unauthorized" });
    expect(OrgMembersService.listMembers).not.toHaveBeenCalled();
  });

  it("calls service when members.read granted", async () => {
    setCtx(CTX_ORG_ADMIN);
    (OrgMembersService.listMembers as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: [],
    });
    const result = await listMembersAction();
    expect(result).toEqual({ success: true, data: [] });
  });
});

describe("updateMemberStatusAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setCtx(CTX_NO_PERM);
  });

  it("Unauthorized — no members.manage", async () => {
    const result = await updateMemberStatusAction({
      userId: "00000000-0000-0000-0000-000000000001",
      status: "inactive",
    });
    expect(result).toEqual({ success: false, error: "Unauthorized" });
    expect(OrgMembersService.updateMemberStatus).not.toHaveBeenCalled();
  });

  it("rejects 'suspended' — invalid per DB constraint (only active|inactive|pending allowed)", async () => {
    setCtx(CTX_ORG_ADMIN);
    const result = await updateMemberStatusAction({
      userId: "00000000-0000-0000-0000-000000000001",
      status: "suspended",
    });
    expect(result).toMatchObject({ success: false });
    expect(OrgMembersService.updateMemberStatus).not.toHaveBeenCalled();
  });

  it("accepts 'inactive' and passes it to service", async () => {
    setCtx(CTX_ORG_ADMIN);
    (OrgMembersService.updateMemberStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: undefined,
    });
    await updateMemberStatusAction({
      userId: "00000000-0000-0000-0000-000000000001",
      status: "inactive",
    });
    expect(OrgMembersService.updateMemberStatus).toHaveBeenCalledWith(
      expect.anything(),
      "org-123",
      "00000000-0000-0000-0000-000000000001",
      "inactive"
    );
  });
});

describe("removeMemberAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setCtx(CTX_NO_PERM);
  });

  it("Unauthorized — no members.manage", async () => {
    const result = await removeMemberAction({ userId: "00000000-0000-0000-0000-000000000001" });
    expect(result).toEqual({ success: false, error: "Unauthorized" });
    expect(OrgMembersService.removeMember).not.toHaveBeenCalled();
  });
});

// ─── Invitations ──────────────────────────────────────────────────────────────

describe("listInvitationsAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setCtx(CTX_NO_PERM);
  });

  it("Unauthorized — no invites.read", async () => {
    const result = await listInvitationsAction();
    expect(result).toEqual({ success: false, error: "Unauthorized" });
    expect(OrgInvitationsService.listInvitations).not.toHaveBeenCalled();
  });
});

describe("createInvitationAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setCtx(CTX_NO_PERM);
  });

  it("Unauthorized — no invites.create", async () => {
    const result = await createInvitationAction({ email: "test@example.com" });
    expect(result).toEqual({ success: false, error: "Unauthorized" });
    expect(OrgInvitationsService.createInvitation).not.toHaveBeenCalled();
  });

  it("calls service when authorized and returns the invitation", async () => {
    setCtx(CTX_ORG_ADMIN);
    const mockInvitation = {
      id: "inv-1",
      email: "newuser@example.com",
      token: "tok-abc",
      organization_id: "org-123",
      status: "pending",
    };
    (OrgInvitationsService.createInvitation as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: mockInvitation,
    });
    (OrgProfileService.getProfile as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: { name: "Test Org" },
    });
    const result = await createInvitationAction({ email: "newuser@example.com" });
    expect(result).toEqual({ success: true, data: mockInvitation, emailDelivered: true });
    expect(OrgInvitationsService.createInvitation).toHaveBeenCalledOnce();
  });
});

describe("cancelInvitationAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setCtx(CTX_NO_PERM);
  });

  it("Unauthorized — no invites.cancel", async () => {
    const result = await cancelInvitationAction({
      invitationId: "00000000-0000-0000-0000-000000000001",
    });
    expect(result).toEqual({ success: false, error: "Unauthorized" });
    expect(OrgInvitationsService.cancelInvitation).not.toHaveBeenCalled();
  });
});

// ─── Accept Invitation ────────────────────────────────────────────────────────

describe("acceptInvitationAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls service with the provided token", async () => {
    (OrgInvitationsService.acceptInvitation as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: { organization_id: "org-123" },
    });
    const result = await acceptInvitationAction("test-token-abc");
    expect(result).toEqual({ success: true, data: { organization_id: "org-123" } });
    expect(OrgInvitationsService.acceptInvitation).toHaveBeenCalledWith(
      expect.anything(),
      "test-token-abc"
    );
  });

  it("returns service error when acceptance fails", async () => {
    (OrgInvitationsService.acceptInvitation as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: false,
      error: "Invitation has expired",
    });
    const result = await acceptInvitationAction("expired-token");
    expect(result).toEqual({ success: false, error: "Invitation has expired" });
  });

  it("returns unexpected error when service throws", async () => {
    (OrgInvitationsService.acceptInvitation as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("DB connection failed")
    );
    const result = await acceptInvitationAction("bad-token");
    expect(result).toEqual({ success: false, error: "Unexpected error" });
  });
});

// ─── Roles ────────────────────────────────────────────────────────────────────

describe("listRolesAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setCtx(CTX_NO_PERM);
  });

  it("Unauthorized — no members.read", async () => {
    const result = await listRolesAction();
    expect(result).toEqual({ success: false, error: "Unauthorized" });
    expect(OrgRolesService.listRoles).not.toHaveBeenCalled();
  });
});

describe("createRoleAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setCtx(CTX_NO_PERM);
  });

  it("Unauthorized — no members.manage", async () => {
    const result = await createRoleAction({ name: "Test Role" });
    expect(result).toEqual({ success: false, error: "Unauthorized" });
    expect(OrgRolesService.createRole).not.toHaveBeenCalled();
  });

  // P2: branch-scoped role with org-only permissions is rejected server-side
  it("P2: rejects branch role containing org-only permission org.read", async () => {
    setCtx(CTX_ORG_ADMIN);
    const result = await createRoleAction({
      name: "Bad Branch Role",
      scope_type: "branch",
      permission_slugs: ["org.read", "members.read"],
    });
    expect(result).toMatchObject({ success: false });
    expect((result as { error: string }).error).toMatch(/not allowed for branch-scoped/i);
    expect(OrgRolesService.createRole).not.toHaveBeenCalled();
  });

  // P2: branch-scoped role with org-only permission branches.create is rejected
  it("P2: rejects branch role containing org-only permission branches.create", async () => {
    setCtx(CTX_ORG_ADMIN);
    const result = await createRoleAction({
      name: "Bad Branch Role 2",
      scope_type: "branch",
      permission_slugs: ["branches.create"],
    });
    expect(result).toMatchObject({ success: false });
    expect((result as { error: string }).error).toMatch(/not allowed for branch-scoped/i);
    expect(OrgRolesService.createRole).not.toHaveBeenCalled();
  });

  // P2: branch-scoped role with only branch-allowed permissions passes validation
  it("P2: allows branch role with only branch-allowed permissions", async () => {
    setCtx(CTX_ORG_ADMIN);
    (OrgRolesService.createRole as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: { id: "r-new" },
    });
    const result = await createRoleAction({
      name: "Branch Manager",
      scope_type: "branch",
      permission_slugs: ["branches.read", "branch.roles.manage"],
    });
    expect(OrgRolesService.createRole).toHaveBeenCalledOnce();
    expect(result.success).toBe(true);
  });

  // P2: org-scoped role with any permissions (including org.read) passes
  it("P2: org-scoped role with org.read passes validation", async () => {
    setCtx(CTX_ORG_ADMIN);
    (OrgRolesService.createRole as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: { id: "r-org" },
    });
    const result = await createRoleAction({
      name: "Org Viewer",
      scope_type: "org",
      permission_slugs: ["org.read", "members.read"],
    });
    expect(OrgRolesService.createRole).toHaveBeenCalledOnce();
    expect(result.success).toBe(true);
  });
});

describe("updateRoleAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setCtx(CTX_ORG_ADMIN);
  });

  it("Unauthorized — no members.manage", async () => {
    setCtx(CTX_NO_PERM);
    const result = await updateRoleAction({
      roleId: "00000000-0000-0000-0000-000000000001",
      permission_slugs: ["members.read"],
    });
    expect(result).toEqual({ success: false, error: "Unauthorized" });
    expect(OrgRolesService.updateRole).not.toHaveBeenCalled();
  });

  // G2: branch-scoped role edit is rejected when org-only permissions are submitted
  it("G2: rejects update with org-only permission when role.scope_type='branch'", async () => {
    // Provide a supabase mock that returns scope_type='branch' for the role lookup
    const { createClient } = await import("@/utils/supabase/server");
    const mockChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { scope_type: "branch" }, error: null }),
    };
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      from: vi.fn(() => mockChain),
    });

    const result = await updateRoleAction({
      roleId: "00000000-0000-0000-0000-000000000001",
      permission_slugs: ["org.read", "members.read"],
    });

    expect(result).toMatchObject({ success: false });
    expect((result as { error: string }).error).toMatch(/not allowed for branch-scoped/i);
    expect(OrgRolesService.updateRole).not.toHaveBeenCalled();
  });

  // G2: branch-scoped role update with only branch-allowed permissions passes
  it("G2: allows update when branch role contains only branch-allowed permissions", async () => {
    const { createClient } = await import("@/utils/supabase/server");
    const mockChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { scope_type: "branch" }, error: null }),
    };
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      from: vi.fn(() => mockChain),
    });
    (OrgRolesService.updateRole as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: undefined,
    });

    const result = await updateRoleAction({
      roleId: "00000000-0000-0000-0000-000000000001",
      permission_slugs: ["branches.read", "branch.roles.manage"],
    });

    expect(result.success).toBe(true);
    expect(OrgRolesService.updateRole).toHaveBeenCalledOnce();
  });

  // G2: org-scoped role may freely include org-only permissions
  it("G2: org-scoped role update with org.read passes without restriction", async () => {
    const { createClient } = await import("@/utils/supabase/server");
    const mockChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { scope_type: "org" }, error: null }),
    };
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      from: vi.fn(() => mockChain),
    });
    (OrgRolesService.updateRole as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: undefined,
    });

    const result = await updateRoleAction({
      roleId: "00000000-0000-0000-0000-000000000001",
      permission_slugs: ["org.read", "branches.create"],
    });

    expect(result.success).toBe(true);
    expect(OrgRolesService.updateRole).toHaveBeenCalledOnce();
  });

  // G2: when only name/description are updated (no permission_slugs), role lookup is skipped
  it("G2: skips role lookup when permission_slugs not in payload", async () => {
    (OrgRolesService.updateRole as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: undefined,
    });

    const result = await updateRoleAction({
      roleId: "00000000-0000-0000-0000-000000000001",
      name: "Renamed Role",
    });

    expect(result.success).toBe(true);
    expect(OrgRolesService.updateRole).toHaveBeenCalledOnce();
  });
});

describe("deleteRoleAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setCtx(CTX_NO_PERM);
  });

  it("Unauthorized — no members.manage", async () => {
    const result = await deleteRoleAction({ roleId: "00000000-0000-0000-0000-000000000001" });
    expect(result).toEqual({ success: false, error: "Unauthorized" });
    expect(OrgRolesService.deleteRole).not.toHaveBeenCalled();
  });
});

describe("assignRoleToUserAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setCtx(CTX_NO_PERM);
  });

  it("Unauthorized — no members.manage and no branch.roles.manage", async () => {
    const result = await assignRoleToUserAction({
      userId: "00000000-0000-0000-0000-000000000001",
      roleId: "00000000-0000-0000-0000-000000000002",
    });
    expect(result).toEqual({ success: false, error: "Unauthorized" });
    expect(OrgRolesService.assignRoleToUser).not.toHaveBeenCalled();
  });

  // Branch manager allow: branch.roles.manage is sufficient for branch-scoped assignment
  it("BM: branch manager can assign branch-scoped role (branch.roles.manage, no members.manage)", async () => {
    setCtx({
      app: { activeOrgId: "org-123" },
      user: {
        user: { id: "user-123" },
        permissionSnapshot: {
          allow: ["module.organization-management.access", "branch.roles.manage"],
          deny: [],
        },
      },
    });
    (OrgRolesService.assignRoleToUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: undefined,
    });
    const result = await assignRoleToUserAction({
      userId: "00000000-0000-0000-0000-000000000001",
      roleId: "00000000-0000-0000-0000-000000000002",
      scope: "branch",
      scopeId: "00000000-0000-0000-0000-000000000003",
    });
    expect(result.success).toBe(true);
    expect(OrgRolesService.assignRoleToUser).toHaveBeenCalledOnce();
  });

  // Branch manager deny: branch.roles.manage does NOT allow org-scoped assignment
  it("BM: branch manager cannot assign org-scoped role (branch.roles.manage only)", async () => {
    setCtx({
      app: { activeOrgId: "org-123" },
      user: {
        user: { id: "user-123" },
        permissionSnapshot: {
          allow: ["module.organization-management.access", "branch.roles.manage"],
          deny: [],
        },
      },
    });
    const result = await assignRoleToUserAction({
      userId: "00000000-0000-0000-0000-000000000001",
      roleId: "00000000-0000-0000-0000-000000000002",
      scope: "org",
    });
    expect(result).toEqual({ success: false, error: "Unauthorized" });
    expect(OrgRolesService.assignRoleToUser).not.toHaveBeenCalled();
  });
});

describe("removeRoleFromUserAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setCtx(CTX_NO_PERM);
  });

  it("Unauthorized — no members.manage and no branch.roles.manage", async () => {
    const result = await removeRoleFromUserAction({
      userId: "00000000-0000-0000-0000-000000000001",
      roleId: "00000000-0000-0000-0000-000000000002",
    });
    expect(result).toEqual({ success: false, error: "Unauthorized" });
    expect(OrgRolesService.removeRoleFromUser).not.toHaveBeenCalled();
  });

  // Branch manager allow: branch.roles.manage is sufficient for branch-scoped removal
  it("BM: branch manager can remove branch-scoped role (branch.roles.manage, no members.manage)", async () => {
    setCtx({
      app: { activeOrgId: "org-123" },
      user: {
        user: { id: "user-123" },
        permissionSnapshot: {
          allow: ["module.organization-management.access", "branch.roles.manage"],
          deny: [],
        },
      },
    });
    (OrgRolesService.removeRoleFromUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: undefined,
    });
    const result = await removeRoleFromUserAction({
      userId: "00000000-0000-0000-0000-000000000001",
      roleId: "00000000-0000-0000-0000-000000000002",
      scope: "branch",
      scopeId: "00000000-0000-0000-0000-000000000003",
    });
    expect(result.success).toBe(true);
    expect(OrgRolesService.removeRoleFromUser).toHaveBeenCalledOnce();
  });

  // Branch manager deny: branch.roles.manage does NOT allow org-scoped removal
  it("BM: branch manager cannot remove org-scoped role (branch.roles.manage only)", async () => {
    setCtx({
      app: { activeOrgId: "org-123" },
      user: {
        user: { id: "user-123" },
        permissionSnapshot: {
          allow: ["module.organization-management.access", "branch.roles.manage"],
          deny: [],
        },
      },
    });
    const result = await removeRoleFromUserAction({
      userId: "00000000-0000-0000-0000-000000000001",
      roleId: "00000000-0000-0000-0000-000000000002",
      scope: "org",
    });
    expect(result).toEqual({ success: false, error: "Unauthorized" });
    expect(OrgRolesService.removeRoleFromUser).not.toHaveBeenCalled();
  });
});

// ─── ORG_ONLY_SLUGS enforcement ───────────────────────────────────────────────

describe("ORG_ONLY_SLUGS enforcement — members.* and invites.* blocked for branch roles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setCtx(CTX_ORG_ADMIN);
  });

  it("createRoleAction: rejects branch role with members.read", async () => {
    const result = await createRoleAction({
      name: "Bad Role",
      scope_type: "branch",
      permission_slugs: ["members.read"],
    });
    expect(result).toMatchObject({ success: false });
    expect((result as { error: string }).error).toMatch(/not allowed for branch-scoped/i);
    expect(OrgRolesService.createRole).not.toHaveBeenCalled();
  });

  it("createRoleAction: rejects branch role with members.manage", async () => {
    const result = await createRoleAction({
      name: "Bad Role",
      scope_type: "branch",
      permission_slugs: ["members.manage"],
    });
    expect(result).toMatchObject({ success: false });
    expect((result as { error: string }).error).toMatch(/not allowed for branch-scoped/i);
    expect(OrgRolesService.createRole).not.toHaveBeenCalled();
  });

  it("createRoleAction: rejects branch role with invites.create", async () => {
    const result = await createRoleAction({
      name: "Bad Role",
      scope_type: "branch",
      permission_slugs: ["invites.create"],
    });
    expect(result).toMatchObject({ success: false });
    expect((result as { error: string }).error).toMatch(/not allowed for branch-scoped/i);
    expect(OrgRolesService.createRole).not.toHaveBeenCalled();
  });

  it("createRoleAction: allows branch role with branch.roles.manage", async () => {
    (OrgRolesService.createRole as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: { id: "r-bm" },
    });
    const result = await createRoleAction({
      name: "Branch Manager",
      scope_type: "branch",
      permission_slugs: ["branch.roles.manage"],
    });
    expect(result.success).toBe(true);
    expect(OrgRolesService.createRole).toHaveBeenCalledOnce();
  });
});

// ─── Billing ──────────────────────────────────────────────────────────────────

describe("getBillingOverviewAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setCtx(CTX_NO_PERM);
  });

  it("Unauthorized with members.* only (billing requires org.update)", async () => {
    setCtx({
      app: { activeOrgId: "org-123" },
      user: { user: { id: "user-123" }, permissionSnapshot: { allow: ["members.*"], deny: [] } },
    });
    const result = await getBillingOverviewAction();
    expect(result).toEqual({ success: false, error: "Unauthorized" });
    expect(OrgBillingService.getBillingOverview).not.toHaveBeenCalled();
  });

  it("calls service for org owner with org.* wildcard", async () => {
    setCtx(CTX_ORG_ADMIN);
    (OrgBillingService.getBillingOverview as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: { plan_name: "Pro", enabled_modules: ["warehouse"], limits: {}, features: {} },
    });
    const result = await getBillingOverviewAction();
    expect(result.success).toBe(true);
    expect(OrgBillingService.getBillingOverview).toHaveBeenCalledOnce();
  });
});

// ─── Positions ────────────────────────────────────────────────────────────────

describe("listPositionsAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setCtx(CTX_NO_PERM);
  });

  it("Unauthorized — no members.read", async () => {
    const result = await listPositionsAction();
    expect(result).toEqual({ success: false, error: "Unauthorized" });
    expect(OrgPositionsService.listPositions).not.toHaveBeenCalled();
  });
});

describe("createPositionAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setCtx(CTX_NO_PERM);
  });

  it("Unauthorized — no members.manage", async () => {
    const result = await createPositionAction({ name: "Manager" });
    expect(result).toEqual({ success: false, error: "Unauthorized" });
    expect(OrgPositionsService.createPosition).not.toHaveBeenCalled();
  });
});

// ─── Branches ─────────────────────────────────────────────────────────────────

describe("listBranchesAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setCtx(CTX_NO_PERM);
  });

  it("Unauthorized — no branches.read", async () => {
    const result = await listBranchesAction();
    expect(result).toEqual({ success: false, error: "Unauthorized" });
    expect(OrgBranchesService.listBranches).not.toHaveBeenCalled();
  });
});

describe("createBranchAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setCtx(CTX_NO_PERM);
  });

  it("Unauthorized — no branches.create", async () => {
    const result = await createBranchAction({ name: "Warsaw Branch" });
    expect(result).toEqual({ success: false, error: "Unauthorized" });
    expect(OrgBranchesService.createBranch).not.toHaveBeenCalled();
  });

  it("branches.read does NOT imply branches.create", async () => {
    setCtx({
      app: { activeOrgId: "org-123" },
      user: {
        user: { id: "user-123" },
        permissionSnapshot: { allow: ["branches.read"], deny: [] },
      },
    });
    const result = await createBranchAction({ name: "Warsaw Branch" });
    expect(result).toEqual({ success: false, error: "Unauthorized" });
    expect(OrgBranchesService.createBranch).not.toHaveBeenCalled();
  });
});

// ─── Module access gate ───────────────────────────────────────────────────────

describe("Module access gate — Unauthorized when module.organization-management.access absent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setCtx(CTX_HAS_ORG_PERMS_NO_MODULE_ACCESS);
  });

  it("getOrgProfileAction: blocked despite org.read being present", async () => {
    const result = await getOrgProfileAction();
    expect(result).toEqual({ success: false, error: "Unauthorized" });
    expect(OrgProfileService.getProfile).not.toHaveBeenCalled();
  });

  it("listMembersAction: blocked despite members.read being present", async () => {
    const result = await listMembersAction();
    expect(result).toEqual({ success: false, error: "Unauthorized" });
    expect(OrgMembersService.listMembers).not.toHaveBeenCalled();
  });

  it("listRolesAction: blocked despite members.read being present", async () => {
    const result = await listRolesAction();
    expect(result).toEqual({ success: false, error: "Unauthorized" });
    expect(OrgRolesService.listRoles).not.toHaveBeenCalled();
  });

  it("listInvitationsAction: blocked despite invites.read being present", async () => {
    const result = await listInvitationsAction();
    expect(result).toEqual({ success: false, error: "Unauthorized" });
    expect(OrgInvitationsService.listInvitations).not.toHaveBeenCalled();
  });

  it("getBillingOverviewAction: blocked despite org.update being present", async () => {
    const result = await getBillingOverviewAction();
    expect(result).toEqual({ success: false, error: "Unauthorized" });
    expect(OrgBillingService.getBillingOverview).not.toHaveBeenCalled();
  });

  it("listPositionsAction: blocked despite members.read being present", async () => {
    const result = await listPositionsAction();
    expect(result).toEqual({ success: false, error: "Unauthorized" });
    expect(OrgPositionsService.listPositions).not.toHaveBeenCalled();
  });

  it("listBranchesAction: blocked despite branches.read being present", async () => {
    const result = await listBranchesAction();
    expect(result).toEqual({ success: false, error: "Unauthorized" });
    expect(OrgBranchesService.listBranches).not.toHaveBeenCalled();
  });
});

// ─── Entitlements gate ────────────────────────────────────────────────────────

describe("Entitlements gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setCtx(CTX_ORG_ADMIN);
  });

  it("short-circuits before permission check when module access denied", async () => {
    (entitlements.requireModuleAccess as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("MODULE_ACCESS_DENIED")
    );
    (mapEntitlementError as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      message: "Module not available on your plan",
    });
    const result = await getOrgProfileAction();
    expect(result).toEqual({ success: false, error: "Module not available on your plan" });
    expect(OrgProfileService.getProfile).not.toHaveBeenCalled();
  });
});
