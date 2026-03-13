/**
 * Event Projection Layer — Backend Only
 *
 * This is the ONLY path that may return event data to application code.
 * Raw PlatformEventRow must never be returned to callers — projection is mandatory.
 *
 * Three projection scopes (all backed by the same canonical event store):
 *   personal  — viewer's own events only; no ip/ua; sensitive fields stripped
 *   org       — org-visible events; no ip/ua; sensitive fields stripped
 *   audit     — all events in org; full fields including ip/ua and all metadata
 *
 * Visibility rules, sensitive field definitions, and summary templates all come
 * from the Event Registry — never from the DB row.
 *
 * Architecture ref: docs/event-system/README.md
 * Plan ref:         docs/event-system/EVENT_SYSTEM_IMPLEMENTATION_PLAN.md
 */

import "server-only";

import { getRegistryEntry } from "@/server/audit/event-registry";
import type {
  PlatformEventRow,
  ProjectedEvent,
  ProjectionContext,
  ProjectionScope,
} from "@/server/audit/types";

// ---------------------------------------------------------------------------
// Public API types
// ---------------------------------------------------------------------------

export interface ProjectionInput {
  events: PlatformEventRow[];
  context: ProjectionContext;
  /** Maximum number of events to return. Defaults to 50. Never unbounded. */
  limit?: number;
  /** Zero-based offset into the filtered+projected result set. Defaults to 0. */
  offset?: number;
}

export interface ProjectionResult {
  events: ProjectedEvent[];
  /** Total number of events after visibility filtering (before pagination). */
  total: number;
  limit: number;
  offset: number;
}

// ---------------------------------------------------------------------------
// Scope-to-visibleTo mapping
// ---------------------------------------------------------------------------

/**
 * Maps a ProjectionScope to the EventVisibilityScope values that qualify.
 * An event is visible to a scope if the registry entry's visibleTo array
 * contains at least one of the values returned here.
 */
const SCOPE_QUALIFIERS: Record<ProjectionScope, readonly string[]> = {
  // Personal: viewer sees their own events → self
  personal: ["self"],
  // Org: members and admins can see → self, org_member, org_admin
  org: ["self", "org_member", "org_admin"],
  // Audit: everything visible to all scopes including auditors
  audit: ["self", "org_member", "org_admin", "auditor"],
};

// ---------------------------------------------------------------------------
// Main projection function
// ---------------------------------------------------------------------------

/**
 * Project a set of raw platform event rows into viewer-safe projected events.
 *
 * Steps per event:
 *  1. Registry lookup — skip with a console.warn if action key is unknown
 *  2. Visibility filter — skip if registry.visibleTo has no overlap with scope qualifiers
 *  3. Personal-scope guard — skip if scope=personal and event.actor_user_id !== viewerUserId
 *  4. Summary generation — interpolate registry summaryTemplate
 *  5. Field projection — strip sensitive fields and ip/ua for non-audit scopes
 *  6. Pagination — apply limit/offset to the filtered result
 */
export function projectEvents(input: ProjectionInput): ProjectionResult {
  const { events, context } = input;
  const limit = input.limit ?? 50;
  const offset = input.offset ?? 0;
  const qualifiers = SCOPE_QUALIFIERS[context.viewerScope];

  // Pass 1: filter and project
  const projected: ProjectedEvent[] = [];

  for (const row of events) {
    const entry = getRegistryEntry(row.action_key);

    // Unknown action key — skip, do not crash
    if (!entry) {
      console.warn(
        `[projection] Unknown action_key "${row.action_key}" in event ${row.id} — skipped`
      );
      continue;
    }

    // Visibility check: at least one qualifier must be in registry visibleTo
    const isVisible = entry.visibleTo.some((scope) => qualifiers.includes(scope));
    if (!isVisible) {
      continue;
    }

    // Personal scope: only events where viewer is the actor
    if (context.viewerScope === "personal" && row.actor_user_id !== context.viewerUserId) {
      continue;
    }

    // Summary generation
    const summary = generateSummary(row, entry.summaryTemplate);

    // Actor display: prefer user ID representation; projection callers may enrich later
    const actorDisplay = resolveActorDisplay(row);

    // Field projection
    const metadata = projectMetadata(row.metadata, entry.sensitiveFields, context.viewerScope);

    const projectedEvent: ProjectedEvent = {
      id: row.id,
      created_at: row.created_at,
      action_key: row.action_key,
      actor_display: actorDisplay,
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      target_type: row.target_type,
      target_id: row.target_id,
      summary,
      metadata,
      event_tier: row.event_tier,
      request_id: row.request_id,
    };

    // ip_address and user_agent are only included for audit scope
    if (context.viewerScope === "audit") {
      projectedEvent.ip_address = row.ip_address;
      projectedEvent.user_agent = row.user_agent;
    }

    projected.push(projectedEvent);
  }

  const total = projected.length;
  const paginated = projected.slice(offset, offset + limit);

  return { events: paginated, total, limit, offset };
}

// ---------------------------------------------------------------------------
// Summary generation
// ---------------------------------------------------------------------------

/**
 * Interpolate a summaryTemplate string.
 *
 * Supported variables:
 *   {{actor}}  — resolved actor display string
 *   {{entity}} — entity_type:entity_id
 *   {{target}} — target_type:target_id (or empty string if null)
 */
function generateSummary(row: PlatformEventRow, template: string): string {
  const actor = resolveActorDisplay(row);
  const entity = `${row.entity_type}:${row.entity_id}`;
  const target = row.target_type && row.target_id ? `${row.target_type}:${row.target_id}` : "";

  return template
    .replace(/\{\{actor\}\}/g, actor)
    .replace(/\{\{entity\}\}/g, entity)
    .replace(/\{\{target\}\}/g, target);
}

/**
 * Resolve a display string for the actor.
 *
 * At this layer we do not have access to a user display-name lookup.
 * Callers that need enriched actor names should enrich the result set
 * after projection. This function returns a minimal stable identifier.
 */
function resolveActorDisplay(row: PlatformEventRow): string {
  if (row.actor_type === "user" && row.actor_user_id) {
    return row.actor_user_id;
  }
  return row.actor_type;
}

// ---------------------------------------------------------------------------
// Metadata field projection
// ---------------------------------------------------------------------------

/**
 * Return a copy of the metadata object with sensitive fields removed,
 * unless the viewer scope is 'audit' (auditors always receive full metadata).
 */
function projectMetadata(
  metadata: Record<string, unknown>,
  sensitiveFields: string[],
  scope: ProjectionScope
): Record<string, unknown> {
  if (scope === "audit" || sensitiveFields.length === 0) {
    return { ...metadata };
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (!sensitiveFields.includes(key)) {
      result[key] = value;
    }
  }
  return result;
}
