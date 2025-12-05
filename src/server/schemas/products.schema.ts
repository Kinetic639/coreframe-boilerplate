import { z } from "zod";
import { paginationSchema } from "./common";

// Product types and status
export const productTypeSchema = z.enum(["goods", "service", "item_group"]);
export const productStatusSchema = z.enum(["active", "inactive", "archived"]);

// Create product input validation
export const createProductSchema = z.object({
  product_type: productTypeSchema,
  name: z.string().min(2).max(255),
  sku: z.string().min(1).max(100).nullable(),
  description: z.string().nullable(),
  category_id: z.string().uuid().nullable(),
  brand: z.string().max(100).nullable(),
  manufacturer: z.string().max(100).nullable(),
  unit: z.string().min(1).max(50),
  returnable_item: z.boolean().default(false),

  // Dimensions
  dimensions_length: z.number().positive().nullable(),
  dimensions_width: z.number().positive().nullable(),
  dimensions_height: z.number().positive().nullable(),
  dimensions_unit: z.string().max(20).nullable(),
  weight: z.number().positive().nullable(),
  weight_unit: z.string().max(20).nullable(),

  // Identifiers
  upc: z.string().max(50).nullable(),
  ean: z.string().max(50).nullable(),
  isbn: z.string().max(50).nullable(),
  mpn: z.string().max(100).nullable(),

  // Sales info
  selling_price: z.number().nonnegative(),
  sales_account: z.string().max(100).nullable(),
  sales_description: z.string().nullable(),

  // Purchase info
  cost_price: z.number().nonnegative(),
  purchase_account: z.string().max(100).nullable(),
  purchase_description: z.string().nullable(),
  preferred_vendor_id: z.string().uuid().nullable(),

  // Inventory settings
  track_inventory: z.boolean().default(true),
  inventory_account: z.string().max(100).nullable(),
  reorder_point: z.number().nonnegative().default(0),
  opening_stock: z.number().nonnegative().default(0),
  opening_stock_rate: z.number().nonnegative().nullable(),

  // Replenishment settings
  reorder_quantity: z.number().positive().nullable(),
  max_stock_level: z.number().positive().nullable(),
  reorder_calculation_method: z.enum(["fixed", "min_max", "auto"]).default("fixed"),
  lead_time_days: z.number().int().nonnegative().nullable(),
  send_low_stock_alerts: z.boolean().default(false),

  // Status
  status: productStatusSchema.default("active"),
});

// Update product input validation (all fields optional)
export const updateProductSchema = createProductSchema.partial();

// Product filters
export const productFiltersSchema = paginationSchema.extend({
  search: z.string().optional(),
  product_type: z.array(productTypeSchema).optional(),
  status: z.array(productStatusSchema).optional(),
  category_id: z.array(z.string().uuid()).optional(),
  brand: z.array(z.string()).optional(),
  manufacturer: z.array(z.string()).optional(),
  min_price: z.number().nonnegative().optional(),
  max_price: z.number().nonnegative().optional(),
});

// Barcode schemas
export const createBarcodeSchema = z.object({
  product_id: z.string().uuid().nullable(),
  variant_id: z.string().uuid().nullable(),
  barcode: z.string().min(1).max(100),
  is_primary: z.boolean().default(false),
});

export const updateBarcodeSchema = createBarcodeSchema.partial();

// Export types
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ProductFilters = z.infer<typeof productFiltersSchema>;
export type CreateBarcodeInput = z.infer<typeof createBarcodeSchema>;
export type UpdateBarcodeInput = z.infer<typeof updateBarcodeSchema>;
