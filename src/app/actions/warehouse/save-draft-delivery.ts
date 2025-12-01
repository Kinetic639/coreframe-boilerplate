"use server";

// =============================================
// Save Draft Delivery Server Action
// Saves delivery progress as draft with wizard state
// =============================================

import { createClient } from "@/lib/supabase/server";
import type {
  CreateDeliveryData,
  CreateDeliveryResponse,
} from "@/modules/warehouse/types/deliveries";

export interface SaveDraftDeliveryData extends CreateDeliveryData {
  delivery_id?: string; // If updating existing draft
  wizard_step?: number; // Current step (1 or 2)
}

export async function saveDraftDelivery(
  data: SaveDraftDeliveryData
): Promise<CreateDeliveryResponse> {
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

    const requiresVerification = data.requires_verification !== false;
    const wizardStep = data.wizard_step || 1;

    // Generate delivery number if creating new draft
    let deliveryNumber = "";
    if (!data.delivery_id) {
      deliveryNumber = await generateDeliveryNumber(data.organization_id, data.branch_id);
    }

    // Generate a unique reference ID for this delivery batch
    const deliveryReferenceId = data.delivery_id || crypto.randomUUID();

    // Store all draft data in metadata for resume
    const metadata = {
      delivery_number: deliveryNumber,
      delivery_address: data.delivery_address,
      responsible_user_id: data.responsible_user_id,
      supplier_id: data.supplier_id,
      requires_verification: requiresVerification,
      wizard_step: wizardStep,
      form_data: {
        destination_location_id: data.destination_location_id,
        scheduled_date: data.scheduled_date,
        source_document: data.source_document,
        notes: data.notes,
      },
    };

    // If updating existing draft, update all movements
    if (data.delivery_id) {
      // Delete existing item movements
      const { error: deleteError } = await supabase
        .from("stock_movements")
        .delete()
        .eq("reference_id", data.delivery_id)
        .eq("movement_type_code", "101");

      if (deleteError) {
        console.error("Error deleting old draft movements:", deleteError);
        return {
          success: false,
          errors: ["Failed to update draft"],
        };
      }
    }

    // Create stock movements for each item (status: draft)
    const movementIds: string[] = [];
    const errors: string[] = [];

    // Skip if no items
    if (!data.items || data.items.length === 0) {
      return {
        success: true,
        delivery_id: deliveryReferenceId,
        delivery_number: deliveryNumber,
        movement_ids: [],
      };
    }

    for (const item of data.items) {
      // Generate unique movement number for this draft item
      // Format: DRAFT-{UUID} (will be replaced with proper number when finalized)
      const draftMovementNumber = `DRAFT-${crypto.randomUUID()}`;

      const { data: movement, error: movementError } = await supabase
        .from("stock_movements")
        .insert({
          movement_number: draftMovementNumber, // Required field
          movement_type_code: "101",
          category: "receipt", // Required field for movement type 101
          organization_id: data.organization_id,
          branch_id: data.branch_id,
          product_id: item.product_id,
          variant_id: item.variant_id || null,
          quantity: item.expected_quantity,
          destination_location_id: data.destination_location_id || null,
          unit_cost: item.unit_cost,
          currency: "PLN",
          reference_type: "purchase_order",
          reference_id: deliveryReferenceId,
          reference_number: data.source_document || deliveryNumber,
          batch_number: item.batch_number,
          serial_number: item.serial_number,
          expiry_date: item.expiry_date,
          notes: item.notes || data.notes,
          occurred_at: data.scheduled_date || new Date().toISOString(),
          created_by: user.id,
          status: "draft", // Save as draft
          metadata,
        })
        .select("id")
        .single();

      if (movementError || !movement) {
        console.error("Error creating draft movement:", movementError);
        errors.push(
          `Failed to save item for product ${item.product_id}: ${movementError?.message || "Unknown error"}`
        );
        continue;
      }

      movementIds.push(movement.id);
    }

    if (movementIds.length === 0) {
      return {
        success: false,
        errors: errors.length > 0 ? errors : ["Failed to save any items"],
      };
    }

    // Get the first movement ID as the primary delivery ID
    const deliveryId = data.delivery_id || movementIds[0];

    return {
      success: true,
      delivery_id: deliveryId,
      delivery_number: deliveryNumber || data.source_document || "",
      movement_ids: movementIds,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    console.error("Error saving draft delivery:", error);
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
