// =============================================
// Stock Movements - TypeScript Definitions
// Phase 2: Stock Movement System
// =============================================

import type { MovementCategory, MovementType } from "./movement-types";

// Re-export for convenience
export type { MovementCategory, MovementType };

/**
 * Stock movement status
 */
export type MovementStatus = "pending" | "approved" | "completed" | "cancelled" | "reversed";

/**
 * Reference types for movements
 */
export type ReferenceType =
  | "purchase_order"
  | "sales_order"
  | "transfer_request"
  | "production_order"
  | "return_authorization"
  | "manual"
  | "ecommerce_order";

/**
 * Stock reservation status
 */
export type ReservationStatus = "active" | "partial" | "fulfilled" | "expired" | "cancelled";

/**
 * Complete stock movement record
 */
export interface StockMovement {
  id: string;
  movement_number: string;
  movement_type_code: string;
  category: MovementCategory;

  // Context
  organization_id: string;
  branch_id: string;

  // Product
  product_id: string;
  variant_id: string | null;

  // Locations
  source_location_id: string | null;
  destination_location_id: string | null;

  // Quantity
  quantity: number;
  unit_of_measure: string | null;

  // Financial
  unit_cost: number | null;
  total_cost: number | null;
  currency: string;

  // Reference
  reference_type: ReferenceType | null;
  reference_id: string | null;
  reference_number: string | null;

  // Status & Approval
  status: MovementStatus;
  requires_approval: boolean;
  approved_by: string | null;
  approved_at: string | null;

  // Tracking
  batch_number: string | null;
  serial_number: string | null;
  lot_number: string | null;
  expiry_date: string | null;
  manufacturing_date: string | null;

  // Document
  document_number: string | null;
  document_generated_at: string | null;
  document_url: string | null;

  // Timestamps
  occurred_at: string;
  created_at: string;
  updated_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;

  // Users
  created_by: string | null;
  updated_by: string | null;
  cancelled_by: string | null;

  // Notes
  notes: string | null;
  cancellation_reason: string | null;
  metadata: Record<string, unknown>;

  // Soft delete
  deleted_at: string | null;
}

/**
 * Stock movement with related data (for display)
 */
export interface StockMovementWithRelations extends StockMovement {
  movement_type?: MovementType;
  product?: {
    id: string;
    name: string;
    sku: string;
  };
  variant?: {
    id: string;
    name: string;
    sku: string;
  };
  source_location?: {
    id: string;
    name: string;
    code: string;
  };
  destination_location?: {
    id: string;
    name: string;
    code: string;
  };
  created_by_user?: {
    id: string;
    email: string;
    name: string;
  };
  approved_by_user?: {
    id: string;
    email: string;
    name: string;
  };
}

/**
 * Data for creating a new stock movement
 */
export interface CreateStockMovementData {
  movement_type_code: string;
  organization_id: string;
  branch_id: string;
  product_id: string;
  quantity: number;
  variant_id?: string;
  location_id?: string; // Primary location for the movement
  source_location_id?: string;
  destination_location_id?: string;
  unit_of_measure?: string;
  unit_cost?: number;
  currency?: string;
  reference_type?: ReferenceType;
  reference_id?: string;
  reference_number?: string;
  batch_number?: string;
  serial_number?: string;
  lot_number?: string;
  expiry_date?: string;
  manufacturing_date?: string;
  notes?: string;
  occurred_at?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Data for updating a stock movement
 */
export interface UpdateStockMovementData {
  quantity?: number;
  unit_cost?: number;
  source_location_id?: string;
  destination_location_id?: string;
  batch_number?: string;
  serial_number?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Stock movement filters
 */
export interface StockMovementFilters {
  organization_id?: string;
  branch_id?: string;
  product_id?: string;
  variant_id?: string;
  movement_type_code?: string;
  category?: MovementCategory;
  status?: MovementStatus;
  source_location_id?: string;
  destination_location_id?: string;
  reference_type?: ReferenceType;
  reference_id?: string;
  created_by?: string;
  date_from?: string;
  date_to?: string;
  search?: string; // Search in movement_number, document_number, notes
}

/**
 * Stock reservation record
 */
export interface StockReservation {
  id: string;
  reservation_number: string;

  // Context
  organization_id: string;
  branch_id: string;

  // Product & Location
  product_id: string;
  variant_id: string | null;
  location_id: string;

  // Quantities
  quantity: number;
  reserved_quantity: number;
  released_quantity: number;

  // Reference
  reference_type: string;
  reference_id: string;
  reference_number: string | null;

  // Status
  status: ReservationStatus;

  // Timestamps
  reserved_at: string;
  expires_at: string | null;
  fulfilled_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string | null;

  // Users
  created_by: string | null;
  cancelled_by: string | null;

  // Notes
  notes: string | null;
  metadata: Record<string, unknown>;

