// =============================================
// Simplified Products System Types
// Based on InFlow/Zoho inventory management
// =============================================

export type ProductType = "goods" | "service" | "item_group";
export type ProductStatus = "active" | "inactive" | "archived";

// ==========================================
// MAIN PRODUCT TYPES
// ==========================================

export interface Product {
  id: string;
  organization_id: string;

  // Product Type
  product_type: ProductType;

  // Basic Info
  name: string;
  sku: string | null; // Required for goods/service, NULL for item_group
  description: string | null;

  // Classification
  category_id: string | null;
  brand: string | null;
  manufacturer: string | null;

  // Unit of Measure
  unit: string;

  // Item Properties
  returnable_item: boolean;

  // Measurements (optional)
  dimensions_length: number | null;
  dimensions_width: number | null;
  dimensions_height: number | null;
  dimensions_unit: string | null;
  weight: number | null;
  weight_unit: string | null;

  // Identifiers
  upc: string | null;
  ean: string | null;
  isbn: string | null;
  mpn: string | null;

  // Sales Information
  selling_price: number;
  sales_account: string | null;
  sales_description: string | null;

  // Purchase Information
  cost_price: number;
  purchase_account: string | null;
  purchase_description: string | null;
  preferred_business_account_id: string | null;

  // Inventory Settings
  track_inventory: boolean;
  inventory_account: string | null;
  reorder_point: number;
  opening_stock: number;
  opening_stock_rate: number | null;

  // Phase 2: Replenishment & Optimal Ordering Settings
  reorder_quantity: number | null;
  max_stock_level: number | null;
  reorder_calculation_method: "fixed" | "min_max" | "auto";
  lead_time_days: number | null;
  send_low_stock_alerts: boolean;

  // Status
  status: ProductStatus;

