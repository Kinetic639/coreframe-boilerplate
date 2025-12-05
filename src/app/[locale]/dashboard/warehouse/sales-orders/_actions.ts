"use server";

/**
 * Sales Orders Server Actions
 * Co-located with /dashboard/warehouse/sales-orders route
 */

import { getUserContext } from "@/lib/utils/assert-auth";
import {
  createSalesOrderSchema,
  updateSalesOrderSchema,
  salesOrderFiltersSchema,
  updateOrderStatusSchema,
  releaseReservationForItemSchema,
  type CreateSalesOrderInput,
  type UpdateSalesOrderInput,
  type SalesOrderFiltersInput,
  type UpdateOrderStatusInput,
  type SalesOrderStatus,
  type ReleaseReservationForItemInput,
} from "@/server/schemas/sales-orders.schema";

// =====================================================
// QUERY ACTIONS
// =====================================================

/**
 * Get all sales orders with filters
 */
export async function getSalesOrdersAction(filters: SalesOrderFiltersInput = {}) {
  try {
    const { user, supabase } = await getUserContext();
    const organizationId = user.user_metadata?.active_org_id;
    const branchId = user.user_metadata?.active_branch_id;

    if (!organizationId) {
      return { success: false, error: "Organization not found" };
    }

    const validatedFilters = salesOrderFiltersSchema.parse(filters);

    const result = await SalesOrdersService.getSalesOrders(
      supabase,
      organizationId,
      branchId || null,
      validatedFilters
    );

    return { success: true, data: result };
  } catch (error: any) {
    console.error("[getSalesOrdersAction]", error);
    return { success: false, error: error.message };
  }
}

/**
 * Get a single sales order by ID
 */
export async function getSalesOrderByIdAction(id: string) {
  try {
    const { user, supabase } = await getUserContext();
    const organizationId = user.user_metadata?.active_org_id;

    if (!organizationId) {
      return { success: false, error: "Organization not found" };
    }

    const salesOrder = await SalesOrdersService.getSalesOrderById(supabase, id, organizationId);

    if (!salesOrder) {
      return { success: false, error: "Sales order not found" };
    }

    return { success: true, data: salesOrder };
  } catch (error: any) {
    console.error("[getSalesOrderByIdAction]", error);
    return { success: false, error: error.message };
  }
}

/**
 * Get a sales order by order number
 */
export async function getSalesOrderByNumberAction(orderNumber: string) {
  try {
    const { user, supabase } = await getUserContext();
    const organizationId = user.user_metadata?.active_org_id;

    if (!organizationId) {
      return { success: false, error: "Organization not found" };
    }

    const salesOrder = await SalesOrdersService.getSalesOrderByNumber(
      supabase,
      orderNumber,
      organizationId
    );

    if (!salesOrder) {
      return { success: false, error: "Sales order not found" };
    }

    return { success: true, data: salesOrder };
  } catch (error: any) {
    console.error("[getSalesOrderByNumberAction]", error);
    return { success: false, error: error.message };
  }
}

/**
 * Get orders by customer
 */
export async function getOrdersByCustomerAction(customerId: string) {
  try {
    const { user, supabase } = await getUserContext();
    const organizationId = user.user_metadata?.active_org_id;

    if (!organizationId) {
      return { success: false, error: "Organization not found" };
    }

    const orders = await SalesOrdersService.getOrdersByCustomer(
      supabase,
      customerId,
      organizationId
    );

    return { success: true, data: orders };
  } catch (error: any) {
    console.error("[getOrdersByCustomerAction]", error);
    return { success: false, error: error.message };
  }
}

/**
 * Get orders by status
 */
