// Sales Orders Types
// Based on database tables: sales_orders, sales_order_items

import type { Database } from "../../../../supabase/types/types";

// =============================================
// Database Types (from Supabase generated types)
// =============================================

export type SalesOrderRow = Database["public"]["Tables"]["sales_orders"]["Row"];
export type SalesOrderInsert = Database["public"]["Tables"]["sales_orders"]["Insert"];
export type SalesOrderUpdate = Database["public"]["Tables"]["sales_orders"]["Update"];

export type SalesOrderItemRow = Database["public"]["Tables"]["sales_order_items"]["Row"];
export type SalesOrderItemInsert = Database["public"]["Tables"]["sales_order_items"]["Insert"];
export type SalesOrderItemUpdate = Database["public"]["Tables"]["sales_order_items"]["Update"];

// =============================================
// Enums and Constants
// =============================================

export const SALES_ORDER_STATUS = {
  DRAFT: "draft",
  PENDING: "pending",
  CONFIRMED: "confirmed",
  PROCESSING: "processing",
  FULFILLED: "fulfilled",
  CANCELLED: "cancelled",
} as const;

export type SalesOrderStatus = (typeof SALES_ORDER_STATUS)[keyof typeof SALES_ORDER_STATUS];

export const SALES_ORDER_STATUS_LABELS: Record<SalesOrderStatus, string> = {
  draft: "Draft",
  pending: "Pending",
  confirmed: "Confirmed",
  processing: "Processing",
  fulfilled: "Fulfilled",
  cancelled: "Cancelled",
};

export const SALES_ORDER_STATUS_COLORS: Record<
  SalesOrderStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  draft: "outline",
  pending: "secondary",
  confirmed: "default",
  processing: "default",
  fulfilled: "default",
  cancelled: "destructive",
};

// =============================================
// Extended Types with Relations
// =============================================

export type SalesOrder = SalesOrderRow;

export type SalesOrderItem = SalesOrderItemRow;

export interface SalesOrderWithItems extends SalesOrderRow {
  items: SalesOrderItemRow[];
}

export interface SalesOrderWithRelations extends SalesOrderRow {
  items: SalesOrderItemRow[];
  customer?: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
  } | null;
}

// =============================================
// Form Data Types
// =============================================

export interface SalesOrderFormData {
  // Customer Information
  customer_id?: string;
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;

  // Order Information
  order_date: string; // ISO date string
  expected_delivery_date?: string;

  // Delivery Address
  delivery_address_line1?: string;
  delivery_address_line2?: string;
  delivery_city?: string;
  delivery_state?: string;
  delivery_postal_code?: string;
  delivery_country?: string;

  // Financial
  shipping_cost?: number;
  discount_amount?: number;
  currency_code?: string;

  // Notes
  customer_notes?: string;
  internal_notes?: string;

  // Items
  items: SalesOrderItemFormData[];
}

export interface SalesOrderItemFormData {
  // Product Selection
  product_id: string;
  product_variant_id?: string;

  // Denormalized for display (auto-filled from product selection)
  product_name?: string;
  product_sku?: string;
  variant_name?: string;

  // Quantity & Pricing
  quantity_ordered: number;
  unit_of_measure?: string;
  unit_price: number;
  tax_rate?: number;
  discount_percent?: number;

  // Location (where to fulfill from)
  location_id?: string;

  // Notes
  notes?: string;
}

// =============================================
// Filter and Query Types
// =============================================

export interface SalesOrderFilters {
  status?: SalesOrderStatus | SalesOrderStatus[];
  customer_id?: string;
  branch_id?: string;
  order_date_from?: string;
  order_date_to?: string;
  search?: string; // Search in order_number, customer_name
  has_items?: boolean;
}

export interface SalesOrderListParams {
  filters?: SalesOrderFilters;
  page?: number;
  page_size?: number;
  sort_by?: "order_date" | "order_number" | "total_amount" | "created_at";
  sort_order?: "asc" | "desc";
}

// =============================================
// Service Response Types
// =============================================

export interface SalesOrderListResponse {
  orders: SalesOrderWithItems[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface CreateSalesOrderResult {
  success: boolean;
  order?: SalesOrderWithItems;
  error?: string;
}

export interface UpdateSalesOrderResult {
  success: boolean;
  order?: SalesOrderWithItems;
  error?: string;
}

export interface DeleteSalesOrderResult {
  success: boolean;
  error?: string;
}

// =============================================
// Status Transition Types
// =============================================

export interface SalesOrderStatusTransition {
  from: SalesOrderStatus;
  to: SalesOrderStatus;
  requires_validation?: boolean;
  creates_reservation?: boolean; // confirmed status creates reservations
  releases_reservation?: boolean; // fulfilled/cancelled releases reservations
}

export const VALID_STATUS_TRANSITIONS: Record<SalesOrderStatus, SalesOrderStatus[]> = {
  draft: ["pending", "cancelled"],
  pending: ["confirmed", "cancelled"],
  confirmed: ["processing", "cancelled"],
  processing: ["fulfilled", "cancelled"],
  fulfilled: [], // Terminal state
  cancelled: [], // Terminal state
};

// =============================================
// Validation Types
// =============================================

export interface SalesOrderValidationError {
  field: string;
  message: string;
}

export interface SalesOrderValidationResult {
  valid: boolean;
  errors: SalesOrderValidationError[];
}

// =============================================
// Statistics and Metrics Types
// =============================================

export interface SalesOrderMetrics {
  total_orders: number;
  total_value: number;
  average_order_value: number;
  orders_by_status: Record<SalesOrderStatus, number>;
  top_customers: Array<{
    customer_id: string;
    customer_name: string;
    order_count: number;
    total_value: number;
  }>;
}

// =============================================
// Utility Types
// =============================================

export type SalesOrderStatusBadgeVariant = "default" | "secondary" | "destructive" | "outline";

export interface SalesOrderSummary {
  id: string;
  order_number: string;
  customer_name: string;
  order_date: string;
  status: SalesOrderStatus;
  total_amount: number;
  items_count: number;
}
