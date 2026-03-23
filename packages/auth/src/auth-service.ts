import { jwtDecode } from "jwt-decode";
import type { TokenRole, RoleValidationOptions } from "@repo/contracts/auth";

// Re-export canonical type and deprecated alias for consumers who import via @repo/auth
export type { TokenRole, RoleValidationOptions };
/**
 * @deprecated Use TokenRole. Alias preserved for existing consumers.
 */
export type { JWTRole } from "@repo/contracts/auth";

// ============================================================
// Internal wire-format interfaces (not exported)
//
// These represent the raw shapes as they arrive in the JWT.
// Consumers never see these — they always receive TokenRole.
// ============================================================

/**
 * Target token wire format (canonical).
 * Source: custom_access_token_hook (target schema)
 * Location in JWT: claims.app_metadata.roles[]
 */
interface TargetRawRole {
  role_id: string;
  name: string;
  is_basic: boolean;
  scope: "org" | "branch";
  scope_id: string;
  scope_type: "org" | "branch";
}

/**
 * Legacy token wire format (transitional fallback).
 * Source: custom_access_token_hook (legacy schema)
 * Location in JWT: claims.roles[]
 *
 * TRANSITIONAL: Remove this interface when the legacy schema is retired
 * and all issued tokens use the target shape.
 */
interface LegacyRawRole {
  role_id?: string;
  role: string;
  org_id?: string | null;
  branch_id?: string | null;
  scope?: "org" | "branch";
  scope_id?: string;
  /** Very old legacy field present in some tokens. Ignored during normalization. */
  team_id?: string | null;
}

/**
 * JWT claims structure.
 *
 * Two role locations are supported:
 *   - app_metadata.roles  → TARGET (PRIMARY, canonical)
 *   - roles               → LEGACY (FALLBACK, transitional)
 */
interface JWTClaims {
  sub: string;
  email?: string;
  /**
   * TARGET path: roles injected into app_metadata by the target access token hook.
   * This is the canonical location. Checked first.
   */
  app_metadata?: {
    roles?: TargetRawRole[];
    [key: string]: unknown;
  };
  /**
   * LEGACY path: roles injected at root level by the legacy access token hook.
   * TRANSITIONAL: Remove when legacy schema is retired.
   */
  roles?: LegacyRawRole[];
  aud: string;
  exp: number;
  iat: number;
  [key: string]: unknown;
}

// ============================================================
// Normalization helpers
// ============================================================

/**
 * Normalize a target-shape raw role to the canonical TokenRole.
 *
 * Target normalization rules:
 *   name       → taken directly from wire format
 *   scope_type → taken directly from wire format
 *   is_basic   → taken directly from wire format
 *   org_id     → DERIVED: scope === "org" ? scope_id : null
 *   branch_id  → DERIVED: scope === "branch" ? scope_id : null
 *   role       → deprecated alias, always equals name
 */
function normalizeTargetRole(r: TargetRawRole): TokenRole {
  return {
    role_id: r.role_id,
    name: r.name,
    scope: r.scope,
    scope_id: r.scope_id,
    scope_type: r.scope_type,
    is_basic: r.is_basic,
    // org_id and branch_id are not in the target wire format — derived from scope + scope_id
    org_id: r.scope === "org" ? r.scope_id : null,
    branch_id: r.scope === "branch" ? r.scope_id : null,
    // Deprecated compatibility alias — always equals name; remove when legacy consumers are gone
    role: r.name,
  };
}

/**
 * Normalize a legacy-shape raw role to the canonical TokenRole.
 *
 * Legacy normalization rules:
 *   name       → normalized from `role` field (legacy field name)
 *   scope      → from wire format if present; otherwise derived from presence of org_id/branch_id
 *   scope_id   → from wire format if present; otherwise derived from org_id or branch_id
 *   org_id     → taken directly from wire format
 *   branch_id  → taken directly from wire format
 *   role_id    → from wire format if present; empty string if absent
 *   role       → deprecated alias, always equals name
 *
 * TRANSITIONAL DEFAULTS (fields absent from legacy wire format):
 *   scope_type → mirrors derived/provided scope (not in legacy tokens)
 *   is_basic   → false (not available in legacy wire format)
 *
 * TRANSITIONAL: Remove when legacy schema is retired.
 */
function normalizeLegacyRole(r: LegacyRawRole): TokenRole {
  const derivedScope: "org" | "branch" = r.scope ?? (r.org_id != null ? "org" : "branch");
  const derivedScopeId: string = r.scope_id ?? r.org_id ?? r.branch_id ?? "";
  const normalizedName = r.role;

  return {
    role_id: r.role_id ?? "",
    name: normalizedName,
    scope: derivedScope,
    scope_id: derivedScopeId,
    // TRANSITIONAL DEFAULT: scope_type mirrors scope. Not present in legacy wire format.
    scope_type: derivedScope,
    // TRANSITIONAL DEFAULT: is_basic set to false. Not present in legacy wire format.
    is_basic: false,
    org_id: r.org_id ?? null,
    branch_id: r.branch_id ?? null,
    // Deprecated compatibility alias — always equals name; remove when legacy consumers are gone
    role: normalizedName,
  };
}

// ============================================================
// AuthService
// ============================================================

