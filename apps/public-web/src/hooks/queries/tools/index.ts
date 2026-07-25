"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  listToolsCatalogAction,
  getToolBySlugAction,
  listMyEnabledToolsAction,
  getMyToolRecordAction,
  setToolEnabledAction,
  setToolPinnedAction,
  updateToolSettingsAction,
} from "@/app/actions/tools";
import type { ToolCatalogItem, UserEnabledTool } from "@/server/services/tools.service";
import type {
  SetToolEnabledInput,
  SetToolPinnedInput,
  UpdateToolSettingsInput,
} from "@/lib/validations/tools";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SR<T> = { success: true; data: T } | { success: false; error: string };

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------

export const toolsKeys = {
  all: ["tools"] as const,
  catalog: () => [...toolsKeys.all, "catalog"] as const,
  catalogDetail: (slug: string) => [...toolsKeys.catalog(), slug] as const,
  myTools: () => [...toolsKeys.all, "my-tools"] as const,
  myToolRecord: (slug: string) => [...toolsKeys.myTools(), slug] as const,
};

// ---------------------------------------------------------------------------
// Helper: unwrap discriminated union or throw
// ---------------------------------------------------------------------------

function unwrapSR<T>(result: SR<T>): T {
  if (result.success) return result.data;
  throw new Error((result as { error: string }).error);
}

// ---------------------------------------------------------------------------
// Catalog hooks
// ---------------------------------------------------------------------------

export function useToolsCatalogQuery(initialData?: ToolCatalogItem[]) {
  return useQuery({
    queryKey: toolsKeys.catalog(),
    queryFn: async () => unwrapSR((await listToolsCatalogAction()) as SR<ToolCatalogItem[]>),
    initialData: initialData ?? undefined,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useToolBySlugQuery(slug: string, initialData?: ToolCatalogItem | null) {
  return useQuery({
    queryKey: toolsKeys.catalogDetail(slug),
    queryFn: async () => unwrapSR((await getToolBySlugAction(slug)) as SR<ToolCatalogItem | null>),
    initialData: initialData ?? undefined,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: Boolean(slug),
  });
}

// ---------------------------------------------------------------------------
// User-tools hooks
// ---------------------------------------------------------------------------

export function useMyEnabledToolsQuery(initialData?: UserEnabledTool[]) {
  return useQuery({
    queryKey: toolsKeys.myTools(),
    queryFn: async () => unwrapSR((await listMyEnabledToolsAction()) as SR<UserEnabledTool[]>),
    initialData: initialData ?? undefined,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useMyToolRecordQuery(slug: string, initialData?: UserEnabledTool | null) {
  return useQuery({
    queryKey: toolsKeys.myToolRecord(slug),
    queryFn: async () =>
      unwrapSR((await getMyToolRecordAction(slug)) as SR<UserEnabledTool | null>),
    initialData: initialData ?? undefined,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: Boolean(slug),
  });
}

// ---------------------------------------------------------------------------
// Mutation hooks
// ---------------------------------------------------------------------------

export function useSetToolEnabledMutation() {
  const queryClient = useQueryClient();
  const t = useTranslations("modules.tools");
  const router = useRouter();

  return useMutation({
    mutationFn: async (input: SetToolEnabledInput) =>
      unwrapSR((await setToolEnabledAction(input)) as SR<UserEnabledTool>),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: toolsKeys.myTools() });
      queryClient.setQueryData(toolsKeys.myToolRecord(data.tool_slug), data);
      toast.success(data.enabled ? t("toasts.toolEnabled") : t("toasts.toolDisabled"));
      // Refresh sidebar: disabling also unpins, so sidebar must update
      if (!data.enabled) router.refresh();
    },
    onError: (err: Error) => {
      toast.error(err.message || t("toasts.errorGeneric"));
    },
  });
}

export function useSetToolPinnedMutation() {
  const queryClient = useQueryClient();
  const t = useTranslations("modules.tools");
  const router = useRouter();

  return useMutation({
    mutationFn: async (input: SetToolPinnedInput) =>
      unwrapSR((await setToolPinnedAction(input)) as SR<UserEnabledTool>),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: toolsKeys.myTools() });
      queryClient.setQueryData(toolsKeys.myToolRecord(data.tool_slug), data);
      toast.success(data.pinned ? t("toasts.toolPinned") : t("toasts.toolUnpinned"));
      // Re-run server layout to refresh pinned tools in the sidebar
      router.refresh();
    },
    onError: (err: Error) => {
      toast.error(err.message || t("toasts.errorGeneric"));
    },
  });
}

export function useUpdateToolSettingsMutation() {
  const queryClient = useQueryClient();
  const t = useTranslations("modules.tools");

  return useMutation({
    mutationFn: async (input: UpdateToolSettingsInput) =>
      unwrapSR((await updateToolSettingsAction(input)) as SR<UserEnabledTool>),
    onSuccess: (data) => {
      queryClient.setQueryData(toolsKeys.myToolRecord(data.tool_slug), data);
      toast.success(t("toasts.settingsSaved"));
    },
    onError: (err: Error) => {
      toast.error(err.message || t("toasts.errorGeneric"));
    },
  });
}
