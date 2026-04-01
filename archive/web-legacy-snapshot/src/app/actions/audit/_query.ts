/**
 * Shared DB query helpers for audit feed actions.
 *
 * Responsibilities:
 *  1. Isolate the `as any` cast for `platform_events` (not yet in generated DB
 *     types). All callers receive strongly-typed PlatformEventRow[].
 *  2. Bounded fetch strategy: (offset + limit) * PROJECTION_BUFFER, capped at
 *     ABSOLUTE_CAP. Absorbs projection-layer filtering waste without unbounded
 *     queries.
 *  3. Org-null personal auth event fetch: a controlled service-role path for
 *     self-visible auth events emitted with organization_id = null. Tightly
 *     restricted to actor_user_id = currentUserId — no other data exposed.
 *  4. Server-side pagination validation: clamp limit and offset to safe bounds.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/utils/supabase/service";
import type { PlatformEventRow } from "@/server/audit/types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Multiplier above (offset + limit) to absorb projection-layer filtering. */
const PROJECTION_BUFFER = 2;

/** Absolute maximum rows fetched in any single query. */
const ABSOLUTE_CAP = 500;

/** Default page size for all feed actions. */
export const DEFAULT_PAGE_LIMIT = 50;

/** Maximum page size accepted from callers. */
const MAX_PAGE_LIMIT = 50;

// ---------------------------------------------------------------------------
// Pagination validation
// ---------------------------------------------------------------------------

/**
 * Clamp caller-supplied limit and offset to safe server-side bounds.
 *
 * Rules:
 *  - limit:  clamped to [1, MAX_PAGE_LIMIT]; defaults to DEFAULT_PAGE_LIMIT
 *  - offset: clamped to [0, ∞); defaults to 0
 *
 * This prevents callers (including compromised client calls) from requesting
 * unbounded page sizes or negative offsets.
 */
export function validatePagination(
  rawLimit: number,
  rawOffset: number
): { limit: number; offset: number } {
  const limit = Math.min(Math.max(Math.floor(rawLimit), 1), MAX_PAGE_LIMIT);
  const offset = Math.max(Math.floor(rawOffset), 0);
  return { limit, offset };
}

// ---------------------------------------------------------------------------
// Bounded fetch limit
// ---------------------------------------------------------------------------

/**
 * Compute the bounded DB fetch limit for a given page request.
 *
 * Formula: clamp( (offset + limit) * PROJECTION_BUFFER, offset + limit, ABSOLUTE_CAP )
 *
 * Use computeFetchLimit AFTER validatePagination so inputs are already safe.
 */
export function computeFetchLimit(offset: number, limit: number): number {
  const base = offset + limit;
  const buffered = base * PROJECTION_BUFFER;
  return Math.min(Math.max(buffered, base), ABSOLUTE_CAP);
}

// ---------------------------------------------------------------------------
// Org-scoped platform event query (authenticated RLS client)
// ---------------------------------------------------------------------------

/** UUID v4 pattern — used to validate branchId before use as a DB filter. */
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validate a branchId string as a UUID before using it as a DB filter.
 * Returns the branchId unchanged if valid, or undefined if invalid/absent.
 * This prevents injection of arbitrary strings into the query chain.
 */
export function validateBranchId(branchId: string | undefined): string | undefined {
  if (!branchId) return undefined;
  return UUID_V4_PATTERN.test(branchId) ? branchId : undefined;
}

/**
 * Fetch platform events for an organization, optionally restricted to one actor
 * and/or one branch.
 *
 * Uses the caller-supplied authenticated Supabase client.
 * RLS on platform_events enforces org membership — cross-tenant rows
 * cannot be fetched this way.
 *
 * @param supabase    Authenticated client (RLS enforced).
 * @param orgId       Organization ID — mandatory tenant scope.
 * @param fetchLimit  Row limit (use computeFetchLimit).
 * @param actorUserId When provided, adds SQL filter for this user only.
 * @param branchId    When provided, filters to events with branch_id = branchId.
 *                    Must be a valid UUID — pass through validateBranchId() first.
 */
export async function fetchPlatformEvents(
  supabase: SupabaseClient,
  orgId: string,
  fetchLimit: number,
  actorUserId?: string,
  branchId?: string
): Promise<{ rows: PlatformEventRow[]; dbError: string | null }> {
  // platform_events is not yet in generated DB types.
  // as any is isolated here — all callers receive PlatformEventRow[].
  // actorUserId filter applied before .limit() so the chain terminates cleanly.
  let query = (supabase as any).from("platform_events").select("*").eq("organization_id", orgId);

  if (actorUserId) {
    query = query.eq("actor_user_id", actorUserId);
  }

  if (branchId) {
    query = query.eq("branch_id", branchId);
  }

  const { data, error } = await query.order("created_at", { ascending: false }).limit(fetchLimit);

  if (error) {
    return { rows: [], dbError: error.message as string };
  }

  return { rows: (data ?? []) as PlatformEventRow[], dbError: null };
}

