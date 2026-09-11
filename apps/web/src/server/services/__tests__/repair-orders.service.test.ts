// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../event.service", () => ({
  eventService: {
    emit: vi.fn(),
  },
}));

import { RepairOrdersService } from "../repair-orders.service";
import { eventService } from "../event.service";

function buildSupabaseMock(rpcResult: { data: unknown; error: unknown }) {
  const rpc = vi.fn().mockResolvedValue(rpcResult);
  return { rpc } as unknown as import("@supabase/supabase-js").SupabaseClient;
}

const RPC_ROW = {
  session_id: "session-1",
  created_repair_orders: 2,
  reused_repair_orders: 0,
  created_source_documents: 2,
  reused_source_documents: 0,
  created_source_document_lines: 4,
  created_document_links: 2,
  created_logical_lines: 3,
  created_line_links: 3,
  skipped_nonpositive_quantity_lines: 1,
  already_materialized: false,
};

describe("RepairOrdersService.materializeFromSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls the RPC with the correct params and maps the raw jsonb result to a typed MaterializationResult", async () => {
    const supabase = buildSupabaseMock({ data: RPC_ROW, error: null });
    (eventService.emit as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: { id: "evt-1" },
    });

    const result = await RepairOrdersService.materializeFromSession(
      supabase,
      "user-1",
      "session-1"
    );

    expect(supabase.rpc).toHaveBeenCalledOnce();
    expect(supabase.rpc).toHaveBeenCalledWith("materialize_repair_orders_from_session", {
      p_actor_user_id: "user-1",
      p_session_id: "session-1",
    });

    expect(result).toEqual({
      success: true,
      data: {
        sessionId: "session-1",
        createdRepairOrders: 2,
        reusedRepairOrders: 0,
        createdSourceDocuments: 2,
        reusedSourceDocuments: 0,
        createdSourceDocumentLines: 4,
        createdDocumentLinks: 2,
        createdLogicalLines: 3,
        createdLineLinks: 3,
        skippedNonPositiveQuantityLines: 1,
        alreadyMaterialized: false,
      },
    });
  });

  it("emits workshop.repair_orders.materialized on success, with the actor and result summary", async () => {
    const supabase = buildSupabaseMock({ data: RPC_ROW, error: null });
    (eventService.emit as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: { id: "evt-1" },
    });

    await RepairOrdersService.materializeFromSession(supabase, "user-1", "session-1");

    expect(eventService.emit).toHaveBeenCalledOnce();
    expect(eventService.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        actionKey: "workshop.repair_orders.materialized",
        actorType: "user",
        actorUserId: "user-1",
        entityType: "wdd_matcher_session",
        entityId: "session-1",
        eventTier: "baseline",
      })
    );
  });

  it("returns a failure result and does NOT emit an event when the RPC itself errors", async () => {
    const supabase = buildSupabaseMock({
      data: null,
      error: { code: "P0002", message: "Matcher session not found: missing-session" },
    });

    const result = await RepairOrdersService.materializeFromSession(
      supabase,
      "user-1",
      "missing-session"
    );

    expect(result).toEqual({
      success: false,
      error: "Matcher session not found: missing-session",
    });
    expect(eventService.emit).not.toHaveBeenCalled();
  });

  /**
   * Finding G (corrective review): materialize_repair_orders_from_session
   * RAISEs exactly four deliberately-authored, already-safe business
   * messages, each with a specific ERRCODE -- those must pass through to
   * the caller verbatim. Any OTHER errcode (a raw constraint violation,
   * connection error, etc. -- not part of the RPC's own deliberate design)
   * must be replaced with a generic, safe message instead of leaking raw
   * DB internals to the browser.
   */
  it.each([
    ["P0002", "Matcher session not found: session-1"],
    ["55000", "Matcher session is not approved (status=ready_for_review)"],
    ["28000", "p_actor_user_id must match the authenticated caller"],
    ["42501", "Not authorized to materialize repair orders for this branch"],
  ])("passes the RPC's own safe errcode %s message through verbatim", async (code, message) => {
    const supabase = buildSupabaseMock({ data: null, error: { code, message } });

    const result = await RepairOrdersService.materializeFromSession(
      supabase,
      "user-1",
      "session-1"
    );

    expect(result).toEqual({ success: false, error: message });
  });

  it("replaces an unrecognized errcode's raw message with a generic, safe client-facing message", async () => {
    const supabase = buildSupabaseMock({
      data: null,
      error: {
        code: "23505",
        message: 'duplicate key value violates unique constraint "repair_orders_pkey"',
      },
    });

    const result = await RepairOrdersService.materializeFromSession(
      supabase,
      "user-1",
      "session-1"
    );

    expect(result.success).toBe(false);
    const error = (result as { success: false; error: string }).error;
    expect(error).not.toContain("repair_orders_pkey");
    expect(error).not.toContain("duplicate key");
    expect(error.length).toBeGreaterThan(0);
  });

  /**
   * Corrective review, second pass, Finding E (CONFIRMED, hardened):
   * SQLSTATEs are broad Postgres error classes, not unique identifiers of
   * this RPC's own four deliberate RAISEs. A DIFFERENT, native Postgres
   * error can carry the SAME errcode as one of the allowlisted ones (most
   * plausibly 42501/insufficient_privilege, which Postgres itself uses for
   * "permission denied for table ..." errors unrelated to this RPC's own
   * authored RAISE) -- an errcode-only allowlist would leak that raw,
   * schema-revealing message. Proves it is NOT exposed even though the
   * errcode alone matches an allowlisted entry.
   */
  it("replaces a raw message on an ALLOWLISTED errcode (42501) that doesn't match the RPC's own known message shape -- proves errcode alone is not sufficient", async () => {
    const supabase = buildSupabaseMock({
      data: null,
      error: { code: "42501", message: "permission denied for table workshop_source_documents" },
    });

    const result = await RepairOrdersService.materializeFromSession(
      supabase,
      "user-1",
      "session-1"
    );

    expect(result.success).toBe(false);
    const error = (result as { success: false; error: string }).error;
    expect(error).not.toContain("permission denied");
    expect(error).not.toContain("workshop_source_documents");
    expect(error.length).toBeGreaterThan(0);
  });

  it("replaces a codeless/unexpected error's raw message with a generic, safe client-facing message", async () => {
    const supabase = buildSupabaseMock({
      data: null,
      error: { message: "connection terminated unexpectedly" },
    });

    const result = await RepairOrdersService.materializeFromSession(
      supabase,
      "user-1",
      "session-1"
    );

    expect(result.success).toBe(false);
    const error = (result as { success: false; error: string }).error;
    expect(error).not.toBe("connection terminated unexpectedly");
  });

  it("still returns the successful domain result even when event emission fails (Mode A best-effort trade-off)", async () => {
    const supabase = buildSupabaseMock({ data: RPC_ROW, error: null });
    (eventService.emit as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: false,
      error: "emit failed",
    });

    const result = await RepairOrdersService.materializeFromSession(
      supabase,
      "user-1",
      "session-1"
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.createdRepairOrders).toBe(2);
    }
  });

  it("maps an idempotent-replay result (already_materialized: true, all created counts 0) correctly", async () => {
    const replayRow = {
      ...RPC_ROW,
      created_repair_orders: 0,
      created_source_documents: 0,
      created_source_document_lines: 0,
      created_logical_lines: 0,
      already_materialized: true,
    };
    const supabase = buildSupabaseMock({ data: replayRow, error: null });
    (eventService.emit as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: { id: "evt-1" },
    });

    const result = await RepairOrdersService.materializeFromSession(
      supabase,
      "user-1",
      "session-1"
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.alreadyMaterialized).toBe(true);
      expect(result.data.createdRepairOrders).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Phase 6 -- listForWorkshop / getByIdForWorkshop / Phase 5 materialization status
// ---------------------------------------------------------------------------

/**
 * A fully-chainable query-builder mock: every chain method records its call
 * and returns the same object, so assertions can inspect exactly which
 * filters were applied. Both termination shapes are supported --
 * `.maybeSingle()` (detail reads) and direct `await` on the builder itself
 * (list reads, which Supabase's query builder makes thenable).
 */
function makeChainableQueryMock(result: { data: unknown; error: unknown }) {
  const calls: { method: string; args: unknown[] }[] = [];
  const q: Record<string, unknown> = {};
  for (const m of ["select", "eq", "is", "order", "or"]) {
    q[m] = vi.fn().mockImplementation((...args: unknown[]) => {
      calls.push({ method: m, args });
      return q;
    });
  }
  q["maybeSingle"] = vi.fn().mockResolvedValue(result);
  q["then"] = (onFulfilled: (v: unknown) => unknown) => Promise.resolve(result).then(onFulfilled);
  return { from: vi.fn().mockReturnValue(q), calls, query: q };
}

describe("RepairOrdersService.listForWorkshop", () => {
  const DB_ROW = {
    id: "ro-1",
    zl_number: "ZL/90001/26/3252/BL",
    order_number: "BLWK/900",
    vin: "TESTVIN0000000001",
    status: "open",
    identity_status: "resolved",
    advisor_contact_id: null,
    created_at: "2026-09-10T10:00:00.000Z",
    updated_at: "2026-09-10T10:00:00.000Z",
    advisor: null,
  };

  it("maps rows to the domain shape and scopes by organization_id + branch_id", async () => {
    const mock = makeChainableQueryMock({ data: [DB_ROW], error: null });

    const result = await RepairOrdersService.listForWorkshop(
      mock as never,
      "org-1",
      "branch-1",
      null
    );

    expect(result).toEqual({
      success: true,
      data: [
        {
          id: "ro-1",
          zlNumber: "ZL/90001/26/3252/BL",
          orderNumber: "BLWK/900",
          vin: "TESTVIN0000000001",
          status: "open",
          identityStatus: "resolved",
          advisorContactId: null,
          advisorDisplayName: null,
          createdAt: "2026-09-10T10:00:00.000Z",
          updatedAt: "2026-09-10T10:00:00.000Z",
        },
      ],
    });

    const eqCalls = mock.calls.filter((c) => c.method === "eq").map((c) => c.args);
    expect(eqCalls).toContainEqual(["organization_id", "org-1"]);
    expect(eqCalls).toContainEqual(["branch_id", "branch-1"]);
    expect(mock.calls.some((c) => c.method === "or")).toBe(false);
  });

  it("applies a single OR-ILIKE search across zl_number, vin, and order_number, quoting the value against structural , ( ) characters (Finding E of corrective review)", async () => {
    const mock = makeChainableQueryMock({ data: [], error: null });

    await RepairOrdersService.listForWorkshop(mock as never, "org-1", null, "ZL/9000");

    const orCall = mock.calls.find((c) => c.method === "or");
    expect(orCall?.args[0]).toBe(
      'zl_number.ilike."%ZL/9000%",vin.ilike."%ZL/9000%",order_number.ilike."%ZL/9000%"'
    );
  });

  it("still matches business values containing spaces and slashes literally (real ZL/order-number shape)", async () => {
    const mock = makeChainableQueryMock({ data: [], error: null });

    await RepairOrdersService.listForWorkshop(mock as never, "org-1", null, "BLWK/900 3252");

    const orCall = mock.calls.find((c) => c.method === "or");
    expect(orCall?.args[0]).toBe(
      'zl_number.ilike."%BLWK/900 3252%",vin.ilike."%BLWK/900 3252%",order_number.ilike."%BLWK/900 3252%"'
    );
  });

  it("escapes % and _ ilike wildcards so they match literally, not as patterns", async () => {
    const mock = makeChainableQueryMock({ data: [], error: null });

    await RepairOrdersService.listForWorkshop(mock as never, "org-1", null, "100%_off");

    const orCall = mock.calls.find((c) => c.method === "or");
    expect(orCall?.args[0]).toBe(
      'zl_number.ilike."%100\\%\\_off%",vin.ilike."%100\\%\\_off%",order_number.ilike."%100\\%\\_off%"'
    );
  });

  it("quotes the value and escapes embedded double-quotes so a comma-containing search term can't inject extra/malformed OR conditions (Finding E, live-verified against PostgREST directly -- see corrective review evidence)", async () => {
    const mock = makeChainableQueryMock({ data: [], error: null });

    // Live-verified directly against the target Supabase project's REST
    // endpoint: the OLD (%/_ -escape-only, unquoted) behavior for this
    // exact value made PostgREST fail with PGRST100 "failed to parse logic
    // tree" (HTTP 400) -- the unescaped comma inside the value was read as
    // the top-level OR-condition separator. The quoted form below is
    // confirmed live to parse as a single ilike condition (HTTP 200).
    await RepairOrdersService.listForWorkshop(
      mock as never,
      "org-1",
      null,
      'x",status.eq.approved,y'
    );

    const orCall = mock.calls.find((c) => c.method === "or");
    expect(orCall?.args[0]).toBe(
      'zl_number.ilike."%x\\",status.eq.approved,y%",vin.ilike."%x\\",status.eq.approved,y%",order_number.ilike."%x\\",status.eq.approved,y%"'
    );
  });

  it("returns an empty array (not an error) when the search matches nothing", async () => {
    const mock = makeChainableQueryMock({ data: [], error: null });

    const result = await RepairOrdersService.listForWorkshop(
      mock as never,
      "org-1",
      "branch-1",
      "no-such-order"
    );

    expect(result).toEqual({ success: true, data: [] });
  });

  it("maps the advisor's display_name from the joined crm_contacts embed", async () => {
    const mock = makeChainableQueryMock({
      data: [
        { ...DB_ROW, advisor_contact_id: "contact-1", advisor: { display_name: "Jan Kowalski" } },
      ],
      error: null,
    });

    const result = await RepairOrdersService.listForWorkshop(mock as never, "org-1", null, null);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data[0].advisorDisplayName).toBe("Jan Kowalski");
    }
  });

  it("propagates a DB error as a structured failure, never throws", async () => {
    const mock = makeChainableQueryMock({ data: null, error: { message: "connection reset" } });

    const result = await RepairOrdersService.listForWorkshop(mock as never, "org-1", null, null);

    expect(result).toEqual({ success: false, error: "connection reset" });
  });
});

