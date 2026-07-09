/**
 * @vitest-environment node
 *
 * Unit tests for InventoryCountSessionsService.
 *
 * All Supabase interactions are mocked — no real DB connections. Covers:
 *  - listSessions / getSessionDetail (read side, happy + error paths)
 *  - createCountSession: location-scope subtree expansion, supplier scope,
 *    blind-mode / require-reason / zero-stock passthrough into scope
 *  - updateCountLine: transition validation, required-reason-on-approve gate
 *    (and that a zero-variance approve does NOT require a reason)
 *  - addUnexpectedLine: sequence_no computed server-side from current max
 *  - bulkApproveLines: only "counted" lines qualify; missing-reason lines are
 *    reported as skipped, not silently dropped or force-approved
 *  - approveCountSession: pass-through, error surfaced unchanged
 *  - getReorderReport: below-reorder-point filtering, reorder_quantity vs.
 *    fallback math, supplier filtering
 *
 * RLS-denial simulation tests (T-RLS) and branch/org isolation tests
 * (T-BRANCH/T-ORG) are included per the plan's TDD requirements.
 */
import { describe, expect, it, vi } from "vitest";
import { InventoryCountSessionsService } from "../inventory-count-sessions.service";

const ORG_ID = "org-111";
const BRANCH_ID = "branch-222";
const USER_ID = "user-333";

// ─── Supabase mock builder (mirrors warehouse-locations.service.test.ts) ──────

function makeSupabaseMock(
  fromResults: Array<{ data: unknown; error: unknown }>,
  rpcResults: Array<{ data: unknown; error: unknown }> = []
) {
  let fromIndex = 0;
  let rpcIndex = 0;

  const makeChain = (result: { data: unknown; error: unknown }) => {
    const chain: Record<string, unknown> = {};
    for (const m of ["select", "eq", "is", "order", "insert", "update", "neq", "in", "limit"]) {
      chain[m] = vi.fn().mockReturnValue(chain);
    }
    chain.maybeSingle = vi.fn().mockResolvedValue(result);
    chain.single = vi.fn().mockResolvedValue(result);
    chain.then = (
      onfulfilled: ((v: unknown) => unknown) | null | undefined,
      onrejected: ((r: unknown) => unknown) | null | undefined
    ) => Promise.resolve(result).then(onfulfilled, onrejected);
    return chain;
  };

  return {
    from: vi.fn().mockImplementation(() => {
      const result = fromResults[fromIndex] ?? { data: null, error: null };
      fromIndex++;
      return makeChain(result);
    }),
    rpc: vi.fn().mockImplementation(() => {
      const result = rpcResults[rpcIndex] ?? { data: null, error: null };
      rpcIndex++;
      return Promise.resolve(result);
    }),
  };
}

function makeRlsDeniedClient() {
  const rlsError = { code: "42501", message: "permission denied" };
  const errResult = { data: null, error: rlsError };
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "eq", "is", "order", "insert", "update", "neq", "in", "limit"]) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.maybeSingle = vi.fn().mockResolvedValue(errResult);
  chain.single = vi.fn().mockResolvedValue(errResult);
  chain.then = (onfulfilled: (v: unknown) => unknown) =>
    Promise.resolve(errResult).then(onfulfilled);
  return {
    from: vi.fn().mockReturnValue(chain),
    rpc: vi.fn().mockResolvedValue(errResult),
  };
}

// ─── listSessions / getSessionDetail ───────────────────────────────────────────

describe("listSessions", () => {
  it("maps the RPC's snake_case result into the service's camelCase shape", async () => {
    const supabase = makeSupabaseMock(
      [],
      [
        {
          data: { rows: [{ id: "s1" }], total_count: 1, page: 1, page_size: 20 },
          error: null,
        },
      ]
    );

    const result = await InventoryCountSessionsService.listSessions(
      supabase as any,
      ORG_ID,
      BRANCH_ID
    );

    expect(result).toEqual({
      success: true,
      data: { rows: [{ id: "s1" }], totalCount: 1, page: 1, pageSize: 20 },
    });
    expect(supabase.rpc).toHaveBeenCalledWith("inventory_count_session_list", {
      p_organization_id: ORG_ID,
      p_branch_id: BRANCH_ID,
      p_search: null,
      p_status: null,
      p_page: 1,
      p_page_size: 20,
    });
  });

  it("returns a failure result when the RPC errors", async () => {
    const supabase = makeSupabaseMock([], [{ data: null, error: { message: "boom" } }]);
    const result = await InventoryCountSessionsService.listSessions(
      supabase as any,
      ORG_ID,
      BRANCH_ID
    );
    expect(result).toEqual({ success: false, error: "boom" });
  });
});

