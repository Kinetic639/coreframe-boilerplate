/**
 * Variance reason-code taxonomy for the stock-audit feature. Lives in the
 * app layer (not a DB CHECK constraint — inventory_count_lines.reason_code
 * is free text) so it can be localized/extended without a migration. See
 * apps/web/docs/stock-audit-implementation-plan.md §1b.
 */

export type CountVarianceReasonCode =
  | "damaged"
  | "placement_error"
  | "theft"
  | "supplier_shortage"
  | "unexpected_surplus";

export interface CountVarianceReasonOption {
  value: CountVarianceReasonCode;
  labelKey: string;
}

/** Full taxonomy, order matches the prototype's shortage-reason list. */
export const COUNT_VARIANCE_REASON_OPTIONS: CountVarianceReasonOption[] = [
  { value: "damaged", labelKey: "reasonDamaged" },
  { value: "placement_error", labelKey: "reasonPlacementError" },
  { value: "theft", labelKey: "reasonUnidentified" },
  { value: "supplier_shortage", labelKey: "reasonSupplierShortage" },
  { value: "unexpected_surplus", labelKey: "reasonUnexpectedSurplus" },
];

/**
 * Dynamically reordered/filtered reason list depending on whether the
 * current line is a surplus or a shortage — mirrors the prototype's
 * GuidedCountScreen.tsx `dynamicReasons` behavior exactly: surplus-typical
 * reasons lead when variance > 0, shortage-typical reasons lead otherwise.
 */
export function getReasonOptionsForVariance(variance: number): CountVarianceReasonOption[] {
  const byValue = new Map(COUNT_VARIANCE_REASON_OPTIONS.map((opt) => [opt.value, opt]));
  const order: CountVarianceReasonCode[] =
    variance > 0
      ? ["placement_error", "unexpected_surplus", "supplier_shortage", "theft"]
      : ["damaged", "placement_error", "supplier_shortage", "theft"];
  return order.map((value) => byValue.get(value)!).filter(Boolean);
}
