"use server";

/**
 * Purchase Orders Server Actions
 * Co-located with /dashboard/warehouse/purchases route
 */

import { getUserContext } from "@/lib/utils/assert-auth";
import { PurchaseOrdersService } from "@/server/services/purchase-orders.service";
import {
  createPurchaseOrderSchema,
  updatePurchaseOrderSchema,
  purchaseOrderFiltersSchema,
  updatePurchaseOrderItemSchema,
  rejectPurchaseOrderSchema,
  cancelPurchaseOrderSchema,
  receivePurchaseOrderSchema,
  type CreatePurchaseOrderInput,
  type UpdatePurchaseOrderInput,
  type PurchaseOrderFiltersInput,
  type UpdatePurchaseOrderItemInput,
  type RejectPurchaseOrderInput,
  type CancelPurchaseOrderInput,
  type ReceivePurchaseOrderInput,
} from "@/server/schemas/purchase-orders.schema";

// =====================================================
// QUERY ACTIONS
// =====================================================

/**
 * Get all purchase orders with filters
 */
export async function getPurchaseOrdersAction(filters: PurchaseOrderFiltersInput = {}) {
  try {
    const { user, supabase } = await getUserContext();
    const organizationId = user.user_metadata?.active_org_id;

    if (!organizationId) {
      return { success: false, error: "Organization not found" };
    }

    const validatedFilters = purchaseOrderFiltersSchema.parse(filters);

    const result = await PurchaseOrdersService.getPurchaseOrders(
      supabase,
      organizationId,
      validatedFilters
    );

    return { success: true, data: result };
  } catch (error: any) {
    console.error("[getPurchaseOrdersAction]", error);
    return { success: false, error: error.message };
  }
}

/**
 * Get a single purchase order by ID
 */
export async function getPurchaseOrderByIdAction(id: string) {
  try {
    const { user, supabase } = await getUserContext();
    const organizationId = user.user_metadata?.active_org_id;

    if (!organizationId) {
      return { success: false, error: "Organization not found" };
    }

    const purchaseOrder = await PurchaseOrdersService.getPurchaseOrderById(
      supabase,
      id,
      organizationId
    );

    if (!purchaseOrder) {
      return { success: false, error: "Purchase order not found" };
    }

    return { success: true, data: purchaseOrder };
  } catch (error: any) {
    console.error("[getPurchaseOrderByIdAction]", error);
    return { success: false, error: error.message };
  }
}

/**
 * Get purchase order items
 */
export async function getPurchaseOrderItemsAction(purchaseOrderId: string) {
  try {
    const { supabase } = await getUserContext();

    const items = await PurchaseOrdersService.getPurchaseOrderItems(supabase, purchaseOrderId);

    return { success: true, data: items };
  } catch (error: any) {
    console.error("[getPurchaseOrderItemsAction]", error);
    return { success: false, error: error.message };
  }
}

/**
 * Get purchase order statistics
 */
export async function getPurchaseOrderStatisticsAction() {
  try {
    const { user, supabase } = await getUserContext();
    const organizationId = user.user_metadata?.active_org_id;

    if (!organizationId) {
      return { success: false, error: "Organization not found" };
    }

    const statistics = await PurchaseOrdersService.getStatistics(supabase, organizationId);

    return { success: true, data: statistics };
  } catch (error: any) {
    console.error("[getPurchaseOrderStatisticsAction]", error);
    return { success: false, error: error.message };
  }
}

// =====================================================
// MUTATION ACTIONS - CRUD
// =====================================================

/**
 * Create a new purchase order
 */
export async function createPurchaseOrderAction(input: CreatePurchaseOrderInput) {
  try {
    const { user, supabase } = await getUserContext();
    const organizationId = user.user_metadata?.active_org_id;
    const branchId = user.user_metadata?.active_branch_id;

    if (!organizationId) {
      return { success: false, error: "Organization not found" };
    }

    const validatedData = createPurchaseOrderSchema.parse(input);

    const purchaseOrder = await PurchaseOrdersService.createPurchaseOrder(
      supabase,
      organizationId,
      branchId || null,
      validatedData,
      user.id
    );

    return { success: true, data: purchaseOrder };
  } catch (error: any) {
    console.error("[createPurchaseOrderAction]", error);
    return { success: false, error: error.message };
  }
}

/**
 * Update a purchase order
 */
export async function updatePurchaseOrderAction(id: string, input: UpdatePurchaseOrderInput) {
  try {
    const { user, supabase } = await getUserContext();
    const organizationId = user.user_metadata?.active_org_id;

    if (!organizationId) {
      return { success: false, error: "Organization not found" };
    }

    const validatedData = updatePurchaseOrderSchema.parse(input);

    const purchaseOrder = await PurchaseOrdersService.updatePurchaseOrder(
      supabase,
      id,
      organizationId,
      validatedData
    );

    return { success: true, data: purchaseOrder };
  } catch (error: any) {
    console.error("[updatePurchaseOrderAction]", error);
    return { success: false, error: error.message };
  }
}

/**
 * Delete a purchase order
 */
