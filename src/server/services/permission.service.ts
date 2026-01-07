import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Permission Service
 *
 * Provides utilities for fetching and validating user permissions with full scope support.
 * Combines role-based permissions with user-specific overrides.
 * Supports both organization-wide and branch-specific permissions.
 *
 * @example
 * ```typescript
 * // Org-level permissions only
 * const orgPerms = await PermissionService.getPermissionsForUser(supabase, userId, orgId);
 *
 * // Branch-level permissions (includes org + branch roles)
 * const branchPerms = await PermissionService.getPermissionsForUser(supabase, userId, orgId, branchId);
 *
 * const canRead = PermissionService.can(branchPerms, "warehouse.products.read");
 * const canManage = PermissionService.can(branchPerms, "warehouse.*");
 * ```
 */
export class PermissionService {
  /**
   * Get all permissions for a user within an organization (and optionally a branch)
   *
   * Combines:
   * 1. Role-based permissions from user_role_assignments (org + optional branch scopes)
   * 2. User-specific permission overrides (with proper scope precedence)
   *
   * Permission precedence (later wins):
   * - Base permissions from org-scoped roles
   * - Base permissions from branch-scoped roles (if branchId provided)
   * - Global overrides
   * - Org overrides
   * - Branch overrides (if branchId provided)
   *
   * @param supabase - Supabase client instance
   * @param userId - User ID to fetch permissions for
   * @param orgId - Organization ID context
   * @param branchId - Optional branch ID context (if omitted, only org-scoped permissions)
   * @returns Array of permission slugs (e.g., ["warehouse.products.read", "warehouse.*"])
   *
   * @example
   * ```typescript
   * // Org-only context
   * const orgPermissions = await PermissionService.getPermissionsForUser(
   *   supabase,
   *   "user-123",
   *   "org-456"
   * );
   *
   * // Branch context (includes org + branch permissions)
   * const branchPermissions = await PermissionService.getPermissionsForUser(
   *   supabase,
   *   "user-123",
   *   "org-456",
   *   "branch-789"
   * );
   * ```
   */
  static async getPermissionsForUser(
    supabase: SupabaseClient,
    userId: string,
    orgId: string,
    branchId?: string | null
  ): Promise<string[]> {
    try {
      // 1. Get user's role assignments for this context
      // Build filters for org-scoped and optionally branch-scoped roles
      const filters: string[] = [
        // Org-scoped roles for this org
        `and(scope.eq.org,scope_id.eq.${orgId})`,
      ];

      // If branch context, also include branch-scoped roles for this branch
      if (branchId) {
        filters.push(`and(scope.eq.branch,scope_id.eq.${branchId})`);
      }

      const { data: roleAssignments, error: roleError } = await supabase
        .from("user_role_assignments")
        .select("role_id, scope, scope_id")
        .eq("user_id", userId)
        .or(filters.join(",")) // org roles OR branch roles
        .is("deleted_at", null);

      if (roleError) {
        // Silent fail - RLS denial or other errors
        return [];
      }

      if (!roleAssignments || roleAssignments.length === 0) {
        return [];
      }

      // 2. Get permissions for these roles via RPC
      const roleIds = roleAssignments.map((r) => r.role_id);
      const { data: permissionsData, error: permError } = await supabase.rpc(
        "get_permissions_for_roles",
        { role_ids: roleIds }
      );

      if (permError) {
        // Silent fail - RPC errors
        return [];
      }

      // Extract permission slugs from RPC response
      // The RPC now returns SETOF text, so it should be strings directly
      const basePermissions = (permissionsData ?? [])
        .map((p: any) => {
          if (typeof p === "string") return p;
          if (p?.slug) return p.slug;
          if (p?.get_permissions_for_roles) return p.get_permissions_for_roles;
          return null;
        })
        .filter((slug: string | null): slug is string => typeof slug === "string");

      // 3. Get permission overrides for this user/context with proper scoping
      // Build override filters: global + org + (optional) branch
      // Note: global overrides have scope_id = NULL (handled by scope.eq.global filter)
      const overrideOr = branchId
        ? `scope.eq.global,and(scope.eq.org,scope_id.eq.${orgId}),and(scope.eq.branch,scope_id.eq.${branchId})`
        : `scope.eq.global,and(scope.eq.org,scope_id.eq.${orgId})`;

      const { data: overrides, error: overrideError } = await supabase
        .from("user_permission_overrides")
        .select("permission_id, allowed, scope, scope_id")
        .eq("user_id", userId)
        .or(overrideOr)
        .is("deleted_at", null);

      if (overrideError) {
        // Return base permissions if override fetch fails
        return basePermissions;
      }

      if (!overrides || overrides.length === 0) {
        return basePermissions;
      }

      // 4. Fetch permission slugs for overrides
      const overridePermissionIds = overrides.map((o) => o.permission_id);
      const { data: permissionDetails, error: detailsError } = await supabase
        .from("permissions")
        .select("id, slug")
        .in("id", overridePermissionIds);

      if (detailsError) {
        // Return base permissions if details fetch fails
        return basePermissions;
      }

      // Create a map of permission ID to slug
      const permissionMap = new Map<string, string>();
      (permissionDetails ?? []).forEach((p) => {
        permissionMap.set(p.id, p.slug);
      });

      // 5. Apply overrides with proper precedence
      // Precedence: global < org < branch (later wins)
      const permissionSet = new Set<string>(basePermissions);

      // Sort overrides by scope precedence (global -> org -> branch)
      // with deterministic tiebreaker on permission_id for reproducible results
      const scopePrecedence: Record<string, number> = {
        global: 1,
        org: 2,
        branch: 3,
      };

      const sortedOverrides = [...overrides].sort((a, b) => {
        const aPrecedence = scopePrecedence[a.scope] || 0;
        const bPrecedence = scopePrecedence[b.scope] || 0;
        const scopeDiff = aPrecedence - bPrecedence;

        // If same scope, use permission_id as stable tiebreaker
        if (scopeDiff !== 0) return scopeDiff;
        return String(a.permission_id).localeCompare(String(b.permission_id));
      });

      // Apply overrides in order (later overrides win)
      sortedOverrides.forEach((override) => {
        const slug = permissionMap.get(override.permission_id);
        if (!slug) return;

        if (override.allowed) {
          // Grant permission
          permissionSet.add(slug);
        } else {
          // Deny permission (remove it)
          permissionSet.delete(slug);
        }
      });

      return Array.from(permissionSet).sort(); // Sort for deterministic results
    } catch {
      // Silent fail for unexpected errors
      return [];
    }
  }

