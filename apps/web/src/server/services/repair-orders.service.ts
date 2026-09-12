import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { eventService } from "./event.service";
import type {
  CreateRepairOrderInput,
  UpdateRepairOrderHeaderInput,
} from "@/lib/validations/repair-orders";
import type { RepairOrderStatus, RepairOrderLineStatus } from "@/lib/types/repair-orders";

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
 * Correction pass Finding E (CONFIRMED, fixed here): the plain-CRUD Phase 7
 * methods below (create/update/assign/changeStatus) previously returned raw
 * `error.message` for any non-23505 failure -- unlike the curated
 * allowlist-based normalization already established above for the
 * materialization RPC's own four deliberate RAISEs. A genuinely unexpected
 * error on a plain table INSERT/UPDATE (an RLS WITH CHECK violation, an FK
 * violation -- including the new org-scoped advisor FK from Finding D's
 * fix -- a connection error, etc.) was reaching the browser verbatim,
 * revealing table/constraint/policy names. Every such error is now logged
 * in full server-side (with the calling method name for context) and
 * replaced with one generic, safe message before returning to the caller.
 * The only specific, curated exceptions are the two already-safe, already-
 * expected cases below -- matched by constraint name/column, not by
 * errcode alone, so a different, unrelated future constraint on this table
 * can never be mislabeled as one of these two.
 */
