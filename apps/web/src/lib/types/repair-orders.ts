/**
 * Zone 3 — Repair Orders domain / read-model types.
 *
 * Hand-written domain layer over the generated Supabase types
 * (`@repo/supabase` / `packages/supabase/src/database.types.ts`), which remain
 * the persistence source of truth (column names/nullability/constraints).
 * This file exists so application code depends on a clean, intentional
 * domain shape rather than importing raw generated `Row` types throughout
 * services/actions/components.
 *
 * Source of truth for the shape below: docs/mvp/zones/03-repair-orders.md
 * ("Product clarification and final design") and
 * docs/mvp/zones/03-repair-orders-implementation-plan.md (Phase 1/2).
 *
 * Literal unions here MUST stay in sync with the live DB CHECK constraints
 * created in apps/web/supabase-target/supabase/migrations/20260910061711_repair_orders_core_schema.sql
 * and 20260910071755_repair_orders_status_archived.sql. If either changes,
 * update both the migration and this file in the same change.
 */

// ---------------------------------------------------------------------------
// Literal unions matching live DB CHECK constraints
// ---------------------------------------------------------------------------

/** repair_orders.identity_status CHECK */
export type RepairOrderIdentityStatus = "resolved" | "unresolved";

/**
 * repair_orders.status CHECK.
 * Corrected 2026-09-10 to include 'archived' (was 'open'/'closed' only in the
 * originally-applied migration -- see the forward migration that added it).
 * Intentionally simple: no 'in_progress'/'cancelled'/'completed' states.
 */
export type RepairOrderStatus = "open" | "closed" | "archived";

/** repair_order_lines.status CHECK */
export type RepairOrderLineStatus = "pending" | "partially_received" | "received" | "closed";

/** workshop_source_documents.document_type CHECK */
export type WorkshopSourceDocumentType = "zl" | "zw" | "wdd";

/** repair_order_line_movement_links.relation_type CHECK */
export type RepairOrderLineMovementRelationType = "receipt" | "issue" | "reversal";

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

const REPAIR_ORDER_IDENTITY_STATUSES: readonly RepairOrderIdentityStatus[] = [
  "resolved",
  "unresolved",
];
const REPAIR_ORDER_STATUSES: readonly RepairOrderStatus[] = ["open", "closed", "archived"];
const REPAIR_ORDER_LINE_STATUSES: readonly RepairOrderLineStatus[] = [
  "pending",
  "partially_received",
  "received",
  "closed",
];
const WORKSHOP_SOURCE_DOCUMENT_TYPES: readonly WorkshopSourceDocumentType[] = ["zl", "zw", "wdd"];
const REPAIR_ORDER_LINE_MOVEMENT_RELATION_TYPES: readonly RepairOrderLineMovementRelationType[] = [
  "receipt",
  "issue",
  "reversal",
];

export function isRepairOrderIdentityStatus(value: string): value is RepairOrderIdentityStatus {
  return (REPAIR_ORDER_IDENTITY_STATUSES as readonly string[]).includes(value);
}

export function isRepairOrderStatus(value: string): value is RepairOrderStatus {
  return (REPAIR_ORDER_STATUSES as readonly string[]).includes(value);
}

export function isRepairOrderLineStatus(value: string): value is RepairOrderLineStatus {
  return (REPAIR_ORDER_LINE_STATUSES as readonly string[]).includes(value);
}

export function isWorkshopSourceDocumentType(value: string): value is WorkshopSourceDocumentType {
  return (WORKSHOP_SOURCE_DOCUMENT_TYPES as readonly string[]).includes(value);
}

export function isRepairOrderLineMovementRelationType(
  value: string
): value is RepairOrderLineMovementRelationType {
  return (REPAIR_ORDER_LINE_MOVEMENT_RELATION_TYPES as readonly string[]).includes(value);
}

/**
 * `archived` requires the stronger archive-capable / manage-all permission
 * per the accepted architecture -- a plain `manage_own` advisor may not
 * archive an order. This helper centralizes that rule so it isn't
 * reimplemented ad hoc at each call site (service method + RLS policy both
 * enforce it independently; this is the application-layer mirror).
 */
export function canTransitionRepairOrderStatus(
  from: RepairOrderStatus,
  to: RepairOrderStatus,
  hasManageAllPermission: boolean
): boolean {
  if (from === to) return false;
  if (to === "archived" && !hasManageAllPermission) return false;
  // open -> closed -> archived is the only forward path; archived is terminal.
  if (from === "archived") return false;
  if (from === "open") return to === "closed" || to === "archived";
  if (from === "closed") return to === "open" || to === "archived";
  return false;
}

