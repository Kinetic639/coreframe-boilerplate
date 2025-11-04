"use server";

// =============================================
// Create Delivery Server Action
// Creates delivery with multiple product lines (movement type 101)
// =============================================

import { stockMovementsService } from "@/modules/warehouse/api/stock-movements-service";
import { movementValidationService } from "@/modules/warehouse/api/movement-validation-service";
import { createClient } from "@/utils/supabase/server";
import type {
  CreateDeliveryData,
  CreateDeliveryResponse,
} from "@/modules/warehouse/types/deliveries";

export async function createDelivery(data: CreateDeliveryData): Promise<CreateDeliveryResponse> {
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

    // Validate that we have at least one item
    if (!data.items || data.items.length === 0) {
      return {
        success: false,
        errors: ["At least one product is required"],
      };
    }

    // Determine if verification is required (default: true)
    const requiresVerification = data.requires_verification !== false;

    // Generate delivery number (WH/OUT/XXXXX format like Odoo)
    const deliveryNumber = await generateDeliveryNumber(data.organization_id, data.branch_id);

    // Generate a unique reference ID (UUID) for this delivery batch
    const deliveryReferenceId = crypto.randomUUID();

    // Create stock movements for each item (all using movement type 101 - GR from PO)
    const movementIds: string[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const item of data.items) {
      const movementData = {
        movement_type_code: "101", // GR from PO - creates PZ document
        organization_id: data.organization_id,
        branch_id: data.branch_id,
        product_id: item.product_id,
        variant_id: item.variant_id || undefined,
        quantity: item.expected_quantity,
        destination_location_id: data.destination_location_id,
        unit_cost: item.unit_cost,
        currency: "PLN",
        reference_type: "purchase_order" as const,
        reference_id: deliveryReferenceId, // Use generated UUID as reference_id
        reference_number: data.source_document || deliveryNumber,
        batch_number: item.batch_number,
        serial_number: item.serial_number,
        expiry_date: item.expiry_date,
        notes: item.notes || data.notes,
        occurred_at: data.scheduled_date || new Date().toISOString(),
        metadata: {
          delivery_number: deliveryNumber,
          delivery_address: data.delivery_address,
          responsible_user_id: data.responsible_user_id,
          supplier_id: data.supplier_id,
          requires_verification: requiresVerification, // Store verification flag
        },
      };

      // Validate movement
      const validation = await movementValidationService.validateMovement(movementData);

      if (!validation.isValid) {
        errors.push(...validation.errors.map((e) => `Product ${item.product_id}: ${e}`));
        continue;
      }

      if (validation.warnings.length > 0) {
        warnings.push(...validation.warnings);
      }

      // Create movement with status "pending" (draft in Odoo terms)
      const result = await stockMovementsService.createMovement(movementData, user.id);

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

    // If no movements were created successfully, return error
    if (movementIds.length === 0) {
      return {
        success: false,
        errors: errors.length > 0 ? errors : ["Failed to create any movements"],
        warnings,
      };
    }

    // Get the first movement ID as the primary delivery ID
    const deliveryId = movementIds[0];

    // ALWAYS approve and complete the movements to generate receipt
    // When user clicks "Przyjmij dostawę" in Step 3, they have already verified (if needed)
    // Flow: pending → approved → completed
    for (const movementId of movementIds) {
      try {
        // First approve the movement (pending → approved)
        await stockMovementsService.approveMovement(movementId, user.id);
        // Then complete it (approved → completed)
        await stockMovementsService.completeMovement(movementId);
      } catch (completeError) {
        console.error(`Failed to complete movement ${movementId}:`, completeError);
        warnings.push(`Movement ${movementId} created but not auto-completed`);
      }
    }

    // Generate receipt document automatically
    try {
      // Generate receipt number
      const { data: receiptNumber, error: receiptNumberError } = await supabase.rpc(
        "generate_receipt_number",
        {
          p_organization_id: data.organization_id,
          p_branch_id: data.branch_id,
        }
      );

      if (receiptNumberError || !receiptNumber) {
        console.error("Failed to generate receipt number:", receiptNumberError);
        warnings.push("Receipt number generation failed");
      } else {
        // Calculate total value
        const totalValue = data.items.reduce(
          (sum, item) => sum + (item.unit_cost || 0) * item.expected_quantity,
          0
        );

        // Create receipt document
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
            pz_document_number: `PZ/${deliveryNumber}`,
          })
          .select()
          .single();

        if (receiptError || !receipt) {
          console.error("Failed to create receipt document:", receiptError);
          warnings.push("Receipt document creation failed");
        } else {
          // Link all movements to the receipt
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

/**
 * Generate unique delivery number in Odoo format: WH/OUT/XXXXX
 */
async function generateDeliveryNumber(organizationId: string, branchId: string): Promise<string> {
  const supabase = await createClient();

  // Count existing deliveries (movements with type 101) to generate sequence number
  const { count } = await supabase
    .from("stock_movements")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("branch_id", branchId)
    .eq("movement_type_code", "101");

  const sequence = (count || 0) + 1;
  return `WH/OUT/${String(sequence).padStart(5, "0")}`;
}
