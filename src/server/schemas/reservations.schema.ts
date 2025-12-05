import { z } from "zod";

// ==========================================
// RESERVATION SCHEMAS
// ==========================================

/**
 * Schema for creating a reservation
 */
export const createReservationSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().optional(),
  locationId: z.string().uuid(),
  quantity: z.number().positive(),
  referenceType: z.enum(["sales_order", "transfer", "production", "manual", "other"]),
  referenceId: z.string().uuid().optional(),
  referenceNumber: z.string().max(100).optional(),
  reservedFor: z.string().min(1).max(255),
  salesOrderId: z.string().uuid().optional(),
  salesOrderItemId: z.string().uuid().optional(),
  priority: z.number().int().min(0).max(100).default(0),
  autoRelease: z.boolean().default(true),
  expiresAt: z.string().datetime().optional(),
  notes: z.string().max(1000).optional(),
});

/**
 * Schema for releasing a reservation
 */
export const releaseReservationSchema = z.object({
  reservationId: z.string().uuid(),
  quantity: z.number().positive(),
  notes: z.string().max(1000).optional(),
});

/**
 * Schema for cancelling a reservation
 */
export const cancelReservationSchema = z.object({
  reservationId: z.string().uuid(),
  reason: z.string().min(1).max(500),
});

/**
 * Schema for reservation filters
 */
export const reservationFiltersSchema = z.object({
  status: z
    .union([
      z.enum(["active", "partial", "fulfilled", "cancelled", "expired"]),
      z.array(z.enum(["active", "partial", "fulfilled", "cancelled", "expired"])),
    ])
    .optional(),
  referenceType: z
    .union([
      z.enum(["sales_order", "transfer", "production", "manual", "other"]),
      z.array(z.enum(["sales_order", "transfer", "production", "manual", "other"])),
    ])
    .optional(),
  productId: z.string().uuid().optional(),
  locationId: z.string().uuid().optional(),
  salesOrderId: z.string().uuid().optional(),
  createdBy: z.string().uuid().optional(),
  search: z.string().optional(),
});

/**
 * Schema for validating availability
 */
export const validateAvailabilitySchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().optional(),
  locationId: z.string().uuid(),
  requestedQuantity: z.number().positive(),
});

// ==========================================
// TYPE EXPORTS
// ==========================================

export type CreateReservationInput = z.infer<typeof createReservationSchema>;
export type ReleaseReservationInput = z.infer<typeof releaseReservationSchema>;
export type CancelReservationInput = z.infer<typeof cancelReservationSchema>;
export type ReservationFiltersInput = z.infer<typeof reservationFiltersSchema>;
export type ValidateAvailabilityInput = z.infer<typeof validateAvailabilitySchema>;