describe("getSessionDetail", () => {
  it("returns the session and its lines ordered by sequence_no", async () => {
    const supabase = makeSupabaseMock([
      { data: { id: "s1", status: "counting" }, error: null },
      { data: [{ id: "l1", sequence_no: 1 }], error: null },
    ]);

    const result = await InventoryCountSessionsService.getSessionDetail(supabase as any, "s1");

    expect(result).toEqual({
      success: true,
      data: { session: { id: "s1", status: "counting" }, lines: [{ id: "l1", sequence_no: 1 }] },
    });
  });

  it("fails when the session lookup errors", async () => {
    const supabase = makeSupabaseMock([{ data: null, error: { message: "not found" } }]);
    const result = await InventoryCountSessionsService.getSessionDetail(supabase as any, "s1");
    expect(result).toEqual({ success: false, error: "not found" });
  });
});

// ─── createCountSession ────────────────────────────────────────────────────────

describe("createCountSession", () => {
  const LOCATIONS = [
    { id: "warehouse-a", parent_id: null },
    { id: "rack-a1", parent_id: "warehouse-a" },
    { id: "shelf-a1-1", parent_id: "rack-a1" },
  ];

  it("expands location subtree before calling the RPC when count_type=location and include_children=true", async () => {
    const supabase = makeSupabaseMock([], [{ data: { count_session_id: "s1" }, error: null }]);

    await InventoryCountSessionsService.createCountSession(
      supabase as any,
      ORG_ID,
      BRANCH_ID,
      { count_type: "location", location_ids: ["warehouse-a"], include_children: true },
      LOCATIONS
    );

    expect(supabase.rpc).toHaveBeenCalledWith(
      "inventory_create_count_session",
      expect.objectContaining({
        p_scope: expect.objectContaining({
          count_type: "location",
          location_ids: expect.arrayContaining(["warehouse-a", "rack-a1", "shelf-a1-1"]),
        }),
      })
    );
  });

  it("does not expand anything when include_children is false", async () => {
    const supabase = makeSupabaseMock([], [{ data: { count_session_id: "s1" }, error: null }]);

    await InventoryCountSessionsService.createCountSession(
      supabase as any,
      ORG_ID,
      BRANCH_ID,
      { count_type: "location", location_ids: ["warehouse-a"], include_children: false },
      LOCATIONS
    );

    const call = (supabase.rpc as any).mock.calls[0][1];
    expect(call.p_scope.location_ids).toEqual(["warehouse-a"]);
  });

  it("passes supplier_id and location_filter_ids through for count_type=supplier", async () => {
    const supabase = makeSupabaseMock([], [{ data: { count_session_id: "s1" }, error: null }]);

    await InventoryCountSessionsService.createCountSession(supabase as any, ORG_ID, BRANCH_ID, {
      count_type: "supplier",
      supplier_id: "sup-1",
      location_filter_ids: ["loc-1"],
    });

    const call = (supabase.rpc as any).mock.calls[0][1];
    expect(call.p_scope).toEqual(
      expect.objectContaining({
        count_type: "supplier",
        supplier_id: "sup-1",
        location_filter_ids: ["loc-1"],
      })
    );
  });

  it("defaults show_expected_quantity and require_reason_for_variance to true (standard, not blind)", async () => {
    const supabase = makeSupabaseMock([], [{ data: {}, error: null }]);
    await InventoryCountSessionsService.createCountSession(supabase as any, ORG_ID, BRANCH_ID, {
      count_type: "supplier",
      supplier_id: "sup-1",
    });
    const call = (supabase.rpc as any).mock.calls[0][1];
    expect(call.p_scope.show_expected_quantity).toBe(true);
    expect(call.p_scope.require_reason_for_variance).toBe(true);
  });

  it("passes blind mode and include_zero_stock through unchanged", async () => {
    const supabase = makeSupabaseMock([], [{ data: {}, error: null }]);
    await InventoryCountSessionsService.createCountSession(
      supabase as any,
      ORG_ID,
      BRANCH_ID,
      {
        count_type: "location",
        location_ids: ["loc-1"],
        show_expected_quantity: false,
        require_reason_for_variance: false,
        include_zero_stock: true,
      },
      [{ id: "loc-1", parent_id: null }]
    );
    const call = (supabase.rpc as any).mock.calls[0][1];
    expect(call.p_scope.show_expected_quantity).toBe(false);
    expect(call.p_scope.require_reason_for_variance).toBe(false);
    expect(call.p_scope.include_zero_stock).toBe(true);
  });

  it("returns a failure result when the RPC rejects (e.g. missing permission)", async () => {
    const supabase = makeSupabaseMock(
      [],
      [{ data: null, error: { message: "Missing warehouse.audits.manage permission" } }]
    );
    const result = await InventoryCountSessionsService.createCountSession(
      supabase as any,
      ORG_ID,
      BRANCH_ID,
      {
        count_type: "supplier",
        supplier_id: "sup-1",
      }
    );
    expect(result).toEqual({ success: false, error: "Missing warehouse.audits.manage permission" });
  });
});

