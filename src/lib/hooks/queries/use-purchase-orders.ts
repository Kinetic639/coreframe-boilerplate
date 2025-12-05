/**
 * Purchase Orders React Query Hooks
 * Client-side hooks for purchase order operations
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import {
  getPurchaseOrdersAction,
  getPurchaseOrderByIdAction,
  getPurchaseOrderItemsAction,
  getPurchaseOrderStatisticsAction,
  createPurchaseOrderAction,
  updatePurchaseOrderAction,
  deletePurchaseOrderAction,
  updatePurchaseOrderItemAction,
  deletePurchaseOrderItemAction,
  submitForApprovalAction,
  approvePurchaseOrderAction,
  rejectPurchaseOrderAction,
  cancelPurchaseOrderAction,
  closePurchaseOrderAction,
  receiveItemsAction,
} from "@/app/[locale]/dashboard/warehouse/purchases/_actions";
import type {
  CreatePurchaseOrderInput,
  UpdatePurchaseOrderInput,
  PurchaseOrderFiltersInput,
  UpdatePurchaseOrderItemInput,
  RejectPurchaseOrderInput,
  CancelPurchaseOrderInput,
  ReceivePurchaseOrderInput,
} from "@/server/schemas/purchase-orders.schema";

// =====================================================
// QUERY KEYS
// =====================================================

export const purchaseOrderKeys = {
  all: ["purchase-orders"] as const,
  lists: () => [...purchaseOrderKeys.all, "list"] as const,
  list: (filters: PurchaseOrderFiltersInput) => [...purchaseOrderKeys.lists(), filters] as const,
  details: () => [...purchaseOrderKeys.all, "detail"] as const,
  detail: (id: string) => [...purchaseOrderKeys.details(), id] as const,
  items: (id: string) => [...purchaseOrderKeys.all, "items", id] as const,
  statistics: () => [...purchaseOrderKeys.all, "statistics"] as const,
};

// =====================================================
// QUERY HOOKS
// =====================================================

/**
 * Get all purchase orders with filters
 */
export function usePurchaseOrders(filters: PurchaseOrderFiltersInput = {}) {
  return useQuery({
    queryKey: purchaseOrderKeys.list(filters),
    queryFn: async () => {
      const result = await getPurchaseOrdersAction(filters);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Get a single purchase order by ID
 */
export function usePurchaseOrder(id: string | null) {
  return useQuery({
    queryKey: purchaseOrderKeys.detail(id || ""),
    queryFn: async () => {
      if (!id) throw new Error("Purchase order ID is required");
      const result = await getPurchaseOrderByIdAction(id);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data;
    },
    enabled: !!id,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Get purchase order items
 */
export function usePurchaseOrderItems(purchaseOrderId: string | null) {
  return useQuery({
    queryKey: purchaseOrderKeys.items(purchaseOrderId || ""),
    queryFn: async () => {
      if (!purchaseOrderId) throw new Error("Purchase order ID is required");
      const result = await getPurchaseOrderItemsAction(purchaseOrderId);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data;
    },
    enabled: !!purchaseOrderId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Get purchase order statistics
 */
export function usePurchaseOrderStatistics() {
  return useQuery({
    queryKey: purchaseOrderKeys.statistics(),
    queryFn: async () => {
      const result = await getPurchaseOrderStatisticsAction();
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// =====================================================
// MUTATION HOOKS - CRUD
// =====================================================

/**
 * Create a new purchase order
 */
export function useCreatePurchaseOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreatePurchaseOrderInput) => {
      const result = await createPurchaseOrderAction(input);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data;
    },
    onSuccess: () => {
      toast.success("Purchase order created successfully");
      queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.lists() });
      queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.statistics() });
    },
    onError: (error: Error) => {
      toast.error(`Failed to create purchase order: ${error.message}`);
    },
  });
}

/**
 * Update a purchase order
 */
export function useUpdatePurchaseOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdatePurchaseOrderInput }) => {
      const result = await updatePurchaseOrderAction(id, data);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data;
    },
    onSuccess: (_, variables) => {
      toast.success("Purchase order updated successfully");
      queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.lists() });
      queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.statistics() });
    },
    onError: (error: Error) => {
      toast.error(`Failed to update purchase order: ${error.message}`);
    },
  });
}

/**
 * Delete a purchase order
 */
