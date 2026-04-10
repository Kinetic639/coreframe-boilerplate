// ==========================================
// PRODUCT GROUP TYPES
// ==========================================

import type { ProductWithDetails, ProductVariantWithDetails } from "./products";
import type { OptionGroupWithValues, VariantOptionValue } from "./option-groups";

/**
 * Selected attribute configuration for creating a product group
 * Includes the option group and which values from it are selected
 */
export interface SelectedAttribute {
  optionGroup: OptionGroupWithValues; // from option-groups.ts
  selectedValueIds: string[]; // IDs of selected values
}

/**
 * Generated variant data structure
 * Represents a single variant before it's saved to the database
 */
export interface GeneratedVariant {
  // Auto-generated info
  name: string; // e.g., "T-Shirt-Red-Small"
  sku: string; // Will be empty initially, filled by generator or manually

  // Attribute combination that defines this variant
  attributeValues: Array<{
    optionGroupId: string;
    optionGroupName: string;
    optionValueId: string;
    optionValueName: string;
  }>;

  // Editable fields (initialized from parent product or default)
  sellingPrice: number;
  costPrice: number;
  reorderPoint: number;

  // Optional identifiers
  upc?: string;
  ean?: string;
  isbn?: string;

  // Status
  isActive: boolean;
}

/**
 * Form data for creating a product group
 * Contains all information needed to create the parent product and variants
 */
export interface CreateProductGroupFormData {
  // Basic Info (same as regular product)
  name: string;
  description?: string;
  categoryId?: string;
  brand?: string;
  manufacturer?: string;
  unit: string;
  returnableItem: boolean;

  // Measurements (optional)
  dimensionsLength?: number;
  dimensionsWidth?: number;
  dimensionsHeight?: number;
  dimensionsUnit?: string;
  weight?: number;
  weightUnit?: string;

  // Default values for all variants
  sellingPrice: number;
  costPrice: number;
  reorderPoint: number;

  // Sales/Purchase info
  salesAccount?: string;
  salesDescription?: string;
  purchaseAccount?: string;
  purchaseDescription?: string;
  preferredVendorId?: string;

  // Inventory settings
  trackInventory: boolean;
  inventoryAccount?: string;

  // Product Group Specific
  selectedAttributes: SelectedAttribute[]; // 1-3 attributes
  generatedVariants: GeneratedVariant[]; // All combinations

  // Item Type
  sellable: boolean;
  purchasable: boolean;
}

/**
 * Configuration for SKU pattern generation
 * Defines how SKUs should be formatted from product name and attributes
 */
export interface SKUGeneratorConfig {
  // Which attributes to include in SKU
  includeAttributes: Array<{
    attributeName: string;
    include: boolean;
    displayFormat: "first" | "last" | "full"; // First 3, Last 3, or Full text
    letterCase: "upper" | "lower" | "title";
  }>;

  // Separator between parts
  separator: "-" | "_" | " " | "";

  // Include base product name
  includeBaseName: boolean;
  baseNameFormat: "first" | "last" | "full";
  baseNameCase: "upper" | "lower" | "title";
}

/**
 * Complete product group details with all related data
 * Used for displaying product group detail page
 */
export interface ProductGroupDetail {
  product: ProductWithDetails; // Parent product (type = item_group)
  variants: Array<ProductVariantWithDetails>; // All variants with full details
  attributes: Array<{
    optionGroup: OptionGroupWithValues;
    usedValues: VariantOptionValue[]; // Only values used in this group
  }>;
  totalVariants: number;
  activeVariants: number;
  totalStock: number; // Aggregate stock across all variants
}

// ==========================================
// API REQUEST/RESPONSE TYPES
// ==========================================

/**
 * Request payload for creating a product group
 */
export interface CreateProductGroupRequest {
  productData: CreateProductGroupFormData;
  organizationId: string;
  userId: string;
}

/**
 * Response after creating a product group
 */
export interface CreateProductGroupResponse {
  productGroup: ProductGroupDetail;
  message: string;
}

/**
 * Data for updating a variant
 * All fields are optional - only provided fields will be updated
 */
export interface UpdateVariantData {
  name?: string;
  sku?: string;
  sellingPrice?: number;
  costPrice?: number;
  reorderPoint?: number;
  upc?: string;
  ean?: string;
  isbn?: string;
  isActive?: boolean;
}

/**
 * Stock adjustment data for a specific variant
 */
export interface StockAdjustmentData {
  variantId: string;
  quantity: number;
  adjustmentType: "increase" | "decrease";
  reason:
    | "purchase"
    | "sale"
    | "adjustment_positive"
    | "adjustment_negative"
    | "damaged"
    | "found"
    | "transfer";
  notes?: string;
  locationId?: string;
}
