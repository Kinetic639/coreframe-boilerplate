/**
 * Purchase Orders Schema
 * Input validation schemas for purchase orders operations
 */

import { z } from "zod";

// =====================================================
// ENUMS
// =====================================================

export const purchaseOrderStatusSchema = z.enum([
  "draft",
  "pending",
  "approved",
  "partially_received",
  "received",
  "cancelled",
  "closed",
]);

export const paymentStatusSchema = z.enum(["unpaid", "partially_paid", "paid"]);

// =====================================================
// PURCHASE ORDER ITEM SCHEMAS
// =====================================================

export const purchaseOrderItemFormSchema = z.object({
  id: z.string().uuid().optional(), // For editing existing items
  product_id: z.string().uuid(),
  product_variant_id: z.string().uuid().optional(),
  product_supplier_id: z.string().uuid().optional(),
  quantity_ordered: z.number().positive("Quantity must be greater than 0"),
  unit_price: z.number().min(0, "Price cannot be negative"),
  tax_rate: z.number().min(0).max(100).optional().default(0),
  discount_percent: z.number().min(0).max(100).optional().default(0),
  expected_location_id: z.string().uuid().optional(),
  notes: z.string().max(500).optional(),
});

export const updatePurchaseOrderItemSchema = z.object({
  quantity_ordered: z.number().positive().optional(),
  unit_price: z.number().min(0).optional(),
  tax_rate: z.number().min(0).max(100).optional(),
  discount_percent: z.number().min(0).max(100).optional(),
  expected_location_id: z.string().uuid().optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

// =====================================================
// PURCHASE ORDER SCHEMAS
// =====================================================

export const createPurchaseOrderSchema = z.object({
  supplier_id: z.string().uuid(),
  po_date: z.string().date().optional(),
  expected_delivery_date: z.string().date().optional().nullable(),
  delivery_location_id: z.string().uuid().optional().nullable(),
  payment_terms: z.string().max(500).optional().nullable(),
  shipping_cost: z.number().min(0).optional().default(0),
  discount_amount: z.number().min(0).optional().default(0),
  notes: z.string().max(1000).optional().nullable(),
  internal_notes: z.string().max(1000).optional().nullable(),
  items: z.array(purchaseOrderItemFormSchema).min(1, "At least one item is required"),
});

export const updatePurchaseOrderSchema = z.object({
  supplier_id: z.string().uuid().optional(),
  po_date: z.string().date().optional(),
  expected_delivery_date: z.string().date().optional().nullable(),
  delivery_location_id: z.string().uuid().optional().nullable(),
  payment_terms: z.string().max(500).optional().nullable(),
  shipping_cost: z.number().min(0).optional(),
  discount_amount: z.number().min(0).optional(),
  notes: z.string().max(1000).optional().nullable(),
  internal_notes: z.string().max(1000).optional().nullable(),
});

export const purchaseOrderFiltersSchema = z.object({
  search: z.string().optional(),
  status: z.array(purchaseOrderStatusSchema).optional(),
  payment_status: z.array(paymentStatusSchema).optional(),
  supplier_id: z.string().uuid().optional(),
  date_from: z.string().date().optional(),
  date_to: z.string().date().optional(),
  expected_delivery_from: z.string().date().optional(),
  expected_delivery_to: z.string().date().optional(),
  branch_id: z.string().uuid().optional(),
  created_by: z.string().uuid().optional(),
  limit: z.number().int().positive().max(100).optional().default(10),
  offset: z.number().int().min(0).optional().default(0),
  sort_by: z.enum(["po_date", "expected_delivery_date", "total_amount", "created_at"]).optional(),
  sort_order: z.enum(["asc", "desc"]).optional(),
});

// =====================================================
// WORKFLOW SCHEMAS
// =====================================================

export const rejectPurchaseOrderSchema = z.object({
  reason: z.string().min(1, "Rejection reason is required").max(1000),
});

export const cancelPurchaseOrderSchema = z.object({
  reason: z.string().min(1, "Cancellation reason is required").max(1000),
});

// =====================================================
// RECEIVING SCHEMAS
// =====================================================

export const receiveItemSchema = z.object({
  purchase_order_item_id: z.string().uuid(),
  quantity_to_receive: z.number().positive("Quantity must be greater than 0"),
  actual_location_id: z.string().uuid().optional(),
  quality_status: z.enum(["good", "damaged", "rejected"]).optional().default("good"),
  notes: z.string().max(500).optional(),
});

export const receivePurchaseOrderSchema = z.object({
  purchase_order_id: z.string().uuid(),
  received_date: z.string().date().optional(),
  items: z.array(receiveItemSchema).min(1, "At least one item is required"),
  create_stock_movement: z.boolean().optional().default(true),
  notes: z.string().max(1000).optional(),
});

// =====================================================
// TYPE EXPORTS
// =====================================================

export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>;
export type UpdatePurchaseOrderInput = z.infer<typeof updatePurchaseOrderSchema>;
export type PurchaseOrderFiltersInput = z.infer<typeof purchaseOrderFiltersSchema>;
export type PurchaseOrderItemFormInput = z.infer<typeof purchaseOrderItemFormSchema>;
export type UpdatePurchaseOrderItemInput = z.infer<typeof updatePurchaseOrderItemSchema>;
export type RejectPurchaseOrderInput = z.infer<typeof rejectPurchaseOrderSchema>;
export type CancelPurchaseOrderInput = z.infer<typeof cancelPurchaseOrderSchema>;
export type ReceiveItemInput = z.infer<typeof receiveItemSchema>;
export type ReceivePurchaseOrderInput = z.infer<typeof receivePurchaseOrderSchema>;
