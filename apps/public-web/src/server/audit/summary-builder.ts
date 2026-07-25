/**
 * Event Summary Builder — Backend Only
 *
 * Builds the rich summary model for a projected event:
 *   - Determines the rendering perspective (self | default | audit)
 *   - Builds named summaryParams for i18n interpolation
 *   - Builds summaryEntities with resolved hrefs
 *   - Computes primaryHref for the event
 *
 * This file is server-only. It must never be imported by client code.
 *
 * Route resolution notes:
 *   - /dashboard/organization/users/members/[memberId] — per-member page EXISTS
 *   - /dashboard/organization/users/roles — roles list page EXISTS
 *   - /dashboard/organization/users/branches — branches list page EXISTS
 *   - /dashboard/organization/users — users section index EXISTS
 * These are real routes verified from the filesystem.
 */

import "server-only";

import type {
  PlatformEventRow,
  EventRegistryEntry,
  EventSummaryPerspective,
  ActivityEntityRefs,
  ProjectionScope,
} from "./types";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface SummaryBuildInput {
  event: PlatformEventRow;
  entry: EventRegistryEntry;
  viewerUserId: string | null;
  viewerScope: ProjectionScope;
  /**
   * Map from user UUID → resolved display name.
   * Built by actor-enrichment after the initial projection pass.
   * May be empty on first pass — caller is responsible for post-updating.
   */
  enrichedActorDisplays: Map<string, string>;
}

