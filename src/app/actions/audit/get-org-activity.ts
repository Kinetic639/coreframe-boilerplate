"use server";

import { createClient } from "@/utils/supabase/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { ORG_READ } from "@/lib/constants/permissions";
import { projectEvents, type ProjectionResult } from "@/server/audit/projection";
import {
  fetchPlatformEvents,
  computeFetchLimit,
  validatePagination,
  DEFAULT_PAGE_LIMIT,
} from "./_query";

export type GetOrgActivityResult =
  | { success: true; data: ProjectionResult }
  | { success: false; error: string };

/**
 * Returns organization-visible activity events.
 *
 * Scope: org — events visible to org members and admins.
 * Requires org.read permission (standard org member level).
 * Sensitive fields and ip/ua are stripped by the projection layer.
 * RLS on platform_events enforces org membership automatically.
 *
 * Pagination is validated server-side before use.
 * Query strategy: bounded fetch of (offset + limit) * 2, capped at 500.
 * Buffer accounts for auditor-only events being filtered out by projection.
 */
export async function getOrgActivityAction(
  rawLimit = DEFAULT_PAGE_LIMIT,
  rawOffset = 0
): Promise<GetOrgActivityResult> {
  const { limit, offset } = validatePagination(rawLimit, rawOffset);

  const context = await loadDashboardContextV2();
  if (!context?.app.activeOrgId || !context.user.user?.id) {
    return { success: false, error: "No active organization" };
  }

  if (!checkPermission(context.user.permissionSnapshot, ORG_READ)) {
    return { success: false, error: "Unauthorized" };
  }

  const userId = context.user.user.id;
  const orgId = context.app.activeOrgId;
  const supabase = await createClient();

  const { rows, dbError } = await fetchPlatformEvents(
    supabase,
    orgId,
    computeFetchLimit(offset, limit)
  );

  if (dbError) {
    console.error("[getOrgActivityAction] DB query failed", {
      orgId,
      userId,
      error: dbError,
    });
    return { success: false, error: "Failed to load activity" };
  }

  const result = projectEvents({
    events: rows,
    context: {
      viewerUserId: userId,
      viewerScope: "org",
      organizationId: orgId,
      permissions: context.user.permissionSnapshot.allow,
    },
    limit,
    offset,
  });

  return { success: true, data: result };
}
