/**
 * Permission Slug Constants
 *
 * CRITICAL: These MUST match the `slug` column in the `permissions` table.
 * - Do NOT create new permissions here without adding them to the database first
 * - If a permission slug changes in the database, update this file and TypeScript will catch all usages
 * - NEVER use raw permission strings outside this file
 *
 * Single source of truth for permission slug references.
 *
 * Database Query to Verify:
 * SELECT slug FROM permissions WHERE deleted_at IS NULL ORDER BY slug;
 *
 * Expected Count: 38 permissions (20 org-scoped + 4 superadmin + 2 module-access + 3 branch-view + 1 branch-management + 2 tools + 1 audit + 2 event-feed + 3 warehouse-layouts)
 */

// Account Permissions (global scope, system permissions)
export const ACCOUNT_WILDCARD = "account.*" as const;
export const ACCOUNT_PREFERENCES_READ = "account.preferences.read" as const;
export const ACCOUNT_PREFERENCES_UPDATE = "account.preferences.update" as const;
export const ACCOUNT_PROFILE_READ = "account.profile.read" as const;
export const ACCOUNT_PROFILE_UPDATE = "account.profile.update" as const;
export const ACCOUNT_SETTINGS_READ = "account.settings.read" as const;
export const ACCOUNT_SETTINGS_UPDATE = "account.settings.update" as const;

// Branch Permissions (org-scoped) — CRUD administration
export const BRANCHES_CREATE = "branches.create" as const;
export const BRANCHES_DELETE = "branches.delete" as const;
export const BRANCHES_READ = "branches.read" as const;
export const BRANCHES_UPDATE = "branches.update" as const;

// Branch Management Permission (branch-scoped) — delegate role assignment within a branch
// Allows the holder to manage branch-scoped role assignments for the specific branch(es)
// where they hold this permission. Does NOT grant org-wide members.manage/read access.
export const BRANCH_ROLES_MANAGE = "branch.roles.manage" as const;

// Branch Visibility Permissions (org-scoped) — controls branch switcher access
// Separate from CRUD admin permissions; granted to org_owner by default.
// branches.view.any        — user sees ALL non-deleted org branches in the switcher
// branches.view.update.any — user may switch default branch to any org branch (no assignment needed)
// branches.view.remove.any — user may clear/reset their default branch preference
export const BRANCHES_VIEW_ANY = "branches.view.any" as const;
export const BRANCHES_VIEW_UPDATE_ANY = "branches.view.update.any" as const;
export const BRANCHES_VIEW_REMOVE_ANY = "branches.view.remove.any" as const;

// Invite Permissions (org-scoped)
export const INVITES_CANCEL = "invites.cancel" as const;
export const INVITES_CREATE = "invites.create" as const;
export const INVITES_READ = "invites.read" as const;

// Member Permissions (org-scoped)
export const MEMBERS_MANAGE = "members.manage" as const;
export const MEMBERS_READ = "members.read" as const;

// Organization Permissions (org-scoped)
export const ORG_READ = "org.read" as const;
export const ORG_UPDATE = "org.update" as const;

// Self Permissions (user-scoped)
export const SELF_READ = "self.read" as const;
export const SELF_UPDATE = "self.update" as const;

// Module Access Permissions (org-scoped — controls which users may enter a module)
// Entitlements decide which modules an org has; these decide which users can access them.
// module.* wildcard is granted to org_owner only (system role).
// module.organization-management.access can be granted to custom roles via the roles editor.
export const MODULE_ACCESS_WILDCARD = "module.*" as const;
export const MODULE_ORGANIZATION_MANAGEMENT_ACCESS =
  "module.organization-management.access" as const;
// module.warehouse.access — user-level gate to the warehouse module.
// org_owner has it via module.* wildcard; org_member has it as an explicit grant.
// Seeded in migration 20260401120000_warehouse_locations.
export const MODULE_WAREHOUSE_ACCESS = "module.warehouse.access" as const;

