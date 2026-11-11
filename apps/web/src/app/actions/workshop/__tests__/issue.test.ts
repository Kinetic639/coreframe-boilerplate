/**
 * @vitest-environment node
 *
 * Phase 10F — issue actions: permission gate, active-branch scoping of the
 * repair order, input validation, identity from server context.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const RO = "11111111-1111-4111-8111-111111111111";
const SRC = "22222222-2222-4222-8222-222222222222";
const ROL = "33333333-3333-4333-8333-333333333333";

const h = vi.hoisted(() => ({
  loadContext: vi.fn(),
  ro: { current: { id: "", branch_id: "branch-1" } as { id: string; branch_id: string } | null },
  issue: vi.fn(),
  list: vi.fn(),
}));

vi.mock("@/server/loaders/v2/load-dashboard-context.v2", () => ({
  loadDashboardContextV2: () => h.loadContext(),
}));
vi.mock("@/utils/supabase/server", () => ({
  createClient: () => {
    const chain: Record<string, unknown> = {};
    for (const m of ["select", "eq", "is"]) chain[m] = () => chain;
    chain.maybeSingle = () => Promise.resolve({ data: h.ro.current });
    return Promise.resolve({ from: () => chain });
  },
}));
vi.mock("@/server/services/repair-order-issue.service", () => ({
  RepairOrderIssueService: {
    issue: (...a: unknown[]) => h.issue(...a),
    listCandidates: (...a: unknown[]) => h.list(...a),
  },
}));

import { issueRepairOrderPartsAction, listRepairOrderIssueCandidatesAction } from "../issue";

function context(allow: string[]) {
  return {
    app: { activeOrgId: "org-1", activeBranchId: "branch-1" },
    user: { user: { id: "user-1" }, permissionSnapshot: { allow, deny: [] } },
  };
}

const input = {
  repairOrderId: RO,
  recipient: "Jan Kowalski",
  lines: [{ kind: "allocation", sourceId: SRC, repairOrderLineId: ROL, quantity: 1 }],
};

beforeEach(() => {
  vi.clearAllMocks();
  h.ro.current = { id: RO, branch_id: "branch-1" };
});

describe("issueRepairOrderPartsAction", () => {
  it("requires warehouse.inventory.operate", async () => {
    h.loadContext.mockResolvedValue(context(["warehouse.inventory.read"]));
    expect(await issueRepairOrderPartsAction(input)).toEqual({
      success: false,
      error: "unauthorized",
    });
    expect(h.issue).not.toHaveBeenCalled();
  });

  it("requires a recipient", async () => {
    h.loadContext.mockResolvedValue(context(["warehouse.inventory.operate"]));
    expect(await issueRepairOrderPartsAction({ ...input, recipient: "  " })).toEqual({
      success: false,
      error: "invalid_input",
    });
  });

  it("refuses a repair order of another branch", async () => {
    h.loadContext.mockResolvedValue(context(["warehouse.inventory.operate"]));
    h.ro.current = { id: RO, branch_id: "branch-2" };
    expect(await issueRepairOrderPartsAction(input)).toEqual({
      success: false,
      error: "not_found",
    });
    expect(h.issue).not.toHaveBeenCalled();
  });

  it("issues with org/branch/actor from server context", async () => {
    h.loadContext.mockResolvedValue(context(["warehouse.inventory.operate"]));
    h.issue.mockResolvedValue({
      success: true,
      data: { movementId: "mv", documentNumber: "RW/2026/000001", lineCount: 1 },
    });
    const result = await issueRepairOrderPartsAction(input);
    expect(h.issue).toHaveBeenCalledWith(expect.anything(), {
      actorUserId: "user-1",
      organizationId: "org-1",
      branchId: "branch-1",
      repairOrderId: RO,
      recipient: "Jan Kowalski",
      note: null,
      lines: [{ kind: "allocation", sourceId: SRC, repairOrderLineId: ROL, quantity: 1 }],
    });
    expect(result.success).toBe(true);
  });
});

describe("listRepairOrderIssueCandidatesAction", () => {
  it("requires warehouse.inventory.read", async () => {
    h.loadContext.mockResolvedValue(context([]));
    expect(await listRepairOrderIssueCandidatesAction(RO)).toEqual({
      success: false,
      error: "Unauthorized",
    });
  });

  it("lists for an order in the active branch", async () => {
    h.loadContext.mockResolvedValue(context(["warehouse.inventory.read"]));
    h.list.mockResolvedValue({ success: true, data: [] });
    expect(await listRepairOrderIssueCandidatesAction(RO)).toEqual({ success: true, data: [] });
  });
});
