import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import {
  getUnits,
  getUnit,
  createUnit,
  updateUnit,
  deleteUnit,
} from "@/app/[locale]/dashboard/warehouse/units/_actions";
import type { CreateUnitInput, UpdateUnitInput } from "@/server/schemas/units.schema";

/**
 * Hook to fetch all units
 */
export function useUnits() {
  return useQuery({
    queryKey: ["units"],
    queryFn: async () => {
      return await getUnits();
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Hook to fetch single unit by ID
 */
export function useUnit(unitId: string | null) {
  return useQuery({
    queryKey: ["unit", unitId],
    queryFn: async () => {
      if (!unitId) return null;
      return await getUnit(unitId);
    },
    enabled: !!unitId,
    staleTime: 10 * 60 * 1000,
  });
}

/**
 * Hook to create a new unit
 */
export function useCreateUnit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateUnitInput) => {
      return await createUnit(input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["units"] });
      toast.success("Unit created successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create unit");
    },
  });
}

/**
 * Hook to update a unit
 */
export function useUpdateUnit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ unitId, input }: { unitId: string; input: UpdateUnitInput }) => {
      return await updateUnit(unitId, input);
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["units"] });
      queryClient.invalidateQueries({ queryKey: ["unit", variables.unitId] });
      toast.success("Unit updated successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update unit");
    },
  });
}

/**
 * Hook to delete a unit
 */
export function useDeleteUnit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (unitId: string) => {
      return await deleteUnit(unitId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["units"] });
      toast.success("Unit deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete unit");
    },
  });
}
