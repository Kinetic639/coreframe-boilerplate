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
 * Expected Count: grows as modules add concrete slugs. Verify against:
 * SELECT slug FROM permissions WHERE deleted_at IS NULL ORDER BY slug;
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

// Warehouse Inventory Permissions (org+branch-scoped — Ambra Inventory V2 Phase 1)
// warehouse.products.read     — list/read inventory products and default variants
// warehouse.products.manage   — create/update products, variants, units, and movement reasons
// warehouse.products.archive  — archive products without deleting movement history
// warehouse.inventory.read    — list/read balances, movement headers, and movement lines
// warehouse.inventory.operate — create/post normal stock movements
// warehouse.inventory.adjust  — create/post adjustment movements
// warehouse.inventory.reverse — reverse posted movements
// warehouse.settings.manage   — manage inventory settings such as number/SKU sequences
// Seeded in migration 20260505090000_inventory_phase1_permissions.
// org_owner is covered by warehouse.* wildcard — do NOT add explicit grants.
// org_member receives read-only inventory visibility by default.
export const WAREHOUSE_PRODUCTS_READ = "warehouse.products.read" as const;
export const WAREHOUSE_PRODUCTS_MANAGE = "warehouse.products.manage" as const;
export const WAREHOUSE_PRODUCTS_ARCHIVE = "warehouse.products.archive" as const;
export const WAREHOUSE_INVENTORY_READ = "warehouse.inventory.read" as const;
export const WAREHOUSE_INVENTORY_OPERATE = "warehouse.inventory.operate" as const;
export const WAREHOUSE_INVENTORY_ADJUST = "warehouse.inventory.adjust" as const;
export const WAREHOUSE_INVENTORY_REVERSE = "warehouse.inventory.reverse" as const;
export const WAREHOUSE_SETTINGS_MANAGE = "warehouse.settings.manage" as const;
export const WAREHOUSE_PROCUREMENT_READ = "warehouse.procurement.read" as const;
export const WAREHOUSE_PROCUREMENT_MANAGE = "warehouse.procurement.manage" as const;
export const WAREHOUSE_PRICING_READ = "warehouse.pricing.read" as const;
export const WAREHOUSE_PRICING_MANAGE = "warehouse.pricing.manage" as const;
export const WAREHOUSE_REPORTS_READ = "warehouse.reports.read" as const;
export const WAREHOUSE_IMPORTS_MANAGE = "warehouse.imports.manage" as const;

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

// Analytics Permissions (org-scoped — Analytics & Reports module, Premium plan only)
// analytics.*              — org_owner wildcard; compiler expands to all concrete analytics.* slugs
// analytics.read           — broad read gate for the analytics module shell and overview
// analytics.activity.read  — view the organisation activity feed within the analytics module
// analytics.audit.read     — view the full audit event log within the analytics module
// analytics.reports.read   — view generated reports (future)
// analytics.exports.manage — download / trigger data exports (future)
// module.analytics.access  — user-level gate; admins assign to custom roles for premium-plan orgs
// Seeded in migration 20260525100000_analytics_module.sql.
// org_owner gets analytics.* wildcard — do NOT add explicit granular grants.
export const MODULE_ANALYTICS_ACCESS = "module.analytics.access" as const;
export const ANALYTICS_WILDCARD = "analytics.*" as const;
export const ANALYTICS_READ = "analytics.read" as const;
export const ANALYTICS_ACTIVITY_READ = "analytics.activity.read" as const;
export const ANALYTICS_AUDIT_READ = "analytics.audit.read" as const;
export const ANALYTICS_REPORTS_READ = "analytics.reports.read" as const;
export const ANALYTICS_EXPORTS_MANAGE = "analytics.exports.manage" as const;

// Tools Permissions (user-scoped — always available, no plan gating)
// tools.read  — view the tools catalog, tool detail pages, and personal enabled-tools list
// tools.manage — enable, disable, pin, and update settings for tools
export const PERMISSION_TOOLS_READ = "tools.read" as const;
export const PERMISSION_TOOLS_MANAGE = "tools.manage" as const;

// WDD Matcher Permissions (org-scoped — SVWMS WDD Matcher tool)
// wdd_matcher.read   — view sessions, blocks, matches (org_owner + org_member)
// wdd_matcher.upload — create sessions, upload/parse PDFs, run matching (org_owner + org_member)
// wdd_matcher.review — approve/reject block pairs and line matches (org_owner + org_member)
// wdd_matcher.approve — final session sign-off (org_owner only)
export const PERMISSION_WDD_MATCHER_READ = "wdd_matcher.read" as const;
export const PERMISSION_WDD_MATCHER_UPLOAD = "wdd_matcher.upload" as const;
export const PERMISSION_WDD_MATCHER_REVIEW = "wdd_matcher.review" as const;
export const PERMISSION_WDD_MATCHER_APPROVE = "wdd_matcher.approve" as const;