  // Timestamps
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ProductBarcode {
  id: string;
  product_id: string | null;
  variant_id: string | null;
  barcode: string;
  is_primary: boolean;
  created_at: string;
}

export interface ProductCustomFieldDefinition {
  id: string;
  organization_id: string;
  field_name: string;
  field_type: "text" | "number" | "date" | "dropdown" | "checkbox";
  dropdown_options: string[] | null;
  display_order: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ProductCustomFieldValue {
  id: string;
  product_id: string | null;
  variant_id: string | null;
  field_definition_id: string;
  value_text: string | null;
  value_number: number | null;
  value_date: string | null;
  value_boolean: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  name: string;
  sku: string;
  selling_price: number | null;
  cost_price: number | null;
  reorder_point: number | null;
  upc: string | null;
  ean: string | null;
  isbn: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface VariantOptionGroup {
  id: string;
  organization_id: string;
  name: string;
  display_order: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface VariantOptionValue {
  id: string;
  option_group_id: string;
  value: string;
  display_order: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ProductGroupAttribute {
  id: string;
  product_id: string;
  option_group_id: string;
  display_order: number;
  created_at: string;
}

export interface VariantAttributeValue {
  id: string;
  variant_id: string;
  option_group_id: string;
  option_value_id: string;
  created_at: string;
}

export interface ProductCategory {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ProductImage {
  id: string;
  product_id: string | null;
  variant_id: string | null;
  storage_path: string;
  file_name: string;
  alt_text: string | null;
  display_order: number;
  is_primary: boolean;
  created_at: string;
}

// ==========================================
// EXTENDED TYPES (WITH RELATIONS)
// ==========================================

export interface ProductWithDetails extends Product {
  barcodes?: ProductBarcode[];
  custom_field_values?: ProductCustomFieldValue[];
  category?: ProductCategory | null;
  variants?: ProductVariant[];
  images?: ProductImage[];
}

export interface ProductVariantWithDetails extends ProductVariant {
  barcodes?: ProductBarcode[];
  custom_field_values?: ProductCustomFieldValue[];
  attribute_values?: VariantAttributeValue[];
  images?: ProductImage[];
}

export interface VariantOptionGroupWithValues extends VariantOptionGroup {
  values: VariantOptionValue[];
}

// ==========================================
// FORM DATA TYPES
// ==========================================

export interface CreateProductFormData {
  // Product Type Selection
  product_type: ProductType;

  // Basic Info
  name: string;
  sku?: string;
  description?: string;

  // Classification
  category_id?: string;
  brand?: string;
  manufacturer?: string;

  // Unit of Measure
  unit: string;

  // Item Properties
  returnable_item: boolean;

  // Measurements (optional)
  dimensions_length?: number;
  dimensions_width?: number;
  dimensions_height?: number;
  dimensions_unit?: string;
  weight?: number;
  weight_unit?: string;

  // Identifiers
  upc?: string;
  ean?: string;
  isbn?: string;
  mpn?: string;

  // Sales Information
  selling_price: number;
  sales_account?: string;
  sales_description?: string;

  // Purchase Information
  cost_price: number;
  purchase_account?: string;
  purchase_description?: string;
  preferred_business_account_id?: string;

  // Inventory Settings
  track_inventory: boolean;
  inventory_account?: string;
  reorder_point: number;
  opening_stock: number;
  opening_stock_rate?: number;

  // Barcodes
  barcodes?: Array<{
    barcode: string;
    is_primary: boolean;
  }>;

  // Custom Fields
  custom_fields?: Record<
    string,
    {
      field_definition_id: string;
      value: string | number | boolean | null;
    }
  >;
}

export interface UpdateProductFormData extends Partial<CreateProductFormData> {
  id: string;
}

export interface CreateProductBarcodeData {
  product_id?: string;
  variant_id?: string;
  barcode: string;
  is_primary: boolean;
}

export interface CreateCustomFieldDefinitionData {
  organization_id: string;
  field_name: string;
  field_type: "text" | "number" | "date" | "dropdown" | "checkbox";
  dropdown_options?: string[];
  display_order?: number;
}

export interface CreateCustomFieldValueData {
  product_id?: string;
  variant_id?: string;
  field_definition_id: string;
  value: string | number | boolean | null;
}

// ==========================================
// FILTER & SEARCH TYPES
// ==========================================

export interface ProductFilters {
  search?: string;
  product_type?: ProductType[];
  category_id?: string[];
  status?: ProductStatus[];
  brand?: string[];
  manufacturer?: string[];
  has_stock?: boolean;
  min_price?: number;
  max_price?: number;
  preferred_business_account_id?: string[];
  limit?: number;
  offset?: number;
}

// ==========================================
// ITEM GROUP SPECIFIC TYPES
// ==========================================

export interface CreateItemGroupFormData {
  // Basic Info
  name: string;
  description?: string;

  // Classification
  category_id?: string;
  brand?: string;
  manufacturer?: string;

  // Unit of Measure
  unit: string;

  // Item Properties
  returnable_item: boolean;

  // Default values for variants
  selling_price: number;
  cost_price: number;
  reorder_point: number;

  // Variant Options (which option groups to use)
  variant_option_group_ids: string[];

  // Inventory Settings
  track_inventory: boolean;
  inventory_account?: string;
}

export interface VariantGenerationConfig {
  // Which option groups and values to use
  option_configurations: Array<{
    option_group_id: string;
    option_group_name: string;
    selected_value_ids: string[];
  }>;

  // Default values for all variants
  default_selling_price?: number;
  default_cost_price?: number;
  default_reorder_point?: number;
}

export interface GeneratedVariantRow {
  // Generated info
  name: string; // e.g., "Red - Large"
  sku: string; // Will be generated or manually entered

  // Attribute values that define this variant
  attribute_values: Array<{
    option_group_id: string;
    option_value_id: string;
    option_group_name: string;
    option_value_name: string;
  }>;

  // Editable fields
  selling_price: number;
  cost_price: number;
  reorder_point: number;
  upc?: string;
  ean?: string;
  isbn?: string;
  is_active: boolean;
}

// ==========================================
// API RESPONSE TYPES
// ==========================================

export interface ProductListResponse {
  products: ProductWithDetails[];
  total_count: number;
  page: number;
  page_size: number;
}

export interface CreateProductResponse {
  product: ProductWithDetails;
  message: string;
}

export interface UpdateProductResponse {
  product: ProductWithDetails;
  message: string;
}

export interface DeleteProductResponse {
  success: boolean;
  message: string;
}
