"use server";

import { StockMovementsService } from "@/server/services/stock-movements.service";
import { getUserContext } from "@/lib/utils/assert-auth";
import {
  stockMovementFiltersSchema,
  createStockMovementSchema,
  updateStockMovementSchema,
  approveMovementSchema,
  completeMovementSchema,
  cancelMovementSchema,
  checkStockAvailabilitySchema,
} from "@/server/schemas/stock-movements.schema";

/**
 * Get paginated movements
 */
export async function getMovements(filters: unknown) {
  try {
    const ctx = await getUserContext();
    const validatedFilters = stockMovementFiltersSchema.parse(filters);

    return await StockMovementsService.getMovements(
      ctx.supabase,
      ctx.organizationId,
      ctx.branchId!,
      validatedFilters
    );
  } catch (error) {
    console.error("getMovements error:", error);
    throw error;
  }
}

/**
 * Get movements with full relations
 */
export async function getMovementsWithRelations(filters: unknown) {
  try {
    const ctx = await getUserContext();
    const validatedFilters = stockMovementFiltersSchema.parse(filters);

    return await StockMovementsService.getMovementsWithRelations(
      ctx.supabase,
      ctx.organizationId,
      ctx.branchId!,
      validatedFilters
    );
  } catch (error) {
    console.error("getMovementsWithRelations error:", error);
    throw error;
  }
}

/**
 * Get a single movement by ID
 */
export async function getMovementById(movementId: string) {
  try {
    const ctx = await getUserContext();
    return await StockMovementsService.getMovementById(ctx.supabase, movementId);
  } catch (error) {
    console.error("getMovementById error:", error);
    throw error;
  }
}

/**
 * Create a new movement
 */
export async function createMovement(input: unknown) {
  try {
    const ctx = await getUserContext();
    const validatedInput = createStockMovementSchema.parse(input);

    return await StockMovementsService.createMovement(
      ctx.supabase,
      ctx.organizationId,
      ctx.branchId!,
      ctx.user.id,
      validatedInput
    );
  } catch (error) {
    console.error("createMovement error:", error);
    throw error;
  }
}

/**
 * Update an existing movement
 */
export async function updateMovement(movementId: string, input: unknown) {
  try {
    const ctx = await getUserContext();
    const validatedInput = updateStockMovementSchema.parse(input);

    return await StockMovementsService.updateMovement(
      ctx.supabase,
      movementId,
      ctx.user.id,
      validatedInput
    );
  } catch (error) {
    console.error("updateMovement error:", error);
    throw error;
  }
}

/**
 * Approve a movement
 */
export async function approveMovement(input: unknown) {
  try {
    const ctx = await getUserContext();
    const validatedInput = approveMovementSchema.parse(input);

    return await StockMovementsService.approveMovement(
      ctx.supabase,
      validatedInput.movement_id,
      ctx.user.id
    );
  } catch (error) {
    console.error("approveMovement error:", error);
    throw error;
  }
}

/**
 * Complete a movement
 */
export async function completeMovement(input: unknown) {
  try {
    const ctx = await getUserContext();
    const validatedInput = completeMovementSchema.parse(input);

    return await StockMovementsService.completeMovement(ctx.supabase, validatedInput.movement_id);
  } catch (error) {
    console.error("completeMovement error:", error);
    throw error;
  }
}

/**
 * Cancel a movement
 */
export async function cancelMovement(input: unknown) {
  try {
    const ctx = await getUserContext();
    const validatedInput = cancelMovementSchema.parse(input);

    return await StockMovementsService.cancelMovement(
      ctx.supabase,
      validatedInput.movement_id,
      validatedInput.reason,
      ctx.user.id
    );
  } catch (error) {
    console.error("cancelMovement error:", error);
    throw error;
  }
}

/**
 * Get pending approvals
 */
export async function getPendingApprovals(limit = 50) {
  try {
    const ctx = await getUserContext();

    return await StockMovementsService.getPendingApprovals(
      ctx.supabase,
      ctx.organizationId,
      ctx.branchId!,
      limit
    );
  } catch (error) {
    console.error("getPendingApprovals error:", error);
    throw error;
  }
}

/**
 * Get movement statistics
 */
export async function getStatistics(startDate?: string, endDate?: string) {
  try {
    const ctx = await getUserContext();

    return await StockMovementsService.getStatistics(
      ctx.supabase,
      ctx.organizationId,
      ctx.branchId!,
      startDate,
      endDate
    );
  } catch (error) {
    console.error("getStatistics error:", error);
    throw error;
  }
}

/**
 * Get inventory levels
 */
export async function getInventoryLevels(locationId?: string, productId?: string) {
  try {
    const ctx = await getUserContext();

    return await StockMovementsService.getInventoryLevels(
      ctx.supabase,
      ctx.organizationId,
      ctx.branchId!,
      locationId,
      productId
    );
  } catch (error) {
    console.error("getInventoryLevels error:", error);
    throw error;
  }
}

/**
 * Check stock availability
 */
export async function checkStockAvailability(input: unknown) {
  try {
    const ctx = await getUserContext();
    const validatedInput = checkStockAvailabilitySchema.parse(input);

    return await StockMovementsService.checkStockAvailability(ctx.supabase, validatedInput);
  } catch (error) {
    console.error("checkStockAvailability error:", error);
    throw error;
  }
}

/**
 * Get stock level for specific product/location
 */
export async function getStockLevel(
  productId: string,
  locationId: string,
  variantId?: string | null
) {
  try {
    const ctx = await getUserContext();

    return await StockMovementsService.getStockLevel(
      ctx.supabase,
      productId,
      locationId,
      variantId
    );
  } catch (error) {
    console.error("getStockLevel error:", error);
    throw error;
  }
}
