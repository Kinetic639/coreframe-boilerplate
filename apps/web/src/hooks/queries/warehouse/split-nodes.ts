"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import {
  listSplitNodesAction,
  createSplitAction,
  resizeSplitAction,
  removeSplitNodeAction,
  linkSplitToLocationAction,
  unlinkSplitFromLocationAction,
} from "@/app/actions/warehouse/split-nodes";
import type {
  LayoutSplitNode,
  CreateSplitNodeInput,
  SplitSizeMode,
} from "@/lib/types/warehouse/locations-v2";
import { visualNodeKeys } from "./location-visual-nodes";

// ─── Query keys ───────────────────────────────────────────────────────────────

export const splitNodeKeys = {
  all: ["warehouse", "splitNodes"] as const,
  byLayout: (layoutId: string, parentVisualNodeId?: string | null) =>
    [
      ...splitNodeKeys.all,
      "layout",
      layoutId,
      parentVisualNodeId === undefined ? "any-pvn" : (parentVisualNodeId ?? "null-pvn"),
    ] as const,
};

// ─── Discriminated result helper ──────────────────────────────────────────────

type SR<T> = { success: true; data: T } | { success: false; error: string };
function unwrapSR<T>(result: SR<T>): T {
  if (result.success) return result.data;
  throw new Error((result as { error: string }).error);
}

// ─── Query ────────────────────────────────────────────────────────────────────

export function useSplitNodesQuery(
  layoutId: string | null | undefined,
  parentVisualNodeId?: string | null
) {
  return useQuery({
    queryKey: layoutId ? splitNodeKeys.byLayout(layoutId, parentVisualNodeId) : splitNodeKeys.all,
    queryFn: async () =>
      unwrapSR(
        (await listSplitNodesAction({
          layoutId: layoutId!,
          parentVisualNodeId,
        })) as SR<LayoutSplitNode[]>
      ),
    enabled: !!layoutId,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

function invalidateSplitQueries(queryClient: ReturnType<typeof useQueryClient>, layoutId: string) {
  queryClient.invalidateQueries({ queryKey: splitNodeKeys.byLayout(layoutId) });
}

export function useCreateSplitMutation(layoutId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateSplitNodeInput) =>
      unwrapSR((await createSplitAction(input)) as SR<LayoutSplitNode>),
    onSuccess: () => {
      invalidateSplitQueries(queryClient, layoutId);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create split");
    },
  });
}

export function useResizeSplitMutation(layoutId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      nodeId: string;
      sizeMode: SplitSizeMode;
      sizeValue?: number | null;
    }) => unwrapSR((await resizeSplitAction(input)) as SR<LayoutSplitNode>),
    onSuccess: () => {
      invalidateSplitQueries(queryClient, layoutId);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to resize split");
    },
  });
}

export function useRemoveSplitNodeMutation(layoutId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (nodeId: string) =>
      unwrapSR((await removeSplitNodeAction({ nodeId })) as SR<void>),
    onSuccess: () => {
      invalidateSplitQueries(queryClient, layoutId);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to remove split node");
    },
  });
}

export function useLinkSplitToLocationMutation(layoutId: string, branchId?: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { splitNodeId: string; locationId: string }) =>
      unwrapSR((await linkSplitToLocationAction(input)) as SR<LayoutSplitNode>),
    onSuccess: () => {
      invalidateSplitQueries(queryClient, layoutId);
      // Mapping status may change when a location gets linked
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey;
          return Array.isArray(key) && key.includes("mapping-status");
        },
      });
      if (branchId) {
        queryClient.invalidateQueries({ queryKey: visualNodeKeys.unmapped(branchId, layoutId) });
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to link location");
    },
  });
}

export function useUnlinkSplitFromLocationMutation(layoutId: string, branchId?: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (splitNodeId: string) =>
      unwrapSR((await unlinkSplitFromLocationAction({ splitNodeId })) as SR<LayoutSplitNode>),
    onSuccess: () => {
      invalidateSplitQueries(queryClient, layoutId);
      if (branchId) {
        queryClient.invalidateQueries({ queryKey: visualNodeKeys.unmapped(branchId, layoutId) });
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to unlink location");
    },
  });
}
