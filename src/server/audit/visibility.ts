/**
 * Central Event Visibility Evaluator — Backend Only
 *
 * Single function that answers: can this viewer see this event?
 *
 * Evaluation order:
 *  1. Intrinsic actor visibility   — viewer is the actor
 *  2. Intrinsic self visibility    — event is about the viewer (entity/target)
 *  3. Permission-based visibility  — viewer holds the required permission slug
 *     3a. Scope-aware evaluation   — platform / organization / branch rules
 *
 * This module is the ONLY place in the codebase that implements this logic.
 * projection.ts delegates entirely to canViewerSeeEvent() — no inline rules.
 *
 * Architecture ref: docs/event-system/README.md
 */

import "server-only";

import type { PlatformEventRow, EventRegistryEntry } from "./types";
import { VISIBILITY_CLASS_PERMISSIONS } from "./types";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface VisibilityInput {
  viewer: {
    /** null when the viewer is not identified (unusual but handled gracefully). */
    userId: string | null;
    /** All permission slugs the viewer holds (from permission snapshot). */
    permissions: string[];
    /** Active branch for the viewer — used for branch-scope evaluation. */
    branchId?: string | null;
  };
  event: PlatformEventRow;
  /** Registry entry for this event type. null/undefined → deny (unknown event). */
  entry: EventRegistryEntry | null | undefined;
}

/**
 * Determine whether a viewer may see a given event.
 *
 * Returns true if at least one of the following holds:
 *   1. actorVisible=true AND viewer is the actor (actor_user_id === viewer.userId)
 *   2. selfVisible=true AND event entity_id or target_id matches viewer.userId
 *   3. viewer holds the permission required by entry.visibilityClass
 *      (with scope-aware evaluation for branch events)
 *
 * Returns false for unknown registry entries (entry is null/undefined).
 */
export function canViewerSeeEvent({ viewer, event, entry }: VisibilityInput): boolean {
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
  // 3. Audit superpower — audit.events.read grants broad access
  //
  // WHY this is intentional and not a bypass:
  //  - audit.events.read is a privileged, restricted permission granted only
  //    to org_owner by default. It is the explicit contract for the audit feed.
  //  - Holders are expected to see ALL registered events for their org,
  //    including sensitive ones (invitations, role changes, etc.) plus full
  //    metadata (ip_address, user_agent) — that is the purpose of the audit log.
  //  - The DB query already scopes to the viewer's org via RLS, so this
  //    superpower applies within the viewer's org only — not cross-tenant.
  //  - Scope note: if the viewer has audit.events.read as an org-wide grant
  //    (branch_id IS NULL in user_effective_permissions), it appears in the
  //    flat permission snapshot and grants access to all events including branch
  //    events for that org. This is the intended behaviour — auditors need
  //    full visibility across all branches of their org.
  // -------------------------------------------------------------------------
  if (viewer.permissions.includes(VISIBILITY_CLASS_PERMISSIONS.audit)) {
    return true;
  }

  // -------------------------------------------------------------------------
  // 4. Permission-based visibility
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
  // 3a. Scope-aware evaluation
  // -------------------------------------------------------------------------

  if (entry.scope === "platform") {
    // Platform events are globally visible to permission holders.
    // There is no org/branch scoping on platform events.
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
    //
    // How the flat snapshot encodes branch scope:
    //   - Org-wide grant: user has the permission at org level
    //     (branch_id IS NULL in user_effective_permissions). This appears in
    //     the flat `permissions` array regardless of active branch. Org-wide
    //     holders can see all branch events for their org.
    //   - Branch-specific grant: user has the permission only for a specific
    //     branch (branch_id = X in user_effective_permissions). This only
    //     appears in the flat `permissions` array when the snapshot was loaded
    //     with that branch as the active branch context.
    //
    // Limitation: the flat `permissions: string[]` does NOT carry branch_id
    // metadata per slug. We cannot distinguish here whether the viewer's
    // `events.org_activity.read` is org-wide or branch-B-scoped. This means:
    //
    //   Scenario: viewer has events.org_activity.read scoped to branch B only.
    //   - If they load the feed with branch B active → snapshot includes the
    //     slug → they see branch B events. CORRECT.
    //   - If they load with branch A active → snapshot excludes the slug
    //     (PermissionServiceV2 only loads branch A rows + org-wide rows) →
    //     they don't see the slug → denied. CORRECT.
    //
    // The DB snapshot loader therefore handles scope resolution correctly.
    // The includes() check above is sufficient — the snapshot is already the
    // right set of slugs for the active org+branch context.
    return true;
  }

  // Unknown scope — deny by default.
  return false;
}
