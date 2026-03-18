/**
 * Purchase Orders Server Actions
 *
 * Next.js server actions that provide authenticated access to purchase orders functionality.
 * These actions wrap the service layer methods with proper authentication and error handling.
 */

"use server";

import { createClient } from "@/utils/supabase/server";
import { PurchaseOrdersService } from "../../api/purchase-orders-service";
import type {
  PurchaseOrderFormData,
  PurchaseOrderFilters,
  PurchaseOrdersResponse,
  PurchaseOrderWithRelations,
  ReceivePurchaseOrderData,
  PurchaseOrderStatistics,
} from "../../types/purchase-orders";

// =====================================================
// HELPER FUNCTIONS
// =====================================================

async function getAuthenticatedUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("Unauthorized: User not authenticated");
  }

  return { supabase, user };
}

// =====================================================
// READ OPERATIONS
// =====================================================

/**
 * Get all purchase orders with optional filtering
 */
export async function getPurchaseOrdersAction(
  organizationId: string,
  filters?: PurchaseOrderFilters
): Promise<{
  success: boolean;
  data?: PurchaseOrdersResponse;
  error?: string;
}> {
  try {
    const { supabase } = await getAuthenticatedUser();
    const service = new PurchaseOrdersService(supabase);

    const result = await service.getPurchaseOrders(organizationId, filters || {});

    return { success: true, data: result };
  } catch (error) {
    console.error("Error fetching purchase orders:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch purchase orders",
    };
  }
}

/**
 * Get a single purchase order by ID
 */
export async function getPurchaseOrderByIdAction(
  id: string,
  organizationId: string
): Promise<{
  success: boolean;
  data?: PurchaseOrderWithRelations;
  error?: string;
}> {
  try {
    const { supabase } = await getAuthenticatedUser();
    const service = new PurchaseOrdersService(supabase);

    const result = await service.getPurchaseOrderById(id, organizationId);

    if (!result) {
      return { success: false, error: "Purchase order not found" };
    }

    return { success: true, data: result };
  } catch (error) {
    console.error("Error fetching purchase order:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch purchase order",
    };
  }
}

/**
 * Get purchase order statistics
 */
export async function getPurchaseOrderStatisticsAction(organizationId: string): Promise<{
  success: boolean;
  data?: PurchaseOrderStatistics;
  error?: string;
}> {
  try {
    const { supabase } = await getAuthenticatedUser();
    const service = new PurchaseOrdersService(supabase);

    const result = await service.getStatistics(organizationId);

    return { success: true, data: result };
  } catch (error) {
    console.error("Error fetching purchase order statistics:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch purchase order statistics",
    };
  }
}

// =====================================================
// CREATE OPERATIONS
// =====================================================

/**
 * Create a new purchase order
 */
export async function createPurchaseOrderAction(
  organizationId: string,
  branchId: string | null,
  data: PurchaseOrderFormData
): Promise<{
  success: boolean;
  data?: PurchaseOrderWithRelations;
  error?: string;
}> {
  try {
    const { supabase, user } = await getAuthenticatedUser();
    const service = new PurchaseOrdersService(supabase);

    const result = await service.createPurchaseOrder(organizationId, branchId, data, user.id);

    return { success: true, data: result };
  } catch (error) {
    console.error("Error creating purchase order:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create purchase order",
    };
  }
}

// =====================================================
// UPDATE OPERATIONS
// =====================================================

/**
 * Update a purchase order
 */
export async function updatePurchaseOrderAction(
  id: string,
  organizationId: string,
  data: Partial<PurchaseOrderFormData>
): Promise<{
  success: boolean;
  data?: any;
  error?: string;
}> {
  try {
    const { supabase } = await getAuthenticatedUser();
    const service = new PurchaseOrdersService(supabase);

    const result = await service.updatePurchaseOrder(id, organizationId, data);

    return { success: true, data: result };
  } catch (error) {
    console.error("Error updating purchase order:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update purchase order",
    };
  }
}

/**
 * Update a purchase order item
 */
export async function updatePurchaseOrderItemAction(
  itemId: string,
  updates: any
): Promise<{
  success: boolean;
  data?: any;
  error?: string;
}> {
  try {
    const { supabase } = await getAuthenticatedUser();
    const service = new PurchaseOrdersService(supabase);

    const result = await service.updatePurchaseOrderItem(itemId, updates);

    return { success: true, data: result };
  } catch (error) {
    console.error("Error updating purchase order item:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update purchase order item",
    };
  }
}

