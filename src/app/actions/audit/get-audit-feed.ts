"use server";

import { createClient } from "@/utils/supabase/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { AUDIT_EVENTS_READ } from "@/lib/constants/permissions";
import { projectEvents, type ProjectionResult } from "@/server/audit/projection";
import {
  fetchPlatformEvents,
  computeFetchLimit,
  validatePagination,
  DEFAULT_PAGE_LIMIT,
} from "./_query";

export type GetAuditFeedResult =
  | { success: true; data: ProjectionResult }
  | { success: false; error: string };

/**
 * Returns the full audit event feed for the organization.
 *
 * Scope: audit — all events including ip_address, user_agent, and full metadata.
 * Requires audit.events.read permission (org_owner by default).
 * RLS on platform_events enforces org membership automatically.
 *
 * Pagination is validated server-side before use.
 * Query strategy: bounded fetch of (offset + limit) * 2, capped at 500.
 * In audit scope all fetched rows project, so the buffer is conservative.
 */
export async function getAuditFeedAction(
  rawLimit = DEFAULT_PAGE_LIMIT,
  rawOffset = 0
): Promise<GetAuditFeedResult> {
  const { limit, offset } = validatePagination(rawLimit, rawOffset);

  const context = await loadDashboardContextV2();
  if (!context?.app.activeOrgId || !context.user.user?.id) {
    return { success: false, error: "No active organization" };
  }

  if (!checkPermission(context.user.permissionSnapshot, AUDIT_EVENTS_READ)) {
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
    console.error("[getAuditFeedAction] DB query failed", {
      orgId,
      userId,
      error: dbError,
    });
    return { success: false, error: "Failed to load audit feed" };
  }

  const result = projectEvents({
    events: rows,
    context: {
      viewerUserId: userId,
      viewerScope: "audit",
      organizationId: orgId,
      permissions: context.user.permissionSnapshot.allow,
    },
    limit,
    offset,
  });

  return { success: true, data: result };
}
