/**
 * Stock Reservations Types
 *
 * Hybrid reservation model combining:
 * - stock_reservations table for operational state
 * - RES/UNRES movement types in stock_movements for event log
 */

import { Database } from "@/types/supabase";

// Database types
export type StockReservation = Database["public"]["Tables"]["stock_reservations"]["Row"];
export type StockReservationInsert = Database["public"]["Tables"]["stock_reservations"]["Insert"];
export type StockReservationUpdate = Database["public"]["Tables"]["stock_reservations"]["Update"];

/**
 * Reservation Status Lifecycle
 */
export type ReservationStatus =
  | "active" // Reservation is active and holding stock
  | "partial" // Partially fulfilled/released
  | "fulfilled" // Completely fulfilled (converted to shipment)
  | "cancelled" // Cancelled by user
  | "expired"; // Expired due to expiration date

/**
 * Reference Types for Different Reservation Sources
 */
export type ReservationType =
  | "sales_order" // Sales order reservation
  | "work_order" // Workshop/manufacturing order
  | "vmi" // Vendor Managed Inventory
  | "audit" // Audit/field count reservation
  | "transfer" // Inter-branch transfer reservation
  | "allocation" // Manual stock allocation
  | "ecommerce"; // E-commerce platform reservation

/**
 * Create Reservation Request
 */
export interface CreateReservationRequest {
  // Product details
  productId: string;
  variantId?: string;
  locationId: string;

  // Quantity
  quantity: number;

  // Reference (source of reservation)
  referenceType: ReservationType;
  referenceId?: string;
  referenceNumber?: string;
  reservedFor: string; // Description of what this is reserved for

  // Sales order specifics (if applicable)
  salesOrderId?: string;
  salesOrderItemId?: string;

  // Optional settings
  priority?: number; // Higher = more important (default: 0)
  autoRelease?: boolean; // Auto-release when expired (default: true)
  expiresAt?: string; // ISO timestamp when reservation expires
  notes?: string;

  // Context (provided by service)
  organizationId?: string;
  branchId?: string;
  userId?: string;
}

/**
 * Release (Fulfill) Reservation Request
 */
export interface ReleaseReservationRequest {
  reservationId: string;
  quantity: number; // How much to release/fulfill
  notes?: string;
  userId?: string;
}

/**
 * Cancel Reservation Request
 */
export interface CancelReservationRequest {
  reservationId: string;
  reason: string;
  userId?: string;
}

/**
 * Reservation with Related Data (for display)
 */
export interface ReservationWithDetails extends StockReservation {
  product?: {
    id: string;
    name: string;
    sku: string;
    image_url?: string;
  };
  variant?: {
    id: string;
    name: string;
    sku: string;
  };
  location?: {
    id: string;
    name: string;
    code: string;
  };
  salesOrder?: {
    id: string;
    order_number: string;
    customer_name: string;
    status: string;
  };
  createdByUser?: {
    id: string;
    email: string;
    full_name?: string;
  };
}

/**
 * Available Inventory (from view)
 */
export interface AvailableInventory {
  productId: string;
  variantId?: string;
  locationId: string;
  organizationId: string;
  branchId: string;
  quantityOnHand: number; // Physical stock
  reservedQuantity: number; // Reserved stock
  availableQuantity: number; // Available = on_hand - reserved
  totalValue?: number;
  averageCost?: number;
  lastMovementAt?: string;
  updatedAt: string;
}

/**
 * Reservation Filter Options
 */
export interface ReservationFilters {
  status?: ReservationStatus | ReservationStatus[];
  referenceType?: ReservationType | ReservationType[];
  productId?: string;
  locationId?: string;
  salesOrderId?: string;
  branchId?: string;
  createdBy?: string;
  expiresAfter?: string; // ISO timestamp
  expiresBefore?: string; // ISO timestamp
  search?: string; // Search by reservation_number, reference_number, reserved_for
}

/**
 * Reservation Summary Stats
 */
export interface ReservationStats {
  totalActive: number;
  totalExpired: number;
  totalFulfilled: number;
  totalCancelled: number;
  totalQuantityReserved: number;
  totalValueReserved: number;
}

/**
 * Reservation Validation Result
 */
export interface ReservationValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  availableQuantity?: number;
  requestedQuantity?: number;
}

/**
 * Movement Types for Reservations
 */
export const RESERVATION_MOVEMENT_TYPES = {
  CREATE: "501", // RES - Reservation Created
  RELEASE: "502", // UNRES - Reservation Released
} as const;

/**
 * Reservation Helper Functions
 */
export const ReservationHelpers = {
  /**
   * Check if reservation is active
   */
  isActive: (reservation: StockReservation): boolean => {
    return reservation.status === "active" || reservation.status === "partial";
  },

  /**
   * Check if reservation is expired
   */
  isExpired: (reservation: StockReservation): boolean => {
    if (!reservation.expires_at) return false;
    return new Date(reservation.expires_at) < new Date();
  },

  /**
   * Get remaining quantity to fulfill
   */
  getRemainingQuantity: (reservation: StockReservation): number => {
    return reservation.reserved_quantity - reservation.released_quantity;
  },

  /**
   * Calculate fulfillment percentage
   */
  getFulfillmentPercentage: (reservation: StockReservation): number => {
    if (reservation.reserved_quantity === 0) return 0;
    return (reservation.released_quantity / reservation.reserved_quantity) * 100;
  },

  /**
   * Get status badge color
   */
  getStatusColor: (status: ReservationStatus): string => {
    switch (status) {
      case "active":
        return "blue";
      case "partial":
        return "yellow";
      case "fulfilled":
        return "green";
      case "cancelled":
        return "red";
      case "expired":
        return "gray";
      default:
        return "gray";
    }
  },
};
