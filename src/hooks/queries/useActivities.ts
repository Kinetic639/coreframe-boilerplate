"use client";

import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { ActivityService } from "@/lib/services/activity-service";
import { useAppStore } from "@/lib/stores/app-store";
import type { ActivityFilters } from "@/types/activities";

/**
 * Hook for fetching paginated activities
 */
export function useActivities(
  filters: Omit<ActivityFilters, "organizationId">,
  options?: {
    enabled?: boolean;
    refetchInterval?: number;
  }
) {
  const { activeOrgId } = useAppStore();

  return useQuery({
    queryKey: ["activities", activeOrgId, filters],
    queryFn: () => {
      if (!activeOrgId) throw new Error("No active organization");
      return ActivityService.getActivities({
        ...filters,
        organizationId: activeOrgId,
      });
    },
    enabled: !!activeOrgId && (options?.enabled ?? true),
    refetchInterval: options?.refetchInterval,
  });
}

/**
 * Hook for infinite scroll activities
 */
export function useInfiniteActivities(
  filters: Omit<ActivityFilters, "organizationId" | "offset">,
  options?: {
    enabled?: boolean;
    refetchInterval?: number;
  }
) {
  const { activeOrgId } = useAppStore();
  const limit = filters.limit || 20;

  return useInfiniteQuery({
    queryKey: ["activities-infinite", activeOrgId, filters],
    queryFn: ({ pageParam = 0 }) => {
      if (!activeOrgId) throw new Error("No active organization");
      return ActivityService.getActivities({
        ...filters,
        organizationId: activeOrgId,
        offset: pageParam * limit,
        limit,
      });
    },
    enabled: !!activeOrgId && (options?.enabled ?? true),
    refetchInterval: options?.refetchInterval,
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      return lastPage.hasMore ? allPages.length : undefined;
    },
  });
}

/**
 * Hook for fetching a single activity
 */
export function useActivity(id: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["activity", id],
    queryFn: () => ActivityService.getActivityById(id),
    enabled: !!id && (options?.enabled ?? true),
  });
}

/**
 * Hook for fetching activities for a specific entity
 */
export function useEntityActivities(
  entityTypeSlug: string,
  entityId: string,
  options?: { enabled?: boolean }
) {
  const { activeOrgId } = useAppStore();

  return useQuery({
    queryKey: ["entity-activities", activeOrgId, entityTypeSlug, entityId],
    queryFn: () => {
      if (!activeOrgId) throw new Error("No active organization");
      return ActivityService.getActivitiesByEntity(entityTypeSlug, entityId, activeOrgId);
    },
    enabled: !!activeOrgId && !!entityTypeSlug && !!entityId && (options?.enabled ?? true),
  });
}

/**
 * Hook for fetching activity reference data
 */
export function useActivityModules() {
  return useQuery({
    queryKey: ["activity-modules"],
    queryFn: () => ActivityService.getModules(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useActivityEntityTypes(moduleSlug?: string) {
  return useQuery({
    queryKey: ["activity-entity-types", moduleSlug],
    queryFn: () => ActivityService.getEntityTypes(moduleSlug),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useActivityActions() {
  return useQuery({
    queryKey: ["activity-actions"],
    queryFn: () => ActivityService.getActions(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook for activity summary/analytics
 */
export function useActivitySummary(
  filters: Omit<ActivityFilters, "organizationId">,
  options?: { enabled?: boolean }
) {
  const { activeOrgId } = useAppStore();

  return useQuery({
    queryKey: ["activity-summary", activeOrgId, filters],
    queryFn: () => {
      if (!activeOrgId) throw new Error("No active organization");
      return (ActivityService as any).getActivitySummary({
        ...filters,
        organizationId: activeOrgId,
      });
    },
    enabled: !!activeOrgId && (options?.enabled ?? true),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Hook for recent activities (for widgets)
 */
export function useRecentActivities(
  limit: number = 10,
  options?: { enabled?: boolean; refetchInterval?: number }
) {
  const { activeOrgId, activeBranchId } = useAppStore();

  return useQuery({
    queryKey: ["recent-activities", activeOrgId, activeBranchId, limit],
    queryFn: () => {
      if (!activeOrgId) throw new Error("No active organization");
      return ActivityService.getActivities({
        organizationId: activeOrgId,
        branchId: activeBranchId || undefined,
        limit,
        includeDeleted: false,
      });
    },
    enabled: !!activeOrgId && (options?.enabled ?? true),
    refetchInterval: options?.refetchInterval || 30 * 1000, // 30 seconds
    staleTime: 10 * 1000, // 10 seconds
  });
}
