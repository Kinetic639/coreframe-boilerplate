import type { Tables } from "../../../../supabase/types/types";

// Simplified variant types - no complex EAV system
export type Product = Tables<"products">;
export type ProductTemplate = Tables<"product_templates">;

// Simplified variant type
export type Variant = {
  id: string;
  product_id: string;
  name: string;
  slug: string;
  sku?: string;
  barcode?: string;
  is_default: boolean;
  status: "active" | "inactive" | "archived";
  // Simple attributes - just key-value pairs
  attributes: Record<string, string | number>;
  // Stock info - simplified
  stock_quantity?: number;
  created_at: string;
  updated_at: string;
};

// Product with its variants
export type ProductWithVariants = Product & {
  template: ProductTemplate;
  variants: Variant[];
};

// Form data types
export type CreateVariantData = {
  name: string;
  sku?: string;
  barcode?: string;
  attributes: Record<string, string | number>;
};

export type UpdateVariantData = Partial<CreateVariantData> & {
  id: string;
};

// Simple filters
export type VariantFilters = {
  search?: string;
  status?: string[];
  hasStock?: boolean;
};

// API response types
export type VariantsResponse = {
  variants: Variant[];
  total: number;
};
