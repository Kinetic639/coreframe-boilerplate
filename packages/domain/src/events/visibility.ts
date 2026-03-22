/**
 * Event Visibility Evaluator
 *
 * Pure domain function: can this viewer see this event?
 *
 * Framework-agnostic — no Next.js, no React, no Expo, no Supabase client.
 * No "server-only" sentinel. The function has no server dependency.
 *
 * Evaluation order (identical to apps/web/src/server/audit/visibility.ts):
 *  1. Unknown entry → deny (prevents info leakage on unregistered events)
 *  2. Intrinsic actor visibility: actorVisible=true AND viewer is the actor
 *  3. Intrinsic self visibility: selfVisible=true AND viewer is entity/target
 *  4. Audit superpower: audit.events.read in non-personal/non-org scope
 *  5. Audit-class exclusion: audit-class events excluded from non-audit feeds
 *  6. Permission-based visibility: viewer holds required permission slug
 *     with scope-aware evaluation (platform / organization / branch)
 *
 * === Minimal structural interfaces ===
 *
 * EventVisibilityRow and EventVisibilityDefinition are intentionally narrow —
 * they contain only the fields this function actually reads.
 *
 * apps/web PlatformEventRow satisfies EventVisibilityRow structurally.
 * apps/web EventRegistryEntry satisfies EventVisibilityDefinition structurally.
 * Callers pass their existing objects without casts.
 *
 * === ProjectionScope ===
 *
 * viewerScope uses a literal union "personal" | "org" | "audit" rather than
 * importing the app-local ProjectionScope type. The values are identical;
 * the name "ProjectionScope" belongs to the web service layer, not domain.
 */

import type { EventScope, EventVisibilityClass } from "./types.js";
import { VISIBILITY_CLASS_PERMISSIONS } from "./types.js";

// ---------------------------------------------------------------------------
// Minimal structural interfaces
// ---------------------------------------------------------------------------

/**
 * The subset of an event row that visibility evaluation reads.
 * apps/web PlatformEventRow satisfies this interface structurally.
 */
export interface EventVisibilityRow {
  actor_user_id: string | null;
  entity_type: string;
  entity_id: string;
  target_type: string | null;
  target_id: string | null;
}

/**
 * The subset of an event registry entry that visibility evaluation reads.
 * apps/web EventRegistryEntry satisfies this interface structurally.
 */
export interface EventVisibilityDefinition {
  actorVisible: boolean;
  selfVisible?: boolean;
  visibilityClass?: EventVisibilityClass;
  scope: EventScope;
}

