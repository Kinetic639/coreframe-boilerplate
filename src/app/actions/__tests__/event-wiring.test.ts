/**
 * @vitest-environment node
 *
 * T-EVENT-WIRING: Verify that platform actions emit the correct events after
 * successful domain writes.
 *
 * Strategy:
 *   - All vi.mock() calls must be at module scope (they are hoisted)
 *   - Static imports are used so vi.mocked() resolves against the right mock instances
 *   - eventService.emit is mocked and calls are asserted per action
 *   - Do NOT assert on requestId (dynamically generated); DO assert for correlation equality
 *
 * Covered actions:
 *   createInvitationAction  → org.member.invited
 *   cancelInvitationAction  → org.invitation.cancelled
 *   acceptInvitationAction  → org.invitation.accepted
 *   removeMemberAction      → org.member.removed
 *   createRoleAction        → org.role.created
 *   deleteRoleAction        → org.role.deleted
 *   assignRoleToUserAction  → org.member.role_assigned
 *   removeRoleFromUserAction→ org.member.role_removed
 *   createBranchAction      → org.branch.created
 *   updateBranchAction      → org.branch.updated
 *   deleteBranchAction      → org.branch.deleted
 *   updateOrgProfileAction  → org.updated
 *   createOrganizationAction→ org.created + org.onboarding.completed (shared requestId)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Constants + mock helpers — declared via vi.hoisted() so they are available
// inside vi.mock() factories (which are also hoisted before regular const decls)
// ---------------------------------------------------------------------------

const {
  ORG_ID,
  USER_ID,
  ROLE_ID,
  BRANCH_ID,
  INV_ID,
  TARGET_USER_ID,
  mockAuthGetUser,
  mockFromChain,
} = vi.hoisted(() => {
  const ORG_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const USER_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
  return {
    ORG_ID,
    USER_ID,
    ROLE_ID: "cccccccc-cccc-cccc-cccc-cccccccccccc",
    BRANCH_ID: "dddddddd-dddd-dddd-dddd-dddddddddddd",
    INV_ID: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",
    TARGET_USER_ID: "ffffffff-ffff-ffff-ffff-ffffffffffff",
    mockAuthGetUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }),
    mockFromChain: vi.fn(),
  };
});

// ---------------------------------------------------------------------------
// Mocks — must be at module scope (hoisted by Vitest)
// ---------------------------------------------------------------------------

vi.mock("@/server/services/event.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/services/event.service")>();
  return {
    ...actual,
    eventService: { emit: vi.fn().mockResolvedValue({ success: true, data: { id: "event-id" } }) },
  };
});

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    from: mockFromChain,
    auth: { getUser: mockAuthGetUser },
  }),
}));

vi.mock("@/server/loaders/v2/load-dashboard-context.v2", () => ({
  loadDashboardContextV2: vi.fn().mockResolvedValue({
    app: { activeOrgId: ORG_ID },
    user: {
      user: { id: USER_ID },
      permissionSnapshot: {
        allow: [
          "org.*",
          "members.*",
          "invites.*",
          "branches.*",
          "module.organization-management.access",
        ],
        deny: [],
      },
    },
  }),
}));

vi.mock("@/lib/utils/permissions", () => ({
  checkPermission: vi.fn().mockReturnValue(true),
}));

vi.mock("@/server/guards/entitlements-guards", () => ({
  entitlements: { requireModuleAccess: vi.fn().mockResolvedValue(undefined) },
  mapEntitlementError: vi.fn().mockReturnValue(null),
}));

vi.mock("@/server/services/email.service", () => {
  function MockEmailService() {}
  MockEmailService.prototype.sendInvitationEmailWithTemplate = vi
    .fn()
    .mockResolvedValue({ success: true });
  return { EmailService: MockEmailService };
});

vi.mock("next-intl/server", () => ({
  getLocale: vi.fn().mockResolvedValue("en"),
  getTranslations: vi.fn().mockResolvedValue((k: string) => k),
}));

vi.mock("@/server/services/organization.service", () => ({
  OrgProfileService: {
    getProfile: vi.fn(),
    updateProfile: vi.fn(),
    uploadLogo: vi.fn(),
  },
  OrgMembersService: {
    listMembers: vi.fn(),
    updateMemberStatus: vi.fn(),
    removeMember: vi.fn(),
    getMember: vi.fn(),
    getMembersGroupedByBranch: vi.fn(),
  },
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
    setRolePermissions: vi.fn(),
  },
  OrgBranchesService: {
    listBranches: vi.fn(),
    createBranch: vi.fn(),
    updateBranch: vi.fn(),
    deleteBranch: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Static imports (after mocks)
// ---------------------------------------------------------------------------

import { eventService } from "@/server/services/event.service";
import { createClient } from "@/utils/supabase/server";
import {
  OrgInvitationsService,
  OrgMembersService,
  OrgRolesService,
  OrgBranchesService,
  OrgProfileService,
} from "@/server/services/organization.service";

import {
  createInvitationAction,
  cancelInvitationAction,
  acceptInvitationAction,
} from "@/app/actions/organization/invitations";
import { removeMemberAction } from "@/app/actions/organization/members";
import {
  createRoleAction,
  deleteRoleAction,
  assignRoleToUserAction,
  removeRoleFromUserAction,
} from "@/app/actions/organization/roles";
import {
  createBranchAction,
  updateBranchAction,
  deleteBranchAction,
} from "@/app/actions/organization/branches";
import {
  updateOrgProfileAction,
  uploadOrgLogoAction,
  removeOrgLogoAction,
} from "@/app/actions/organization/profile";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a single-table chain that resolves maybeSingle with the given data. */
function singleTableQuery(data: unknown) {
  const inner = {
    maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
    eq: vi.fn(),
    is: vi.fn(),
  };
  inner.eq.mockReturnValue(inner);
  inner.is.mockReturnValue(inner);
  return { select: vi.fn().mockReturnValue(inner), update: vi.fn().mockReturnValue(inner) };
}