/**
 * Authentication Service
 *
 * Pure utilities for extracting and validating user roles from JWT tokens.
 * All methods are static, pure functions with no side effects and no runtime
 * dependencies on Next.js, React, Expo, or Supabase client libraries.
 *
 * Platform-neutral: safe to use in web, mobile, or any Node.js context
 * that has access to a JWT access token string.
 *
 * === Canonical JWT contract ===
 * The target hook shape is the source of truth. The PRIMARY decode path is:
 *   claims.app_metadata.roles[] — fields: role_id, name, is_basic, scope, scope_id, scope_type
 *
 * A legacy fallback path handles transitional migration:
 *   claims.roles[] — fields: role_id, role, org_id, branch_id, scope, scope_id
 *
 * Both paths normalize to TokenRole before returning to consumers.
 * Remove the legacy fallback path when the legacy schema is retired.
 *
 * @example
 * ```typescript
 * // Target token (canonical)
 * const roles = AuthService.getUserRoles(session.access_token);
 * // [{ name: "org_owner", scope: "org", scope_id: "org-uuid", is_basic: true, ... }]
 *
 * const isOwner = AuthService.hasRole(roles, "org_owner", { orgId: "org-uuid" });
 * const userOrgs = AuthService.getUserOrganizations(roles);
 * ```
 */
export class AuthService {
  /**
   * Extract and normalize user roles from a JWT access token.
   *
   * PRIMARY PATH (target): claims.app_metadata.roles[] with field `name`.
   * If present and non-empty, this path is used exclusively.
   *
   * FALLBACK PATH (legacy, transitional): claims.roles[] with field `role`.
   * Used only when the target path is absent or empty.
   * TRANSITIONAL: Remove fallback path when legacy schema is retired.
   *
   * @param accessToken - JWT access token from Supabase Auth
   * @returns Normalized TokenRole array. Both decode paths produce the same shape.
   *
   * @example
   * ```typescript
   * // Target token (canonical — primary path)
   * const roles = AuthService.getUserRoles(session.access_token);
   * // [{ name: "org_owner", scope: "org", scope_id: "org-uuid", ... }]
   * ```
   */
  static getUserRoles(accessToken: string): TokenRole[] {
    try {
      const decoded = jwtDecode<JWTClaims>(accessToken);

      // PRIMARY PATH: target hook — claims.app_metadata.roles with field `name`
      const targetRoles = decoded.app_metadata?.roles;
      if (Array.isArray(targetRoles) && targetRoles.length > 0) {
        return targetRoles.map(normalizeTargetRole);
      }

      // FALLBACK PATH: legacy hook — claims.roles with field `role`
      // TRANSITIONAL: Remove when legacy schema is retired and all tokens use target shape.
      const legacyRoles = decoded.roles;
      if (Array.isArray(legacyRoles) && legacyRoles.length > 0) {
        return legacyRoles.map(normalizeLegacyRole);
      }

      return [];
    } catch {
      // Silent fail for invalid tokens — expected in test scenarios and middleware validation
      return [];
    }
  }

  /**
   * Check if a user has a specific role.
   *
   * Matches on the canonical `name` field.
   *
   * @param roles - Normalized TokenRole array from getUserRoles()
   * @param roleName - Role name(s) to check (string or array)
   * @param options - Optional scope filters (orgId, branchId)
   * @returns True if a matching role exists with the requested scope
   *
   * @example
   * ```typescript
   * // Any org_owner role
   * AuthService.hasRole(roles, "org_owner")
   *
   * // org_owner in a specific org
   * AuthService.hasRole(roles, "org_owner", { orgId: "org-uuid" })
   *
   * // Multiple role names (any match)
   * AuthService.hasRole(roles, ["org_owner", "org_admin"])
   * ```
   */
  static hasRole(
    roles: TokenRole[],
    roleName: string | string[],
    options?: RoleValidationOptions
  ): boolean {
    const roleNames = Array.isArray(roleName) ? roleName : [roleName];

    return roles.some((role) => {
      // Match on canonical `name` field
      if (!roleNames.includes(role.name)) {
        return false;
      }

      // If org filter provided, validate org scope via derived org_id
      if (options?.orgId) {
        if (role.scope !== "org" || role.org_id !== options.orgId) {
          return false;
        }
      }

      // If branch filter provided, validate branch scope via derived branch_id
      if (options?.branchId) {
        if (role.scope !== "branch" || role.branch_id !== options.branchId) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Get all unique organization IDs the user has access to.
   *
   * @param roles - Normalized TokenRole array from getUserRoles()
   * @returns Array of unique org UUIDs (from org-scoped roles only)
   *
   * @example
   * ```typescript
   * const orgs = AuthService.getUserOrganizations(roles);
   * // ["org-uuid-1", "org-uuid-2"]
   * ```
   */
  static getUserOrganizations(roles: TokenRole[]): string[] {
    const orgIds = roles
      .filter((role) => role.org_id !== null && role.scope === "org")
      .map((role) => role.org_id as string);

    return Array.from(new Set(orgIds));
  }

  /**
   * Get all unique branch IDs the user has access to.
   *
   * @param roles - Normalized TokenRole array from getUserRoles()
   * @param orgId - Optional: filter branches belonging to a specific org
   * @returns Array of unique branch UUIDs (from branch-scoped roles only)
   *
   * @example
   * ```typescript
   * // All accessible branches
   * const branches = AuthService.getUserBranches(roles);
   *
   * // Branches in a specific org
   * const orgBranches = AuthService.getUserBranches(roles, "org-uuid-1");
   * ```
   */
  static getUserBranches(roles: TokenRole[], orgId?: string): string[] {
    let filteredRoles = roles.filter((role) => role.branch_id !== null && role.scope === "branch");

    if (orgId) {
      filteredRoles = filteredRoles.filter((role) => role.org_id === orgId);
    }

    const branchIds = filteredRoles.map((role) => role.branch_id as string);

    return Array.from(new Set(branchIds));
  }
}