export interface VisibilityInput {
  viewer: {
    /** null when the viewer is not identified (handled gracefully). */
    userId: string | null;
    /** All permission slugs the viewer holds (from permission snapshot). */
    permissions: string[];
    /** Active branch for the viewer — used for branch-scope evaluation. */
    branchId?: string | null;
  };
  event: EventVisibilityRow;
  /** Registry entry for this event type. null/undefined → deny. */
  entry: EventVisibilityDefinition | null | undefined;
  /**
   * Feed scope being rendered.
   *
   * Literal union kept local to avoid importing the web-service-layer
   * ProjectionScope type into domain. Values are identical.
   *   "personal" — viewer's own activity feed
   *   "org"      — organization activity/sensitive feed
   *   "audit"    — full audit log (all events, full metadata)
   */
  viewerScope?: "personal" | "org" | "audit";
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Determine whether a viewer may see a given event.
 *
 * Behavior is identical to apps/web/src/server/audit/visibility.ts
 * canViewerSeeEvent(). That file re-exports this function with a
 * "server-only" guard; the logic here has no server dependency.
 *
 * Returns true if at least one of the following holds:
 *   1. actorVisible=true AND viewer is the actor (actor_user_id === viewer.userId)
 *   2. selfVisible=true AND event entity_id or target_id matches viewer.userId
 *   3. viewer holds audit.events.read AND viewerScope is audit (or unspecified)
 *   4. audit-class events are excluded from personal/org feeds
 *   5. viewer holds the permission required by entry.visibilityClass
 *      (scope-aware: platform / organization / branch)
 *
 * Returns false for unknown registry entries (entry is null/undefined).
 */
export function canViewerSeeEvent({ viewer, event, entry, viewerScope }: VisibilityInput): boolean {
  if (!entry) {
    // Unknown event type — deny to prevent info leakage on unregistered events.
    return false;
  }

  // -------------------------------------------------------------------------
  // 1. Intrinsic actor visibility
  //    Viewer is the actor who performed this event.
  // -------------------------------------------------------------------------
  if (entry.actorVisible && viewer.userId !== null && event.actor_user_id === viewer.userId) {
    return true;
  }

  // -------------------------------------------------------------------------
  // 2. Intrinsic self visibility
  //    The event is directly about the viewer (as entity or target).
  // -------------------------------------------------------------------------
  if (entry.selfVisible && viewer.userId !== null) {
    const isEntitySelf = event.entity_type === "user" && event.entity_id === viewer.userId;
    const isTargetSelf = event.target_type === "user" && event.target_id === viewer.userId;
    if (isEntitySelf || isTargetSelf) {
      return true;
    }
  }

  // -------------------------------------------------------------------------
  // 3. Audit superpower — audit.events.read grants broad access IN AUDIT SCOPE
  //
  // WHY this is intentional and not a bypass:
  //  - audit.events.read is a privileged, restricted permission granted only
  //    to org_owner by default. It is the explicit contract for the audit feed.
  //  - Holders are expected to see ALL registered events for their org,
  //    including sensitive ones (invitations, role changes, etc.) plus full
  //    metadata (ip_address, user_agent) — that is the purpose of the audit log.
  //  - The DB query already scopes to the viewer's org via RLS, so this
  //    superpower applies within the viewer's org only — not cross-tenant.
  //
  // Scope gate: the superpower only fires in "audit" feed scope (or when no
  // scope is specified, for backward compat with direct evaluator calls).
  // In "org" or "personal" scope, having audit.events.read does NOT surface
  // audit-class events — those belong exclusively to the audit feed.
  // -------------------------------------------------------------------------
  if (
    viewer.permissions.includes(VISIBILITY_CLASS_PERMISSIONS.audit) &&
    viewerScope !== "personal" &&
    viewerScope !== "org"
  ) {
    return true;
  }

  // -------------------------------------------------------------------------
  // 4. Audit-class events are exclusive to audit feed scope.
  //    Even if the viewer has audit.events.read, audit-class events must not
  //    appear in org or personal feeds — they belong only in the audit feed.
  // -------------------------------------------------------------------------
  if (entry.visibilityClass === "audit" && (viewerScope === "org" || viewerScope === "personal")) {
    return false;
  }

  // -------------------------------------------------------------------------
  // 5. Permission-based visibility
  //    If no visibilityClass is defined, only intrinsic paths apply.
  // -------------------------------------------------------------------------
  if (!entry.visibilityClass) {
    return false;
  }

  const requiredPermission = VISIBILITY_CLASS_PERMISSIONS[entry.visibilityClass];

  // Simple includes() check: the permission snapshot already encodes both
  // org-wide and branch-scoped grants. Wildcard expansion happens at compile
  // time in the DB — the snapshot always contains concrete slugs.
  const hasPermission = viewer.permissions.includes(requiredPermission);
  if (!hasPermission) {
    return false;
  }

  // -------------------------------------------------------------------------
  // 6. Scope-aware evaluation
  // -------------------------------------------------------------------------

  if (entry.scope === "platform") {
    // Platform events are globally visible to permission holders.
    return true;
  }

  if (entry.scope === "organization") {
    // Org events: permission is org-scoped. The permission snapshot loaded by
    // the feed action is already restricted to the active org — any match here
    // is authoritative. No additional org-ID comparison needed.
    return true;
  }

  if (entry.scope === "branch") {
    // Branch events: scope resolution is handled entirely by the permission
    // snapshot loader (PermissionServiceV2.getPermissionSnapshotForUser).
    // The flat permissions array already encodes the correct org+branch context.
    return true;
  }

  // Unknown scope — deny by default.
  return false;
}
