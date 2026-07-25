/**
 * Event System — Shared Types
 *
 * This file is the single source of truth for all event system types.
 *
 * Import freely from server-side code.
 * Types here carry no runtime behaviour — safe to import for type-checking only.
 *
 * Architecture ref: docs/event-system/README.md
 * Plan ref:         docs/event-system/EVENT_SYSTEM_IMPLEMENTATION_PLAN.md
 */

import type { ZodTypeAny } from "zod";

// ---------------------------------------------------------------------------
// Primitive union types and visibility model
// These types moved to @repo/domain. Re-exported here for zero consumer churn.
// ---------------------------------------------------------------------------

import type {
  ActorType,
  EventTier,
  EventCategory,
  EventIntent,
  EventScope,
  EventVisibilityClass,
} from "@repo/domain/events";

export type {
  ActorType,
  EventTier,
  EventCategory,
  EventIntent,
  EventScope,
  EventVisibilityClass,
} from "@repo/domain/events";
export { VISIBILITY_CLASS_PERMISSIONS } from "@repo/domain/events";

export type ProjectionScope = "personal" | "org" | "audit";

// ---------------------------------------------------------------------------
// Legacy visibility scope values (kept for backward-compat with existing tests)
// @deprecated Use actorVisible / selfVisible / visibilityClass instead.
// ---------------------------------------------------------------------------

/** @deprecated */
export type EventVisibilityScope = "self" | "org_member" | "org_admin" | "auditor";

// ---------------------------------------------------------------------------
// Raw database row — mirrors public.platform_events exactly
// ---------------------------------------------------------------------------

export interface PlatformEventRow {
  id: string;
  created_at: string;
  organization_id: string | null; // null for auth / global / platform events
  branch_id: string | null;
  actor_user_id: string | null;
  actor_type: ActorType;
  module_slug: string;
  action_key: string;
  entity_type: string;
  entity_id: string; // text — supports UUIDs, doc numbers, composite keys
  target_type: string | null;
  target_id: string | null; // text — same rationale as entity_id
  metadata: Record<string, unknown>;
  event_tier: EventTier;
  request_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
}

// ---------------------------------------------------------------------------
// Input type for eventService.emit()  (Mode A)
// ---------------------------------------------------------------------------

export interface EmitEventInput {
  /** Registry-registered action key — will be rejected if not found. */
  actionKey: string;
  /** null when actorType is not 'user'. Service enforces this. */
  actorUserId?: string | null;
  actorType: ActorType;
  organizationId?: string | null;
  branchId?: string | null;
  entityType: string;
  entityId: string;
  targetType?: string | null;
  targetId?: string | null;
  /** Must conform to the Zod schema registered for this actionKey. */
  metadata?: Record<string, unknown>;
  eventTier: EventTier;
  /**
   * Generated ONCE at the workflow entry point (server action / service boundary).
   * Never generated inside event.service.ts itself.
   * Propagated through the call stack and passed here.
   */
  requestId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

// ---------------------------------------------------------------------------
// Registry entry — code-defined, never stored in DB
// ---------------------------------------------------------------------------

export interface EventRegistryEntry {
  /** Must match the action_key value used in EmitEventInput. */
  actionKey: string;
  moduleSlug: string;
  eventTier: EventTier;
  /** Domain classification for this event. */
  category: EventCategory;
  /** Action classification for this event. */
  intent: EventIntent;
  /** Human-readable description for developer reference. */
  description: string;
  /**
   * Validated at emit time by event.service.ts before any DB write.
   * Rejection on schema mismatch is a hard error — no silent pass.
   */
  metadataSchema: ZodTypeAny;
  /**
   * Named interpolation template resolved at projection/read time.
   * Supported variables: {{actor}}, {{entity}}, {{target}}
   * NEVER stored in the database.
   *
   * @transitional Use i18nKey for new UI rendering. This field is retained
   * as a backend fallback for the legacy `summary` field on ProjectedEvent.
   */
  summaryTemplate: string;

  /**
   * next-intl translation key root for this event, e.g. "events.auth.login".
   * The UI resolves the full key as `${i18nKey}.${perspective}`.
   * Required for the rich summary model introduced in the activity-summary phase.
   */
  i18nKey: string;

  /**
   * Optional icon key (maps to lucide icon name via icon-map on the client).
   * When absent, the UI falls back to a default activity icon.
   */
  iconKey?: string;

  // ---------------------------------------------------------------------------
  // New permission-based visibility model (replaces visibleTo)
  // ---------------------------------------------------------------------------

  /**
   * Contextual scope of the event.
   * platform — auth / global events (no org context)
   * organization — org-level lifecycle events
   * branch — branch-level events
   */
  scope: EventScope;

  /**
   * True if the event actor should always be able to see their own event,
   * regardless of permission snapshot. Applies when actor_user_id === viewerUserId.
   */
  actorVisible: boolean;

