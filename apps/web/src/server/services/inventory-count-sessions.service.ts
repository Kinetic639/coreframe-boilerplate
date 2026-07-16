import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { expandLocationIds } from "@/lib/warehouse/count-session-scope";
import { calculateSuggestedOrderQuantity, isBelowReorderPoint } from "@/lib/warehouse/reorder-math";
import { isValidCountLineTransition } from "@/lib/warehouse/count-session-types";
import type {
  CountLineStatus,
  CountLineRow,
  CountSessionDetail,
  CountSessionListResult,
  CountSessionScope,
  CountSessionType,
  ReorderReportRow,
} from "@/lib/warehouse/count-session-types";

export type {
  CountLineRow,
  CountSessionDetail,
  CountSessionListResult,
  ReorderReportRow,
} from "@/lib/warehouse/count-session-types";

export type ServiceResult<T> = { success: true; data: T } | { success: false; error: string };

function errorMessage(error: { message?: string } | null | undefined) {
  return error?.message ?? "Unexpected database error";
}

export interface CountSessionLocationRef {
  id: string;
  parent_id: string | null;
}

export interface CreateCountSessionInput {
  count_type: CountSessionType;
  location_ids?: string[];
  include_children?: boolean;
  supplier_id?: string;
  location_filter_ids?: string[];
  include_zero_stock?: boolean;
  show_expected_quantity?: boolean;
  require_reason_for_variance?: boolean;
  notes?: string | null;
  actor_user_id?: string | null;
}

export interface UpdateCountLineInput {
  counted_quantity?: number | null;
  variance_quantity?: number | null;
  status?: CountLineStatus;
  /** Current status, if known — enables transition validation. Optional so
   * callers that don't have it yet (e.g. a bare quantity edit) can still
   * call this without an extra round trip. */
  current_status?: CountLineStatus;
  reason_code?: string | null;
  note?: string | null;
  /** Whether the owning session requires a reason for nonzero-variance
   * approvals. Passed by the caller (from session.scope), not looked up
   * here, to avoid an extra round trip on every line edit. */
  require_reason_for_variance?: boolean;
  actor_user_id?: string | null;
}

export interface AddUnexpectedLineInput {
  organization_id: string;
  branch_id: string;
  variant_id: string;
  location_id: string;
  unit_id: string;
  counted_quantity: number;
  note?: string | null;
  actor_user_id?: string | null;
}

export class InventoryCountSessionsService {
  // MVP assumption (plan §6): a count session is operated by a single active
  // counter at a time. No presence/locking/assignment concept exists here by
  // design — multi-counter collaborative counting is out of scope.

  static async listSessions(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string,
    params: { search?: string; status?: string; page?: number; pageSize?: number } = {}
  ): Promise<ServiceResult<CountSessionListResult>> {
    const { data, error } = await supabase.rpc("inventory_count_session_list", {
      p_organization_id: orgId,
      p_branch_id: branchId,
      p_search: params.search ?? null,
      p_status: params.status ?? null,
      p_page: params.page ?? 1,
      p_page_size: params.pageSize ?? 20,
    });

    if (error) return { success: false, error: errorMessage(error) };
    const result = data as {
      rows: CountSessionListResult["rows"];
      total_count: number;
      page: number;
      page_size: number;
    };
    return {
      success: true,
      data: {
        rows: result.rows ?? [],
        totalCount: result.total_count ?? 0,
        page: result.page ?? 1,
        pageSize: result.page_size ?? 20,
      },
    };
  }

  static async getSessionDetail(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string,
    sessionId: string
  ): Promise<ServiceResult<CountSessionDetail>> {
    const { data: session, error: sessionError } = await supabase
      .from("inventory_count_sessions")
      .select("*")
      .eq("id", sessionId)
      .eq("organization_id", orgId)
      .eq("branch_id", branchId)
      .single();
    if (sessionError) return { success: false, error: errorMessage(sessionError) };

    const { data: lines, error: linesError } = await supabase
      .from("inventory_count_lines")
      .select("*")
      .eq("count_session_id", sessionId)
      .eq("organization_id", orgId)
      .eq("branch_id", branchId)
      .order("sequence_no", { ascending: true });
    if (linesError) return { success: false, error: errorMessage(linesError) };

    return {
      success: true,
      data: {
        session: session as Record<string, unknown>,
        lines: (lines ?? []) as CountLineRow[],
      },
    };
  }

