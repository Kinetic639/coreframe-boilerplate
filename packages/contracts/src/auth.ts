/**
 * Shared Auth Types
 *
 * Client-safe type definitions for authentication.
 * These types can be safely imported from both client and server code.
 */

/**
 * Canonical shared auth role — target-first contract.
 *
 * This is the stable normalized output shape for all platform consumers:
 * web, mobile, and domain layer.
 *
 * === Target JWT wire shape (canonical, PRIMARY) ===
 * Location: claims.app_metadata.roles[]
 * Fields:   role_id, name, is_basic, scope, scope_id, scope_type
 * Source:   custom_access_token_hook (target schema)
 *
 * === Legacy JWT wire shape (transitional FALLBACK) ===
 * Location: claims.roles[]
 * Fields:   role_id, role, org_id, branch_id, scope, scope_id
 * Source:   custom_access_token_hook (legacy schema)
 *
 * Both wire formats are decoded by AuthService.getUserRoles() and normalized
 * to this type before being returned to consumers. New code must treat the
 * target shape as the definition of truth.
 */
export interface TokenRole {
  role_id: string;

  /**
   * Canonical role name (e.g. "org_owner", "branch_manager").
   * This is the primary field. New code must use `name`.
   * Populated from `name` in target tokens.
   * Normalized from `role` in legacy tokens.
   */
  name: string;

  scope: "org" | "branch";

  /**
   * The UUID of the org or branch this role is scoped to.
   * Target tokens: taken directly from `scope_id`.
   * Legacy tokens: derived from `org_id` or `branch_id` depending on scope.
   */
  scope_id: string;

  /**
   * Mirrors `scope`. Present natively in target tokens.
   * Legacy transitional default: derived from `scope`.
   */
  scope_type: "org" | "branch";

  /**
   * Whether this role is a basic/default role.
   * Present natively in target tokens.
   * Legacy transitional default: false (field not present in legacy wire format).
   */
  is_basic: boolean;

  /**
   * Convenience derived field. Not present in the target JWT wire format.
   * Derived: scope === "org" ? scope_id : null.
   * Legacy tokens: taken from raw `org_id` field.
   */
  org_id: string | null;

  /**
   * Convenience derived field. Not present in the target JWT wire format.
   * Derived: scope === "branch" ? scope_id : null.
   * Legacy tokens: taken from raw `branch_id` field.
   */
  branch_id: string | null;

  /**
   * @deprecated Transitional compatibility alias for `name`.
   * Always equals `name`. Exists only for legacy web consumers that still
   * read this field. Remove when all legacy web modules are migrated to
   * the target schema.
   * New code must use `name` instead of `role`.
   */
  role: string;
}

/**
 * @deprecated Use TokenRole. This alias exists for backward compatibility only.
 * JWTRole now reflects the normalized target-first contract, not the old legacy shape.
 * All new code should import and use TokenRole directly.
 */
export type JWTRole = TokenRole;

/**
 * Options for role validation
 */
export interface RoleValidationOptions {
  orgId?: string;
  branchId?: string;
}