  // Soft delete
  deleted_at: string | null;
}

/**
 * Stock inventory level (from view)
 */
export interface StockInventoryLevel {
  organization_id: string;
  branch_id: string;
  product_id: string;
  variant_id: string | null;
  location_id: string;
  available_quantity: number;
  reserved_quantity: number;
  available_to_promise: number;
  total_value: number;
  average_cost: number;
  last_movement_at: string;
  total_movements: number;
}

/**
 * Stock level summary
 */
export interface StockLevelSummary {
  product_id: string;
  variant_id: string | null;
  total_quantity: number;
  total_value: number;
  locations: {
    location_id: string;
    location_name: string;
    quantity: number;
    value: number;
  }[];
}

/**
 * Movement validation result
 */
export interface MovementValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  requiredFields: {
    sourceLocation: boolean;
    destinationLocation: boolean;
    reference: boolean;
    approval: boolean;
  };
  stockCheck?: {
    available: number;
    required: number;
    sufficient: boolean;
  };
}

/**
 * Movement approval data
 */
export interface ApproveMovementData {
  movement_id: string;
  approved_by: string;
  notes?: string;
}

/**
 * Movement cancellation data
 */
export interface CancelMovementData {
  movement_id: string;
  cancelled_by: string;
  cancellation_reason: string;
}

/**
 * Batch movement creation (for bulk operations)
 */
export interface BatchMovementData {
  movements: CreateStockMovementData[];
  validate_stock?: boolean;
  auto_approve?: boolean;
}

/**
 * Movement statistics
 */
export interface MovementStatistics {
  total_movements: number;
  pending_approvals: number;
  completed_today: number;
  total_value: number;
  by_category: Record<MovementCategory, number>;
  by_status: Record<MovementStatus, number>;
}

/**
 * Stock transfer data (simplified interface for transfers)
 */
export interface StockTransferData {
  product_id: string;
  variant_id?: string;
  quantity: number;
  from_location_id: string;
  to_location_id: string;
  notes?: string;
  requires_approval?: boolean;
}

/**
 * Stock adjustment data (simplified interface for adjustments)
 */
export interface StockAdjustmentData {
  product_id: string;
  variant_id?: string;
  location_id: string;
  quantity: number; // Positive for increase, negative for decrease
  reason: string;
  unit_cost?: number;
}

/**
 * Movement document generation data
 */
export interface GenerateMovementDocumentData {
  movement_id: string;
  template?: string;
  include_signature?: boolean;
  language?: "pl" | "en";
}

/**
 * Helper type for movement creation response
 */
export interface CreateMovementResponse {
  success: boolean;
  movement_id?: string;
  movement_number?: string;
  errors?: string[];
  warnings?: string[];
}

/**
 * Helper type for pagination
 */
export interface PaginatedMovements {
  data: StockMovementWithRelations[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

/**
 * Constants for validation
 */
export const MOVEMENT_VALIDATION = {
  MAX_QUANTITY: 999999.9999,
  MIN_QUANTITY: 0.0001,
  MAX_COST: 9999999999.99,
  MIN_COST: 0,
} as const;

/**
 * Default values
 */
export const MOVEMENT_DEFAULTS = {
  CURRENCY: "PLN",
  STATUS: "pending" as MovementStatus,
  PAGE_SIZE: 50,
} as const;

/**
 * Status display configuration
 */
export const MOVEMENT_STATUS_CONFIG: Record<
  MovementStatus,
  { label: { pl: string; en: string }; color: string; icon: string }
> = {
  pending: {
    label: { pl: "Oczekuje", en: "Pending" },
    color: "warning",
    icon: "clock",
  },
  approved: {
    label: { pl: "Zatwierdzony", en: "Approved" },
    color: "info",
    icon: "check-circle",
  },
  completed: {
    label: { pl: "Zakończony", en: "Completed" },
    color: "success",
    icon: "check-circle-2",
  },
  cancelled: {
    label: { pl: "Anulowany", en: "Cancelled" },
    color: "destructive",
    icon: "x-circle",
  },
  reversed: {
    label: { pl: "Wycofany", en: "Reversed" },
    color: "secondary",
    icon: "undo",
  },
};

/**
 * Reference type configuration
 */
export const REFERENCE_TYPE_CONFIG: Record<
  ReferenceType,
  { label: { pl: string; en: string }; icon: string }
> = {
  purchase_order: {
    label: { pl: "Zamówienie zakupu", en: "Purchase Order" },
    icon: "shopping-cart",
  },
  sales_order: {
    label: { pl: "Zamówienie sprzedaży", en: "Sales Order" },
    icon: "package",
  },
  transfer_request: {
    label: { pl: "Prośba o transfer", en: "Transfer Request" },
    icon: "arrow-right-left",
  },
  production_order: {
    label: { pl: "Zlecenie produkcyjne", en: "Production Order" },
    icon: "cog",
  },
  return_authorization: {
    label: { pl: "Autoryzacja zwrotu", en: "Return Authorization" },
    icon: "undo-2",
  },
  manual: {
    label: { pl: "Ręczne", en: "Manual" },
    icon: "hand",
  },
  ecommerce_order: {
    label: { pl: "Zamówienie e-commerce", en: "E-commerce Order" },
    icon: "shopping-bag",
  },
};
