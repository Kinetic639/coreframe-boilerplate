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
 * from the Event Registry and the central visibility evaluator — never from DB rows.
 *
 * Architecture ref: docs/event-system/README.md
 * Plan ref:         docs/event-system/EVENT_SYSTEM_IMPLEMENTATION_PLAN.md
 */

import "server-only";

import { getRegistryEntry } from "@/server/audit/event-registry";
import { canViewerSeeEvent } from "@/server/audit/visibility";
import { buildEventSummary } from "@/server/audit/summary-builder";
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
// Main projection function
// ---------------------------------------------------------------------------

/**
 * Project a set of raw platform event rows into viewer-safe projected events.
 *
 * Steps per event:
 *  1. Registry lookup — skip with a console.warn if action key is unknown
 *  2. Visibility check — delegate to canViewerSeeEvent() from visibility.ts
 *  3. Personal-scope guard — additional actor check for personal scope
 *  4. Summary generation — interpolate registry summaryTemplate (legacy)
 *  5. Rich summary — build summaryKey/summaryPerspective/summaryParams/summaryEntities
 *  6. Field projection — strip sensitive fields and ip/ua for non-audit scopes
 *  7. Pagination — apply limit/offset to the filtered result
 *
 * Note: summaryParams.actorName is initially set to the raw UUID for user actors.
 * Callers that call enrichActorDisplays() after projection should also call
 * applyActorEnrichmentToSummaries() to update actorName and summaryEntities.actor.label.
 */
export function projectEvents(input: ProjectionInput): ProjectionResult {
  const { events, context } = input;
  const limit = input.limit ?? 50;
  const offset = input.offset ?? 0;

  // Build viewer descriptor for the visibility evaluator
  const viewer = {
    userId: context.viewerUserId,
    permissions: context.permissions,
    branchId: context.viewerBranchId ?? null,
  };

  // Empty enriched map — actorName will be updated by enrichActorDisplays post-pass
  const emptyEnrichedMap = new Map<string, string>();

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

    // Personal scope: defence-in-depth check.
    //
    // The DB query now fetches rows where the viewer is the actor OR the
    // entity/target subject (Fix A — self-visible events). We must NOT
    // pre-filter here by actor alone; that would block selfVisible events
    // where the viewer is the target (e.g. org.member.role_assigned emitted
    // by an admin where target_id = viewerUserId).
    //
    // Instead we rely entirely on canViewerSeeEvent() below, which evaluates
    // all three intrinsic paths (actorVisible, selfVisible) plus permission
    // checks. The only pre-flight we do here is reject null-actor system
    // events that can never be attributed to any personal feed.
    //
    // A system event (actor_user_id = null) cannot satisfy either
    // actorVisible (actor guard requires non-null actor === viewer) or
    // selfVisible (requires entity/target === viewerUserId by registry rule).
    // Explicitly filtering them out here avoids calling the evaluator
    // unnecessarily, but is not strictly required for correctness.
    if (
      context.viewerScope === "personal" &&
      row.actor_user_id === null &&
      row.actor_type !== "user"
    ) {
      // System/scheduler/worker-originated event with no user actor — not personal.
      continue;
    }

    // Central visibility evaluation — replaces old SCOPE_QUALIFIERS / visibleTo logic
    const isVisible = canViewerSeeEvent({
      viewer,
      event: row,
      entry,
      viewerScope: context.viewerScope,
    });
    if (!isVisible) {
      continue;
    }

    // Summary generation (legacy — kept for backward compat with event.summary consumers)
    const summary = generateSummary(row, entry.summaryTemplate);

    // Actor display: prefer user ID representation; projection callers may enrich later
    const actorDisplay = resolveActorDisplay(row);
    // Rich summary model
    const richSummary = buildEventSummary({
      event: row,
      entry,
      viewerUserId: context.viewerUserId,
      viewerScope: context.viewerScope,
      enrichedActorDisplays: emptyEnrichedMap,
    });

    // Field projection — metadata stripping
    const isAuditScope = context.viewerScope === "audit";
    const metadata = projectMetadata(row.metadata, entry.sensitiveFields, isAuditScope);

    const projectedEvent: ProjectedEvent = {
      id: row.id,
      created_at: row.created_at,
      action_key: row.action_key,
      actor_display: actorDisplay,
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      target_type: row.target_type,
      // Rich summary fields
      summaryKey: richSummary.summaryKey,
      summaryPerspective: richSummary.summaryPerspective,
      summaryParams: richSummary.summaryParams,
      summaryEntities: richSummary.summaryEntities,
      primaryHref: richSummary.primaryHref,
      iconKey: richSummary.iconKey,
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
// Post-enrichment summary update
// ---------------------------------------------------------------------------

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * After actor enrichment resolves UUID → display name, update summaryParams
 * and summaryEntities on each projected event with the enriched actor name.
 *
 * Called by feed actions after enrichActorDisplays() completes.
 */
export function applyActorEnrichmentToSummaries(
  events: ProjectedEvent[],
  displayMap: Map<string, string>
): ProjectedEvent[] {
  if (displayMap.size === 0) return events;

  return events.map((event) => {
    const actorEntityId = event.summaryEntities?.actor?.id;
    if (!actorEntityId || !UUID_PATTERN.test(actorEntityId)) return event;

    const resolvedName = displayMap.get(actorEntityId);
    if (!resolvedName) {
      const currentActorName = event.summaryParams?.actorName;
      if (typeof currentActorName === "string" && UUID_PATTERN.test(currentActorName)) {
        return {
          ...event,
          summaryParams: {
            ...event.summaryParams,
            actorName: `User ${actorEntityId.slice(0, 8)}`,
          },
          summaryEntities: {
            ...event.summaryEntities,
            actor: event.summaryEntities?.actor
              ? { ...event.summaryEntities.actor, label: `User ${actorEntityId.slice(0, 8)}` }
              : undefined,
          },
        };
      }
      return event;
    }

    return {
      ...event,
      summaryParams: {
        ...event.summaryParams,
        actorName: resolvedName,
      },
      summaryEntities: {
        ...event.summaryEntities,
        actor: event.summaryEntities?.actor
          ? { ...event.summaryEntities.actor, label: resolvedName }
          : undefined,
      },
    };
  });
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
 * unless the viewer is in audit scope (auditors always receive full metadata).
 */
function projectMetadata(
  metadata: Record<string, unknown>,
  sensitiveFields: string[],
  isAuditScope: boolean
): Record<string, unknown> {
  if (isAuditScope || sensitiveFields.length === 0) {
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

// ---------------------------------------------------------------------------
// Re-export ProjectionScope for convenience (avoids deep imports in callers)
// ---------------------------------------------------------------------------

export type { ProjectionScope };
