"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import {
  getUserPreferencesAction,
  getDashboardSettingsAction,
  updateProfileAction,
  updateRegionalSettingsAction,
  updateNotificationSettingsAction,
  updateDashboardSettingsAction,
  updateModuleSettingsAction,
  syncUiSettingsAction,
  setDefaultOrganizationAction,
  setDefaultBranchAction,
} from "@/app/actions/user-preferences";
import type {
  DashboardSettings,
  UpdateProfileInput,
  UpdateRegionalInput,
  NotificationSettings,
  SyncUiSettingsInput,
} from "@/lib/types/user-preferences";

// Query key factory for consistent cache management
export const userPreferencesKeys = {
  all: ["user-preferences"] as const,
  preferences: () => [...userPreferencesKeys.all, "full"] as const,
  dashboardSettings: () => [...userPreferencesKeys.all, "dashboard"] as const,
};

/**
 * Hook to fetch user preferences
 *
 * @param enabled - Whether to enable the query
 * @returns React Query result with preferences
 */
export function usePreferencesQuery(enabled = true) {
  return useQuery({
    queryKey: userPreferencesKeys.preferences(),
    queryFn: async () => {
      const result = await getUserPreferencesAction();
      if (result.success === false) {
        throw new Error(result.error);
      }
      return result.data;
    },
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to fetch dashboard settings only
 *
 * Lighter weight than full preferences. Used for UI sync.
 *
 * @param enabled - Whether to enable the query
 * @returns React Query result with dashboard settings
 */
export function useDashboardSettingsQuery(enabled = true) {
  return useQuery({
    queryKey: userPreferencesKeys.dashboardSettings(),
    queryFn: async () => {
      const result = await getDashboardSettingsAction();
      if (result.success === false) {
        throw new Error(result.error);
      }
      return result.data;
    },
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to update user profile
 *
 * Shows toast on success/error.
 */
export function useUpdateProfileMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateProfileInput) => {
      const result = await updateProfileAction(input);
      if (result.success === false) {
        throw new Error(result.error);
      }
      return result.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(userPreferencesKeys.preferences(), data);
      toast.success("Profile updated successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update profile");
    },
  });
}

/**
 * Hook to update regional settings
 *
 * Shows toast on success/error.
 */
export function useUpdateRegionalSettingsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateRegionalInput) => {
      const result = await updateRegionalSettingsAction(input);
      if (result.success === false) {
        throw new Error(result.error);
      }
      return result.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(userPreferencesKeys.preferences(), data);
      toast.success("Regional settings updated");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update regional settings");
    },
  });
}

/**
 * Hook to update notification settings
 *
 * Shows toast on success/error.
 */
export function useUpdateNotificationSettingsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (settings: Partial<NotificationSettings>) => {
      const result = await updateNotificationSettingsAction(settings);
      if (result.success === false) {
        throw new Error(result.error);
      }
      return result.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(userPreferencesKeys.preferences(), data);
      toast.success("Notification settings updated");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update notification settings");
    },
  });
}

/**
 * Hook to update dashboard settings
 *
 * Performs deep merge with existing settings.
 * Shows toast on success/error.
 */
export function useUpdateDashboardSettingsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (settings: Partial<DashboardSettings>) => {
      const result = await updateDashboardSettingsAction(settings);
      if (result.success === false) {
        throw new Error(result.error);
      }
      return result.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(userPreferencesKeys.preferences(), data);
      queryClient.setQueryData(userPreferencesKeys.dashboardSettings(), data.dashboardSettings);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update dashboard settings");
    },
  });
}

/**
 * Hook to update module-specific settings
 *
 * Shows toast on success/error.
 */
export function useUpdateModuleSettingsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      moduleId,
      settings,
    }: {
      moduleId: string;
      settings: Record<string, unknown>;
    }) => {
      const result = await updateModuleSettingsAction(moduleId, settings);
      if (result.success === false) {
        throw new Error(result.error);
      }
      return result.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(userPreferencesKeys.preferences(), data);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update module settings");
    },
  });
}

/**
 * Hook to sync UI settings to database
 *
 * Silent mutation (no toast) - used for background sync.
 */
export function useSyncUiSettingsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (settings: SyncUiSettingsInput) => {
      const result = await syncUiSettingsAction(settings);
      if (result.success === false) {
        throw new Error(result.error);
      }
      return result.data;
    },
    onSuccess: (data) => {
      // Silently update cache without toast
      queryClient.setQueryData(userPreferencesKeys.preferences(), data);
      queryClient.setQueryData(userPreferencesKeys.dashboardSettings(), data.dashboardSettings);
    },
    onError: (error: Error) => {
      // Silent error - just log
      console.warn("[useSyncUiSettingsMutation] Sync failed:", error.message);
    },
  });
}

/**
 * Hook to set default organization
 *
 * Triggers page reload on success.
 */
export function useSetDefaultOrganizationMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (organizationId: string) => {
      const result = await setDefaultOrganizationAction(organizationId);
      if (result.success === false) {
        throw new Error(result.error);
      }
      return result.data;
    },
    onSuccess: () => {
      // Invalidate all queries and reload page for fresh context
      queryClient.invalidateQueries();
      toast.success("Default organization updated");
      // Delay reload to show toast
      setTimeout(() => {
        window.location.reload();
      }, 500);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to set default organization");
    },
  });
}

/**
 * Hook to set default branch
 *
 * Updates cache without page reload.
 */
export function useSetDefaultBranchMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (branchId: string) => {
      const result = await setDefaultBranchAction(branchId);
      if (result.success === false) {
        throw new Error(result.error);
      }
      return result.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(userPreferencesKeys.preferences(), data);
      toast.success("Default branch updated");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to set default branch");
    },
  });
}
