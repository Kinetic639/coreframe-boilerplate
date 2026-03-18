/**
 * Shared Auth Types
 *
 * Client-safe type definitions for authentication.
 * These types can be safely imported from both client and server code.
 */

/**
 * Role assignment from JWT with scope information
 */
export interface JWTRole {
  role_id: string;
  role: string;
  org_id: string | null;
  branch_id: string | null;
  scope: "org" | "branch";
  scope_id: string;
}

/**
 * Options for role validation
 */
export interface RoleValidationOptions {
  orgId?: string;
  branchId?: string;
}
