/**
 * Movement Validation Schema
 * Input validation for movement validation operations
 */

import { z } from "zod";
import { createStockMovementSchema } from "@/server/schemas/stock-movements.schema";

/**
 * Quick validation input (without stock checks)
 */
export const quickValidationInputSchema = createStockMovementSchema;

/**
 * Batch validation input
 */
export const batchValidationInputSchema = z.object({
  movements: z.array(createStockMovementSchema),
});

/**
 * Type exports
 */
export type QuickValidationInput = z.infer<typeof quickValidationInputSchema>;
export type BatchValidationInput = z.infer<typeof batchValidationInputSchema>;