// ---------------------------------------------------------------------------
// T-EVENT-WIRING: invitation events
// ---------------------------------------------------------------------------

describe("T-EVENT-WIRING: invitation events", () => {
  beforeEach(() => vi.clearAllMocks());

  it("createInvitationAction emits org.member.invited after successful insert", async () => {
    vi.mocked(OrgInvitationsService.createInvitation).mockResolvedValue({
      success: true,
      data: {
        id: INV_ID,
        email: "invitee@example.com",
        invited_first_name: "Jane",
        invited_last_name: "Doe",
        role_summary: null,
      } as any,
    });
    vi.mocked(OrgProfileService.getProfile).mockResolvedValue({
      success: true,
      data: { name: "Test Org" } as any,
    });

    await createInvitationAction({ email: "invitee@example.com" });

    expect(vi.mocked(eventService.emit)).toHaveBeenCalledWith(
      expect.objectContaining({
        actionKey: "org.member.invited",
        actorUserId: USER_ID,
        organizationId: ORG_ID,
        entityType: "invitation",
        entityId: INV_ID,
        metadata: expect.objectContaining({ invitee_email: "invitee@example.com" }),
      })
    );
  });

  it("createInvitationAction does NOT emit when invitation creation fails", async () => {
    vi.mocked(OrgInvitationsService.createInvitation).mockResolvedValue({
      success: false,
      error: "DUPLICATE_PENDING",
    });

    await createInvitationAction({ email: "invitee@example.com" });

    expect(vi.mocked(eventService.emit)).not.toHaveBeenCalled();
  });

  it("cancelInvitationAction emits org.invitation.cancelled after successful cancel", async () => {
    mockFromChain.mockReturnValue(singleTableQuery({ email: "invited@example.com" }));
    vi.mocked(OrgInvitationsService.cancelInvitation).mockResolvedValue({
      success: true,
      data: undefined,
    });

    await cancelInvitationAction({ invitationId: INV_ID });

    expect(vi.mocked(eventService.emit)).toHaveBeenCalledWith(
      expect.objectContaining({
        actionKey: "org.invitation.cancelled",
        actorUserId: USER_ID,
        organizationId: ORG_ID,
        entityId: INV_ID,
        metadata: expect.objectContaining({ invitation_id: INV_ID }),
      })
    );
  });

  it("acceptInvitationAction emits org.invitation.accepted after successful accept", async () => {
    mockFromChain.mockReturnValue(singleTableQuery({ id: INV_ID }));
    mockAuthGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
    vi.mocked(OrgInvitationsService.acceptInvitation).mockResolvedValue({
      success: true,
      data: { organization_id: ORG_ID },
    });

    await acceptInvitationAction("test-token-123");

    expect(vi.mocked(eventService.emit)).toHaveBeenCalledWith(
      expect.objectContaining({
        actionKey: "org.invitation.accepted",
        actorUserId: USER_ID,
        organizationId: ORG_ID,
        entityType: "user",
        entityId: USER_ID,
      })
    );
  });
});

// ---------------------------------------------------------------------------
// T-EVENT-WIRING: member events
// ---------------------------------------------------------------------------

