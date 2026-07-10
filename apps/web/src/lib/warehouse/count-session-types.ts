/**
 * Stock-audit ("cycle count") domain types shared between the service layer,
 * server actions, and client components.
 *
 * Not server-only — these are plain types/constants safe to import from
 * client components.
 */

export type CountSessionType = "location" | "supplier";

export type CountLineStatus = "pending" | "counted" | "skipped" | "needs_recount" | "approved";

export type CountLineSource = "generated" | "unexpected_found";

export type CountSessionStatus = "draft" | "counting" | "submitted" | "approved" | "cancelled";

/**
 * Canonical, closed shape of `inventory_count_sessions.scope` (jsonb).
 *
 * This is an exhaustive list — there is no `allow_partial_posting` or any
 * other undocumented key. Partial posting does not exist in this feature;
 * see apps/web/docs/stock-audit-implementation-plan.md §5.
 */
export interface CountSessionScope {
  count_type: CountSessionType;
  /** Always the final, already-expanded location id list (subtree expansion
   * happens client/service-side before this is sent to the RPC) — never a
   * set of parent-only ids. Required (non-empty) when count_type=location. */
  location_ids?: string[];
  /** Provenance only — the RPC does not interpret this, it only reads the
   * already-expanded location_ids above. */
  include_children?: boolean;
  /** Required when count_type=supplier. */
  supplier_id?: string;
  /** Optional narrowing filter when count_type=supplier. */
  location_filter_ids?: string[];
  include_zero_stock?: boolean;
  /** Blind-count mode when false. */
  show_expected_quantity?: boolean;
  require_reason_for_variance?: boolean;
}

export interface CountSessionListRow {
  id: string;
  count_number: string;
  status: CountSessionStatus;
  scope: CountSessionScope;
  notes: string | null;
  created_by: string | null;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
  approved_at: string | null;
  total_lines: number;
  counted_lines: number;
  variance_lines: number;
}

export interface CountSessionListResult {
  rows: CountSessionListRow[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface CountLineRow {
  id: string;
  count_session_id: string;
  sequence_no: number | null;
  variant_id: string;
  location_id: string;
  lot_id: string | null;
  serial_id: string | null;
  expected_quantity: number;
  counted_quantity: number | null;
  variance_quantity: number | null;
  unit_id: string;
  status: CountLineStatus;
  source: CountLineSource;
  reason_code: string | null;
  note: string | null;
  counted_by: string | null;
  counted_at: string | null;
}

export interface CountSessionDetail {
  session: Record<string, unknown>;
  lines: CountLineRow[];
}

export interface ReorderReportRow {
  variant_id: string;
  location_id: string | null;
  on_hand_quantity: number;
  reorder_point: number;
  min_quantity: number | null;
  suggested_order_quantity: number;
  preferred_supplier_id: string | null;
}

/**
 * A count line enriched with display data (SKU, product name, unit,
 * location) — inventory_count_lines itself only stores
 * variant_id/location_id/unit_id foreign keys. Produced by
 * `enrichCountLines` (src/server/services/warehouse-audit-enrichment.service.ts).
 * Location display is deliberately simplified to code/name only, not a full
 * ancestor breadcrumb — a disclosed simplification vs. the read-only
 * prototype reference, since this app has no ready-made full-path helper.
 */
export interface EnrichedCountLine extends CountLineRow {
  sku: string;
  productName: string;
  unitCode: string;
  locationCode: string;
  locationName: string;
}

/**
 * Session detail with enriched lines — the shape both the SSR pages and the
 * `useCountSessionDetailQuery` React Query hook return, so a post-mutation
 * client-side refetch produces the same display-ready shape as the initial
 * server-rendered paint.
 */
export interface EnrichedCountSessionDetail {
  session: Record<string, unknown>;
  lines: EnrichedCountLine[];
}

/**
 * A reorder-report row enriched with display data plus the latest human
 * accept/ignore decision (from `inventory_reorder_suggestion_actions`, an
 * append-only decision log — `actionStatus` is whichever row for that
 * variant/location key has the newest `created_at`). Produced by
 * `enrichReorderReportRows` (src/server/services/warehouse-audit-enrichment.service.ts).
 */
export interface EnrichedReorderReportRow extends ReorderReportRow {
  sku: string;
  productName: string;
  unitCode: string;
  locationCode: string | null;
  locationName: string | null;
  supplierName: string | null;
  actionStatus: "accepted" | "ignored" | null;
}

export const COUNT_LINE_STATUSES: readonly CountLineStatus[] = [
  "pending",
  "counted",
  "skipped",
  "needs_recount",
  "approved",
] as const;

const VALID_COUNT_LINE_TRANSITIONS: Record<CountLineStatus, readonly CountLineStatus[]> = {
  pending: ["counted", "skipped"],
  counted: ["needs_recount", "approved", "counted"],
  needs_recount: ["counted", "skipped"],
  skipped: [],
  approved: [],
};

/**
 * Whether moving a count line from `from` to `to` is a valid transition per
 * the state machine in apps/web/docs/stock-audit-implementation-plan.md §4.
 * `counted -> counted` is allowed (re-counting/editing before review).
 */
export function isValidCountLineTransition(from: CountLineStatus, to: CountLineStatus): boolean {
  return VALID_COUNT_LINE_TRANSITIONS[from]?.includes(to) ?? false;
}
