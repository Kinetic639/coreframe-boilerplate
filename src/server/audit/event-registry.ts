/**
 * Event Registry — Backend Only
 *
 * Code-defined registry of all valid platform event action keys.
 * This file must never be imported by client-side code.
 *
 * The registry is the single authority for:
 *   - which action keys are valid for emission
 *   - what metadata shape is required per action key
 *   - what summary template to use at projection time
 *   - which viewer scopes may see each event
 *   - which metadata fields are sensitive and must be stripped
 *
 * Architecture ref: docs/event-system/README.md
 * Plan ref:         docs/event-system/EVENT_SYSTEM_IMPLEMENTATION_PLAN.md
 */

import "server-only";

import { z } from "zod";
import type { EventRegistryEntry } from "./types";

// ---------------------------------------------------------------------------
// Registry map
// ---------------------------------------------------------------------------

export const EVENT_REGISTRY: Readonly<Record<string, EventRegistryEntry>> = {
  // -------------------------------------------------------------------------
  // Auth module
  // -------------------------------------------------------------------------

  "auth.login": {
    actionKey: "auth.login",
    moduleSlug: "auth",
    eventTier: "baseline",
    description: "User successfully authenticated",
    metadataSchema: z.object({
      email: z.string().email().optional(),
    }),
    summaryTemplate: "{{actor}} logged in",
    visibleTo: ["self", "auditor"],
    sensitiveFields: ["email"],
  },

  "auth.login.failed": {
    actionKey: "auth.login.failed",
    moduleSlug: "auth",
    eventTier: "baseline",
    description: "Authentication attempt failed",
    metadataSchema: z.object({
      email: z.string().email().optional(),
      reason: z.string().optional(),
    }),
    summaryTemplate: "Failed login attempt",
    visibleTo: ["auditor"],
    sensitiveFields: ["email"],
  },

  "auth.password.reset_requested": {
    actionKey: "auth.password.reset_requested",
    moduleSlug: "auth",
    eventTier: "baseline",
    description: "User requested a password reset",
    metadataSchema: z.object({
      email: z.string().email().optional(),
    }),
    summaryTemplate: "{{actor}} requested a password reset",
    visibleTo: ["self", "auditor"],
    sensitiveFields: ["email"],
  },

  "auth.password.reset_completed": {
    actionKey: "auth.password.reset_completed",
    moduleSlug: "auth",
    eventTier: "baseline",
    description: "User completed a password reset",
    metadataSchema: z.object({}),
    summaryTemplate: "{{actor}} completed a password reset",
    visibleTo: ["self", "auditor"],
    sensitiveFields: [],
  },

  "auth.session.revoked": {
    actionKey: "auth.session.revoked",
    moduleSlug: "auth",
    eventTier: "enhanced",
    description: "User session was revoked",
    metadataSchema: z.object({
      reason: z.string().optional(),
    }),
    summaryTemplate: "{{actor}} session revoked",
    visibleTo: ["self", "auditor"],
    sensitiveFields: [],
  },

  // -------------------------------------------------------------------------
  // Organization management module
  // -------------------------------------------------------------------------

  "org.created": {
    actionKey: "org.created",
    moduleSlug: "organization-management",
    eventTier: "baseline",
    description: "A new organization was created",
    metadataSchema: z.object({
      org_name: z.string().optional(),
      org_slug: z.string().optional(),
    }),
    summaryTemplate: "Organization created",
    visibleTo: ["self", "org_member", "org_admin", "auditor"],
    sensitiveFields: [],
  },

  "org.updated": {
    actionKey: "org.updated",
    moduleSlug: "organization-management",
    eventTier: "baseline",
    description: "Organization profile was updated",
    metadataSchema: z.object({
      updated_fields: z.array(z.string()).optional(),
    }),
    summaryTemplate: "Organization profile updated by {{actor}}",
    visibleTo: ["self", "org_member", "org_admin", "auditor"],
    sensitiveFields: [],
  },

  "org.member.invited": {
    actionKey: "org.member.invited",
    moduleSlug: "organization-management",
    eventTier: "enhanced",
    description: "A user was invited to join the organization",
    metadataSchema: z.object({
      invitee_email: z.string().email(),
      invitee_first_name: z.string().optional(),
      invitee_last_name: z.string().optional(),
    }),
    summaryTemplate: "{{actor}} invited {{target}} to the organization",
    visibleTo: ["self", "org_admin", "auditor"],
    sensitiveFields: ["invitee_email", "invitee_first_name", "invitee_last_name"],
  },

  "org.member.removed": {
    actionKey: "org.member.removed",
    moduleSlug: "organization-management",
    eventTier: "enhanced",
    description: "A member was removed from the organization",
    metadataSchema: z.object({
      removed_user_id: z.string().uuid().optional(),
      removed_user_name: z.string().optional(),
    }),
    summaryTemplate: "{{actor}} removed {{target}} from the organization",
    visibleTo: ["self", "org_admin", "auditor"],
    sensitiveFields: ["removed_user_name"],
  },

  "org.invitation.accepted": {
    actionKey: "org.invitation.accepted",
    moduleSlug: "organization-management",
    eventTier: "baseline",
    description: "An invitation was accepted and the user joined the organization",
    metadataSchema: z.object({
      invitation_id: z.string().uuid().optional(),
    }),
    summaryTemplate: "{{target}} accepted invitation and joined the organization",
    visibleTo: ["self", "org_member", "org_admin", "auditor"],
    sensitiveFields: [],
  },

  "org.invitation.cancelled": {
    actionKey: "org.invitation.cancelled",
    moduleSlug: "organization-management",
    eventTier: "enhanced",
    description: "An invitation was cancelled before it was accepted",
    metadataSchema: z.object({
      invitation_id: z.string().uuid().optional(),
      invitee_email: z.string().email().optional(),
    }),
    summaryTemplate: "{{actor}} cancelled invitation for {{target}}",
    visibleTo: ["self", "org_admin", "auditor"],
    sensitiveFields: ["invitee_email"],
  },

  "org.role.created": {
    actionKey: "org.role.created",
    moduleSlug: "organization-management",
    eventTier: "enhanced",
    description: "A new role was created",
    metadataSchema: z.object({
      role_id: z.string().uuid().optional(),
      role_name: z.string(),
    }),
    summaryTemplate: "{{actor}} created role {{entity}}",
    visibleTo: ["self", "org_admin", "auditor"],
    sensitiveFields: [],
  },

  "org.role.updated": {
    actionKey: "org.role.updated",
    moduleSlug: "organization-management",
    eventTier: "enhanced",
    description: "A role was updated",
    metadataSchema: z.object({
      role_id: z.string().uuid().optional(),
      role_name: z.string(),
      updated_fields: z.array(z.string()).optional(),
    }),
    summaryTemplate: "{{actor}} updated role {{entity}}",
    visibleTo: ["self", "org_admin", "auditor"],
    sensitiveFields: [],
  },

  "org.role.deleted": {
    actionKey: "org.role.deleted",
    moduleSlug: "organization-management",
    eventTier: "enhanced",
    description: "A role was deleted",
    metadataSchema: z.object({
      role_id: z.string().uuid().optional(),
      role_name: z.string(),
    }),
    summaryTemplate: "{{actor}} deleted role {{entity}}",
    visibleTo: ["self", "org_admin", "auditor"],
    sensitiveFields: [],
  },

  "org.member.role_assigned": {
    actionKey: "org.member.role_assigned",
    moduleSlug: "organization-management",
    eventTier: "enhanced",
    description: "A role was assigned to an organization member",
    metadataSchema: z.object({
      target_user_id: z.string().uuid().optional(),
      role_name: z.string(),
      scope: z.enum(["org", "branch"]).optional(),
      branch_id: z.string().uuid().optional(),
    }),
    summaryTemplate: "{{actor}} assigned role to {{target}}",
    visibleTo: ["self", "org_admin", "auditor"],
    sensitiveFields: [],
  },

  "org.member.role_removed": {
    actionKey: "org.member.role_removed",
    moduleSlug: "organization-management",
    eventTier: "enhanced",
    description: "A role was removed from an organization member",
    metadataSchema: z.object({
      target_user_id: z.string().uuid().optional(),
      role_name: z.string(),
      scope: z.enum(["org", "branch"]).optional(),
      branch_id: z.string().uuid().optional(),
    }),
    summaryTemplate: "{{actor}} removed role from {{target}}",
    visibleTo: ["self", "org_admin", "auditor"],
    sensitiveFields: [],
  },

  "org.branch.created": {
    actionKey: "org.branch.created",
    moduleSlug: "organization-management",
    eventTier: "baseline",
    description: "A new branch was created",
    metadataSchema: z.object({
      branch_id: z.string().uuid().optional(),
      branch_name: z.string(),
    }),
    summaryTemplate: "{{actor}} created branch {{entity}}",
    visibleTo: ["self", "org_member", "org_admin", "auditor"],
    sensitiveFields: [],
  },

  "org.branch.updated": {
    actionKey: "org.branch.updated",
    moduleSlug: "organization-management",
    eventTier: "baseline",
    description: "A branch was updated",
    metadataSchema: z.object({
      branch_id: z.string().uuid().optional(),
      branch_name: z.string().optional(),
      updated_fields: z.array(z.string()).optional(),
    }),
    summaryTemplate: "{{actor}} updated branch {{entity}}",
    visibleTo: ["self", "org_member", "org_admin", "auditor"],
    sensitiveFields: [],
  },

  "org.branch.deleted": {
    actionKey: "org.branch.deleted",
    moduleSlug: "organization-management",
    eventTier: "enhanced",
    description: "A branch was deleted",
    metadataSchema: z.object({
      branch_id: z.string().uuid().optional(),
      branch_name: z.string().optional(),
    }),
    summaryTemplate: "{{actor}} deleted branch {{entity}}",
    visibleTo: ["self", "org_admin", "auditor"],
    sensitiveFields: [],
  },

  "org.onboarding.completed": {
    actionKey: "org.onboarding.completed",
    moduleSlug: "organization-management",
    eventTier: "baseline",
    description: "Organization onboarding flow was completed",
    metadataSchema: z.object({
      org_name: z.string().optional(),
      completed_steps: z.array(z.string()).optional(),
    }),
    summaryTemplate: "Organization onboarding completed",
    visibleTo: ["self", "org_member", "org_admin", "auditor"],
    sensitiveFields: [],
  },
};

// ---------------------------------------------------------------------------
// Accessor
// ---------------------------------------------------------------------------

/**
 * Look up a registry entry by action key.
 * Returns undefined if the action key is not registered.
 * event.service.ts must reject emission for undefined entries.
 */
export function getRegistryEntry(actionKey: string): EventRegistryEntry | undefined {
  return EVENT_REGISTRY[actionKey];
}

/**
 * Returns all registered action keys.
 * Useful for contract tests and audit tooling.
 */
export function getAllActionKeys(): string[] {
  return Object.keys(EVENT_REGISTRY);
}
