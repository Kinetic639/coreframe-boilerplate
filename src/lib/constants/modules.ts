/**
 * Module Slug Constants
 *
 * CRITICAL: These MUST match the `enabled_modules` array values in:
 * - `organization_entitlements.enabled_modules` (JSONB array)
 * - `subscription_plans.enabled_modules` (JSONB array)
 *
 * - Do NOT create new module slugs here without adding them to subscription plans first
 * - If a module slug changes in entitlements, update this file and TypeScript will catch all usages
 * - NEVER use raw module strings outside this file
 *
 * Single source of truth for module slug references.
 *
 * Database Query to Verify:
 * SELECT DISTINCT jsonb_array_elements_text(enabled_modules) AS module_slug
 * FROM subscription_plans
 * WHERE is_active = true
 * ORDER BY module_slug;
 */

// Core Modules (Available on Free Plan)
// NOTE: MODULE_HOME and MODULE_TEAMS are confirmed canonical per entitlements system
export const MODULE_HOME = "home" as const;
export const MODULE_WAREHOUSE = "warehouse" as const;
export const MODULE_TEAMS = "teams" as const;
export const MODULE_ORGANIZATION_MANAGEMENT = "organization-management" as const;
export const MODULE_SUPPORT = "support" as const;
export const MODULE_USER_ACCOUNT = "user-account" as const;

// Free-Only Modules (Removed in Professional/Enterprise)
export const MODULE_CONTACTS = "contacts" as const;
export const MODULE_DOCUMENTATION = "documentation" as const;

// Premium Modules (Professional/Enterprise Only)
export const MODULE_ANALYTICS = "analytics" as const;
export const MODULE_DEVELOPMENT = "development" as const;

// Admin Module (Not in any plan - superadmin only)
export const MODULE_ADMIN = "admin" as const;

/**
 * Type union of all valid module slugs
 * Useful for type-safe module checks
 */
export type ModuleSlug =
  | typeof MODULE_HOME
  | typeof MODULE_WAREHOUSE
  | typeof MODULE_TEAMS
  | typeof MODULE_ORGANIZATION_MANAGEMENT
  | typeof MODULE_SUPPORT
  | typeof MODULE_USER_ACCOUNT
  | typeof MODULE_CONTACTS
  | typeof MODULE_DOCUMENTATION
  | typeof MODULE_ANALYTICS
  | typeof MODULE_DEVELOPMENT
  | typeof MODULE_ADMIN;

/**
 * Free plan modules (always available)
 */
export const FREE_PLAN_MODULES = [
  MODULE_HOME,
  MODULE_WAREHOUSE,
  MODULE_TEAMS,
  MODULE_ORGANIZATION_MANAGEMENT,
  MODULE_SUPPORT,
  MODULE_USER_ACCOUNT,
  MODULE_CONTACTS,
  MODULE_DOCUMENTATION,
] as const;

/**
 * Premium modules (require paid plan)
 */
export const PREMIUM_MODULES = [MODULE_ANALYTICS, MODULE_DEVELOPMENT] as const;

/**
 * Core modules (available across all paid plans)
 */
export const CORE_MODULES = [
  MODULE_HOME,
  MODULE_WAREHOUSE,
  MODULE_TEAMS,
  MODULE_ORGANIZATION_MANAGEMENT,
  MODULE_SUPPORT,
  MODULE_USER_ACCOUNT,
] as const;