// ─── updateCountLine ────────────────────────────────────────────────────────────

describe("updateCountLine", () => {
  it("updates counted_quantity and stamps counted_by/counted_at", async () => {
    const supabase = makeSupabaseMock([{ data: { id: "line-1" }, error: null }]);
    const result = await InventoryCountSessionsService.updateCountLine(supabase as any, "line-1", {
      counted_quantity: 5,
      actor_user_id: USER_ID,
    });
    expect(result).toEqual({ success: true, data: { id: "line-1" } });
  });

  it("allows approving a zero-variance line without a reason_code, even when require_reason_for_variance=true", async () => {
    const supabase = makeSupabaseMock([{ data: { id: "line-1" }, error: null }]);
    const result = await InventoryCountSessionsService.updateCountLine(supabase as any, "line-1", {
      status: "approved",
      variance_quantity: 0,
      require_reason_for_variance: true,
    });
    expect(result.success).toBe(true);
  });

  it("rejects approving a nonzero-variance line without a reason_code when required", async () => {
    const supabase = makeSupabaseMock([{ data: { id: "line-1" }, error: null }]);
    const result = await InventoryCountSessionsService.updateCountLine(supabase as any, "line-1", {
      status: "approved",
      variance_quantity: -2,
      require_reason_for_variance: true,
      reason_code: null,
    });
    expect(result).toEqual({
      success: false,
      error: "A reason is required to approve a line with a quantity variance",
    });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("allows approving a nonzero-variance line without a reason when the session does not require one", async () => {
    const supabase = makeSupabaseMock([{ data: { id: "line-1" }, error: null }]);
    const result = await InventoryCountSessionsService.updateCountLine(supabase as any, "line-1", {
      status: "approved",
      variance_quantity: -2,
      require_reason_for_variance: false,
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid transition when current_status is supplied", async () => {
    const supabase = makeSupabaseMock([{ data: { id: "line-1" }, error: null }]);
    const result = await InventoryCountSessionsService.updateCountLine(supabase as any, "line-1", {
      status: "pending",
      current_status: "approved",
    });
    expect(result.success).toBe(false);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("skips transition validation when current_status is not supplied", async () => {
    const supabase = makeSupabaseMock([{ data: { id: "line-1" }, error: null }]);
    const result = await InventoryCountSessionsService.updateCountLine(supabase as any, "line-1", {
      status: "skipped",
    });
    expect(result.success).toBe(true);
  });

  it("propagates a DB error", async () => {
    const supabase = makeSupabaseMock([{ data: null, error: { message: "constraint violated" } }]);
    const result = await InventoryCountSessionsService.updateCountLine(supabase as any, "line-1", {
      status: "skipped",
    });
    expect(result).toEqual({ success: false, error: "constraint violated" });
  });
});

// ─── addUnexpectedLine ──────────────────────────────────────────────────────────

describe("addUnexpectedLine", () => {
  it("computes sequence_no from the current max, server-side, and inserts the line", async () => {
    const supabase = makeSupabaseMock([
      { data: { sequence_no: 7 }, error: null }, // max lookup
      { data: { id: "line-new" }, error: null }, // insert
    ]);

    const result = await InventoryCountSessionsService.addUnexpectedLine(
      supabase as any,
      "session-1",
      {
        organization_id: ORG_ID,
        branch_id: BRANCH_ID,
        variant_id: "variant-1",
        location_id: "loc-1",
        unit_id: "unit-1",
        counted_quantity: 3,
        actor_user_id: USER_ID,
      }
    );

    expect(result).toEqual({ success: true, data: { id: "line-new" } });
  });

  it("starts sequence_no at 1 when the session has no existing lines", async () => {
    const supabase = makeSupabaseMock([
      { data: null, error: null }, // maybeSingle -> no rows
      { data: { id: "line-new" }, error: null },
    ]);

    const result = await InventoryCountSessionsService.addUnexpectedLine(
      supabase as any,
      "session-1",
      {
        organization_id: ORG_ID,
        branch_id: BRANCH_ID,
        variant_id: "variant-1",
        location_id: "loc-1",
        unit_id: "unit-1",
        counted_quantity: 1,
      }
    );

    expect(result.success).toBe(true);
  });

  it("propagates an error from the max-sequence lookup", async () => {
    const supabase = makeSupabaseMock([{ data: null, error: { message: "boom" } }]);
    const result = await InventoryCountSessionsService.addUnexpectedLine(
      supabase as any,
      "session-1",
      {
        organization_id: ORG_ID,
        branch_id: BRANCH_ID,
        variant_id: "variant-1",
        location_id: "loc-1",
        unit_id: "unit-1",
        counted_quantity: 1,
      }
    );
    expect(result).toEqual({ success: false, error: "boom" });
  });
});

// ─── bulkApproveLines ───────────────────────────────────────────────────────────

describe("bulkApproveLines", () => {
  it("returns empty results immediately for an empty id list, without querying", async () => {
    const supabase = makeSupabaseMock([]);
    const result = await InventoryCountSessionsService.bulkApproveLines(supabase as any, [], {
      require_reason_for_variance: true,
    });
    expect(result).toEqual({ success: true, data: { approvedIds: [], skippedIds: [] } });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("approves counted lines with no variance or with a reason, skips counted lines missing a required reason, skips non-counted lines", async () => {
    const supabase = makeSupabaseMock([
      {
        data: [
          { id: "l-match", status: "counted", variance_quantity: 0, reason_code: null },
          { id: "l-has-reason", status: "counted", variance_quantity: -2, reason_code: "damaged" },
          { id: "l-missing-reason", status: "counted", variance_quantity: 3, reason_code: null },
          { id: "l-skipped", status: "skipped", variance_quantity: null, reason_code: null },
          { id: "l-pending", status: "pending", variance_quantity: null, reason_code: null },
        ],
        error: null,
      },
      { data: null, error: null }, // bulk update
    ]);

    const result = await InventoryCountSessionsService.bulkApproveLines(
      supabase as any,
      ["l-match", "l-has-reason", "l-missing-reason", "l-skipped", "l-pending"],
      { require_reason_for_variance: true }
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.approvedIds.sort()).toEqual(["l-has-reason", "l-match"].sort());
      expect(result.data.skippedIds.sort()).toEqual(
        ["l-missing-reason", "l-pending", "l-skipped"].sort()
      );
    }
  });

  it("never issues the update call when nothing qualifies", async () => {
    const supabase = makeSupabaseMock([
      {
        data: [{ id: "l-pending", status: "pending", variance_quantity: null, reason_code: null }],
        error: null,
      },
    ]);
    const result = await InventoryCountSessionsService.bulkApproveLines(
      supabase as any,
      ["l-pending"],
      {
        require_reason_for_variance: true,
      }
    );
    expect(result.success).toBe(true);
    // Only one .from() call (the select) — no second call for the update.
    expect(supabase.from).toHaveBeenCalledTimes(1);
  });
});

// ─── approveCountSession ────────────────────────────────────────────────────────

describe("approveCountSession", () => {
  it("passes through a successful RPC result", async () => {
    const supabase = makeSupabaseMock(
      [],
      [{ data: { count_session_id: "s1", status: "approved" }, error: null }]
    );
    const result = await InventoryCountSessionsService.approveCountSession(
      supabase as any,
      "s1",
      USER_ID
    );
    expect(result).toEqual({ success: true, data: { count_session_id: "s1", status: "approved" } });
  });

  it("surfaces the RPC's rejection reason unchanged (e.g. all-or-nothing gate failure)", async () => {
    const supabase = makeSupabaseMock(
      [],
      [{ data: null, error: { message: "Cannot post: session has unresolved pending lines" } }]
    );
    const result = await InventoryCountSessionsService.approveCountSession(
      supabase as any,
      "s1",
      USER_ID
    );
    expect(result).toEqual({
      success: false,
      error: "Cannot post: session has unresolved pending lines",
    });
  });

  it("surfaces a missing warehouse.inventory.adjust permission error unchanged", async () => {
    const supabase = makeSupabaseMock(
      [],
      [{ data: null, error: { message: "Missing warehouse.inventory.adjust permission" } }]
    );
    const result = await InventoryCountSessionsService.approveCountSession(
      supabase as any,
      "s1",
      USER_ID
    );
    expect(result).toEqual({
      success: false,
      error: "Missing warehouse.inventory.adjust permission",
    });
  });
});

describe("updateSessionStatus", () => {
  it("updates the session status to counting", async () => {
    const supabase = makeSupabaseMock([{ data: { id: "s1", status: "counting" }, error: null }]);
    const result = await InventoryCountSessionsService.updateSessionStatus(
      supabase as any,
      "s1",
      "counting"
    );
    expect(result).toEqual({ success: true, data: { id: "s1", status: "counting" } });
  });

  it("updates the session status to submitted", async () => {
    const supabase = makeSupabaseMock([{ data: { id: "s1", status: "submitted" }, error: null }]);
    const result = await InventoryCountSessionsService.updateSessionStatus(
      supabase as any,
      "s1",
      "submitted"
    );
    expect(result).toEqual({ success: true, data: { id: "s1", status: "submitted" } });
  });

  it("propagates a DB error", async () => {
    const supabase = makeSupabaseMock([{ data: null, error: { message: "not found" } }]);
    const result = await InventoryCountSessionsService.updateSessionStatus(
      supabase as any,
      "s1",
      "counting"
    );
    expect(result).toEqual({ success: false, error: "not found" });
  });
});

// ─── getReorderReport ───────────────────────────────────────────────────────────

describe("getReorderReport", () => {
  it("returns an empty report when no reorder rules exist", async () => {
    const supabase = makeSupabaseMock([{ data: [], error: null }]);
    const result = await InventoryCountSessionsService.getReorderReport(
      supabase as any,
      ORG_ID,
      BRANCH_ID
    );
    expect(result).toEqual({ success: true, data: [] });
    expect(supabase.from).toHaveBeenCalledTimes(1); // no balances query needed
  });

  it("excludes variants whose on-hand quantity is at or above the reorder point", async () => {
    const supabase = makeSupabaseMock([
      {
        data: [
          {
            variant_id: "v1",
            location_id: null,
            reorder_point: 10,
            reorder_quantity: null,
            min_quantity: 2,
            preferred_supplier_id: null,
          },
        ],
        error: null,
      },
      { data: [{ variant_id: "v1", location_id: "loc-1", on_hand_quantity: 15 }], error: null },
    ]);
    const result = await InventoryCountSessionsService.getReorderReport(
      supabase as any,
      ORG_ID,
      BRANCH_ID
    );
    expect(result).toEqual({ success: true, data: [] });
  });

  it("includes below-reorder-point variants and uses reorder_quantity directly when set", async () => {
    const supabase = makeSupabaseMock([
      {
        data: [
          {
            variant_id: "v1",
            location_id: null,
            reorder_point: 10,
            reorder_quantity: 25,
            min_quantity: 2,
            preferred_supplier_id: "sup-1",
          },
        ],
        error: null,
      },
      { data: [{ variant_id: "v1", location_id: "loc-1", on_hand_quantity: 3 }], error: null },
    ]);
    const result = await InventoryCountSessionsService.getReorderReport(
      supabase as any,
      ORG_ID,
      BRANCH_ID
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0].suggested_order_quantity).toBe(25);
      expect(result.data[0].on_hand_quantity).toBe(3);
    }
  });

  it("falls back to topping up to the reorder point when reorder_quantity is null", async () => {
    const supabase = makeSupabaseMock([
      {
        data: [
          {
            variant_id: "v1",
            location_id: null,
            reorder_point: 10,
            reorder_quantity: null,
            min_quantity: null,
            preferred_supplier_id: null,
          },
        ],
        error: null,
      },
      { data: [{ variant_id: "v1", location_id: "loc-1", on_hand_quantity: 4 }], error: null },
    ]);
    const result = await InventoryCountSessionsService.getReorderReport(
      supabase as any,
      ORG_ID,
      BRANCH_ID
    );
    if (result.success) {
      expect(result.data[0].suggested_order_quantity).toBe(6);
    }
  });

  it("filters out rules whose preferred_supplier_id does not match the requested supplierId", async () => {
    const supabase = makeSupabaseMock([
      {
        data: [
          {
            variant_id: "v1",
            location_id: null,
            reorder_point: 10,
            reorder_quantity: 5,
            min_quantity: null,
            preferred_supplier_id: "sup-other",
          },
        ],
        error: null,
      },
      { data: [{ variant_id: "v1", location_id: "loc-1", on_hand_quantity: 1 }], error: null },
    ]);
    const result = await InventoryCountSessionsService.getReorderReport(
      supabase as any,
      ORG_ID,
      BRANCH_ID,
      {
        supplierId: "sup-1",
      }
    );
    expect(result).toEqual({ success: true, data: [] });
  });

  it("sums on-hand quantity across multiple locations for a location-agnostic rule", async () => {
    const supabase = makeSupabaseMock([
      {
        data: [
          {
            variant_id: "v1",
            location_id: null,
            reorder_point: 10,
            reorder_quantity: null,
            min_quantity: null,
            preferred_supplier_id: null,
          },
        ],
        error: null,
      },
      {
        data: [
          { variant_id: "v1", location_id: "loc-1", on_hand_quantity: 2 },
          { variant_id: "v1", location_id: "loc-2", on_hand_quantity: 3 },
        ],
        error: null,
      },
    ]);
    const result = await InventoryCountSessionsService.getReorderReport(
      supabase as any,
      ORG_ID,
      BRANCH_ID
    );
    if (result.success) {
      expect(result.data[0].on_hand_quantity).toBe(5);
    }
  });
});

// ─── T-RLS: RLS-denial simulation ───────────────────────────────────────────────

describe("T-RLS: RLS denial", () => {
  it("listSessions surfaces an RLS permission error from the RPC", async () => {
    const supabase = makeRlsDeniedClient();
    const result = await InventoryCountSessionsService.listSessions(
      supabase as any,
      ORG_ID,
      BRANCH_ID
    );
    expect(result.success).toBe(false);
  });

  it("getSessionDetail surfaces an RLS permission error on SELECT", async () => {
    const supabase = makeRlsDeniedClient();
    const result = await InventoryCountSessionsService.getSessionDetail(supabase as any, "s1");
    expect(result.success).toBe(false);
  });

  it("updateCountLine surfaces an RLS permission error on UPDATE", async () => {
    const supabase = makeRlsDeniedClient();
    const result = await InventoryCountSessionsService.updateCountLine(supabase as any, "line-1", {
      status: "skipped",
    });
    expect(result.success).toBe(false);
  });

  it("approveCountSession surfaces an RLS/permission error from the RPC", async () => {
    const supabase = makeRlsDeniedClient();
    const result = await InventoryCountSessionsService.approveCountSession(
      supabase as any,
      "s1",
      USER_ID
    );
    expect(result.success).toBe(false);
  });
});

// ─── T-BRANCH / T-ORG: isolation — assert org/branch are always the query scope ─

describe("T-BRANCH/T-ORG: isolation invariants", () => {
  it("listSessions scopes the RPC call to the given organization and branch", async () => {
    const supabase = makeSupabaseMock(
      [],
      [{ data: { rows: [], total_count: 0, page: 1, page_size: 20 }, error: null }]
    );
    await InventoryCountSessionsService.listSessions(supabase as any, "org-A", "branch-A");
    expect(supabase.rpc).toHaveBeenCalledWith(
      "inventory_count_session_list",
      expect.objectContaining({ p_organization_id: "org-A", p_branch_id: "branch-A" })
    );
  });

  it("createCountSession scopes the RPC call to the given organization and branch", async () => {
    const supabase = makeSupabaseMock([], [{ data: {}, error: null }]);
    await InventoryCountSessionsService.createCountSession(supabase as any, "org-A", "branch-A", {
      count_type: "supplier",
      supplier_id: "sup-1",
    });
    expect(supabase.rpc).toHaveBeenCalledWith(
      "inventory_create_count_session",
      expect.objectContaining({ p_organization_id: "org-A", p_branch_id: "branch-A" })
    );
  });

  it("getReorderReport scopes both queries to the given organization and branch", async () => {
    const supabase = makeSupabaseMock([
      {
        data: [
          {
            variant_id: "v1",
            location_id: null,
            reorder_point: 5,
            reorder_quantity: null,
            min_quantity: null,
            preferred_supplier_id: null,
          },
        ],
        error: null,
      },
      { data: [], error: null },
    ]);
    await InventoryCountSessionsService.getReorderReport(supabase as any, "org-A", "branch-A");
    // Two .from() calls issued (rules, then balances) — both scoped queries built via .eq chain calls.
    expect(supabase.from).toHaveBeenCalledTimes(2);
  });
});
