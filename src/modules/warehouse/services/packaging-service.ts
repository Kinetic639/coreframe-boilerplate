/**
 * Packaging & Ordering Constraints Service
 * Phase 1 of Inventory Replenishment System
 *
 * This service handles supplier-specific packaging constraints and adjustments.
 */

import { createClient } from "@/lib/supabase/client";
import type { ProductSupplierPackaging, PackagingAdjustment } from "../types/packaging";
import { validatePackagingConstraints, calculatePackages } from "../types/packaging";

// =====================================================
// Database Function Calls
// =====================================================

/**
 * Calls the adjust_for_packaging database function
 */
export async function adjustForPackaging(
  rawQuantity: number,
  productSupplierId: string
): Promise<PackagingAdjustment> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc("adjust_for_packaging", {
    p_raw_quantity: rawQuantity,
    p_product_supplier_id: productSupplierId,
  });

  if (error) {
    console.error("Error adjusting for packaging:", error);
    throw new Error(`Failed to adjust quantity for packaging: ${error.message}`);
  }

  if (!data || data.length === 0) {
    // No adjustment needed, return raw quantity
    return {
      raw_quantity: rawQuantity,
      adjusted_quantity: rawQuantity,
      packages: null,
      adjustment_reason: null,
    };
  }

  return {
    raw_quantity: rawQuantity,
    adjusted_quantity: data[0].adjusted_quantity,
    packages: data[0].packages,
    adjustment_reason: data[0].adjustment_reason,
  };
}

// =====================================================
// Packaging Information Retrieval
// =====================================================

/**
 * Gets packaging information for a product-supplier relationship
 */
export async function getProductSupplierPackaging(
  productSupplierId: string
): Promise<ProductSupplierPackaging | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("product_suppliers")
    .select(
      `
      package_unit,
      package_quantity,
      allow_partial_package,
      min_order_quantity,
      order_in_multiples_of,
      supplier_lead_time_days,
      supplier_price
    `
    )
    .eq("id", productSupplierId)
    .is("deleted_at", null)
    .single();

  if (error) {
    console.error("Error fetching packaging info:", error);
    return null;
  }

  return data as ProductSupplierPackaging;
}

/**
 * Gets packaging for a product from a specific supplier
 */
export async function getPackagingByProductAndSupplier(
  productId: string,
  supplierId: string
): Promise<{
  packaging: ProductSupplierPackaging | null;
  productSupplierId: string | null;
}> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("product_suppliers")
    .select(
      `
      id,
      package_unit,
      package_quantity,
      allow_partial_package,
      min_order_quantity,
      order_in_multiples_of,
      supplier_lead_time_days,
      supplier_price
    `
    )
    .eq("product_id", productId)
    .eq("supplier_id", supplierId)
    .is("deleted_at", null)
    .single();

  if (error) {
    console.error("Error fetching packaging info:", error);
    return { packaging: null, productSupplierId: null };
  }

  const { id, ...packaging } = data;

  return {
    packaging: packaging as ProductSupplierPackaging,
    productSupplierId: id,
  };
}

// =====================================================
// Client-Side Validation & Preview
// =====================================================

/**
 * Validates quantity against packaging constraints (client-side)
 * Use this for form validation before submitting
 */
export function validateQuantityAgainstPackaging(
  quantity: number,
  packaging: ProductSupplierPackaging
): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  return validatePackagingConstraints(quantity, packaging);
}

/**
 * Previews adjusted quantity without calling database
 * Useful for real-time UI feedback
 */
export function previewPackagingAdjustment(
  rawQuantity: number,
  packaging: ProductSupplierPackaging
): PackagingAdjustment {
  let adjustedQuantity = rawQuantity;
  const adjustmentReasons: string[] = [];

  // Apply minimum order quantity
  if (packaging.min_order_quantity && rawQuantity < packaging.min_order_quantity) {
    adjustedQuantity = packaging.min_order_quantity;
    adjustmentReasons.push(`Adjusted to minimum order quantity (${packaging.min_order_quantity})`);
  }

  // Apply order multiples
  if (packaging.order_in_multiples_of && packaging.order_in_multiples_of > 0) {
    const remainder = adjustedQuantity % packaging.order_in_multiples_of;
    if (remainder !== 0) {
      adjustedQuantity = adjustedQuantity + (packaging.order_in_multiples_of - remainder);
      adjustmentReasons.push(`Rounded up to multiple of ${packaging.order_in_multiples_of}`);
    }
  }

  // Apply full package constraint
  if (
    !packaging.allow_partial_package &&
    packaging.package_quantity &&
    packaging.package_quantity > 0
  ) {
    const remainder = adjustedQuantity % packaging.package_quantity;
    if (remainder !== 0) {
      adjustedQuantity = adjustedQuantity + (packaging.package_quantity - remainder);
      adjustmentReasons.push(
        `Rounded up to full ${packaging.package_unit || "package"} (${packaging.package_quantity} units each)`
      );
    }
  }

  const packages = calculatePackages(adjustedQuantity, packaging.package_quantity);

  return {
    raw_quantity: rawQuantity,
    adjusted_quantity: adjustedQuantity,
    packages,
    adjustment_reason: adjustmentReasons.length > 0 ? adjustmentReasons.join("; ") : null,
  };
}

