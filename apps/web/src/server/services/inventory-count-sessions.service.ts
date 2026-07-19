import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { expandLocationIds } from "@/lib/warehouse/count-session-scope";
import { calculateSuggestedOrderQuantity, isBelowReorderPoint } from "@/lib/warehouse/reorder-math";
import { isValidCountLineTransition } from "@/lib/warehouse/count-session-types";
import type {
  CountLineStatus,
  CountLineRow,
  CountSessionStatus,
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

const CLOSED_COUNT_SESSION_STATUSES = new Set(["approved", "cancelled"]);

function isClosedCountSessionStatus(status: unknown) {
  return typeof status === "string" && CLOSED_COUNT_SESSION_STATUSES.has(status);
}

function closedCountSessionError(status: unknown) {
  return `Inventory count session is ${String(status)} and can no longer be changed`;
}

function parseRequireReasonForVariance(scope: unknown) {
  if (!scope || typeof scope !== "object") return true;
  const value = (scope as { require_reason_for_variance?: unknown }).require_reason_for_variance;
  return value !== false;
}

const VALID_COUNT_SESSION_TRANSITIONS: Record<
  Extract<CountSessionStatus, "draft" | "counting" | "submitted">,
  ReadonlyArray<"counting" | "submitted">
> = {
  draft: ["counting", "submitted"],
  counting: ["counting", "submitted"],
  submitted: ["submitted"],
};

function isValidCountSessionTransition(from: string, to: "counting" | "submitted") {
  if (from === "approved" || from === "cancelled") return false;
  const transitions =
    VALID_COUNT_SESSION_TRANSITIONS[from as keyof typeof VALID_COUNT_SESSION_TRANSITIONS];
  return transitions?.includes(to) ?? false;
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
  /** Legacy client hint kept for action-schema compatibility. The service
   * always reads the authoritative current status from the database. */
  current_status?: CountLineStatus;
  reason_code?: string | null;
  note?: string | null;
  /** Legacy client hint kept for action-schema compatibility. The service
   * always reads the owning session scope from the database. */
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

  static async listAuditSuppliers(
    supabase: SupabaseClient,
    orgId: string
  ): Promise<ServiceResult<Array<{ id: string; name: string }>>> {
    const [legacyResult, crmResult] = await Promise.all([
      supabase
        .from("inventory_suppliers")
        .select("id, name")
        .eq("organization_id", orgId)
        .eq("status", "active")
        .is("deleted_at", null)
        .order("name", { ascending: true }),
      supabase
        .from("crm_party_roles")
        .select("party_id, crm_parties!inner(id, display_name, status, deleted_at)")
        .eq("organization_id", orgId)
        .eq("role", "supplier")
        .eq("crm_parties.organization_id", orgId)
        .eq("crm_parties.status", "active")
        .is("crm_parties.deleted_at", null),
    ]);

    if (legacyResult.error) return { success: false, error: errorMessage(legacyResult.error) };
    if (crmResult.error) return { success: false, error: errorMessage(crmResult.error) };

    const suppliersById = new Map<string, { id: string; name: string }>();
    for (const supplier of (legacyResult.data ?? []) as Array<{ id: string; name: string }>) {
      suppliersById.set(supplier.id, supplier);
    }

    for (const role of (crmResult.data ?? []) as Array<{
      party_id: string;
      crm_parties?:
        | { id: string; display_name: string }
        | Array<{ id: string; display_name: string }>
        | null;
    }>) {
      const party = Array.isArray(role.crm_parties) ? role.crm_parties[0] : role.crm_parties;
      if (party?.id && party.display_name) {
        suppliersById.set(party.id, { id: party.id, name: party.display_name });
      }
    }

    return {
      success: true,
      data: [...suppliersById.values()].sort((a, b) => a.name.localeCompare(b.name)),
    };
  }

  static async getAuditSupplierName(
    supabase: SupabaseClient,
    orgId: string,
    supplierId: string
  ): Promise<string | null> {
    const { data: legacySupplier, error: legacyError } = await supabase
      .from("inventory_suppliers")
      .select("name")
      .eq("id", supplierId)
      .eq("organization_id", orgId)
      .maybeSingle();

    if (!legacyError && legacySupplier) {
      return ((legacySupplier as { name?: string | null }).name ?? null) || null;
    }

    const { data: crmParty } = await supabase
      .from("crm_parties")
      .select("display_name, crm_party_roles!inner(role)")
      .eq("id", supplierId)
      .eq("organization_id", orgId)
      .eq("status", "active")
      .is("deleted_at", null)
      .eq("crm_party_roles.role", "supplier")
      .maybeSingle();

    return ((crmParty as { display_name?: string | null } | null)?.display_name ?? null) || null;
  }

  /**
   * Updates a count line's counted quantity / status / reason / note.
   * Enforces two rules server-side (not just in the UI):
   *  - a reason_code is required when approving a nonzero-variance line and
   *    the session requires reasons;
   *  - the requested status transition must be valid per the state machine
   *    using the current status read from the database.
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
    const { data: line, error: lineError } = await supabase
      .from("inventory_count_lines")
      .select(
        "id, count_session_id, status, expected_quantity, counted_quantity, variance_quantity, reason_code"
      )
      .eq("id", lineId)
      .eq("organization_id", orgId)
      .eq("branch_id", branchId)
      .single();
    if (lineError) return { success: false, error: errorMessage(lineError) };

    const lineRow = line as {
      count_session_id?: string;
      status?: CountLineStatus;
      expected_quantity?: number | null;
      counted_quantity?: number | null;
      variance_quantity?: number | null;
      reason_code?: string | null;
    } | null;
    const countSessionId = lineRow?.count_session_id;
    if (!countSessionId) return { success: false, error: "Inventory count line not found" };

    const { data: session, error: sessionError } = await supabase
      .from("inventory_count_sessions")
      .select("id, status, scope")
      .eq("id", countSessionId)
      .eq("organization_id", orgId)
      .eq("branch_id", branchId)
      .single();
    if (sessionError) return { success: false, error: errorMessage(sessionError) };

    const sessionStatus = (session as { status?: string } | null)?.status;
    if (isClosedCountSessionStatus(sessionStatus)) {
      return { success: false, error: closedCountSessionError(sessionStatus) };
    }

    const currentStatus = lineRow?.status;
    if (input.status && currentStatus && !isValidCountLineTransition(currentStatus, input.status)) {
      return {
        success: false,
        error: `Cannot move a count line from "${currentStatus}" to "${input.status}"`,
      };
    }

    const nextReason =
      input.reason_code !== undefined ? input.reason_code : (lineRow?.reason_code ?? null);
    const nextVariance =
      input.counted_quantity !== undefined
        ? (input.counted_quantity ?? lineRow?.expected_quantity ?? 0) -
          (lineRow?.expected_quantity ?? 0)
        : (lineRow?.variance_quantity ?? 0);
    const requireReasonForVariance = parseRequireReasonForVariance(
      (session as { scope?: unknown } | null)?.scope
    );

    if (
      input.status === "approved" &&
      requireReasonForVariance &&
      nextVariance !== 0 &&
      !nextReason
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
      .eq("count_session_id", countSessionId)
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
    const { data: session, error: sessionError } = await supabase
      .from("inventory_count_sessions")
      .select("id, status")
      .eq("id", sessionId)
      .eq("organization_id", input.organization_id)
      .eq("branch_id", input.branch_id)
      .single();
    if (sessionError) return { success: false, error: errorMessage(sessionError) };

    const sessionStatus = (session as { status?: string } | null)?.status;
    if (isClosedCountSessionStatus(sessionStatus)) {
      return { success: false, error: closedCountSessionError(sessionStatus) };
    }

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
      .select("id, count_session_id, status, variance_quantity, reason_code")
      .eq("organization_id", orgId)
      .eq("branch_id", branchId)
      .in("id", lineIds);
    if (error) return { success: false, error: errorMessage(error) };

    const rows = (lines ?? []) as Array<{
      id: string;
      count_session_id: string;
      status: CountLineStatus;
      variance_quantity: number | null;
      reason_code: string | null;
    }>;

    const countSessionIds = [...new Set(rows.map((line) => line.count_session_id).filter(Boolean))];
    if (countSessionIds.length > 1) {
      return {
        success: false,
        error: "Bulk approving lines from multiple audit sessions is not allowed",
      };
    }

    if (countSessionIds.length === 1) {
      const { data: session, error: sessionError } = await supabase
        .from("inventory_count_sessions")
        .select("id, status")
        .eq("id", countSessionIds[0])
        .eq("organization_id", orgId)
        .eq("branch_id", branchId)
        .single();
      if (sessionError) return { success: false, error: errorMessage(sessionError) };

      const sessionStatus = (session as { status?: string } | null)?.status;
      if (isClosedCountSessionStatus(sessionStatus)) {
        return { success: false, error: closedCountSessionError(sessionStatus) };
      }
    }

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
        .eq("count_session_id", countSessionIds[0])
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
    const { data: session, error: sessionError } = await supabase
      .from("inventory_count_sessions")
      .select("id, status")
      .eq("id", sessionId)
      .eq("organization_id", orgId)
      .eq("branch_id", branchId)
      .single();

    if (sessionError) return { success: false, error: errorMessage(sessionError) };

    const currentStatus = (session as { status?: string } | null)?.status;
    if (!currentStatus) return { success: false, error: "Inventory count session not found" };
    if (!isValidCountSessionTransition(currentStatus, status)) {
      return {
        success: false,
        error: `Cannot move an inventory count session from "${currentStatus}" to "${status}"`,
      };
    }

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
