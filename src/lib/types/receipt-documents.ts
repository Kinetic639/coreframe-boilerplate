/**
 * Receipt Documents Types
 *
 * Type definitions for the receipt processing system (Solution B).
 *
 * Architecture:
 * - receipt_documents = Header with metadata (who, when, PZ doc, QC notes)
 * - receipt_movements = Junction table linking receipts to movements
 * - stock_movements = Quantitative truth (what, how much, where)
 *
 * This design separates compliance/audit concerns from movement mechanics.
 */

import { Database } from "@/supabase/types/types";

// ============================================
// Database Types (from Supabase)
// ============================================

export type ReceiptDocumentRow = Database["public"]["Tables"]["receipt_documents"]["Row"];
export type ReceiptDocumentInsert = Database["public"]["Tables"]["receipt_documents"]["Insert"];
export type ReceiptDocumentUpdate = Database["public"]["Tables"]["receipt_documents"]["Update"];

export type ReceiptMovementRow = Database["public"]["Tables"]["receipt_movements"]["Row"];
export type ReceiptMovementInsert = Database["public"]["Tables"]["receipt_movements"]["Insert"];

// ============================================
// Enums
// ============================================

export type ReceiptStatus = "draft" | "completed" | "cancelled";

export type ReceiptType = "full" | "partial" | "final_partial";

// ============================================
// Extended Types with Relations
// ============================================

export interface ReceiptDocumentWithRelations extends ReceiptDocumentRow {
  // User relationships
  created_by_user?: {
    id: string;
    email: string;
    first_name?: string;
    last_name?: string;
  } | null;

  received_by_user?: {
    id: string;
    email: string;
    first_name?: string;
    last_name?: string;
  } | null;

  // Linked movements
  movements?: Array<{
    id: string;
    movement_number: string;
    movement_type_id: string;
    product_id: string;
    variant_id: string | null;
    quantity: number;
    unit: string;
    unit_cost: number | null;
    total_cost: number | null;
    destination_location_id: string | null;
    batch_number: string | null;
    serial_number: string | null;
    expiry_date: string | null;
    status: string;
    parent_movement_id: string | null;
  }>;

  // Organization/Branch info
  organization?: {
    organization_id: string;
    name: string;
  };

  branch?: {
    branch_id: string;
    name: string;
  };
}

// ============================================
// Receipt Creation Types
// ============================================

export interface CreateReceiptInput {
  organization_id: string;
  branch_id: string;
  receipt_type: ReceiptType;
  receipt_date?: Date | string;
  received_by?: string;
  quality_check_passed?: boolean;
  quality_notes?: string;
  receiving_notes?: string;

  // Movements to link
  movement_ids: string[];
}

export interface CreateReceiptItemInput {
  product_id: string;
  variant_id?: string | null;
  quantity_received: number;
  quantity_damaged?: number;
  unit: string;
  unit_cost?: number;
  destination_location_id: string;
  batch_number?: string;
  serial_number?: string;
  expiry_date?: Date | string | null;
  damage_reason?: DamageReason;
  damage_notes?: string;
  notes?: string;
}

// ============================================
// Receipt Processing Types
// ============================================

/**
 * Input for processing a delivery receipt
 * This is what the UI sends when user receives goods
 */
export interface ProcessDeliveryReceiptInput {
  // Original delivery movement ID
  delivery_movement_id: string;

  // Receipt header info
  receipt_date?: Date | string;
  receipt_type: ReceiptType;
  received_by?: string;
  quality_check_passed?: boolean;
  quality_notes?: string;
  receiving_notes?: string;

  // Line items being received
  items: Array<{
    product_id: string;
    variant_id?: string | null;
    quantity_ordered: number; // From original delivery
    quantity_received: number; // Actually received
    quantity_damaged: number; // Damaged/rejected
    unit: string;
    unit_cost?: number;
    destination_location_id: string;
    batch_number?: string;
    serial_number?: string;
    expiry_date?: Date | string | null;
    damage_reason?: DamageReason;
    damage_notes?: string;
    notes?: string;
  }>;
}

/**
 * Result of processing a receipt
 */
export interface ProcessReceiptResult {
  success: boolean;
  receipt_id?: string;
  receipt_number?: string;
  pz_document_url?: string;
  movements_created?: string[]; // IDs of created movements
  error?: string;
}

// ============================================
// Damage Tracking
// ============================================

export type DamageReason =
  | "damaged_in_transit"
  | "wrong_product"
  | "expired"
  | "quality_issue"
  | "packaging_damaged"
  | "incomplete_order"
  | "other";

export const DAMAGE_REASON_LABELS: Record<DamageReason, string> = {
  damaged_in_transit: "Damaged in Transit",
  wrong_product: "Wrong Product",
  expired: "Expired",
  quality_issue: "Quality Issue",
  packaging_damaged: "Packaging Damaged",
  incomplete_order: "Incomplete Order",
  other: "Other",
};

// ============================================
// Receipt Summary/Stats
// ============================================

export interface ReceiptSummary {
  total_receipts: number;
  total_value: number;
  receipts_today: number;
  receipts_this_week: number;
  receipts_this_month: number;
  pending_receipts: number;
  average_receipt_value: number;
}

// ============================================
// Receipt Filters
// ============================================

export interface ReceiptFilters {
  organization_id: string;
  branch_id?: string;
  status?: ReceiptStatus;
  receipt_type?: ReceiptType;
  date_from?: Date | string;
  date_to?: Date | string;
  received_by?: string;
  search?: string; // Search by receipt_number, pz_document_number
  has_quality_issues?: boolean;
}

// ============================================
// Partial Receipt Tracking
// ============================================

/**
 * Tracks partial receipt status for a delivery
 */
export interface PartialReceiptStatus {
  delivery_movement_id: string;
  quantity_ordered: number;
  quantity_received: number;
  quantity_remaining: number;
  receipts: Array<{
    receipt_id: string;
    receipt_number: string;
    receipt_date: string;
    quantity: number;
    status: ReceiptStatus;
  }>;
  is_complete: boolean;
  can_receive_more: boolean;
}

// ============================================
// Receipt Document Details
// ============================================

/**
 * Full receipt details including all movements and products
 */
export interface ReceiptDocumentDetails extends ReceiptDocumentWithRelations {
  line_items: Array<{
    movement_id: string;
    movement_number: string;
    product_id: string;
    product_name: string;
    product_sku: string;
    variant_id: string | null;
    variant_name: string | null;
    variant_sku: string | null;
    quantity: number;
    unit: string;
    unit_cost: number | null;
    total_cost: number | null;
    location_id: string | null;
    location_name: string | null;
    batch_number: string | null;
    serial_number: string | null;
    expiry_date: string | null;
    movement_status: string;
  }>;
}

// ============================================
// Validation Types
// ============================================

export interface ReceiptValidationError {
  field: string;
  message: string;
}

export interface ReceiptValidationResult {
  valid: boolean;
  errors: ReceiptValidationError[];
  warnings?: string[];
}
