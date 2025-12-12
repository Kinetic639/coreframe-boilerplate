/**
 * Movement Validation Server Actions
 * Co-located with the warehouse/movements/validation route
 */

"use server";

import { getUserContext } from "@/lib/utils/assert-auth";
import { MovementValidationService } from "@/server/services/movement-validation.service";
import { createStockMovementSchema } from "@/server/schemas/stock-movements.schema";
import { z } from "zod";

/**
 * Validate single movement
 */
export async function validateMovement(input: unknown) {
  const ctx = await getUserContext();
  const validated = createStockMovementSchema.parse(input);
  return await MovementValidationService.validateMovement(ctx.supabase, validated);
}

/**
 * Validate batch of movements
 */
export async function validateBatch(input: unknown) {
  const ctx = await getUserContext();
  const schema = z.object({ movements: z.array(createStockMovementSchema) });
  const validated = schema.parse(input);
  return await MovementValidationService.validateBatch(ctx.supabase, validated.movements);
}

/**
 * Quick validate (without stock checks)
 */
export async function quickValidate(input: unknown) {
  const ctx = await getUserContext();
  const validated = createStockMovementSchema.parse(input);
  return await MovementValidationService.quickValidate(ctx.supabase, validated);
}
