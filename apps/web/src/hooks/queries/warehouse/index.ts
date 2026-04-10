"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";

import {
  listLocationsAction,
  getLocationAction,
  createLocationAction,
  updateLocationAction,
  deleteLocationAction,
  reorderLocationsAction,
  listPlacedLocationIdsAction,
} from "@/app/actions/warehouse/locations";
import {
  listLocationGroupsAction,
  createLocationGroupAction,
  updateLocationGroupAction,
  deleteLocationGroupAction,
  reorderGroupsAction,
} from "@/app/actions/warehouse/location-groups";
import {
  listLayoutsAction,
  getLayoutWithShapesAction,
  getPublishedLayoutAction,
  createLayoutAction,
  createLayoutForLocationAction,
  updateLayoutAction,
  publishLayoutAction,
  unpublishLayoutAction,
  deleteLayoutAction,
} from "@/app/actions/warehouse/layouts";
import {
  batchSaveShapesAction,
  upsertOneShapeAction,
  deleteShapeAction,
} from "@/app/actions/warehouse/shapes";
import type { WarehouseLocation, WarehouseLocationGroup } from "@/lib/warehouse/location-tree";
import type {
  WarehouseLayout,
  WarehouseLayoutWithShapes,
  WarehouseLayoutShape,
  ShapeUpsertInput,
} from "@/lib/warehouse/layouts";
import type {
  CreateLocationInput,
  UpdateLocationInput,
  ReorderLocationsInput,
  CreateLocationGroupInput,
  UpdateLocationGroupInput,
  ReorderGroupsInput,
} from "@/app/actions/warehouse/schemas";
import type {
  CreateLayoutInput,
  CreateLayoutForLocationInput,
  UpdateLayoutInput as UpdateLayoutSchemaInput,
  BatchSaveShapesInput,
} from "@/app/actions/warehouse/layout-schemas";

// ─── Discriminated result helper ──────────────────────────────────────────────

type SR<T> = { success: true; data: T } | { success: false; error: string };

function unwrapSR<T>(result: SR<T>): T {
  if (result.success) return result.data;
  throw new Error((result as { error: string }).error);
}

function invalidatePublishedLayoutsForBranch(
  queryClient: ReturnType<typeof useQueryClient>,
  branchId: string
) {
  return queryClient.invalidateQueries({
    predicate: (query) => {
      const key = query.queryKey;
      return (
        Array.isArray(key) &&
        key[0] === "warehouse" &&
        key[1] === "layouts" &&
        key[2] === "published" &&
        key[3] === branchId
      );
    },
  });
}

// ─── Query Key Factory ─────────────────────────────────────────────────────────

export const warehouseKeys = {
  all: ["warehouse"] as const,
  // ── locations ──
  locations: () => [...warehouseKeys.all, "locations"] as const,
  locationsByBranch: (branchId: string) =>
    [...warehouseKeys.locations(), "branch", branchId] as const,
  location: (id: string) => [...warehouseKeys.locations(), id] as const,
  placedLocationIds: (branchId: string) =>
    [...warehouseKeys.locations(), "placed", branchId] as const,
  // ── location groups ──
  locationGroups: () => [...warehouseKeys.all, "locationGroups"] as const,
  locationGroupsByBranch: (branchId: string) =>
    [...warehouseKeys.locationGroups(), "branch", branchId] as const,
  // ── layouts ──
  layouts: () => [...warehouseKeys.all, "layouts"] as const,
  layoutsByBranch: (branchId: string) => [...warehouseKeys.layouts(), "branch", branchId] as const,
  layout: (id: string) => [...warehouseKeys.layouts(), id] as const,
  layoutWithShapes: (id: string) => [...warehouseKeys.layout(id), "shapes"] as const,
  publishedLayout: (branchId: string, rootLocationId?: string | null) =>
    [
      ...warehouseKeys.layouts(),
      "published",
      branchId,
      rootLocationId === undefined
        ? "__any__"
        : rootLocationId === null
          ? "__branch_root__"
          : rootLocationId,
    ] as const,
};

// ─── List locations ───────────────────────────────────────────────────────────

