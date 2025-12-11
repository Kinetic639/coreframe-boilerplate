import { z } from "zod";
import { paginationSchema } from "./common";

// Movement status enum
export const movementStatusSchema = z.enum([
  "draft",
  "pending",
  "approved",
  "completed",
  "cancelled",
  "reversed",
]);

// Reference type enum
export const referenceTypeSchema = z.enum([
  "purchase_order",
  "sales_order",
  "transfer_request",
  "production_order",
  "return_authorization",
  "reservation",
  "manual",
  "ecommerce_order",
]);

// Movement category enum
export const movementCategorySchema = z.enum([
  "receipt",
  "issue",
  "transfer",
  "adjustment",
  "reservation",
  "ecommerce",
]);

// Create stock movement input
export const createStockMovementSchema = z.object({
  movement_type_code: z.string().min(1).max(10),
  product_id: z.string().uuid(),
  variant_id: z.string().uuid().nullable().optional(),

  source_location_id: z.string().uuid().nullable().optional(),
  destination_location_id: z.string().uuid().nullable().optional(),

  quantity: z.number().positive(),
  unit_of_measure: z.string().max(20).nullable().optional(),

  unit_cost: z.number().nonnegative().nullable().optional(),
  total_cost: z.number().nonnegative().nullable().optional(),
  currency: z.string().length(3).default("PLN"),

  reference_type: referenceTypeSchema.nullable().optional(),
  reference_id: z.string().uuid().nullable().optional(),
  reference_number: z.string().max(100).nullable().optional(),

  requires_approval: z.boolean().default(false),

  batch_number: z.string().max(100).nullable().optional(),
  serial_number: z.string().max(100).nullable().optional(),
  lot_number: z.string().max(100).nullable().optional(),
  expiry_date: z.string().datetime().nullable().optional(),
  manufacturing_date: z.string().datetime().nullable().optional(),

  occurred_at: z.string().datetime().optional(),
  notes: z.string().nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
});

// Update stock movement input
export const updateStockMovementSchema = createStockMovementSchema.partial();

// Approve movement input
export const approveMovementSchema = z.object({
  movement_id: z.string().uuid(),
  notes: z.string().nullable().optional(),
});

// Complete movement input
export const completeMovementSchema = z.object({
  movement_id: z.string().uuid(),
  notes: z.string().nullable().optional(),
});

// Cancel movement input
export const cancelMovementSchema = z.object({
  movement_id: z.string().uuid(),
  reason: z.string().min(1),
  notes: z.string().nullable().optional(),
});

// Stock movement filters
export const stockMovementFiltersSchema = paginationSchema.extend({
  search: z.string().optional(),
  movement_type_code: z.array(z.string()).optional(),
  category: z.array(movementCategorySchema).optional(),
  status: z.array(movementStatusSchema).optional(),
  product_id: z.string().uuid().optional(),
  variant_id: z.string().uuid().optional(),
  source_location_id: z.string().uuid().optional(),
  destination_location_id: z.string().uuid().optional(),
  reference_type: referenceTypeSchema.optional(),
  reference_id: z.string().uuid().optional(),
  created_by: z.string().uuid().optional(),
  approved_by: z.string().uuid().optional(),
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
  requires_approval: z.boolean().optional(),
});

// Stock availability check input
export const checkStockAvailabilitySchema = z.object({
  product_id: z.string().uuid(),
  variant_id: z.string().uuid().nullable().optional(),
  location_id: z.string().uuid(),
  quantity: z.number().positive(),
});

// Export types
export type MovementStatus = z.infer<typeof movementStatusSchema>;
export type ReferenceType = z.infer<typeof referenceTypeSchema>;
export type MovementCategory = z.infer<typeof movementCategorySchema>;
export type CreateStockMovementInput = z.infer<typeof createStockMovementSchema>;
export type UpdateStockMovementInput = z.infer<typeof updateStockMovementSchema>;
export type ApproveMovementInput = z.infer<typeof approveMovementSchema>;
export type CompleteMovementInput = z.infer<typeof completeMovementSchema>;
export type CancelMovementInput = z.infer<typeof cancelMovementSchema>;
export type StockMovementFilters = z.infer<typeof stockMovementFiltersSchema>;
export type CheckStockAvailabilityInput = z.infer<typeof checkStockAvailabilitySchema>;
