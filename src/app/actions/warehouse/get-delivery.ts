"use server";

// =============================================
// Get Delivery Server Action
// Fetches single delivery with all details
// =============================================

import { createClient } from "@/utils/supabase/server";
import type { DeliveryWithRelations, DeliveryStatus } from "@/modules/warehouse/types/deliveries";

export async function getDelivery(deliveryId: string): Promise<DeliveryWithRelations | null> {
  try {
    const supabase = await createClient();

    // Get the primary movement
    const { data: primaryMovement, error: primaryError } = await supabase
      .from("stock_movements")
      .select(
        `
        id,
        movement_number,
        organization_id,
        branch_id,
        destination_location_id,
        occurred_at,
        reference_number,
        reference_id,
        status,
        created_at,
        completed_at,
        cancelled_at,
        created_by,
        notes,
        metadata,
        destination_location:locations!stock_movements_destination_location_id_fkey(
          id,
          name,
          code
        ),
        created_by_user:users!stock_movements_created_by_fkey(
          id,
          email
        )
      `
      )
      .eq("id", deliveryId)
      .eq("movement_type_code", "101")
      .single();

    if (primaryError || !primaryMovement) {
      console.error("Error fetching primary movement:", primaryError);
      return null;
    }

    // Debug logging
    console.log("=== GET DELIVERY SERVER ACTION DEBUG ===");
    console.log("primaryMovement.occurred_at:", primaryMovement.occurred_at);
    console.log("primaryMovement.reference_number:", primaryMovement.reference_number);
    console.log("primaryMovement.metadata:", primaryMovement.metadata);
    console.log(
      "primaryMovement.destination_location_id:",
      primaryMovement.destination_location_id
    );
    console.log("========================================");

    const deliveryNumber =
      (primaryMovement.metadata as any)?.delivery_number || primaryMovement.movement_number;

    // Get all related movements (all movements with the same reference_id)
    // Using reference_id as the grouping mechanism instead of delivery_number in metadata
    const referenceId = primaryMovement.reference_id || primaryMovement.id;

    const { data: relatedMovements, error: relatedError } = await supabase
      .from("stock_movements")
      .select(
        `
        id,
        product_id,
        variant_id,
        quantity,
        unit_cost,
        total_cost,
        status,
        notes,
        batch_number,
        serial_number,
        expiry_date,
        products!stock_movements_product_id_fkey(
          id,
          name,
          sku
        ),
        product_variants!stock_movements_variant_id_fkey(
          id,
          name,
          sku
        )
      `
      )
      .eq("organization_id", primaryMovement.organization_id)
      .eq("branch_id", primaryMovement.branch_id)
      .eq("movement_type_code", "101")
      .eq("reference_id", referenceId);

    if (relatedError) {
      console.error("Error fetching related movements:", relatedError);
    }

    const movements = relatedMovements || [];

    // Fetch responsible user if available in metadata
    // Query from public.users table (application-level users, not auth.users)
    const responsibleUserId = (primaryMovement.metadata as any)?.responsible_user_id;
    let responsibleUser = null;

    if (responsibleUserId) {
      const { data: userData, error: userError } = await supabase
        .from("users") // This queries public.users by default
        .select("id, email, first_name, last_name, avatar_url")
        .eq("id", responsibleUserId)
        .single();

      if (!userError && userData) {
        responsibleUser = userData;
      }
    }

    // Build delivery object
    const delivery: DeliveryWithRelations = {
      id: primaryMovement.id,
      delivery_number: deliveryNumber,
      organization_id: primaryMovement.organization_id,
      branch_id: primaryMovement.branch_id,
      status: mapMovementStatusToDeliveryStatus(primaryMovement.status),
      scheduled_date: primaryMovement.occurred_at,
      source_document: primaryMovement.reference_number || undefined,
      delivery_address: (primaryMovement.metadata as any)?.delivery_address,
      operation_type: "Delivery Orders",
      destination_location_id: primaryMovement.destination_location_id,
      items: movements.map((m) => ({
        id: m.id,
        product_id: m.product_id,
        variant_id: m.variant_id,
        expected_quantity: m.quantity,
        received_quantity: m.status === "completed" ? m.quantity : 0,
        unit_cost: m.unit_cost || undefined,
        total_cost: m.total_cost || undefined,
        notes: m.notes || undefined,
        batch_number: m.batch_number || undefined,
        serial_number: m.serial_number || undefined,
        expiry_date: m.expiry_date || undefined,
      })),
      created_by: primaryMovement.created_by,
      created_at: primaryMovement.created_at,
      received_at: primaryMovement.completed_at,
      shipping_policy: (primaryMovement.metadata as any)?.shipping_policy,
      responsible_user_id: (primaryMovement.metadata as any)?.responsible_user_id,
      notes: primaryMovement.notes || undefined,
      metadata: primaryMovement.metadata as Record<string, unknown>,
      destination_location:
        primaryMovement.destination_location &&
        Array.isArray(primaryMovement.destination_location) &&
        primaryMovement.destination_location.length > 0
          ? {
              id: primaryMovement.destination_location[0].id,
              name: primaryMovement.destination_location[0].name,
              code: primaryMovement.destination_location[0].code,
            }
          : undefined,
      created_by_user:
        primaryMovement.created_by_user &&
        Array.isArray(primaryMovement.created_by_user) &&
        primaryMovement.created_by_user.length > 0
          ? {
              id: primaryMovement.created_by_user[0].id,
              email: primaryMovement.created_by_user[0].email,
              name: primaryMovement.created_by_user[0].email.split("@")[0],
            }
          : undefined,
      responsible_user: responsibleUser
        ? {
            id: responsibleUser.id,
            email: responsibleUser.email,
            name:
              responsibleUser.first_name && responsibleUser.last_name
                ? `${responsibleUser.first_name} ${responsibleUser.last_name}`
                : responsibleUser.email.split("@")[0],
          }
        : undefined,
      items_with_details: movements.map((m: any) => {
        const productData =
          m.products && Array.isArray(m.products) && m.products.length > 0 ? m.products[0] : null;
        const variantData =
          m.product_variants && Array.isArray(m.product_variants) && m.product_variants.length > 0
            ? m.product_variants[0]
            : null;

        return {
          id: m.id,
          product_id: m.product_id,
          variant_id: m.variant_id,
          expected_quantity: m.quantity,
          received_quantity: m.status === "completed" ? m.quantity : 0,
          unit_cost: m.unit_cost || undefined,
          total_cost: m.total_cost || undefined,
          notes: m.notes || undefined,
          batch_number: m.batch_number || undefined,
          serial_number: m.serial_number || undefined,
          expiry_date: m.expiry_date || undefined,
          product: productData
            ? {
                id: productData.id,
                name: productData.name,
                sku: productData.sku,
              }
            : undefined,
          variant: variantData
            ? {
                id: variantData.id,
                name: variantData.name,
                sku: variantData.sku,
              }
            : undefined,
        };
      }),
    };

    return delivery;
  } catch (error) {
    console.error("Error in getDelivery:", error);
    return null;
  }
}

/**
 * Map movement status to delivery status
 */
function mapMovementStatusToDeliveryStatus(status: string): DeliveryStatus {
  const mapping: Record<string, DeliveryStatus> = {
    pending: "draft",
    approved: "ready",
    completed: "done",
    cancelled: "cancelled",
    reversed: "cancelled",
  };
  return mapping[status] || "draft";
}
