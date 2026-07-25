/**
 * @vitest-environment node
 *
 * Tests: positions server actions
 *
 * Covers all exported actions from actions/organization/positions.ts:
 * - listPositionsAction
 * - listPositionAssignmentsAction
 * - createPositionAction
 * - updatePositionAction
 * - deletePositionAction
 * - assignPositionAction
 * - removePositionAssignmentAction
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock setup ───────────────────────────────────────────────────────────────

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
      user: { id: "user-123" },
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

vi.mock("@/server/services/organization.service", () => ({
  OrgPositionsService: {
    listPositions: vi.fn(),
    listAssignmentsForOrg: vi.fn(),
    createPosition: vi.fn(),
    updatePosition: vi.fn(),
    deletePosition: vi.fn(),
    assignPosition: vi.fn(),
    removeAssignment: vi.fn(),
  },
}));

import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { mapEntitlementError } from "@/server/guards/entitlements-guards";
import { OrgPositionsService } from "@/server/services/organization.service";

import {
  listPositionsAction,
  listPositionAssignmentsAction,
  createPositionAction,
  updatePositionAction,
  deletePositionAction,
  assignPositionAction,
  removePositionAssignmentAction,
} from "../positions";

// ─── Context presets ──────────────────────────────────────────────────────────

const CTX_NO_PERM = {
  app: { activeOrgId: "org-123" },
  user: {
    user: { id: "user-123" },
    permissionSnapshot: { allow: [], deny: [] },
  },
};

const CTX_NO_ORG = {
  app: { activeOrgId: null },
  user: {
    user: { id: "user-123" },
    permissionSnapshot: {
      allow: ["module.organization-management.access", "members.*", "members.manage"],
      deny: [],
    },
  },
};

const CTX_MODULE_ACCESS_MEMBERS_READ = {
  app: { activeOrgId: "org-123" },
  user: {
    user: { id: "user-123" },
    permissionSnapshot: {
      allow: ["module.organization-management.access", "members.read"],
      deny: [],
    },
  },
};

const CTX_FULL = {
  app: { activeOrgId: "org-123" },
  user: {
    user: { id: "user-123" },
    permissionSnapshot: {
      allow: ["module.organization-management.access", "members.read", "members.manage"],
      deny: [],
    },
  },
};

const CTX_NO_MODULE_ACCESS = {
  app: { activeOrgId: "org-123" },
  user: {
    user: { id: "user-123" },
    permissionSnapshot: {
      allow: ["members.read", "members.manage"],
      deny: [],
    },
  },
};

function setCtx(ctx: unknown) {
  (loadDashboardContextV2 as ReturnType<typeof vi.fn>).mockResolvedValue(ctx);
}

// ─── listPositionsAction ──────────────────────────────────────────────────────

describe("listPositionsAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setCtx(CTX_NO_PERM);
  });

  it("returns Unauthorized when module access permission is missing", async () => {
    setCtx(CTX_NO_MODULE_ACCESS);
    const result = await listPositionsAction();
    expect(result).toEqual({ success: false, error: "Unauthorized" });
    expect(OrgPositionsService.listPositions).not.toHaveBeenCalled();
  });

  it("returns Unauthorized when members.read permission is missing", async () => {
    setCtx(CTX_NO_PERM);
    const result = await listPositionsAction();
    expect(result).toEqual({ success: false, error: "Unauthorized" });
    expect(OrgPositionsService.listPositions).not.toHaveBeenCalled();
  });

  it("returns No active organization when activeOrgId is null", async () => {
    setCtx(CTX_NO_ORG);
    const result = await listPositionsAction();
    expect(result).toEqual({ success: false, error: "No active organization" });
    expect(OrgPositionsService.listPositions).not.toHaveBeenCalled();
  });

  it("calls service and returns result when permissions are met", async () => {
    setCtx(CTX_MODULE_ACCESS_MEMBERS_READ);
    (OrgPositionsService.listPositions as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: [{ id: "pos-1", name: "Manager" }],
    });
    const result = await listPositionsAction();
    expect(result).toEqual({ success: true, data: [{ id: "pos-1", name: "Manager" }] });
    expect(OrgPositionsService.listPositions).toHaveBeenCalledOnce();
  });

  it("returns mapped entitlement error when entitlements guard throws", async () => {
    setCtx(CTX_MODULE_ACCESS_MEMBERS_READ);
    const { entitlements } = await import("@/server/guards/entitlements-guards");
    (entitlements.requireModuleAccess as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("module locked")
    );
    (mapEntitlementError as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      message: "Module not available",
    });
    const result = await listPositionsAction();
    expect(result).toEqual({ success: false, error: "Module not available" });
  });

  it("returns Unexpected error on unhandled throw", async () => {
    setCtx(CTX_MODULE_ACCESS_MEMBERS_READ);
    (OrgPositionsService.listPositions as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("db crash")
    );
    const result = await listPositionsAction();
    expect(result).toEqual({ success: false, error: "Unexpected error" });
  });
});

// ─── listPositionAssignmentsAction ────────────────────────────────────────────

describe("listPositionAssignmentsAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setCtx(CTX_NO_PERM);
  });

  it("returns Unauthorized when module access permission is missing", async () => {
    setCtx(CTX_NO_MODULE_ACCESS);
    const result = await listPositionAssignmentsAction();
    expect(result).toEqual({ success: false, error: "Unauthorized" });
    expect(OrgPositionsService.listAssignmentsForOrg).not.toHaveBeenCalled();
  });

  it("returns Unauthorized when members.read permission is missing", async () => {
    setCtx(CTX_NO_PERM);
    const result = await listPositionAssignmentsAction();
    expect(result).toEqual({ success: false, error: "Unauthorized" });
    expect(OrgPositionsService.listAssignmentsForOrg).not.toHaveBeenCalled();
  });

  it("returns No active organization when activeOrgId is null", async () => {
    setCtx(CTX_NO_ORG);
    const result = await listPositionAssignmentsAction();
    expect(result).toEqual({ success: false, error: "No active organization" });
    expect(OrgPositionsService.listAssignmentsForOrg).not.toHaveBeenCalled();
  });

  it("calls service and returns result when permissions are met", async () => {
    setCtx(CTX_MODULE_ACCESS_MEMBERS_READ);
    (OrgPositionsService.listAssignmentsForOrg as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: [{ id: "asgn-1", user_id: "user-1", position_id: "pos-1" }],
    });
    const result = await listPositionAssignmentsAction();
    expect(result).toEqual({
      success: true,
      data: [{ id: "asgn-1", user_id: "user-1", position_id: "pos-1" }],
    });
    expect(OrgPositionsService.listAssignmentsForOrg).toHaveBeenCalledOnce();
  });

  it("returns mapped entitlement error on guard throw", async () => {
    setCtx(CTX_MODULE_ACCESS_MEMBERS_READ);
    const { entitlements } = await import("@/server/guards/entitlements-guards");
    (entitlements.requireModuleAccess as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("locked")
    );
    (mapEntitlementError as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      message: "Entitlement error",
    });
    const result = await listPositionAssignmentsAction();
    expect(result).toEqual({ success: false, error: "Entitlement error" });
  });

  it("returns Unexpected error on unhandled throw", async () => {
    setCtx(CTX_MODULE_ACCESS_MEMBERS_READ);
    (OrgPositionsService.listAssignmentsForOrg as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("unexpected")
    );
    const result = await listPositionAssignmentsAction();
    expect(result).toEqual({ success: false, error: "Unexpected error" });
  });
});

// ─── createPositionAction ─────────────────────────────────────────────────────

describe("createPositionAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setCtx(CTX_FULL);
  });

  it("returns Unauthorized when module access is missing", async () => {
    setCtx(CTX_NO_MODULE_ACCESS);
    const result = await createPositionAction({ name: "Engineer" });
    expect(result).toEqual({ success: false, error: "Unauthorized" });
    expect(OrgPositionsService.createPosition).not.toHaveBeenCalled();
  });

  it("returns Unauthorized when members.manage is missing", async () => {
    setCtx(CTX_MODULE_ACCESS_MEMBERS_READ);
    const result = await createPositionAction({ name: "Engineer" });
    expect(result).toEqual({ success: false, error: "Unauthorized" });
    expect(OrgPositionsService.createPosition).not.toHaveBeenCalled();
  });

  it("returns No active organization when activeOrgId is null", async () => {
    setCtx(CTX_NO_ORG);
    const result = await createPositionAction({ name: "Engineer" });
    expect(result).toEqual({ success: false, error: "No active organization" });
    expect(OrgPositionsService.createPosition).not.toHaveBeenCalled();
  });

  it("returns validation error when name is empty string", async () => {
    const result = await createPositionAction({ name: "" });
    expect(result).toMatchObject({ success: false });
    expect(OrgPositionsService.createPosition).not.toHaveBeenCalled();
  });

  it("returns validation error when name exceeds 100 chars", async () => {
    const result = await createPositionAction({ name: "a".repeat(101) });
    expect(result).toMatchObject({ success: false });
    expect(OrgPositionsService.createPosition).not.toHaveBeenCalled();
  });

  it("returns validation error when description exceeds 300 chars", async () => {
    const result = await createPositionAction({ name: "Engineer", description: "x".repeat(301) });
    expect(result).toMatchObject({ success: false });
    expect(OrgPositionsService.createPosition).not.toHaveBeenCalled();
  });

  it("returns validation error when rawInput is missing required fields", async () => {
    const result = await createPositionAction({});
    expect(result).toMatchObject({ success: false });
    expect(OrgPositionsService.createPosition).not.toHaveBeenCalled();
  });

  it("calls service with correct args when valid", async () => {
    (OrgPositionsService.createPosition as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: { id: "pos-new-1", name: "Engineer" },
    });
    const result = await createPositionAction({ name: "Engineer", description: "Builds things" });
    expect(result).toEqual({ success: true, data: { id: "pos-new-1", name: "Engineer" } });
    expect(OrgPositionsService.createPosition).toHaveBeenCalledWith(
      expect.anything(),
      "org-123",
      "user-123",
      { name: "Engineer", description: "Builds things" }
    );
  });

  it("calls service with null description", async () => {
    (OrgPositionsService.createPosition as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: { id: "pos-new-2", name: "Designer" },
    });
    const result = await createPositionAction({ name: "Designer", description: null });
    expect(result).toMatchObject({ success: true });
    expect(OrgPositionsService.createPosition).toHaveBeenCalledOnce();
  });

  it("returns Unexpected error on unhandled throw", async () => {
    (OrgPositionsService.createPosition as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("network fail")
    );
    const result = await createPositionAction({ name: "Engineer" });
    expect(result).toEqual({ success: false, error: "Unexpected error" });
  });
});

// ─── updatePositionAction ─────────────────────────────────────────────────────

describe("updatePositionAction", () => {
  const VALID_UUID = "00000000-0000-0000-0000-000000000001";

  beforeEach(() => {
    vi.clearAllMocks();
    setCtx(CTX_FULL);
  });

  it("returns Unauthorized when module access is missing", async () => {
    setCtx(CTX_NO_MODULE_ACCESS);
    const result = await updatePositionAction({ positionId: VALID_UUID, name: "Updated" });
    expect(result).toEqual({ success: false, error: "Unauthorized" });
    expect(OrgPositionsService.updatePosition).not.toHaveBeenCalled();
  });

  it("returns Unauthorized when members.manage is missing", async () => {
    setCtx(CTX_MODULE_ACCESS_MEMBERS_READ);
    const result = await updatePositionAction({ positionId: VALID_UUID, name: "Updated" });
    expect(result).toEqual({ success: false, error: "Unauthorized" });
    expect(OrgPositionsService.updatePosition).not.toHaveBeenCalled();
  });

  it("returns No active organization when activeOrgId is null", async () => {
    setCtx(CTX_NO_ORG);
    const result = await updatePositionAction({ positionId: VALID_UUID, name: "Updated" });
    expect(result).toEqual({ success: false, error: "No active organization" });
    expect(OrgPositionsService.updatePosition).not.toHaveBeenCalled();
  });

  it("returns validation error when positionId is not a valid UUID", async () => {
    const result = await updatePositionAction({ positionId: "not-a-uuid", name: "Updated" });
    expect(result).toMatchObject({ success: false });
    expect(OrgPositionsService.updatePosition).not.toHaveBeenCalled();
  });

  it("returns validation error when positionId is missing", async () => {
    const result = await updatePositionAction({ name: "Updated" });
    expect(result).toMatchObject({ success: false });
    expect(OrgPositionsService.updatePosition).not.toHaveBeenCalled();
  });

  it("returns validation error when name is empty string", async () => {
    const result = await updatePositionAction({ positionId: VALID_UUID, name: "" });
    expect(result).toMatchObject({ success: false });
    expect(OrgPositionsService.updatePosition).not.toHaveBeenCalled();
  });

  it("calls service with correct args on valid input", async () => {
    (OrgPositionsService.updatePosition as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: { id: VALID_UUID, name: "Updated" },
    });
    const result = await updatePositionAction({
      positionId: VALID_UUID,
      name: "Updated",
      description: "New desc",
    });
    expect(result).toEqual({ success: true, data: { id: VALID_UUID, name: "Updated" } });
    expect(OrgPositionsService.updatePosition).toHaveBeenCalledWith(
      expect.anything(),
      VALID_UUID,
      "org-123",
      { name: "Updated", description: "New desc" }
    );
  });

  it("calls service with only description update", async () => {
    (OrgPositionsService.updatePosition as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: { id: VALID_UUID },
    });
    await updatePositionAction({ positionId: VALID_UUID, description: "Desc only" });
    expect(OrgPositionsService.updatePosition).toHaveBeenCalledWith(
      expect.anything(),
      VALID_UUID,
      "org-123",
      { description: "Desc only" }
    );
  });

  it("returns service result when service returns not found", async () => {
    (OrgPositionsService.updatePosition as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: false,
      error: "Not found",
    });
    const result = await updatePositionAction({ positionId: VALID_UUID, name: "X" });
    expect(result).toEqual({ success: false, error: "Not found" });
  });

  it("returns Unexpected error on unhandled throw", async () => {
    (OrgPositionsService.updatePosition as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("crash")
    );
    const result = await updatePositionAction({ positionId: VALID_UUID, name: "X" });
    expect(result).toEqual({ success: false, error: "Unexpected error" });
  });
});

// ─── deletePositionAction ─────────────────────────────────────────────────────

describe("deletePositionAction", () => {
  const VALID_UUID = "00000000-0000-0000-0000-000000000002";

  beforeEach(() => {
    vi.clearAllMocks();
    setCtx(CTX_FULL);
  });

  it("returns Unauthorized when module access is missing", async () => {
    setCtx(CTX_NO_MODULE_ACCESS);
    const result = await deletePositionAction({ positionId: VALID_UUID });
    expect(result).toEqual({ success: false, error: "Unauthorized" });
    expect(OrgPositionsService.deletePosition).not.toHaveBeenCalled();
  });

  it("returns Unauthorized when members.manage is missing", async () => {
    setCtx(CTX_MODULE_ACCESS_MEMBERS_READ);
    const result = await deletePositionAction({ positionId: VALID_UUID });
    expect(result).toEqual({ success: false, error: "Unauthorized" });
    expect(OrgPositionsService.deletePosition).not.toHaveBeenCalled();
  });

  it("returns No active organization when activeOrgId is null", async () => {
    setCtx(CTX_NO_ORG);
    const result = await deletePositionAction({ positionId: VALID_UUID });
    expect(result).toEqual({ success: false, error: "No active organization" });
    expect(OrgPositionsService.deletePosition).not.toHaveBeenCalled();
  });

  it("returns validation error when positionId is not a valid UUID", async () => {
    const result = await deletePositionAction({ positionId: "bad-id" });
    expect(result).toMatchObject({ success: false });
    expect(OrgPositionsService.deletePosition).not.toHaveBeenCalled();
  });

  it("returns validation error when positionId is missing", async () => {
    const result = await deletePositionAction({});
    expect(result).toMatchObject({ success: false });
    expect(OrgPositionsService.deletePosition).not.toHaveBeenCalled();
  });

  it("calls service with correct args on valid input", async () => {
    (OrgPositionsService.deletePosition as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
    });
    const result = await deletePositionAction({ positionId: VALID_UUID });
    expect(result).toEqual({ success: true });
    expect(OrgPositionsService.deletePosition).toHaveBeenCalledWith(
      expect.anything(),
      VALID_UUID,
      "org-123"
    );
  });

  it("returns Unexpected error on unhandled throw", async () => {
    (OrgPositionsService.deletePosition as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("crash")
    );
    const result = await deletePositionAction({ positionId: VALID_UUID });
    expect(result).toEqual({ success: false, error: "Unexpected error" });
  });
});

// ─── assignPositionAction ─────────────────────────────────────────────────────

describe("assignPositionAction", () => {
  const USER_UUID = "00000000-0000-0000-0000-000000000010";
  const POS_UUID = "00000000-0000-0000-0000-000000000020";
  const BRANCH_UUID = "00000000-0000-0000-0000-000000000030";

  beforeEach(() => {
    vi.clearAllMocks();
    setCtx(CTX_FULL);
  });

  it("returns Unauthorized when module access is missing", async () => {
    setCtx(CTX_NO_MODULE_ACCESS);
    const result = await assignPositionAction({ userId: USER_UUID, positionId: POS_UUID });
    expect(result).toEqual({ success: false, error: "Unauthorized" });
    expect(OrgPositionsService.assignPosition).not.toHaveBeenCalled();
  });

  it("returns Unauthorized when members.manage is missing", async () => {
    setCtx(CTX_MODULE_ACCESS_MEMBERS_READ);
    const result = await assignPositionAction({ userId: USER_UUID, positionId: POS_UUID });
    expect(result).toEqual({ success: false, error: "Unauthorized" });
    expect(OrgPositionsService.assignPosition).not.toHaveBeenCalled();
  });

  it("returns No active organization when activeOrgId is null", async () => {
    setCtx(CTX_NO_ORG);
    const result = await assignPositionAction({ userId: USER_UUID, positionId: POS_UUID });
    expect(result).toEqual({ success: false, error: "No active organization" });
    expect(OrgPositionsService.assignPosition).not.toHaveBeenCalled();
  });

  it("returns validation error when userId is missing", async () => {
    const result = await assignPositionAction({ positionId: POS_UUID });
    expect(result).toMatchObject({ success: false });
    expect(OrgPositionsService.assignPosition).not.toHaveBeenCalled();
  });

  it("returns validation error when positionId is not a valid UUID", async () => {
    const result = await assignPositionAction({ userId: USER_UUID, positionId: "bad-id" });
    expect(result).toMatchObject({ success: false });
    expect(OrgPositionsService.assignPosition).not.toHaveBeenCalled();
  });

  it("returns validation error when userId is not a valid UUID", async () => {
    const result = await assignPositionAction({ userId: "not-uuid", positionId: POS_UUID });
    expect(result).toMatchObject({ success: false });
    expect(OrgPositionsService.assignPosition).not.toHaveBeenCalled();
  });

  it("calls service with correct args without branchId", async () => {
    (OrgPositionsService.assignPosition as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: { id: "asgn-new-1" },
    });
    const result = await assignPositionAction({ userId: USER_UUID, positionId: POS_UUID });
    expect(result).toEqual({ success: true, data: { id: "asgn-new-1" } });
    expect(OrgPositionsService.assignPosition).toHaveBeenCalledWith(
      expect.anything(),
      "org-123",
      USER_UUID,
      POS_UUID,
      "user-123",
      undefined
    );
  });

  it("calls service with branchId when provided", async () => {
    (OrgPositionsService.assignPosition as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: { id: "asgn-new-2" },
    });
    await assignPositionAction({ userId: USER_UUID, positionId: POS_UUID, branchId: BRANCH_UUID });
    expect(OrgPositionsService.assignPosition).toHaveBeenCalledWith(
      expect.anything(),
      "org-123",
      USER_UUID,
      POS_UUID,
      "user-123",
      BRANCH_UUID
    );
  });

  it("calls service with null branchId when explicitly set to null", async () => {
    (OrgPositionsService.assignPosition as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: { id: "asgn-new-3" },
    });
    await assignPositionAction({ userId: USER_UUID, positionId: POS_UUID, branchId: null });
    expect(OrgPositionsService.assignPosition).toHaveBeenCalledWith(
      expect.anything(),
      "org-123",
      USER_UUID,
      POS_UUID,
      "user-123",
      null
    );
  });

  it("returns Unexpected error on unhandled throw", async () => {
    (OrgPositionsService.assignPosition as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("crash")
    );
    const result = await assignPositionAction({ userId: USER_UUID, positionId: POS_UUID });
    expect(result).toEqual({ success: false, error: "Unexpected error" });
  });
});

// ─── removePositionAssignmentAction ──────────────────────────────────────────

describe("removePositionAssignmentAction", () => {
  const ASGN_UUID = "00000000-0000-0000-0000-000000000099";

  beforeEach(() => {
    vi.clearAllMocks();
    setCtx(CTX_FULL);
  });

  it("returns Unauthorized when module access is missing", async () => {
    setCtx(CTX_NO_MODULE_ACCESS);
    const result = await removePositionAssignmentAction({ assignmentId: ASGN_UUID });
    expect(result).toEqual({ success: false, error: "Unauthorized" });
    expect(OrgPositionsService.removeAssignment).not.toHaveBeenCalled();
  });

  it("returns Unauthorized when members.manage is missing", async () => {
    setCtx(CTX_MODULE_ACCESS_MEMBERS_READ);
    const result = await removePositionAssignmentAction({ assignmentId: ASGN_UUID });
    expect(result).toEqual({ success: false, error: "Unauthorized" });
    expect(OrgPositionsService.removeAssignment).not.toHaveBeenCalled();
  });

  it("returns No active organization when activeOrgId is null", async () => {
    setCtx(CTX_NO_ORG);
    const result = await removePositionAssignmentAction({ assignmentId: ASGN_UUID });
    expect(result).toEqual({ success: false, error: "No active organization" });
    expect(OrgPositionsService.removeAssignment).not.toHaveBeenCalled();
  });

  it("returns validation error when assignmentId is not a valid UUID", async () => {
    const result = await removePositionAssignmentAction({ assignmentId: "not-uuid" });
    expect(result).toMatchObject({ success: false });
    expect(OrgPositionsService.removeAssignment).not.toHaveBeenCalled();
  });

  it("returns validation error when assignmentId is missing", async () => {
    const result = await removePositionAssignmentAction({});
    expect(result).toMatchObject({ success: false });
    expect(OrgPositionsService.removeAssignment).not.toHaveBeenCalled();
  });

  it("calls service with correct args on valid input", async () => {
    (OrgPositionsService.removeAssignment as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
    });
    const result = await removePositionAssignmentAction({ assignmentId: ASGN_UUID });
    expect(result).toEqual({ success: true });
    expect(OrgPositionsService.removeAssignment).toHaveBeenCalledWith(
      expect.anything(),
      ASGN_UUID,
      "org-123"
    );
  });

  it("passes service error through", async () => {
    (OrgPositionsService.removeAssignment as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: false,
      error: "Assignment not found",
    });
    const result = await removePositionAssignmentAction({ assignmentId: ASGN_UUID });
    expect(result).toEqual({ success: false, error: "Assignment not found" });
  });

  it("returns Unexpected error on unhandled throw", async () => {
    (OrgPositionsService.removeAssignment as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("crash")
    );
    const result = await removePositionAssignmentAction({ assignmentId: ASGN_UUID });
    expect(result).toEqual({ success: false, error: "Unexpected error" });
  });
});
