// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../event.service", () => ({
  eventService: {
    emit: vi.fn(),
  },
}));

import { RepairOrdersService, groupProvenanceByRepairOrderLine } from "../repair-orders.service";
import type {
  RepairOrderLineReadModel,
  RepairOrderProvenanceDocument,
} from "../repair-orders.service";
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
  for (const m of ["select", "eq", "is", "order", "or", "not", "insert", "update"]) {
    q[m] = vi.fn().mockImplementation((...args: unknown[]) => {
      calls.push({ method: m, args });
      return q;
    });
  }
  q["maybeSingle"] = vi.fn().mockResolvedValue(result);
  q["single"] = vi.fn().mockResolvedValue(result);
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

// ---------------------------------------------------------------------------
// Phase 7 -- header, advisor, lifecycle
// ---------------------------------------------------------------------------

const HEADER_DB_ROW = {
  id: "ro-1",
  zl_number: "ZL/90001/26/3252/BL",
  order_number: "BLWK/900",
  vin: "TESTVIN0000000001",
  vehicle_brand: "Toyota",
  client_name: "Jan Kowalski",
  dealer_name: "Dealer A",
  status: "open",
  identity_status: "resolved",
  advisor_contact_id: "contact-1",
  created_by: "user-1",
  created_at: "2026-09-10T10:00:00.000Z",
  updated_at: "2026-09-10T10:00:00.000Z",
  advisor: { display_name: "Jane Advisor" },
};

describe("RepairOrdersService.createRepairOrder", () => {
  beforeEach(() => vi.clearAllMocks());

  it("inserts with org/branch from trusted params, derives identity_status='resolved' when zl_number is present, and emits workshop.repair_orders.created", async () => {
    const mock = makeChainableQueryMock({ data: HEADER_DB_ROW, error: null });
    (eventService.emit as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: { id: "evt-1" },
    });

    const result = await RepairOrdersService.createRepairOrder(
      mock as never,
      "org-1",
      "branch-1",
      "user-1",
      { zl_number: "ZL/90001/26/3252/BL", order_number: "BLWK/900" }
    );

    expect(result.success).toBe(true);
    const insertCall = mock.calls.find((c) => c.method === "insert");
    expect(insertCall?.args[0]).toMatchObject({
      organization_id: "org-1",
      branch_id: "branch-1",
      zl_number: "ZL/90001/26/3252/BL",
      identity_status: "resolved",
      created_by: "user-1",
    });
    expect(eventService.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        actionKey: "workshop.repair_orders.created",
        organizationId: "org-1",
        branchId: "branch-1",
        entityId: "ro-1",
      })
    );
  });

  it("derives identity_status='unresolved' when zl_number is absent (no fabricated zl_number)", async () => {
    const mock = makeChainableQueryMock({
      data: { ...HEADER_DB_ROW, zl_number: null, identity_status: "unresolved" },
      error: null,
    });
    (eventService.emit as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true, data: {} });

    await RepairOrdersService.createRepairOrder(mock as never, "org-1", "branch-1", "user-1", {});

    const insertCall = mock.calls.find((c) => c.method === "insert");
    expect(insertCall?.args[0]).toMatchObject({ zl_number: null, identity_status: "unresolved" });
  });

  it("maps a 23505 unique-constraint violation to a clear duplicate-zl_number error", async () => {
    const mock = makeChainableQueryMock({
      data: null,
      error: {
        code: "23505",
        message: 'duplicate key value violates unique constraint "repair_orders_identity_unique"',
      },
    });

    const result = await RepairOrdersService.createRepairOrder(
      mock as never,
      "org-1",
      "branch-1",
      "user-1",
      { zl_number: "ZL/DUP" }
    );

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toContain("already exists");
  });
});

describe("RepairOrdersService.updateHeader", () => {
  beforeEach(() => vi.clearAllMocks());

  it("updates only the given fields, never touching advisor_contact_id or status", async () => {
    const mock = makeChainableQueryMock({ data: HEADER_DB_ROW, error: null });
    (eventService.emit as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true, data: {} });

    const result = await RepairOrdersService.updateHeader(
      mock as never,
      "org-1",
      "branch-1",
      "user-1",
      "ro-1",
      { vin: "NEWVIN" }
    );

    expect(result.success).toBe(true);
    const updateCall = mock.calls.find((c) => c.method === "update");
    expect(updateCall?.args[0]).toEqual({ vin: "NEWVIN" });
  });

  it("re-derives identity_status from zl_number's presence when zl_number is included in the patch", async () => {
    const mock = makeChainableQueryMock({ data: HEADER_DB_ROW, error: null });
    (eventService.emit as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true, data: {} });

    await RepairOrdersService.updateHeader(mock as never, "org-1", "branch-1", "user-1", "ro-1", {
      zl_number: null,
    });

    const updateCall = mock.calls.find((c) => c.method === "update");
    expect(updateCall?.args[0]).toMatchObject({ zl_number: null, identity_status: "unresolved" });
  });

  it("returns a clear error (not a raw RLS message) when the row is not found/not authorized (0 rows affected)", async () => {
    const mock = makeChainableQueryMock({ data: null, error: null });

    const result = await RepairOrdersService.updateHeader(
      mock as never,
      "org-1",
      "branch-1",
      "user-1",
      "ro-missing",
      { vin: "X" }
    );

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toMatch(
      /not found|not authorized/i
    );
  });

  it("maps a 23505 unique-constraint violation to a clear duplicate-zl_number error", async () => {
    const mock = makeChainableQueryMock({
      data: null,
      error: {
        code: "23505",
        message: 'duplicate key value violates unique constraint "repair_orders_identity_unique"',
      },
    });

    const result = await RepairOrdersService.updateHeader(
      mock as never,
      "org-1",
      "branch-1",
      "user-1",
      "ro-1",
      { zl_number: "ZL/DUP" }
    );

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toContain("already exists");
  });
});