// Warehouse Permissions (org+branch-scoped — warehouse module, phase 1)
// warehouse.*               — org_owner wildcard; compiler expands to all concrete warehouse.* slugs
// warehouse.read            — broad read gate checked in layout and actions
// warehouse.locations.read  — read / list warehouse locations for the active branch
// warehouse.locations.manage — create / update / soft-delete warehouse locations
// Seeded in migration 20260401120000_warehouse_locations.
export const WAREHOUSE_WILDCARD = "warehouse.*" as const;
export const WAREHOUSE_READ = "warehouse.read" as const;
export const WAREHOUSE_LOCATIONS_READ = "warehouse.locations.read" as const;
export const WAREHOUSE_LOCATIONS_MANAGE = "warehouse.locations.manage" as const;

// Warehouse Layout Permissions (org+branch-scoped — warehouse module, phase 2)
// warehouse.layouts.read    — view layouts and their shapes (published + draft)
// warehouse.layouts.manage  — create / edit / soft-delete layouts and shapes
// warehouse.layouts.publish — publish a draft layout as the canonical map for its scope
//                             deliberately separate from manage: editors draw, publishers approve
// Seeded in migration 20260407110000_warehouse_layouts.
// org_owner is covered by warehouse.* wildcard — do NOT add explicit grants.
// org_member receives warehouse.layouts.read only (can view published maps, not edit).
export const WAREHOUSE_LAYOUTS_READ = "warehouse.layouts.read" as const;
export const WAREHOUSE_LAYOUTS_MANAGE = "warehouse.layouts.manage" as const;
export const WAREHOUSE_LAYOUTS_PUBLISH = "warehouse.layouts.publish" as const;

// Audit Permissions (org-scoped)
// audit.events.read — view the full organization audit event log (IP, UA, all metadata)
// Granted to org_owner by default; assignable to custom roles via roles editor.
export const AUDIT_EVENTS_READ = "audit.events.read" as const;

// Event Feed Permissions (org-scoped)
// events.org_activity.read — view organization activity feed (branch created, member joined, etc.)
// events.org_sensitive.read — view sensitive org events (invitations, role changes, member removal)
// Granted to org_owner + org_admin; org_member gets org_activity.read only.
export const EVENTS_ORG_ACTIVITY_READ = "events.org_activity.read" as const;
export const EVENTS_ORG_SENSITIVE_READ = "events.org_sensitive.read" as const;

// Tools Permissions (user-scoped — always available, no plan gating)
// tools.read  — view the tools catalog, tool detail pages, and personal enabled-tools list
// tools.manage — enable, disable, pin, and update settings for tools
export const PERMISSION_TOOLS_READ = "tools.read" as const;
export const PERMISSION_TOOLS_MANAGE = "tools.manage" as const;

// Superadmin Permissions (global scope, super-admin only)
export const SUPERADMIN_WILDCARD = "superadmin.*" as const;
export const SUPERADMIN_ADMIN_READ = "superadmin.admin.read" as const;
export const SUPERADMIN_PLANS_READ = "superadmin.plans.read" as const;
export const SUPERADMIN_PRICING_READ = "superadmin.pricing.read" as const;

/**
 * Type union of all valid permission slugs
 * Useful for type-safe permission checks
 */