export function useDeletePurchaseOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const result = await deletePurchaseOrderAction(id);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data;
    },
    onSuccess: () => {
      toast.success("Purchase order deleted successfully");
      queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.lists() });
      queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.statistics() });
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete purchase order: ${error.message}`);
    },
  });
}

// =====================================================
// MUTATION HOOKS - ITEMS
// =====================================================

/**
 * Update a purchase order item
 */
export function useUpdatePurchaseOrderItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      itemId,
      purchaseOrderId: _purchaseOrderId,
      data,
    }: {
      itemId: string;
      purchaseOrderId: string;
      data: UpdatePurchaseOrderItemInput;
    }) => {
      const result = await updatePurchaseOrderItemAction(itemId, data);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data;
    },
    onSuccess: (_, variables) => {
      toast.success("Item updated successfully");
      queryClient.invalidateQueries({
        queryKey: purchaseOrderKeys.items(variables.purchaseOrderId),
      });
      queryClient.invalidateQueries({
        queryKey: purchaseOrderKeys.detail(variables.purchaseOrderId),
      });
      queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.lists() });
    },
    onError: (error: Error) => {
      toast.error(`Failed to update item: ${error.message}`);
    },
  });
}

/**
 * Delete a purchase order item
 */
export function useDeletePurchaseOrderItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      itemId,
      purchaseOrderId: _purchaseOrderId,
    }: {
      itemId: string;
      purchaseOrderId: string;
    }) => {
      const result = await deletePurchaseOrderItemAction(itemId);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data;
    },
    onSuccess: (_, variables) => {
      toast.success("Item deleted successfully");
      queryClient.invalidateQueries({
        queryKey: purchaseOrderKeys.items(variables.purchaseOrderId),
      });
      queryClient.invalidateQueries({
        queryKey: purchaseOrderKeys.detail(variables.purchaseOrderId),
      });
      queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.lists() });
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete item: ${error.message}`);
    },
  });
}

// =====================================================
// MUTATION HOOKS - WORKFLOW
// =====================================================

/**
 * Submit purchase order for approval
 */
export function useSubmitForApproval() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const result = await submitForApprovalAction(id);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data;
    },
    onSuccess: (_, id) => {
      toast.success("Purchase order submitted for approval");
      queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.lists() });
      queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.statistics() });
    },
    onError: (error: Error) => {
      toast.error(`Failed to submit for approval: ${error.message}`);
    },
  });
}

/**
 * Approve a purchase order
 */
export function useApprovePurchaseOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const result = await approvePurchaseOrderAction(id);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data;
    },
    onSuccess: (_, id) => {
      toast.success("Purchase order approved successfully");
      queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.lists() });
      queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.statistics() });
    },
    onError: (error: Error) => {
      toast.error(`Failed to approve purchase order: ${error.message}`);
    },
  });
}

/**
 * Reject a purchase order
 */
export function useRejectPurchaseOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: RejectPurchaseOrderInput }) => {
      const result = await rejectPurchaseOrderAction(id, data);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data;
    },
    onSuccess: (_, variables) => {
      toast.success("Purchase order rejected");
      queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.lists() });
      queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.statistics() });
    },
    onError: (error: Error) => {
      toast.error(`Failed to reject purchase order: ${error.message}`);
    },
  });
}

/**
 * Cancel a purchase order
 */
export function useCancelPurchaseOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: CancelPurchaseOrderInput }) => {
      const result = await cancelPurchaseOrderAction(id, data);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data;
    },
    onSuccess: (_, variables) => {
      toast.success("Purchase order cancelled successfully");
      queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.lists() });
      queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.statistics() });
    },
    onError: (error: Error) => {
      toast.error(`Failed to cancel purchase order: ${error.message}`);
    },
  });
}

/**
 * Close a purchase order
 */
export function useClosePurchaseOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const result = await closePurchaseOrderAction(id);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data;
    },
    onSuccess: (_, id) => {
      toast.success("Purchase order closed successfully");
      queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.lists() });
      queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.statistics() });
    },
    onError: (error: Error) => {
      toast.error(`Failed to close purchase order: ${error.message}`);
    },
  });
}

// =====================================================
// MUTATION HOOKS - RECEIVING
// =====================================================

/**
 * Receive items from a purchase order
 */
export function useReceiveItems() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ReceivePurchaseOrderInput) => {
      const result = await receiveItemsAction(input);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data;
    },
    onSuccess: (_, variables) => {
      toast.success("Items received successfully");
      queryClient.invalidateQueries({
        queryKey: purchaseOrderKeys.detail(variables.purchase_order_id),
      });
      queryClient.invalidateQueries({
        queryKey: purchaseOrderKeys.items(variables.purchase_order_id),
      });
      queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.lists() });
      queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.statistics() });
      // Also invalidate inventory/stock queries
      queryClient.invalidateQueries({ queryKey: ["stock-inventory"] });
      queryClient.invalidateQueries({ queryKey: ["stock-movements"] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to receive items: ${error.message}`);
    },
  });
}
