/**
 * Replenishment & Optimal Ordering Service
 * Phase 2 of Inventory Replenishment System
 *
 * This service calculates optimal order quantities using three methods:
 * - Fixed: Always order same amount
 * - Min/Max: Order to maximum stock level (recommended)
 * - Auto: Based on demand history (future)
 */

import { createClient } from "@/utils/supabase/client";
import type {
  ProductReplenishmentSettings,
  OrderQuantityCalculation,
  ReorderCalculationMethod,
} from "../types/replenishment";
import {
  calculateRawOrderQuantity,
  validateReplenishmentSettings,
  explainCalculationMethod,
} from "../types/replenishment";

// =====================================================
// Database Function Calls
// =====================================================

/**
 * Calls the calculate_order_quantity database function
 * This integrates Phase 2 (decision) + Phase 1 (adjustment)
 */
export async function calculateOrderQuantity(
  productId: string,
  supplierId: string,
  availableStock?: number
): Promise<OrderQuantityCalculation | null> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc("calculate_order_quantity", {
    p_product_id: productId,
    p_supplier_id: supplierId,
    p_available_stock: availableStock ?? null,
  });

  if (error) {
    console.error("Error calculating order quantity:", error);
    throw new Error(`Failed to calculate order quantity: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return null;
  }

  const result = data[0];

  return {
    raw_quantity: result.raw_quantity,
    adjusted_quantity: result.adjusted_quantity,
    packages: result.packages,
    calculation_method: result.calculation_method as ReorderCalculationMethod,
    adjustment_reason: result.adjustment_reason,
  };
}

// =====================================================
// Replenishment Settings Management
// =====================================================

/**
 * Gets replenishment settings for a product
 */
export async function getReplenishmentSettings(
  productId: string
): Promise<ProductReplenishmentSettings | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("products")
    .select(
      `
      reorder_point,
      reorder_quantity,
      max_stock_level,
      reorder_calculation_method,
      base_unit,
      lead_time_days,
      send_low_stock_alerts
    `
    )
    .eq("id", productId)
    .is("deleted_at", null)
    .single();

  if (error) {
    console.error("Error fetching replenishment settings:", error);
    return null;
  }

  return {
    reorder_point: data.reorder_point,
    reorder_quantity: data.reorder_quantity,
    max_stock_level: data.max_stock_level,
    reorder_calculation_method:
      (data.reorder_calculation_method as ReorderCalculationMethod) || "min_max",
    base_unit: data.base_unit || "piece",
    lead_time_days: data.lead_time_days,
    send_low_stock_alerts: data.send_low_stock_alerts || false,
  };
}

/**
 * Updates replenishment settings for a product
 */
export async function updateReplenishmentSettings(
  productId: string,
  settings: Partial<ProductReplenishmentSettings>
): Promise<{ success: boolean; errors?: string[]; warnings?: string[] }> {
  // Validate settings
  const validation = validateReplenishmentSettings(settings);

  if (!validation.isValid) {
    return {
      success: false,
      errors: validation.errors,
      warnings: validation.warnings,
    };
  }

  const supabase = createClient();

  // Prepare update data
  const updateData: Record<string, any> = {};

  if (settings.reorder_point !== undefined) {
    updateData.reorder_point = settings.reorder_point;
  }
  if (settings.reorder_quantity !== undefined) {
    updateData.reorder_quantity = settings.reorder_quantity;
  }
  if (settings.max_stock_level !== undefined) {
    updateData.max_stock_level = settings.max_stock_level;
  }
  if (settings.reorder_calculation_method !== undefined) {
    updateData.reorder_calculation_method = settings.reorder_calculation_method;
  }
  if (settings.lead_time_days !== undefined) {
    updateData.lead_time_days = settings.lead_time_days;
  }
  if (settings.send_low_stock_alerts !== undefined) {
    updateData.send_low_stock_alerts = settings.send_low_stock_alerts;
  }

  const { error } = await supabase.from("products").update(updateData).eq("id", productId);

  if (error) {
    console.error("Error updating replenishment settings:", error);
    return {
      success: false,
      errors: [error.message],
    };
  }

  return {
    success: true,
    warnings: validation.warnings,
  };
}

/**
 * Bulk update replenishment settings for multiple products
 */
export async function bulkUpdateReplenishmentSettings(
  productIds: string[],
  settings: Partial<ProductReplenishmentSettings>
): Promise<{
  success: boolean;
  updated: number;
  errors?: string[];
}> {
  // Validate settings first
  const validation = validateReplenishmentSettings(settings);

  if (!validation.isValid) {
    return {
      success: false,
      updated: 0,
      errors: validation.errors,
    };
  }

  const supabase = createClient();

  // Prepare update data
  const updateData: Record<string, any> = {};

  if (settings.reorder_point !== undefined) {
    updateData.reorder_point = settings.reorder_point;
  }
  if (settings.reorder_quantity !== undefined) {
    updateData.reorder_quantity = settings.reorder_quantity;
  }
  if (settings.max_stock_level !== undefined) {
    updateData.max_stock_level = settings.max_stock_level;
  }
  if (settings.reorder_calculation_method !== undefined) {
    updateData.reorder_calculation_method = settings.reorder_calculation_method;
  }
  if (settings.lead_time_days !== undefined) {
    updateData.lead_time_days = settings.lead_time_days;
  }
  if (settings.send_low_stock_alerts !== undefined) {
    updateData.send_low_stock_alerts = settings.send_low_stock_alerts;
  }

  const { error, count } = await supabase.from("products").update(updateData).in("id", productIds);

  if (error) {
    console.error("Error bulk updating replenishment settings:", error);
    return {
      success: false,
      updated: 0,
      errors: [error.message],
    };
  }

  return {
    success: true,
    updated: count || 0,
  };
}

// =====================================================
// Client-Side Calculation Preview
// =====================================================

/**
 * Previews order quantity calculation without calling database
 * Useful for real-time UI feedback
 */
export function previewOrderQuantity(
  settings: ProductReplenishmentSettings,
  availableStock: number
): number {
  return calculateRawOrderQuantity(settings, availableStock);
}

/**
 * Gets explanation of calculation method for UI display
 */
export function getCalculationExplanation(
  method: ReorderCalculationMethod,
  settings: ProductReplenishmentSettings,
  availableStock: number
): string {
  return explainCalculationMethod(method, settings, availableStock);
}

// =====================================================
// Product Inventory Status
// =====================================================

/**
 * Checks if product needs reordering
 */
export async function checkIfNeedsReorder(productId: string): Promise<{
  needsReorder: boolean;
  currentStock: number | null;
  reorderPoint: number | null;
  reason?: string;
}> {
  const supabase = createClient();

  // Get product settings and current stock
  const { data: product, error: productError } = await supabase
    .from("products")
    .select("reorder_point, base_unit")
    .eq("id", productId)
    .is("deleted_at", null)
    .single();

  if (productError || !product) {
    return {
      needsReorder: false,
      currentStock: null,
      reorderPoint: null,
      reason: "Product not found or reorder point not set",
    };
  }

  if (!product.reorder_point) {
    return {
      needsReorder: false,
      currentStock: null,
      reorderPoint: null,
      reason: "Reorder point not configured",
    };
  }

  // Get current available stock
  const { data: inventory, error: inventoryError } = await supabase
    .from("product_available_inventory")
    .select("available_quantity")
    .eq("product_id", productId)
    .single();

  if (inventoryError || !inventory) {
    return {
      needsReorder: false,
      currentStock: null,
      reorderPoint: product.reorder_point,
      reason: "Could not fetch inventory data",
    };
  }

  const availableStock = inventory.available_quantity || 0;
  const needsReorder = availableStock <= product.reorder_point;

  return {
    needsReorder,
    currentStock: availableStock,
    reorderPoint: product.reorder_point,
    reason: needsReorder
      ? `Stock (${availableStock}) is at or below reorder point (${product.reorder_point})`
      : undefined,
  };
}

/**
 * Gets products that need reordering for an organization
 */
export async function getProductsNeedingReorder(
  organizationId: string,
  branchId?: string
): Promise<
  Array<{
    product_id: string;
    product_name: string;
    sku: string;
    base_unit: string;
    available_stock: number;
    reorder_point: number;
    max_stock_level: number | null;
    calculation_method: ReorderCalculationMethod;
    send_low_stock_alerts: boolean;
  }>
> {
  const supabase = createClient();

  let query = supabase
    .from("products")
    .select(
      `
      id,
      name,
      sku,
      base_unit,
      reorder_point,
      max_stock_level,
      reorder_calculation_method,
      send_low_stock_alerts,
      product_available_inventory!inner (
        available_quantity,
        branch_id
      )
    `
    )
    .eq("organization_id", organizationId)
    .eq("track_inventory", true)
    .not("reorder_point", "is", null)
    .is("deleted_at", null);

  if (branchId) {
    query = query.eq("product_available_inventory.branch_id", branchId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching products needing reorder:", error);
    return [];
  }

  // Filter products where available_quantity <= reorder_point
  const productsNeedingReorder = (data || [])
    .filter((product: any) => {
      const inventory = Array.isArray(product.product_available_inventory)
        ? product.product_available_inventory[0]
        : product.product_available_inventory;

      return inventory && (inventory.available_quantity || 0) <= (product.reorder_point || 0);
    })
    .map((product: any) => {
      const inventory = Array.isArray(product.product_available_inventory)
        ? product.product_available_inventory[0]
        : product.product_available_inventory;

      return {
        product_id: product.id,
        product_name: product.name,
        sku: product.sku,
        base_unit: product.base_unit || "piece",
        available_stock: inventory.available_quantity || 0,
        reorder_point: product.reorder_point,
        max_stock_level: product.max_stock_level,
        calculation_method: product.reorder_calculation_method as ReorderCalculationMethod,
        send_low_stock_alerts: product.send_low_stock_alerts || false,
      };
    });

  return productsNeedingReorder;
}

// =====================================================
// Helper Functions
// =====================================================

/**
 * Checks if replenishment settings are configured
 */
export function hasReplenishmentSettings(settings: ProductReplenishmentSettings | null): boolean {
  if (!settings) return false;
  return settings.reorder_point !== null && settings.reorder_point > 0;
}

/**
 * Gets recommended max stock level based on reorder point
 */
export function getRecommendedMaxStock(reorderPoint: number): number {
  // Default recommendation: 2x reorder point
  return reorderPoint * 2;
}

/**
 * Validates that max_stock_level is appropriate for reorder_point
 */
export function validateMaxStockLevel(
  reorderPoint: number,
  maxStockLevel: number
): {
  isValid: boolean;
  error?: string;
  warning?: string;
} {
  if (maxStockLevel <= reorderPoint) {
    return {
      isValid: false,
      error: "Max stock level must be greater than reorder point",
    };
  }

  const ratio = maxStockLevel / reorderPoint;

  if (ratio < 1.5) {
    return {
      isValid: true,
      warning:
        "Max stock level is very close to reorder point. Consider increasing it to avoid frequent reorders.",
    };
  }

  if (ratio > 10) {
    return {
      isValid: true,
      warning:
        "Max stock level is very high compared to reorder point. This may lead to excess inventory.",
    };
  }

  return { isValid: true };
}

/**
 * Calculates estimated order frequency based on demand
 * (Placeholder for future demand history integration)
 */
export function estimateOrderFrequency(
  reorderPoint: number,
  maxStockLevel: number,
  averageDailyDemand: number
): {
  estimatedDaysBetweenOrders: number;
  ordersPerMonth: number;
} {
  const orderQuantity = maxStockLevel - reorderPoint;
  const estimatedDaysBetweenOrders = orderQuantity / averageDailyDemand;
  const ordersPerMonth = 30 / estimatedDaysBetweenOrders;

  return {
    estimatedDaysBetweenOrders: Math.round(estimatedDaysBetweenOrders),
    ordersPerMonth: Math.round(ordersPerMonth * 10) / 10, // Round to 1 decimal
  };
}
