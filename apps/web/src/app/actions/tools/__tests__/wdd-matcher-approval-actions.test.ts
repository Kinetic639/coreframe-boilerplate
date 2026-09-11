/**
 * @vitest-environment node
 *
 * Tests: app/actions/tools/wdd-matcher.ts -- Phase 4/5 approval +
 * materialization orchestration actions.
 *
 * Zone 3 Repair Orders. Mirrors the existing mocking convention from
 * ../tools-actions.test.ts (mock createClient / loadDashboardContextV2 /
 * the relevant service classes; assert on the ActionResult shape).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ────────────────────────────────────────────────────────────────────

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

vi.mock("@/server/services/wdd-matcher.service", () => ({
  WddMatcherService: {
    approveSession: vi.fn(),
  },
}));

vi.mock("@/server/services/repair-orders.service", () => ({
  RepairOrdersService: {
    materializeFromSession: vi.fn(),
    getMaterializationStatusForSession: vi.fn(),
  },
}));

vi.mock("@/server/services/event.service", () => ({
  eventService: {
    emit: vi.fn().mockResolvedValue({ success: true, data: { id: "evt-1" } }),
  },
}));

import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { createClient } from "@/utils/supabase/server";
import { WddMatcherService } from "@/server/services/wdd-matcher.service";
import { RepairOrdersService } from "@/server/services/repair-orders.service";
import { eventService } from "@/server/services/event.service";

import {
  approveSessionAction,
  approveAndMaterializeSessionAction,
  retryMaterializationAction,
  getMaterializationStatusAction,
} from "../wdd-matcher";

// ─── Context helpers ──────────────────────────────────────────────────────────

const CTX_APPROVE = {
  app: { activeOrgId: "org-1", activeBranchId: "branch-1" },
  user: {
    permissionSnapshot: {
      allow: ["wdd_matcher.approve", "wdd_matcher.read", "workshop.repair_orders.read"],
      deny: [],
    },
  },
};
const CTX_NO_APPROVE = {
  app: { activeOrgId: "org-1", activeBranchId: "branch-1" },
  user: { permissionSnapshot: { allow: ["wdd_matcher.read"], deny: [] } },
};
// Finding B (corrective review): a caller with Matcher read access but
// WITHOUT the separate workshop.repair_orders.read permission that
// getMaterializationStatusAction's underlying query is actually RLS-gated
// by (see repair-orders.service.ts's getMaterializationStatusForSession
// doc comment) -- must be rejected, not silently read as "not
// materialized".
const CTX_MATCHER_READ_ONLY_NO_WORKSHOP_READ = {
  app: { activeOrgId: "org-1", activeBranchId: "branch-1" },
  user: { permissionSnapshot: { allow: ["wdd_matcher.read"], deny: [] } },
};

const APPROVED_SESSION = {
  id: "11111111-1111-1111-1111-111111111111",
  organization_id: "org-1",
  branch_id: "branch-1",
  status: "approved",
  approved_by: "user-1",
  approved_at: "2026-09-10T12:00:00.000Z",
  name: "Session 1",
  match_summary: null,
  created_by: "user-1",
  created_at: "2026-09-10T10:00:00.000Z",
  updated_at: "2026-09-10T12:00:00.000Z",
};

const MATERIALIZATION_RESULT = {
  sessionId: "11111111-1111-1111-1111-111111111111",
  createdRepairOrders: 2,
  reusedRepairOrders: 0,
  createdSourceDocuments: 2,
  reusedSourceDocuments: 0,
  createdSourceDocumentLines: 4,
  createdDocumentLinks: 2,
  createdLogicalLines: 3,
  createdLineLinks: 3,
  skippedNonPositiveQuantityLines: 0,
  alreadyMaterialized: false,
};

/**
 * `from` defaults to a chainable query builder resolving `{ data: null, error: null }`
 * for `.maybeSingle()` -- used by retryMaterializationAction's Finding D
 * (second pass) session-scope lookup on its failure path. Override via
 * `sessionScopeResult` to simulate the session actually being found.
 */
function resetCreateClient(
  sessionScopeResult: { data: unknown; error: unknown } = { data: null, error: null }
) {
  const fromChain: Record<string, unknown> = {};
  for (const m of ["select", "eq"]) {
    fromChain[m] = vi.fn().mockReturnValue(fromChain);
  }
  fromChain["maybeSingle"] = vi.fn().mockResolvedValue(sessionScopeResult);

  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }) },
    from: vi.fn().mockReturnValue(fromChain),
  } as never);
}

function setCtx(ctx: unknown) {
  vi.mocked(loadDashboardContextV2).mockResolvedValue(ctx as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  resetCreateClient();
  setCtx(CTX_APPROVE);
});

// ─── approveSessionAction (Phase 4) ────────────────────────────────────────────

