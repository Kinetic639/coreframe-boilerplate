/**
 * Event Domain Types
 *
 * Framework-agnostic type vocabulary for the event/audit domain.
 * Safe for use in web, mobile, or any platform context.
 *
 * Extracted from apps/web/src/server/audit/types.ts.
 * That file re-exports these for zero consumer churn.
 *
 * === What is NOT here (and why) ===
 *
 * PlatformEventRow        — raw DB row mirroring platform_events table; app-local
 * EmitEventInput          — operational input to event.service.ts; app-local
 * EventRegistryEntry      — imports ZodTypeAny + "server-only" registry; app-local
 * EventServiceResult<T>   — service error pattern; app-local
 * EventVisibilityScope    — deprecated; app-local
 * ProjectionScope         — named after the projection service layer; app-local
 * ProjectedEvent          — contains web route hrefs (summaryEntities.href); deferred
 * ProjectionContext       — orbits ProjectedEvent and app-local projection.ts; deferred
 * ActivityEntityRef/Refs  — contain href?: string web route fields; deferred
 * EventSummaryPerspective — i18n rendering concept tied to ProjectedEvent; deferred
 */

export type ActorType = "user" | "system" | "api" | "worker" | "scheduler" | "automation";

export type EventTier = "baseline" | "enhanced" | "forensic";

/**
 * Domain classification — WHAT domain the event belongs to.
 * Finite, non-overlapping. Every event must have exactly one.
 */
export type EventCategory =
  | "AUTH"
  | "USER"
  | "MEMBERSHIP"
  | "ORGANIZATION"
  | "INVITATION"
  | "SYSTEM"
  | "DATA"
  | "STATE"
  | "SECURITY"
  | "AUTOMATION";

/**
 * Action classification — WHAT ACTION happened.
 * Finite, orthogonal to category. Every event must have exactly one.
 */
export type EventIntent =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "ASSIGN"
  | "REMOVE"
  | "ACCEPT"
  | "DECLINE"
  | "SUCCESS"
  | "FAIL"
  | "REQUEST";

/** Scope at which the event is contextually meaningful. */
export type EventScope = "platform" | "organization" | "branch";

/**
 * Which permission class gates access to this event type.
 * Maps directly to a permission slug via VISIBILITY_CLASS_PERMISSIONS.
 */
export type EventVisibilityClass = "org_activity" | "org_sensitive" | "audit";

/**
 * Central mapping from visibility class → required permission slug.
 * Single source of truth — never duplicate these strings elsewhere.
 */
export const VISIBILITY_CLASS_PERMISSIONS: Record<EventVisibilityClass, string> = {
  org_activity: "events.org_activity.read",
  org_sensitive: "events.org_sensitive.read",
  audit: "audit.events.read",
};
