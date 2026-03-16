"use server";

import { createClient } from "@/utils/supabase/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { projectEvents, type ProjectionResult } from "@/server/audit/projection";
import {
  collectReferences,
  batchLoadReferences,
  applyReferenceEnrichment,
} from "@/server/audit/reference-enrichment";
import {
  fetchPersonalOrgEvents,
  fetchPersonalOrgNullEvents,
  mergeAndSortEvents,
  computeFetchLimit,
  validatePagination,
  DEFAULT_PAGE_LIMIT,
} from "./_query";

export type GetPersonalActivityResult =
  | { success: true; data: ProjectionResult }
  | { success: false; error: string };

/**
 * Returns the current user's own activity events across two sources:
 *
 *  1. Org-scoped events — fetched via authenticated client (RLS enforces org
 *     membership). Fetches rows where the viewer is the actor OR the event
 *     subject (entity/target). This covers:
 *      - Events the viewer performed (actor path)
 *      - Self-visible events where the viewer is the subject, e.g.
 *        org.member.role_assigned emitted by an admin where target_id = viewerUserId.
 *
 *  2. Org-null auth/global events — fetched via service-role client (bypasses
 *     RLS, which would otherwise block organization_id IS NULL rows). Same OR
 *     filter for actor/entity/target. Examples: auth.login, auth.session.revoked.
 *
 * Both result sets are merged, sorted by created_at desc, and passed through
 * projectEvents() with scope=personal. The projection layer applies the
 * canonical canViewerSeeEvent() evaluator which checks actorVisible,
 * selfVisible, and permission-based visibility — it is the single gatekeeper.
 *
 * Pagination is validated server-side before use.
 * Query strategy: bounded fetch of (offset + limit) * 2, capped at 500.
 */
export async function getPersonalActivityAction(
  rawLimit = DEFAULT_PAGE_LIMIT,
  rawOffset = 0
): Promise<GetPersonalActivityResult> {
  const { limit, offset } = validatePagination(rawLimit, rawOffset);

  const context = await loadDashboardContextV2();
  if (!context?.app.activeOrgId || !context.user.user?.id) {
    return { success: false, error: "No active organization" };
  }

  const userId = context.user.user.id;
  const orgId = context.app.activeOrgId;
  const fetchLimit = computeFetchLimit(offset, limit);

  // Query 1: org-scoped personal events (RLS client)
  // Fetches actor events AND self-visible events (entity/target = userId).
  const supabase = await createClient();
  const { rows: orgRows, dbError: orgError } = await fetchPersonalOrgEvents(
    supabase,
    orgId,
    userId,
    fetchLimit
  );

  if (orgError) {
    console.error("[getPersonalActivityAction] Org-scoped query failed", {
      orgId,
      userId,
      error: orgError,
    });
    return { success: false, error: "Failed to load activity" };
  }

  // Query 2: org-null self auth events (service-role, tightly restricted)
  const { rows: authRows, dbError: authError } = await fetchPersonalOrgNullEvents(
    userId,
    fetchLimit
  );

  if (authError) {
    // Non-fatal: log and continue with org-scoped rows only.
    // Auth events may simply not exist yet for this user.
    console.warn("[getPersonalActivityAction] Org-null query failed (non-fatal)", {
      userId,
      error: authError,
    });
  }

  const merged = mergeAndSortEvents(orgRows, authError ? [] : authRows);

  const result = projectEvents({
    events: merged,
    context: {
      viewerUserId: userId,
      viewerScope: "personal",
      organizationId: orgId,
      permissions: context.user.permissionSnapshot.allow,
    },
    limit,
    offset,
  });

  // Batch-enrich all entity references (actor, target user, role, branch) — best effort, non-fatal.
  const refs = collectReferences(result.events);
  const ctx = await batchLoadReferences(refs);
  const enrichedEvents = applyReferenceEnrichment(result.events, ctx);

  return { success: true, data: { ...result, events: enrichedEvents } };
}