export interface BuiltSummary {
  summaryKey: string;
  summaryPerspective: EventSummaryPerspective;
  summaryParams: Record<string, string | number | boolean | null>;
  summaryEntities: ActivityEntityRefs;
  primaryHref?: string;
  iconKey?: string;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function buildEventSummary(input: SummaryBuildInput): BuiltSummary {
  const { event, entry, viewerUserId, viewerScope, enrichedActorDisplays } = input;

  const perspective = determinePerspective(viewerUserId, event, entry, viewerScope);
  const summaryKey = entry.i18nKey;

  // Actor display name — use enriched map if available, fall back to UUID/type
  const actorRawId =
    event.actor_type === "user" && event.actor_user_id ? event.actor_user_id : null;
  const actorDisplay =
    actorRawId !== null
      ? (enrichedActorDisplays.get(actorRawId) ?? `User ${actorRawId.slice(0, 8)}`)
      : event.actor_type;

  // Build params and entities for this specific event
  const { summaryParams, summaryEntities, primaryHref } = buildParamsAndEntities(
    event,
    entry,
    actorDisplay,
    actorRawId,
    viewerUserId
  );

  return {
    summaryKey,
    summaryPerspective: perspective,
    summaryParams,
    summaryEntities,
    primaryHref,
    iconKey: entry.iconKey,
  };
}

// ---------------------------------------------------------------------------
// Perspective determination
// ---------------------------------------------------------------------------

function determinePerspective(
  viewerUserId: string | null,
  event: PlatformEventRow,
  entry: EventRegistryEntry,
  viewerScope: ProjectionScope
): EventSummaryPerspective {
  // Audit scope always uses audit perspective regardless of viewer identity
  if (viewerScope === "audit") return "audit";

  if (!viewerUserId) return "default";

  // Actor is the viewer → self perspective
  if (event.actor_user_id === viewerUserId) return "self";

  // Viewer is the subject (entity or target) — selfVisible events
  if (entry.selfVisible) {
    const isEntitySelf = event.entity_type === "user" && event.entity_id === viewerUserId;
    const isTargetSelf = event.target_type === "user" && event.target_id === viewerUserId;
    if (isEntitySelf || isTargetSelf) return "self";
  }

  return "default";
}

// ---------------------------------------------------------------------------
// Route resolution helpers
// ---------------------------------------------------------------------------

function resolveUserHref(userId: string | null): string | undefined {
  if (!userId) return undefined;
  return `/dashboard/organization/users/members/${userId}`;
}

function resolveBranchHref(): string {
  // No per-branch detail page exists — link to branches list
  return `/dashboard/organization/users/branches`;
}

function resolveRolesHref(): string {
  return `/dashboard/organization/users/roles`;
}

function resolveOrgUsersHref(): string {
  return `/dashboard/organization/users`;
}

// ---------------------------------------------------------------------------
// Per-event params and entities builder
// ---------------------------------------------------------------------------

function buildParamsAndEntities(
  event: PlatformEventRow,
  _entry: EventRegistryEntry,
  actorDisplay: string,
  actorRawId: string | null,
  viewerUserId: string | null
): {
  summaryParams: Record<string, string | number | boolean | null>;
  summaryEntities: ActivityEntityRefs;
  primaryHref?: string;
} {
  const params: Record<string, string | number | boolean | null> = {};
  const entities: ActivityEntityRefs = {};
  let primaryHref: string | undefined;

  // Actor entity
  params.actorName = actorDisplay;
  if (actorRawId) {
    entities.actor = {
      kind: "user",
      id: actorRawId,
      label: actorDisplay,
      href: resolveUserHref(actorRawId),
    };
  } else {
    entities.actor = {
      kind: "unknown",
      id: "system",
      label: actorDisplay,
    };
  }

  // Target entity (if any)
  if (event.target_type && event.target_id) {
    const targetLabel = resolveTargetLabel(event);
    params.targetName = targetLabel;
    entities.target = {
      kind: event.target_type === "user" ? "user" : "unknown",
      id: event.target_id,
      label: targetLabel,
      href: event.target_type === "user" ? resolveUserHref(event.target_id) : undefined,
    };
  }

  // Per action_key enrichment
  const metadata = event.metadata as Record<string, unknown>;

  switch (event.action_key) {
    // -------------------------------------------------------------------------
    // Auth events
    // -------------------------------------------------------------------------
    case "auth.login":
    case "auth.login.failed":
    case "auth.password.reset_requested":
    case "auth.password.reset_completed":
    case "auth.session.revoked": {
      // Auth events are self-only; primaryHref leads to personal activity
      primaryHref = `/dashboard/activity`;
      // Add email param for audit perspective (sensitive — will be stripped by projection)
      if (metadata.email) {
        params.email = String(metadata.email);
      }
      if (metadata.ip_address) {
        params.ipAddress = String(metadata.ip_address);
      }
      break;
    }

    // -------------------------------------------------------------------------
    // Org events
    // -------------------------------------------------------------------------
    case "org.created":
    case "org.updated": {
      if (metadata.org_name) {
        params.orgName = String(metadata.org_name);
        entities.organization = {
          kind: "organization",
          id: event.entity_id,
          label: String(metadata.org_name),
        };
      }
      primaryHref = `/dashboard/organization`;
      break;
    }

    case "org.onboarding.completed": {
      if (metadata.org_name) {
        params.orgName = String(metadata.org_name);
      }
      primaryHref = `/dashboard/organization`;
      break;
    }

    // -------------------------------------------------------------------------
    // Member events
    // -------------------------------------------------------------------------
    case "org.member.invited": {
      const inviteeFirstName =
        typeof metadata.invitee_first_name === "string" ? metadata.invitee_first_name : null;
      const inviteeLastName =
        typeof metadata.invitee_last_name === "string" ? metadata.invitee_last_name : null;
      const inviteeEmail =
        typeof metadata.invitee_email === "string" ? metadata.invitee_email : null;

      const inviteeName =
        [inviteeFirstName, inviteeLastName].filter(Boolean).join(" ").trim() ||
        inviteeEmail ||
        "Unknown";

      params.targetName = inviteeName;
      if (inviteeEmail) params.email = inviteeEmail;
      entities.target = {
        kind: "user",
        id: event.target_id ?? "unknown",
        label: inviteeName,
      };
      primaryHref = resolveOrgUsersHref();
      break;
    }

    case "org.member.removed": {
      const removedName =
        typeof metadata.removed_user_name === "string"
          ? metadata.removed_user_name
          : event.target_id
            ? `User ${String(event.target_id).slice(0, 8)}`
            : "Unknown";

      params.targetName = removedName;
      entities.target = {
        kind: "user",
        id: event.target_id ?? "unknown",
        label: removedName,
        href:
          event.target_id && event.target_id !== viewerUserId
            ? resolveUserHref(event.target_id)
            : undefined,
      };
      primaryHref = resolveOrgUsersHref();
      break;
    }

    case "org.member.role_assigned":
    case "org.member.role_removed": {
      const roleName = typeof metadata.role_name === "string" ? metadata.role_name : "Unknown Role";
      params.roleName = roleName;
      entities.role = {
        kind: "role",
        id: typeof metadata.role_id === "string" ? metadata.role_id : "unknown",
        label: roleName,
        href: resolveRolesHref(),
      };

      // Resolve target user display
      const targetId = event.target_id;
      if (targetId) {
        const targetLabel = params.targetName ?? `User ${targetId.slice(0, 8)}`;
        params.targetName = targetLabel;
        entities.target = {
          kind: "user",
          id: targetId,
          label: String(targetLabel),
          href: resolveUserHref(targetId),
        };
      }
      primaryHref = resolveOrgUsersHref();
      break;
    }

    // -------------------------------------------------------------------------
    // Invitation events
    // -------------------------------------------------------------------------
    case "org.invitation.accepted":
    case "org.invitation.declined": {
      primaryHref = resolveOrgUsersHref();
      break;
    }

    case "org.invitation.cancelled":
    case "org.invitation.resent": {
      const targetEmail =
        typeof metadata.invitee_email === "string" ? metadata.invitee_email : null;
      if (targetEmail) {
        params.targetName = targetEmail;
        entities.target = {
          kind: "invitation",
          id: event.target_id ?? "unknown",
          label: targetEmail,
        };
      }
      primaryHref = resolveOrgUsersHref();
      break;
    }

    // -------------------------------------------------------------------------
    // Role events
    // -------------------------------------------------------------------------
    case "org.role.created":
    case "org.role.updated":
    case "org.role.deleted": {
      const roleName = typeof metadata.role_name === "string" ? metadata.role_name : "Unknown Role";
      params.roleName = roleName;
      entities.entity = {
        kind: "role",
        id: event.entity_id,
        label: roleName,
        href: resolveRolesHref(),
      };
      primaryHref = resolveRolesHref();
      break;
    }

    // -------------------------------------------------------------------------
    // Branch events
    // -------------------------------------------------------------------------
    case "org.branch.created":
    case "org.branch.updated":
    case "org.branch.deleted": {
      const branchName =
        typeof metadata.branch_name === "string" ? metadata.branch_name : "Unknown Branch";
      params.branchName = branchName;
      entities.branch = {
        kind: "branch",
        id: event.entity_id,
        label: branchName,
        href: resolveBranchHref(),
      };
      entities.entity = {
        kind: "branch",
        id: event.entity_id,
        label: branchName,
        href: resolveBranchHref(),
      };
      primaryHref = resolveBranchHref();
      break;
    }
  }

  return { summaryParams: params, summaryEntities: entities, primaryHref };
}

// ---------------------------------------------------------------------------
// Target label resolver
// ---------------------------------------------------------------------------

/**
 * Resolve a display label for the event target.
 * Falls back to a short UUID prefix when no better info is available.
 */
function resolveTargetLabel(event: PlatformEventRow): string {
  // If target is an email string stored as target_id (invitation events), show it directly
  if (event.target_type === "email" && event.target_id) {
    return event.target_id;
  }
  // Use target_id short form
  if (event.target_id) {
    return `User ${event.target_id.slice(0, 8)}`;
  }
  return "Unknown";
}
