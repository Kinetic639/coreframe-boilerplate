/**
 * @vitest-environment node
 *
 * Tests: server/services/wdd-matcher.service.ts -- WddMatcherService.approveSession
 * (Phase 4, Zone 3 Repair Orders; rewritten for the Phase 4-6 correction-
 * review's second Finding A pass).
 *
 * approveSession now calls the dedicated approve_wdd_matcher_session RPC
 * (SECURITY DEFINER, atomic ready_for_review->approved transition guard
 * enforced at the DB layer itself, not just in this service's query
 * shape) instead of a raw `.update()` -- see the RPC's own migration
 * (20260911090117_wdd_matcher_session_approval_rpc.sql) for why: RLS's
 * USING/WITH CHECK clauses cannot correlate a row's OLD and NEW status in
 * one expression, so a raw client UPDATE bypassing this service could
 * previously set status='approved' from any prior status.
 */
import { describe, it, expect, vi } from "vitest";
import { WddMatcherService } from "../wdd-matcher.service";

function buildSupabaseMock(rpcResult: { data: unknown; error: unknown }) {
  const rpc = vi.fn().mockResolvedValue(rpcResult);
  return { rpc } as unknown as import("@supabase/supabase-js").SupabaseClient;
}

const APPROVED_ROW = {
  id: "session-1",
  organization_id: "org-1",
  branch_id: "branch-1",
  status: "approved",
  approved_by: "user-1",
  approved_at: "2026-09-10T12:00:00.000Z",
  name: "Session",
  match_summary: null,
  created_by: "user-1",
  created_at: "2026-09-10T10:00:00.000Z",
  updated_at: "2026-09-10T12:00:00.000Z",
};

describe("WddMatcherService.approveSession", () => {
  it("ready_for_review -> approved succeeds: calls the approve_wdd_matcher_session RPC with the actor/session ids and returns the RPC's resulting row", async () => {
    const supabase = buildSupabaseMock({ data: APPROVED_ROW, error: null });

    const result = await WddMatcherService.approveSession(
      supabase,
      "session-1",
      "org-1",
      "branch-1",
      "user-1"
    );

    expect(result).toEqual({ success: true, data: APPROVED_ROW });
    expect(supabase.rpc).toHaveBeenCalledWith("approve_wdd_matcher_session", {
      p_actor_user_id: "user-1",
      p_session_id: "session-1",
    });
  });

  it("maps the RPC's P0002 (not found) error to a distinct SESSION_NOT_READY error, not a generic one", async () => {
    const supabase = buildSupabaseMock({
      data: null,
      error: { code: "P0002", message: "Matcher session not found: session-1" },
    });

    const result = await WddMatcherService.approveSession(
      supabase,
      "session-1",
      "org-1",
      "branch-1",
      "user-1"
    );

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toContain("SESSION_NOT_READY");
  });

  it("maps the RPC's 55000 (invalid source status) error to a distinct SESSION_NOT_READY error, not a generic one", async () => {
    const supabase = buildSupabaseMock({
      data: null,
      error: { code: "55000", message: "Matcher session is not ready for review (status=pending)" },
    });

    const result = await WddMatcherService.approveSession(
      supabase,
      "session-1",
      "org-1",
      "branch-1",
      "user-1"
    );

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toContain("SESSION_NOT_READY");
  });

  it("maps a raw 42501 (not authorized) DB error to a normalized service failure via normalizeDbError, not SESSION_NOT_READY", async () => {
    const supabase = buildSupabaseMock({
      data: null,
      error: { code: "42501", message: "Not authorized to approve this Matcher session" },
    });

    const result = await WddMatcherService.approveSession(
      supabase,
      "session-1",
      "org-1",
      "branch-1",
      "user-1"
    );

    expect(result).toEqual({
      success: false,
      error: "You do not have permission to perform this action.",
    });
  });

  it("rejects with SESSION_NOT_READY (defense-in-depth) when the RPC's returned session belongs to a different organization than the caller's active org", async () => {
    const supabase = buildSupabaseMock({
      data: { ...APPROVED_ROW, organization_id: "org-DIFFERENT" },
      error: null,
    });

    const result = await WddMatcherService.approveSession(
      supabase,
      "session-1",
      "org-1",
      "branch-1",
      "user-1"
    );

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toContain("SESSION_NOT_READY");
  });

  it("rejects with SESSION_NOT_READY (defense-in-depth) when branchId is known and the RPC's returned session belongs to a different branch", async () => {
    const supabase = buildSupabaseMock({
      data: { ...APPROVED_ROW, branch_id: "branch-DIFFERENT" },
      error: null,
    });

    const result = await WddMatcherService.approveSession(
      supabase,
      "session-1",
      "org-1",
      "branch-1",
      "user-1"
    );

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toContain("SESSION_NOT_READY");
  });

  it("does not reject on a branch mismatch when branchId is null (org-wide approval scope, matching the RPC's own org-only authorization model)", async () => {
    const supabase = buildSupabaseMock({
      data: { ...APPROVED_ROW, branch_id: "some-other-branch" },
      error: null,
    });

    const result = await WddMatcherService.approveSession(
      supabase,
      "session-1",
      "org-1",
      null,
      "user-1"
    );

    expect(result.success).toBe(true);
  });
});