export function useWarehouseLocationsQuery(
  branchId: string | null | undefined,
  initialData?: WarehouseLocation[]
) {
  return useQuery({
    // branchId is used only for React Query cache key scoping.
    // The action derives the active branch from server context — the client
    // must NOT forward an arbitrary branchId to prevent cross-branch leakage.
    queryKey: branchId ? warehouseKeys.locationsByBranch(branchId) : warehouseKeys.locations(),
    queryFn: async () => unwrapSR((await listLocationsAction()) as SR<WarehouseLocation[]>),
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
  const t = useTranslations("warehouseFeedback");

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
      toast.success(t("locationCreated"));
    },
    onError: (err: Error) => {
      toast.error(err.message || t("locationCreateFailed"));
    },
  });
}

// ─── Update ───────────────────────────────────────────────────────────────────

export function useUpdateLocationMutation(branchId: string | null | undefined) {
  const queryClient = useQueryClient();
  const t = useTranslations("warehouseFeedback");

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
      toast.success(t("locationUpdated"));
    },
    onError: (err: Error) => {
      toast.error(err.message || t("locationUpdateFailed"));
    },
  });
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export function useDeleteLocationMutation(branchId: string | null | undefined) {
  const queryClient = useQueryClient();
  const t = useTranslations("warehouseFeedback");

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
      toast.success(t("locationDeleted"));
    },
    onError: (err: Error) => {
      toast.error(err.message || t("locationDeleteFailed"));
    },
  });
}

// ─── Reorder ──────────────────────────────────────────────────────────────────