// =====================================================
// DELETE OPERATIONS
// =====================================================

/**
 * Delete a purchase order (soft delete)
 */
export async function deletePurchaseOrderAction(
  id: string,
  organizationId: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { supabase } = await getAuthenticatedUser();
    const service = new PurchaseOrdersService(supabase);

    await service.deletePurchaseOrder(id, organizationId);

    return { success: true };
  } catch (error) {
    console.error("Error deleting purchase order:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete purchase order",
    };
  }
}

/**
 * Delete a purchase order item (soft delete)
 */
export async function deletePurchaseOrderItemAction(itemId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { supabase } = await getAuthenticatedUser();
    const service = new PurchaseOrdersService(supabase);

    await service.deletePurchaseOrderItem(itemId);

    return { success: true };
  } catch (error) {
    console.error("Error deleting purchase order item:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete purchase order item",
    };
  }
}

// =====================================================
// WORKFLOW OPERATIONS
// =====================================================

/**
 * Submit a purchase order for approval
 */
export async function submitPurchaseOrderAction(
  id: string,
  organizationId: string
): Promise<{
  success: boolean;
  data?: any;
  error?: string;
}> {
  try {
    const { supabase } = await getAuthenticatedUser();
    const service = new PurchaseOrdersService(supabase);

    const result = await service.submitForApproval(id, organizationId);

    return { success: true, data: result };
  } catch (error) {
    console.error("Error submitting purchase order:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to submit purchase order",
    };
  }
}

/**
 * Approve a purchase order
 */
export async function approvePurchaseOrderAction(
  id: string,
  organizationId: string
): Promise<{
  success: boolean;
  data?: any;
  error?: string;
}> {
  try {
    const { supabase, user } = await getAuthenticatedUser();
    const service = new PurchaseOrdersService(supabase);

    const result = await service.approvePurchaseOrder(id, organizationId, user.id);

    return { success: true, data: result };
  } catch (error) {
    console.error("Error approving purchase order:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to approve purchase order",
    };
  }
}

/**
 * Reject a purchase order
 */
export async function rejectPurchaseOrderAction(
  id: string,
  organizationId: string,
  reason: string
): Promise<{
  success: boolean;
  data?: any;
  error?: string;
}> {
  try {
    const { supabase } = await getAuthenticatedUser();
    const service = new PurchaseOrdersService(supabase);

    const result = await service.rejectPurchaseOrder(id, organizationId, reason);

    return { success: true, data: result };
  } catch (error) {
    console.error("Error rejecting purchase order:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to reject purchase order",
    };
  }
}

/**
 * Cancel a purchase order
 */
export async function cancelPurchaseOrderAction(
  id: string,
  organizationId: string,
  reason: string
): Promise<{
  success: boolean;
  data?: any;
  error?: string;
}> {
  try {
    const { supabase, user } = await getAuthenticatedUser();
    const service = new PurchaseOrdersService(supabase);

    const result = await service.cancelPurchaseOrder(id, organizationId, user.id, reason);

    return { success: true, data: result };
  } catch (error) {
    console.error("Error cancelling purchase order:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to cancel purchase order",
    };
  }
}

/**
 * Close a purchase order
 */
export async function closePurchaseOrderAction(
  id: string,
  organizationId: string
): Promise<{
  success: boolean;
  data?: any;
  error?: string;
}> {
  try {
    const { supabase } = await getAuthenticatedUser();
    const service = new PurchaseOrdersService(supabase);

    const result = await service.closePurchaseOrder(id, organizationId);

    return { success: true, data: result };
  } catch (error) {
    console.error("Error closing purchase order:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to close purchase order",
    };
  }
}

// =====================================================
// RECEIVING OPERATIONS
// =====================================================

/**
 * Receive items from a purchase order
 */
export async function receiveItemsAction(receiveData: ReceivePurchaseOrderData): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { supabase } = await getAuthenticatedUser();
    const service = new PurchaseOrdersService(supabase);

    await service.receiveItems(receiveData.purchase_order_id, receiveData.items);

    // TODO: Create stock movement (type 101) if create_stock_movement is true
    // This will be implemented when integrating with stock movements

    return { success: true };
  } catch (error) {
    console.error("Error receiving items:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to receive items",
    };
  }
}
