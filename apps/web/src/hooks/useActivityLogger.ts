"use client";

import { useCallback } from "react";
import { useAppStore } from "@/lib/stores/app-store";
import { ActivityService } from "@/lib/services/activity-service";
import type { ActivityInput } from "@/types/activities";

export function useActivityLogger() {
  const { activeOrgId, activeBranchId } = useAppStore();

  const logActivity = useCallback(
    async (activity: Omit<ActivityInput, "organizationId" | "branchId">) => {
      if (!activeOrgId) {
        console.warn("Cannot log activity: No active organization");
        return null;
      }

      try {
        return await ActivityService.log({
          ...activity,
          organizationId: activeOrgId,
          branchId: activeBranchId || undefined,
        });
      } catch (error) {
        console.error("Failed to log activity:", error);
        // Don't throw in production to avoid breaking the app
        if (process.env.NODE_ENV === "development") {
          throw error;
        }
        return null;
      }
    },
    [activeOrgId, activeBranchId]
  );

  // Helper methods for common module activities
  const logWarehouseActivity = useCallback(
    async (
      entityTypeSlug: string,
      actionSlug: string,
      entityId: string,
      description: string,
      metadata?: Record<string, unknown>
    ) => {
      return logActivity({
        moduleSlug: "warehouse",
        entityTypeSlug,
        actionSlug,
        entityId,
        description,
        metadata,
      });
    },
    [logActivity]
  );

  const logOrganizationActivity = useCallback(
    async (
      entityTypeSlug: string,
      actionSlug: string,
      entityId: string,
      description: string,
      metadata?: Record<string, unknown>
    ) => {
      return logActivity({
        moduleSlug: "organization",
        entityTypeSlug,
        actionSlug,
        entityId,
        description,
        metadata,
      });
    },
    [logActivity]
  );

  const logTeamsActivity = useCallback(
    async (
      entityTypeSlug: string,
      actionSlug: string,
      entityId: string,
      description: string,
      metadata?: Record<string, unknown>
    ) => {
      return logActivity({
        moduleSlug: "teams",
        entityTypeSlug,
        actionSlug,
        entityId,
        description,
        metadata,
      });
    },
    [logActivity]
  );

  const logSupportActivity = useCallback(
    async (
      entityTypeSlug: string,
      actionSlug: string,
      entityId: string,
      description: string,
      metadata?: Record<string, unknown>
    ) => {
      return logActivity({
        moduleSlug: "support",
        entityTypeSlug,
        actionSlug,
        entityId,
        description,
        metadata,
      });
    },
    [logActivity]
  );

  const logAnalyticsActivity = useCallback(
    async (
      entityTypeSlug: string,
      actionSlug: string,
      entityId: string,
      description: string,
      metadata?: Record<string, unknown>
    ) => {
      return logActivity({
        moduleSlug: "analytics",
        entityTypeSlug,
        actionSlug,
        entityId,
        description,
        metadata,
      });
    },
    [logActivity]
  );

  return {
    logActivity,
    logWarehouseActivity,
    logOrganizationActivity,
    logTeamsActivity,
    logSupportActivity,
    logAnalyticsActivity,
  };
}
