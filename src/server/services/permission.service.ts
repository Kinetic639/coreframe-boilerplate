import { SupabaseClient } from "@supabase/supabase-js";
import type { PermissionSnapshot } from "@/lib/types/permissions";
import { checkPermission, matchesAnyPattern } from "@/lib/utils/permissions";

export type { PermissionSnapshot };

/**
 * Permission Service
 *
 * Provides utilities for fetching and validating user permissions with full scope support.
 * Combines role-based permissions with user-specific overrides.
 * Supports both organization-wide and branch-specific permissions.
 *
 * **IMPORTANT:** Returns PermissionSnapshot with separate allow/deny lists to support
 * deny overrides with wildcard permissions.
 *
 * @example
 * ```typescript
 * // Org-level permissions only
 * const orgPerms = await PermissionService.getPermissionSnapshotForUser(supabase, userId, orgId);
 *
 * // Branch-level permissions (includes org + branch roles)
 * const branchPerms = await PermissionService.getPermissionSnapshotForUser(supabase, userId, orgId, branchId);
 *
 * const canRead = PermissionService.can(branchPerms, "warehouse.products.read");
 * const canManage = PermissionService.can(branchPerms, "warehouse.*");
 * ```
 */
export class PermissionService {
  /**
   * Get permission snapshot for a user within an organization (and optionally a branch)
   *
   * Combines:
   * 1. Role-based permissions from user_role_assignments (org + optional branch scopes)
   * 2. User-specific permission overrides (with proper scope precedence)
   *
   * Permission precedence:
   * 1. Base permissions from roles (org + optional branch)
   * 2. Overrides: branch > org > global (higher scope wins)
   * 3. For same scope+slug: newest created_at wins
   *
   * @param supabase - Supabase client instance
   * @param userId - User ID to fetch permissions for
   * @param orgId - Organization ID context
   * @param branchId - Optional branch ID context (if omitted, only org-scoped permissions)
   * @returns PermissionSnapshot with allow and deny lists
   *
   * @example
   * ```typescript
   * // Org-only context
   * const orgPermissions = await PermissionService.getPermissionSnapshotForUser(
   *   supabase,
   *   "user-123",
   *   "org-456"
   * );
   *
   * // Branch context (includes org + branch permissions)
   * const branchPermissions = await PermissionService.getPermissionSnapshotForUser(
   *   supabase,
   *   "user-123",
   *   "org-456",
   *   "branch-789"
   * );
   * ```
   */
  static async getPermissionSnapshotForUser(
    supabase: SupabaseClient,
    userId: string,
    orgId: string,
    branchId?: string | null
  ): Promise<PermissionSnapshot> {
    try {
      // 1. Get user's role assignments using explicit queries (not .or() DSL)
      const roleIds = new Set<string>();

      // Query org roles
      const { data: orgRoles, error: orgErr } = await supabase
        .from("user_role_assignments")
        .select("role_id")
        .eq("user_id", userId)
        .eq("scope", "org")
        .eq("scope_id", orgId)
        .is("deleted_at", null);

      if (orgErr) {
        if (process.env.NODE_ENV === "development") {
          console.error("[PermissionService] Org roles query failed:", orgErr);
        }
        return { allow: [], deny: [] };
      }

      (orgRoles ?? []).forEach((r) => roleIds.add(r.role_id));

      // Query branch roles (if branch context provided)
      if (branchId) {
        const { data: branchRoles, error: branchErr } = await supabase
          .from("user_role_assignments")
          .select("role_id")
          .eq("user_id", userId)
          .eq("scope", "branch")
          .eq("scope_id", branchId)
          .is("deleted_at", null);

        if (branchErr) {
          if (process.env.NODE_ENV === "development") {
            console.error("[PermissionService] Branch roles query failed:", branchErr);
          }
          return { allow: [], deny: [] };
        }

        (branchRoles ?? []).forEach((r) => roleIds.add(r.role_id));
      }

      // 2. Get base allow permissions from roles via RPC
      let allow: string[] = [];

      if (roleIds.size > 0) {
        const { data, error } = await supabase.rpc("get_permissions_for_roles", {
          role_ids: Array.from(roleIds),
        });

        if (error) {
          if (process.env.NODE_ENV === "development") {
            console.error("[PermissionService] RPC failed:", error);
          }
          return { allow: [], deny: [] };
        }

        // RPC returns SETOF text => string[]
        allow = (data ?? []).filter((x: any): x is string => typeof x === "string");
      }

      // 3. Get overrides with join to permissions (single query, no N+1)
      // Fetch overrides for relevant scopes only (avoid pulling branch overrides when no branch context)
      const scopeFilter = branchId ? ["global", "org", "branch"] : ["global", "org"];
      const { data: overrides, error: ovErr } = await supabase
        .from("user_permission_overrides")
        .select("allowed, scope, scope_id, created_at, permissions!inner(slug)")
        .eq("user_id", userId)
        .in("scope", scopeFilter)
        .is("deleted_at", null);

      if (ovErr) {
        if (process.env.NODE_ENV === "development") {
          console.error("[PermissionService] Override query failed:", {
            orgId,
            branchId,
            error: ovErr,
          });
        }
        return { allow: uniqSorted(allow), deny: [] };
      }

      if (!overrides?.length) {
        return { allow: uniqSorted(allow), deny: [] };
      }

      // 4. Filter overrides to only relevant scope_ids
      const relevantOverrides = (overrides as any[]).filter((o) => {
        if (o.scope === "global") return true; // No scope_id check for global
        if (o.scope === "org") return o.scope_id === orgId;
        if (o.scope === "branch") return o.scope_id === branchId;
        return false;
      });

      // 5. Apply overrides with precedence: branch > org > global; for same scope newest created_at wins
      // Use Map to track highest-precedence override per slug (no pre-sorting needed)
      const scopeRank: Record<string, number> = { global: 1, org: 2, branch: 3 };
      const deny: string[] = [];

      // Track which permission slugs have been overridden
      // Key: slug, Value: {rank, allowed, created_at}
      const overrideMap = new Map<string, { rank: number; allowed: boolean; created_at: number }>();

      // Process overrides: compute (rank, created_at) and keep "max" per slug
      for (const o of relevantOverrides as any[]) {
        const slug = o.permissions?.slug;
        if (!slug) continue;

        const rank = scopeRank[o.scope] ?? 0;
        const createdAt = new Date(o.created_at || 0).getTime();
        const existing = overrideMap.get(slug);

        // Keep this override if: (1) no existing, (2) higher rank, (3) same rank but newer
        if (
          !existing ||
          rank > existing.rank ||
          (rank === existing.rank && createdAt > existing.created_at)
        ) {
          overrideMap.set(slug, { rank, allowed: o.allowed, created_at: createdAt });
        }
      }

      // Apply final overrides to allow/deny arrays
      for (const [slug, override] of overrideMap.entries()) {
        if (override.allowed) {
          allow.push(slug);
        } else {
          deny.push(slug);
        }
      }

      return { allow: uniqSorted(allow), deny: uniqSorted(deny) };
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("[PermissionService] Unexpected error:", error);
      }
      return { allow: [], deny: [] };
    }
  }

  /**
   * Check if a permission exists in the permission snapshot
   *
   * Uses deny-first semantics:
   * 1. Check if denied (including wildcard matches) -> false
   * 2. Check if allowed (including wildcard matches) -> true
   * 3. Otherwise -> false
   *
   * Supports wildcard matching:
   * - "warehouse.*" matches "warehouse.products.read"
   * - "warehouse.products.*" matches "warehouse.products.read"
   * - "*" matches everything
   *
   * **NOTE:** This method now delegates to shared permission utilities
   * to ensure consistent behavior between client and server.
   *
   * @param snapshot - Permission snapshot with allow and deny lists
   * @param requiredPermission - Permission to check for
   * @returns True if permission is allowed and not denied
   *
   * @example
   * ```typescript
   * const snapshot = {
   *   allow: ["warehouse.*", "teams.members.read"],
   *   deny: ["warehouse.products.delete"]
   * };
   *
   * PermissionService.can(snapshot, "warehouse.products.read");   // true (allow wildcard)
   * PermissionService.can(snapshot, "warehouse.products.delete"); // false (explicit deny)
   * PermissionService.can(snapshot, "teams.members.read");        // true (exact allow)
   * PermissionService.can(snapshot, "teams.members.create");      // false (not allowed)
   * ```
   */
  static can(snapshot: PermissionSnapshot, requiredPermission: string): boolean {
    // Delegate to shared utility (with regex cache, consistent logic)
    return checkPermission(snapshot, requiredPermission);
  }

  /**
   * LEGACY METHOD - For backwards compatibility
   * @deprecated Use getPermissionSnapshotForUser() instead
   *
   * **WARNING - UNSAFE WITH WILDCARDS:**
   * This method returns string[] instead of PermissionSnapshot, which cannot
   * properly handle wildcard permissions in deny lists.
   *
   * **Critical Bug Example:**
   * - allow: ["warehouse.*"]
   * - deny: ["warehouse.products.delete"]
   * - Returns: ["warehouse.*"] ❌
   * - UI may incorrectly allow "warehouse.products.delete"
   *
   * **Migration Path:**
   * Replace usage with getPermissionSnapshotForUser() and checkPermission():
   * ```typescript
   * // OLD (unsafe):
   * const perms = await PermissionService.getPermissionsForUser(...);
   * const canDelete = perms.includes("warehouse.products.delete");
   *
   * // NEW (safe):
   * const snapshot = await PermissionService.getPermissionSnapshotForUser(...);
   * const canDelete = PermissionService.can(snapshot, "warehouse.products.delete");
   * ```
   *
   * This maintains backwards compatibility by returning string[] instead of snapshot.
   */
  static async getPermissionsForUser(
    supabase: SupabaseClient,
    userId: string,
    orgId: string,
    branchId?: string | null
  ): Promise<string[]> {
    const snapshot = await this.getPermissionSnapshotForUser(supabase, userId, orgId, branchId);

    // UNSAFE: This filter doesn't work correctly with wildcards
    // If allow contains "warehouse.*" and deny contains "warehouse.products.delete",
    // this will still return "warehouse.*" because matchesAnyPattern(deny, "warehouse.*") is false
    //
    // The correct check would be to expand wildcards or just return the snapshot,
    // but that would break the API contract of returning string[]
    return snapshot.allow.filter((permission) => {
      // Check if this exact permission slug is denied
      return !matchesAnyPattern(snapshot.deny, permission);
    });
  }
}

// Helper functions

/**
 * Remove duplicates and sort array
 */
function uniqSorted(arr: string[]): string[] {
  return Array.from(new Set(arr)).sort();
}
