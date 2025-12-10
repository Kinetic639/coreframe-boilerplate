"use server";

// =============================================
// Create Movement Server Action
// Handles server-side movement creation with validation
// =============================================

import { stockMovementsService } from "@/modules/warehouse/api/stock-movements-service";
import { movementValidationService } from "@/modules/warehouse/api/movement-validation-service";
import { createClient } from "@/lib/supabase/server";
import type { CreateStockMovementData } from "@/modules/warehouse/types/stock-movements";

export async function createMovement(data: CreateStockMovementData) {
  try {
    // Get current user
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        success: false,
        errors: ["Authentication required"],
        warnings: [],
      };
    }

    // Validate movement data
    const validation = await movementValidationService.validateMovement(data);

    if (!validation.isValid) {
      return {
        success: false,
        errors: validation.errors,
        warnings: validation.warnings,
      };
    }

    // Create movement
    const result = await stockMovementsService.createMovement(data, user.id);

    if (!result.success) {
      return {
        success: false,
        errors: result.errors || ["Failed to create movement"],
        warnings: validation.warnings,
      };
    }

    return {
      success: true,
      id: result.movement_id,
      movement_number: result.movement_number,
      errors: [],
      warnings: validation.warnings,
    };
  } catch (error) {
    console.error("Error in createMovement action:", error);
    return {
      success: false,
      errors: ["An unexpected error occurred"],
      warnings: [],
    };
  }
}
