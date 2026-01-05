import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Permission Service
 *
 * Provides utilities for fetching and validating user permissions.
 * Combines role-based permissions with user-specific overrides.
 *
 * @example
 * ```typescript
 * const permissions = await PermissionService.getPermissionsForUser(supabase, userId, orgId);
 * const canRead = PermissionService.can(permissions, "warehouse.products.read");
 * const canManage = PermissionService.can(permissions, "warehouse.*");
 * ```
 */
export class PermissionService {
  /**
   * Get all permissions for a user within an organization
   *
   * Combines:
   * 1. Role-based permissions from user_role_assignments
   * 2. User-specific permission overrides
   *
   * @param supabase - Supabase client instance
   * @param userId - User ID to fetch permissions for
   * @param orgId - Organization ID context
   * @returns Array of permission slugs (e.g., ["warehouse.products.read", "warehouse.*"])
   *
   * @example
   * ```typescript
   * const permissions = await PermissionService.getPermissionsForUser(
   *   supabase,
   *   "user-123",
   *   "org-456"
   * );
   * // ["warehouse.products.read", "warehouse.products.create"]
   * ```
   */
  static async getPermissionsForUser(
    supabase: SupabaseClient,
    userId: string,
    orgId: string
  ): Promise<string[]> {
    try {
      // 1. Get user's role assignments for this org
      const { data: roleAssignments, error: roleError } = await supabase
        .from("user_role_assignments")
        .select("role_id, scope, scope_id")
        .eq("user_id", userId)
        .or(`scope_id.eq.${orgId}`)
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
      // The RPC can return strings directly or objects with slug property
      const basePermissions = (permissionsData ?? [])
        .map((p: any) => {
          if (typeof p === "string") return p;
          if (p?.slug) return p.slug;
          if (p?.get_permissions_for_roles) return p.get_permissions_for_roles;
          return null;
        })
        .filter((slug: string | null): slug is string => typeof slug === "string");

      // 3. Get permission overrides for this user/org
      const { data: overrides, error: overrideError } = await supabase
        .from("user_permission_overrides")
        .select("permission_id, allowed")
        .eq("user_id", userId)
        .eq("scope_id", orgId)
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

      // 5. Apply overrides
      const permissionSet = new Set<string>(basePermissions);

      overrides.forEach((override) => {
        const slug = permissionMap.get(override.permission_id);
        if (!slug) return;

        if (override.allowed) {
          // Grant permission
          permissionSet.add(slug);
        } else {
          // Deny permission
          permissionSet.delete(slug);
        }
      });

      return Array.from(permissionSet);
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