export async function deletePurchaseOrderAction(id: string) {
  try {
    const { user, supabase } = await getUserContext();
    const organizationId = user.user_metadata?.active_org_id;

    if (!organizationId) {
      return { success: false, error: "Organization not found" };
    }

    await PurchaseOrdersService.deletePurchaseOrder(supabase, id, organizationId);

    return { success: true, data: null };
  } catch (error: any) {
    console.error("[deletePurchaseOrderAction]", error);
    return { success: false, error: error.message };
  }
}

// =====================================================
// MUTATION ACTIONS - ITEMS
// =====================================================

/**
 * Update a purchase order item
 */
export async function updatePurchaseOrderItemAction(
  itemId: string,
  input: UpdatePurchaseOrderItemInput
) {
  try {
    const { supabase } = await getUserContext();

    const validatedData = updatePurchaseOrderItemSchema.parse(input);

    const item = await PurchaseOrdersService.updatePurchaseOrderItem(
      supabase,
      itemId,
      validatedData
    );

    return { success: true, data: item };
  } catch (error: any) {
    console.error("[updatePurchaseOrderItemAction]", error);
    return { success: false, error: error.message };
  }
}

/**
 * Delete a purchase order item
 */
export async function deletePurchaseOrderItemAction(itemId: string) {
  try {
    const { supabase } = await getUserContext();

    await PurchaseOrdersService.deletePurchaseOrderItem(supabase, itemId);

    return { success: true, data: null };
  } catch (error: any) {
    console.error("[deletePurchaseOrderItemAction]", error);
    return { success: false, error: error.message };
  }
}

// =====================================================
// MUTATION ACTIONS - WORKFLOW
// =====================================================

/**
 * Submit purchase order for approval
 */
export async function submitForApprovalAction(id: string) {
  try {
    const { user, supabase } = await getUserContext();
    const organizationId = user.user_metadata?.active_org_id;

    if (!organizationId) {
      return { success: false, error: "Organization not found" };
    }

    const purchaseOrder = await PurchaseOrdersService.submitForApproval(
      supabase,
      id,
      organizationId
    );

    return { success: true, data: purchaseOrder };
  } catch (error: any) {
    console.error("[submitForApprovalAction]", error);
    return { success: false, error: error.message };
  }
}

/**
 * Approve a purchase order
 */
export async function approvePurchaseOrderAction(id: string) {
  try {
    const { user, supabase } = await getUserContext();
    const organizationId = user.user_metadata?.active_org_id;

    if (!organizationId) {
      return { success: false, error: "Organization not found" };
    }

    const purchaseOrder = await PurchaseOrdersService.approvePurchaseOrder(
      supabase,
      id,
      organizationId,
      user.id
    );

    return { success: true, data: purchaseOrder };
  } catch (error: any) {
    console.error("[approvePurchaseOrderAction]", error);
    return { success: false, error: error.message };
  }
}

/**
 * Reject a purchase order
 */
export async function rejectPurchaseOrderAction(id: string, input: RejectPurchaseOrderInput) {
  try {
    const { user, supabase } = await getUserContext();
    const organizationId = user.user_metadata?.active_org_id;

    if (!organizationId) {
      return { success: false, error: "Organization not found" };
    }

    const validatedData = rejectPurchaseOrderSchema.parse(input);

    const purchaseOrder = await PurchaseOrdersService.rejectPurchaseOrder(
      supabase,
      id,
      organizationId,
      validatedData
    );

    return { success: true, data: purchaseOrder };
  } catch (error: any) {
    console.error("[rejectPurchaseOrderAction]", error);
    return { success: false, error: error.message };
  }
}

/**
 * Cancel a purchase order
 */
export async function cancelPurchaseOrderAction(id: string, input: CancelPurchaseOrderInput) {
  try {
    const { user, supabase } = await getUserContext();
    const organizationId = user.user_metadata?.active_org_id;

    if (!organizationId) {
      return { success: false, error: "Organization not found" };
    }

    const validatedData = cancelPurchaseOrderSchema.parse(input);

    const purchaseOrder = await PurchaseOrdersService.cancelPurchaseOrder(
      supabase,
      id,
      organizationId,
      user.id,
      validatedData
    );

    return { success: true, data: purchaseOrder };
  } catch (error: any) {
    console.error("[cancelPurchaseOrderAction]", error);
    return { success: false, error: error.message };
  }
}

/**
 * Close a purchase order
 */
export async function closePurchaseOrderAction(id: string) {
  try {
    const { user, supabase } = await getUserContext();
    const organizationId = user.user_metadata?.active_org_id;

    if (!organizationId) {
      return { success: false, error: "Organization not found" };
    }

    const purchaseOrder = await PurchaseOrdersService.closePurchaseOrder(
      supabase,
      id,
      organizationId
    );

    return { success: true, data: purchaseOrder };
  } catch (error: any) {
    console.error("[closePurchaseOrderAction]", error);
    return { success: false, error: error.message };
  }
}

// =====================================================
// MUTATION ACTIONS - RECEIVING
// =====================================================

/**
 * Receive items from a purchase order
 */
export async function receiveItemsAction(input: ReceivePurchaseOrderInput) {
  try {
    const { supabase } = await getUserContext();

    const validatedData = receivePurchaseOrderSchema.parse(input);

    await PurchaseOrdersService.receiveItems(supabase, validatedData);

    return { success: true, data: null };
  } catch (error: any) {
    console.error("[receiveItemsAction]", error);
    return { success: false, error: error.message };
  }
}
