/**
 * Purchase Orders Type Definitions
 *
 * This file contains all TypeScript types and interfaces for the purchase orders module.
 * It includes types for purchase orders, items, filters, forms, and related entities.
 */

import type { Database } from "@/types/supabase";

// =====================================================
// DATABASE TYPES
// =====================================================

export type PurchaseOrder = Database["public"]["Tables"]["purchase_orders"]["Row"];
export type PurchaseOrderInsert = Database["public"]["Tables"]["purchase_orders"]["Insert"];
export type PurchaseOrderUpdate = Database["public"]["Tables"]["purchase_orders"]["Update"];

export type PurchaseOrderItem = Database["public"]["Tables"]["purchase_order_items"]["Row"];
export type PurchaseOrderItemInsert =
  Database["public"]["Tables"]["purchase_order_items"]["Insert"];
export type PurchaseOrderItemUpdate =
  Database["public"]["Tables"]["purchase_order_items"]["Update"];

// =====================================================
// ENUMS
// =====================================================

export type PurchaseOrderStatus =
  | "draft"
  | "pending"
  | "approved"
  | "partially_received"
  | "received"
  | "cancelled"
  | "closed";

export type PaymentStatus = "unpaid" | "partially_paid" | "paid";

// =====================================================
// EXTENDED TYPES WITH RELATIONS
// =====================================================

export interface PurchaseOrderWithRelations extends PurchaseOrder {
  items?: PurchaseOrderItemWithRelations[];
  supplier?: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    is_active: boolean;
  };
  delivery_location?: {
    id: string;
    name: string;
    code: string;
  };
  created_by_user?: {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
  };
  approved_by_user?: {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
  };
}

export interface PurchaseOrderItemWithRelations extends PurchaseOrderItem {
  product?: {
    id: string;
    name: string;
    sku: string;
    unit: string;
    current_stock?: number;
  };
  product_variant?: {
    id: string;
    name: string;
    sku: string | null;
  };
  product_supplier?: {
    id: string;
    supplier_sku: string | null;
    unit_price: number;
    lead_time_days: number;
    min_order_qty: number;
  };
  expected_location?: {
    id: string;
    name: string;
    code: string;
  };
}

// =====================================================
// FORM DATA TYPES
// =====================================================

export interface PurchaseOrderFormData {
  supplier_id: string;
  po_date?: string;
  expected_delivery_date?: string;
  delivery_location_id?: string;
  payment_terms?: string;
  shipping_cost?: number;
  discount_amount?: number;
  notes?: string;
  internal_notes?: string;
  items: PurchaseOrderItemFormData[];
}

export interface PurchaseOrderItemFormData {
  id?: string; // For editing existing items
  product_id: string;
  product_variant_id?: string;
  product_supplier_id?: string;
  quantity_ordered: number;
  unit_price: number;
  tax_rate?: number;
  discount_percent?: number;
  expected_location_id?: string;
  notes?: string;
}

// =====================================================
// FILTER TYPES
// =====================================================

export interface PurchaseOrderFilters {
  search?: string; // Search by PO number, supplier name
  status?: PurchaseOrderStatus[];
  payment_status?: PaymentStatus[];
  supplier_id?: string;
  date_from?: string;
  date_to?: string;
  expected_delivery_from?: string;
  expected_delivery_to?: string;
  branch_id?: string;
  created_by?: string;
  limit?: number;
  offset?: number;
  sort_by?: "po_date" | "expected_delivery_date" | "total_amount" | "created_at";
  sort_order?: "asc" | "desc";
}

// =====================================================
// RESPONSE TYPES
// =====================================================

export interface PurchaseOrdersResponse {
  purchase_orders: PurchaseOrderWithRelations[];
  total: number;
}

export interface PurchaseOrderItemsResponse {
  items: PurchaseOrderItemWithRelations[];
  total: number;
}

// =====================================================
// SUMMARY & STATISTICS TYPES
// =====================================================

export interface PurchaseOrderSummary {
  id: string;
  po_number: string;
  po_date: string;
  expected_delivery_date: string | null;
  supplier_name: string;
  status: PurchaseOrderStatus;
  payment_status: PaymentStatus;
  total_amount: number;
  amount_paid: number;
  currency_code: string;
  item_count: number;
  total_quantity_ordered: number;
  total_quantity_received: number;
  total_quantity_pending: number;
  is_fully_received: boolean;
  created_at: string;
}

