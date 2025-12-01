"use server";

// =============================================
// Get Deliveries Server Action
// Fetches deliveries list with pagination and filters
// =============================================

import { createClient } from "@/lib/supabase/server";
import type {
  DeliveryFilters,
  PaginatedDeliveries,
  DeliveryWithRelations,
  DeliveryStatus,
} from "@/modules/warehouse/types/deliveries";

export async function getDeliveries(
  organizationId: string,
  branchId: string,
  filters: DeliveryFilters = {},
  page: number = 1,
  pageSize: number = 50
): Promise<PaginatedDeliveries> {
  try {
    const supabase = await createClient();

    // Build query for deliveries (movements with type 101)
    // NOTE: We now show ALL deliveries including those with receipts
    // since receipts are automatically generated for completed deliveries
    let query = supabase
      .from("stock_movements")
      .select(
        `
        id,
        movement_number,
        movement_type_code,
        category,
        organization_id,
        branch_id,
        product_id,
        variant_id,
        destination_location_id,
        quantity,
        unit_cost,
        total_cost,
        reference_number,
        reference_id,
        status,
        occurred_at,
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
        products!stock_movements_product_id_fkey(
          id,
          name,
          sku
        ),
        product_variants!stock_movements_variant_id_fkey(
          id,
          name,
          sku
        ),
        created_by_user:users!stock_movements_created_by_fkey(
          id,
          email
        )
      `,
        { count: "exact" }
      )
      .eq("organization_id", organizationId)
      .eq("branch_id", branchId)
      .eq("movement_type_code", "101"); // Only GR from PO movements (deliveries)

    // Apply filters
    if (filters.status) {
      query = query.eq("status", mapDeliveryStatusToMovementStatus(filters.status));
    }

    if (filters.destination_location_id) {
      query = query.eq("destination_location_id", filters.destination_location_id);
    }

    if (filters.source_document) {
      query = query.eq("reference_number", filters.source_document);
    }

    if (filters.date_from) {
      query = query.gte("occurred_at", filters.date_from);
    }

    if (filters.date_to) {
      query = query.lte("occurred_at", filters.date_to);
    }

    if (filters.search) {
      query = query.or(
        `movement_number.ilike.%${filters.search}%,reference_number.ilike.%${filters.search}%,notes.ilike.%${filters.search}%`
      );
    }

    // Apply pagination
    const offset = (page - 1) * pageSize;
    query = query.range(offset, offset + pageSize - 1).order("created_at", { ascending: false });

    const { data, error, count } = await query;

    if (error) {
      console.error("Error fetching deliveries:", error);
      return {
        data: [],
        total: 0,
        page,
        page_size: pageSize,
        total_pages: 0,
      };
    }

    // Transform movements to deliveries
    // Group movements by reference_id (each delivery has a unique reference_id)
    const deliveriesMap = new Map<string, DeliveryWithRelations>();

    for (const movement of data || []) {
      const deliveryNumber =
        (movement.metadata as any)?.delivery_number || movement.movement_number;
      const groupKey = movement.reference_id || movement.id; // Use reference_id as the grouping key

      if (!deliveriesMap.has(groupKey)) {
        // Create new delivery entry
        const delivery: DeliveryWithRelations = {
          id: movement.id,
          delivery_number: deliveryNumber,
          organization_id: movement.organization_id,
          branch_id: movement.branch_id,
          status: mapMovementStatusToDeliveryStatus(movement.status),
          scheduled_date: movement.occurred_at,
          source_document: movement.reference_number || undefined,
          delivery_address: (movement.metadata as any)?.delivery_address,
          operation_type: "Delivery Orders",
          destination_location_id: movement.destination_location_id,
          items: [],
          created_by: movement.created_by,
          created_at: movement.created_at,
          received_at: movement.completed_at,
          shipping_policy: (movement.metadata as any)?.shipping_policy,
          responsible_user_id: (movement.metadata as any)?.responsible_user_id,
          notes: movement.notes || undefined,
          metadata: movement.metadata as Record<string, unknown>,
          destination_location:
            movement.destination_location &&
            Array.isArray(movement.destination_location) &&
            movement.destination_location.length > 0
              ? {
                  id: movement.destination_location[0].id,
                  name: movement.destination_location[0].name,
                  code: movement.destination_location[0].code,
                }
              : undefined,
          created_by_user:
            movement.created_by_user &&
            Array.isArray(movement.created_by_user) &&
            movement.created_by_user.length > 0
              ? {
                  id: movement.created_by_user[0].id,
                  email: movement.created_by_user[0].email,
                  name: movement.created_by_user[0].email.split("@")[0],
                }
              : undefined,
        };

        deliveriesMap.set(groupKey, delivery);
      }

      // Add item to delivery
      const delivery = deliveriesMap.get(groupKey)!;
      delivery.items.push({
        id: movement.id,
        product_id: movement.product_id,
        variant_id: movement.variant_id,
        expected_quantity: movement.quantity,
        received_quantity: movement.status === "completed" ? movement.quantity : 0,
        unit_cost: movement.unit_cost || undefined,
        total_cost: movement.total_cost || undefined,
        notes: movement.notes || undefined,
      });

      // If movement has product/variant details, add them
      if (!delivery.items_with_details) {
        delivery.items_with_details = [];
      }

      const productData =
        (movement as any).products &&
        Array.isArray((movement as any).products) &&
        (movement as any).products.length > 0
          ? (movement as any).products[0]
          : null;
      const variantData =
        (movement as any).product_variants &&
        Array.isArray((movement as any).product_variants) &&
        (movement as any).product_variants.length > 0
          ? (movement as any).product_variants[0]
          : null;

      delivery.items_with_details.push({
        id: movement.id,
        product_id: movement.product_id,
        variant_id: movement.variant_id,
        expected_quantity: movement.quantity,
        received_quantity: movement.status === "completed" ? movement.quantity : 0,
        unit_cost: movement.unit_cost || undefined,
        total_cost: movement.total_cost || undefined,
        notes: movement.notes || undefined,
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
      });
    }

    const deliveries = Array.from(deliveriesMap.values());

    return {
      data: deliveries,
      total: count || 0,
      page,
      page_size: pageSize,
      total_pages: Math.ceil((count || 0) / pageSize),
    };
  } catch (error) {
    console.error("Error in getDeliveries:", error);
    return {
      data: [],
      total: 0,
      page,
      page_size: pageSize,
      total_pages: 0,
    };
  }
}

/**
 * Map delivery status to movement status
 */
function mapDeliveryStatusToMovementStatus(status: DeliveryStatus): string {
  const mapping: Record<DeliveryStatus, string> = {
    draft: "draft",
    pending: "pending",
    approved: "approved",
    completed: "completed",
    cancelled: "cancelled",
  };
  return mapping[status] || "pending";
}

/**
 * Map movement status to delivery status
 */
function mapMovementStatusToDeliveryStatus(status: string): DeliveryStatus {
  const mapping: Record<string, DeliveryStatus> = {
    draft: "draft",
    pending: "pending",
    approved: "approved",
    completed: "completed",
    cancelled: "cancelled",
    reversed: "cancelled",
  };
  return mapping[status] || "draft";
}