export type PermissionSlug =
  | typeof ACCOUNT_WILDCARD
  | typeof ACCOUNT_PREFERENCES_READ
  | typeof ACCOUNT_PREFERENCES_UPDATE
  | typeof ACCOUNT_PROFILE_READ
  | typeof ACCOUNT_PROFILE_UPDATE
  | typeof ACCOUNT_SETTINGS_READ
  | typeof ACCOUNT_SETTINGS_UPDATE
  | typeof BRANCHES_CREATE
  | typeof BRANCHES_DELETE
  | typeof BRANCHES_READ
  | typeof BRANCHES_UPDATE
  | typeof BRANCH_ROLES_MANAGE
  | typeof BRANCHES_VIEW_ANY
  | typeof BRANCHES_VIEW_UPDATE_ANY
  | typeof BRANCHES_VIEW_REMOVE_ANY
  | typeof INVITES_CANCEL
  | typeof INVITES_CREATE
  | typeof INVITES_READ
  | typeof MEMBERS_MANAGE
  | typeof MEMBERS_READ
  | typeof ORG_READ
  | typeof ORG_UPDATE
  | typeof SELF_READ
  | typeof SELF_UPDATE
  | typeof MODULE_ACCESS_WILDCARD
  | typeof MODULE_ORGANIZATION_MANAGEMENT_ACCESS
  | typeof MODULE_WAREHOUSE_ACCESS
  | typeof WAREHOUSE_WILDCARD
  | typeof WAREHOUSE_READ
  | typeof WAREHOUSE_LOCATIONS_READ
  | typeof WAREHOUSE_LOCATIONS_MANAGE
  | typeof WAREHOUSE_LAYOUTS_READ
  | typeof WAREHOUSE_LAYOUTS_MANAGE
  | typeof WAREHOUSE_LAYOUTS_PUBLISH
  | typeof AUDIT_EVENTS_READ
  | typeof EVENTS_ORG_ACTIVITY_READ
  | typeof EVENTS_ORG_SENSITIVE_READ
  | typeof PERMISSION_TOOLS_READ
  | typeof PERMISSION_TOOLS_MANAGE
  | typeof SUPERADMIN_WILDCARD
  | typeof SUPERADMIN_ADMIN_READ
  | typeof SUPERADMIN_PLANS_READ
  | typeof SUPERADMIN_PRICING_READ;

/**
 * Helper: Get all permission slugs as array
 * Useful for validation and testing
 */
export const ALL_PERMISSION_SLUGS: PermissionSlug[] = [
  ACCOUNT_WILDCARD,
  ACCOUNT_PREFERENCES_READ,
  ACCOUNT_PREFERENCES_UPDATE,
  ACCOUNT_PROFILE_READ,
  ACCOUNT_PROFILE_UPDATE,
  ACCOUNT_SETTINGS_READ,
  ACCOUNT_SETTINGS_UPDATE,
  BRANCHES_CREATE,
  BRANCHES_DELETE,
  BRANCHES_READ,
  BRANCHES_UPDATE,
  BRANCH_ROLES_MANAGE,
  BRANCHES_VIEW_ANY,
  BRANCHES_VIEW_UPDATE_ANY,
  BRANCHES_VIEW_REMOVE_ANY,
  INVITES_CANCEL,
  INVITES_CREATE,
  INVITES_READ,
  MEMBERS_MANAGE,
  MEMBERS_READ,
  ORG_READ,
  ORG_UPDATE,
  SELF_READ,
  SELF_UPDATE,
  MODULE_ACCESS_WILDCARD,
  MODULE_ORGANIZATION_MANAGEMENT_ACCESS,
  MODULE_WAREHOUSE_ACCESS,
  WAREHOUSE_WILDCARD,
  WAREHOUSE_READ,
  WAREHOUSE_LOCATIONS_READ,
  WAREHOUSE_LOCATIONS_MANAGE,
  WAREHOUSE_LAYOUTS_READ,
  WAREHOUSE_LAYOUTS_MANAGE,
  WAREHOUSE_LAYOUTS_PUBLISH,
  AUDIT_EVENTS_READ,
  EVENTS_ORG_ACTIVITY_READ,
  EVENTS_ORG_SENSITIVE_READ,
  PERMISSION_TOOLS_READ,
  PERMISSION_TOOLS_MANAGE,
  SUPERADMIN_WILDCARD,
  SUPERADMIN_ADMIN_READ,
  SUPERADMIN_PLANS_READ,
  SUPERADMIN_PRICING_READ,
];

/**
 * Permission snapshot with explicit allow and deny lists
 *
 * This structure ensures deny overrides work correctly with wildcards.
 * Used throughout the application for permission checking with deny-first semantics.
 *
 * @example
 * ```typescript
 * const snapshot: PermissionSnapshot = {
 *   allow: ["warehouse.*", "teams.members.read"],
 *   deny: ["warehouse.products.delete"]
 * };
 * ```
 */
export type PermissionSnapshot = {
  /** Permissions explicitly allowed (can include wildcards like "warehouse.*") */
  allow: string[];
  /** Permissions explicitly denied (can include wildcards) - takes precedence over allow */
  deny: string[];
};
