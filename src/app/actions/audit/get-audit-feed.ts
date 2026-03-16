"use server";

import { createClient } from "@/utils/supabase/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { AUDIT_EVENTS_READ } from "@/lib/constants/permissions";
import { projectEvents, type ProjectionResult } from "@/server/audit/projection";
import { enrichActorDisplays } from "@/server/audit/actor-enrichment";
import {
  fetchPlatformEvents,
  computeFetchLimit,
  validatePagination,
  validateBranchId,
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
 *
 * @param rawLimit   Page size (clamped 1–50 server-side).
 * @param rawOffset  Zero-based offset (clamped ≥ 0 server-side).
 * @param rawBranchId Optional branch UUID. When provided, results are scoped to
 *                   events with branch_id = branchId. Invalid UUIDs are silently
 *                   ignored and the unfiltered feed is returned instead.
 */
export async function getAuditFeedAction(
  rawLimit = DEFAULT_PAGE_LIMIT,
  rawOffset = 0,
  rawBranchId?: string
): Promise<GetAuditFeedResult> {
  const { limit, offset } = validatePagination(rawLimit, rawOffset);
  const branchId = validateBranchId(rawBranchId);

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
    computeFetchLimit(offset, limit),
    undefined,
    branchId
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

  // Enrich actor_display UUIDs to human-readable names — best effort, non-fatal.
  const enrichedEvents = await enrichActorDisplays(result.events);

  return { success: true, data: { ...result, events: enrichedEvents } };
}