export function useReorderLocationsMutation(branchId: string | null | undefined) {
  const queryClient = useQueryClient();
  const t = useTranslations("warehouseFeedback");

  return useMutation({
    mutationFn: async (input: ReorderLocationsInput) =>
      unwrapSR((await reorderLocationsAction(input)) as SR<void>),
    onMutate: async (input) => {
      // Optimistic update — patch sort_order in cache immediately
      if (!branchId) return;
      const key = warehouseKeys.locationsByBranch(branchId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData(key);
      queryClient.setQueryData(key, (old: WarehouseLocation[] | undefined) => {
        if (!old) return old;
        const orderMap = new Map(input.items.map(({ id, sort_order }) => [id, sort_order]));
        return old.map((loc) =>
          orderMap.has(loc.id) ? { ...loc, sort_order: orderMap.get(loc.id)! } : loc
        );
      });
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (branchId && ctx?.previous) {
        queryClient.setQueryData(warehouseKeys.locationsByBranch(branchId), ctx.previous);
      }
      toast.error(t("locationReorderFailed"));
    },
    onSettled: () => {
      if (branchId)
        queryClient.invalidateQueries({ queryKey: warehouseKeys.locationsByBranch(branchId) });
    },
  });
}

// ─── Placed location IDs ──────────────────────────────────────────────────────

export function usePlacedLocationIdsQuery(branchId: string | null | undefined) {
  return useQuery({
    queryKey: branchId
      ? warehouseKeys.placedLocationIds(branchId)
      : ["warehouse", "placed", "none"],
    queryFn: async () => unwrapSR((await listPlacedLocationIdsAction()) as SR<string[]>),
    enabled: !!branchId,
    staleTime: 30_000,
  });
}

// =============================================================================
// LOCATION GROUPS
// =============================================================================

export function useWarehouseLocationGroupsQuery(
  branchId: string | null | undefined,
  initialData?: WarehouseLocationGroup[]
) {
  return useQuery({
    queryKey: branchId
      ? warehouseKeys.locationGroupsByBranch(branchId)
      : warehouseKeys.locationGroups(),
    queryFn: async () =>
      unwrapSR((await listLocationGroupsAction()) as SR<WarehouseLocationGroup[]>),
    enabled: !!branchId,
    initialData,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useCreateLocationGroupMutation(branchId: string | null | undefined) {
  const queryClient = useQueryClient();
  const t = useTranslations("warehouseFeedback");

  return useMutation({
    mutationFn: async (input: CreateLocationGroupInput) =>
      unwrapSR((await createLocationGroupAction(input)) as SR<WarehouseLocationGroup>),
    onSuccess: () => {
      if (branchId) {
        queryClient.invalidateQueries({
          queryKey: warehouseKeys.locationGroupsByBranch(branchId),
        });
      } else {
        queryClient.invalidateQueries({ queryKey: warehouseKeys.locationGroups() });
      }
      toast.success(t("locationGroupCreated"));
    },
    onError: (err: Error) => {
      toast.error(err.message || t("locationGroupCreateFailed"));
    },
  });
}

export function useUpdateLocationGroupMutation(branchId: string | null | undefined) {
  const queryClient = useQueryClient();
  const t = useTranslations("warehouseFeedback");

  return useMutation({
    mutationFn: async (input: UpdateLocationGroupInput & { id: string }) =>
      unwrapSR((await updateLocationGroupAction(input)) as SR<WarehouseLocationGroup>),
    onSuccess: () => {
      if (branchId) {
        queryClient.invalidateQueries({
          queryKey: warehouseKeys.locationGroupsByBranch(branchId),
        });
      } else {
        queryClient.invalidateQueries({ queryKey: warehouseKeys.locationGroups() });
      }
      toast.success(t("locationGroupUpdated"));
    },
    onError: (err: Error) => {
      toast.error(err.message || t("locationGroupUpdateFailed"));
    },
  });
}

export function useDeleteLocationGroupMutation(branchId: string | null | undefined) {
  const queryClient = useQueryClient();
  const t = useTranslations("warehouseFeedback");

  return useMutation({
    mutationFn: async (id: string) =>
      unwrapSR((await deleteLocationGroupAction({ id })) as SR<void>),
    onSuccess: () => {
      if (branchId) {
        queryClient.invalidateQueries({
          queryKey: warehouseKeys.locationGroupsByBranch(branchId),
        });
        // Also invalidate locations — their group_id fields were cleared
        queryClient.invalidateQueries({
          queryKey: warehouseKeys.locationsByBranch(branchId),
        });
      }
      toast.success(t("locationGroupDeleted"));
    },
    onError: (err: Error) => {
      toast.error(err.message || t("locationGroupDeleteFailed"));
    },
  });
}

export function useReorderGroupsMutation(branchId: string | null | undefined) {
  const queryClient = useQueryClient();
  const t = useTranslations("warehouseFeedback");

  return useMutation({
    mutationFn: async (input: ReorderGroupsInput) =>
      unwrapSR((await reorderGroupsAction(input)) as SR<void>),
    onSuccess: () => {
      if (branchId) {
        queryClient.invalidateQueries({
          queryKey: warehouseKeys.locationGroupsByBranch(branchId),
        });
      } else {
        queryClient.invalidateQueries({ queryKey: warehouseKeys.locationGroups() });
      }
    },
    onError: (err: Error) => {
      toast.error(err.message || t("locationGroupReorderFailed"));
    },
  });
}

// =============================================================================
// LAYOUTS
// =============================================================================

// ─── List layouts ─────────────────────────────────────────────────────────────

export function useWarehouseLayoutsQuery(
  branchId: string | null | undefined,
  initialData?: WarehouseLayout[]
) {
  return useQuery({
    queryKey: branchId ? warehouseKeys.layoutsByBranch(branchId) : warehouseKeys.layouts(),
    queryFn: async () => unwrapSR((await listLayoutsAction()) as SR<WarehouseLayout[]>),
    enabled: !!branchId,
    initialData,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

// ─── Single layout with shapes ────────────────────────────────────────────────

export function useWarehouseLayoutWithShapesQuery(
  layoutId: string | null | undefined,
  initialData?: WarehouseLayoutWithShapes | null
) {
  return useQuery({
    queryKey: layoutId ? warehouseKeys.layoutWithShapes(layoutId) : warehouseKeys.layouts(),
    queryFn: async () =>
      unwrapSR(
        (await getLayoutWithShapesAction({ id: layoutId! })) as SR<WarehouseLayoutWithShapes | null>
      ),
    enabled: !!layoutId,
    initialData: initialData ?? undefined,
    staleTime: 30 * 1000, // editor data should refresh more frequently than locations
    refetchOnWindowFocus: false,
  });
}

// ─── Published layout for a scope ────────────────────────────────────────────

export function usePublishedLayoutQuery(
  branchId: string | null | undefined,
  rootLocationId?: string | null
) {
  return useQuery({
    queryKey: branchId
      ? warehouseKeys.publishedLayout(branchId, rootLocationId)
      : warehouseKeys.layouts(),
    queryFn: async () =>
      unwrapSR(
        (await getPublishedLayoutAction({
          root_location_id: rootLocationId,
        })) as SR<WarehouseLayoutWithShapes | null>
      ),
    enabled: !!branchId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

// ─── Create layout ────────────────────────────────────────────────────────────

export function useCreateLayoutMutation(branchId: string | null | undefined) {
  const queryClient = useQueryClient();
  const t = useTranslations("warehouseFeedback");

  return useMutation({
    mutationFn: async (input: CreateLayoutInput) =>
      unwrapSR((await createLayoutAction(input)) as SR<WarehouseLayout>),
    onSuccess: () => {
      if (branchId) {
        queryClient.invalidateQueries({ queryKey: warehouseKeys.layoutsByBranch(branchId) });
      } else {
        queryClient.invalidateQueries({ queryKey: warehouseKeys.layouts() });
      }
      toast.success(t("layoutCreated"));
    },
    onError: (err: Error) => {
      toast.error(err.message || t("layoutCreateFailed"));
    },
  });
}

// ─── Create layout for existing location ────────────────────────────────────

export function useCreateLayoutForLocationMutation(branchId: string | null | undefined) {
  const queryClient = useQueryClient();
  const t = useTranslations("warehouseFeedback");

  return useMutation({
    mutationFn: async (input: CreateLayoutForLocationInput) =>
      unwrapSR((await createLayoutForLocationAction(input)) as SR<WarehouseLayout>),
    onSuccess: () => {
      if (branchId) {
        queryClient.invalidateQueries({ queryKey: warehouseKeys.layoutsByBranch(branchId) });
      } else {
        queryClient.invalidateQueries({ queryKey: warehouseKeys.layouts() });
      }
      toast.success(t("mapCreated"));
    },
    onError: (err: Error) => {
      toast.error(err.message || t("mapCreateFailed"));
    },
  });
}

// ─── Update layout ────────────────────────────────────────────────────────────

export function useUpdateLayoutMutation(branchId: string | null | undefined) {
  const queryClient = useQueryClient();
  const t = useTranslations("warehouseFeedback");

  return useMutation({
    mutationFn: async (input: UpdateLayoutSchemaInput & { id: string }) =>
      unwrapSR((await updateLayoutAction(input)) as SR<WarehouseLayout>),
    onSuccess: (data) => {
      queryClient.setQueryData(warehouseKeys.layout(data.id), data);
      if (branchId) {
        queryClient.invalidateQueries({ queryKey: warehouseKeys.layoutsByBranch(branchId) });
      }
    },
    onError: (err: Error) => {
      toast.error(err.message || t("layoutUpdateFailed"));
    },
  });
}

// ─── Publish / Unpublish ──────────────────────────────────────────────────────

export function usePublishLayoutMutation(branchId: string | null | undefined) {
  const queryClient = useQueryClient();
  const t = useTranslations("warehouseFeedback");

  return useMutation({
    mutationFn: async (id: string) =>
      unwrapSR((await publishLayoutAction({ id })) as SR<WarehouseLayout>),
    onSuccess: (data) => {
      queryClient.setQueryData(warehouseKeys.layout(data.id), data);
      if (branchId) {
        queryClient.invalidateQueries({ queryKey: warehouseKeys.layoutsByBranch(branchId) });
        invalidatePublishedLayoutsForBranch(queryClient, branchId);
      }
      toast.success(t("layoutPublished"));
    },
    onError: (err: Error) => {
      toast.error(err.message || t("layoutPublishFailed"));
    },
  });
}

export function useUnpublishLayoutMutation(branchId: string | null | undefined) {
  const queryClient = useQueryClient();
  const t = useTranslations("warehouseFeedback");

  return useMutation({
    mutationFn: async (id: string) =>
      unwrapSR((await unpublishLayoutAction({ id })) as SR<WarehouseLayout>),
    onSuccess: (data) => {
      queryClient.setQueryData(warehouseKeys.layout(data.id), data);
      if (branchId) {
        queryClient.invalidateQueries({ queryKey: warehouseKeys.layoutsByBranch(branchId) });
        invalidatePublishedLayoutsForBranch(queryClient, branchId);
      }
      toast.success(t("layoutUnpublished"));
    },
    onError: (err: Error) => {
      toast.error(err.message || t("layoutUnpublishFailed"));
    },
  });
}

// ─── Delete layout ────────────────────────────────────────────────────────────

export function useDeleteLayoutMutation(branchId: string | null | undefined) {
  const queryClient = useQueryClient();
  const t = useTranslations("warehouseFeedback");

  return useMutation({
    mutationFn: async (id: string) => unwrapSR((await deleteLayoutAction({ id })) as SR<void>),
    onSuccess: () => {
      if (branchId) {
        queryClient.invalidateQueries({ queryKey: warehouseKeys.layoutsByBranch(branchId) });
        invalidatePublishedLayoutsForBranch(queryClient, branchId);
      } else {
        queryClient.invalidateQueries({ queryKey: warehouseKeys.layouts() });
      }
      toast.success(t("layoutDeleted"));
    },
    onError: (err: Error) => {
      toast.error(err.message || t("layoutDeleteFailed"));
    },
  });
}

// =============================================================================
// SHAPES
// =============================================================================

// ─── Batch save (primary editor save) ────────────────────────────────────────

export function useBatchSaveShapesMutation(layoutId: string | null | undefined) {
  const queryClient = useQueryClient();
  const t = useTranslations("warehouseFeedback");

  return useMutation({
    mutationFn: async (shapes: ShapeUpsertInput[]) => {
      if (!layoutId) throw new Error(t("noLayoutSelected"));
      return unwrapSR(
        (await batchSaveShapesAction({ layout_id: layoutId, shapes })) as SR<WarehouseLayoutShape[]>
      );
    },
    onSuccess: (data) => {
      if (layoutId) {
        // Update the shapes cache directly — avoids a full re-fetch after save
        queryClient.setQueryData(
          warehouseKeys.layoutWithShapes(layoutId),
          (old: WarehouseLayoutWithShapes | undefined) => (old ? { ...old, shapes: data } : old)
        );
      }
    },
    onError: (err: Error) => {
      toast.error(err.message || t("saveCanvasFailed"));
    },
  });
}

// ─── Upsert one shape (incremental save) ─────────────────────────────────────

export function useUpsertOneShapeMutation(layoutId: string | null | undefined) {
  const queryClient = useQueryClient();
  const t = useTranslations("warehouseFeedback");

  return useMutation({
    mutationFn: async (shape: ShapeUpsertInput) => {
      if (!layoutId) throw new Error(t("noLayoutSelected"));
      return unwrapSR(
        (await upsertOneShapeAction({ layout_id: layoutId, shape })) as SR<WarehouseLayoutShape>
      );
    },
    onSuccess: (data) => {
      if (layoutId) {
        queryClient.setQueryData(
          warehouseKeys.layoutWithShapes(layoutId),
          (old: WarehouseLayoutWithShapes | undefined) => {
            if (!old) return old;
            const idx = old.shapes.findIndex((s) => s.id === data.id);
            const shapes =
              idx >= 0
                ? old.shapes.map((s) => (s.id === data.id ? data : s))
                : [...old.shapes, data];
            return { ...old, shapes };
          }
        );
      }
    },
    onError: (err: Error) => {
      toast.error(err.message || t("shapeSaveFailed"));
    },
  });
}

// ─── Delete shape ─────────────────────────────────────────────────────────────

export function useDeleteShapeMutation(layoutId: string | null | undefined) {
  const queryClient = useQueryClient();
  const t = useTranslations("warehouseFeedback");

  return useMutation({
    mutationFn: async (shapeId: string) =>
      unwrapSR((await deleteShapeAction({ id: shapeId })) as SR<void>),
    onSuccess: (_data, shapeId) => {
      if (layoutId) {
        queryClient.setQueryData(
          warehouseKeys.layoutWithShapes(layoutId),
          (old: WarehouseLayoutWithShapes | undefined) =>
            old ? { ...old, shapes: old.shapes.filter((s) => s.id !== shapeId) } : old
        );
      }
    },
    onError: (err: Error) => {
      toast.error(err.message || t("shapeDeleteFailed"));
    },
  });
}
