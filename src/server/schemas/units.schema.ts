/**
 * Units Schema
 * Input validation for unit of measure operations
 */

import { z } from "zod";

/**
 * Create unit data
 */
export const createUnitSchema = z.object({
  organization_id: z.string().uuid(),
  name: z.string().min(1).max(100),
  symbol: z.string().max(20).optional().nullable(),
});

/**
 * Update unit data
 */
export const updateUnitSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  symbol: z.string().max(20).optional().nullable(),
});

/**
 * Type exports
 */
export type CreateUnitInput = z.infer<typeof createUnitSchema>;
export type UpdateUnitInput = z.infer<typeof updateUnitSchema>;
