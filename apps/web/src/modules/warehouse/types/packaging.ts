/**
 * Packaging and Ordering Constraints Types
 * Phase 1 of Inventory Replenishment System
 *
 * These types define supplier-specific packaging rules.
 * Different suppliers can sell the same product with different
 * packaging, MOQs, and ordering constraints.
 */

/**
 * Packaging information for a product-supplier relationship
 */
export interface ProductSupplierPackaging {
  package_unit: string | null; // 'box', 'case', 'pallet', 'drum', 'bundle', 'carton'
  package_quantity: number | null; // How many base units per package
  allow_partial_package: boolean; // Can order partial packages?
  min_order_quantity: number | null; // Minimum quantity (in base units)
  order_in_multiples_of: number | null; // Must order in multiples of this
  supplier_lead_time_days: number | null; // Supplier-specific lead time
  supplier_price: number | null; // Price per base unit
}

/**
 * Result of packaging adjustment calculation
 */
export interface PackagingAdjustment {
  raw_quantity: number; // Original quantity before adjustments
  adjusted_quantity: number; // Final quantity after all adjustments
  packages: number | null; // Number of packages (if applicable)
  adjustment_reason: string | null; // Human-readable explanation
}

/**
 * Common package unit types
 */
export const PACKAGE_UNITS = {
  box: "Box",
  case: "Case",
  pallet: "Pallet",
  drum: "Drum",
  bundle: "Bundle",
  carton: "Carton",
  bag: "Bag",
  roll: "Roll",
  pack: "Pack",
} as const;

export type PackageUnit = keyof typeof PACKAGE_UNITS;

/**
 * Helper function to format quantity with units
 */
export function formatQuantity(
  qty: number,
  baseUnit: string,
  packageInfo?: {
    packageUnit: string | null;
    packageQuantity: number | null;
  },
  showPackages = true
): string {
  if (!packageInfo?.packageUnit || !packageInfo?.packageQuantity || !showPackages) {
    return `${qty} ${baseUnit}${qty !== 1 ? "s" : ""}`;
  }

  const packages = Math.floor(qty / packageInfo.packageQuantity);
  const remainder = qty % packageInfo.packageQuantity;

  if (remainder === 0) {
    return `${packages} ${packageInfo.packageUnit}${packages !== 1 ? "s" : ""} (${qty} ${baseUnit}s)`;
  } else {
    return `${packages} ${packageInfo.packageUnit}s + ${remainder} ${baseUnit}s (${qty} total)`;
  }
}

/**
 * Helper function to calculate packages from quantity
 */
export function calculatePackages(quantity: number, packageQuantity: number | null): number | null {
  if (!packageQuantity || packageQuantity === 0) {
    return null;
  }
  return quantity / packageQuantity;
}

/**
 * Helper function to calculate quantity from packages
 */
export function calculateQuantityFromPackages(
  packages: number,
  packageQuantity: number | null
): number {
  if (!packageQuantity) {
    return packages; // Assume 1:1 if no package quantity
  }
  return packages * packageQuantity;
}

/**
 * Validates if quantity meets packaging constraints
 */
export function validatePackagingConstraints(
  quantity: number,
  packaging: ProductSupplierPackaging
): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check minimum order quantity
  if (packaging.min_order_quantity && quantity < packaging.min_order_quantity) {
    errors.push(`Minimum order quantity is ${packaging.min_order_quantity}`);
  }

  // Check multiples
  if (packaging.order_in_multiples_of && quantity % packaging.order_in_multiples_of !== 0) {
    errors.push(`Must order in multiples of ${packaging.order_in_multiples_of}`);
  }

  // Check full packages
  if (
    !packaging.allow_partial_package &&
    packaging.package_quantity &&
    quantity % packaging.package_quantity !== 0
  ) {
    errors.push(
      `Must order full ${packaging.package_unit || "package"}s only (${packaging.package_quantity} units each)`
    );
  }

  // Warning if quantity is very different from package quantity
  if (
    packaging.package_quantity &&
    packaging.allow_partial_package &&
    quantity % packaging.package_quantity !== 0
  ) {
    const packages = Math.floor(quantity / packaging.package_quantity);
    const nextFullPackage = (packages + 1) * packaging.package_quantity;
    warnings.push(
      `Consider ordering ${nextFullPackage} (${packages + 1} full ${packaging.package_unit || "package"}s)`
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}
