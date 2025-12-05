import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import {
  validateAvailabilityAction,
  createReservationAction,
  releaseReservationAction,
  cancelReservationAction,
  getReservationAction,
  getReservationWithDetailsAction,
  getReservationsAction,
  getExpiredReservationsAction,
  getAvailableInventoryAction,
} from "@/app/[locale]/dashboard/warehouse/inventory/reservations/_actions";
import type {
  CreateReservationInput,
  ReleaseReservationInput,
  CancelReservationInput,
  ReservationFiltersInput,
} from "@/server/schemas/reservations.schema";

// ==========================================
// QUERY KEYS
// ==========================================

export const reservationKeys = {
  all: ["reservations"] as const,
  lists: () => [...reservationKeys.all, "list"] as const,
  list: (filters: ReservationFiltersInput) => [...reservationKeys.lists(), filters] as const,
  details: () => [...reservationKeys.all, "detail"] as const,
  detail: (id: string) => [...reservationKeys.details(), id] as const,
  detailWithData: (id: string) => [...reservationKeys.details(), "with-data", id] as const,
  expired: () => [...reservationKeys.all, "expired"] as const,
  availability: (productId: string, variantId: string | undefined, locationId: string) =>
    [...reservationKeys.all, "availability", productId, variantId, locationId] as const,
  inventory: (productId: string, variantId: string | undefined, locationId: string) =>
    [...reservationKeys.all, "inventory", productId, variantId, locationId] as const,
};

// ==========================================
// QUERIES
// ==========================================

/**
 * Validate stock availability for reservation
 */
export function useValidateAvailability(
  productId: string,
  variantId: string | undefined,
  locationId: string,
  requestedQuantity: number,
  enabled = true
) {
  return useQuery({
    queryKey: reservationKeys.availability(productId, variantId, locationId),
    queryFn: async () => {
      const result = await validateAvailabilityAction(
        productId,
        variantId,
        locationId,
        requestedQuantity
      );

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data!;
    },
    enabled,
  });
}

/**
 * Get reservation by ID
 */
export function useReservation(id: string | null) {
  return useQuery({
    queryKey: reservationKeys.detail(id || ""),
    queryFn: async () => {
      if (!id) return null;

      const result = await getReservationAction(id);

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
    enabled: !!id,
  });
}

/**
 * Get reservation with details
 */
export function useReservationWithDetails(id: string | null) {
  return useQuery({
    queryKey: reservationKeys.detailWithData(id || ""),
    queryFn: async () => {
      if (!id) return null;

      const result = await getReservationWithDetailsAction(id);

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
    enabled: !!id,
  });
}

/**
 * Get reservations with filters
 */
export function useReservations(filters: ReservationFiltersInput = {}) {
  return useQuery({
    queryKey: reservationKeys.list(filters),
    queryFn: async () => {
      const result = await getReservationsAction(filters);

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
  });
}

/**
 * Get expired reservations
 */
export function useExpiredReservations() {
  return useQuery({
    queryKey: reservationKeys.expired(),
    queryFn: async () => {
      const result = await getExpiredReservationsAction();

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
  });
}

/**
 * Get available inventory
 */
export function useAvailableInventory(
  productId: string | null,
  variantId: string | undefined,
  locationId: string | null
) {
  return useQuery({
    queryKey: reservationKeys.inventory(productId || "", variantId, locationId || ""),
    queryFn: async () => {
      if (!productId || !locationId) return null;

      const result = await getAvailableInventoryAction(productId, variantId, locationId);

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
    enabled: !!productId && !!locationId,
  });
}

// ==========================================
// MUTATIONS
// ==========================================

/**
 * Create a new reservation
 */
export function useCreateReservation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateReservationInput) => {
      const result = await createReservationAction(input);

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
    onSuccess: () => {
      toast.success("Reservation created successfully");
      queryClient.invalidateQueries({ queryKey: reservationKeys.lists() });
      queryClient.invalidateQueries({ queryKey: reservationKeys.all });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create reservation");
    },
  });
}

/**
 * Release (fulfill) a reservation
 */
export function useReleaseReservation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ReleaseReservationInput) => {
      const result = await releaseReservationAction(input);

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
    onSuccess: (_, variables) => {
      toast.success("Reservation released successfully");
      queryClient.invalidateQueries({ queryKey: reservationKeys.detail(variables.reservationId) });
      queryClient.invalidateQueries({
        queryKey: reservationKeys.detailWithData(variables.reservationId),
      });
      queryClient.invalidateQueries({ queryKey: reservationKeys.lists() });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to release reservation");
    },
  });
}

/**
 * Cancel a reservation
 */
export function useCancelReservation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CancelReservationInput) => {
      const result = await cancelReservationAction(input);

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
    onSuccess: (_, variables) => {
      toast.success("Reservation cancelled successfully");
      queryClient.invalidateQueries({ queryKey: reservationKeys.detail(variables.reservationId) });
      queryClient.invalidateQueries({
        queryKey: reservationKeys.detailWithData(variables.reservationId),
      });
      queryClient.invalidateQueries({ queryKey: reservationKeys.lists() });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to cancel reservation");
    },
  });
}
