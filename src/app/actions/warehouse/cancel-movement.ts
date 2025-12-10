"use server";

// =============================================
// Cancel Movement Server Action
// Handles movement cancellation with reason
// =============================================

import { stockMovementsService } from "@/modules/warehouse/api/stock-movements-service";
import { createClient } from "@/lib/supabase/server";

interface CancelMovementParams {
  movementId: string;
  reason: string;
}

export async function cancelMovement({ movementId, reason }: CancelMovementParams) {
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

    // Validate reason
    if (!reason || reason.trim().length === 0) {
      return {
        success: false,
        error: "Cancellation reason is required",
      };
    }

    // Cancel the movement
    const success = await stockMovementsService.cancelMovement(movementId, reason, user.id);

    if (!success) {
      return {
        success: false,
        error: "Failed to cancel movement",
      };
    }

    return {
      success: true,
    };
  } catch (error) {
    console.error("Error in cancelMovement action:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unexpected error occurred",
    };
  }
}
