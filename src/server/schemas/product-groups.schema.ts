import { z } from "zod";

// ==========================================
// PRODUCT GROUP SCHEMAS
// ==========================================

/**
 * Schema for generated variant
 */
export const generatedVariantSchema = z.object({
  name: z.string().min(1).max(255),
  sku: z.string().max(100),
  attributeValues: z.array(
    z.object({
      optionGroupId: z.string().uuid(),
      optionGroupName: z.string(),
      optionValueId: z.string().uuid(),
      optionValueName: z.string(),
    })
  ),
  sellingPrice: z.number().nonnegative(),
  costPrice: z.number().nonnegative(),
  reorderPoint: z.number().int().nonnegative(),
  upc: z.string().max(50).optional(),
  ean: z.string().max(50).optional(),
  isbn: z.string().max(50).optional(),
  isActive: z.boolean(),
});

/**
 * Schema for selected attribute with option group
 */
export const selectedAttributeSchema = z.object({
  optionGroup: z.object({
    id: z.string(), // Can be UUID or "new-xxx" for new groups
    name: z.string().min(1).max(100),
    values: z.array(
      z.object({
        id: z.string(), // Can be UUID or temporary ID
        value: z.string().min(1).max(100),
        display_order: z.number().int().nonnegative().optional(),
      })
    ),
  }),
  selectedValueIds: z.array(z.string()),
});

/**
 * Schema for creating a product group
 */
export const createProductGroupSchema = z.object({
  // Basic Info
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  categoryId: z.string().uuid().optional(),
  brand: z.string().max(100).optional(),
  manufacturer: z.string().max(100).optional(),
  unit: z.string().min(1).max(50),
  returnableItem: z.boolean(),

  // Measurements
  dimensionsLength: z.number().positive().optional(),
  dimensionsWidth: z.number().positive().optional(),
  dimensionsHeight: z.number().positive().optional(),
  dimensionsUnit: z.string().max(20).optional(),
  weight: z.number().positive().optional(),
  weightUnit: z.string().max(20).optional(),

  // Default values
  sellingPrice: z.number().nonnegative(),
  costPrice: z.number().nonnegative(),
  reorderPoint: z.number().int().nonnegative(),

  // Sales/Purchase
  salesAccount: z.string().max(100).optional(),
  salesDescription: z.string().max(1000).optional(),
  purchaseAccount: z.string().max(100).optional(),
  purchaseDescription: z.string().max(1000).optional(),
  preferredVendorId: z.string().uuid().optional(),

  // Inventory
  trackInventory: z.boolean(),
  inventoryAccount: z.string().max(100).optional(),

  // Product Group Specific
  selectedAttributes: z.array(selectedAttributeSchema).min(1).max(3),
  generatedVariants: z.array(generatedVariantSchema).min(1),

  // Item Type
  sellable: z.boolean().optional(),
  purchasable: z.boolean().optional(),
});

/**
 * Schema for updating a variant
 */
export const updateVariantSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  sku: z.string().max(100).optional(),
  sellingPrice: z.number().nonnegative().optional(),
  costPrice: z.number().nonnegative().optional(),
  reorderPoint: z.number().int().nonnegative().optional(),
  upc: z.string().max(50).optional(),
  ean: z.string().max(50).optional(),
  isbn: z.string().max(50).optional(),
  isActive: z.boolean().optional(),
});

/**
 * Schema for bulk variant updates
 */
export const bulkUpdateVariantsSchema = z.object({
  variantIds: z.array(z.string().uuid()).min(1),
  updates: updateVariantSchema,
});

/**
 * Schema for stock adjustment
 */
export const stockAdjustmentSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().positive(),
  adjustmentType: z.enum(["increase", "decrease"]),
  reason: z.enum([
    "purchase",
    "sale",
    "adjustment_positive",
    "adjustment_negative",
    "damaged",
    "found",
    "transfer",
  ]),
  notes: z.string().max(1000).optional(),
  locationId: z.string().uuid().optional(),
});

// ==========================================
// TYPE EXPORTS
// ==========================================

export type CreateProductGroupInput = z.infer<typeof createProductGroupSchema>;
export type UpdateVariantInput = z.infer<typeof updateVariantSchema>;
export type BulkUpdateVariantsInput = z.infer<typeof bulkUpdateVariantsSchema>;
export type StockAdjustmentInput = z.infer<typeof stockAdjustmentSchema>;
export type GeneratedVariantInput = z.infer<typeof generatedVariantSchema>;
export type SelectedAttributeInput = z.infer<typeof selectedAttributeSchema>;
