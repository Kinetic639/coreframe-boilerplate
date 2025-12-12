/**
 * Units Server Actions
 * Co-located with the warehouse/units route
 */

"use server";

import { getUserContext } from "@/lib/utils/assert-auth";
import { UnitsService } from "@/server/services/units.service";
import { createUnitSchema, updateUnitSchema } from "@/server/schemas/units.schema";

/**
 * Get all units for organization
 */
export async function getUnits() {
  const ctx = await getUserContext();
  return await UnitsService.getUnits(ctx.supabase, ctx.organizationId);
}

/**
 * Get single unit by ID
 */
export async function getUnit(unitId: string) {
  const ctx = await getUserContext();
  return await UnitsService.getUnit(ctx.supabase, unitId);
}

/**
 * Create new unit
 */
export async function createUnit(input: unknown) {
  const ctx = await getUserContext();
  const validated = createUnitSchema.parse(input);
  return await UnitsService.createUnit(ctx.supabase, validated);
}

/**
 * Update unit
 */
export async function updateUnit(unitId: string, input: unknown) {
  const ctx = await getUserContext();
  const validated = updateUnitSchema.parse(input);
  return await UnitsService.updateUnit(ctx.supabase, unitId, validated);
}

/**
 * Delete unit
 */
export async function deleteUnit(unitId: string) {
  const ctx = await getUserContext();
  return await UnitsService.deleteUnit(ctx.supabase, unitId);
}
