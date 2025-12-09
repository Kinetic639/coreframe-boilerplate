"use server";

// =============================================
// Get Movements Server Action
// Fetches movements with filters and pagination
// =============================================

import { createClient } from "@/utils/supabase/server";
import type { StockMovementFilters } from "@/modules/warehouse/types/stock-movements";

interface GetMovementsParams {
  filters?: StockMovementFilters;
  page?: number;
  pageSize?: number;
}

export async function getMovements({
  filters = {},
  page = 1,
  pageSize = 20,
}: GetMovementsParams = {}) {
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
        total: 0,
        page: 1,
        page_size: pageSize,
        total_pages: 0,
      };
    }

    // Fetch movements
    const result = await stockMovementsService.getMovementsWithRelations(filters, page, pageSize);

    return {
      success: true,
      ...result,
    };
  } catch (error) {
    console.error("Error in getMovements action:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unexpected error occurred",
      data: [],
      total: 0,
      page: 1,
      page_size: pageSize,
      total_pages: 0,
    };
  }
}

export async function getMovementById(movementId: string) {
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
        data: null,
      };
    }

    // Fetch movement
    const movement = await stockMovementsService.getMovementById(movementId);

    if (!movement) {
      return {
        success: false,
        error: "Movement not found",
        data: null,
      };
    }

    return {
      success: true,
      data: movement,
    };
  } catch (error) {
    console.error("Error in getMovementById action:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unexpected error occurred",
      data: null,
    };
  }
}
