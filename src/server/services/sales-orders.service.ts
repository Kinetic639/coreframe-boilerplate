/**
 * Sales Orders Service
 * Migrated from src/modules/warehouse/api/sales-orders-service.ts
 * Handles CRUD operations for sales orders and integrates with reservations
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../../supabase/types/types";
import type {
  CreateSalesOrderInput,
  UpdateSalesOrderInput,
  SalesOrderFiltersInput,
  SalesOrderStatus,
  UpdateOrderStatusInput,
  ReleaseReservationForItemInput,
} from "../schemas/sales-orders.schema";
import { ReservationsService } from "./reservations.service";

// Type definitions
type SalesOrder = Database["public"]["Tables"]["sales_orders"]["Row"];
type SalesOrderItem = Database["public"]["Tables"]["sales_order_items"]["Row"];

export interface SalesOrderWithItems extends SalesOrder {
  items?: SalesOrderItem[];
}

export interface SalesOrderWithRelations extends SalesOrder {
  items?: SalesOrderItem[];
  customer?: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
  };
}

export interface SalesOrdersResponse {
  orders: SalesOrderWithItems[];
  total: number;
}

export class SalesOrdersService {
  /**
   * Validate status transition
   */
  static canTransitionStatus(
    from: SalesOrderStatus,
    to: SalesOrderStatus
  ): { allowed: boolean; reason?: string } {
    const validTransitions: Record<SalesOrderStatus, SalesOrderStatus[]> = {
      draft: ["pending", "cancelled"],
      pending: ["confirmed", "cancelled"],
      confirmed: ["processing", "cancelled"],
      processing: ["fulfilled", "cancelled"],
      fulfilled: [],
      cancelled: [],
    };

    const allowed = validTransitions[from]?.includes(to) || false;

    if (!allowed) {
      return {
        allowed: false,
        reason: `Cannot transition from "${from}" to "${to}"`,
      };
    }

    return { allowed: true };
  }

  /**
   * Get all sales orders with optional filtering
   */
  static async getSalesOrders(
    supabase: SupabaseClient<Database>,
    organizationId: string,
    branchId: string | null,
    filters: SalesOrderFiltersInput
  ): Promise<SalesOrdersResponse> {
    let query = supabase
      .from("sales_orders")
      .select(
        `
        *,
        items:sales_order_items(*)
      `,
        { count: "exact" }
      )
      .eq("organization_id", organizationId)
      .is("deleted_at", null);

    // Filter by branch if provided
    if (branchId) {
      query = query.eq("branch_id", branchId) as any;
    }

    // Apply filters
    if (filters.status) {
      if (Array.isArray(filters.status)) {
        query = query.in("status", filters.status) as any;
      } else {
        query = query.eq("status", filters.status) as any;
      }
    }

    if (filters.customer_id) {
      query = query.eq("customer_id", filters.customer_id) as any;
    }

    if (filters.branch_id) {
      query = query.eq("branch_id", filters.branch_id) as any;
    }

    if (filters.order_date_from) {
      query = query.gte("order_date", filters.order_date_from) as any;
    }

    if (filters.order_date_to) {
      query = query.lte("order_date", filters.order_date_to) as any;
    }

    if (filters.search) {
      query = query.or(
        `order_number.ilike.%${filters.search}%,customer_name.ilike.%${filters.search}%`
      ) as any;
    }

    // Sorting
    const sortBy = filters.sort_by || "order_date";
    const sortOrder = filters.sort_order || "desc";
    query = query.order(sortBy, { ascending: sortOrder === "asc" });

    // Pagination
    if (filters.limit) {
      const offset = filters.offset || 0;
      query = query.range(offset, offset + filters.limit - 1);
    }

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to fetch sales orders: ${error.message}`);
    }

    return {
      orders: (data as unknown as SalesOrderWithItems[]) || [],
      total: count || 0,
    };
  }

  /**
   * Get single sales order by ID with all relations
   */
  static async getSalesOrderById(
    supabase: SupabaseClient<Database>,
    orderId: string,
    organizationId: string
  ): Promise<SalesOrderWithRelations | null> {
    const { data, error } = await supabase
      .from("sales_orders")
      .select(
        `
        *,
        items:sales_order_items(*),
        customer:business_accounts(id, name, email, phone)
      `
      )
      .eq("id", orderId)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null; // Not found
      }
      throw new Error(`Failed to fetch sales order: ${error.message}`);
    }

    return data as unknown as SalesOrderWithRelations;
  }

  /**
   * Get sales order by order number
   */
  static async getSalesOrderByNumber(
    supabase: SupabaseClient<Database>,
    orderNumber: string,
    organizationId: string
  ): Promise<SalesOrderWithItems | null> {
    const { data, error } = await supabase
      .from("sales_orders")
      .select(
        `
        *,
        items:sales_order_items(*)
      `
      )
      .eq("order_number", orderNumber)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null; // Not found
      }
      throw new Error(`Failed to fetch sales order: ${error.message}`);
    }

    return data as unknown as SalesOrderWithItems;
  }

  /**
   * Create new sales order
   */
  static async createSalesOrder(
    supabase: SupabaseClient<Database>,
    organizationId: string,
    branchId: string | null,
    data: CreateSalesOrderInput,
    userId: string
  ): Promise<SalesOrderWithItems> {
    // Create order header
    const { data: order, error: orderError } = await supabase
      .from("sales_orders")
      .insert({
        organization_id: organizationId,
        branch_id: branchId,
        customer_id: data.customer_id || null,
        customer_name: data.customer_name,
        customer_email: data.customer_email || null,
        customer_phone: data.customer_phone || null,
        order_date: data.order_date,
        expected_delivery_date: data.expected_delivery_date || null,
        delivery_address_line1: data.delivery_address_line1 || null,
        delivery_address_line2: data.delivery_address_line2 || null,
        delivery_city: data.delivery_city || null,
        delivery_state: data.delivery_state || null,
        delivery_postal_code: data.delivery_postal_code || null,
        delivery_country: data.delivery_country || "PL",
        shipping_cost: data.shipping_cost || 0,
        discount_amount: data.discount_amount || 0,
        currency_code: data.currency_code || "PLN",
        customer_notes: data.customer_notes || null,
        internal_notes: data.internal_notes || null,
        status: "draft",
        created_by: userId,
      } as any)
      .select()
      .single();

    if (orderError || !order) {
      throw new Error(`Failed to create order: ${orderError?.message || "Unknown error"}`);
    }

    // Create order items
    const items = data.items.map((item) => ({
      sales_order_id: order.id,
      product_id: item.product_id,
      product_variant_id: item.product_variant_id || null,
      product_name: item.product_name || "",
      product_sku: item.product_sku || null,
      variant_name: item.variant_name || null,
      quantity_ordered: item.quantity_ordered,
      unit_of_measure: item.unit_of_measure || null,
      unit_price: item.unit_price,
      tax_rate: item.tax_rate || 0,
      discount_percent: item.discount_percent || 0,
      location_id: item.location_id || null,
      notes: item.notes || null,
    }));

    const { data: createdItems, error: itemsError } = await supabase
      .from("sales_order_items")
      .insert(items as any)
      .select();

    if (itemsError || !createdItems || createdItems.length === 0) {
      // Rollback: Delete the order
      await supabase.from("sales_orders").delete().eq("id", order.id);

      throw new Error(`Failed to create order items: ${itemsError?.message || "No items created"}`);
    }

    // Fetch complete order with items
    const completeOrder = await this.getSalesOrderById(supabase, order.id, organizationId);
    if (!completeOrder) {
      throw new Error("Failed to fetch created sales order");
    }

    return completeOrder as SalesOrderWithItems;
  }

  /**
   * Update sales order
   */
  static async updateSalesOrder(
    supabase: SupabaseClient<Database>,
    orderId: string,
    organizationId: string,
    data: UpdateSalesOrderInput,
    _userId: string
  ): Promise<SalesOrder> {
    // Check if order exists and is not fulfilled/cancelled
    const existing = await this.getSalesOrderById(supabase, orderId, organizationId);
    if (!existing) {
      throw new Error("Order not found");
    }

    if (existing.status === "fulfilled" || existing.status === "cancelled") {
      throw new Error(`Cannot update ${existing.status} order`);
    }

    // Build update data
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (data.customer_name) updateData.customer_name = data.customer_name;
    if (data.customer_email !== undefined) updateData.customer_email = data.customer_email;
    if (data.customer_phone !== undefined) updateData.customer_phone = data.customer_phone;
    if (data.order_date) updateData.order_date = data.order_date;
    if (data.expected_delivery_date !== undefined)
      updateData.expected_delivery_date = data.expected_delivery_date;
    if (data.delivery_address_line1 !== undefined)
      updateData.delivery_address_line1 = data.delivery_address_line1;
    if (data.delivery_address_line2 !== undefined)
      updateData.delivery_address_line2 = data.delivery_address_line2;
    if (data.delivery_city !== undefined) updateData.delivery_city = data.delivery_city;
    if (data.delivery_state !== undefined) updateData.delivery_state = data.delivery_state;
    if (data.delivery_postal_code !== undefined)
      updateData.delivery_postal_code = data.delivery_postal_code;
    if (data.delivery_country !== undefined) updateData.delivery_country = data.delivery_country;
    if (data.shipping_cost !== undefined) updateData.shipping_cost = data.shipping_cost;
    if (data.discount_amount !== undefined) updateData.discount_amount = data.discount_amount;
    if (data.customer_notes !== undefined) updateData.customer_notes = data.customer_notes;
    if (data.internal_notes !== undefined) updateData.internal_notes = data.internal_notes;

    const { data: updated, error: updateError } = await supabase
      .from("sales_orders")
      .update(updateData)
      .eq("id", orderId)
      .eq("organization_id", organizationId)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to update order: ${updateError.message}`);
    }

    // Update items if provided
    if (data.items && data.items.length > 0) {
      // Delete existing items
      await supabase.from("sales_order_items").delete().eq("sales_order_id", orderId);

      // Create new items
      const items = data.items.map((item) => ({
        sales_order_id: orderId,
        product_id: item.product_id,
        product_variant_id: item.product_variant_id || null,
        product_name: item.product_name || "",
        product_sku: item.product_sku || null,
        variant_name: item.variant_name || null,
        quantity_ordered: item.quantity_ordered,
        unit_of_measure: item.unit_of_measure || null,
        unit_price: item.unit_price,
        tax_rate: item.tax_rate || 0,
        discount_percent: item.discount_percent || 0,
        location_id: item.location_id || null,
        notes: item.notes || null,
      }));

      const { error: itemsError } = await supabase.from("sales_order_items").insert(items as any);

      if (itemsError) {
        throw new Error(`Failed to update order items: ${itemsError.message}`);
      }
    }

    return updated as SalesOrder;
  }

  /**
   * Update sales order status with reservation integration
   */
  static async updateOrderStatus(
    supabase: SupabaseClient<Database>,
    orderId: string,
    organizationId: string,
    branchId: string | null,
    input: UpdateOrderStatusInput,
    userId: string
  ): Promise<SalesOrder> {
    // Get current order
    const order = await this.getSalesOrderById(supabase, orderId, organizationId);
    if (!order) {
      throw new Error("Order not found");
    }

    // Validate transition
    const transition = this.canTransitionStatus(order.status as SalesOrderStatus, input.status);
    if (!transition.allowed) {
      throw new Error(transition.reason);
    }

    // Prepare update data
    const updateData: any = {
      status: input.status,
      updated_at: new Date().toISOString(),
    };

    if (input.status === "cancelled") {
      updateData.cancelled_at = new Date().toISOString();
      updateData.cancelled_by = userId;
      if (input.cancellation_reason) {
        updateData.cancellation_reason = input.cancellation_reason;
      }
    }

    // Update order
    const { data: updated, error } = await supabase
      .from("sales_orders")
      .update(updateData)
      .eq("id", orderId)
      .eq("organization_id", organizationId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update order status: ${error.message}`);
    }

    // Handle reservations based on status transition
    if (input.status === "confirmed" && order.status !== "confirmed") {
      // Create reservations for all order items when order is confirmed
      await this.createReservationsForOrder(supabase, order as SalesOrderWithItems, userId);
    } else if (input.status === "cancelled") {
      // Cancel all reservations when order is cancelled
      await this.cancelReservationsForOrder(
        supabase,
        orderId,
        organizationId,
        branchId,
        userId,
        input.cancellation_reason || "Order cancelled"
      );
    }

    return updated as SalesOrder;
  }

  /**
   * Soft delete sales order
   */
  static async deleteSalesOrder(
    supabase: SupabaseClient<Database>,
    orderId: string,
    organizationId: string
  ): Promise<void> {
    // Check if order can be deleted (only draft/pending)
    const order = await this.getSalesOrderById(supabase, orderId, organizationId);
    if (!order) {
      throw new Error("Order not found");
    }

    if (!["draft", "pending"].includes(order.status)) {
      throw new Error(
        `Cannot delete ${order.status} order. Only draft and pending orders can be deleted.`
      );
    }

    // Soft delete
    const { error } = await supabase
      .from("sales_orders")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", orderId)
      .eq("organization_id", organizationId);

    if (error) {
      throw new Error(`Failed to delete order: ${error.message}`);
    }
  }

  /**
   * Get orders by customer
   */
  static async getOrdersByCustomer(
    supabase: SupabaseClient<Database>,
    customerId: string,
    organizationId: string
  ): Promise<SalesOrderWithItems[]> {
    const { data, error } = await supabase
      .from("sales_orders")
      .select(
        `
        *,
        items:sales_order_items(*)
      `
      )
      .eq("customer_id", customerId)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("order_date", { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch customer orders: ${error.message}`);
    }

    return (data as unknown as SalesOrderWithItems[]) || [];
  }

  /**
   * Get orders by status
   */
  static async getOrdersByStatus(
    supabase: SupabaseClient<Database>,
    status: SalesOrderStatus,
    organizationId: string,
    branchId: string | null
  ): Promise<SalesOrderWithItems[]> {
    let query = supabase
      .from("sales_orders")
      .select(
        `
        *,
        items:sales_order_items(*)
      `
      )
      .eq("status", status)
      .eq("organization_id", organizationId)
      .is("deleted_at", null);

    if (branchId) {
      query = query.eq("branch_id", branchId) as any;
    }

    query = query.order("order_date", { ascending: false });

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch orders by status: ${error.message}`);
    }

    return (data as unknown as SalesOrderWithItems[]) || [];
  }

  /**
   * Release reservation for an order item when fulfilled
   */
  static async releaseReservationForItem(
    supabase: SupabaseClient<Database>,
    input: ReleaseReservationForItemInput,
    userId: string
  ): Promise<void> {
    // Get order item with reservation
    const { data: item, error: itemError } = await supabase
      .from("sales_order_items")
      .select("*")
      .eq("id", input.item_id)
      .single();

    if (itemError || !item) {
      throw new Error("Order item not found");
    }

    if (!item.reservation_id) {
      throw new Error("No reservation found for this item");
    }

    // Release the reservation using ReservationsService
    await ReservationsService.releaseReservation(
      supabase,
      {
        reservation_id: item.reservation_id,
        quantity: input.quantity,
        notes: input.notes,
      },
      userId
    );

    // Update order item fulfilled quantity
    await supabase
      .from("sales_order_items")
      .update({
        quantity_fulfilled: (item.quantity_fulfilled || 0) + input.quantity,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.item_id);
  }

  /**
   * Create reservations for all items in a sales order
   * Called when order status transitions to "confirmed"
   * @private
   */
  private static async createReservationsForOrder(
    supabase: SupabaseClient<Database>,
    order: SalesOrderWithItems,
    userId: string
  ): Promise<void> {
    if (!order.items || order.items.length === 0) {
      console.log("[Reservations] No items in order");
      return;
    }

    console.log("[Reservations] Creating reservations for order:", order.order_number);

    const reservationPromises = order.items.map(async (item) => {
      // Skip if no product or location
      if (!item.product_id || !item.location_id) {
        const reason = !item.product_id ? "missing product_id" : "missing location_id";
        console.warn(
          `[Reservations] ⚠️ SKIPPING item ${item.id} (${item.product_name}): ${reason}`
        );
        return;
      }

      try {
        console.log(
          `[Reservations] Creating reservation for item ${item.id} (${item.product_name})...`
        );

        const result = await ReservationsService.createReservation(
          supabase,
          order.organization_id,
          order.branch_id || null,
          {
            product_id: item.product_id,
            variant_id: item.product_variant_id || undefined,
            location_id: item.location_id,
            quantity: item.quantity_ordered,
            reference_type: "sales_order",
            reference_id: order.id,
            reference_number: order.order_number,
            reserved_for: `Sales Order ${order.order_number} - ${order.customer_name}`,
            sales_order_id: order.id,
            sales_order_item_id: item.id,
            priority: 1, // Sales orders have higher priority
            auto_release: false, // Manual release when fulfilled
            expires_at: order.expected_delivery_date || undefined,
            notes: item.notes || undefined,
          },
          userId
        );

        console.log(
          `[Reservations] ✅ Created reservation ${result.reservation_number} for item ${item.id}`
        );

        // Update sales_order_item with reservation_id
        await supabase
          .from("sales_order_items")
          .update({ reservation_id: result.id })
          .eq("id", item.id);
      } catch (error) {
        console.error(`[Reservations] ❌ Error creating reservation for item ${item.id}:`, error);
        // Continue with other items even if one fails
      }
    });

    await Promise.all(reservationPromises);
    console.log("[Reservations] Finished processing all items");
  }

  /**
   * Cancel all reservations for a sales order
   * Called when order is cancelled
   * @private
   */
  private static async cancelReservationsForOrder(
    supabase: SupabaseClient<Database>,
    orderId: string,
    organizationId: string,
    branchId: string | null,
    userId: string,
    reason: string
  ): Promise<void> {
    try {
      console.log(`[Reservations] Cancelling reservations for order: ${orderId}`);

      // Get all active reservations for this order
      const reservations = await ReservationsService.getReservations(
        supabase,
        organizationId,
        branchId,
        {
          sales_order_id: orderId,
          status: ["active", "partial"],
        }
      );

      console.log(`[Reservations] Found ${reservations.length} active reservations to cancel`);

      if (reservations.length === 0) {
        console.log(`[Reservations] No active reservations found for order ${orderId}`);
        return;
      }

      // Cancel each reservation
      const cancellationPromises = reservations.map(async (reservation) => {
        console.log(`[Reservations] Cancelling reservation: ${reservation.reservation_number}`);
        await ReservationsService.cancelReservation(
          supabase,
          {
            reservation_id: reservation.id,
            reason,
          },
          userId
        );
        console.log(`[Reservations] ✅ Cancelled reservation ${reservation.reservation_number}`);
      });

      await Promise.all(cancellationPromises);
      console.log(`[Reservations] Finished cancelling all reservations for order ${orderId}`);
    } catch (error) {
      console.error(`[Reservations] ❌ Error cancelling reservations for order ${orderId}:`, error);
    }
  }
}
