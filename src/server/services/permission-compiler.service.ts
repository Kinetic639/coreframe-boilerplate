/**
 * Permission Compiler Service
 *
 * Compiles role assignments into explicit permission facts stored in `user_effective_permissions`.
 *
 * **Architecture: "Compile, don't evaluate"**
 *
 * This follows the enterprise pattern used by GitHub, Notion, and Slack:
 * - Permissions are compiled at write-time (when roles/assignments change)
 * - RLS policies do simple existence checks
 * - No wildcards, no deny-first logic at runtime
 *
 * **When to call the compiler:**
 * - After user creates organization (assign org_owner → compile)
 * - After invitation is accepted (assign org_member → compile)
 * - After role assignment changes (add/remove role → compile)
 * - After role permissions are modified (edit role → compile all users with that role)
 *
 * @example
 * ```typescript
 * import { PermissionCompiler } from "@/server/services/permission-compiler.service";
 *
 * // After assigning a role to a user
 * await PermissionCompiler.compileForUser(supabase, userId, organizationId);
 *
 * // After modifying a role's permissions
 * await PermissionCompiler.recompileForRole(supabase, roleId);
 *
 * // After modifying permissions for all users in an org
 * await PermissionCompiler.recompileForOrganization(supabase, organizationId);
 * ```
 */

import { SupabaseClient } from "@supabase/supabase-js";

export interface CompileResult {
  success: boolean;
  permissionCount: number;
  error?: string;
}

export interface RecompileResult {
  success: boolean;
  usersUpdated: number;
  errors?: string[];
}

