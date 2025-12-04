import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import {
  createTransferRequestAction,
  getTransferRequestAction,
  listTransferRequestsAction,
  submitTransferAction,
  approveTransferAction,
  shipTransferAction,
  receiveTransferAction,
  cancelTransferAction,
  getTransferStatsAction,
} from "@/app/[locale]/dashboard/warehouse/transfers/_actions";
import type {
  CreateTransferRequestInput,
  ApproveTransferInput,
  ShipTransferInput,
  ReceiveTransferInput,
  CancelTransferInput,
  TransferFilters,
} from "@/server/schemas/inter-warehouse-transfers.schema";

// ==========================================
// QUERY KEYS
// ==========================================

export const interWarehouseTransfersKeys = {
  all: ["inter-warehouse-transfers"] as const,
  lists: () => [...interWarehouseTransfersKeys.all, "list"] as const,
  list: (branchId?: string, filters?: TransferFilters) =>
    [...interWarehouseTransfersKeys.lists(), { branchId, filters }] as const,
  details: () => [...interWarehouseTransfersKeys.all, "detail"] as const,
  detail: (id: string) => [...interWarehouseTransfersKeys.details(), id] as const,
  stats: (branchId?: string) => [...interWarehouseTransfersKeys.all, "stats", branchId] as const,
};

// ==========================================
// TRANSFER QUERIES
// ==========================================

/**
 * Hook to fetch a single transfer request by ID
 */
export function useTransferRequest(transferId: string | null) {
  return useQuery({
    queryKey: interWarehouseTransfersKeys.detail(transferId || ""),
    queryFn: async () => {
      if (!transferId) {
        throw new Error("Transfer ID is required");
      }

      const result = await getTransferRequestAction(transferId);

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
    enabled: !!transferId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Hook to list transfer requests with filters
 */
export function useTransferRequests(branchId?: string, filters?: TransferFilters) {
  return useQuery({
    queryKey: interWarehouseTransfersKeys.list(branchId, filters),
    queryFn: async () => {
      const result = await listTransferRequestsAction(branchId, filters);

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Hook to fetch transfer statistics
 */
export function useTransferStats(branchId?: string) {
  return useQuery({
    queryKey: interWarehouseTransfersKeys.stats(branchId),
    queryFn: async () => {
      const result = await getTransferStatsAction(branchId);

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// ==========================================
// TRANSFER MUTATIONS
// ==========================================

/**
 * Hook to create a new transfer request
 */
export function useCreateTransferRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Omit<CreateTransferRequestInput, "organization_id">) => {
      const result = await createTransferRequestAction(input);

      if (!result.success) {
        throw new Error(result.error);
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: interWarehouseTransfersKeys.lists() });
      queryClient.invalidateQueries({ queryKey: interWarehouseTransfersKeys.all });
      toast.success("Transfer request created successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create transfer request");
    },
  });
}

/**
 * Hook to submit transfer for approval
 */
export function useSubmitTransfer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (transferId: string) => {
      const result = await submitTransferAction(transferId);

      if (!result.success) {
        throw new Error(result.error);
      }

      return transferId;
    },
    onSuccess: (transferId) => {
      queryClient.invalidateQueries({ queryKey: interWarehouseTransfersKeys.lists() });
      queryClient.invalidateQueries({ queryKey: interWarehouseTransfersKeys.detail(transferId) });
      queryClient.invalidateQueries({ queryKey: interWarehouseTransfersKeys.all });
      toast.success("Transfer submitted for approval");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to submit transfer");
    },
  });
}

/**
 * Hook to approve transfer request
 */
export function useApproveTransfer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      transferId,
      input,
    }: {
      transferId: string;
      input: ApproveTransferInput;
    }) => {
      const result = await approveTransferAction(transferId, input);

      if (!result.success) {
        throw new Error(result.error);
      }

      return transferId;
    },
    onSuccess: (transferId) => {
      queryClient.invalidateQueries({ queryKey: interWarehouseTransfersKeys.lists() });
      queryClient.invalidateQueries({ queryKey: interWarehouseTransfersKeys.detail(transferId) });
      queryClient.invalidateQueries({ queryKey: interWarehouseTransfersKeys.all });
      toast.success("Transfer approved successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to approve transfer");
    },
  });
}

/**
 * Hook to ship transfer
 */
export function useShipTransfer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      transferId,
      input,
      movementIds,
    }: {
      transferId: string;
      input: ShipTransferInput;
      movementIds: string[];
    }) => {
      const result = await shipTransferAction(transferId, input, movementIds);

      if (!result.success) {
        throw new Error(result.error);
      }

      return { transferId, movementIds: result.movement_ids };
    },
    onSuccess: ({ transferId }) => {
      queryClient.invalidateQueries({ queryKey: interWarehouseTransfersKeys.lists() });
      queryClient.invalidateQueries({ queryKey: interWarehouseTransfersKeys.detail(transferId) });
      queryClient.invalidateQueries({ queryKey: interWarehouseTransfersKeys.all });
      queryClient.invalidateQueries({ queryKey: ["stock-movements"] });
      queryClient.invalidateQueries({ queryKey: ["stock-inventory"] });
      toast.success("Transfer shipped successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to ship transfer");
    },
  });
}

/**
 * Hook to receive transfer
 */
export function useReceiveTransfer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      transferId,
      input,
      movementIds,
    }: {
      transferId: string;
      input: ReceiveTransferInput;
      movementIds: string[];
    }) => {
      const result = await receiveTransferAction(transferId, input, movementIds);

      if (!result.success) {
        throw new Error(result.error);
      }

      return { transferId, movementIds: result.movement_ids };
    },
    onSuccess: ({ transferId }) => {
      queryClient.invalidateQueries({ queryKey: interWarehouseTransfersKeys.lists() });
      queryClient.invalidateQueries({ queryKey: interWarehouseTransfersKeys.detail(transferId) });
      queryClient.invalidateQueries({ queryKey: interWarehouseTransfersKeys.all });
      queryClient.invalidateQueries({ queryKey: ["stock-movements"] });
      queryClient.invalidateQueries({ queryKey: ["stock-inventory"] });
      toast.success("Transfer received successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to receive transfer");
    },
  });
}

/**
 * Hook to cancel transfer
 */
export function useCancelTransfer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      transferId,
      input,
    }: {
      transferId: string;
      input: CancelTransferInput;
    }) => {
      const result = await cancelTransferAction(transferId, input);

      if (!result.success) {
        throw new Error(result.error);
      }

      return transferId;
    },
    onSuccess: (transferId) => {
      queryClient.invalidateQueries({ queryKey: interWarehouseTransfersKeys.lists() });
      queryClient.invalidateQueries({ queryKey: interWarehouseTransfersKeys.detail(transferId) });
      queryClient.invalidateQueries({ queryKey: interWarehouseTransfersKeys.all });
      toast.success("Transfer cancelled successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to cancel transfer");
    },
  });
}
