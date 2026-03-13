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
// Primitive union types
// ---------------------------------------------------------------------------

export type ActorType = "user" | "system" | "api" | "worker" | "scheduler" | "automation";

export type EventTier = "baseline" | "enhanced" | "forensic";

export type ProjectionScope = "personal" | "org" | "audit";

// ---------------------------------------------------------------------------
// Visibility scope values used by the registry
// ---------------------------------------------------------------------------

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
   */
  summaryTemplate: string;
  /**
   * Which viewer scopes may see this event at all.
   * Enforced by projection.ts — never by frontend code.
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
}

/**
 * The only event shape the frontend may ever receive.
 * Raw PlatformEventRow must never be returned to client code.
 */
export interface ProjectedEvent {
  id: string;
  created_at: string;
  action_key: string;
  /** Resolved from actor_type + actor_user_id display name lookup. */
  actor_display: string;
  entity_type: string;
  entity_id: string;
  target_type: string | null;
  target_id: string | null;
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
}

// ---------------------------------------------------------------------------
// Service result  (consistent with ServiceResult<T> used across services)
// ---------------------------------------------------------------------------

export type EventServiceResult<T> = { success: true; data: T } | { success: false; error: string };
