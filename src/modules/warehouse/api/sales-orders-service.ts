// =============================================
// Sales Orders Service
// Handles CRUD operations for sales orders and order items
// =============================================

import { createClient } from "@/utils/supabase/client";
import type {
  SalesOrderWithItems,
  SalesOrderWithRelations,
  SalesOrderFormData,
  SalesOrderFilters,
  SalesOrderListResponse,
  SalesOrderStatus,
  CreateSalesOrderResult,
  UpdateSalesOrderResult,
  DeleteSalesOrderResult,
  SalesOrderValidationResult,
  SalesOrderValidationError,
} from "../types/sales-orders";

class SalesOrdersService {
  private supabase = createClient();

  // ==========================================
  // VALIDATION
  // ==========================================

  /**
   * Validate sales order form data
   */
  validateSalesOrder(data: SalesOrderFormData): SalesOrderValidationResult {
    const errors: SalesOrderValidationError[] = [];

    // Validate customer
    if (!data.customer_name || data.customer_name.trim() === "") {
      errors.push({
        field: "customer_name",
        message: "Customer name is required",
      });
    }

    // Validate order date
    if (!data.order_date) {
      errors.push({
        field: "order_date",
        message: "Order date is required",
      });
    }

    // Validate items
    if (!data.items || data.items.length === 0) {
      errors.push({
        field: "items",
        message: "At least one item is required",
      });
    } else {
      data.items.forEach((item, index) => {
        if (!item.product_id) {
          errors.push({
            field: `items[${index}].product_id`,
            message: `Item ${index + 1}: Product is required`,
          });
        }

        if (!item.quantity_ordered || item.quantity_ordered <= 0) {
          errors.push({
            field: `items[${index}].quantity_ordered`,
            message: `Item ${index + 1}: Quantity must be greater than 0`,
          });
        }

        if (!item.unit_price || item.unit_price < 0) {
          errors.push({
            field: `items[${index}].unit_price`,
            message: `Item ${index + 1}: Unit price must be 0 or greater`,
          });
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate status transition
   */
  canTransitionStatus(
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

  // ==========================================
  // SALES ORDER CRUD OPERATIONS
  // ==========================================

  /**
   * Get all sales orders with optional filtering
   */
  async getSalesOrders(
    organizationId: string,
    branchId: string | null,
    filters?: SalesOrderFilters
  ): Promise<SalesOrderListResponse> {
    let query = this.supabase
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
      query = query.eq("branch_id", branchId);
    }

    // Apply filters
    if (filters?.status) {
      if (Array.isArray(filters.status)) {
        query = query.in("status", filters.status);
      } else {
        query = query.eq("status", filters.status);
      }
    }

    if (filters?.customer_id) {
      query = query.eq("customer_id", filters.customer_id);
    }

    if (filters?.branch_id) {
      query = query.eq("branch_id", filters.branch_id);
    }

    if (filters?.order_date_from) {
      query = query.gte("order_date", filters.order_date_from);
    }

    if (filters?.order_date_to) {
      query = query.lte("order_date", filters.order_date_to);
    }

    if (filters?.search) {
      query = query.or(
        `order_number.ilike.%${filters.search}%,customer_name.ilike.%${filters.search}%`
      );
    }

    // Order by date descending
    query = query.order("order_date", { ascending: false });
    query = query.order("created_at", { ascending: false });

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to fetch sales orders: ${error.message}`);
    }

    return {
      orders: (data as SalesOrderWithItems[]) || [],
      total: count || 0,
      page: 1,
      page_size: data?.length || 0,
      total_pages: 1,
    };
  }

  /**
   * Get single sales order by ID with all relations
   */
  async getSalesOrder(
    orderId: string,
    organizationId: string
  ): Promise<SalesOrderWithRelations | null> {
    const { data, error } = await this.supabase
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

    return data as SalesOrderWithRelations;
  }

  /**
   * Get sales order by order number
   */
  async getSalesOrderByNumber(
    orderNumber: string,
    organizationId: string
  ): Promise<SalesOrderWithItems | null> {
    const { data, error } = await this.supabase
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

    return data as SalesOrderWithItems;
  }

  /**
   * Create new sales order
   */
  async createSalesOrder(
    data: SalesOrderFormData,
    organizationId: string,
    branchId: string | null,
    userId: string
  ): Promise<CreateSalesOrderResult> {
    try {
      // Validate
      const validation = this.validateSalesOrder(data);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.errors.map((e) => e.message).join(", "),
        };
      }

      // Create order header
      const { data: order, error: orderError } = await this.supabase
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
        })
        .select()
        .single();

      if (orderError || !order) {
        return {
          success: false,
          error: `Failed to create order: ${orderError?.message || "Unknown error"}`,
        };
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

      const { data: createdItems, error: itemsError } = await this.supabase
        .from("sales_order_items")
        .insert(items)
        .select();

      if (itemsError || !createdItems || createdItems.length === 0) {
        // Rollback: Delete the order
        await this.supabase.from("sales_orders").delete().eq("id", order.id);

        return {
          success: false,
          error: `Failed to create order items: ${itemsError?.message || "No items created"}`,
        };
      }

      // Fetch complete order with items
      const completeOrder = await this.getSalesOrder(order.id, organizationId);

      return {
        success: true,
        order: completeOrder as SalesOrderWithItems,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Update sales order
   */
  async updateSalesOrder(
    orderId: string,
    data: Partial<SalesOrderFormData>,
    organizationId: string,
    _userId: string
  ): Promise<UpdateSalesOrderResult> {
    try {
      // Check if order exists and is not fulfilled/cancelled
      const existing = await this.getSalesOrder(orderId, organizationId);
      if (!existing) {
        return {
          success: false,
          error: "Order not found",
        };
      }

      if (existing.status === "fulfilled" || existing.status === "cancelled") {
        return {
          success: false,
          error: `Cannot update ${existing.status} order`,
        };
      }

      // Update order header
      const updateData: Record<string, unknown> = {
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

      const { error: updateError } = await this.supabase
        .from("sales_orders")
        .update(updateData)
        .eq("id", orderId)
        .eq("organization_id", organizationId);

      if (updateError) {
        return {
          success: false,
          error: `Failed to update order: ${updateError.message}`,
        };
      }

      // Update items if provided
      if (data.items && data.items.length > 0) {
        // Delete existing items
        await this.supabase.from("sales_order_items").delete().eq("sales_order_id", orderId);

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

        const { error: itemsError } = await this.supabase.from("sales_order_items").insert(items);

        if (itemsError) {
          return {
            success: false,
            error: `Failed to update order items: ${itemsError.message}`,
          };
        }
      }

      // Fetch updated order
      const updatedOrder = await this.getSalesOrder(orderId, organizationId);

      return {
        success: true,
        order: updatedOrder as SalesOrderWithItems,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Update sales order status
   */
  async updateOrderStatus(
    orderId: string,
    newStatus: SalesOrderStatus,
    organizationId: string,
    userId: string,
    cancellationReason?: string
  ): Promise<UpdateSalesOrderResult> {
    try {
      // Get current order
      const order = await this.getSalesOrder(orderId, organizationId);
      if (!order) {
        return {
          success: false,
          error: "Order not found",
        };
      }

      // Validate transition
      const transition = this.canTransitionStatus(order.status as SalesOrderStatus, newStatus);
      if (!transition.allowed) {
        return {
          success: false,
          error: transition.reason,
        };
      }

      // Prepare update data
      const updateData: Record<string, unknown> = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      };

      if (newStatus === "cancelled") {
        updateData.cancelled_at = new Date().toISOString();
        updateData.cancelled_by = userId;
        if (cancellationReason) {
          updateData.cancellation_reason = cancellationReason;
        }
      }

      // Update order
      const { error } = await this.supabase
        .from("sales_orders")
        .update(updateData)
        .eq("id", orderId)
        .eq("organization_id", organizationId);

      if (error) {
        return {
          success: false,
          error: `Failed to update order status: ${error.message}`,
        };
      }

      // TODO: When status changes to "confirmed", create stock reservations
      // TODO: When status changes to "fulfilled" or "cancelled", release reservations

      // Fetch updated order
      const updatedOrder = await this.getSalesOrder(orderId, organizationId);

      return {
        success: true,
        order: updatedOrder as SalesOrderWithItems,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Soft delete sales order
   */
  async deleteSalesOrder(orderId: string, organizationId: string): Promise<DeleteSalesOrderResult> {
    try {
      // Check if order can be deleted (only draft/pending)
      const order = await this.getSalesOrder(orderId, organizationId);
      if (!order) {
        return {
          success: false,
          error: "Order not found",
        };
      }

      if (!["draft", "pending"].includes(order.status)) {
        return {
          success: false,
          error: `Cannot delete ${order.status} order. Only draft and pending orders can be deleted.`,
        };
      }

      // Soft delete
      const { error } = await this.supabase
        .from("sales_orders")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", orderId)
        .eq("organization_id", organizationId);

      if (error) {
        return {
          success: false,
          error: `Failed to delete order: ${error.message}`,
        };
      }

      return {
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // ==========================================
  // HELPER METHODS
  // ==========================================

  /**
   * Get orders by customer
   */
  async getOrdersByCustomer(
    customerId: string,
    organizationId: string
  ): Promise<SalesOrderWithItems[]> {
    const { data, error } = await this.supabase
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

    return (data as SalesOrderWithItems[]) || [];
  }

  /**
   * Get orders by status
   */
  async getOrdersByStatus(
    status: SalesOrderStatus,
    organizationId: string,
    branchId?: string | null
  ): Promise<SalesOrderWithItems[]> {
    let query = this.supabase
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
      query = query.eq("branch_id", branchId);
    }

    query = query.order("order_date", { ascending: false });

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch orders by status: ${error.message}`);
    }

    return (data as SalesOrderWithItems[]) || [];
  }
}

// Export singleton instance
export const salesOrdersService = new SalesOrdersService();
export default salesOrdersService;
