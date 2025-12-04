import { z } from "zod";

// ==========================================
// ENUMS
// ==========================================

export const transferStatusSchema = z.enum([
  "draft",
  "pending",
  "approved",
  "in_transit",
  "completed",
  "cancelled",
  "rejected",
]);

export const transferPrioritySchema = z.enum(["normal", "high", "urgent"]);

// ==========================================
// CREATE/UPDATE SCHEMAS
// ==========================================

export const createTransferRequestItemSchema = z.object({
  product_id: z.string().uuid(),
  variant_id: z.string().uuid().optional(),
  quantity: z.number().positive(),
  unit_id: z.string().uuid(),
  from_location_id: z.string().uuid(),
  to_location_id: z.string().uuid(),
});

export const createTransferRequestSchema = z.object({
  organization_id: z.string().uuid(),
  from_branch_id: z.string().uuid(),
  to_branch_id: z.string().uuid(),
  priority: transferPrioritySchema.optional(),
  expected_date: z.string().optional(),
  shipping_method: z.string().max(200).optional(),
  notes: z.string().optional(),
  items: z.array(createTransferRequestItemSchema).min(1),
});

export const approveTransferSchema = z.object({
  expected_date: z.string().optional(),
  notes: z.string().optional(),
});

export const shipTransferSchema = z.object({
  carrier: z.string().max(200).optional(),
  tracking_number: z.string().max(200).optional(),
  shipping_method: z.string().max(200).optional(),
  notes: z.string().optional(),
});

export const receiveTransferItemSchema = z.object({
  item_id: z.string().uuid(),
  received_quantity: z.number().positive(),
  notes: z.string().optional(),
});

export const receiveTransferSchema = z.object({
  items: z.array(receiveTransferItemSchema).min(1),
  notes: z.string().optional(),
});

export const cancelTransferSchema = z.object({
  reason: z.string().min(1),
});

// ==========================================
// FILTER SCHEMAS
// ==========================================

export const transferFiltersSchema = z.object({
  organization_id: z.string().uuid().optional(),
  from_branch_id: z.string().uuid().optional(),
  to_branch_id: z.string().uuid().optional(),
  status: transferStatusSchema.optional(),
  priority: transferPrioritySchema.optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
});

// ==========================================
// TYPE EXPORTS
// ==========================================

export type TransferStatus = z.infer<typeof transferStatusSchema>;
export type TransferPriority = z.infer<typeof transferPrioritySchema>;
export type CreateTransferRequestInput = z.infer<typeof createTransferRequestSchema>;
export type CreateTransferRequestItemInput = z.infer<typeof createTransferRequestItemSchema>;
export type ApproveTransferInput = z.infer<typeof approveTransferSchema>;
export type ShipTransferInput = z.infer<typeof shipTransferSchema>;
export type ReceiveTransferInput = z.infer<typeof receiveTransferSchema>;
export type ReceiveTransferItemInput = z.infer<typeof receiveTransferItemSchema>;
export type CancelTransferInput = z.infer<typeof cancelTransferSchema>;
export type TransferFilters = z.infer<typeof transferFiltersSchema>;
