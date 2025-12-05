/**
 * Receipt React Query Hooks
 * Client-side hooks for receipt document operations
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import {
  getReceiptByIdAction,
  getReceiptsAction,
  getPartialReceiptStatusAction,
  processDeliveryReceiptAction,
  cancelReceiptAction,
} from "@/app/[locale]/dashboard/warehouse/receipts/_actions";
import type {
  ProcessDeliveryReceiptInput,
  CancelReceiptInput,
  ReceiptFiltersInput,
} from "@/server/schemas/receipts.schema";

// =====================================================
// QUERY KEYS
// =====================================================

export const receiptKeys = {
  all: ["receipts"] as const,
  lists: () => [...receiptKeys.all, "list"] as const,
  list: (filters: ReceiptFiltersInput) => [...receiptKeys.lists(), filters] as const,
  details: () => [...receiptKeys.all, "detail"] as const,
  detail: (id: string) => [...receiptKeys.details(), id] as const,
  partialStatus: (deliveryMovementId: string) =>
    [...receiptKeys.all, "partial-status", deliveryMovementId] as const,
};

// =====================================================
// QUERY HOOKS
// =====================================================

/**
 * Get all receipts with filters
 */
export function useReceipts(filters: ReceiptFiltersInput = {}) {
  return useQuery({
    queryKey: receiptKeys.list(filters),
    queryFn: async () => {
      const result = await getReceiptsAction(filters);
      if (!result.success) {
        throw new Error(result.error);
      }
      return { receipts: result.data, total: result.total };
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Get a single receipt by ID
 */
export function useReceipt(id: string | null) {
  return useQuery({
    queryKey: receiptKeys.detail(id || ""),
    queryFn: async () => {
      if (!id) throw new Error("Receipt ID is required");
      const result = await getReceiptByIdAction(id);
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
 * Get partial receipt status for a delivery movement
 */
export function usePartialReceiptStatus(deliveryMovementId: string | null) {
  return useQuery({
    queryKey: receiptKeys.partialStatus(deliveryMovementId || ""),
    queryFn: async () => {
      if (!deliveryMovementId) throw new Error("Delivery movement ID is required");
      const result = await getPartialReceiptStatusAction(deliveryMovementId);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data;
    },
    enabled: !!deliveryMovementId,
    staleTime: 1 * 60 * 1000, // 1 minute (shorter for real-time partial receipt tracking)
  });
}

// =====================================================
// MUTATION HOOKS
// =====================================================

/**
 * Process a delivery receipt
 */
export function useProcessDeliveryReceipt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ProcessDeliveryReceiptInput) => {
      const result = await processDeliveryReceiptAction(input);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data;
    },
    onSuccess: (data) => {
      toast.success(`Receipt ${data.receipt_number || "processed"} successfully`);
      // Invalidate receipt queries
      queryClient.invalidateQueries({ queryKey: receiptKeys.lists() });
      if (data.receipt_id) {
        queryClient.invalidateQueries({ queryKey: receiptKeys.detail(data.receipt_id) });
      }
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ["stock-movements"] });
      queryClient.invalidateQueries({ queryKey: ["stock-inventory"] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to process receipt: ${error.message}`);
    },
  });
}

/**
 * Cancel a receipt
 */
export function useCancelReceipt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ receiptId, input }: { receiptId: string; input: CancelReceiptInput }) => {
      const result = await cancelReceiptAction(receiptId, input);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data;
    },
    onSuccess: (data) => {
      toast.success("Receipt cancelled successfully");
      // Invalidate receipt queries
      queryClient.invalidateQueries({ queryKey: receiptKeys.lists() });
      queryClient.invalidateQueries({ queryKey: receiptKeys.detail(data.receiptId) });
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ["stock-movements"] });
      queryClient.invalidateQueries({ queryKey: ["stock-inventory"] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to cancel receipt: ${error.message}`);
    },
  });
}
