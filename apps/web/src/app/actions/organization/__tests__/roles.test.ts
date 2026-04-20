/**
 * @vitest-environment node
 *
 * Covers remaining gap paths in roles.ts not tested by actions.test.ts
 * or actions-success.test.ts:
 *   - "No active organization" early-return for every action
 *   - Unexpected error (catch block) for select actions
 *
 * The bulk of role action coverage already lives in:
 *   - actions.test.ts          (permission guards, branch-role validation)
 *   - actions-success.test.ts  (happy paths, event emission, service errors)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoist mocks ──────────────────────────────────────────────────────────────

const {
  mockCreateClient,
  mockLoadDashboardContextV2,
  mockRequireModuleAccess,
  mockMapEntitlementError,
} = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
  mockLoadDashboardContextV2: vi.fn(),
  mockRequireModuleAccess: vi.fn().mockResolvedValue(undefined),
  mockMapEntitlementError: vi.fn().mockReturnValue(null),
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
vi.mock("@/server/services/event.service", () => ({
  eventService: { emit: vi.fn().mockResolvedValue({ success: true }) },
}));

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

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const VALID_UUID = "00000000-0000-0000-0000-000000000001";
const VALID_UUID_2 = "00000000-0000-0000-0000-000000000002";

const CTX_NO_ORG = {
  app: { activeOrgId: null },
  user: {
    user: { id: "user-1" },
    permissionSnapshot: { allow: [], deny: [] },
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireModuleAccess.mockResolvedValue(undefined);
  mockMapEntitlementError.mockReturnValue(null);
  mockLoadDashboardContextV2.mockResolvedValue(CTX_NO_ORG);
  mockCreateClient.mockResolvedValue({});
});

// ─── "No active organization" guard for every exported action ─────────────────

describe("listRolesAction", () => {
  it("returns error when no active organization", async () => {
    const result = await listRolesAction();
    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toBe("No active organization");
  });
});

describe("createRoleAction", () => {
  it("returns error when no active organization", async () => {
    const result = await createRoleAction({
      name: "Manager",
      scope_type: "org",
      permission_slugs: [],
    });
    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toBe("No active organization");
  });
});

describe("updateRoleAction", () => {
  it("returns error when no active organization", async () => {
    const result = await updateRoleAction({ roleId: VALID_UUID, name: "Updated" });
    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toBe("No active organization");
  });
});

describe("deleteRoleAction", () => {
  it("returns error when no active organization", async () => {
    const result = await deleteRoleAction({ roleId: VALID_UUID });
    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toBe("No active organization");
  });
});

describe("assignRoleToUserAction", () => {
  it("returns error when no active organization", async () => {
    const result = await assignRoleToUserAction({
      userId: VALID_UUID,
      roleId: VALID_UUID_2,
      scope: "org",
    });
    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toBe("No active organization");
  });
});

describe("removeRoleFromUserAction", () => {
  it("returns error when no active organization", async () => {
    const result = await removeRoleFromUserAction({
      userId: VALID_UUID,
      roleId: VALID_UUID_2,
      scope: "org",
    });
    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toBe("No active organization");
  });
});

describe("getUserRoleAssignmentsAction", () => {
  it("returns error when no active organization", async () => {
    const result = await getUserRoleAssignmentsAction({ userId: VALID_UUID });
    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toBe("No active organization");
  });
});

describe("getMemberAccessAction", () => {
  it("returns error when no active organization", async () => {
    const result = await getMemberAccessAction({ userId: VALID_UUID });
    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toBe("No active organization");
  });
});

// ─── Unexpected error path (catch block) ─────────────────────────────────────

describe("Unexpected error catch path", () => {
  it("listRolesAction returns Unexpected error when loadDashboardContextV2 throws", async () => {
    mockLoadDashboardContextV2.mockRejectedValue(new Error("context load failed"));

    const result = await listRolesAction();
    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toBe("Unexpected error");
  });

  it("createRoleAction returns Unexpected error when context throws", async () => {
    mockLoadDashboardContextV2.mockRejectedValue(new Error("context load failed"));

    const result = await createRoleAction({ name: "X", scope_type: "org", permission_slugs: [] });
    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toBe("Unexpected error");
  });
});
