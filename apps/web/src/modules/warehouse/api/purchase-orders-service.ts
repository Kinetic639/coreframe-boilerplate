/**
 * Purchase Orders Service
 *
 * This service handles all business logic for purchase orders including:
 * - CRUD operations for purchase orders and items
 * - Status workflow management
 * - Approval process
 * - Receiving workflow
 * - Integration with stock movements
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../../../supabase/types/types";
import type {
  PurchaseOrder,
  PurchaseOrderWithRelations,
  PurchaseOrderFormData,
  PurchaseOrderFilters,
  PurchaseOrdersResponse,
  PurchaseOrderItem,
  PurchaseOrderItemWithRelations,
  ReceivePurchaseOrderData,
  PurchaseOrderStatistics,
} from "../types/purchase-orders";

export class PurchaseOrdersService {
  constructor(private supabase: SupabaseClient<Database>) {}

  /**
   * Get all purchase orders with optional filtering
   */
  async getPurchaseOrders(
    organizationId: string,
    filters: PurchaseOrderFilters = {}
  ): Promise<PurchaseOrdersResponse> {
    let query = this.supabase
      .from("purchase_orders")
      .select(
        `
        *,
        supplier:business_accounts!supplier_id (
          id,
          name,
          email,
          phone,
          is_active
        ),
        delivery_location:locations!delivery_location_id (
          id,
          name,
          code
        ),
        created_by_user:users!created_by (
          id,
          email,
          first_name,
          last_name,
          avatar_url
        )
      `,
        { count: "exact" }
      )
      .eq("organization_id", organizationId)
      .is("deleted_at", null);

    // Apply filters
    if (filters.search) {
      query = query.or(
        `po_number.ilike.%${filters.search}%,supplier_name.ilike.%${filters.search}%,supplier_reference.ilike.%${filters.search}%`
      );
    }

    if (filters.status && filters.status.length > 0) {
      query = query.in("status", filters.status);
    }

    if (filters.payment_status && filters.payment_status.length > 0) {
      query = query.in("payment_status", filters.payment_status);
    }

    if (filters.supplier_id) {
      query = query.eq("supplier_id", filters.supplier_id);
    }

    if (filters.branch_id) {
      query = query.eq("branch_id", filters.branch_id);
    }

    if (filters.created_by) {
      query = query.eq("created_by", filters.created_by);
    }

    if (filters.date_from) {
      query = query.gte("po_date", filters.date_from);
    }

    if (filters.date_to) {
      query = query.lte("po_date", filters.date_to);
    }

    if (filters.expected_delivery_from) {
      query = query.gte("expected_delivery_date", filters.expected_delivery_from);
    }

    if (filters.expected_delivery_to) {
      query = query.lte("expected_delivery_date", filters.expected_delivery_to);
    }

    // Sorting
    const sortBy = filters.sort_by || "po_date";
    const sortOrder = filters.sort_order || "desc";
    query = query.order(sortBy, { ascending: sortOrder === "asc" });

    // Pagination
    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    if (filters.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("Error fetching purchase orders:", error);
      throw new Error(`Failed to fetch purchase orders: ${error.message}`);
    }

    return {
      purchase_orders: (data as any[]) || [],
      total: count || 0,
    };
  }

  /**
   * Get a single purchase order by ID with all relations
   */
  async getPurchaseOrderById(
    id: string,
    organizationId: string
  ): Promise<PurchaseOrderWithRelations | null> {
    const { data, error } = await this.supabase
      .from("purchase_orders")
      .select(
        `
        *,
        supplier:business_accounts!supplier_id (
          id,
          name,
          email,
          phone,
          is_active
        ),
        delivery_location:locations!delivery_location_id (
          id,
          name,
          code
        ),
        created_by_user:users!created_by (
          id,
          email,
          first_name,
          last_name,
          avatar_url
        ),
        approved_by_user:users!approved_by (
          id,
          email,
          first_name,
          last_name,
          avatar_url
        )
      `
      )
      .eq("id", id)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null; // Not found
      }
      console.error("Error fetching purchase order:", error);
      throw new Error(`Failed to fetch purchase order: ${error.message}`);
    }

    if (!data) return null;

    // Fetch items separately
    const items = await this.getPurchaseOrderItems(id);

    return {
      ...(data as any),
      items,
    };
  }

  /**
   * Get items for a purchase order
   */
  async getPurchaseOrderItems(purchaseOrderId: string): Promise<PurchaseOrderItemWithRelations[]> {
    const { data, error } = await this.supabase
      .from("purchase_order_items")
      .select(
        `
        *,
        product:products!product_id (
          id,
          name,
          sku,
          unit
        ),
        product_variant:product_variants!product_variant_id (
          id,
          name,
          sku
        ),
        product_supplier:product_suppliers!product_supplier_id (
          id,
          supplier_sku,
          unit_price,
          lead_time_days,
          min_order_qty
        ),
        expected_location:locations!expected_location_id (
          id,
          name,
          code
        )
      `
      )
      .eq("purchase_order_id", purchaseOrderId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching purchase order items:", error);
      throw new Error(`Failed to fetch purchase order items: ${error.message}`);
    }

    return (data as any[]) || [];
  }

  /**
   * Create a new purchase order
   */
  async createPurchaseOrder(
    organizationId: string,
    branchId: string | null,
    data: PurchaseOrderFormData,
    userId: string
  ): Promise<PurchaseOrderWithRelations> {
    // Get supplier details for denormalization
    const { data: supplier, error: supplierError } = await this.supabase
      .from("business_accounts")
      .select("name, email, phone")
      .eq("id", data.supplier_id)
      .single();

    if (supplierError || !supplier) {
      throw new Error("Supplier not found");
    }

    // Create purchase order
    const poInsert: any = {
      organization_id: organizationId,
      branch_id: branchId,
      supplier_id: data.supplier_id,
      supplier_name: supplier.name,
      supplier_email: supplier.email,
      supplier_phone: supplier.phone,
      po_date: data.po_date || new Date().toISOString().split("T")[0],
      expected_delivery_date: data.expected_delivery_date || null,
      delivery_location_id: data.delivery_location_id || null,
      payment_terms: data.payment_terms || null,
      shipping_cost: data.shipping_cost || 0,
      discount_amount: data.discount_amount || 0,
      notes: data.notes || null,
      internal_notes: data.internal_notes || null,
      status: "draft" as const,
      payment_status: "unpaid" as const,
      created_by: userId,
      // po_number will be auto-generated by trigger
    };

    const { data: newPO, error: poError } = await this.supabase
      .from("purchase_orders")
      .insert(poInsert)
      .select()
      .single();

    if (poError) {
      console.error("Error creating purchase order:", poError);
      throw new Error(`Failed to create purchase order: ${poError.message}`);
    }

    // Create items
    if (data.items && data.items.length > 0) {
      await this.addItemsToPurchaseOrder(newPO.id, data.items);
    }

    // Fetch the complete purchase order with relations
    const completePO = await this.getPurchaseOrderById(newPO.id, organizationId);
    if (!completePO) {
      throw new Error("Failed to fetch created purchase order");
    }

    return completePO;
  }

  /**
   * Update a purchase order
   */
  async updatePurchaseOrder(
    id: string,
    organizationId: string,
    data: Partial<PurchaseOrderFormData>
  ): Promise<PurchaseOrder> {
    // Build update object
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (data.po_date !== undefined) updateData.po_date = data.po_date;
    if (data.expected_delivery_date !== undefined)
      updateData.expected_delivery_date = data.expected_delivery_date;
    if (data.delivery_location_id !== undefined)
      updateData.delivery_location_id = data.delivery_location_id;
    if (data.payment_terms !== undefined) updateData.payment_terms = data.payment_terms;
    if (data.shipping_cost !== undefined) updateData.shipping_cost = data.shipping_cost;
    if (data.discount_amount !== undefined) updateData.discount_amount = data.discount_amount;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.internal_notes !== undefined) updateData.internal_notes = data.internal_notes;

    // If supplier is changed, update denormalized fields
    if (data.supplier_id) {
      const { data: supplier } = await this.supabase
        .from("business_accounts")
        .select("name, email, phone")
        .eq("id", data.supplier_id)
        .single();

      if (supplier) {
        updateData.supplier_id = data.supplier_id;
        updateData.supplier_name = supplier.name;
        updateData.supplier_email = supplier.email;
        updateData.supplier_phone = supplier.phone;
      }
    }

    const { data: updated, error } = await this.supabase
      .from("purchase_orders")
      .update(updateData)
      .eq("id", id)
      .eq("organization_id", organizationId)
      .select()
      .single();

    if (error) {
      console.error("Error updating purchase order:", error);
      throw new Error(`Failed to update purchase order: ${error.message}`);
    }

    return updated;
  }

  /**
   * Add items to a purchase order
   */
  async addItemsToPurchaseOrder(
    purchaseOrderId: string,
    items: PurchaseOrderFormData["items"]
  ): Promise<PurchaseOrderItem[]> {
    const itemsToInsert = await Promise.all(
      items.map(async (item) => {
        // Get product details for denormalization
        const { data: product } = await this.supabase
          .from("products")
          .select("name, sku, unit")
          .eq("id", item.product_id)
          .single();

        let variantName: string | null = null;
        let supplierSku: string | null = null;

        if (item.product_variant_id) {
          const { data: variant } = await this.supabase
            .from("product_variants")
            .select("name, sku")
            .eq("id", item.product_variant_id)
            .single();
          variantName = variant?.name || null;
        }

        if (item.product_supplier_id) {
          const { data: prodSupplier } = await this.supabase
            .from("product_suppliers")
            .select("supplier_sku")
            .eq("id", item.product_supplier_id)
            .single();
          supplierSku = prodSupplier?.supplier_sku || null;
        }

        return {
          purchase_order_id: purchaseOrderId,
          product_id: item.product_id,
          product_variant_id: item.product_variant_id || null,
          product_supplier_id: item.product_supplier_id || null,
          product_name: product?.name || "Unknown Product",
          product_sku: product?.sku || null,
          supplier_sku: supplierSku,
          variant_name: variantName,
          quantity_ordered: item.quantity_ordered,
          unit_of_measure: product?.unit || "pcs",
          unit_price: item.unit_price,
          tax_rate: item.tax_rate || 0,
          discount_percent: item.discount_percent || 0,
          expected_location_id: item.expected_location_id || null,
          notes: item.notes || null,
        };
      })
    );

    const { data, error } = await this.supabase
      .from("purchase_order_items")
      .insert(itemsToInsert)
      .select();

    if (error) {
      console.error("Error adding items to purchase order:", error);
      throw new Error(`Failed to add items to purchase order: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Update a purchase order item
   */
  async updatePurchaseOrderItem(
    itemId: string,
    updates: Partial<PurchaseOrderItem>
  ): Promise<PurchaseOrderItem> {
    const { data, error } = await this.supabase
      .from("purchase_order_items")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", itemId)
      .select()
      .single();

    if (error) {
      console.error("Error updating purchase order item:", error);
      throw new Error(`Failed to update purchase order item: ${error.message}`);
    }

    return data;
  }

  /**
   * Delete a purchase order item (soft delete)
   */
  async deletePurchaseOrderItem(itemId: string): Promise<void> {
    const { error } = await this.supabase
      .from("purchase_order_items")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", itemId);

    if (error) {
      console.error("Error deleting purchase order item:", error);
      throw new Error(`Failed to delete purchase order item: ${error.message}`);
    }
  }

  /**
   * Submit purchase order for approval
   */
  async submitForApproval(id: string, organizationId: string): Promise<PurchaseOrder> {
    const { data, error } = await this.supabase
      .from("purchase_orders")
      .update({
        status: "pending",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("organization_id", organizationId)
      .eq("status", "draft") // Only allow draft → pending
      .select()
      .single();

    if (error) {
      console.error("Error submitting purchase order for approval:", error);
      throw new Error(`Failed to submit purchase order for approval: ${error.message}`);
    }

    return data;
  }

  /**
   * Approve a purchase order
   */
  async approvePurchaseOrder(
    id: string,
    organizationId: string,
    userId: string
  ): Promise<PurchaseOrder> {
    const { data, error } = await this.supabase
      .from("purchase_orders")
      .update({
        status: "approved",
        approved_at: new Date().toISOString(),
        approved_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("organization_id", organizationId)
      .eq("status", "pending") // Only allow pending → approved
      .select()
      .single();

    if (error) {
      console.error("Error approving purchase order:", error);
      throw new Error(`Failed to approve purchase order: ${error.message}`);
    }

    return data;
  }

  /**
   * Reject a purchase order (back to draft)
   */
  async rejectPurchaseOrder(
    id: string,
    organizationId: string,
    reason: string
  ): Promise<PurchaseOrder> {
    const { data, error } = await this.supabase
      .from("purchase_orders")
      .update({
        status: "draft",
        internal_notes: reason,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("organization_id", organizationId)
      .eq("status", "pending")
      .select()
      .single();

    if (error) {
      console.error("Error rejecting purchase order:", error);
      throw new Error(`Failed to reject purchase order: ${error.message}`);
    }

    return data;
  }

  /**
   * Cancel a purchase order
   */
  async cancelPurchaseOrder(
    id: string,
    organizationId: string,
    userId: string,
    reason: string
  ): Promise<PurchaseOrder> {
    const { data, error } = await this.supabase
      .from("purchase_orders")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        cancelled_by: userId,
        cancellation_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("organization_id", organizationId)
      .select()
      .single();

    if (error) {
      console.error("Error cancelling purchase order:", error);
      throw new Error(`Failed to cancel purchase order: ${error.message}`);
    }

    return data;
  }

  /**
   * Close a purchase order
   */
  async closePurchaseOrder(id: string, organizationId: string): Promise<PurchaseOrder> {
    const { data, error } = await this.supabase
      .from("purchase_orders")
      .update({
        status: "closed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("organization_id", organizationId)
      .select()
      .single();

    if (error) {
      console.error("Error closing purchase order:", error);
      throw new Error(`Failed to close purchase order: ${error.message}`);
    }

    return data;
  }

  /**
   * Receive items from a purchase order
   * Updates quantity_received on items
   * Status is automatically updated by database trigger
   */
  async receiveItems(
    purchaseOrderId: string,
    items: ReceivePurchaseOrderData["items"]
  ): Promise<void> {
    for (const item of items) {
      const { data: currentItem, error: fetchError } = await this.supabase
        .from("purchase_order_items")
        .select("quantity_ordered, quantity_received")
        .eq("id", item.purchase_order_item_id)
        .single();

      if (fetchError || !currentItem) {
        throw new Error(`Item not found: ${item.purchase_order_item_id}`);
      }

      const newQuantityReceived = (currentItem.quantity_received || 0) + item.quantity_to_receive;

      if (newQuantityReceived > currentItem.quantity_ordered) {
        throw new Error(
          `Cannot receive more than ordered quantity for item ${item.purchase_order_item_id}`
        );
      }

      const { error: updateError } = await this.supabase
        .from("purchase_order_items")
        .update({
          quantity_received: newQuantityReceived,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.purchase_order_item_id);

      if (updateError) {
        throw new Error(`Failed to update item: ${updateError.message}`);
      }
    }
  }

  /**
   * Delete a purchase order (soft delete)
   */
  async deletePurchaseOrder(id: string, organizationId: string): Promise<void> {
    const { error } = await this.supabase
      .from("purchase_orders")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .eq("organization_id", organizationId);

    if (error) {
      console.error("Error deleting purchase order:", error);
      throw new Error(`Failed to delete purchase order: ${error.message}`);
    }
  }

  /**
   * Get purchase order statistics
   */
  async getStatistics(organizationId: string): Promise<PurchaseOrderStatistics> {
    const { data, error } = await this.supabase
      .from("purchase_orders")
      .select("status, total_amount, amount_paid, expected_delivery_date")
      .eq("organization_id", organizationId)
      .is("deleted_at", null);

    if (error) {
      throw new Error(`Failed to fetch statistics: ${error.message}`);
    }

    const pos = data || [];
    const today = new Date().toISOString().split("T")[0];
    const weekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    return {
      total_pos: pos.length,
      draft_count: pos.filter((p) => p.status === "draft").length,
      pending_approval_count: pos.filter((p) => p.status === "pending").length,
      approved_count: pos.filter((p) => p.status === "approved").length,
      partially_received_count: pos.filter((p) => p.status === "partially_received").length,
      received_count: pos.filter((p) => p.status === "received").length,
      total_value: pos.reduce((sum, p) => sum + (p.total_amount || 0), 0),
      total_unpaid: pos.reduce((sum, p) => sum + ((p.total_amount || 0) - (p.amount_paid || 0)), 0),
      overdue_count: pos.filter(
        (p) =>
          p.expected_delivery_date &&
          p.expected_delivery_date < today &&
          p.status !== "received" &&
          p.status !== "cancelled" &&
          p.status !== "closed"
      ).length,
      expected_this_week: pos.filter(
        (p) =>
          p.expected_delivery_date &&
          p.expected_delivery_date >= today &&
          p.expected_delivery_date <= weekFromNow &&
          p.status !== "received" &&
          p.status !== "cancelled" &&
          p.status !== "closed"
      ).length,
    };
  }
}
