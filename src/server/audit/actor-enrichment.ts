/**
 * Actor Display Enrichment — Backend Only
 *
 * Resolves actor_user_id UUIDs to human-readable display names by batch-querying
 * public.users. Applied after projection, before returning data to callers.
 *
 * Design rules:
 *  - One batched query per call — never N+1.
 *  - Falls back gracefully: if a user is not found, uses "User <first-8-chars-of-uuid>".
 *  - Never fails the feed: if the enrichment query throws, returns events unchanged.
 *  - Operates on ProjectedEvent shapes only — never touches raw PlatformEventRow.
 *  - Server-only: must never be imported by client code.
 *
 * Architecture ref: docs/event-system/README.md
 */

import "server-only";

import { createServiceClient } from "@/utils/supabase/service";
import type { ProjectedEvent } from "@/server/audit/types";
import { applyActorEnrichmentToSummaries } from "@/server/audit/projection";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Enrich a list of projected events by resolving actor_display UUIDs to
 * human-readable names.
 *
 * The projection layer sets actor_display to the raw UUID when the actor is
 * a user. This function replaces those UUIDs with "First Last" or "email"
 * falling back to "User <first-8-chars>" when no user record is found.
 *
 * Additionally, this function applies the resolved names to the rich summary
 * fields (summaryParams.actorName, summaryEntities.actor.label) via
 * applyActorEnrichmentToSummaries().
 *
 * @param events  Projected events (output of projectEvents()).
 * @returns       Same array with actor_display values and summary actor names
 *                enriched in-memory. Returns the original array unchanged on error.
 */
export async function enrichActorDisplays(events: ProjectedEvent[]): Promise<ProjectedEvent[]> {
  if (events.length === 0) return events;

  // Collect unique actor_display values that look like UUIDs.
  // The projection layer sets actor_display to the raw UUID string for user actors,
  // or to the actor_type string (e.g. "system") for non-user actors.
  const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  const uuidsToResolve = [
    ...new Set(events.map((e) => e.actor_display).filter((d) => UUID_PATTERN.test(d))),
  ];

  if (uuidsToResolve.length === 0) return events;

  // Batch query public.users for all unique UUIDs — single round trip.
  let userMap: Map<string, string>;
  try {
    userMap = await fetchUserDisplayNames(uuidsToResolve);
  } catch (err) {
    // Non-fatal: enrichment failure must not break the feed.
    console.warn("[actor-enrichment] Failed to resolve actor display names (non-fatal)", {
      uuidCount: uuidsToResolve.length,
      error: err instanceof Error ? err.message : String(err),
    });
    return events;
  }

  // Enrich actor_display and summary fields in-memory — return new objects.
  const withEnrichedActorDisplay = events.map((event) => {
    if (!UUID_PATTERN.test(event.actor_display)) return event;
    const resolved = userMap.get(event.actor_display);
    if (!resolved) {
      // Fallback: "User <first-8-chars-of-uuid>"
      return { ...event, actor_display: `User ${event.actor_display.slice(0, 8)}` };
    }
    return { ...event, actor_display: resolved };
  });

  // Apply enriched names to the rich summary fields (summaryParams.actorName, etc.)
  return applyActorEnrichmentToSummaries(withEnrichedActorDisplay, userMap);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Batch-fetch display names for the given user IDs from public.users.
 *
 * Priority: "First Last" > email > "User <first-8-chars>"
 * Deleted users are included — their names are still meaningful in audit logs.
 */
async function fetchUserDisplayNames(userIds: string[]): Promise<Map<string, string>> {
  const client = createServiceClient();

  const { data, error } = await (client as any)
    .from("users")
    .select("id, first_name, last_name, email")
    .in("id", userIds);

  if (error) {
    throw new Error(`users lookup failed: ${error.message}`);
  }

  const map = new Map<string, string>();
  for (const row of data ?? []) {
    const id: string = row.id;
    const firstName: string | null = row.first_name ?? null;
    const lastName: string | null = row.last_name ?? null;
    const email: string | null = row.email ?? null;

    const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
    if (fullName) {
      map.set(id, fullName);
    } else if (email) {
      map.set(id, email);
    } else {
      map.set(id, `User ${id.slice(0, 8)}`);
    }
  }

  return map;
}