// QR Platform Permissions (org+branch-scoped — platform-wide QR identity and label system)
// qr.*      — wildcard for org_owner; compiler expands to all concrete qr.X slugs
// qr.read   — view QR codes and their assignments
// qr.create — generate new QR code records
// qr.assign — assign/reassign QR codes to targets (compound check with target permission)
// qr.revoke — permanently revoke QR codes or individual assignments
// qr.export — download printable label PDFs (operational capability; not seeded to org_member)
// Seeded in migration 20260423110000_qr_platform_permissions.
export const QR_WILDCARD = "qr.*" as const;
export const QR_READ = "qr.read" as const;
export const QR_CREATE = "qr.create" as const;
export const QR_ASSIGN = "qr.assign" as const;
export const QR_REVOKE = "qr.revoke" as const;
export const QR_EXPORT = "qr.export" as const;

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
  | typeof WAREHOUSE_PRODUCTS_READ
  | typeof WAREHOUSE_PRODUCTS_MANAGE
  | typeof WAREHOUSE_PRODUCTS_ARCHIVE
  | typeof WAREHOUSE_INVENTORY_READ
  | typeof WAREHOUSE_INVENTORY_OPERATE
  | typeof WAREHOUSE_INVENTORY_ADJUST
  | typeof WAREHOUSE_INVENTORY_REVERSE
  | typeof WAREHOUSE_SETTINGS_MANAGE
  | typeof WAREHOUSE_PROCUREMENT_READ
  | typeof WAREHOUSE_PROCUREMENT_MANAGE
  | typeof WAREHOUSE_PRICING_READ
  | typeof WAREHOUSE_PRICING_MANAGE
  | typeof WAREHOUSE_REPORTS_READ
  | typeof WAREHOUSE_IMPORTS_MANAGE
  | typeof AUDIT_EVENTS_READ
  | typeof EVENTS_ORG_ACTIVITY_READ
  | typeof EVENTS_ORG_SENSITIVE_READ
  | typeof MODULE_ANALYTICS_ACCESS
  | typeof ANALYTICS_WILDCARD
  | typeof ANALYTICS_READ
  | typeof ANALYTICS_ACTIVITY_READ
  | typeof ANALYTICS_AUDIT_READ
  | typeof ANALYTICS_REPORTS_READ
  | typeof ANALYTICS_EXPORTS_MANAGE
  | typeof PERMISSION_TOOLS_READ
  | typeof PERMISSION_TOOLS_MANAGE
  | typeof PERMISSION_WDD_MATCHER_READ
  | typeof PERMISSION_WDD_MATCHER_UPLOAD
  | typeof PERMISSION_WDD_MATCHER_REVIEW
  | typeof PERMISSION_WDD_MATCHER_APPROVE
  | typeof QR_WILDCARD
  | typeof QR_READ
  | typeof QR_CREATE
  | typeof QR_ASSIGN
  | typeof QR_REVOKE
  | typeof QR_EXPORT
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
  WAREHOUSE_PRODUCTS_READ,
  WAREHOUSE_PRODUCTS_MANAGE,
  WAREHOUSE_PRODUCTS_ARCHIVE,
  WAREHOUSE_INVENTORY_READ,
  WAREHOUSE_INVENTORY_OPERATE,
  WAREHOUSE_INVENTORY_ADJUST,
  WAREHOUSE_INVENTORY_REVERSE,
  WAREHOUSE_SETTINGS_MANAGE,
  WAREHOUSE_PROCUREMENT_READ,
  WAREHOUSE_PROCUREMENT_MANAGE,
  WAREHOUSE_PRICING_READ,
  WAREHOUSE_PRICING_MANAGE,
  WAREHOUSE_REPORTS_READ,
  WAREHOUSE_IMPORTS_MANAGE,
  AUDIT_EVENTS_READ,
  EVENTS_ORG_ACTIVITY_READ,
  EVENTS_ORG_SENSITIVE_READ,
  MODULE_ANALYTICS_ACCESS,
  ANALYTICS_WILDCARD,
  ANALYTICS_READ,
  ANALYTICS_ACTIVITY_READ,
  ANALYTICS_AUDIT_READ,
  ANALYTICS_REPORTS_READ,
  ANALYTICS_EXPORTS_MANAGE,
  PERMISSION_TOOLS_READ,
  PERMISSION_TOOLS_MANAGE,
  PERMISSION_WDD_MATCHER_READ,
  PERMISSION_WDD_MATCHER_UPLOAD,
  PERMISSION_WDD_MATCHER_REVIEW,
  PERMISSION_WDD_MATCHER_APPROVE,
  QR_WILDCARD,
  QR_READ,
  QR_CREATE,
  QR_ASSIGN,
  QR_REVOKE,
  QR_EXPORT,
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
