/**
 * Shared Permission Types
 *
 * Centralized type definitions for the permission system to ensure consistency
 * across client and server code.
 */

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