describe("RepairOrdersService.assignAdvisor", () => {
  beforeEach(() => vi.clearAllMocks());

  it("updates only advisor_contact_id and emits workshop.repair_orders.advisor_assigned", async () => {
    const mock = makeChainableQueryMock({ data: HEADER_DB_ROW, error: null });
    (eventService.emit as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true, data: {} });

    const result = await RepairOrdersService.assignAdvisor(
      mock as never,
      "org-1",
      "branch-1",
      "user-1",
      "ro-1",
      "contact-2"
    );

    expect(result.success).toBe(true);
    const updateCall = mock.calls.find((c) => c.method === "update");
    expect(updateCall?.args[0]).toEqual({ advisor_contact_id: "contact-2" });
    expect(eventService.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        actionKey: "workshop.repair_orders.advisor_assigned",
        metadata: { advisorContactId: "contact-2" },
      })
    );
  });

  it("allows clearing the advisor (null)", async () => {
    const mock = makeChainableQueryMock({ data: HEADER_DB_ROW, error: null });
    (eventService.emit as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true, data: {} });

    await RepairOrdersService.assignAdvisor(
      mock as never,
      "org-1",
      "branch-1",
      "user-1",
      "ro-1",
      null
    );

    const updateCall = mock.calls.find((c) => c.method === "update");
    expect(updateCall?.args[0]).toEqual({ advisor_contact_id: null });
  });

  it("returns a clear error when RLS blocks the reassignment (0 rows affected)", async () => {
    const mock = makeChainableQueryMock({ data: null, error: null });

    const result = await RepairOrdersService.assignAdvisor(
      mock as never,
      "org-1",
      "branch-1",
      "user-1",
      "ro-1",
      "contact-2"
    );

    expect(result.success).toBe(false);
  });
});

describe("RepairOrdersService.changeStatus", () => {
  beforeEach(() => vi.clearAllMocks());

  it("performs a race-safe conditional update keyed on the CURRENT status matching fromStatus", async () => {
    const mock = makeChainableQueryMock({
      data: { ...HEADER_DB_ROW, status: "closed" },
      error: null,
    });
    (eventService.emit as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true, data: {} });

    const result = await RepairOrdersService.changeStatus(
      mock as never,
      "org-1",
      "branch-1",
      "user-1",
      "ro-1",
      "open",
      "closed"
    );

    expect(result.success).toBe(true);
    const updateCall = mock.calls.find((c) => c.method === "update");
    expect(updateCall?.args[0]).toEqual({ status: "closed" });
    const eqCalls = mock.calls.filter((c) => c.method === "eq");
    expect(eqCalls).toContainEqual({ method: "eq", args: ["status", "open"] });
    expect(eventService.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        actionKey: "workshop.repair_orders.status_changed",
        metadata: { previousStatus: "open", newStatus: "closed" },
      })
    );
  });

  it("returns a specific conflict error (not a generic failure) when 0 rows match -- the status already changed under a concurrent caller", async () => {
    const mock = makeChainableQueryMock({ data: null, error: null });

    const result = await RepairOrdersService.changeStatus(
      mock as never,
      "org-1",
      "branch-1",
      "user-1",
      "ro-1",
      "open",
      "closed"
    );

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toMatch(/expected status/i);
  });
});

describe("RepairOrdersService.listAdvisorCandidates", () => {
  it("scopes to org, excludes soft-deleted rows, and only includes contacts already linked to a real user (linked_user_id IS NOT NULL)", async () => {
    const mock = makeChainableQueryMock({
      data: [{ id: "contact-1", display_name: "Jane Advisor" }],
      error: null,
    });

    const result = await RepairOrdersService.listAdvisorCandidates(mock as never, "org-1");

    expect(result).toEqual({
      success: true,
      data: [{ id: "contact-1", displayName: "Jane Advisor" }],
    });
    const notCall = mock.calls.find((c) => c.method === "not");
    expect(notCall?.args).toEqual(["linked_user_id", "is", null]);
  });
});

/**
 * Correction pass Finding A (CONFIRMED, fixed): getOwnAdvisorContactId now
 * calls the get_own_advisor_contact_id(p_organization_id) RPC -- a
 * SECURITY DEFINER function that bypasses crm_contacts' own RLS -- instead
 * of a plain authenticated SELECT against crm_contacts, which was itself
 * subject to that RLS (requiring a separate crm.contacts.read grant the
 * caller may not hold) and silently returned nothing even for a genuine
 * self-linked contact. Live-reproduced and fixed; see
 * 094_repair_orders_correction_pass_rls_test.sql T1/T2 for the live-RLS
 * proof. These tests cover the service-layer RPC-calling contract.
 */
describe("RepairOrdersService.getOwnAdvisorContactId", () => {
  function makeRpcMock(result: { data: unknown; error: unknown }) {
    const rpc = vi.fn().mockResolvedValue(result);
    return { mock: { rpc } as unknown as import("@supabase/supabase-js").SupabaseClient, rpc };
  }

  it("calls the get_own_advisor_contact_id RPC with the org id, never the raw crm_contacts table", async () => {
    const { mock, rpc } = makeRpcMock({ data: "contact-1", error: null });

    const result = await RepairOrdersService.getOwnAdvisorContactId(mock, "org-1");

    expect(result).toEqual({ success: true, data: "contact-1" });
    expect(rpc).toHaveBeenCalledWith("get_own_advisor_contact_id", { p_organization_id: "org-1" });
  });

  it("returns null (not an error) when the caller has no linked contact", async () => {
    const { mock } = makeRpcMock({ data: null, error: null });

    const result = await RepairOrdersService.getOwnAdvisorContactId(mock, "org-1");

    expect(result).toEqual({ success: true, data: null });
  });

  it("normalizes an unexpected RPC error to a generic safe message, not the raw error text", async () => {
    const { mock } = makeRpcMock({
      data: null,
      error: { code: "XX000", message: "connection terminated unexpectedly" },
    });

    const result = await RepairOrdersService.getOwnAdvisorContactId(mock, "org-1");

    expect(result.success).toBe(false);
    const error = (result as { success: false; error: string }).error;
    expect(error).not.toContain("connection terminated");
  });
});

