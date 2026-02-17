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
 * Expected Count: 20 permissions
 */

// Account Permissions (global scope, system permissions)
export const ACCOUNT_WILDCARD = "account.*" as const;
export const ACCOUNT_PREFERENCES_READ = "account.preferences.read" as const;
export const ACCOUNT_PREFERENCES_UPDATE = "account.preferences.update" as const;
export const ACCOUNT_PROFILE_READ = "account.profile.read" as const;
export const ACCOUNT_PROFILE_UPDATE = "account.profile.update" as const;
export const ACCOUNT_SETTINGS_READ = "account.settings.read" as const;
export const ACCOUNT_SETTINGS_UPDATE = "account.settings.update" as const;

// Branch Permissions (org-scoped)
export const BRANCHES_CREATE = "branches.create" as const;
export const BRANCHES_DELETE = "branches.delete" as const;
export const BRANCHES_READ = "branches.read" as const;
export const BRANCHES_UPDATE = "branches.update" as const;

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
  | typeof INVITES_CANCEL
  | typeof INVITES_CREATE
  | typeof INVITES_READ
  | typeof MEMBERS_MANAGE
  | typeof MEMBERS_READ
  | typeof ORG_READ
  | typeof ORG_UPDATE
  | typeof SELF_READ
  | typeof SELF_UPDATE;

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
  INVITES_CANCEL,
  INVITES_CREATE,
  INVITES_READ,
  MEMBERS_MANAGE,
  MEMBERS_READ,
  ORG_READ,
  ORG_UPDATE,
  SELF_READ,
  SELF_UPDATE,
];