describe("approveSessionAction", () => {
  it("succeeds and emits workshop.matcher_session.approved when permitted and the service call succeeds", async () => {
    vi.mocked(WddMatcherService.approveSession).mockResolvedValue({
      success: true,
      data: APPROVED_SESSION as never,
    });

    const result = await approveSessionAction({
      sessionId: "11111111-1111-1111-1111-111111111111",
    });

    expect(result.success).toBe(true);
    expect((result as { success: true; data: unknown }).data).toEqual(APPROVED_SESSION);
    expect(WddMatcherService.approveSession).toHaveBeenCalledWith(
      expect.anything(),
      "11111111-1111-1111-1111-111111111111",
      "org-1",
      "branch-1",
      "user-1"
    );
    expect(eventService.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        actionKey: "workshop.matcher_session.approved",
        actorType: "user",
        actorUserId: "user-1",
        organizationId: "org-1",
        branchId: "branch-1",
        entityType: "wdd_matcher_session",
        entityId: "11111111-1111-1111-1111-111111111111",
        metadata: expect.objectContaining({
          previousStatus: "ready_for_review",
          newStatus: "approved",
        }),
      })
    );
  });

  it("rejects with Unauthorized when the caller lacks wdd_matcher.approve", async () => {
    setCtx(CTX_NO_APPROVE);

    const result = await approveSessionAction({
      sessionId: "11111111-1111-1111-1111-111111111111",
    });

    expect(result).toEqual({ success: false, error: "Unauthorized" });
    expect(WddMatcherService.approveSession).not.toHaveBeenCalled();
  });

  it("rejects with Unauthenticated when there is no user", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
    } as never);

    const result = await approveSessionAction({
      sessionId: "11111111-1111-1111-1111-111111111111",
    });

    expect(result).toEqual({ success: false, error: "Unauthenticated" });
    expect(WddMatcherService.approveSession).not.toHaveBeenCalled();
  });

  it("rejects malformed input before calling the service (zod validation)", async () => {
    const result = await approveSessionAction({ sessionId: "not-a-uuid" });

    expect(result.success).toBe(false);
    expect(WddMatcherService.approveSession).not.toHaveBeenCalled();
  });

  it("propagates the service's SESSION_NOT_READY error unchanged (invalid state transition)", async () => {
    vi.mocked(WddMatcherService.approveSession).mockResolvedValue({
      success: false,
      error:
        "SESSION_NOT_READY: session not found, wrong branch, or not in ready_for_review status",
    });

    const result = await approveSessionAction({
      sessionId: "11111111-1111-1111-1111-111111111111",
    });

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toContain("SESSION_NOT_READY");
  });
});

// ─── approveAndMaterializeSessionAction (Phase 5) ──────────────────────────────

describe("approveAndMaterializeSessionAction", () => {
  it("approves then materializes; returns both results combined on full success", async () => {
    vi.mocked(WddMatcherService.approveSession).mockResolvedValue({
      success: true,
      data: APPROVED_SESSION as never,
    });
    vi.mocked(RepairOrdersService.materializeFromSession).mockResolvedValue({
      success: true,
      data: MATERIALIZATION_RESULT,
    });

    const result = await approveAndMaterializeSessionAction({
      sessionId: "11111111-1111-1111-1111-111111111111",
    });

    expect(result.success).toBe(true);
    const data = (result as { success: true; data: any }).data;
    expect(data.session).toEqual(APPROVED_SESSION);
    expect(data.materialization).toEqual(MATERIALIZATION_RESULT);
    expect(data.materializationError).toBeNull();
    expect(RepairOrdersService.materializeFromSession).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      "11111111-1111-1111-1111-111111111111"
    );
  });

  it("keeps the action 'successful' but reports materializationError when materialization fails (approval is not rolled back)", async () => {
    vi.mocked(WddMatcherService.approveSession).mockResolvedValue({
      success: true,
      data: APPROVED_SESSION as never,
    });
    vi.mocked(RepairOrdersService.materializeFromSession).mockResolvedValue({
      success: false,
      error: "Not authorized to materialize repair orders for this branch",
    });

    const result = await approveAndMaterializeSessionAction({
      sessionId: "11111111-1111-1111-1111-111111111111",
    });

    expect(result.success).toBe(true);
    const data = (result as { success: true; data: any }).data;
    expect(data.session).toEqual(APPROVED_SESSION);
    expect(data.materialization).toBeNull();
    expect(data.materializationError).toBe(
      "Not authorized to materialize repair orders for this branch"
    );
    expect(eventService.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        actionKey: "workshop.repair_orders.materialization_failed",
        entityId: "11111111-1111-1111-1111-111111111111",
        metadata: expect.objectContaining({ attempt: "initial" }),
        // Finding D (corrective review, CONFIRMED, fixed): this event
        // previously carried neither organizationId nor branchId at all on
        // this code path -- both must now be present, derived only from
        // the trusted server-loaded context (never client input).
        organizationId: "org-1",
        branchId: "branch-1",
      })
    );
  });

  it("returns the approval failure directly when approval itself fails, without attempting materialization", async () => {
    vi.mocked(WddMatcherService.approveSession).mockResolvedValue({
      success: false,
      error:
        "SESSION_NOT_READY: session not found, wrong branch, or not in ready_for_review status",
    });

    const result = await approveAndMaterializeSessionAction({
      sessionId: "11111111-1111-1111-1111-111111111111",
    });

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toContain("SESSION_NOT_READY");
    expect(RepairOrdersService.materializeFromSession).not.toHaveBeenCalled();
  });
});

