// Re-export types from variant-types.ts for backward compatibility
export type {
  Product,
  ProductTemplate,
  Variant,
  ProductWithVariants,
  CreateVariantData,
  UpdateVariantData,
  VariantFilters,
  VariantsResponse,
} from "./variant-types";

// Additional types for API requests
export interface CreateVariantRequest {
  product_id: string;
  name: string;
  sku?: string;
  barcode?: string;
  description?: string;
  attributes: Record<string, string | number>;
}

export interface UpdateVariantRequest {
  id: string;
  name?: string;
  sku?: string;
  barcode?: string;
  description?: string;
  attributes?: Record<string, string | number>;
  status?: "active" | "inactive" | "archived";
}

// Use VariantWithAttributes from variant-service instead
export type { VariantWithAttributes } from "../api/variant-service";

export interface VariantContextData {
  attributes: Record<string, any>;
  images: any[];
  context?: string;
}
