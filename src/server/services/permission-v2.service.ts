/**
 * Permission Service V2
 *
 * Simplified permission service that reads from compiled effective permissions.
 *
 * **Architecture: "Compile, don't evaluate"**
 *
 * Unlike the old PermissionService which computed permissions at request time,
 * this service simply reads pre-compiled facts from `user_effective_permissions`.
 *
 * The compiler (database triggers) handles:
 * - Expanding role permissions
 * - Applying overrides (grant/revoke)
 * - Storing the final result
 *
 * This service just reads those facts. Simple.
 *
 * **No wildcards at runtime!**
 * Wildcards are expanded at compile time. The effective permissions table
 * contains only explicit permission slugs.
 *
 * @example
 * ```typescript
 * import { PermissionServiceV2 } from "@/server/services/permission-v2.service";
 *
 * // Get effective permissions for user
 * const permissions = await PermissionServiceV2.getEffectivePermissions(supabase, userId, orgId);
 * // Returns: Set<string> { "org.read", "branches.read", "members.manage", ... }
 *
 * // Check permission
 * if (permissions.has("members.manage")) {
 *   // User can manage members
 * }
 *
 * // Or use the helper
 * const canManage = await PermissionServiceV2.hasPermission(supabase, userId, orgId, "members.manage");
 * ```
 */

import { SupabaseClient } from "@supabase/supabase-js";

// For backwards compatibility with existing code
export interface PermissionSnapshot {
  allow: string[];
  deny: string[]; // Always empty in V2 - kept for interface compatibility
}

export class PermissionServiceV2 {
  /**
   * Get effective permissions for a user in an organization
   *
   * This reads from the compiled `user_effective_permissions` table.
   * No complex logic - just a simple SELECT.
   *
   * @param supabase - Supabase client
   * @param userId - User ID
   * @param orgId - Organization ID
   * @returns Set of permission slugs the user has
   *
   * @example
   * ```typescript
   * const permissions = await PermissionServiceV2.getEffectivePermissions(
   *   supabase,
   *   "user-123",
   *   "org-456"
   * );
   *
   * if (permissions.has("members.manage")) {
   *   // User can manage members
   * }
   * ```
   */
  static async getEffectivePermissions(
    supabase: SupabaseClient,
    userId: string,
    orgId: string
  ): Promise<Set<string>> {
    const { data, error } = await supabase
      .from("user_effective_permissions")
      .select("permission_slug")
      .eq("user_id", userId)
      .eq("organization_id", orgId);

    if (error) {
      console.error("[PermissionServiceV2] Failed to fetch effective permissions:", error);
      return new Set();
    }

    return new Set((data ?? []).map((row) => row.permission_slug));
  }

  /**
   * Get effective permissions as an array (for serialization)
   *
   * Same as getEffectivePermissions but returns an array instead of Set.
   * Useful for passing to frontend via server actions.
   *
   * @param supabase - Supabase client
   * @param userId - User ID
   * @param orgId - Organization ID
   * @returns Array of permission slugs
   */
  static async getEffectivePermissionsArray(
    supabase: SupabaseClient,
    userId: string,
    orgId: string
  ): Promise<string[]> {
    const { data, error } = await supabase
      .from("user_effective_permissions")
      .select("permission_slug")
      .eq("user_id", userId)
      .eq("organization_id", orgId);

    if (error) {
      console.error("[PermissionServiceV2] Failed to fetch effective permissions:", error);
      return [];
    }

    return (data ?? []).map((row) => row.permission_slug).sort();
  }

  /**
   * Get permission snapshot for backwards compatibility with V1 code
   *
   * Returns a PermissionSnapshot with allow list populated and deny list empty.
   * In V2, deny logic is handled at compile time, not runtime.
   *
   * @param supabase - Supabase client
   * @param userId - User ID
   * @param orgId - Organization ID
   * @param _branchId - Ignored in V2 (kept for API compatibility)
   * @returns PermissionSnapshot with allow array and empty deny array
   */
  static async getPermissionSnapshotForUser(
    supabase: SupabaseClient,
    userId: string,
    orgId: string,
    _branchId?: string | null
  ): Promise<PermissionSnapshot> {
    const permissions = await this.getEffectivePermissionsArray(supabase, userId, orgId);

    return {
      allow: permissions,
      deny: [], // V2: Deny is handled at compile time
    };
  }

  /**
   * Check if a user has a specific permission
   *
   * Uses the database function for efficient server-side checks.
   *
   * @param supabase - Supabase client
   * @param userId - User ID
   * @param orgId - Organization ID
   * @param permission - Permission slug to check
   * @returns True if user has the permission
   *
   * @example
   * ```typescript
   * const canManage = await PermissionServiceV2.hasPermission(
   *   supabase,
   *   "user-123",
   *   "org-456",
   *   "members.manage"
   * );
   *
   * if (!canManage) {
   *   throw new Error("Unauthorized");
   * }
   * ```
   */
  static async hasPermission(
    supabase: SupabaseClient,
    userId: string,
    orgId: string,
    permission: string
  ): Promise<boolean> {
    const { data, error } = await supabase.rpc("user_has_effective_permission", {
      p_user_id: userId,
      p_organization_id: orgId,
      p_permission_slug: permission,
    });

    if (error) {
      console.error("[PermissionServiceV2] Failed to check permission:", error);
      return false;
    }

    return data === true;
  }

  /**
   * Check if current authenticated user has a specific permission
   *
   * Uses the database function that checks auth.uid() internally.
   * More efficient than fetching all permissions.
   *
   * @param supabase - Supabase client
   * @param orgId - Organization ID
   * @param permission - Permission slug to check
   * @returns True if current user has the permission
   */
  static async currentUserHasPermission(
    supabase: SupabaseClient,
    orgId: string,
    permission: string
  ): Promise<boolean> {
    const { data, error } = await supabase.rpc("current_user_has_permission", {
      p_organization_id: orgId,
      p_permission_slug: permission,
    });

    if (error) {
      console.error("[PermissionServiceV2] Failed to check current user permission:", error);
      return false;
    }

    return data === true;
  }

  /**
   * Check if current user is an active member of an organization
   *
   * Uses the database function for tenant boundary checks.
   *
   * @param supabase - Supabase client
   * @param orgId - Organization ID
   * @returns True if current user is an active member
   */
  static async currentUserIsOrgMember(supabase: SupabaseClient, orgId: string): Promise<boolean> {
    const { data, error } = await supabase.rpc("current_user_is_org_member", {
      p_organization_id: orgId,
    });

    if (error) {
      console.error("[PermissionServiceV2] Failed to check org membership:", error);
      return false;
    }

    return data === true;
  }

  /**
   * Static permission check (for use with already-fetched permissions)
   *
   * Simple Set membership check - no wildcards, no logic.
   *
   * @param permissions - Set of permissions
   * @param permission - Permission to check
   * @returns True if permission exists in set
   */
  static can(permissions: Set<string>, permission: string): boolean {
    return permissions.has(permission);
  }

  /**
   * Check permission against a PermissionSnapshot (V1 compatibility)
   *
   * @param snapshot - Permission snapshot
   * @param permission - Permission to check
   * @returns True if permission is in allow list
   */
  static canFromSnapshot(snapshot: PermissionSnapshot, permission: string): boolean {
    return snapshot.allow.includes(permission);
  }
}