export interface PurchaseOrderStatistics {
  total_pos: number;
  draft_count: number;
  pending_approval_count: number;
  approved_count: number;
  partially_received_count: number;
  received_count: number;
  total_value: number;
  total_unpaid: number;
  overdue_count: number;
  expected_this_week: number;
}

// =====================================================
// RECEIVING TYPES
// =====================================================

export interface ReceiveItemData {
  purchase_order_item_id: string;
  quantity_to_receive: number;
  actual_location_id?: string; // Override expected location
  quality_status?: "good" | "damaged" | "rejected";
  notes?: string;
}

export interface ReceivePurchaseOrderData {
  purchase_order_id: string;
  received_date?: string;
  items: ReceiveItemData[];
  create_stock_movement?: boolean; // Create movement type 101
  notes?: string;
}

// =====================================================
// APPROVAL TYPES
// =====================================================

export interface ApprovePurchaseOrderData {
  purchase_order_id: string;
  notes?: string;
}

export interface RejectPurchaseOrderData {
  purchase_order_id: string;
  rejection_reason: string;
}

// =====================================================
// UTILITY TYPES
// =====================================================

export interface PurchaseOrderValidationResult {
  isValid: boolean;
  errors: {
    field: string;
    message: string;
  }[];
  warnings: {
    field: string;
    message: string;
  }[];
}

// =====================================================
// STATUS DISPLAY HELPERS
// =====================================================

export const PO_STATUS_LABELS: Record<PurchaseOrderStatus, string> = {
  draft: "Draft",
  pending: "Pending Approval",
  approved: "Approved",
  partially_received: "Partially Received",
  received: "Received",
  cancelled: "Cancelled",
  closed: "Closed",
};

export const PO_STATUS_COLORS: Record<PurchaseOrderStatus, string> = {
  draft: "gray",
  pending: "yellow",
  approved: "blue",
  partially_received: "orange",
  received: "green",
  cancelled: "red",
  closed: "slate",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  unpaid: "Unpaid",
  partially_paid: "Partially Paid",
  paid: "Paid",
};

export const PAYMENT_STATUS_COLORS: Record<PaymentStatus, string> = {
  unpaid: "red",
  partially_paid: "yellow",
  paid: "green",
};

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Check if a purchase order can be edited
 */
export function canEditPurchaseOrder(status: PurchaseOrderStatus): boolean {
  return status === "draft" || status === "pending";
}

/**
 * Check if a purchase order can be approved
 */
export function canApprovePurchaseOrder(status: PurchaseOrderStatus): boolean {
  return status === "pending";
}

/**
 * Check if a purchase order can be cancelled
 */
export function canCancelPurchaseOrder(status: PurchaseOrderStatus): boolean {
  return status !== "cancelled" && status !== "closed" && status !== "received";
}

/**
 * Check if a purchase order can be received
 */
export function canReceivePurchaseOrder(status: PurchaseOrderStatus): boolean {
  return status === "approved" || status === "partially_received";
}

/**
 * Check if a purchase order can be closed
 */
export function canClosePurchaseOrder(status: PurchaseOrderStatus): boolean {
  return status === "received" || status === "partially_received";
}

/**
 * Calculate completion percentage
 */
export function calculateCompletionPercentage(
  quantityOrdered: number,
  quantityReceived: number
): number {
  if (quantityOrdered === 0) return 0;
  return Math.round((quantityReceived / quantityOrdered) * 100);
}

/**
 * Format currency
 */
export function formatCurrency(amount: number, currencyCode: string = "PLN"): string {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: currencyCode,
  }).format(amount);
}

/**
 * Calculate days until delivery
 */
export function daysUntilDelivery(expectedDate: string | null): number | null {
  if (!expectedDate) return null;
  const today = new Date();
  const delivery = new Date(expectedDate);
  const diffTime = delivery.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

/**
 * Check if delivery is overdue
 */
export function isDeliveryOverdue(
  expectedDate: string | null,
  status: PurchaseOrderStatus
): boolean {
  if (!expectedDate || status === "received" || status === "cancelled" || status === "closed") {
    return false;
  }
  const days = daysUntilDelivery(expectedDate);
  return days !== null && days < 0;
}