// =====================================================
// Batch Operations
// =====================================================

/**
 * Adjusts multiple quantities for the same supplier's packaging
 */
export async function adjustMultipleQuantities(
  items: Array<{ productSupplierId: string; rawQuantity: number }>
): Promise<
  Array<{
    productSupplierId: string;
    adjustment: PackagingAdjustment;
  }>
> {
  const results = await Promise.all(
    items.map(async (item) => ({
      productSupplierId: item.productSupplierId,
      adjustment: await adjustForPackaging(item.rawQuantity, item.productSupplierId),
    }))
  );

  return results;
}

/**
 * Gets packaging info for multiple product-supplier relationships
 */
export async function getMultiplePackagingInfo(
  productSupplierIds: string[]
): Promise<Map<string, ProductSupplierPackaging>> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("product_suppliers")
    .select(
      `
      id,
      package_unit,
      package_quantity,
      allow_partial_package,
      min_order_quantity,
      order_in_multiples_of,
      supplier_lead_time_days,
      supplier_price
    `
    )
    .in("id", productSupplierIds)
    .is("deleted_at", null);

  if (error) {
    console.error("Error fetching multiple packaging info:", error);
    return new Map();
  }

  const packagingMap = new Map<string, ProductSupplierPackaging>();

  data?.forEach((item) => {
    const { id, ...packaging } = item;
    packagingMap.set(id, packaging as ProductSupplierPackaging);
  });

  return packagingMap;
}

// =====================================================
// Update Operations
// =====================================================

/**
 * Updates packaging information for a product-supplier relationship
 */
export async function updatePackagingInfo(
  productSupplierId: string,
  packaging: Partial<ProductSupplierPackaging>
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();

  // Validate packaging constraints
  if (packaging.package_quantity && packaging.package_quantity <= 0) {
    return {
      success: false,
      error: "Package quantity must be greater than 0",
    };
  }

  if (packaging.min_order_quantity && packaging.min_order_quantity < 0) {
    return {
      success: false,
      error: "Minimum order quantity cannot be negative",
    };
  }

  if (packaging.order_in_multiples_of && packaging.order_in_multiples_of <= 0) {
    return {
      success: false,
      error: "Order multiples must be greater than 0",
    };
  }

  if (packaging.supplier_lead_time_days && packaging.supplier_lead_time_days < 0) {
    return {
      success: false,
      error: "Lead time cannot be negative",
    };
  }

  const { error } = await supabase
    .from("product_suppliers")
    .update(packaging)
    .eq("id", productSupplierId);

  if (error) {
    console.error("Error updating packaging info:", error);
    return {
      success: false,
      error: error.message,
    };
  }

  return { success: true };
}

// =====================================================
// Helper Functions
// =====================================================

/**
 * Checks if a product-supplier has packaging constraints defined
 */
export function hasPackagingConstraints(packaging: ProductSupplierPackaging | null): boolean {
  if (!packaging) return false;

  return !!(
    packaging.package_quantity ||
    packaging.min_order_quantity ||
    packaging.order_in_multiples_of ||
    !packaging.allow_partial_package
  );
}

/**
 * Gets a human-readable summary of packaging constraints
 */
export function getPackagingConstraintsSummary(packaging: ProductSupplierPackaging): string[] {
  const constraints: string[] = [];

  if (packaging.min_order_quantity) {
    constraints.push(`Minimum order: ${packaging.min_order_quantity} units`);
  }

  if (packaging.order_in_multiples_of) {
    constraints.push(`Order in multiples of: ${packaging.order_in_multiples_of}`);
  }

  if (packaging.package_quantity) {
    const packageInfo = `Packaged in ${packaging.package_unit || "units"} of ${packaging.package_quantity}`;
    if (!packaging.allow_partial_package) {
      constraints.push(`${packageInfo} (full packages only)`);
    } else {
      constraints.push(`${packageInfo} (partial allowed)`);
    }
  }

  if (packaging.supplier_lead_time_days) {
    constraints.push(`Lead time: ${packaging.supplier_lead_time_days} days`);
  }

  return constraints;
}
