"use server";

// =============================================
// Approve Movement Server Action
// Handles movement approval with authorization
// =============================================

import { createClient } from "@/utils/supabase/server";
import { StockMovementsService } from "@/server/services/stock-movements.service";

export async function approveMovement(movementId: string) {
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
        error: "Authentication required",
      };
    }

    // TODO: Add permission check here
    // Verify user has permission to approve movements
    // For now, we'll allow any authenticated user

    // Approve the movement
    const success = await StockMovementsService.approveMovement(supabase, movementId, user.id);

    if (!success) {
      return {
        success: false,
        error: "Failed to approve movement",
      };
    }

    return {
      success: true,
    };
  } catch (error) {
    console.error("Error in approveMovement action:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unexpected error occurred",
    };
  }
}
