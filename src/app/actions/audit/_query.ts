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

/**
 * Fetch platform events for an organization, optionally restricted to one actor.
 *
 * Uses the caller-supplied authenticated Supabase client.
 * RLS on platform_events enforces org membership — cross-tenant rows
 * cannot be fetched this way.
 *
 * @param supabase    Authenticated client (RLS enforced).
 * @param orgId       Organization ID — mandatory tenant scope.
 * @param fetchLimit  Row limit (use computeFetchLimit).
 * @param actorUserId When provided, adds SQL filter for this user only.
 */
export async function fetchPlatformEvents(
  supabase: SupabaseClient,
  orgId: string,
  fetchLimit: number,
  actorUserId?: string
): Promise<{ rows: PlatformEventRow[]; dbError: string | null }> {
  // platform_events is not yet in generated DB types.
  // as any is isolated here — all callers receive PlatformEventRow[].
  // actorUserId filter applied before .limit() so the chain terminates cleanly.
  let query = (supabase as any).from("platform_events").select("*").eq("organization_id", orgId);

  if (actorUserId) {
    query = query.eq("actor_user_id", actorUserId);
  }

  const { data, error } = await query.order("created_at", { ascending: false }).limit(fetchLimit);

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
 *  - actor_user_id = userId (current user's events only)
 *
 * The projection layer provides a second line of defence:
 *  - personal scope visibility filter (only "self" visibleTo events pass)
 *  - actor guard (only events where actor_user_id === viewerUserId pass)
 *
 * @param userId     The authenticated user's ID — mandatory, never omit.
 * @param fetchLimit Row limit (use computeFetchLimit).
 */
export async function fetchPersonalOrgNullEvents(
  userId: string,
  fetchLimit: number
): Promise<{ rows: PlatformEventRow[]; dbError: string | null }> {
  const client = createServiceClient();

  const { data, error } = await (client as any)
    .from("platform_events")
    .select("*")
    .is("organization_id", null)
    .eq("actor_user_id", userId)
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