  /**
   * Creates a count session. Location-subtree expansion (when count_type is
   * "location" and include_children is set) happens here in TypeScript via
   * expandLocationIds, using allLocations (the full flat branch location
   * list) — the RPC never re-expands, it only reads the already-expanded
   * scope.location_ids.
   */
  static async createCountSession(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string,
    input: CreateCountSessionInput,
    allLocations: CountSessionLocationRef[] = []
  ): Promise<ServiceResult<Record<string, unknown>>> {
    let locationIds = input.location_ids ?? [];
    if (input.count_type === "location") {
      locationIds = expandLocationIds(allLocations, locationIds, input.include_children ?? false);
    }

    const scope: CountSessionScope = {
      count_type: input.count_type,
      location_ids: locationIds,
      include_children: input.include_children ?? false,
      supplier_id: input.supplier_id,
      location_filter_ids: input.location_filter_ids ?? [],
      include_zero_stock: input.include_zero_stock ?? false,
      show_expected_quantity: input.show_expected_quantity ?? true,
      require_reason_for_variance: input.require_reason_for_variance ?? true,
    };

    const { data, error } = await supabase.rpc("inventory_create_count_session", {
      p_organization_id: orgId,
      p_branch_id: branchId,
      p_scope: scope,
      p_notes: input.notes ?? null,
      p_actor_user_id: input.actor_user_id ?? null,
    });

    if (error) return { success: false, error: errorMessage(error) };
    return { success: true, data: data as Record<string, unknown> };
  }