export async function getOrdersByStatusAction(status: SalesOrderStatus) {
  try {
    const { user, supabase } = await getUserContext();
    const organizationId = user.user_metadata?.active_org_id;
    const branchId = user.user_metadata?.active_branch_id;

    if (!organizationId) {
      return { success: false, error: "Organization not found" };
    }

    const orders = await SalesOrdersService.getOrdersByStatus(
      supabase,
      status,
      organizationId,
      branchId || null
    );

    return { success: true, data: orders };
  } catch (error: any) {
    console.error("[getOrdersByStatusAction]", error);
    return { success: false, error: error.message };
  }
}

// =====================================================
// MUTATION ACTIONS - CRUD
// =====================================================

/**
 * Create a new sales order
 */
export async function createSalesOrderAction(input: CreateSalesOrderInput) {
  try {
    const { user, supabase } = await getUserContext();
    const organizationId = user.user_metadata?.active_org_id;
    const branchId = user.user_metadata?.active_branch_id;

    if (!organizationId) {
      return { success: false, error: "Organization not found" };
    }

    const validatedData = createSalesOrderSchema.parse(input);

    const salesOrder = await SalesOrdersService.createSalesOrder(
      supabase,
      organizationId,
      branchId || null,
      validatedData,
      user.id
    );

    return { success: true, data: salesOrder };
  } catch (error: any) {
    console.error("[createSalesOrderAction]", error);
    return { success: false, error: error.message };
  }
}

/**
 * Update a sales order
 */
export async function updateSalesOrderAction(id: string, input: UpdateSalesOrderInput) {
  try {
    const { user, supabase } = await getUserContext();
    const organizationId = user.user_metadata?.active_org_id;

    if (!organizationId) {
      return { success: false, error: "Organization not found" };
    }

    const validatedData = updateSalesOrderSchema.parse(input);

    const salesOrder = await SalesOrdersService.updateSalesOrder(
      supabase,
      id,
      organizationId,
      validatedData,
      user.id
    );

    return { success: true, data: salesOrder };
  } catch (error: any) {
    console.error("[updateSalesOrderAction]", error);
    return { success: false, error: error.message };
  }
}

/**
 * Delete a sales order
 */
export async function deleteSalesOrderAction(id: string) {
  try {
    const { user, supabase } = await getUserContext();
    const organizationId = user.user_metadata?.active_org_id;

    if (!organizationId) {
      return { success: false, error: "Organization not found" };
    }

    await SalesOrdersService.deleteSalesOrder(supabase, id, organizationId);

    return { success: true, data: null };
  } catch (error: any) {
    console.error("[deleteSalesOrderAction]", error);
    return { success: false, error: error.message };
  }
}

// =====================================================
// MUTATION ACTIONS - STATUS
// =====================================================

/**
 * Update sales order status
 */
export async function updateOrderStatusAction(id: string, input: UpdateOrderStatusInput) {
  try {
    const { user, supabase } = await getUserContext();
    const organizationId = user.user_metadata?.active_org_id;
    const branchId = user.user_metadata?.active_branch_id;

    if (!organizationId) {
      return { success: false, error: "Organization not found" };
    }

    const validatedData = updateOrderStatusSchema.parse(input);

    const salesOrder = await SalesOrdersService.updateOrderStatus(
      supabase,
      id,
      organizationId,
      branchId || null,
      validatedData,
      user.id
    );

    return { success: true, data: salesOrder };
  } catch (error: any) {
    console.error("[updateOrderStatusAction]", error);
    return { success: false, error: error.message };
  }
}

// =====================================================
// MUTATION ACTIONS - RESERVATIONS
// =====================================================

/**
 * Release reservation for an order item when fulfilled
 */
export async function releaseReservationForItemAction(input: ReleaseReservationForItemInput) {
  try {
    const { user, supabase } = await getUserContext();

    const validatedData = releaseReservationForItemSchema.parse(input);

    await SalesOrdersService.releaseReservationForItem(supabase, validatedData, user.id);

    return { success: true, data: null };
  } catch (error: any) {
    console.error("[releaseReservationForItemAction]", error);
    return { success: false, error: error.message };
  }
}
