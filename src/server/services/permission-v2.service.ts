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
 * **Wildcards in UEP — critical for callers**
 *
 * The DB compiler (`compile_user_permissions`) inserts `permissions.slug` verbatim —
 * it does NOT expand wildcards. UEP rows may contain `account.*`, `module.*`, etc.
 *
 * | Check type | Method | Wildcard-aware? | Scope |
 * |---|---|---|---|
 * | Client/SSR snapshot | `checkPermission(snapshot, slug)` | ✅ YES | org + branch |
 * | DB RPC (current user) | `has_permission(org_id, slug)` | ❌ exact match | org-only (`branch_id IS NULL`) |
 * | DB RPC (explicit user) | `user_has_effective_permission(uid, org_id, slug)` | ❌ exact match | org-only (`branch_id IS NULL`) |
 *
 * **Rule**: Always use `checkPermission(snapshot, requiredSlug)` at runtime.
 * The RPC helpers are only appropriate for simple exact-match org-level gates where
 * you know the slug will never be a wildcard (e.g. feature-flag checks).
 *
 * @example
 * ```typescript
 * import { PermissionServiceV2 } from "@/server/services/permission-v2.service";
 *
 * // Get org-scope effective permissions for user
 * const permissions = await PermissionServiceV2.getOrgEffectivePermissions(supabase, userId, orgId);
 * // Returns: Set<string> { "org.read", "branches.read", "members.manage", "account.*", ... }
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
import type { PermissionSnapshot } from "@/lib/types/permissions";
import { checkPermission } from "@/lib/utils/permissions";

export class PermissionServiceV2 {
  /**
   * Get org-scope effective permissions for a user (Set form).
   *
   * Reads only org-scope rows (`branch_id IS NULL`) from the compiled UEP table.
   * Branch-scoped permission rows are excluded by design — use
   * `getPermissionSnapshotForUser` when branch context is needed.
   *
   * @param supabase - Supabase client
   * @param userId - User ID
   * @param orgId - Organization ID
   * @returns Set of org-scope permission slugs (wildcards preserved as-is)
   */
  static async getOrgEffectivePermissions(
    supabase: SupabaseClient,
    userId: string,
    orgId: string
  ): Promise<Set<string>> {
    const { data, error } = await supabase
      .from("user_effective_permissions")
      .select("permission_slug")
      .eq("user_id", userId)
      .eq("organization_id", orgId)
      .is("branch_id", null);

    if (error) {
      console.error("[PermissionServiceV2] Failed to fetch org effective permissions:", error);
      return new Set();
    }

    return new Set((data ?? []).map((row) => row.permission_slug));
  }

  /**
   * Get org-scope effective permissions as a sorted array (for serialization).
   *
   * Reads only org-scope rows (`branch_id IS NULL`) from the compiled UEP table.
   * Wildcard slugs (e.g. `account.*`, `module.*`) are preserved as-is — use
   * `checkPermission` for wildcard-aware checks, not exact string matching.
   *
   * @param supabase - Supabase client
   * @param userId - User ID
   * @param orgId - Organization ID
   * @returns Sorted array of org-scope permission slugs
   */
  static async getOrgEffectivePermissionsArray(
    supabase: SupabaseClient,
    userId: string,
    orgId: string
  ): Promise<string[]> {
    const { data, error } = await supabase
      .from("user_effective_permissions")
      .select("permission_slug")
      .eq("user_id", userId)
      .eq("organization_id", orgId)
      .is("branch_id", null);

    if (error) {
      console.error("[PermissionServiceV2] Failed to fetch org effective permissions:", error);
      return [];
    }

    return (data ?? []).map((row) => row.permission_slug).sort();
  }

  /**
   * Get permission snapshot from compiled UEP — branch-aware.
   *
   * Mirrors the DB `has_branch_permission(org_id, branch_id, slug)` semantics:
   *   - Org-wide rows (branch_id IS NULL) are always included.
   *   - When branchId is set, rows for that exact branch are also included.
   *   - When branchId is null/undefined, only org-wide rows are returned
   *     (mirrors `has_permission` org-only semantics).
   *
   * Deny is always empty: deny overrides are resolved at compile time by
   * `compile_user_permissions` and are never written into UEP.
   *
   * Fail-closed: on query error or missing orgId returns empty allow[].
   *
   * @param supabase - Supabase client
   * @param userId - User ID
   * @param orgId - Organization ID
   * @param branchId - Active branch ID (null/undefined = org-scope only)
   * @returns PermissionSnapshot with allow array and empty deny array
   */
  static async getPermissionSnapshotForUser(
    supabase: SupabaseClient,
    userId: string,
    orgId: string,
    branchId?: string | null
  ): Promise<PermissionSnapshot> {
    if (!orgId) return { allow: [], deny: [] };

    // Build base query
    const baseQuery = supabase
      .from("user_effective_permissions")
      .select("permission_slug")
      .eq("user_id", userId)
      .eq("organization_id", orgId);

    // Branch-aware filter: mirrors has_branch_permission semantics
    //   branchId set   → branch_id IS NULL OR branch_id = branchId
    //   branchId unset → branch_id IS NULL (org-only, mirrors has_permission)
    const { data, error } = await (branchId
      ? baseQuery.or(`branch_id.is.null,branch_id.eq.${branchId}`)
      : baseQuery.is("branch_id", null));

    if (error) {
      console.error("[PermissionServiceV2] Failed to fetch branch-aware permissions:", error);
      return { allow: [], deny: [] };
    }

    const allow = [...new Set((data ?? []).map((r) => r.permission_slug))].sort();
    return { allow, deny: [] };
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
   * Uses the canonical `has_permission` database function that checks auth.uid() internally.
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
    // Use canonical has_permission function (uses auth.uid() internally)
    const { data, error } = await supabase.rpc("has_permission", {
      org_id: orgId,
      permission: permission,
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
   * Uses the canonical `is_org_member` database function for tenant boundary checks.
   *
   * @param supabase - Supabase client
   * @param orgId - Organization ID
   * @returns True if current user is an active member
   */
  static async currentUserIsOrgMember(supabase: SupabaseClient, orgId: string): Promise<boolean> {
    // Use canonical is_org_member function (uses auth.uid() internally)
    const { data, error } = await supabase.rpc("is_org_member", {
      org_id: orgId,
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
   * Check permission against a PermissionSnapshot.
   *
   * @deprecated Use `checkPermission(snapshot, slug)` from `@/lib/utils/permissions` instead.
   *   This method delegates to `checkPermission` and is kept only for backwards compatibility.
   *   `checkPermission` is wildcard-aware and deny-first; this method is now equivalent.
   *
   * **Why this was unsafe before**: The original implementation used `Array.includes()`,
   * which is NOT wildcard-aware. A snapshot with `allow: ["warehouse.*"]` would return
   * `false` for `canFromSnapshot(snap, "warehouse.products.read")`.
   *
   * **Now fixed**: Delegates to `checkPermission(snapshot, permission)` from the utility,
   * which correctly matches wildcards using regex and applies deny-first semantics.
   *
   * @param snapshot - Permission snapshot with allow/deny arrays
   * @param permission - Permission slug to check
   * @returns True if permission is allowed (wildcard-aware, deny-first)
   */
  /** @deprecated Use `checkPermission(snapshot, slug)` from `@/lib/utils/permissions` */
  static canFromSnapshot(snapshot: PermissionSnapshot, permission: string): boolean {
    return checkPermission(snapshot, permission);
  }
}