describe("T-EVENT-WIRING: member events", () => {
  beforeEach(() => vi.clearAllMocks());

  it("removeMemberAction emits org.member.removed after successful removal", async () => {
    vi.mocked(OrgMembersService.removeMember).mockResolvedValue({
      success: true,
      data: undefined,
    });

    await removeMemberAction({ userId: TARGET_USER_ID });

    expect(vi.mocked(eventService.emit)).toHaveBeenCalledWith(
      expect.objectContaining({
        actionKey: "org.member.removed",
        actorUserId: USER_ID,
        organizationId: ORG_ID,
        entityId: TARGET_USER_ID,
        metadata: expect.objectContaining({ removed_user_id: TARGET_USER_ID }),
      })
    );
  });

  it("removeMemberAction does NOT emit when removal fails", async () => {
    vi.mocked(OrgMembersService.removeMember).mockResolvedValue({
      success: false,
      error: "Member not found",
    });

    await removeMemberAction({ userId: TARGET_USER_ID });

    expect(vi.mocked(eventService.emit)).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// T-EVENT-WIRING: role events
// ---------------------------------------------------------------------------

describe("T-EVENT-WIRING: role events", () => {
  beforeEach(() => vi.clearAllMocks());

  it("createRoleAction emits org.role.created with role_id and role_name", async () => {
    vi.mocked(OrgRolesService.createRole).mockResolvedValue({
      success: true,
      data: {
        id: ROLE_ID,
        name: "Manager",
        organization_id: ORG_ID,
        description: null,
        is_basic: false,
        scope_type: "org",
        deleted_at: null,
        permission_slugs: [],
      },
    });

    await createRoleAction({ name: "Manager" });

    expect(vi.mocked(eventService.emit)).toHaveBeenCalledWith(
      expect.objectContaining({
        actionKey: "org.role.created",
        actorUserId: USER_ID,
        organizationId: ORG_ID,
        entityId: ROLE_ID,
        metadata: expect.objectContaining({ role_id: ROLE_ID, role_name: "Manager" }),
      })
    );
  });

  it("deleteRoleAction emits org.role.deleted with role_name fetched before deletion", async () => {
    mockFromChain.mockReturnValue(singleTableQuery({ name: "OldRole" }));
    vi.mocked(OrgRolesService.deleteRole).mockResolvedValue({
      success: true,
      data: undefined,
    });

    await deleteRoleAction({ roleId: ROLE_ID });

    expect(vi.mocked(eventService.emit)).toHaveBeenCalledWith(
      expect.objectContaining({
        actionKey: "org.role.deleted",
        entityId: ROLE_ID,
        metadata: expect.objectContaining({ role_id: ROLE_ID, role_name: "OldRole" }),
      })
    );
  });

  it("assignRoleToUserAction emits org.member.role_assigned with correct metadata", async () => {
    mockFromChain.mockReturnValue(singleTableQuery({ name: "Manager" }));
    vi.mocked(OrgRolesService.assignRoleToUser).mockResolvedValue({
      success: true,
      data: undefined,
    });

    await assignRoleToUserAction({
      userId: TARGET_USER_ID,
      roleId: ROLE_ID,
      scope: "org",
    });

    expect(vi.mocked(eventService.emit)).toHaveBeenCalledWith(
      expect.objectContaining({
        actionKey: "org.member.role_assigned",
        targetType: "user",
        targetId: TARGET_USER_ID,
        metadata: expect.objectContaining({
          target_user_id: TARGET_USER_ID,
          role_name: "Manager",
          scope: "org",
        }),
      })
    );
  });

  it("removeRoleFromUserAction emits org.member.role_removed with correct metadata", async () => {
    mockFromChain.mockReturnValue(singleTableQuery({ name: "Manager" }));
    vi.mocked(OrgRolesService.removeRoleFromUser).mockResolvedValue({
      success: true,
      data: undefined,
    });

    await removeRoleFromUserAction({
      userId: TARGET_USER_ID,
      roleId: ROLE_ID,
      scope: "org",
    });

    expect(vi.mocked(eventService.emit)).toHaveBeenCalledWith(
      expect.objectContaining({
        actionKey: "org.member.role_removed",
        targetId: TARGET_USER_ID,
        metadata: expect.objectContaining({
          target_user_id: TARGET_USER_ID,
          role_name: "Manager",
          scope: "org",
        }),
      })
    );
  });
});

// ---------------------------------------------------------------------------
// T-EVENT-WIRING: branch events
// ---------------------------------------------------------------------------

describe("T-EVENT-WIRING: branch events", () => {
  beforeEach(() => vi.clearAllMocks());

  it("createBranchAction emits org.branch.created with branch_id and branch_name", async () => {
    vi.mocked(OrgBranchesService.createBranch).mockResolvedValue({
      success: true,
      data: {
        id: BRANCH_ID,
        name: "Warsaw",
        organization_id: ORG_ID,
        slug: null,
        created_at: null,
        deleted_at: null,
      },
    });

    await createBranchAction({ name: "Warsaw" });

    expect(vi.mocked(eventService.emit)).toHaveBeenCalledWith(
      expect.objectContaining({
        actionKey: "org.branch.created",
        actorUserId: USER_ID,
        organizationId: ORG_ID,
        entityId: BRANCH_ID,
        metadata: expect.objectContaining({ branch_id: BRANCH_ID, branch_name: "Warsaw" }),
      })
    );
  });

  it("updateBranchAction emits org.branch.updated with branch_id and updated_fields", async () => {
    vi.mocked(OrgBranchesService.updateBranch).mockResolvedValue({
      success: true,
      data: undefined,
    });

    await updateBranchAction({ branchId: BRANCH_ID, name: "Krakow" });

    expect(vi.mocked(eventService.emit)).toHaveBeenCalledWith(
      expect.objectContaining({
        actionKey: "org.branch.updated",
        entityId: BRANCH_ID,
        metadata: expect.objectContaining({
          branch_id: BRANCH_ID,
          updated_fields: expect.arrayContaining(["name"]),
        }),
      })
    );
  });

  it("deleteBranchAction emits org.branch.deleted with branch_id", async () => {
    vi.mocked(OrgBranchesService.deleteBranch).mockResolvedValue({
      success: true,
      data: undefined,
    });

    await deleteBranchAction({ branchId: BRANCH_ID });

    expect(vi.mocked(eventService.emit)).toHaveBeenCalledWith(
      expect.objectContaining({
        actionKey: "org.branch.deleted",
        entityId: BRANCH_ID,
        metadata: expect.objectContaining({ branch_id: BRANCH_ID }),
      })
    );
  });
});

// ---------------------------------------------------------------------------
// T-EVENT-WIRING: org profile
// ---------------------------------------------------------------------------

describe("T-EVENT-WIRING: org.updated", () => {
  beforeEach(() => vi.clearAllMocks());

  it("updateOrgProfileAction emits org.updated with updated_fields", async () => {
    vi.mocked(OrgProfileService.updateProfile).mockResolvedValue({
      success: true,
      data: { name: "NewName" } as any,
    });

    await updateOrgProfileAction({ name: "NewName", bio: "Updated bio" });

    expect(vi.mocked(eventService.emit)).toHaveBeenCalledWith(
      expect.objectContaining({
        actionKey: "org.updated",
        actorUserId: USER_ID,
        organizationId: ORG_ID,
        metadata: expect.objectContaining({
          updated_fields: expect.arrayContaining(["name", "bio"]),
        }),
      })
    );
  });

  it("updateOrgProfileAction does NOT emit when update fails", async () => {
    vi.mocked(OrgProfileService.updateProfile).mockResolvedValue({
      success: false,
      error: "unauthorized",
    });

    await updateOrgProfileAction({ name: "NewName" });

    expect(vi.mocked(eventService.emit)).not.toHaveBeenCalled();
  });

  it("uploadOrgLogoAction emits org.updated with updated_fields: [logo_url] on success", async () => {
    vi.mocked(OrgProfileService.uploadLogo).mockResolvedValue({
      success: true,
      data: { logo_url: "https://example.com/logo.png" } as any,
    });

    const formData = new FormData();
    const file = new File(["x"], "logo.png", { type: "image/png" });
    formData.append("file", file);

    await uploadOrgLogoAction(formData);

    expect(vi.mocked(eventService.emit)).toHaveBeenCalledWith(
      expect.objectContaining({
        actionKey: "org.updated",
        actorUserId: USER_ID,
        organizationId: ORG_ID,
        metadata: { updated_fields: ["logo_url"] },
      })
    );
  });

  it("uploadOrgLogoAction does NOT emit when upload fails", async () => {
    vi.mocked(OrgProfileService.uploadLogo).mockResolvedValue({
      success: false,
      error: "File too large",
    });

    const formData = new FormData();
    const file = new File(["x"], "logo.png", { type: "image/png" });
    formData.append("file", file);

    await uploadOrgLogoAction(formData);

    expect(vi.mocked(eventService.emit)).not.toHaveBeenCalled();
  });

  it("removeOrgLogoAction emits org.updated with updated_fields: [logo_url] on success", async () => {
    vi.mocked(OrgProfileService.updateProfile).mockResolvedValue({
      success: true,
      data: { logo_url: null } as any,
    });
    // removeOrgLogoAction calls supabase.storage directly for list/remove
    vi.mocked(createClient).mockResolvedValueOnce({
      from: mockFromChain,
      auth: { getUser: mockAuthGetUser },
      storage: {
        from: vi.fn().mockReturnValue({
          list: vi.fn().mockResolvedValue({ data: [], error: null }),
          remove: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      },
    } as any);

    await removeOrgLogoAction();

    expect(vi.mocked(eventService.emit)).toHaveBeenCalledWith(
      expect.objectContaining({
        actionKey: "org.updated",
        actorUserId: USER_ID,
        organizationId: ORG_ID,
        metadata: { updated_fields: ["logo_url"] },
      })
    );
  });

  it("removeOrgLogoAction does NOT emit when profile update fails", async () => {
    vi.mocked(OrgProfileService.updateProfile).mockResolvedValue({
      success: false,
      error: "DB error",
    });
    vi.mocked(createClient).mockResolvedValueOnce({
      from: mockFromChain,
      auth: { getUser: mockAuthGetUser },
      storage: {
        from: vi.fn().mockReturnValue({
          list: vi.fn().mockResolvedValue({ data: [], error: null }),
          remove: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      },
    } as any);

    await removeOrgLogoAction();

    expect(vi.mocked(eventService.emit)).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// T-EVENT-WIRING: onboarding — org.created + org.onboarding.completed
// ---------------------------------------------------------------------------

describe("T-EVENT-WIRING: onboarding events", () => {
  beforeEach(() => vi.clearAllMocks());

  it("createOrganizationAction emits org.created and org.onboarding.completed", async () => {
    // We need a supabase client with rpc
    const mockRpc = vi.fn().mockResolvedValue({
      data: { success: true, organization_id: ORG_ID },
      error: null,
    });
    const { createClient } = await import("@/utils/supabase/server");
    vi.mocked(createClient).mockResolvedValue({
      from: mockFromChain,
      auth: { getUser: mockAuthGetUser },
      rpc: mockRpc,
    } as any);

    const { createOrganizationAction } = await import("@/app/actions/onboarding/index");
    await createOrganizationAction("Test Org", "Main Branch", null);

    const emitCalls = vi.mocked(eventService.emit).mock.calls.map((c) => c[0]);
    const keys = emitCalls.map((c) => c.actionKey);

    expect(keys).toContain("org.created");
    expect(keys).toContain("org.onboarding.completed");
  });

  it("org.created and org.onboarding.completed share the same non-null requestId", async () => {
    const mockRpc = vi.fn().mockResolvedValue({
      data: { success: true, organization_id: ORG_ID },
      error: null,
    });
    const { createClient } = await import("@/utils/supabase/server");
    vi.mocked(createClient).mockResolvedValue({
      from: mockFromChain,
      auth: { getUser: mockAuthGetUser },
      rpc: mockRpc,
    } as any);

    const { createOrganizationAction } = await import("@/app/actions/onboarding/index");
    await createOrganizationAction("Org A", "Branch A", null);

    const emitCalls = vi.mocked(eventService.emit).mock.calls.map((c) => c[0]);
    const createdCall = emitCalls.find((c) => c.actionKey === "org.created");
    const onboardedCall = emitCalls.find((c) => c.actionKey === "org.onboarding.completed");

    expect(createdCall?.requestId).toBeTruthy();
    expect(createdCall?.requestId).toBe(onboardedCall?.requestId);
  });

  it("emits no events if org creation fails", async () => {
    const mockRpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "DB error" },
    });
    const { createClient } = await import("@/utils/supabase/server");
    vi.mocked(createClient).mockResolvedValue({
      from: mockFromChain,
      auth: { getUser: mockAuthGetUser },
      rpc: mockRpc,
    } as any);

    const { createOrganizationAction } = await import("@/app/actions/onboarding/index");
    const result = await createOrganizationAction("Test Org", "Main Branch", null);

    expect(result.success).toBe(false);
    expect(vi.mocked(eventService.emit)).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// T-EVENT-WIRING: metadata passes schema validation
// ---------------------------------------------------------------------------

describe("T-EVENT-WIRING: metadata schema validation passes for all wired events", () => {
  it("emitted metadata for org.member.invited satisfies the registry schema", async () => {
    const { validateMetadata } = await import("@/server/services/event.service");
    // This test verifies that real emit() calls would pass validation in event.service
    // We call validateMetadata directly (exported from event.service for Mode B use)
    const result = validateMetadata("org.member.invited", {
      invitee_email: "test@example.com",
      invitee_first_name: "Jane",
    });
    expect(result.success).toBe(true);
  });

  it("emitted metadata for org.role.created satisfies the registry schema", async () => {
    const { validateMetadata } = await import("@/server/services/event.service");
    const result = validateMetadata("org.role.created", {
      role_id: ROLE_ID,
      role_name: "Manager",
    });
    expect(result.success).toBe(true);
  });

  it("emitted metadata for org.branch.created satisfies the registry schema", async () => {
    const { validateMetadata } = await import("@/server/services/event.service");
    const result = validateMetadata("org.branch.created", {
      branch_id: BRANCH_ID,
      branch_name: "Warsaw",
    });
    expect(result.success).toBe(true);
  });

  it("emitted metadata for org.created satisfies the registry schema", async () => {
    const { validateMetadata } = await import("@/server/services/event.service");
    const result = validateMetadata("org.created", {
      org_name: "Test Org",
      org_slug: "test-org",
    });
    expect(result.success).toBe(true);
  });

  it("emitted metadata for org.member.removed satisfies the registry schema", async () => {
    const { validateMetadata } = await import("@/server/services/event.service");
    const result = validateMetadata("org.member.removed", {
      removed_user_id: TARGET_USER_ID,
    });
    expect(result.success).toBe(true);
  });

  it("emitted metadata for auth.login satisfies the registry schema", async () => {
    const { validateMetadata } = await import("@/server/services/event.service");
    const result = validateMetadata("auth.login", { email: "user@example.com" });
    expect(result.success).toBe(true);
  });

  it("emitted metadata for auth.login.failed satisfies the registry schema", async () => {
    const { validateMetadata } = await import("@/server/services/event.service");
    const result = validateMetadata("auth.login.failed", {
      email: "user@example.com",
      reason: "invalid_credentials",
    });
    expect(result.success).toBe(true);
  });

  it("emitted metadata for auth.session.revoked satisfies the registry schema", async () => {
    const { validateMetadata } = await import("@/server/services/event.service");
    const result = validateMetadata("auth.session.revoked", {
      reason: "voluntary_signout",
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// T-EVENT-WIRING-MODE-A: Mode A best-effort — emit failure must NOT fail action
//
// These tests verify the critical Mode A invariant:
//   domain write succeeds → emit throws → action still returns success
//   emit failure is logged → no false business error is propagated
// ---------------------------------------------------------------------------

describe("T-EVENT-WIRING-MODE-A: emit failure does not fail successful domain action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Make emit throw on every call in this suite
    vi.mocked(eventService.emit).mockRejectedValue(new Error("DB connection lost"));
  });

  it("removeMemberAction returns success even when emit throws", async () => {
    vi.mocked(OrgMembersService.removeMember).mockResolvedValue({
      success: true,
      data: undefined,
    });
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await removeMemberAction({ userId: TARGET_USER_ID });

    expect(result.success).toBe(true);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("[removeMemberAction]"),
      expect.objectContaining({ actionKey: "org.member.removed", error: expect.any(Error) })
    );
    consoleErrorSpy.mockRestore();
  });

  it("createRoleAction returns success even when emit throws", async () => {
    vi.mocked(OrgRolesService.createRole).mockResolvedValue({
      success: true,
      data: {
        id: ROLE_ID,
        name: "Manager",
        organization_id: ORG_ID,
        description: null,
        is_basic: false,
        scope_type: "org",
        deleted_at: null,
        permission_slugs: [],
      },
    });
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await createRoleAction({ name: "Manager" });

    expect(result.success).toBe(true);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("[createRoleAction]"),
      expect.objectContaining({ actionKey: "org.role.created", error: expect.any(Error) })
    );
    consoleErrorSpy.mockRestore();
  });

  it("createBranchAction returns success even when emit throws", async () => {
    vi.mocked(OrgBranchesService.createBranch).mockResolvedValue({
      success: true,
      data: {
        id: BRANCH_ID,
        name: "Warsaw",
        organization_id: ORG_ID,
        slug: null,
        created_at: null,
        deleted_at: null,
      },
    });
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await createBranchAction({ name: "Warsaw" });

    expect(result.success).toBe(true);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("[createBranchAction]"),
      expect.objectContaining({ actionKey: "org.branch.created", error: expect.any(Error) })
    );
    consoleErrorSpy.mockRestore();
  });

  it("updateOrgProfileAction returns success even when emit returns { success: false }", async () => {
    // updateOrgProfileAction uses typed result pattern — eventService.emit never throws,
    // so we test the { success: false } typed-failure path (not a thrown exception)
    vi.mocked(eventService.emit).mockResolvedValue({
      success: false,
      error: "Event insert failed: DB down",
    });
    vi.mocked(OrgProfileService.updateProfile).mockResolvedValue({
      success: true,
      data: { name: "NewName" } as any,
    });
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await updateOrgProfileAction({ name: "NewName" });

    expect(result.success).toBe(true);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("[updateOrgProfileAction]"),
      expect.objectContaining({
        actionKey: "org.updated",
        error: "Event insert failed: DB down",
      })
    );
    consoleErrorSpy.mockRestore();
  });

  it("cancelInvitationAction returns success even when emit throws", async () => {
    mockFromChain.mockReturnValue(singleTableQuery({ email: "invited@example.com" }));
    vi.mocked(OrgInvitationsService.cancelInvitation).mockResolvedValue({
      success: true,
      data: undefined,
    });
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await cancelInvitationAction({ invitationId: INV_ID });

    expect(result.success).toBe(true);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("[cancelInvitationAction]"),
      expect.objectContaining({ actionKey: "org.invitation.cancelled", error: expect.any(Error) })
    );
    consoleErrorSpy.mockRestore();
  });

  it("createOrganizationAction returns success even when both emit calls throw", async () => {
    const mockRpc = vi.fn().mockResolvedValue({
      data: { success: true, organization_id: ORG_ID },
      error: null,
    });
    const { createClient } = await import("@/utils/supabase/server");
    vi.mocked(createClient).mockResolvedValue({
      from: mockFromChain,
      auth: { getUser: mockAuthGetUser },
      rpc: mockRpc,
    } as any);
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { createOrganizationAction } = await import("@/app/actions/onboarding/index");
    const result = await createOrganizationAction("Test Org", "Main Branch", null);

    expect(result.success).toBe(true);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("[createOrganizationAction]"),
      expect.objectContaining({ error: expect.any(Error) })
    );
    consoleErrorSpy.mockRestore();
  });

  it("requestId correlation is preserved when emit succeeds after failure recovery", async () => {
    // Reset emit to succeed for this specific test to verify requestId still propagates
    vi.mocked(eventService.emit).mockResolvedValue({ success: true, data: { id: "event-id" } });

    const mockRpc = vi.fn().mockResolvedValue({
      data: { success: true, organization_id: ORG_ID },
      error: null,
    });
    const { createClient } = await import("@/utils/supabase/server");
    vi.mocked(createClient).mockResolvedValue({
      from: mockFromChain,
      auth: { getUser: mockAuthGetUser },
      rpc: mockRpc,
    } as any);

    const { createOrganizationAction } = await import("@/app/actions/onboarding/index");
    await createOrganizationAction("Org B", "Branch B", null);

    const emitCalls = vi.mocked(eventService.emit).mock.calls.map((c) => c[0]);
    const createdCall = emitCalls.find((c) => c.actionKey === "org.created");
    const onboardedCall = emitCalls.find((c) => c.actionKey === "org.onboarding.completed");

    expect(createdCall?.requestId).toBeTruthy();
    expect(createdCall?.requestId).toBe(onboardedCall?.requestId);
  });
});

// ---------------------------------------------------------------------------
// T-REGISTRY-VISIBILITY: personal scope now surfaces actor-owned org events
// ---------------------------------------------------------------------------

import { projectEvents } from "@/server/audit/projection";
import { getRegistryEntry } from "@/server/audit/event-registry";
import type { PlatformEventRow, ProjectionContext } from "@/server/audit/types";

const VIEWER_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const OTHER_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const TEST_ORG_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc";

function makeOrgRow(
  actionKey: string,
  actorUserId: string,
  overrides: Partial<PlatformEventRow> = {}
): PlatformEventRow {
  return {
    id: "evt-" + actionKey,
    created_at: "2026-03-14T10:00:00.000Z",
    organization_id: TEST_ORG_ID,
    branch_id: null,
    actor_user_id: actorUserId,
    actor_type: "user",
    module_slug: "organization-management",
    action_key: actionKey,
    entity_type: "organization",
    entity_id: TEST_ORG_ID,
    target_type: null,
    target_id: null,
    metadata: {},
    event_tier: "baseline",
    request_id: null,
    ip_address: null,
    user_agent: null,
    ...overrides,
  };
}

function makePersonalContext(viewerUserId: string): ProjectionContext {
  return {
    viewerUserId,
    viewerScope: "personal",
    organizationId: TEST_ORG_ID,
    permissions: [],
  };
}

function makeOrgContext(viewerUserId: string): ProjectionContext {
  return {
    viewerUserId,
    viewerScope: "org",
    organizationId: TEST_ORG_ID,
    permissions: [],
  };
}

function makeAuditContext(viewerUserId: string): ProjectionContext {
  return {
    viewerUserId,
    viewerScope: "audit",
    organizationId: TEST_ORG_ID,
    permissions: [],
  };
}

describe("T-REGISTRY-VISIBILITY: personal scope now surfaces actor-owned org events", () => {
  it("all 15 org event action keys have 'self' in visibleTo", () => {
    const orgEventKeys = [
      "org.created",
      "org.updated",
      "org.member.invited",
      "org.member.removed",
      "org.invitation.accepted",
      "org.invitation.cancelled",
      "org.role.created",
      "org.role.updated",
      "org.role.deleted",
      "org.member.role_assigned",
      "org.member.role_removed",
      "org.branch.created",
      "org.branch.updated",
      "org.branch.deleted",
      "org.onboarding.completed",
    ];

    for (const key of orgEventKeys) {
      const entry = getRegistryEntry(key);
      expect(entry, `Registry entry missing for ${key}`).toBeDefined();
      expect(entry!.visibleTo, `${key} must include "self" in visibleTo`).toContain("self");
    }
  });

  it("personal scope shows org.updated when actor is the viewer", () => {
    const row = makeOrgRow("org.updated", VIEWER_ID);
    const result = projectEvents({
      events: [row],
      context: makePersonalContext(VIEWER_ID),
    });
    expect(result.total).toBe(1);
    expect(result.events[0].action_key).toBe("org.updated");
  });

  it("personal scope hides org.updated when actor is a different user", () => {
    const row = makeOrgRow("org.updated", OTHER_ID);
    const result = projectEvents({
      events: [row],
      context: makePersonalContext(VIEWER_ID),
    });
    expect(result.total).toBe(0);
  });

  it("personal scope shows org.member.invited when actor is the viewer", () => {
    const row = makeOrgRow("org.member.invited", VIEWER_ID, {
      event_tier: "enhanced",
      metadata: { invitee_email: "invite@example.com" },
    });
    const result = projectEvents({
      events: [row],
      context: makePersonalContext(VIEWER_ID),
    });
    expect(result.total).toBe(1);
  });

  it("personal scope shows org.branch.created when actor is the viewer", () => {
    const row = makeOrgRow("org.branch.created", VIEWER_ID, {
      metadata: { branch_name: "Test Branch" },
    });
    const result = projectEvents({
      events: [row],
      context: makePersonalContext(VIEWER_ID),
    });
    expect(result.total).toBe(1);
  });

  it("org scope shows org.updated for any viewer in the org", () => {
    const row = makeOrgRow("org.updated", OTHER_ID);
    const result = projectEvents({
      events: [row],
      context: makeOrgContext(VIEWER_ID),
    });
    expect(result.total).toBe(1);
  });

  it("org scope shows org.created for any viewer in the org", () => {
    const row = makeOrgRow("org.created", OTHER_ID);
    const result = projectEvents({
      events: [row],
      context: makeOrgContext(VIEWER_ID),
    });
    expect(result.total).toBe(1);
  });

  it("audit scope shows all org events regardless of actor", () => {
    const rows = [
      makeOrgRow("org.updated", OTHER_ID),
      makeOrgRow("org.member.invited", OTHER_ID, {
        event_tier: "enhanced",
        metadata: { invitee_email: "x@y.com" },
      }),
      makeOrgRow("org.role.deleted", OTHER_ID, { event_tier: "enhanced" }),
    ];
    const result = projectEvents({
      events: rows,
      context: makeAuditContext(VIEWER_ID),
    });
    expect(result.total).toBe(3);
  });

  it("audit scope preserves sensitive fields in metadata", () => {
    const row = makeOrgRow("org.member.invited", OTHER_ID, {
      event_tier: "enhanced",
      metadata: { invitee_email: "secret@example.com", invitee_first_name: "Alice" },
    });
    const auditResult = projectEvents({
      events: [row],
      context: makeAuditContext(VIEWER_ID),
    });
    expect(auditResult.events[0].metadata).toHaveProperty("invitee_email", "secret@example.com");
    expect(auditResult.events[0].metadata).toHaveProperty("invitee_first_name", "Alice");
  });

  it("personal scope strips sensitive fields from org.member.invited metadata", () => {
    const row = makeOrgRow("org.member.invited", VIEWER_ID, {
      event_tier: "enhanced",
      metadata: { invitee_email: "secret@example.com", invitee_first_name: "Alice" },
    });
    const personalResult = projectEvents({
      events: [row],
      context: makePersonalContext(VIEWER_ID),
    });
    expect(personalResult.total).toBe(1);
    expect(personalResult.events[0].metadata).not.toHaveProperty("invitee_email");
    expect(personalResult.events[0].metadata).not.toHaveProperty("invitee_first_name");
  });

  it("personal scope does not include ip_address or user_agent", () => {
    const row = makeOrgRow("org.updated", VIEWER_ID, {
      ip_address: "1.2.3.4",
      user_agent: "Mozilla/5.0",
    });
    const result = projectEvents({
      events: [row],
      context: makePersonalContext(VIEWER_ID),
    });
    expect(result.events[0].ip_address).toBeUndefined();
    expect(result.events[0].user_agent).toBeUndefined();
  });

  it("audit scope includes ip_address and user_agent", () => {
    const row = makeOrgRow("org.updated", VIEWER_ID, {
      ip_address: "1.2.3.4",
      user_agent: "Mozilla/5.0",
    });
    const result = projectEvents({
      events: [row],
      context: makeAuditContext(VIEWER_ID),
    });
    expect(result.events[0].ip_address).toBe("1.2.3.4");
    expect(result.events[0].user_agent).toBe("Mozilla/5.0");
  });
});
