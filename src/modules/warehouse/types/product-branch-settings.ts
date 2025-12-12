/**
 * Per-Branch Product Settings
 * Allows different inventory thresholds per warehouse
 */

export type ReorderCalculationMethod = "fixed" | "min_max" | "auto";

export interface ProductBranchSettings {
  id: string;
  product_id: string;
  branch_id: string;
  organization_id: string;

  // Inventory thresholds (per-warehouse)
  reorder_point: number | null;
  max_stock_level: number | null;
  min_stock_level: number | null;
  reorder_quantity: number | null;
  reorder_calculation_method: ReorderCalculationMethod | null;

  // Warehouse preferences
  track_inventory: boolean;
  send_low_stock_alerts: boolean;
  lead_time_days: number | null;

  // Optional default location
  preferred_receiving_location_id: string | null;

  // Metadata
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface CreateProductBranchSettingsData {
  product_id: string;
  branch_id: string;
  reorder_point?: number;
  max_stock_level?: number;
  min_stock_level?: number;
  reorder_quantity?: number;
  reorder_calculation_method?: ReorderCalculationMethod;
  track_inventory?: boolean;
  send_low_stock_alerts?: boolean;
  lead_time_days?: number;
  preferred_receiving_location_id?: string;
}

export interface UpdateProductBranchSettingsData {
  reorder_point?: number;
  max_stock_level?: number;
  min_stock_level?: number;
  reorder_quantity?: number;
  reorder_calculation_method?: ReorderCalculationMethod;
  track_inventory?: boolean;
  send_low_stock_alerts?: boolean;
  lead_time_days?: number;
  preferred_receiving_location_id?: string;
}

/**
 * Product with branch-specific settings
 * Used in UI to display product with per-warehouse configuration
 */
export interface ProductWithBranchSettings {
  product_id: string;
  product_name: string;
  product_sku: string | null;
  branch_id: string;
  branch_name: string;
  settings: ProductBranchSettings | null;
}
