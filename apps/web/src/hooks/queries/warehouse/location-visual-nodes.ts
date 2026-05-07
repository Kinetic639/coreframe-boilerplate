"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import {
  listVisualNodesAction,
  upsertVisualNodeAction,
  batchUpsertVisualNodesAction,
  removeVisualNodeAction,
  hideVisualNodeAction,
  restoreVisualNodeAction,
  getUnmappedLocationsAction,
} from "@/app/actions/warehouse/location-visual-nodes";
import type {
  LocationVisualNode,
  LocationV2,
  UpsertVisualNodeInput,
  ViewType,
} from "@/lib/types/warehouse/locations-v2";

// ─── Query keys ───────────────────────────────────────────────────────────────

export const visualNodeKeys = {
  all: ["warehouse", "visualNodes"] as const,
  byLayout: (layoutId: string, viewType?: string, viewContextId?: string | null) =>
    [
      ...visualNodeKeys.all,
      "layout",
      layoutId,
      viewType ?? "all",
      viewContextId === undefined ? "any-ctx" : (viewContextId ?? "null-ctx"),
    ] as const,
  byLocation: (locationId: string) => [...visualNodeKeys.all, "location", locationId] as const,
  unmapped: (branchId: string, layoutId: string, viewContextId?: string | null) =>
    [
      ...visualNodeKeys.all,
      "unmapped",
      branchId,
      layoutId,
      viewContextId === undefined ? "any-ctx" : (viewContextId ?? "null-ctx"),
    ] as const,
};

// ─── Discriminated result helper ──────────────────────────────────────────────

type SR<T> = { success: true; data: T } | { success: false; error: string };
function unwrapSR<T>(result: SR<T>): T {
  if (result.success) return result.data;
  throw new Error((result as { error: string }).error);
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export function useLocationVisualNodesQuery(
  layoutId: string | null | undefined,
  viewType?: ViewType,
  viewContextLocationId?: string | null
) {
  return useQuery({
    queryKey: layoutId
      ? visualNodeKeys.byLayout(layoutId, viewType, viewContextLocationId)
      : visualNodeKeys.all,
    queryFn: async () =>
      unwrapSR(
        (await listVisualNodesAction({
          layoutId: layoutId!,
          viewType,
          viewContextLocationId,
        })) as SR<LocationVisualNode[]>
      ),
    enabled: !!layoutId,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useUnmappedLocationsQuery(
  branchId: string | null | undefined,
  layoutId: string | null | undefined,
  viewContextLocationId?: string | null
) {
  return useQuery({
    queryKey:
      branchId && layoutId
        ? visualNodeKeys.unmapped(branchId, layoutId, viewContextLocationId)
        : visualNodeKeys.all,
    queryFn: async () =>
      unwrapSR(
        (await getUnmappedLocationsAction({
          layoutId: layoutId!,
          viewContextLocationId,
        })) as SR<LocationV2[]>
      ),
    enabled: !!branchId && !!layoutId,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

function invalidateVisualNodeQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  layoutId: string,
  branchId?: string | null
) {
  queryClient.invalidateQueries({ queryKey: visualNodeKeys.byLayout(layoutId) });
  if (branchId) {
    queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey;
        return (
          Array.isArray(key) &&
          key[0] === "warehouse" &&
          key[1] === "visualNodes" &&
          key[2] === "unmapped" &&
          key[3] === branchId
        );
      },
    });
  }
}

export function useUpsertVisualNodeMutation(layoutId: string, branchId?: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpsertVisualNodeInput) =>
      unwrapSR((await upsertVisualNodeAction(input)) as SR<LocationVisualNode>),
    onSuccess: () => {
      invalidateVisualNodeQueries(queryClient, layoutId, branchId);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to save visual node");
    },
  });
}

export function useBatchUpsertVisualNodesMutation(layoutId: string, branchId?: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      nodes: Omit<UpsertVisualNodeInput, "layout_id">[];
      replace_scope?: boolean;
      view_type?: ViewType;
      view_context_location_id?: string | null;
    }) =>
      unwrapSR(
        (await batchUpsertVisualNodesAction({
          layout_id: layoutId,
          ...input,
        })) as SR<LocationVisualNode[]>
      ),
    onSuccess: () => {
      invalidateVisualNodeQueries(queryClient, layoutId, branchId);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to save visual nodes");
    },
  });
}

export function useRemoveVisualNodeMutation(layoutId: string, branchId?: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (nodeId: string) =>
      unwrapSR((await removeVisualNodeAction({ nodeId })) as SR<void>),
    onSuccess: () => {
      invalidateVisualNodeQueries(queryClient, layoutId, branchId);
      // Mapping status may have changed
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey;
          return Array.isArray(key) && key.includes("mapping-status");
        },
      });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to remove visual node");
    },
  });
}

export function useHideVisualNodeMutation(layoutId: string, branchId?: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (nodeId: string) =>
      unwrapSR((await hideVisualNodeAction({ nodeId })) as SR<void>),
    onSuccess: () => {
      invalidateVisualNodeQueries(queryClient, layoutId, branchId);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to hide visual node");
    },
  });
}

export function useRestoreVisualNodeMutation(layoutId: string, branchId?: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (nodeId: string) =>
      unwrapSR((await restoreVisualNodeAction({ nodeId })) as SR<LocationVisualNode>),
    onSuccess: () => {
      invalidateVisualNodeQueries(queryClient, layoutId, branchId);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to restore visual node");
    },
  });
}
