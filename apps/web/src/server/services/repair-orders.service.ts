import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { eventService } from "./event.service";
import type {
  CreateRepairOrderInput,
  UpdateRepairOrderHeaderInput,
} from "@/lib/validations/repair-orders";
import type {
  RepairOrderStatus,
  RepairOrderLineStatus,
  WorkshopSourceDocumentType,
} from "@/lib/types/repair-orders";

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

/**
 * A3 simplification pass: mechanical extraction of the identical 4-line
 * "match against my own allowlist array, else null" shape previously
 * repeated verbatim across 5 `normalize*RpcError` functions below,
 * differing only in which allowlist array they closed over. Pure
 * matcher -- returns the original (already-safe) message on a match, or
 * `null` on no match -- so each of the 5 functions below keeps its own
 * domain-specific fallback message, call signature, and call sites
 * completely unchanged. Allowlist DATA (the 5 arrays) is intentionally
 * NOT merged -- each stays its own independently-curated table.
 */
function normalizeKnownRpcError(
  error: { code?: string; message: string },
  knownErrors: ReadonlyArray<{ code: string; pattern: RegExp }>
): string | null {
  const isKnown = knownErrors.some(
    (known) => error.code === known.code && known.pattern.test(error.message)
  );
  return isKnown ? error.message : null;
}

