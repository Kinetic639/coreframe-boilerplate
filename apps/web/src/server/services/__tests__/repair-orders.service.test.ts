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
    const supabase = buildSupabaseMock({ data: null, error: { message: "session not found" } });

    const result = await RepairOrdersService.materializeFromSession(
      supabase,
      "user-1",
      "missing-session"
    );

    expect(result).toEqual({ success: false, error: "session not found" });
    expect(eventService.emit).not.toHaveBeenCalled();
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
