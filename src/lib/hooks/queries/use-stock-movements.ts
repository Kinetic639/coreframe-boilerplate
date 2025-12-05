import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import {
  getMovements,
  getMovementsWithRelations,
  getMovementById,
  createMovement,
  updateMovement,
  approveMovement,
  completeMovement,
  cancelMovement,
  getPendingApprovals,
  getStatistics,
  getInventoryLevels,
  checkStockAvailability,
  getStockLevel,
} from "@/app/[locale]/dashboard/warehouse/movements/_actions";
import type {
  StockMovementFilters,
  CreateStockMovementInput,
  UpdateStockMovementInput,
  ApproveMovementInput,
  CompleteMovementInput,
  CancelMovementInput,
  CheckStockAvailabilityInput,
} from "@/server/schemas/stock-movements.schema";

/**
 * Hook to fetch movements with optional filters
 */
export function useMovements(filters?: StockMovementFilters) {
  return useQuery({
    queryKey: ["movements", filters],
    queryFn: async () => {
      return await getMovements(filters || { page: 1, pageSize: 50 });
    },
    staleTime: 2 * 60 * 1000, // 2 minutes (movements change frequently)
  });
}

/**
 * Hook to fetch movements with full relations
 */
export function useMovementsWithRelations(filters?: StockMovementFilters) {
  return useQuery({
    queryKey: ["movements", "with-relations", filters],
    queryFn: async () => {
      return await getMovementsWithRelations(filters || { page: 1, pageSize: 50 });
    },
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Hook to fetch a single movement by ID
 */
export function useMovement(movementId: string | null) {
  return useQuery({
    queryKey: ["movement", movementId],
    queryFn: async () => {
      if (!movementId) return null;
      return await getMovementById(movementId);
    },
    enabled: !!movementId,
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Hook to create a new movement
 */
export function useCreateMovement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateStockMovementInput) => {
      return await createMovement(input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["movements"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-levels"] });
      queryClient.invalidateQueries({ queryKey: ["stock-level"] });
      queryClient.invalidateQueries({ queryKey: ["statistics"] });
      toast.success("Stock movement created successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create movement");
    },
  });
}

/**
 * Hook to update an existing movement
 */
export function useUpdateMovement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      movementId,
      input,
    }: {
      movementId: string;
      input: UpdateStockMovementInput;
    }) => {
      return await updateMovement(movementId, input);
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["movements"] });
      queryClient.invalidateQueries({ queryKey: ["movement", variables.movementId] });
      toast.success("Movement updated successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update movement");
    },
  });
}

/**
 * Hook to approve a movement
 */
export function useApproveMovement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ApproveMovementInput) => {
      return await approveMovement(input);
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["movements"] });
      queryClient.invalidateQueries({ queryKey: ["movement", variables.movement_id] });
      queryClient.invalidateQueries({ queryKey: ["pending-approvals"] });
      queryClient.invalidateQueries({ queryKey: ["statistics"] });
      toast.success("Movement approved successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to approve movement");
    },
  });
}

/**
 * Hook to complete a movement
 */
export function useCompleteMovement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CompleteMovementInput) => {
      return await completeMovement(input);
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["movements"] });
      queryClient.invalidateQueries({ queryKey: ["movement", variables.movement_id] });
      queryClient.invalidateQueries({ queryKey: ["inventory-levels"] });
      queryClient.invalidateQueries({ queryKey: ["stock-level"] });
      queryClient.invalidateQueries({ queryKey: ["statistics"] });
      toast.success("Movement completed successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to complete movement");
    },
  });
}

/**
 * Hook to cancel a movement
 */
export function useCancelMovement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CancelMovementInput) => {
      return await cancelMovement(input);
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["movements"] });
      queryClient.invalidateQueries({ queryKey: ["movement", variables.movement_id] });
      queryClient.invalidateQueries({ queryKey: ["statistics"] });
      toast.success("Movement cancelled successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to cancel movement");
    },
  });
}

/**
 * Hook to fetch pending approvals
 */
export function usePendingApprovals(limit = 50) {
  return useQuery({
    queryKey: ["pending-approvals", limit],
    queryFn: async () => {
      return await getPendingApprovals(limit);
    },
    staleTime: 1 * 60 * 1000, // 1 minute (approvals should be fresh)
  });
}

/**
 * Hook to fetch movement statistics
 */
export function useStatistics(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ["statistics", startDate, endDate],
    queryFn: async () => {
      return await getStatistics(startDate, endDate);
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch inventory levels
 */
export function useInventoryLevels(locationId?: string, productId?: string) {
  return useQuery({
    queryKey: ["inventory-levels", locationId, productId],
    queryFn: async () => {
      return await getInventoryLevels(locationId, productId);
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Hook to check stock availability
 */
export function useCheckStockAvailability() {
  return useMutation({
    mutationFn: async (input: CheckStockAvailabilityInput) => {
      return await checkStockAvailability(input);
    },
  });
}

/**
 * Hook to fetch stock level for specific product/location
 */
export function useStockLevel(
  productId: string | null,
  locationId: string | null,
  variantId?: string | null
) {
  return useQuery({
    queryKey: ["stock-level", productId, locationId, variantId],
    queryFn: async () => {
      if (!productId || !locationId) return null;
      return await getStockLevel(productId, locationId, variantId);
    },
    enabled: !!productId && !!locationId,
    staleTime: 2 * 60 * 1000,
  });
}