/**
 * Correction pass Finding E (CONFIRMED, fixed): every Phase 7 plain-CRUD
 * method previously returned raw `error.message` for any non-23505
 * failure. normalizeRepairOrderCrudError (used by all five methods below)
 * now logs the full error server-side and returns one generic, safe
 * message for anything outside its small, curated allowlist (duplicate
 * zl_number; cross-org/invalid advisor_contact_id FK violation).
 */
describe("RepairOrdersService error normalization (Finding E)", () => {
  const ORIGINAL_CONSOLE_ERROR = console.error;
  beforeEach(() => {
    console.error = vi.fn();
  });
  afterEach(() => {
    console.error = ORIGINAL_CONSOLE_ERROR;
  });

  it("createRepairOrder: an unexpected RLS/constraint error is replaced with a generic message, not leaked verbatim", async () => {
    const mock = makeChainableQueryMock({
      data: null,
      error: {
        code: "42501",
        message: 'new row violates row-level security policy for table "repair_orders"',
      },
    });

    const result = await RepairOrdersService.createRepairOrder(
      mock as never,
      "org-1",
      "branch-1",
      "user-1",
      {}
    );

    expect(result.success).toBe(false);
    const error = (result as { success: false; error: string }).error;
    expect(error).not.toContain("row-level security");
    expect(error).not.toContain("repair_orders");
  });

  it("createRepairOrder: a cross-org/invalid advisor FK violation gets a clear, specific, non-leaking message", async () => {
    const mock = makeChainableQueryMock({
      data: null,
      error: {
        code: "23503",
        message:
          'insert or update on table "repair_orders" violates foreign key constraint "repair_orders_advisor_contact_id_fkey"',
      },
    });

    const result = await RepairOrdersService.createRepairOrder(
      mock as never,
      "org-1",
      "branch-1",
      "user-1",
      { advisor_contact_id: "22222222-2222-2222-2222-222222222222" }
    );

    expect(result.success).toBe(false);
    const error = (result as { success: false; error: string }).error;
    expect(error).toContain("advisor");
    expect(error).not.toContain("constraint");
    expect(error).not.toContain("foreign key");
  });

  it("createRepairOrder: the duplicate-zl_number 23505 case is still specifically labeled, not swallowed by the generic fallback", async () => {
    const mock = makeChainableQueryMock({
      data: null,
      error: {
        code: "23505",
        message: 'duplicate key value violates unique constraint "repair_orders_identity_unique"',
      },
    });

    const result = await RepairOrdersService.createRepairOrder(
      mock as never,
      "org-1",
      "branch-1",
      "user-1",
      { zl_number: "ZL/DUP" }
    );

    expect(result).toEqual({
      success: false,
      error: "A RepairOrder with this ZL number already exists in this branch",
    });
  });

  it("createRepairOrder: a 23505 on a DIFFERENT, unrelated constraint is NOT mislabeled as duplicate zl_number", async () => {
    const mock = makeChainableQueryMock({
      data: null,
      error: {
        code: "23505",
        message: 'duplicate key value violates unique constraint "repair_orders_pkey"',
      },
    });

    const result = await RepairOrdersService.createRepairOrder(
      mock as never,
      "org-1",
      "branch-1",
      "user-1",
      {}
    );

    expect(result.success).toBe(false);
    const error = (result as { success: false; error: string }).error;
    expect(error).not.toContain("ZL number");
  });

  it("assignAdvisor: a cross-org/invalid advisor FK violation gets the same clear, specific message", async () => {
    const mock = makeChainableQueryMock({
      data: null,
      error: {
        code: "23503",
        message:
          'insert or update on table "repair_orders" violates foreign key constraint "repair_orders_advisor_contact_id_fkey"',
      },
    });

    const result = await RepairOrdersService.assignAdvisor(
      mock as never,
      "org-1",
      "branch-1",
      "user-1",
      "ro-1",
      "22222222-2222-2222-2222-222222222222"
    );

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toContain("advisor");
  });

  it("changeStatus: an unexpected error is replaced with a generic message", async () => {
    const mock = makeChainableQueryMock({
      data: null,
      error: { code: "XX000", message: "connection terminated unexpectedly" },
    });

    const result = await RepairOrdersService.changeStatus(
      mock as never,
      "org-1",
      "branch-1",
      "user-1",
      "ro-1",
      "open",
      "closed"
    );

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).not.toBe(
      "connection terminated unexpectedly"
    );
  });

  it("listAdvisorCandidates: an unexpected error is replaced with a generic message", async () => {
    const mock = makeChainableQueryMock({
      data: null,
      error: { code: "XX000", message: "connection terminated unexpectedly" },
    });

    const result = await RepairOrdersService.listAdvisorCandidates(mock as never, "org-1");

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).not.toBe(
      "connection terminated unexpectedly"
    );
  });
});

/**
 * Phase 8: RepairOrdersService.listRepairOrderLines -- the logical
 * RepairOrderLine read model. Every test here uses makeTableQueryMock
 * (already established above for getMaterializationStatusForSession) since
 * this method makes two sequential `.from()` calls: a parent-scope check
 * against `repair_orders`, then the lines query against `repair_order_lines`
 * with a nested `repair_order_line_movement_links` embed.
 */
