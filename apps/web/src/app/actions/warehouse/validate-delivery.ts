"use server";

// =============================================
// Validate Delivery Server Action
// Marks delivery as validated/done (completes all movements)
// =============================================

import { stockMovementsService } from "@/modules/warehouse/api/stock-movements-service";
import { createClient } from "@/utils/supabase/server";

export async function validateDelivery(deliveryId: string) {
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
      };
    }

    // Get the delivery's primary movement to find delivery_number
    const { data: primaryMovement, error: primaryError } = await supabase
      .from("stock_movements")
      .select("id, metadata, organization_id, branch_id")
      .eq("id", deliveryId)
      .eq("movement_type_code", "101")
      .single();

    if (primaryError || !primaryMovement) {
      return {
        success: false,
        errors: ["Delivery not found"],
      };
    }

    const deliveryNumber = (primaryMovement.metadata as any)?.delivery_number;

    // Get all movements for this delivery
    let query = supabase
      .from("stock_movements")
      .select("id, status")
      .eq("organization_id", primaryMovement.organization_id)
      .eq("branch_id", primaryMovement.branch_id)
      .eq("movement_type_code", "101");

    if (deliveryNumber) {
      query = query.contains("metadata", { delivery_number: deliveryNumber });
    } else {
      query = query.eq("id", deliveryId);
    }

    const { data: movements, error: movementsError } = await query;

    if (movementsError || !movements || movements.length === 0) {
      return {
        success: false,
        errors: ["No movements found for this delivery"],
      };
    }

    // Approve and complete all movements
    const errors: string[] = [];
    let successCount = 0;

    for (const movement of movements) {
      // Skip if already completed
      if (movement.status === "completed") {
        successCount++;
        continue;
      }

      // First approve if pending
      if (movement.status === "pending") {
        const approveResult = await stockMovementsService.approveMovement(movement.id, user.id);

        if (!approveResult) {
          errors.push(`Failed to approve movement ${movement.id}`);
          continue;
        }
      }

      // Then complete the movement (this updates stock levels)
      const { error: updateError } = await supabase
        .from("stock_movements")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", movement.id);

      if (updateError) {
        errors.push(`Failed to complete movement ${movement.id}: ${updateError.message}`);
        continue;
      }

      successCount++;
    }

    if (successCount === 0) {
      return {
        success: false,
        errors: errors.length > 0 ? errors : ["Failed to validate delivery"],
      };
    }

    return {
      success: true,
      validated_count: successCount,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    console.error("Error validating delivery:", error);
    return {
      success: false,
      errors: [error instanceof Error ? error.message : "Unknown error occurred"],
    };
  }
}
