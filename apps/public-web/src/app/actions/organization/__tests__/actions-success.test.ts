/**
 * @vitest-environment node
 *
 * Success-path and edge-case tests for:
 * - roles.ts (listRolesAction, createRoleAction, updateRoleAction, deleteRoleAction,
 *             assignRoleToUserAction, removeRoleFromUserAction, getUserRoleAssignmentsAction,
 *             getMemberAccessAction)
 * - invitations.ts (listInvitationsAction, createInvitationAction, cancelInvitationAction,
 *                   resendInvitationAction, cleanupExpiredInvitationsAction)
 *
 * These complement actions.test.ts which covers deny paths.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock factories — must not reference outer scope ───────────────────────────

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-test" } }, error: null }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  }),
}));

vi.mock("next-intl/server", () => ({
  getLocale: vi.fn().mockResolvedValue("en"),
}));

vi.mock("@/server/loaders/v2/load-dashboard-context.v2", () => ({
  loadDashboardContextV2: vi.fn().mockResolvedValue({
    app: { activeOrgId: "org-123" },
    user: {
      user: { id: "user-123", email: "admin@example.com", first_name: "Admin", last_name: "User" },
      permissionSnapshot: { allow: [], deny: [] },
    },
  }),
}));

vi.mock("@/server/guards/entitlements-guards", () => ({
  entitlements: { requireModuleAccess: vi.fn().mockResolvedValue(undefined) },
  mapEntitlementError: vi.fn().mockReturnValue(null),
}));

vi.mock("@/server/services/event.service", () => ({
  eventService: { emit: vi.fn().mockResolvedValue({ success: true }) },
}));

vi.mock("@/server/services/email.service", () => {
  function EmailServiceMock() {}
  EmailServiceMock.prototype.sendInvitationEmailWithTemplate = vi
    .fn()
    .mockResolvedValue({ success: true });
  return { EmailService: EmailServiceMock };
});

vi.mock("@/server/services/organization.service", () => ({
  OrgProfileService: { getProfile: vi.fn() },
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
}));

import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { eventService } from "@/server/services/event.service";
import {
  OrgProfileService,
  OrgInvitationsService,
  OrgRolesService,
} from "@/server/services/organization.service";
import { createClient } from "@/utils/supabase/server";

import {
  listRolesAction,
  createRoleAction,
  updateRoleAction,
  deleteRoleAction,
  assignRoleToUserAction,
  removeRoleFromUserAction,
  getUserRoleAssignmentsAction,
  getMemberAccessAction,
} from "../roles";
import {
  listInvitationsAction,
  createInvitationAction,
  cancelInvitationAction,
  resendInvitationAction,
  cleanupExpiredInvitationsAction,
} from "../invitations";

// ─── Context helpers ──────────────────────────────────────────────────────────

const CTX_ORG_ADMIN = {
  app: { activeOrgId: "org-123" },
  user: {
    user: { id: "user-123", email: "admin@example.com", first_name: "Admin", last_name: "User" },
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

const CTX_BRANCH_MANAGER = {
  app: { activeOrgId: "org-123" },
  user: {
    user: { id: "user-123", email: "bm@example.com" },
    permissionSnapshot: {
      allow: ["module.organization-management.access", "branch.roles.manage"],
      deny: [],
    },
  },
};

function setCtx(ctx: unknown) {
  (loadDashboardContextV2 as ReturnType<typeof vi.fn>).mockResolvedValue(ctx);
}

const VALID_UUID = "00000000-0000-0000-0000-000000000001";
const VALID_UUID_2 = "00000000-0000-0000-0000-000000000002";
const VALID_UUID_3 = "00000000-0000-0000-0000-000000000003";

// ─── listRolesAction — success paths ─────────────────────────────────────────

describe("listRolesAction — success paths", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setCtx(CTX_ORG_ADMIN);
  });

  it("returns roles when authorized with members.read", async () => {
    const roles = [{ id: "r-1", name: "Admin", scope_type: "org" }];
    vi.mocked(OrgRolesService.listRoles).mockResolvedValue({ success: true, data: roles as never });
    const result = await listRolesAction();
    expect(result.success).toBe(true);
    expect((result as { success: true; data: unknown }).data).toEqual(roles);
  });

  it("branch manager sees only branch-scoped roles", async () => {
    setCtx(CTX_BRANCH_MANAGER);
    const roles = [
      { id: "r-1", name: "Org Admin", scope_type: "org" },
      { id: "r-2", name: "Branch Lead", scope_type: "branch" },
    ];
    vi.mocked(OrgRolesService.listRoles).mockResolvedValue({ success: true, data: roles as never });
    const result = await listRolesAction();
    expect(result.success).toBe(true);
    const data = (result as { success: true; data: { scope_type: string }[] }).data;
    expect(data).toHaveLength(1);
    expect(data[0].scope_type).toBe("branch");
  });

  it("returns service error when listRoles fails", async () => {
    vi.mocked(OrgRolesService.listRoles).mockResolvedValue({ success: false, error: "DB error" });
    const result = await listRolesAction();
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe("DB error");
  });
});

// ─── createRoleAction — success paths ────────────────────────────────────────

describe("createRoleAction — success paths", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setCtx(CTX_ORG_ADMIN);
  });

  it("creates org-scoped role and emits event", async () => {
    const newRole = { id: VALID_UUID, name: "Supervisor", scope_type: "org" };
    vi.mocked(OrgRolesService.createRole).mockResolvedValue({
      success: true,
      data: newRole as never,
    });
    const result = await createRoleAction({ name: "Supervisor", scope_type: "org" });
    expect(result.success).toBe(true);
    expect(eventService.emit).toHaveBeenCalledWith(
      expect.objectContaining({ actionKey: "org.role.created" })
    );
  });

  it("creates role even when event emission fails", async () => {
    const newRole = { id: VALID_UUID, name: "Supervisor", scope_type: "org" };
    vi.mocked(OrgRolesService.createRole).mockResolvedValue({
      success: true,
      data: newRole as never,
    });
    vi.mocked(eventService.emit).mockResolvedValue({
      success: false,
      error: "Event failed",
    } as never);
    const result = await createRoleAction({ name: "Supervisor" });
    // Still succeeds even if event emission fails
    expect(result.success).toBe(true);
  });

  it("returns service error when createRole fails", async () => {
    vi.mocked(OrgRolesService.createRole).mockResolvedValue({
      success: false,
      error: "Duplicate name",
    });
    const result = await createRoleAction({ name: "Admin" });
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe("Duplicate name");
  });

  it("rejects invalid input", async () => {
    const result = await createRoleAction({ name: "" }); // empty name fails min(1)
    expect(result.success).toBe(false);
  });
});

// ─── updateRoleAction — success paths ────────────────────────────────────────

describe("updateRoleAction — success paths", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setCtx(CTX_ORG_ADMIN);
    // Default: from("roles") returns null role (no scope_type check needed)
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-test" } }, error: null }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    } as never);
  });

  it("updates role and emits event", async () => {
    vi.mocked(OrgRolesService.updateRole).mockResolvedValue({ success: true, data: undefined });
    const result = await updateRoleAction({ roleId: VALID_UUID, name: "New Name" });
    expect(result.success).toBe(true);
    expect(eventService.emit).toHaveBeenCalledWith(
      expect.objectContaining({ actionKey: "org.role.updated" })
    );
  });

  it("returns service error when updateRole fails", async () => {
    vi.mocked(OrgRolesService.updateRole).mockResolvedValue({
      success: false,
      error: "Role not found",
    });
    const result = await updateRoleAction({ roleId: VALID_UUID, name: "New Name" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid roleId", async () => {
    const result = await updateRoleAction({ roleId: "not-a-uuid", name: "Name" });
    expect(result.success).toBe(false);
  });
});

// ─── deleteRoleAction — success paths ────────────────────────────────────────

describe("deleteRoleAction — success paths", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setCtx(CTX_ORG_ADMIN);
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-test" } }, error: null }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: { name: "OldRole" }, error: null }),
      }),
    } as never);
  });

  it("deletes role and emits event", async () => {
    vi.mocked(OrgRolesService.deleteRole).mockResolvedValue({ success: true, data: undefined });
    const result = await deleteRoleAction({ roleId: VALID_UUID });
    expect(result.success).toBe(true);
    expect(eventService.emit).toHaveBeenCalledWith(
      expect.objectContaining({ actionKey: "org.role.deleted" })
    );
  });

  it("succeeds even when event emission fails", async () => {
    vi.mocked(OrgRolesService.deleteRole).mockResolvedValue({ success: true, data: undefined });
    vi.mocked(eventService.emit).mockResolvedValue({
      success: false,
      error: "Event error",
    } as never);
    const result = await deleteRoleAction({ roleId: VALID_UUID });
    expect(result.success).toBe(true);
  });

  it("returns service error when deleteRole fails", async () => {
    vi.mocked(OrgRolesService.deleteRole).mockResolvedValue({
      success: false,
      error: "Cannot delete basic role",
    });
    const result = await deleteRoleAction({ roleId: VALID_UUID });
    expect(result.success).toBe(false);
  });

  it("rejects invalid roleId", async () => {
    const result = await deleteRoleAction({ roleId: "not-uuid" });
    expect(result.success).toBe(false);
  });
});

// ─── assignRoleToUserAction — success paths ──────────────────────────────────

describe("assignRoleToUserAction — success paths", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setCtx(CTX_ORG_ADMIN);
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-test" } }, error: null }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: { name: "Supervisor" }, error: null }),
      }),
    } as never);
  });

  it("assigns org-scoped role and emits event", async () => {
    vi.mocked(OrgRolesService.assignRoleToUser).mockResolvedValue({
      success: true,
      data: undefined,
    });
    const result = await assignRoleToUserAction({
      userId: VALID_UUID,
      roleId: VALID_UUID_2,
      scope: "org",
    });
    expect(result.success).toBe(true);
    expect(eventService.emit).toHaveBeenCalledWith(
      expect.objectContaining({ actionKey: "org.member.role_assigned" })
    );
  });

  it("assigns branch-scoped role with scopeId", async () => {
    vi.mocked(OrgRolesService.assignRoleToUser).mockResolvedValue({
      success: true,
      data: undefined,
    });
    const result = await assignRoleToUserAction({
      userId: VALID_UUID,
      roleId: VALID_UUID_2,
      scope: "branch",
      scopeId: VALID_UUID_3,
    });
    expect(result.success).toBe(true);
  });

  it("returns error when branch scope missing scopeId", async () => {
    const result = await assignRoleToUserAction({
      userId: VALID_UUID,
      roleId: VALID_UUID_2,
      scope: "branch",
    });
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe(
      "scopeId required for branch assignments"
    );
  });

  it("returns service error when assign fails", async () => {
    vi.mocked(OrgRolesService.assignRoleToUser).mockResolvedValue({
      success: false,
      error: "Already assigned",
    });
    const result = await assignRoleToUserAction({
      userId: VALID_UUID,
      roleId: VALID_UUID_2,
      scope: "org",
    });
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe("Already assigned");
  });
});

// ─── removeRoleFromUserAction — success paths ─────────────────────────────────

describe("removeRoleFromUserAction — success paths", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setCtx(CTX_ORG_ADMIN);
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-test" } }, error: null }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: { name: "Supervisor" }, error: null }),
      }),
    } as never);
  });

  it("removes org-scoped role and emits event", async () => {
    vi.mocked(OrgRolesService.removeRoleFromUser).mockResolvedValue({
      success: true,
      data: undefined,
    });
    const result = await removeRoleFromUserAction({
      userId: VALID_UUID,
      roleId: VALID_UUID_2,
      scope: "org",
    });
    expect(result.success).toBe(true);
    expect(eventService.emit).toHaveBeenCalledWith(
      expect.objectContaining({ actionKey: "org.member.role_removed" })
    );
  });

  it("returns error when branch scope missing scopeId", async () => {
    const result = await removeRoleFromUserAction({
      userId: VALID_UUID,
      roleId: VALID_UUID_2,
      scope: "branch",
    });
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe(
      "scopeId required for branch removals"
    );
  });

  it("returns service error when remove fails", async () => {
    vi.mocked(OrgRolesService.removeRoleFromUser).mockResolvedValue({
      success: false,
      error: "Assignment not found",
    });
    const result = await removeRoleFromUserAction({
      userId: VALID_UUID,
      roleId: VALID_UUID_2,
      scope: "org",
    });
    expect(result.success).toBe(false);
  });
});

// ─── getUserRoleAssignmentsAction ─────────────────────────────────────────────

describe("getUserRoleAssignmentsAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setCtx(CTX_ORG_ADMIN);
  });

  it("returns role assignments when authorized", async () => {
    const assignments = [{ id: "a-1", role_id: VALID_UUID }];
    vi.mocked(OrgRolesService.getUserRoleAssignments).mockResolvedValue({
      success: true,
      data: assignments as never,
    });
    const result = await getUserRoleAssignmentsAction(VALID_UUID);
    expect(result.success).toBe(true);
    expect(OrgRolesService.getUserRoleAssignments).toHaveBeenCalledWith(
      expect.anything(),
      "org-123",
      VALID_UUID
    );
  });

  it("returns error for invalid UUID", async () => {
    const result = await getUserRoleAssignmentsAction("not-a-uuid");
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe("Invalid user ID");
  });

  it("returns unauthorized when no MEMBERS_READ and no BRANCH_ROLES_MANAGE", async () => {
    setCtx({
      app: { activeOrgId: "org-123" },
      user: {
        user: { id: "user-123" },
        permissionSnapshot: { allow: ["module.organization-management.access"], deny: [] },
      },
    });
    const result = await getUserRoleAssignmentsAction(VALID_UUID);
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe("Unauthorized");
  });

  it("branch manager can access via BRANCH_ROLES_MANAGE", async () => {
    setCtx(CTX_BRANCH_MANAGER);
    vi.mocked(OrgRolesService.getUserRoleAssignments).mockResolvedValue({
      success: true,
      data: [] as never,
    });
    const result = await getUserRoleAssignmentsAction(VALID_UUID);
    expect(result.success).toBe(true);
  });
});

// ─── getMemberAccessAction — success paths ───────────────────────────────────

describe("getMemberAccessAction — success paths", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setCtx(CTX_ORG_ADMIN);
  });

  it("returns full access data for org admin", async () => {
    const accessData = {
      assignments: [
        { id: "a-1", scope: "org" },
        { id: "a-2", scope: "branch" },
      ],
    };
    vi.mocked(OrgRolesService.getMemberAccess).mockResolvedValue({
      success: true,
      data: accessData as never,
    });
    const result = await getMemberAccessAction(VALID_UUID);
    expect(result.success).toBe(true);
    const data = (result as { success: true; data: typeof accessData }).data;
    expect(data.assignments).toHaveLength(2);
  });

  it("branch manager sees only branch-scoped assignments", async () => {
    setCtx(CTX_BRANCH_MANAGER);
    const accessData = {
      assignments: [
        { id: "a-1", scope: "org" },
        { id: "a-2", scope: "branch" },
      ],
    };
    vi.mocked(OrgRolesService.getMemberAccess).mockResolvedValue({
      success: true,
      data: accessData as never,
    });
    const result = await getMemberAccessAction(VALID_UUID);
    expect(result.success).toBe(true);
    const data = (result as { success: true; data: { assignments: { scope: string }[] } }).data;
    expect(data.assignments).toHaveLength(1);
    expect(data.assignments[0].scope).toBe("branch");
  });

  it("returns error for invalid UUID", async () => {
    const result = await getMemberAccessAction("not-a-uuid");
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe("Invalid user ID");
  });

  it("returns service error when getMemberAccess fails", async () => {
    vi.mocked(OrgRolesService.getMemberAccess).mockResolvedValue({
      success: false,
      error: "Not found",
    });
    const result = await getMemberAccessAction(VALID_UUID);
    expect(result.success).toBe(false);
  });
});

// ─── listInvitationsAction ────────────────────────────────────────────────────

describe("listInvitationsAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setCtx(CTX_ORG_ADMIN);
  });

  it("returns invitations when authorized with invites.read", async () => {
    const invitations = [{ id: "inv-1", email: "user@example.com", status: "pending" }];
    vi.mocked(OrgInvitationsService.listInvitations).mockResolvedValue({
      success: true,
      data: invitations as never,
    });
    const result = await listInvitationsAction();
    expect(result.success).toBe(true);
    expect((result as { success: true; data: unknown }).data).toEqual(invitations);
  });

  it("returns service error when listInvitations fails", async () => {
    vi.mocked(OrgInvitationsService.listInvitations).mockResolvedValue({
      success: false,
      error: "DB error",
    });
    const result = await listInvitationsAction();
    expect(result.success).toBe(false);
  });
});

// ─── createInvitationAction — email paths ─────────────────────────────────────

describe("createInvitationAction — email delivery paths", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setCtx(CTX_ORG_ADMIN);
    vi.mocked(OrgProfileService.getProfile).mockResolvedValue({
      success: true,
      data: { name: "Acme Corp", name_2: null } as never,
    });
  });

  it("returns emailDelivered=true when email service succeeds", async () => {
    const invitation = {
      id: VALID_UUID,
      email: "user@example.com",
      token: "tok-123",
      invited_first_name: "Jane",
      invited_last_name: "Doe",
    };
    vi.mocked(OrgInvitationsService.createInvitation).mockResolvedValue({
      success: true,
      data: invitation as never,
    });

    const result = await createInvitationAction({ email: "user@example.com" });
    expect(result.success).toBe(true);
    const r = result as { success: true; emailDelivered: boolean };
    expect(r.emailDelivered).toBe(true);
  });

  it("returns emailDelivered=false when email service returns failure", async () => {
    const invitation = {
      id: VALID_UUID,
      email: "user@example.com",
      token: "tok-123",
      invited_first_name: null,
      invited_last_name: null,
    };
    vi.mocked(OrgInvitationsService.createInvitation).mockResolvedValue({
      success: true,
      data: invitation as never,
    });

    // Import the email service mock to configure it
    const { EmailService } = await import("@/server/services/email.service");
    (
      EmailService.prototype.sendInvitationEmailWithTemplate as ReturnType<typeof vi.fn>
    ).mockResolvedValueOnce({ success: false, error: "Rate limit" });

    const result = await createInvitationAction({ email: "user@example.com" });
    expect(result.success).toBe(true);
    const r = result as { success: true; emailDelivered: boolean; emailError?: string };
    expect(r.emailDelivered).toBe(false);
    expect(r.emailError).toBe("Rate limit");
  });

  it("returns emailDelivered=false when email service throws", async () => {
    const invitation = {
      id: VALID_UUID,
      email: "user@example.com",
      token: "tok-123",
      invited_first_name: null,
      invited_last_name: null,
    };
    vi.mocked(OrgInvitationsService.createInvitation).mockResolvedValue({
      success: true,
      data: invitation as never,
    });

    const { EmailService } = await import("@/server/services/email.service");
    (
      EmailService.prototype.sendInvitationEmailWithTemplate as ReturnType<typeof vi.fn>
    ).mockRejectedValueOnce(new Error("SMTP timeout"));

    const result = await createInvitationAction({ email: "user@example.com" });
    expect(result.success).toBe(true);
    const r = result as { success: true; emailDelivered: boolean; emailError?: string };
    expect(r.emailDelivered).toBe(false);
    expect(r.emailError).toBe("SMTP timeout");
  });

  it("returns result.success=false when createInvitation service fails", async () => {
    vi.mocked(OrgInvitationsService.createInvitation).mockResolvedValue({
      success: false,
      error: "SELF_INVITE",
    });
    const result = await createInvitationAction({ email: "admin@example.com" });
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe("SELF_INVITE");
  });

  it("rejects invalid email", async () => {
    const result = await createInvitationAction({ email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("emits event on successful invitation", async () => {
    const invitation = {
      id: VALID_UUID,
      email: "user@example.com",
      token: "tok-123",
      invited_first_name: null,
      invited_last_name: null,
    };
    vi.mocked(OrgInvitationsService.createInvitation).mockResolvedValue({
      success: true,
      data: invitation as never,
    });
    await createInvitationAction({ email: "user@example.com" });
    expect(eventService.emit).toHaveBeenCalledWith(
      expect.objectContaining({ actionKey: "org.member.invited" })
    );
  });
});

// ─── cancelInvitationAction ───────────────────────────────────────────────────

describe("cancelInvitationAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setCtx(CTX_ORG_ADMIN);
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-test" } }, error: null }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi
          .fn()
          .mockResolvedValue({ data: { email: "user@example.com" }, error: null }),
      }),
    } as never);
  });

  it("cancels invitation and emits event", async () => {
    vi.mocked(OrgInvitationsService.cancelInvitation).mockResolvedValue({
      success: true,
      data: undefined,
    });
    const result = await cancelInvitationAction({ invitationId: VALID_UUID });
    expect(result.success).toBe(true);
    expect(eventService.emit).toHaveBeenCalledWith(
      expect.objectContaining({ actionKey: "org.invitation.cancelled" })
    );
  });

  it("succeeds even when event emission fails", async () => {
    vi.mocked(OrgInvitationsService.cancelInvitation).mockResolvedValue({
      success: true,
      data: undefined,
    });
    vi.mocked(eventService.emit).mockResolvedValue({
      success: false,
      error: "Event error",
    } as never);
    const result = await cancelInvitationAction({ invitationId: VALID_UUID });
    expect(result.success).toBe(true);
  });

  it("returns service error when cancelInvitation fails", async () => {
    vi.mocked(OrgInvitationsService.cancelInvitation).mockResolvedValue({
      success: false,
      error: "Already accepted",
    });
    const result = await cancelInvitationAction({ invitationId: VALID_UUID });
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe("Already accepted");
  });

  it("rejects invalid invitationId", async () => {
    const result = await cancelInvitationAction({ invitationId: "not-uuid" });
    expect(result.success).toBe(false);
  });
});

// ─── resendInvitationAction ───────────────────────────────────────────────────

describe("resendInvitationAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setCtx(CTX_ORG_ADMIN);
    vi.mocked(OrgProfileService.getProfile).mockResolvedValue({
      success: true,
      data: { name: "Acme Corp", name_2: null } as never,
    });
  });

  it("resends invitation and returns emailDelivered=true", async () => {
    const invitationData = {
      organization_id: "org-123",
      email: "user@example.com",
      token: "new-token-123",
    };
    vi.mocked(OrgInvitationsService.resendInvitation).mockResolvedValue({
      success: true,
      data: invitationData as never,
    });
    const result = await resendInvitationAction({ invitationId: VALID_UUID });
    expect(result.success).toBe(true);
    const r = result as { success: true; data: string; emailDelivered: boolean };
    expect(r.data).toBe("new-token-123");
    expect(r.emailDelivered).toBe(true);
    expect(eventService.emit).toHaveBeenCalledWith(
      expect.objectContaining({ actionKey: "org.invitation.resent" })
    );
  });

  it("returns emailDelivered=false when email fails", async () => {
    const invitationData = {
      organization_id: "org-123",
      email: "user@example.com",
      token: "new-token-456",
    };
    vi.mocked(OrgInvitationsService.resendInvitation).mockResolvedValue({
      success: true,
      data: invitationData as never,
    });

    const { EmailService } = await import("@/server/services/email.service");
    (
      EmailService.prototype.sendInvitationEmailWithTemplate as ReturnType<typeof vi.fn>
    ).mockResolvedValueOnce({ success: false, error: "Delivery failed" });

    const result = await resendInvitationAction({ invitationId: VALID_UUID });
    expect(result.success).toBe(true);
    const r = result as { success: true; emailDelivered: boolean; emailError?: string };
    expect(r.emailDelivered).toBe(false);
    expect(r.emailError).toBe("Delivery failed");
  });

  it("returns service error when resendInvitation fails", async () => {
    vi.mocked(OrgInvitationsService.resendInvitation).mockResolvedValue({
      success: false,
      error: "Not found",
    });
    const result = await resendInvitationAction({ invitationId: VALID_UUID });
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe("Not found");
  });

  it("rejects invalid invitationId", async () => {
    const result = await resendInvitationAction({ invitationId: "not-uuid" });
    expect(result.success).toBe(false);
  });

  it("returns unauthorized when missing invites.create", async () => {
    setCtx({
      app: { activeOrgId: "org-123" },
      user: {
        user: { id: "user-123" },
        permissionSnapshot: {
          allow: ["module.organization-management.access", "invites.read"],
          deny: [],
        },
      },
    });
    const result = await resendInvitationAction({ invitationId: VALID_UUID });
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe("Unauthorized");
  });
});

// ─── cleanupExpiredInvitationsAction ─────────────────────────────────────────

describe("cleanupExpiredInvitationsAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setCtx(CTX_ORG_ADMIN);
  });

  it("cleans up expired invitations when authorized", async () => {
    vi.mocked(OrgInvitationsService.cleanupExpiredInvitations).mockResolvedValue({
      success: true,
      data: { cleaned: 3 } as never,
    });
    const result = await cleanupExpiredInvitationsAction();
    expect(result.success).toBe(true);
    expect(OrgInvitationsService.cleanupExpiredInvitations).toHaveBeenCalledWith(
      expect.anything(),
      "org-123"
    );
  });

  it("returns unauthorized when missing invites.cancel", async () => {
    setCtx({
      app: { activeOrgId: "org-123" },
      user: {
        user: { id: "user-123" },
        permissionSnapshot: {
          allow: ["module.organization-management.access", "invites.read"],
          deny: [],
        },
      },
    });
    const result = await cleanupExpiredInvitationsAction();
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe("Unauthorized");
  });

  it("returns service error on failure", async () => {
    vi.mocked(OrgInvitationsService.cleanupExpiredInvitations).mockResolvedValue({
      success: false,
      error: "DB error",
    });
    const result = await cleanupExpiredInvitationsAction();
    expect(result.success).toBe(false);
  });
});
