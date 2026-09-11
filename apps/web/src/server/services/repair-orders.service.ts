import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { eventService } from "./event.service";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ServiceResult<T> = { success: true; data: T } | { success: false; error: string };

/**
 * Corrective review Finding G (CONFIRMED DESIGN INCONSISTENCY, fixed here):
 * materializeFromSession previously returned `error.message` from the RPC
 * call completely unnormalized -- unlike its sibling
 * WddMatcherService.approveSession (which already normalizes RLS/
 * permission-denied errors via its own normalizeDbError helper). This
 * client-facing message flows through into `materializationError` in the
 * actions layer and is sent to the browser (never rendered as raw text by
 * the current UI, which only checks its presence as a boolean -- but it IS
 * present in the JSON/RSC payload, inspectable via devtools).
 *
 * materialize_repair_orders_from_session (the RPC this wraps) RAISEs
 * exactly four deliberately-authored, human-readable, already-safe
 * business messages, each with an explicit, stable ERRCODE chosen for
 * this exact purpose:
 *   - P0002 "Matcher session not found: %"
 *   - 55000 "Matcher session is not approved (status=%)"
 *   - 55000 "Matcher session has no branch_id -- cannot materialize..."
 *   - 28000 "p_actor_user_id must match the authenticated caller"
 *   - 42501 "Not authorized to materialize repair orders for this branch"
 * These are the intended, specific, safe user-facing text and must be
 * passed through as-is -- blindly normalizing on errcode (the way
 * normalizeDbError does for 42501) would replace the RPC's own good,
 * specific message with a generic one and lose real UX value. Only a
 * genuinely UNEXPECTED error (any other errcode -- a raw constraint
 * violation, connection error, etc., none of which are part of this RPC's
 * own deliberate design) gets replaced with a generic, safe message here.
 *
 * Corrective review, second pass, Finding E (CONFIRMED, hardened here):
 * an errcode-only allowlist is not actually unique to this RPC's own four
 * deliberate RAISEs -- SQLSTATEs are broad Postgres error CLASSES, not
 * identifiers of a specific RAISE statement. In particular 42501
 * (insufficient_privilege) is the SAME code Postgres itself uses for a
 * native, un-authored "permission denied for table ..." error (e.g. a
 * missing GRANT reached via some other code path inside this RPC's
 * execution, or a future refactor that accidentally triggers one) -- an
 * errcode-only check would have passed such a raw, schema-revealing
 * message straight through to the browser. Every allowlist entry below now
 * requires BOTH the exact errcode AND a match against the RPC's own known,
 * stable message shape (fixed text has an exact pattern; the two RAISEs
 * with a `%`-interpolated value use a fixed prefix) -- an unexpected
 * message on an otherwise-allowlisted errcode now correctly falls through
 * to the generic safe message, not just an unexpected errcode.
 */
const REPAIR_ORDER_RPC_KNOWN_ERRORS: ReadonlyArray<{ code: string; pattern: RegExp }> = [
  { code: "P0002", pattern: /^Matcher session not found: / },
  { code: "55000", pattern: /^Matcher session is not approved \(status=.*\)$/ },
  {
    code: "55000",
    pattern: /^Matcher session has no branch_id -- cannot materialize without a branch$/,
  },
  { code: "28000", pattern: /^p_actor_user_id must match the authenticated caller$/ },
  { code: "42501", pattern: /^Not authorized to materialize repair orders for this branch$/ },
];

function normalizeMaterializationRpcError(error: { code?: string; message: string }): string {
  const isKnown = REPAIR_ORDER_RPC_KNOWN_ERRORS.some(
    (known) => error.code === known.code && known.pattern.test(error.message)
  );
  if (isKnown) return error.message;
  return "Materialization failed due to an unexpected server error. Please try again or contact support.";
}

/**
 * Typed, clean result of a materialization call -- the raw jsonb shape
 * returned by the materialize_repair_orders_from_session RPC, mapped to a
 * domain type so callers never depend on the RPC's raw jsonb keys directly.
 */
