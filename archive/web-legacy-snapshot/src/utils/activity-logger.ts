import { ActivityService } from "@/lib/services/activity-service";
import type { ActivityInput, ActivityContext } from "@/types/activities";

/**
 * Static utility class for activity logging outside of React components
 */
export class ActivityLogger {
  /**
   * Context-aware logging with automatic context injection
   */
  static async logWithContext(
    activity: Omit<ActivityInput, "organizationId" | "userId" | "branchId">,
    context: ActivityContext
  ): Promise<string> {
    return ActivityService.log({
      ...activity,
      organizationId: context.organizationId,
      branchId: context.branchId,
      userId: context.userId,
      sessionId: context.sessionId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      url: context.url,
    });
  }

  /**
   * Batch logging with context
   */
  static async logBatchWithContext(
    activities: Array<Omit<ActivityInput, "organizationId" | "userId" | "branchId">>,
    context: ActivityContext
  ): Promise<string[]> {
    const activitiesWithContext = activities.map((activity) => ({
      ...activity,
      organizationId: context.organizationId,
      branchId: context.branchId,
      userId: context.userId,
      sessionId: context.sessionId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      url: context.url,
    }));

    return ActivityService.logBatch(activitiesWithContext);
  }

  /**
   * Module-specific logging methods
   */
  static async logWarehouseActivity(
    context: ActivityContext,
    entityTypeSlug: string,
    actionSlug: string,
    entityId: string,
    description: string,
    metadata?: Record<string, unknown>
  ): Promise<string> {
    return this.logWithContext(
      {
        moduleSlug: "warehouse",
        entityTypeSlug,
        actionSlug,
        entityId,
        description,
        metadata,
      },
      context
    );
  }

  static async logOrganizationActivity(
    context: ActivityContext,
    entityTypeSlug: string,
    actionSlug: string,
    entityId: string,
    description: string,
    metadata?: Record<string, unknown>
  ): Promise<string> {
    return this.logWithContext(
      {
        moduleSlug: "organization",
        entityTypeSlug,
        actionSlug,
        entityId,
        description,
        metadata,
      },
      context
    );
  }

  static async logTeamsActivity(
    context: ActivityContext,
    entityTypeSlug: string,
    actionSlug: string,
    entityId: string,
    description: string,
    metadata?: Record<string, unknown>
  ): Promise<string> {
    return this.logWithContext(
      {
        moduleSlug: "teams",
        entityTypeSlug,
        actionSlug,
        entityId,
        description,
        metadata,
      },
      context
    );
  }

  static async logSupportActivity(
    context: ActivityContext,
    entityTypeSlug: string,
    actionSlug: string,
    entityId: string,
    description: string,
    metadata?: Record<string, unknown>
  ): Promise<string> {
    return this.logWithContext(
      {
        moduleSlug: "support",
        entityTypeSlug,
        actionSlug,
        entityId,
        description,
        metadata,
      },
      context
    );
  }

  static async logSystemActivity(
    organizationId: string,
    actionSlug: string,
    description: string,
    metadata?: Record<string, unknown>
  ): Promise<string> {
    return this.logWithContext(
      {
        moduleSlug: "system",
        actionSlug,
        description,
        metadata,
      },
      { organizationId }
    );
  }

  static async logSecurityActivity(
    context: { organizationId: string; userId?: string; ipAddress?: string; userAgent?: string },
    actionSlug: string,
    description: string,
    metadata?: Record<string, unknown>
  ): Promise<string> {
    return this.logWithContext(
      {
        moduleSlug: "security",
        actionSlug,
        description,
        metadata,
        status: "recorded", // Security events are immediately recorded
      },
      context
    );
  }

  static async logAnalyticsActivity(
    context: ActivityContext,
    entityTypeSlug: string,
    actionSlug: string,
    entityId: string,
    description: string,
    metadata?: Record<string, unknown>
  ): Promise<string> {
    return this.logWithContext(
      {
        moduleSlug: "analytics",
        entityTypeSlug,
        actionSlug,
        entityId,
        description,
        metadata,
      },
      context
    );
  }

  /**
   * Common activity patterns
   */
  static async logEntityCreated(
    context: ActivityContext,
    moduleSlug: string,
    entityTypeSlug: string,
    entityId: string,
    entityName: string,
    metadata?: Record<string, unknown>
  ): Promise<string> {
    return this.logWithContext(
      {
        moduleSlug,
        entityTypeSlug,
        actionSlug: "created",
        entityId,
        description: `Created ${entityTypeSlug}: ${entityName}`,
        metadata,
      },
      context
    );
  }

  static async logEntityUpdated(
    context: ActivityContext,
    moduleSlug: string,
    entityTypeSlug: string,
    entityId: string,
    entityName: string,
    changes: Record<string, { old: any; new: any }>,
    metadata?: Record<string, unknown>
  ): Promise<string> {
    const changeDescription = Object.keys(changes).join(", ");
    return this.logWithContext(
      {
        moduleSlug,
        entityTypeSlug,
        actionSlug: "updated",
        entityId,
        description: `Updated ${entityTypeSlug}: ${entityName} (${changeDescription})`,
        metadata: { ...metadata, changes },
      },
      context
    );
  }

  static async logEntityDeleted(
    context: ActivityContext,
    moduleSlug: string,
    entityTypeSlug: string,
    entityId: string,
    entityName: string,
    metadata?: Record<string, unknown>
  ): Promise<string> {
    return this.logWithContext(
      {
        moduleSlug,
        entityTypeSlug,
        actionSlug: "deleted",
        entityId,
        description: `Deleted ${entityTypeSlug}: ${entityName}`,
        metadata,
      },
      context
    );
  }

  static async logUserAction(
    context: ActivityContext,
    action: string,
    description: string,
    metadata?: Record<string, unknown>
  ): Promise<string> {
    return this.logWithContext(
      {
        moduleSlug: "organization",
        entityTypeSlug: "user",
        actionSlug: action,
        entityId: context.userId,
        description,
        metadata,
      },
      context
    );
  }

  /**
   * Error logging utility
   */
  static async logError(
    context: ActivityContext,
    moduleSlug: string,
    error: Error,
    additionalContext?: Record<string, unknown>
  ): Promise<string> {
    return this.logWithContext(
      {
        moduleSlug,
        actionSlug: "failed",
        description: `Error in ${moduleSlug}: ${error.message}`,
        status: "error",
        metadata: {
          error: {
            name: error.name,
            message: error.message,
            stack: error.stack,
          },
          ...additionalContext,
        },
      },
      context
    );
  }

  /**
   * Audit trail utility
   */
  static async logAuditEvent(
    context: ActivityContext,
    action: string,
    resource: string,
    description: string,
    metadata?: Record<string, unknown>
  ): Promise<string> {
    return this.logWithContext(
      {
        moduleSlug: "security",
        actionSlug: action,
        description: `Audit: ${description} on ${resource}`,
        metadata: {
          ...metadata,
          auditType: "security",
          resource,
        },
      },
      context
    );
  }
}
