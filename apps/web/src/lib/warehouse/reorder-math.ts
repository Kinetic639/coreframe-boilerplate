/**
 * Pure reorder-suggestion math for the low-stock report.
 *
 * `inventory_reorder_rules.reorder_quantity` already directly answers "how
 * much to reorder" when set — no packaging-multiple rounding is needed (the
 * prototype's suggestedOrderMultiple rounding was a workaround for not
 * having this field; the real schema already has it). When reorder_quantity
 * is not set, fall back to topping up to the reorder point.
 */

export interface ReorderRuleInput {
  reorder_point: number;
  reorder_quantity: number | null;
}

/**
 * Returns the suggested order quantity for a variant/location whose current
 * on-hand quantity is below its reorder point, or 0 if it isn't actually
 * below the reorder point (not a suggestion in that case).
 */
export function calculateSuggestedOrderQuantity(
  rule: ReorderRuleInput,
  onHandQuantity: number
): number {
  if (onHandQuantity >= rule.reorder_point) return 0;

  if (rule.reorder_quantity != null && rule.reorder_quantity > 0) {
    return rule.reorder_quantity;
  }

  return Math.max(0, rule.reorder_point - onHandQuantity);
}

/**
 * True when the given on-hand quantity is below the rule's reorder point —
 * i.e. this variant/location belongs in the low-stock report at all.
 */
export function isBelowReorderPoint(
  rule: Pick<ReorderRuleInput, "reorder_point">,
  onHandQuantity: number
) {
  return onHandQuantity < rule.reorder_point;
}