export interface MaterializationResult {
  sessionId: string;
  createdRepairOrders: number;
  reusedRepairOrders: number;
  createdSourceDocuments: number;
  reusedSourceDocuments: number;
  createdSourceDocumentLines: number;
  createdDocumentLinks: number;
  createdLogicalLines: number;
  createdLineLinks: number;
  skippedNonPositiveQuantityLines: number;
  /** True when this call found nothing new to do (safe idempotent replay). */
  alreadyMaterialized: boolean;
}

interface MaterializeRpcRow {
  session_id: string;
  created_repair_orders: number;
  reused_repair_orders: number;
  created_source_documents: number;
  reused_source_documents: number;
  created_source_document_lines: number;
  created_document_links: number;
  created_logical_lines: number;
  created_line_links: number;
  skipped_nonpositive_quantity_lines: number;
  already_materialized: boolean;
}

function mapMaterializationResult(row: MaterializeRpcRow): MaterializationResult {
  return {
    sessionId: row.session_id,
    createdRepairOrders: row.created_repair_orders,
    reusedRepairOrders: row.reused_repair_orders,
    createdSourceDocuments: row.created_source_documents,
    reusedSourceDocuments: row.reused_source_documents,
    createdSourceDocumentLines: row.created_source_document_lines,
    createdDocumentLinks: row.created_document_links,
    createdLogicalLines: row.created_logical_lines,
    createdLineLinks: row.created_line_links,
    skippedNonPositiveQuantityLines: row.skipped_nonpositive_quantity_lines,
    alreadyMaterialized: row.already_materialized,
  };
}

/** Minimal shape needed from a materialization-status read to render the
 * Phase 5 "approved but not yet materialized" vs "materialized" UI states. */
export interface MaterializationStatus {
  materialized: boolean;
  repairOrderCount: number;
}

/** One row for the Phase 6 RepairOrder list/search page. */
export interface RepairOrderListRow {
  id: string;
  zlNumber: string | null;
  orderNumber: string | null;
  vin: string | null;
  status: string;
  identityStatus: string;
  advisorContactId: string | null;
  advisorDisplayName: string | null;
  createdAt: string;
  updatedAt: string;
}

interface RepairOrderListDbRow {
  id: string;
  zl_number: string | null;
  order_number: string | null;
  vin: string | null;
  status: string;
  identity_status: string;
  advisor_contact_id: string | null;
  created_at: string;
  updated_at: string;
  /** Supabase embed -- object (1:1 via FK) in practice, but the client
   * types this as an array; both shapes are handled defensively below. */
  advisor?: { display_name: string | null } | { display_name: string | null }[] | null;
}

