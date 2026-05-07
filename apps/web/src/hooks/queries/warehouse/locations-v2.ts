"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import {
  validateArchiveLocationAction,
  archiveLocationAction,
  getLocationMappingStatusAction,
  updateLocationV2Action,
} from "@/app/actions/warehouse/locations";
import type {
  LocationV2,
  MappingStatusResult,
  ArchiveValidationResult,
  UpdateLocationV2Input,
} from "@/lib/types/warehouse/locations-v2";
import { warehouseKeys } from "./index";

// ─── Query key extensions for V2 ─────────────────────────────────────────────

export const warehouseV2Keys = {
  // Mapping status keys
  mappingStatus: (locationId: string, layoutId?: string) =>
    [...warehouseKeys.location(locationId), "mapping-status", layoutId ?? "any"] as const,
  // Archive validation keys
  archiveValidation: (locationId: string) =>
    [...warehouseKeys.location(locationId), "archive-validation"] as const,
};

// ─── Discriminated result helper ──────────────────────────────────────────────

type SR<T> = { success: true; data: T } | { success: false; error: string };
function unwrapSR<T>(result: SR<T>): T {
  if (result.success) return result.data;
  throw new Error((result as { error: string }).error);
}

// ─── Mapping status query ─────────────────────────────────────────────────────

export function useLocationMappingStatusQuery(
  locationId: string | null | undefined,
  layoutId?: string
) {
  return useQuery({
    queryKey: locationId
      ? warehouseV2Keys.mappingStatus(locationId, layoutId)
      : warehouseKeys.locations(),
    queryFn: async () =>
      unwrapSR(
        (await getLocationMappingStatusAction({
          id: locationId!,
          layoutId,
        })) as SR<MappingStatusResult>
      ),
    enabled: !!locationId,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

// ─── Archive validation query ─────────────────────────────────────────────────

export function useValidateArchiveLocationQuery(locationId: string | null | undefined) {
  return useQuery({
    queryKey: locationId
      ? warehouseV2Keys.archiveValidation(locationId)
      : warehouseKeys.locations(),
    queryFn: async () =>
      unwrapSR(
        (await validateArchiveLocationAction({ id: locationId! })) as SR<ArchiveValidationResult>
      ),
    enabled: !!locationId,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  });
}

// ─── Archive location mutation ────────────────────────────────────────────────

export function useArchiveLocationMutation(branchId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (locationId: string) =>
      unwrapSR(
        (await archiveLocationAction({ id: locationId })) as SR<{
          archived: true;
          warnings: ArchiveValidationResult["warnings"];
        }>
      ),
    onSuccess: (_, locationId) => {
      queryClient.invalidateQueries({ queryKey: warehouseKeys.location(locationId) });
      if (branchId) {
        queryClient.invalidateQueries({ queryKey: warehouseKeys.locationsByBranch(branchId) });
      }
      queryClient.invalidateQueries({ queryKey: warehouseV2Keys.archiveValidation(locationId) });
      toast.success("Location archived");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to archive location");
    },
  });
}

// ─── Update V2 fields mutation ────────────────────────────────────────────────

export function useUpdateLocationV2Mutation(branchId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateLocationV2Input & { id: string }) =>
      unwrapSR((await updateLocationV2Action(input)) as SR<LocationV2>),
    onSuccess: (data) => {
      queryClient.setQueryData(warehouseKeys.location(data.id), data);
      if (branchId) {
        queryClient.invalidateQueries({ queryKey: warehouseKeys.locationsByBranch(branchId) });
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update location");
    },
  });
}
