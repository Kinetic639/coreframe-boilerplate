/**
 * Product-Supplier Integration Types
 * Phase 0: Purchase Orders Implementation
 */

// =====================================================
// Core Product Supplier Types
// =====================================================

export interface ProductSupplier {
  id: string;
  product_id: string;
  supplier_id: string;
  supplier_sku: string | null;
  supplier_product_name: string | null;
  supplier_product_description: string | null;
  unit_price: number;
  currency_code: string;
  price_valid_from: string;
  price_valid_until: string | null;
  lead_time_days: number;
  min_order_qty: number;
  order_multiple: number;
  is_preferred: boolean;
  is_active: boolean;
  priority_rank: number;
  notes: string | null;
  last_order_date: string | null;
  last_order_price: number | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  deleted_at: string | null;
}

// =====================================================
// Product Supplier with Relations
// =====================================================

export interface ProductSupplierWithRelations extends ProductSupplier {
  supplier: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    is_active: boolean;
    address: string | null;
    city: string | null;
    country: string | null;
  };
  product: {
    id: string;
    name: string;
    sku: string;
    unit: string;
    description: string | null;
  };
}

// =====================================================
// Form Data Types
// =====================================================

export interface ProductSupplierFormData {
  supplier_id: string;
  supplier_sku?: string;
  supplier_product_name?: string;
  supplier_product_description?: string;
  unit_price: number;
  currency_code?: string;
  price_valid_from?: string;
  price_valid_until?: string;
  lead_time_days?: number;
  min_order_qty?: number;
  order_multiple?: number;
  is_preferred?: boolean;
  is_active?: boolean;
  priority_rank?: number;
  notes?: string;
}

export interface ProductSupplierUpdateData extends Partial<ProductSupplierFormData> {
  id: string;
}

// =====================================================
// Price History Types
// =====================================================

export interface SupplierPriceHistory {
  id: string;
  product_supplier_id: string;
  unit_price: number;
  currency_code: string;
  effective_date: string;
  end_date: string | null;
  change_reason: string | null;
  created_at: string;
  created_by: string | null;
}

export interface PriceHistoryWithDetails extends SupplierPriceHistory {
  supplier_name: string;
  product_name: string;
}

// =====================================================
// Filter and Query Types
// =====================================================

export interface ProductSupplierFilters {
  product_id?: string;
  supplier_id?: string;
  is_active?: boolean;
  is_preferred?: boolean;
  search?: string; // Search by supplier name or SKU
}

export interface SupplierProductsFilters {
  supplier_id: string;
  is_active?: boolean;
  search?: string; // Search by product name or SKU
}

// =====================================================
// Utility Types
// =====================================================

export interface SupplierComparison {
  supplier_id: string;
  supplier_name: string;
  unit_price: number;
  lead_time_days: number;
  min_order_qty: number;
  is_preferred: boolean;
  is_active: boolean;
  total_cost_for_quantity: (quantity: number) => number; // Helper function
}

export interface BestPriceResult {
  supplier: ProductSupplierWithRelations;
  total_cost: number;
  meets_moq: boolean;
  adjusted_quantity: number; // Adjusted for order multiple
}

// =====================================================
// API Response Types
// =====================================================

export interface ProductSuppliersResponse {
  suppliers: ProductSupplierWithRelations[];
  count: number;
  preferred_supplier: ProductSupplierWithRelations | null;
}

export interface SupplierProductsResponse {
  products: ProductSupplierWithRelations[];
  count: number;
}

export interface PriceHistoryResponse {
  history: SupplierPriceHistory[];
  current_price: number;
  price_trend: "increasing" | "decreasing" | "stable";
  avg_price: number;
}

// =====================================================
// Constants
// =====================================================

export const DEFAULT_CURRENCY = "PLN";
export const DEFAULT_LEAD_TIME = 0;
export const DEFAULT_MIN_ORDER_QTY = 1;
export const DEFAULT_ORDER_MULTIPLE = 1;
export const DEFAULT_PRIORITY_RANK = 0;

// =====================================================
// Validation Types
// =====================================================

export interface ProductSupplierValidation {
  isValid: boolean;
  errors: {
    field: keyof ProductSupplierFormData;
    message: string;
  }[];
}
