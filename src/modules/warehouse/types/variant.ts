import type { Tables } from "../../../../supabase/types/types";
import type { AttributeValue } from "./flexible-products";

// Use existing database types from Supabase
export type ProductVariant = Tables<"product_variants">;
export type ProductVariantAttribute = Tables<"product_attributes">;

export interface VariantWithAttributes {
  variant: ProductVariant;
  attributes: ProductVariantAttribute[];
  images?: Tables<"product_images">[];
  stock_snapshots?: Tables<"stock_snapshots">[];
  attribute_count?: number;
}

export interface CreateVariantRequest {
  product_id: string;
  name: string;
  slug?: string;
  sku?: string;
  barcode?: string;
  is_default?: boolean;
  status?: "active" | "inactive" | "discontinued";
  attributes?: Record<string, AttributeValue>;
  images?: {
    storage_path: string;
    file_name: string;
    alt_text?: string;
    context_scope?: string;
    is_primary?: boolean;
  }[];
}

export interface UpdateVariantRequest extends Partial<CreateVariantRequest> {
  id: string;
}

export interface CloneVariantRequest {
  source_variant_id: string;
  target_product_id: string;
  new_name: string;
  customizations?: {
    sku?: string;
    barcode?: string;
    is_default?: boolean;
    status?: "active" | "inactive" | "discontinued";
    attributes?: Record<string, AttributeValue>;
    images?: {
      storage_path: string;
      file_name: string;
      alt_text?: string;
      context_scope?: string;
      is_primary?: boolean;
    }[];
  };
}

export interface VariantListResponse {
  variants: VariantWithAttributes[];
  total_count: number;
  default_variant?: ProductVariant;
}

export interface VariantMatrixConfig {
  product_id: string;
  attributes: Array<{
    key: string;
    label: string;
    values: Array<{
      value: any;
      label: string;
    }>;
    context_scope?: string;
  }>;
  naming_pattern: string; // e.g., "{color} - {size}"
  sku_pattern?: string; // e.g., "{base_sku}-{color}-{size}"
  base_variant?: Partial<CreateVariantRequest>;
}

export interface AttributeDefinition {
  slug: string;
  label: Record<string, string>;
  description?: Record<string, string>;
  data_type: "text" | "number" | "boolean" | "date" | "json";
  is_required: boolean;
  is_unique: boolean;
  default_value?: any;
  validation_rules?: Record<string, any>;
  context_scope: string;
  display_order: number;
  is_searchable: boolean;
  is_filterable: boolean;
  input_type: string;
  placeholder?: Record<string, string>;
  help_text?: Record<string, string>;
}
