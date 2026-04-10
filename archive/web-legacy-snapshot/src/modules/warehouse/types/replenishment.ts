/**
 * Replenishment & Optimal Ordering Types
 * Phase 2 of Inventory Replenishment System
 *
 * These types define how to calculate optimal order quantities
 * using three methods: fixed, min/max, and auto (future).
 */

/**
 * Replenishment calculation methods
 */
export type ReorderCalculationMethod = "fixed" | "min_max" | "auto";

/**
 * Product replenishment settings
 */
export interface ProductReplenishmentSettings {
  reorder_point: number | null; // Minimum stock level (alert threshold)
  reorder_quantity: number | null; // For fixed method: always order this amount
  max_stock_level: number | null; // For min_max method: order up to this level
  reorder_calculation_method: ReorderCalculationMethod; // Which method to use
  unit: string; // Unit of measure (piece, kg, liter, etc.)
  lead_time_days: number | null; // Global lead time (can be overridden by supplier)
  send_low_stock_alerts: boolean; // Tier 2: Send notifications when low?
}

/**
 * Result of order quantity calculation
 */
export interface OrderQuantityCalculation {
  raw_quantity: number; // Initial calculated quantity
  adjusted_quantity: number; // After supplier packaging constraints
  packages: number | null; // Number of packages (if applicable)
  calculation_method: ReorderCalculationMethod; // Which method was used
  adjustment_reason: string | null; // Explanation of any adjustments
}

/**
 * Labels for calculation methods
 */
export const REORDER_METHOD_LABELS: Record<ReorderCalculationMethod, string> = {
  fixed: "Fixed Quantity",
  min_max: "Min/Max (Recommended)",
  auto: "Auto (Based on Demand)",
};

/**
 * Descriptions for calculation methods
 */
export const REORDER_METHOD_DESCRIPTIONS: Record<ReorderCalculationMethod, string> = {
  fixed: "Always order the same amount when stock is low",
  min_max: "Order enough to reach maximum stock level (adapts to current stock)",
  auto: "Calculate from historical demand data (future enhancement)",
};

/**
 * Helper function to calculate raw order quantity
 * (before packaging adjustments)
 */
export function calculateRawOrderQuantity(
  settings: ProductReplenishmentSettings,
  availableStock: number
): number {
  if (!settings.reorder_point) {
    return 0;
  }

  switch (settings.reorder_calculation_method) {
    case "fixed":
      // Always order reorder_quantity
      return settings.reorder_quantity || settings.reorder_point;

    case "min_max":
      // Order up to max_stock_level
      if (settings.max_stock_level) {
        return Math.max(0, settings.max_stock_level - availableStock);
      }
      // Fallback: order to 2x reorder point
      return Math.max(0, settings.reorder_point * 2 - availableStock);

    case "auto":
      // Future: calculate from demand history
      // For now, use min_max logic
      const maxLevel = settings.max_stock_level || settings.reorder_point * 2;
      return Math.max(0, maxLevel - availableStock);

    default:
      return Math.max(0, settings.reorder_point - availableStock);
  }
}

/**
 * Validates replenishment settings
 */
export function validateReplenishmentSettings(settings: Partial<ProductReplenishmentSettings>): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Reorder point is required for monitoring
  if (!settings.reorder_point || settings.reorder_point <= 0) {
    errors.push("Reorder point must be greater than zero");
  }

  // Validate fixed method
  if (settings.reorder_calculation_method === "fixed") {
    if (!settings.reorder_quantity || settings.reorder_quantity <= 0) {
      errors.push("Reorder quantity is required for fixed method");
    }
    if (
      settings.reorder_quantity &&
      settings.reorder_point &&
      settings.reorder_quantity < settings.reorder_point
    ) {
      warnings.push("Reorder quantity is less than reorder point - may result in frequent orders");
    }
  }

  // Validate min_max method
  if (settings.reorder_calculation_method === "min_max") {
    if (!settings.max_stock_level) {
      warnings.push("Max stock level not set - will default to 2x reorder point");
    }
    if (
      settings.max_stock_level &&
      settings.reorder_point &&
      settings.max_stock_level <= settings.reorder_point
    ) {
      errors.push("Max stock level must be greater than reorder point");
    }
  }

  // Validate lead time
  if (settings.lead_time_days !== null && settings.lead_time_days < 0) {
    errors.push("Lead time cannot be negative");
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Gets a user-friendly explanation of the calculation method
 */
export function explainCalculationMethod(
  method: ReorderCalculationMethod,
  settings: ProductReplenishmentSettings,
  availableStock: number
): string {
  const rawQty = calculateRawOrderQuantity(settings, availableStock);

  switch (method) {
    case "fixed":
      return `Fixed method: Always order ${settings.reorder_quantity} ${settings.unit}s when stock falls below ${settings.reorder_point}`;

    case "min_max":
      const maxLevel = settings.max_stock_level || settings.reorder_point * 2;
      return `Min/Max method: Order ${rawQty} ${settings.unit}s to reach maximum level of ${maxLevel}`;

    case "auto":
      return `Auto method: Calculate from demand history (currently using min/max logic)`;

    default:
      return `Order to bring stock to reorder point (${settings.reorder_point} ${settings.unit}s)`;
  }
}