describe("RepairOrdersService.listRepairOrderLines", () => {
  const PARENT_FOUND = { data: { id: "ro-1" }, error: null };

  function lineRow(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      id: "line-1",
      variant_id: null,
      product_code: "5WA-857-093",
      product_name: "Front bumper cover",
      ordered_quantity: 5,
      unit: "pcs",
      status: "pending",
      repair_order_line_movement_links: [],
      ...overrides,
    };
  }

  it("lists logical RepairOrder lines, mapped to the domain shape", async () => {
    const mock = makeTableQueryMock({
      repair_orders: PARENT_FOUND,
      repair_order_lines: { data: [lineRow()], error: null },
    });

    const result = await RepairOrdersService.listRepairOrderLines(
      mock as never,
      "org-1",
      "branch-1",
      "ro-1"
    );

    expect(result).toEqual({
      success: true,
      data: [
        {
          id: "line-1",
          repairOrderId: "ro-1",
          variantId: null,
          sku: "5WA-857-093",
          productName: "Front bumper cover",
          orderedQuantity: 5,
          unit: "pcs",
          receivedQuantity: 0,
          issuedQuantity: 0,
          outstandingToReceive: 5,
          availableForIssue: 0,
          status: "pending",
        },
      ],
    });
  });

  it("the list is not grouped by source document -- the query never selects/joins workshop_source_documents at all", async () => {
    const mock = makeTableQueryMock({
      repair_orders: PARENT_FOUND,
      repair_order_lines: { data: [lineRow()], error: null },
    });

    await RepairOrdersService.listRepairOrderLines(mock as never, "org-1", "branch-1", "ro-1");

    const selectCall = mock.callsByTable["repair_order_lines"]?.find((c) => c.method === "select");
    const selectArg = selectCall?.args[0] as string;
    expect(selectArg).not.toContain("workshop_source_document");
    expect(selectArg).not.toContain("source_document");
  });

  it("same-SKU different lines remain distinct -- never merged or cross-attributed by product_code", async () => {
    const mock = makeTableQueryMock({
      repair_orders: PARENT_FOUND,
      repair_order_lines: {
        data: [
          lineRow({
            id: "line-A",
            product_code: "SKU-X",
            ordered_quantity: 2,
            repair_order_line_movement_links: [{ applied_quantity: 2, relation_type: "receipt" }],
          }),
          lineRow({
            id: "line-B",
            product_code: "SKU-X",
            ordered_quantity: 3,
            repair_order_line_movement_links: [{ applied_quantity: 1, relation_type: "receipt" }],
          }),
        ],
        error: null,
      },
    });

    const result = await RepairOrdersService.listRepairOrderLines(
      mock as never,
      "org-1",
      "branch-1",
      "ro-1"
    );

    expect(result.success).toBe(true);
    const lines = (
      result as {
        success: true;
        data: Array<{ id: string; sku: string; orderedQuantity: number; receivedQuantity: number }>;
      }
    ).data;

    expect(lines).toHaveLength(2);
    const lineA = lines.find((l) => l.id === "line-A")!;
    const lineB = lines.find((l) => l.id === "line-B")!;
    expect(lineA.sku).toBe("SKU-X");
    expect(lineB.sku).toBe("SKU-X");
    // Independent quantities -- never summed into one SKU-X row (would be
    // orderedQuantity: 5, receivedQuantity: 3 if wrongly merged).
    expect(lineA.orderedQuantity).toBe(2);
    expect(lineA.receivedQuantity).toBe(2);
    expect(lineB.orderedQuantity).toBe(3);
    expect(lineB.receivedQuantity).toBe(1);
  });

  it("quantity worked example: ordered=5, receipts 2+2+1=5, issues 2+1=3 -> outstandingToReceive=0, availableForIssue=2", async () => {
    const mock = makeTableQueryMock({
      repair_orders: PARENT_FOUND,
      repair_order_lines: {
        data: [
          lineRow({
            ordered_quantity: 5,
            repair_order_line_movement_links: [
              { applied_quantity: 2, relation_type: "receipt" },
              { applied_quantity: 2, relation_type: "receipt" },
              { applied_quantity: 1, relation_type: "receipt" },
              { applied_quantity: 2, relation_type: "issue" },
              { applied_quantity: 1, relation_type: "issue" },
            ],
          }),
        ],
        error: null,
      },
    });

    const result = await RepairOrdersService.listRepairOrderLines(
      mock as never,
      "org-1",
      "branch-1",
      "ro-1"
    );

    expect(result.success).toBe(true);
    const [line] = (result as { success: true; data: RepairOrderLineReadModel[] }).data;
    expect(line.receivedQuantity).toBe(5);
    expect(line.issuedQuantity).toBe(3);
    expect(line.outstandingToReceive).toBe(0);
    expect(line.availableForIssue).toBe(2);
  });

  it("one line can aggregate many receipt links (3 receipts summed correctly)", async () => {
    const mock = makeTableQueryMock({
      repair_orders: PARENT_FOUND,
      repair_order_lines: {
        data: [
          lineRow({
            repair_order_line_movement_links: [
              { applied_quantity: 2, relation_type: "receipt" },
              { applied_quantity: 2, relation_type: "receipt" },
              { applied_quantity: 1, relation_type: "receipt" },
            ],
          }),
        ],
        error: null,
      },
    });

    const result = await RepairOrdersService.listRepairOrderLines(
      mock as never,
      "org-1",
      "branch-1",
      "ro-1"
    );

    const [line] = (result as { success: true; data: RepairOrderLineReadModel[] }).data;
    expect(line.receivedQuantity).toBe(5);
  });

  it("one line can aggregate many issue links (2 issues summed correctly)", async () => {
    const mock = makeTableQueryMock({
      repair_orders: PARENT_FOUND,
      repair_order_lines: {
        data: [
          lineRow({
            repair_order_line_movement_links: [
              { applied_quantity: 2, relation_type: "issue" },
              { applied_quantity: 1, relation_type: "issue" },
            ],
          }),
        ],
        error: null,
      },
    });

    const result = await RepairOrdersService.listRepairOrderLines(
      mock as never,
      "org-1",
      "branch-1",
      "ro-1"
    );

    const [line] = (result as { success: true; data: RepairOrderLineReadModel[] }).data;
    expect(line.issuedQuantity).toBe(3);
  });

  it("no movement links -> zero derived quantities (received=0, issued=0, outstanding=ordered, available=0)", async () => {
    const mock = makeTableQueryMock({
      repair_orders: PARENT_FOUND,
      repair_order_lines: {
        data: [lineRow({ ordered_quantity: 7, repair_order_line_movement_links: [] })],
        error: null,
      },
    });

    const result = await RepairOrdersService.listRepairOrderLines(
      mock as never,
      "org-1",
      "branch-1",
      "ro-1"
    );

    const [line] = (result as { success: true; data: RepairOrderLineReadModel[] }).data;
    expect(line.receivedQuantity).toBe(0);
    expect(line.issuedQuantity).toBe(0);
    expect(line.outstandingToReceive).toBe(7);
    expect(line.availableForIssue).toBe(0);
  });

  it("'reversal' relation_type rows are excluded from both received and issued sums (disclosed limitation, not netted)", async () => {
    const mock = makeTableQueryMock({
      repair_orders: PARENT_FOUND,
      repair_order_lines: {
        data: [
          lineRow({
            repair_order_line_movement_links: [
              { applied_quantity: 5, relation_type: "receipt" },
              { applied_quantity: 3, relation_type: "reversal" },
            ],
          }),
        ],
        error: null,
      },
    });

    const result = await RepairOrdersService.listRepairOrderLines(
      mock as never,
      "org-1",
      "branch-1",
      "ro-1"
    );

    const [line] = (result as { success: true; data: RepairOrderLineReadModel[] }).data;
    // 'reversal' neither adds to nor subtracts from receivedQuantity today.
    expect(line.receivedQuantity).toBe(5);
  });

  it("scopes the parent check by organization_id AND branch_id (branch isolation)", async () => {
    const mock = makeTableQueryMock({
      repair_orders: PARENT_FOUND,
      repair_order_lines: { data: [], error: null },
    });

    await RepairOrdersService.listRepairOrderLines(mock as never, "org-1", "branch-1", "ro-1");

    const eqCalls = (mock.callsByTable["repair_orders"] ?? [])
      .filter((c) => c.method === "eq")
      .map((c) => c.args);
    expect(eqCalls).toContainEqual(["organization_id", "org-1"]);
    expect(eqCalls).toContainEqual(["branch_id", "branch-1"]);
  });

  it("parent RepairOrder not accessible (wrong org/branch, not found, or soft-deleted) -> lines are not exposed, and the lines table is never even queried", async () => {
    const mock = makeTableQueryMock({
      repair_orders: { data: null, error: null },
      // Deliberately no repair_order_lines entry -- if the method queried
      // it anyway, makeTableQueryMock's default { data: null, error: null }
      // would still make this assertion pass for the wrong reason, so we
      // additionally assert the table was never queried at all below.
    });

    const result = await RepairOrdersService.listRepairOrderLines(
      mock as never,
      "org-1",
      "branch-1",
      "ro-missing"
    );

    expect(result).toEqual({ success: true, data: [] });
    expect(mock.from).not.toHaveBeenCalledWith("repair_order_lines");
  });

  it("error normalization: an unexpected error on the parent check is replaced with a generic message, not leaked raw", async () => {
    const mock = makeTableQueryMock({
      repair_orders: {
        data: null,
        error: { code: "XX000", message: "connection terminated unexpectedly" },
      },
    });

    const result = await RepairOrdersService.listRepairOrderLines(
      mock as never,
      "org-1",
      "branch-1",
      "ro-1"
    );

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).not.toBe(
      "connection terminated unexpectedly"
    );
  });

  it("error normalization: an unexpected error on the lines query is replaced with a generic message, not leaked raw", async () => {
    const mock = makeTableQueryMock({
      repair_orders: PARENT_FOUND,
      repair_order_lines: {
        data: null,
        error: { code: "XX000", message: "connection terminated unexpectedly" },
      },
    });

    const result = await RepairOrdersService.listRepairOrderLines(
      mock as never,
      "org-1",
      "branch-1",
      "ro-1"
    );

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).not.toBe(
      "connection terminated unexpectedly"
    );
  });
});

