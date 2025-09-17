import type { Tables } from "../../../../supabase/types/types";

// Core flexible product types
export type ProductTemplate = Tables<"product_templates">;
export type TemplateAttributeDefinition = Tables<"template_attribute_definitions">;
export type FlexibleProduct = Tables<"products">;
export type ProductVariant = Tables<"product_variants">;
export type ProductAttribute = Tables<"product_attributes">;
export type ProductImage = Tables<"product_images">;

// Stock management types
export type MovementType = Tables<"movement_types">;
export type StockMovement = Tables<"stock_movements">;
export type StockReservation = Tables<"stock_reservations">;
export type StockSnapshot = Tables<"stock_snapshots">;
export type TransferRequest = Tables<"transfer_requests">;
export type TransferRequestItem = Tables<"transfer_request_items">;

// Extended types for UI
export type ProductWithDetails = FlexibleProduct & {
  template: ProductTemplate;
  variants: (ProductVariant & {
    attributes: ProductAttribute[];
    images: ProductImage[];
    stock_snapshots: StockSnapshot[];
  })[];
  attributes: ProductAttribute[];
  images: ProductImage[];
};

export type ProductTemplateWithAttributes = ProductTemplate & {
  attribute_definitions: TemplateAttributeDefinition[];
};

export type VariantWithStock = ProductVariant & {
  stock_snapshots: StockSnapshot[];
  attributes: ProductAttribute[];
  images: ProductImage[];
};

// Attribute value types
export type AttributeValue =
  | { type: "text"; value: string }
  | { type: "number"; value: number }
  | { type: "boolean"; value: boolean }
  | { type: "date"; value: string }
  | { type: "json"; value: any };

// Form types for creating/updating
export type CreateProductData = {
  template_id: string;
  name: string;
  slug?: string;
  description?: string;
  status?: "active" | "inactive" | "archived";
  organization_id: string;

  // Default variant data
  variant_name?: string;
  variant_sku?: string;
  variant_barcode?: string;

  // Attributes (key-value pairs for the template)
  attributes?: Record<string, AttributeValue>;

  // Images
  images?: {
    storage_path: string;
    file_name: string;
    alt_text?: string;
    context_scope?: string;
    is_primary?: boolean;
  }[];

  // Initial stock if creating with inventory
  initial_stock?: {
    location_id: string;
    quantity: number;
    unit_cost?: number;
    notes?: string;
  };
};

export type UpdateProductData = Partial<CreateProductData> & {
  id: string;
};

export type CreateVariantData = {
  product_id: string;
  name: string;
  slug?: string;
  sku?: string;
  barcode?: string;
  is_default?: boolean;
  attributes?: Record<string, AttributeValue>;
  images?: {
    storage_path: string;
    file_name: string;
    alt_text?: string;
    context_scope?: string;
    is_primary?: boolean;
  }[];
};

export type CreateMovementData = {
  organization_id: string;
  branch_id: string;
  location_id: string;
  product_id: string;
  variant_id: string;
  movement_type_code: string;
  quantity: number;
  unit_cost?: number;
  currency?: string;
  reference_type?: string;
  reference_id?: string;
  notes?: string;
  batch_number?: string;
  serial_number?: string;
  expiry_date?: string;
};

export type CreateReservationData = {
  organization_id: string;
  branch_id: string;
  location_id: string;
  product_id: string;
  variant_id: string;
  quantity: number;
  reserved_for: string; // 'order', 'transfer', 'production', etc.
  reference_id?: string;
  priority?: number;
  expires_at?: string;
  notes?: string;
};

// Search and filter types
export type ProductSearchFilters = {
  search?: string;
  template_ids?: string[];
  status?: string[];
  context_scope?: string;
  location_id?: string;
  branch_id?: string;
  has_stock?: boolean;
  min_price?: number;
  max_price?: number;
  tags?: string[];
  attributes?: Record<string, any>;
  limit?: number;
  offset?: number;
};

export type StockMovementFilters = {
  product_id?: string;
  variant_id?: string;
  location_id?: string;
  branch_id?: string;
  movement_types?: string[];
  date_from?: string;
  date_to?: string;
  reference_type?: string;
  reference_id?: string;
  limit?: number;
  offset?: number;
};

// Template context types
export type TemplateContext = "warehouse" | "ecommerce" | "b2b" | "pos" | "manufacturing";

// Data validation schemas (for use with Zod)
export type ValidationRule = {
  required?: boolean;
  min?: number;
  max?: number;
  pattern?: string;
  options?: string[];
  custom?: string; // Custom validation function name
};