  /**
   * Check if a permission exists in the permissions array
   *
   * Supports wildcard matching:
   * - "warehouse.*" matches "warehouse.products.read"
   * - "warehouse.products.*" matches "warehouse.products.read"
   * - "*" matches everything
   *
   * @param permissions - Array of permission slugs
   * @param requiredPermission - Permission to check for
   * @returns True if permission exists or matches a wildcard
   *
   * @example
   * ```typescript
   * const permissions = ["warehouse.*", "teams.members.read"];
   *
   * PermissionService.can(permissions, "warehouse.products.read"); // true (wildcard)
   * PermissionService.can(permissions, "teams.members.read");      // true (exact)
   * PermissionService.can(permissions, "teams.members.create");    // false
   * ```
   */
  static can(permissions: string[], requiredPermission: string): boolean {
    if (permissions.length === 0) {
      return false;
    }

    // Check for exact match first
    if (permissions.includes(requiredPermission)) {
      return true;
    }

    // Check for wildcard matches
    return permissions.some((permission) => {
      if (!permission.includes("*")) {
        return false;
      }

      // Convert wildcard pattern to regex
      // Escape special regex characters except *
      const pattern = permission
        .replace(/[.+?^${}()|[\]\\]/g, "\\$&") // Escape regex special chars
        .replace(/\*/g, ".*"); // Convert * to .*

      const regex = new RegExp(`^${pattern}$`);
      return regex.test(requiredPermission);
    });
  }
}
