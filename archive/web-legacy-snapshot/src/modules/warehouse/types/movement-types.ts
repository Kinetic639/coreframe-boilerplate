// =============================================
// Movement Types - TypeScript Definitions
// Phase 1: Enhanced Movement Types
// =============================================

/**
 * Movement category classifications
 */
export type MovementCategory =
  | "receipt" // Goods received (PZ)
  | "issue" // Goods issued (WZ)
  | "transfer" // Inter-location transfers (MM)
  | "adjustment" // Stock adjustments (KP/KN/INW)
  | "reservation" // Stock reservations
  | "ecommerce"; // E-commerce channel movements

/**
 * Polish warehouse document types
 * Based on Polish accounting regulations
 */
export type PolishDocumentType =
  | "PZ" // Przyjęcie Zewnętrzne (External Receipt)
  | "PZ-K" // Korekta PZ (PZ Reversal)
  | "PZ-ZK" // Zwrot od Klienta (Customer Return)
  | "PZ-P" // Produkcja (Production Output)
  | "PZ-I" // Stan Początkowy (Initial Stock)
  | "PZ-S" // Shopify Receipt
  | "PZ-W" // WooCommerce Receipt
  | "PZ-A" // Allegro Receipt
  | "WZ" // Wydanie Zewnętrzne (External Issue)
  | "WZ-K" // Korekta WZ (WZ Reversal)
  | "WZ-ZD" // Zwrot do Dostawcy (Supplier Return)
  | "WZ-S" // Shopify Issue
  | "WZ-W" // WooCommerce Issue
  | "WZ-A" // Allegro Issue
  | "MM" // Międzymagazynowe (Inter-Warehouse)
  | "MM-W" // MM Wydanie (Transfer Out)
  | "MM-P" // MM Przyjęcie (Transfer In)
  | "MM-L" // MM Lokalizacja (Intra-Location)
  | "MM-O" // MM Oddziały (Inter-Branch)
  | "MM-Q" // MM Quality (Quality Reclassification)
  | "RW" // Rozchód Wewnętrzny (Internal Issue)
  | "RW-P" // RW Produkcja (Production Consumption)
  | "RW-S" // RW Szkody (Waste/Damage)
  | "INW" // Inwentaryzacja (Inventory Count)
  | "KP" // Korekta Dodatnia (Positive Adjustment)
  | "KN"; // Korekta Ujemna (Negative Adjustment)

/**
 * Cost impact of the movement
 */
export type CostImpact = "increase" | "decrease" | "neutral";

/**
 * Movement type complete definition
 */
