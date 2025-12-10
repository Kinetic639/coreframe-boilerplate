"use server";

import { getUserContext } from "@/lib/utils/assert-auth";
import { StockMovementsService } from "@/server/services/stock-movements.service";
import type { CheckStockAvailabilityInput } from "@/server/schemas/stock-movements.schema";

interface GetInventoryParams {
  organizationId: string;
  branchId: string;
  productId?: string;
  locationId?: string;
}

export async function getInventoryLevels({
  organizationId,
  branchId,
  productId,
  locationId,
}: GetInventoryParams) {
  try {
    const { supabase } = await getUserContext();

    const levels = await StockMovementsService.getInventoryLevels(
      supabase,
      organizationId,
      branchId,
      productId,
      locationId
    );

    return {
      success: true,
      data: levels,
    };
  } catch (error) {
    console.error("Error in getInventoryLevels action:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unexpected error occurred",
      data: [],
    };
  }
}

export async function getStockLevel({
  productId,
  variantId,
  locationId,
}: {
  productId: string;
  variantId?: string | null;
  locationId: string;
}) {
  try {
    const { supabase } = await getUserContext();

    const level = await StockMovementsService.getStockLevel(
      supabase,
      productId,
      locationId,
      variantId
    );

    return {
      success: true,
      level,
    };
  } catch (error) {
    console.error("Error in getStockLevel action:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unexpected error occurred",
      level: null,
    };
  }
}

export async function checkStockAvailability(input: CheckStockAvailabilityInput) {
  try {
    const { supabase } = await getUserContext();
    const result = await StockMovementsService.checkStockAvailability(supabase, input);

    return {
      success: true,
      available: result.available,
      currentStock: result.available_quantity,
      requiredStock: input.quantity,
    };
  } catch (error) {
    console.error("Error in checkStockAvailability action:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unexpected error occurred",
      available: false,
    };
  }
}
