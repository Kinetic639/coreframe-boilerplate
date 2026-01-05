import { jwtDecode } from "jwt-decode";

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
 * JWT claims structure from Supabase Auth
 */
interface JWTClaims {
  sub: string;
  email?: string;
  roles?: JWTRole[];
  aud: string;
  exp: number;
  iat: number;
  [key: string]: any;
}

/**
 * Options for role validation
 */
export interface RoleValidationOptions {
  orgId?: string;
  branchId?: string;
}

/**
 * Authentication Service
 *
 * Provides utilities for extracting and validating user roles from JWT tokens.
 * All methods are pure functions with no side effects.
 *
 * @example
 * ```typescript
 * const roles = AuthService.getUserRoles(accessToken);
 * const isAdmin = AuthService.hasRole(roles, "admin", { orgId: "org-123" });
 * const userOrgs = AuthService.getUserOrganizations(roles);
 * ```
 */
export class AuthService {
  /**
   * Extract user roles from JWT access token
   *
   * @param accessToken - JWT access token from Supabase Auth
   * @returns Array of role assignments with scope information
   *
   * @example
   * ```typescript
   * const roles = AuthService.getUserRoles(session.access_token);
   * // [{ role_id: "...", role: "admin", org_id: "org-1", scope: "org", ... }]
   * ```
   */
  static getUserRoles(accessToken: string): JWTRole[] {
    try {
      const decoded = jwtDecode<JWTClaims>(accessToken);

      if (!decoded.roles || !Array.isArray(decoded.roles)) {
        return [];
      }

      return decoded.roles;
    } catch {
      // Silent fail for invalid tokens - this is expected in test scenarios
      // In production, invalid tokens won't reach this point due to middleware validation
      return [];
    }
  }

  /**
   * Check if user has a specific role
   *
   * @param roles - Array of user roles from getUserRoles()
   * @param roleName - Role name(s) to check (can be string or array)
   * @param options - Optional filters for org/branch scope
   * @returns True if user has the role with matching scope
   *
   * @example
   * ```typescript
   * // Check for any admin role
   * AuthService.hasRole(roles, "admin")
   *
   * // Check for admin in specific org
   * AuthService.hasRole(roles, "admin", { orgId: "org-123" })
   *
   * // Check for multiple roles
   * AuthService.hasRole(roles, ["admin", "moderator"])
   * ```
   */
  static hasRole(
    roles: JWTRole[],
    roleName: string | string[],
    options?: RoleValidationOptions
  ): boolean {
    const roleNames = Array.isArray(roleName) ? roleName : [roleName];

    return roles.some((role) => {
      // Check if role name matches
      if (!roleNames.includes(role.role)) {
        return false;
      }

      // If org filter provided, validate org scope
      if (options?.orgId) {
        // Must be org-scoped role with matching org_id
        if (role.scope !== "org" || role.org_id !== options.orgId) {
          return false;
        }
      }

      // If branch filter provided, validate branch scope
      if (options?.branchId) {
        // Must be branch-scoped role with matching branch_id
        if (role.scope !== "branch" || role.branch_id !== options.branchId) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Get all unique organization IDs user has access to
   *
   * @param roles - Array of user roles from getUserRoles()
   * @returns Array of unique organization IDs
   *
   * @example
   * ```typescript
   * const orgs = AuthService.getUserOrganizations(roles);
   * // ["org-1", "org-2"]
   * ```
   */
  static getUserOrganizations(roles: JWTRole[]): string[] {
    const orgIds = roles
      .filter((role) => role.org_id !== null && role.scope === "org")
      .map((role) => role.org_id as string);

    // Return unique org IDs
    return Array.from(new Set(orgIds));
  }

  /**
   * Get all unique branch IDs user has access to
   *
   * @param roles - Array of user roles from getUserRoles()
   * @param orgId - Optional filter for branches in specific organization
   * @returns Array of unique branch IDs
   *
   * @example
   * ```typescript
   * // Get all branches
   * const branches = AuthService.getUserBranches(roles);
   *
   * // Get branches in specific org
   * const orgBranches = AuthService.getUserBranches(roles, "org-123");
   * ```
   */
  static getUserBranches(roles: JWTRole[], orgId?: string): string[] {
    let filteredRoles = roles.filter((role) => role.branch_id !== null && role.scope === "branch");

    // Filter by org if provided
    if (orgId) {
      filteredRoles = filteredRoles.filter((role) => role.org_id === orgId);
    }

    const branchIds = filteredRoles.map((role) => role.branch_id as string);

    // Return unique branch IDs
    return Array.from(new Set(branchIds));
  }
}
