"use server";

// =============================================
// Create Delivery Server Action
// Creates delivery with multiple product lines (movement type 101)
// =============================================

import { getUserContext } from "@/lib/utils/assert-auth";
import { MovementValidationService } from "@/server/services/movement-validation.service";
import { StockMovementsService } from "@/server/services/stock-movements.service";
import type { CreateStockMovementInput } from "@/server/schemas/stock-movements.schema";
import type {
  CreateDeliveryData,
  CreateDeliveryResponse,
} from "@/modules/warehouse/types/deliveries";

export async function createDelivery(data: CreateDeliveryData): Promise<CreateDeliveryResponse> {
  try {
    const { supabase, user } = await getUserContext();

    if (!data.organization_id || !data.branch_id) {
      return {
        success: false,
        errors: ["Organization and branch are required"],
      };
    }

    // Validate that we have at least one item
    if (!data.items || data.items.length === 0) {
      return {
        success: false,
        errors: ["At least one product is required"],
      };
    }

    const requiresVerification = data.requires_verification !== false;
    const deliveryReferenceId = crypto.randomUUID();

    // Generate receipt number first (will be used as delivery number)
    const { data: receiptNumber, error: receiptNumberError } = await supabase.rpc(
      "generate_receipt_number",
      {
        p_organization_id: data.organization_id,
        p_branch_id: data.branch_id,
      }
    );

    if (receiptNumberError || !receiptNumber) {
      console.error("Failed to generate receipt number:", receiptNumberError);
      return {
        success: false,
        errors: ["Failed to generate receipt number"],
      };
    }

    const deliveryNumber = receiptNumber;
    const movementIds: string[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const item of data.items) {
      const movementInput: CreateStockMovementInput = {
        movement_type_code: "101",
        product_id: item.product_id,
        variant_id: item.variant_id || undefined,
        quantity: item.expected_quantity,
        destination_location_id: data.destination_location_id,
        unit_cost: item.unit_cost,
        currency: "PLN",
        reference_type: "purchase_order",
        reference_id: deliveryReferenceId,
        reference_number: data.source_document || deliveryNumber,
        batch_number: item.batch_number,
        serial_number: item.serial_number,
        expiry_date: item.expiry_date || undefined,
        notes: item.notes || data.notes,
        occurred_at: data.scheduled_date || new Date().toISOString(),
        metadata: {
          delivery_address: data.delivery_address,
          responsible_user_id: data.responsible_user_id,
          supplier_id: data.supplier_id,
          requires_verification: requiresVerification,
          delivery_number: deliveryNumber,
        },
      };

      const validation = await MovementValidationService.validateMovement(supabase, movementInput);

      if (!validation.isValid) {
        errors.push(...validation.errors.map((e) => `Product ${item.product_id}: ${e}`));
        continue;
      }

      if (validation.warnings.length > 0) {
        warnings.push(...validation.warnings);
      }

      const result = await StockMovementsService.createMovement(
        supabase,
        data.organization_id,
        data.branch_id,
        user.id,
        movementInput
      );

      if (!result.success) {
        errors.push(
          ...(result.errors || [`Failed to create movement for product ${item.product_id}`])
        );
        continue;
      }

      if (result.movement_id) {
        movementIds.push(result.movement_id);
      }
    }

    if (movementIds.length === 0) {
      return {
        success: false,
        errors: errors.length > 0 ? errors : ["Failed to create any movements"],
        warnings,
      };
    }

    const deliveryId = movementIds[0];

    for (const movementId of movementIds) {
      try {
        await StockMovementsService.approveMovement(supabase, movementId, user.id);
        await StockMovementsService.completeMovement(supabase, movementId);
      } catch (completeError) {
        console.error(`Failed to complete movement ${movementId}:`, completeError);
        warnings.push(`Movement ${movementId} created but not auto-completed`);
      }
    }

    try {
      const totalValue = data.items.reduce(
        (sum, item) => sum + (item.unit_cost || 0) * item.expected_quantity,
        0
      );

      const { data: receipt, error: receiptError } = await supabase
        .from("receipt_documents")
        .insert({
          receipt_number: receiptNumber,
          organization_id: data.organization_id,
          branch_id: data.branch_id,
          receipt_type: "full",
          receipt_date: new Date().toISOString(),
          created_by: user.id,
          received_by: user.id,
          quality_check_passed: true,
          receiving_notes: data.notes || null,
          status: "completed",
          total_movements: movementIds.length,
          total_value: totalValue,
          completed_at: new Date().toISOString(),
          pz_document_number: receiptNumber,
        })
        .select()
        .single();

      if (receiptError || !receipt) {
        console.error("Failed to create receipt document:", receiptError);
        warnings.push("Receipt document creation failed");
      } else {
        const receiptMovements = movementIds.map((movementId) => ({
          receipt_id: receipt.id,
          movement_id: movementId,
        }));

        const { error: linkError } = await supabase
          .from("receipt_movements")
          .insert(receiptMovements);

        if (linkError) {
          console.error("Failed to link movements to receipt:", linkError);
          warnings.push("Failed to link movements to receipt");
        }
      }
    } catch (receiptGenError) {
      console.error("Error generating receipt:", receiptGenError);
      warnings.push("Receipt generation failed");
    }

    return {
      success: true,
      delivery_id: deliveryId,
      delivery_number: deliveryNumber,
      movement_ids: movementIds,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (error) {
    console.error("Error creating delivery:", error);
    return {
      success: false,
      errors: [error instanceof Error ? error.message : "Unknown error occurred"],
    };
  }
}