// ---------------------------------------------------------------------------
// Domain entity types (7 PITCH tables)
// ---------------------------------------------------------------------------

export interface RepairOrder {
  id: string;
  organization_id: string;
  branch_id: string;
  /** Business identity (Correction 1, Option B). Null until resolved. */
  zl_number: string | null;
  /** Descriptive/reference only -- NEVER part of uniqueness. */
  order_number: string | null;
  identity_status: RepairOrderIdentityStatus;
  advisor_contact_id: string | null;
  status: RepairOrderStatus;
  vin: string | null;
  vehicle_brand: string | null;
  client_name: string | null;
  dealer_name: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface RepairOrderLine {
  id: string;
  repair_order_id: string;
  variant_id: string | null;
  product_code: string | null;
  product_name: string;
  ordered_quantity: number;
  unit: string | null;
  status: RepairOrderLineStatus;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface WorkshopSourceDocument {
  id: string;
  organization_id: string;
  branch_id: string;
  document_type: WorkshopSourceDocumentType;
  external_document_number: string;
  /** Part of the natural key (final clarification pass correction) -- content
   * legitimately varies across sessions sharing the same external number. */
  source_session_id: string;
  official_warehouse_code: string | null;
  block_id: string | null;
  created_at: string;
}

export interface RepairOrderSourceDocumentLink {
  repair_order_id: string;
  workshop_source_document_id: string;
  linked_at: string;
  linked_by: string | null;
}

export interface WorkshopSourceDocumentLine {
  id: string;
  workshop_source_document_id: string;
  wdd_matcher_line_id: string | null;
  product_code: string | null;
  product_name: string | null;
  quantity: number;
  unit: string | null;
  raw_text: string | null;
  created_at: string;
}

export interface RepairOrderLineSourceLink {
  id: string;
  repair_order_line_id: string;
  workshop_source_document_line_id: string;
  quantity_contribution: number;
  linked_at: string;
}

export interface RepairOrderLineMovementLink {
  id: string;
  repair_order_line_id: string;
  inventory_movement_line_id: string;
  applied_quantity: number;
  relation_type: RepairOrderLineMovementRelationType;
  created_at: string;
}

/**
 * PILOT-scope stub (Phase 14). Table does not exist live yet -- this type is
 * declared now so Phase 1's contract is complete per the work order, but must
 * not be used against a real table/service until Phase 14 creates it.
 */
export interface RepairOrderLegacyRecord {
  id: string;
  organization_id: string;
  branch_id: string;
  repair_order_id: string | null;
  /** Free-form description of the pre-cutover legacy record being represented. */
  description: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Derived read-model types -- NEVER stored as mutable columns
// ---------------------------------------------------------------------------

/**
 * Derived quantities for one RepairOrderLine. Per the architecture doc and
 * the 2026-09-10 work order: `outstanding_to_receive` and
 * `available_for_issue` are the two explicit operational concepts -- never a
 * single ambiguous `remaining_quantity`.
 */
export interface RepairOrderLineQuantities {
  ordered_quantity: number;
  received_quantity: number;
  issued_quantity: number;
  /** ordered_quantity - received_quantity */
  outstanding_to_receive: number;
  /** received_quantity - issued_quantity */
  available_for_issue: number;
}

/**
 * Pure derivation function -- the ONLY sanctioned way to compute
 * RepairOrderLineQuantities. Reproduces the architecture doc's worked
 * example: ordered=5 across 3 receipt batches totaling 5, issued=3 across 2
 * issue batches -> outstanding_to_receive=0, available_for_issue=2.
 *
 * `applied_quantity` for `relation_type: 'reversal'` rows is intentionally
 * excluded from both sums here -- reversal semantics (which sum a reversal
 * nets against) are not yet decided and must not be silently guessed at in
 * this helper; a reversal-aware version should replace this once that
 * decision is made (tracked as an open item, not implemented here).
 */
export function computeRepairOrderLineQuantities(
  orderedQuantity: number,
  movementLinks: ReadonlyArray<
    Pick<RepairOrderLineMovementLink, "applied_quantity" | "relation_type">
  >
): RepairOrderLineQuantities {
  const receivedQuantity = movementLinks
    .filter((link) => link.relation_type === "receipt")
    .reduce((sum, link) => sum + link.applied_quantity, 0);

  const issuedQuantity = movementLinks
    .filter((link) => link.relation_type === "issue")
    .reduce((sum, link) => sum + link.applied_quantity, 0);

  return {
    ordered_quantity: orderedQuantity,
    received_quantity: receivedQuantity,
    issued_quantity: issuedQuantity,
    outstanding_to_receive: orderedQuantity - receivedQuantity,
    available_for_issue: receivedQuantity - issuedQuantity,
  };
}
