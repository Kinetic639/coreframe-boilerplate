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
 *   - visibility model (scope, actorVisible, selfVisible, visibilityClass)
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
    category: "AUTH",
    intent: "SUCCESS",
    description: "User successfully authenticated",
    metadataSchema: z.object({
      email: z.string().email().optional(),
    }),
    summaryTemplate: "{{actor}} logged in",
    i18nKey: "events.auth.login",
    iconKey: "settings",
    // New model
    scope: "platform",
    actorVisible: true,
    selfVisible: true,
    visibilityClass: "audit",
    // Legacy — kept for contract tests
    visibleTo: ["self", "auditor"],
    sensitiveFields: ["email"],
  },

  "auth.login.failed": {
    actionKey: "auth.login.failed",
    moduleSlug: "auth",
    eventTier: "baseline",
    category: "SECURITY",
    intent: "FAIL",
    description: "Authentication attempt failed",
    metadataSchema: z.object({
      email: z.string().email().optional(),
      reason: z.string().optional(),
    }),
    summaryTemplate: "Failed login attempt",
    i18nKey: "events.auth.loginFailed",
    iconKey: "settings",
    // New model — no actor (failed attempt may have null actorUserId)
    scope: "platform",
    actorVisible: false,
    selfVisible: false,
    visibilityClass: "audit",
    // Legacy
    visibleTo: ["auditor"],
    sensitiveFields: ["email"],
  },

  "auth.password.reset_requested": {
    actionKey: "auth.password.reset_requested",
    moduleSlug: "auth",
    eventTier: "baseline",
    category: "AUTH",
    intent: "REQUEST",
    description: "User requested a password reset",
    metadataSchema: z.object({
      email: z.string().email().optional(),
    }),
    // Auditor-only: emitted with actorType="system" and actorUserId=null
    // because the requesting user is not yet authenticated.
    summaryTemplate: "Password reset requested",
    i18nKey: "events.auth.password.resetRequested",
    iconKey: "settings",
    // New model
    scope: "platform",
    actorVisible: false,
    selfVisible: false,
    visibilityClass: "audit",
    // Legacy
    visibleTo: ["auditor"],
    sensitiveFields: ["email"],
  },

  "auth.password.reset_completed": {
    actionKey: "auth.password.reset_completed",
    moduleSlug: "auth",
    eventTier: "baseline",
    category: "AUTH",
    intent: "SUCCESS",
    description: "User completed a password reset",
    metadataSchema: z.object({}),
    summaryTemplate: "{{actor}} completed a password reset",
    i18nKey: "events.auth.password.resetCompleted",
    iconKey: "settings",
    // New model
    scope: "platform",
    actorVisible: true,
    selfVisible: true,
    visibilityClass: "audit",
    // Legacy
    visibleTo: ["self", "auditor"],
    sensitiveFields: [],
  },

  "auth.session.revoked": {
    actionKey: "auth.session.revoked",
    moduleSlug: "auth",
    eventTier: "enhanced",
    category: "AUTH",
    intent: "DELETE",
    description: "User session was revoked",
    metadataSchema: z.object({
      reason: z.string().optional(),
    }),
    summaryTemplate: "{{actor}} session revoked",
    i18nKey: "events.auth.session.revoked",
    iconKey: "settings",
    // New model
    scope: "platform",
    actorVisible: true,
    selfVisible: true,
    visibilityClass: "audit",
    // Legacy
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
    category: "ORGANIZATION",
    intent: "CREATE",
    description: "A new organization was created",
    metadataSchema: z.object({
      org_name: z.string().optional(),
      org_slug: z.string().optional(),
    }),
    summaryTemplate: "Organization created",
    i18nKey: "events.org.created",
    iconKey: "settings",
    // New model — visible to all org members
    scope: "organization",
    actorVisible: true,
    selfVisible: true,
    visibilityClass: "org_activity",
    // Legacy
    visibleTo: ["self", "org_member", "org_admin", "auditor"],
    sensitiveFields: [],
  },

  "org.updated": {
    actionKey: "org.updated",
    moduleSlug: "organization-management",
    eventTier: "baseline",
    category: "ORGANIZATION",
    intent: "UPDATE",
    description: "Organization profile was updated",
    metadataSchema: z.object({
      updated_fields: z.array(z.string()).optional(),
    }),
    summaryTemplate: "Organization profile updated by {{actor}}",
    i18nKey: "events.org.updated",
    iconKey: "settings",
    // New model — visible to all org members
    scope: "organization",
    actorVisible: true,
    selfVisible: false,
    visibilityClass: "org_activity",
    // Legacy
    visibleTo: ["self", "org_member", "org_admin", "auditor"],
    sensitiveFields: [],
  },

  "org.member.invited": {
    actionKey: "org.member.invited",
    moduleSlug: "organization-management",
    eventTier: "enhanced",
    category: "INVITATION",
    intent: "CREATE",
    description: "A user was invited to join the organization",
    metadataSchema: z.object({
      invitee_email: z.string().email(),
      invitee_first_name: z.string().optional(),
      invitee_last_name: z.string().optional(),
    }),
    summaryTemplate: "{{actor}} invited {{target}} to the organization",
    i18nKey: "events.org.member.invited",
    iconKey: "users",
    // New model — sensitive: invitee PII; visible to org_admin+ only
    scope: "organization",
    actorVisible: true,
    selfVisible: false,
    visibilityClass: "org_sensitive",
    // Legacy
    visibleTo: ["self", "org_admin", "auditor"],
    sensitiveFields: ["invitee_email", "invitee_first_name", "invitee_last_name"],
  },

  "org.member.removed": {
    actionKey: "org.member.removed",
    moduleSlug: "organization-management",
    eventTier: "enhanced",
    category: "MEMBERSHIP",
    intent: "REMOVE",
    description: "A member was removed from the organization",
    metadataSchema: z.object({
      removed_user_id: z.string().uuid().optional(),
      removed_user_name: z.string().optional(),
    }),
    summaryTemplate: "{{actor}} removed {{target}} from the organization",
    i18nKey: "events.org.member.removed",
    iconKey: "users",
    // New model — sensitive: includes who was removed; selfVisible so the removed user can see it
    scope: "organization",
    actorVisible: true,
    selfVisible: true,
    visibilityClass: "org_sensitive",
    // Legacy
    visibleTo: ["self", "org_admin", "auditor"],
    sensitiveFields: ["removed_user_name"],
  },

  "org.invitation.accepted": {
    actionKey: "org.invitation.accepted",
    moduleSlug: "organization-management",
    eventTier: "baseline",
    category: "INVITATION",
    intent: "ACCEPT",
    description: "An invitation was accepted and the user joined the organization",
    metadataSchema: z.object({
      invitation_id: z.string().uuid().optional(),
    }),
    summaryTemplate: "{{actor}} accepted invitation and joined the organization",
    i18nKey: "events.org.invitation.accepted",
    iconKey: "users",
    // New model — a positive membership event; visible to all org members
    scope: "organization",
    actorVisible: true,
    selfVisible: true,
    visibilityClass: "org_activity",
    // Legacy
    visibleTo: ["self", "org_member", "org_admin", "auditor"],
    sensitiveFields: [],
  },

  "org.invitation.cancelled": {
    actionKey: "org.invitation.cancelled",
    moduleSlug: "organization-management",
    eventTier: "enhanced",
    category: "INVITATION",
    intent: "DELETE",
    description: "An invitation was cancelled before it was accepted",
    metadataSchema: z.object({
      invitation_id: z.string().uuid().optional(),
      invitee_email: z.string().email().optional(),
    }),
    summaryTemplate: "{{actor}} cancelled invitation for {{target}}",
    i18nKey: "events.org.invitation.cancelled",
    iconKey: "users",
    // New model — sensitive: invitee_email in metadata
    scope: "organization",
    actorVisible: true,
    selfVisible: false,
    visibilityClass: "org_sensitive",
    // Legacy
    visibleTo: ["self", "org_admin", "auditor"],
    sensitiveFields: ["invitee_email"],
  },

  "org.invitation.resent": {
    actionKey: "org.invitation.resent",
    moduleSlug: "organization-management",
    eventTier: "enhanced",
    category: "INVITATION",
    intent: "UPDATE",
    description: "An invitation was resent with a new token and expiry",
    metadataSchema: z.object({
      invitation_id: z.string().uuid().optional(),
      invitee_email: z.string().email().optional(),
    }),
    // targetType/targetId set to invitation_email so {{target}} renders the email address.
    summaryTemplate: "{{actor}} resent invitation to {{target}}",
    i18nKey: "events.org.invitation.resent",
    iconKey: "users",
    // New model — sensitive: invitee_email in metadata
    scope: "organization",
    actorVisible: true,
    selfVisible: false,
    visibilityClass: "org_sensitive",
    // Legacy
    visibleTo: ["self", "org_admin", "auditor"],
    sensitiveFields: ["invitee_email"],
  },

  "org.invitation.declined": {
    actionKey: "org.invitation.declined",
    moduleSlug: "organization-management",
    eventTier: "baseline",
    category: "INVITATION",
    intent: "DECLINE",
    description: "An invitation was declined by the recipient",
    metadataSchema: z.object({
      invitation_id: z.string().uuid().optional(),
    }),
    // No {{target}}: the actor IS the recipient — using target would be redundant.
    // actorUserId may be null if the recipient was not authenticated at decline time.
    summaryTemplate: "{{actor}} declined the invitation",
    i18nKey: "events.org.invitation.declined",
    iconKey: "users",
    // New model — sensitive: who declined is relevant to admins
    scope: "organization",
    actorVisible: true,
    selfVisible: false,
    visibilityClass: "org_sensitive",
    // Legacy
    visibleTo: ["self", "org_admin", "auditor"],
    sensitiveFields: [],
  },

  "org.role.created": {
    actionKey: "org.role.created",
    moduleSlug: "organization-management",
    eventTier: "enhanced",
    category: "ORGANIZATION",
    intent: "CREATE",
    description: "A new role was created",
    metadataSchema: z.object({
      role_id: z.string().optional(),
      role_name: z.string(),
    }),
    summaryTemplate: "{{actor}} created role {{entity}}",
    i18nKey: "events.org.role.created",
    iconKey: "settings",
    // New model — role changes are admin-level sensitive
    scope: "organization",
    actorVisible: true,
    selfVisible: false,
    visibilityClass: "org_sensitive",
    // Legacy
    visibleTo: ["self", "org_admin", "auditor"],
    sensitiveFields: [],
  },

  "org.role.updated": {
    actionKey: "org.role.updated",
    moduleSlug: "organization-management",
    eventTier: "enhanced",
    category: "ORGANIZATION",
    intent: "UPDATE",
    description: "A role was updated",
    metadataSchema: z.object({
      role_id: z.string().optional(),
      role_name: z.string(),
      updated_fields: z.array(z.string()).optional(),
    }),
    summaryTemplate: "{{actor}} updated role {{entity}}",
    i18nKey: "events.org.role.updated",
    iconKey: "settings",
    // New model
    scope: "organization",
    actorVisible: true,
    selfVisible: false,
    visibilityClass: "org_sensitive",
    // Legacy
    visibleTo: ["self", "org_admin", "auditor"],
    sensitiveFields: [],
  },

  "org.role.deleted": {
    actionKey: "org.role.deleted",
    moduleSlug: "organization-management",
    eventTier: "enhanced",
    category: "ORGANIZATION",
    intent: "DELETE",
    description: "A role was deleted",
    metadataSchema: z.object({
      role_id: z.string().optional(),
      role_name: z.string(),
    }),
    summaryTemplate: "{{actor}} deleted role {{entity}}",
    i18nKey: "events.org.role.deleted",
    iconKey: "settings",
    // New model
    scope: "organization",
    actorVisible: true,
    selfVisible: false,
    visibilityClass: "org_sensitive",
    // Legacy
    visibleTo: ["self", "org_admin", "auditor"],
    sensitiveFields: [],
  },

  "org.member.role_assigned": {
    actionKey: "org.member.role_assigned",
    moduleSlug: "organization-management",
    eventTier: "enhanced",
    category: "MEMBERSHIP",
    intent: "ASSIGN",
    description: "A role was assigned to an organization member",
    metadataSchema: z.object({
      target_user_id: z.string().uuid().optional(),
      role_name: z.string(),
      scope: z.enum(["org", "branch"]).optional(),
      branch_id: z.string().uuid().optional(),
    }),
    summaryTemplate: "{{actor}} assigned role to {{target}}",
    i18nKey: "events.org.member.roleAssigned",
    iconKey: "users",
    // New model — selfVisible: target user can see their own role assignment
    scope: "organization",
    actorVisible: true,
    selfVisible: true,
    visibilityClass: "org_sensitive",
    // Legacy
    visibleTo: ["self", "org_admin", "auditor"],
    sensitiveFields: [],
  },

  "org.member.role_removed": {
    actionKey: "org.member.role_removed",
    moduleSlug: "organization-management",
    eventTier: "enhanced",
    category: "MEMBERSHIP",
    intent: "REMOVE",
    description: "A role was removed from an organization member",
    metadataSchema: z.object({
      target_user_id: z.string().uuid().optional(),
      role_name: z.string(),
      scope: z.enum(["org", "branch"]).optional(),
      branch_id: z.string().uuid().optional(),
    }),
    summaryTemplate: "{{actor}} removed role from {{target}}",
    i18nKey: "events.org.member.roleRemoved",
    iconKey: "users",
    // New model — selfVisible: target user can see their own role removal
    scope: "organization",
    actorVisible: true,
    selfVisible: true,
    visibilityClass: "org_sensitive",
    // Legacy
    visibleTo: ["self", "org_admin", "auditor"],
    sensitiveFields: [],
  },

  "org.branch.created": {
    actionKey: "org.branch.created",
    moduleSlug: "organization-management",
    eventTier: "baseline",
    category: "ORGANIZATION",
    intent: "CREATE",
    description: "A new branch was created",
    metadataSchema: z.object({
      branch_id: z.string().uuid().optional(),
      branch_name: z.string(),
    }),
    summaryTemplate: "{{actor}} created branch {{entity}}",
    i18nKey: "events.org.branch.created",
    iconKey: "settings",
    // New model — branch lifecycle visible to all org members
    scope: "branch",
    actorVisible: true,
    selfVisible: false,
    visibilityClass: "org_activity",
    // Legacy
    visibleTo: ["self", "org_member", "org_admin", "auditor"],
    sensitiveFields: [],
  },

  "org.branch.updated": {
    actionKey: "org.branch.updated",
    moduleSlug: "organization-management",
    eventTier: "baseline",
    category: "ORGANIZATION",
    intent: "UPDATE",
    description: "A branch was updated",
    metadataSchema: z.object({
      branch_id: z.string().uuid().optional(),
      branch_name: z.string().optional(),
      updated_fields: z.array(z.string()).optional(),
    }),
    summaryTemplate: "{{actor}} updated branch {{entity}}",
    i18nKey: "events.org.branch.updated",
    iconKey: "settings",
    // New model — branch lifecycle visible to all org members
    scope: "branch",
    actorVisible: true,
    selfVisible: false,
    visibilityClass: "org_activity",
    // Legacy
    visibleTo: ["self", "org_member", "org_admin", "auditor"],
    sensitiveFields: [],
  },

  "org.branch.deleted": {
    actionKey: "org.branch.deleted",
    moduleSlug: "organization-management",
    eventTier: "enhanced",
    category: "ORGANIZATION",
    intent: "DELETE",
    description: "A branch was deleted",
    metadataSchema: z.object({
      branch_id: z.string().uuid().optional(),
      branch_name: z.string().optional(),
    }),
    summaryTemplate: "{{actor}} deleted branch {{entity}}",
    i18nKey: "events.org.branch.deleted",
    iconKey: "settings",
    // New model — sensitive: deletion is an admin-level action
    scope: "branch",
    actorVisible: true,
    selfVisible: false,
    visibilityClass: "org_sensitive",
    // Legacy
    visibleTo: ["self", "org_admin", "auditor"],
    sensitiveFields: [],
  },

  "org.onboarding.completed": {
    actionKey: "org.onboarding.completed",
    moduleSlug: "organization-management",
    eventTier: "baseline",
    category: "ORGANIZATION",
    intent: "SUCCESS",
    description: "Organization onboarding flow was completed",
    metadataSchema: z.object({
      org_name: z.string().optional(),
      completed_steps: z.array(z.string()).optional(),
    }),
    summaryTemplate: "Organization onboarding completed",
    i18nKey: "events.org.onboarding.completed",
    iconKey: "settings",
    // New model — a milestone visible to all org members
    scope: "organization",
    actorVisible: true,
    selfVisible: true,
    visibilityClass: "org_activity",
    // Legacy
    visibleTo: ["self", "org_member", "org_admin", "auditor"],
    sensitiveFields: [],
  },

  // -------------------------------------------------------------------------
  // Warehouse module — Locations
  // -------------------------------------------------------------------------

  "warehouse.location.created": {
    actionKey: "warehouse.location.created",
    moduleSlug: "warehouse",
    eventTier: "baseline",
    category: "WAREHOUSE",
    intent: "CREATE",
    i18nKey: "events.warehouse.location.created",
    description: "A warehouse location was created",
    metadataSchema: z.object({
      location_id: z.string().uuid(),
      location_name: z.string(),
      branch_id: z.string().uuid(),
      parent_id: z.string().uuid().nullable().optional(),
    }),
    summaryTemplate: "Created location {{location_name}}",
    scope: "branch",
    actorVisible: true,
    selfVisible: true,
    visibilityClass: "org_activity",
    visibleTo: ["org_member", "org_admin", "auditor"],
    sensitiveFields: [],
  },

  "warehouse.location.updated": {
    actionKey: "warehouse.location.updated",
    moduleSlug: "warehouse",
    eventTier: "baseline",
    category: "WAREHOUSE",
    intent: "UPDATE",
    i18nKey: "events.warehouse.location.updated",
    description: "A warehouse location was updated",
    metadataSchema: z.object({
      location_id: z.string().uuid(),
      location_name: z.string(),
      branch_id: z.string().uuid(),
      updated_fields: z.array(z.string()).optional(),
    }),
    summaryTemplate: "Updated location {{location_name}}",
    scope: "branch",
    actorVisible: true,
    selfVisible: true,
    visibilityClass: "org_activity",
    visibleTo: ["org_member", "org_admin", "auditor"],
    sensitiveFields: [],
  },

  "warehouse.location.deleted": {
    actionKey: "warehouse.location.deleted",
    moduleSlug: "warehouse",
    eventTier: "enhanced",
    category: "WAREHOUSE",
    intent: "DELETE",
    i18nKey: "events.warehouse.location.deleted",
    description: "A warehouse location was soft-deleted",
    metadataSchema: z.object({
      location_id: z.string().uuid(),
      location_name: z.string(),
      branch_id: z.string().uuid(),
    }),
    summaryTemplate: "Deleted location {{location_name}}",
    scope: "branch",
    actorVisible: true,
    selfVisible: true,
    visibilityClass: "org_activity",
    visibleTo: ["org_member", "org_admin", "auditor"],
    sensitiveFields: [],
  },

  // -------------------------------------------------------------------------
  // Warehouse module — Inventory
  // -------------------------------------------------------------------------

  "warehouse.inventory.product.created": {
    actionKey: "warehouse.inventory.product.created",
    moduleSlug: "warehouse",
    eventTier: "baseline",
    category: "WAREHOUSE",
    intent: "CREATE",
    i18nKey: "events.warehouse.inventory.product.created",
    description: "An inventory product was created",
    metadataSchema: z.object({
      product_id: z.string().uuid(),
      variant_id: z.string().uuid(),
      sku: z.string(),
    }),
    summaryTemplate: "Created inventory product {{sku}}",
    scope: "organization",
    actorVisible: true,
    selfVisible: true,
    visibilityClass: "org_activity",
    visibleTo: ["org_member", "org_admin", "auditor"],
    sensitiveFields: [],
  },

  "warehouse.inventory.product.updated": {
    actionKey: "warehouse.inventory.product.updated",
    moduleSlug: "warehouse",
    eventTier: "baseline",
    category: "WAREHOUSE",
    intent: "UPDATE",
    i18nKey: "events.warehouse.inventory.product.updated",
    description: "An inventory product was updated",
    metadataSchema: z.object({
      product_id: z.string().uuid(),
      updated_fields: z.array(z.string()).optional(),
    }),
    summaryTemplate: "Updated inventory product",
    scope: "organization",
    actorVisible: true,
    selfVisible: true,
    visibilityClass: "org_activity",
    visibleTo: ["org_member", "org_admin", "auditor"],
    sensitiveFields: [],
  },

  "warehouse.inventory.product.archived": {
    actionKey: "warehouse.inventory.product.archived",
    moduleSlug: "warehouse",
    eventTier: "enhanced",
    category: "WAREHOUSE",
    intent: "UPDATE",
    i18nKey: "events.warehouse.inventory.product.archived",
    description: "An inventory product was archived",
    metadataSchema: z.object({
      product_id: z.string().uuid(),
    }),
    summaryTemplate: "Archived inventory product",
    scope: "organization",
    actorVisible: true,
    selfVisible: true,
    visibilityClass: "org_activity",
    visibleTo: ["org_member", "org_admin", "auditor"],
    sensitiveFields: [],
  },

  "warehouse.inventory.movement.posted": {
    actionKey: "warehouse.inventory.movement.posted",
    moduleSlug: "warehouse",
    eventTier: "baseline",
    category: "WAREHOUSE",
    intent: "CREATE",
    i18nKey: "events.warehouse.inventory.movement.posted",
    description: "An inventory movement was posted",
    metadataSchema: z.object({
      movement_id: z.string().uuid(),
      movement_number: z.string(),
      status: z.string(),
    }),
    summaryTemplate: "Posted inventory movement {{movement_number}}",
    scope: "branch",
    actorVisible: true,
    selfVisible: true,
    visibilityClass: "org_activity",
    visibleTo: ["org_member", "org_admin", "auditor"],
    sensitiveFields: [],
  },

  "warehouse.inventory.movement.reversed": {
    actionKey: "warehouse.inventory.movement.reversed",
    moduleSlug: "warehouse",
    eventTier: "enhanced",
    category: "WAREHOUSE",
    intent: "UPDATE",
    i18nKey: "events.warehouse.inventory.movement.reversed",
    description: "An inventory movement was reversed",
    metadataSchema: z.object({
      movement_id: z.string().uuid(),
      movement_number: z.string(),
      status: z.string(),
    }),
    summaryTemplate: "Reversed inventory movement {{movement_number}}",
    scope: "branch",
    actorVisible: true,
    selfVisible: true,
    visibilityClass: "org_activity",
    visibleTo: ["org_member", "org_admin", "auditor"],
    sensitiveFields: [],
  },

  "warehouse.inventory.product.image.uploaded": {
    actionKey: "warehouse.inventory.product.image.uploaded",
    moduleSlug: "warehouse",
    eventTier: "enhanced",
    category: "WAREHOUSE",
    intent: "CREATE",
    i18nKey: "events.warehouse.inventory.product.image.uploaded",
    description: "An inventory product or variant image was uploaded",
    metadataSchema: z.object({
      product_id: z.string().uuid(),
      variant_id: z.string().uuid().nullable().optional(),
      image_id: z.string().uuid(),
      is_primary: z.boolean().optional(),
      file_name: z.string().optional(),
      content_type: z.string().optional(),
      file_size: z.number().int().nonnegative().optional(),
    }),
    summaryTemplate: "Uploaded inventory product image",
    scope: "organization",
    actorVisible: true,
    selfVisible: true,
    visibilityClass: "org_activity",
    visibleTo: ["org_member", "org_admin", "auditor"],
    sensitiveFields: [],
  },

  "warehouse.inventory.product.image.assigned": {
    actionKey: "warehouse.inventory.product.image.assigned",
    moduleSlug: "warehouse",
    eventTier: "enhanced",
    category: "WAREHOUSE",
    intent: "ASSIGN",
    i18nKey: "events.warehouse.inventory.product.image.assigned",
    description: "An existing inventory image was assigned to a variant",
    metadataSchema: z.object({
      product_id: z.string().uuid(),
      variant_id: z.string().uuid(),
      image_id: z.string().uuid(),
      is_primary: z.boolean().optional(),
      sort_order: z.number().int().optional(),
    }),
    summaryTemplate: "Assigned inventory variant image",
    scope: "organization",
    actorVisible: true,
    selfVisible: true,
    visibilityClass: "org_activity",
    visibleTo: ["org_member", "org_admin", "auditor"],
    sensitiveFields: [],
  },

  "warehouse.inventory.product.images.updated": {
    actionKey: "warehouse.inventory.product.images.updated",
    moduleSlug: "warehouse",
    eventTier: "enhanced",
    category: "WAREHOUSE",
    intent: "UPDATE",
    i18nKey: "events.warehouse.inventory.product.images.updated",
    description: "Inventory product or variant image ordering/primary state was updated",
    metadataSchema: z.object({
      product_id: z.string().uuid(),
      variant_id: z.string().uuid().nullable().optional(),
      image_count: z.number().int().nonnegative(),
      deleted_count: z.number().int().nonnegative().optional(),
    }),
    summaryTemplate: "Updated inventory product images",
    scope: "organization",
    actorVisible: true,
    selfVisible: true,
    visibilityClass: "org_activity",
    visibleTo: ["org_member", "org_admin", "auditor"],
    sensitiveFields: [],
  },

  "warehouse.inventory.import.completed": {
    actionKey: "warehouse.inventory.import.completed",
    moduleSlug: "warehouse",
    eventTier: "enhanced",
    category: "WAREHOUSE",
    intent: "SUCCESS",
    i18nKey: "events.warehouse.inventory.import.completed",
    description: "An inventory product import completed",
    metadataSchema: z.object({
      job_id: z.string().uuid(),
      imported_products: z.number().int().nonnegative(),
      imported_variants: z.number().int().nonnegative(),
      skipped_rows: z.number().int().nonnegative(),
      mode: z.string().optional(),
    }),
    summaryTemplate: "Imported {{imported_products}} inventory products",
    scope: "organization",
    actorVisible: true,
    selfVisible: true,
    visibilityClass: "org_activity",
    visibleTo: ["org_member", "org_admin", "auditor"],
    sensitiveFields: [],
  },

  "warehouse.inventory.export.completed": {
    actionKey: "warehouse.inventory.export.completed",
    moduleSlug: "warehouse",
    eventTier: "enhanced",
    category: "WAREHOUSE",
    intent: "SUCCESS",
    i18nKey: "events.warehouse.inventory.export.completed",
    description: "An inventory product export completed",
    metadataSchema: z.object({
      job_id: z.string().uuid(),
      file_name: z.string(),
    }),
    summaryTemplate: "Exported inventory products",
    scope: "organization",
    actorVisible: true,
    selfVisible: true,
    visibilityClass: "org_activity",
    visibleTo: ["org_member", "org_admin", "auditor"],
    sensitiveFields: [],
  },

  "warehouse.inventory.settings.unit.created": {
    actionKey: "warehouse.inventory.settings.unit.created",
    moduleSlug: "warehouse",
    eventTier: "enhanced",
    category: "WAREHOUSE",
    intent: "CREATE",
    i18nKey: "events.warehouse.inventory.settings.unit.created",
    description: "An inventory unit preset was created",
    metadataSchema: z.object({
      unit_id: z.string().uuid(),
      code: z.string(),
      name: z.string().optional(),
      unit_kind: z.string().optional(),
    }),
    summaryTemplate: "Created inventory unit {{code}}",
    scope: "organization",
    actorVisible: true,
    selfVisible: true,
    visibilityClass: "org_activity",
    visibleTo: ["org_member", "org_admin", "auditor"],
    sensitiveFields: [],
  },

  "warehouse.inventory.settings.unit.archived": {
    actionKey: "warehouse.inventory.settings.unit.archived",
    moduleSlug: "warehouse",
    eventTier: "enhanced",
    category: "WAREHOUSE",
    intent: "UPDATE",
    i18nKey: "events.warehouse.inventory.settings.unit.archived",
    description: "An inventory unit preset was archived",
    metadataSchema: z.object({
      unit_id: z.string().uuid(),
    }),
    summaryTemplate: "Archived inventory unit",
    scope: "organization",
    actorVisible: true,
    selfVisible: true,
    visibilityClass: "org_activity",
    visibleTo: ["org_member", "org_admin", "auditor"],
    sensitiveFields: [],
  },

  "warehouse.inventory.settings.unit_conversion.created": {
    actionKey: "warehouse.inventory.settings.unit_conversion.created",
    moduleSlug: "warehouse",
    eventTier: "enhanced",
    category: "WAREHOUSE",
    intent: "CREATE",
    i18nKey: "events.warehouse.inventory.settings.unitConversion.created",
    description: "An inventory unit conversion preset was created",
    metadataSchema: z.object({
      unit_conversion_id: z.string().uuid(),
      from_unit_id: z.string().uuid(),
      to_unit_id: z.string().uuid(),
      factor: z.number(),
    }),
    summaryTemplate: "Created inventory unit conversion",
    scope: "organization",
    actorVisible: true,
    selfVisible: true,
    visibilityClass: "org_activity",
    visibleTo: ["org_member", "org_admin", "auditor"],
    sensitiveFields: [],
  },

  "warehouse.inventory.settings.unit_conversion.archived": {
    actionKey: "warehouse.inventory.settings.unit_conversion.archived",
    moduleSlug: "warehouse",
    eventTier: "enhanced",
    category: "WAREHOUSE",
    intent: "UPDATE",
    i18nKey: "events.warehouse.inventory.settings.unitConversion.archived",
    description: "An inventory unit conversion preset was archived",
    metadataSchema: z.object({
      unit_conversion_id: z.string().uuid(),
    }),
    summaryTemplate: "Archived inventory unit conversion",
    scope: "organization",
    actorVisible: true,
    selfVisible: true,
    visibilityClass: "org_activity",
    visibleTo: ["org_member", "org_admin", "auditor"],
    sensitiveFields: [],
  },

  "warehouse.inventory.settings.tax_rate.created": {
    actionKey: "warehouse.inventory.settings.tax_rate.created",
    moduleSlug: "warehouse",
    eventTier: "enhanced",
    category: "WAREHOUSE",
    intent: "CREATE",
    i18nKey: "events.warehouse.inventory.settings.taxRate.created",
    description: "An inventory tax preset was created",
    metadataSchema: z.object({
      tax_rate_id: z.string().uuid(),
      code: z.string(),
      name: z.string().optional(),
      rate_percent: z.number(),
      is_default: z.boolean().optional(),
    }),
    summaryTemplate: "Created inventory tax rate {{code}}",
    scope: "organization",
    actorVisible: true,
    selfVisible: true,
    visibilityClass: "org_activity",
    visibleTo: ["org_member", "org_admin", "auditor"],
    sensitiveFields: [],
  },

  "warehouse.inventory.settings.tax_rate.archived": {
    actionKey: "warehouse.inventory.settings.tax_rate.archived",
    moduleSlug: "warehouse",
    eventTier: "enhanced",
    category: "WAREHOUSE",
    intent: "UPDATE",
    i18nKey: "events.warehouse.inventory.settings.taxRate.archived",
    description: "An inventory tax preset was archived",
    metadataSchema: z.object({
      tax_rate_id: z.string().uuid(),
    }),
    summaryTemplate: "Archived inventory tax rate",
    scope: "organization",
    actorVisible: true,
    selfVisible: true,
    visibilityClass: "org_activity",
    visibleTo: ["org_member", "org_admin", "auditor"],
    sensitiveFields: [],
  },

  "warehouse.inventory.settings.tag.created": {
    actionKey: "warehouse.inventory.settings.tag.created",
    moduleSlug: "warehouse",
    eventTier: "enhanced",
    category: "WAREHOUSE",
    intent: "CREATE",
    i18nKey: "events.warehouse.inventory.settings.tag.created",
    description: "An inventory tag was created",
    metadataSchema: z.object({
      tag_id: z.string().uuid(),
      name: z.string(),
      color: z.string().nullable().optional(),
    }),
    summaryTemplate: "Created inventory tag {{name}}",
    scope: "organization",
    actorVisible: true,
    selfVisible: true,
    visibilityClass: "org_activity",
    visibleTo: ["org_member", "org_admin", "auditor"],
    sensitiveFields: [],
  },

  "warehouse.inventory.settings.tag.archived": {
    actionKey: "warehouse.inventory.settings.tag.archived",
    moduleSlug: "warehouse",
    eventTier: "enhanced",
    category: "WAREHOUSE",
    intent: "UPDATE",
    i18nKey: "events.warehouse.inventory.settings.tag.archived",
    description: "An inventory tag was archived",
    metadataSchema: z.object({
      tag_id: z.string().uuid(),
    }),
    summaryTemplate: "Archived inventory tag",
    scope: "organization",
    actorVisible: true,
    selfVisible: true,
    visibilityClass: "org_activity",
    visibleTo: ["org_member", "org_admin", "auditor"],
    sensitiveFields: [],
  },

  "warehouse.inventory.settings.custom_field.created": {
    actionKey: "warehouse.inventory.settings.custom_field.created",
    moduleSlug: "warehouse",
    eventTier: "enhanced",
    category: "WAREHOUSE",
    intent: "CREATE",
    i18nKey: "events.warehouse.inventory.settings.customField.created",
    description: "An inventory custom field definition was created",
    metadataSchema: z.object({
      custom_field_id: z.string().uuid(),
      entity_type: z.string(),
      field_key: z.string().optional(),
      field_type: z.string().optional(),
      name: z.string().optional(),
    }),
    summaryTemplate: "Created inventory custom field",
    scope: "organization",
    actorVisible: true,
    selfVisible: true,
    visibilityClass: "org_activity",
    visibleTo: ["org_member", "org_admin", "auditor"],
    sensitiveFields: [],
  },

  "warehouse.inventory.settings.custom_field.updated": {
    actionKey: "warehouse.inventory.settings.custom_field.updated",
    moduleSlug: "warehouse",
    eventTier: "enhanced",
    category: "WAREHOUSE",
    intent: "UPDATE",
    i18nKey: "events.warehouse.inventory.settings.customField.updated",
    description: "An inventory custom field definition was updated",
    metadataSchema: z.object({
      custom_field_id: z.string().uuid(),
      updated_fields: z.array(z.string()).optional(),
    }),
    summaryTemplate: "Updated inventory custom field",
    scope: "organization",
    actorVisible: true,
    selfVisible: true,
    visibilityClass: "org_activity",
    visibleTo: ["org_member", "org_admin", "auditor"],
    sensitiveFields: [],
  },

  "warehouse.inventory.settings.custom_field.archived": {
    actionKey: "warehouse.inventory.settings.custom_field.archived",
    moduleSlug: "warehouse",
    eventTier: "enhanced",
    category: "WAREHOUSE",
    intent: "UPDATE",
    i18nKey: "events.warehouse.inventory.settings.customField.archived",
    description: "An inventory custom field definition was archived",
    metadataSchema: z.object({
      custom_field_id: z.string().uuid(),
    }),
    summaryTemplate: "Archived inventory custom field",
    scope: "organization",
    actorVisible: true,
    selfVisible: true,
    visibilityClass: "org_activity",
    visibleTo: ["org_member", "org_admin", "auditor"],
    sensitiveFields: [],
  },

  "warehouse.inventory.settings.sku_template.created": {
    actionKey: "warehouse.inventory.settings.sku_template.created",
    moduleSlug: "warehouse",
    eventTier: "enhanced",
    category: "WAREHOUSE",
    intent: "CREATE",
    i18nKey: "events.warehouse.inventory.settings.skuTemplate.created",
    description: "An inventory SKU template was created",
    metadataSchema: z.object({
      sku_template_id: z.string().uuid(),
      name: z.string(),
      is_default: z.boolean().optional(),
    }),
    summaryTemplate: "Created inventory SKU template {{name}}",
    scope: "organization",
    actorVisible: true,
    selfVisible: true,
    visibilityClass: "org_activity",
    visibleTo: ["org_member", "org_admin", "auditor"],
    sensitiveFields: [],
  },

  "warehouse.inventory.settings.sku_template.updated": {
    actionKey: "warehouse.inventory.settings.sku_template.updated",
    moduleSlug: "warehouse",
    eventTier: "enhanced",
    category: "WAREHOUSE",
    intent: "UPDATE",
    i18nKey: "events.warehouse.inventory.settings.skuTemplate.updated",
    description: "An inventory SKU template was updated",
    metadataSchema: z.object({
      sku_template_id: z.string().uuid(),
      name: z.string().optional(),
      is_default: z.boolean().optional(),
      updated_fields: z.array(z.string()).optional(),
    }),
    summaryTemplate: "Updated inventory SKU template",
    scope: "organization",
    actorVisible: true,
    selfVisible: true,
    visibilityClass: "org_activity",
    visibleTo: ["org_member", "org_admin", "auditor"],
    sensitiveFields: [],
  },

  "warehouse.inventory.settings.sku_template.archived": {
    actionKey: "warehouse.inventory.settings.sku_template.archived",
    moduleSlug: "warehouse",
    eventTier: "enhanced",
    category: "WAREHOUSE",
    intent: "UPDATE",
    i18nKey: "events.warehouse.inventory.settings.skuTemplate.archived",
    description: "An inventory SKU template was archived",
    metadataSchema: z.object({
      sku_template_id: z.string().uuid(),
    }),
    summaryTemplate: "Archived inventory SKU template",
    scope: "organization",
    actorVisible: true,
    selfVisible: true,
    visibilityClass: "org_activity",
    visibleTo: ["org_member", "org_admin", "auditor"],
    sensitiveFields: [],
  },

  "warehouse.inventory.branch_transfer.created": {
    actionKey: "warehouse.inventory.branch_transfer.created",
    moduleSlug: "warehouse",
    eventTier: "enhanced",
    category: "WAREHOUSE",
    intent: "CREATE",
    i18nKey: "events.warehouse.inventory.branchTransfer.created",
    description: "A cross-branch inventory transfer was created",
    metadataSchema: z.object({
      transfer_id: z.string().uuid(),
      source_branch_id: z.string().uuid(),
      destination_branch_id: z.string().uuid(),
      line_count: z.number().int().nonnegative(),
    }),
    summaryTemplate: "Created branch transfer",
    scope: "branch",
    actorVisible: true,
    selfVisible: true,
    visibilityClass: "org_activity",
    visibleTo: ["org_member", "org_admin", "auditor"],
    sensitiveFields: [],
  },

  "warehouse.inventory.branch_transfer.accepted": {
    actionKey: "warehouse.inventory.branch_transfer.accepted",
    moduleSlug: "warehouse",
    eventTier: "enhanced",
    category: "WAREHOUSE",
    intent: "ACCEPT",
    i18nKey: "events.warehouse.inventory.branchTransfer.accepted",
    description: "A cross-branch inventory transfer was accepted",
    metadataSchema: z.object({
      transfer_id: z.string().uuid(),
      destination_location_id: z.string().uuid(),
    }),
    summaryTemplate: "Accepted branch transfer",
    scope: "branch",
    actorVisible: true,
    selfVisible: true,
    visibilityClass: "org_activity",
    visibleTo: ["org_member", "org_admin", "auditor"],
    sensitiveFields: [],
  },

  "warehouse.inventory.branch_transfer.declined": {
    actionKey: "warehouse.inventory.branch_transfer.declined",
    moduleSlug: "warehouse",
    eventTier: "enhanced",
    category: "WAREHOUSE",
    intent: "DECLINE",
    i18nKey: "events.warehouse.inventory.branchTransfer.declined",
    description: "A cross-branch inventory transfer was declined",
    metadataSchema: z.object({
      transfer_id: z.string().uuid(),
      has_decline_reason: z.boolean().optional(),
    }),
    summaryTemplate: "Declined branch transfer",
    scope: "branch",
    actorVisible: true,
    selfVisible: true,
    visibilityClass: "org_activity",
    visibleTo: ["org_member", "org_admin", "auditor"],
    sensitiveFields: [],
  },

  "warehouse.inventory.count_session.created": {
    actionKey: "warehouse.inventory.count_session.created",
    moduleSlug: "warehouse",
    eventTier: "enhanced",
    category: "WAREHOUSE",
    intent: "CREATE",
    i18nKey: "events.warehouse.inventory.countSession.created",
    description: "An inventory count session was created",
    metadataSchema: z.object({
      count_session_id: z.string().uuid(),
      scope: z.record(z.unknown()).optional(),
    }),
    summaryTemplate: "Created inventory count session",
    scope: "branch",
    actorVisible: true,
    selfVisible: true,
    visibilityClass: "org_activity",
    visibleTo: ["org_member", "org_admin", "auditor"],
    sensitiveFields: [],
  },

  "warehouse.inventory.count_line.updated": {
    actionKey: "warehouse.inventory.count_line.updated",
    moduleSlug: "warehouse",
    eventTier: "enhanced",
    category: "WAREHOUSE",
    intent: "UPDATE",
    i18nKey: "events.warehouse.inventory.countLine.updated",
    description: "An inventory count line was updated",
    metadataSchema: z.object({
      count_line_id: z.string().uuid(),
      counted_quantity: z.number().optional(),
    }),
    summaryTemplate: "Updated inventory count line",
    scope: "branch",
    actorVisible: true,
    selfVisible: true,
    visibilityClass: "org_activity",
    visibleTo: ["org_member", "org_admin", "auditor"],
    sensitiveFields: [],
  },

  "warehouse.inventory.count_session.approved": {
    actionKey: "warehouse.inventory.count_session.approved",
    moduleSlug: "warehouse",
    eventTier: "enhanced",
    category: "WAREHOUSE",
    intent: "ACCEPT",
    i18nKey: "events.warehouse.inventory.countSession.approved",
    description: "An inventory count session was approved",
    metadataSchema: z.object({
      count_session_id: z.string().uuid(),
    }),
    summaryTemplate: "Approved inventory count session",
    scope: "branch",
    actorVisible: true,
    selfVisible: true,
    visibilityClass: "org_activity",
    visibleTo: ["org_member", "org_admin", "auditor"],
    sensitiveFields: [],
  },

  // -------------------------------------------------------------------------
  // QR Platform module
  // -------------------------------------------------------------------------

  "qr.code.created": {
    actionKey: "qr.code.created",
    moduleSlug: "qr",
    eventTier: "baseline",
    category: "QR",
    intent: "CREATE",
    i18nKey: "events.qr.code.created",
    description: "A QR code was created",
    metadataSchema: z.object({
      qr_code_id: z.string().uuid(),
      // First 4 chars only — enough to cross-reference in logs without
      // exposing the full scannable token.
      token_prefix: z.string(),
      label: z.string().nullable().optional(),
    }),
    summaryTemplate: "Created QR code {{label}}",
    scope: "organization",
    actorVisible: true,
    selfVisible: true,
    visibilityClass: "org_activity",
    visibleTo: ["org_member", "org_admin", "auditor"],
    sensitiveFields: [],
  },

  "qr.code.assigned": {
    actionKey: "qr.code.assigned",
    moduleSlug: "qr",
    eventTier: "baseline",
    category: "QR",
    intent: "ASSIGN",
    i18nKey: "events.qr.code.assigned",
    description: "A QR code was assigned to a target",
    metadataSchema: z.object({
      qr_code_id: z.string().uuid(),
      target_type: z.string(),
      target_id: z.string().uuid(),
      branch_id: z.string().uuid().nullable().optional(),
    }),
    summaryTemplate: "Assigned QR code to {{target_type}}",
    scope: "branch",
    actorVisible: true,
    selfVisible: true,
    visibilityClass: "org_activity",
    visibleTo: ["org_member", "org_admin", "auditor"],
    sensitiveFields: [],
  },

  "qr.code.revoked": {
    actionKey: "qr.code.revoked",
    moduleSlug: "qr",
    eventTier: "baseline",
    category: "QR",
    intent: "DELETE",
    i18nKey: "events.qr.code.revoked",
    description: "A QR code was permanently revoked",
    metadataSchema: z.object({
      qr_code_id: z.string().uuid(),
      revocation_reason: z.string().nullable().optional(),
    }),
    summaryTemplate: "Revoked QR code",
    scope: "organization",
    actorVisible: true,
    selfVisible: true,
    visibilityClass: "org_activity",
    visibleTo: ["org_member", "org_admin", "auditor"],
    sensitiveFields: [],
  },

  "qr.labels.exported": {
    actionKey: "qr.labels.exported",
    moduleSlug: "qr",
    eventTier: "baseline",
    category: "QR",
    intent: "SUCCESS",
    i18nKey: "events.qr.labels.exported",
    description: "A QR label PDF was exported",
    metadataSchema: z.object({
      qr_code_ids: z.array(z.string().uuid()),
      label_count: z.number().int().positive(),
      label_size: z.string(),
      branch_id: z.string().uuid().nullable().optional(),
    }),
    summaryTemplate: "Exported {{label_count}} QR labels",
    scope: "branch",
    actorVisible: true,
    selfVisible: true,
    visibilityClass: "org_activity",
    visibleTo: ["org_member", "org_admin", "auditor"],
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
