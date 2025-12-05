import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import {
  getLocations,
  getAllLocations,
  getLocationById,
  createLocation,
  updateLocation,
  deleteLocation,
  permanentlyDeleteLocation,
  reorderLocations,
  getChildLocations,
} from "@/app/[locale]/dashboard/warehouse/locations/_actions";
import type {
  LocationFilters,
  CreateLocationInput,
  UpdateLocationInput,
} from "@/server/schemas/locations.schema";

/**
 * Hook to fetch locations with optional filters
 */
export function useLocations(filters?: LocationFilters) {
  return useQuery({
    queryKey: ["locations", filters],
    queryFn: async () => {
      return await getLocations(filters || { page: 1, pageSize: 50 });
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch all locations without pagination (for tree view)
 */
export function useAllLocations() {
  return useQuery({
    queryKey: ["locations", "all"],
    queryFn: async () => {
      return await getAllLocations();
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to fetch a single location by ID
 */
export function useLocation(locationId: string | null) {
  return useQuery({
    queryKey: ["location", locationId],
    queryFn: async () => {
      if (!locationId) return null;
      return await getLocationById(locationId);
    },
    enabled: !!locationId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to create a new location
 */
export function useCreateLocation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateLocationInput) => {
      return await createLocation(input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      toast.success("Location created successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create location");
    },
  });
}

/**
 * Hook to update an existing location
 */
export function useUpdateLocation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      locationId,
      input,
    }: {
      locationId: string;
      input: UpdateLocationInput;
    }) => {
      return await updateLocation(locationId, input);
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      queryClient.invalidateQueries({ queryKey: ["location", variables.locationId] });
      toast.success("Location updated successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update location");
    },
  });
}

/**
 * Hook to delete a location (soft delete)
 */
export function useDeleteLocation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (locationId: string) => {
      return await deleteLocation(locationId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      toast.success("Location deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete location");
    },
  });
}

/**
 * Hook to permanently delete a location
 */
export function usePermanentlyDeleteLocation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (locationId: string) => {
      return await permanentlyDeleteLocation(locationId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      toast.success("Location permanently deleted");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to permanently delete location");
    },
  });
}

/**
 * Hook to reorder locations
 */
export function useReorderLocations() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (locationOrders: Array<{ id: string; display_order: number }>) => {
      return await reorderLocations(locationOrders);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      toast.success("Locations reordered successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to reorder locations");
    },
  });
}

/**
 * Hook to fetch child locations
 */
export function useChildLocations(parentLocationId: string | null) {
  return useQuery({
    queryKey: ["locations", "children", parentLocationId],
    queryFn: async () => {
      if (!parentLocationId) return [];
      return await getChildLocations(parentLocationId);
    },
    enabled: !!parentLocationId,
    staleTime: 5 * 60 * 1000,
  });
}
