"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";

import {
  listLocationsAction,
  getLocationAction,
  createLocationAction,
  updateLocationAction,
  deleteLocationAction,
} from "@/app/actions/warehouse/locations";
import type { WarehouseLocation } from "@/lib/warehouse/location-tree";
import type { CreateLocationInput, UpdateLocationInput } from "@/app/actions/warehouse/schemas";

// ─── Discriminated result helper ──────────────────────────────────────────────

type SR<T> = { success: true; data: T } | { success: false; error: string };

function unwrapSR<T>(result: SR<T>): T {
  if (result.success) return result.data;
  throw new Error((result as { error: string }).error);
}

// ─── Query Key Factory ─────────────────────────────────────────────────────────

export const warehouseKeys = {
  all: ["warehouse"] as const,
  locations: () => [...warehouseKeys.all, "locations"] as const,
  locationsByBranch: (branchId: string) =>
    [...warehouseKeys.locations(), "branch", branchId] as const,
  location: (id: string) => [...warehouseKeys.locations(), id] as const,
};

// ─── List locations ───────────────────────────────────────────────────────────

export function useWarehouseLocationsQuery(
  branchId: string | null | undefined,
  initialData?: WarehouseLocation[]
) {
  return useQuery({
    queryKey: branchId ? warehouseKeys.locationsByBranch(branchId) : warehouseKeys.locations(),
    queryFn: async () =>
      unwrapSR((await listLocationsAction(branchId!)) as SR<WarehouseLocation[]>),
    enabled: !!branchId,
    initialData: initialData,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

// ─── Single location ──────────────────────────────────────────────────────────

export function useWarehouseLocationQuery(
  id: string | null | undefined,
  initialData?: WarehouseLocation | null
) {
  return useQuery({
    queryKey: id ? warehouseKeys.location(id) : warehouseKeys.locations(),
    queryFn: async () =>
      unwrapSR((await getLocationAction({ id: id! })) as SR<WarehouseLocation | null>),
    enabled: !!id,
    initialData: initialData ?? undefined,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

// ─── Create ───────────────────────────────────────────────────────────────────

export function useCreateLocationMutation(branchId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateLocationInput) =>
      unwrapSR((await createLocationAction(input)) as SR<WarehouseLocation>),
    onSuccess: () => {
      if (branchId) {
        queryClient.invalidateQueries({
          queryKey: warehouseKeys.locationsByBranch(branchId),
        });
      } else {
        queryClient.invalidateQueries({ queryKey: warehouseKeys.locations() });
      }
      toast.success("Location created");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to create location");
    },
  });
}

// ─── Update ───────────────────────────────────────────────────────────────────

export function useUpdateLocationMutation(branchId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateLocationInput & { id: string }) =>
      unwrapSR((await updateLocationAction(input)) as SR<WarehouseLocation>),
    onSuccess: (data) => {
      queryClient.setQueryData(warehouseKeys.location(data.id), data);
      if (branchId) {
        queryClient.invalidateQueries({
          queryKey: warehouseKeys.locationsByBranch(branchId),
        });
      } else {
        queryClient.invalidateQueries({ queryKey: warehouseKeys.locations() });
      }
      toast.success("Location updated");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to update location");
    },
  });
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export function useDeleteLocationMutation(branchId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => unwrapSR((await deleteLocationAction({ id })) as SR<void>),
    onSuccess: () => {
      if (branchId) {
        queryClient.invalidateQueries({
          queryKey: warehouseKeys.locationsByBranch(branchId),
        });
      } else {
        queryClient.invalidateQueries({ queryKey: warehouseKeys.locations() });
      }
      toast.success("Location deleted");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to delete location");
    },
  });
}
