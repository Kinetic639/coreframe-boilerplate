/**
 * @vitest-environment node
 *
 * Covers gap paths in members.ts:
 *   - removeMemberAction: event emission, service error (not in actions-org-gaps.test.ts)
 *   - updateMemberStatusAction: service error path
 *
 * Auth / permission / validation guards for listMembers, updateMemberStatus, and
 * removeMemberAction are already covered in actions.test.ts and actions-org-gaps.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoist mocks ──────────────────────────────────────────────────────────────

const {
  mockCreateClient,
  mockLoadDashboardContextV2,
  mockRequireModuleAccess,
  mockMapEntitlementError,
  mockEventEmit,
  mockRemoveMember,
  mockUpdateMemberStatus,
} = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
  mockLoadDashboardContextV2: vi.fn(),
  mockRequireModuleAccess: vi.fn().mockResolvedValue(undefined),
  mockMapEntitlementError: vi.fn().mockReturnValue(null),
  mockEventEmit: vi.fn().mockResolvedValue({ success: true }),
  mockRemoveMember: vi.fn(),
  mockUpdateMemberStatus: vi.fn(),
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
  OrgMembersService: {
    listMembers: vi.fn(),
    updateMemberStatus: mockUpdateMemberStatus,
    removeMember: mockRemoveMember,
  },
}));
vi.mock("@/server/services/event.service", () => ({
  eventService: { emit: mockEventEmit },
}));

import { removeMemberAction, updateMemberStatusAction } from "../members";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ORG_ID = "org-456";
const USER_ID = "user-abc";
const TARGET_USER_ID = "00000000-0000-0000-0000-000000000099";

const CTX = {
  app: { activeOrgId: ORG_ID },
  user: {
    user: { id: USER_ID },
    permissionSnapshot: {
      allow: ["module.organization-management.access", "members.*"],
      deny: [],
    },
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireModuleAccess.mockResolvedValue(undefined);
  mockMapEntitlementError.mockReturnValue(null);
  mockEventEmit.mockResolvedValue({ success: true });
  mockLoadDashboardContextV2.mockResolvedValue(CTX);
  mockCreateClient.mockResolvedValue({});
});

// ─── removeMemberAction ───────────────────────────────────────────────────────

describe("removeMemberAction — event emission and service errors", () => {
  it("emits org.member.removed event on successful removal", async () => {
    mockRemoveMember.mockResolvedValue({ success: true, data: undefined });

    await removeMemberAction({ userId: TARGET_USER_ID });

    expect(mockEventEmit).toHaveBeenCalledWith(
      expect.objectContaining({
        actionKey: "org.member.removed",
        entityType: "user",
        entityId: TARGET_USER_ID,
        targetType: "user",
        targetId: TARGET_USER_ID,
        metadata: { removed_user_id: TARGET_USER_ID },
        eventTier: "enhanced",
      })
    );
  });

  it("returns success even when event emission fails", async () => {
    mockRemoveMember.mockResolvedValue({ success: true, data: undefined });
    mockEventEmit.mockResolvedValue({ success: false, error: "emit failed" });

    const result = await removeMemberAction({ userId: TARGET_USER_ID });
    expect(result.success).toBe(true);
  });

  it("returns service error when removeMember service fails", async () => {
    mockRemoveMember.mockResolvedValue({ success: false, error: "Member not found" });

    const result = await removeMemberAction({ userId: TARGET_USER_ID });

    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toBe("Member not found");
    expect(mockEventEmit).not.toHaveBeenCalled();
  });

  it("returns validation error for non-UUID userId", async () => {
    const result = await removeMemberAction({ userId: "not-a-uuid" });
    expect(result.success).toBe(false);
    expect(mockRemoveMember).not.toHaveBeenCalled();
  });

  it("passes orgId and userId to removeMember service", async () => {
    mockRemoveMember.mockResolvedValue({ success: true, data: undefined });

    await removeMemberAction({ userId: TARGET_USER_ID });

    expect(mockRemoveMember).toHaveBeenCalledWith(expect.anything(), ORG_ID, TARGET_USER_ID);
  });
});

// ─── updateMemberStatusAction ─────────────────────────────────────────────────

describe("updateMemberStatusAction — service error path", () => {
  it("returns service error when updateMemberStatus service fails", async () => {
    mockUpdateMemberStatus.mockResolvedValue({ success: false, error: "DB update error" });

    const result = await updateMemberStatusAction({
      userId: TARGET_USER_ID,
      status: "inactive",
    });

    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toBe("DB update error");
  });

  it("returns success when updateMemberStatus succeeds", async () => {
    mockUpdateMemberStatus.mockResolvedValue({ success: true, data: undefined });

    const result = await updateMemberStatusAction({
      userId: TARGET_USER_ID,
      status: "active",
    });

    expect(result.success).toBe(true);
  });
});