export class PermissionCompiler {
  /**
   * Compile all effective permissions for a user in an organization.
   *
   * Algorithm:
   * 1. Get all role assignments for (user, org) - both org and branch scoped
   * 2. Get all permission slugs from those roles via role_permissions
   * 3. Delete existing compiled permissions for (user, org)
   * 4. Insert new compiled permission rows
   *
   * @param supabase - Supabase client (must have permission to write to user_effective_permissions)
   * @param userId - User ID to compile permissions for
   * @param organizationId - Organization ID context
   * @returns CompileResult with success status and permission count
   *
   * @example
   * ```typescript
   * // After user creates org and gets org_owner role
   * const result = await PermissionCompiler.compileForUser(
   *   supabaseAdmin, // Use admin client for service operations
   *   userId,
   *   organizationId
   * );
   *
   * if (result.success) {
   *   console.log(`Compiled ${result.permissionCount} permissions`);
   * } else {
   *   console.error(`Failed to compile: ${result.error}`);
   * }
   * ```
   */
  static async compileForUser(
    supabase: SupabaseClient,
    userId: string,
    organizationId: string
  ): Promise<CompileResult> {
    try {
      // 1. Get all role assignments for this user in this org
      // Include both org-scoped and branch-scoped assignments
      const { data: assignments, error: assignErr } = await supabase
        .from("user_role_assignments")
        .select(
          `
          role_id,
          scope,
          scope_id,
          branches!left(organization_id)
        `
        )
        .eq("user_id", userId)
        .is("deleted_at", null);

      if (assignErr) {
        console.error("[PermissionCompiler] Failed to fetch role assignments:", assignErr);
        return { success: false, permissionCount: 0, error: assignErr.message };
      }

      // Filter assignments to only those for this organization
      // - org scope: scope_id must match organizationId
      // - branch scope: the branch's organization_id must match
      const relevantAssignments = (assignments ?? []).filter((a) => {
        if (a.scope === "org") {
          return a.scope_id === organizationId;
        }
        if (a.scope === "branch") {
          // Branch belongs to this org
          return a.branches?.organization_id === organizationId;
        }
        return false;
      });

      const roleIds = [...new Set(relevantAssignments.map((a) => a.role_id))];

      // If no roles, clear permissions and return
      if (roleIds.length === 0) {
        const { error: deleteErr } = await supabase
          .from("user_effective_permissions")
          .delete()
          .eq("user_id", userId)
          .eq("organization_id", organizationId);

        if (deleteErr) {
          console.error("[PermissionCompiler] Failed to clear permissions:", deleteErr);
          return { success: false, permissionCount: 0, error: deleteErr.message };
        }

        return { success: true, permissionCount: 0 };
      }

      // 2. Get all permission slugs from the assigned roles
      const { data: rolePerms, error: permErr } = await supabase
        .from("role_permissions")
        .select(
          `
          permission_id,
          permissions!inner(slug)
        `
        )
        .in("role_id", roleIds)
        .is("deleted_at", null);

      if (permErr) {
        console.error("[PermissionCompiler] Failed to fetch role permissions:", permErr);
        return { success: false, permissionCount: 0, error: permErr.message };
      }

      // Extract unique permission slugs
      const permissionSlugs = [
        ...new Set(
          (rolePerms ?? [])
            .map((rp: { permissions: { slug: string } | null }) => rp.permissions?.slug)
            .filter((slug): slug is string => typeof slug === "string")
        ),
      ];

      // 3. Delete existing compiled permissions for this user+org
      const { error: deleteErr } = await supabase
        .from("user_effective_permissions")
        .delete()
        .eq("user_id", userId)
        .eq("organization_id", organizationId);

      if (deleteErr) {
        console.error("[PermissionCompiler] Failed to delete old permissions:", deleteErr);
        return { success: false, permissionCount: 0, error: deleteErr.message };
      }

      // 4. Insert new compiled permissions
      if (permissionSlugs.length > 0) {
        const now = new Date().toISOString();
        const rows = permissionSlugs.map((slug) => ({
          user_id: userId,
          organization_id: organizationId,
          permission_slug: slug,
          source_type: "role",
          compiled_at: now,
        }));

        const { error: insertErr } = await supabase.from("user_effective_permissions").insert(rows);

        if (insertErr) {
          console.error("[PermissionCompiler] Failed to insert permissions:", insertErr);
          return { success: false, permissionCount: 0, error: insertErr.message };
        }
      }

      console.log(
        `[PermissionCompiler] Compiled ${permissionSlugs.length} permissions for user ${userId} in org ${organizationId}`
      );

      return { success: true, permissionCount: permissionSlugs.length };
    } catch (error) {
      console.error("[PermissionCompiler] Unexpected error:", error);
      return {
        success: false,
        permissionCount: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Recompile permissions for all users who have a specific role.
   *
   * Call this when a role's permissions are modified (add/remove permissions from role).
   *
   * @param supabase - Supabase client
   * @param roleId - Role ID that was modified
   * @returns RecompileResult with users updated count
   *
   * @example
   * ```typescript
   * // After adding/removing permissions from a role
   * const result = await PermissionCompiler.recompileForRole(supabaseAdmin, roleId);
   * console.log(`Updated ${result.usersUpdated} users`);
   * ```
   */
  static async recompileForRole(
    supabase: SupabaseClient,
    roleId: string
  ): Promise<RecompileResult> {
    try {
      // Get all users who have this role
      const { data: assignments, error: fetchErr } = await supabase
        .from("user_role_assignments")
        .select("user_id, scope_id, scope, branches!left(organization_id)")
        .eq("role_id", roleId)
        .is("deleted_at", null);

      if (fetchErr) {
        console.error("[PermissionCompiler] Failed to fetch role assignments:", fetchErr);
        return { success: false, usersUpdated: 0, errors: [fetchErr.message] };
      }

      if (!assignments?.length) {
        return { success: true, usersUpdated: 0 };
      }

      // Build unique user+org combinations
      const userOrgPairs = new Map<string, { userId: string; orgId: string }>();

      for (const assignment of assignments) {
        const orgId =
          assignment.scope === "org" ? assignment.scope_id : assignment.branches?.organization_id;

        if (!orgId) continue;

        const key = `${assignment.user_id}:${orgId}`;
        if (!userOrgPairs.has(key)) {
          userOrgPairs.set(key, { userId: assignment.user_id, orgId });
        }
      }

      // Compile for each unique user+org
      const errors: string[] = [];
      let usersUpdated = 0;

      for (const { userId, orgId } of userOrgPairs.values()) {
        const result = await this.compileForUser(supabase, userId, orgId);
        if (result.success) {
          usersUpdated++;
        } else if (result.error) {
          errors.push(`User ${userId}: ${result.error}`);
        }
      }

      return {
        success: errors.length === 0,
        usersUpdated,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      console.error("[PermissionCompiler] Unexpected error in recompileForRole:", error);
      return {
        success: false,
        usersUpdated: 0,
        errors: [error instanceof Error ? error.message : "Unknown error"],
      };
    }
  }

  /**
   * Recompile permissions for all users in an organization.
   *
   * Call this when organization-wide permission changes occur.
   *
   * @param supabase - Supabase client
   * @param organizationId - Organization ID
   * @returns RecompileResult with users updated count
   *
   * @example
   * ```typescript
   * // After bulk permission changes
   * const result = await PermissionCompiler.recompileForOrganization(supabaseAdmin, orgId);
   * console.log(`Updated ${result.usersUpdated} users`);
   * ```
   */
  static async recompileForOrganization(
    supabase: SupabaseClient,
    organizationId: string
  ): Promise<RecompileResult> {
    try {
      // Get all active members of the organization
      const { data: members, error: fetchErr } = await supabase
        .from("organization_members")
        .select("user_id")
        .eq("organization_id", organizationId)
        .eq("status", "active")
        .is("deleted_at", null);

      if (fetchErr) {
        console.error("[PermissionCompiler] Failed to fetch org members:", fetchErr);
        return { success: false, usersUpdated: 0, errors: [fetchErr.message] };
      }

      if (!members?.length) {
        return { success: true, usersUpdated: 0 };
      }

      // Compile for each member
      const errors: string[] = [];
      let usersUpdated = 0;

      for (const member of members) {
        const result = await this.compileForUser(supabase, member.user_id, organizationId);
        if (result.success) {
          usersUpdated++;
        } else if (result.error) {
          errors.push(`User ${member.user_id}: ${result.error}`);
        }
      }

      return {
        success: errors.length === 0,
        usersUpdated,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      console.error("[PermissionCompiler] Unexpected error in recompileForOrganization:", error);
      return {
        success: false,
        usersUpdated: 0,
        errors: [error instanceof Error ? error.message : "Unknown error"],
      };
    }
  }
}