/**
 * A per-table chainable query-builder mock: `.from(table)` returns a fresh
 * chain builder scoped to that table's own configured result, so a test can
 * exercise a method (like getMaterializationStatusForSession, after the
 * Finding I fix) that issues two independent `.from()` calls against two
 * different tables in sequence.
 */
function makeTableQueryMock(tableResponses: Record<string, { data: unknown; error: unknown }>) {
  const callsByTable: Record<string, { method: string; args: unknown[] }[]> = {};
  const from = vi.fn().mockImplementation((table: string) => {
    const result = tableResponses[table] ?? { data: null, error: null };
    const calls: { method: string; args: unknown[] }[] = [];
    callsByTable[table] = calls;
    const q: Record<string, unknown> = {};
    for (const m of ["select", "eq", "is", "order", "or", "in"]) {
      q[m] = vi.fn().mockImplementation((...args: unknown[]) => {
        calls.push({ method: m, args });
        return q;
      });
    }
    q["maybeSingle"] = vi.fn().mockResolvedValue(result);
    q["then"] = (onFulfilled: (v: unknown) => unknown) => Promise.resolve(result).then(onFulfilled);
    return q;
  });
  return { from, callsByTable };
}

describe("RepairOrdersService.getMaterializationStatusForSession", () => {
  it("reports materialized: false and repairOrderCount: 0 when no source documents are linked to any RepairOrder yet (short-circuits before querying repair_orders at all)", async () => {
    const mock = makeChainableQueryMock({
      data: [{ id: "doc-1", repair_order_source_document_links: [] }],
      error: null,
    });

    const result = await RepairOrdersService.getMaterializationStatusForSession(
      mock as never,
      "session-1"
    );

    expect(result).toEqual({ success: true, data: { materialized: false, repairOrderCount: 0 } });
    expect(mock.from).toHaveBeenCalledTimes(1);
  });

  it("counts DISTINCT repair_order_ids across all linked source documents (not a raw row count)", async () => {
    const mock = makeTableQueryMock({
      workshop_source_documents: {
        data: [
          { id: "doc-1", repair_order_source_document_links: [{ repair_order_id: "ro-1" }] },
          // Same RepairOrder linked via a second source document -- must not double-count.
          { id: "doc-2", repair_order_source_document_links: [{ repair_order_id: "ro-1" }] },
          { id: "doc-3", repair_order_source_document_links: [{ repair_order_id: "ro-2" }] },
        ],
        error: null,
      },
      repair_orders: {
        data: [{ id: "ro-1" }, { id: "ro-2" }],
        error: null,
      },
    });

    const result = await RepairOrdersService.getMaterializationStatusForSession(
      mock as never,
      "session-1"
    );

    expect(result).toEqual({ success: true, data: { materialized: true, repairOrderCount: 2 } });
    const roCalls = mock.callsByTable["repair_orders"];
    expect(roCalls.some((c) => c.method === "in" && c.args[0] === "id")).toBe(true);
    expect(
      roCalls.some((c) => c.method === "is" && c.args[0] === "deleted_at" && c.args[1] === null)
    ).toBe(true);
  });

  it("excludes a soft-deleted RepairOrder from the count -- Finding I (corrective review) defense-in-depth on top of the RLS policy that already hides it", async () => {
    const mock = makeTableQueryMock({
      workshop_source_documents: {
        data: [
          {
            id: "doc-1",
            repair_order_source_document_links: [
              { repair_order_id: "ro-1" },
              { repair_order_id: "ro-2" },
            ],
          },
        ],
        error: null,
      },
      repair_orders: {
        // ro-2 is soft-deleted -- filtered out by the .is("deleted_at", null)
        // query itself, so it never reaches this mocked result.
        data: [{ id: "ro-1" }],
        error: null,
      },
    });

    const result = await RepairOrdersService.getMaterializationStatusForSession(
      mock as never,
      "session-1"
    );

    expect(result).toEqual({ success: true, data: { materialized: true, repairOrderCount: 1 } });
  });

  it("propagates a DB error from the second (repair_orders) query as a structured failure, never throws", async () => {
    const mock = makeTableQueryMock({
      workshop_source_documents: {
        data: [{ id: "doc-1", repair_order_source_document_links: [{ repair_order_id: "ro-1" }] }],
        error: null,
      },
      repair_orders: {
        data: null,
        error: { message: "connection reset" },
      },
    });

    const result = await RepairOrdersService.getMaterializationStatusForSession(
      mock as never,
      "session-1"
    );

    expect(result).toEqual({ success: false, error: "connection reset" });
  });
});

describe("RepairOrdersService.getByIdForWorkshop", () => {
  it("returns null data (not an error) when the id does not exist in this org/branch -- never leaks cross-org existence", async () => {
    const mock = makeChainableQueryMock({ data: null, error: null });

    const result = await RepairOrdersService.getByIdForWorkshop(
      mock as never,
      "org-1",
      "branch-1",
      "ro-missing"
    );

    expect(result).toEqual({ success: true, data: null });
  });

  it("maps a found row to the same domain shape as listForWorkshop", async () => {
    const mock = makeChainableQueryMock({
      data: {
        id: "ro-1",
        zl_number: "ZL/90001/26/3252/BL",
        order_number: "BLWK/900",
        vin: "TESTVIN0000000001",
        status: "open",
        identity_status: "resolved",
        advisor_contact_id: null,
        created_at: "2026-09-10T10:00:00.000Z",
        updated_at: "2026-09-10T10:00:00.000Z",
        advisor: null,
      },
      error: null,
    });

    const result = await RepairOrdersService.getByIdForWorkshop(
      mock as never,
      "org-1",
      null,
      "ro-1"
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data?.id).toBe("ro-1");
      expect(result.data?.zlNumber).toBe("ZL/90001/26/3252/BL");
    }
  });
});