  /**
   * Updates a count line's counted quantity / status / reason / note.
   * Enforces two rules server-side (not just in the UI):
   *  - a reason_code is required when approving a nonzero-variance line and
   *    the session requires reasons;
   *  - the requested status transition must be valid per the state machine
   *    (only checked when `current_status` is supplied by the caller).
   * A zero-variance counted line does NOT need to become "approved" — it is
   * already resolved (plan §4) — so no reason/approval requirement applies
   * to it.
   */
  static async updateCountLine(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string,
    lineId: string,
    input: UpdateCountLineInput
  ): Promise<ServiceResult<{ id: string }>> {
    if (
      input.status &&
      input.current_status &&
      !isValidCountLineTransition(input.current_status, input.status)
    ) {
      return {
        success: false,
        error: `Cannot move a count line from "${input.current_status}" to "${input.status}"`,
      };
    }

    if (
      input.status === "approved" &&
      input.require_reason_for_variance &&
      (input.variance_quantity ?? 0) !== 0 &&
      !input.reason_code
    ) {
      return {
        success: false,
        error: "A reason is required to approve a line with a quantity variance",
      };
    }

    const updates: Record<string, unknown> = {};
    if (input.counted_quantity !== undefined) updates.counted_quantity = input.counted_quantity;
    if (input.status !== undefined) updates.status = input.status;
    if (input.reason_code !== undefined) updates.reason_code = input.reason_code;
    if (input.note !== undefined) updates.note = input.note;
    if (input.counted_quantity !== undefined) {
      updates.counted_by = input.actor_user_id ?? null;
      updates.counted_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from("inventory_count_lines")
      .update(updates)
      .eq("id", lineId)
      .eq("organization_id", orgId)
      .eq("branch_id", branchId)
      .select("id")
      .single();

    if (error) return { success: false, error: errorMessage(error) };
    return { success: true, data: data as { id: string } };
  }

  /**
   * Inserts an ad hoc line for an item physically found but not in the
   * expected list (source='unexpected_found', expected_quantity=0, status
   * seeded straight to 'counted'). sequence_no is always computed
   * server-side from the current max in this session, never trusted from
   * the caller. Per the single-counter assumption (plan §6), the small race
   * window between the max-read and the insert is an accepted, documented
   * limitation, not something this method guards against with locking.
   */
  static async addUnexpectedLine(
    supabase: SupabaseClient,
    sessionId: string,
    input: AddUnexpectedLineInput
  ): Promise<ServiceResult<{ id: string }>> {
    const { data: maxRow, error: maxError } = await supabase
      .from("inventory_count_lines")
      .select("sequence_no")
      .eq("count_session_id", sessionId)
      .eq("organization_id", input.organization_id)
      .eq("branch_id", input.branch_id)
      .order("sequence_no", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (maxError) return { success: false, error: errorMessage(maxError) };

    const currentMax = (maxRow as { sequence_no: number | null } | null)?.sequence_no ?? 0;
    const nextSequence = currentMax + 1;

    const { data, error } = await supabase
      .from("inventory_count_lines")
      .insert({
        organization_id: input.organization_id,
        branch_id: input.branch_id,
        count_session_id: sessionId,
        variant_id: input.variant_id,
        location_id: input.location_id,
        unit_id: input.unit_id,
        expected_quantity: 0,
        counted_quantity: input.counted_quantity,
        status: "counted",
        source: "unexpected_found",
        sequence_no: nextSequence,
        note: input.note ?? null,
        counted_by: input.actor_user_id ?? null,
        counted_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) return { success: false, error: errorMessage(error) };
    return { success: true, data: data as { id: string } };
  }

  /**
   * Bulk-approves eligible lines: only lines currently in status "counted"
   * qualify. A qualifying line missing a required reason_code (nonzero
   * variance + require_reason_for_variance) is reported back as skipped
   * rather than approved. Lines in any other status (pending, skipped,
   * needs_recount, already approved) are never touched and are reported as
   * skipped for transparency.
   */
  static async bulkApproveLines(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string,
    lineIds: string[],
    input: { require_reason_for_variance: boolean }
  ): Promise<ServiceResult<{ approvedIds: string[]; skippedIds: string[] }>> {
    if (lineIds.length === 0) return { success: true, data: { approvedIds: [], skippedIds: [] } };

    const { data: lines, error } = await supabase
      .from("inventory_count_lines")
      .select("id, status, variance_quantity, reason_code")
      .eq("organization_id", orgId)
      .eq("branch_id", branchId)
      .in("id", lineIds);
    if (error) return { success: false, error: errorMessage(error) };

    const rows = (lines ?? []) as Array<{
      id: string;
      status: CountLineStatus;
      variance_quantity: number | null;
      reason_code: string | null;
    }>;

    const approvedIds: string[] = [];
    const skippedIds: string[] = [];

    for (const line of rows) {
      if (line.status !== "counted") {
        skippedIds.push(line.id);
        continue;
      }
      const variance = line.variance_quantity ?? 0;
      if (variance !== 0 && input.require_reason_for_variance && !line.reason_code) {
        skippedIds.push(line.id);
        continue;
      }
      approvedIds.push(line.id);
    }

    if (approvedIds.length > 0) {
      const { error: updateError } = await supabase
        .from("inventory_count_lines")
        .update({ status: "approved" })
        .eq("organization_id", orgId)
        .eq("branch_id", branchId)
        .in("id", approvedIds);
      if (updateError) return { success: false, error: errorMessage(updateError) };
    }

    return { success: true, data: { approvedIds, skippedIds } };
  }

  /**
   * Posts the session's approved variance lines as real stock-adjustment
   * movements. All enforcement (all-or-nothing posting gate, movement-engine
   * call, warehouse.inventory.adjust check) lives in the
   * inventory_approve_count_session RPC — this method is a thin pass-through
   * that surfaces the RPC's rejection reason unchanged, never swallowing or
   * generalizing it.
   */
  static async approveCountSession(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string,
    countSessionId: string,
    actorUserId: string | null
  ): Promise<ServiceResult<Record<string, unknown>>> {
    const { data: session, error: sessionError } = await supabase
      .from("inventory_count_sessions")
      .select("id")
      .eq("id", countSessionId)
      .eq("organization_id", orgId)
      .eq("branch_id", branchId)
      .single();
    if (sessionError) return { success: false, error: errorMessage(sessionError) };
    if (!session) return { success: false, error: "Inventory count session not found" };

    const { data, error } = await supabase.rpc("inventory_approve_count_session", {
      p_count_session_id: countSessionId,
      p_actor_user_id: actorUserId,
    });

    if (error) return { success: false, error: errorMessage(error) };
    return { success: true, data: data as Record<string, unknown> };
  }

  /**
   * Advances a session's workflow status forward — "counting" (entering the
   * guided-count screen) or "submitted" (finishing counting, entering
   * review). This is a plain RLS-gated UPDATE, not a business-rule RPC: the
   * only status transition with real integrity rules is submitted->approved
   * (inventory_approve_count_session's all-or-nothing gate). Only forward
   * transitions from the count-session status enum are accepted; approved
   * and cancelled are handled by their own dedicated flows, not this method.
   */
  static async updateSessionStatus(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string,
    sessionId: string,
    status: "counting" | "submitted"
  ): Promise<ServiceResult<{ id: string; status: string }>> {
    const { data, error } = await supabase
      .from("inventory_count_sessions")
      .update({ status })
      .eq("id", sessionId)
      .eq("organization_id", orgId)
      .eq("branch_id", branchId)
      .select("id, status")
      .single();

    if (error) return { success: false, error: errorMessage(error) };
    return { success: true, data: data as { id: string; status: string } };
  }

  /**
   * Live low-stock report: joins active inventory_reorder_rules against
   * current inventory_balances. Numbers are always computed fresh here —
   * nothing about "what's currently low" is persisted (plan §7); only the
   * human accept/ignore decision for a suggestion is persisted, in the
   * separate inventory_reorder_suggestion_actions table, and is not read by
   * this method (the decision-merge happens at the action/hook layer that
   * calls this).
   */
  static async getReorderReport(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string,
    params: { locationId?: string; supplierId?: string } = {}
  ): Promise<ServiceResult<ReorderReportRow[]>> {
    let ruleQuery = supabase
      .from("inventory_reorder_rules")
      .select(
        "id, variant_id, location_id, reorder_point, reorder_quantity, min_quantity, preferred_supplier_id"
      )
      .eq("organization_id", orgId)
      .eq("branch_id", branchId)
      .eq("is_active", true)
      .is("deleted_at", null);
    if (params.locationId) ruleQuery = ruleQuery.eq("location_id", params.locationId);

    const { data: rules, error: rulesError } = await ruleQuery;
    if (rulesError) return { success: false, error: errorMessage(rulesError) };

    const ruleRows = (rules ?? []) as Array<{
      variant_id: string;
      location_id: string | null;
      reorder_point: number;
      reorder_quantity: number | null;
      min_quantity: number | null;
      preferred_supplier_id: string | null;
    }>;

    const variantIds = [...new Set(ruleRows.map((r) => r.variant_id))];
    if (variantIds.length === 0) return { success: true, data: [] };

    const { data: balances, error: balancesError } = await supabase
      .from("inventory_balances")
      .select("variant_id, location_id, on_hand_quantity")
      .eq("organization_id", orgId)
      .eq("branch_id", branchId)
      .in("variant_id", variantIds);
    if (balancesError) return { success: false, error: errorMessage(balancesError) };

    const balanceRows = (balances ?? []) as Array<{
      variant_id: string;
      location_id: string;
      on_hand_quantity: number;
    }>;

    const rows: ReorderReportRow[] = [];
    for (const rule of ruleRows) {
      if (params.supplierId && rule.preferred_supplier_id !== params.supplierId) continue;

      const relevantBalances = balanceRows.filter(
        (b) =>
          b.variant_id === rule.variant_id &&
          (rule.location_id == null || b.location_id === rule.location_id)
      );
      const onHand = relevantBalances.reduce((sum, b) => sum + (b.on_hand_quantity ?? 0), 0);

      if (!isBelowReorderPoint(rule, onHand)) continue;

      rows.push({
        variant_id: rule.variant_id,
        location_id: rule.location_id,
        on_hand_quantity: onHand,
        reorder_point: rule.reorder_point,
        min_quantity: rule.min_quantity,
        suggested_order_quantity: calculateSuggestedOrderQuantity(rule, onHand),
        preferred_supplier_id: rule.preferred_supplier_id,
      });
    }

    return { success: true, data: rows };
  }

  /**
   * Latest accept/ignore decision per (variant_id, location_id) — the
   * actions table is an append-only decision log (plan §7: only the human
   * decision is persisted, never the live numbers), so "current" status is
   * whichever row for that key has the newest created_at.
   */
  static async getReorderSuggestionActions(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string
  ): Promise<ServiceResult<Map<string, "accepted" | "ignored">>> {
    const { data, error } = await supabase
      .from("inventory_reorder_suggestion_actions")
      .select("variant_id, location_id, status, created_at")
      .eq("organization_id", orgId)
      .eq("branch_id", branchId)
      .order("created_at", { ascending: true });
    if (error) return { success: false, error: errorMessage(error) };

    const rows = (data ?? []) as Array<{
      variant_id: string;
      location_id: string | null;
      status: "accepted" | "ignored";
    }>;
    const byKey = new Map<string, "accepted" | "ignored">();
    for (const row of rows) {
      byKey.set(`${row.variant_id}:${row.location_id ?? ""}`, row.status);
    }
    return { success: true, data: byKey };
  }

  static async setReorderSuggestionAction(
    supabase: SupabaseClient,
    input: {
      organization_id: string;
      branch_id: string;
      variant_id: string;
      location_id: string | null;
      status: "accepted" | "ignored";
      actor_user_id: string | null;
      count_session_id?: string | null;
    }
  ): Promise<ServiceResult<{ id: string }>> {
    const { data, error } = await supabase
      .from("inventory_reorder_suggestion_actions")
      .insert({
        organization_id: input.organization_id,
        branch_id: input.branch_id,
        variant_id: input.variant_id,
        location_id: input.location_id,
        status: input.status,
        actor_user_id: input.actor_user_id,
        count_session_id: input.count_session_id ?? null,
      })
      .select("id")
      .single();
    if (error) return { success: false, error: errorMessage(error) };
    return { success: true, data: data as { id: string } };
  }
}
