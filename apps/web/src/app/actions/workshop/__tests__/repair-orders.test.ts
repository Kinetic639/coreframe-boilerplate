/**
 * @vitest-environment node
 *
 * Tests: app/actions/workshop/repair-orders.ts -- Phase 7 header/advisor/
 * lifecycle action layer. Mirrors the mocking convention already
 * established in ../../tools/__tests__/wdd-matcher-approval-actions.test.ts
 * (mock createClient / loadDashboardContextV2 / the service class; assert
 * on the ActionResult shape).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }),
    },
  }),
}));

vi.mock("@/server/loaders/v2/load-dashboard-context.v2", () => ({
  loadDashboardContextV2: vi.fn(),
}));

vi.mock("@/server/services/repair-orders.service", () => ({
  RepairOrdersService: {
    createRepairOrder: vi.fn(),
    updateHeader: vi.fn(),
    assignAdvisor: vi.fn(),
    changeStatus: vi.fn(),
    listAdvisorCandidates: vi.fn(),
    getOwnAdvisorContactId: vi.fn(),
  },
}));

import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { createClient } from "@/utils/supabase/server";
import { RepairOrdersService } from "@/server/services/repair-orders.service";

import {
  createRepairOrderAction,
  updateRepairOrderHeaderAction,
  assignRepairOrderAdvisorAction,
  changeRepairOrderStatusAction,
  listAdvisorCandidatesAction,
} from "../repair-orders";

const RO_ID = "11111111-1111-1111-1111-111111111111";
const CONTACT_SELF = "22222222-2222-2222-2222-222222222222";
const CONTACT_OTHER = "33333333-3333-3333-3333-333333333333";

const HEADER = {
  id: RO_ID,
  zlNumber: null,
  orderNumber: null,
  vin: null,
  status: "open",
  identityStatus: "unresolved",
  advisorContactId: null,
  advisorDisplayName: null,
  createdAt: "2026-09-11T00:00:00.000Z",
  updatedAt: "2026-09-11T00:00:00.000Z",
  vehicleBrand: null,
  clientName: null,
  dealerName: null,
  createdBy: "user-1",
};

const CTX_MANAGE_OWN = {
  app: { activeOrgId: "org-1", activeBranchId: "branch-1" },
  user: {
    user: { id: "user-1" },
    permissionSnapshot: { allow: ["workshop.repair_orders.manage_own"], deny: [] },
  },
};
const CTX_MANAGE_ALL = {
  app: { activeOrgId: "org-1", activeBranchId: "branch-1" },
  user: {
    user: { id: "user-1" },
    permissionSnapshot: { allow: ["workshop.repair_orders.manage_all"], deny: [] },
  },
};
const CTX_READ_ONLY = {
  app: { activeOrgId: "org-1", activeBranchId: "branch-1" },
  user: {
    user: { id: "user-1" },
    permissionSnapshot: { allow: ["workshop.repair_orders.read"], deny: [] },
  },
};
const CTX_NO_BRANCH = {
  app: { activeOrgId: "org-1", activeBranchId: null },
  user: {
    user: { id: "user-1" },
    permissionSnapshot: { allow: ["workshop.repair_orders.manage_own"], deny: [] },
  },
};

function setCtx(ctx: unknown) {
  vi.mocked(loadDashboardContextV2).mockResolvedValue(ctx as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }) },
  } as never);
  setCtx(CTX_MANAGE_ALL);
});

// ---------------------------------------------------------------------------
// createRepairOrderAction
// ---------------------------------------------------------------------------

describe("createRepairOrderAction", () => {
  it("succeeds for a manage_all caller and passes org/branch from trusted context, never from input", async () => {
    vi.mocked(RepairOrdersService.createRepairOrder).mockResolvedValue({
      success: true,
      data: HEADER as never,
    });

    const result = await createRepairOrderAction({ zl_number: "ZL/1" });

    expect(result.success).toBe(true);
    expect(RepairOrdersService.createRepairOrder).toHaveBeenCalledWith(
      expect.anything(),
      "org-1",
      "branch-1",
      "user-1",
      expect.objectContaining({ zl_number: "ZL/1" })
    );
  });

  it("rejects with Unauthenticated when there is no user", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
    } as never);

    const result = await createRepairOrderAction({});
    expect(result).toEqual({ success: false, error: "Unauthenticated" });
    expect(RepairOrdersService.createRepairOrder).not.toHaveBeenCalled();
  });

  it("rejects with Unauthorized when the caller has neither manage_own nor manage_all", async () => {
    setCtx(CTX_READ_ONLY);
    const result = await createRepairOrderAction({});
    expect(result).toEqual({ success: false, error: "Unauthorized" });
    expect(RepairOrdersService.createRepairOrder).not.toHaveBeenCalled();
  });

  it("rejects with a clear error when there is no active branch (branch_id is NOT NULL at the DB layer)", async () => {
    setCtx(CTX_NO_BRANCH);
    const result = await createRepairOrderAction({});
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toMatch(/branch/i);
    expect(RepairOrdersService.createRepairOrder).not.toHaveBeenCalled();
  });

  it("a manage_own-only caller CAN set advisor_contact_id to their OWN linked contact", async () => {
    setCtx(CTX_MANAGE_OWN);
    vi.mocked(RepairOrdersService.getOwnAdvisorContactId).mockResolvedValue({
      success: true,
      data: CONTACT_SELF,
    });
    vi.mocked(RepairOrdersService.createRepairOrder).mockResolvedValue({
      success: true,
      data: HEADER as never,
    });

    const result = await createRepairOrderAction({ advisor_contact_id: CONTACT_SELF });

    expect(result.success).toBe(true);
    expect(RepairOrdersService.createRepairOrder).toHaveBeenCalled();
  });

  it("a manage_own-only caller CANNOT set advisor_contact_id to someone else's contact -- rejected before the service is ever called", async () => {
    setCtx(CTX_MANAGE_OWN);
    vi.mocked(RepairOrdersService.getOwnAdvisorContactId).mockResolvedValue({
      success: true,
      data: CONTACT_SELF,
    });

    const result = await createRepairOrderAction({ advisor_contact_id: CONTACT_OTHER });

    expect(result.success).toBe(false);
    expect(RepairOrdersService.createRepairOrder).not.toHaveBeenCalled();
  });

  it("a manage_all caller may set advisor_contact_id to any contact without the self-check", async () => {
    vi.mocked(RepairOrdersService.createRepairOrder).mockResolvedValue({
      success: true,
      data: HEADER as never,
    });

    const result = await createRepairOrderAction({ advisor_contact_id: CONTACT_OTHER });

    expect(result.success).toBe(true);
    expect(RepairOrdersService.getOwnAdvisorContactId).not.toHaveBeenCalled();
  });

  it("rejects malformed input before calling the service (zod validation)", async () => {
    const result = await createRepairOrderAction({ advisor_contact_id: "not-a-uuid" });
    expect(result.success).toBe(false);
    expect(RepairOrdersService.createRepairOrder).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// updateRepairOrderHeaderAction
// ---------------------------------------------------------------------------

describe("updateRepairOrderHeaderAction", () => {
  it("succeeds for a manage_own caller and strips id out of the patch payload", async () => {
    setCtx(CTX_MANAGE_OWN);
    vi.mocked(RepairOrdersService.updateHeader).mockResolvedValue({
      success: true,
      data: HEADER as never,
    });

    const result = await updateRepairOrderHeaderAction({ id: RO_ID, vin: "NEWVIN" });

    expect(result.success).toBe(true);
    expect(RepairOrdersService.updateHeader).toHaveBeenCalledWith(
      expect.anything(),
      "org-1",
      "branch-1",
      "user-1",
      RO_ID,
      { vin: "NEWVIN" }
    );
  });

  it("rejects with Unauthorized when the caller has neither manage_own nor manage_all", async () => {
    setCtx(CTX_READ_ONLY);
    const result = await updateRepairOrderHeaderAction({ id: RO_ID });
    expect(result).toEqual({ success: false, error: "Unauthorized" });
    expect(RepairOrdersService.updateHeader).not.toHaveBeenCalled();
  });

  it("propagates the service's not-found/not-authorized error unchanged", async () => {
    vi.mocked(RepairOrdersService.updateHeader).mockResolvedValue({
      success: false,
      error: "RepairOrder not found, wrong branch, or you are not authorized to edit it",
    });

    const result = await updateRepairOrderHeaderAction({ id: RO_ID, vin: "X" });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// assignRepairOrderAdvisorAction
// ---------------------------------------------------------------------------

describe("assignRepairOrderAdvisorAction", () => {
  it("succeeds for a manage_all caller", async () => {
    vi.mocked(RepairOrdersService.assignAdvisor).mockResolvedValue({
      success: true,
      data: HEADER as never,
    });

    const result = await assignRepairOrderAdvisorAction({
      id: RO_ID,
      advisorContactId: CONTACT_OTHER,
    });

    expect(result.success).toBe(true);
    expect(RepairOrdersService.assignAdvisor).toHaveBeenCalledWith(
      expect.anything(),
      "org-1",
      "branch-1",
      "user-1",
      RO_ID,
      CONTACT_OTHER
    );
  });

  it("rejects a manage_own-only caller -- reassignment is manage_all-only (matches RLS: manage_own's WITH CHECK can never actually succeed here)", async () => {
    setCtx(CTX_MANAGE_OWN);

    const result = await assignRepairOrderAdvisorAction({
      id: RO_ID,
      advisorContactId: CONTACT_OTHER,
    });

    expect(result).toEqual({ success: false, error: "Unauthorized" });
    expect(RepairOrdersService.assignAdvisor).not.toHaveBeenCalled();
  });

  it("allows clearing the advisor (null)", async () => {
    vi.mocked(RepairOrdersService.assignAdvisor).mockResolvedValue({
      success: true,
      data: HEADER as never,
    });

    const result = await assignRepairOrderAdvisorAction({ id: RO_ID, advisorContactId: null });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// changeRepairOrderStatusAction
// ---------------------------------------------------------------------------

describe("changeRepairOrderStatusAction", () => {
  it("succeeds for a legal open->closed transition by a manage_own caller", async () => {
    setCtx(CTX_MANAGE_OWN);
    vi.mocked(RepairOrdersService.changeStatus).mockResolvedValue({
      success: true,
      data: { ...HEADER, status: "closed" } as never,
    });

    const result = await changeRepairOrderStatusAction({
      id: RO_ID,
      fromStatus: "open",
      toStatus: "closed",
    });

    expect(result.success).toBe(true);
    expect(RepairOrdersService.changeStatus).toHaveBeenCalledWith(
      expect.anything(),
      "org-1",
      "branch-1",
      "user-1",
      RO_ID,
      "open",
      "closed"
    );
  });

  it("rejects open->archived for a manage_own-only caller BEFORE calling the service, using the existing canTransitionRepairOrderStatus domain rule", async () => {
    setCtx(CTX_MANAGE_OWN);

    const result = await changeRepairOrderStatusAction({
      id: RO_ID,
      fromStatus: "open",
      toStatus: "archived",
    });

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toMatch(/manage_all/i);
    expect(RepairOrdersService.changeStatus).not.toHaveBeenCalled();
  });

  it("allows open->archived for a manage_all caller", async () => {
    vi.mocked(RepairOrdersService.changeStatus).mockResolvedValue({
      success: true,
      data: { ...HEADER, status: "archived" } as never,
    });

    const result = await changeRepairOrderStatusAction({
      id: RO_ID,
      fromStatus: "open",
      toStatus: "archived",
    });

    expect(result.success).toBe(true);
  });

  it("rejects an illegal transition (archived->open) even for manage_all -- archived is terminal per the domain contract", async () => {
    const result = await changeRepairOrderStatusAction({
      id: RO_ID,
      fromStatus: "archived",
      toStatus: "open",
    });

    expect(result.success).toBe(false);
    expect(RepairOrdersService.changeStatus).not.toHaveBeenCalled();
  });

  it("rejects with Unauthorized when the caller has neither manage_own nor manage_all", async () => {
    setCtx(CTX_READ_ONLY);
    const result = await changeRepairOrderStatusAction({
      id: RO_ID,
      fromStatus: "open",
      toStatus: "closed",
    });
    expect(result).toEqual({ success: false, error: "Unauthorized" });
  });
});

// ---------------------------------------------------------------------------
// listAdvisorCandidatesAction
// ---------------------------------------------------------------------------

describe("listAdvisorCandidatesAction", () => {
  it("succeeds for a caller with at least read access", async () => {
    setCtx(CTX_READ_ONLY);
    vi.mocked(RepairOrdersService.listAdvisorCandidates).mockResolvedValue({
      success: true,
      data: [{ id: CONTACT_SELF, displayName: "Jane" }],
    });

    const result = await listAdvisorCandidatesAction();
    expect(result.success).toBe(true);
  });

  it("rejects with Unauthenticated when there is no user", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
    } as never);

    const result = await listAdvisorCandidatesAction();
    expect(result).toEqual({ success: false, error: "Unauthenticated" });
  });
});