// ─── retryMaterializationAction (Phase 5) ──────────────────────────────────────

describe("retryMaterializationAction", () => {
  it("calls the same idempotent materialization service on retry", async () => {
    vi.mocked(RepairOrdersService.materializeFromSession).mockResolvedValue({
      success: true,
      data: { ...MATERIALIZATION_RESULT, alreadyMaterialized: true, createdRepairOrders: 0 },
    });

    const result = await retryMaterializationAction("11111111-1111-1111-1111-111111111111");

    expect(result.success).toBe(true);
    expect(RepairOrdersService.materializeFromSession).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      "11111111-1111-1111-1111-111111111111"
    );
  });

  it("rejects when the caller lacks wdd_matcher.approve", async () => {
    setCtx(CTX_NO_APPROVE);

    const result = await retryMaterializationAction("11111111-1111-1111-1111-111111111111");

    expect(result).toEqual({ success: false, error: "Unauthorized" });
    expect(RepairOrdersService.materializeFromSession).not.toHaveBeenCalled();
  });

  it("emits a materialization_failed event with attempt='retry' when the retry itself fails, falling back to the active context's org/branch when the session-scope lookup finds nothing", async () => {
    // Default resetCreateClient() mock: the session-scope lookup resolves
    // { data: null }, so this exercises the fallback path.
    vi.mocked(RepairOrdersService.materializeFromSession).mockResolvedValue({
      success: false,
      error: "boom",
    });

    await retryMaterializationAction("11111111-1111-1111-1111-111111111111");

    expect(eventService.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        actionKey: "workshop.repair_orders.materialization_failed",
        metadata: expect.objectContaining({ attempt: "retry" }),
        organizationId: "org-1",
        branchId: "branch-1",
      })
    );
  });

  /**
   * Finding D (corrective review, second pass, CONFIRMED and fixed):
   * audit-event scope should describe the entity/action that actually
   * occurred, not merely where the caller happened to be browsing. A
   * retry's active context can genuinely differ from the target session's
   * own organization/branch (branch switch, deep link, org-level user,
   * retrying an older approved session) -- when the session-scope lookup
   * DOES find the row, its real organization_id/branch_id must be used
   * instead of the caller's active context.
   */
  it("uses the target session's OWN organization_id/branch_id for the retry-failure event when the session-scope lookup succeeds, even though it differs from the caller's active context", async () => {
    resetCreateClient({
      data: { organization_id: "org-SESSION-REAL", branch_id: "branch-SESSION-REAL" },
      error: null,
    });
    vi.mocked(RepairOrdersService.materializeFromSession).mockResolvedValue({
      success: false,
      error: "boom",
    });

    await retryMaterializationAction("11111111-1111-1111-1111-111111111111");

    expect(eventService.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        actionKey: "workshop.repair_orders.materialization_failed",
        organizationId: "org-SESSION-REAL",
        branchId: "branch-SESSION-REAL",
      })
    );
  });
});

// ─── getMaterializationStatusAction (Phase 5 read model) ──────────────────────

describe("getMaterializationStatusAction", () => {
  it("returns the materialization status when permitted", async () => {
    vi.mocked(RepairOrdersService.getMaterializationStatusForSession).mockResolvedValue({
      success: true,
      data: { materialized: true, repairOrderCount: 2 },
    });

    const result = await getMaterializationStatusAction("11111111-1111-1111-1111-111111111111");

    expect(result).toEqual({ success: true, data: { materialized: true, repairOrderCount: 2 } });
  });

  /**
   * Finding B (corrective review, CONFIRMED BUG, fixed): the action
   * previously checked ONLY wdd_matcher.read, while the read model it
   * calls is actually gated (via RLS) by the separate
   * workshop.repair_orders.read permission -- meaning rows hidden by
   * authorization could previously be silently misread as "not yet
   * materialized" instead of surfacing the real cause. Verifies the fix:
   * a caller lacking workshop.repair_orders.read is now rejected outright,
   * and the underlying service is never even called (never an implicit,
   * possibly-misleading zero-rows read).
   */
  it("rejects a caller with wdd_matcher.read but NOT workshop.repair_orders.read, never reaching the underlying query (Finding B fix)", async () => {
    setCtx(CTX_MATCHER_READ_ONLY_NO_WORKSHOP_READ);

    const result = await getMaterializationStatusAction("11111111-1111-1111-1111-111111111111");

    expect(result).toEqual({ success: false, error: "Unauthorized" });
    expect(RepairOrdersService.getMaterializationStatusForSession).not.toHaveBeenCalled();
  });
});
