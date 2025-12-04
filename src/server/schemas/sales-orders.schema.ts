/**
 * Sales Orders Schemas
 * Zod validation schemas for sales order operations
 */

import { z } from "zod";

// =====================================================
// ENUMS
// =====================================================

export const salesOrderStatusSchema = z.enum([
  "draft",
  "pending",
  "confirmed",
  "processing",
  "fulfilled",
  "cancelled",
]);

export type SalesOrderStatus = z.infer<typeof salesOrderStatusSchema>;

// =====================================================
// SALES ORDER ITEM SCHEMAS
// =====================================================

export const salesOrderItemFormSchema = z.object({
  id: z.string().uuid().optional(),
  product_id: z.string().uuid(),
  product_variant_id: z.string().uuid().optional().nullable(),
  product_name: z.string().min(1, "Product name is required").optional(),
  product_sku: z.string().max(100).optional().nullable(),
  variant_name: z.string().max(255).optional().nullable(),
  quantity_ordered: z.number().positive("Quantity must be greater than 0"),
  unit_of_measure: z.string().max(50).optional().nullable(),
  unit_price: z.number().min(0, "Price cannot be negative"),
  tax_rate: z.number().min(0).max(100).optional().default(0),
  discount_percent: z.number().min(0).max(100).optional().default(0),
  location_id: z.string().uuid().optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

export type SalesOrderItemFormInput = z.infer<typeof salesOrderItemFormSchema>;

// =====================================================
// SALES ORDER CRUD SCHEMAS
// =====================================================

export const createSalesOrderSchema = z.object({
  customer_id: z.string().uuid().optional().nullable(),
  customer_name: z.string().min(1, "Customer name is required"),
  customer_email: z.string().email().optional().nullable(),
  customer_phone: z.string().max(50).optional().nullable(),
  order_date: z.string().date(),
  expected_delivery_date: z.string().date().optional().nullable(),
  delivery_address_line1: z.string().max(255).optional().nullable(),
  delivery_address_line2: z.string().max(255).optional().nullable(),
  delivery_city: z.string().max(100).optional().nullable(),
  delivery_state: z.string().max(100).optional().nullable(),
  delivery_postal_code: z.string().max(20).optional().nullable(),
  delivery_country: z.string().max(2).optional().default("PL"),
  shipping_cost: z.number().min(0).optional().default(0),
  discount_amount: z.number().min(0).optional().default(0),
  currency_code: z.string().max(3).optional().default("PLN"),
  customer_notes: z.string().max(1000).optional().nullable(),
  internal_notes: z.string().max(1000).optional().nullable(),
  items: z.array(salesOrderItemFormSchema).min(1, "At least one item is required"),
});

export type CreateSalesOrderInput = z.infer<typeof createSalesOrderSchema>;

export const updateSalesOrderSchema = z.object({
  customer_name: z.string().min(1).optional(),
  customer_email: z.string().email().optional().nullable(),
  customer_phone: z.string().max(50).optional().nullable(),
  order_date: z.string().date().optional(),
  expected_delivery_date: z.string().date().optional().nullable(),
  delivery_address_line1: z.string().max(255).optional().nullable(),
  delivery_address_line2: z.string().max(255).optional().nullable(),
  delivery_city: z.string().max(100).optional().nullable(),
  delivery_state: z.string().max(100).optional().nullable(),
  delivery_postal_code: z.string().max(20).optional().nullable(),
  delivery_country: z.string().max(2).optional().nullable(),
  shipping_cost: z.number().min(0).optional(),
  discount_amount: z.number().min(0).optional(),
  customer_notes: z.string().max(1000).optional().nullable(),
  internal_notes: z.string().max(1000).optional().nullable(),
  items: z.array(salesOrderItemFormSchema).optional(),
});

export type UpdateSalesOrderInput = z.infer<typeof updateSalesOrderSchema>;

// =====================================================
// STATUS UPDATE SCHEMAS
// =====================================================

export const updateOrderStatusSchema = z.object({
  status: salesOrderStatusSchema,
  cancellation_reason: z.string().max(500).optional(),
});

export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;

// =====================================================
// FILTER SCHEMAS
// =====================================================

export const salesOrderFiltersSchema = z.object({
  status: z.union([salesOrderStatusSchema, z.array(salesOrderStatusSchema)]).optional(),
  customer_id: z.string().uuid().optional(),
  branch_id: z.string().uuid().optional(),
  order_date_from: z.string().date().optional(),
  order_date_to: z.string().date().optional(),
  search: z.string().optional(),
  sort_by: z.enum(["order_date", "customer_name", "order_number", "created_at"]).optional(),
  sort_order: z.enum(["asc", "desc"]).optional(),
  limit: z.number().int().positive().optional(),
  offset: z.number().int().nonnegative().optional(),
});

export type SalesOrderFiltersInput = z.infer<typeof salesOrderFiltersSchema>;

// =====================================================
// RESERVATION INTEGRATION SCHEMAS
// =====================================================

export const releaseReservationForItemSchema = z.object({
  item_id: z.string().uuid(),
  quantity: z.number().positive(),
  notes: z.string().max(500).optional(),
});

export type ReleaseReservationForItemInput = z.infer<typeof releaseReservationForItemSchema>;