function mapRepairOrderListRow(row: RepairOrderListDbRow): RepairOrderListRow {
  const advisor = Array.isArray(row.advisor) ? row.advisor[0] : row.advisor;
  return {
    id: row.id,
    zlNumber: row.zl_number,
    orderNumber: row.order_number,
    vin: row.vin,
    status: row.status,
    identityStatus: row.identity_status,
    advisorContactId: row.advisor_contact_id,
    advisorDisplayName: advisor?.display_name ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// RepairOrdersService
// ---------------------------------------------------------------------------

export class RepairOrdersService {
  /**
   * Materialize RepairOrders from an approved Matcher session.
   *
   * Calls the atomic SECURITY DEFINER RPC materialize_repair_orders_from_session
   * (apps/web/supabase-target/supabase/migrations/20260910075814_repair_orders_materialization_rpc.sql).
   * The RPC itself is the single, all-or-nothing transaction boundary for
   * every domain write (RepairOrders, logical lines, source documents/lines,
   * provenance links) -- this method does not perform any additional
   * Supabase calls that would need to stay in sync with it.
   *
   * Idempotent: safe to call more than once for the same session (e.g. a
   * UI retry after a network error) -- a repeat call returns
   * alreadyMaterialized: true with every created* count at 0, per the RPC's
   * own DB-level idempotency (unique constraints + ON CONFLICT), not any
   * client-side guard.
   *
   * Event emission (Mode A, best-effort, per docs/event-system/README.md):
   * on success, this method calls eventService.emit() AFTER the RPC commits.
   * If emission fails, the domain write already succeeded and is preserved
   * -- the failure is only logged, matching the documented Mode A trade-off.
   * The RPC's own transaction does not attempt DB-side (Mode B) event
   * emission, since Mode B requires the pre-validation/registration
   * machinery this codebase has not yet built for Zone 3 -- preserving the
   * existing event-system architecture rather than forking a parallel one.
   */
  static async materializeFromSession(
    supabase: SupabaseClient,
    actorUserId: string,
    sessionId: string
  ): Promise<ServiceResult<MaterializationResult>> {
    const { data, error } = await supabase.rpc("materialize_repair_orders_from_session", {
      p_actor_user_id: actorUserId,
      p_session_id: sessionId,
    });

    if (error) {
      // Full raw error stays in server logs for diagnosis/audit; only the
      // normalized, allowlisted message (see normalizeMaterializationRpcError
      // above) is returned to the caller / eventually the browser.
      console.error(
        "[RepairOrdersService.materializeFromSession] materialize_repair_orders_from_session RPC error:",
        error
      );
      return { success: false, error: normalizeMaterializationRpcError(error) };
    }

    const result = mapMaterializationResult(data as MaterializeRpcRow);

    const emitResult = await eventService.emit({
      actionKey: "workshop.repair_orders.materialized",
      actorType: "user",
      actorUserId,
      entityType: "wdd_matcher_session",
      entityId: sessionId,
      metadata: {
        createdRepairOrders: result.createdRepairOrders,
        reusedRepairOrders: result.reusedRepairOrders,
        createdSourceDocuments: result.createdSourceDocuments,
        createdLogicalLines: result.createdLogicalLines,
        alreadyMaterialized: result.alreadyMaterialized,
      },
      eventTier: "baseline",
    });

    if (!emitResult.success) {
      // Best-effort per Mode A -- the domain write above already succeeded
      // and is returned to the caller regardless of this failure.
      // Cast needed: apps/web's tsconfig strictNullChecks setup does not
      // narrow this discriminated union from `if (!x.success)` alone (known
      // repo-wide quirk -- see actions.ts's own eventService.emit() caller
      // for the same pattern).
      console.error(
        "[RepairOrdersService.materializeFromSession] Failed to emit workshop.repair_orders.materialized:",
        (emitResult as { success: false; error: string }).error
      );
    }

    return { success: true, data: result };
  }

  /**
   * Phase 5 read model: has this Matcher session's approval actually
   * produced RepairOrders yet?
   *
   * Deliberately does NOT add a `materialization_status` column to
   * wdd_matcher_sessions (the implementation plan's own "TO VERIFY DURING
   * PHASE" note) -- "approved but zero repair_orders linked via this
   * session's source documents" is a sufficient, always-consistent signal,
   * derived read-only from the same tables materialization itself writes.
   * RLS-backed: relies on the caller's own read access to
   * workshop_source_documents/repair_order_source_document_links (Tier 1,
   * FORCE RLS, `workshop.repair_orders.read`) -- no service-role bypass.
   */
  static async getMaterializationStatusForSession(
    supabase: SupabaseClient,
    sessionId: string
  ): Promise<ServiceResult<MaterializationStatus>> {
    const { data, error } = await supabase
      .from("workshop_source_documents")
      .select("id, repair_order_source_document_links(repair_order_id)")
      .eq("source_session_id", sessionId);

    if (error) return { success: false, error: error.message };

    const rawRepairOrderIds = new Set<string>();
    for (const doc of (data ?? []) as Array<{
      repair_order_source_document_links: { repair_order_id: string }[] | null;
    }>) {
      for (const link of doc.repair_order_source_document_links ?? []) {
        rawRepairOrderIds.add(link.repair_order_id);
      }
    }

    if (rawRepairOrderIds.size === 0) {
      return { success: true, data: { materialized: false, repairOrderCount: 0 } };
    }

    /**
     * Finding I (corrective review, CONFIRMED DESIGN INCONSISTENCY, fixed
     * here): repair_order_source_document_links' own SELECT RLS policy
     * already requires the linked repair_orders row to have
     * deleted_at IS NULL, so a soft-deleted RepairOrder's link is already
     * invisible to any caller today -- making the gap this closes currently
     * unreachable in practice, not an active bug. This explicit re-check is
     * added anyway, matching the deleted_at IS NULL convention this
     * service's sibling methods already apply directly
     * (listForWorkshop/getByIdForWorkshop), as defense-in-depth: the
     * "materialized" read model this method exposes to the UI should not
     * depend solely on an unrelated table's RLS policy staying exactly as
     * it is today to remain correct.
     */
    const { data: activeRows, error: activeError } = await supabase
      .from("repair_orders")
      .select("id")
      .in("id", Array.from(rawRepairOrderIds))
      .is("deleted_at", null);

    if (activeError) return { success: false, error: activeError.message };

    const repairOrderCount = activeRows?.length ?? 0;
    return {
      success: true,
      data: { materialized: repairOrderCount > 0, repairOrderCount },
    };
  }

  /**
   * Phase 6: branch/org-scoped RepairOrder list with a single search box
   * matching zl_number (primary business identity), VIN, and order_number
   * (descriptive-only, per the architecture doc -- search convenience does
   * not promote it to an identity field). RLS-backed (Tier 1, FORCE RLS on
   * repair_orders) -- branchId is applied explicitly (matching
   * WddMatcherService.listSessions's own convention) rather than relied on
   * implicitly through RLS alone, since a caller's permission grants may
   * span more than one branch.
   */
  static async listForWorkshop(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string | null,
    search: string | null
  ): Promise<ServiceResult<RepairOrderListRow[]>> {
    let query = supabase
      .from("repair_orders")
      .select(
        `id, zl_number, order_number, vin, status, identity_status, advisor_contact_id, created_at, updated_at,
         advisor:crm_contacts!repair_orders_advisor_contact_id_fkey(display_name)`
      )
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (branchId) query = query.eq("branch_id", branchId);

    const trimmed = search?.trim();
    if (trimmed) {
      /**
       * Finding E (corrective review): classified ACCEPTABLE CURRENT DESIGN
       * overall -- a repo-wide grep of every other pre-existing .or( caller
       * found no shared escaping helper anywhere, and this method already
       * did MORE escaping (%/_) than most of that established precedent, so
       * this is not a Phase 4-6-specific regression. This is a small,
       * local-only hardening on top of that, not a "confirmed unsafe" fix:
       * PostgREST's .or() filter-list syntax treats "," and "(" / ")" as
       * structural separators/grouping, not literal value characters --
       * backslash-escaping (the previous %/_-only behavior) has no effect
       * on them, so a free-text value containing one of them (plausible in
       * an order/VIN search box) could silently corrupt the intended filter
       * into extra/malformed OR conditions. PostgREST's own documented fix
       * for structural characters is to double-quote the value; backslash
       * must first be escaped (so our own inserted escapes stay
       * unambiguous), then the quote-delimiter character itself, then the
       * ilike pattern wildcards % and _.
       */
      const escaped = trimmed
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '\\"')
        .replace(/[%_]/g, (c) => `\\${c}`);
      query = query.or(
        `zl_number.ilike."%${escaped}%",vin.ilike."%${escaped}%",order_number.ilike."%${escaped}%"`
      );
    }

    const { data, error } = await query;
    if (error) return { success: false, error: error.message };

    return {
      success: true,
      data: (data ?? []).map((row) => mapRepairOrderListRow(row as RepairOrderListDbRow)),
    };
  }

  /**
   * Phase 6 minimal detail read -- "option A" from the work order (a real,
   * basic identifier/context shell), deliberately NOT the Phase 7 header
   * view: no lines, no provenance, no lifecycle transitions, no advisor
   * editing. Same row shape as listForWorkshop's mapping, fetched by id and
   * scoped to org (+ branch, when known) so a wrong-org/branch id reads as
   * "not found" rather than leaking existence.
   */
  static async getByIdForWorkshop(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string | null,
    id: string
  ): Promise<ServiceResult<RepairOrderListRow | null>> {
    let query = supabase
      .from("repair_orders")
      .select(
        `id, zl_number, order_number, vin, status, identity_status, advisor_contact_id, created_at, updated_at,
         advisor:crm_contacts!repair_orders_advisor_contact_id_fkey(display_name)`
      )
      .eq("id", id)
      .eq("organization_id", orgId)
      .is("deleted_at", null);

    if (branchId) query = query.eq("branch_id", branchId);

    const { data, error } = await query.maybeSingle();
    if (error) return { success: false, error: error.message };
    if (!data) return { success: true, data: null };

    return { success: true, data: mapRepairOrderListRow(data as RepairOrderListDbRow) };
  }
}