export interface MovementType {
  id: string;
  code: string;
  category: MovementCategory;
  name: string;
  name_pl: string;
  name_en: string;
  description: string | null;
  polish_document_type: PolishDocumentType | null;
  affects_stock: -1 | 0 | 1;
  requires_approval: boolean;
  requires_source_location: boolean;
  requires_destination_location: boolean;
  requires_reference: boolean;
  allows_manual_entry: boolean;
  generates_document: boolean;
  is_system: boolean;
  cost_impact: CostImpact | null;
  accounting_entry: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/**
 * Data for creating a new movement
 */
export interface CreateMovementData {
  movement_type_code: string;
  organization_id: string;
  branch_id: string;
  location_id?: string;
  product_id: string;
  variant_id?: string;
  quantity: number;
  unit_cost?: number;
  total_cost?: number;
  currency?: string;
  reference_type?: string;
  reference_id?: string;
  created_by?: string;
  approved_by?: string;
  approved_at?: string;
  notes?: string;
  occurred_at?: string;
  batch_number?: string;
  serial_number?: string;
  expiry_date?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Movement validation result
 */
export interface MovementValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Movement type filter options
 */
export interface MovementTypeFilters {
  category?: MovementCategory;
  allows_manual_entry?: boolean;
  generates_document?: boolean;
  polish_document_type?: PolishDocumentType;
  requires_approval?: boolean;
}

/**
 * Movement type summary for UI display
 */
export interface MovementTypeSummary {
  code: string;
  name: string;
  nameLocalized: string; // Based on locale
  category: MovementCategory;
  icon?: string;
  color?: string;
  description?: string;
}

/**
 * SAP-style movement code ranges
 */
export const MOVEMENT_CODE_RANGES = {
  RECEIPTS: { min: 100, max: 199, category: "receipt" as MovementCategory },
  ISSUES: { min: 200, max: 299, category: "issue" as MovementCategory },
  TRANSFERS: { min: 300, max: 399, category: "transfer" as MovementCategory },
  ADJUSTMENTS: { min: 400, max: 499, category: "adjustment" as MovementCategory },
  RESERVATIONS: { min: 500, max: 599, category: "reservation" as MovementCategory },
  ECOMMERCE: { min: 600, max: 699, category: "ecommerce" as MovementCategory },
} as const;

/**
 * Common movement type codes
 */
export const COMMON_MOVEMENT_CODES = {
  // Receipts
  GOODS_RECEIPT_PO: "101",
  GOODS_RECEIPT_REVERSAL: "102",
  CUSTOMER_RETURN: "103",
  PRODUCTION_OUTPUT: "104",
  INITIAL_STOCK: "105",

  // Issues
  GOODS_ISSUE_SALE: "201",
  GOODS_ISSUE_REVERSAL: "202",
  SUPPLIER_RETURN: "203",
  PRODUCTION_CONSUMPTION: "204",
  COST_CENTER_ISSUE: "205",
  WASTE_DAMAGE: "206",

  // Transfers
  TRANSFER_OUT: "301",
  TRANSFER_IN: "302",
  INTRA_LOCATION: "303",
  INTER_BRANCH_OUT: "311",
  INTER_BRANCH_IN: "312",

  // Adjustments
  POSITIVE_ADJUSTMENT: "401",
  NEGATIVE_ADJUSTMENT: "402",
  AUDIT_ADJUSTMENT: "403",
  QUALITY_RECLASSIFICATION: "411",

  // Reservations
  RESERVATION: "501",
  RESERVATION_RELEASE: "502",

  // E-commerce
  SHOPIFY_ORDER: "601",
  WOOCOMMERCE_ORDER: "602",
  ALLEGRO_ORDER: "603",
  SHOPIFY_RETURN: "611",
  WOOCOMMERCE_RETURN: "612",
  ALLEGRO_RETURN: "613",
} as const;

/**
 * Movement type category labels
 */
export const MOVEMENT_CATEGORY_LABELS: Record<MovementCategory, { pl: string; en: string }> = {
  receipt: { pl: "Przyjęcia", en: "Receipts" },
  issue: { pl: "Wydania", en: "Issues" },
  transfer: { pl: "Przesunięcia", en: "Transfers" },
  adjustment: { pl: "Korekty", en: "Adjustments" },
  reservation: { pl: "Rezerwacje", en: "Reservations" },
  ecommerce: { pl: "E-commerce", en: "E-commerce" },
};

/**
 * Helper function to get category from code
 */
export function getCategoryFromCode(code: string): MovementCategory | null {
  const numericCode = parseInt(code, 10);
  if (isNaN(numericCode)) return null;

  for (const [, range] of Object.entries(MOVEMENT_CODE_RANGES)) {
    if (numericCode >= range.min && numericCode <= range.max) {
      return range.category;
    }
  }

  return null;
}

/**
 * Helper function to validate movement type code
 */
export function isValidMovementCode(code: string): boolean {
  const numericCode = parseInt(code, 10);
  if (isNaN(numericCode)) {
    // Allow legacy codes
    return [
      "initial",
      "purchase",
      "sale",
      "adjustment_positive",
      "adjustment_negative",
      "damaged",
      "transfer_out",
      "transfer_in",
      "return_customer",
      "return_supplier",
      "production_consume",
      "production_output",
      "reservation",
      "reservation_release",
      "audit_adjustment",
    ].includes(code);
  }

  return getCategoryFromCode(code) !== null;
}
