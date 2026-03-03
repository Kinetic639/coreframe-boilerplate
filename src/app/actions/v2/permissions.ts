"use server";

import { createClient } from "@/utils/supabase/server";
import { PermissionService } from "@/server/services/permission.service";
import { PermissionServiceV2 } from "@/server/services/permission-v2.service";
import type { PermissionSnapshot } from "@/lib/types/permissions";

/**
 * Server action to fetch permissions for a given org/branch context
 *
 * Uses branch-aware dynamic permission lookup (PermissionService) so that
 * branch-scoped role assignments are included in the result. This keeps
 * PermissionsSync consistent with the SSR-computed permission snapshot.
 *
 * @param orgId - Organization ID
 * @param branchId - Branch ID — passed to PermissionService for branch-scoped role lookup
 * @returns Object with permissions snapshot (allow array, empty deny array)
 *
 * Security: Validates session server-side
 */
export async function getBranchPermissions(
  orgId: string,
  branchId: string | null
): Promise<{ permissions: PermissionSnapshot }> {
  try {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    // Return empty snapshot if no session
    if (!session) {
      return { permissions: { allow: [], deny: [] } };
    }

    // Use branch-aware PermissionService so branch-scoped role permissions are included.
    // PermissionServiceV2 ignores branchId and only returns org-compiled permissions,
    // which causes branch-scoped permissions to be stripped after PermissionsSync fires.
    const permissions = await PermissionService.getPermissionSnapshotForUser(
      supabase,
      session.user.id,
      orgId,
      branchId
    );

    return { permissions };
  } catch (error) {
    console.error("Failed to fetch permissions:", error);
    // Return empty snapshot on error instead of throwing
    return { permissions: { allow: [], deny: [] } };
  }
}

/**
 * Server action to get effective permissions as an array
 *
 * Simpler API for V2 - just returns the permission slugs.
 *
 * @param orgId - Organization ID
 * @returns Array of permission slugs the current user has
 */
export async function getEffectivePermissions(orgId: string): Promise<string[]> {
  try {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return [];
    }

    return await PermissionServiceV2.getEffectivePermissionsArray(supabase, session.user.id, orgId);
  } catch (error) {
    console.error("Failed to fetch effective permissions:", error);
    return [];
  }
}

/**
 * Server action to check if current user has a specific permission
 *
 * More efficient than fetching all permissions when you only need to check one.
 *
 * @param orgId - Organization ID
 * @param permission - Permission slug to check
 * @returns True if user has the permission
 */
export async function checkPermission(orgId: string, permission: string): Promise<boolean> {
  try {
    const supabase = await createClient();

    return await PermissionServiceV2.currentUserHasPermission(supabase, orgId, permission);
  } catch (error) {
    console.error("Failed to check permission:", error);
    return false;
  }
}

/**
 * A single permission entry with scope metadata (for debug panel).
 */
export interface DetailedPermission {
  slug: string;
  scope: "org" | "branch";
  branch_id: string | null;
  branch_name: string | null;
}

/**
 * Server action to get all permission assignments with scope and branch metadata.
 *
 * Used by the debug panel to show per-permission scope and branch context.
 * Queries role assignments directly — org-scoped and branch-scoped separately.
 * Branch names are resolved server-side and included in the result.
 *
 * @param orgId - Organization ID
 * @returns Array of detailed permission entries (slug + scope + branch_id + branch_name)
 */
export async function getDetailedPermissions(orgId: string): Promise<DetailedPermission[]> {
  try {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return [];

    const userId = session.user.id;
    const results: DetailedPermission[] = [];

    // 1. Org-scoped role assignments
    const { data: orgAssignments } = await supabase
      .from("user_role_assignments")
      .select("role_id")
      .eq("user_id", userId)
      .eq("scope", "org")
      .eq("scope_id", orgId)
      .is("deleted_at", null);

    const orgRoleIds = (orgAssignments ?? []).map((a) => a.role_id);

    if (orgRoleIds.length > 0) {
      const { data: orgPerms } = await supabase.rpc("get_permissions_for_roles", {
        role_ids: orgRoleIds,
      });
      const seen = new Set<string>();
      (orgPerms ?? []).forEach((slug: string) => {
        if (!seen.has(slug)) {
          seen.add(slug);
          results.push({ slug, scope: "org", branch_id: null, branch_name: null });
        }
      });
    }

    // 2. Branch-scoped role assignments
    // RLS "View own role assignments" (user_id = auth.uid()) allows this read.
    // We do NOT filter by org here — instead we fetch branch names by scope_id IDs
    // directly (avoiding a separate branches-by-org query that may have stricter RLS).
    const { data: branchAssignments } = await supabase
      .from("user_role_assignments")
      .select("role_id, scope_id")
      .eq("user_id", userId)
      .eq("scope", "branch")
      .is("deleted_at", null);

    if (branchAssignments?.length) {
      // Collect unique branch IDs from this user's branch assignments
      const uniqueBranchIds = [
        ...new Set(branchAssignments.map((a) => a.scope_id).filter(Boolean)),
      ];

      // Resolve branch names and org in a single query by IDs (no org filter needed —
      // we own these scope_ids from user_role_assignments RLS, and we filter by orgId below).
      const { data: branchRows } = await supabase
        .from("branches")
        .select("id, name, organization_id")
        .in("id", uniqueBranchIds);

      // Build id→{name, org} lookup; filter to this org only
      const branchMeta = new Map<string, { name: string; org_id: string }>();
      (branchRows ?? []).forEach((b) => {
        branchMeta.set(b.id, { name: b.name, org_id: b.organization_id });
      });

      // Group role IDs by branch (only for this org's branches)
      const byBranch = new Map<string, { roleIds: string[]; name: string }>();
      for (const a of branchAssignments) {
        if (!a.scope_id) continue;
        const meta = branchMeta.get(a.scope_id);
        if (!meta || meta.org_id !== orgId) continue; // skip cross-org assignments
        const entry = byBranch.get(a.scope_id) ?? { roleIds: [], name: meta.name };
        entry.roleIds.push(a.role_id);
        byBranch.set(a.scope_id, entry);
      }

      for (const [branchId, { roleIds, name }] of byBranch) {
        const { data: branchPerms } = await supabase.rpc("get_permissions_for_roles", {
          role_ids: roleIds,
        });
        const seen = new Set<string>();
        (branchPerms ?? []).forEach((slug: string) => {
          if (!seen.has(slug)) {
            seen.add(slug);
            results.push({ slug, scope: "branch", branch_id: branchId, branch_name: name });
          }
        });
      }
    }

    return results;
  } catch (error) {
    console.error("Failed to fetch detailed permissions:", error);
    return [];
  }
}

/**
 * Server action to check if current user is a member of an organization
 *
 * @param orgId - Organization ID
 * @returns True if user is an active member
 */
export async function checkOrgMembership(orgId: string): Promise<boolean> {
  try {
    const supabase = await createClient();

    return await PermissionServiceV2.currentUserIsOrgMember(supabase, orgId);
  } catch (error) {
    console.error("Failed to check org membership:", error);
    return false;
  }
}
