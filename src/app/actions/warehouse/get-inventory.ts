"use server";

// =============================================
// Get Inventory Server Action
// Fetches inventory levels and statistics
// =============================================

import { stockMovementsService } from "@/modules/warehouse/api/stock-movements-service";
import { createClient } from "@/lib/supabase/server";

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
    // Get current user for context
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        success: false,
        error: "Authentication required",
        data: [],
      };
    }

    // Fetch inventory levels
    const levels = await stockMovementsService.getInventoryLevels(
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
  organizationId,
  branchId,
}: {
  productId: string;
  variantId?: string;
  locationId?: string;
  organizationId: string;
  branchId: string;
}) {
  try {
    // Get current user for context
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        success: false,
        error: "Authentication required",
        level: 0,
      };
    }

    // Fetch stock level
    const level = await stockMovementsService.getStockLevel(
      productId,
      variantId,
      locationId,
      organizationId,
      branchId
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
      level: 0,
    };
  }
}

export async function checkStockAvailability({
  productId,
  locationId,
  quantity,
  variantId,
}: {
  productId: string;
  locationId: string;
  quantity: number;
  variantId?: string;
}) {
  try {
    // Get current user for context
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        success: false,
        error: "Authentication required",
        available: false,
        currentStock: 0,
        requiredStock: quantity,
      };
    }

    // Check availability
    const result = await stockMovementsService.checkStockAvailability(
      productId,
      locationId,
      quantity,
      variantId
    );

    return {
      success: true,
      available: result,
      currentStock: result ? quantity : 0,
      requiredStock: quantity,
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