// ---------------------------------------------------------------------------
// Personal feed — org-scoped self-visible event query
// ---------------------------------------------------------------------------

/**
 * Fetch org-scoped platform events where the viewer is the subject (not the
 * actor). This covers selfVisible events such as org.member.role_assigned where
 * an admin assigns a role to the viewer — the viewer is the target, not actor.
 *
 * Fetches rows matching ANY of:
 *   - actor_user_id = userId           (actor path — also returned by fetchPlatformEvents)
 *   - entity_type = 'user' AND entity_id = userId   (entity self-visible)
 *   - target_type = 'user' AND target_id = userId   (target self-visible)
 *
 * Using an OR filter avoids a separate query and keeps the result set tightly
 * scoped to personal-relevant rows only. The projection evaluator then applies
 * the canonical visibility rules (canViewerSeeEvent) as the final gatekeeper.
 *
 * Uses the caller-supplied authenticated Supabase client (RLS enforced).
 *
 * @param supabase    Authenticated client (RLS enforced).
 * @param orgId       Organization ID — mandatory tenant scope.
 * @param userId      Viewer's user ID — events are fetched relative to this user.
 * @param fetchLimit  Row limit (use computeFetchLimit).
 */
export async function fetchPersonalOrgEvents(
  supabase: SupabaseClient,
  orgId: string,
  userId: string,
  fetchLimit: number
): Promise<{ rows: PlatformEventRow[]; dbError: string | null }> {
  // OR filter: actor, entity-self, or target-self.
  // Supabase client OR syntax: "col1.eq.val,and(col2.eq.v2,col3.eq.v3)"
  const orFilter = [
    `actor_user_id.eq.${userId}`,
    `and(entity_type.eq.user,entity_id.eq.${userId})`,
    `and(target_type.eq.user,target_id.eq.${userId})`,
  ].join(",");

  const { data, error } = await (supabase as any)
    .from("platform_events")
    .select("*")
    .eq("organization_id", orgId)
    .or(orFilter)
    .order("created_at", { ascending: false })
    .limit(fetchLimit);

  if (error) {
    return { rows: [], dbError: error.message as string };
  }

  return { rows: (data ?? []) as PlatformEventRow[], dbError: null };
}

// ---------------------------------------------------------------------------
// Org-null personal auth event query (service-role — tightly restricted)
// ---------------------------------------------------------------------------

/**
 * Fetch platform events with organization_id = null for a specific user.
 *
 * These are global/auth events (e.g. auth.login, auth.login.failed) that are
 * emitted without an org context. They are NOT accessible via the regular
 * RLS-enforced client because the RLS policy requires organization_id IS NOT NULL.
 *
 * SECURITY: This function uses the service-role client which bypasses RLS.
 * It is strictly restricted to:
 *  - organization_id IS NULL (org-null events only)
 *  - actor_user_id = userId OR (entity_type='user' AND entity_id=userId)
 *    OR (target_type='user' AND target_id=userId)
 *    (personal-relevant rows only — covers actor path AND self-visible paths)
 *
 * The projection layer provides a second line of defence:
 *  - canViewerSeeEvent() evaluates actorVisible, selfVisible, and permission checks
 *  - Only events the viewer is entitled to see are returned to callers
 *
 * Auth/platform events rarely have a non-actor subject, but the broader filter
 * future-proofs this path for any auth event that targets a specific user.
 *
 * @param userId     The authenticated user's ID — mandatory, never omit.
 * @param fetchLimit Row limit (use computeFetchLimit).
 */
export async function fetchPersonalOrgNullEvents(
  userId: string,
  fetchLimit: number
): Promise<{ rows: PlatformEventRow[]; dbError: string | null }> {
  const client = createServiceClient();

  // OR filter: actor, entity-self, or target-self (same logic as fetchPersonalOrgEvents).
  const orFilter = [
    `actor_user_id.eq.${userId}`,
    `and(entity_type.eq.user,entity_id.eq.${userId})`,
    `and(target_type.eq.user,target_id.eq.${userId})`,
  ].join(",");

  const { data, error } = await (client as any)
    .from("platform_events")
    .select("*")
    .is("organization_id", null)
    .or(orFilter)
    .order("created_at", { ascending: false })
    .limit(fetchLimit);

  if (error) {
    return { rows: [], dbError: error.message as string };
  }

  return { rows: (data ?? []) as PlatformEventRow[], dbError: null };
}

// ---------------------------------------------------------------------------
// Merge helper
// ---------------------------------------------------------------------------

/**
 * Merge two PlatformEventRow arrays and sort by created_at descending.
 * Used to combine org-scoped and org-null personal event sets before projection.
 */
export function mergeAndSortEvents(
  a: PlatformEventRow[],
  b: PlatformEventRow[]
): PlatformEventRow[] {
  return [...a, ...b].sort(
    (x, y) => new Date(y.created_at).getTime() - new Date(x.created_at).getTime()
  );
}