  /**
   * True if the event subject (entity_id or target_id matching viewerUserId) can
   * always see the event, regardless of permission snapshot.
   */
  selfVisible?: boolean;

  /**
   * Permission class required for non-intrinsic access.
   * If absent, only actor/self intrinsic visibility applies.
   */
  visibilityClass?: EventVisibilityClass;

  // ---------------------------------------------------------------------------
  // Legacy field — kept to avoid breaking existing contract tests
  // @deprecated Use scope / actorVisible / selfVisible / visibilityClass instead.
  // ---------------------------------------------------------------------------

  /**
   * @deprecated Legacy visibility scope array.
   * Kept for backward compatibility with event-registry.test.ts contract suite.
   * Projection no longer uses this field — see visibility.ts for the evaluator.
   */
  visibleTo: EventVisibilityScope[];

  /**
   * Keys inside `metadata` that are stripped for personal and org projections.
   * Auditor scope always receives full metadata.
   */
  sensitiveFields: string[];
}

// ---------------------------------------------------------------------------
// Projection types  (used in Phase 3 — defined here as the type source of truth)
// ---------------------------------------------------------------------------

export interface ProjectionContext {
  viewerUserId: string;
  viewerScope: ProjectionScope;
  organizationId: string | null;
  /** Permission snapshot slugs for this viewer — checked by projection layer. */
  permissions: string[];
  /**
   * The branch the viewer is currently operating in.
   * Used for branch-scope evaluation when needed.
   * Optional — absent for org-wide or platform queries.
   */
  viewerBranchId?: string | null;
}

// ---------------------------------------------------------------------------
// Rich activity summary model
// ---------------------------------------------------------------------------

/**
 * Perspective from which a summary string is rendered.
 *   self    — the viewer is the actor ("You logged in")
 *   default — the viewer is an observer ("Alice logged in")
 *   audit   — full audit context including forensic data
 */
export type EventSummaryPerspective = "self" | "default" | "audit";

/**
 * A resolved reference to a named entity within an event.
 * Used by the UI layer to render clickable links or plain text.
 */
export type ActivityEntityRef = {
  kind:
    | "user"
    | "movement"
    | "document"
    | "branch"
    | "role"
    | "organization"
    | "invitation"
    | "unknown";
  id: string;
  label: string;
  href?: string;
};

/**
 * Named slots for entity refs within a single event.
 * Not all slots are populated for every event — check for undefined before use.
 */
export type ActivityEntityRefs = {
  actor?: ActivityEntityRef;
  target?: ActivityEntityRef;
  entity?: ActivityEntityRef;
  branch?: ActivityEntityRef;
  role?: ActivityEntityRef;
  organization?: ActivityEntityRef;
};

/**
 * The only event shape the frontend may ever receive.
 * Raw PlatformEventRow must never be returned to client code.
 */
export interface ProjectedEvent {
  id: string;
  created_at: string;
  action_key: string;
  /** Domain classification — derived from registry at projection time, never stored. */
  category: EventCategory;
  /** Action classification — derived from registry at projection time, never stored. */
  intent: EventIntent;
  /** Resolved from actor_type + actor_user_id display name lookup. */
  actor_display: string;
  entity_type: string;
  entity_id: string;
  target_type: string | null;
  target_id: string | null;
  /** Branch this event belongs to, if any. Carried from the raw event row. */
  branch_id: string | null;
  /** Generated from summaryTemplate at read time — never stored. */
  summary: string;
  /** Sensitive fields already stripped per registry + viewer scope. */
  metadata: Record<string, unknown>;
  event_tier: EventTier;
  request_id: string | null;
  // ip_address and user_agent are intentionally absent unless auditor scope.
  // They are added by the projection layer for audit-scope responses only.
  ip_address?: string | null;
  user_agent?: string | null;

  // -------------------------------------------------------------------------
  // Rich summary model (added in activity-summary phase)
  // -------------------------------------------------------------------------

  /** next-intl translation key for the summary, e.g. "events.auth.login" */
  summaryKey: string;
  /** Which perspective to use when resolving the translation sub-key */
  summaryPerspective: EventSummaryPerspective;
  /** Named parameters for the translation string, e.g. { actorName: "Alice" } */
  summaryParams: Record<string, string | number | boolean | null>;
  /** Entity refs for linked UI rendering */
  summaryEntities: ActivityEntityRefs;
  /** Primary navigation target for this event (optional) */
  primaryHref?: string;
  /** Icon key for the event (maps to lucide icon name) */
  iconKey?: string;
}

// ---------------------------------------------------------------------------
// Service result  (consistent with ServiceResult<T> used across services)
// ---------------------------------------------------------------------------

export type EventServiceResult<T> = { success: true; data: T } | { success: false; error: string };
