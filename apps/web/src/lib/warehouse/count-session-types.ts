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
