/**
 * Receipts Schemas
 * Zod validation schemas for receipt document operations
 */

import { z } from "zod";

// =====================================================
// ENUMS
// =====================================================

export const receiptStatusSchema = z.enum(["draft", "completed", "cancelled"]);

export type ReceiptStatus = z.infer<typeof receiptStatusSchema>;

export const receiptTypeSchema = z.enum(["full", "partial", "final_partial"]);

export type ReceiptType = z.infer<typeof receiptTypeSchema>;

export const damageReasonSchema = z.enum([
  "damaged_in_transit",
  "wrong_product",
  "expired",
  "quality_issue",
  "packaging_damaged",
  "incomplete_order",
  "other",
]);

export type DamageReason = z.infer<typeof damageReasonSchema>;

// =====================================================
// RECEIPT ITEM SCHEMAS
// =====================================================

export const receiptItemSchema = z.object({
  product_id: z.string().uuid(),
  variant_id: z.string().uuid().optional().nullable(),
  quantity_ordered: z.number().positive(),
  quantity_received: z.number().min(0),
  quantity_damaged: z.number().min(0).default(0),
  unit: z.string().min(1),
  unit_cost: z.number().min(0).optional(),
  destination_location_id: z.string().uuid(),
  batch_number: z.string().max(100).optional(),
  serial_number: z.string().max(100).optional(),
  expiry_date: z.string().date().optional().nullable(),
  damage_reason: damageReasonSchema.optional(),
  damage_notes: z.string().max(500).optional(),
  notes: z.string().max(500).optional(),
});

export type ReceiptItemInput = z.infer<typeof receiptItemSchema>;

// =====================================================
// PROCESS DELIVERY RECEIPT SCHEMA
// =====================================================

export const processDeliveryReceiptSchema = z.object({
  delivery_movement_id: z.string().uuid(),
  receipt_date: z.string().date().optional(),
  receipt_type: receiptTypeSchema,
  received_by: z.string().uuid().optional(),
  quality_check_passed: z.boolean().optional().default(true),
  quality_notes: z.string().max(1000).optional(),
  receiving_notes: z.string().max(1000).optional(),
  items: z.array(receiptItemSchema).min(1, "At least one item is required"),
});

export type ProcessDeliveryReceiptInput = z.infer<typeof processDeliveryReceiptSchema>;

// =====================================================
// CANCEL RECEIPT SCHEMA
// =====================================================

export const cancelReceiptSchema = z.object({
  reason: z.string().min(1, "Cancellation reason is required").max(1000),
});

export type CancelReceiptInput = z.infer<typeof cancelReceiptSchema>;

// =====================================================
// RECEIPT FILTERS SCHEMA
// =====================================================

export const receiptFiltersSchema = z.object({
  status: receiptStatusSchema.optional(),
  receipt_type: receiptTypeSchema.optional(),
  date_from: z.string().date().optional(),
  date_to: z.string().date().optional(),
  received_by: z.string().uuid().optional(),
  search: z.string().optional(),
  has_quality_issues: z.boolean().optional(),
  sort_by: z.enum(["receipt_date", "receipt_number", "created_at"]).optional(),
  sort_order: z.enum(["asc", "desc"]).optional(),
  limit: z.number().int().positive().optional(),
  offset: z.number().int().nonnegative().optional(),
});

export type ReceiptFiltersInput = z.infer<typeof receiptFiltersSchema>;