/**
 * Phase 9: RepairOrdersService.getRepairOrderProvenance -- source-document/
 * source-line provenance, explicitly distinct from Phase 8's logical-line
 * list. Uses makeTableQueryMock (repair_orders parent check +
 * repair_order_source_document_links main query), matching
 * listRepairOrderLines' own established two-`.from()`-calls test pattern.
 */
describe("RepairOrdersService.getRepairOrderProvenance", () => {
  const PARENT_FOUND = { data: { id: "ro-1" }, error: null };

  function linkRow(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      workshop_source_document_id: "doc-1",
      linked_at: "2026-09-10T10:00:00.000Z",
      document: {
        id: "doc-1",
        document_type: "zl",
        external_document_number: "ZL/90001/26/3252/BL",
        source_session_id: "session-1",
        official_warehouse_code: "BL",
        created_at: "2026-09-10T09:00:00.000Z",
        lines: [],
      },
      ...overrides,
    };
  }

  function sourceLine(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      id: "docline-1",
      product_code: "5WA-857-093",
      product_name: "Front bumper cover",
      quantity: 2,
      unit: "pcs",
      raw_text: "5WA 857 093  front bumper  2 pcs",
      wdd_matcher_line_id: "wdd-line-1",
      line_links: [],
      ...overrides,
    };
  }

  it("lists provenance documents with nested source lines and contributions, mapped to the domain shape", async () => {
    const mock = makeTableQueryMock({
      repair_orders: PARENT_FOUND,
      repair_order_lines: { data: [{ id: "line-1" }], error: null },
      repair_order_source_document_links: {
        data: [
          linkRow({
            document: {
              id: "doc-1",
              document_type: "zl",
              external_document_number: "ZL/90001/26/3252/BL",
              source_session_id: "session-1",
              official_warehouse_code: "BL",
              created_at: "2026-09-10T09:00:00.000Z",
              lines: [
                sourceLine({
                  line_links: [
                    {
                      repair_order_line_id: "line-1",
                      quantity_contribution: 2,
                      linked_at: "2026-09-10T10:01:00.000Z",
                    },
                  ],
                }),
              ],
            },
          }),
        ],
        error: null,
      },
    });

    const result = await RepairOrdersService.getRepairOrderProvenance(
      mock as never,
      "org-1",
      "branch-1",
      "ro-1"
    );

    expect(result).toEqual({
      success: true,
      data: [
        {
          id: "doc-1",
          documentType: "zl",
          externalDocumentNumber: "ZL/90001/26/3252/BL",
          sourceSessionId: "session-1",
          officialWarehouseCode: "BL",
          createdAt: "2026-09-10T09:00:00.000Z",
          linkedAt: "2026-09-10T10:00:00.000Z",
          lines: [
            {
              id: "docline-1",
              productCode: "5WA-857-093",
              productName: "Front bumper cover",
              quantity: 2,
              unit: "pcs",
              rawText: "5WA 857 093  front bumper  2 pcs",
              wddMatcherLineId: "wdd-line-1",
              contributions: [
                {
                  repairOrderLineId: "line-1",
                  quantityContribution: 2,
                  linkedAt: "2026-09-10T10:01:00.000Z",
                },
              ],
            },
          ],
        },
      ],
    });
  });

  it("one RepairOrder -> many source documents: both appear, in linked_at order", async () => {
    const mock = makeTableQueryMock({
      repair_orders: PARENT_FOUND,
      repair_order_source_document_links: {
        data: [
          linkRow({
            workshop_source_document_id: "doc-1",
            document: { ...linkRow().document, id: "doc-1" },
          }),
          linkRow({
            workshop_source_document_id: "doc-2",
            linked_at: "2026-09-11T10:00:00.000Z",
            document: { ...linkRow().document, id: "doc-2", external_document_number: "ZW/900" },
          }),
        ],
        error: null,
      },
    });

    const result = await RepairOrdersService.getRepairOrderProvenance(
      mock as never,
      "org-1",
      "branch-1",
      "ro-1"
    );

    expect(result.success).toBe(true);
    const docs = (result as { success: true; data: RepairOrderProvenanceDocument[] }).data;
    expect(docs.map((d) => d.id)).toEqual(["doc-1", "doc-2"]);
  });

  it("scopes the query to this RepairOrder's own document links only (never cross-order)", async () => {
    const mock = makeTableQueryMock({
      repair_orders: PARENT_FOUND,
      repair_order_source_document_links: { data: [], error: null },
    });

    await RepairOrdersService.getRepairOrderProvenance(mock as never, "org-1", "branch-1", "ro-1");

    const eqCalls = (mock.callsByTable["repair_order_source_document_links"] ?? [])
      .filter((c) => c.method === "eq")
      .map((c) => c.args);
    expect(eqCalls).toContainEqual(["repair_order_id", "ro-1"]);
  });

  it("one logical line -> many source lines: quantity_contribution preserved exactly for each, never summed/collapsed", async () => {
    const mock = makeTableQueryMock({
      repair_orders: PARENT_FOUND,
      repair_order_lines: { data: [{ id: "line-1" }], error: null },
      repair_order_source_document_links: {
        data: [
          linkRow({
            document: {
              ...linkRow().document,
              lines: [
                sourceLine({
                  id: "docline-A",
                  line_links: [
                    { repair_order_line_id: "line-1", quantity_contribution: 2, linked_at: "t1" },
                  ],
                }),
                sourceLine({
                  id: "docline-B",
                  line_links: [
                    { repair_order_line_id: "line-1", quantity_contribution: 3, linked_at: "t2" },
                  ],
                }),
              ],
            },
          }),
        ],
        error: null,
      },
    });

    const result = await RepairOrdersService.getRepairOrderProvenance(
      mock as never,
      "org-1",
      "branch-1",
      "ro-1"
    );

    expect(result.success).toBe(true);
    const docs = (result as { success: true; data: RepairOrderProvenanceDocument[] }).data;
    const sources = groupProvenanceByRepairOrderLine(docs, "line-1");

    expect(sources).toHaveLength(2);
    expect(sources.map((s) => s.contribution.quantityContribution).sort()).toEqual([2, 3]);
    // Never summed into one contribution of 5.
    expect(sources.some((s) => s.contribution.quantityContribution === 5)).toBe(false);
  });

  it("same-SKU source lines do not cross logical-line boundaries when grouped by line", async () => {
    const mock = makeTableQueryMock({
      repair_orders: PARENT_FOUND,
      repair_order_lines: { data: [{ id: "line-A" }, { id: "line-B" }], error: null },
      repair_order_source_document_links: {
        data: [
          linkRow({
            document: {
              ...linkRow().document,
              lines: [
                sourceLine({
                  id: "docline-A",
                  product_code: "SKU-X",
                  line_links: [
                    { repair_order_line_id: "line-A", quantity_contribution: 2, linked_at: "t1" },
                  ],
                }),
                sourceLine({
                  id: "docline-B",
                  product_code: "SKU-X",
                  line_links: [
                    { repair_order_line_id: "line-B", quantity_contribution: 3, linked_at: "t2" },
                  ],
                }),
              ],
            },
          }),
        ],
        error: null,
      },
    });

    const result = await RepairOrdersService.getRepairOrderProvenance(
      mock as never,
      "org-1",
      "branch-1",
      "ro-1"
    );

    const docs = (result as { success: true; data: RepairOrderProvenanceDocument[] }).data;
    const sourcesForA = groupProvenanceByRepairOrderLine(docs, "line-A");
    const sourcesForB = groupProvenanceByRepairOrderLine(docs, "line-B");

    expect(sourcesForA).toHaveLength(1);
    expect(sourcesForA[0].contribution.quantityContribution).toBe(2);
    expect(sourcesForB).toHaveLength(1);
    expect(sourcesForB[0].contribution.quantityContribution).toBe(3);
  });

  /**
   * CASE A (document M:N, cross-order leak): a source document shared
   * between TWO RepairOrders must never leak one order's own source-line
   * CONTENT (not just its contribution reference) into the other's
   * provenance view. Reproduces the exact scenario found and fixed above
   * -- doc-1 has two lines, docline-mine contributing to THIS order's own
   * line-mine, and docline-theirs contributing ONLY to a DIFFERENT order's
   * line-theirs (not in this order's owned-line set).
   *
   * External-review Finding (2026-09-12, CONFIRMED, fixed): the original
   * fix only emptied `theirs.contributions` -- the source line ITSELF
   * (SKU/product name/quantity/unit/wddMatcherLineId) still leaked through.
   * This test now asserts the foreign line is entirely ABSENT, not merely
   * "present with an empty contributions array".
   */
  it("a document shared with another RepairOrder does not leak that other order's source-line content (cross-order metadata leak fix)", async () => {
    const mock = makeTableQueryMock({
      repair_orders: PARENT_FOUND,
      // This RepairOrder owns only "line-mine" -- "line-theirs" belongs to
      // a different RepairOrder entirely.
      repair_order_lines: { data: [{ id: "line-mine" }], error: null },
      repair_order_source_document_links: {
        data: [
          linkRow({
            document: {
              ...linkRow().document,
              lines: [
                sourceLine({
                  id: "docline-mine",
                  product_code: "SKU-MINE",
                  product_name: "My own part",
                  wdd_matcher_line_id: "wdd-mine",
                  line_links: [
                    {
                      repair_order_line_id: "line-mine",
                      quantity_contribution: 2,
                      linked_at: "t1",
                    },
                  ],
                }),
                sourceLine({
                  id: "docline-theirs",
                  product_code: "SKU-THEIRS",
                  product_name: "Their part",
                  quantity: 4,
                  wdd_matcher_line_id: "wdd-theirs",
                  line_links: [
                    {
                      repair_order_line_id: "line-theirs",
                      quantity_contribution: 4,
                      linked_at: "t2",
                    },
                  ],
                }),
              ],
            },
          }),
        ],
        error: null,
      },
    });

    const result = await RepairOrdersService.getRepairOrderProvenance(
      mock as never,
      "org-1",
      "branch-1",
      "ro-1"
    );

    expect(result.success).toBe(true);
    const docs = (result as { success: true; data: RepairOrderProvenanceDocument[] }).data;
    const docLines = docs[0].lines;

    // Only "docline-mine" is present -- "docline-theirs" is omitted
    // entirely, not present-with-empty-contributions.
    expect(docLines).toHaveLength(1);
    expect(docLines[0].id).toBe("docline-mine");
    expect(docLines[0].contributions).toEqual([
      { repairOrderLineId: "line-mine", quantityContribution: 2, linkedAt: "t1" },
    ]);

    // None of the foreign line's own metadata is exposed anywhere in the
    // response -- not the source line itself, not its SKU, product name,
    // quantity, wddMatcherLineId, or the foreign repair_order_line_id.
    const serialized = JSON.stringify(docs);
    expect(serialized).not.toContain("docline-theirs");
    expect(serialized).not.toContain("SKU-THEIRS");
    expect(serialized).not.toContain("Their part");
    expect(serialized).not.toContain("wdd-theirs");
    expect(serialized).not.toContain("line-theirs");
  });

  /**
   * Inverse of CASE A: reading provenance FOR RepairOrder B (the "theirs"
   * side) must symmetrically show only line-theirs and never line-mine's
   * content -- proving the fix is not one-directional.
   */
  it("the inverse case: RepairOrder B's own provenance shows only its own line, never RepairOrder A's", async () => {
    const mock = makeTableQueryMock({
      repair_orders: PARENT_FOUND,
      repair_order_lines: { data: [{ id: "line-theirs" }], error: null },
      repair_order_source_document_links: {
        data: [
          linkRow({
            document: {
              ...linkRow().document,
              lines: [
                sourceLine({
                  id: "docline-mine",
                  product_code: "SKU-MINE",
                  line_links: [
                    {
                      repair_order_line_id: "line-mine",
                      quantity_contribution: 2,
                      linked_at: "t1",
                    },
                  ],
                }),
                sourceLine({
                  id: "docline-theirs",
                  product_code: "SKU-THEIRS",
                  line_links: [
                    {
                      repair_order_line_id: "line-theirs",
                      quantity_contribution: 4,
                      linked_at: "t2",
                    },
                  ],
                }),
              ],
            },
          }),
        ],
        error: null,
      },
    });

    const result = await RepairOrdersService.getRepairOrderProvenance(
      mock as never,
      "org-1",
      "branch-1",
      "ro-2"
    );

    const docs = (result as { success: true; data: RepairOrderProvenanceDocument[] }).data;
    expect(docs[0].lines).toHaveLength(1);
    expect(docs[0].lines[0].id).toBe("docline-theirs");
    expect(JSON.stringify(docs)).not.toContain("docline-mine");
    expect(JSON.stringify(docs)).not.toContain("SKU-MINE");
  });

  /**
   * External-review Finding, point 3: a source line with ZERO
   * contributions to THIS RepairOrder is not provenance of this
   * RepairOrder -- omitted entirely, never fabricated into the tree as an
   * "unlinked" placeholder. This applies whether the line was never linked
   * to anything at all, or (proven separately above) linked only to a
   * different order.
   */
  it("a source line with zero contributions to this RepairOrder (never linked to anything) is OMITTED from this RepairOrder's provenance", async () => {
    const mock = makeTableQueryMock({
      repair_orders: PARENT_FOUND,
      repair_order_source_document_links: {
        data: [
          linkRow({
            document: {
              ...linkRow().document,
              lines: [sourceLine({ line_links: [] })],
            },
          }),
        ],
        error: null,
      },
    });

    const result = await RepairOrdersService.getRepairOrderProvenance(
      mock as never,
      "org-1",
      "branch-1",
      "ro-1"
    );

    const docs = (result as { success: true; data: RepairOrderProvenanceDocument[] }).data;
    // The document itself is still returned (a real, genuine link), but
    // with zero lines -- the never-linked line is not fabricated into it.
    expect(docs).toHaveLength(1);
    expect(docs[0].lines).toEqual([]);
  });

  /**
   * A shared document may legitimately be linked to THIS RepairOrder while
   * (after correct per-order line scoping) yielding zero visible lines --
   * e.g. every one of its lines belongs to a DIFFERENT order it is also
   * shared with. The document-level link itself is real, genuine
   * provenance and must NOT be silently dropped just because none of its
   * lines happen to belong to this specific order.
   */
  it("a document linked to this RepairOrder with zero own-order visible lines is still returned (document-level link is real provenance)", async () => {
    const mock = makeTableQueryMock({
      repair_orders: PARENT_FOUND,
      // This order owns no lines at all in this fixture -- every line in
      // the shared document below belongs to some other order.
      repair_order_lines: { data: [], error: null },
      repair_order_source_document_links: {
        data: [
          linkRow({
            document: {
              ...linkRow().document,
              id: "doc-shared-no-own-lines",
              lines: [
                sourceLine({
                  id: "docline-foreign",
                  line_links: [
                    {
                      repair_order_line_id: "line-belongs-elsewhere",
                      quantity_contribution: 1,
                      linked_at: "t1",
                    },
                  ],
                }),
              ],
            },
          }),
        ],
        error: null,
      },
    });

    const result = await RepairOrdersService.getRepairOrderProvenance(
      mock as never,
      "org-1",
      "branch-1",
      "ro-1"
    );

    const docs = (result as { success: true; data: RepairOrderProvenanceDocument[] }).data;
    expect(docs).toHaveLength(1);
    expect(docs[0].id).toBe("doc-shared-no-own-lines");
    expect(docs[0].lines).toEqual([]);
  });

  it("does not fabricate a wddMatcherLineId or join wdd_matcher_lines content -- exposes only the raw id reference, or null, for a line that genuinely belongs to this order", async () => {
    const mock = makeTableQueryMock({
      repair_orders: PARENT_FOUND,
      repair_order_lines: { data: [{ id: "line-1" }], error: null },
      repair_order_source_document_links: {
        data: [
          linkRow({
            document: {
              ...linkRow().document,
              lines: [
                sourceLine({
                  wdd_matcher_line_id: null,
                  line_links: [
                    { repair_order_line_id: "line-1", quantity_contribution: 2, linked_at: "t1" },
                  ],
                }),
              ],
            },
          }),
        ],
        error: null,
      },
    });

    const result = await RepairOrdersService.getRepairOrderProvenance(
      mock as never,
      "org-1",
      "branch-1",
      "ro-1"
    );

    const docs = (result as { success: true; data: RepairOrderProvenanceDocument[] }).data;
    expect(docs[0].lines).toHaveLength(1);
    expect(docs[0].lines[0].wddMatcherLineId).toBeNull();
  });

  it("inaccessible parent RepairOrder (wrong org/branch, not found, or soft-deleted) -> empty provenance, no error, no leak, and the link table is never even queried", async () => {
    const mock = makeTableQueryMock({
      repair_orders: { data: null, error: null },
    });

    const result = await RepairOrdersService.getRepairOrderProvenance(
      mock as never,
      "org-1",
      "branch-1",
      "ro-missing"
    );

    expect(result).toEqual({ success: true, data: [] });
    expect(mock.from).not.toHaveBeenCalledWith("repair_order_source_document_links");
  });

  it("a manually-created RepairOrder with zero linked documents returns a genuine empty array, not an error", async () => {
    const mock = makeTableQueryMock({
      repair_orders: PARENT_FOUND,
      repair_order_source_document_links: { data: [], error: null },
    });

    const result = await RepairOrdersService.getRepairOrderProvenance(
      mock as never,
      "org-1",
      "branch-1",
      "ro-1"
    );

    expect(result).toEqual({ success: true, data: [] });
  });

  it("error normalization: an unexpected error on the parent check is replaced with a generic message, not leaked raw", async () => {
    const mock = makeTableQueryMock({
      repair_orders: {
        data: null,
        error: { code: "XX000", message: "connection terminated unexpectedly" },
      },
    });

    const result = await RepairOrdersService.getRepairOrderProvenance(
      mock as never,
      "org-1",
      "branch-1",
      "ro-1"
    );

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).not.toBe(
      "connection terminated unexpectedly"
    );
  });

  it("error normalization: an unexpected error on the provenance query is replaced with a generic message, not leaked raw", async () => {
    const mock = makeTableQueryMock({
      repair_orders: PARENT_FOUND,
      repair_order_source_document_links: {
        data: null,
        error: { code: "XX000", message: "connection terminated unexpectedly" },
      },
    });

    const result = await RepairOrdersService.getRepairOrderProvenance(
      mock as never,
      "org-1",
      "branch-1",
      "ro-1"
    );

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).not.toBe(
      "connection terminated unexpectedly"
    );
  });
});
