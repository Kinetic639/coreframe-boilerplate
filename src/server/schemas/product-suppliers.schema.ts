/**
 * Product-Suppliers Schema
 * Input validation for product-supplier relationship operations
 */

import { z } from "zod";
import { paginationSchema } from "./common";

/**
 * Product-Supplier form data (create/update)
 */
export const productSupplierFormDataSchema = z.object({
  supplier_id: z.string().uuid(),
  supplier_sku: z.string().max(100).optional().nullable(),
  supplier_product_name: z.string().max(255).optional().nullable(),
  supplier_product_description: z.string().optional().nullable(),
  unit_price: z.number().positive(),
  currency_code: z.string().length(3).default("PLN"),
  price_valid_from: z.string().optional().nullable(), // ISO date string
  price_valid_until: z.string().optional().nullable(), // ISO date string
  lead_time_days: z.number().int().nonnegative().default(0),
  min_order_qty: z.number().positive().default(1),
  order_multiple: z.number().positive().default(1),
  is_preferred: z.boolean().default(false),
  is_active: z.boolean().default(true),
  priority_rank: z.number().int().nonnegative().default(0),
  notes: z.string().optional().nullable(),
});

/**
 * Add supplier to product
 */
export const addSupplierSchema = z.object({
  product_id: z.string().uuid(),
  data: productSupplierFormDataSchema,
});

/**
 * Update product-supplier relationship
 */
export const updateSupplierSchema = z.object({
  id: z.string().uuid(),
  data: productSupplierFormDataSchema.partial(),
});

/**
 * Update supplier price
 */
export const updatePriceSchema = z.object({
  id: z.string().uuid(),
  new_price: z.number().positive(),
  reason: z.string().min(1).max(500),
});

/**
 * Set preferred supplier
 */
export const setPreferredSupplierSchema = z.object({
  product_id: z.string().uuid(),
  supplier_id: z.string().uuid(),
});

/**
 * Get best price supplier
 */
export const getBestPriceSupplierSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().positive(),
});

/**
 * Filters for product-suppliers queries
 */
export const productSuppliersFiltersSchema = paginationSchema.extend({
  product_id: z.string().uuid().optional(),
  supplier_id: z.string().uuid().optional(),
  active_only: z.boolean().default(true),
});

/**
 * Type exports
 */
export type ProductSupplierFormData = z.infer<typeof productSupplierFormDataSchema>;
export type AddSupplierInput = z.infer<typeof addSupplierSchema>;
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;
export type UpdatePriceInput = z.infer<typeof updatePriceSchema>;
export type SetPreferredSupplierInput = z.infer<typeof setPreferredSupplierSchema>;
export type GetBestPriceSupplierInput = z.infer<typeof getBestPriceSupplierSchema>;
export type ProductSuppliersFilters = z.infer<typeof productSuppliersFiltersSchema>;