function normalizeRepairOrderCrudError(
  methodName: string,
  error: { code?: string; message: string }
): string {
  if (error.code === "23505" && error.message.includes("repair_orders_identity_unique")) {
    return "A RepairOrder with this ZL number already exists in this branch";
  }
  if (error.code === "23503" && error.message.includes("advisor_contact_id")) {
    return "The selected advisor is not valid for this organization";
  }
  console.error(`[RepairOrdersService.${methodName}] Unexpected DB error:`, error);
  return "An unexpected error occurred. Please try again or contact support.";
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

/** Phase 7: candidate advisor for the assignment picker -- a crm_contacts
 * row already linked to a real platform user (the only kind of contact
 * that can ever function as an "owner" under the manage_own ownership
 * model; see repair-orders.service.ts's listAdvisorCandidates doc comment
 * for why this is the interim scoping rule, pending a product decision on
 * the CRM party-role "employee" tagging scheme). */
export interface RepairOrderAdvisorCandidate {
  id: string;
  displayName: string;
}

/** Phase 7: full editable header shape returned to the detail/edit UI --
 * a superset of RepairOrderListRow (adds vehicle_brand/client_name/
 * dealer_name/created_by, none of which the Phase 6 list view needed). */
export interface RepairOrderHeader extends RepairOrderListRow {
  vehicleBrand: string | null;
  clientName: string | null;
  dealerName: string | null;
  createdBy: string | null;
}

interface RepairOrderHeaderDbRow extends RepairOrderListDbRow {
  vehicle_brand: string | null;
  client_name: string | null;
  dealer_name: string | null;
  created_by: string | null;
}

function mapRepairOrderHeader(row: RepairOrderHeaderDbRow): RepairOrderHeader {
  return {
    ...mapRepairOrderListRow(row),
    vehicleBrand: row.vehicle_brand,
    clientName: row.client_name,
    dealerName: row.dealer_name,
    createdBy: row.created_by,
  };
}

const HEADER_COLUMNS = `id, zl_number, order_number, vin, vehicle_brand, client_name, dealer_name,
   status, identity_status, advisor_contact_id, created_by, created_at, updated_at,
   advisor:crm_contacts!repair_orders_advisor_contact_id_fkey(display_name)`;

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

/**
 * Phase 8: the logical RepairOrderLine read model -- the durable BUSINESS
 * line list (never grouped by source document; that is provenance, Phase
 * 9's own concern). See listRepairOrderLines' own doc comment for the full
 * identity/aggregation/formula rules this shape depends on.
 */
export interface RepairOrderLineReadModel {
  id: string;
  repairOrderId: string;
  variantId: string | null;
  /**
   * = repair_order_lines.product_code (the raw/source-parsed part code),
   * NOT a join through inventory_variants.sku. Live-verified before this
   * phase: 100% of currently-materialized repair_order_lines rows (167/167)
   * have variant_id IS NULL -- no existing materialization or creation path
   * ever resolves/assigns a real inventory_variants row. Joining through
   * inventory_variants for a "canonical" SKU would therefore (a) return
   * nothing for any real row today, and (b) introduce an unnecessary
   * cross-module RLS dependency (inventory_variants' own SELECT policy
   * requires warehouse.products.read, a permission Workshop callers are
   * not guaranteed to hold) for zero current benefit. Revisit only if/when
   * a future phase actually starts populating variant_id.
   */
  sku: string | null;
  /** repair_order_lines.product_name -- NOT NULL at the DB layer; already
   * carries the established 'Unknown part' fallback from materialization
   * (COALESCE(product_name, raw_text, 'Unknown part')) when no better value
   * exists. Phase 8 renders this truthfully as-is; it does not invent its
   * own separate "Unknown product" fallback string. */
  productName: string;
  orderedQuantity: number;
  unit: string | null;
  /** SUM(applied_quantity) WHERE relation_type = 'receipt', for THIS
   * line's id only -- never grouped/matched by sku/product_code. */
  receivedQuantity: number;
  /** SUM(applied_quantity) WHERE relation_type = 'issue', for THIS line's
   * id only. */
  issuedQuantity: number;
  /** orderedQuantity - receivedQuantity. Deliberately NOT clamped to zero
   * -- see listRepairOrderLines' own doc comment for why. */
  outstandingToReceive: number;
  /** receivedQuantity - issuedQuantity. Deliberately NOT clamped to zero. */
  availableForIssue: number;
  /**
   * Real, persisted repair_order_lines.status (CHECK 'pending' |
   * 'partially_received' | 'received' | 'closed') -- included because it
   * genuinely exists, not fabricated for this phase. Live-verified before
   * this phase: 100% of currently-materialized lines (167/167) read
   * 'pending' -- nothing (no trigger, no service method, no Phase-10 wiring
   * yet) ever transitions it away from the DB default. Phase 8's own UI
   * deliberately does NOT render this as a status indicator for exactly
   * that reason (it would misrepresent every real line as permanently
   * "pending" regardless of its true received/issued state) -- the numeric
   * received/outstanding/available columns are the truthful signal for
   * this phase. This field is exposed on the read model for completeness
   * and for any future phase that legitimately needs it.
   */
  status: RepairOrderLineStatus;
}

interface RepairOrderLineMovementLinkDbRow {
  applied_quantity: number;
  relation_type: string;
}

interface RepairOrderLineDbRow {
  id: string;
  variant_id: string | null;
  product_code: string | null;
  product_name: string;
  ordered_quantity: number;
  unit: string | null;
  status: string;
  /** PostgREST has-many embed -- always an array (never a bare object),
   * unlike the advisor:crm_contacts embed above (a has-one/belongs-to
   * embed, which the client types defensively as object-or-array). */
  repair_order_line_movement_links: RepairOrderLineMovementLinkDbRow[] | null;
}

function mapRepairOrderLine(
  row: RepairOrderLineDbRow,
  repairOrderId: string
): RepairOrderLineReadModel {
  const links = row.repair_order_line_movement_links ?? [];
  // Aggregation is scoped by construction to THIS row's own nested links
  // array -- PostgREST nests each repair_order_lines row's movement links
  // under that specific row via the repair_order_line_id FK, never across
  // rows that happen to share the same product_code. This is what makes
  // the same-SKU-independence guarantee hold without any extra code here.
  const receivedQuantity = links
    .filter((link) => link.relation_type === "receipt")
    .reduce((sum, link) => sum + link.applied_quantity, 0);
  const issuedQuantity = links
    .filter((link) => link.relation_type === "issue")
    .reduce((sum, link) => sum + link.applied_quantity, 0);
  // 'reversal' rows are deliberately excluded from both sums -- see
  // listRepairOrderLines' own doc comment for why this is a disclosed
  // limitation, not an oversight.

  return {
    id: row.id,
    repairOrderId,
    variantId: row.variant_id,
    sku: row.product_code,
    productName: row.product_name,
    orderedQuantity: row.ordered_quantity,
    unit: row.unit,
    receivedQuantity,
    issuedQuantity,
    outstandingToReceive: row.ordered_quantity - receivedQuantity,
    availableForIssue: receivedQuantity - issuedQuantity,
    status: row.status as RepairOrderLineStatus,
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
   * Detail read backing both the Phase 6 list-row-open shell and Phase 7's
   * full header view -- returns the full RepairOrderHeader shape (a
   * superset of RepairOrderListRow, so this is a non-breaking extension of
   * the Phase 6 method rather than a parallel duplicate query). Scoped to
   * org (+ branch, when known) so a wrong-org/branch id reads as "not
   * found" rather than leaking existence.
   */
  static async getByIdForWorkshop(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string | null,
    id: string
  ): Promise<ServiceResult<RepairOrderHeader | null>> {
    let query = supabase
      .from("repair_orders")
      .select(HEADER_COLUMNS)
      .eq("id", id)
      .eq("organization_id", orgId)
      .is("deleted_at", null);

    if (branchId) query = query.eq("branch_id", branchId);

    const { data, error } = await query.maybeSingle();
    if (error) return { success: false, error: error.message };
    if (!data) return { success: true, data: null };

    return { success: true, data: mapRepairOrderHeader(data as RepairOrderHeaderDbRow) };
  }

  /**
   * Phase 7: candidate advisors for the assignment picker.
   *
   * Interim scoping rule (see this session's Phase 7 report for the full
   * product-decision writeup): the architecture doc's own prose ("a
   * crm_contacts row representing an internal advisor gets a
   * crm_party_roles row with role='employee'") is not literally
   * implementable against the live schema -- crm_party_roles.role is a
   * PARTY-level tag (crm_party_roles.party_id -> crm_parties.id), not a
   * CONTACT-level one; crm_party_roles has no contact_id column at all.
   * Scoping this picker by that mechanism would require inventing a new,
   * undecided, undocumented synthetic-party-per-employee scheme. Pending
   * that product decision, this method uses the narrower, schema-real,
   * reversible signal instead: crm_contacts rows already linked to a real
   * platform user (linked_user_id IS NOT NULL) -- the only contacts that
   * can ever function as an "owner" under the manage_own ownership model
   * (repair_orders_update's RLS requires exactly this link). An advisor
   * with no linked_user_id can still be assigned by a manage_all caller
   * via a free-text/manual path later if ever needed -- not built here,
   * since nothing in this phase's accepted scope requires it.
   *
   * This list is inherently gated by crm_contacts' own RLS (a separate
   * crm.contacts.read permission) -- a caller without it simply sees an
   * empty list here (safe default), not an error; advisor assignment is
   * optional everywhere it is used, so an empty candidate list degrades
   * gracefully rather than blocking anything.
   */
  static async listAdvisorCandidates(
    supabase: SupabaseClient,
    orgId: string
  ): Promise<ServiceResult<RepairOrderAdvisorCandidate[]>> {
    const { data, error } = await supabase
      .from("crm_contacts")
      .select("id, display_name")
      .eq("organization_id", orgId)
      .not("linked_user_id", "is", null)
      .is("deleted_at", null)
      .order("display_name", { ascending: true });

    if (error) {
      return {
        success: false,
        error: normalizeRepairOrderCrudError("listAdvisorCandidates", error),
      };
    }

    return {
      success: true,
      data: (data ?? []).map((row) => ({
        id: (row as { id: string; display_name: string }).id,
        displayName: (row as { id: string; display_name: string }).display_name,
      })),
    };
  }

  /**
   * Phase 7: resolve the caller's OWN linked crm_contacts row, if any --
   * used by createRepairOrderAction/createRepairOrder to validate a
   * manage_own-only actor's advisor_contact_id selection server-side
   * (defense in depth ahead of repair_orders_insert's own RLS, which
   * enforces the identical rule at the DB layer as the authoritative
   * gate), and by the detail page to determine UI ownership.
   *
   * Correction pass Finding A (CONFIRMED, fixed here): this previously
   * performed a plain authenticated SELECT against crm_contacts
   * (organization_id = :org AND linked_user_id = :user) -- itself subject
   * to crm_contacts_select's own RLS (requires a separate crm.contacts.read
   * grant), reintroducing in the application layer the exact same
   * visibility bug already fixed at the RLS layer by
   * is_own_advisor_contact(). Live-reproduced before fixing: a real
   * self-linked crm_contacts row, for which is_own_advisor_contact()
   * correctly returned true, returned ZERO rows from this exact query
   * shape under an actor holding only workshop.repair_orders.manage_own/
   * .read (no crm.contacts.read) -- meaning a genuine advisor without CRM
   * access was shown as a non-owner on their own RepairOrder, and could not
   * self-assign during manual creation. Fixed by calling the new
   * get_own_advisor_contact_id(p_organization_id) SECURITY DEFINER RPC
   * (20260911183702) instead -- derives identity from auth.uid() only (no
   * caller-supplied user id parameter at all, unlike the previous plain
   * query, which is why this method's own signature no longer takes a
   * userId parameter either), organization-scoped, exposes only the
   * resulting contact id. Returns null (not an error) when the caller has
   * no linked contact -- a real, valid state (e.g. an advisor identity not
   * yet created in CRM).
   */
  static async getOwnAdvisorContactId(
    supabase: SupabaseClient,
    orgId: string
  ): Promise<ServiceResult<string | null>> {
    const { data, error } = await supabase.rpc("get_own_advisor_contact_id", {
      p_organization_id: orgId,
    });

    if (error) {
      return {
        success: false,
        error: normalizeRepairOrderCrudError("getOwnAdvisorContactId", error),
      };
    }
    return { success: true, data: (data as string | null) ?? null };
  }

  /**
   * Phase 7: manual RepairOrder header creation. organization_id/branch_id
   * are always the caller's trusted server-side active context (never
   * accepted from `input`) -- matching the accepted "no separate manual-
   * order subsystem" rule: this INSERT goes through the exact same table,
   * RLS, and permission gates a materialized RepairOrder uses.
   *
   * identity_status is derived here, never accepted as client input:
   * 'resolved' when zl_number is present, 'unresolved' otherwise -- the
   * same rule repair_orders_resolved_requires_zl_number enforces at the DB
   * layer (this is a convenience default matching that constraint, not a
   * bypass of it).
   *
   * advisor_contact_id is passed through as given by the caller (already
   * pre-validated by the action layer via getOwnAdvisorContactId for a
   * manage_own-only actor) -- repair_orders_insert's own RLS WITH CHECK
   * remains the authoritative enforcement either way.
   */
  static async createRepairOrder(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string,
    userId: string,
    input: CreateRepairOrderInput
  ): Promise<ServiceResult<RepairOrderHeader>> {
    const zlNumber = input.zl_number ?? null;

    const { data, error } = await supabase
      .from("repair_orders")
      .insert({
        organization_id: orgId,
        branch_id: branchId,
        zl_number: zlNumber,
        order_number: input.order_number ?? null,
        vin: input.vin ?? null,
        vehicle_brand: input.vehicle_brand ?? null,
        client_name: input.client_name ?? null,
        dealer_name: input.dealer_name ?? null,
        advisor_contact_id: input.advisor_contact_id ?? null,
        identity_status: zlNumber ? "resolved" : "unresolved",
        created_by: userId,
      })
      .select(HEADER_COLUMNS)
      .single();

    if (error) {
      return { success: false, error: normalizeRepairOrderCrudError("createRepairOrder", error) };
    }

    const header = mapRepairOrderHeader(data as RepairOrderHeaderDbRow);

    const emitResult = await eventService.emit({
      actionKey: "workshop.repair_orders.created",
      actorType: "user",
      actorUserId: userId,
      organizationId: orgId,
      branchId,
      entityType: "repair_order",
      entityId: header.id,
      metadata: { zlNumber: header.zlNumber, identityStatus: header.identityStatus },
      eventTier: "baseline",
    });
    if (!emitResult.success) {
      console.error(
        "[RepairOrdersService.createRepairOrder] Failed to emit workshop.repair_orders.created:",
        (emitResult as { success: false; error: string }).error
      );
    }

    return { success: true, data: header };
  }

  /**
   * Phase 7: edit mutable header/business fields. NEVER touches
   * advisor_contact_id (assignAdvisor) or status (changeStatus) -- both
   * carry stricter, dedicated RLS/authorization rules of their own.
   * organization_id/branch_id are query filters, never write targets.
   *
   * A race-safe conditional filter is unnecessary here (unlike
   * changeStatus): concurrent header edits are a last-write-wins field
   * update, the same convention CrmContactsService.update already uses --
   * ownership/authorization is re-verified live by RLS on every request
   * regardless, so no stale-permission window exists.
   *
   * identity_status is re-derived whenever the payload includes zl_number
   * (even when set back to null) -- never accepted directly.
   */
  static async updateHeader(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string | null,
    userId: string,
    id: string,
    patch: Omit<UpdateRepairOrderHeaderInput, "id">
  ): Promise<ServiceResult<RepairOrderHeader>> {
    const updatePayload: Record<string, unknown> = { ...patch };
    if ("zl_number" in patch) {
      updatePayload.identity_status = patch.zl_number ? "resolved" : "unresolved";
    }

    let query = supabase
      .from("repair_orders")
      .update(updatePayload)
      .eq("id", id)
      .eq("organization_id", orgId)
      .is("deleted_at", null);
    if (branchId) query = query.eq("branch_id", branchId);

    const { data, error } = await query.select(HEADER_COLUMNS).maybeSingle();

    if (error) {
      return { success: false, error: normalizeRepairOrderCrudError("updateHeader", error) };
    }
    if (!data) {
      return {
        success: false,
        error: "RepairOrder not found, wrong branch, or you are not authorized to edit it",
      };
    }

    const header = mapRepairOrderHeader(data as RepairOrderHeaderDbRow);

    const emitResult = await eventService.emit({
      actionKey: "workshop.repair_orders.header_updated",
      actorType: "user",
      actorUserId: userId,
      organizationId: orgId,
      branchId,
      entityType: "repair_order",
      entityId: id,
      metadata: { fields: Object.keys(patch) },
      eventTier: "baseline",
    });
    if (!emitResult.success) {
      console.error(
        "[RepairOrdersService.updateHeader] Failed to emit workshop.repair_orders.header_updated:",
        (emitResult as { success: false; error: string }).error
      );
    }

    return { success: true, data: header };
  }

  /**
   * Phase 7: reassign (or clear) the advisor. A separate method from
   * updateHeader because RLS treats advisor_contact_id specially: a
   * manage_own-only actor's WITH CHECK requires the NEW value to remain
   * their own linked contact, so in practice only a manage_all caller (or
   * a manage_own caller re-affirming themselves, a no-op) can ever
   * succeed here for a real reassignment -- matching the accepted "manage_
   * all can reassign; manage_own may edit header but not change advisor"
   * policy. This method itself performs no extra authorization beyond the
   * org/branch/id filter -- repair_orders_update's RLS is the authoritative
   * gate; the action layer adds a clearer pre-check for UX.
   */
  static async assignAdvisor(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string | null,
    userId: string,
    id: string,
    advisorContactId: string | null
  ): Promise<ServiceResult<RepairOrderHeader>> {
    let query = supabase
      .from("repair_orders")
      .update({ advisor_contact_id: advisorContactId })
      .eq("id", id)
      .eq("organization_id", orgId)
      .is("deleted_at", null);
    if (branchId) query = query.eq("branch_id", branchId);

    const { data, error } = await query.select(HEADER_COLUMNS).maybeSingle();
    if (error) {
      return { success: false, error: normalizeRepairOrderCrudError("assignAdvisor", error) };
    }
    if (!data) {
      return {
        success: false,
        error: "RepairOrder not found, wrong branch, or you are not authorized to reassign it",
      };
    }

    const header = mapRepairOrderHeader(data as RepairOrderHeaderDbRow);

    const emitResult = await eventService.emit({
      actionKey: "workshop.repair_orders.advisor_assigned",
      actorType: "user",
      actorUserId: userId,
      organizationId: orgId,
      branchId,
      entityType: "repair_order",
      entityId: id,
      metadata: { advisorContactId },
      eventTier: "baseline",
    });
    if (!emitResult.success) {
      console.error(
        "[RepairOrdersService.assignAdvisor] Failed to emit workshop.repair_orders.advisor_assigned:",
        (emitResult as { success: false; error: string }).error
      );
    }

    return { success: true, data: header };
  }

  /**
   * Phase 7: lifecycle transition (open/closed/archived). Race-safe via a
   * conditional UPDATE keyed on the CURRENT status matching `fromStatus`
   * (the same "guard inside the WHERE clause" pattern already established
   * by WddMatcherService.approveSession) -- a concurrent second caller who
   * changed the status first causes this call to affect 0 rows, reported
   * as a specific "conflict" error rather than silently reporting success.
   * `canTransitionRepairOrderStatus` (the existing, authoritative domain
   * helper) is checked BEFORE attempting the UPDATE, so an illegal
   * transition is rejected with a clear message before ever reaching the
   * DB -- RLS's `status <> 'archived'` restriction for manage_own remains
   * the authoritative server-side enforcement of the archive-requires-
   * manage_all rule either way.
   */
  static async changeStatus(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string | null,
    userId: string,
    id: string,
    fromStatus: RepairOrderStatus,
    toStatus: RepairOrderStatus
  ): Promise<ServiceResult<RepairOrderHeader>> {
    let query = supabase
      .from("repair_orders")
      .update({ status: toStatus })
      .eq("id", id)
      .eq("organization_id", orgId)
      .eq("status", fromStatus)
      .is("deleted_at", null);
    if (branchId) query = query.eq("branch_id", branchId);

    const { data, error } = await query.select(HEADER_COLUMNS).maybeSingle();
    if (error) {
      return { success: false, error: normalizeRepairOrderCrudError("changeStatus", error) };
    }
    if (!data) {
      return {
        success: false,
        error:
          "RepairOrder was not in the expected status (already changed by someone else, not found, wrong branch, or you are not authorized to change it)",
      };
    }

    const header = mapRepairOrderHeader(data as RepairOrderHeaderDbRow);

    const emitResult = await eventService.emit({
      actionKey: "workshop.repair_orders.status_changed",
      actorType: "user",
      actorUserId: userId,
      organizationId: orgId,
      branchId,
      entityType: "repair_order",
      entityId: id,
      metadata: { previousStatus: fromStatus, newStatus: toStatus },
      eventTier: "baseline",
    });
    if (!emitResult.success) {
      console.error(
        "[RepairOrdersService.changeStatus] Failed to emit workshop.repair_orders.status_changed:",
        (emitResult as { success: false; error: string }).error
      );
    }

    return { success: true, data: header };
  }

  /**
   * Phase 8: list the logical RepairOrderLines for one RepairOrder --
   * durable business lines (SKU/part/ordered/received/issued/outstanding/
   * available), NEVER grouped by source document (that is provenance,
   * Phase 9's own separate concern).
   *
   * Identity rule (verified against the materialization RPC and the
   * architecture doc before writing this, not assumed): `repair_order_
   * lines.id` is the ONLY identity/grouping key this method ever uses.
   * Two lines sharing the same `product_code` (SKU) are NEVER merged or
   * cross-attributed here, even though Phase 3's own materialization RPC
   * (20260910075814) happens to merge SAME-SKU SOURCE lines into one
   * logical line AT CREATE TIME within a single materialization call (an
   * existing, accepted Phase 3 design choice, out of this phase's scope to
   * change) -- that upstream behavior does not guarantee two independent
   * `repair_order_lines` rows can never share a product_code (a null-
   * product_code source line always gets its own new logical line; a
   * future manual-line-entry feature could create genuine duplicates on
   * purpose). This method's own query never re-groups by product_code, so
   * it is correct regardless of how the rows it reads were created --
   * see the explicit same-SKU-independence test for the live proof.
   *
   * Derived-quantity formulas (per the architecture doc's Correction 5,
   * `repair_order_line_movement_links` table comment, and this phase's own
   * verification pass -- NOT invented from field names):
   *   receivedQuantity     = SUM(applied_quantity) WHERE relation_type = 'receipt'
   *   issuedQuantity       = SUM(applied_quantity) WHERE relation_type = 'issue'
   *   outstandingToReceive = orderedQuantity - receivedQuantity
   *   availableForIssue    = receivedQuantity - issuedQuantity
   * All four grouped strictly by repair_order_line_id (never by SKU,
   * movement, or source document). This resolves, rather than guesses at,
   * the architecture doc's own flagged ambiguity ("remaining_quantity =
   * received - issued, OR ordered - issued, per final product definition
   * -- needs one product-owner confirmation"): rather than picking one
   * interpretation of a single ambiguous "remaining" number, this method
   * exposes BOTH well-defined quantities under their own unambiguous
   * names, matching the worked example exactly (ordered=5, received=5,
   * issued=3 -> outstandingToReceive=0, availableForIssue=2).
   *
   * NOT clamped to zero: `applied_quantity` is always > 0 (DB CHECK) and
   * `relation_type` buckets are disjoint, but nothing today (Phase 10 does
   * not exist yet) prevents receiving more than ordered or issuing more
   * than received -- a negative outstanding/available value is a genuine,
   * meaningful over-receipt/over-issue signal, not an error state to hide.
   * No established convention says to clamp; inventing one was avoided.
   *
   * Reversal handling (disclosed limitation, not invented): `relation_type
   * = 'reversal'` exists in the live CHECK constraint but has NO defined
   * netting/linkage semantics anywhere in the architecture doc, the schema
   * (no column identifies WHICH receipt/issue a reversal row reverses), or
   * any existing code path (nothing writes 'reversal' rows yet -- Phase 10
   * is what will eventually populate this table at all; live-verified 0
   * rows exist in repair_order_line_movement_links today). This method
   * therefore excludes 'reversal' rows from both sums entirely, matching
   * the architecture doc's own literal formula (which only ever sums
   * 'receipt' or 'issue', never mentions netting a 'reversal' bucket
   * against either) -- it does NOT attempt to guess a netting rule. A
   * future phase that defines real reversal semantics must add an explicit
   * linkage column and update this method accordingly.
   *
   * Scope/authorization: mirrors getByIdForWorkshop's own explicit org(+
   * branch) pre-check on the PARENT repair_orders row (never trusting a
   * client-supplied org/branch, and not relying solely on RLS, since a
   * caller's permission grants may span more than one branch) -- an
   * inaccessible/wrong-org/wrong-branch/soft-deleted parent yields an
   * empty line list, never an error and never a leak. `repair_order_lines`
   * and `repair_order_line_movement_links` are both Tier 1 join-derived-
   * scope tables (FORCE RLS, scoped through repair_order_id ->
   * repair_orders -> has_branch_permission('workshop.repair_orders.read'))
   * -- the exact same read boundary as the parent RepairOrder itself, not
   * a widened one.
   *
   * Query shape: two bounded queries total (the parent existence/scope
   * check, then one PostgREST embedded-select that nests each line's own
   * `repair_order_line_movement_links` rows via a single server-side
   * join/aggregation) -- not one query per line, no N+1. No new DB view,
   * RPC, or migration was needed or added for this.
   */
  static async listRepairOrderLines(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string | null,
    repairOrderId: string
  ): Promise<ServiceResult<RepairOrderLineReadModel[]>> {
    let parentQuery = supabase
      .from("repair_orders")
      .select("id")
      .eq("id", repairOrderId)
      .eq("organization_id", orgId)
      .is("deleted_at", null);
    if (branchId) parentQuery = parentQuery.eq("branch_id", branchId);

    const { data: parent, error: parentError } = await parentQuery.maybeSingle();
    if (parentError) {
      return {
        success: false,
        error: normalizeRepairOrderCrudError("listRepairOrderLines", parentError),
      };
    }
    if (!parent) {
      // Not found / wrong org / wrong branch / soft-deleted -- no lines
      // exposed, no error, no existence leak. Matches getByIdForWorkshop's
      // own "success: true, data: null" convention for the same case.
      return { success: true, data: [] };
    }

    const { data, error } = await supabase
      .from("repair_order_lines")
      .select(
        `id, variant_id, product_code, product_name, ordered_quantity, unit, status,
         repair_order_line_movement_links(applied_quantity, relation_type)`
      )
      .eq("repair_order_id", repairOrderId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });

    if (error) {
      return {
        success: false,
        error: normalizeRepairOrderCrudError("listRepairOrderLines", error),
      };
    }

    return {
      success: true,
      data: (data ?? []).map((row) =>
        mapRepairOrderLine(row as RepairOrderLineDbRow, repairOrderId)
      ),
    };
  }
}