function normalizeMaterializationRpcError(error: { code?: string; message: string }): string {
  return (
    normalizeKnownRpcError(error, REPAIR_ORDER_RPC_KNOWN_ERRORS) ??
    "Materialization failed due to an unexpected server error. Please try again or contact support."
  );
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
 * Phase 10: the atomic, fully-validated writer for
 * `repair_order_line_movement_links` (`attach_repair_order_line_movement`,
 * apps/web/supabase-target/supabase/migrations/20260912162802_repair_order_
 * line_movement_attach_rpc.sql) RAISEs a small set of deliberately-authored,
 * already-safe messages, each with a stable ERRCODE -- same allowlist
 * pattern as normalizeMaterializationRpcError above (code AND message-shape
 * match required, not errcode alone, for the same reason Finding E fixed
 * there: several of these codes are broad Postgres error CLASSES a native,
 * un-authored error could also raise).
 */
const REPAIR_ORDER_MOVEMENT_LINK_KNOWN_ERRORS: ReadonlyArray<{ code: string; pattern: RegExp }> = [
  { code: "28000", pattern: /^p_actor_user_id must match the authenticated caller$/ },
  { code: "22023", pattern: /^applied_quantity must be greater than zero$/ },
  { code: "22023", pattern: /^relation_type must be receipt or issue$/ },
  { code: "P0002", pattern: /^RepairOrderLine not found: / },
  {
    code: "42501",
    pattern: /^Not authorized to attribute inventory movements for this branch$/,
  },
  { code: "P0002", pattern: /^Inventory movement line not found: / },
  {
    code: "42501",
    pattern: /^Movement line organization\/branch does not match the RepairOrder$/,
  },
  {
    code: "55000",
    pattern: /^Only posted movement lines can be attributed to a RepairOrderLine$/,
  },
  { code: "22023", pattern: /^relation_type .* does not match movement category / },
  { code: "55000", pattern: /^Movement is referenced to a different RepairOrder$/ },
  {
    code: "55000",
    pattern: /^Movement line product\/variant does not match the RepairOrderLine's own variant$/,
  },
  {
    code: "22023",
    pattern: /^applied_quantity exceeds the movement line's own remaining quantity /,
  },
  {
    code: "23505",
    pattern:
      /^This movement line is already attributed to this RepairOrderLine with this relation type$/,
  },
];

function normalizeMovementLinkRpcError(error: { code?: string; message: string }): string {
  return (
    normalizeKnownRpcError(error, REPAIR_ORDER_MOVEMENT_LINK_KNOWN_ERRORS) ??
    "Failed to attribute this movement to the repair order line due to an unexpected server error. Please try again or contact support."
  );
}

/**
 * Phase 10A: `inventory_create_reservation`/`inventory_release_reservation`
 * (the existing, unmodified generic reservation engine RPCs -- REPO/LIVE
 * VERIFIED, `apps/web/src/server/services/inventory-enterprise.service.ts`'s
 * own `createReservation`/`releaseReservation` wrap the identical RPCs but
 * discard the Postgres errcode when normalizing, which this file's own
 * hardened code+message-pattern convention needs -- so this service calls
 * `supabase.rpc(...)` directly, exactly like every other Zone 3 RPC caller
 * in this file, rather than through that thinner wrapper. This is NOT a
 * duplicate implementation of the reservation algorithm -- it is the same
 * RPC call, just made directly for error fidelity).
 *
 * Every RAISE in both RPC bodies (LIVE VERIFIED via `pg_get_functiondef`)
 * uses a bare `RAISE EXCEPTION 'message'` with no explicit `USING ERRCODE`,
 * so Postgres assigns the default `P0001` (raise_exception) SQLSTATE to
 * all of them -- matched here by code AND exact message text together,
 * same hardening as `normalizeMovementLinkRpcError` above (a raw,
 * un-authored error sharing the same generic P0001 code must never be
 * mistaken for one of these specific, safe messages).
 */
const REPAIR_ORDER_RESERVATION_KNOWN_ERRORS: ReadonlyArray<{ code: string; pattern: RegExp }> = [
  { code: "P0001", pattern: /^Missing warehouse\.inventory\.operate permission$/ },
  { code: "P0001", pattern: /^At least one reservation line is required$/ },
  { code: "P0001", pattern: /^Reservation quantity must be positive$/ },
  { code: "P0001", pattern: /^Phase 2 hard reservations require location_id$/ },
  { code: "P0001", pattern: /^Reservation variant is not active$/ },
  { code: "P0001", pattern: /^Insufficient available stock to reserve$/ },
  { code: "P0001", pattern: /^Reservation not found$/ },
  { code: "P0001", pattern: /^Unable to lock inventory balance row$/ },
];

function normalizeReservationRpcError(error: { code?: string; message: string }): string {
  return (
    normalizeKnownRpcError(error, REPAIR_ORDER_RESERVATION_KNOWN_ERRORS) ??
    "Failed to process this reservation request due to an unexpected server error. Please try again or contact support."
  );
}

/**
 * Phase 10B: `inventory_create_allocation`'s own known, safe error shapes --
 * every message below copied verbatim from `pg_get_functiondef` output
 * (LIVE VERIFIED, not guessed), matched by code AND exact message text
 * together, same hardening rationale as the reservation allowlist above
 * (every RAISE in this RPC's body is a bare `RAISE EXCEPTION 'message'`,
 * default `P0001` SQLSTATE). `Unable to lock inventory balance row` is
 * shared with the reservation RPC -- both call the same
 * `inventory_get_or_create_balance_for_update` helper.
 */
const REPAIR_ORDER_ALLOCATION_KNOWN_ERRORS: ReadonlyArray<{ code: string; pattern: RegExp }> = [
  { code: "P0001", pattern: /^Missing warehouse\.inventory\.operate permission$/ },
  { code: "P0001", pattern: /^At least one allocation line is required$/ },
  { code: "P0001", pattern: /^Allocation quantity must be positive$/ },
  { code: "P0001", pattern: /^Allocation variant is not active$/ },
  { code: "P0001", pattern: /^Reservation line not found for allocation$/ },
  { code: "P0001", pattern: /^Allocation exceeds remaining reservation quantity$/ },
  { code: "P0001", pattern: /^Insufficient available stock to allocate$/ },
  { code: "P0001", pattern: /^Unable to lock inventory balance row$/ },
];

function normalizeAllocationRpcError(error: { code?: string; message: string }): string {
  return (
    normalizeKnownRpcError(error, REPAIR_ORDER_ALLOCATION_KNOWN_ERRORS) ??
    "Failed to process this allocation request due to an unexpected server error. Please try again or contact support."
  );
}

/**
 * Phase 10C: `inventory_create_container`/`inventory_add_to_container`/
 * `inventory_remove_from_container`/`inventory_seal_container`'s own known,
 * safe error shapes -- every message below copied verbatim from
 * `pg_get_functiondef` output (LIVE VERIFIED, not guessed), matched by
 * code AND exact message pattern together. Unlike Phase 10/10A/10B's own
 * RPCs (which let Postgres assign the default P0001 to every RAISE), these
 * four RPCs each set an explicit, specific SQLSTATE per error
 * (`USING ERRCODE = ...`) -- matched here accordingly. Some messages carry
 * a `%`-substituted dynamic value (current status, or a quantity) -- those
 * patterns match the surrounding literal text and allow any content in the
 * substituted position, never the other way around.
 *
 * CORRECTION PASS (2026-09-14, external review): `inventory_add_to_container`
 * gained two new checks -- allocation/container location-identity and
 * RepairOrder-ownership identity (both LIVE VERIFIED via `pg_get_functiondef`
 * re-fetched after applying the forward-migration fix) -- their exact error
 * text is added below alongside the original set, unchanged otherwise.
 */
const REPAIR_ORDER_CONTAINER_KNOWN_ERRORS: ReadonlyArray<{ code: string; pattern: RegExp }> = [
  { code: "28000", pattern: /^p_actor_user_id must match the authenticated caller$/ },
  { code: "42501", pattern: /^Missing warehouse\.inventory\.operate permission$/ },
  { code: "22023", pattern: /^Container code is required$/ },
  { code: "P0002", pattern: /^Location not found$/ },
  { code: "22023", pattern: /^Only stockable bins can hold a container$/ },
  { code: "22023", pattern: /^Quantity must be positive$/ },
  { code: "P0002", pattern: /^Container not found$/ },
  { code: "55000", pattern: /^Container is not open for adding stock \(status: .+\)$/ },
  { code: "55000", pattern: /^Container is not open for removing stock \(status: .+\)$/ },
  { code: "P0002", pattern: /^Allocation line not found$/ },
  {
    code: "22023",
    pattern: /^Allocation location does not match the container's own current location$/,
  },
  {
    code: "P0002",
    pattern: /^Allocation does not belong to this container's own RepairOrder$/,
  },
  {
    code: "22023",
    pattern:
      /^Placement quantity exceeds the allocation line's own allocated quantity \(already placed .+, allocated .+\)$/,
  },
  { code: "P0002", pattern: /^Unable to resolve unit for this allocation line's own variant$/ },
  { code: "P0002", pattern: /^Allocation-container link not found$/ },
  {
    code: "22023",
    pattern: /^Cannot remove more than the currently linked quantity \(linked .+, requested .+\)$/,
  },
  { code: "55000", pattern: /^Container cannot be sealed from its current status \(.+\)$/ },
];

function normalizeContainerRpcError(error: { code?: string; message: string }): string {
  return (
    normalizeKnownRpcError(error, REPAIR_ORDER_CONTAINER_KNOWN_ERRORS) ??
    "Failed to process this container request due to an unexpected server error. Please try again or contact support."
  );
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
 * Phase 10: the result of a successful `attachMovementToRepairOrderLine`
 * call -- one real, persisted `repair_order_line_movement_links` row,
 * mapped to a domain type so callers never depend on the RPC's raw jsonb
 * key names directly.
 */
export interface RepairOrderLineMovementAttachment {
  id: string;
  repairOrderLineId: string;
  inventoryMovementLineId: string;
  appliedQuantity: number;
  relationType: "receipt" | "issue";
}

/**
 * Phase 10A: the result of a successful `reserveForLine` call -- the raw
 * jsonb `inventory_create_reservation` returns, mapped to a domain type.
 */
export interface RepairOrderLineReservationResult {
  reservationId: string;
  reservationNumber: string;
  status: string;
}

/**
 * Phase 10A: the result of a successful `releaseReservationForLine` call.
 */
export interface RepairOrderLineReservationReleaseResult {
  reservationId: string;
  status: string;
}

/**
 * Phase 10A: one real, persisted `inventory_reservation_lines` row under a
 * reservation attributed to a RepairOrderLine. `outstandingQuantity` is the
 * LIVE-VERIFIED engine formula (`inventory_release_reservation`'s own body,
 * verbatim): `reserved_quantity - released_quantity - fulfilled_quantity`
 * -- computed here from the same three persisted columns, never a fourth,
 * separately-tracked number. `fulfilled_quantity` is whatever the generic
 * engine itself produces (0 today, since nothing calls
 * `inventory_create_allocation` yet -- that is Phase 10B's own job, not
 * fabricated here).
 */
export interface RepairOrderLineReservationLine {
  id: string;
  variantId: string;
  locationId: string | null;
  lotId: string | null;
  serialId: string | null;
  reservedQuantity: number;
  releasedQuantity: number;
  fulfilledQuantity: number;
  outstandingQuantity: number;
}

/**
 * Phase 10A: one real, persisted `inventory_reservations` row referencing
 * this RepairOrderLine (`reference_type = 'repair_order_line'`,
 * `reference_id = repair_order_line_id`). A RepairOrderLine may have MANY
 * of these over time (no uniqueness constraint restricts it, LIVE
 * VERIFIED) -- each one may itself carry more than one
 * `inventory_reservation_lines` row (the schema allows it, even though
 * this phase's own writer -- `reserveForLine` -- always creates exactly
 * one). `outstandingQuantity` here is the SUM of every one of this
 * reservation's own lines' own outstanding quantity, never assumed to be
 * exactly one line's worth.
 */
export interface RepairOrderLineReservation {
  id: string;
  reservationNumber: string;
  status: string;
  expiresAt: string | null;
  createdAt: string;
  lines: RepairOrderLineReservationLine[];
  outstandingQuantity: number;
}

/**
 * Phase 10B: the result of a successful `allocateForLine` call -- the raw
 * jsonb `inventory_create_allocation` returns, mapped to a domain type.
 */
export interface RepairOrderLineAllocationResult {
  allocationId: string;
  allocationNumber: string;
  status: string;
}

/**
 * Phase 10B: one real, persisted `inventory_allocation_lines` row reachable
 * from this RepairOrderLine via the authoritative relational chain --
 * RepairOrderLine -> (reservation.reference_id) -> reservation ->
 * reservation lines -> (allocation_lines.reservation_line_id) -> allocation
 * lines -- never a redundant RepairOrderLine FK on the allocation tables
 * themselves (none was added; LIVE VERIFIED none is needed -- the chain is
 * sufficient and already indexed, see `listAllocationsForLine`).
 * `outstandingQuantity` is the LIVE-VERIFIED engine formula
 * (`inventory_release_allocation`'s own body, verbatim):
 * `allocated_quantity - fulfilled_quantity` (this table has no
 * `released_quantity` column, unlike reservation lines -- confirmed live,
 * not assumed). A flat list, not grouped by allocation header -- each row
 * already carries its own parent allocation's number/status inline, and a
 * RepairOrderLine's allocations do not need a header-level rollup the way
 * reservations' own multi-line-per-reservation shape did.
 */
export interface RepairOrderLineAllocationLine {
  id: string;
  allocationId: string;
  allocationNumber: string;
  allocationStatus: string;
  reservationLineId: string | null;
  variantId: string;
  locationId: string;
  lotId: string | null;
  serialId: string | null;
  allocatedQuantity: number;
  fulfilledQuantity: number;
  outstandingQuantity: number;
}

/**
 * Phase 10C: the result of a successful `createContainerForRepairOrder`
 * call -- the raw jsonb `inventory_create_container` returns, mapped to a
 * domain type. A freshly created container always starts `status: "empty"`
 * (LIVE VERIFIED, this RPC's own deliberate choice -- see its doc comment).
 */
export interface RepairOrderContainerResult {
  containerId: string;
  code: string;
  status: string;
}

/**
 * Phase 10C: the result of a successful `placeAllocationInContainer` call.
 */
export interface RepairOrderContainerPlacementResult {
  linkId: string;
  containerLineId: string;
  quantity: number;
  containerStatus: string;
}

/**
 * Phase 10C: the result of a successful `removeAllocationFromContainer`
 * call.
 */
export interface RepairOrderContainerRemovalResult {
  linkId: string;
  remainingLinkQuantity: number;
  containerLineId: string;
  remainingContainerLineQuantity: number;
  containerStatus: string;
}

/**
 * Zone 3 <-> Zone 5 integration layer (2026-09-15): one container's own
 * contribution to a RepairOrderLine's stock at ONE location bucket --
 * `quantity` is the sum of every active `inventory_allocation_container_links`
 * row for this container, for this RepairOrderLine's own allocation lines
 * whose own `location_id` equals the bucket's `locationId` (never the
 * container's own total contents, which may include other allocation
 * lines/RepairOrders entirely -- see `inventory_containers`' own
 * many-allocation-lines-per-container cardinality, Phase 10C).
 */
export interface RepairOrderLinePhysicalStateContainer {
  containerId: string;
  containerCode: string;
  quantity: number;
  currentLocationId: string | null;
  status: string;
}

/**
 * One physical-location bucket in a RepairOrderLine's own reconciled state.
 * `locationId` values are the UNION of every location either Zone 5's own
 * `repair_order_line_locations` projection OR this line's own outstanding
 * allocations claim -- a location present on only one side is still
 * surfaced here (with the other side's own quantities at 0), which is
 * exactly what makes a `location_mismatch`/`uncontainerized` bucket
 * visible rather than silently dropped.
 */
export interface RepairOrderLinePhysicalStateLocation {
  locationId: string;
  /** Zone 5's own `repair_order_line_locations.quantity` at this location. */
  physicalQuantity: number;
  /** Sum of this line's own outstanding reservation-line quantity here. */
  reservedQuantity: number;
  /** Sum of this line's own outstanding allocation-line quantity here. */
  allocatedQuantity: number;
  /** Sum of active container-link quantity for allocation lines here. */
  containerizedQuantity: number;
  /** `allocatedQuantity - containerizedQuantity`, floored at 0. */
  uncontainerizedAllocatedQuantity: number;
  containers: RepairOrderLinePhysicalStateContainer[];
}

/**
 * - `"consistent"`: every signal available agrees (or there is simply
 *   nothing yet to disagree about -- e.g. Zone 5 has received stock but
 *   nothing has been reserved yet).
 * - `"uncontainerized"`: allocated stock exists that has not (yet) been
 *   placed into any container -- a normal, expected mid-lifecycle state,
 *   not an error.
 * - `"location_mismatch"`: Zone 5's own spatial projection and this line's
 *   own outstanding allocations name DIFFERENT, non-overlapping location
 *   sets -- a real, reachable divergence (see the integration audit) since
 *   nothing today wires a reservation's own `location_id` to wherever
 *   Zone 5's putaway actually placed the stock.
 * - `"unknown"`: either Zone 5's own attribution for a touched
 *   (location, variant) bucket is explicitly marked uncertain
 *   (`repair_order_location_attribution_uncertain` -- Zone 5's own
 *   documented "treat as UNKNOWN regardless of what the projection
 *   currently holds" contract, honored here verbatim), or this method
 *   found an active container link whose own container disagrees with its
 *   own allocation line's `location_id` (which the Phase 10C RPC itself
 *   should never allow -- surfaced as `unknown`, not silently trusted,
 *   per the "no guessing" requirement).
 */
export type RepairOrderLinePhysicalStateConsistency =
  | "consistent"
  | "uncontainerized"
  | "location_mismatch"
  | "unknown";

/**
 * Zone 3 <-> Zone 5 integration layer (2026-09-15): "what is the current
 * physical stock state for this RepairOrderLine?", reconciling Zone 5's own
 * spatial projection (`repair_order_line_locations`) with Phase 10's own
 * reservation/allocation/container chain, WITHOUT mutating either side.
 * See `RepairOrdersService.getPhysicalStateForLine`'s own doc comment for
 * the full reconciliation algorithm and its "never guess" guarantee.
 */
export interface RepairOrderLinePhysicalState {
  repairOrderLineId: string;
  locations: RepairOrderLinePhysicalStateLocation[];
  consistency: RepairOrderLinePhysicalStateConsistency;
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

/**
 * Phase 9: provenance read model -- which source document(s) and source
 * line(s) back a RepairOrder, and which logical RepairOrderLine each source
 * line contributes to. Deliberately a SEPARATE shape from Phase 8's
 * `RepairOrderLineReadModel` -- a logical line is never a source line (one
 * logical line may be backed by many source lines, across many documents;
 * a source document may back many RepairOrders). See
 * `getRepairOrderProvenance`'s own doc comment for the full model.
 */
export interface RepairOrderProvenanceContribution {
  /** The logical RepairOrderLine (Phase 8) this source line contributes to. */
  repairOrderLineId: string;
  /** repair_order_line_source_links.quantity_contribution -- persisted,
   * never recomputed from quantity/SKU heuristics. */
  quantityContribution: number;
  linkedAt: string;
}

export interface RepairOrderProvenanceSourceLine {
  id: string;
  productCode: string | null;
  productName: string | null;
  quantity: number;
  unit: string | null;
  rawText: string | null;
  /**
   * Deep Matcher traceability reference -- the exact `wdd_matcher_lines.id`
   * this source line was parsed from, when known. Deliberately NOT joined
   * to fetch the target row's own content: `wdd_matcher_lines`' (and
   * `wdd_matcher_sessions`') own SELECT RLS requires `wdd_matcher.read`, a
   * separate Matcher-module permission Workshop callers holding only
   * `workshop.repair_orders.read` are not guaranteed to hold -- exactly the
   * same class of cross-module RLS dependency Phase 8 already declined for
   * `inventory_variants`. The id alone already satisfies this phase's own
   * acceptance criterion ("traceable back to specific wdd_matcher_lines
   * rows") without widening any RLS boundary.
   */
  wddMatcherLineId: string | null;
  /**
   * Which logical RepairOrderLine(s) this source line contributes to.
   * Modeled as an array purely because `repair_order_line_source_links` has
   * no NOT-NULL/exactly-one constraint forcing a link to exist at all (a
   * source line can legitimately have zero links -- e.g. Phase 3's
   * materialization RPC skips linking for a zero/null-quantity source
   * line) -- NOT because more than one is ever expected.
   * `repair_order_line_source_links_source_line_unique` (a live, verified
   * UNIQUE index on `workshop_source_document_line_id` alone) guarantees at
   * most one contribution per source line; this array is therefore always
   * length 0 or 1 in practice, never collapsed or assumed to be exactly 1.
   */
  contributions: RepairOrderProvenanceContribution[];
}

export interface RepairOrderProvenanceDocument {
  id: string;
  documentType: WorkshopSourceDocumentType;
  externalDocumentNumber: string;
  sourceSessionId: string;
  officialWarehouseCode: string | null;
  createdAt: string;
  /** repair_order_source_document_links.linked_at -- when THIS RepairOrder
   * was linked to this document (may differ from the document's own
   * createdAt for a later-arriving document attaching to an
   * already-existing order). */
  linkedAt: string;
  lines: RepairOrderProvenanceSourceLine[];
}

interface ProvenanceDbRow {
  workshop_source_document_id: string;
  linked_at: string;
  document: {
    id: string;
    document_type: string;
    external_document_number: string;
    source_session_id: string;
    official_warehouse_code: string | null;
    created_at: string;
    lines: Array<{
      id: string;
      product_code: string | null;
      product_name: string | null;
      quantity: number;
      unit: string | null;
      raw_text: string | null;
      wdd_matcher_line_id: string | null;
      line_links: Array<{
        repair_order_line_id: string;
        quantity_contribution: number;
        linked_at: string;
      }> | null;
    }> | null;
  } | null;
}

function mapProvenanceDocument(
  row: ProvenanceDbRow,
  ownLineIds: ReadonlySet<string>
): RepairOrderProvenanceDocument | null {
  const doc = row.document;
  if (!doc) return null;

  const lines: RepairOrderProvenanceSourceLine[] = [];
  for (const line of doc.lines ?? []) {
    // External-review Finding (2026-09-12, CONFIRMED, fixed here): filtering
    // only each line's own `contributions` array (the prior version of this
    // function) still returned the SOURCE LINE ITSELF -- with its
    // productCode/productName/quantity/unit/rawText/wddMatcherLineId all
    // intact -- for a line whose ONLY contribution belongs to a DIFFERENT
    // RepairOrder sharing this document. That is real metadata leakage: a
    // caller viewing RepairOrder A's provenance could see RepairOrder B's
    // own source-line content (just with an empty contributions array),
    // even though the actual product question this phase answers is "which
    // source lines contributed to THIS RepairOrder", not "show every line
    // contained in every shared document". No accepted product requirement
    // anywhere in the architecture doc calls for the latter (checked, not
    // assumed, before applying this fix) -- the line-level content itself
    // is therefore filtered, not just the contribution reference inside it.
    const ownContributions = (line.line_links ?? [])
      .filter((link) => ownLineIds.has(link.repair_order_line_id))
      .map((link) => ({
        repairOrderLineId: link.repair_order_line_id,
        quantityContribution: link.quantity_contribution,
        linkedAt: link.linked_at,
      }));

    // Zero own-order contributions -- whether because this line was never
    // linked to anything at all, or because its only link(s) belong to a
    // DIFFERENT RepairOrder sharing this document -- means this line is not
    // provenance of THIS RepairOrder. Omitted entirely (not included with
    // an empty contributions array), rather than fabricating an "unlinked"
    // placeholder line into a RepairOrder's own provenance tree.
    if (ownContributions.length === 0) continue;

    lines.push({
      id: line.id,
      productCode: line.product_code,
      productName: line.product_name,
      quantity: line.quantity,
      unit: line.unit,
      rawText: line.raw_text,
      wddMatcherLineId: line.wdd_matcher_line_id,
      contributions: ownContributions,
    });
  }

  return {
    id: doc.id,
    documentType: doc.document_type as WorkshopSourceDocumentType,
    externalDocumentNumber: doc.external_document_number,
    sourceSessionId: doc.source_session_id,
    officialWarehouseCode: doc.official_warehouse_code,
    createdAt: doc.created_at,
    linkedAt: row.linked_at,
    // The document itself is ALWAYS kept (never omitted here) even if every
    // one of its lines was just filtered out above -- the
    // repair_order_source_document_links row linking it to THIS RepairOrder
    // is itself real, genuine document-level provenance ("this document was
    // linked to this order"), independent of which specific lines within it
    // happen to belong to this order vs. another one it is also shared
    // with. See getRepairOrderProvenance's own doc comment for why this
    // state is possible at all (not reachable through today's
    // materialization RPC, but not schema-prevented either) and why keeping
    // the document with zero visible lines is the truthful choice, not
    // silently dropping a real link.
    lines,
  };
}

/**
 * Phase 9: pure derivation, not a query -- groups an already-fetched
 * provenance tree by logical RepairOrderLine id, for the "Sources (N)"
 * affordance on a Phase 8 line row. Takes the SAME data
 * `getRepairOrderProvenance` already returned; never issues its own query
 * (there is nothing left to fetch -- the full tree, in both directions, was
 * already retrieved in that one call).
 */
export function groupProvenanceByRepairOrderLine(
  documents: RepairOrderProvenanceDocument[],
  repairOrderLineId: string
): Array<{
  document: RepairOrderProvenanceDocument;
  sourceLine: RepairOrderProvenanceSourceLine;
  contribution: RepairOrderProvenanceContribution;
}> {
  const result: Array<{
    document: RepairOrderProvenanceDocument;
    sourceLine: RepairOrderProvenanceSourceLine;
    contribution: RepairOrderProvenanceContribution;
  }> = [];
  for (const document of documents) {
    for (const sourceLine of document.lines) {
      for (const contribution of sourceLine.contributions) {
        if (contribution.repairOrderLineId === repairOrderLineId) {
          result.push({ document, sourceLine, contribution });
        }
      }
    }
  }
  return result;
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

  /**
   * Phase 9: full source-document/source-line provenance for one
   * RepairOrder -- "where did this come from?" Explicitly a DIFFERENT
   * concept from Phase 8's logical-line list: one document may back many
   * RepairOrders (M:N via `repair_order_source_document_links`, a
   * composite-PK link table with no cardinality restriction in either
   * direction), one RepairOrder may be backed by many documents, and one
   * logical RepairOrderLine may be backed by many source lines across many
   * documents. This method never merges/collapses any of that -- it
   * returns the full tree, and `groupProvenanceByRepairOrderLine` (a pure
   * function above, not a second query) re-indexes the SAME data by
   * logical line for the UI's line-level "Sources (N)" affordance.
   *
   * Query architecture (verified against the actual live data shape before
   * choosing this, not assumed): ONE hierarchical PostgREST embedded-select
   * -- `repair_order_source_document_links` (scoped to this RepairOrder) ->
   * nested `workshop_source_documents` -> nested `workshop_source_document_
   * lines` -> nested `repair_order_line_source_links`. Postgres/PostgREST
   * resolves this as a single query with a server-side join/aggregation,
   * not one query per document or per line -- chosen over (a) fetching
   * documents then looping to fetch each one's lines (real N+1, rejected)
   * or (b) a new SQL view/RPC (unnecessary: live data is small -- 26
   * documents / 202 lines total across the whole database at verification
   * time, and PostgREST's own embed mechanism already expresses this exact
   * shape in one round trip). Preceded by the same explicit parent-scope
   * check Phase 7/8 already established (`getByIdForWorkshop`/
   * `listRepairOrderLines`'s own convention) -- never trusting a
   * client-supplied org/branch, not relying on RLS alone. Followed by ONE
   * more small, indexed query fetching this order's own logical-line ids
   * (`repair_order_lines.repair_order_id`, indexed since Phase 2/8) -- used
   * to filter cross-order contribution leakage, see the inline comment
   * below for the exact scenario this closes. Total: 3 bounded queries,
   * independent of how many documents/lines/links exist -- still no
   * per-document or per-line looping.
   *
   * Does NOT join `wdd_matcher_lines`/`wdd_matcher_sessions` for content --
   * see `RepairOrderProvenanceSourceLine.wddMatcherLineId`'s own doc
   * comment for why (a cross-module RLS dependency on `wdd_matcher.read`,
   * declined for the same reason Phase 8 declined joining
   * `inventory_variants`). `quantity_contribution` is always the persisted
   * DB value, never recomputed from SKU/quantity heuristics.
   *
   * External-review Finding (2026-09-12, CONFIRMED, fixed): the ownLineIds
   * filter above only protects the CONTRIBUTION reference (which logical
   * line a source line points to) -- it does not, by itself, prevent a
   * source line belonging ENTIRELY to a different RepairOrder (sharing a
   * document with this one) from still appearing with its own full content
   * (productCode/productName/quantity/unit/rawText/wddMatcherLineId). Fixed
   * in `mapProvenanceDocument`: a source line with ZERO contributions
   * belonging to THIS order (whether never-linked at all, or linked only to
   * a different order) is omitted from the returned `lines` array entirely
   * -- "which source lines contributed to THIS RepairOrder" is the actual
   * product question, not "show every line contained in every shared
   * document" (no accepted requirement for the latter was found anywhere in
   * the architecture doc). The DOCUMENT itself is still always returned
   * (its `repair_order_source_document_links` row is real, genuine
   * document-level provenance) even if this filtering leaves it with zero
   * visible lines -- not reachable through today's materialization RPC (a
   * document is always linked to the SAME order its own lines contribute
   * to, live-verified), but not schema-prevented either; keeping the real
   * link with an empty line list is the truthful choice over silently
   * dropping it.
   *
   * Scope/authorization: identical read boundary to the parent RepairOrder
   * -- `workshop_source_documents`/`repair_order_source_document_links`/
   * `workshop_source_document_lines`/`repair_order_line_source_links` are
   * all Tier 1 join-derived-scope tables (unchanged, Phase 2), each
   * requiring `workshop.repair_orders.read` on the parent RepairOrder's
   * organization_id/branch_id. An inaccessible/wrong-org/wrong-branch/
   * soft-deleted parent yields an empty provenance list, never an error,
   * never an existence leak -- matches `listRepairOrderLines`'s own
   * convention exactly. A manually-created RepairOrder with zero linked
   * documents is a genuine, valid, non-error state (an empty array), not
   * fabricated data.
   */
  static async getRepairOrderProvenance(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string | null,
    repairOrderId: string
  ): Promise<ServiceResult<RepairOrderProvenanceDocument[]>> {
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
        error: normalizeRepairOrderCrudError("getRepairOrderProvenance", parentError),
      };
    }
    if (!parent) {
      return { success: true, data: [] };
    }

    /**
     * Cross-order contribution leak, found and fixed while verifying the
     * "one document -> many orders, without leaking each other's logical
     * lines" case (not assumed safe): `repair_order_source_document_links`
     * is a genuine M:N link, so a single `workshop_source_documents` row
     * can legitimately be linked to MULTIPLE RepairOrders -- and because
     * `repair_order_line_source_links_source_line_unique` only restricts a
     * SOURCE line to at most one contribution TOTAL (never that all of a
     * shared document's lines belong to the same order), individual lines
     * within one shared document can genuinely contribute to DIFFERENT
     * orders' logical lines. A naive fetch of this RepairOrder's document
     * tree would, for a document it shares with another order, still
     * return that OTHER order's `repair_order_line_id` inside the shared
     * document's own line `line_links` -- leaking a reference to a logical
     * line this caller's RepairOrder does not own. Fixed by first fetching
     * this order's own logical-line ids (one extra bounded, indexed query
     * on `repair_order_lines.repair_order_id`, already indexed since
     * Phase 2/8), then filtering every source line's `contributions` array
     * to only the entries whose `repairOrderLineId` is in that set --
     * never trimming the document/line listing itself (a document's own
     * line contents are legitimate shared provenance metadata; only WHICH
     * logical line a contribution points to is the sensitive, order-scoped
     * reference).
     */
    const { data: ownLines, error: ownLinesError } = await supabase
      .from("repair_order_lines")
      .select("id")
      .eq("repair_order_id", repairOrderId)
      .is("deleted_at", null);
    if (ownLinesError) {
      return {
        success: false,
        error: normalizeRepairOrderCrudError("getRepairOrderProvenance", ownLinesError),
      };
    }
    const ownLineIds = new Set((ownLines ?? []).map((row) => (row as { id: string }).id));

    const { data, error } = await supabase
      .from("repair_order_source_document_links")
      .select(
        `workshop_source_document_id, linked_at,
         document:workshop_source_documents(
           id, document_type, external_document_number, source_session_id,
           official_warehouse_code, created_at,
           lines:workshop_source_document_lines(
             id, product_code, product_name, quantity, unit, raw_text, wdd_matcher_line_id,
             line_links:repair_order_line_source_links(repair_order_line_id, quantity_contribution, linked_at)
           )
         )`
      )
      .eq("repair_order_id", repairOrderId)
      .order("linked_at", { ascending: true });

    if (error) {
      return {
        success: false,
        error: normalizeRepairOrderCrudError("getRepairOrderProvenance", error),
      };
    }

    const documents: RepairOrderProvenanceDocument[] = [];
    for (const row of (data ?? []) as unknown as ProvenanceDbRow[]) {
      const mapped = mapProvenanceDocument(row, ownLineIds);
      if (mapped) documents.push(mapped);
    }

    return { success: true, data: documents };
  }

  /**
   * Phase 10: attribute one already-posted, real `inventory_movement_lines`
   * row to a RepairOrderLine -- the ONLY writer this phase adds for
   * `repair_order_line_movement_links`. Calls the atomic SECURITY DEFINER
   * RPC `attach_repair_order_line_movement` (20260912162802_repair_order_
   * line_movement_attach_rpc.sql), which is the single place every
   * attribution validation rule lives (actor identity, branch permission,
   * cross-org/branch movement-line match, posted-status, relation_type <->
   * movement-category match, RepairOrder-reference consistency where the
   * movement carries one, variant compatibility where the RepairOrderLine
   * carries one, and the applied-quantity-never-exceeds-the-movement-line's
   * -own-quantity cap, enforced under a row lock so concurrent attempts
   * against the SAME movement line cannot race past the cap) -- see that
   * migration's own comments for the exact rules. This method performs no
   * additional validation of its own and makes no assumption about SKU:
   * every RepairOrderLine/movement-line pairing is exactly what the caller
   * explicitly passed in, never inferred.
   *
   * `relation_type: 'issue'` is accepted by the RPC's own signature (kept
   * forward-compatible for Phase 10F, which will reuse this exact same
   * primitive rather than needing a new one) but cannot succeed against any
   * data live today -- LIVE VERIFIED this session: the target project has
   * no `inventory_movement_types` row with `category = 'issue'` at all (the
   * only live categories are `receipt`, `transfer`, `adjustment`,
   * `bin_operation`), so the RPC's own category-match check rejects every
   * real issue attempt today. This method does not fabricate an issue flow
   * to work around that -- it is a genuine, disclosed, live-data-backed
   * limitation, not a design choice made here.
   *
   * `relation_type: 'reversal'` is deliberately not accepted at all (the
   * RPC rejects it outright) -- no netting/linkage semantics for it exist
   * anywhere in the architecture, matching Phase 8's own read-side
   * disclosed limitation (`listRepairOrderLines`'s own doc comment).
   *
   * Event emission (Mode A, best-effort, same pattern as
   * materializeFromSession above): emitted AFTER the RPC commits; a failure
   * to emit never rolls back or hides the already-successful attribution.
   */
  static async attachMovementToRepairOrderLine(
    supabase: SupabaseClient,
    actorUserId: string,
    params: {
      repairOrderLineId: string;
      inventoryMovementLineId: string;
      appliedQuantity: number;
      relationType: "receipt" | "issue";
    }
  ): Promise<ServiceResult<RepairOrderLineMovementAttachment>> {
    const { data, error } = await supabase.rpc("attach_repair_order_line_movement", {
      p_actor_user_id: actorUserId,
      p_repair_order_line_id: params.repairOrderLineId,
      p_inventory_movement_line_id: params.inventoryMovementLineId,
      p_applied_quantity: params.appliedQuantity,
      p_relation_type: params.relationType,
    });

    if (error) {
      console.error(
        "[RepairOrdersService.attachMovementToRepairOrderLine] attach_repair_order_line_movement RPC error:",
        error
      );
      return { success: false, error: normalizeMovementLinkRpcError(error) };
    }

    const row = data as {
      id: string;
      repair_order_line_id: string;
      inventory_movement_line_id: string;
      applied_quantity: number;
      relation_type: string;
    };
    const result: RepairOrderLineMovementAttachment = {
      id: row.id,
      repairOrderLineId: row.repair_order_line_id,
      inventoryMovementLineId: row.inventory_movement_line_id,
      appliedQuantity: row.applied_quantity,
      relationType: row.relation_type as "receipt" | "issue",
    };

    const emitResult = await eventService.emit({
      actionKey: "workshop.repair_orders.movement_attributed",
      actorType: "user",
      actorUserId,
      entityType: "repair_order_line",
      entityId: result.repairOrderLineId,
      metadata: {
        inventoryMovementLineId: result.inventoryMovementLineId,
        appliedQuantity: result.appliedQuantity,
        relationType: result.relationType,
      },
      eventTier: "baseline",
    });

    if (!emitResult.success) {
      // Best-effort per Mode A -- the domain write above already succeeded
      // and is returned to the caller regardless of this failure.
      console.error(
        "[RepairOrdersService.attachMovementToRepairOrderLine] Failed to emit workshop.repair_orders.movement_attributed:",
        (emitResult as { success: false; error: string }).error
      );
    }

    return { success: true, data: result };
  }

  /**
   * Phase 10A: resolve a RepairOrderLine's own authoritative scope --
   * its parent RepairOrder's `organization_id`/`branch_id`, and the line's
   * own `variant_id` (nullable -- some logical lines have no variant match
   * yet, per Phase 8's own read model). Two bounded queries (parent-then-
   * child), matching every other Zone 3 method's own "never trust a
   * client-supplied org/branch" convention -- never a single query that
   * would let a caller supply org/branch directly. Returns `null` for a
   * missing/soft-deleted line or a missing/soft-deleted parent RepairOrder
   * -- the caller turns that into a safe, existence-non-leaking error.
   */
  private static async resolveRepairOrderLineScope(
    supabase: SupabaseClient,
    repairOrderLineId: string
  ): Promise<{
    repairOrderId: string;
    organizationId: string;
    branchId: string;
    variantId: string | null;
  } | null> {
    const { data: line, error: lineError } = await supabase
      .from("repair_order_lines")
      .select("id, repair_order_id, variant_id")
      .eq("id", repairOrderLineId)
      .is("deleted_at", null)
      .maybeSingle();

    if (lineError || !line) return null;

    const { data: order, error: orderError } = await supabase
      .from("repair_orders")
      .select("id, organization_id, branch_id")
      .eq("id", line.repair_order_id)
      .is("deleted_at", null)
      .maybeSingle();

    if (orderError || !order) return null;

    return {
      repairOrderId: order.id,
      organizationId: order.organization_id,
      branchId: order.branch_id,
      variantId: line.variant_id,
    };
  }

  /**
   * A2 simplification pass: mechanical extraction of the exact
   * `belongsToThisLine` boolean previously copy-pasted verbatim in
   * `releaseReservationForLine` and `allocateForLine`. Pure predicate --
   * no error message, no side effect -- so each call site keeps its own
   * (deliberately non-leaking, possibly per-site-different) failure
   * message unchanged. `!!row` makes the return type strictly boolean;
   * this is a pure runtime no-op since `row && ...` was only ever used
   * in a truthy/falsy `if` check at both original sites, never compared
   * for identity or serialized.
   */
  private static belongsToRepairOrderLine(
    row: {
      organization_id: string;
      branch_id: string;
      reference_type: string;
      reference_id: string;
    } | null,
    scope: { organizationId: string; branchId: string },
    repairOrderLineId: string
  ): boolean {
    return (
      !!row &&
      row.organization_id === scope.organizationId &&
      row.branch_id === scope.branchId &&
      row.reference_type === "repair_order_line" &&
      row.reference_id === repairOrderLineId
    );
  }

  /**
   * Phase 10C: resolve a RepairOrder's own authoritative
   * `organization_id`/`branch_id` directly (no logical-line hop needed --
   * container ownership is at the RepairOrder header level, per decision:
   * "one RepairOrder may own many containers; one container operationally
   * belongs to one RepairOrder"). Same never-trust-client-supplied-scope
   * convention as `resolveRepairOrderLineScope`. Returns `null` for a
   * missing/soft-deleted RepairOrder.
   */
  private static async resolveRepairOrderScope(
    supabase: SupabaseClient,
    repairOrderId: string
  ): Promise<{ organizationId: string; branchId: string } | null> {
    const { data: order, error } = await supabase
      .from("repair_orders")
      .select("id, organization_id, branch_id")
      .eq("id", repairOrderId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error || !order) return null;

    return { organizationId: order.organization_id, branchId: order.branch_id };
  }

  /**
   * Phase 10A: reserve stock for one RepairOrderLine, via the existing,
   * unmodified generic `inventory_create_reservation` RPC (LIVE VERIFIED:
   * `SECURITY INVOKER`, gated by its own `has_branch_permission(...,
   * 'warehouse.inventory.operate')` check -- this method does not
   * duplicate that check, it relies on the RPC's own, exactly like the
   * existing Warehouse-module `createInventoryReservationAction` already
   * does for its own generic callers).
   *
   * Ownership is always server-authoritative: `organization_id`/
   * `branch_id` are resolved from the RepairOrderLine's own parent
   * RepairOrder (`resolveRepairOrderLineScope`), never accepted from the
   * caller -- so a caller cannot forge `reference_id` to claim a
   * cross-org/branch line, and cannot make this RPC operate against a
   * variant the line does not actually carry (the RPC call always uses
   * THIS line's own `variant_id`, read server-side, never a
   * caller-supplied one).
   *
   * `reference_type = 'repair_order_line'` / `reference_id =
   * repairOrderLineId` is the ONLY ownership signal ever written --
   * never SKU, product_code, VIN, or RepairOrder number, per the
   * project's own "RepairOrderLine identity != SKU identity" invariant
   * (same rule Phase 10's own attribution RPC enforces for movement
   * links).
   *
   * `location_id` LIVE VERIFIED as a hard requirement of the RPC itself
   * ("Phase 2 hard reservations require location_id") -- this method does
   * not default or infer one; the caller (UI) must supply a real,
   * in-branch location holding available stock.
   */
  static async reserveForLine(
    supabase: SupabaseClient,
    actorUserId: string,
    input: {
      repairOrderLineId: string;
      locationId: string;
      quantity: number;
      lotId?: string | null;
      serialId?: string | null;
      expiresAt?: string | null;
      notes?: string | null;
    }
  ): Promise<ServiceResult<RepairOrderLineReservationResult>> {
    const scope = await RepairOrdersService.resolveRepairOrderLineScope(
      supabase,
      input.repairOrderLineId
    );
    if (!scope) {
      return { success: false, error: "RepairOrderLine not found" };
    }
    if (!scope.variantId) {
      return {
        success: false,
        error: "This line has no product/variant identity to reserve stock against",
      };
    }

    const { data, error } = await supabase.rpc("inventory_create_reservation", {
      p_organization_id: scope.organizationId,
      p_branch_id: scope.branchId,
      p_lines: [
        {
          variant_id: scope.variantId,
          location_id: input.locationId,
          quantity: input.quantity,
          lot_id: input.lotId ?? null,
          serial_id: input.serialId ?? null,
        },
      ],
      p_reference_type: "repair_order_line",
      p_reference_id: input.repairOrderLineId,
      p_reference_number: null,
      p_expires_at: input.expiresAt ?? null,
      p_notes: input.notes ?? null,
      p_actor_user_id: actorUserId,
    });

    if (error) {
      console.error(
        "[RepairOrdersService.reserveForLine] inventory_create_reservation RPC error:",
        error
      );
      return { success: false, error: normalizeReservationRpcError(error) };
    }

    const row = data as { reservation_id: string; reservation_number: string; status: string };
    const result: RepairOrderLineReservationResult = {
      reservationId: row.reservation_id,
      reservationNumber: row.reservation_number,
      status: row.status,
    };

    const emitResult = await eventService.emit({
      actionKey: "workshop.repair_orders.reservation_created",
      actorType: "user",
      actorUserId,
      entityType: "repair_order_line",
      entityId: input.repairOrderLineId,
      metadata: {
        reservationId: result.reservationId,
        quantity: input.quantity,
        locationId: input.locationId,
      },
      eventTier: "baseline",
    });
    if (!emitResult.success) {
      console.error(
        "[RepairOrdersService.reserveForLine] Failed to emit workshop.repair_orders.reservation_created:",
        (emitResult as { success: false; error: string }).error
      );
    }

    return { success: true, data: result };
  }

  /**
   * Phase 10A: release (and, by default, cancel) a reservation previously
   * created for one RepairOrderLine, via the existing, unmodified generic
   * `inventory_release_reservation` RPC.
   *
   * LIVE VERIFIED the RPC's own release granularity: it releases every
   * outstanding line of the WHOLE reservation it is given (`reserved -
   * released - fulfilled` per line, looped), not a caller-chosen partial
   * quantity and not a single line in isolation -- there is no
   * finer-grained release primitive in the generic engine today. This
   * method exposes exactly that granularity, honestly, rather than
   * implying a partial-quantity release this phase cannot actually offer.
   *
   * Ownership check (the central security requirement for this method):
   * before ever calling the release RPC, the reservation is read back and
   * verified to genuinely belong to THIS RepairOrderLine
   * (`reference_type = 'repair_order_line'` AND `reference_id =
   * repairOrderLineId`) AND to the line's own authoritative org/branch --
   * a caller cannot pass an arbitrary `reservationId` to release an
   * unrelated reservation just because they hold
   * `warehouse.inventory.operate` somewhere in the org (the underlying
   * RLS on `inventory_reservations` is branch-scoped, not
   * reference-scoped, so this check is NOT redundant with RLS -- it is
   * this domain's own additional ownership guarantee). A mismatch returns
   * the same generic "not found" the RPC itself would raise for a
   * genuinely missing id, so this never discloses whether an unrelated
   * reservation id exists.
   */
  static async releaseReservationForLine(
    supabase: SupabaseClient,
    actorUserId: string,
    input: {
      repairOrderLineId: string;
      reservationId: string;
      cancel?: boolean;
    }
  ): Promise<ServiceResult<RepairOrderLineReservationReleaseResult>> {
    const scope = await RepairOrdersService.resolveRepairOrderLineScope(
      supabase,
      input.repairOrderLineId
    );
    if (!scope) {
      return { success: false, error: "RepairOrderLine not found" };
    }

    const { data: reservation, error: reservationError } = await supabase
      .from("inventory_reservations")
      .select("id, organization_id, branch_id, reference_type, reference_id")
      .eq("id", input.reservationId)
      .is("deleted_at", null)
      .maybeSingle();

    if (reservationError) {
      console.error(
        "[RepairOrdersService.releaseReservationForLine] reservation lookup error:",
        reservationError
      );
      return {
        success: false,
        error:
          "Failed to process this reservation request due to an unexpected server error. Please try again or contact support.",
      };
    }

    const belongsToThisLine = RepairOrdersService.belongsToRepairOrderLine(
      reservation,
      scope,
      input.repairOrderLineId
    );

    if (!belongsToThisLine) {
      // Same message the RPC itself raises for a genuinely missing id --
      // an unrelated/cross-scope reservation id must be indistinguishable
      // from one that does not exist at all.
      return { success: false, error: "Reservation not found" };
    }

    const { data, error } = await supabase.rpc("inventory_release_reservation", {
      p_reservation_id: input.reservationId,
      p_actor_user_id: actorUserId,
      p_cancel: input.cancel ?? true,
    });

    if (error) {
      console.error(
        "[RepairOrdersService.releaseReservationForLine] inventory_release_reservation RPC error:",
        error
      );
      return { success: false, error: normalizeReservationRpcError(error) };
    }

    const row = data as { reservation_id: string; status: string };
    const result: RepairOrderLineReservationReleaseResult = {
      reservationId: row.reservation_id,
      status: row.status,
    };

    const emitResult = await eventService.emit({
      actionKey: "workshop.repair_orders.reservation_released",
      actorType: "user",
      actorUserId,
      entityType: "repair_order_line",
      entityId: input.repairOrderLineId,
      metadata: { reservationId: result.reservationId, status: result.status },
      eventTier: "baseline",
    });
    if (!emitResult.success) {
      console.error(
        "[RepairOrdersService.releaseReservationForLine] Failed to emit workshop.repair_orders.reservation_released:",
        (emitResult as { success: false; error: string }).error
      );
    }

    return { success: true, data: result };
  }

  /**
   * Phase 10A read model: every reservation genuinely attributed to one
   * RepairOrderLine (`reference_type='repair_order_line'`,
   * `reference_id=repairOrderLineId`), with each reservation's own lines
   * and their outstanding quantity (`reserved - released - fulfilled`,
   * the LIVE-VERIFIED engine formula). Deliberately does NOT assume 1
   * reservation or 1 line per reservation -- both are genuinely
   * many-valued in this schema (LIVE VERIFIED: no uniqueness constraint
   * restricts either). `deleted_at IS NULL` scoped, ordered oldest-first.
   * Org/branch scope is resolved from the parent RepairOrderLine, never
   * trusted from the caller, matching every other Zone 3 read method.
   *
   * Domain-integrity correction (2026-09-14, external review): header
   * reference equality is not sufficient proof of product identity (see
   * `allocateForLine`'s own doc comment for the full finding) -- only
   * lines whose own `variant_id` exactly matches this RepairOrderLine's
   * authoritative `variant_id` are counted; a reservation left with zero
   * matching lines after that filter is omitted from the result entirely.
   */
  static async listReservationsForLine(
    supabase: SupabaseClient,
    repairOrderLineId: string
  ): Promise<ServiceResult<RepairOrderLineReservation[]>> {
    const scope = await RepairOrdersService.resolveRepairOrderLineScope(
      supabase,
      repairOrderLineId
    );
    if (!scope) {
      // Not found / wrong scope -- no reservations exposed, no error, no
      // existence leak, matching listRepairOrderLines' own convention.
      return { success: true, data: [] };
    }

    const { data, error } = await supabase
      .from("inventory_reservations")
      .select(
        `id, reservation_number, status, expires_at, created_at,
         inventory_reservation_lines(id, variant_id, location_id, lot_id, serial_id, reserved_quantity, released_quantity, fulfilled_quantity)`
      )
      .eq("organization_id", scope.organizationId)
      .eq("branch_id", scope.branchId)
      .eq("reference_type", "repair_order_line")
      .eq("reference_id", repairOrderLineId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[RepairOrdersService.listReservationsForLine] query error:", error);
      return {
        success: false,
        error:
          "Failed to load reservations due to an unexpected server error. Please try again or contact support.",
      };
    }

    type ReservationRow = {
      id: string;
      reservation_number: string;
      status: string;
      expires_at: string | null;
      created_at: string;
      inventory_reservation_lines: Array<{
        id: string;
        variant_id: string;
        location_id: string | null;
        lot_id: string | null;
        serial_id: string | null;
        reserved_quantity: number;
        released_quantity: number;
        fulfilled_quantity: number;
      }> | null;
    };

    // Domain-integrity correction (2026-09-14, external review): a
    // reservation HEADER matching `reference_type`/`reference_id` is NOT
    // sufficient proof that one of its own LINES represents this
    // RepairOrderLine's product identity -- `reference_id` is generic
    // metadata with no FK (LIVE VERIFIED), and the generic Warehouse
    // reservation action accepts it as unrestricted client input, entirely
    // independent of each line's own `variant_id`. Only a reservation
    // line whose own `variant_id` exactly matches this RepairOrderLine's
    // own authoritative `scope.variantId` is counted as this line's own
    // reservation quantity -- never inferred by SKU/product_code. A
    // reservation with zero matching lines after this filter contributes
    // nothing and is omitted entirely (a reservation header alone, with no
    // line genuinely attributable to this RepairOrderLine, carries no
    // useful reservation-quantity information for it). `scope.variantId`
    // may be `null` (a RepairOrderLine with no product identity yet) --
    // no real reservation line can ever match that, which is correct
    // (mirrors `reserveForLine`'s own pre-existing no-variant guard).
    const reservations = (data as unknown as ReservationRow[])
      .map((row) => {
        const lines: RepairOrderLineReservationLine[] = (row.inventory_reservation_lines ?? [])
          .filter((line) => line.variant_id === scope.variantId)
          .map((line) => ({
            id: line.id,
            variantId: line.variant_id,
            locationId: line.location_id,
            lotId: line.lot_id,
            serialId: line.serial_id,
            reservedQuantity: line.reserved_quantity,
            releasedQuantity: line.released_quantity,
            fulfilledQuantity: line.fulfilled_quantity,
            outstandingQuantity:
              line.reserved_quantity - line.released_quantity - line.fulfilled_quantity,
          }));
        return {
          id: row.id,
          reservationNumber: row.reservation_number,
          status: row.status,
          expiresAt: row.expires_at,
          createdAt: row.created_at,
          lines,
          outstandingQuantity: lines.reduce((sum, l) => sum + l.outstandingQuantity, 0),
        };
      })
      .filter((reservation) => reservation.lines.length > 0);

    return { success: true, data: reservations };
  }

  /**
   * Phase 10B: convert an existing reservation line into an allocation for
   * one RepairOrderLine, via the existing, unmodified generic
   * `inventory_create_allocation` RPC (LIVE VERIFIED: `SECURITY INVOKER`,
   * gated by its own `has_branch_permission(..., 'warehouse.inventory.
   * operate')` check -- this method does not duplicate that check).
   *
   * Reservation-first is a HARD Zone 3 invariant: `p_lines[0].
   * reservation_line_id` is ALWAYS set from a real, ownership-verified
   * reservation line -- this method never calls the RPC with it omitted
   * (which the generic engine's own direct-allocation-without-reservation
   * path would otherwise allow; that path remains available to other,
   * non-RepairOrder callers of the same RPC, unchanged).
   *
   * Ownership (server-authoritative, never trusted from the caller): the
   * requested `reservationLineId` is read back together with its own
   * parent reservation header, and the header is verified to genuinely
   * belong to THIS RepairOrderLine (`reference_type = 'repair_order_line'`
   * AND `reference_id = repairOrderLineId`) AND to the line's own
   * authoritative org/branch (resolved via `resolveRepairOrderLineScope`,
   * reusing the exact same pattern `releaseReservationForLine` already
   * established in Phase 10A). A mismatch or not-found returns the same
   * generic "Reservation line not found" either way -- no existence leak.
   *
   * Variant/location/lot/serial are DERIVED from the reservation line's
   * own row, never accepted as client input, for a reason beyond ownership
   * security: LIVE VERIFIED (reading `inventory_create_allocation`'s own
   * body via `pg_get_functiondef`) the generic engine does NOT itself
   * cross-check that an allocation line's `variant_id`/`location_id`
   * agrees with its own `reservation_line_id` -- it trusts whatever
   * `p_lines` supplies independently, and updates the BALANCE ROW keyed by
   * whatever location/variant `p_lines` gives it, not the reservation
   * line's own location/variant. Accepting a client-supplied location
   * here (as the implementation plan's own illustrative signature
   * suggested) could silently decrement `reserved_quantity` on a balance
   * row the original reservation never actually incremented, corrupting
   * that balance -- a real correctness defect, not just a security one.
   * Deriving these fields from the reservation line closes both: the
   * allocation can never disagree with the stock it claims to convert,
   * and a client can never inject an out-of-branch location or a
   * mismatched variant. This is a deliberate, disclosed deviation from
   * the plan's illustrative `{ ..., locationId, ... }` signature -- not a
   * generic-engine change (nothing in the RPC or its callers elsewhere
   * was touched), and not a silent redesign (reported here and in the
   * review bundle).
   *
   * Does not reimplement any allocation/quantity math -- the RPC's own
   * row-locked check (`reserved_quantity - released_quantity -
   * fulfilled_quantity < requested -> reject`) is the sole authority for
   * whether the requested quantity is actually available on the
   * reservation line; this method does not pre-compute or duplicate that
   * comparison, only existence + ownership.
   */
  static async allocateForLine(
    supabase: SupabaseClient,
    actorUserId: string,
    input: {
      repairOrderLineId: string;
      reservationLineId: string;
      quantity: number;
    }
  ): Promise<ServiceResult<RepairOrderLineAllocationResult>> {
    const scope = await RepairOrdersService.resolveRepairOrderLineScope(
      supabase,
      input.repairOrderLineId
    );
    if (!scope) {
      return { success: false, error: "RepairOrderLine not found" };
    }

    const { data: reservationLine, error: reservationLineError } = await supabase
      .from("inventory_reservation_lines")
      .select("id, reservation_id, variant_id, location_id, lot_id, serial_id")
      .eq("id", input.reservationLineId)
      .maybeSingle();

    if (reservationLineError) {
      console.error(
        "[RepairOrdersService.allocateForLine] reservation line lookup error:",
        reservationLineError
      );
      return {
        success: false,
        error:
          "Failed to process this allocation request due to an unexpected server error. Please try again or contact support.",
      };
    }

    if (!reservationLine) {
      return { success: false, error: "Reservation line not found" };
    }

    const { data: reservation, error: reservationError } = await supabase
      .from("inventory_reservations")
      .select("id, organization_id, branch_id, reference_type, reference_id")
      .eq("id", reservationLine.reservation_id)
      .is("deleted_at", null)
      .maybeSingle();

    if (reservationError) {
      console.error(
        "[RepairOrdersService.allocateForLine] reservation lookup error:",
        reservationError
      );
      return {
        success: false,
        error:
          "Failed to process this allocation request due to an unexpected server error. Please try again or contact support.",
      };
    }

    const belongsToThisLine = RepairOrdersService.belongsToRepairOrderLine(
      reservation,
      scope,
      input.repairOrderLineId
    );

    if (!belongsToThisLine) {
      // Same message either way -- an unrelated/cross-scope reservation
      // line must be indistinguishable from one that does not exist.
      return { success: false, error: "Reservation line not found" };
    }

    // Domain-integrity correction (2026-09-14, external review): header
    // reference equality alone is NOT sufficient proof that this
    // reservation LINE represents the RepairOrderLine's own product
    // identity. `inventory_reservations.reference_id` is generic metadata
    // with no FK (LIVE VERIFIED, Phase 10A) -- the generic Warehouse
    // reservation action (`createInventoryReservationAction`) accepts
    // `reference_type`/`reference_id` as plain, unrestricted client input
    // (LIVE VERIFIED: `createReservationSchema` places no domain
    // constraint on either field) and each reservation LINE's own
    // `variant_id` is entirely independent of the header's reference --
    // so a reservation header can legitimately claim
    // `reference_id=<this RepairOrderLine>` while one of its own lines
    // carries a completely different variant. The final Zone 3 invariant
    // requires BOTH: exact header reference identity (already checked
    // above) AND exact reservation-LINE variant identity against this
    // RepairOrderLine's own authoritative `variant_id` (`scope.variantId`,
    // never inferred by SKU/product_code). `scope.variantId` may itself be
    // `null` (a RepairOrderLine with no product identity yet) -- no real
    // reservation line can ever match that, which is the correct outcome
    // (matches `reserveForLine`'s own pre-existing no-variant guard).
    if (!scope.variantId || reservationLine.variant_id !== scope.variantId) {
      // Same generic, non-leaking shape as the ownership check above --
      // never reveals that a mismatched reservation line exists.
      return { success: false, error: "Reservation line not found" };
    }

    if (!reservationLine.location_id) {
      // Defensive -- `inventory_create_reservation` enforces `location_id`
      // as a hard requirement at reserve time (LIVE VERIFIED, Phase 10A),
      // so this should be unreachable in practice. Kept as an explicit,
      // honest guard rather than assuming the invariant always held.
      return { success: false, error: "Reservation line has no location to allocate from" };
    }

    const { data, error } = await supabase.rpc("inventory_create_allocation", {
      p_organization_id: scope.organizationId,
      p_branch_id: scope.branchId,
      p_lines: [
        {
          variant_id: reservationLine.variant_id,
          location_id: reservationLine.location_id,
          quantity: input.quantity,
          lot_id: reservationLine.lot_id,
          serial_id: reservationLine.serial_id,
          reservation_line_id: input.reservationLineId,
        },
      ],
      p_reservation_id: reservation.id,
      p_reference_type: "repair_order_line",
      p_reference_id: input.repairOrderLineId,
      p_reference_number: null,
      p_actor_user_id: actorUserId,
    });

    if (error) {
      console.error(
        "[RepairOrdersService.allocateForLine] inventory_create_allocation RPC error:",
        error
      );
      return { success: false, error: normalizeAllocationRpcError(error) };
    }

    const row = data as { allocation_id: string; allocation_number: string; status: string };
    const result: RepairOrderLineAllocationResult = {
      allocationId: row.allocation_id,
      allocationNumber: row.allocation_number,
      status: row.status,
    };

    const emitResult = await eventService.emit({
      actionKey: "workshop.repair_orders.allocation_created",
      actorType: "user",
      actorUserId,
      entityType: "repair_order_line",
      entityId: input.repairOrderLineId,
      metadata: {
        allocationId: result.allocationId,
        reservationLineId: input.reservationLineId,
        quantity: input.quantity,
      },
      eventTier: "baseline",
    });
    if (!emitResult.success) {
      // Best-effort per Mode A -- the domain write above already succeeded
      // and is returned to the caller regardless of this failure.
      console.error(
        "[RepairOrdersService.allocateForLine] Failed to emit workshop.repair_orders.allocation_created:",
        (emitResult as { success: false; error: string }).error
      );
    }

    return { success: true, data: result };
  }

  /**
   * Phase 10B read model: every `inventory_allocation_lines` row reachable
   * from this RepairOrderLine via the authoritative chain (this line's own
   * reservations -> their own reservation lines -> allocation lines
   * pointing at those reservation lines via `reservation_line_id`). No
   * RepairOrderLine FK was added to either allocation table -- the chain,
   * already indexed (`inventory_allocation_lines_reservation_line_id_idx`,
   * LIVE VERIFIED to already exist), is sufficient. Returns `[]` (not an
   * error) for an unresolvable line, matching `listReservationsForLine`'s
   * own no-existence-leak convention. `deleted_at IS NULL` is filtered
   * explicitly on the allocation header, not left to RLS alone -- LIVE
   * VERIFIED `inventory_allocations_operate` (the `ALL`-command policy) has
   * no `deleted_at` check of its own, unlike the dedicated `_select`
   * policy; an actor with only `.operate` could otherwise see a
   * soft-deleted row through that policy (the exact same asymmetry
   * Phase 10A's own reservation read model already defends against the
   * same way).
   *
   * Domain-integrity correction (2026-09-14, external review): the chain
   * only follows reservation LINES whose own `variant_id` exactly matches
   * this RepairOrderLine's own authoritative `variant_id` -- a reservation
   * header matching `reference_type`/`reference_id` is not itself
   * sufficient proof of product identity (see `allocateForLine`'s own doc
   * comment for the full finding).
   */
  static async listAllocationsForLine(
    supabase: SupabaseClient,
    repairOrderLineId: string
  ): Promise<ServiceResult<RepairOrderLineAllocationLine[]>> {
    const scope = await RepairOrdersService.resolveRepairOrderLineScope(
      supabase,
      repairOrderLineId
    );
    if (!scope) {
      return { success: true, data: [] };
    }

    const { data: reservationRows, error: reservationError } = await supabase
      .from("inventory_reservations")
      .select("inventory_reservation_lines(id, variant_id)")
      .eq("organization_id", scope.organizationId)
      .eq("branch_id", scope.branchId)
      .eq("reference_type", "repair_order_line")
      .eq("reference_id", repairOrderLineId)
      .is("deleted_at", null);

    if (reservationError) {
      console.error(
        "[RepairOrdersService.listAllocationsForLine] reservation lookup error:",
        reservationError
      );
      return {
        success: false,
        error:
          "Failed to load allocations due to an unexpected server error. Please try again or contact support.",
      };
    }

    // Domain-integrity correction (2026-09-14, external review): a
    // reservation LINE is only a valid source of allocation state for
    // this RepairOrderLine if its own `variant_id` exactly matches the
    // RepairOrderLine's own authoritative `scope.variantId` -- header
    // reference equality alone is not sufficient (see `allocateForLine`'s
    // own doc comment for the full finding). Filtered here, BEFORE
    // collecting reservation-line ids, so a wrong-variant reservation
    // line's own allocation lines are never even queried, let alone
    // surfaced.
    type ReservationLinesRow = {
      inventory_reservation_lines: Array<{ id: string; variant_id: string }> | null;
    };
    const reservationLineIds = (
      (reservationRows ?? []) as unknown as ReservationLinesRow[]
    ).flatMap((r) =>
      (r.inventory_reservation_lines ?? [])
        .filter((l) => l.variant_id === scope.variantId)
        .map((l) => l.id)
    );

    if (reservationLineIds.length === 0) {
      return { success: true, data: [] };
    }

    const { data, error } = await supabase
      .from("inventory_allocation_lines")
      .select(
        `id, reservation_line_id, variant_id, location_id, lot_id, serial_id, allocated_quantity, fulfilled_quantity,
         allocation:inventory_allocations!inventory_allocation_lines_allocation_id_fkey(id, allocation_number, status, deleted_at)`
      )
      .eq("organization_id", scope.organizationId)
      .eq("branch_id", scope.branchId)
      .in("reservation_line_id", reservationLineIds);

    if (error) {
      console.error("[RepairOrdersService.listAllocationsForLine] query error:", error);
      return {
        success: false,
        error:
          "Failed to load allocations due to an unexpected server error. Please try again or contact support.",
      };
    }

    type AllocationHeaderEmbed = {
      id: string;
      allocation_number: string;
      status: string;
      deleted_at: string | null;
    };
    type AllocationLineRow = {
      id: string;
      reservation_line_id: string | null;
      variant_id: string;
      location_id: string;
      lot_id: string | null;
      serial_id: string | null;
      allocated_quantity: number;
      fulfilled_quantity: number;
      allocation: AllocationHeaderEmbed | AllocationHeaderEmbed[] | null;
    };

    const lines: RepairOrderLineAllocationLine[] = [];
    for (const row of (data ?? []) as unknown as AllocationLineRow[]) {
      const allocation = Array.isArray(row.allocation) ? row.allocation[0] : row.allocation;
      // Defensive re-filter, not relying on RLS alone -- see this method's
      // own doc comment for why the ALL/`.operate` policy does not itself
      // exclude a soft-deleted allocation header.
      if (!allocation || allocation.deleted_at !== null) continue;

      lines.push({
        id: row.id,
        allocationId: allocation.id,
        allocationNumber: allocation.allocation_number,
        allocationStatus: allocation.status,
        reservationLineId: row.reservation_line_id,
        variantId: row.variant_id,
        locationId: row.location_id,
        lotId: row.lot_id,
        serialId: row.serial_id,
        allocatedQuantity: row.allocated_quantity,
        fulfilledQuantity: row.fulfilled_quantity,
        outstandingQuantity: row.allocated_quantity - row.fulfilled_quantity,
      });
    }

    return { success: true, data: lines };
  }

  /**
   * Phase 10C: create a real physical container owned by one RepairOrder,
   * via the existing, unmodified generic `inventory_create_container` RPC
   * (LIVE VERIFIED: `SECURITY DEFINER`, owner `postgres`, its own actor-
   * identity check first, then `has_branch_permission(...,
   * 'warehouse.inventory.operate')`).
   *
   * Ownership is server-authoritative: `organization_id`/`branch_id` are
   * resolved from the RepairOrder's own row (`resolveRepairOrderScope`),
   * never accepted from the caller. `reference_type = 'repair_order'` /
   * `reference_id = repairOrderId` is the ONLY ownership signal ever
   * written -- the same generic reference pattern reservations/allocations
   * already use, requiring zero schema change. One RepairOrder may own
   * many containers; this method never assumes 1:1.
   *
   * A freshly created container always starts `status: "empty"` (the
   * RPC's own deliberate choice, LIVE VERIFIED -- an honestly empty
   * container, not a nominally-"active"-but-actually-empty one).
   */
  static async createContainerForRepairOrder(
    supabase: SupabaseClient,
    actorUserId: string,
    input: {
      repairOrderId: string;
      code: string;
      currentLocationId: string;
      type?: string;
    }
  ): Promise<ServiceResult<RepairOrderContainerResult>> {
    const scope = await RepairOrdersService.resolveRepairOrderScope(supabase, input.repairOrderId);
    if (!scope) {
      return { success: false, error: "RepairOrder not found" };
    }

    const { data, error } = await supabase.rpc("inventory_create_container", {
      p_actor_user_id: actorUserId,
      p_organization_id: scope.organizationId,
      p_branch_id: scope.branchId,
      p_code: input.code,
      p_current_location_id: input.currentLocationId,
      p_type: input.type ?? "container",
      p_reference_type: "repair_order",
      p_reference_id: input.repairOrderId,
    });

    if (error) {
      console.error(
        "[RepairOrdersService.createContainerForRepairOrder] inventory_create_container RPC error:",
        error
      );
      return { success: false, error: normalizeContainerRpcError(error) };
    }

    const row = data as { container_id: string; code: string; status: string };
    const result: RepairOrderContainerResult = {
      containerId: row.container_id,
      code: row.code,
      status: row.status,
    };

    const emitResult = await eventService.emit({
      actionKey: "workshop.repair_orders.container_created",
      actorType: "user",
      actorUserId,
      entityType: "repair_order",
      entityId: input.repairOrderId,
      metadata: { containerId: result.containerId, code: result.code },
      eventTier: "baseline",
    });
    if (!emitResult.success) {
      console.error(
        "[RepairOrdersService.createContainerForRepairOrder] Failed to emit workshop.repair_orders.container_created:",
        (emitResult as { success: false; error: string }).error
      );
    }

    return { success: true, data: result };
  }

  /**
   * Phase 10C: place a quantity of an already-allocated stock (one
   * RepairOrderLine's own `AllocationLine`) into a real physical container,
   * via the existing, unmodified generic `inventory_add_to_container` RPC.
   * Pure physical grouping -- never touches `allocation_line.
   * fulfilled_quantity`, `reservation_line.fulfilled_quantity`, or any
   * `inventory_balances` quantity (LIVE VERIFIED against the RPC's own
   * body, and proven live in `100_...`'s own T15a-e).
   *
   * Ownership (server-authoritative, never trusted from the caller):
   * 1. The RepairOrderLine's own scope is resolved
   *    (`resolveRepairOrderLineScope`).
   * 2. `allocationLineId` must be one of THIS RepairOrderLine's own
   *    allocation lines -- reuses `listAllocationsForLine` (which itself
   *    already enforces the Phase 10B domain-integrity correction's exact
   *    reservation-line-variant identity check) rather than re-deriving
   *    the ownership chain a third time.
   * 3. `containerId` must genuinely belong to the SAME RepairOrder
   *    (`reference_type = 'repair_order'`, `reference_id =
   *    repairOrderId`) -- a caller cannot place this RepairOrder's own
   *    allocation into a DIFFERENT RepairOrder's container merely by
   *    knowing its id.
   *
   * On any ownership mismatch, returns the same generic
   * "Allocation line not found for this RepairOrderLine" /
   * "Container not found for this RepairOrder" messages -- no existence
   * leak, matching every other Zone 3 ownership check's own convention.
   */
  static async placeAllocationInContainer(
    supabase: SupabaseClient,
    actorUserId: string,
    input: {
      repairOrderLineId: string;
      allocationLineId: string;
      containerId: string;
      quantity: number;
    }
  ): Promise<ServiceResult<RepairOrderContainerPlacementResult>> {
    const scope = await RepairOrdersService.resolveRepairOrderLineScope(
      supabase,
      input.repairOrderLineId
    );
    if (!scope) {
      return { success: false, error: "RepairOrderLine not found" };
    }

    const allocationsResult = await RepairOrdersService.listAllocationsForLine(
      supabase,
      input.repairOrderLineId
    );
    if (!allocationsResult.success) {
      return {
        success: false,
        error: (allocationsResult as { success: false; error: string }).error,
      };
    }
    const ownsAllocationLine = allocationsResult.data.some(
      (line) => line.id === input.allocationLineId
    );
    if (!ownsAllocationLine) {
      return { success: false, error: "Allocation line not found for this RepairOrderLine" };
    }

    const { data: container, error: containerError } = await supabase
      .from("inventory_containers")
      .select("id, organization_id, branch_id, reference_type, reference_id")
      .eq("id", input.containerId)
      .is("deleted_at", null)
      .maybeSingle();

    if (containerError) {
      console.error(
        "[RepairOrdersService.placeAllocationInContainer] container lookup error:",
        containerError
      );
      return {
        success: false,
        error:
          "Failed to process this container request due to an unexpected server error. Please try again or contact support.",
      };
    }

    const belongsToThisRepairOrder =
      container &&
      container.organization_id === scope.organizationId &&
      container.branch_id === scope.branchId &&
      container.reference_type === "repair_order" &&
      container.reference_id === scope.repairOrderId;

    if (!belongsToThisRepairOrder) {
      return { success: false, error: "Container not found for this RepairOrder" };
    }

    // A7 simplification pass: calls the RepairOrder-domain wrapper
    // (repair_order_add_allocation_to_container) instead of the generic
    // inventory_add_to_container primitive directly -- the generic
    // primitive no longer contains RepairOrder-ownership knowledge (see
    // docs/inventory/reviews/inventory-a7-repairorder-container-
    // boundary-review/). Same params, same result shape, same
    // transaction (the wrapper nests the generic call itself).
    const { data, error } = await supabase.rpc("repair_order_add_allocation_to_container", {
      p_actor_user_id: actorUserId,
      p_organization_id: scope.organizationId,
      p_branch_id: scope.branchId,
      p_container_id: input.containerId,
      p_allocation_line_id: input.allocationLineId,
      p_quantity: input.quantity,
    });

    if (error) {
      console.error(
        "[RepairOrdersService.placeAllocationInContainer] repair_order_add_allocation_to_container RPC error:",
        error
      );
      return { success: false, error: normalizeContainerRpcError(error) };
    }

    const row = data as {
      link_id: string;
      container_line_id: string;
      quantity: number;
      container_status: string;
    };
    const result: RepairOrderContainerPlacementResult = {
      linkId: row.link_id,
      containerLineId: row.container_line_id,
      quantity: row.quantity,
      containerStatus: row.container_status,
    };

    const emitResult = await eventService.emit({
      actionKey: "workshop.repair_orders.stock_placed_in_container",
      actorType: "user",
      actorUserId,
      entityType: "repair_order_line",
      entityId: input.repairOrderLineId,
      metadata: {
        containerId: input.containerId,
        allocationLineId: input.allocationLineId,
        quantity: input.quantity,
      },
      eventTier: "baseline",
    });
    if (!emitResult.success) {
      console.error(
        "[RepairOrdersService.placeAllocationInContainer] Failed to emit workshop.repair_orders.stock_placed_in_container:",
        (emitResult as { success: false; error: string }).error
      );
    }

    return { success: true, data: result };
  }

  /**
   * Phase 10C: remove (fully or partially) a previously placed quantity
   * from a container, via the existing, unmodified generic
   * `inventory_remove_from_container` RPC. Same physical-grouping-only
   * guarantee as `placeAllocationInContainer` -- never touches fulfilled
   * quantities or inventory balances.
   *
   * Ownership: the target link's own `allocation_line_id` must be one of
   * THIS RepairOrderLine's own allocation lines (reusing
   * `listAllocationsForLine`, same as `placeAllocationInContainer`) --
   * a caller cannot remove stock from an unrelated RepairOrderLine's own
   * container placement merely by knowing a link id.
   */
  static async removeAllocationFromContainer(
    supabase: SupabaseClient,
    actorUserId: string,
    input: {
      repairOrderLineId: string;
      containerId: string;
      linkId: string;
      quantity: number;
    }
  ): Promise<ServiceResult<RepairOrderContainerRemovalResult>> {
    const scope = await RepairOrdersService.resolveRepairOrderLineScope(
      supabase,
      input.repairOrderLineId
    );
    if (!scope) {
      return { success: false, error: "RepairOrderLine not found" };
    }

    const allocationsResult = await RepairOrdersService.listAllocationsForLine(
      supabase,
      input.repairOrderLineId
    );
    if (!allocationsResult.success) {
      return {
        success: false,
        error: (allocationsResult as { success: false; error: string }).error,
      };
    }
    const validAllocationLineIds = new Set(allocationsResult.data.map((line) => line.id));

    const { data: link, error: linkError } = await supabase
      .from("inventory_allocation_container_links")
      .select("id, organization_id, branch_id, allocation_line_id")
      .eq("id", input.linkId)
      .is("deleted_at", null)
      .maybeSingle();

    if (linkError) {
      console.error(
        "[RepairOrdersService.removeAllocationFromContainer] link lookup error:",
        linkError
      );
      return {
        success: false,
        error:
          "Failed to process this container request due to an unexpected server error. Please try again or contact support.",
      };
    }

    const belongsToThisLine =
      link &&
      link.organization_id === scope.organizationId &&
      link.branch_id === scope.branchId &&
      validAllocationLineIds.has(link.allocation_line_id);

    if (!belongsToThisLine) {
      return { success: false, error: "Container placement not found for this RepairOrderLine" };
    }

    const { data, error } = await supabase.rpc("inventory_remove_from_container", {
      p_actor_user_id: actorUserId,
      p_organization_id: scope.organizationId,
      p_branch_id: scope.branchId,
      p_container_id: input.containerId,
      p_link_id: input.linkId,
      p_quantity: input.quantity,
    });

    if (error) {
      console.error(
        "[RepairOrdersService.removeAllocationFromContainer] inventory_remove_from_container RPC error:",
        error
      );
      return { success: false, error: normalizeContainerRpcError(error) };
    }

    const row = data as {
      link_id: string;
      remaining_link_quantity: number;
      container_line_id: string;
      remaining_container_line_quantity: number;
      container_status: string;
    };
    const result: RepairOrderContainerRemovalResult = {
      linkId: row.link_id,
      remainingLinkQuantity: row.remaining_link_quantity,
      containerLineId: row.container_line_id,
      remainingContainerLineQuantity: row.remaining_container_line_quantity,
      containerStatus: row.container_status,
    };

    const emitResult = await eventService.emit({
      actionKey: "workshop.repair_orders.stock_removed_from_container",
      actorType: "user",
      actorUserId,
      entityType: "repair_order_line",
      entityId: input.repairOrderLineId,
      metadata: {
        containerId: input.containerId,
        linkId: input.linkId,
        quantity: input.quantity,
      },
      eventTier: "baseline",
    });
    if (!emitResult.success) {
      console.error(
        "[RepairOrdersService.removeAllocationFromContainer] Failed to emit workshop.repair_orders.stock_removed_from_container:",
        (emitResult as { success: false; error: string }).error
      );
    }

    return { success: true, data: result };
  }

  /**
   * Zone 3 <-> Zone 5 integration layer (2026-09-15): "what is the current
   * physical stock state for this RepairOrderLine?" -- reconciles Zone 5's
   * own spatial projection (`repair_order_line_locations`, written by
   * `receive_repair_order_stock`/`putaway_repair_order_stock`) with this
   * line's own reservation/allocation/container chain (Phase 10A/10B/10C),
   * a PURE READ, mutating neither side. Per the accepted integration
   * decision: these are SEQUENTIAL stages of one normal lifecycle
   * (101 receive -> 801 putaway -> reservation -> allocation -> container
   * -> QR -> 801 relocation -> issue), not competing models -- this method
   * is the first read layer that looks at both stages together.
   *
   * NEVER guesses. If the two sides' own physical-location claims disagree,
   * or if Zone 5's own attribution for a touched (location, variant) bucket
   * is explicitly marked uncertain, this returns an honest
   * `"location_mismatch"`/`"unknown"` consistency value rather than
   * silently preferring one side -- see `RepairOrderLinePhysicalStateConsistency`'s
   * own doc comment for the exact rules and their precedence.
   *
   * NO hard schema coupling was added to produce this: no FK/trigger
   * between `repair_order_line_locations` and
   * `inventory_containers`/`inventory_allocation_container_links` -- this
   * method reconciles them entirely in application code, reading each
   * domain's own existing, unmodified tables/read-model methods.
   *
   * Org/branch/variant scope is resolved once from the RepairOrderLine's
   * own authoritative row (`resolveRepairOrderLineScope`) and every query
   * below is explicitly re-scoped by it -- never trusted from an FK alone
   * (matches every other Zone 3 read method's own convention; also closes
   * the specific cross-org/branch leak risk this integration layer's own
   * task explicitly called out).
   *
   * Reuses `listReservationsForLine`/`listAllocationsForLine` rather than
   * re-deriving the RepairOrderLine -> Reservation -> ReservationLine ->
   * AllocationLine chain a third time -- both already enforce the accepted
   * domain-integrity variant-identity filter (2026-09-14 correction), so
   * this method inherits that guarantee for free.
   *
   * Returns `{ success: true, data: null }` (no error, no existence leak)
   * for an unresolvable RepairOrderLine, matching `getByIdForWorkshop`'s
   * own singular-read convention.
   */
  static async getPhysicalStateForLine(
    supabase: SupabaseClient,
    repairOrderLineId: string
  ): Promise<ServiceResult<RepairOrderLinePhysicalState | null>> {
    const scope = await RepairOrdersService.resolveRepairOrderLineScope(
      supabase,
      repairOrderLineId
    );
    if (!scope) {
      return { success: true, data: null };
    }

    // ---- Zone 5's own spatial projection --------------------------------
    const { data: zone5Rows, error: zone5Error } = await supabase
      .from("repair_order_line_locations")
      .select("location_id, quantity")
      .eq("repair_order_line_id", repairOrderLineId)
      .eq("organization_id", scope.organizationId)
      .eq("branch_id", scope.branchId)
      .eq("variant_id", scope.variantId)
      .gt("quantity", 0);

    if (zone5Error) {
      console.error(
        "[RepairOrdersService.getPhysicalStateForLine] repair_order_line_locations query error:",
        zone5Error
      );
      return {
        success: false,
        error:
          "Failed to load physical stock state due to an unexpected server error. Please try again or contact support.",
      };
    }

    // ---- Phase 10A/10B: reservations and allocations, reused -----------
    const reservationsResult = await RepairOrdersService.listReservationsForLine(
      supabase,
      repairOrderLineId
    );
    if (!reservationsResult.success) {
      return {
        success: false,
        error: (reservationsResult as { success: false; error: string }).error,
      };
    }

    const allocationsResult = await RepairOrdersService.listAllocationsForLine(
      supabase,
      repairOrderLineId
    );
    if (!allocationsResult.success) {
      return {
        success: false,
        error: (allocationsResult as { success: false; error: string }).error,
      };
    }

    // ---- Phase 10C: active container placements for this line's own
    // allocation lines, via three plain sequential queries (matches this
    // service's own established style elsewhere, rather than a fragile
    // multi-level embed) -------------------------------------------------
    const allocationLineIds = allocationsResult.data.map((a) => a.id);

    type LinkRow = {
      id: string;
      quantity: number;
      allocation_line_id: string;
      container_line_id: string;
    };
    let linkRows: LinkRow[] = [];
    if (allocationLineIds.length > 0) {
      const { data, error } = await supabase
        .from("inventory_allocation_container_links")
        .select("id, quantity, allocation_line_id, container_line_id")
        .eq("organization_id", scope.organizationId)
        .eq("branch_id", scope.branchId)
        .in("allocation_line_id", allocationLineIds)
        .is("deleted_at", null);

      if (error) {
        console.error(
          "[RepairOrdersService.getPhysicalStateForLine] inventory_allocation_container_links query error:",
          error
        );
        return {
          success: false,
          error:
            "Failed to load physical stock state due to an unexpected server error. Please try again or contact support.",
        };
      }
      linkRows = (data ?? []) as LinkRow[];
    }

    type ContainerLineRow = { id: string; container_id: string };
    let containerLineRows: ContainerLineRow[] = [];
    const containerLineIds = [...new Set(linkRows.map((l) => l.container_line_id))];
    if (containerLineIds.length > 0) {
      const { data, error } = await supabase
        .from("inventory_container_lines")
        .select("id, container_id")
        .eq("organization_id", scope.organizationId)
        .eq("branch_id", scope.branchId)
        .in("id", containerLineIds)
        .is("deleted_at", null);

      if (error) {
        console.error(
          "[RepairOrdersService.getPhysicalStateForLine] inventory_container_lines query error:",
          error
        );
        return {
          success: false,
          error:
            "Failed to load physical stock state due to an unexpected server error. Please try again or contact support.",
        };
      }
      containerLineRows = (data ?? []) as ContainerLineRow[];
    }

    type ContainerRow = {
      id: string;
      code: string;
      current_location_id: string | null;
      status: string;
    };
    let containerRows: ContainerRow[] = [];
    const containerIds = [...new Set(containerLineRows.map((cl) => cl.container_id))];
    if (containerIds.length > 0) {
      const { data, error } = await supabase
        .from("inventory_containers")
        .select("id, code, current_location_id, status")
        .eq("organization_id", scope.organizationId)
        .eq("branch_id", scope.branchId)
        .in("id", containerIds)
        .is("deleted_at", null);

      if (error) {
        console.error(
          "[RepairOrdersService.getPhysicalStateForLine] inventory_containers query error:",
          error
        );
        return {
          success: false,
          error:
            "Failed to load physical stock state due to an unexpected server error. Please try again or contact support.",
        };
      }
      containerRows = (data ?? []) as ContainerRow[];
    }

    const containerLineById = new Map(containerLineRows.map((cl) => [cl.id, cl]));
    const containerById = new Map(containerRows.map((c) => [c.id, c]));
    const allocationLineById = new Map(allocationsResult.data.map((a) => [a.id, a]));

    // A soft-deleted container/container_line means the link's own chain is
    // no longer active physical placement, even if the link row itself
    // passed the `deleted_at IS NULL` filter above (e.g. a container
    // deleted -- not a real path today, but defensively excluded, not
    // assumed impossible) -- excluded here rather than trusted.
    const activeLinks = linkRows
      .map((link) => {
        const containerLine = containerLineById.get(link.container_line_id);
        const container = containerLine ? containerById.get(containerLine.container_id) : undefined;
        const allocationLine = allocationLineById.get(link.allocation_line_id);
        if (!containerLine || !container || !allocationLine) return null;
        return { link, container, allocationLine };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    // Internal Phase 10C consistency: an active link's own container must
    // sit at the same location as its own allocation line (the invariant
    // `inventory_add_to_container` itself enforces at placement time --
    // see Phase 10C's own correction pass). If it ever doesn't, this
    // method cannot trust either signal -- surfaced as "unknown", never
    // silently picked.
    const hasInternalPhase10cInconsistency = activeLinks.some(
      ({ container, allocationLine }) => container.current_location_id !== allocationLine.locationId
    );

    // ---- Union of every location either side ever mentions -------------
    const locationIds = new Set<string>();
    for (const row of zone5Rows ?? []) locationIds.add(row.location_id as string);
    for (const line of reservationsResult.data.flatMap((r) => r.lines)) {
      if (line.locationId) locationIds.add(line.locationId);
    }
    for (const line of allocationsResult.data) locationIds.add(line.locationId);

    // ---- Zone 5's own "treat as UNKNOWN regardless" marker -------------
    let uncertainLocationIds = new Set<string>();
    if (scope.variantId && locationIds.size > 0) {
      const { data: uncertainRows, error: uncertainError } = await supabase
        .from("repair_order_location_attribution_uncertain")
        .select("location_id")
        .eq("organization_id", scope.organizationId)
        .eq("branch_id", scope.branchId)
        .eq("variant_id", scope.variantId)
        .in("location_id", [...locationIds]);

      if (uncertainError) {
        console.error(
          "[RepairOrdersService.getPhysicalStateForLine] repair_order_location_attribution_uncertain query error:",
          uncertainError
        );
        return {
          success: false,
          error:
            "Failed to load physical stock state due to an unexpected server error. Please try again or contact support.",
        };
      }
      uncertainLocationIds = new Set((uncertainRows ?? []).map((r) => r.location_id as string));
    }

    // ---- Build one bucket per location ----------------------------------
    const locations: RepairOrderLinePhysicalStateLocation[] = [...locationIds]
      .sort()
      .map((locationId) => {
        const physicalQuantity = (zone5Rows ?? [])
          .filter((r) => r.location_id === locationId)
          .reduce((sum, r) => sum + (r.quantity as number), 0);

        const reservedQuantity = reservationsResult.data
          .flatMap((r) => r.lines)
          .filter((l) => l.locationId === locationId)
          .reduce((sum, l) => sum + l.outstandingQuantity, 0);

        const allocationLinesHere = allocationsResult.data.filter(
          (l) => l.locationId === locationId
        );
        const allocatedQuantity = allocationLinesHere.reduce(
          (sum, l) => sum + l.outstandingQuantity,
          0
        );

        const linksHere = activeLinks.filter(({ allocationLine }) =>
          allocationLinesHere.some((l) => l.id === allocationLine.id)
        );
        const containerizedQuantity = linksHere.reduce((sum, { link }) => sum + link.quantity, 0);

        const containersByContainerId = new Map<string, RepairOrderLinePhysicalStateContainer>();
        for (const { link, container } of linksHere) {
          const existing = containersByContainerId.get(container.id);
          if (existing) {
            existing.quantity += link.quantity;
          } else {
            containersByContainerId.set(container.id, {
              containerId: container.id,
              containerCode: container.code,
              quantity: link.quantity,
              currentLocationId: container.current_location_id,
              status: container.status,
            });
          }
        }

        return {
          locationId,
          physicalQuantity,
          reservedQuantity,
          allocatedQuantity,
          containerizedQuantity,
          uncontainerizedAllocatedQuantity: Math.max(0, allocatedQuantity - containerizedQuantity),
          containers: [...containersByContainerId.values()],
        };
      });

    // ---- Overall consistency (precedence: unknown > mismatch >
    // uncontainerized > consistent) ---------------------------------------
    let consistency: RepairOrderLinePhysicalStateConsistency;
    const anyUncertain =
      hasInternalPhase10cInconsistency ||
      locations.some((loc) => uncertainLocationIds.has(loc.locationId));

    const zone5LocationSet = new Set(
      locations.filter((l) => l.physicalQuantity > 0).map((l) => l.locationId)
    );
    const allocatedLocationSet = new Set(
      locations.filter((l) => l.allocatedQuantity > 0).map((l) => l.locationId)
    );
    const bothNonEmpty = zone5LocationSet.size > 0 && allocatedLocationSet.size > 0;
    const setsDiffer =
      bothNonEmpty &&
      ([...zone5LocationSet].some((id) => !allocatedLocationSet.has(id)) ||
        [...allocatedLocationSet].some((id) => !zone5LocationSet.has(id)));

    if (anyUncertain) {
      consistency = "unknown";
    } else if (setsDiffer) {
      consistency = "location_mismatch";
    } else if (locations.some((l) => l.uncontainerizedAllocatedQuantity > 0)) {
      consistency = "uncontainerized";
    } else {
      consistency = "consistent";
    }

    return {
      success: true,
      data: { repairOrderLineId, locations, consistency },
    };
  }
}
